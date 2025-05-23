
'use client';

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarDays, PlusCircle, Edit3, X, Search as SearchIcon, FilterX, Eye, Loader2, Filter as FilterIcon, Info, Clock, ListFilter } from 'lucide-react';
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
import type { Booking, Resource, DayOfWeek, RoleName, BlackoutDate, RecurringBlackoutRule } from '@/types';
import { daysOfWeekArray } from '@/types';
import { format, parseISO, isValid as isValidDate, startOfDay, isSameDay, set, addDays, isBefore, getDay, startOfToday, compareAsc } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { bookingStatusesForFilter, bookingStatusesForForm, addNotification, addAuditLog } from '@/lib/mock-data';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp, getDoc, orderBy } from 'firebase/firestore';


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

  const [isClient, setIsClient] = useState(false);
  const [allUserBookings, setAllUserBookings] = useState<Booking[]>([]);
  const [allAvailableResources, setAllAvailableResources] = useState<Resource[]>([]);
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringBlackoutRule[]>([]);

  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [isLoadingAvailabilityRules, setIsLoadingAvailabilityRules] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Partial<Booking> & { resourceId?: string } | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

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

  const [tempSearchTerm, setTempSearchTerm] = useState(activeSearchTerm);
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>(activeFilterResourceId);
  const [tempFilterStatus, setTempFilterStatus] = useState<Booking['status'] | 'all'>(activeFilterStatus);
  const [tempSelectedDateInDialog, setTempSelectedDateInDialog] = useState<Date | undefined>(activeSelectedDate);
  const [currentCalendarMonthInDialog, setCurrentCalendarMonthInDialog] = useState<Date>(activeSelectedDate || startOfDay(new Date()));

  const fetchAllBookingsForUser = useCallback(async () => {
    if (!currentUser) {
      setAllUserBookings([]);
      setIsLoadingBookings(false);
      return;
    }
    setIsLoadingBookings(true);
    try {
      // REMOVED: orderBy('startTime', 'asc') to avoid specific index error. Sorting is now done client-side.
      // A Firestore index on (userId ASC, startTime ASC) would be more performant for server-side sorting.
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', currentUser.id)
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const fetchedBookingsPromises = bookingsSnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let resourceNameStr = 'Unknown Resource';
        if (data.resourceId) {
          const resourceDoc = await getDoc(doc(db, 'resources', data.resourceId));
          if (resourceDoc.exists()) resourceNameStr = resourceDoc.data()?.name || resourceNameStr;
        }
        return {
          id: docSnap.id,
          ...data,
          startTime: data.startTime ? parseISO(data.startTime) : new Date(),
          endTime: data.endTime ? parseISO(data.endTime) : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
          resourceName: resourceNameStr,
        } as Booking;
      });
      let bookings = await Promise.all(fetchedBookingsPromises);
      // Client-side sorting
      bookings.sort((a, b) => compareAsc(a.startTime, b.startTime));
      setAllUserBookings(bookings);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      toast({ title: "Error", description: "Failed to load your bookings.", variant: "destructive" });
    }
    setIsLoadingBookings(false);
  }, [currentUser, toast]);

  const fetchSupportData = useCallback(async () => {
    setIsLoadingResources(true);
    setIsLoadingAvailabilityRules(true);
    try {
      const resourcesQuery = query(collection(db, 'resources'));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const resources = resourcesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data(),
        // Ensure availability and unavailabilityPeriods are arrays
        availability: Array.isArray(docSnap.data().availability) ? docSnap.data().availability : [],
        unavailabilityPeriods: Array.isArray(docSnap.data().unavailabilityPeriods) ? docSnap.data().unavailabilityPeriods : [],
       } as Resource));
      setAllAvailableResources(resources.sort((a, b) => a.name.localeCompare(b.name)));
    } catch (error) {
      console.error("Error fetching resources:", error);
      toast({ title: "Error", description: "Failed to load resources for booking form.", variant: "destructive" });
    }
    setIsLoadingResources(false);

    try {
      const blackoutSnapshot = await getDocs(collection(db, "blackoutDates"));
      setBlackoutDates(blackoutSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as BlackoutDate)));

      const recurringSnapshot = await getDocs(collection(db, "recurringBlackoutRules"));
      setRecurringRules(recurringSnapshot.docs.map(r => ({ id: r.id, ...r.data() } as RecurringBlackoutRule)));
    } catch (error) {
      console.error("Error fetching blackout/recurring rules:", error);
      toast({ title: "Error", description: "Failed to load lab closure rules.", variant: "destructive" });
    }
    setIsLoadingAvailabilityRules(false);
  }, [toast]);


  useEffect(() => {
    setIsClient(true);
    fetchSupportData();
  }, [fetchSupportData]);

  useEffect(() => {
    if (isClient) {
      fetchAllBookingsForUser();
    }
  }, [currentUser, isClient, fetchAllBookingsForUser]);

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
    } else {
      baseDateForNewBooking = startOfDay(new Date());
    }

    if (!bookingToEdit?.id && isBefore(baseDateForNewBooking, startOfToday())) {
      baseDateForNewBooking = startOfToday();
    }

    const defaultStartTime = set(new Date(baseDateForNewBooking), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });
    const defaultCreatedAt = new Date();

    let bookingData: Partial<Booking> & { resourceId?: string };

    if (bookingToEdit) {
      bookingData = {
        ...bookingToEdit,
        userId: bookingToEdit.userId || currentUser.id,
      };
    } else {
      const initialResourceId = resourceIdForNew || (allAvailableResources.length > 0 ? allAvailableResources[0].id : '');
      bookingData = {
        startTime: defaultStartTime,
        endTime: new Date(defaultStartTime.getTime() + 2 * 60 * 60 * 1000), // Default 2 hour booking
        createdAt: defaultCreatedAt,
        userId: currentUser.id,
        resourceId: initialResourceId,
        status: 'Pending', notes: '',
      };
    }
    setCurrentBooking(bookingData);
    setIsFormOpen(true);
  }, [activeSelectedDate, currentUser, toast, allAvailableResources]);


  useEffect(() => {
    if (!isClient || !currentUser || !searchParams || isLoadingBookings || isLoadingResources || isLoadingAvailabilityRules) return;

    const resourceIdParam = searchParams?.get('resourceId');
    const dateParam = searchParams?.get('date');
    const bookingIdParam = searchParams?.get('bookingId');

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
      const bookingToEdit = allUserBookings.find(b => b.id === bookingIdParam && b.userId === currentUser.id);
      if (bookingToEdit) {
        handleOpenForm(bookingToEdit, undefined, new Date(bookingToEdit.startTime));
      }
    } else if (shouldOpenFormForNewWithResourceAndDate) {
      handleOpenForm(undefined, resourceIdParam, dateToSetFromUrl);
    } else if (shouldOpenFormForNewWithResourceOnly) {
      handleOpenForm(undefined, resourceIdParam, activeSelectedDate || new Date());
    }

  }, [searchParams, allUserBookings, isClient, currentUser, activeSelectedDate, handleOpenForm, isFormOpen, currentBooking, isLoadingBookings, isLoadingResources, isLoadingAvailabilityRules]);


  const bookingsToDisplay = useMemo(() => {
    if (!currentUser || isLoadingBookings) return [];
    let filtered = [...allUserBookings];

    if (activeSearchTerm) {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      filtered = filtered.filter(b =>
        (b.resourceName && b.resourceName.toLowerCase().includes(lowerSearchTerm)) ||
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
    } else {
      // Default view: show upcoming bookings, not past or cancelled ones that aren't also waitlisted
      filtered = filtered.filter(b =>
        b.startTime &&
        !isBefore(startOfDay(new Date(b.startTime)), startOfToday()) &&
        (b.status !== 'Cancelled' || b.status === 'Waitlisted') // Show waitlisted even if "past" today
      );
    }
    return filtered;
  }, [allUserBookings, activeSelectedDate, activeSearchTerm, activeFilterResourceId, activeFilterStatus, currentUser, isLoadingBookings]);


  const handleApplyDialogFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterStatus(tempFilterStatus);
    setActiveSelectedDate(tempSelectedDateInDialog);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFiltersOnly = () => {
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
    resetDialogFiltersOnly();

    const newSearchParams = new URLSearchParams(searchParams?.toString() || '');
    newSearchParams.delete('date');
    newSearchParams.delete('bookingId');
    newSearchParams.delete('resourceId');
    router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    setIsFilterDialogOpen(false);
  };


  const bookedDatesForCalendar = useMemo(() => {
    if (!currentUser || isLoadingBookings) return [];
    const dates = new Set<string>();
    allUserBookings.forEach(booking => {
      if (booking.status !== 'Cancelled' && isValidDate(new Date(booking.startTime))) {
        dates.add(format(new Date(booking.startTime), 'yyyy-MM-dd'));
      }
    });
    return Array.from(dates).map(dateStr => parseISO(dateStr));
  }, [currentUser, allUserBookings, isLoadingBookings]);


  const activeFilterCount = useMemo(() => [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
    activeFilterStatus !== 'all',
    activeSelectedDate !== undefined,
  ].filter(Boolean).length, [activeSearchTerm, activeFilterResourceId, activeFilterStatus, activeSelectedDate]);


  const dialogHeaderDateString = useMemo(() => {
    const dateFromCurrentBooking = currentBooking?.startTime ? new Date(currentBooking.startTime) : null;
    const dateToFormat = (isFormOpen && dateFromCurrentBooking && isValidDate(dateFromCurrentBooking))
      ? dateFromCurrentBooking
      : (isFormOpen && !currentBooking?.id && activeSelectedDate && isValidDate(activeSelectedDate))
        ? activeSelectedDate
        : null;
    return dateToFormat ? format(dateToFormat, "PPP") : null;
  }, [isFormOpen, currentBooking?.startTime, activeSelectedDate, currentBooking?.id]);



  if (!isClient) {
    return <BookingsPageLoader />;
  }

  if (!currentUser && isClient) {
    return (
      <div className="space-y-8">
        <PageHeader title="Manage Bookings" description="Please log in to manage your bookings." icon={CalendarDays} />
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

  async function handleSaveBooking(formData: BookingFormValues) {
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in to save a booking.", variant: "destructive" });
      return;
    }

    const finalStartTime = set(formData.bookingDate, {
      hours: parseInt(formData.startTime.split(':')[0]),
      minutes: parseInt(formData.startTime.split(':')[1]),
      seconds: 0, milliseconds: 0
    });
    const finalEndTime = set(formData.bookingDate, {
      hours: parseInt(formData.endTime.split(':')[0]),
      minutes: parseInt(formData.endTime.split(':')[1]),
      seconds: 0, milliseconds: 0
    });

    if (!formData.resourceId || !finalStartTime || !finalEndTime) {
      toast({ title: "Error", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    const resource = allAvailableResources.find(r => r.id === formData.resourceId);
    if (!resource) { toast({ title: "Error", description: "Selected resource not found or not available.", variant: "destructive" }); return; }

    if (isBefore(startOfDay(finalStartTime), startOfToday()) && !currentBooking?.id) {
      toast({ title: "Invalid Date", description: "Cannot create new bookings for past dates.", variant: "destructive" }); return;
    }

    if (finalEndTime <= finalStartTime) { toast({ title: "Invalid Time", description: "End time must be after start time.", variant: "destructive" }); return; }

    // 1. Check Lab-wide Recurring Blackout Rules
    const bookingDayIndex = getDay(finalStartTime);
    const bookingDayName = daysOfWeekArray[bookingDayIndex];
    const recurringLabBlackout = recurringRules.find(rule => rule.daysOfWeek.includes(bookingDayName));
    if (recurringLabBlackout) {
      toast({
        title: "Lab Closed",
        description: `The lab is regularly closed on ${bookingDayName}s due to: ${recurringLabBlackout.name}${recurringLabBlackout.reason ? ` (${recurringLabBlackout.reason})` : ''}. Please select a different date.`,
        variant: "destructive",
        duration: 10000
      });
      return;
    }

    // 2. Check Lab-wide Specific Blackout Dates
    const proposedDateOnlyStr = format(finalStartTime, 'yyyy-MM-dd');
    const isSpecificBlackout = blackoutDates.find(bd => bd.date === proposedDateOnlyStr);
    if (isSpecificBlackout) {
      toast({
        title: "Lab Closed",
        description: `The lab is closed on ${format(finalStartTime, 'PPP')}${isSpecificBlackout.reason ? ` due to: ${isSpecificBlackout.reason}` : '.'}. Please select a different date.`,
        variant: "destructive",
        duration: 7000
      });
      return;
    }

    // 3. Check Resource-Specific Unavailability Periods
    if (resource.unavailabilityPeriods && resource.unavailabilityPeriods.length > 0) {
      for (const period of resource.unavailabilityPeriods) {
        const unavailabilityStart = startOfDay(parseISO(period.startDate));
        const unavailabilityEnd = addDays(startOfDay(parseISO(period.endDate)), 1);

        if (
          (finalStartTime >= unavailabilityStart && finalStartTime < unavailabilityEnd) ||
          (finalEndTime > unavailabilityStart && finalEndTime <= unavailabilityEnd) ||
          (finalStartTime <= unavailabilityStart && finalEndTime >= unavailabilityEnd)
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

    // 4. Check Resource Daily Availability Slots
    if (resource.status !== 'Available') {
      toast({ title: "Resource Not Available", description: `${resource.name} is currently ${resource.status.toLowerCase()} and cannot be booked.`, variant: "destructive", duration: 7000 });
      return;
    }

    const resourceDayAvailability = resource.availability?.find(avail => avail.date === proposedDateOnlyStr);
    if (!resourceDayAvailability || resourceDayAvailability.slots.length === 0) {
      toast({ title: "Resource Unavailable", description: `${resource.name} is not scheduled to be available on ${format(finalStartTime, 'PPP')}. Please check resource availability settings or select another day.`, variant: "destructive", duration: 7000 });
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

      const slotStartTime = set(new Date(finalStartTime), { hours: slotStartHours, minutes: slotStartMinutes, seconds: 0, milliseconds: 0 });
      const slotEndTime = set(new Date(finalStartTime), { hours: slotEndHours, minutes: slotEndMinutes, seconds: 0, milliseconds: 0 });

      if (finalStartTime >= slotStartTime && finalEndTime <= slotEndTime) {
        isWithinAvailableSlot = true;
        break;
      }
    }

    if (!isWithinAvailableSlot) {
      toast({ title: "Time Slot Unavailable", description: `The selected time for ${resource.name} is outside of its defined available slots on ${format(finalStartTime, 'PPP')}. Available slots: ${resourceDayAvailability.slots.join(', ')}.`, variant: "destructive", duration: 10000 });
      return;
    }

    // 5. Check Conflicts with Existing Bookings
    const existingBookingsSnapshot = await getDocs(
      query(
        collection(db, 'bookings'),
        where('resourceId', '==', formData.resourceId!),
        where('status', 'in', ['Confirmed', 'Pending'])
      )
    );
    const existingBookingsForResource: Booking[] = existingBookingsSnapshot.docs.map(d => ({
      id: d.id, ...d.data(),
      startTime: parseISO(d.data().startTime),
      endTime: parseISO(d.data().endTime),
      createdAt: d.data().createdAt?.toDate ? d.data().createdAt.toDate() : new Date(d.data().createdAt || Date.now()),
    } as Booking));

    const conflictingBooking = existingBookingsForResource.find(existingBooking => {
      if (currentBooking && currentBooking.id && existingBooking.id === currentBooking.id) return false;
      return (finalStartTime < existingBooking.endTime && finalEndTime > existingBooking.startTime);
    });

    const isNewBooking = !currentBooking?.id;
    let finalStatus: Booking['status'] = formData.status || (isNewBooking ? 'Pending' : (currentBooking?.status || 'Pending'));


    if (conflictingBooking && finalStatus !== 'Waitlisted') {
      if (resource.allowQueueing) {
        finalStatus = 'Waitlisted';
        toast({ title: "Added to Waitlist", description: `This time slot is currently booked. Your request for ${resource.name} has been added to the waitlist.` });
        addAuditLog(currentUser.id, currentUser.name, 'BOOKING_WAITLISTED', { entityType: 'Booking', entityId: (currentBooking?.id || `temp_waitlist_${Date.now()}`), details: `Booking for '${resource.name}' placed on waitlist by user.` });
        addNotification(
          currentUser.id,
          'Added to Waitlist',
          `Your booking request for ${resource.name} on ${format(finalStartTime, 'MMM dd, HH:mm')} has been added to the waitlist.`,
          'booking_waitlisted',
          `/bookings?bookingId=${currentBooking?.id || `temp_waitlist_${Date.now()}`}`
        );
      } else {
        const conflictingUserDoc = await getDoc(doc(db, 'users', conflictingBooking.userId));
        const conflictingUserName = conflictingUserDoc.exists() ? conflictingUserDoc.data()?.name : 'another user';
        toast({ title: "Booking Conflict", description: `${resource.name} is already booked by ${conflictingUserName} from ${format(new Date(conflictingBooking.startTime), 'p')} to ${format(new Date(conflictingBooking.endTime), 'p')} on ${format(new Date(conflictingBooking.startTime), 'PPP')}. This resource does not allow queueing.`, variant: "destructive", duration: 10000 });
        return;
      }
    }

    const bookingDataToSave = {
      resourceId: formData.resourceId!,
      userId: currentUser.id,
      startTime: finalStartTime.toISOString(),
      endTime: finalEndTime.toISOString(),
      status: finalStatus,
      notes: formData.notes || '',
    };

    setIsLoadingBookings(true);
    try {
      if (!isNewBooking && currentBooking?.id) {
        const bookingDocRef = doc(db, "bookings", currentBooking.id);
        await updateDoc(bookingDocRef, bookingDataToSave); // createdAt is not updated
        toast({ title: "Success", description: "Booking updated successfully." });
        addAuditLog(currentUser.id, currentUser.name, 'BOOKING_UPDATED', { entityType: 'Booking', entityId: currentBooking.id, details: `Booking for '${resource.name}' updated by user.` });
      } else {
        const payloadForNewBooking = {
          ...bookingDataToSave,
          createdAt: formData.createdAt ? Timestamp.fromDate(formData.createdAt) : serverTimestamp()
        };
        const docRef = await addDoc(collection(db, "bookings"), payloadForNewBooking);
        addAuditLog(currentUser.id, currentUser.name, finalStatus === 'Pending' ? 'BOOKING_CREATED' : 'BOOKING_WAITLISTED', { entityType: 'Booking', entityId: docRef.id, details: `Booking for '${resource.name}' created with status ${finalStatus} by user.` });

        if (finalStatus === 'Pending') {
          toast({ title: "Success", description: "Booking created and submitted for approval." });
          // Assuming Admin UID is 'admin_user_id_placeholder' or similar
          const adminUserIds = ['u1']; // Replace with actual admin/lab manager UIDs
          adminUserIds.forEach(adminId => {
            addNotification(
              adminId,
              'New Booking Request',
              `Booking for ${resource.name} by ${currentUser.name} on ${format(finalStartTime, 'MMM dd, HH:mm')} needs approval.`,
              'booking_pending_approval',
              `/admin/booking-requests`
            );
          });
        }
      }
      await fetchAllBookingsForUser();
    } catch (error) {
      console.error("Error saving booking:", error);
      toast({ title: "Save Failed", description: "Could not save your booking. Please try again.", variant: "destructive" });
    } finally {
      setIsLoadingBookings(false);
      setIsFormOpen(false);
      setCurrentBooking(null);
    }
  }

  const handleCancelBookingLocal = async (bookingId: string) => {
    if (!currentUser) return;

    const bookingToCancel = allUserBookings.find(b => b.id === bookingId);
    if (!bookingToCancel) return;

    const resourceForCancelledBooking = allAvailableResources.find(r => r.id === bookingToCancel.resourceId);

    setIsLoadingBookings(true);
    try {
      const bookingDocRef = doc(db, "bookings", bookingId);
      await updateDoc(bookingDocRef, { status: 'Cancelled' });

      toast({ title: "Info", description: "Booking cancelled." });
      addAuditLog(currentUser.id, currentUser.name, 'BOOKING_CANCELLED', { entityType: 'Booking', entityId: bookingId, details: `Booking for '${bookingToCancel.resourceName}' cancelled by user.` });

      // Queue processing logic removed as it was complex with mock data
      // and requires robust Firestore implementation (potentially Cloud Functions)

      await fetchAllBookingsForUser();
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast({ title: "Cancellation Failed", description: "Could not cancel booking.", variant: "destructive" });
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const handleOpenDetailsDialog = (booking: Booking) => {
    setSelectedBookingForDetails(booking);
    setIsDetailsDialogOpen(true);
  };

  const handleBookingUpdateInDetails = (updatedBooking: Booking) => {
    if (!currentUser) return;
    setAllUserBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBooking : b));
    if (selectedBookingForDetails && selectedBookingForDetails.id === updatedBooking.id) {
      setSelectedBookingForDetails(updatedBooking);
    }
  };

  const dialogFooterText = useMemo(() => {
    if (activeSelectedDate) return `Showing bookings for ${format(activeSelectedDate, 'PPP')}.`;
    if (activeFilterCount > 0) return 'Showing filtered list of your bookings.';
    return 'Showing all your upcoming bookings.';
  }, [activeSelectedDate, activeFilterCount]);

  const calendarFooterActions = (
    <div className="flex flex-col sm:flex-row justify-center items-center gap-2 pt-2">
      {activeSelectedDate && (
        <Button
          variant="link"
          size="sm"
          onClick={() => setActiveSelectedDate(undefined)}
          className="text-xs px-2 h-auto"
        >
          View All Upcoming
        </Button>
      )}
      <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" size="sm" className="text-xs px-2 h-auto">
            <ListFilter className="mr-1.5 h-3.5 w-3.5" /> Filters
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1.5 rounded-full px-1.5 py-0.5 text-xs">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Filter Your Bookings</DialogTitle>
            <DialogDescription>
              Refine your list of bookings.
            </DialogDescription>
          </DialogHeader>
          <Separator className="my-4" />
          <ScrollArea className="max-h-[65vh] overflow-y-auto pr-2">
            <div className="space-y-6 py-1">
              <div>
                <Label htmlFor="bookingSearchDialog" className="text-sm font-medium mb-1 block">Search (Resource / Notes)</Label>
                <div className="relative">
                  <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="bookingSearchDialog"
                    type="search"
                    placeholder="Keyword..."
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
                      {allAvailableResources
                        .map(resource => (
                          <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem>
                        ))
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
                      tempSelectedDateInDialog && (
                        <Button variant="ghost" size="sm" onClick={() => setTempSelectedDateInDialog(undefined)} className="w-full text-xs mt-2"><FilterX className="mr-2 h-4 w-4" />Clear Date Selection</Button>
                      )
                    }
                    classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }}
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="pt-6 border-t">
            <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
              <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
            </Button>
            <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleApplyDialogFilters}>Apply Filters</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );


  return (
    <div className="space-y-8">
      <PageHeader
        title="Bookings"
        description="View, search, filter, and manage your lab resource bookings."
        icon={CalendarDays}
        actions={
          currentUser && (
            <Button onClick={() => handleOpenForm(undefined, null, activeSelectedDate || new Date())}><PlusCircle className="mr-2 h-4 w-4" /> New Booking</Button>
          )
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Select Date or Filter</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center p-2 sm:p-4">
            <Calendar
              mode="single"
              selected={activeSelectedDate}
              onSelect={(date) => setActiveSelectedDate(date ? startOfDay(date) : undefined)}
              month={activeSelectedDate || startOfDay(new Date())} // Control current month view
              modifiers={{ booked: bookedDatesForCalendar }}
              modifiersClassNames={{ booked: 'day-booked-dot' }}
              className="rounded-md border w-full max-w-xs"
              classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }}
            />
          </CardContent>
           <CardFooter className="p-2 sm:p-4 border-t">
             {calendarFooterActions}
           </CardFooter>
        </Card>

        <Card className="md:col-span-2 shadow-lg">
          <CardHeader className="border-b">
            <CardTitle>
              {activeSelectedDate ? `Your Bookings for ${format(activeSelectedDate, 'PPP')}` : 'All Your Upcoming Bookings'}
            </CardTitle>
            <CardDescription>
              Displaying {bookingsToDisplay.length} booking(s). {dialogFooterText}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingBookings || isLoadingResources || isLoadingAvailabilityRules ? (
              <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading bookings...</div>
            ) : bookingsToDisplay.length > 0 ? (
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
                      return (
                        <TableRow key={booking.id} className={cn(booking.status === 'Cancelled' && 'opacity-60')}>
                          <TableCell
                            className="font-medium cursor-pointer hover:underline hover:text-primary"
                            onClick={() => handleOpenDetailsDialog(booking)}
                          >
                            {booking.resourceName || 'N/A'}
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
                            >{booking.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDetailsDialog(booking)}>
                              <Eye className="h-4 w-4" /> <span className="sr-only">View Details</span>
                            </Button>
                            {booking.status !== 'Cancelled' &&
                              (booking.status === 'Pending' || booking.status === 'Waitlisted' || booking.status === 'Confirmed') && (
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenForm(booking, undefined, new Date(booking.startTime))}>
                                  <Edit3 className="h-4 w-4" /> <span className="sr-only">Edit Booking</span>
                                </Button>
                              )}
                            {booking.status !== 'Cancelled' && (
                              <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => handleCancelBookingLocal(booking.id)}>
                                <X className="h-4 w-4" /> <span className="sr-only">Cancel Booking</span>
                              </Button>
                            )}
                            {(booking.status === 'Cancelled') && (
                              <span className="text-xs text-muted-foreground italic">{booking.status}</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <CardContent className="text-center py-10 text-muted-foreground px-6">
                <CalendarDays className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">
                  {activeFilterCount > 0 ? 'No bookings match your current filters.' :
                    activeSelectedDate ? `No bookings scheduled for ${format(activeSelectedDate, 'PPP')}.` :
                      (allUserBookings.length === 0 ? 'You have no bookings.' : 'No upcoming bookings.')}
                </p>
                <p className="text-sm mb-4">
                  {activeFilterCount > 0 ? 'Try adjusting your filter criteria.' :
                    activeSelectedDate ? 'Feel free to create a new booking for this date.' :
                      (allUserBookings.length === 0 ? 'Create your first booking to get started.' : 'Create a new booking or check past dates.')}
                </p>
                {activeFilterCount > 0 ? (
                  <Button variant="outline" onClick={resetAllActivePageFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                  </Button>
                ) : (
                  activeSelectedDate ? (
                    <Button onClick={() => handleOpenForm(undefined, null, activeSelectedDate)} className="mt-4">
                      <PlusCircle className="mr-2 h-4 w-4" /> Create New Booking
                    </Button>
                  ) : (
                    allUserBookings.length === 0 && (
                      <Button onClick={() => handleOpenForm(undefined, null, new Date())} className="mt-4">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Booking
                      </Button>
                    )
                  )
                )}
              </CardContent>
            )}
          </CardContent>
          {activeFilterCount > 0 && bookingsToDisplay.length > 0 &&
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
          {isFormOpen && currentUser && (isLoadingResources || isLoadingAvailabilityRules ? (
            <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading form data...</div>
          ) : allAvailableResources.length > 0 ? (
            <BookingForm
              key={currentBooking?.id || `new:${currentBooking?.resourceId || 'na'}:${currentBooking?.startTime?.toISOString() || activeSelectedDate?.toISOString() || 'nodate'}`}
              initialData={currentBooking}
              onSave={handleSaveBooking}
              onCancel={() => setIsFormOpen(false)}
              currentUserFullName={currentUser.name}
              currentUserRole={currentUser.role}
              selectedDateProp={activeSelectedDate || (currentBooking?.startTime ? startOfDay(new Date(currentBooking.startTime)) : startOfDay(new Date()))}
              allAvailableResources={allAvailableResources}
            />
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <Info className="mx-auto h-8 w-8 mb-2" />
              <p>No resources are currently available for booking.</p>
              <p className="text-xs">Please check back later or contact an administrator.</p>
            </div>
          ))
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

const bookingFormSchema = z.object({
  resourceId: z.string().min(1, "Please select a resource."),
  bookingDate: z.date({ required_error: "Please select a date." }),
  startTime: z.string().min(1, "Please select a start time."),
  endTime: z.string().min(1, "Please select an end time."),
  status: z.enum(['Confirmed', 'Pending', 'Cancelled', 'Waitlisted'] as [string, ...string[]]).optional(),
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

export type BookingFormValues = z.infer<typeof bookingFormSchema>;


interface BookingFormProps {
  initialData?: Partial<Booking> & { resourceId?: string } | null;
  onSave: (data: BookingFormValues) => void;
  onCancel: () => void;
  currentUserFullName: string;
  currentUserRole: RoleName;
  selectedDateProp: Date;
  allAvailableResources: Resource[];
}

const timeSlots = Array.from({ length: (17 - 9) * 2 + 1 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  if (hour > 17 || (hour === 17 && minute === '30')) return null; // End time slot consideration for a 17:00 close
  return `${String(hour).padStart(2, '0')}:${minute}`;
}).filter(Boolean) as string[];


function BookingForm({ initialData, onSave, onCancel, currentUserFullName, currentUserRole, selectedDateProp, allAvailableResources }: BookingFormProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      resourceId: initialData?.resourceId || (allAvailableResources.length > 0 ? allAvailableResources[0].id : ''),
      bookingDate: initialData?.startTime ? startOfDay(new Date(initialData.startTime)) : startOfDay(selectedDateProp || new Date()),
      startTime: initialData?.startTime ? format(new Date(initialData.startTime), 'HH:mm') : '09:00',
      endTime: initialData?.endTime ? format(new Date(initialData.endTime), 'HH:mm') : '11:00',
      status: initialData?.id ? (initialData.status || 'Pending') : 'Pending',
      notes: initialData?.notes || '',
      createdAt: initialData?.createdAt ? new Date(initialData.createdAt) : new Date(),
    },
  });

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
        let newEndTime = new Date(newStartTime.getTime() + 2 * 60 * 60 * 1000); // Default 2hr booking

        const maxEndTimeForDay = set(new Date(currentBookingDate), { hours: 17, minutes: 0 });
        if (newEndTime > maxEndTimeForDay) {
          newEndTime = maxEndTimeForDay;
        }

        if (newEndTime <= newStartTime && currentStartTimeStr !== timeSlots[timeSlots.length - 1]) {
          const newStartTimePlus30Min = new Date(newStartTime.getTime() + 30 * 60 * 1000);
          if (newStartTimePlus30Min <= maxEndTimeForDay) newEndTime = newStartTimePlus30Min;
          else newEndTime = maxEndTimeForDay;
        }

        const formattedNewEndTime = format(newEndTime, 'HH:mm');
        if (form.getValues('endTime') !== formattedNewEndTime && newStartTime < newEndTime) {
          form.setValue('endTime', formattedNewEndTime, { shouldValidate: true });
        } else if (newStartTime >= newEndTime && format(newStartTime, 'HH:mm') === '17:00') {
           form.setValue('endTime', '17:00', { shouldValidate: true });
        }
      }
    }
  }, [watchStartTime, watchBookingDate, form]);


  function handleRHFSubmit(data: BookingFormValues) {
    onSave(data);
  }

  const canEditStatus = (currentUserRole === 'Admin' || currentUserRole === 'Lab Manager') && !!initialData?.id;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleRHFSubmit)} className="space-y-0">
        <ScrollArea className="max-h-[65vh] overflow-y-auto pr-2">
          <div className="space-y-4 py-4 px-1">
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
                          <CalendarDays className="mr-2 h-4 w-4" />
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
                        disabled={(date) => isBefore(date, startOfToday()) && !initialData?.id}
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
                      {allAvailableResources.map(resource => (
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
              <Input id="bookingFormUserNameRHF" value={currentUserFullName} readOnly className="bg-muted/50" />
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


export default function BookingsPage() {
  return (
    <Suspense fallback={<BookingsPageLoader />}>
      <BookingsPageContent />
    </Suspense>
  );
}
