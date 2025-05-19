
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Bell, Check, Trash2, CalendarCheck2, Wrench, AlertTriangle, CircleEllipsis, CircleCheck, Info, ShieldAlert, Loader2 } from 'lucide-react';
import type { Notification, User } from '@/types';
import { initialNotifications } from '@/lib/mock-data';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid as isValidDate, formatDistanceToNowStrict } from 'date-fns';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';
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
import { useAuth } from '@/components/auth-context'; // Import useAuth

const getNotificationIcon = (type: Notification['type']) => {
  switch (type) {
    case 'booking_confirmed':
      return <CalendarCheck2 className="h-5 w-5 text-green-500" />;
    case 'booking_pending_approval':
      return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
    case 'booking_rejected':
      return <CircleEllipsis className="h-5 w-5 text-red-500" />;
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
  const { currentUser } = useAuth(); // Use AuthContext
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isClearAllAlertOpen, setIsClearAllAlertOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    setIsLoading(true);
    if (currentUser) {
      const userNotifications = initialNotifications
        .filter(n => n.userId === currentUser.id)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNotifications(userNotifications);
    } else {
      setNotifications([]); // No user, no notifications
    }
    setIsLoading(false);
  }, [currentUser]);

  const handleMarkAsRead = (id: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === id ? { ...n, isRead: true } : n))
    );
    const notificationIndex = initialNotifications.findIndex(n => n.id === id);
    if (notificationIndex !== -1) {
      initialNotifications[notificationIndex].isRead = true;
    }
  };

  const handleMarkAllAsRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    initialNotifications.forEach(n => {
      if (currentUser && n.userId === currentUser.id) n.isRead = true;
    });
    toast({
      title: "All Read",
      description: "All notifications have been marked as read.",
    });
  };
  
  const handleDeleteNotification = (id: string) => {
     setNotifications(prev => prev.filter(n => n.id !== id));
     const notificationIndex = initialNotifications.findIndex(n => n.id === id);
     if (notificationIndex !== -1) {
       initialNotifications.splice(notificationIndex, 1);
     }
     toast({
      title: "Notification Deleted",
      description: "The notification has been removed.",
      variant: "destructive"
    });
  };

  const handleDeleteAllNotifications = () => {
    if (!currentUser) return;
    setNotifications([]);
    // Filter out notifications for the current user from the global array
    const remainingNotifications = initialNotifications.filter(n => n.userId !== currentUser.id);
    initialNotifications.length = 0; 
    initialNotifications.push(...remainingNotifications); 

    toast({
      title: "All Notifications Cleared",
      description: "All your notifications have been deleted.",
      variant: "destructive"
    });
    setIsClearAllAlertOpen(false);
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-sm">Loading notifications...</p>
      </div>
    );
  }
  
  if (!currentUser) {
    return (
         <div className="space-y-8">
            <PageHeader title="Notifications" description="Please log in to view your notifications." icon={Bell} />
            <Card className="text-center py-10 text-muted-foreground">
                <CardContent>
                    <Info className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Login Required</p>
                    <p className="text-sm mb-4">You need to be logged in to view your notifications.</p>
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
                    {isValidDate(parseISO(notification.createdAt))
                      ? formatDistanceToNowStrict(parseISO(notification.createdAt), { addSuffix: true })
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
