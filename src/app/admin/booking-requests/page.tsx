
'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CheckSquare, ThumbsUp, ThumbsDown, FilterX, Search as SearchIcon, ListFilter, Clock } from 'lucide-react';
import type { Booking, Resource } from '@/types'; 
// Removed initialBookings, allAdminMockResources, processQueueForResource from mock-data import
import { addNotification, addAuditLog } from '@/lib/mock-data';
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
import { cn } from '@/lib/utils';
// Firestore imports would go here in a future step
// import { db } from '@/lib/firebase';
// import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';


export default function BookingRequestsPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  // Initialize with empty array, will be populated from Firestore later
  const [allBookingsState, setAllBookingsState] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true); // Add loading state for Firestore

  // Filter states
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<Booking['status'] | 'all'>('Pending'); 
  
  // Dialog states for filters
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState(activeSearchTerm);
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>(activeFilterResourceId);
  const [tempFilterStatus, setTempFilterStatus] = useState<Booking['status'] | 'all'>(activeFilterStatus);

  // TODO: Implement fetchBookingsFromFirestore function in a future step
  useEffect(() => {
    // This is where you would fetch data from Firestore
    // For now, it will remain empty or show a loader
    // async function fetchPendingBookings() {
    //   if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Lab Manager')) {
    //     setAllBookingsState([]);
    //     setIsLoading(false);
    //     return;
    //   }
    //   setIsLoading(true);
    //   try {
    //     const bookingsRef = collection(db, "bookings");
    //     const q = query(bookingsRef, where("status", "in", ["Pending", "Waitlisted"]));
    //     const querySnapshot = await getDocs(q);
    //     const fetchedBookings: Booking[] = [];
    //     // Fetch related resource and user names if needed, or denormalize slightly in Firestore
    //     // For simplicity here, we assume resourceName and userName are still on booking object,
    //     // but in an ideal Firestore setup, they'd be fetched or denormalized carefully.
    //     querySnapshot.forEach((docSnap) => {
    //       const data = docSnap.data();
    //       fetchedBookings.push({
    //         id: docSnap.id,
    //         ...data,
    //         // Ensure dates are Date objects
    //         startTime: data.startTime.toDate ? data.startTime.toDate() : new Date(data.startTime),
    //         endTime: data.endTime.toDate ? data.endTime.toDate() : new Date(data.endTime),
    //         createdAt: data.createdAt.toDate ? data.createdAt.toDate() : new Date(data.createdAt),
    //       } as Booking);
    //     });
    //     setAllBookingsState(fetchedBookings);
    //   } catch (error) {
    //     console.error("Error fetching booking requests: ", error);
    //     toast({ title: "Error", description: "Failed to fetch booking requests.", variant: "destructive" });
    //   }
    //   setIsLoading(false);
    // }
    // fetchPendingBookings();
    setIsLoading(false); // For now, just set loading to false as we have no data
  }, [currentUser, toast]); 

  const bookingsForApproval = useMemo(() => {
    let filtered = allBookingsState;
    
    const lowerSearch = activeSearchTerm.toLowerCase();
    if (activeSearchTerm) {
      filtered = filtered.filter(b => 
        (b.resourceName && b.resourceName.toLowerCase().includes(lowerSearch)) || // resourceName will be undefined for now
        (b.userName && b.userName.toLowerCase().includes(lowerSearch)) || // userName will be undefined for now
        (b.notes && b.notes.toLowerCase().includes(lowerSearch))
      );
    }

    if (activeFilterResourceId !== 'all') {
      filtered = filtered.filter(b => b.resourceId === activeFilterResourceId);
    }
    
    if (activeFilterStatus === 'all') {
        filtered = filtered.filter(b => b.status === 'Pending' || b.status === 'Waitlisted');
    } else if (activeFilterStatus) {
        filtered = filtered.filter(b => b.status === activeFilterStatus);
    }

    return filtered.sort((a, b) => {
        const dateA = a.startTime; // Already Date objects if fetched correctly
        const dateB = b.startTime;
        if (!isValidDate(dateA) || !isValidDate(dateB)) return 0;
        return dateA.getTime() - dateB.getTime();
    });
  }, [allBookingsState, activeSearchTerm, activeFilterResourceId, activeFilterStatus]);

  const handleApproveBooking = async (bookingId: string) => {
    // TODO: Refactor to update Firestore document
    // const bookingDocRef = doc(db, "bookings", bookingId);
    // try {
    //   await updateDoc(bookingDocRef, { status: 'Confirmed' });
    //   const approvedBooking = allBookingsState.find(b => b.id === bookingId);
    //   if (approvedBooking && currentUser) {
    //     toast({
    //       title: 'Booking Approved',
    //       description: `Booking for "${approvedBooking.resourceName}" by ${approvedBooking.userName} has been confirmed.`,
    //     });
    //     addAuditLog(currentUser.id, currentUser.name || 'Admin', 'BOOKING_APPROVED', { entityType: 'Booking', entityId: approvedBooking.id, details: `Booking for ${approvedBooking.resourceName} by ${approvedBooking.userName} approved.`});
    //     addNotification(
    //       approvedBooking.userId,
    //       'Booking Confirmed',
    //       `Your booking for ${approvedBooking.resourceName} on ${format(new Date(approvedBooking.startTime), 'MMM dd, HH:mm')} has been confirmed.`,
    //       'booking_confirmed',
    //       `/bookings?bookingId=${approvedBooking.id}`
    //     );
    //     // Re-fetch bookings
    //     // fetchPendingBookings();
    //   }
    // } catch (error) {
    //   console.error("Error approving booking:", error);
    //   toast({ title: "Error", description: "Failed to approve booking.", variant: "destructive" });
    // }
    toast({ title: "Mock Action", description: "Approve booking functionality to be updated for Firestore." });
    // Temporary mock update for UI consistency until Firestore is integrated
    const bookingIndex = allBookingsState.findIndex(b => b.id === bookingId);
    if (bookingIndex !== -1 && currentUser) {
      const updatedBookings = [...allBookingsState];
      const approvedBooking = { ...updatedBookings[bookingIndex], status: 'Confirmed' as Booking['status']};
      updatedBookings.splice(bookingIndex, 1); // Remove from pending list
      setAllBookingsState(updatedBookings); 
      addAuditLog(currentUser.id, currentUser.name || 'Admin', 'BOOKING_APPROVED', { entityType: 'Booking', entityId: approvedBooking.id, details: `Booking for ${approvedBooking.resourceName} by ${approvedBooking.userName} approved.`});
      addNotification(
        approvedBooking.userId,
        'Booking Confirmed',
        `Your booking for ${approvedBooking.resourceName} on ${format(new Date(approvedBooking.startTime), 'MMM dd, HH:mm')} has been confirmed.`,
        'booking_confirmed',
        `/bookings?bookingId=${approvedBooking.id}`
      );
    }
  };

  const handleRejectBooking = async (bookingId: string) => {
    // TODO: Refactor to update Firestore document
    // const bookingDocRef = doc(db, "bookings", bookingId);
    // try {
    //   await updateDoc(bookingDocRef, { status: 'Cancelled' });
    //   const rejectedBooking = allBookingsState.find(b => b.id === bookingId);
    //   if (rejectedBooking && currentUser) {
    //     toast({
    //       title: 'Booking Rejected',
    //       description: `Booking for "${rejectedBooking.resourceName}" by ${rejectedBooking.userName} has been cancelled.`,
    //       variant: 'destructive',
    //     });
    //     addAuditLog(currentUser.id, currentUser.name || 'Admin', 'BOOKING_REJECTED', { entityType: 'Booking', entityId: rejectedBooking.id, details: `Booking for ${rejectedBooking.resourceName} by ${rejectedBooking.userName} rejected/cancelled.`});
    //     addNotification(
    //       rejectedBooking.userId,
    //       'Booking Rejected',
    //       `Your booking for ${rejectedBooking.resourceName} on ${format(new Date(rejectedBooking.startTime), 'MMM dd, HH:mm')} has been rejected and cancelled.`,
    //       'booking_rejected',
    //       `/bookings?bookingId=${rejectedBooking.id}`
    //     );
            // Queue processing logic removed as processQueueForResource is no longer available
            // This needs to be re-implemented with Firestore logic
    //     // fetchPendingBookings();
    //   }
    // } catch (error) {
    //   console.error("Error rejecting booking:", error);
    //   toast({ title: "Error", description: "Failed to reject booking.", variant: "destructive" });
    // }
    toast({ title: "Mock Action", description: "Reject booking functionality to be updated for Firestore." });
    // Temporary mock update for UI consistency until Firestore is integrated
    const bookingIndex = allBookingsState.findIndex(b => b.id === bookingId);
    if (bookingIndex !== -1 && currentUser) {
      const updatedBookings = [...allBookingsState];
      const rejectedBooking = { ...updatedBookings[bookingIndex], status: 'Cancelled' as Booking['status']};
      updatedBookings.splice(bookingIndex, 1); // Remove from pending list
      setAllBookingsState(updatedBookings);
      addAuditLog(currentUser.id, currentUser.name || 'Admin', 'BOOKING_REJECTED', { entityType: 'Booking', entityId: rejectedBooking.id, details: `Booking for ${rejectedBooking.resourceName} by ${rejectedBooking.userName} rejected/cancelled.`});
      addNotification(
        rejectedBooking.userId,
        'Booking Rejected',
        `Your booking for ${rejectedBooking.resourceName} on ${format(new Date(rejectedBooking.startTime), 'MMM dd, HH:mm')} has been rejected and cancelled.`,
        'booking_rejected',
        `/bookings?bookingId=${rejectedBooking.id}`
      );
    }
  };
  
  const handleApplyFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterStatus(tempFilterStatus);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFilters = () => {
    setTempSearchTerm('');
    setTempFilterResourceId('all');
    setTempFilterStatus('Pending'); 
  };

  const resetAllActiveFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterResourceId('all');
    setActiveFilterStatus('Pending'); 
    resetDialogFilters(); 
    setIsFilterDialogOpen(false); 
  };

  const activeFilterCount = [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
    activeFilterStatus !== 'Pending', // Default is Pending, so filter is active if not Pending or all
  ].filter(Boolean).length;

  const formatDateField = (dateInput: Date): string => {
    return isValidDate(dateInput) ? format(dateInput, 'MMM dd, yyyy') : 'Invalid Date';
  };

  const formatTimeField = (dateInput: Date): string => {
    return isValidDate(dateInput) ? format(dateInput, 'p') : '';
  };

  const bookingStatusesForFilterDialog: Array<Booking['status'] | 'all'> = ['all', 'Pending', 'Waitlisted'];

  // Placeholder for actual resource names, to be fetched or denormalized
  const getResourceNameById = (resourceId: string): string => {
    // In a real scenario, you'd fetch this from a resources state or context
    // or have it denormalized on the booking object from Firestore.
    // For now, this will effectively be missing.
    return resourceId; 
  };
  const getUserNameById = (userId: string): string => {
    // Similar to getResourceNameById, this would be fetched.
    return `User ${userId.substring(0, 6)}...`;
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
                        onChange={(e) => setTempSearchTerm(e.target.value.toLowerCase())}
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
                              {/* Resource options would be populated from fetched resources in a real app */}
                              {Array.from(new Set(allBookingsState.map(b => b.resourceId)))
                                  .map(resourceId => {
                                      return <SelectItem key={resourceId} value={resourceId}>{getResourceNameById(resourceId)}</SelectItem>;
                                  })
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
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyFilters}>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        {isLoading ? (
          <div className="flex justify-center items-center py-10"><Clock className="mr-2 h-6 w-6 animate-spin" /> Loading requests...</div>
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
                        <TableCell className="font-medium">{booking.resourceName || getResourceNameById(booking.resourceId)}</TableCell>
                        <TableCell>{booking.userName || getUserNameById(booking.userId)}</TableCell>
                        <TableCell>
                          <div>{formatDateField(booking.startTime)}</div>
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
