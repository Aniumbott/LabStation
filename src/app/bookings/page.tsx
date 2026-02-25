
'use client';

import React, { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter, usePathname, useSearchParams }from 'next/navigation';
import { CalendarDays, PlusCircle, Edit3, Search as SearchIcon, FilterX, Eye, Loader2, Filter as FilterIcon, Info, Clock, Calendar as CalendarIconLucide, User as UserIcon, Package as ResourceIcon, CheckCircle2, Save, CheckCircle, AlertCircle, Users, ToggleLeft, ToggleRight, X } from 'lucide-react';
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
import type { Booking, Resource, RoleName, BookingUsageDetails, User, LabMembership, BlackoutDate, RecurringBlackoutRule } from '@/types';
import { format, parseISO, isValid as isValidDateFn, startOfDay, isSameDay, set, isBefore, getDay, startOfToday, compareAsc, addDays as dateFnsAddDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn, formatDateSafe } from '@/lib/utils';
import { BookingDetailsDialog } from '@/components/bookings/booking-details-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { bookingStatusesForFilter, bookingStatusesForForm } from '@/lib/app-constants';
import { addNotification } from '@/lib/db-helpers';
import { createBookingTransactional_SA, updateBooking_SA as updateBookingSA, cancelBooking_SA } from '@/lib/actions/booking.actions';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Form, FormControl, FormField, FormItem, FormMessage, FormLabel } from '@/components/ui/form';
import { useAuth } from '@/components/auth-context';
import { getBookings_SA, getResources_SA, getUsers_SA, getLabMemberships_SA, getLabs_SA, getBlackoutDates_SA, getRecurringBlackoutRules_SA } from '@/lib/actions/data.actions';
import { Switch } from '@/components/ui/switch';


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
  const { currentUser, isLoading: authIsLoading } = useAuth();

  const [isClient, setIsClient] = useState(false);

  const [allBookingsDataSource, setAllBookingsDataSource] = useState<(Booking & { resourceName?: string, userName?: string })[]>([]);
  const [allAvailableResources, setAllAvailableResources] = useState<Resource[]>([]);
  const [userLabMemberships, setUserLabMemberships] = useState<LabMembership[]>([]);
  const [allUsersForFilter, setAllUsersForFilter] = useState<User[]>([]);
  const [fetchedBlackoutDates, setFetchedBlackoutDates] = useState<BlackoutDate[]>([]);
  const [fetchedRecurringRules, setFetchedRecurringRules] = useState<RecurringBlackoutRule[]>([]);

  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isLoadingResourcesAndLabs, setIsLoadingResourcesAndLabs] = useState(true);
  const [isLoadingAvailabilityRules, setIsLoadingAvailabilityRules] = useState(true);
  const [isLoadingUsersForFilter, setIsLoadingUsersForFilter] = useState(true);

  const [displayScope, setDisplayScope] = useState<'mine' | 'all'>('mine');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Partial<Booking> & { resourceId?: string, userId?: string } | null>(null);
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
  const [tempFilterRequesterId, setTempFilterRequesterId] = useState<string>('all');


  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterStatus, setActiveFilterStatus] = useState<Booking['status'] | 'all'>('all');
  const [activeFilterRequesterId, setActiveFilterRequesterId] = useState<string>('all');


  const dialogJustClosedRef = useRef(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const canViewAllBookings = useMemo(() => currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Technician'), [currentUser]);


  const fetchBookingsData = useCallback(async () => {
    if (!currentUser?.id) {
      setAllBookingsDataSource([]);
      setIsLoadingBookings(false);
      return;
    }
    setIsLoadingBookings(true);
    try {
      const bookingsFilter: { userId?: string; status?: string } = {};
      if (!(displayScope === 'all' && canViewAllBookings)) {
        bookingsFilter.userId = currentUser.id;
      }

      const result = await getBookings_SA(bookingsFilter);

      if (result.success && result.data) {
        let bookings = result.data.map(data => {
          let resourceName = "Unknown Resource";
          let userName = "Unknown User";

          if (data.resourceId) {
            const resource = allAvailableResources.find(r => r.id === data.resourceId);
            resourceName = resource?.name || resourceName;
          }
          if (data.userId) {
            const userFromList = allUsersForFilter.find(u => u.id === data.userId);
            if (userFromList) {
              userName = userFromList.name || userName;
            }
          }

          return {
            ...data,
            startTime: data.startTime ? new Date(data.startTime) : new Date(),
            endTime: data.endTime ? new Date(data.endTime) : new Date(),
            createdAt: data.createdAt ? new Date(data.createdAt) : new Date(),
            resourceName,
            userName,
          } as Booking & { resourceName?: string, userName?: string };
        });
        bookings.sort((a, b) => compareAsc(a.startTime, b.startTime));
        setAllBookingsDataSource(bookings);
      } else {
        setAllBookingsDataSource([]);
      }
    } catch (error: any) {
      setAllBookingsDataSource([]);
    }
    setIsLoadingBookings(false);
  }, [currentUser?.id, displayScope, canViewAllBookings, allAvailableResources, allUsersForFilter, toast]);


  const fetchSupportData = useCallback(async () => {
    setIsLoadingResourcesAndLabs(true);
    setIsLoadingAvailabilityRules(true);
    setIsLoadingUsersForFilter(true);
    try {
      let activeUserLabIds: string[] = [];
      if (currentUser && currentUser.id && currentUser.role !== 'Admin') {
          const membershipsResult = await getLabMemberships_SA(currentUser.id);
          const memberships: LabMembership[] = membershipsResult.success && membershipsResult.data
            ? membershipsResult.data.filter(m => m.status === 'active')
            : [];
          setUserLabMemberships(memberships);
          activeUserLabIds = memberships.map(m => m.labId);
      } else if (currentUser && currentUser.role === 'Admin') {
        const labsResult = await getLabs_SA();
        activeUserLabIds = labsResult.success && labsResult.data ? labsResult.data.map(l => l.id) : [];
      }

      const resourcesResult = await getResources_SA();
      let resourcesData: Resource[] = resourcesResult.success && resourcesResult.data ? resourcesResult.data : [];
      if (currentUser && currentUser.role !== 'Admin') {
        resourcesData = resourcesData.filter(r => activeUserLabIds.includes(r.labId) || !r.labId);
      }
      setAllAvailableResources(resourcesData);

    } catch (error: any) {
      setAllAvailableResources([]);
      setUserLabMemberships([]);
    } finally {
      setIsLoadingResourcesAndLabs(false);
    }

    try {
      const usersResult = await getUsers_SA(currentUser!.id);
      setAllUsersForFilter(usersResult.success && usersResult.data ? usersResult.data : []);
    } catch (error: any) {
      setAllUsersForFilter([]);
    } finally {
      setIsLoadingUsersForFilter(false);
    }

    try {
      const [blackoutResult, recurringResult] = await Promise.all([
        getBlackoutDates_SA(),
        getRecurringBlackoutRules_SA(),
      ]);
      setFetchedBlackoutDates(blackoutResult.success && blackoutResult.data ? blackoutResult.data : []);
      setFetchedRecurringRules(recurringResult.success && recurringResult.data ? recurringResult.data : []);
    } catch (error: any) {
      setFetchedBlackoutDates([]);
      setFetchedRecurringRules([]);
    } finally {
     setIsLoadingAvailabilityRules(false);
    }

  }, [currentUser]);


  useEffect(() => {
    if (isClient && currentUser) {
      fetchSupportData();
    } else if (isClient && !currentUser) {
      setAllBookingsDataSource([]); setIsLoadingBookings(false);
      setAllAvailableResources([]); setUserLabMemberships([]); setIsLoadingResourcesAndLabs(false);
      setAllUsersForFilter([]); setIsLoadingUsersForFilter(false);
      setFetchedBlackoutDates([]); setFetchedRecurringRules([]); setIsLoadingAvailabilityRules(false);
    }
  }, [isClient, currentUser, fetchSupportData]);

  useEffect(() => {
    if (currentUser && !isLoadingResourcesAndLabs && !isLoadingUsersForFilter) {
        fetchBookingsData();
    }
  }, [currentUser, displayScope, fetchBookingsData, isLoadingResourcesAndLabs, isLoadingUsersForFilter]);


  const handleOpenForm = useCallback((
    bookingToEdit?: Booking,
    resourceIdForNew?: string | null,
    dateForNew?: Date | null
  ) => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "You need to be logged in to create or edit bookings.", variant: "destructive" });
      return;
    }
     if (!bookingToEdit && allAvailableResources.length === 0 && currentUser.role !== 'Admin') {
      toast({ title: "No Resources Available", description: "You currently don't have access to any resources for booking. Please request lab access via your dashboard or contact an admin.", variant: "destructive", duration: 7000 });
      return;
    }
     if (!bookingToEdit && allAvailableResources.length === 0 && currentUser.role === 'Admin') {
      toast({ title: "No Resources in System", description: "There are no resources configured in the system. Please add resources first.", variant: "destructive", duration: 7000 });
      router.push('/admin/resources');
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

    let bookingData: Partial<Booking> & { resourceId?: string, userId?: string };

    if (bookingToEdit) {
      bookingData = {
        ...bookingToEdit,
        userId: bookingToEdit.userId,
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
  }, [currentUser, allAvailableResources, activeSelectedDate, toast, router]);


 useEffect(() => {
    if (dialogJustClosedRef.current) {
      dialogJustClosedRef.current = false;
      return;
    }

    if (!isClient || !currentUser || isLoadingBookings || isLoadingResourcesAndLabs || isLoadingAvailabilityRules || authIsLoading) {
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
        const bookingToEdit = allBookingsDataSource.find(b => b.id === bookingIdParam && (canViewAllBookings || b.userId === currentUser.id));
        if (bookingToEdit) {
          handleOpenForm(bookingToEdit);
        }
    } else if (resourceIdParam) {
        if (isFormOpen && !currentBooking?.id && currentBooking?.resourceId === resourceIdParam && currentBooking?.startTime && isSameDay(currentBooking.startTime, targetDateForNewBooking)) return;
        if (isFormOpen && currentBooking?.id) return;
        handleOpenForm(undefined, resourceIdParam, targetDateForNewBooking);
    }
  }, [searchParams, isClient, currentUser, allBookingsDataSource, handleOpenForm, isLoadingBookings, isLoadingResourcesAndLabs, isLoadingAvailabilityRules, authIsLoading, activeSelectedDate, isFormOpen, currentBooking, canViewAllBookings]);


  const bookingsToDisplay = useMemo(() => {
    if (!currentUser || isLoadingBookings || isLoadingResourcesAndLabs || isLoadingUsersForFilter) return [];

    let filteredBookings = [...allBookingsDataSource];

    if (activeSearchTerm) {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      filteredBookings = filteredBookings.filter(b =>
        (b.resourceName && b.resourceName.toLowerCase().includes(lowerSearchTerm)) ||
        (b.userName && b.userName.toLowerCase().includes(lowerSearchTerm)) ||
        (b.notes && b.notes.toLowerCase().includes(lowerSearchTerm))
      );
    }

    if (activeFilterResourceId !== 'all') {
      filteredBookings = filteredBookings.filter(b => b.resourceId === activeFilterResourceId);
    }
    if (activeFilterStatus !== 'all') {
      filteredBookings = filteredBookings.filter(b => b.status === activeFilterStatus);
    }
    if (displayScope === 'all' && canViewAllBookings && activeFilterRequesterId !== 'all') {
      filteredBookings = filteredBookings.filter(b => b.userId === activeFilterRequesterId);
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
  }, [allBookingsDataSource, activeSelectedDate, activeSearchTerm, activeFilterResourceId, activeFilterStatus, activeFilterRequesterId, displayScope, canViewAllBookings, currentUser, isLoadingBookings, isLoadingResourcesAndLabs, isLoadingUsersForFilter]);


  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterResourceId(activeFilterResourceId);
      setTempFilterStatus(activeFilterStatus);
      setTempSelectedDateForDialog(activeSelectedDate);
      setCurrentCalendarMonthInDialog(activeSelectedDate || startOfDay(new Date()));
      setTempFilterRequesterId(activeFilterRequesterId);
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterResourceId, activeFilterStatus, activeSelectedDate, activeFilterRequesterId]);


  const handleApplyDialogFilters = useCallback(() => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterStatus(tempFilterStatus);
    setActiveFilterRequesterId(tempFilterRequesterId);


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
  }, [tempSearchTerm, tempFilterResourceId, tempFilterStatus, tempFilterRequesterId, tempSelectedDateForDialog, activeSelectedDate, router, pathname, searchParams]);


  const resetDialogFiltersOnly = useCallback(() => {
    setTempSearchTerm('');
    setTempFilterResourceId('all');
    setTempFilterStatus('all');
    setTempSelectedDateForDialog(undefined);
    setCurrentCalendarMonthInDialog(startOfDay(new Date()));
    setTempFilterRequesterId('all');
  }, []);


  const resetAllActivePageFilters = useCallback(() => {
    setActiveSearchTerm('');
    setActiveFilterResourceId('all');
    setActiveFilterStatus('all');
    setActiveFilterRequesterId('all');
    setActiveSelectedDate(undefined);
    setCurrentCalendarMonth(startOfDay(new Date()));
    resetDialogFiltersOnly();

    const newSearchParams = new URLSearchParams(searchParams?.toString() || '');
    newSearchParams.delete('date');
    newSearchParams.delete('bookingId');
    newSearchParams.delete('resourceId');
    router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });

    setIsFilterDialogOpen(false);
  }, [resetDialogFiltersOnly, router, pathname, searchParams]);


  const activeFilterCount = useMemo(() => [
    activeSearchTerm !== '',
    activeFilterResourceId !== 'all',
    activeFilterStatus !== 'all',
    activeSelectedDate !== undefined,
    (canViewAllBookings && displayScope === 'all' && activeFilterRequesterId !== 'all')
  ].filter(Boolean).length, [activeSearchTerm, activeFilterResourceId, activeFilterStatus, activeSelectedDate, activeFilterRequesterId, canViewAllBookings, displayScope]);


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
    if (!currentUser || !currentUser.id) {
      toast({ title: "Authentication Error", description: "User not authenticated. Please log in.", variant: "destructive" });
      return;
    }
    const actingUserId = currentUser.id;
    const actingUserName = currentUser.name || 'User';

    const bookingForUserId = formData.userId || actingUserId;


    if (!formData.resourceId) {
      toast({ title: "Resource Not Selected", variant: "destructive" }); return;
    }
    const selectedResource = allAvailableResources.find(r => r.id === formData.resourceId);
    if (!selectedResource) {
      toast({ title: "Resource Not Found", variant: "destructive" }); return;
    }

    let finalStartTime: Date; let finalEndTime: Date;
    try {
      finalStartTime = set(formData.bookingDate, { hours: parseInt(formData.startTime.split(':')[0], 10), minutes: parseInt(formData.startTime.split(':')[1], 10), seconds: 0, milliseconds: 0 });
      finalEndTime = set(formData.bookingDate, { hours: parseInt(formData.endTime.split(':')[0], 10), minutes: parseInt(formData.endTime.split(':')[1], 10), seconds: 0, milliseconds: 0 });
    } catch (e) { toast({ title: "Invalid Date/Time", variant: "destructive" }); return; }

    const isNewBooking = !formData.id;
    if (isNewBooking && isBefore(startOfDay(finalStartTime), startOfToday())) { toast({ title: "Invalid Date", description: "Cannot book past dates.", variant: "destructive" }); return; }
    if (finalEndTime <= finalStartTime) { toast({ title: "Invalid Time", description: "End time must be after start time.", variant: "destructive" }); return; }

    const resourceLabId = selectedResource.labId;
    const bookingDayIndex = getDay(finalStartTime);
    const bookingDayName = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][bookingDayIndex];
    const labSpecificRecurringBlackout = fetchedRecurringRules.find(rule => rule.labId === resourceLabId && rule.daysOfWeek.includes(bookingDayName));
    const globalRecurringBlackout = fetchedRecurringRules.find(rule => !rule.labId && rule.daysOfWeek.includes(bookingDayName));

    if (labSpecificRecurringBlackout) { toast({ title: "Lab Closed", description: `Lab for ${selectedResource.name} closed on ${bookingDayName}s (${labSpecificRecurringBlackout.name}).`, variant: "destructive", duration: 7000 }); return; }
    if (!labSpecificRecurringBlackout && globalRecurringBlackout) { toast({ title: "Lab Closed (Global)", description: `All labs closed on ${bookingDayName}s (${globalRecurringBlackout.name}).`, variant: "destructive", duration: 7000 }); return; }

    const proposedDateOnlyStr = format(finalStartTime, 'yyyy-MM-dd');
    const labSpecificBlackoutDate = fetchedBlackoutDates.find(bd => bd.labId === resourceLabId && bd.date === proposedDateOnlyStr);
    const globalBlackoutDate = fetchedBlackoutDates.find(bd => !bd.labId && bd.date === proposedDateOnlyStr);

    if (labSpecificBlackoutDate) { toast({ title: "Lab Closed", description: `Lab for ${selectedResource.name} closed on ${formatDateSafe(finalStartTime, '', 'PPP')} (${labSpecificBlackoutDate.reason || 'N/A'}).`, variant: "destructive", duration: 7000 }); return; }
    if (!labSpecificBlackoutDate && globalBlackoutDate) { toast({ title: "Lab Closed (Global)", description: `All labs closed on ${formatDateSafe(finalStartTime, '', 'PPP')} (${globalBlackoutDate.reason || 'N/A'}).`, variant: "destructive", duration: 7000 }); return; }


    if (selectedResource.unavailabilityPeriods && selectedResource.unavailabilityPeriods.length > 0) {
      for (const period of selectedResource.unavailabilityPeriods) {
        if (!period.startDate || !period.endDate) continue;
        const unavailabilityStart = startOfDay(parseISO(period.startDate));
        const unavailabilityEnd = dateFnsAddDays(startOfDay(parseISO(period.endDate)), 1);
        if ((finalStartTime >= unavailabilityStart && finalStartTime < unavailabilityEnd) || (finalEndTime > unavailabilityStart && finalEndTime <= unavailabilityEnd) || (finalStartTime <= unavailabilityStart && finalEndTime >= unavailabilityEnd)) {
          toast({ title: "Resource Unavailable", description: `${selectedResource.name} unavailable: ${period.reason || 'Scheduled Unavailability'}.`, variant: "destructive", duration: 7000 }); return;
        }
      }
    }

    try {
      setIsLoadingBookings(true);
      if (isNewBooking) {
        // C-03 FIX: Uses server-side Prisma transaction for atomic conflict detection + creation
        const result = await createBookingTransactional_SA({
          callerUserId: actingUserId,
          resourceId: formData.resourceId!,
          userId: bookingForUserId,
          startTime: finalStartTime.toISOString(),
          endTime: finalEndTime.toISOString(),
          notes: formData.notes || '',
        });

        if (!result.success) {
          toast({ title: result.status === undefined ? "Booking Conflict" : "Error", description: result.message || "Failed to create booking.", variant: "destructive", duration: 7000 });
          setIsLoadingBookings(false); return;
        }

        const newBookingId = result.bookingId;
        const finalStatus = result.status;
        toast({ title: "Success", description: `Booking request ${finalStatus === 'Pending' ? 'submitted' : 'waitlisted'}.` });

        if (newBookingId && currentUser && currentUser.id && currentUser.name) {
          const selectedResourceNameForNotif = selectedResource.name;
          const targetUserForNotification = allUsersForFilter.find(u => u.id === bookingForUserId);
          const targetUserName = targetUserForNotification?.name || 'User';

          if (finalStatus === 'Pending') {
            if (actingUserId !== bookingForUserId && currentUser.role === 'Admin') {
                 try { await addNotification(bookingForUserId, 'Booking Submitted For You', `A booking for ${selectedResourceNameForNotif} on ${format(finalStartTime, 'MMM dd, HH:mm')} was submitted for you by ${actingUserName} and is pending approval.`, 'booking_pending_approval', `/bookings?bookingId=${newBookingId}`); } catch { /* ignore */ }
            }
            try {
              const adminAndTechUsers = allUsersForFilter.filter(u => u.role === 'Admin' || u.role === 'Technician');
              const notificationPromises = adminAndTechUsers.map(adminUser => {
                if (adminUser.id !== actingUserId) {
                  return addNotification(adminUser.id, 'New Booking Request', `Booking for ${selectedResourceNameForNotif} by ${targetUserName} on ${format(finalStartTime, 'MMM dd, HH:mm')} needs approval.`, 'booking_pending_approval', `/admin/booking-requests?bookingId=${newBookingId}`);
                } return Promise.resolve();
              });
              await Promise.allSettled(notificationPromises);
            } catch { /* Log error */ }
          } else if (finalStatus === 'Waitlisted') {
            try { await addNotification(bookingForUserId, 'Added to Waitlist', `Your booking for ${selectedResourceNameForNotif} on ${format(finalStartTime, 'MMM dd, HH:mm')} is waitlisted${actingUserId !== bookingForUserId ? ` (created by ${actingUserName})` : ''}.`, 'booking_waitlisted', `/bookings?bookingId=${newBookingId}`);
            } catch { /* Log error */ }
          }
        }
      } else if (formData.id) {
        // C-04 FIX: Uses server action with authorization checks
        const updateResult = await updateBookingSA({
          callerUserId: actingUserId,
          bookingId: formData.id,
          resourceId: formData.resourceId!,
          startTime: finalStartTime.toISOString(),
          endTime: finalEndTime.toISOString(),
          status: formData.status || 'Pending',
          notes: formData.notes || '',
        });
        if (!updateResult.success) {
          toast({ title: "Update Failed", description: updateResult.message || "Failed to update booking.", variant: "destructive" });
          setIsLoadingBookings(false); return;
        }
        toast({ title: "Success", description: "Booking updated." });
      }
      await fetchBookingsData();
      handleDialogClose(false);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally { setIsLoadingBookings(false); }
  }, [currentUser, allAvailableResources, fetchedBlackoutDates, fetchedRecurringRules, allUsersForFilter, fetchBookingsData, toast, handleDialogClose, setIsLoadingBookings]);


  const handleCancelBookingLocal = useCallback(async (bookingId: string) => {
    if (!currentUser?.id) {
      toast({ title: "Authentication Error", variant: "destructive" }); return;
    }

    setIsLoadingBookings(true);
    try {
      // C-04 FIX: Server-side ownership and role verification
      const result = await cancelBooking_SA({
        callerUserId: currentUser.id,
        bookingId,
      });

      if (!result.success) {
        toast({ title: "Cancellation Failed", description: result.message || "Could not cancel booking.", variant: "destructive" });
      } else {
        toast({ title: "Info", description: "Booking cancelled." });
      }
      await fetchBookingsData();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Could not cancel booking. Please try again.';
      toast({ title: "Cancellation Failed", description: message, variant: "destructive" });
    } finally { setIsLoadingBookings(false); }
  }, [currentUser, fetchBookingsData, toast]);


  const handleOpenDetailsDialog = useCallback(async (bookingId: string) => {
    const bookingFromState = allBookingsDataSource.find(b => b.id === bookingId);
    if (!bookingFromState) { toast({ title: "Error", description: "Booking details not found locally.", variant: "destructive" }); return; }
    let detailedBooking: Booking & { resourceName?: string, userName?: string } = { ...bookingFromState };
    if (bookingFromState.resourceId) {
      const resource = allAvailableResources.find(r => r.id === bookingFromState.resourceId);
      detailedBooking.resourceName = resource?.name || bookingFromState.resourceName || "Unknown Resource";
    }
    if (bookingFromState.userId) {
      const userFromList = allUsersForFilter.find(u => u.id === bookingFromState.userId);
      detailedBooking.userName = userFromList?.name || bookingFromState.userName || "Unknown User";
    }
    setSelectedBookingForDetails(detailedBooking);
    setIsDetailsDialogOpen(true);
  }, [allBookingsDataSource, allAvailableResources, allUsersForFilter, toast]);

  const handleBookingUpdateInDetails = useCallback((updatedBooking: Booking) => {
    if (!currentUser) return;
    setAllBookingsDataSource(prev => prev.map(b => b.id === updatedBooking.id ? { ...b, ...updatedBooking, resourceName: allAvailableResources.find(r => r.id === updatedBooking.resourceId)?.name || 'Unknown Resource', userName: allUsersForFilter.find(u => u.id === updatedBooking.userId)?.name || 'Unknown User' } : b));
    if (selectedBookingForDetails && selectedBookingForDetails.id === updatedBooking.id) {
      setSelectedBookingForDetails(prev => prev ? { ...prev, ...updatedBooking, resourceName: allAvailableResources.find(r => r.id === updatedBooking.resourceId)?.name || prev.resourceName, userName: allUsersForFilter.find(u => u.id === updatedBooking.userId)?.name || prev.userName } : null);
    }
  }, [currentUser, selectedBookingForDetails, allAvailableResources, allUsersForFilter]);


  const getBookingStatusBadgeElement = (status: Booking['status']) => {
    switch (status) {
      case 'Confirmed': return <Badge className={cn("bg-green-500 text-white hover:bg-green-600 border-transparent")}><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Pending': return <Badge className={cn("bg-yellow-500 text-yellow-950 hover:bg-yellow-600 border-transparent")}><Clock className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Cancelled': return <Badge className={cn("bg-gray-400 text-white hover:bg-gray-500 border-transparent")}><X className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Waitlisted': return <Badge className={cn("bg-purple-500 text-white hover:bg-purple-600 border-transparent")}><UserIcon className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const dialogHeaderDateString = useMemo(() => {
    if (isFormOpen && currentBooking?.startTime && isValidDateFn(new Date(currentBooking.startTime))) return format(new Date(currentBooking.startTime), "PPP");
    else if (isFormOpen && !currentBooking?.id && activeSelectedDate && isValidDateFn(activeSelectedDate)) return format(activeSelectedDate, "PPP");
    return null;
  }, [isFormOpen, currentBooking?.startTime, currentBooking?.id, activeSelectedDate]);


  if (!isClient) return <BookingsPageLoader />;

  if (!currentUser && isClient && !authIsLoading) {
    return (
      <div className="space-y-8">
        <PageHeader title="Bookings" description="Please log in to manage bookings." icon={CalendarDays} />
        <Card className="text-center py-10 text-muted-foreground border-0 shadow-none">
          <CardContent><Info className="mx-auto h-12 w-12 mb-4 opacity-50" /><p className="text-lg font-medium">Login Required</p><p className="text-sm mb-4">You need to be logged in to view and manage bookings.</p><Button onClick={() => router.push('/login')} className="mt-4">Go to Login</Button></CardContent>
        </Card>
      </div>
    );
  }

  const isLoadingAnyData = isLoadingBookings || isLoadingResourcesAndLabs || isLoadingAvailabilityRules || authIsLoading || isLoadingUsersForFilter;
  const formKey = currentBooking?.id || `new:${currentBooking?.resourceId || 'empty'}:${currentBooking?.startTime instanceof Date ? currentBooking.startTime.toISOString() : (activeSelectedDate || new Date()).toISOString()}`;

  const pageHeaderDescription = displayScope === 'all' && canViewAllBookings
    ? `View, search, filter, and manage all lab resource bookings.`
    : `View, search, filter, and manage your lab resource bookings.`;


  return (
    <div className="space-y-8">
      <PageHeader
        title="Bookings"
        description={pageHeaderDescription}
        icon={CalendarDays}
        actions={
          currentUser && (
            <div className="flex items-center gap-2 flex-wrap">
              {canViewAllBookings && (
                <div className="flex items-center space-x-2 p-1.5 border rounded-md bg-muted">
                  <Label htmlFor="displayScopeToggle" className="text-sm text-muted-foreground pl-1 pr-0.5 whitespace-nowrap cursor-pointer">
                     {displayScope === 'all' ? 'All Bookings' : 'My Bookings'}
                  </Label>
                   <Switch
                    id="displayScopeToggle"
                    checked={displayScope === 'all'}
                    onCheckedChange={(checked) => setDisplayScope(checked ? 'all' : 'mine')}
                    className="data-[state=checked]:bg-primary data-[state=unchecked]:bg-primary"
                    thumbIcon={displayScope === 'all' ? <ToggleRight className="h-3.5 w-3.5 text-primary-foreground" /> : <ToggleLeft className="h-3.5 w-3.5 text-primary-foreground" />}
                  />
                </div>
              )}
               <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                    <DialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter {activeFilterCount > 0 && (<Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">{activeFilterCount}</Badge>)}</Button></DialogTrigger>
                    <DialogContent className="w-full sm:max-w-lg">
                        <DialogHeader><DialogTitle>Filter Bookings</DialogTitle><DialogDescription>Refine your list of bookings.</DialogDescription></DialogHeader>
                        <ScrollArea className="max-h-[60vh] mt-4">
                            <div className="space-y-6 pl-1 pr-1">
                                <div>
                                    <Label htmlFor="bookingCalendarDialogDate">Filter by Specific Date (Optional)</Label>
                                    <div className="flex justify-center items-center rounded-md border p-2 mt-1"><Calendar mode="single" selected={tempSelectedDateForDialog} onSelect={(date) => setTempSelectedDateForDialog(date ? startOfDay(date) : undefined)} month={currentCalendarMonthInDialog} onMonthChange={setCurrentCalendarMonthInDialog} className="rounded-md" classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }} footer={tempSelectedDateForDialog && <Button variant="ghost" size="sm" onClick={() => { setTempSelectedDateForDialog(undefined); setCurrentCalendarMonthInDialog(startOfDay(new Date())); }} className="w-full mt-2 text-xs"><FilterX className="mr-2 h-4 w-4" /> Clear Date Selection</Button>} /></div>
                                </div>
                                <div>
                                    <Label htmlFor="bookingSearchDialog">Search ({displayScope === 'all' && canViewAllBookings ? 'Resource/User/Notes' : 'Resource/Notes'})</Label>
                                    <div className="relative mt-1"><SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input id="bookingSearchDialog" type="search" placeholder="Keyword..." className="h-9 pl-8" value={tempSearchTerm} onChange={(e) => setTempSearchTerm(e.target.value)} /></div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div><Label htmlFor="bookingResourceDialog">Resource</Label><Select value={tempFilterResourceId} onValueChange={setTempFilterResourceId} disabled={isLoadingResourcesAndLabs}><SelectTrigger id="bookingResourceDialog" className="h-9 mt-1"><SelectValue placeholder={isLoadingResourcesAndLabs ? "Loading..." : "Filter by Resource"} /></SelectTrigger><SelectContent><SelectItem value="all">All Resources</SelectItem>{allAvailableResources.map(resource => (<SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem>))}</SelectContent></Select></div>
                                    <div><Label htmlFor="bookingStatusDialog">Status</Label><Select value={tempFilterStatus} onValueChange={(v) => setTempFilterStatus(v as Booking['status'] | 'all')}><SelectTrigger id="bookingStatusDialog" className="h-9 mt-1"><SelectValue placeholder="Filter by Status" /></SelectTrigger><SelectContent>{bookingStatusesForFilter.map(s => <SelectItem key={s} value={s}>{s === 'all' ? 'All Statuses' : s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}</SelectContent></Select></div>
                                </div>
                                {canViewAllBookings && (
                                  <div>
                                    <Label htmlFor="bookingRequesterDialog">Requester</Label>
                                    <Select value={tempFilterRequesterId} onValueChange={setTempFilterRequesterId} disabled={isLoadingUsersForFilter || displayScope === 'mine'}>
                                      <SelectTrigger id="bookingRequesterDialog" className="h-9 mt-1"><SelectValue placeholder={isLoadingUsersForFilter ? "Loading Users..." : "Filter by Requester"} /></SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="all">All Requesters</SelectItem>
                                        {allUsersForFilter.map(user => (<SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>))}
                                      </SelectContent>
                                    </Select>
                                    {displayScope === 'mine' && <p className="text-xs text-muted-foreground !mt-0.5">Requester filter is disabled when 'Show My Bookings' is active.</p>}
                                  </div>
                                )}
                            </div>
                        </ScrollArea>
                        <DialogFooter className="pt-6 border-t"><Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters</Button><Button onClick={handleApplyDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply Filters</Button></DialogFooter>
                    </DialogContent>
                </Dialog>
              <Button onClick={() => handleOpenForm(undefined, null, activeSelectedDate || startOfToday())}><PlusCircle className="mr-2 h-4 w-4" /> New Booking</Button>
            </div>
          )
        }
      />
       <Card className="shadow-lg">
            <CardHeader className="pb-3 border-b-0 flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
                <div>
                    <CardTitle>
                    {activeSelectedDate ? `Bookings for ${formatDateSafe(activeSelectedDate, 'this day', 'PPP')}` :
                     (displayScope === 'all' && canViewAllBookings ? 'All Upcoming Bookings' : 'Your Upcoming Bookings')}
                    </CardTitle>
                    <CardDescription className="mt-1">
                      {isLoadingAnyData && bookingsToDisplay.length === 0 ? 'Loading...' : `Displaying ${bookingsToDisplay.length} booking(s).`}
                      {activeFilterCount > 0 && ` (${activeFilterCount} filter(s) active)`}
                    </CardDescription>
                </div>
            </CardHeader>
            <CardContent className="p-0">
            {isLoadingAnyData && bookingsToDisplay.length === 0 && allBookingsDataSource.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />Loading bookings...</div>
            ) : bookingsToDisplay.length > 0 ? (
                <div className="overflow-x-auto border rounded-b-lg rounded-t-none">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead><ResourceIcon className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Resource</TableHead>
                        {canViewAllBookings && displayScope === 'all' && <TableHead><Users className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Requester</TableHead>}
                        {!activeSelectedDate && <TableHead><CalendarIconLucide className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Date</TableHead>}
                        <TableHead><Clock className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Time</TableHead>
                        <TableHead><Info className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {bookingsToDisplay.map((booking) => {
                       const isCurrentUserBooking = booking.userId === currentUser?.id;
                       const canAdministerBooking = currentUser?.role === 'Admin';

                       const canEditThisBooking = canAdministerBooking || (isCurrentUserBooking && (booking.status === 'Pending' || booking.status === 'Waitlisted' || booking.status === 'Confirmed'));
                       const canCancelThisBooking = canAdministerBooking || isCurrentUserBooking;

                        return (
                        <TableRow key={booking.id} className={cn(booking.status === 'Cancelled' && 'opacity-60')}>
                            <TableCell className="font-medium cursor-pointer hover:underline hover:text-primary" onClick={() => handleOpenDetailsDialog(booking.id)}>{booking.resourceName || 'Loading...'}</TableCell>
                            {canViewAllBookings && displayScope === 'all' && <TableCell>{booking.userName || 'N/A'}</TableCell>}
                            {!activeSelectedDate && <TableCell>{formatDateSafe(booking.startTime, 'Invalid Date', 'MMM dd, yyyy')}</TableCell>}
                            <TableCell>{isValidDateFn(booking.startTime) ? format(booking.startTime, 'p') : ''} - {isValidDateFn(booking.endTime) ? format(booking.endTime, 'p') : ''}</TableCell>
                            <TableCell>{getBookingStatusBadgeElement(booking.status)}</TableCell>
                            <TableCell className="text-right space-x-1">
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenDetailsDialog(booking.id)}><Eye className="h-4 w-4" /> <span className="sr-only">View Details</span></Button>
                            {booking.status !== 'Cancelled' && canEditThisBooking && (<Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenForm(booking)}><Edit3 className="h-4 w-4" /> <span className="sr-only">Edit Booking</span></Button>)}
                            {booking.status !== 'Cancelled' && canCancelThisBooking && (<Button variant="ghost" size="icon" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8" onClick={() => handleCancelBookingLocal(booking.id)}><X className="h-4 w-4" /> <span className="sr-only">Cancel Booking</span></Button>)}
                            {(booking.status === 'Cancelled') && (<span className="text-xs text-muted-foreground italic">{booking.status}</span>)}
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
                        (allBookingsDataSource.length === 0 && !isLoadingBookings ? (displayScope === 'mine' ? 'You have no bookings.' : 'No bookings found in the system.') :
                            (activeSelectedDate ? `No bookings scheduled for ${formatDateSafe(activeSelectedDate, 'this day', 'PPP')}.` : (displayScope === 'mine' ? 'No upcoming bookings found for you.' : 'No upcoming bookings found.'))
                        )
                    }
                </p>
                <p className="text-sm mb-4">
                    {activeFilterCount > 0 ? 'Try adjusting your filter criteria or reset all filters.' :
                        (allBookingsDataSource.length === 0 && !isLoadingBookings ? (displayScope === 'mine' ? 'Create your first booking to get started.' : 'No bookings in the system yet.') :
                            (activeSelectedDate ? 'Try a different date or create a new booking for this day.' : 'Create a new booking or check other dates.')
                        )
                    }
                </p>
                {activeFilterCount > 0 ? (<Button variant="outline" onClick={resetAllActivePageFilters}><FilterX className="mr-2 h-4 w-4" /> Reset All Filters</Button>
                ) : ( allBookingsDataSource.length === 0 && !isLoadingBookings && currentUser && (<Button onClick={() => handleOpenForm(undefined, null, startOfToday())} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Create {(displayScope === 'all' && canViewAllBookings) ? 'First System Booking' : 'Your First Booking'}</Button>))
                }
                 {activeSelectedDate && bookingsToDisplay.length === 0 && (!activeFilterCount || (activeFilterCount ===1 && activeSelectedDate)) && currentUser && (<Button onClick={() => handleOpenForm(undefined, null, activeSelectedDate)} className="mt-4"><PlusCircle className="mr-2 h-4 w-4" /> Create Booking for {formatDateSafe(activeSelectedDate, '', 'MMM dd')}</Button>)}
                </CardContent>
            )}
            </CardContent>
             {activeFilterCount > 0 && bookingsToDisplay.length > 0 &&
                <CardFooter className="pt-4 justify-center border-t">
                  {!activeSelectedDate ? (
                     <Button variant="link" className="p-0 h-auto text-xs" onClick={resetAllActivePageFilters}><FilterX className="mr-2 h-4 w-4" /> Reset All Filters</Button>
                  ) : (<Button variant="link" className="p-0 h-auto text-xs" onClick={() => { setActiveSelectedDate(undefined); setCurrentCalendarMonth(startOfDay(new Date())); const newSearchParams = new URLSearchParams(searchParams?.toString() || ''); newSearchParams.delete('date'); router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });}}><FilterX className="mr-2 h-4 w-4" /> View All Upcoming Bookings</Button>)}
                </CardFooter>
            }
        </Card>
      <Dialog open={isFormOpen} onOpenChange={handleDialogClose} key={formKey}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>{currentBooking?.id ? 'Edit Booking' : 'Create New Booking'}</DialogTitle><DialogDescription>Fill in the details below to {currentBooking?.id ? 'update your' : 'schedule a new'} booking.{dialogHeaderDateString && ` For date: ${dialogHeaderDateString}`}</DialogDescription></DialogHeader>
          {(isLoadingResourcesAndLabs || isLoadingAvailabilityRules || isLoadingUsersForFilter) && isFormOpen ? (<div className="flex justify-center items-center py-10 mt-4"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading form data...</div>
          ) : allAvailableResources.length > 0 && currentUser && currentUser.name && currentUser.role ? (
            <BookingForm
                initialData={currentBooking}
                onSave={handleSaveBooking}
                onCancel={() => handleDialogClose(false)}
                currentUser={currentUser}
                allAvailableResources={allAvailableResources}
                allUsers={allUsersForFilter}
                selectedDateProp={currentBooking?.startTime ? startOfDay(new Date(currentBooking.startTime)) : (activeSelectedDate || startOfToday())}
            />
          ) : ( isFormOpen && (<div className="text-center py-6 text-muted-foreground mt-4"><Info className="mx-auto h-8 w-8 mb-2" /><p>No resources are currently available for booking, or user data is missing.</p><p className="text-xs">{ currentUser?.role !== 'Admin' ? "Please ensure you have access to labs via your dashboard." : "Please configure resources and labs in Admin section."}</p></div>))}
        </DialogContent>
      </Dialog>

      {selectedBookingForDetails && (<BookingDetailsDialog booking={selectedBookingForDetails} isOpen={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen} onBookingUpdate={handleBookingUpdateInDetails} />)}
    </div>
  );
}

const bookingFormSchema = z.object({
  id: z.string().optional(),
  userId: z.string().min(1, "Requester ID is required."),
  resourceId: z.string().min(1, "Please select a resource."),
  bookingDate: z.date({ required_error: "Please select a date." }),
  startTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid start time format. Use HH:mm."),
  endTime: z.string().regex(/^([01]\d|2[0-3]):([0-5]\d)$/, "Invalid end time format. Use HH:mm."),
  status: z.enum(bookingStatusesForForm as [Booking['status'], ...Array<Booking['status'] >]).optional(),
  notes: z.string().max(500, "Notes cannot exceed 500 characters.").optional().or(z.literal('')),
}).refine(data => {
  if (!data.bookingDate || !data.startTime || !data.endTime) return true;
  try {
    const startDateTime = set(data.bookingDate, { hours: parseInt(data.startTime.split(':')[0], 10), minutes: parseInt(data.startTime.split(':')[1], 10) });
    const endDateTime = set(data.bookingDate, { hours: parseInt(data.endTime.split(':')[0], 10), minutes: parseInt(data.endTime.split(':')[1], 10) });
    return endDateTime > startDateTime;
  } catch (e) { return true; }
}, { message: "End time must be after start time.", path: ["endTime"], });

export type BookingFormValues = z.infer<typeof bookingFormSchema>;

interface BookingFormProps {
  initialData?: Partial<Booking> & { resourceId?: string, userId?: string };
  onSave: (data: BookingFormValues) => void;
  onCancel: () => void;
  currentUser: User;
  allAvailableResources: Resource[];
  allUsers: User[];
  selectedDateProp?: Date;
}

const timeSlots = Array.from({ length: (17 - 8) * 2 + 1 }, (_, i) => {
  const hour = 8 + Math.floor(i / 2); const minute = i % 2 === 0 ? '00' : '30';
  if (hour > 17 || (hour === 17 && minute !== '00')) return null;
  return `${String(hour).padStart(2, '0')}:${minute}`;
}).filter(Boolean) as string[];


function BookingForm({ initialData, onSave, onCancel, currentUser, allAvailableResources, allUsers, selectedDateProp }: BookingFormProps) {
  const form = useForm<BookingFormValues>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      id: initialData?.id || undefined,
      userId: initialData?.userId || currentUser.id,
      resourceId: initialData?.resourceId || (allAvailableResources.length > 0 ? allAvailableResources[0].id : ''),
      bookingDate: initialData?.startTime ? startOfDay(new Date(initialData.startTime)) : (selectedDateProp || startOfToday()),
      startTime: initialData?.startTime ? format(new Date(initialData.startTime), 'HH:mm') : '09:00',
      endTime: initialData?.endTime ? format(new Date(initialData.endTime), 'HH:mm') : '11:00',
      status: initialData?.status || 'Pending',
      notes: initialData?.notes || '',
    },
  });

  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const watchBookingDate = form.watch('bookingDate');
  const watchStartTime = form.watch('startTime');


  useEffect(() => {
    const defaultDate = initialData?.startTime ? startOfDay(new Date(initialData.startTime)) : (selectedDateProp || startOfToday());
    const defaultStartTimeStr = initialData?.startTime ? format(new Date(initialData.startTime), 'HH:mm') : '09:00';
    let defaultEndTimeStr = initialData?.endTime ? format(new Date(initialData.endTime), 'HH:mm') : '11:00';
    if (defaultDate && defaultStartTimeStr && defaultEndTimeStr) {
        try {
            const tempStartDate = set(defaultDate, { hours: parseInt(defaultStartTimeStr.split(':')[0], 10), minutes: parseInt(defaultStartTimeStr.split(':')[1], 10) });
            const tempEndDate = set(defaultDate, { hours: parseInt(defaultEndTimeStr.split(':')[0], 10), minutes: parseInt(defaultEndTimeStr.split(':')[1], 10) });
            if (tempEndDate <= tempStartDate) {
                const newEndDate = new Date(tempStartDate.getTime() + 2 * 60 * 60 * 1000);
                 if (newEndDate.getHours() > 17 || (newEndDate.getHours() === 17 && newEndDate.getMinutes() > 0)) defaultEndTimeStr = '17:00';
                else defaultEndTimeStr = format(newEndDate, 'HH:mm');
            }
        } catch (e) { defaultEndTimeStr = '11:00'; }
    }
    form.reset({
      id: initialData?.id || undefined,
      userId: initialData?.userId || currentUser.id,
      resourceId: initialData?.resourceId || (allAvailableResources.length > 0 ? allAvailableResources[0].id : ''),
      bookingDate: defaultDate, startTime: defaultStartTimeStr, endTime: defaultEndTimeStr,
      status: initialData?.status || 'Pending', notes: initialData?.notes || '',
    });
  }, [initialData, selectedDateProp, allAvailableResources, form, currentUser.id]);

  useEffect(() => {
    const currentBookingDate = form.getValues('bookingDate');
    const currentStartTime = form.getValues('startTime');
    const currentEndTime = form.getValues('endTime');
    if (currentBookingDate && currentStartTime && currentEndTime) {
      try {
        const startDateTime = set(currentBookingDate, { hours: parseInt(currentStartTime.split(':')[0], 10), minutes: parseInt(currentStartTime.split(':')[1], 10) });
        const endDateTime = set(currentBookingDate, { hours: parseInt(currentEndTime.split(':')[0], 10), minutes: parseInt(currentEndTime.split(':')[1], 10) });
        if (endDateTime <= startDateTime) {
          const newEndDateTime = new Date(startDateTime.getTime() + 2 * 60 * 60 * 1000);
          if (newEndDateTime.getHours() > 17 || (newEndDateTime.getHours() === 17 && newEndDateTime.getMinutes() > 0)) form.setValue('endTime', '17:00', { shouldValidate: true });
          else form.setValue('endTime', format(newEndDateTime, 'HH:mm'), { shouldValidate: true });
        }
      } catch (e) { /* Silent catch for auto-adjust logic */ }
    }
  }, [watchStartTime, watchBookingDate, form]);

  const isNewBookingForm = useMemo(() => !initialData?.id, [initialData?.id]);
  const isAdminBooking = currentUser.role === 'Admin';

  const canEditStatus = useMemo(() => {
    if (!currentUser.role || !initialData?.id) return false;
    return currentUser.role === 'Admin' || currentUser.role === 'Technician';
  }, [currentUser.role, initialData?.id]);

  function handleRHFSubmit(data: BookingFormValues) { onSave(data); }
  const selectedResource = allAvailableResources.find(r => r.id === form.watch('resourceId'));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleRHFSubmit)}>
        <ScrollArea className="max-h-[60vh] mt-4">
          <div className="space-y-4 pl-1 pr-1">

            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requester</FormLabel>
                  {isNewBookingForm && isAdminBooking ? (
                    <Select onValueChange={field.onChange} value={field.value} disabled={form.formState.isSubmitting}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select requester" /></SelectTrigger></FormControl>
                      <SelectContent>
                        {allUsers.map(user => (
                          <SelectItem key={user.id} value={user.id}>{user.name} ({user.email})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={allUsers.find(u => u.id === field.value)?.name || currentUser.name}
                      disabled
                    />
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField control={form.control} name="resourceId" render={({ field }) => (<FormItem><FormLabel>Resource <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value || ''} disabled={!isNewBookingForm || allAvailableResources.length === 0 || form.formState.isSubmitting}><FormControl><SelectTrigger id="bookingFormDialogResource"><SelectValue placeholder={allAvailableResources.length > 0 ? "Select a resource" : "No resources available"} /></SelectTrigger></FormControl><SelectContent>{allAvailableResources.map(resource => (<SelectItem key={resource.id} value={resource.id} disabled={resource.status !== 'Working' && resource.id !== initialData?.resourceId}>{resource.name} ({resource.status})</SelectItem>))}</SelectContent></Select>{!isNewBookingForm && <p className="text-xs text-muted-foreground !mt-0.5">Resource cannot be changed for existing bookings.</p>}{selectedResource && selectedResource.status !== 'Working' && isNewBookingForm && (<FormMessage className="text-xs text-destructive !mt-0.5">This resource is currently {selectedResource.status.toLowerCase()} and cannot be booked.</FormMessage>)}{allAvailableResources.length === 0 && <p className="text-xs text-muted-foreground mt-1">No resources accessible. Please check your lab memberships or contact an admin.</p>}<FormMessage /></FormItem>)} />
            <FormField control={form.control} name="bookingDate" render={({ field }) => (<FormItem className="flex flex-col"><FormLabel>Date <span className="text-destructive">*</span></FormLabel><Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}><PopoverTrigger asChild><FormControl><Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-10", !field.value && "text-muted-foreground")} disabled={!isNewBookingForm || form.formState.isSubmitting}><CalendarIconLucide className="mr-2 h-4 w-4" />{field.value && isValidDateFn(field.value) ? (format(field.value, "PPP")) : (<span>Pick a date</span>)}</Button></FormControl></PopoverTrigger><PopoverContent className="w-auto p-0" align="start"><Calendar mode="single" selected={field.value} onSelect={(date) => { if (date) field.onChange(startOfDay(date)); setIsCalendarOpen(false);}} disabled={(date) => date < startOfToday() && !initialData?.id} initialFocus /></PopoverContent></Popover>{!isNewBookingForm && <p className="text-xs text-muted-foreground !mt-0.5">Date cannot be changed for existing bookings.</p>}<FormMessage /></FormItem>)} />
            <div className="grid grid-cols-2 gap-4">
              <FormField control={form.control} name="startTime" render={({ field }) => (<FormItem><FormLabel>Start Time <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!isNewBookingForm || form.formState.isSubmitting}><FormControl><SelectTrigger id="bookingFormDialogStartTime"><SelectValue placeholder="Select start time" /></SelectTrigger></FormControl><SelectContent>{timeSlots.map(slot => <SelectItem key={`start-${slot}`} value={slot}>{slot}</SelectItem>)}</SelectContent></Select>{!isNewBookingForm && <p className="text-xs text-muted-foreground !mt-0.5">Start time cannot be changed.</p>}<FormMessage /></FormItem>)} />
              <FormField control={form.control} name="endTime" render={({ field }) => (<FormItem><FormLabel>End Time <span className="text-destructive">*</span></FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!isNewBookingForm || form.formState.isSubmitting}><FormControl><SelectTrigger id="bookingFormDialogEndTime"><SelectValue placeholder="Select end time" /></SelectTrigger></FormControl><SelectContent>{timeSlots.map(slot => <SelectItem key={`end-${slot}`} value={slot}>{slot}</SelectItem>)}</SelectContent></Select>{!isNewBookingForm && <p className="text-xs text-muted-foreground !mt-0.5">End time cannot be changed.</p>}<FormMessage /></FormItem>)} />
            </div>
            {!isNewBookingForm && (<FormField control={form.control} name="status" render={({ field }) => (<FormItem><FormLabel>Status</FormLabel><Select onValueChange={field.onChange} value={field.value} disabled={!canEditStatus || form.formState.isSubmitting}><FormControl><SelectTrigger id="bookingFormDialogStatus"><SelectValue placeholder="Select status" /></SelectTrigger></FormControl><SelectContent>{bookingStatusesForForm.map(status => (<SelectItem key={status} value={status} disabled={status === 'Waitlisted' && isNewBookingForm}>{status}</SelectItem>))}</SelectContent></Select>{!canEditStatus && <p className="text-xs text-muted-foreground !mt-0.5">Status can only be changed by Admins/Technicians.</p>}<FormMessage /></FormItem>)} />)}
            <FormField control={form.control} name="notes" render={({ field }) => (<FormItem><FormLabel>Notes (Optional)</FormLabel><FormControl><Textarea placeholder="Any specific requirements or notes for this booking..." {...field} value={field.value || ''} rows={3} disabled={form.formState.isSubmitting}/></FormControl><FormMessage /></FormItem>)} />
          </div>
        </ScrollArea>
        <DialogFooter className="pt-6 border-t">
          <Button type="submit" disabled={form.formState.isSubmitting || (selectedResource && selectedResource.status !== 'Working' && isNewBookingForm) || (allAvailableResources.length === 0 && isNewBookingForm)}>{form.formState.isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}{form.formState.isSubmitting ? "Saving..." : (initialData?.id ? "Save Changes" : "Request Booking")}</Button>
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
