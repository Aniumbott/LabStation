
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Bell, Check, Trash2, CalendarCheck2, Wrench, AlertTriangle, CircleEllipsis, CircleCheck, Info, ShieldAlert, Loader2, X } from 'lucide-react';
import type { Notification as NotificationTypeAlias } from '@/types'; // Renamed to avoid conflict with browser Notification
import { useAuth } from '@/components/auth-context';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid as isValidDateFn, formatDistanceToNowStrict } from 'date-fns';
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
import { collection, query, where, orderBy, getDocs, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { formatDateSafe } from '@/lib/utils';


const getNotificationIcon = (type: NotificationTypeAlias['type']) => {
  switch (type) {
    case 'booking_confirmed':
      return <CalendarCheck2 className="h-5 w-5 text-green-500" />;
    case 'booking_pending_approval':
    case 'booking_promoted_admin':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'booking_rejected':
      return <CircleEllipsis className="h-5 w-5 text-red-500" />;
    case 'booking_waitlisted':
    case 'booking_promoted_user':
      return <Clock className="h-5 w-5 text-purple-500" />; // Example for waitlist/promotion
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
  const [notifications, setNotifications] = useState<NotificationTypeAlias[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(true);
  const [isClearAllAlertOpen, setIsClearAllAlertOpen] = useState(false);
  const { toast } = useToast();

  const fetchNotifications = useCallback(async () => {
    if (!currentUser?.id) {
      setNotifications([]);
      setIsLoadingNotifications(false);
      return;
    }
    setIsLoadingNotifications(true);
    try {
      // Firestore Index required: notifications collection: userId (ASC), createdAt (DESC)
      const notificationsQuery = query(
        collection(db, "notifications"),
        where("userId", "==", currentUser.id),
        orderBy("createdAt", "desc")
      );
      const querySnapshot = await getDocs(notificationsQuery);
      const fetchedNotifications: NotificationTypeAlias[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        } as NotificationTypeAlias;
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
    if (!authIsLoading) { // Only fetch after auth state is resolved
        fetchNotifications();
    }
  }, [authIsLoading, fetchNotifications]);

  const handleMarkAsRead = async (id: string) => {
    try {
      const notifDocRef = doc(db, "notifications", id);
      await updateDoc(notifDocRef, { isRead: true });
      setNotifications(prev =>
        prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
      );
    } catch (error: any) {
      toast({ title: "Error", description: `Could not mark notification as read: ${error.message}`, variant: "destructive"});
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!currentUser) return;
    const unreadNotifications = notifications.filter(n => !n.isRead);
    if (unreadNotifications.length === 0) {
      toast({ title: "No Unread Notifications", description: "All notifications are already marked as read." });
      return;
    }
    try {
      // In a real app, you might use a batched write or a Cloud Function for this.
      // For client-side, we update one by one.
      for (const notification of unreadNotifications) {
        const notifDocRef = doc(db, "notifications", notification.id);
        await updateDoc(notifDocRef, { isRead: true });
      }
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      toast({ title: "All Read", description: "All notifications have been marked as read." });
    } catch (error: any) {
      toast({ title: "Error", description: `Could not mark all notifications as read: ${error.message}`, variant: "destructive"});
    }
  };
  
  const handleDeleteNotification = async (id: string) => {
     try {
       const notifDocRef = doc(db, "notifications", id);
       await deleteDoc(notifDocRef);
       setNotifications(prev => prev.filter(n => n.id !== id));
       toast({ title: "Notification Deleted", description: "The notification has been removed.", variant: "destructive" });
     } catch (error: any) {
       toast({ title: "Error", description: `Could not delete notification: ${error.message}`, variant: "destructive"});
     }
  };

  const handleDeleteAllNotifications = async () => {
    if (!currentUser || notifications.length === 0) {
      setIsClearAllAlertOpen(false);
      return;
    }
    try {
      // In a real app, deleting all user's notifications would ideally be a backend operation.
      // For client-side, we delete one by one.
      for (const notification of notifications) {
        const notifDocRef = doc(db, "notifications", notification.id);
        await deleteDoc(notifDocRef);
      }
      setNotifications([]);
      toast({ title: "All Notifications Cleared", description: "All your notifications have been deleted.", variant: "destructive" });
    } catch (error: any) {
      toast({ title: "Error", description: `Could not clear all notifications: ${error.message}`, variant: "destructive"});
    } finally {
      setIsClearAllAlertOpen(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (authIsLoading || (currentUser && isLoadingNotifications)) {
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
            <PageHeader title="Notifications" description="Please log in to view your notifications." icon={Bell} />
            <Card className="text-center py-10 text-muted-foreground border-0 shadow-none">
                <CardContent>
                    <Info className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Login Required</p>
                    <p className="text-sm mb-4">You need to be logged in to view your notifications.</p>
                     <Button asChild><Link href="/login">Go to Login</Link></Button>
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
                <Button onClick={handleMarkAllAsRead} variant="outline">
                  <Check className="mr-2 h-4 w-4" /> Mark All as Read ({unreadCount})
                </Button>
              )}
              <AlertDialog open={isClearAllAlertOpen} onOpenChange={setIsClearAllAlertOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive">
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
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
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

      {notifications.length === 0 ? (
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
