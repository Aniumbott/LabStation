
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CheckSquare, ThumbsUp, ThumbsDown, FilterX, Search as SearchIcon, ListFilter, Clock, Info, X, Loader2 } from 'lucide-react';
import type { Booking, Resource, User } from '@/types';
import { addNotification, addAuditLog } from '@/lib/mock-data'; // AuditLog and Notification are still mock
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
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn, formatDateSafe } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, orderBy, Timestamp } from 'firebase/firestore';


const bookingStatusesForFilterDialog: Array<'all' | 'Pending' | 'Waitlisted'> = ['all', 'Pending', 'Waitlisted'];

export default function BookingRequestsPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [allBookingsState, setAllBookingsState] = useState<Booking[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filter Dialog State
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>('all');
  const [tempFilterStatus, setTempFilterStatus] = useState<Booking['status'] | 'all'>('Pending'); // Default to 'Pending'

  // Active Page Filters
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<Booking['status'] | 'all'>('Pending'); // Default to 'Pending'

  const fetchBookingRequests = useCallback(async () => {
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Lab Manager')) {
      setAllBookingsState([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Firestore Index Required: bookings collection: status (ASC/DESC), startTime (ASC)
      const bookingsRef = collection(db, "bookings");
      const q = query(bookingsRef, where("status", "in", ["Pending", "Waitlisted"]), orderBy("startTime", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedBookingsPromises = querySnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let resourceName = 'Unknown Resource';
        let userName = 'Unknown User';

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
          ...data,
          startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(),
          endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
          // Add resourceName and userName for display purposes (denormalized on client)
          resourceName,
          userName,
        } as Booking & { resourceName: string; userName: string }; // Augment type for local use
      });
      const fetchedBookings = (await Promise.all(fetchedBookingsPromises)) as Booking[];
      setAllBookingsState(fetchedBookings);
    } catch (error: any) {
      console.error("Error fetching booking requests: ", error);
      toast({ title: "Error", description: `Failed to fetch booking requests. ${error.message}`, variant: "destructive" });
      setAllBookingsState([]);
    }
    setIsLoading(false);
  }, [currentUser, toast]);

  const fetchAllResourcesForFilter = useCallback(async () => {
    try {
        // Firestore Index required: resources collection: name (ASC)
        const resourcesQuery = query(collection(db, "resources"), orderBy("name", "asc"));
        const resourcesSnapshot = await getDocs(resourcesQuery);
        const fetchedResources = resourcesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Resource));
        setAllResources(fetchedResources);
    } catch (error) {
        console.error("Error fetching resources for filter: ", error);
        toast({ title: "Error", description: "Could not load resources for filtering.", variant: "destructive" });
    }
  }, [toast]);

  useEffect(() => {
    fetchBookingRequests();
    fetchAllResourcesForFilter();
  }, [fetchBookingRequests, fetchAllResourcesForFilter]);

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
      // @ts-ignore (resourceName and userName are added client-side)
      const searchMatch = !activeSearchTerm || (b.resourceName && b.resourceName.toLowerCase().includes(lowerSearch)) || (b.userName && b.userName.toLowerCase().includes(lowerSearch)) || (b.notes && b.notes.toLowerCase().includes(lowerSearch));
      const resourceMatch = activeFilterResourceId === 'all' || b.resourceId === activeFilterResourceId;
      const statusMatch = activeFilterStatus === 'all'
                            ? (b.status === 'Pending' || b.status === 'Waitlisted')
                            : b.status === activeFilterStatus;
      return searchMatch && resourceMatch && statusMatch;
    });
  }, [allBookingsState, activeSearchTerm, activeFilterResourceId, activeFilterStatus]);

  const handleApproveBooking = async (bookingId: string) => {
    if (!currentUser) return;
    const bookingDocRef = doc(db, "bookings", bookingId);
    try {
      await updateDoc(bookingDocRef, { status: 'Confirmed' });
      const approvedBooking = allBookingsState.find(b => b.id === bookingId);
      if (approvedBooking) {
        // @ts-ignore
        toast({ title: 'Booking Approved', description: `Booking for "${approvedBooking.resourceName}" by ${approvedBooking.userName} has been confirmed.`});
        // @ts-ignore
        addAuditLog(currentUser.id, currentUser.name, 'BOOKING_APPROVED', { entityType: 'Booking', entityId: approvedBooking.id, details: `Booking for ${approvedBooking.resourceName} by ${approvedBooking.userName} approved.`});
        addNotification(
          approvedBooking.userId,
          'Booking Confirmed',
          // @ts-ignore
          `Your booking for ${approvedBooking.resourceName} on ${format(new Date(approvedBooking.startTime), 'MMM dd, HH:mm')} has been confirmed.`,
          'booking_confirmed',
          `/bookings?bookingId=${approvedBooking.id}`
        );
        await fetchBookingRequests();
      }
    } catch (error) {
      console.error("Error approving booking:", error);
      toast({ title: "Error", description: "Failed to approve booking.", variant: "destructive" });
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    if(!currentUser) return;
    const bookingDocRef = doc(db, "bookings", bookingId);
    try {
      await updateDoc(bookingDocRef, { status: 'Cancelled' });
      const rejectedBooking = allBookingsState.find(b => b.id === bookingId);
      if (rejectedBooking) {
        // @ts-ignore
        toast({ title: 'Booking Rejected', description: `Booking for "${rejectedBooking.resourceName}" by ${rejectedBooking.userName} has been cancelled.`, variant: 'destructive'});
        // @ts-ignore
        addAuditLog(currentUser.id, currentUser.name, 'BOOKING_REJECTED', { entityType: 'Booking', entityId: rejectedBooking.id, details: `Booking for ${rejectedBooking.resourceName} by ${rejectedBooking.userName} rejected/cancelled.`});
        addNotification(
          rejectedBooking.userId,
          'Booking Rejected',
          // @ts-ignore
          `Your booking for ${rejectedBooking.resourceName} on ${format(new Date(rejectedBooking.startTime), 'MMM dd, HH:mm')} has been rejected and cancelled.`,
          'booking_rejected',
          `/bookings?bookingId=${rejectedBooking.id}`
        );
        // Queue processing logic removed for Firestore refactor - will be handled server-side or via triggers later
        await fetchBookingRequests();
      }
    } catch (error) {
      console.error("Error rejecting booking:", error);
      toast({ title: "Error", description: "Failed to reject booking.", variant: "destructive" });
    }
  };

  const handleApplyDialogFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterStatus(tempFilterStatus);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFilters = () => {
    setTempSearchTerm('');
    setTempFilterResourceId('all');
    setTempFilterStatus('Pending'); // Reset to default filter status for this page
  };

  const resetAllActiveFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterResourceId('all');
    setActiveFilterStatus('Pending'); // Reset to default filter status
    resetDialogFilters();
    setIsFilterDialogOpen(false);
  };

  const activeFilterCount = [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
    activeFilterStatus !== 'Pending', // Default is 'Pending', so other selections are active filters
  ].filter(Boolean).length;


  const formatTimeField = (dateInput: Date | string): string => {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    return isValidDate(date) ? format(date, 'p') : '';
  };


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
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Filter Booking Requests</DialogTitle>
                  <DialogDescription>
                    Refine the list of pending or waitlisted booking requests.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="requestSearchDialog" className="text-sm font-medium mb-1 block">Search (Resource/User/Notes)</Label>
                      <div className="relative">
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
                      <Label htmlFor="requestResourceDialog" className="text-sm font-medium mb-1 block">Resource</Label>
                      <Select value={tempFilterResourceId} onValueChange={setTempFilterResourceId}>
                          <SelectTrigger id="requestResourceDialog" className="h-9"><SelectValue placeholder="Filter by Resource" /></SelectTrigger>
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
                      <Label htmlFor="requestStatusDialog" className="text-sm font-medium mb-1 block">Status</Label>
                      <Select value={tempFilterStatus} onValueChange={(v) => setTempFilterStatus(v as Booking['status'] | 'all')}>
                          <SelectTrigger id="requestStatusDialog" className="h-9"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                          <SelectContent>
                              {bookingStatusesForFilterDialog.map(s => (
                                  <SelectItem key={s} value={s}>{s === 'all' ? 'All (Pending & Waitlisted)' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                <DialogFooter className="pt-6 border-t">
                    <Button variant="ghost" onClick={resetDialogFilters} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}><X className="mr-2 h-4 w-4" />Cancel</Button>
                  <Button onClick={handleApplyDialogFilters}>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading requests...</div>
        ) : bookingsForApproval.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Pending & Waitlisted Requests ({bookingsForApproval.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Booked By</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookingsForApproval.map((booking) => (
                      <TableRow key={booking.id}>
                        {/* @ts-ignore */}
                        <TableCell className="font-medium">{booking.resourceName}</TableCell>
                        {/* @ts-ignore */}
                        <TableCell>{booking.userName}</TableCell>
                        <TableCell>
                          <div>{formatDateSafe(booking.startTime)}</div>
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
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{booking.notes || 'N/A'}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleApproveBooking(booking.id)}>
                                <ThumbsUp className="h-4 w-4 text-green-600" />
                                <span className="sr-only">Approve Booking</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Approve Booking</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleRejectBooking(booking.id)}>
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
          <Card className="text-center py-10 text-muted-foreground bg-card border-0 shadow-none">
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
                  <Button variant="outline" onClick={resetAllActiveFilters}>
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
