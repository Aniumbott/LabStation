
'use client';

import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams }from 'next/navigation';
import { CalendarDays, PlusCircle, Edit3, X, Search as SearchIcon, FilterX, Eye, Loader2, ListFilter, Info, Clock, Calendar as CalendarIconLucide, User as UserIcon, Package as ResourceIcon, CheckCircle2, Save, CheckCircle, AlertCircle } from 'lucide-react';
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
import { BookingUsageOutcomes } from '@/types';
import { format, parseISO, isValid as isValidDateFn, startOfDay, isSameDay, set, isBefore, getDay, startOfToday, compareAsc, addDays as dateFnsAddDays, isSameMonth } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn, formatDateSafe } from '@/lib/utils';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { bookingStatusesForFilter, bookingStatusesForForm } from '@/lib/app-constants';
import { addNotification, addAuditLog } from '@/lib/firestore-helpers';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp, getDoc, orderBy, limit, writeBatch } from 'firebase/firestore';


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
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [isClient, setIsClient] = useState(false);

  const [allUserBookings, setAllUserBookings] = useState<Booking[]>([]);
  const [allAvailableResources, setAllAvailableResources] = useState<Resource[]>([]);
  const [fetchedBlackoutDates, setFetchedBlackoutDates] = useState<any[]>([]);
  const [fetchedRecurringRules, setFetchedRecurringRules] = useState<any[]>([]);

  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [isLoadingAvailabilityRules, setIsLoadingAvailabilityRules] = useState(true);


  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Partial<Booking> & { resourceId?: string } | null>(null);
  const [selectedBookingForDetails, setSelectedBookingForDetails] = useState<(Booking & { resourceName?: string, userName?: string }) | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const [activeSelectedDate, setActiveSelectedDate] = useState<Date | undefined>(undefined);
  const [currentCalendarMonth, setCurrentCalendarMonth] = useState<Date>(startOfDay(new Date()));

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>('all');
  const [tempFilterStatus, setTempFilterStatus] = useState<Booking['status'] | 'all'>('all');
  const [tempSelectedDateForDialog, setTempSelectedDateForDialog] = useState<Date | undefined>(undefined);
  const [currentCalendarMonthInDialog, setCurrentCalendarMonthInDialog] = useState<Date>(startOfDay(new Date()));


  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<Booking['status'] | 'all'>('all');

  const dialogJustClosedRef = useRef(false);


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
      const bookingsQueryInstance = query(
        collection(db, 'bookings'),
        where('userId', '==', currentUser.id),
        orderBy('startTime', 'asc')
      );
      const bookingsSnapshot = await getDocs(bookingsQueryInstance);
      const fetchedBookingsPromises = bookingsSnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let resourceName = "Unknown Resource";
        if (data.resourceId) {
          try {
            const resourceDoc = await getDoc(doc(db, 'resources', data.resourceId));
            if (resourceDoc.exists()) resourceName = resourceDoc.data()?.name || resourceName;
          } catch (e) { console.error("Error fetching resource name for booking:", e); }
        }
        return {
          id: docSnap.id,
          resourceId: data.resourceId,
          userId: data.userId,
          startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(),
          endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
          status: data.status as Booking['status'],
          notes: data.notes,
          usageDetails: data.usageDetails ? {
            ...data.usageDetails,
            actualStartTime: data.usageDetails.actualStartTime instanceof Timestamp ? data.usageDetails.actualStartTime.toDate() : undefined,
            actualEndTime: data.usageDetails.actualEndTime instanceof Timestamp ? data.usageDetails.actualEndTime.toDate() : undefined,
          } : undefined,
        } as Booking;
      });
      let bookings = await Promise.all(fetchedBookingsPromises);
      bookings.sort((a, b) => compareAsc(a.startTime, b.startTime));
      setAllUserBookings(bookings);
    } catch (error: any) {
      console.error("Error fetching user bookings:", error);
      toast({ title: "Error Loading Bookings", description: `Failed to load your bookings. ${error.message}`, variant: "destructive" });
      setAllUserBookings([]);
    }
    setIsLoadingBookings(false);
  }, [currentUser?.id, toast]);

  const fetchSupportData = useCallback(async () => {
    setIsLoadingResources(true);
    setIsLoadingAvailabilityRules(true);
    try {
      const resourcesQueryInstance = query(collection(db, 'resources'), orderBy('name', 'asc'));
      const resourcesSnapshot = await getDocs(resourcesQueryInstance);
      const resourcesData = resourcesSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name,
          status: data.status,
          lab: data.lab,
          resourceTypeId: data.resourceTypeId,
          allowQueueing: data.allowQueueing ?? false,
          unavailabilityPeriods: Array.isArray(data.unavailabilityPeriods) ? data.unavailabilityPeriods.map((p: any) => ({ ...p, id: p.id || `unavail-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, startDate: p.startDate, endDate: p.endDate, reason: p.reason })) : [],
        } as Resource;
      });
      setAllAvailableResources(resourcesData);
    } catch (error: any) {
      console.error("Error fetching resources:", error);
      toast({ title: "Error Loading Resources", description: `Failed to load resources for booking form. ${error.message}`, variant: "destructive" });
      setAllAvailableResources([]);
    }
    setIsLoadingResources(false);

    try {
      const blackoutQuery = query(collection(db, "blackoutDates"), orderBy("date", "asc"));
      const blackoutSnapshot = await getDocs(blackoutQuery);
      setFetchedBlackoutDates(blackoutSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as any)));

      const recurringQuery = query(collection(db, "recurringBlackoutRules"), orderBy("name", "asc"));
      const recurringSnapshot = await getDocs(recurringQuery);
      setFetchedRecurringRules(recurringSnapshot.docs.map(r => ({ id: r.id, ...r.data() } as any)));
    } catch (error: any) {
      console.error("Error fetching blackout/recurring rules:", error);
      toast({ title: "Error Loading Closure Rules", description: `Failed to load lab closure rules. ${error.message}`, variant: "destructive" });
      setFetchedBlackoutDates([]);
      setFetchedRecurringRules([]);
    }
     setIsLoadingAvailabilityRules(false);

  }, [toast]);


  useEffect(() => {
    if (isClient && currentUser) {
      fetchAllBookingsForUser();
      fetchSupportData();
    } else if (isClient && !currentUser) {
      setAllUserBookings([]);
      setIsLoadingBookings(false);
      setAllAvailableResources([]);
      setIsLoadingResources(false);
      setFetchedBlackoutDates([]);
      setFetchedRecurringRules([]);
      setIsLoadingAvailabilityRules(false);
    }
  }, [isClient, currentUser, fetchAllBookingsForUser, fetchSupportData]);

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
    } else if (bookingToEdit?.startTime && isValidDateFn(bookingToEdit.startTime)) {
      baseDateForNewBooking = startOfDay(bookingToEdit.startTime);
    } else {
      baseDateForNewBooking = startOfToday();
    }

    if (!bookingToEdit?.id && isBefore(baseDateForNewBooking, startOfToday())) {
      baseDateForNewBooking = startOfToday();
    }

    const defaultStartTime = set(baseDateForNewBooking, { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });

    let bookingData: Partial<Booking> & { resourceId?: string };

    if (bookingToEdit) {
      bookingData = {
        ...bookingToEdit,
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
  }, [currentUser, allAvailableResources, activeSelectedDate, toast]);


 useEffect(() => {
    if (dialogJustClosedRef.current) {
      dialogJustClosedRef.current = false;
      return;
    }

    if (!isClient || !currentUser || isLoadingBookings || isLoadingResources || isLoadingAvailabilityRules || authIsLoading) {
      return;
    }

    const resourceIdParam = searchParams?.get('resourceId');
    const bookingIdParam = searchParams?.get('bookingId');
    const dateParam = searchParams?.get('date');

    let dateFromUrl: Date | undefined = undefined;
    if (dateParam) {
      const parsed = parseISO(dateParam);
      if (isValidDateFn(parsed)) dateFromUrl = startOfDay(parsed);
    }

    const targetDateForNewBooking = dateFromUrl || activeSelectedDate || startOfToday();

    if (bookingIdParam) {
        if (isFormOpen && currentBooking?.id === bookingIdParam) return;
        if (isFormOpen && currentBooking?.id && currentBooking.id !== bookingIdParam) return;
        const bookingToEdit = allUserBookings.find(b => b.id === bookingIdParam && b.userId === currentUser.id);
        if (bookingToEdit) {
          handleOpenForm(bookingToEdit);
        }
    } else if (resourceIdParam) {
        if (isFormOpen && !currentBooking?.id && currentBooking?.resourceId === resourceIdParam && currentBooking?.startTime && isSameDay(currentBooking.startTime, targetDateForNewBooking)) return;
        if (isFormOpen && currentBooking?.id) return;
        handleOpenForm(undefined, resourceIdParam, targetDateForNewBooking);
    }
  }, [searchParams, isClient, currentUser, allUserBookings, handleOpenForm, isLoadingBookings, isLoadingResources, isLoadingAvailabilityRules, authIsLoading, activeSelectedDate, isFormOpen, currentBooking]);


  const bookingsToDisplay = useMemo(() => {
    if (!currentUser || isLoadingBookings || isLoadingResources) return [];

    let filteredBookings = allUserBookings.map(b => {
        const resource = allAvailableResources.find(r => r.id === b.resourceId);
        return {
            ...b,
            resourceName: resource?.name || 'Unknown Resource'
        }
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
      ).sort((a, b) => compareAsc(a.startTime, b.startTime));
    }
  }, [allUserBookings, allAvailableResources, activeSelectedDate, activeSearchTerm, activeFilterResourceId, activeFilterStatus, currentUser, isLoadingBookings, isLoadingResources]);


  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterResourceId(activeFilterResourceId);
      setTempFilterStatus(activeFilterStatus);
      setTempSelectedDateForDialog(activeSelectedDate);
      setCurrentCalendarMonthInDialog(activeSelectedDate || startOfDay(new Date()));
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterResourceId, activeFilterStatus, activeSelectedDate]);


  const handleApplyDialogFilters = useCallback(() => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterStatus(tempFilterStatus);

    if (tempSelectedDateForDialog !== activeSelectedDate) {
      setActiveSelectedDate(tempSelectedDateForDialog ? startOfDay(tempSelectedDateForDialog) : undefined);
      if (tempSelectedDateForDialog) {
        setCurrentCalendarMonth(startOfDay(tempSelectedDateForDialog));
      }
    }

    const newSearchParams = new URLSearchParams(searchParams?.toString() || '');
    if (tempSelectedDateForDialog) {
      newSearchParams.set('date', format(tempSelectedDateForDialog, 'yyyy-MM-dd'));
    } else {
      newSearchParams.delete('date');
    }

    if (!tempSelectedDateForDialog) {
        newSearchParams.delete('bookingId');
        newSearchParams.delete('resourceId');
    }
    router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });

    setIsFilterDialogOpen(false);
  }, [tempSearchTerm, tempFilterResourceId, tempFilterStatus, tempSelectedDateForDialog, activeSelectedDate, router, pathname, searchParams]);


  const resetDialogFiltersOnly = useCallback(() => {
    setTempSearchTerm('');
    setTempFilterResourceId('all');
    setTempFilterStatus('all');
    setTempSelectedDateForDialog(undefined);
    setCurrentCalendarMonthInDialog(startOfDay(new Date()));
  }, []);


  const resetAllActivePageFilters = useCallback(() => {
    setActiveSearchTerm('');
    setActiveFilterResourceId('all');
    setActiveFilterStatus('all');
    setActiveSelectedDate(undefined);
    setCurrentCalendarMonth(startOfDay(new Date()));
    resetDialogFiltersOnly();

    const newSearchParams = new URLSearchParams(searchParams?.toString() || '');
    newSearchParams.delete('date');
    newSearchParams.delete('bookingId');
    newSearchParams.delete('resourceId');
    newSearchParams.delete('q');
    newSearchParams.delete('status');
    router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });

    setIsFilterDialogOpen(false);
  }, [resetDialogFiltersOnly, router, pathname, searchParams]);


  const activeFilterCount = useMemo(() => [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
    activeFilterStatus !== 'all',
    activeSelectedDate !== undefined,
  ].filter(Boolean).length, [activeSearchTerm, activeFilterResourceId, activeFilterStatus, activeSelectedDate]);


  const handleDialogClose = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      dialogJustClosedRef.current = true;
      setIsFormOpen(false);
      setCurrentBooking(null);

      const currentParams = new URLSearchParams(searchParams?.toString() || '');
      let paramsModified = false;
      if (currentParams.has('bookingId')) { currentParams.delete('bookingId'); paramsModified = true; }
      if (currentParams.has('resourceId')) { currentParams.delete('resourceId'); paramsModified = true; }

      if (paramsModified) {
        router.push(`${pathname}?${currentParams.toString()}`, { scroll: false });
      }
    } else {
      dialogJustClosedRef.current = false;
      setIsFormOpen(true);
    }
  }, [searchParams, router, pathname]);


  const handleSaveBooking = useCallback(async (formData: BookingFormValues) => {
    if (!currentUser || !currentUser.id || !currentUser.name) {
      toast({ title: "Error", description: "You must be logged in to save a booking.", variant: "destructive" });
      return;
    }
    if (!formData.resourceId) {
      toast({ title: "Error", description: "Please select a resource.", variant: "destructive" }); return;
    }

    const selectedResource = allAvailableResources.find(r => r.id === formData.resourceId);
    if (!selectedResource) { toast({ title: "Error", description: "Selected resource not found or not available.", variant: "destructive" }); return; }

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

    if (isBefore(startOfDay(finalStartTime), startOfToday()) && !formData.id) {
      toast({ title: "Invalid Date", description: "Cannot create new bookings for past dates.", variant: "destructive" }); return;
    }
    if (finalEndTime <= finalStartTime) { toast({ title: "Invalid Time", description: "End time must be after start time.", variant: "destructive" }); return; }

    const bookingDayIndex = getDay(finalStartTime);
    const bookingDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bookingDayIndex];

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

    if (selectedResource.unavailabilityPeriods && selectedResource.unavailabilityPeriods.length > 0) {
      for (const period of selectedResource.unavailabilityPeriods) {
        if (!period.startDate || !period.endDate) continue;
        try {
          const unavailabilityStart = startOfDay(parseISO(period.startDate));
          const unavailabilityEnd = dateFnsAddDays(startOfDay(parseISO(period.endDate)), 1);

          if (
            (finalStartTime >= unavailabilityStart && finalStartTime < unavailabilityEnd) ||
            (finalEndTime > unavailabilityStart && finalEndTime <= unavailabilityEnd) ||
            (finalStartTime <= unavailabilityStart && finalEndTime >= unavailabilityEnd)
          ) {
            toast({
              title: "Resource Unavailable",
              description: `${selectedResource.name} is scheduled to be unavailable from ${formatDateSafe(unavailabilityStart, '', 'PPP')} to ${formatDateSafe(parseISO(period.endDate), '', 'PPP')}${period.reason ? ` due to: ${period.reason}` : '.'}. Please select a different date or time.`,
              variant: "destructive",
              duration: 10000
            });
            return;
          }
        } catch (e) {
          console.warn("Error parsing resource unavailability period dates for booking check:", e, period);
        }
      }
    }

    if (selectedResource.status !== 'Available' && !formData.id && formData.status !== 'Waitlisted') {
      toast({ title: "Resource Not Available", description: `${selectedResource.name} is currently ${selectedResource.status.toLowerCase()} and cannot be booked.`, variant: "destructive", duration: 7000 });
      return;
    }
    
    let conflictingBookingFound: Booking | undefined = undefined;
    try {
      const bookingsCollectionRef = collection(db, 'bookings');
      const q = query(
        bookingsCollectionRef,
        where('resourceId', '==', formData.resourceId!),
        where('status', 'in', ['Confirmed', 'Pending'])
      );
      const existingBookingsSnapshot = await getDocs(q);
      const existingBookingsForResource: Booking[] = existingBookingsSnapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(),
          endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(),
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
        } as Booking;
      });

      conflictingBookingFound = existingBookingsForResource.find(existingBooking => {
        if (formData.id && existingBooking.id === formData.id) return false;
        return (finalStartTime < existingBooking.endTime && finalEndTime > existingBooking.startTime);
      });
    } catch (e) {
      console.error("Error fetching existing bookings for conflict check:", e);
      toast({ title: "Error", description: "Could not verify existing bookings. Please try again.", variant: "destructive" });
      return;
    }

    const isNewBooking = !formData.id;
    let finalStatus: Booking['status'] = isNewBooking ? 'Pending' : (formData.status || 'Pending');

    if (conflictingBookingFound && finalStatus !== 'Waitlisted') {
      if (selectedResource.allowQueueing) {
        finalStatus = 'Waitlisted';
        toast({ title: "Added to Waitlist", description: `This time slot is currently booked. Your request for ${selectedResource.name} has been added to the waitlist.` });
        if (currentUser?.id && currentUser?.name) {
          addAuditLog(currentUser.id, currentUser.name, 'BOOKING_WAITLISTED', {
            entityType: 'Booking',
            details: `Booking for '${selectedResource.name}' by ${currentUser.name} placed on waitlist. Start: ${format(finalStartTime, 'PPpp')}, End: ${format(finalEndTime, 'PPpp')}.`
          });
        }
      } else {
        let conflictingUserName = 'another user';
        if (conflictingBookingFound.userId) {
            try {
                const userDocSnap = await getDoc(doc(db, "users", conflictingBookingFound.userId));
                if (userDocSnap.exists()) conflictingUserName = userDocSnap.data()?.name || 'another user';
            } catch (userFetchError) {
                console.error("Error fetching conflicting user's name:", userFetchError);
            }
        }
        toast({ title: "Booking Conflict", description: `${selectedResource.name} is already booked by ${conflictingUserName} from ${format(conflictingBookingFound.startTime, 'p')} to ${format(conflictingBookingFound.endTime, 'p')} on ${formatDateSafe(conflictingBookingFound.startTime, 'this day', 'PPP')}. This resource does not allow queueing.`, variant: "destructive", duration: 10000 });
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

    if (isNewBooking) {
      bookingDataToSave.createdAt = formData.createdAt ? Timestamp.fromDate(formData.createdAt) : serverTimestamp();
    } else if (formData.id && formData.createdAt instanceof Date) {
      bookingDataToSave.createdAt = Timestamp.fromDate(formData.createdAt);
      if (currentUser?.id && currentUser?.name) {
        addAuditLog(currentUser.id, currentUser.name, 'BOOKING_UPDATED', { entityType: 'Booking', entityId: formData.id, details: `Booking for '${selectedResource.name}' updated by user ${currentUser.name}. Status: ${finalStatus}.` });
      }
    }

    setIsLoadingBookings(true);
    try {
      if (!isNewBooking && formData.id) {
        const bookingDocRef = doc(db, "bookings", formData.id);
        await updateDoc(bookingDocRef, bookingDataToSave);
        toast({ title: "Success", description: "Booking updated successfully." });
      } else {
        const docRef = await addDoc(collection(db, "bookings"), bookingDataToSave);
        if (finalStatus === 'Pending' && currentUser?.id && currentUser?.name && selectedResource?.name) {
          toast({ title: "Success", description: "Booking created and submitted for approval." });
          addAuditLog(currentUser.id, currentUser.name, 'BOOKING_CREATED', {
            entityType: 'Booking',
            entityId: docRef.id,
            details: `Booking for '${selectedResource.name}' by ${currentUser.name}. Status: ${finalStatus}. Start: ${format(finalStartTime, 'PPpp')}, End: ${format(finalEndTime, 'PPpp')}.`
          });
          try {
            const adminUsersQuery = query(collection(db, 'users'), where('role', 'in', ['Admin', 'Lab Manager']));
            const adminSnapshot = await getDocs(adminUsersQuery);
            const notificationPromises = adminSnapshot.docs.map(adminDoc => {
              if (adminDoc.id !== currentUser.id) { 
                return addNotification(
                  adminDoc.id,
                  'New Booking Request',
                  `Booking for ${selectedResource!.name} by ${currentUser!.name} on ${format(finalStartTime, 'MMM dd, HH:mm')} needs approval.`,
                  'booking_pending_approval',
                  `/admin/booking-requests?bookingId=${docRef.id}`
                );
              }
              return Promise.resolve();
            });
            await Promise.all(notificationPromises);
            console.log("Admin notifications sent for new pending booking.");
          } catch (adminNotificationError) {
            console.error("Error sending notifications to admins:", adminNotificationError);
          }
        } else if (finalStatus === 'Waitlisted' && currentUser?.id && selectedResource?.name) {
          addNotification(
            currentUser.id,
            'Added to Waitlist',
            `Your booking request for ${selectedResource.name} on ${format(finalStartTime, 'MMM dd, HH:mm')} has been added to the waitlist.`,
            'booking_waitlisted',
            `/bookings?bookingId=${docRef.id}`
          );
        }
      }
      await fetchAllBookingsForUser();
    } catch (error: any) {
      console.error("Error saving booking:", error);
      toast({ title: "Save Failed", description: `Could not save your booking. ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingBookings(false);
      handleDialogClose(false);
    }
  }, [currentUser, allAvailableResources, fetchedBlackoutDates, fetchedRecurringRules, fetchAllBookingsForUser, toast, handleDialogClose]);

  const handleCancelBookingLocal = useCallback(async (bookingId: string) => {
    if (!currentUser || !currentUser.id || !currentUser.name) return;

    const bookingToCancel = allUserBookings.find(b => b.id === bookingId);
    if (!bookingToCancel) {
      toast({ title: "Error", description: "Booking not found.", variant: "destructive" });
      return;
    }
    const resourceForCancelledBooking = allAvailableResources.find(r => r.id === bookingToCancel.resourceId);

    setIsLoadingBookings(true);
    try {
      const bookingDocRef = doc(db, "bookings", bookingId);
      await updateDoc(bookingDocRef, { status: 'Cancelled' });

      toast({ title: "Info", description: "Booking cancelled." });

      let resourceNameForLog = resourceForCancelledBooking?.name || 'Unknown Resource';
      addAuditLog(currentUser.id, currentUser.name, 'BOOKING_CANCELLED', { entityType: 'Booking', entityId: bookingId, details: `Booking for '${resourceNameForLog}' cancelled by user ${currentUser.name}.` });
      
      await fetchAllBookingsForUser();
    } catch (error: any) {
      console.error("Error cancelling booking:", error);
      toast({ title: "Cancellation Failed", description: `Could not cancel booking. ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingBookings(false);
    }
  }, [currentUser, allUserBookings, allAvailableResources, fetchAllBookingsForUser, toast]);


  const handleOpenDetailsDialog = useCallback(async (bookingId: string) => {
    const bookingFromState = allUserBookings.find(b => b.id === bookingId);
    if (!bookingFromState) {
        toast({ title: "Error", description: "Booking details not found locally.", variant: "destructive" });
        return;
    }

    let detailedBooking: Booking & { resourceName?: string, userName?: string } = { ...bookingFromState };

    setIsLoadingBookings(true);
    try {
      if (bookingFromState.resourceId) {
        const resourceDocSnap = await getDoc(doc(db, 'resources', bookingFromState.resourceId));
        if (resourceDocSnap.exists()) detailedBooking.resourceName = resourceDocSnap.data()?.name || "Unknown Resource";
        else detailedBooking.resourceName = "Resource Not Found";
      }

      if (bookingFromState.userId) {
        const userDocSnap = await getDoc(doc(db, 'users', bookingFromState.userId));
        if (userDocSnap.exists()) detailedBooking.userName = userDocSnap.data()?.name || "Unknown User";
         else detailedBooking.userName = "User Not Found";
      }
    } catch (error: any) {
      console.error("Error fetching details for dialog:", error);
      toast({ title: "Error", description: `Could not load full booking details. ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingBookings(false);
    }

    setSelectedBookingForDetails(detailedBooking);
    setIsDetailsDialogOpen(true);
  }, [allUserBookings, toast]);

  const handleBookingUpdateInDetails = useCallback((updatedBooking: Booking) => {
    if (!currentUser) return;
    setAllUserBookings(prev => prev.map(b => b.id === updatedBooking.id ? { ...b, ...updatedBooking } : b));
    if (selectedBookingForDetails && selectedBookingForDetails.id === updatedBooking.id) {
      setSelectedBookingForDetails(prev => prev ? { ...prev, ...updatedBooking, resourceName: prev.resourceName, userName: prev.userName } : null);
    }
  }, [currentUser, selectedBookingForDetails]);


  const getBookingStatusBadgeElement = (status: Booking['status']) => {
    let badgeText = status;
    
    switch (status) {
      case 'Confirmed':
        return <Badge className={cn("bg-green-500 text-white hover:bg-green-600 border-transparent")}><CheckCircle className="mr-1 h-3.5 w-3.5" />{badgeText}</Badge>;
      case 'Pending':
        return <Badge className={cn("bg-yellow-500 text-yellow-950 hover:bg-yellow-600 border-transparent")}><Clock className="mr-1 h-3.5 w-3.5" />{badgeText}</Badge>;
      case 'Cancelled':
        return <Badge className={cn("bg-gray-400 text-white hover:bg-gray-500 border-transparent")}><X className="mr-1 h-3.5 w-3.5" />{badgeText}</Badge>;
      case 'Waitlisted':
        return <Badge className={cn("bg-purple-500 text-white hover:bg-purple-600 border-transparent")}><UserIcon className="mr-1 h-3.5 w-3.5" />{badgeText}</Badge>;
      default:
        return <Badge variant="outline">{badgeText}</Badge>;
    }
  };

  const dialogHeaderDateString = useMemo(() => {
    if (isFormOpen && currentBooking?.startTime && isValidDateFn(new Date(currentBooking.startTime))) {
      return format(new Date(currentBooking.startTime), "PPP");
    } else if (isFormOpen && !currentBooking?.id && activeSelectedDate && isValidDateFn(activeSelectedDate)) {
       return format(activeSelectedDate, "PPP");
    }
    return null;
  }, [isFormOpen, currentBooking?.startTime, currentBooking?.id, activeSelectedDate]);


  if (!isClient) {
    return <BookingsPageLoader />;
  }
  
  if (!currentUser && isClient && !authIsLoading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Manage My Bookings" description="Please log in to manage your bookings." icon={CalendarDays} />
        <Card className="text-center py-10 text-muted-foreground border-0 shadow-none">
          <CardContent>
            <Info className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">Login Required</p>
            <p className="text-sm mb-4">You need to be logged in to view and manage your bookings.</p>
            <Button onClick={() => router.push('/login')} className="mt-4">Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLoadingAnyData = isLoadingBookings || isLoadingResources || isLoadingAvailabilityRules || authIsLoading;
  const formKey = currentBooking?.id || `new:${currentBooking?.resourceId || 'empty'}:${currentBooking?.startTime instanceof Date ? currentBooking.startTime.toISOString() : (activeSelectedDate || new Date()).toISOString()}`;


  return (
    <div className="space-y-8">
      <PageHeader
        title="Manage My Bookings"
        description="View, search, filter, and manage your lab resource bookings."
        icon={CalendarDays}
        actions={
          currentUser && (
            <div className="flex items-center gap-2 flex-wrap">
              <Button onClick={() => handleOpenForm(undefined, null, activeSelectedDate || startOfToday())}><PlusCircle className="mr-2 h-4 w-4" /> New Booking</Button>
            </div>
          )
        }
      />
       <Card className="shadow-lg">
            <CardHeader className="border-b flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
                <div>
                    <CardTitle>
                    {activeSelectedDate ? `Your Bookings for ${formatDateSafe(activeSelectedDate, 'this day', 'PPP')}` : 'All Your Upcoming Bookings'}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {isLoadingAnyData && bookingsToDisplay.length === 0 ? 'Loading...' : `Displaying ${bookingsToDisplay.length} booking(s).`}
                      {activeFilterCount > 0 && ` (${activeFilterCount} filter(s) active)`}
                    </CardDescription>
                </div>
                 <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                    <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
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
                            <DialogDescription>Refine your list of bookings.</DialogDescription>
                        </DialogHeader>
                        <Separator className="my-4" />
                        <div className="space-y-6 py-4 px-1">
                            <div>
                                <Label htmlFor="bookingCalendarDialogDate">Filter by Specific Date (Optional)</Label>
                                <div className="flex justify-center items-center rounded-md border p-2 mt-1">
                                    <Calendar
                                        mode="single"
                                        selected={tempSelectedDateForDialog}
                                        onSelect={(date) => setTempSelectedDateForDialog(date ? startOfDay(date) : undefined)}
                                        month={currentCalendarMonthInDialog}
                                        onMonthChange={setCurrentCalendarMonthInDialog}
                                        className="rounded-md"
                                        classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }}
                                        footer={tempSelectedDateForDialog &&
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => { setTempSelectedDateForDialog(undefined); setCurrentCalendarMonthInDialog(startOfDay(new Date())); }}
                                                className="w-full mt-2 text-xs"
                                            >
                                                <FilterX className="mr-2 h-4 w-4" /> Clear Date Selection
                                            </Button>
                                        }
                                    />
                                </div>
                            </div>
                            <Separator />
                            <div>
                                <Label htmlFor="bookingSearchDialog">Search (Resource/Notes)</Label>
                                <div className="relative mt-1">
                                    <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input
                                    id="bookingSearchDialog"
                                    type="search"
                                    placeholder="Keyword..."
                                    className="h-9 pl-8"
                                    value={tempSearchTerm}
                                    onChange={(e) => setTempSearchTerm(e.target.value)}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="bookingResourceDialog">Resource</Label>
                                    <Select value={tempFilterResourceId} onValueChange={setTempFilterResourceId} disabled={isLoadingResources}>
                                    <SelectTrigger id="bookingResourceDialog" className="h-9 mt-1"><SelectValue placeholder={isLoadingResources ? "Loading..." : "Filter by Resource"} /></SelectTrigger>
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
                                    <Label htmlFor="bookingStatusDialog">Status</Label>
                                    <Select value={tempFilterStatus} onValueChange={(v) => setTempFilterStatus(v as Booking['status'] | 'all')}>
                                    <SelectTrigger id="bookingStatusDialog" className="h-9 mt-1"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                                    <SelectContent>
                                        {bookingStatusesForFilter.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
                                    </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <DialogFooter className="pt-6 border-t mt-4">
                            <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                                <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                            </Button>
                            <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button>
                            <Button onClick={handleApplyDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply Filters</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardHeader>
            <CardContent className="p-0">
            {isLoadingAnyData && bookingsToDisplay.length === 0 && allUserBookings.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />Loading bookings...</div>
            ) : bookingsToDisplay.length > 0 ? (
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead><ResourceIcon className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Resource</TableHead>
                        {!activeSelectedDate && <TableHead><CalendarIconLucide className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Date</TableHead>}
                        <TableHead><Clock className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Time</TableHead>
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
                            {booking.resourceName || 'Loading...'}
                            </TableCell>
                            {!activeSelectedDate && <TableCell>{formatDateSafe(booking.startTime, 'Invalid Date', 'MMM dd, yyyy')}</TableCell>}
                            <TableCell>
                            {isValidDateFn(booking.startTime) ? format(booking.startTime, 'p') : ''} -
                            {isValidDateFn(booking.endTime) ? format(booking.endTime, 'p') : ''}
                            </TableCell>
                            <TableCell>
                            {getBookingStatusBadgeElement(booking.status)}
                            </TableCell>
                            <TableCell className="text-right space-x-1">
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenDetailsDialog(booking.id)}>
                                    <Eye className="h-4 w-4" /> <span className="sr-only">View Details</span>
                                </Button>
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
                        (allUserBookings.length === 0 && !isLoadingBookings ? 'You have no bookings.' :
                            (activeSelectedDate ? `No bookings scheduled for ${formatDateSafe(activeSelectedDate, 'this day', 'PPP')}.` : 'No upcoming bookings found.')
                        )
                    }
                </p>
                <p className="text-sm mb-4">
                    {activeFilterCount > 0 ? 'Try adjusting your filter criteria or reset all filters.' :
                        (allUserBookings.length === 0 && !isLoadingBookings ? 'Create your first booking to get started.' :
                            (activeSelectedDate ? 'Try a different date or create a new booking for this day.' : 'Create a new booking or check other dates.')
                        )
                    }
                </p>
                {activeFilterCount > 0 ? (
                    <Button variant="outline" onClick={resetAllActivePageFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                    </Button>
                ) : (
                    allUserBookings.length === 0 && !isLoadingBookings && currentUser && (
                    <Button onClick={() => handleOpenForm(undefined, null, startOfToday())} className="mt-4">
                        <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Booking
                    </Button>
                    )
                )}
                 {activeSelectedDate && bookingsToDisplay.length === 0 && (!activeFilterCount || (activeFilterCount ===1 && activeSelectedDate)) && currentUser && (
                     <Button onClick={() => handleOpenForm(undefined, null, activeSelectedDate)} className="mt-4">
                         <PlusCircle className="mr-2 h-4 w-4" /> Create Booking for {formatDateSafe(activeSelectedDate, '', 'MMM dd')}
                     </Button>
                 )}
                </CardContent>
            )}
            </CardContent>
             {activeFilterCount > 0 && bookingsToDisplay.length > 0 &&
                <CardFooter className="pt-4 justify-center border-t">
                  {!activeSelectedDate ? (
                     <Button variant="link" className="p-0 h-auto text-xs" onClick={resetAllActivePageFilters}>
                        <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                    </Button>
                  ) : (
                     <Button variant="link" className="p-0 h-auto text-xs" onClick={() => {
                        setActiveSelectedDate(undefined);
                        setCurrentCalendarMonth(startOfDay(new Date()));
                        const newSearchParams = new URLSearchParams(searchParams?.toString() || '');
                        newSearchParams.delete('date');
                        router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
                     }}>
                        <FilterX className="mr-2 h-4 w-4" /> View All Upcoming Bookings
                    </Button>
                  )}
                </CardFooter>
            }
        </Card>
      <Dialog
        open={isFormOpen}
        onOpenChange={handleDialogClose}
        key={formKey}
        >
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{currentBooking?.id ? 'Edit Booking' : 'Create New Booking'}</DialogTitle>
             <DialogDescription>
              Fill in the details below to {currentBooking?.id ? 'update your' : 'schedule a new'} booking.
              {dialogHeaderDateString && ` For date: ${dialogHeaderDateString}`}
             </DialogDescription>
          </DialogHeader>
          {(isLoadingResources || isLoadingAvailabilityRules) && isFormOpen ? (
            <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading form data...</div>
          ) : allAvailableResources.length > 0 && currentUser && currentUser.name && currentUser.role ? (
            <BookingForm
              initialData={currentBooking}
              onSave={handleSaveBooking}
              onCancel={() => handleDialogClose(false)}
              currentUserFullName={currentUser.name}
              currentUserRole={currentUser.role}
              allAvailableResources={allAvailableResources}
              selectedDateProp={currentBooking?.startTime ? startOfDay(currentBooking.startTime) : (activeSelectedDate || startOfToday())}
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
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid start time format. Use HH:mm."),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid end time format. Use HH:mm."),
  status: z.enum(bookingStatusesForForm as [Booking['status'], ...Array<Booking['status'] >]).optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters.").optional().or(z.literal('')),
  createdAt: z.date().optional(),
  userId: z.string().optional(),
}).refine(data => {
  if (!data.bookingDate || !data.startTime || !data.endTime) return true;
  try {
    const startDateTime = set(data.bookingDate, {
      hours: parseInt(data.startTime.split(':')[0]),
      minutes: parseInt(data.startTime.split(':')[1])
    });
    const endDateTime = set(data.bookingDate, {
      hours: parseInt(data.endTime.split(':')[0]),
      minutes: parseInt(data.endTime.split(':')[1])
    });
    return endDateTime > startDateTime;
  } catch (e) {
    return true;
  }
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

const timeSlots = Array.from({ length: (17 - 8) * 2 + 1 }, (_, i) => {
  const hour = 8 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  if (hour > 17 || (hour === 17 && minute !== '00')) return null;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}).filter(Boolean) as string[];


function BookingForm({ initialData, onSave, onCancel, currentUserFullName, currentUserRole, allAvailableResources, selectedDateProp }: BookingFormProps) {

  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      id: undefined,
      resourceId: '',
      bookingDate: startOfToday(),
      startTime: '09:00',
      endTime: '11:00',
      status: 'Pending',
      notes: '',
      createdAt: new Date(),
      userId: undefined,
    },
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const watchBookingDate = form.watch('bookingDate');
  const watchStartTime = form.watch('startTime');

  useEffect(() => {
    let defaultBookingDate = selectedDateProp ? startOfDay(selectedDateProp) : startOfToday();
    let defaultStartTimeStr = '09:00';
    let defaultEndTimeStr = '11:00';
    let defaultResourceId = allAvailableResources.length > 0 ? allAvailableResources[0].id : '';
    let defaultStatus: Booking['status'] = 'Pending';
    let defaultNotes = '';
    let defaultCreatedAt = new Date();
    let defaultUserId = initialData?.userId;

    if (initialData) {
      defaultBookingDate = initialData.startTime ? startOfDay(initialData.startTime) : defaultBookingDate;
      defaultStartTimeStr = initialData.startTime ? format(initialData.startTime, 'HH:mm') : defaultStartTimeStr;
      defaultEndTimeStr = initialData.endTime ? format(initialData.endTime, 'HH:mm') : defaultEndTimeStr;
      defaultResourceId = initialData.resourceId || defaultResourceId;
      defaultStatus = initialData.status || defaultStatus;
      defaultNotes = initialData.notes || defaultNotes;
      defaultCreatedAt = initialData.createdAt || defaultCreatedAt;
    } else if(selectedDateProp) {
        defaultBookingDate = startOfDay(selectedDateProp);
    }

    if (defaultStartTimeStr && defaultBookingDate) {
        try {
            const startH = parseInt(defaultStartTimeStr.split(':')[0]);
            const startM = parseInt(defaultStartTimeStr.split(':')[1]);
            if (!isNaN(startH) && !isNaN(startM)) {
              const tempStartDate = set(defaultBookingDate, { hours: startH, minutes: startM });
              let tempEndDate = new Date(tempStartDate.getTime() + 2 * 60 * 60 * 1000);

              const maxEndTimeForDay = set(defaultBookingDate, { hours: 17, minutes: 0 });
              if (tempEndDate > maxEndTimeForDay) {
                tempEndDate = maxEndTimeForDay;
              }
               if (tempEndDate <= tempStartDate && defaultStartTimeStr !== "17:00") {
                 const newStartTimePlus30Min = new Date(tempStartDate.getTime() + 30 * 60 * 1000);
                 if (newStartTimePlus30Min <= maxEndTimeForDay) tempEndDate = newStartTimePlus30Min;
                 else tempEndDate = maxEndTimeForDay;
               } else if (defaultStartTimeStr === "17:00") {
                 tempEndDate = tempStartDate;
               }
              defaultEndTimeStr = format(tempEndDate, 'HH:mm');
            }
        } catch(e) { /* ignore */ }
    }

    form.reset({
      id: initialData?.id,
      resourceId: defaultResourceId,
      bookingDate: defaultBookingDate,
      startTime: defaultStartTimeStr,
      endTime: defaultEndTimeStr,
      status: defaultStatus,
      notes: defaultNotes,
      createdAt: defaultCreatedAt,
      userId: defaultUserId,
    });
  }, [initialData, selectedDateProp, allAvailableResources, form]);


  useEffect(() => {
    const currentStartTimeStr = form.getValues('startTime');
    const currentBookingDate = form.getValues('bookingDate');

    if (currentBookingDate && isValidDateFn(currentBookingDate) && currentStartTimeStr && timeSlots.includes(currentStartTimeStr)) {
      const currentStartTimeParts = currentStartTimeStr.split(':');
      const currentStartTimeHours = parseInt(currentStartTimeParts[0]);
      const currentStartTimeMinutes = parseInt(currentStartTimeParts[1]);

      if (!isNaN(currentStartTimeHours) && !isNaN(currentStartTimeMinutes)) {
        const newStartTimeDt = set(new Date(currentBookingDate), { hours: currentStartTimeHours, minutes: currentStartTimeMinutes });
        let newEndTimeDt;
        const currentEndTimeStr = form.getValues('endTime');
        const currentEndTimeParts = currentEndTimeStr.split(':');
        const currentEndTimeHours = parseInt(currentEndTimeParts[0]);
        const currentEndTimeMinutes = parseInt(currentEndTimeParts[1]);
        
        if (!isNaN(currentEndTimeHours) && !isNaN(currentEndTimeMinutes)) {
            newEndTimeDt = set(new Date(currentBookingDate), { hours: currentEndTimeHours, minutes: currentEndTimeMinutes });
            if (newEndTimeDt <= newStartTimeDt) {
                newEndTimeDt = new Date(newStartTimeDt.getTime() + 2 * 60 * 60 * 1000);
            }
        } else {
            newEndTimeDt = new Date(newStartTimeDt.getTime() + 2 * 60 * 60 * 1000);
        }

        const maxEndTimeForDay = set(new Date(currentBookingDate), { hours: 17, minutes: 0 });
        if (newEndTimeDt > maxEndTimeForDay) {
          newEndTimeDt = maxEndTimeForDay;
        }

        if (newEndTimeDt <= newStartTimeDt && currentStartTimeStr !== "17:00") {
          const newStartTimePlus30Min = new Date(newStartTimeDt.getTime() + 30 * 60 * 1000);
          if (newStartTimePlus30Min <= maxEndTimeForDay) newEndTimeDt = newStartTimePlus30Min;
          else newEndTimeDt = maxEndTimeForDay;
        } else if (currentStartTimeStr === "17:00") {
          newEndTimeDt = newStartTimeDt;
        }

        const formattedNewEndTime = format(newEndTimeDt, 'HH:mm');
        if (form.getValues('endTime') !== formattedNewEndTime && (timeSlots.includes(formattedNewEndTime) || formattedNewEndTime === "17:00")) {
          form.setValue('endTime', formattedNewEndTime, { shouldValidate: true });
        } else if (form.getValues('endTime') !== formattedNewEndTime && newStartTimeDt >= newEndTimeDt && formattedNewEndTime === "17:00") {
           form.setValue('endTime', "17:00", { shouldValidate: true });
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
                            id="bookingFormDialogDate"
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
                                  field.onChange(newDate);
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
                  <Select onValueChange={field.onChange} value={field.value || ''} disabled={form.formState.isSubmitting || allAvailableResources.length === 0}>
                    <FormControl>
                      <SelectTrigger id="bookingFormDialogResource"><SelectValue placeholder={allAvailableResources.length > 0 ? "Select a resource" : "No resources available"} /></SelectTrigger>
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
                    <FormLabel htmlFor="bookingFormDialogStartTime">Start Time</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
                      <FormControl>
                        <SelectTrigger id="bookingFormDialogStartTime"><SelectValue placeholder="Select start time" /></SelectTrigger>
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
                    <FormLabel htmlFor="bookingFormDialogEndTime">End Time</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
                      <FormControl>
                        <SelectTrigger id="bookingFormDialogEndTime"><SelectValue placeholder="Select end time" /></SelectTrigger>
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
                    <FormLabel htmlFor="bookingFormDialogStatus">Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value || 'Pending'} disabled={!canEditStatus || form.formState.isSubmitting}>
                      <FormControl>
                        <SelectTrigger id="bookingFormDialogStatus"><SelectValue placeholder="Select status" /></SelectTrigger>
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
                  <FormLabel htmlFor="bookingFormDialogNotes">Notes (Optional)</FormLabel>
                  <FormControl>
                    <Textarea id="bookingFormDialogNotes" placeholder="Any specific requirements or purpose of booking..." {...field} value={field.value || ''} disabled={form.formState.isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </ScrollArea>
        <DialogFooter className="pt-6 border-t mt-4">
          <Button type="button" variant="outline" onClick={onCancel} disabled={form.formState.isSubmitting}><X className="mr-2 h-4 w-4" /> Cancel</Button>
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

