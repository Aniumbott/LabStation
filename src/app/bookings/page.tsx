
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarDays, PlusCircle, Edit3, X, Clock, UserCircle, Info, ChevronLeft, ChevronRight, Search as SearchIcon, FilterX } from 'lucide-react';
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
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { Booking, Resource, RoleName } from '@/types';
import { format, parseISO, isValid as isValidDate, startOfDay, addMonths, subMonths, isSameDay, set } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const mockResources: Resource[] = [
  { id: '1', name: 'Electron Microscope Alpha', type: 'Microscope', lab: 'Lab A', status: 'Available', description: '', imageUrl: '' },
  { id: '2', name: 'BioSafety Cabinet Omega', type: 'Incubator', lab: 'Lab B', status: 'Available', description: '', imageUrl: '' },
  { id: '3', name: 'HPLC System Zeta', type: 'HPLC System', lab: 'Lab C', status: 'Available', description: '', imageUrl: '' },
  { id: '4', name: 'High-Speed Centrifuge Pro', type: 'Centrifuge', lab: 'Lab A', status: 'Available', description: '', imageUrl: '' },
  { id: '5', name: 'Confocal Microscope Zeiss', type: 'Microscope', lab: 'Lab B', status: 'Available', description: '', imageUrl: '' },
];

const mockCurrentUser = {
  id: 'user_authed_123',
  name: 'Dr. Lab User',
  email: 'lab.user@labstation.com',
  role: 'Researcher' as RoleName,
};

const initialBookings: Booking[] = [
  { id: 'b1', resourceId: '1', resourceName: 'Electron Microscope Alpha', userId: mockCurrentUser.id, userName: mockCurrentUser.name, startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 2, 10, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 2, 12, 0), status: 'Confirmed', notes: 'Routine sample analysis.' },
  { id: 'b2', resourceId: '2', resourceName: 'BioSafety Cabinet Omega', userId: 'user2', userName: 'Dr. Charles Babbage', startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 3, 14, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 3, 16, 0), status: 'Pending', notes: 'Cell culture experiment setup.' },
  { id: 'b3', resourceId: '1', resourceName: 'Electron Microscope Alpha', userId: mockCurrentUser.id, userName: mockCurrentUser.name, startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 14, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 1, 15, 0), status: 'Confirmed', notes: 'Quick check.' },
  { id: 'b4', resourceId: '4', resourceName: 'High-Speed Centrifuge Pro', userId: mockCurrentUser.id, userName: mockCurrentUser.name, startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 9, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate(), 11, 0), status: 'Confirmed', notes: 'Urgent spin.' },
  { id: 'b5', resourceId: '3', resourceName: 'HPLC System Zeta', userId: 'user2', userName: 'Dr. Charles Babbage', startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 5, 10, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 5, 13, 0), status: 'Pending' },
  { id: 'b6', resourceId: '5', resourceName: 'Confocal Microscope Zeiss', userId: mockCurrentUser.id, userName: mockCurrentUser.name, startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1, 10, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1, 12, 0), status: 'Confirmed', notes: 'Past booking example.' },
];

const timeSlots = Array.from({ length: (17 - 9) * 2 + 1 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

const bookingStatuses: Booking['status'][] = ['Confirmed', 'Pending', 'Cancelled'];
type BookingStatusFilter = Booking['status'] | 'all';


function BookingsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [allUserBookings, setAllUserBookings] = useState<Booking[]>(() => initialBookings.filter(b => b.userId === mockCurrentUser.id));
  
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsedDate = parseISO(dateParam);
      if (isValidDate(parsedDate)) return startOfDay(parsedDate);
    }
    return undefined; 
  });
  
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate || startOfDay(new Date()));
  const [isClient, setIsClient] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Partial<Booking> & { resourceId?: string } | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterResourceId, setFilterResourceId] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<BookingStatusFilter>('all');
  
  useEffect(() => {
    setIsClient(true);
    const resourceIdParam = searchParams.get('resourceId');
    const dateParam = searchParams.get('date');
    const bookingIdParam = searchParams.get('bookingId');

    let dateToSet = selectedDate;
    if (dateParam) {
      const parsedQueryDate = parseISO(dateParam);
      if (isValidDate(parsedQueryDate)) dateToSet = startOfDay(parsedQueryDate);
    }
    
     if (dateToSet && (!selectedDate || selectedDate.getTime() !== dateToSet.getTime())) {
        setSelectedDate(dateToSet);
        setCurrentMonth(dateToSet);
    }

    if (bookingIdParam) {
        if (!isFormOpen || (currentBooking && currentBooking.id !== bookingIdParam)) {
            const bookingToEdit = allUserBookings.find(b => b.id === bookingIdParam);
            if (bookingToEdit) handleOpenForm(bookingToEdit);
        }
    } else if (resourceIdParam && !isFormOpen) {
         if (!currentBooking || (currentBooking && currentBooking.id) || (currentBooking && !currentBooking.id && currentBooking.resourceId !== resourceIdParam)) {
            handleOpenForm(undefined, resourceIdParam);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, isFormOpen, allUserBookings]); 


  const bookingsToDisplay = useMemo(() => {
    let filtered = [...allUserBookings];

    if (selectedDate) {
      filtered = filtered.filter(b => isSameDay(b.startTime, selectedDate));
    }

    if (searchTerm) {
      const lowerSearchTerm = searchTerm.toLowerCase();
      filtered = filtered.filter(b => 
        b.resourceName.toLowerCase().includes(lowerSearchTerm) ||
        (b.notes && b.notes.toLowerCase().includes(lowerSearchTerm))
      );
    }

    if (filterResourceId && filterResourceId !== 'all') {
      filtered = filtered.filter(b => b.resourceId === filterResourceId);
    }

    if (filterStatus && filterStatus !== 'all') {
      filtered = filtered.filter(b => b.status === filterStatus);
    }
    
    return filtered.sort((a, b) => b.startTime.getTime() - a.startTime.getTime()); 
  }, [allUserBookings, selectedDate, searchTerm, filterResourceId, filterStatus]);


  const bookedDatesInMonth = useMemo(() => {
    const dates = new Set<string>();
    allUserBookings.forEach(booking => {
      if (booking.status !== 'Cancelled' && 
          booking.startTime.getFullYear() === currentMonth.getFullYear() &&
          booking.startTime.getMonth() === currentMonth.getMonth()) {
        dates.add(format(startOfDay(booking.startTime), 'yyyy-MM-dd'));
      }
    });
    return dates;
  }, [allUserBookings, currentMonth]);

  const calendarModifiers = {
    booked: (date: Date) => bookedDatesInMonth.has(format(date, 'yyyy-MM-dd')),
    selected: selectedDate ? (date: Date) => isSameDay(date, selectedDate) : undefined,
  };
  
  const calendarModifierStyles = { booked: { position: 'relative' as React.CSSProperties['position'], } };
  
  const handleDateSelect = (date?: Date) => {
    const newSearchParams = new URLSearchParams(searchParams.toString());
    if (date) {
        const newSelectedDate = startOfDay(date);
        setSelectedDate(newSelectedDate);
        setCurrentMonth(newSelectedDate); 
        newSearchParams.set('date', format(newSelectedDate, 'yyyy-MM-dd'));
        if (newSearchParams.has('bookingId')) newSearchParams.delete('bookingId'); 
        if (newSearchParams.has('resourceId') && isFormOpen) { /* keep resourceId */ }
        else if (newSearchParams.has('resourceId')) newSearchParams.delete('resourceId');
    } else {
        setSelectedDate(undefined);
        newSearchParams.delete('date');
    }
    router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
  };
  
  const handleOpenForm = (bookingToEdit?: Booking, resourceIdForNew?: string | null) => {
    const baseDateForNewBooking = selectedDate || startOfDay(new Date());
    const defaultStartTime = set(new Date(baseDateForNewBooking), { hours: 9, minutes: 0, seconds: 0, milliseconds: 0 });

    let bookingData: Partial<Booking> & { resourceId?: string };

    if (bookingToEdit) {
        bookingData = { ...bookingToEdit, startTime: new Date(bookingToEdit.startTime), endTime: new Date(bookingToEdit.endTime), userName: bookingToEdit.userName || mockCurrentUser.name };
    } else {
        bookingData = { 
            startTime: defaultStartTime, 
            endTime: new Date(defaultStartTime.getTime() + 2 * 60 * 60 * 1000),
            userName: mockCurrentUser.name,
            userId: mockCurrentUser.id,
            resourceId: resourceIdForNew || searchParams.get('resourceId') || (mockResources.length > 0 ? mockResources[0].id : ''), 
            status: 'Pending', notes: '',
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
    const resource = mockResources.find(r => r.id === formData.resourceId);
    if (!resource) { toast({ title: "Error", description: "Selected resource not found.", variant: "destructive" }); return; }
    
    const proposedStartTime = new Date(formData.startTime);
    const proposedEndTime = new Date(formData.endTime);

    if (proposedEndTime <= proposedStartTime) { toast({ title: "Invalid Time", description: "End time must be after start time.", variant: "destructive" }); return; }

    const conflictingBooking = initialBookings.find(existingBooking => { 
        if (existingBooking.resourceId !== formData.resourceId) return false;
        if (existingBooking.status === 'Cancelled') return false; 
        if (currentBooking && currentBooking.id && existingBooking.id === currentBooking.id) return false; 
        if(format(existingBooking.startTime, 'yyyy-MM-dd') !== format(proposedStartTime, 'yyyy-MM-dd')) return false;
        const existingStartTime = new Date(existingBooking.startTime);
        const existingEndTime = new Date(existingBooking.endTime);
        return proposedStartTime < existingEndTime && proposedEndTime > existingStartTime;
    });

    if (conflictingBooking) {
        toast({ title: "Booking Conflict", description: `${resource.name} is already booked by ${conflictingBooking.userName} from ${format(conflictingBooking.startTime, 'p')} to ${format(conflictingBooking.endTime, 'p')}.`, variant: "destructive", duration: 7000 });
        return;
    }

    const newBookingData = { ...formData, userId: mockCurrentUser.id, userName: mockCurrentUser.name, startTime: proposedStartTime, endTime: proposedEndTime, resourceName: resource.name, status: formData.status || 'Pending' } as Booking;

    if (currentBooking && currentBooking.id) { 
      setAllUserBookings(prev => prev.map(b => b.id === currentBooking.id ? { ...b, ...newBookingData, id: b.id } : b));
      toast({ title: "Success", description: "Booking updated successfully."});
    } else { 
      const newBookingId = `b${allUserBookings.length + 1 + Date.now()}`;
      setAllUserBookings(prev => [...prev, { ...newBookingData, id: newBookingId }]);
      toast({ title: "Success", description: "Booking created successfully."});
    }
    setIsFormOpen(false); 
  };

  const handleCancelBooking = (bookingId: string) => {
    setAllUserBookings(prev => prev.map(b => b.id === bookingId ? { ...b, status: 'Cancelled' } : b));
    toast({ title: "Info", description: "Booking cancelled."});
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterResourceId('all');
    setFilterStatus('all');
    handleDateSelect(undefined); 
  };
  
  if (!isClient) {
    return <div className="flex justify-center items-center h-screen"><CalendarDays className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg text-muted-foreground">Loading bookings...</p></div>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manage My Bookings"
        description="View, search, filter, and manage your lab resource bookings."
        icon={CalendarDays}
        actions={<Button onClick={() => handleOpenForm()}><PlusCircle className="mr-2 h-4 w-4" /> New Booking</Button>}
      />

      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-lg">
            <CardHeader className="pb-2">
              <CardTitle className="text-xl">Filter by Date</CardTitle>
               <div className="flex justify-between items-center pt-2">
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" /></Button>
                  <span className="font-semibold text-center min-w-[120px]">{format(currentMonth, 'MMMM yyyy')}</span>
                  <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="flex justify-center">
              <Calendar
                mode="single" selected={selectedDate} onSelect={handleDateSelect} month={currentMonth} onMonthChange={setCurrentMonth}
                className="rounded-md border p-3"
                disabled={(date) => date < startOfDay(new Date(new Date().setDate(new Date().getDate() -30))) } 
                modifiers={calendarModifiers} modifiersStyles={calendarModifierStyles}
                footer={
                  selectedDate ? 
                      <Button variant="outline" className="w-full mt-2 text-sm" onClick={() => handleDateSelect(undefined)}>View All My Bookings</Button>
                     : <p className="text-xs text-center text-muted-foreground mt-2">Viewing all your bookings (filtered below).</p>
                }
                classNames={{ day_selected: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary focus:text-primary-foreground', day_today: 'bg-accent text-accent-foreground font-bold', day_disabled: 'text-muted-foreground/50 opacity-50', day_modifier_booked: 'relative day-booked-dot' }}
              />
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle>
                {selectedDate ? `Your Bookings for ${format(selectedDate, 'PPP')}` : 'All Your Bookings'}
                </CardTitle>
                <CardDescription>
                  Use the filters below to narrow down your bookings. {bookingsToDisplay.length} booking(s) currently displayed.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="relative">
                    <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input 
                        type="search" 
                        placeholder="Search by resource name or notes..." 
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                    <Select value={filterResourceId} onValueChange={setFilterResourceId}>
                        <SelectTrigger><SelectValue placeholder="Filter by Resource" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Resources</SelectItem>
                            {mockResources.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as BookingStatusFilter)}>
                        <SelectTrigger><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Statuses</SelectItem>
                            {bookingStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                 <Button onClick={resetFilters} variant="outline" className="w-full sm:w-auto"><FilterX className="mr-2 h-4 w-4"/>Clear All Filters</Button>
            </CardContent>
            <CardContent className="p-0"> {/* Changed from a separate card to be part of the same card */}
                {bookingsToDisplay.length > 0 ? (
                <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead>Resource</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Time</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                    {bookingsToDisplay.map((booking) => (
                        <TableRow key={booking.id} className={cn(booking.status === 'Cancelled' && 'opacity-60')}>
                        <TableCell className="font-medium">{booking.resourceName}</TableCell>
                        <TableCell>{format(new Date(booking.startTime), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{format(new Date(booking.startTime), 'p')} - {format(new Date(booking.endTime), 'p')}</TableCell>
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
                        <TableCell className="text-right">
                            {booking.status !== 'Cancelled' && (
                            <>
                                <Button variant="outline" size="sm" className="h-7 px-2 py-1 text-xs mr-1" onClick={() => handleOpenForm(booking)}>
                                <Edit3 className="mr-1.5 h-3 w-3" /> Edit
                                </Button>
                                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 py-1 text-xs" onClick={() => handleCancelBooking(booking.id)}>
                                <X className="mr-1.5 h-3 w-3" /> Cancel
                                </Button>
                            </>
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
                    <p className="font-medium">No bookings match your current filters.</p>
                    <p className="text-sm">Try adjusting your search or filter criteria, or select a different date.</p>
                    {(searchTerm || (filterResourceId && filterResourceId !== 'all') || (filterStatus && filterStatus !== 'all') || selectedDate) && 
                        <Button variant="outline" onClick={resetFilters} className="mt-4">
                            <FilterX className="mr-2 h-4 w-4" /> Clear All Filters
                        </Button>
                    }
                    {!(searchTerm || (filterResourceId && filterResourceId !== 'all') || (filterStatus && filterStatus !== 'all') || selectedDate) && allUserBookings.length === 0 &&
                         <Button variant="outline" onClick={() => handleOpenForm()} className="mt-4">
                            <PlusCircle className="mr-2 h-4 w-4" /> Create Your First Booking
                        </Button>
                    }
                </div>
                )}
            </CardContent>
            </Card>
        </div>
      </div>

      <Dialog 
        open={isFormOpen} 
        onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) {
                setCurrentBooking(null);
                const newSearchParams = new URLSearchParams(searchParams.toString());
                if (newSearchParams.has('bookingId') || newSearchParams.has('resourceId')) { 
                    newSearchParams.delete('bookingId');
                    newSearchParams.delete('resourceId');
                    router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
                }
            }
        }}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{currentBooking?.id ? 'Edit Booking' : 'Create New Booking'}</DialogTitle>
            <DialogDescription>
              Fill in the details below to {currentBooking?.id ? 'update your' : 'schedule a new'} booking
              {selectedDate && (!currentBooking || !currentBooking.id) && ` for ${format(selectedDate, 'PPP')}`}.
              {!selectedDate && (!currentBooking || !currentBooking.id) && ` (date will be based on start time).`}
            </DialogDescription>
          </DialogHeader>
          <BookingForm
            key={currentBooking?.id || `new:${currentBooking?.resourceId || 'empty'}:${currentBooking?.startTime?.getTime() || 'form'}:${selectedDate?.getTime() || 'nodate'}`}
            initialData={currentBooking} 
            onSave={handleSaveBooking} 
            onCancel={() => setIsFormOpen(false)}
            selectedDateProp={selectedDate} 
            currentUserFullName={mockCurrentUser.name}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function BookingsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center items-center h-screen"><CalendarDays className="h-12 w-12 animate-spin text-primary" /><p className="ml-4 text-lg">Loading...</p></div>}>
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
  const [formData, setFormData] = useState<Partial<Booking>>(() => {
    const isEditing = !!initialData?.id;
    
    let initialResourceId = initialData?.resourceId || (mockResources.length > 0 ? mockResources[0].id : '');
    let initialStartTime: Date;
    let initialEndTime: Date;
    let initialNotes = initialData?.notes || '';
    let initialStatus = initialData?.status || 'Pending';

    if (initialData?.startTime) { 
        initialStartTime = new Date(initialData.startTime);
        initialEndTime = initialData.endTime ? new Date(initialData.endTime) : new Date(initialStartTime.getTime() + 2 * 60 * 60 * 1000);
        
        if (!isEditing && selectedDateProp && startOfDay(initialStartTime).getTime() !== startOfDay(selectedDateProp).getTime()) { 
            initialStartTime = set(initialStartTime, { year: selectedDateProp.getFullYear(), month: selectedDateProp.getMonth(), date: selectedDateProp.getDate() });
            initialEndTime = set(initialEndTime, { year: selectedDateProp.getFullYear(), month: selectedDateProp.getMonth(), date: selectedDateProp.getDate() });
        }
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

  useEffect(() => {
    const isNewBooking = !initialData?.id; 
    if (isNewBooking && selectedDateProp) {
      setFormData(prev => {
        const currentFormStartTime = prev.startTime ? new Date(prev.startTime) : new Date();
        if (startOfDay(currentFormStartTime).getTime() !== startOfDay(selectedDateProp).getTime()) {
            const newStartTime = set(currentFormStartTime, { year: selectedDateProp.getFullYear(), month: selectedDateProp.getMonth(), date: selectedDateProp.getDate() });
            let duration = (prev.endTime ? new Date(prev.endTime).getTime() : 0) - (prev.startTime ? new Date(prev.startTime).getTime() : 0);
            if (duration <= 0) duration = 2 * 60 * 60 * 1000; 
            let newEndTime = new Date(newStartTime.getTime() + duration);
            newEndTime = set(newEndTime, { year: newStartTime.getFullYear(), month: newStartTime.getMonth(), date: newStartTime.getDate() });
            return { ...prev, startTime: newStartTime, endTime: newEndTime };
        }
        return prev;
      });
    }
  }, [selectedDateProp, initialData?.id]);

  const handleChange = (field: keyof Booking | 'resourceId', value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTimeChange = (field: 'startTime' | 'endTime', timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    
    let baseDateForTimeChange: Date;
    if (formData[field]) {
        baseDateForTimeChange = new Date(formData[field]!);
    } else if (selectedDateProp) {
        baseDateForTimeChange = new Date(selectedDateProp);
    } else {
        baseDateForTimeChange = startOfDay(new Date());
    }
     if (!formData.id && selectedDateProp) {
       baseDateForTimeChange = set(selectedDateProp, { hours: new Date().getHours(), minutes: new Date().getMinutes()}); 
    }

    const newDate = set(baseDateForTimeChange, { hours, minutes, seconds: 0, milliseconds: 0 });
    handleChange(field, newDate);

    if (field === 'startTime') {
        const currentStartTime = newDate;
        let duration = 2 * 60 * 60 * 1000; 
        if (formData.startTime && formData.endTime) {
            const existingDuration = new Date(formData.endTime).getTime() - new Date(formData.startTime).getTime();
             if (existingDuration > 0) duration = existingDuration;
        }
        let newAutoEndTime = new Date(currentStartTime.getTime() + duration);
        newAutoEndTime = set(newAutoEndTime, { year: currentStartTime.getFullYear(), month: currentStartTime.getMonth(), date: currentStartTime.getDate() });
        handleChange('endTime', newAutoEndTime);
    }
  };

  const handleSubmit = (e: React.FormEvent) => { e.preventDefault(); onSave(formData); };
  
  const bookingDate = formData.startTime ? format(new Date(formData.startTime), 'PPP') : (selectedDateProp ? format(selectedDateProp, 'PPP') : "Date not set");

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div className="p-2 mb-2 rounded-md border bg-muted/50 text-sm">
        <span className="font-medium">Booking for Date:</span> {bookingDate}
      </div>
      <div>
        <Label htmlFor="resourceId">Resource</Label>
        <Select value={formData.resourceId || ''} onValueChange={(value) => handleChange('resourceId', value)} required>
          <SelectTrigger id="resourceId"><SelectValue placeholder="Select a resource" /></SelectTrigger>
          <SelectContent>
            {mockResources.map(resource => (
              <SelectItem key={resource.id} value={resource.id} disabled={resource.status !== 'Available' && resource.id !== initialData?.resourceId}>
                {resource.name} ({resource.status === 'Available' ? 'Available' : resource.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="userName">Booked By</Label>
        <Input id="userName" value={formData.userName || ''} readOnly className="bg-muted/50"/>
         <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Info size={12} /> This is automatically set for the logged-in user.</p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startTime">Start Time</Label>
           <Select value={formData.startTime ? format(new Date(formData.startTime), 'HH:mm') : ''} onValueChange={(value) => handleTimeChange('startTime', value)} required>
            <SelectTrigger id="startTime"><SelectValue placeholder="Select start time" /></SelectTrigger>
            <SelectContent>{timeSlots.map(slot => <SelectItem key={`start-${slot}`} value={slot}>{slot}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="endTime">End Time</Label>
          <Select value={formData.endTime ? format(new Date(formData.endTime), 'HH:mm') : ''} onValueChange={(value) => handleTimeChange('endTime', value)} required>
            <SelectTrigger id="endTime"><SelectValue placeholder="Select end time" /></SelectTrigger>
            <SelectContent>{timeSlots.map(slot => <SelectItem key={`end-${slot}`} value={slot}>{slot}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
       <div>
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea id="notes" value={formData.notes || ''} onChange={(e) => handleChange('notes', e.target.value)} placeholder="Any specific requirements or purpose of booking..."/>
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initialData?.id ? "Save Changes" : "Create Booking"}</Button>
      </DialogFooter>
    </form>
  );
}
    

    

    
