
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CheckSquare, ThumbsUp, ThumbsDown, FilterX, Search as SearchIcon, ListFilter, Clock, Info, X, Loader2 } from 'lucide-react';
import type { Booking, Resource, User } from '@/types';
import { addNotification, addAuditLog, bookingStatusesForFilter } from '@/lib/mock-data';
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
import { format, parseISO, isValid as isValidDateFn, Timestamp } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { cn, formatDateSafe } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, getDoc, orderBy } from 'firebase/firestore';


const bookingStatusesForApprovalFilter: Array<'all' | 'Pending' | 'Waitlisted'> = ['all', 'Pending', 'Waitlisted'];

export default function BookingRequestsPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [allBookingsState, setAllBookingsState] = useState<Booking[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]); // To fetch user names
  const [isLoading, setIsLoading] = useState(true);

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>('all');
  const [tempFilterStatus, setTempFilterStatus] = useState<'Pending' | 'Waitlisted' | 'all'>('Pending');

  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<'Pending' | 'Waitlisted' | 'all'>('Pending');

  const fetchBookingRequestsAndRelatedData = useCallback(async () => {
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Lab Manager')) {
      setAllBookingsState([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      // Fetch users and resources first to map names later
      const usersQuery = query(collection(db, "users"), orderBy("name", "asc"));
      const usersSnapshot = await getDocs(usersQuery);
      const fetchedUsers = usersSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as User));
      setAllUsers(fetchedUsers);

      const resourcesQuery = query(collection(db, "resources"), orderBy("name", "asc"));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const fetchedResources = resourcesSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Resource));
      setAllResources(fetchedResources);
      
      // Fetch booking requests
      // Firestore Index Required: bookings (status ASC, startTime ASC) OR (status DESC, startTime ASC)
      const bookingsRef = collection(db, "bookings");
      const q = query(bookingsRef, where("status", "in", ["Pending", "Waitlisted"]), orderBy("startTime", "asc"));
      const querySnapshot = await getDocs(q);
      const fetchedBookings = querySnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(),
          endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        } as Booking;
      });
      setAllBookingsState(fetchedBookings);
    } catch (error: any) {
      console.error("Error fetching booking requests: ", error);
      toast({ title: "Database Error", description: `Failed to fetch booking requests. ${error.message}`, variant: "destructive" });
      setAllBookingsState([]);
    }
    setIsLoading(false);
  }, [currentUser, toast]);


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
    return allBookingsState.map(booking => {
      const resource = allResources.find(r => r.id === booking.resourceId);
      const user = allUsers.find(u => u.id === booking.userId);
      return {
        ...booking,
        resourceName: resource?.name || 'Unknown Resource',
        userName: user?.name || 'Unknown User',
      };
    }).filter(b => {
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
  }, [allBookingsState, allResources, allUsers, activeSearchTerm, activeFilterResourceId, activeFilterStatus]);

  const handleApproveBooking = useCallback(async (bookingId: string) => {
    if (!currentUser) return;
    const bookingDocRef = doc(db, "bookings", bookingId);
    const bookingToUpdate = allBookingsState.find(b => b.id === bookingId);
    if (!bookingToUpdate) {
        toast({ title: "Error", description: "Booking not found for approval.", variant: "destructive" });
        return;
    }

    try {
      await updateDoc(bookingDocRef, { status: 'Confirmed' });
      
      const resource = allResources.find(r => r.id === bookingToUpdate.resourceId);
      const user = allUsers.find(u => u.id === bookingToUpdate.userId);
      const resourceName = resource?.name || 'the resource';
      const userName = user?.name || 'the user';

      toast({ title: 'Booking Approved', description: `Booking for "${resourceName}" by ${userName} has been confirmed.`});
      addAuditLog(currentUser.id, currentUser.name || 'Admin', 'BOOKING_APPROVED', { entityType: 'Booking', entityId: bookingToUpdate.id, details: `Booking for ${resourceName} by ${userName} approved.`});
      addNotification(
        bookingToUpdate.userId,
        'Booking Confirmed',
        `Your booking for ${resourceName} on ${formatDateSafe(bookingToUpdate.startTime, '', 'MMM dd, HH:mm')} has been confirmed.`,
        'booking_confirmed',
        `/bookings?bookingId=${bookingToUpdate.id}`
      );
      await fetchBookingRequestsAndRelatedData();
    } catch (error: any) {
      console.error("Error approving booking:", error);
      toast({ title: "Error", description: `Failed to approve booking: ${error.message}`, variant: "destructive" });
    }
  }, [currentUser, allBookingsState, allResources, allUsers, fetchBookingRequestsAndRelatedData, toast]);

  const handleRejectBooking = useCallback(async (bookingId: string) => {
    if(!currentUser) return;
    const bookingDocRef = doc(db, "bookings", bookingId);
    const bookingToUpdate = allBookingsState.find(b => b.id === bookingId);
     if (!bookingToUpdate) {
        toast({ title: "Error", description: "Booking not found for rejection.", variant: "destructive" });
        return;
    }

    try {
      await updateDoc(bookingDocRef, { status: 'Cancelled' });
      
      const resource = allResources.find(r => r.id === bookingToUpdate.resourceId);
      const user = allUsers.find(u => u.id === bookingToUpdate.userId);
      const resourceName = resource?.name || 'the resource';
      const userName = user?.name || 'the user';

      toast({ title: 'Booking Rejected', description: `Booking for "${resourceName}" by ${userName} has been cancelled.`, variant: 'destructive'});
      addAuditLog(currentUser.id, currentUser.name || 'Admin', 'BOOKING_REJECTED', { entityType: 'Booking', entityId: bookingToUpdate.id, details: `Booking for ${resourceName} by ${userName} rejected/cancelled.`});
      addNotification(
        bookingToUpdate.userId,
        'Booking Rejected',
        `Your booking for ${resourceName} on ${formatDateSafe(bookingToUpdate.startTime, '', 'MMM dd, HH:mm')} has been rejected and cancelled.`,
        'booking_rejected',
        `/bookings?bookingId=${bookingToUpdate.id}`
      );
      // Note: Queue processing for Firestore needs specific logic; removed mock processQueueForResource call.
      await fetchBookingRequestsAndRelatedData();
    } catch (error: any) {
      console.error("Error rejecting booking:", error);
      toast({ title: "Error", description: `Failed to reject booking: ${error.message}`, variant: "destructive" });
    }
  }, [currentUser, allBookingsState, allResources, allUsers, fetchBookingRequestsAndRelatedData, toast]);

  const handleApplyDialogFilters = useCallback(() => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterStatus(tempFilterStatus);
    setIsFilterDialogOpen(false);
  }, [tempSearchTerm, tempFilterResourceId, tempFilterStatus]);

  const resetDialogFilters = useCallback(() => {
    setTempSearchTerm('');
    setTempFilterResourceId('all');
    setTempFilterStatus('Pending');
  }, []);

  const resetAllActiveFilters = useCallback(() => {
    setActiveSearchTerm('');
    setActiveFilterResourceId('all');
    setActiveFilterStatus('Pending');
    resetDialogFilters();
    setIsFilterDialogOpen(false);
  }, [resetDialogFilters]);

  const activeFilterCount = useMemo(() => [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
    activeFilterStatus !== 'Pending',
  ].filter(Boolean).length, [activeSearchTerm, activeFilterResourceId, activeFilterStatus]);


  const formatTimeField = (dateInput: Date): string => {
    return isValidDateFn(dateInput) ? format(dateInput, 'p') : 'Invalid Time';
  };

  if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Lab Manager')) {
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
                      <Select value={tempFilterResourceId} onValueChange={setTempFilterResourceId}>
                          <SelectTrigger id="requestResourceDialog" className="h-9 mt-1"><SelectValue placeholder="Filter by Resource" /></SelectTrigger>
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
                        <TableCell className="font-medium">{booking.resourceName}</TableCell>
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
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleApproveBooking(booking.id)} disabled={isLoading}>
                                <ThumbsUp className="h-4 w-4 text-green-600" />
                                <span className="sr-only">Approve Booking</span>
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent><p>Approve Booking</p></TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleRejectBooking(booking.id)} disabled={isLoading}>
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
