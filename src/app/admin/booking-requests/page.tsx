
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CheckSquare, ThumbsUp, ThumbsDown, FilterX, Search as SearchIcon, ListFilter, Clock, Info, X, Loader2, User as UserIcon, Package as ResourceIcon, CheckCircle2 } from 'lucide-react';
import type { Booking, Resource, User, ResourceStatus } from '@/types';
import { addNotification, addAuditLog, processWaitlistForResource } from '@/lib/firestore-helpers';
import { useAuth } from '@/components/auth-context';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid as isValidDateFn } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn, formatDateSafe } from '@/lib/utils';
import { db, auth } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, orderBy, Timestamp, serverTimestamp } from 'firebase/firestore';


const bookingStatusesForApprovalFilter: Array<'all' | 'Pending' | 'Waitlisted'> = ['all', 'Pending', 'Waitlisted'];

export default function BookingRequestsPage() {
  const { toast } = useToast();
  const { currentUser: loggedInUserFromContext } = useAuth();
  const [allBookingsState, setAllBookingsState] = useState<(Booking & { resourceName?: string, userName?: string })[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);

  const [isLoading, setIsLoading] = useState(true);

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>('all');
  const [tempFilterStatus, setTempFilterStatus] = useState<'Pending' | 'Waitlisted' | 'all'>('Pending');

  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<'Pending' | 'Waitlisted' | 'all'>('Pending');

  const canManageBookingRequests = useMemo(() => loggedInUserFromContext && loggedInUserFromContext.role === 'Admin', [loggedInUserFromContext]);


  const fetchBookingRequestsAndRelatedData = useCallback(async () => {
    if (!canManageBookingRequests) {
      setAllBookingsState([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const resourcesQueryInstance = query(collection(db, "resources"), orderBy("name", "asc"));
      const resourcesSnapshot = await getDocs(resourcesQueryInstance);
      const fetchedResources = resourcesSnapshot.docs.map(d => ({
        id: d.id,
        ...(d.data() as Omit<Resource, 'id'>)
      } as Resource));
      setAllResources(fetchedResources);

      const bookingsRef = collection(db, "bookings");
      const q = query(bookingsRef, where("status", "in", ["Pending", "Waitlisted"]), orderBy("startTime", "asc"));
      const querySnapshot = await getDocs(q);

      const fetchedBookingsPromises = querySnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let resourceName = "Unknown Resource";
        let userName = "Unknown User";

        if (data.resourceId) {
          const resourceDoc = await getDoc(doc(db, 'resources', data.resourceId));
          if (resourceDoc.exists()) resourceName = resourceDoc.data()?.name || resourceName;
        }
        if (data.userId) {
          const userDoc = await getDoc(doc(db, 'users', data.userId));
          if (userDoc.exists()) userName = userDoc.data()?.name || userName;
        }

        return {
          id: docSnap.id,
          resourceId: data.resourceId,
          userId: data.userId,
          startTime: (data.startTime as Timestamp)?.toDate(),
          endTime: (data.endTime as Timestamp)?.toDate(),
          createdAt: (data.createdAt as Timestamp)?.toDate(),
          status: data.status as Booking['status'],
          notes: data.notes,
          resourceName: resourceName,
          userName: userName,
          usageDetails: data.usageDetails ? {
            ...data.usageDetails,
            actualStartTime: (data.usageDetails.actualStartTime as Timestamp)?.toDate(),
            actualEndTime: (data.usageDetails.actualEndTime as Timestamp)?.toDate(),
          } : undefined,
        } as Booking & { resourceName?: string, userName?: string };
      });
      const bookingsWithDetails = await Promise.all(fetchedBookingsPromises);
      setAllBookingsState(bookingsWithDetails);

    } catch (error: any) {
      console.error("Error fetching booking requests: ", error);
      toast({ title: "Database Error", description: `Failed to fetch booking requests. ${error.message}`, variant: "destructive" });
      setAllBookingsState([]);
    }
    setIsLoading(false);
  }, [canManageBookingRequests, toast]);


  useEffect(() => {
    fetchBookingRequestsAndRelatedData();
  }, [fetchBookingRequestsAndRelatedData]);

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterResourceId(activeFilterResourceId);
      setTempFilterStatus(activeFilterStatus);
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterResourceId, activeFilterStatus]);

  const bookingsForApproval = useMemo(() => {
    return allBookingsState.filter(b => {
      const lowerSearch = activeSearchTerm.toLowerCase();
      const searchMatch = !activeSearchTerm ||
                           (b.resourceName && b.resourceName.toLowerCase().includes(lowerSearch)) ||
                           (b.userName && b.userName.toLowerCase().includes(lowerSearch)) ||
                           (b.notes && b.notes.toLowerCase().includes(lowerSearch));
      const resourceMatch = activeFilterResourceId === 'all' || b.resourceId === activeFilterResourceId;
      const statusMatch = activeFilterStatus === 'all'
                            ? (b.status === 'Pending' || b.status === 'Waitlisted')
                            : b.status === activeFilterStatus;
      return searchMatch && resourceMatch && statusMatch;
    });
  }, [allBookingsState, activeSearchTerm, activeFilterResourceId, activeFilterStatus]);

  const handleApproveBooking = useCallback(async (bookingId: string) => {
    if (!loggedInUserFromContext || !loggedInUserFromContext.id || !loggedInUserFromContext.name) {
        toast({ title: "Authentication Error", description: "Current user context is missing for approval.", variant: "destructive" });
        return;
    }
    const bookingToUpdate = allBookingsState.find(b => b.id === bookingId);
    if (!bookingToUpdate || !bookingToUpdate.resourceId || !bookingToUpdate.userId || !bookingToUpdate.startTime) {
        toast({ title: "Error", description: "Booking data is incomplete for approval.", variant: "destructive" });
        return;
    }

    const bookingDocRef = doc(db, "bookings", bookingId);
    setIsLoading(true);
    try {
      await updateDoc(bookingDocRef, { status: 'Confirmed' });
      toast({ title: 'Booking Approved', description: `Booking for "${bookingToUpdate.resourceName || 'Unknown Resource'}" by ${bookingToUpdate.userName || 'Unknown User'} has been confirmed.`});

      try {
        console.log(`[BookingRequestsPage/handleApproveBooking] ABOUT TO CALL addAuditLog. Admin: ${loggedInUserFromContext.name} (${loggedInUserFromContext.id})`);
        await addAuditLog(loggedInUserFromContext.id, loggedInUserFromContext.name, 'BOOKING_APPROVED', { entityType: 'Booking', entityId: bookingToUpdate.id, details: `Booking for ${bookingToUpdate.resourceName || 'Unknown Resource'} by ${bookingToUpdate.userName || 'Unknown User'} approved.`});
        console.log(`[BookingRequestsPage/handleApproveBooking] Successfully called addAuditLog.`);
      } catch (auditError: any) {
          console.error("[BookingRequestsPage/handleApproveBooking] Error adding audit log:", auditError);
          toast({
              title: "Audit Log Failed",
              description: `Booking approved, but audit log failed: ${auditError.message || 'Unknown audit error'}`,
              variant: "destructive",
          });
      }

      if (bookingToUpdate.userId && bookingToUpdate.resourceName && bookingToUpdate.startTime) {
        const directAuthUser = auth.currentUser;
        if (!directAuthUser || !directAuthUser.uid) {
           console.warn("[BookingRequestsPage/handleApproveBooking] Skipping notification: Current Firebase SDK user is null for notification sending.");
           toast({ title: "Notification Skipped", description: "Booking approved, but current user session issue prevented notification. Please check login.", variant: "destructive" });
        } else {
            console.log(`[BookingRequestsPage/handleApproveBooking] Preparing to send 'Booking Confirmed' notification. Target UserID: ${bookingToUpdate.userId}`);
            const notificationParams = {
                userId: bookingToUpdate.userId,
                title: 'Booking Confirmed',
                message: `Your booking for ${bookingToUpdate.resourceName} on ${formatDateSafe(bookingToUpdate.startTime, '', 'MMM dd, HH:mm')} has been confirmed.`,
                type: 'booking_confirmed' as const,
                linkTo: `/bookings?bookingId=${bookingToUpdate.id}`
            };
            try {
              await addNotification(
                notificationParams.userId,
                notificationParams.title,
                notificationParams.message,
                notificationParams.type,
                notificationParams.linkTo
              );
              console.log(`[BookingRequestsPage/handleApproveBooking] Successfully called addNotification for userId: ${bookingToUpdate.userId}`);
            } catch (notificationError: any) {
              console.error(`[BookingRequestsPage/handleApproveBooking] Error calling addNotification for userId ${bookingToUpdate.userId}:`, notificationError);
              toast({
                  title: "Notification Failed",
                  description: `Booking was approved, but sending notification failed: ${notificationError.message || 'Unknown notification error'}`,
                  variant: "destructive"
              });
            }
        }
      } else {
        console.warn("[BookingRequestsPage/handleApproveBooking] Skipping notification: Missing userId, resourceName or startTime for the booking being approved.");
      }
      await fetchBookingRequestsAndRelatedData();
    } catch (error: any) {
      console.error("[BookingRequestsPage/handleApproveBooking] Outer catch block error:", error.toString(), error);
      toast({ title: "Error Approving Booking", description: `Failed to approve booking: ${error.message || 'Unknown error'}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [loggedInUserFromContext, allBookingsState, fetchBookingRequestsAndRelatedData, toast]);

  const handleRejectBooking = useCallback(async (bookingId: string) => {
    if(!loggedInUserFromContext || !loggedInUserFromContext.id || !loggedInUserFromContext.name) {
        toast({ title: "Authentication Error", description: "Current user context is missing for rejection.", variant: "destructive" });
        return;
    }
    const bookingToUpdate = allBookingsState.find(b => b.id === bookingId);
     if (!bookingToUpdate || !bookingToUpdate.resourceId || !bookingToUpdate.userId || !bookingToUpdate.startTime || !bookingToUpdate.endTime) {
        toast({ title: "Error", description: "Booking data is incomplete for rejection.", variant: "destructive" });
        return;
    }

    const bookingDocRef = doc(db, "bookings", bookingId);
    setIsLoading(true);
    try {
      await updateDoc(bookingDocRef, { status: 'Cancelled' });
      toast({ title: 'Booking Rejected', description: `Booking for "${bookingToUpdate.resourceName || 'Unknown Resource'}" by ${bookingToUpdate.userName || 'Unknown User'} has been cancelled.`, variant: 'destructive'});

      try {
        await addAuditLog(loggedInUserFromContext.id, loggedInUserFromContext.name, 'BOOKING_REJECTED', { entityType: 'Booking', entityId: bookingToUpdate.id, details: `Booking for ${bookingToUpdate.resourceName || 'Unknown Resource'} by ${bookingToUpdate.userName || 'Unknown User'} rejected/cancelled.`});
      } catch (auditError: any) {
          console.error("[BookingRequestsPage/handleRejectBooking] Error adding audit log:", auditError);
          toast({
              title: "Audit Log Failed",
              description: `Booking rejected, but audit log failed: ${auditError.message || 'Unknown audit error'}`,
              variant: "destructive",
          });
      }

      if (bookingToUpdate.userId && bookingToUpdate.resourceName && bookingToUpdate.startTime) {
        const directAuthUser = auth.currentUser;
        if (!directAuthUser || !directAuthUser.uid) {
           console.warn("[BookingRequestsPage/handleRejectBooking] Skipping notification: Current Firebase SDK user is null for notification sending.");
           toast({ title: "Notification Skipped", description: "Booking rejected, but current user session issue prevented notification. Please check login.", variant: "destructive" });
        } else {
            const notificationParams = {
                userId: bookingToUpdate.userId,
                title: 'Booking Rejected',
                message: `Your booking for ${bookingToUpdate.resourceName} on ${formatDateSafe(bookingToUpdate.startTime, '', 'MMM dd, HH:mm')} has been rejected and cancelled.`,
                type: 'booking_rejected' as const,
                linkTo: `/bookings?bookingId=${bookingToUpdate.id}`
            };
            try {
              await addNotification(
                notificationParams.userId,
                notificationParams.title,
                notificationParams.message,
                notificationParams.type,
                notificationParams.linkTo
              );
            } catch (notificationError: any) {
              console.error(`[BookingRequestsPage/handleRejectBooking] Error calling addNotification for userId ${bookingToUpdate.userId}:`, notificationError);
              toast({
                  title: "Notification Failed",
                  description: `Booking was rejected, but sending notification failed: ${notificationError.message || 'Unknown notification error'}`,
                  variant: "destructive"
              });
            }
        }
      } else {
        console.warn("[BookingRequestsPage/handleRejectBooking] Skipping notification: Missing userId, resourceName or startTime for the booking being rejected.");
      }

      // Process waitlist if the original status was 'Pending' (meaning an actual slot was freed up by admin action)
      if (bookingToUpdate.status === 'Pending' && bookingToUpdate.resourceId) {
        console.log(`[BookingRequestsPage/handleRejectBooking] Processing waitlist for resource ${bookingToUpdate.resourceId} due to rejection/cancellation of PENDING booking ${bookingId}.`);
        try {
            await processWaitlistForResource(
                bookingToUpdate.resourceId,
                new Date(bookingToUpdate.startTime),
                new Date(bookingToUpdate.endTime),
                'admin_reject'
            );
            console.log(`[BookingRequestsPage/handleRejectBooking] Waitlist processing initiated for resource ${bookingToUpdate.resourceId}.`);
        } catch (waitlistError: any) {
            console.error(`[BookingRequestsPage/handleRejectBooking] Error calling processWaitlistForResource:`, waitlistError);
            toast({
                title: "Waitlist Processing Error",
                description: `Booking rejected, but an error occurred while processing the waitlist: ${waitlistError.message || 'Unknown waitlist error'}`,
                variant: "destructive"
            });
        }
      }

      await fetchBookingRequestsAndRelatedData();
    } catch (error: any) {
      console.error("[BookingRequestsPage/handleRejectBooking] Outer catch block error:", error.toString(), error);
      toast({ title: "Error Rejecting Booking", description: `Failed to reject booking: ${error.message || 'Unknown error'}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [loggedInUserFromContext, allBookingsState, fetchBookingRequestsAndRelatedData, toast]);

  const handleApplyDialogFilters = useCallback(() => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterStatus(tempFilterStatus);
    setIsFilterDialogOpen(false);
  }, [tempSearchTerm, tempFilterResourceId, tempFilterStatus]);

  const resetDialogFiltersOnly = useCallback(() => {
    setTempSearchTerm('');
    setTempFilterResourceId('all');
    setTempFilterStatus('Pending');
  }, []);

  const resetAllActivePageFilters = useCallback(() => {
    setActiveSearchTerm('');
    setActiveFilterResourceId('all');
    setActiveFilterStatus('Pending');
    resetDialogFiltersOnly();
    setIsFilterDialogOpen(false);
  }, [resetDialogFiltersOnly]);

  const activeFilterCount = useMemo(() => [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
    activeFilterStatus !== 'Pending',
  ].filter(Boolean).length, [activeSearchTerm, activeFilterResourceId, activeFilterStatus]);


  const formatTimeField = (dateInput?: Date): string => {
    return dateInput && isValidDateFn(dateInput) ? format(dateInput, 'p') : 'Invalid Time';
  };

  if (!canManageBookingRequests) {
    return (
      <div className="space-y-8">
        <PageHeader title="Booking Requests" icon={CheckSquare} description="Access Denied." />
        <Card className="text-center py-10 text-muted-foreground">
          <CardContent>
            <p>You do not have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PageHeader
          title="Booking Requests"
          description="Review and manage pending or waitlisted booking requests."
          icon={CheckSquare}
          actions={
            <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <ListFilter className="mr-2 h-4 w-4" />
                  Filters
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-full max-w-md">
                <DialogHeader>
                  <DialogTitle>Filter Booking Requests</DialogTitle>
                  <DialogDescription>
                    Refine the list of pending or waitlisted booking requests.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="requestSearchDialog">Search (Resource/User/Notes)</Label>
                      <div className="relative mt-1">
                        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                        id="requestSearchDialog"
                        type="search"
                        placeholder="Keyword..."
                        value={tempSearchTerm}
                        onChange={(e) => setTempSearchTerm(e.target.value)}
                        className="h-9 pl-8"
                        />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="requestResourceDialog">Resource</Label>
                      <Select value={tempFilterResourceId} onValueChange={setTempFilterResourceId} disabled={isLoading || allResources.length === 0}>
                          <SelectTrigger id="requestResourceDialog" className="h-9 mt-1">
                            <SelectValue placeholder={isLoading ? "Loading..." : (allResources.length > 0 ? "Filter by Resource" : "No resources found")} />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">All Resources</SelectItem>
                              {allResources
                                  .map(resource => (
                                      <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem>
                                  ))
                              }
                          </SelectContent>
                      </Select>
                    </div>
                      <div>
                      <Label htmlFor="requestStatusDialog">Status</Label>
                      <Select value={tempFilterStatus} onValueChange={(v) => setTempFilterStatus(v as 'Pending' | 'Waitlisted' | 'all')}>
                          <SelectTrigger id="requestStatusDialog" className="h-9 mt-1"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                          <SelectContent>
                              {bookingStatusesForApprovalFilter.map(s => (
                                  <SelectItem key={s} value={s}>{s === 'all' ? 'All (Pending & Waitlisted)' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter className="pt-6 border-t mt-4">
                    <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}><X className="mr-2 h-4 w-4" />Cancel</Button>
                  <Button onClick={handleApplyDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        {isLoading && allBookingsState.length === 0 ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading requests...</div>
        ) : bookingsForApproval.length > 0 ? (
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>Pending & Waitlisted Requests ({bookingsForApproval.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><ResourceIcon className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Resource</TableHead>
                      <TableHead><UserIcon className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Booked By</TableHead>
                      <TableHead><Clock className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Date & Time</TableHead>
                      <TableHead><Info className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookingsForApproval.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.resourceName}</TableCell>
                        <TableCell>{booking.userName}</TableCell>
                        <TableCell>
                          <div>{formatDateSafe(booking.startTime, 'N/A', 'MMM dd, yyyy')}</div>
                          <div className="text-xs text-muted-foreground">
                              {formatTimeField(booking.startTime)} - {formatTimeField(booking.endTime)}
                          </div>
                        </TableCell>
                        <TableCell>
                            <Badge
                                className={cn(
                                    "whitespace-nowrap text-xs px-2 py-0.5 border-transparent",
                                    booking.status === 'Pending' && 'bg-yellow-500 text-yellow-950 hover:bg-yellow-600',
                                    booking.status === 'Waitlisted' && 'bg-purple-500 text-white hover:bg-purple-600'
                                )}
                            >
                                {booking.status}
                            </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={booking.notes || undefined}>{booking.notes || 'N/A'}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleApproveBooking(booking.id)} disabled={isLoading}>
                                <ThumbsUp className="h-4 w-4 text-green-600" />
                                <span className="sr-only">Approve Booking</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Approve Booking</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => handleRejectBooking(booking.id)} disabled={isLoading}>
                                <ThumbsDown className="h-4 w-4" />
                                <span className="sr-only">Reject Booking</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Reject Booking</p></TooltipContent>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-10 text-muted-foreground border-0 shadow-none">
            <CardContent>
              <CheckSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">
                  {activeFilterCount > 0 ? "No Requests Match Filters" : "No Pending or Waitlisted Booking Requests"}
              </p>
              <p className="text-sm mb-4">
                  {activeFilterCount > 0
                      ? "Try adjusting your filter criteria."
                      : "There are currently no booking requests awaiting approval or on the waitlist."
                  }
              </p>
              {activeFilterCount > 0 && (
                  <Button variant="outline" onClick={resetAllActivePageFilters}>
                      <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                  </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}
