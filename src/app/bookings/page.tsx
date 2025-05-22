
'use client';

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarDays, PlusCircle, Edit3, X, Search as SearchIcon, FilterX, Eye, Loader2, Filter as FilterIcon, Calendar as CalendarIcon, Info, Clock } from 'lucide-react';
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
import type { Booking, Resource, DayOfWeek, RoleName } from '@/types';
import { daysOfWeekArray } from '@/types';
import { format, parseISO, isValid as isValidDate, startOfDay, isSameDay, set, addDays, isBefore, getDay } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { allAdminMockResources, initialBookings, addNotification, initialBlackoutDates, initialRecurringBlackoutRules, bookingStatusesForFilter, bookingStatusesForForm, processQueueForResource, addAuditLog, getWaitlistPosition } from '@/lib/mock-data';
import { useForm, FormProvider, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/components/auth-context';


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
  const { currentUser } = useAuth();

  // States for dialogs and forms
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Partial<Booking> & { resourceId?: string } | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  // Active page filters
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<Booking['status'] | 'all'>('all');
  const [activeSelectedDate, setActiveSelectedDate] = useState<Date | undefined>(() => {
     const dateParam = searchParams?.get('date');
      if (dateParam) {
          const parsedDate = parseISO(dateParam);
          if (isValidDate(parsedDate)) return startOfDay(parsedDate);
      }
      return undefined;
  });

  // Filter Dialog State
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState(activeSearchTerm);
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>(activeFilterResourceId);
  const [tempFilterStatus, setTempFilterStatus] = useState<Booking['status'] | 'all'>(activeFilterStatus);
  const [tempSelectedDateInDialog, setTempSelectedDateInDialog] = useState<Date | undefined>(activeSelectedDate);
  const [currentCalendarMonthInDialog, setCurrentCalendarMonthInDialog] = useState<Date>(activeSelectedDate || startOfDay(new Date()));

  const [isClient, setIsClient] = useState(false);
  const [allUserBookings, setAllUserBookings] = useState<Booking[]>([]);

  const handleOpenForm = useCallback((bookingToEdit?: Booking, resourceIdForNew?: string | null, dateForNew?: Date | null) => {
    if (!currentUser) {
        toast({ title: "Login Required", description: "You need to be logged in to create or edit bookings.", variant: "destructive" });
        return;
    }
    let baseDateForNewBooking: Date;
    if (dateForNew && isValidDate(dateForNew)) {
        baseDateForNewBooking = startOfDay(dateForNew);
    } else if (activeSelectedDate && isValidDate(activeSelectedDate) && !bookingToEdit?.id) {
        baseDateForNewBooking = startOfDay(activeSelectedDate);
    } else if (bookingToEdit?.startTime && isValidDate(new Date(bookingToEdit.startTime))) {
        baseDateForNewBooking = startOfDay(new Date(bookingToEdit.startTime));
    }
     else {
        baseDateForNewBooking = startOfDay(new Date());
    }
    
    if (!bookingToEdit?.id && isBefore(baseDateForNewBooking, startOfDay(new Date()))) {
        baseDateForNewBooking = startOfDay(new Date());
    }

    const defaultStartTime = set(new Date(baseDateForNewBooking), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });

    let bookingData: Partial<Booking> & { resourceId?: string };

    if (bookingToEdit) {
        bookingData = {
          ...bookingToEdit,
          startTime: new Date(bookingToEdit.startTime),
          endTime: new Date(bookingToEdit.endTime),
          userName: bookingToEdit.userName || currentUser.name,
          createdAt: bookingToEdit.createdAt ? new Date(bookingToEdit.createdAt) : new Date(),
        };
    } else {
        const initialResourceId = resourceIdForNew || (allAdminMockResources.length > 0 ? allAdminMockResources.find(r => r.status === 'Available')?.id || allAdminMockResources[0].id : '');
        bookingData = {
            startTime: defaultStartTime,
            endTime: new Date(defaultStartTime.getTime() + 2 * 60 * 60 * 1000),
            createdAt: new Date(),
            userName: currentUser.name,
            userId: currentUser.id,
            resourceId: initialResourceId,
            status: 'Pending', notes: '',
        };
    }
    setCurrentBooking(bookingData);
    setIsFormOpen(true);
  }, [activeSelectedDate, currentUser, toast, setIsFormOpen, setCurrentBooking]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (currentUser) {
      setAllUserBookings(JSON.parse(JSON.stringify(initialBookings
        .filter(b => b.userId === currentUser.id)
        .map(b => ({...b, createdAt: b.createdAt ? new Date(b.createdAt) : new Date(b.startTime) }))
      )));
    } else {
      setAllUserBookings([]);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!isClient || !currentUser || !searchParams) return;

    const resourceIdParam = searchParams.get('resourceId');
    const dateParam = searchParams.get('date');
    const bookingIdParam = searchParams.get('bookingId');

    let dateToSetFromUrl: Date | undefined = undefined;
    if (dateParam) {
      const parsedQueryDate = parseISO(dateParam);
      if (isValidDate(parsedQueryDate)) {
        dateToSetFromUrl = startOfDay(parsedQueryDate);
      }
    }
    
    if (dateToSetFromUrl && (!activeSelectedDate || !isSameDay(activeSelectedDate, dateToSetFromUrl))) {
      setActiveSelectedDate(dateToSetFromUrl);
    }

    const shouldOpenFormForEdit = bookingIdParam && (!isFormOpen || (currentBooking?.id !== bookingIdParam));
    
    const shouldOpenFormForNewWithResourceAndDate = resourceIdParam && dateToSetFromUrl && !bookingIdParam &&
        (!isFormOpen || currentBooking?.id || currentBooking?.resourceId !== resourceIdParam ||
        (currentBooking?.startTime && !isSameDay(new Date(currentBooking.startTime), dateToSetFromUrl)));
    
    const shouldOpenFormForNewWithResourceOnly = resourceIdParam && !dateToSetFromUrl && !bookingIdParam &&
        (!isFormOpen || currentBooking?.id || currentBooking?.resourceId !== resourceIdParam);


    if (shouldOpenFormForEdit) {
      const bookingToEdit = initialBookings.find(b => b.id === bookingIdParam && b.userId === currentUser.id);
      if (bookingToEdit) {
        handleOpenForm(bookingToEdit, undefined, new Date(bookingToEdit.startTime));
      }
    } else if (shouldOpenFormForNewWithResourceAndDate) {
      handleOpenForm(undefined, resourceIdParam, dateToSetFromUrl);
    } else if (shouldOpenFormForNewWithResourceOnly) {
      handleOpenForm(undefined, resourceIdParam, activeSelectedDate || new Date());
    }

  }, [searchParams, isClient, currentUser, activeSelectedDate, handleOpenForm, isFormOpen, currentBooking]);


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
    if (!currentUser) return [];
    let filtered = allUserBookings.filter(b => b.userId === currentUser.id);

    if (activeSearchTerm) {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      filtered = filtered.filter(b =>
        b.resourceName.toLowerCase().includes(lowerSearchTerm) ||
        (b.notes && b.notes.toLowerCase().includes(lowerSearchTerm))
      );
    }

    if (activeFilterResourceId !== 'all') {
      filtered = filtered.filter(b => b.resourceId === activeFilterResourceId);
    }

    if (activeFilterStatus !== 'all') {
      filtered = filtered.filter(b => b.status === activeFilterStatus);
    }
    
    if (activeSelectedDate) {
      filtered = filtered.filter(b => isValidDate(new Date(b.startTime)) && isSameDay(new Date(b.startTime), activeSelectedDate));
    }

    return filtered.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [allUserBookings, activeSelectedDate, activeSearchTerm, activeFilterResourceId, activeFilterStatus, currentUser]);


  const handleApplyDialogFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterStatus(tempFilterStatus);
    setActiveSelectedDate(tempSelectedDateInDialog);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFilters = () => {
    setTempSearchTerm('');
    setTempFilterResourceId('all');
    setTempFilterStatus('all');
    setTempSelectedDateInDialog(undefined);
    setCurrentCalendarMonthInDialog(startOfDay(new Date()));
  };

  const resetAllActivePageFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterResourceId('all');
    setActiveFilterStatus('all');
    setActiveSelectedDate(undefined);
    resetDialogFilters();

    const newSearchParams = new URLSearchParams(searchParams?.toString() || '');
    newSearchParams.delete('date');
    newSearchParams.delete('bookingId');
    newSearchParams.delete('resourceId');
    router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    setIsFilterDialogOpen(false);
  };

  const bookedDatesForCalendar = useMemo(() => {
    if(!currentUser) return [];
    const dates = new Set<string>();
    allUserBookings.forEach(booking => {
      if (booking.status !== 'Cancelled' && isValidDate(new Date(booking.startTime))) {
        dates.add(format(new Date(booking.startTime), 'yyyy-MM-dd'));
      }
    });
    return Array.from(dates).map(dateStr => parseISO(dateStr));
  }, [currentUser, allUserBookings]);


  const activeFilterCount = useMemo(() => [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
    activeFilterStatus !== 'all',
    activeSelectedDate !== undefined,
  ].filter(Boolean).length, [activeSearchTerm, activeFilterResourceId, activeFilterStatus, activeSelectedDate]);


  const formKey = useMemo(() => {
    if (!isFormOpen) return 'closed';
    let keyParts = ['booking-form'];
    if (currentBooking?.id) {
      keyParts.push(`edit-${currentBooking.id}`);
      if (currentBooking.startTime && isValidDate(new Date(currentBooking.startTime))) {
         keyParts.push(new Date(currentBooking.startTime).toISOString().substring(0,10));
      }
    } else {
      keyParts.push('new');
      if (currentBooking?.resourceId) keyParts.push(currentBooking.resourceId);
      
      let formDateForNewKey: Date;
      if(currentBooking?.startTime && isValidDate(new Date(currentBooking.startTime))) {
          formDateForNewKey = startOfDay(new Date(currentBooking.startTime));
      } else if (activeSelectedDate && isValidDate(activeSelectedDate) ){
          formDateForNewKey = startOfDay(activeSelectedDate);
      } else {
          formDateForNewKey = startOfDay(new Date());
      }
      keyParts.push(format(formDateForNewKey, 'yyyy-MM-dd'));
    }
    return keyParts.join(':');
  }, [isFormOpen, currentBooking, activeSelectedDate]);


  const dialogHeaderDateString = useMemo(() => {
    if (isFormOpen && currentBooking?.startTime && isValidDate(new Date(currentBooking.startTime))) {
      return format(new Date(currentBooking.startTime), "PPP");
    }
    else if (isFormOpen && !currentBooking?.id && activeSelectedDate && isValidDate(activeSelectedDate) ){
       return format(activeSelectedDate, "PPP");
    }
    return null;
  }, [isFormOpen, currentBooking?.startTime, activeSelectedDate, currentBooking?.id]);


  if (!isClient) {
    return <BookingsPageLoader />;
  }
  
  if (!currentUser && isClient) {
    return (
        <div className="space-y-8">
            <PageHeader title="Bookings" description="Please log in to manage your bookings." icon={CalendarDays} />
            <Card className="text-center py-10 text-muted-foreground">
                <CardContent>
                    <Info className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">Login Required</p>
                    <p className="text-sm mb-4">You need to be logged in to view and manage your bookings.</p>
                    <Button onClick={() => router.push('/login')}>Go to Login</Button>
                </CardContent>
            </Card>
        </div>
    );
  }

  function handleSaveBooking(formData: Partial<Booking>) {
    if (!currentUser) {
        toast({ title: "Error", description: "You must be logged in to save a booking.", variant: "destructive" });
        return;
    }
    if (!formData.resourceId || !formData.startTime || !formData.endTime || !formData.userName) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    const resource = allAdminMockResources.find(r => r.id === formData.resourceId);
    if (!resource) { toast({ title: "Error", description: "Selected resource not found.", variant: "destructive" }); return; }

    const proposedStartTime = new Date(formData.startTime);
    const proposedEndTime = new Date(formData.endTime);

    if (isBefore(startOfDay(proposedStartTime), startOfDay(new Date())) && !currentBooking?.id) {
       toast({ title: "Invalid Date", description: "Cannot create new bookings for past dates.", variant: "destructive" }); return;
    }

    if (proposedEndTime <= proposedStartTime) { toast({ title: "Invalid Time", description: "End time must be after start time.", variant: "destructive" }); return; }
    
    const bookingDayIndex = getDay(proposedStartTime);
    const bookingDayName = daysOfWeekArray[bookingDayIndex];
    const recurringBlackout = initialRecurringBlackoutRules.find(rule => rule.daysOfWeek.includes(bookingDayName));
    if (recurringBlackout) {
      toast({
        title: "Lab Closed",
        description: `The lab is regularly closed on ${bookingDayName}s for: ${recurringBlackout.name}${recurringBlackout.reason ? ` (${recurringBlackout.reason})` : ''}. Please select a different date.`,
        variant: "destructive",
        duration: 10000
      });
      return;
    }

    const proposedDateOnlyStr = format(proposedStartTime, 'yyyy-MM-dd');
    const isBlackout = initialBlackoutDates.find(bd => bd.date === proposedDateOnlyStr);
    if (isBlackout) {
      toast({
        title: "Lab Closed",
        description: `The lab is closed on ${format(proposedStartTime, 'PPP')}${isBlackout.reason ? ` due to: ${isBlackout.reason}` : '.'}. Please select a different date.`,
        variant: "destructive",
        duration: 7000
      });
      return;
    }

    if (resource.unavailabilityPeriods && resource.unavailabilityPeriods.length > 0) {
      for (const period of resource.unavailabilityPeriods) {
        const unavailabilityStart = startOfDay(parseISO(period.startDate));
        const unavailabilityEnd = addDays(startOfDay(parseISO(period.endDate)),1); 

        if (
          (proposedStartTime >= unavailabilityStart && proposedStartTime < unavailabilityEnd) ||
          (proposedEndTime > unavailabilityStart && proposedEndTime <= unavailabilityEnd) ||
          (proposedStartTime <= unavailabilityStart && proposedEndTime >= unavailabilityEnd)
        ) {
          toast({
            title: "Resource Unavailable",
            description: `${resource.name} is scheduled to be unavailable from ${format(unavailabilityStart, 'PPP')} to ${format(parseISO(period.endDate), 'PPP')}${period.reason ? ` due to: ${period.reason}` : '.'}. Please select a different date or time.`,
            variant: "destructive",
            duration: 10000
          });
          return;
        }
      }
    }

    const proposedDateStr = format(proposedStartTime, 'yyyy-MM-dd');
    const resourceDayAvailability = resource.availability?.find(avail => avail.date === proposedDateStr);

    if (resource.status !== 'Available') {
        toast({ title: "Resource Not Available", description: `${resource.name} is currently ${resource.status.toLowerCase()} and cannot be booked.`, variant: "destructive", duration: 7000 });
        return;
    }

    if (!resourceDayAvailability || resourceDayAvailability.slots.length === 0) {
        toast({ title: "Resource Unavailable", description: `${resource.name} is not scheduled to be available on ${format(proposedStartTime, 'PPP')}. Please check resource availability settings.`, variant: "destructive", duration: 7000 });
        return;
    }

    let isWithinAvailableSlot = false;
    for (const slot of resourceDayAvailability.slots) {
        const [slotStartStr, slotEndStr] = slot.split('-');
        if (!slotStartStr || !slotEndStr) continue;

        const slotStartHours = parseInt(slotStartStr.split(':')[0]);
        const slotStartMinutes = parseInt(slotStartStr.split(':')[1]);
        const slotEndHours = parseInt(slotEndStr.split(':')[0]);
        const slotEndMinutes = parseInt(slotEndStr.split(':')[1]);

        if (isNaN(slotStartHours) || isNaN(slotStartMinutes) || isNaN(slotEndHours) || isNaN(slotEndMinutes)) continue;

        const slotStartTime = set(new Date(proposedStartTime), { hours: slotStartHours, minutes: slotStartMinutes, seconds: 0, milliseconds: 0 });
        const slotEndTime = set(new Date(proposedStartTime), { hours: slotEndHours, minutes: slotEndMinutes, seconds: 0, milliseconds: 0 });

        if (proposedStartTime >= slotStartTime && proposedEndTime <= slotEndTime) {
            isWithinAvailableSlot = true;
            break;
        }
    }

    if (!isWithinAvailableSlot) {
        toast({ title: "Time Slot Unavailable", description: `The selected time for ${resource.name} is outside of its defined available slots on ${format(proposedStartTime, 'PPP')}. Available slots: ${resourceDayAvailability.slots.join(', ')}.`, variant: "destructive", duration: 10000 });
        return;
    }

    const conflictingBooking = initialBookings.find(existingBooking => {
        if (existingBooking.resourceId !== formData.resourceId) return false;
        if (existingBooking.status === 'Cancelled') return false;
        if (currentBooking && currentBooking.id && existingBooking.id === currentBooking.id) return false;

        const existingStartTime = new Date(existingBooking.startTime);
        const existingEndTime = new Date(existingBooking.endTime);
        return (proposedStartTime < existingEndTime && proposedEndTime > existingStartTime);
    });

    const isNewBooking = !currentBooking?.id;
    let finalStatus: Booking['status'] = isNewBooking ? 'Pending' : (formData.status || currentBooking?.status || 'Pending');

    if (conflictingBooking && finalStatus !== 'Waitlisted') {
        if (resource.allowQueueing) {
            finalStatus = 'Waitlisted';
            toast({ title: "Added to Waitlist", description: `This time slot is currently booked. Your request for ${resource.name} has been added to the waitlist.` });
            addNotification(
                currentUser.id,
                'Added to Waitlist',
                `Your booking request for ${resource.name} on ${format(proposedStartTime, 'MMM dd, HH:mm')} has been added to the waitlist.`,
                'booking_waitlisted',
                `/bookings?bookingId=${currentBooking?.id || `b${initialBookings.length + 1 + Date.now()}`}`
            );
        } else {
            toast({ title: "Booking Conflict", description: `${resource.name} is already booked by ${conflictingBooking.userName} from ${format(new Date(conflictingBooking.startTime), 'p')} to ${format(new Date(conflictingBooking.endTime), 'p')} on ${format(new Date(conflictingBooking.startTime), 'PPP')}. This resource does not allow queueing.`, variant: "destructive", duration: 10000 });
            return;
        }
    }
    
    const newBookingData: Booking = {
        ...(currentBooking || {}),
        ...formData,
        id: currentBooking?.id || `b${initialBookings.length + 1 + Date.now()}`,
        userId: currentUser.id,
        userName: currentUser.name,
        startTime: proposedStartTime,
        endTime: proposedEndTime,
        createdAt: formData.createdAt ? new Date(formData.createdAt) : new Date(),
        resourceName: resource.name,
        status: finalStatus,
    } as Booking;

    if (!isNewBooking && currentBooking?.id) {
      const updatedAllUserBookings = allUserBookings.map(b => b.id === currentBooking.id ? { ...b, ...newBookingData } : b).sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      setAllUserBookings(updatedAllUserBookings);
      const globalIndex = initialBookings.findIndex(b => b.id === currentBooking.id);
      if (globalIndex !== -1) initialBookings[globalIndex] = { ...initialBookings[globalIndex], ...newBookingData };
      toast({ title: "Success", description: "Booking updated successfully."});
      addAuditLog(currentUser.id, currentUser.name, 'BOOKING_UPDATED', { entityType: 'Booking', entityId: newBookingData.id, details: `Booking for '${resource.name}' updated.`});

    } else {
      const updatedAllUserBookings = [...allUserBookings, newBookingData].sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
      setAllUserBookings(updatedAllUserBookings);
      initialBookings.push(newBookingData);
      
      if (finalStatus === 'Pending') {
        toast({ title: "Success", description: "Booking created and submitted for approval."});
         addAuditLog(currentUser.id, currentUser.name, 'BOOKING_CREATED', { entityType: 'Booking', entityId: newBookingData.id, details: `Booking for '${resource.name}' created with status Pending.`});
        const adminUser = initialMockUsers.find(u => u.role === 'Admin' || u.role === 'Lab Manager');
        if(adminUser){
            addNotification(
                adminUser.id,
                'New Booking Request',
                `Booking for ${resource.name} by ${currentUser.name} on ${format(proposedStartTime, 'MMM dd, HH:mm')} needs approval.`,
                'booking_pending_approval',
                `/admin/booking-requests`
            );
        }
      } else if (finalStatus === 'Waitlisted') {
         addAuditLog(currentUser.id, currentUser.name, 'BOOKING_CREATED', { entityType: 'Booking', entityId: newBookingData.id, details: `Booking for '${resource.name}' created with status Waitlisted.`});
      }
    }
    setIsFormOpen(false);
  }

  const handleCancelBookingLocal = (bookingId: string) => {
    const bookingToCancelIndex = allUserBookings.findIndex(b => b.id === bookingId);
    if (bookingToCancelIndex === -1 || !currentUser) return;

    const bookingToCancel = allUserBookings[bookingToCancelIndex];
    const resource = allAdminMockResources.find(r => r.id === bookingToCancel.resourceId);

    setAllUserBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'Cancelled' } : b));
    const globalIndex = initialBookings.findIndex(b => b.id === bookingId);
    if (globalIndex !== -1) initialBookings[globalIndex].status = 'Cancelled';
    toast({ title: "Info", description: "Booking cancelled."});
    addAuditLog(currentUser.id, currentUser.name, 'BOOKING_CANCELLED', { entityType: 'Booking', entityId: bookingId, details: `Booking for '${bookingToCancel.resourceName}' cancelled by user.`});


    if (bookingToCancel.status === 'Confirmed' && resource && resource.allowQueueing) {
      processQueueForResource(bookingToCancel.resourceId); // Process queue
      // Re-fetch/re-filter bookings on this page after queue processing
      setTimeout(() => {
          if (currentUser) {
            setAllUserBookings(JSON.parse(JSON.stringify(initialBookings
                .filter(b => b.userId === currentUser.id)
                .map(b => ({...b, createdAt: b.createdAt ? new Date(b.createdAt) : new Date(b.startTime) }))
            )));
          }
      }, 100); // Small delay to allow mock data to "update"
    }
  };

  const handleOpenDetailsDialog = (booking: Booking) => {
    setSelectedBookingForDetails(booking);
    setIsDetailsDialogOpen(true);
  };
  
  const handleBookingUpdateInDetails = (updatedBooking: Booking) => {
    if(!currentUser) return;
    setAllUserBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
    const globalIndex = initialBookings.findIndex(b => b.id === updatedBooking.id);
    if (globalIndex !== -1) {
        initialBookings[globalIndex] = updatedBooking;
    }
    if (selectedBookingForDetails && selectedBookingForDetails.id === updatedBooking.id) {
      setSelectedBookingForDetails(updatedBooking);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manage Bookings"
        description="View, search, filter, and manage your lab resource bookings."
        icon={CalendarDays}
        actions={
            currentUser && (
            <div className="flex items-center gap-2 flex-wrap">
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
                            Refine your list of bookings by keyword, resource, status, or date.
                        </DialogDescription>
                      </DialogHeader>
                      <Separator className="my-4" />
                      <ScrollArea className="max-h-[65vh] overflow-y-auto pr-2">
                        <div className="space-y-6 py-1">
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
                                    {Array.from(new Set(allUserBookings.map(b => b.resourceId)))
                                        .map(resourceId => {
                                            const resource = allAdminMockResources.find(r => r.id === resourceId);
                                            return resource ? <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem> : null;
                                        })
                                    }
                                </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label htmlFor="bookingStatusDialog" className="text-sm font-medium mb-1 block">Status</Label>
                                <Select value={tempFilterStatus} onValueChange={(v) => setTempFilterStatus(v as Booking['status'] | 'all')}>
                                <SelectTrigger id="bookingStatusDialog" className="h-9"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                                <SelectContent>
                                    {bookingStatusesForFilter.map(s => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
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
                                modifiers={{ booked: bookedDatesForCalendar }}
                                modifiersClassNames={{ booked: 'day-booked-dot' }}
                                footer={
                                    <div className="flex flex-col gap-2 items-center pt-2">
                                    {tempSelectedDateInDialog && <Button variant="ghost" size="sm" onClick={() => setTempSelectedDateInDialog(undefined)} className="w-full text-xs"><FilterX className="mr-2 h-4 w-4" />Clear Date Selection</Button>}
                                    <p className="text-xs text-muted-foreground">{tempSelectedDateInDialog ? format(tempSelectedDateInDialog, 'PPP') : "No specific date selected"}</p>
                                    </div>
                                }
                                classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }}
                                />
                            </div>
                            </div>
                        </div>
                      </ScrollArea>
                      <DialogFooter className="pt-6 border-t">
                        <Button variant="ghost" onClick={resetDialogFilters} className="mr-auto">
                            <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                        </Button>
                        <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                        <Button onClick={handleApplyDialogFilters}>Apply Filters</Button>
                      </DialogFooter>
                  </DialogContent>
                </Dialog>
                <Button onClick={() => handleOpenForm(undefined, null, activeSelectedDate || new Date())}><PlusCircle className="mr-2 h-4 w-4" /> New Booking</Button>
            </div>
            )
        }
      />
     <div className="grid grid-cols-1">
        <Card className="shadow-lg">
            <CardHeader className="border-b">
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
                    {bookingsToDisplay.map((booking) => {
                        const waitlistPosition = getWaitlistPosition(booking, allUserBookings);
                        return (
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
                                    booking.status === 'Cancelled' && 'bg-gray-400 text-white hover:bg-gray-500',
                                    booking.status === 'Waitlisted' && 'bg-purple-500 text-white hover:bg-purple-600'
                                )}
                            >{booking.status} {booking.status === 'Waitlisted' && waitlistPosition != null && `(#${waitlistPosition})`}</Badge>
                        </TableCell>
                        <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDetailsDialog(booking)}>
                              <Eye className="h-4 w-4" /> <span className="sr-only">View Details</span>
                            </Button>
                            {booking.status !== 'Cancelled' && booking.status !== 'Waitlisted' && (
                            <>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenForm(booking, undefined, new Date(booking.startTime))}>
                                <Edit3 className="h-4 w-4" /> <span className="sr-only">Edit Booking</span>
                                </Button>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => handleCancelBookingLocal(booking.id)}>
                                <X className="h-4 w-4" /> <span className="sr-only">Cancel Booking</span>
                                </Button>
                            </>
                            )}
                            {(booking.status === 'Cancelled' || booking.status === 'Waitlisted') && (
                                <span className="text-xs text-muted-foreground italic">{booking.status}</span>
                            )}
                        </TableCell>
                        </TableRow>
                    )})}
                    </TableBody>
                </Table>
                </div>
                ) : (
                <CardContent className="text-center py-10 text-muted-foreground px-6">
                    <CalendarDays className="mx-auto h-12 w-12 mb-4 opacity-50" />
                    <p className="text-lg font-medium">
                      {activeFilterCount > 0 ? 'No bookings match your current filters.' :
                      activeSelectedDate ? `No bookings scheduled for ${format(activeSelectedDate, 'PPP')}.` :
                      'You have no bookings.'}
                    </p>
                    <p className="text-sm mb-4">
                      {activeFilterCount > 0 ? 'Try adjusting your filter criteria.' :
                      activeSelectedDate ? 'Feel free to create a new booking for this date.' :
                      'Create a new booking to get started.'}
                    </p>
                    {activeFilterCount > 0 ? (
                        <Button variant="outline" onClick={resetAllActivePageFilters}>
                            <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                        </Button>
                    ): (
                      activeSelectedDate ? (
                        <Button onClick={() => handleOpenForm(undefined, null, activeSelectedDate)} className="mt-4">
                            <PlusCircle className="mr-2 h-4 w-4" /> Create New Booking
                        </Button>
                      ) : (
                        <Button onClick={() => handleOpenForm(undefined, null, new Date())} className="mt-4">
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Booking
                        </Button>
                      )
                    )}
                </CardContent>
                )}
            </CardContent>
            { activeFilterCount > 0 && bookingsToDisplay.length > 0 &&
                <CardFooter className="pt-4 justify-center border-t">
                    <Button variant="link" className="p-0 h-auto text-xs" onClick={resetAllActivePageFilters}>
                        <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                    </Button>
                </CardFooter>
            }
            </Card>
      </div>

      <Dialog
        open={isFormOpen}
        onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) {
                setCurrentBooking(null);
                const currentParams = new URLSearchParams(searchParams?.toString() || '');
                let paramsModified = false;
                if (currentParams.has('bookingId')) {
                    currentParams.delete('bookingId');
                    paramsModified = true;
                }
                if (currentParams.has('resourceId')) {
                    currentParams.delete('resourceId');
                     paramsModified = true;
                }
                 if (currentParams.has('date') && !activeSelectedDate) {
                    currentParams.delete('date');
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
              {dialogHeaderDateString && ` For date: ${dialogHeaderDateString}`}
            </DialogDescription>
          </DialogHeader>
          {isFormOpen && currentUser &&
            <BookingForm
                key={formKey}
                initialData={currentBooking}
                onSave={handleSaveBooking}
                onCancel={() => setIsFormOpen(false)}
                currentUserFullName={currentUser.name}
                currentUserRole={currentUser.role}
            />
          }
        </DialogContent>
      </Dialog>

      {selectedBookingForDetails && (
        <BookingDetailsDialog
            booking={selectedBookingForDetails}
            isOpen={isDetailsDialogOpen}
            onOpenChange={setIsDetailsDialogOpen}
            onBookingUpdate={handleBookingUpdateInDetails}
        />
      )}
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

const bookingFormSchema = z.object({
  resourceId: z.string().min(1, "Please select a resource."),
  bookingDate: z.date({ required_error: "Please select a date." }),
  startTime: z.string().min(1, "Please select a start time."),
  endTime: z.string().min(1, "Please select an end time."),
  status: z.enum(bookingStatusesForForm).optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters.").optional().or(z.literal('')),
  createdAt: z.date().optional(),
}).refine(data => {
  if (!data.bookingDate || !data.startTime || !data.endTime) return true;
  const startDateTime = set(data.bookingDate, {
    hours: parseInt(data.startTime.split(':')[0]),
    minutes: parseInt(data.startTime.split(':')[1])
  });
  const endDateTime = set(data.bookingDate, {
    hours: parseInt(data.endTime.split(':')[0]),
    minutes: parseInt(data.endTime.split(':')[1])
  });
  return endDateTime > startDateTime;
}, {
  message: "End time must be after start time.",
  path: ["endTime"],
});

type BookingFormValues = z.infer<typeof bookingFormSchema>;


interface BookingFormProps {
  initialData?: Partial<Booking> & { resourceId?: string } | null;
  onSave: (data: Partial<Booking>) => void;
  onCancel: () => void;
  currentUserFullName: string;
  currentUserRole: RoleName;
}

const timeSlots = Array.from({ length: (17 - 9) * 2 + 1 }, (_, i) => {
    const hour = 9 + Math.floor(i / 2);
    const minute = i % 2 === 0 ? '00' : '30';
    return `${String(hour).padStart(2, '0')}:${minute}`;
});
  

function BookingForm({ initialData, onSave, onCancel, currentUserFullName, currentUserRole }: BookingFormProps) {
  
  const getInitialBookingDate = useCallback(() => {
    if (initialData?.startTime && isValidDate(new Date(initialData.startTime))) {
      return startOfDay(new Date(initialData.startTime));
    }
    let defaultDate = startOfDay(new Date());
    if (isBefore(defaultDate, startOfDay(new Date())) && !initialData?.id) {
      defaultDate = startOfDay(new Date());
    }
    return defaultDate;
  }, [initialData?.startTime, initialData?.id]);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      resourceId: initialData?.resourceId || (allAdminMockResources.length > 0 ? allAdminMockResources.find(r => r.status === 'Available')?.id || allAdminMockResources[0].id : ''),
      bookingDate: getInitialBookingDate(),
      startTime: initialData?.startTime ? format(new Date(initialData.startTime), 'HH:mm') : '09:00',
      endTime: initialData?.endTime ? format(new Date(initialData.endTime), 'HH:mm') : '11:00',
      status: initialData?.id ? (initialData.status || 'Pending') : 'Pending',
      notes: initialData?.notes || '',
      createdAt: initialData?.createdAt ? new Date(initialData.createdAt) : new Date(),
    },
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const watchBookingDate = form.watch('bookingDate');
  const watchStartTime = form.watch('startTime');

   useEffect(() => {
    const currentStartTimeStr = form.getValues('startTime');
    const currentBookingDate = form.getValues('bookingDate');

    if (currentBookingDate && isValidDate(currentBookingDate) && currentStartTimeStr) {
        const currentStartTimeHours = parseInt(currentStartTimeStr.split(':')[0]);
        const currentStartTimeMinutes = parseInt(currentStartTimeStr.split(':')[1]);

        if (!isNaN(currentStartTimeHours) && !isNaN(currentStartTimeMinutes)) {
            const newStartTime = set(new Date(currentBookingDate), { hours: currentStartTimeHours, minutes: currentStartTimeMinutes });
            let newEndTime = new Date(newStartTime.getTime() + 2 * 60 * 60 * 1000); 
            
            const maxEndTimeForDay = set(new Date(currentBookingDate), { hours: 17, minutes: 30 }); 
            if (newEndTime > maxEndTimeForDay) {
                newEndTime = maxEndTimeForDay;
            }
            
            if (newEndTime <= newStartTime && currentStartTimeStr !== timeSlots[timeSlots.length -1]) {
                 const newStartTimePlus30Min = new Date(newStartTime.getTime() + 30 * 60 * 1000);
                 if(newStartTimePlus30Min <= maxEndTimeForDay) newEndTime = newStartTimePlus30Min;
                 else newEndTime = newStartTime; 
            }
            
            const formattedNewEndTime = format(newEndTime, 'HH:mm');
            if(form.getValues('endTime') !== formattedNewEndTime){
                form.setValue('endTime', formattedNewEndTime, { shouldValidate: true });
            }
        }
    }
  }, [watchStartTime, watchBookingDate, form]); 


  function handleRHFSubmit(data: BookingFormValues) {
    if (!currentUserFullName) {
      toast({ title: "Error", description: "User information not available. Please log in again.", variant: "destructive" });
      return;
    }
    const finalStartTime = set(data.bookingDate, {
      hours: parseInt(data.startTime.split(':')[0]),
      minutes: parseInt(data.startTime.split(':')[1]),
      seconds: 0, milliseconds: 0
    });
    const finalEndTime = set(data.bookingDate, {
      hours: parseInt(data.endTime.split(':')[0]),
      minutes: parseInt(data.endTime.split(':')[1]),
      seconds: 0, milliseconds: 0
    });

    onSave({
      id: initialData?.id,
      resourceId: data.resourceId,
      userId: initialData?.userId,
      userName: currentUserFullName,
      startTime: finalStartTime,
      endTime: finalEndTime,
      createdAt: data.createdAt || new Date(),
      status: initialData?.id ? (data.status || 'Pending') : 'Pending',
      notes: data.notes,
    });
  }

  const canEditStatus = (currentUserRole === 'Admin' || currentUserRole === 'Lab Manager') && !!initialData?.id;

  return (
    <Form {...form}>
    <form onSubmit={form.handleSubmit(handleRHFSubmit)} className="space-y-4 py-4">
      <ScrollArea className="max-h-[65vh] overflow-y-auto pr-2">
        <div className="space-y-4 py-1">
          <FormField
            control={form.control}
            name="bookingDate"
            render={({ field }) => (
              <FormItem className="flex flex-col">
                <FormLabel>Date</FormLabel>
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                  <PopoverTrigger asChild>
                    <FormControl>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal h-10",
                          !field.value && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </FormControl>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={field.value}
                      onSelect={(date) => {
                        if (date) field.onChange(startOfDay(date));
                        setIsCalendarOpen(false);
                      }}
                      disabled={(date) => isBefore(date, startOfDay(new Date())) && !initialData?.id }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="resourceId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Resource</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || ''}>
                  <FormControl>
                    <SelectTrigger><SelectValue placeholder="Select a resource" /></SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {allAdminMockResources.filter(r => r.status === 'Available' || r.id === initialData?.resourceId).map(resource => (
                      <SelectItem key={resource.id} value={resource.id} disabled={resource.status !== 'Available' && resource.id !== initialData?.resourceId}>
                        {resource.name} ({resource.status === 'Available' ? 'Available' : resource.status})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormItem>
            <FormLabel htmlFor="bookingFormUserNameRHF">Booked By</FormLabel>
            <Input id="bookingFormUserNameRHF" value={currentUserFullName} readOnly className="bg-muted/50"/>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Info size={12} /> This is automatically set.</p>
          </FormItem>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField
                control={form.control}
                name="startTime"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>Start Time</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select start time" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>{timeSlots.map(slot => <SelectItem key={`start-${slot}`} value={slot}>{slot}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
            <FormField
                control={form.control}
                name="endTime"
                render={({ field }) => (
                <FormItem>
                    <FormLabel>End Time</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select end time" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>{timeSlots.map(slot => <SelectItem key={`end-${slot}`} value={slot}>{slot}</SelectItem>)}</SelectContent>
                    </Select>
                    <FormMessage />
                </FormItem>
                )}
            />
          </div>
          {initialData?.id && (
            <FormField
                control={form.control}
                name="status"
                render={({ field }) => (
                <FormItem>
                <FormLabel>Status</FormLabel>
                <Select onValueChange={field.onChange} value={field.value || 'Pending'} disabled={!canEditStatus}>
                    <FormControl>
                        <SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                    {bookingStatusesForForm.map(statusVal => (
                        <SelectItem key={statusVal} value={statusVal}>{statusVal}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
                {!canEditStatus && <p className="text-xs text-muted-foreground mt-1">Status can only be changed by Admins or Lab Managers.</p>}
                <FormMessage />
                </FormItem>
                )}
            />
          )}
          <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                <FormItem>
                <FormLabel>Notes (Optional)</FormLabel>
                <FormControl>
                    <Textarea placeholder="Any specific requirements or purpose of booking..." {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
                </FormItem>
                )}
            />
        </div>
      </ScrollArea>
      <DialogFooter className="pt-6 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={form.formState.isSubmitting}>{initialData?.id ? "Save Changes" : "Create Booking"}</Button>
      </DialogFooter>
    </form>
    </Form>
  );
}

    
