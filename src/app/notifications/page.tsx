
'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Bell, Check, Trash2, CalendarCheck2, Wrench, AlertTriangle, Clock, CircleEllipsis, CircleCheck, Info, ShieldAlert, Loader2 } from 'lucide-react';
import type { Notification as NotificationType } from '@/types'; // Renamed to avoid conflict
import { useAuth } from '@/components/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { isValid as isValidDateFn, formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore';
import { formatDateSafe } from '@/lib/utils';
import { useRouter } from 'next/navigation';


const getNotificationIcon = (type: NotificationType['type']) => {
  switch (type) {
    case 'booking_confirmed':
    case 'booking_promoted_user':
      return <CalendarCheck2 className="h-5 w-5 text-green-500" />;
    case 'booking_pending_approval':
    case 'booking_promoted_admin':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'booking_rejected':
      return <CircleEllipsis className="h-5 w-5 text-red-500" />;
    case 'booking_waitlisted':
      return <Clock className="h-5 w-5 text-purple-500" />;
    case 'maintenance_new':
    case 'maintenance_assigned':
      return <Wrench className="h-5 w-5 text-blue-500" />;
    case 'maintenance_resolved':
      return <CircleCheck className="h-5 w-5 text-green-500" />;
    case 'signup_approved':
        return <Check className="h-5 w-5 text-green-500" />;
    case 'signup_pending_admin':
        return <ShieldAlert className="h-5 w-5 text-orange-500" />;
    default:
      return <Info className="h-5 w-5 text-gray-500" />;
  }
};

export default function NotificationsPage() {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const [notifications, setNotifications] = useState<NotificationType[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isClearAllAlertOpen, setIsClearAllAlertOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.id) {
      setNotifications([]);
      setIsLoadingNotifications(false);
      return;
    }
    setIsLoadingNotifications(true);
    try {
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("userId", "==", currentUser.id),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(notificationsQuery);
      const fetchedNotifications: NotificationType[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(), // Convert Firestore Timestamp
        } as NotificationType;
      });
      setNotifications(fetchedNotifications);
    } catch (error: any) {
      console.error("Error fetching notifications:", error);
      toast({ title: "Error", description: `Failed to load notifications: ${error.message}`, variant: "destructive" });
      setNotifications([]);
    }
    setIsLoadingNotifications(false);
  }, [currentUser?.id, toast]);

  useEffect(() => {
    if (!authIsLoading && currentUser) { 
        fetchNotifications();
    } else if (!authIsLoading && !currentUser) {
        setIsLoadingNotifications(false);
        setNotifications([]);
    }
  }, [authIsLoading, currentUser, fetchNotifications]);

  const handleMarkAsRead = useCallback(async (id: string) => {
    if (!currentUser?.id) {
        toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive" });
        return;
    }
    try {
      const notifDocRef = doc(db, "notifications", id);
      await updateDoc(notifDocRef, { isRead: true });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error: any) {
      toast({ title: "Error", description: `Could not mark notification as read: ${error.message}`, variant: "destructive"});
    }
  }, [currentUser, toast]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!currentUser?.id) {
        toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive" });
        return;
    }
    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) {
      toast({ title: "No Unread Notifications", description: "All notifications are already marked as read." });
      return;
    }
    
    setIsLoadingNotifications(true);
    try {
      const batch = writeBatch(db);
      unreadNotifications.forEach(notification => {
        const notifDocRef = doc(db, "notifications", notification.id);
        batch.update(notifDocRef, { isRead: true });
      });
      await batch.commit();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast({ title: "All Read", description: "All notifications have been marked as read." });
    } catch (error: any) {
      toast({ title: "Error", description: `Could not mark all notifications as read: ${error.message}`, variant: "destructive"});
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [currentUser, notifications, toast]);
  
  const handleDeleteNotification = useCallback(async (id: string) => {
    if (!currentUser?.id) {
        toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive" });
        return;
    }
     try {
       const notifDocRef = doc(db, "notifications", id);
       await deleteDoc(notifDocRef);
       setNotifications(prev => prev.filter(n => n.id !== id));
       toast({ title: "Notification Deleted", description: "The notification has been removed." });
     } catch (error: any) {
       toast({ title: "Error", description: `Could not delete notification: ${error.message}`, variant: "destructive"});
     }
  }, [currentUser, toast]);

  const handleDeleteAllNotifications = useCallback(async () => {
    if (!currentUser?.id) {
        toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive" });
        setIsClearAllAlertOpen(false);
        return;
    }
    if (notifications.length === 0) {
      setIsClearAllAlertOpen(false);
      return;
    }
    setIsLoadingNotifications(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach(notification => {
        const notifDocRef = doc(db, "notifications", notification.id);
        batch.delete(notifDocRef);
      });
      await batch.commit();
      setNotifications([]);
      toast({ title: "All Notifications Cleared", description: "All your notifications have been deleted.", variant: "destructive" });
    } catch (error: any) {
      toast({ title: "Error", description: `Could not clear all notifications: ${error.message}`, variant: "destructive"});
    } finally {
      setIsLoadingNotifications(false);
      setIsClearAllAlertOpen(false);
    }
  }, [currentUser, notifications, toast]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  if (authIsLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-sm">Loading notifications...</p>
      </div>
    );
  }
  
  if (!currentUser && !authIsLoading) {
    return (
         <div className="space-y-8">
            <PageHeader title="Notifications" icon={Bell} description="Please log in to view your notifications." />
            <Card className="text-center py-10 text-muted-foreground border-0 shadow-none">
                <CardContent>
                    <Info className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Login Required</p>
                    <p className="text-sm mb-4">You need to be logged in to view your notifications.</p>
                     <Button onClick={() => router.push('/login')} className="mt-4">Go to Login</Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-8">
      <PageHeader
        title="Notifications"
        description="Stay updated with important alerts and messages."
        icon={Bell}
        actions={
          notifications.length > 0 ? (
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button onClick={handleMarkAllAsRead} variant="outline" disabled={isLoadingNotifications}>
                  {isLoadingNotifications && unreadCount > 0 ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Mark All as Read ({unreadCount})
                </Button>
              )}
              <AlertDialog open={isClearAllAlertOpen} onOpenChange={setIsClearAllAlertOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isLoadingNotifications || notifications.length === 0}>
                    <Trash2 className="mr-2 h-4 w-4" /> Clear All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete all your notifications.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter className="pt-6 border-t">
                    <AlertDialogAction onClick={handleDeleteAllNotifications} variant="destructive">
                      Yes, Clear All
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          ) : null
        }
      />

      {isLoadingNotifications && notifications.length === 0 ? ( 
         <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading notifications...</div>
      ) : notifications.length === 0 ? (
        <Card className="text-center py-10 text-muted-foreground bg-card border-0 shadow-none">
          <CardContent>
            <Bell className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">No Notifications</p>
            <p className="text-sm">You're all caught up!</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {notifications.map(notification => (
            <Card
              key={notification.id}
              className={cn(
                "shadow-md hover:shadow-lg transition-shadow duration-200",
                !notification.isRead && "bg-primary/5 border-primary/20"
              )}
            >
              <CardHeader className="flex flex-row items-start gap-3 p-4 pb-2">
                <div className="flex-shrink-0 pt-0.5">{getNotificationIcon(notification.type)}</div>
                <div className="flex-grow">
                  <CardTitle className="text-base font-semibold">{notification.title}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {isValidDateFn(notification.createdAt)
                      ? formatDistanceToNowStrict(notification.createdAt, { addSuffix: true })
                      : 'Invalid date'}
                  </p>
                </div>
                <div className="flex-shrink-0 space-x-1">
                  {!notification.isRead && (
                    <Tooltip>
                       <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMarkAsRead(notification.id)}>
                            <Check className="h-4 w-4 text-green-600" />
                            <span className="sr-only">Mark as Read</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Mark as Read</p></TooltipContent>
                    </Tooltip>
                  )}
                   <Tooltip>
                       <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteNotification(notification.id)}>
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete Notification</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Delete Notification</p></TooltipContent>
                    </Tooltip>
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 ml-[calc(1.25rem+0.75rem)]"> 
                <p className="text-sm text-muted-foreground">{notification.message}</p>
              </CardContent>
              {notification.linkTo && (
                <CardFooter className="px-4 pb-3 pt-0 ml-[calc(1.25rem+0.75rem)] justify-start">
                  <Button asChild variant="link" size="sm" className="p-0 h-auto text-xs">
                    <Link href={notification.linkTo}>View Details</Link>
                  </Button>
                </CardFooter>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
