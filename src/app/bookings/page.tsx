
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarDays, PlusCircle, Edit3, X, Clock, User as UserIconLucide, Info, Search as SearchIcon, FilterX, Eye, Loader2, Filter as FilterIcon, Calendar as CalendarIcon, CheckSquare, ThumbsUp } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Booking, Resource, RoleName } from '@/types';
import { format, parseISO, isValid as isValidDate, startOfDay, isSameDay, set, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { allAdminMockResources, initialBookings, mockCurrentUser } from '@/lib/mock-data';


const timeSlots = Array.from({ length: (17 - 9) * 2 + 1 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

const bookingStatuses: Booking['status'][] = ['Confirmed', 'Pending', 'Cancelled'];
type BookingStatusFilter = Booking['status'] | 'all';

function BookingsPageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-muted-foreground">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="mt-2 text-sm">Loading bookings...</p>
    </div>
  );
}

function BookingsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [allUserBookings, setAllUserBookings] = useState<Booking[]>(() => initialBookings.filter(b => b.userId === mockCurrentUser.id));

  const [activeSelectedDate, setActiveSelectedDate] = useState<Date | undefined>(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsedDate = parseISO(dateParam);
      if (isValidDate(parsedDate)) return startOfDay(parsedDate);
    }
    return undefined;
  });

  // Active page filters (for Dialog)
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<BookingStatusFilter>('all');

  // Booking Form Dialog state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Partial<Booking> & { resourceId?: string } | null>(null);

  // Filter Dialog State
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState(activeSearchTerm);
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>(activeFilterResourceId);
  const [tempFilterStatus, setTempFilterStatus] = useState<BookingStatusFilter>(activeFilterStatus);
  const [tempSelectedDateInDialog, setTempSelectedDateInDialog] = useState<Date | undefined>(activeSelectedDate);
  const [currentCalendarMonthInDialog, setCurrentCalendarMonthInDialog] = useState<Date>(activeSelectedDate || startOfDay(new Date()));

  const [isClient, setIsClient] = useState(false);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

 useEffect(() => {
    setIsClient(true);
    const resourceIdParam = searchParams.get('resourceId');
    const dateParam = searchParams.get('date');
    const bookingIdParam = searchParams.get('bookingId');

    let dateToSet = activeSelectedDate;
    if (dateParam) {
      const parsedQueryDate = parseISO(dateParam);
      if (isValidDate(parsedQueryDate)) {
        dateToSet = startOfDay(parsedQueryDate);
      }
    }
    
    if (dateToSet && (!activeSelectedDate || !isSameDay(activeSelectedDate, dateToSet))) {
      setActiveSelectedDate(dateToSet);
      setTempSelectedDateInDialog(dateToSet); // Sync with dialog date
      setCurrentCalendarMonthInDialog(dateToSet);
    } else if (!dateParam && activeSelectedDate) { 
        // If date param is removed from URL, clear activeSelectedDate
        // setActiveSelectedDate(undefined);
        // setTempSelectedDateInDialog(undefined);
        // setCurrentCalendarMonthInDialog(startOfDay(new Date()));
    }


    const shouldOpenFormForEdit = bookingIdParam && (!isFormOpen || (currentBooking?.id !== bookingIdParam));
    const shouldOpenFormForNewWithResourceAndDate = resourceIdParam && dateToSet && (!isFormOpen || currentBooking?.id || currentBooking?.resourceId !== resourceIdParam || (currentBooking?.startTime && !isSameDay(new Date(currentBooking.startTime), dateToSet)));
    const shouldOpenFormForNewWithResourceOnly = resourceIdParam && !dateToSet && (!isFormOpen || currentBooking?.id || currentBooking?.resourceId !== resourceIdParam);


    if (shouldOpenFormForEdit) {
      const bookingToEdit = allUserBookings.find(b => b.id === bookingIdParam);
      if (bookingToEdit) {
        handleOpenForm(bookingToEdit);
      }
    } else if (shouldOpenFormForNewWithResourceAndDate) {
      handleOpenForm(undefined, resourceIdParam, dateToSet);
    } else if (shouldOpenFormForNewWithResourceOnly) {
      handleOpenForm(undefined, resourceIdParam);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, allUserBookings]); 

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterResourceId(activeFilterResourceId);
      setTempFilterStatus(activeFilterStatus);
      setTempSelectedDateInDialog(activeSelectedDate); 
      setCurrentCalendarMonthInDialog(activeSelectedDate || startOfDay(new Date()));
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterResourceId, activeFilterStatus, activeSelectedDate]);


  const bookingsToDisplay = useMemo(() => {
    let filtered = [...allUserBookings];

    if (activeSelectedDate) {
      filtered = filtered.filter(b => isValidDate(new Date(b.startTime)) && isSameDay(new Date(b.startTime), activeSelectedDate));
    }

    if (activeSearchTerm && activeSearchTerm !== '') {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      filtered = filtered.filter(b =>
        b.resourceName.toLowerCase().includes(lowerSearchTerm) ||
        (b.notes && b.notes.toLowerCase().includes(lowerSearchTerm))
      );
    }

    if (activeFilterResourceId && activeFilterResourceId !== 'all') {
      filtered = filtered.filter(b => b.resourceId === activeFilterResourceId);
    }

    if (activeFilterStatus && activeFilterStatus !== 'all') {
      filtered = filtered.filter(b => b.status === activeFilterStatus);
    }

    return filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [allUserBookings, activeSelectedDate, activeSearchTerm, activeFilterResourceId, activeFilterStatus]);


  const handleOpenForm = (bookingToEdit?: Booking, resourceIdForNew?: string | null, dateForNew?: Date | null) => {
    const baseDateForNewBooking = dateForNew || activeSelectedDate || startOfDay(new Date());
    const defaultStartTime = set(new Date(baseDateForNewBooking), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });

    let bookingData: Partial<Booking> & { resourceId?: string };

    if (bookingToEdit) {
        bookingData = { ...bookingToEdit, startTime: new Date(bookingToEdit.startTime), endTime: new Date(bookingToEdit.endTime), userName: bookingToEdit.userName || mockCurrentUser.name };
    } else {
        const initialResourceId = resourceIdForNew || (allAdminMockResources.length > 0 ? allAdminMockResources.find(r => r.status === 'Available')?.id || allAdminMockResources[0].id : '');
        bookingData = {
            startTime: defaultStartTime,
            endTime: new Date(defaultStartTime.getTime() + 2 * 60 * 60 * 1000), 
            userName: mockCurrentUser.name,
            userId: mockCurrentUser.id,
            resourceId: initialResourceId,
            status: 'Pending', notes: '', // New bookings default to 'Pending'
        };
    }
    setCurrentBooking(bookingData);
    setIsFormOpen(true);
  };

  const handleSaveBooking = (formData: Partial<Booking>) => {
    if (!formData.resourceId || !formData.startTime || !formData.endTime || !formData.userName) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    const resource = allAdminMockResources.find(r => r.id === formData.resourceId);
    if (!resource) { toast({ title: "Error", description: "Selected resource not found.", variant: "destructive" }); return; }

    const proposedStartTime = new Date(formData.startTime);
    const proposedEndTime = new Date(formData.endTime);

    if (proposedEndTime <= proposedStartTime) { toast({ title: "Invalid Time", description: "End time must be after start time.", variant: "destructive" }); return; }

    // For mock data, find conflict in initialBookings (global array)
    const conflictingBooking = initialBookings.find(existingBooking => {
        if (existingBooking.resourceId !== formData.resourceId) return false;
        if (existingBooking.status === 'Cancelled') return false;
        if (currentBooking && currentBooking.id && existingBooking.id === currentBooking.id) return false; // Don't conflict with self when editing
        if(format(new Date(existingBooking.startTime), 'yyyy-MM-dd') !== format(proposedStartTime, 'yyyy-MM-dd')) return false;
        const existingStartTime = new Date(existingBooking.startTime);
        const existingEndTime = new Date(existingBooking.endTime);
        return proposedStartTime < existingEndTime && proposedEndTime > existingStartTime;
    });

    if (conflictingBooking) {
        toast({ title: "Booking Conflict", description: `${resource.name} is already booked by ${conflictingBooking.userName} from ${format(conflictingBooking.startTime, 'p')} to ${format(conflictingBooking.endTime, 'p')}.`, variant: "destructive", duration: 7000 });
        return;
    }

    const isNewBooking = !currentBooking?.id;
    const newBookingData = { 
        ...formData, 
        userId: mockCurrentUser.id, 
        userName: mockCurrentUser.name, 
        startTime: proposedStartTime, 
        endTime: proposedEndTime, 
        resourceName: resource.name, 
        status: isNewBooking ? 'Pending' : (formData.status || 'Pending') // New bookings always pending, edits retain status unless changed
    } as Booking;


    if (!isNewBooking && currentBooking?.id) { // Editing existing booking
      setAllUserBookings(prev => prev.map(b => b.id === currentBooking.id ? { ...b, ...newBookingData, id: b.id } : b));
      // Update global mock data as well for consistency
      const globalIndex = initialBookings.findIndex(b => b.id === currentBooking.id);
      if (globalIndex !== -1) initialBookings[globalIndex] = { ...initialBookings[globalIndex], ...newBookingData, id: initialBookings[globalIndex].id };
      toast({ title: "Success", description: "Booking updated successfully."});
    } else { // Creating new booking
      const newBookingId = `b${initialBookings.length + 1 + Date.now()}`;
      const finalNewBooking = { ...newBookingData, id: newBookingId };
      setAllUserBookings(prev => [...prev, finalNewBooking]);
       // Update global mock data
      initialBookings.push(finalNewBooking);
      toast({ title: "Success", description: "Booking created and submitted for approval."});
    }
    setIsFormOpen(false);
  };

  const handleCancelBookingLocal = (bookingId: string) => {
    setAllUserBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'Cancelled' } : b));
    const globalIndex = initialBookings.findIndex(b => b.id === bookingId);
    if (globalIndex !== -1) initialBookings[globalIndex].status = 'Cancelled';
    toast({ title: "Info", description: "Booking cancelled."});
  };

  const handleOpenDetailsDialog = (booking: Booking) => {
    setSelectedBookingForDetails(booking);
    setIsDetailsDialogOpen(true);
  };

  const handleApplyDialogFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterStatus(tempFilterStatus);
    setActiveSelectedDate(tempSelectedDateInDialog ? startOfDay(tempSelectedDateInDialog) : undefined);

    const newSearchParams = new URLSearchParams(searchParams.toString());
    if (tempSelectedDateInDialog) {
        newSearchParams.set('date', format(startOfDay(tempSelectedDateInDialog), 'yyyy-MM-dd'));
    } else {
        newSearchParams.delete('date');
    }
    router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    setIsFilterDialogOpen(false);
  };

  const resetDialogFilters = () => {
    setTempSearchTerm('');
    setTempFilterResourceId('all');
    setTempFilterStatus('all');
    setTempSelectedDateInDialog(undefined);
    setCurrentCalendarMonthInDialog(startOfDay(new Date()));
  };

  const resetAllActiveFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterResourceId('all');
    setActiveFilterStatus('all');
    setActiveSelectedDate(undefined);
    resetDialogFilters();

    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.delete('date');
    newSearchParams.delete('bookingId');
    newSearchParams.delete('resourceId');
    router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    setIsFilterDialogOpen(false);
  };
  
  const bookedDatesForCalendar = useMemo(() => {
    const dates = new Set<string>();
    allUserBookings.forEach(booking => {
      if (booking.status !== 'Cancelled' && isValidDate(new Date(booking.startTime))) {
        dates.add(format(new Date(booking.startTime), 'yyyy-MM-dd'));
      }
    });
    return Array.from(dates).map(dateStr => parseISO(dateStr));
  }, [allUserBookings]);

  const handleDateSelectFromMainCalendar = (date?: Date) => {
    const newSelectedDate = date ? startOfDay(date) : undefined;
    setActiveSelectedDate(newSelectedDate);
    setTempSelectedDateInDialog(newSelectedDate); // Sync with dialog

    const currentParams = new URLSearchParams(searchParams.toString());
    if (newSelectedDate) {
      currentParams.set('date', format(newSelectedDate, 'yyyy-MM-dd'));
    } else {
      currentParams.delete('date');
    }
    router.push(`${pathname}?${currentParams.toString()}`, { scroll: false });
  };


  if (!isClient) {
    return <BookingsPageLoader />;
  }

  const activeFilterCount = [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
    activeFilterStatus !== 'all',
    activeSelectedDate !== undefined,
  ].filter(Boolean).length;

  let formKey = `new:${activeSelectedDate?.toISOString() || 'nodate'}`;
  if (currentBooking?.id) {
    formKey = currentBooking.id;
  } else if (currentBooking?.resourceId) {
    formKey += `:${currentBooking.resourceId}`;
  }
   if (currentBooking?.startTime && isValidDate(new Date(currentBooking.startTime))) {
    formKey += `:${new Date(currentBooking.startTime).toISOString()}`;
  }


  return (
    <div className="space-y-8">
      <PageHeader
        title="Bookings"
        description="View, search, filter, and manage your lab resource bookings."
        icon={CalendarDays}
        actions={
            <div className="flex items-center gap-2">
                 <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline">
                            <FilterIcon className="mr-2 h-4 w-4" /> Filters
                            {activeFilterCount > 0 && (
                                <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">
                                {activeFilterCount}
                                </Badge>
                            )}
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-lg">
                        <DialogHeader>
                        <DialogTitle>Filter Your Bookings</DialogTitle>
                        <DialogDescription>
                            Refine your list of bookings by date, resource, status, or keywords.
                        </DialogDescription>
                        </DialogHeader>
                        <Separator className="my-4" />
                        <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2">
                            <div>
                                <Label htmlFor="bookingSearchDialog" className="text-sm font-medium mb-1 block">Search by Keyword</Label>
                                <div className="relative">
                                    <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                        id="bookingSearchDialog"
                                        type="search"
                                        placeholder="Resource name or notes..."
                                        className="h-9 pl-8"
                                        value={tempSearchTerm}
                                        onChange={(e) => setTempSearchTerm(e.target.value.toLowerCase())}
                                    />
                                </div>
                            </div>
                            <Separator />
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="bookingResourceDialog" className="text-sm font-medium mb-1 block">Resource</Label>
                                    <Select value={tempFilterResourceId} onValueChange={setTempFilterResourceId}>
                                        <SelectTrigger id="bookingResourceDialog" className="h-9"><SelectValue placeholder="Filter by Resource" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Resources</SelectItem>
                                            {allAdminMockResources.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <Label htmlFor="bookingStatusDialog" className="text-sm font-medium mb-1 block">Status</Label>
                                    <Select value={tempFilterStatus} onValueChange={(v) => setTempFilterStatus(v as BookingStatusFilter)}>
                                        <SelectTrigger id="bookingStatusDialog" className="h-9"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">All Statuses</SelectItem>
                                            {bookingStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <Label className="text-sm font-medium mb-2 block">Filter by Date</Label>
                                <div className="flex justify-center items-center rounded-md border p-2">
                                    <Calendar
                                        mode="single" selected={tempSelectedDateInDialog} onSelect={setTempSelectedDateInDialog}
                                        month={currentCalendarMonthInDialog} onMonthChange={setCurrentCalendarMonthInDialog}
                                        disabled={(date) => date < startOfDay(addDays(new Date(), -90)) }
                                        modifiers={{ booked: bookedDatesForCalendar }}
                                        modifiersClassNames={{ booked: 'day-booked-dot' }}
                                        footer={
                                            <div className="flex flex-col gap-2 items-center pt-2">
                                            {tempSelectedDateInDialog && <Button variant="ghost" size="sm" onClick={() => setTempSelectedDateInDialog(undefined)} className="w-full text-xs">Clear Date Selection</Button>}
                                            <p className="text-xs text-muted-foreground">{tempSelectedDateInDialog ? format(tempSelectedDateInDialog, 'PPP') : "No specific date selected"}</p>
                                            </div>
                                        }
                                        classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }}
                                    />
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="pt-6">
                            <Button variant="ghost" onClick={resetDialogFilters} className="mr-auto">
                                <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                            </Button>
                            <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                            <Button onClick={handleApplyDialogFilters}>Apply Filters</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <Button onClick={() => handleOpenForm()}><PlusCircle className="mr-2 h-4 w-4" /> New Booking</Button>
            </div>
        }
      />
      
      <Card className="shadow-lg">
        <CardHeader>
            <CardTitle>
            {activeSelectedDate ? `Your Bookings for ${format(activeSelectedDate, 'PPP')}` : 'All Your Bookings'}
            </CardTitle>
            <CardDescription>
                Displaying {bookingsToDisplay.length} booking(s) based on active filters.
            </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            {bookingsToDisplay.length > 0 ? (
            <div className="overflow-x-auto">
            <Table>
                <TableHeader>
                <TableRow>
                    <TableHead>Resource</TableHead>
                    <TableHead>Date & Time</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                </TableRow>
                </TableHeader>
                <TableBody>
                {bookingsToDisplay.map((booking) => (
                    <TableRow key={booking.id} className={cn(booking.status === 'Cancelled' && 'opacity-60')}>
                    <TableCell
                        className="font-medium cursor-pointer hover:underline hover:text-primary"
                        onClick={() => handleOpenDetailsDialog(booking)}
                    >
                        {booking.resourceName}
                    </TableCell>
                    <TableCell>
                        <div>{isValidDate(new Date(booking.startTime)) ? format(new Date(booking.startTime), 'MMM dd, yyyy') : 'Invalid Date'}</div>
                        <div className="text-xs text-muted-foreground">
                            {isValidDate(new Date(booking.startTime)) ? format(new Date(booking.startTime), 'p') : ''} - 
                            {isValidDate(new Date(booking.endTime)) ? format(new Date(booking.endTime), 'p') : ''}
                        </div>
                    </TableCell>
                    <TableCell>
                       <Badge
                            className={cn(
                                "whitespace-nowrap text-xs px-2 py-0.5 border-transparent",
                                booking.status === 'Confirmed' && 'bg-green-500 text-white hover:bg-green-600',
                                booking.status === 'Pending' && 'bg-yellow-500 text-yellow-950 hover:bg-yellow-600',
                                booking.status === 'Cancelled' && 'bg-gray-400 text-white hover:bg-gray-500'
                            )}
                        >{booking.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                        {booking.status !== 'Cancelled' && (
                        <>
                            <Button variant="outline" size="sm" className="h-7 px-2 py-1 text-xs" onClick={() => handleOpenForm(booking)}>
                            <Edit3 className="mr-1.5 h-3 w-3" /> Edit
                            </Button>
                            <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 py-1 text-xs" onClick={() => handleCancelBookingLocal(booking.id)}>
                            <X className="mr-1.5 h-3 w-3" /> Cancel
                            </Button>
                        </>
                        )}
                         {booking.status === 'Cancelled' && (
                            <span className="text-xs text-muted-foreground italic">Cancelled</span>
                         )}
                    </TableCell>
                    </TableRow>
                ))}
                </TableBody>
            </Table>
            </div>
            ) : (
            <div className="text-center py-10 text-muted-foreground px-6">
                <CalendarDays className="mx-auto h-12 w-12 mb-4 opacity-50" />
                 <p className="text-lg font-medium">
                  {activeFilterCount > 0 ? 'No bookings match your current filters.' :
                   activeSelectedDate ? `No bookings scheduled for ${format(activeSelectedDate, 'PPP')}.` :
                   'You have no bookings.'}
                </p>
                <p className="text-sm">
                  {activeFilterCount > 0 ? 'Try adjusting your filter criteria.' :
                   activeSelectedDate ? 'Feel free to create a new booking for this date.' :
                   'Create a new booking to get started.'}
                </p>
                {activeFilterCount > 0 ? (
                    <Button variant="outline" onClick={resetAllActiveFilters} className="mt-4">
                        <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                    </Button>
                ) : activeSelectedDate ? (
                     <Button onClick={() => handleOpenForm()} className="mt-4">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create New Booking
                    </Button>
                ) : ( allUserBookings.length === 0 &&
                     <Button onClick={() => handleOpenForm()} className="mt-4">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Booking
                    </Button>
                )}
            </div>
            )}
        </CardContent>
         { activeFilterCount > 0 && bookingsToDisplay.length > 0 &&
            <CardFooter className="pt-4 justify-center">
                <Button variant="link" className="p-0 h-auto text-xs" onClick={resetAllActiveFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
            </CardFooter>
         }
        </Card>

      <Dialog
        open={isFormOpen}
        onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) {
                setCurrentBooking(null);
                const currentParams = new URLSearchParams(searchParams.toString());
                let paramsModified = false;
                if (currentParams.has('bookingId')) {
                    currentParams.delete('bookingId');
                    paramsModified = true;
                }
                if (currentParams.has('resourceId')) { 
                    currentParams.delete('resourceId');
                    paramsModified = true;
                }
                if (paramsModified) {
                    router.push(`${pathname}?${currentParams.toString()}`, { scroll: false });
                }
            }
        }}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{currentBooking?.id ? 'Edit Booking' : 'Create New Booking'}</DialogTitle>
            <DialogDescription>
              Fill in the details below to {currentBooking?.id ? 'update your' : 'schedule a new'} booking.
            </DialogDescription>
          </DialogHeader>
          <BookingForm
            key={formKey}
            initialData={currentBooking}
            onSave={handleSaveBooking}
            onCancel={() => setIsFormOpen(false)}
            selectedDateProp={activeSelectedDate} 
            currentUserFullName={mockCurrentUser.name}
          />
        </DialogContent>
      </Dialog>

      <BookingDetailsDialog
        booking={selectedBookingForDetails}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
      />
    </div>
  );
}


export default function BookingsPage() {
  return (
    <Suspense fallback={<BookingsPageLoader />}>
      <BookingsPageContent />
    </Suspense>
  );
}

interface BookingFormProps {
  initialData?: Partial<Booking> & { resourceId?: string } | null;
  onSave: (data: Partial<Booking>) => void;
  onCancel: () => void;
  selectedDateProp?: Date;
  currentUserFullName: string;
}

function BookingForm({ initialData, onSave, onCancel, selectedDateProp, currentUserFullName }: BookingFormProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const [formData, setFormData] = useState<Partial<Booking>>(() => {
    let initialResourceId = initialData?.resourceId || (allAdminMockResources.length > 0 ? allAdminMockResources.find(r => r.status === 'Available')?.id || allAdminMockResources[0].id : '');
    let initialStartTime: Date;
    let initialEndTime: Date;
    let initialNotes = initialData?.notes || '';
    let initialStatus = initialData?.id ? (initialData?.status || 'Pending') : 'Pending'; // New bookings default to Pending

    if (initialData?.startTime && isValidDate(new Date(initialData.startTime))) {
        initialStartTime = new Date(initialData.startTime);
        initialEndTime = initialData.endTime && isValidDate(new Date(initialData.endTime)) ? new Date(initialData.endTime) : new Date(initialStartTime.getTime() + 2 * 60 * 60 * 1000);
    } else {
        const baseDate = selectedDateProp || startOfDay(new Date());
        initialStartTime = set(new Date(baseDate), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });
        initialEndTime = new Date(initialStartTime.getTime() + 2 * 60 * 60 * 1000);
    }

    if (initialEndTime <= initialStartTime) {
        initialEndTime = new Date(initialStartTime.getTime() + 2 * 60 * 60 * 1000);
    }

    return {
        id: initialData?.id,
        resourceId: initialResourceId,
        userName: currentUserFullName,
        userId: initialData?.userId || mockCurrentUser.id,
        startTime: initialStartTime,
        endTime: initialEndTime,
        status: initialStatus,
        notes: initialNotes,
    };
  });

  const handleDateChangeFromPicker = (newDate: Date | undefined) => {
    if (!newDate) return;
    const selectedDay = startOfDay(newDate);
    setFormData(prev => {
      const currentStartTimeHours = prev.startTime ? new Date(prev.startTime).getHours() : 9;
      const currentStartTimeMinutes = prev.startTime ? new Date(prev.startTime).getMinutes() : 0;
      
      const newStartTime = set(selectedDay, {
        hours: currentStartTimeHours,
        minutes: currentStartTimeMinutes,
        seconds: 0,
        milliseconds: 0
      });

      let duration = (prev.endTime && prev.startTime) ? (new Date(prev.endTime).getTime() - new Date(prev.startTime).getTime()) : (2 * 60 * 60 * 1000);
      if (duration <= 0) duration = 2 * 60 * 60 * 1000;

      const currentEndTimeHours = prev.endTime ? new Date(prev.endTime).getHours() : currentStartTimeHours + Math.floor(duration / (60*60*1000));
      const currentEndTimeMinutes = prev.endTime ? new Date(prev.endTime).getMinutes() : currentStartTimeMinutes + Math.floor((duration % (60*60*1000)) / (60*1000));

      const newEndTime = set(selectedDay, {
        hours: currentEndTimeHours,
        minutes: currentEndTimeMinutes,
        seconds: 0,
        milliseconds: 0
      });
      return { ...prev, startTime: newStartTime, endTime: newEndTime };
    });
    setIsCalendarOpen(false);
  };

  const handleChange = (field: keyof Booking | 'resourceId', value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTimeChange = (field: 'startTime' | 'endTime', timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);

    let baseDateForTimeChange: Date;
    if (formData[field] && isValidDate(new Date(formData[field]!))) {
        baseDateForTimeChange = new Date(formData[field]!);
    } else if (formData.startTime && isValidDate(new Date(formData.startTime))) {
        baseDateForTimeChange = new Date(formData.startTime);
    } else {
        baseDateForTimeChange = selectedDateProp || startOfDay(new Date());
    }

    const newDate = set(baseDateForTimeChange, { hours, minutes, seconds: 0, milliseconds: 0 });
    handleChange(field, newDate);

    if (field === 'startTime') {
        const currentStartTime = newDate;
        let duration = 2 * 60 * 60 * 1000; 
        if (formData.startTime && formData.endTime && isValidDate(new Date(formData.startTime)) && isValidDate(new Date(formData.endTime))) {
            const existingDuration = new Date(formData.endTime).getTime() - new Date(formData.startTime).getTime();
             if (existingDuration > 0) duration = existingDuration;
        }
        let newAutoEndTime = new Date(currentStartTime.getTime() + duration);
        newAutoEndTime = set(newAutoEndTime, { 
            year: currentStartTime.getFullYear(), 
            month: currentStartTime.getMonth(), 
            date: currentStartTime.getDate() 
        });
        handleChange('endTime', newAutoEndTime);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div>
        <Label htmlFor="bookingFormDate">Date</Label>
        <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
          <PopoverTrigger asChild>
            <Button
              id="bookingFormDate"
              variant="outline"
              className={cn(
                "w-full justify-start text-left font-normal h-10",
                !formData.startTime && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {formData.startTime && isValidDate(new Date(formData.startTime)) ? format(new Date(formData.startTime), "PPP") : <span>Pick a date</span>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={formData.startTime && isValidDate(new Date(formData.startTime)) ? new Date(formData.startTime) : undefined}
              onSelect={handleDateChangeFromPicker}
              initialFocus
              disabled={(date) => date < startOfDay(addDays(new Date(), -90))}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div>
        <Label htmlFor="bookingFormResourceId">Resource</Label>
        <Select value={formData.resourceId || ''} onValueChange={(value) => handleChange('resourceId', value)} required>
          <SelectTrigger id="bookingFormResourceId"><SelectValue placeholder="Select a resource" /></SelectTrigger>
          <SelectContent>
            {allAdminMockResources.map(resource => (
              <SelectItem key={resource.id} value={resource.id} disabled={resource.status !== 'Available' && resource.id !== initialData?.resourceId}>
                {resource.name} ({resource.status === 'Available' ? 'Available' : resource.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="bookingFormUserName">Booked By</Label>
        <Input id="bookingFormUserName" value={formData.userName || ''} readOnly className="bg-muted/50"/>
         <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Info size={12} /> This is automatically set for the logged-in user.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="bookingFormStartTime">Start Time</Label>
           <Select value={formData.startTime && isValidDate(new Date(formData.startTime)) ? format(new Date(formData.startTime), 'HH:mm') : ''} onValueChange={(value) => handleTimeChange('startTime', value)} required>
            <SelectTrigger id="bookingFormStartTime"><SelectValue placeholder="Select start time" /></SelectTrigger>
            <SelectContent>{timeSlots.map(slot => <SelectItem key={`start-${slot}`} value={slot}>{slot}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="bookingFormEndTime">End Time</Label>
          <Select value={formData.endTime && isValidDate(new Date(formData.endTime)) ? format(new Date(formData.endTime), 'HH:mm') : ''} onValueChange={(value) => handleTimeChange('endTime', value)} required>
            <SelectTrigger id="bookingFormEndTime"><SelectValue placeholder="Select end time" /></SelectTrigger>
            <SelectContent>{timeSlots.map(slot => <SelectItem key={`end-${slot}`} value={slot}>{slot}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      {initialData?.id && ( // Only show status field when editing
        <div>
          <Label htmlFor="bookingFormStatus">Status</Label>
          <Select 
            value={formData.status || 'Pending'} 
            onValueChange={(value) => handleChange('status', value as Booking['status'])}
            // Disable for regular users, enable for admins if we add role checks later
            // disabled={mockCurrentUser.role !== 'Admin' && mockCurrentUser.role !== 'Lab Manager'}
          >
            <SelectTrigger id="bookingFormStatus"><SelectValue placeholder="Select status" /></SelectTrigger>
            <SelectContent>
              {bookingStatuses.map(statusVal => (
                <SelectItem key={statusVal} value={statusVal}>{statusVal}</SelectItem>
              ))}
            </SelectContent>
          </Select>
           <FormDescription className="text-xs mt-1">Status can only be changed by Admins or Lab Managers during editing.</FormDescription>
        </div>
      )}
       <div>
        <Label htmlFor="bookingFormNotes">Notes (Optional)</Label>
        <Textarea id="bookingFormNotes" value={formData.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Any specific requirements or purpose of booking..."/>
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initialData?.id ? "Save Changes" : "Create Booking"}</Button>
      </DialogFooter>
    </form>
  );
}
