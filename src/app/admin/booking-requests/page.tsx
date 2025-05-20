
'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CheckSquare, ThumbsUp, ThumbsDown, FilterX, Search as SearchIcon, ListFilter, Clock } from 'lucide-react';
import type { Booking } from '@/types';
import { initialBookings, allAdminMockResources, addNotification, bookingStatusesForFilter } from '@/lib/mock-data';
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


export default function BookingRequestsPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [allBookingsState, setAllBookingsState] = useState<Booking[]>(() => JSON.parse(JSON.stringify(initialBookings)));

  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<Booking['status'] | 'all'>('Pending'); // Default to Pending
  
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState(activeSearchTerm);
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>(activeFilterResourceId);
  const [tempFilterStatus, setTempFilterStatus] = useState<Booking['status'] | 'all'>(activeFilterStatus);

  useEffect(() => {
    setAllBookingsState(JSON.parse(JSON.stringify(initialBookings)));
  }, []); 

  const bookingsForApproval = useMemo(() => {
    let filtered = allBookingsState.filter(b => b.status === 'Pending' || b.status === 'Waitlisted');
    
    if (activeSearchTerm) {
      const lowerSearch = activeSearchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.resourceName.toLowerCase().includes(lowerSearch) ||
        b.userName.toLowerCase().includes(lowerSearch) ||
        (b.notes && b.notes.toLowerCase().includes(lowerSearch))
      );
    }

    if (activeFilterResourceId !== 'all') {
      filtered = filtered.filter(b => b.resourceId === activeFilterResourceId);
    }
    
    if (activeFilterStatus !== 'all') {
        filtered = filtered.filter(b => b.status === activeFilterStatus);
    } else { // If 'all' statuses selected in dialog, still default to pending/waitlisted for this page
        filtered = filtered.filter(b => b.status === 'Pending' || b.status === 'Waitlisted');
    }


    return filtered.sort((a, b) => {
        const dateA = typeof a.startTime === 'string' ? parseISO(a.startTime) : a.startTime;
        const dateB = typeof b.startTime === 'string' ? parseISO(b.startTime) : b.startTime;
        if (!isValidDate(dateA) || !isValidDate(dateB)) return 0;
        return dateA.getTime() - dateB.getTime();
    });
  }, [allBookingsState, activeSearchTerm, activeFilterResourceId, activeFilterStatus]);


  const handleApproveBooking = (bookingId: string) => {
    const bookingIndex = allBookingsState.findIndex(b => b.id === bookingId);
    if (bookingIndex !== -1) {
      const updatedBookings = [...allBookingsState];
      const approvedBooking = { ...updatedBookings[bookingIndex], status: 'Confirmed' as Booking['status']};
      updatedBookings[bookingIndex] = approvedBooking;
      setAllBookingsState(updatedBookings);

      const globalBookingIndex = initialBookings.findIndex(b => b.id === bookingId);
      if (globalBookingIndex !== -1) {
        initialBookings[globalBookingIndex].status = 'Confirmed';
      }
      toast({
        title: 'Booking Approved',
        description: `Booking for "${approvedBooking.resourceName}" by ${approvedBooking.userName} has been confirmed.`,
      });
      addNotification(
        approvedBooking.userId,
        'Booking Confirmed',
        `Your booking for ${approvedBooking.resourceName} on ${format(new Date(approvedBooking.startTime), 'MMM dd, HH:mm')} has been confirmed.`,
        'booking_confirmed',
        `/bookings?bookingId=${approvedBooking.id}`
      );
    }
  };

  const handleRejectBooking = (bookingId: string) => {
    const bookingIndex = allBookingsState.findIndex(b => b.id === bookingId);
    if (bookingIndex !== -1) {
      const updatedBookings = [...allBookingsState];
      const rejectedBooking = { ...updatedBookings[bookingIndex], status: 'Cancelled' as Booking['status']}; // Changed to Cancelled
      updatedBookings[bookingIndex] = rejectedBooking;
      setAllBookingsState(updatedBookings);

      const globalBookingIndex = initialBookings.findIndex(b => b.id === bookingId);
      if (globalBookingIndex !== -1) {
        initialBookings[globalBookingIndex].status = 'Cancelled'; // Changed to Cancelled
      }
      toast({
        title: 'Booking Rejected',
        description: `Booking for "${rejectedBooking.resourceName}" by ${rejectedBooking.userName} has been cancelled.`,
        variant: 'destructive',
      });
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
    setTempFilterStatus('Pending'); // Default to Pending
  };

  const resetAllActiveFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterResourceId('all');
    setActiveFilterStatus('Pending'); // Default to Pending
    resetDialogFilters(); 
    setIsFilterDialogOpen(false); 
  };

  const activeFilterCount = [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
    activeFilterStatus !== 'Pending' && activeFilterStatus !== 'all', // Count if not default pending or all
  ].filter(Boolean).length;

  const formatDateField = (dateInput: string | Date): string => {
    const date = typeof dateInput === 'string' ? parseISO(dateInput) : dateInput;
    return isValidDate(date) ? format(date, 'MMM dd, yyyy') : 'Invalid Date';
  };

  const formatTimeField = (dateInput: string | Date): string => {
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
            <div className="flex items-center gap-2">
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
                    <div>
                      <Label htmlFor="requestResourceDialog" className="text-sm font-medium mb-1 block">Resource</Label>
                      <Select value={tempFilterResourceId} onValueChange={setTempFilterResourceId}>
                          <SelectTrigger id="requestResourceDialog" className="h-9"><SelectValue placeholder="Filter by Resource" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">All Resources</SelectItem>
                              {Array.from(new Set(allBookingsState.filter(b => b.status === 'Pending' || b.status === 'Waitlisted').map(b => b.resourceId)))
                                  .map(resourceId => {
                                      const resource = allAdminMockResources.find(r => r.id === resourceId);
                                      return resource ? <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem> : null;
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
                              <SelectItem value="all">All (Pending & Waitlisted)</SelectItem>
                              <SelectItem value="Pending">Pending</SelectItem>
                              <SelectItem value="Waitlisted">Waitlisted</SelectItem>
                          </SelectContent>
                      </Select>
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
            </div>
          }
        />

        {bookingsForApproval.length > 0 ? (
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
