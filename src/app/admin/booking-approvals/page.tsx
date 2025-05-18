
'use client';

import { useState, useEffect, useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CheckSquare, ThumbsUp, ThumbsDown, FilterX, Search as SearchIcon, ListFilter } from 'lucide-react';
import type { Booking } from '@/types';
import { initialBookings, allAdminMockResources } from '@/lib/mock-data';
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
import { format, parseISO, isValid } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

// Note: In a real app, access to this page would be restricted by role (Admin/Lab Manager)

export default function BookingApprovalsPage() {
  const { toast } = useToast();
  const [allBookings, setAllBookings] = useState<Booking[]>(() => JSON.parse(JSON.stringify(initialBookings)));

  // Active filters for the page
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  
  // Filter Dialog State
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState(activeSearchTerm);
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>(activeFilterResourceId);

  useEffect(() => {
    // For this mock setup, re-filter if initialBookings (the global array) were to somehow change.
    // In a real app, this might involve re-fetching or subscribing to updates.
    setAllBookings(JSON.parse(JSON.stringify(initialBookings)));
  }, []); 

  const pendingBookings = useMemo(() => {
    let filtered = allBookings.filter(b => b.status === 'Pending');
    
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

    return filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [allBookings, activeSearchTerm, activeFilterResourceId]);


  const handleApproveBooking = (bookingId: string) => {
    const bookingIndex = allBookings.findIndex(b => b.id === bookingId);
    if (bookingIndex !== -1) {
      const updatedBookings = [...allBookings];
      updatedBookings[bookingIndex].status = 'Confirmed';
      setAllBookings(updatedBookings);

      const globalBookingIndex = initialBookings.findIndex(b => b.id === bookingId);
      if (globalBookingIndex !== -1) {
        initialBookings[globalBookingIndex].status = 'Confirmed';
      }
      toast({
        title: 'Booking Approved',
        description: `Booking for "${updatedBookings[bookingIndex].resourceName}" by ${updatedBookings[bookingIndex].userName} has been confirmed.`,
      });
    }
  };

  const handleRejectBooking = (bookingId: string) => {
    const bookingIndex = allBookings.findIndex(b => b.id === bookingId);
    if (bookingIndex !== -1) {
      const updatedBookings = [...allBookings];
      updatedBookings[bookingIndex].status = 'Cancelled'; 
      setAllBookings(updatedBookings);

      const globalBookingIndex = initialBookings.findIndex(b => b.id === bookingId);
      if (globalBookingIndex !== -1) {
        initialBookings[globalBookingIndex].status = 'Cancelled';
      }
      toast({
        title: 'Booking Rejected',
        description: `Booking for "${updatedBookings[bookingIndex].resourceName}" by ${updatedBookings[bookingIndex].userName} has been cancelled.`,
        variant: 'destructive',
      });
    }
  };
  
  const handleApplyFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFilters = () => {
    setTempSearchTerm('');
    setTempFilterResourceId('all');
  };

  const resetAllActiveFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterResourceId('all');
    resetDialogFilters(); // Also reset temp values in dialog
    setIsFilterDialogOpen(false); // Close dialog if open
  };

  const activeFilterCount = [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
  ].filter(Boolean).length;

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PageHeader
          title="Booking Approvals"
          description="Review and manage pending booking requests."
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
                    <DialogTitle>Filter Pending Approvals</DialogTitle>
                    <DialogDescription>
                      Refine the list of pending booking requests.
                    </DialogDescription>
                  </DialogHeader>
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="approvalSearchDialog" className="text-sm font-medium mb-1 block">Search (Resource/User/Notes)</Label>
                       <div className="relative">
                         <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                          id="approvalSearchDialog"
                          type="search"
                          placeholder="Keyword..."
                          value={tempSearchTerm}
                          onChange={(e) => setTempSearchTerm(e.target.value)}
                          className="h-9 pl-8"
                          />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="approvalResourceDialog" className="text-sm font-medium mb-1 block">Resource</Label>
                      <Select value={tempFilterResourceId} onValueChange={setTempFilterResourceId}>
                          <SelectTrigger id="approvalResourceDialog" className="h-9"><SelectValue placeholder="Filter by Resource" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">All Resources</SelectItem>
                              {/* Get unique resource names from pending bookings for filter options */}
                              {Array.from(new Set(allBookings.filter(b => b.status === 'Pending').map(b => b.resourceId)))
                                  .map(resourceId => {
                                      const resource = allAdminMockResources.find(r => r.id === resourceId);
                                      return resource ? <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem> : null;
                                  })
                              }
                          </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter className="pt-6">
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

        {pendingBookings.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Pending Requests ({pendingBookings.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Booked By</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Notes</TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.resourceName}</TableCell>
                        <TableCell>{booking.userName}</TableCell>
                        <TableCell>
                          <div>{isValid(parseISO(booking.startTime.toString())) ? format(parseISO(booking.startTime.toString()), 'MMM dd, yyyy') : 'Invalid Date'}</div>
                          <div className="text-xs text-muted-foreground">
                              {isValid(parseISO(booking.startTime.toString())) ? format(parseISO(booking.startTime.toString()), 'p') : ''} - 
                              {isValid(parseISO(booking.endTime.toString())) ? format(parseISO(booking.endTime.toString()), 'p') : ''}
                          </div>
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
          <Card className="text-center py-10 text-muted-foreground">
            <CardContent>
              <CheckSquare className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">
                  {activeFilterCount > 0 ? "No Pending Bookings Match Filters" : "No Pending Bookings"}
              </p>
              <p className="text-sm mb-4">
                  {activeFilterCount > 0
                      ? "Try adjusting your filter criteria."
                      : "There are currently no booking requests awaiting approval."
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
