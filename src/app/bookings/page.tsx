
'use client';

import { useState, useEffect, Suspense, useMemo, useCallback } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarDays, PlusCircle, Edit3, X, Search as SearchIcon, FilterX, Eye, Loader2, ListFilter, Info, Clock, CalendarIcon as CalendarIconLucide } from 'lucide-react'; // Renamed CalendarIcon to CalendarIconLucide
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
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Booking, Resource, RoleName } from '@/types';
import { daysOfWeekArray } from '@/types';
import { format, parseISO, isValid as isValidDate, startOfDay, isSameDay, set, isBefore, getDay, startOfToday, compareAsc } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn, formatDateSafe } from '@/lib/utils';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { allAdminMockResources, initialBookings, addNotification, initialBlackoutDates, initialRecurringBlackoutRules, bookingStatusesForFilter, bookingStatusesForForm, addAuditLog } from '@/lib/mock-data'; // Removed getWaitlistPosition, processQueueForResource
import { useForm, FormProvider, Controller } from 'react-hook-form';
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
  const [fetchedBlackoutDates, setFetchedBlackoutDates] = useState<typeof initialBlackoutDates>([]);
  const [fetchedRecurringRules, setFetchedRecurringRules] = useState<typeof initialRecurringBlackoutRules>([]);

  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [isLoadingAvailabilityRules, setIsLoadingAvailabilityRules] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Partial<Booking> & { resourceId?: string } | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  // Active page filters
  const [activeSelectedDate, setActiveSelectedDate] = useState<Date | undefined>(undefined);
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<Booking['status'] | 'all'>('all');
  
  // Temporary filters for the filter dialog
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>('all');
  const [tempFilterStatus, setTempFilterStatus] = useState<Booking['status'] | 'all'>('all');
  const [tempSelectedDateInDialog, setTempSelectedDateInDialog] = useState<Date | undefined>(undefined);
  const [currentCalendarMonthInDialog, setCurrentCalendarMonthInDialog] = useState<Date>(startOfDay(new Date()));

  useEffect(() => {
    setIsClient(true);
  }, []);

  const fetchAllBookingsForUser = useCallback(async () => {
    if (!currentUser?.id) {
      setAllUserBookings([]);
      setIsLoadingBookings(false);
      return;
    }
    setIsLoadingBookings(true);
    try {
      // Firestore Index Required: bookings collection: userId (ASC), startTime (ASC)
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', currentUser.id),
        orderBy('startTime', 'asc') // Re-added orderBy
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
          startTime: data.startTime ? (data.startTime.toDate ? data.startTime.toDate() : parseISO(data.startTime as string)) : new Date(),
          endTime: data.endTime ? (data.endTime.toDate ? data.endTime.toDate() : parseISO(data.endTime as string)) : new Date(),
          createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
          // resourceName: resourceNameStr, // No longer needed here, fetched on demand
        } as Booking;
      });
      let bookings = await Promise.all(fetchedBookingsPromises);
      // Client-side sort if orderBy was removed or as a fallback:
      // bookings.sort((a, b) => compareAsc(a.startTime, b.startTime));
      setAllUserBookings(bookings);
    } catch (error) {
      console.error("Error fetching user bookings:", error);
      toast({ title: "Error", description: "Failed to load your bookings. Firestore query might require an index.", variant: "destructive" });
    }
    setIsLoadingBookings(false);
  }, [currentUser?.id, toast]);

  const fetchSupportData = useCallback(async () => {
    setIsLoadingResources(true);
    setIsLoadingAvailabilityRules(true);
    try {
      const resourcesSnapshot = await getDocs(query(collection(db, 'resources'), orderBy('name', 'asc')));
      const resources = resourcesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data(),
        availability: Array.isArray(docSnap.data().availability) ? docSnap.data().availability.map((a: any) => ({...a, date: typeof a.date === 'string' ? a.date : (a.date?.toDate ? format(a.date.toDate(), 'yyyy-MM-dd') : a.date) })) : [],
        unavailabilityPeriods: Array.isArray(docSnap.data().unavailabilityPeriods) ? docSnap.data().unavailabilityPeriods.map((p: any) => ({...p, id: p.id || `unavail-${Date.now()}-${Math.random().toString(36).substring(2,9)}`, startDate: typeof p.startDate === 'string' ? p.startDate : (p.startDate?.toDate ? format(p.startDate.toDate(), 'yyyy-MM-dd') : p.startDate), endDate: typeof p.endDate === 'string' ? p.endDate : (p.endDate?.toDate ? format(p.endDate.toDate(), 'yyyy-MM-dd') : p.endDate), reason: p.reason })) : [],
       } as Resource));
      setAllAvailableResources(resources);
    } catch (error) {
      console.error("Error fetching resources:", error);
      toast({ title: "Error", description: "Failed to load resources for booking form.", variant: "destructive" });
    }
    setIsLoadingResources(false);

    try {
      const blackoutSnapshot = await getDocs(collection(db, "blackoutDates"));
      setFetchedBlackoutDates(blackoutSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as typeof initialBlackoutDates[0])));

      const recurringSnapshot = await getDocs(collection(db, "recurringBlackoutRules"));
      setFetchedRecurringRules(recurringSnapshot.docs.map(r => ({ id: r.id, ...r.data() } as typeof initialRecurringBlackoutRules[0])));
    } catch (error) {
      console.error("Error fetching blackout/recurring rules:", error);
      toast({ title: "Error", description: "Failed to load lab closure rules.", variant: "destructive" });
    }
    setIsLoadingAvailabilityRules(false);
  }, [toast]);

  useEffect(() => {
    if (isClient) {
      fetchSupportData();
    }
  }, [isClient, fetchSupportData]);

  useEffect(() => {
    if (isClient && currentUser) { 
      fetchAllBookingsForUser();
    } else if (isClient && !currentUser) { 
      setAllUserBookings([]);
      setIsLoadingBookings(false);
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

    let bookingData: Partial<Booking> & { resourceId?: string };

    if (bookingToEdit) {
      bookingData = {
        ...bookingToEdit,
        userId: bookingToEdit.userId || currentUser.id,
        // resourceName will be fetched if not present
      };
    } else {
      const initialResourceId = resourceIdForNew || (allAvailableResources.length > 0 ? allAvailableResources[0].id : '');
      bookingData = {
        startTime: defaultStartTime, // This is a Date object
        endTime: new Date(defaultStartTime.getTime() + 2 * 60 * 60 * 1000), // Also a Date object
        createdAt: new Date(),
        userId: currentUser.id,
        resourceId: initialResourceId,
        status: 'Pending', notes: '',
      };
    }
    setCurrentBooking(bookingData);
    setIsFormOpen(true);
  }, [currentUser, toast, allAvailableResources, activeSelectedDate]);


  // Effect to handle opening the form based on URL parameters
  useEffect(() => {
    if (!isClient || !currentUser || !searchParams || isLoadingBookings || isLoadingResources || isLoadingAvailabilityRules) {
      return;
    }
  
    const resourceIdParam = searchParams?.get('resourceId');
    const bookingIdParam = searchParams?.get('bookingId');
    const dateParam = searchParams?.get('date');
  
    let dateFromUrl: Date | undefined = undefined;
    if (dateParam) {
      const parsed = parseISO(dateParam);
      if (isValidDate(parsed)) {
        dateFromUrl = startOfDay(parsed);
      }
    }
  
    // Sync activeSelectedDate from URL if different (this might trigger activeSelectedDate dependency in handleOpenForm)
    if (dateFromUrl && (!activeSelectedDate || !isSameDay(activeSelectedDate, dateFromUrl))) {
      setActiveSelectedDate(dateFromUrl);
      setCurrentCalendarMonthInDialog(dateFromUrl); // Sync filter dialog calendar too
    }
  
    if (bookingIdParam) {
      // Only open if form is not already open for THIS booking
      if (isFormOpen && currentBooking?.id === bookingIdParam) return;
      
      const bookingToEdit = allUserBookings.find(b => b.id === bookingIdParam && b.userId === currentUser.id);
      if (bookingToEdit) {
        handleOpenForm(bookingToEdit);
      }
    } else if (resourceIdParam) {
      // Only open for a new resource if:
      // 1. Form is not open OR
      // 2. Form is open for a new booking, but for a DIFFERENT resource OR
      // 3. Form is open for a new booking (same resource), but for a DIFFERENT date from URL
      const shouldOpenForNew = 
        !isFormOpen ||
        (isFormOpen && !currentBooking?.id && currentBooking?.resourceId !== resourceIdParam) ||
        (isFormOpen && !currentBooking?.id && currentBooking?.resourceId === resourceIdParam && dateFromUrl && currentBooking.startTime && !isSameDay(new Date(currentBooking.startTime), dateFromUrl));

      if (shouldOpenForNew) {
        const dateToUseForNewBooking = dateFromUrl || activeSelectedDate || startOfToday();
        handleOpenForm(undefined, resourceIdParam, dateToUseForNewBooking);
      }
    }
  }, [
    searchParams, 
    allUserBookings, 
    currentUser, 
    isClient, 
    handleOpenForm, 
    isLoadingBookings, 
    isLoadingResources, 
    isLoadingAvailabilityRules, 
    activeSelectedDate, // activeSelectedDate is a dependency for dateToUse
    isFormOpen,       // Added to ensure effect re-evaluates if form state changes
    currentBooking    // Added to ensure effect re-evaluates if form context changes
  ]);


  const bookingsToDisplay = useMemo(() => {
    if (!currentUser || isLoadingBookings) return [];
    let filteredBookings = [...allUserBookings];

    if (activeSearchTerm) {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      // Requires fetching resourceName if we search by it. For now, only notes.
      filteredBookings = filteredBookings.filter(b =>
        (b.notes && b.notes.toLowerCase().includes(lowerSearchTerm))
      );
    }

    if (activeFilterResourceId !== 'all') {
      filteredBookings = filteredBookings.filter(b => b.resourceId === activeFilterResourceId);
    }

    if (activeFilterStatus !== 'all') {
      filteredBookings = filteredBookings.filter(b => b.status === activeFilterStatus);
    }

    if (activeSelectedDate) {
      return filteredBookings.filter(b => b.startTime && isValidDate(new Date(b.startTime)) && isSameDay(new Date(b.startTime), activeSelectedDate));
    } else {
       return filteredBookings.filter(b =>
        b.startTime &&
        !isBefore(startOfDay(new Date(b.startTime)), startOfToday()) &&
        (b.status !== 'Cancelled' || b.status === 'Waitlisted') 
      );
    }
  }, [allUserBookings, activeSelectedDate, activeSearchTerm, activeFilterResourceId, activeFilterStatus, currentUser, isLoadingBookings]);


  const handleApplyDialogFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterStatus(tempFilterStatus);
    // setActiveSelectedDate is handled by main calendar, but we sync tempSelectedDateInDialog
    if (tempSelectedDateInDialog && (!activeSelectedDate || !isSameDay(activeSelectedDate, tempSelectedDateInDialog))) {
      setActiveSelectedDate(tempSelectedDateInDialog);
    } else if (!tempSelectedDateInDialog && activeSelectedDate) {
      // If dialog clears date, clear active date
      setActiveSelectedDate(undefined);
    }
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

  const activeFilterCount = useMemo(() => [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
    activeFilterStatus !== 'all',
    activeSelectedDate !== undefined,
  ].filter(Boolean).length, [activeSearchTerm, activeFilterResourceId, activeFilterStatus, activeSelectedDate]);

  const dialogHeaderDateString = useMemo(() => {
    // This is for the BookingForm dialog, not the filter dialog
    if (isFormOpen && currentBooking?.startTime && isValidDate(new Date(currentBooking.startTime))) {
      return format(new Date(currentBooking.startTime), "PPP");
    }
    if (isFormOpen && !currentBooking?.id && activeSelectedDate && isValidDate(activeSelectedDate)) {
       return format(activeSelectedDate, "PPP");
    }
    return null;
  }, [isFormOpen, currentBooking?.startTime, activeSelectedDate, currentBooking?.id]);

  const handleDialogClose = (isOpen: boolean) => {
    setIsFormOpen(isOpen);
    if (!isOpen) {
      setCurrentBooking(null); // Clear current booking context
      
      // Aggressively clear URL parameters that might trigger re-opening
      const currentParams = new URLSearchParams(searchParams?.toString() || '');
      let paramsModified = false;
      if (currentParams.has('bookingId')) { currentParams.delete('bookingId'); paramsModified = true; }
      if (currentParams.has('resourceId')) { currentParams.delete('resourceId'); paramsModified = true; }
      if (currentParams.has('date')) { currentParams.delete('date'); paramsModified = true; } // Also clear date
      
      if (paramsModified) {
        router.push(`${pathname}?${currentParams.toString()}`, { scroll: false });
      }
    }
  };
  

  useEffect(() => {
    if (isFilterDialogOpen) {
        setTempSearchTerm(activeSearchTerm);
        setTempFilterResourceId(activeFilterResourceId);
        setTempFilterStatus(activeFilterStatus);
        setTempSelectedDateInDialog(activeSelectedDate);
        setCurrentCalendarMonthInDialog(activeSelectedDate || startOfDay(new Date()));
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterResourceId, activeFilterStatus, activeSelectedDate]);

  async function handleSaveBooking(formData: BookingFormValues) {
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in to save a booking.", variant: "destructive" });
      return;
    }
    if (!formData.resourceId) {
      toast({ title: "Error", description: "Please select a resource.", variant: "destructive" }); return;
    }
    
    const resource = allAvailableResources.find(r => r.id === formData.resourceId);
    if (!resource) { toast({ title: "Error", description: "Selected resource not found or not available.", variant: "destructive" }); return; }

    const finalStartTime = set(new Date(formData.bookingDate), { // Ensure formData.bookingDate is a Date
      hours: parseInt(formData.startTime.split(':')[0]),
      minutes: parseInt(formData.startTime.split(':')[1]),
      seconds: 0, milliseconds: 0
    });
    const finalEndTime = set(new Date(formData.bookingDate), { // Ensure formData.bookingDate is a Date
      hours: parseInt(formData.endTime.split(':')[0]),
      minutes: parseInt(formData.endTime.split(':')[1]),
      seconds: 0, milliseconds: 0
    });

    if (isBefore(startOfDay(finalStartTime), startOfToday()) && !currentBooking?.id) {
      toast({ title: "Invalid Date", description: "Cannot create new bookings for past dates.", variant: "destructive" }); return;
    }
    if (finalEndTime <= finalStartTime) { toast({ title: "Invalid Time", description: "End time must be after start time.", variant: "destructive" }); return; }

    const bookingDayIndex = getDay(finalStartTime);
    const bookingDayName = daysOfWeekArray[bookingDayIndex];
    const recurringLabBlackout = fetchedRecurringRules.find(rule => rule.daysOfWeek.includes(bookingDayName));
    if (recurringLabBlackout) {
      toast({
        title: "Lab Closed",
        description: `The lab is regularly closed on ${bookingDayName}s due to: ${recurringLabBlackout.name}${recurringLabBlackout.reason ? ` (${recurringLabBlackout.reason})` : ''}. Please select a different date.`,
        variant: "destructive",
        duration: 10000
      });
      return;
    }

    const proposedDateOnlyStr = format(finalStartTime, 'yyyy-MM-dd');
    const isSpecificBlackout = fetchedBlackoutDates.find(bd => bd.date === proposedDateOnlyStr);
    if (isSpecificBlackout) {
      toast({
        title: "Lab Closed",
        description: `The lab is closed on ${formatDateSafe(finalStartTime, 'this day', 'PPP')}${isSpecificBlackout.reason ? ` due to: ${isSpecificBlackout.reason}` : '.'}. Please select a different date.`,
        variant: "destructive",
        duration: 7000
      });
      return;
    }

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
            description: `${resource.name} is scheduled to be unavailable from ${formatDateSafe(unavailabilityStart, '', 'PPP')} to ${formatDateSafe(parseISO(period.endDate), '', 'PPP')}${period.reason ? ` due to: ${period.reason}` : '.'}. Please select a different date or time.`,
            variant: "destructive",
            duration: 10000
          });
          return;
        }
      }
    }
    
    if (resource.status !== 'Available') {
      toast({ title: "Resource Not Available", description: `${resource.name} is currently ${resource.status.toLowerCase()} and cannot be booked.`, variant: "destructive", duration: 7000 });
      return;
    }

    const resourceDayAvailability = resource.availability?.find(avail => avail.date === proposedDateOnlyStr);
    if (!resourceDayAvailability || resourceDayAvailability.slots.length === 0) {
      toast({ title: "Resource Unavailable", description: `${resource.name} is not scheduled to be available on ${formatDateSafe(finalStartTime, 'this day', 'PPP')}. Please check resource availability settings or select another day.`, variant: "destructive", duration: 7000 });
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
      toast({ title: "Time Slot Unavailable", description: `The selected time for ${resource.name} is outside of its defined available slots on ${formatDateSafe(finalStartTime, 'this day', 'PPP')}. Available slots: ${resourceDayAvailability.slots.join(', ')}.`, variant: "destructive", duration: 10000 });
      return;
    }

    const existingBookingsSnapshot = await getDocs(
      query(
        collection(db, 'bookings'),
        where('resourceId', '==', formData.resourceId!),
        where('status', 'in', ['Confirmed', 'Pending'])
      )
    );
    const existingBookingsForResource: Booking[] = existingBookingsSnapshot.docs.map(d => {
        const data = d.data();
        return {
        id: d.id, ...data,
        startTime: data.startTime ? (data.startTime.toDate ? data.startTime.toDate() : parseISO(data.startTime as string)) : new Date(),
        endTime: data.endTime ? (data.endTime.toDate ? data.endTime.toDate() : parseISO(data.endTime as string)) : new Date(),
        createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now()),
        } as Booking;
    });


    const conflictingBooking = existingBookingsForResource.find(existingBooking => {
      if (currentBooking && currentBooking.id && existingBooking.id === currentBooking.id) return false; 
      return (finalStartTime < existingBooking.endTime && finalEndTime > existingBooking.startTime);
    });

    const isNewBooking = !currentBooking?.id;
    let finalStatus: Booking['status'] = isNewBooking ? 'Pending' : (formData.status || currentBooking?.status || 'Pending');

    if (conflictingBooking && finalStatus !== 'Waitlisted') {
      if (resource.allowQueueing) {
        finalStatus = 'Waitlisted';
        toast({ title: "Added to Waitlist", description: `This time slot is currently booked. Your request for ${resource.name} has been added to the waitlist.` });
        addAuditLog(currentUser.id, currentUser.name || 'User', 'BOOKING_WAITLISTED', { entityType: 'Booking', entityId: (currentBooking?.id || `temp_waitlist_${Date.now()}`), details: `Booking for '${resource.name}' placed on waitlist by user ${currentUser.name}.` });
        addNotification(
          currentUser.id,
          'Added to Waitlist',
          `Your booking request for ${resource.name} on ${format(finalStartTime, 'MMM dd, HH:mm')} has been added to the waitlist.`,
          'booking_waitlisted',
          `/bookings?bookingId=${currentBooking?.id || `temp_waitlist_${Date.now()}`}`
        );
      } else {
        let conflictingUserName = 'another user';
        try {
            const conflictingUserDoc = await getDoc(doc(db, 'users', conflictingBooking.userId));
            if (conflictingUserDoc.exists()) conflictingUserName = conflictingUserDoc.data()?.name || 'another user';
        } catch (userFetchError) {
            console.error("Error fetching conflicting user's name:", userFetchError);
        }
        toast({ title: "Booking Conflict", description: `${resource.name} is already booked by ${conflictingUserName} from ${format(new Date(conflictingBooking.startTime), 'p')} to ${format(new Date(conflictingBooking.endTime), 'p')} on ${formatDateSafe(new Date(conflictingBooking.startTime), 'this day', 'PPP')}. This resource does not allow queueing.`, variant: "destructive", duration: 10000 });
        return;
      }
    }

    const bookingDataToSave = {
      resourceId: formData.resourceId!,
      userId: currentUser.id,
      startTime: finalStartTime, 
      endTime: finalEndTime,     
      status: finalStatus,
      notes: formData.notes || '',
      // Ensure createdAt is a Firestore Timestamp for new bookings, or use existing for updates
      createdAt: (isNewBooking || !formData.createdAt) ? serverTimestamp() : Timestamp.fromDate(new Date(formData.createdAt)),
    };
    
    const cleanBookingDataToSave = Object.fromEntries(Object.entries(bookingDataToSave).filter(([_,v]) => v !== undefined));


    setIsLoadingBookings(true);
    try {
      if (!isNewBooking && currentBooking?.id) {
        const bookingDocRef = doc(db, "bookings", currentBooking.id);
        await updateDoc(bookingDocRef, cleanBookingDataToSave);
        toast({ title: "Success", description: "Booking updated successfully." });
        addAuditLog(currentUser.id, currentUser.name || 'User', 'BOOKING_UPDATED', { entityType: 'Booking', entityId: currentBooking.id, details: `Booking for '${resource.name}' updated by user ${currentUser.name}.` });
      } else {
        const docRef = await addDoc(collection(db, "bookings"), cleanBookingDataToSave);
        const actionType = finalStatus === 'Pending' ? 'BOOKING_CREATED' : 'BOOKING_WAITLISTED';
        addAuditLog(currentUser.id, currentUser.name || 'User', actionType, { entityType: 'Booking', entityId: docRef.id, details: `Booking for '${resource.name}' created with status ${finalStatus} by user ${currentUser.name}.` });
        
        if (finalStatus === 'Pending') {
          toast({ title: "Success", description: "Booking created and submitted for approval." });
          const adminUsersSnapshot = await getDocs(query(collection(db, 'users'), where('role', 'in', ['Admin', 'Lab Manager'])));
          adminUsersSnapshot.forEach(adminDoc => {
            addNotification(
              adminDoc.id,
              'New Booking Request',
              `Booking for ${resource.name} by ${currentUser.name || 'Unknown User'} on ${format(finalStartTime, 'MMM dd, HH:mm')} needs approval.`,
              'booking_pending_approval',
              `/admin/booking-requests` // Link to booking requests
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
      handleDialogClose(false); // Close dialog after save
    }
  }

  const handleCancelBookingLocal = async (bookingId: string) => {
    if (!currentUser) return;

    const bookingToCancel = allUserBookings.find(b => b.id === bookingId);
    if (!bookingToCancel) {
      toast({ title: "Error", description: "Booking not found.", variant: "destructive"});
      return;
    }
    
    setIsLoadingBookings(true);
    try {
      const bookingDocRef = doc(db, "bookings", bookingId);
      await updateDoc(bookingDocRef, { status: 'Cancelled' });

      toast({ title: "Info", description: "Booking cancelled." });
      
      // Fetch resource name for audit log (might require an additional fetch if not readily available)
      let resourceNameForLog = bookingToCancel.resourceName || 'Unknown Resource';
      if (!bookingToCancel.resourceName && bookingToCancel.resourceId) {
          const resDoc = await getDoc(doc(db, "resources", bookingToCancel.resourceId));
          if (resDoc.exists()) resourceNameForLog = resDoc.data().name;
      }
      addAuditLog(currentUser.id, currentUser.name || 'User', 'BOOKING_CANCELLED', { entityType: 'Booking', entityId: bookingId, details: `Booking for '${resourceNameForLog}' cancelled by user ${currentUser.name}.` });
      
      // Basic Queue Processing on Cancellation - if we remove mock-data processQueueForResource
      const resource = allAvailableResources.find(r => r.id === bookingToCancel.resourceId);
      if (bookingToCancel.status === 'Confirmed' && resource && resource.allowQueueing) {
          // Find the earliest waitlisted booking for this resource
          const waitlistedBookingsSnapshot = await getDocs(query(
              collection(db, "bookings"),
              where("resourceId", "==", bookingToCancel.resourceId),
              where("status", "==", "Waitlisted"),
              orderBy("createdAt", "asc"), // Assuming createdAt is a Timestamp
              limit(1)
          ));

          if (!waitlistedBookingsSnapshot.empty) {
              const promotedBookingDoc = waitlistedBookingsSnapshot.docs[0];
              await updateDoc(promotedBookingDoc.ref, { status: "Pending" });
              
              let promotedUserName = 'A user';
              let promotedResourceName = resource.name; // Use already fetched resource name
              const promotedUserData = await getDoc(doc(db, "users", promotedBookingDoc.data().userId));
              if(promotedUserData.exists()) promotedUserName = promotedUserData.data().name;


              addNotification(promotedBookingDoc.data().userId, "Booking Promoted", `Your waitlisted booking for ${promotedResourceName} is now pending approval.`, "booking_promoted_user", `/bookings?bookingId=${promotedBookingDoc.id}`);
              const adminsSnapshot = await getDocs(query(collection(db, 'users'), where('role', 'in', ['Admin', 'Lab Manager'])));
              adminsSnapshot.forEach(admin => {
                  addNotification(admin.id, "Waitlist Booking Promoted", `Waitlisted booking for ${promotedResourceName} by ${promotedUserName} has been promoted to Pending.`, "booking_promoted_admin", "/admin/booking-requests");
              });
              addAuditLog("SYSTEM", "System", "BOOKING_PROMOTED", { entityType: "Booking", entityId: promotedBookingDoc.id, details: `Booking for ${promotedResourceName} by ${promotedUserName} promoted from waitlist to Pending.`});
          }
      }

      await fetchAllBookingsForUser(); 
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast({ title: "Cancellation Failed", description: "Could not cancel booking.", variant: "destructive" });
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const handleOpenDetailsDialog = async (booking: Booking) => {
     let bookingWithDetails = { ...booking };
     if (!booking.resourceName && booking.resourceId) {
        const resDoc = await getDoc(doc(db, "resources", booking.resourceId));
        if(resDoc.exists()) bookingWithDetails.resourceName = resDoc.data().name;
     }
     if (!booking.userName && booking.userId) {
        const userDoc = await getDoc(doc(db, "users", booking.userId));
        if(userDoc.exists()) bookingWithDetails.userName = userDoc.data().name;
     }
    setSelectedBookingForDetails(bookingWithDetails);
    setIsDetailsDialogOpen(true);
  };

  const handleBookingUpdateInDetails = (updatedBooking: Booking) => {
    if (!currentUser) return;
    // Update the main list
    setAllUserBookings(prev => prev.map(b => b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b));
    // Update the selected one if it's the same
    if (selectedBookingForDetails && selectedBookingForDetails.id === updatedBooking.id) {
      setSelectedBookingForDetails(prev => prev ? {...prev, ...updatedBooking} : null);
    }
  };

  const getBookingStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'Confirmed':
        return <Badge className={cn("bg-green-500 text-white hover:bg-green-600 border-transparent")}>{status}</Badge>;
      case 'Pending':
        return <Badge className={cn("bg-yellow-500 text-yellow-950 hover:bg-yellow-600 border-transparent")}>{status}</Badge>;
      case 'Cancelled':
        return <Badge className={cn("bg-gray-400 text-white hover:bg-gray-500 border-transparent")}>{status}</Badge>;
      case 'Waitlisted':
         // For waitlist position, ensure initialBookings is available or pass it down
         // const position = getWaitlistPosition(booking, initialBookings); // Needs initialBookings or similar
         // return <Badge className={cn("bg-purple-500 text-white hover:bg-purple-600 border-transparent")}>{status}{position ? ` (#${position})` : ''}</Badge>;
         return <Badge className={cn("bg-purple-500 text-white hover:bg-purple-600 border-transparent")}>{status}</Badge>;

      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };


  if (!isClient) {
    return <BookingsPageLoader />; // Or a more specific skeleton for this page
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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Bookings"
        description="View, search, filter, and manage your lab resource bookings."
        icon={CalendarDays}
        actions={
          currentUser && (
            <div className="flex items-center gap-2 flex-wrap">
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
                 <DialogContent className="w-full max-w-md sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Filter Your Bookings</DialogTitle>
                    <DialogDescription>
                      Refine your list of bookings using the options below.
                    </DialogDescription>
                  </DialogHeader>
                  <Separator className="my-4" />
                  <ScrollArea className="max-h-[65vh] overflow-y-auto pr-2">
                    <div className="space-y-6 py-1">
                      <div>
                        <FormLabel htmlFor="bookingSearchDialog">Search (Notes)</FormLabel>
                        <div className="relative mt-1">
                          <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            id="bookingSearchDialog"
                            type="search"
                            placeholder="Keyword in notes..."
                            className="h-9 pl-8"
                            value={tempSearchTerm}
                            onChange={(e) => setTempSearchTerm(e.target.value.toLowerCase())}
                          />
                        </div>
                      </div>
                      <Separator />
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <FormLabel htmlFor="bookingResourceDialog">Resource</FormLabel>
                          <Select value={tempFilterResourceId} onValueChange={setTempFilterResourceId}>
                            <SelectTrigger id="bookingResourceDialog" className="h-9 mt-1"><SelectValue placeholder="Filter by Resource" /></SelectTrigger>
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
                          <FormLabel htmlFor="bookingStatusDialog">Status</FormLabel>
                          <Select value={tempFilterStatus} onValueChange={(v) => setTempFilterStatus(v as Booking['status'] | 'all')}>
                            <SelectTrigger id="bookingStatusDialog" className="h-9 mt-1"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                            <SelectContent>
                              {bookingStatusesForFilter.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                       <Separator />
                        <div>
                            <FormLabel className="text-sm font-medium mb-2 block">Filter by Date</FormLabel>
                            <div className="flex justify-center items-center rounded-md border p-2">
                            <Calendar
                                mode="single" selected={tempSelectedDateInDialog} onSelect={setTempSelectedDateInDialog}
                                month={currentCalendarMonthInDialog} onMonthChange={setCurrentCalendarMonthInDialog}
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
              <Button onClick={() => handleOpenForm(undefined, null, activeSelectedDate || new Date())}><PlusCircle className="mr-2 h-4 w-4" /> New Booking</Button>
            </div>
          )
        }
      />
        <Card className="shadow-lg">
          <CardHeader className="border-b">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center">
              <div>
                 <CardTitle>
                  {activeSelectedDate ? `Your Bookings for ${formatDateSafe(activeSelectedDate, 'this day', 'PPP')}` : 'All Your Upcoming Bookings'}
                </CardTitle>
                <CardDescription>
                  Displaying {bookingsToDisplay.length} booking(s).
                </CardDescription>
              </div>
              {activeSelectedDate && 
                <Button variant="link" size="sm" onClick={() => setActiveSelectedDate(undefined)} className="text-xs px-2 h-auto mt-2 sm:mt-0 self-start sm:self-center">View All Upcoming</Button>
              }
            </div>
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
                      // Find resource name for display - ideally this comes pre-joined or fetched efficiently
                      const resource = allAvailableResources.find(r => r.id === booking.resourceId);
                      const resourceNameDisplay = resource ? resource.name : 'N/A';

                      return (
                        <TableRow key={booking.id} className={cn(booking.status === 'Cancelled' && 'opacity-60')}>
                          <TableCell
                            className="font-medium cursor-pointer hover:underline hover:text-primary"
                            onClick={() => handleOpenDetailsDialog(booking)}
                          >
                            {resourceNameDisplay}
                          </TableCell>
                          <TableCell>
                            <div>{formatDateSafe(booking.startTime, 'Invalid Date', 'MMM dd, yyyy')}</div>
                            <div className="text-xs text-muted-foreground">
                              {isValidDate(booking.startTime) ? format(booking.startTime, 'p') : ''} -
                              {isValidDate(booking.endTime) ? format(booking.endTime, 'p') : ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getBookingStatusBadge(booking.status)}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            {/* <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDetailsDialog(booking)}>
                              <Eye className="h-4 w-4" /> <span className="sr-only">View Details</span>
                            </Button> */}
                            {booking.status !== 'Cancelled' &&
                              (booking.status === 'Pending' || booking.status === 'Waitlisted' || booking.status === 'Confirmed') && (
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenForm(booking)}>
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
                    activeSelectedDate ? `No bookings scheduled for ${formatDateSafe(activeSelectedDate, 'this day', 'PPP')}.` :
                      (allUserBookings.length === 0 && !isLoadingBookings ? 'You have no bookings.' : 'No upcoming bookings.')}
                </p>
                <p className="text-sm mb-4">
                  {activeFilterCount > 0 ? 'Try adjusting your filter criteria.' :
                    activeSelectedDate ? 'Feel free to create a new booking for this date.' :
                      (allUserBookings.length === 0 && !isLoadingBookings ? 'Create your first booking to get started.' : 'Create a new booking or check past dates.')}
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
                    allUserBookings.length === 0 && !isLoadingBookings && (
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
      <Dialog
        open={isFormOpen}
        onOpenChange={handleDialogClose}
        key={currentBooking?.id || `new:${currentBooking?.resourceId || 'na'}:${(currentBooking?.startTime ? new Date(currentBooking.startTime) : activeSelectedDate || new Date()).toISOString()}`}
        >
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
              initialData={currentBooking}
              onSave={handleSaveBooking}
              onCancel={() => handleDialogClose(false)}
              currentUserFullName={currentUser.name}
              currentUserRole={currentUser.role}
              allAvailableResources={allAvailableResources}
              selectedDateProp={activeSelectedDate}
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
  status: z.enum(bookingStatusesForForm as [string, ...string[]]).optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters.").optional().or(z.literal('')),
  createdAt: z.date().optional(), // Added createdAt for consistency if passed
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
  allAvailableResources: Resource[];
  selectedDateProp?: Date; // Date from main calendar
}

const timeSlots = Array.from({ length: (17 - 9) * 2 + 1 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  if (hour > 17 || (hour === 17 && minute === '30')) return null; 
  return `${String(hour).padStart(2, '0')}:${minute}`;
}).filter(Boolean) as string[];


function BookingForm({ initialData, onSave, onCancel, currentUserFullName, currentUserRole, allAvailableResources, selectedDateProp }: BookingFormProps) {
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);

  const getInitialBookingDate = useCallback(() => {
    if (initialData?.startTime && isValidDate(new Date(initialData.startTime))) {
      return startOfDay(new Date(initialData.startTime));
    }
    if (selectedDateProp && isValidDate(selectedDateProp)) {
      return startOfDay(selectedDateProp);
    }
    return startOfToday();
  }, [initialData?.startTime, selectedDateProp]);


  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      resourceId: initialData?.resourceId || (allAvailableResources.length > 0 ? allAvailableResources[0].id : ''),
      bookingDate: getInitialBookingDate(),
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
        let newEndTime = new Date(newStartTime.getTime() + 2 * 60 * 60 * 1000); 

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
  const isNewBookingForm = !initialData?.id;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleRHFSubmit)}>
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
                          <CalendarIconLucide className="mr-2 h-4 w-4" />
                          {field.value && isValidDate(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                            if(date) field.onChange(startOfDay(date));
                            setIsCalendarOpen(false);
                        }}
                        disabled={(date) => isBefore(date, startOfToday()) && isNewBookingForm} 
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
