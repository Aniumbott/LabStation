
'use client';

import { useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { Bell, Check, Trash2, CalendarCheck2, Wrench, AlertTriangle, Clock, CircleEllipsis, CircleCheck, Info, ShieldAlert } from 'lucide-react';
import type { Notification as NotificationType } from '@/types';
import { useAuth } from '@/components/auth-context';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { isValid as isValidDateFn, formatDistanceToNowStrict } from 'date-fns';
import { cn, formatDateSafe } from '@/lib/utils';
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
import { useRouter } from 'next/navigation';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
  useDeleteNotification,
  useDeleteAllNotifications,
} from '@/lib/hooks/use-queries';


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
  const [isClearAllAlertOpen, setIsClearAllAlertOpen] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const userId = currentUser?.id;

  // ── Data query (replaces useState + useCallback + useEffect) ──────────────
  const { data: notifications = [], isLoading: isLoadingNotifications } = useNotifications(userId);

  // ── Optimistic mutation hooks ─────────────────────────────────────────────
  const markReadMutation = useMarkNotificationRead(userId ?? '');
  const markAllReadMutation = useMarkAllNotificationsRead(userId ?? '');
  const deleteMutation = useDeleteNotification(userId ?? '');
  const deleteAllMutation = useDeleteAllNotifications(userId ?? '');

  const isAnyMutating =
    markReadMutation.isPending ||
    markAllReadMutation.isPending ||
    deleteMutation.isPending ||
    deleteAllMutation.isPending;

  const handleMarkAsRead = useCallback(async (id: string) => {
    if (!userId) {
      toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive" });
      return;
    }
    try {
      await markReadMutation.mutateAsync({ callerUserId: userId, notificationId: id });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Could not mark notification as read.", variant: "destructive" });
    }
  }, [userId, markReadMutation, toast]);

  const handleMarkAllAsRead = useCallback(async () => {
    if (!userId) {
      toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive" });
      return;
    }
    const unreadCount = notifications.filter(n => !n.isRead).length;
    if (unreadCount === 0) {
      toast({ title: "No Unread Notifications", description: "All notifications are already marked as read." });
      return;
    }
    try {
      await markAllReadMutation.mutateAsync({ callerUserId: userId });
      toast({ title: "All Read", description: "All notifications have been marked as read." });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Could not mark all notifications as read.", variant: "destructive" });
    }
  }, [userId, markAllReadMutation, notifications, toast]);

  const handleDeleteNotification = useCallback(async (id: string) => {
    if (!userId) {
      toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive" });
      return;
    }
    try {
      await deleteMutation.mutateAsync({ callerUserId: userId, notificationId: id });
      toast({ title: "Notification Deleted", description: "The notification has been removed." });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Could not delete notification.", variant: "destructive" });
    }
  }, [userId, deleteMutation, toast]);

  const handleDeleteAllNotifications = useCallback(async () => {
    if (!userId) {
      toast({ title: "Authentication Error", description: "You must be logged in to perform this action.", variant: "destructive" });
      setIsClearAllAlertOpen(false);
      return;
    }
    if (notifications.length === 0) {
      setIsClearAllAlertOpen(false);
      return;
    }
    try {
      await deleteAllMutation.mutateAsync({ callerUserId: userId });
      toast({ title: "All Notifications Cleared", description: "All your notifications have been deleted.", variant: "destructive" });
    } catch (error: unknown) {
      toast({ title: "Error", description: error instanceof Error ? error.message : "Could not clear all notifications.", variant: "destructive" });
    } finally {
      setIsClearAllAlertOpen(false);
    }
  }, [userId, deleteAllMutation, notifications.length, toast]);

  const unreadCount = useMemo(() => notifications.filter(n => !n.isRead).length, [notifications]);

  if (authIsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-48 rounded-lg" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!currentUser && !authIsLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Notifications" icon={Bell} description="Please log in to view your notifications." />
        <EmptyState
          icon={Info}
          title="Login Required"
          description="You need to be logged in to view your notifications."
          action={<Button onClick={() => router.push('/login')}>Go to Login</Button>}
        />
      </div>
    );
  }

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Stay updated with important alerts and messages."
        icon={Bell}
        actions={
          notifications.length > 0 ? (
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <Button onClick={handleMarkAllAsRead} variant="outline" disabled={isAnyMutating}>
                  {markAllReadMutation.isPending ? <><span className="mr-2 h-4 w-4 animate-spin inline-block border-2 border-current border-t-transparent rounded-full" /></> : <Check className="mr-2 h-4 w-4" />}
                  Mark All as Read ({unreadCount})
                </Button>
              )}
              <AlertDialog open={isClearAllAlertOpen} onOpenChange={setIsClearAllAlertOpen}>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" disabled={isAnyMutating || notifications.length === 0}>
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
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAllNotifications} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
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
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You're all caught up!"
        />
      ) : (
        <div className="space-y-2">
          {notifications.map(notification => (
            <div
              key={notification.id}
              className={cn(
                "rounded-r-lg rounded-l-sm border border-border bg-card flex items-start gap-3 p-4 transition-colors",
                !notification.isRead
                  ? "border-l-4 border-l-primary bg-primary/5"
                  : "border-l-4 border-l-transparent"
              )}
            >
              <div className="flex-shrink-0 pt-0.5">{getNotificationIcon(notification.type)}</div>
              <div className="flex-grow min-w-0">
                <p className="text-sm font-semibold leading-tight">{notification.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isValidDateFn(notification.createdAt)
                    ? formatDistanceToNowStrict(notification.createdAt, { addSuffix: true })
                    : 'Invalid date'}
                </p>
                <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                {notification.linkTo && (
                  <Button asChild variant="link" size="sm" className="p-0 h-auto text-xs mt-1">
                    <Link href={notification.linkTo}>View Details</Link>
                  </Button>
                )}
              </div>
              <div className="flex-shrink-0 flex items-center gap-1">
                {!notification.isRead && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleMarkAsRead(notification.id)} disabled={isAnyMutating}>
                        <Check className="h-4 w-4 text-green-600" />
                        <span className="sr-only">Mark as Read</span>
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent><p>Mark as Read</p></TooltipContent>
                  </Tooltip>
                )}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleDeleteNotification(notification.id)} disabled={isAnyMutating}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete Notification</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Delete Notification</p></TooltipContent>
                </Tooltip>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}
