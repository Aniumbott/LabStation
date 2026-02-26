
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CheckSquare, ThumbsUp, ThumbsDown, FilterX, Search as SearchIcon, Filter as FilterIcon, Clock, Info, User as UserIcon, Package as ResourceIcon, CheckCircle2, StickyNote } from 'lucide-react';
import type { Booking, Resource, User } from '@/types';
import { useAuth } from '@/components/auth-context';
import { approveBooking_SA, rejectBooking_SA } from '@/lib/actions/booking.actions';
import { useAdminData } from '@/contexts/AdminDataContext';
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
import { format, isValid as isValidDateFn } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, formatDateSafe, getBookingStatusBadge } from '@/lib/utils';
import { getResources_SA, getPendingBookings_SA } from '@/lib/actions/data.actions';
import { ScrollArea } from '@/components/ui/scroll-area';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';


const bookingStatusesForApprovalFilter: Array<'all' | 'Pending' | 'Waitlisted'> = ['all', 'Pending', 'Waitlisted'];

export default function BookingRequestsPage() {
  const { toast } = useToast();
  const { currentUser: loggedInUserFromContext } = useAuth();
  const { allUsers, isLoading: isAdminDataLoading } = useAdminData();

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
      const [resourcesResult, bookingsResult] = await Promise.all([
        getResources_SA(),
        getPendingBookings_SA(),
      ]);

      const fetchedResources: Resource[] = resourcesResult.success && resourcesResult.data ? resourcesResult.data : [];
      setAllResources(fetchedResources);

      if (bookingsResult.success && bookingsResult.data) {
        const bookingsWithDetails = bookingsResult.data.map(data => {
          const resource = fetchedResources.find(r => r.id === data.resourceId);
          const user = allUsers.find(u => u.id === data.userId);
          return {
            ...data,
            startTime: data.startTime ? new Date(data.startTime) : new Date(),
            endTime: data.endTime ? new Date(data.endTime) : new Date(),
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            resourceName: resource?.name || "Unknown Resource",
            userName: user?.name || "Unknown User",
          } as Booking & { resourceName?: string, userName?: string };
        });
        setAllBookingsState(bookingsWithDetails);
      } else {
        setAllBookingsState([]);
      }
    } catch (error: any) {
      setAllBookingsState([]);
    }
    setIsLoading(false);
  }, [canManageBookingRequests, allUsers]);


  useEffect(() => {
    if (!isAdminDataLoading) {
      fetchBookingRequestsAndRelatedData();
    }
  }, [fetchBookingRequestsAndRelatedData, isAdminDataLoading]);

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
    if (!loggedInUserFromContext || !loggedInUserFromContext.id) {
        toast({ title: "Authentication Error", description: "Current user context is missing for approval.", variant: "destructive" });
        return;
    }
    const bookingToUpdate = allBookingsState.find(b => b.id === bookingId);
    if (!bookingToUpdate) {
        toast({ title: "Error", description: "Booking data not found for approval.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    try {
      await approveBooking_SA({ callerUserId: loggedInUserFromContext.id, bookingId });
      toast({ title: 'Booking Approved', description: `Booking for "${bookingToUpdate.resourceName || 'Unknown Resource'}" by ${bookingToUpdate.userName || 'Unknown User'} has been confirmed.`});
      await fetchBookingRequestsAndRelatedData();
    } catch (error: any) {
      console.error("Error approving booking:", error);
      toast({ title: "Error Approving Booking", description: `Failed to approve booking: ${error.message || 'Unknown error'}`, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }, [loggedInUserFromContext, allBookingsState, fetchBookingRequestsAndRelatedData, toast]);

  const handleRejectBooking = useCallback(async (bookingId: string) => {
    if (!loggedInUserFromContext || !loggedInUserFromContext.id) {
        toast({ title: "Authentication Error", description: "Current user context is missing for rejection.", variant: "destructive" });
        return;
    }
    const bookingToUpdate = allBookingsState.find(b => b.id === bookingId);
    if (!bookingToUpdate) {
        toast({ title: "Error", description: "Booking data not found for rejection.", variant: "destructive" });
        return;
    }

    setIsLoading(true);
    try {
      await rejectBooking_SA({ callerUserId: loggedInUserFromContext.id, bookingId });
      toast({ title: 'Booking Rejected', description: `Booking for "${bookingToUpdate.resourceName || 'Unknown Resource'}" by ${bookingToUpdate.userName || 'Unknown User'} has been cancelled.`, variant: 'destructive'});
      await fetchBookingRequestsAndRelatedData();
    } catch (error: any) {
      console.error("Error rejecting booking:", error);
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
      <div className="space-y-6">
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
      <div className="space-y-6">
        <PageHeader
          title="Booking Requests"
          description="Review and manage pending or waitlisted booking requests."
          icon={CheckSquare}
          actions={
            <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <FilterIcon className="mr-2 h-4 w-4" />
                  Filter
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-full sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Filter Booking Requests</DialogTitle>
                  <DialogDescription>
                    Refine the list of pending or waitlisted booking requests.
                  </DialogDescription>
                </DialogHeader>
                <ScrollArea className="max-h-[60vh] mt-4">
                  <div className="space-y-4 px-4 py-2">
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
                        <Select value={tempFilterResourceId} onValueChange={setTempFilterResourceId} disabled={isAdminDataLoading || (allResources && allResources.length === 0)}>
                            <SelectTrigger id="requestResourceDialog" className="h-9 mt-1">
                              <SelectValue placeholder={isAdminDataLoading ? "Loading..." : (allResources && allResources.length > 0 ? "Filter by Resource" : "No resources found")} />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Resources</SelectItem>
                                {allResources && allResources
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
                </ScrollArea>
                <DialogFooter className="pt-6 border-t">
                    <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button onClick={handleApplyDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          }
        />

        <div className="rounded-lg border border-border overflow-hidden bg-card">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground"><div className="flex items-center gap-1.5"><ResourceIcon className="h-4 w-4 text-muted-foreground" />Resource</div></TableHead>
                <TableHead className="font-semibold text-foreground"><div className="flex items-center gap-1.5"><UserIcon className="h-4 w-4 text-muted-foreground" />Booked By</div></TableHead>
                <TableHead className="font-semibold text-foreground"><div className="flex items-center gap-1.5"><Clock className="h-4 w-4 text-muted-foreground" />Date & Time</div></TableHead>
                <TableHead className="font-semibold text-foreground"><div className="flex items-center gap-1.5"><Info className="h-4 w-4 text-muted-foreground" />Status</div></TableHead>
                <TableHead className="font-semibold text-foreground"><div className="flex items-center gap-1.5"><StickyNote className="h-4 w-4 text-muted-foreground" />Notes</div></TableHead>
                <TableHead className="font-semibold text-foreground text-right w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(isLoading || isAdminDataLoading) && allBookingsState.length === 0 ? (
                <TableSkeleton rows={5} cols={6} />
              ) : bookingsForApproval.length > 0 ? (
                bookingsForApproval.map((booking) => (
                  <TableRow key={booking.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{booking.resourceName}</TableCell>
                    <TableCell>{booking.userName}</TableCell>
                    <TableCell>
                      <div>{formatDateSafe(booking.startTime, 'N/A', 'MMM dd, yyyy')}</div>
                      <div className="text-xs text-muted-foreground">
                          {formatTimeField(booking.startTime)} - {formatTimeField(booking.endTime)}
                      </div>
                    </TableCell>
                    <TableCell>
                        {getBookingStatusBadge(booking.status as Booking['status'])}
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
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={6}>
                    <EmptyState
                      icon={CheckSquare}
                      title={activeFilterCount > 0 ? "No Requests Match Filters" : "No Pending or Waitlisted Booking Requests"}
                      description={activeFilterCount > 0
                        ? "Try adjusting your filter criteria."
                        : "There are currently no booking requests awaiting approval or on the waitlist."
                      }
                      action={activeFilterCount > 0 ? (
                        <Button variant="outline" onClick={resetAllActivePageFilters}>
                          <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                        </Button>
                      ) : undefined}
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </TooltipProvider>
  );
}
