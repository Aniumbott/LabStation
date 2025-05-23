
'use client';

import React, { useState, useEffect, Suspense, useMemo, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarDays, PlusCircle, Edit3, X, Search as SearchIcon, FilterX, Eye, Loader2, ListFilter, Info, Clock, Calendar as CalendarIconLucide, User as UserIcon, Package as ResourceIcon, CheckCircle2, Save } from 'lucide-react';
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
import { daysOfWeekArray } from '@/types'; // Used for getDay logic
import { format, parseISO, isValid as isValidDateFn, startOfDay, isSameDay, set, isBefore, getDay, startOfToday, compareAsc, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn, formatDateSafe } from '@/lib/utils';
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
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp, getDoc, orderBy, limit } from 'firebase/firestore';


function BookingsPageLoader() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-200px)] text-muted-foreground">
      <Loader2 className="h-10 w-10 animate-spin text-primary" />
      <p className="mt-2 text-sm">Loading bookings...</p>
    </div>
  );
}

interface BookingsPageContentProps {}


function BookingsPageContent({}: BookingsPageContentProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  const [isClient, setIsClient] = useState(false);
  
  const [allUserBookings, setAllUserBookings] = useState<Booking[]>([]);
  const [allAvailableResources, setAllAvailableResources] = useState<Resource[]>([]); // For form dropdown
  const [fetchedBlackoutDates, setFetchedBlackoutDates] = useState<any[]>([]);
  const [fetchedRecurringRules, setFetchedRecurringRules] = useState<any[]>([]);

  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isLoadingResources, setIsLoadingResources] = useState(true); // For form resources
  const [isLoadingAvailabilityRules, setIsLoadingAvailabilityRules] = useState(true);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Partial<Booking> & { resourceId?: string } | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<Booking | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
  
  const [activeSelectedDate, setActiveSelectedDate] = useState<Date | undefined>(undefined);
  
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>('all');
  const [tempFilterStatus, setTempFilterStatus] = useState<Booking['status'] | 'all'>('all');
  
  const dialogJustClosedRef = useRef(false);

  const fetchAllBookingsForUser = useCallback(async () => {
    if (!currentUser?.id) {
      setAllUserBookings([]);
      setIsLoadingBookings(false);
      return;
    }
    setIsLoadingBookings(true);
    try {
      // Firestore Index Required: bookings (userId ASC, startTime ASC)
      const bookingsQuery = query(
        collection(db, 'bookings'),
        where('userId', '==', currentUser.id),
        orderBy('startTime', 'asc') 
      );
      const bookingsSnapshot = await getDocs(bookingsQuery);
      const fetchedBookings = bookingsSnapshot.docs.map((docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          resourceId: data.resourceId,
          userId: data.userId,
          startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(),
          endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
          status: data.status,
          notes: data.notes,
          usageDetails: data.usageDetails ? {
              ...data.usageDetails,
              actualStartTime: data.usageDetails.actualStartTime instanceof Timestamp ? data.usageDetails.actualStartTime.toDate() : undefined,
              actualEndTime: data.usageDetails.actualEndTime instanceof Timestamp ? data.usageDetails.actualEndTime.toDate() : undefined,
          } : undefined,
        } as Booking;
      });
      // Client-side sort, if `orderBy` was removed from query for index reasons.
      // bookings.sort((a, b) => compareAsc(a.startTime, b.startTime));
      setAllUserBookings(fetchedBookings);
    } catch (error: any) {
      console.error("Error fetching user bookings:", error);
      toast({ title: "Error Loading Bookings", description: error.message || "Failed to load your bookings.", variant: "destructive" });
      setAllUserBookings([]);
    }
    setIsLoadingBookings(false);
  }, [currentUser?.id, toast]);

  const fetchSupportData = useCallback(async () => {
    setIsLoadingResources(true);
    setIsLoadingAvailabilityRules(true);
    try {
      const resourcesQuery = query(collection(db, 'resources'), orderBy('name', 'asc'));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const resources = resourcesSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
            id: docSnap.id,
            name: data.name,
            status: data.status,
            lab: data.lab,
            resourceTypeId: data.resourceTypeId,
            allowQueueing: data.allowQueueing ?? false,
            availability: Array.isArray(data.availability) ? data.availability.map((a: any) => ({...a, date: a.date })) : [], // Dates are strings 'YYYY-MM-DD'
            unavailabilityPeriods: Array.isArray(data.unavailabilityPeriods) ? data.unavailabilityPeriods.map((p: any) => ({...p, id: p.id || `unavail-${Date.now()}-${Math.random().toString(36).substring(2,9)}`, startDate: p.startDate, endDate: p.endDate, reason: p.reason })) : [], // Dates are strings 'YYYY-MM-DD'
            // other fields as needed by BookingForm or conflict checks
        } as Resource;
      });
      setAllAvailableResources(resources);
    } catch (error:any) {
      console.error("Error fetching resources:", error);
      toast({ title: "Error Loading Resources", description: `Failed to load resources for booking form. ${error.message}`, variant: "destructive" });
      setAllAvailableResources([]);
    }
    setIsLoadingResources(false);

    try {
      const blackoutSnapshot = await getDocs(query(collection(db, "blackoutDates"), orderBy("date", "asc")));
      setFetchedBlackoutDates(blackoutSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));

      const recurringSnapshot = await getDocs(query(collection(db, "recurringBlackoutRules"), orderBy("name", "asc")));
      setFetchedRecurringRules(recurringSnapshot.docs.map(r => ({ id: r.id, ...r.data() } as any)));
    } catch (error:any) {
      console.error("Error fetching blackout/recurring rules:", error);
      toast({ title: "Error Loading Closure Rules", description: `Failed to load lab closure rules. ${error.message}`, variant: "destructive" });
      setFetchedBlackoutDates([]);
      setFetchedRecurringRules([]);
    }
    setIsLoadingAvailabilityRules(false);
  }, [toast]);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

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


  const handleOpenForm = useCallback((
    bookingToEdit?: Booking,
    resourceIdForNew?: string | null,
    dateForNew?: Date | null
  ) => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "You need to be logged in to create or edit bookings.", variant: "destructive" });
      return;
    }

    let baseDateForNewBooking: Date;
    if (dateForNew && isValidDateFn(dateForNew)) {
      baseDateForNewBooking = startOfDay(dateForNew);
    } else if (activeSelectedDate && isValidDateFn(activeSelectedDate) && !bookingToEdit?.id) {
      baseDateForNewBooking = startOfDay(activeSelectedDate);
    } else if (bookingToEdit?.startTime && isValidDateFn(new Date(bookingToEdit.startTime))) {
      baseDateForNewBooking = startOfDay(new Date(bookingToEdit.startTime));
    } else {
      baseDateForNewBooking = startOfToday();
    }

    if (!bookingToEdit?.id && isBefore(baseDateForNewBooking, startOfToday())) {
      baseDateForNewBooking = startOfToday();
    }
    
    const defaultStartTime = set(new Date(baseDateForNewBooking), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });

    let bookingData: Partial<Booking> & { resourceId?: string };

    if (bookingToEdit) {
      bookingData = {
        ...bookingToEdit, 
        resourceId: bookingToEdit.resourceId, 
      };
    } else {
      const initialResourceId = resourceIdForNew || (allAvailableResources.length > 0 ? allAvailableResources[0].id : '');
      bookingData = {
        startTime: defaultStartTime, 
        endTime: new Date(defaultStartTime.getTime() + 2 * 60 * 60 * 1000), 
        createdAt: new Date(),
        userId: currentUser.id,
        resourceId: initialResourceId,
        status: 'Pending', 
        notes: '',
      };
    }
    setCurrentBooking(bookingData);
    setIsFormOpen(true);
  }, [currentUser, allAvailableResources, activeSelectedDate, toast, setCurrentBooking, setIsFormOpen]);


 useEffect(() => {
    if (dialogJustClosedRef.current) {
      dialogJustClosedRef.current = false; 
      return;
    }

    if (!isClient || !currentUser || isLoadingBookings || isLoadingResources || isLoadingAvailabilityRules) {
      return;
    }
  
    const resourceIdParam = searchParams?.get('resourceId');
    const bookingIdParam = searchParams?.get('bookingId');
    const dateParam = searchParams?.get('date');
  
    let dateFromUrl: Date | undefined = undefined;
    if (dateParam) {
      const parsed = parseISO(dateParam);
      if (isValidDateFn(parsed)) {
        dateFromUrl = startOfDay(parsed);
      }
    }
  
    if (dateFromUrl && (!activeSelectedDate || !isSameDay(activeSelectedDate, dateFromUrl))) {
      setActiveSelectedDate(dateFromUrl);
    }

    if (bookingIdParam) {
        if (isFormOpen && currentBooking?.id === bookingIdParam) return; 
        if (isFormOpen && currentBooking?.id && currentBooking.id !== bookingIdParam) return; 
        const bookingToEdit = allUserBookings.find(b => b.id === bookingIdParam && b.userId === currentUser.id);
        if (bookingToEdit) {
            handleOpenForm(bookingToEdit);
        }
    } else if (resourceIdParam) {
        if (isFormOpen && !currentBooking?.id && currentBooking?.resourceId === resourceIdParam) return; 
        if (isFormOpen && currentBooking?.id) return; 
        const dateToUseForNewBooking = dateFromUrl || activeSelectedDate || startOfToday();
        handleOpenForm(undefined, resourceIdParam, dateToUseForNewBooking);
    }
  }, [
    searchParams, isClient, currentUser, allUserBookings, 
    handleOpenForm, isLoadingBookings, isLoadingResources, isLoadingAvailabilityRules, 
    activeSelectedDate, isFormOpen, currentBooking
  ]);


  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<Booking['status'] | 'all'>('all');
  const [tempSelectedDateInDialog, setTempSelectedDateInDialog] = useState<Date | undefined>(undefined);
  const [currentCalendarMonthInDialog, setCurrentCalendarMonthInDialog] = useState<Date>(startOfDay(new Date()));


  const bookingsToDisplay = useMemo(() => {
    if (!currentUser || isLoadingBookings) return [];
    
    let filteredBookings = allUserBookings.map(b => {
      const resource = allAvailableResources.find(r => r.id === b.resourceId);
      return {...b, resourceName: resource?.name || "Unknown Resource"};
    });

    if (activeSearchTerm) {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      filteredBookings = filteredBookings.filter(b =>
        (b.resourceName && b.resourceName.toLowerCase().includes(lowerSearchTerm)) ||
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
      return filteredBookings.filter(b => b.startTime && isValidDateFn(b.startTime) && isSameDay(b.startTime, activeSelectedDate));
    } else {
       return filteredBookings.filter(b =>
        b.startTime &&
        !isBefore(startOfDay(b.startTime), startOfToday()) &&
        (b.status !== 'Cancelled') 
      ).sort((a,b) => compareAsc(a.startTime, b.startTime));
    }
  }, [allUserBookings, activeSelectedDate, activeSearchTerm, activeFilterResourceId, activeFilterStatus, currentUser, isLoadingBookings, allAvailableResources]);


  const handleApplyDialogFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterStatus(tempFilterStatus);
    if (tempSelectedDateInDialog && (!activeSelectedDate || !isSameDay(activeSelectedDate, tempSelectedDateInDialog))) {
      setActiveSelectedDate(tempSelectedDateInDialog);
      const newSearchParams = new URLSearchParams(searchParams?.toString() || '');
      newSearchParams.set('date', format(tempSelectedDateInDialog, 'yyyy-MM-dd'));
      router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    } else if (!tempSelectedDateInDialog && activeSelectedDate) {
      // If date was cleared in dialog, clear active page date filter
      setActiveSelectedDate(undefined);
      const newSearchParams = new URLSearchParams(searchParams?.toString() || '');
      newSearchParams.delete('date');
      router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
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


  const handleDialogClose = (isOpen: boolean) => {
    if (!isOpen) {
      dialogJustClosedRef.current = true;
      setIsFormOpen(false);
      setCurrentBooking(null);
      
      const currentParams = new URLSearchParams(searchParams?.toString() || '');
      let paramsModified = false;
      if (currentParams.has('bookingId')) { currentParams.delete('bookingId'); paramsModified = true; }
      if (currentParams.has('resourceId')) { currentParams.delete('resourceId'); paramsModified = true; }
      // Keep 'date' param if it was set by user from main calendar or filters
      
      if (paramsModified) {
        router.push(`${pathname}?${currentParams.toString()}`, { scroll: false });
      }
    } else {
      // dialogJustClosedRef.current = false; // This should be reset in the useEffect that opens the dialog
      setIsFormOpen(true);
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

    const finalStartTime = set(new Date(formData.bookingDate), {
      hours: parseInt(formData.startTime.split(':')[0]),
      minutes: parseInt(formData.startTime.split(':')[1]),
      seconds: 0, milliseconds: 0
    });
    const finalEndTime = set(new Date(formData.bookingDate), {
      hours: parseInt(formData.endTime.split(':')[0]),
      minutes: parseInt(formData.endTime.split(':')[1]),
      seconds: 0, milliseconds: 0
    });

    if (isBefore(startOfDay(finalStartTime), startOfToday()) && !formData.id) {
      toast({ title: "Invalid Date", description: "Cannot create new bookings for past dates.", variant: "destructive" }); return;
    }
    if (finalEndTime <= finalStartTime) { toast({ title: "Invalid Time", description: "End time must be after start time.", variant: "destructive" }); return; }

    const bookingDayIndex = getDay(finalStartTime); // 0 for Sunday, 1 for Monday, etc.
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
        if (!period.startDate || !period.endDate) continue;
        const unavailabilityStart = startOfDay(parseISO(period.startDate));
        const unavailabilityEnd = addDays(startOfDay(parseISO(period.endDate)),1); // Make end date inclusive

        if (
          (finalStartTime >= unavailabilityStart && finalStartTime < unavailabilityEnd) || // Starts within
          (finalEndTime > unavailabilityStart && finalEndTime <= unavailabilityEnd) ||   // Ends within
          (finalStartTime <= unavailabilityStart && finalEndTime >= unavailabilityEnd)    // Engulfs
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
    
    if (resource.status !== 'Available' && !formData.id && formData.status !== 'Waitlisted') { 
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
      if (!slot || typeof slot !== 'string' || !slot.includes('-')) continue;
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
        startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(),
        endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(),
        createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        } as Booking;
    });


    const conflictingBooking = existingBookingsForResource.find(existingBooking => {
      if (formData.id && existingBooking.id === formData.id) return false; 
      return (finalStartTime < existingBooking.endTime && finalEndTime > existingBooking.startTime);
    });

    const isNewBooking = !formData.id;
    let finalStatus: Booking['status'] = isNewBooking ? 'Pending' : (formData.status || 'Pending');

    if (conflictingBooking && finalStatus !== 'Waitlisted') {
      if (resource.allowQueueing) {
        finalStatus = 'Waitlisted';
        toast({ title: "Added to Waitlist", description: `This time slot is currently booked. Your request for ${resource.name} has been added to the waitlist.` });
        addAuditLog(currentUser.id, currentUser.name || 'User', 'BOOKING_WAITLISTED', { entityType: 'Booking', entityId: (formData.id || `temp_waitlist_${Date.now()}`), details: `Booking for '${resource.name}' placed on waitlist by user ${currentUser.name}.` });
        addNotification(
          currentUser.id,
          'Added to Waitlist',
          `Your booking request for ${resource.name} on ${format(finalStartTime, 'MMM dd, HH:mm')} has been added to the waitlist.`,
          'booking_waitlisted',
          `/bookings?bookingId=${formData.id || `temp_waitlist_${Date.now()}`}`
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

    const bookingDataToSave: any = {
      resourceId: formData.resourceId!,
      userId: currentUser.id,
      startTime: Timestamp.fromDate(finalStartTime), 
      endTime: Timestamp.fromDate(finalEndTime),     
      status: finalStatus,
      notes: formData.notes || '',
    };

    if(isNewBooking){
        bookingDataToSave.createdAt = serverTimestamp();
    } else if (formData.id && formData.createdAt instanceof Date){ 
        bookingDataToSave.createdAt = Timestamp.fromDate(formData.createdAt);
    }
    
    setIsLoadingBookings(true);
    try {
      if (!isNewBooking && formData.id) {
        const bookingDocRef = doc(db, "bookings", formData.id);
        await updateDoc(bookingDocRef, bookingDataToSave);
        toast({ title: "Success", description: "Booking updated successfully." });
        addAuditLog(currentUser.id, currentUser.name || 'User', 'BOOKING_UPDATED', { entityType: 'Booking', entityId: formData.id, details: `Booking for '${resource.name}' updated by user ${currentUser.name}.` });
      } else {
        const docRef = await addDoc(collection(db, "bookings"), bookingDataToSave);
        const actionType = finalStatus === 'Pending' ? 'BOOKING_CREATED' : 'BOOKING_WAITLISTED';
        const auditDetails = `Booking for '${resource.name}' by ${currentUser.name} (Status: ${finalStatus}). Start: ${format(finalStartTime, 'PPpp')}, End: ${format(finalEndTime, 'PPpp')}.`;
        addAuditLog(currentUser.id, currentUser.name || 'User', actionType, { entityType: 'Booking', entityId: docRef.id, details: auditDetails });
        
        if (finalStatus === 'Pending') {
          toast({ title: "Success", description: "Booking created and submitted for approval." });
          const adminUsersSnapshot = await getDocs(query(collection(db, 'users'), where('role', 'in', ['Admin', 'Lab Manager'])));
          adminUsersSnapshot.forEach(adminDoc => {
            addNotification(
              adminDoc.id,
              'New Booking Request',
              `Booking for ${resource.name} by ${currentUser?.name || 'Unknown User'} on ${format(finalStartTime, 'MMM dd, HH:mm')} needs approval.`,
              'booking_pending_approval',
              `/admin/booking-requests`
            );
          });
        }
      }
      await fetchAllBookingsForUser(); 
    } catch (error:any) {
      console.error("Error saving booking:", error);
      toast({ title: "Save Failed", description: `Could not save your booking. ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingBookings(false);
      handleDialogClose(false);
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
      
      let resourceNameForLog = 'Unknown Resource';
      const resource = allAvailableResources.find(r => r.id === bookingToCancel.resourceId);
      if(resource) resourceNameForLog = resource.name;
      
      addAuditLog(currentUser.id, currentUser.name || 'User', 'BOOKING_CANCELLED', { entityType: 'Booking', entityId: bookingId, details: `Booking for '${resourceNameForLog}' cancelled by user ${currentUser.name}.` });
      
      // Queue processing is now handled by a separate function if needed, or done by admin for promotions
      await fetchAllBookingsForUser(); 
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      toast({ title: "Cancellation Failed", description: `Could not cancel booking. ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingBookings(false);
    }
  };

  const handleOpenDetailsDialog = async (bookingId: string) => {
    const booking = allUserBookings.find(b => b.id === bookingId);
    if (!booking) return;

    let detailedBooking = { ...booking };
    let resourceName = "Unknown Resource";
    let userName = "Unknown User";

    try {
        const resourceDoc = allAvailableResources.find(r => r.id === booking.resourceId);
        if (resourceDoc) resourceName = resourceDoc.name || resourceName;
        
        if (currentUser?.id === booking.userId) {
            userName = currentUser.name || 'You';
        } else {
            // Fetch other user's name - for admin views if they could see this page
            const userDoc = await getDoc(doc(db, 'users', booking.userId));
            if (userDoc.exists()) userName = userDoc.data()?.name || 'Another User';
        }
        
        // @ts-ignore
        detailedBooking.resourceName = resourceName;
        // @ts-ignore
        detailedBooking.userName = userName;

    } catch (error: any) {
        console.error("Error fetching details for dialog:", error);
        toast({title: "Error", description: `Could not load full booking details. ${error.message}`, variant: "destructive"});
    }
    
    setSelectedBookingForDetails(detailedBooking);
    setIsDetailsDialogOpen(true);
  };

  const handleBookingUpdateInDetails = (updatedBooking: Booking) => { // Called from BookingDetailsDialog after usage log
    if (!currentUser) return;
    const updatedBookingWithResourceName = {
      ...updatedBooking,
      resourceName: allAvailableResources.find(r => r.id === updatedBooking.resourceId)?.name || "Unknown Resource",
    };
    setAllUserBookings(prev => prev.map(b => b.id === updatedBooking.id ? updatedBookingWithResourceName : b));
    if (selectedBookingForDetails && selectedBookingForDetails.id === updatedBooking.id) {
      setSelectedBookingForDetails(prev => prev ? {...prev, ...updatedBookingWithResourceName} : null);
    }
  };


  const getBookingStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'Confirmed':
        return <Badge className={cn("bg-green-500 text-white hover:bg-green-600 border-transparent")}><CheckCircle2 className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Pending':
        return <Badge className={cn("bg-yellow-500 text-yellow-950 hover:bg-yellow-600 border-transparent")}><Clock className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Cancelled':
        return <Badge className={cn("bg-gray-400 text-white hover:bg-gray-500 border-transparent")}><X className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Waitlisted':
         return <Badge className={cn("bg-purple-500 text-white hover:bg-purple-600 border-transparent")}><UserIcon className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (!isClient) {
    return <BookingsPageLoader />;
  }

  if (!currentUser && isClient) {
    return (
      <div className="space-y-8">
        <PageHeader title="My Bookings" description="Please log in to manage your bookings." icon={CalendarDays} />
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
  
  const isLoadingAnyData = isLoadingBookings || isLoadingResources || isLoadingAvailabilityRules;


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
                 <DialogContent className="w-full max-w-lg"> 
                  <DialogHeader>
                    <DialogTitle>Filter Your Bookings</DialogTitle>
                    <DialogDescription>
                      Refine your list of bookings using the options below.
                    </DialogDescription>
                  </DialogHeader>
                  <Separator className="my-4" />
                  <ScrollArea className="max-h-[65vh] overflow-y-auto pr-2">
                    <div className="space-y-6 py-4 px-1"> 
                       <div>
                        <FormLabel htmlFor="bookingSearchDialog">Search (Resource/Notes)</FormLabel>
                        <div className="relative mt-1">
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
                      <Separator/>
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
                                    <Button variant="ghost" size="sm" onClick={() => {setTempSelectedDateInDialog(undefined); setCurrentCalendarMonthInDialog(startOfDay(new Date()));}} className="w-full text-xs mt-2"><FilterX className="mr-2 h-4 w-4" />Clear Date Selection</Button>
                                )
                                }
                                classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }}
                            />
                            </div>
                        </div>
                    </div>
                  </ScrollArea>
                  <DialogFooter className="pt-6 border-t mt-4">
                    <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                      <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                    </Button>
                    <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button>
                    <Button onClick={handleApplyDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply Filters</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button onClick={() => handleOpenForm(undefined, null, activeSelectedDate || new Date())}><PlusCircle className="mr-2 h-4 w-4" /> New Booking</Button>
            </div>
          )
        }
      />
      <div className="grid gap-6">
        <Card className="shadow-lg">
          <CardHeader className="border-b">
              <CardTitle>
                {activeSelectedDate ? `Your Bookings for ${formatDateSafe(activeSelectedDate, 'this day', 'PPP')}` : 'All Your Bookings'}
              </CardTitle>
              <CardDescription>
                Displaying {bookingsToDisplay.length} booking(s). {activeFilterCount > 0 && `(${activeFilterCount} filter(s) active)`}
              </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoadingAnyData && allUserBookings.length === 0 ? (
              <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading bookings...</div>
            ) : bookingsToDisplay.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><ResourceIcon className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Resource</TableHead>
                      <TableHead><CalendarIconLucide className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Date & Time</TableHead>
                      <TableHead><Info className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bookingsToDisplay.map((booking) => {
                      return (
                        <TableRow key={booking.id} className={cn(booking.status === 'Cancelled' && 'opacity-60')}>
                          <TableCell
                            className="font-medium cursor-pointer hover:underline hover:text-primary"
                            onClick={() => handleOpenDetailsDialog(booking.id)}
                          >
                            {booking.resourceName}
                          </TableCell>
                          <TableCell>
                            <div>{formatDateSafe(booking.startTime, 'Invalid Date', 'MMM dd, yyyy')}</div>
                            <div className="text-xs text-muted-foreground">
                              {isValidDateFn(booking.startTime) ? format(booking.startTime, 'p') : ''} -
                              {isValidDateFn(booking.endTime) ? format(booking.endTime, 'p') : ''}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getBookingStatusBadge(booking.status)}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
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
                  {activeFilterCount > 0 ? 'Try adjusting your filter criteria or reset all filters.' :
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
          {(activeFilterCount > 0 || activeSelectedDate) && bookingsToDisplay.length > 0 &&
            <CardFooter className="pt-4 justify-center border-t">
              <Button variant="link" className="p-0 h-auto text-xs" onClick={resetAllActivePageFilters}>
                <FilterX className="mr-2 h-4 w-4" /> Reset All Filters & Date
              </Button>
            </CardFooter>
          }
        </Card>
      </div>
      <Dialog
        open={isFormOpen}
        onOpenChange={handleDialogClose}
        key={currentBooking?.id || `new:${currentBooking?.resourceId || 'na'}:${currentBooking?.startTime ? new Date(currentBooking.startTime).toISOString() : (activeSelectedDate || new Date()).toISOString()}`}
        >
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{currentBooking?.id ? 'Edit Booking' : 'Create New Booking'}</DialogTitle>
             <DialogDescription>
              Fill in the details below to {currentBooking?.id ? 'update your' : 'schedule a new'} booking.
              {useMemo(() => {
                  if (isFormOpen && currentBooking?.startTime && isValidDateFn(new Date(currentBooking.startTime))) {
                    return ` For date: ${format(new Date(currentBooking.startTime), "PPP")}`;
                  } else if (isFormOpen && !currentBooking?.id && activeSelectedDate && isValidDateFn(activeSelectedDate)) {
                    return ` For date: ${format(activeSelectedDate, "PPP")}`;
                  }
                  return '';
              }, [isFormOpen, currentBooking?.startTime, activeSelectedDate, currentBooking?.id])}
             </DialogDescription>
          </DialogHeader>
          {(isLoadingResources || isLoadingAvailabilityRules) && isFormOpen ? (
            <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading form data...</div>
          ) : allAvailableResources.length > 0 && currentUser ? (
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
             isFormOpen && (
                <div className="text-center py-6 text-muted-foreground">
                  <Info className="mx-auto h-8 w-8 mb-2" />
                  <p>No resources are currently available for booking, or user data is missing.</p>
                  <p className="text-xs">Please check back later or contact an administrator.</p>
                </div>
             )
          )
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
  id: z.string().optional(),
  resourceId: z.string().min(1, "Please select a resource."),
  bookingDate: z.date({ required_error: "Please select a date." }),
  startTime: z.string().min(1, "Please select a start time."),
  endTime: z.string().min(1, "Please select an end time."),
  status: z.enum(bookingStatusesForForm as [string, ...string[]]).optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters.").optional().or(z.literal('')),
  createdAt: z.date().optional(), 
  userId: z.string().optional(), 
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
  initialData?: Partial<Booking> & { resourceId?: string };
  onSave: (data: BookingFormValues) => void;
  onCancel: () => void;
  currentUserFullName: string;
  currentUserRole: RoleName;
  allAvailableResources: Resource[];
  selectedDateProp?: Date; 
}

const timeSlots = Array.from({ length: (17 - 9) * 2 + 1 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  if (hour > 17 || (hour === 17 && minute === '30')) return null; 
  return `${String(hour).padStart(2, '0')}:${minute}`;
}).filter(Boolean) as string[];


function BookingForm({ initialData, onSave, onCancel, currentUserFullName, currentUserRole, allAvailableResources, selectedDateProp }: BookingFormProps) {
  
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      id: initialData?.id,
      resourceId: initialData?.resourceId || (allAvailableResources.length > 0 ? allAvailableResources[0].id : ''),
      bookingDate: initialData?.startTime && isValidDateFn(initialData.startTime) 
                   ? startOfDay(initialData.startTime) 
                   : (selectedDateProp && isValidDateFn(selectedDateProp) && !initialData?.id 
                      ? startOfDay(selectedDateProp) 
                      : startOfToday()),
      startTime: initialData?.startTime && isValidDateFn(initialData.startTime) ? format(initialData.startTime, 'HH:mm') : '09:00',
      endTime: initialData?.endTime && isValidDateFn(initialData.endTime) 
                 ? format(initialData.endTime, 'HH:mm') 
                 : (initialData?.startTime && isValidDateFn(initialData.startTime) ? format(new Date(initialData.startTime.getTime() + 2*60*60*1000), 'HH:mm') : '11:00'),
      status: initialData?.id ? (initialData.status || 'Pending') : 'Pending',
      notes: initialData?.notes || '',
      createdAt: initialData?.createdAt || new Date(),
      userId: initialData?.userId,
    },
  });
  
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const watchBookingDate = form.watch('bookingDate');
  const watchStartTime = form.watch('startTime');

  useEffect(() => {
    form.reset({
      id: initialData?.id,
      resourceId: initialData?.resourceId || (allAvailableResources.length > 0 ? allAvailableResources[0].id : ''),
      bookingDate: initialData?.startTime && isValidDateFn(initialData.startTime) 
                   ? startOfDay(initialData.startTime) 
                   : (selectedDateProp && isValidDateFn(selectedDateProp) && !initialData?.id 
                      ? startOfDay(selectedDateProp) 
                      : startOfToday()),
      startTime: initialData?.startTime && isValidDateFn(initialData.startTime) ? format(initialData.startTime, 'HH:mm') : '09:00',
      endTime: initialData?.endTime && isValidDateFn(initialData.endTime) 
                 ? format(initialData.endTime, 'HH:mm') 
                 : (initialData?.startTime && isValidDateFn(initialData.startTime) ? format(new Date(initialData.startTime.getTime() + 2*60*60*1000), 'HH:mm') : '11:00'),
      status: initialData?.id ? (initialData.status || 'Pending') : 'Pending',
      notes: initialData?.notes || '',
      createdAt: initialData?.createdAt || new Date(),
      userId: initialData?.userId,
    });
  }, [initialData, selectedDateProp, form, allAvailableResources]);


  useEffect(() => {
    const currentStartTimeStr = form.getValues('startTime');
    const currentBookingDate = form.getValues('bookingDate');

    if (currentBookingDate && isValidDateFn(currentBookingDate) && currentStartTimeStr) {
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
                          disabled={form.formState.isSubmitting}
                        >
                          <CalendarIconLucide className="mr-2 h-4 w-4" />
                          {field.value && isValidDateFn(field.value) ? format(field.value, "PPP") : <span>Pick a date</span>}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                            if(date) {
                              const newDate = startOfDay(date);
                              field.onChange(newDate); // Update RHF state
                              // Update related time fields to the new date but keep time
                              const currentStartTime = form.getValues('startTime');
                              const currentEndTime = form.getValues('endTime');
                              if (currentStartTime) {
                                const [h, m] = currentStartTime.split(':').map(Number);
                                form.setValue('startTime', format(set(newDate, {hours:h, minutes:m}), 'HH:mm'));
                              }
                              if (currentEndTime) {
                                const [h, m] = currentEndTime.split(':').map(Number);
                                form.setValue('endTime', format(set(newDate, {hours:h, minutes:m}), 'HH:mm'));
                              }
                            }
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
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={form.formState.isSubmitting}>
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
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
                    <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
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
                    <Select onValueChange={field.onChange} value={field.value || 'Pending'} disabled={!canEditStatus || form.formState.isSubmitting}>
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
                    <Textarea placeholder="Any specific requirements or purpose of booking..." {...field} value={field.value || ''} disabled={form.formState.isSubmitting}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ScrollArea>
        <DialogFooter className="pt-6 border-t mt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={form.formState.isSubmitting}><X className="mr-2 h-4 w-4" />Cancel</Button>
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : (initialData?.id ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)}
            {form.formState.isSubmitting ? (initialData?.id ? "Saving..." : "Creating...") : (initialData?.id ? "Save Changes" : "Create Booking")}
            </Button>
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
