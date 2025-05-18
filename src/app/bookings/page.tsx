
'use client';

import { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { CalendarDays, PlusCircle, Edit3, X, Clock, UserCircle, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { Booking, Resource, RoleName } from '@/types';
import { format, parseISO, isValid as isValidDate, startOfDay, addMonths, subMonths, isSameDay, eachDayOfInterval, set } from 'date-fns';
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

const initialBookings: Booking[] = [
  { id: 'b1', resourceId: '1', resourceName: 'Electron Microscope Alpha', userId: 'user1', userName: 'Dr. Ada Lovelace', startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 2, 10, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 2, 12, 0), status: 'Confirmed', notes: 'Routine sample analysis.' },
  { id: 'b2', resourceId: '2', resourceName: 'BioSafety Cabinet Omega', userId: 'user2', userName: 'Dr. Charles Babbage', startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 3, 14, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 3, 16, 0), status: 'Pending', notes: 'Cell culture experiment setup.' },
  { id: 'b3', resourceId: '1', resourceName: 'Electron Microscope Alpha', userId: 'user3', userName: 'Dr. Grace Hopper', startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 2, 14, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 2, 15, 0), status: 'Confirmed', notes: 'Quick check.' },
];

const mockCurrentUser = {
  id: 'user_authed_123',
  name: 'Dr. Lab User',
  email: 'lab.user@labstation.com',
  role: 'Researcher' as RoleName,
};

const timeSlots = Array.from({ length: (17 - 9) * 2 + 1 }, (_, i) => {
  const hour = 9 + Math.floor(i / 2);
  const minute = i % 2 === 0 ? '00' : '30';
  return `${String(hour).padStart(2, '0')}:${minute}`;
});

function BookingsPageContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => {
    const dateParam = searchParams.get('date');
    if (dateParam) {
      const parsedDate = parseISO(dateParam);
      if (isValidDate(parsedDate)) {
        return startOfDay(parsedDate);
      }
    }
    return startOfDay(new Date());
  });
  
  const [currentMonth, setCurrentMonth] = useState<Date>(selectedDate || startOfDay(new Date()));
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [isClient, setIsClient] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Partial<Booking> & { resourceId?: string } | null>(null);
  
  useEffect(() => {
    setIsClient(true);
    const resourceIdParam = searchParams.get('resourceId');
    const dateParam = searchParams.get('date');
    const bookingIdParam = searchParams.get('bookingId');

    if (dateParam) {
      const parsedQueryDate = parseISO(dateParam);
      if (isValidDate(parsedQueryDate)) {
        const newUrlDate = startOfDay(parsedQueryDate);
        setSelectedDate(prevSelectedDate => {
            if (!prevSelectedDate || prevSelectedDate.getTime() !== newUrlDate.getTime()){
                return newUrlDate;
            }
            return prevSelectedDate;
        });
        setCurrentMonth(newUrlDate);
      }
    }
    
    if (bookingIdParam) {
        if (!isFormOpen || (currentBooking && currentBooking.id !== bookingIdParam)) {
            const bookingToEdit = bookings.find(b => b.id === bookingIdParam);
            if (bookingToEdit) {
                handleOpenForm(bookingToEdit);
            }
        }
    } else if (resourceIdParam && !isFormOpen) {
        if (!currentBooking || (currentBooking && currentBooking.id) || (currentBooking && !currentBooking.id && currentBooking.resourceId !== resourceIdParam)) {
            handleOpenForm(undefined, resourceIdParam);
        }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]); 

  const bookingsForSelectedDate = selectedDate
    ? bookings.filter(
        (booking) => format(booking.startTime, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
      ).sort((a, b) => a.startTime.getTime() - b.startTime.getTime())
    : [];

  const bookedDatesInMonth = useMemo(() => {
    const dates = new Set<string>();
    bookings.forEach(booking => {
      if (booking.status !== 'Cancelled' && 
          booking.startTime.getFullYear() === currentMonth.getFullYear() &&
          booking.startTime.getMonth() === currentMonth.getMonth()) {
        dates.add(format(startOfDay(booking.startTime), 'yyyy-MM-dd'));
      }
    });
    return dates;
  }, [bookings, currentMonth]);

  const calendarModifiers = {
    booked: (date: Date) => bookedDatesInMonth.has(format(date, 'yyyy-MM-dd')),
    selected: selectedDate ? (date: Date) => isSameDay(date, selectedDate) : undefined,
  };
  
  const calendarModifierStyles = {
    booked: { 
      // Uses a ::after pseudo-element to add a dot
      position: 'relative' as React.CSSProperties['position'],
    }, 
    // This style is for the dot itself, applied via globals.css for the ::after
  };
  

  const handleDateSelect = (date?: Date) => {
    if (date) {
        const newSelectedDate = startOfDay(date);
        setSelectedDate(newSelectedDate);
        setCurrentMonth(newSelectedDate); 
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.set('date', format(newSelectedDate, 'yyyy-MM-dd'));
        if (newSearchParams.has('bookingId')) newSearchParams.delete('bookingId'); // Clear bookingId if selecting new date
        if (newSearchParams.has('resourceId') && isFormOpen) { /* keep resourceId if form is open for new booking */ }
        else if (newSearchParams.has('resourceId')) newSearchParams.delete('resourceId');

        router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    } else {
        setSelectedDate(undefined);
    }
  };
  
  const handleOpenForm = (bookingToEdit?: Booking, resourceIdForNew?: string | null) => {
    const baseDateForNewBooking = selectedDate || startOfDay(new Date());
    const defaultStartTime = new Date(baseDateForNewBooking);
    defaultStartTime.setHours(9,0,0,0);

    let bookingData: Partial<Booking> & { resourceId?: string };

    if (bookingToEdit) {
        bookingData = {
            ...bookingToEdit,
            startTime: new Date(bookingToEdit.startTime), 
            endTime: new Date(bookingToEdit.endTime),
            userName: bookingToEdit.userName || mockCurrentUser.name,
        };
    } else {
        bookingData = { 
            startTime: defaultStartTime, 
            endTime: new Date(defaultStartTime.getTime() + 2 * 60 * 60 * 1000), // Default 2hr slot
            userName: mockCurrentUser.name,
            resourceId: resourceIdForNew || searchParams.get('resourceId') || (mockResources.length > 0 ? mockResources[0].id : ''), 
            status: 'Pending',
            notes: '',
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
    if (!resource) {
        toast({ title: "Error", description: "Selected resource not found.", variant: "destructive" });
        return;
    }
    
    const proposedStartTime = new Date(formData.startTime);
    const proposedEndTime = new Date(formData.endTime);

    if (proposedEndTime <= proposedStartTime) {
        toast({ title: "Invalid Time", description: "End time must be after start time.", variant: "destructive" });
        return;
    }

    const conflictingBooking = bookings.find(existingBooking => {
        if (existingBooking.resourceId !== formData.resourceId) return false;
        if (existingBooking.status === 'Cancelled') return false; 
        // If editing, ignore conflict with itself
        if (currentBooking && currentBooking.id && existingBooking.id === currentBooking.id) return false;
        
        // Ensure we are comparing bookings on the same day
        if(format(existingBooking.startTime, 'yyyy-MM-dd') !== format(proposedStartTime, 'yyyy-MM-dd')) return false;

        const existingStartTime = new Date(existingBooking.startTime);
        const existingEndTime = new Date(existingBooking.endTime);
        // Check for overlap: (StartA < EndB) and (EndA > StartB)
        return proposedStartTime < existingEndTime && proposedEndTime > existingStartTime;
    });

    if (conflictingBooking) {
        toast({
            title: "Booking Conflict",
            description: `${resource.name} is already booked by ${conflictingBooking.userName} from ${format(conflictingBooking.startTime, 'p')} to ${format(conflictingBooking.endTime, 'p')}.`,
            variant: "destructive",
            duration: 7000,
        });
        return;
    }

    const newBookingData = {
        ...formData,
        startTime: proposedStartTime,
        endTime: proposedEndTime,
        resourceName: resource.name,
        status: formData.status || 'Pending',
    } as Booking;


    if (currentBooking && currentBooking.id) { 
      setBookings(bookings.map(b => b.id === currentBooking.id ? { ...b, ...newBookingData, id: b.id } : b));
      toast({ title: "Success", description: "Booking updated successfully."});
    } else { 
      setBookings([...bookings, { ...newBookingData, id: `b${bookings.length + 1 + Date.now()}` }]);
      toast({ title: "Success", description: "Booking created successfully."});
    }
    setIsFormOpen(false); 
  };

  const handleCancelBooking = (bookingId: string) => {
    setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: 'Cancelled' } : b));
    toast({ title: "Info", description: "Booking cancelled."});
  };

  const getBookingStatusVariant = (status: Booking['status']): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (status) {
      case 'Confirmed': return 'default'; 
      case 'Pending': return 'secondary';
      case 'Cancelled': return 'outline';
      default: return 'outline';
    }
  };
  

  if (!isClient) {
    return (
        <div className="flex justify-center items-center h-screen">
            <CalendarDays className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-muted-foreground">Loading calendar...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Booking Calendar"
        description="Manage your lab resource bookings. Select a date to view or add bookings."
        icon={CalendarDays}
        actions={
          <Button onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Booking
          </Button>
        }
      />

      <div className="grid md:grid-cols-3 gap-8 items-start">
        <Card className="md:col-span-1 shadow-lg">
          <CardHeader className="pb-2">
            <CardTitle className="text-xl">Select Date</CardTitle>
             <div className="flex justify-between items-center pt-2">
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} aria-label="Previous month">
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="font-semibold text-center min-w-[120px]">
                    {format(currentMonth, 'MMMM yyyy')}
                </span>
                <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} aria-label="Next month">
                    <ChevronRight className="h-4 w-4" />
                </Button>
            </div>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              month={currentMonth}
              onMonthChange={setCurrentMonth}
              className="rounded-md border p-3"
              disabled={(date) => date < startOfDay(new Date(new Date().setDate(new Date().getDate() -1))) } // Disable past dates
              modifiers={calendarModifiers}
              modifiersStyles={calendarModifierStyles}
              classNames={{
                day_selected: 'bg-primary text-primary-foreground hover:bg-primary/90 focus:bg-primary focus:text-primary-foreground',
                day_today: 'bg-accent text-accent-foreground font-bold',
                day_disabled: 'text-muted-foreground/50 opacity-50',
                // Style for the dot using a pseudo-element, see globals.css
                day_modifier_booked: 'relative day-booked-dot', 
              }}
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-lg min-h-[300px]">
          <CardHeader>
            <CardTitle>
              Bookings for {selectedDate ? format(selectedDate, 'PPP') : 'selected date'}
            </CardTitle>
            <CardDescription>
              {bookingsForSelectedDate.length > 0 
                ? `${bookingsForSelectedDate.filter(b => b.status !== 'Cancelled').length} active booking(s).`
                : "No bookings for this date."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookingsForSelectedDate.length > 0 ? (
              <ul className="space-y-3">
                {bookingsForSelectedDate.map((booking) => (
                  <li 
                    key={booking.id} 
                    className={cn(
                        "p-3 border rounded-lg shadow-sm bg-card hover:shadow-md transition-shadow",
                        booking.status === 'Cancelled' && 'opacity-60 bg-muted/50'
                    )}
                  >
                    <div className="flex justify-between items-start gap-2">
                        <div>
                            <h3 className="font-semibold text-md text-primary">{booking.resourceName}</h3>
                            <p className="text-xs text-muted-foreground flex items-center gap-1"><UserCircle size={13}/> {booking.userName}</p>
                        </div>
                         <Badge variant={getBookingStatusVariant(booking.status)} className="whitespace-nowrap text-xs px-2 py-0.5">
                            {booking.status}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1"><Clock size={13} /> {format(new Date(booking.startTime), 'p')} - {format(new Date(booking.endTime), 'p')}</p>
                    {booking.notes && <p className="text-xs mt-2 pt-2 border-t border-dashed">{booking.notes}</p>}
                    {booking.status !== 'Cancelled' && (
                        <div className="mt-2.5 flex gap-2">
                        <Button size="sm" variant="outline" className="h-7 px-2 py-1 text-xs" onClick={() => handleOpenForm(booking)}>
                            <Edit3 className="mr-1.5 h-3 w-3" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-7 px-2 py-1 text-xs" onClick={() => handleCancelBooking(booking.id)}>
                            <X className="mr-1.5 h-3 w-3" /> Cancel
                        </Button>
                        </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-10 text-muted-foreground">
                <CalendarDays className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>No bookings scheduled for this day.</p>
                 <Button variant="outline" onClick={() => handleOpenForm(undefined, selectedDate ? undefined : searchParams.get('resourceId'))} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" /> Create a Booking for {selectedDate ? format(selectedDate, 'MMM do') : 'this day'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog 
        open={isFormOpen} 
        onOpenChange={(isOpen) => {
            setIsFormOpen(isOpen);
            if (!isOpen) {
                setCurrentBooking(null);
                const newSearchParams = new URLSearchParams(searchParams.toString());
                if (newSearchParams.has('bookingId')) {
                    newSearchParams.delete('bookingId');
                    router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
                }
                 // Optionally clear resourceId if it was only for pre-filling a new booking
                // and not tied to an ongoing edit (which bookingId would handle)
                if (newSearchParams.has('resourceId') && !currentBooking?.id) { 
                    // newSearchParams.delete('resourceId'); // Decided against this to allow re-opening with same resource
                }
            }
        }}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{currentBooking?.id ? 'Edit Booking' : 'Create New Booking'}</DialogTitle>
            <DialogDescription>
              Fill in the details below to {currentBooking?.id ? 'update your' : 'schedule a new'} booking
              {selectedDate && (!currentBooking || !currentBooking.id) && ` for ${format(selectedDate, 'PPP')}`}.
            </DialogDescription>
          </DialogHeader>
          <BookingForm
            key={currentBooking?.id || `new:${currentBooking?.resourceId || 'empty'}:${currentBooking?.startTime?.getTime() || selectedDate?.getTime()}`}
            initialData={currentBooking} 
            onSave={handleSaveBooking} 
            onCancel={() => {
                setIsFormOpen(false); 
            }}
            selectedDate={selectedDate}
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
  selectedDate?: Date; 
  currentUserFullName: string;
}

function BookingForm({ initialData, onSave, onCancel, selectedDate, currentUserFullName }: BookingFormProps) {
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
        
        // If creating NEW booking (not editing) AND selectedDate from calendar is available,
        // ensure the form's date part uses the calendar's selectedDate.
        if (!isEditing && selectedDate) {
            initialStartTime = set(initialStartTime, { 
                year: selectedDate.getFullYear(), 
                month: selectedDate.getMonth(), 
                date: selectedDate.getDate() 
            });
            initialEndTime = set(initialEndTime, {
                year: selectedDate.getFullYear(),
                month: selectedDate.getMonth(),
                date: selectedDate.getDate()
            });
        }

    } else { 
        const baseDate = selectedDate || startOfDay(new Date()); 
        initialStartTime = new Date(baseDate);
        initialStartTime.setHours(9, 0, 0, 0); 
        initialEndTime = new Date(initialStartTime.getTime() + 2 * 60 * 60 * 1000);
    }
    
    if (initialEndTime <= initialStartTime) {
        initialEndTime = new Date(initialStartTime.getTime() + 2 * 60 * 60 * 1000);
    }

    return {
        id: initialData?.id,
        resourceId: initialResourceId,
        userName: initialData?.userName || currentUserFullName,
        startTime: initialStartTime,
        endTime: initialEndTime,
        status: initialStatus,
        notes: initialNotes,
    };
  });

  useEffect(() => {
    const isNewBooking = !initialData?.id; 
    if (isNewBooking && selectedDate) {
      setFormData(prev => {
        const currentFormStartTime = prev.startTime ? new Date(prev.startTime) : new Date();
        if (startOfDay(currentFormStartTime).getTime() !== startOfDay(selectedDate).getTime()) {
            const newStartTime = set(currentFormStartTime, {
                year: selectedDate.getFullYear(),
                month: selectedDate.getMonth(),
                date: selectedDate.getDate()
            });

            const duration = (prev.endTime ? new Date(prev.endTime).getTime() : 0) - (prev.startTime ? new Date(prev.startTime).getTime() : 0);
            let newEndTime = new Date(newStartTime.getTime() + Math.max(duration, 30 * 60 * 1000)); // Min 30 min duration

            if (newEndTime <= newStartTime) { // Ensure end time is after start
                 newEndTime = new Date(newStartTime.getTime() + 2 * 60 * 60 * 1000); // Default 2hr
            }
             // Ensure endTime has same date part as newStartTime
            newEndTime = set(newEndTime, {
                year: newStartTime.getFullYear(),
                month: newStartTime.getMonth(),
                date: newStartTime.getDate()
            });

            return { ...prev, startTime: newStartTime, endTime: newEndTime };
        }
        return prev;
      });
    }
  }, [selectedDate, initialData?.id]);


  const handleChange = (field: keyof Booking | 'resourceId', value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTimeChange = (field: 'startTime' | 'endTime', timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    
    let baseDateForTimeChange: Date;
    if (formData.id && formData[field]) { 
        baseDateForTimeChange = new Date(formData[field]!);
    } else if (selectedDate) { 
        baseDateForTimeChange = new Date(selectedDate);
    } else { 
        baseDateForTimeChange = startOfDay(new Date());
    }

    const newDate = set(baseDateForTimeChange, { hours, minutes, seconds: 0, milliseconds: 0 });
    handleChange(field, newDate);

    if (field === 'startTime') {
        const currentStartTime = newDate;
        let duration = 2 * 60 * 60 * 1000; // Default 2 hours

        if (formData.startTime && formData.endTime) {
            const existingDuration = new Date(formData.endTime).getTime() - new Date(formData.startTime).getTime();
             if (existingDuration > 0) duration = existingDuration;
        }
        
        let newAutoEndTime = new Date(currentStartTime.getTime() + duration);
        newAutoEndTime = set(newAutoEndTime, { // Ensure date part matches start time's date
            year: currentStartTime.getFullYear(),
            month: currentStartTime.getMonth(),
            date: currentStartTime.getDate()
        });
        
        handleChange('endTime', newAutoEndTime);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4">
      <div>
        <Label htmlFor="resourceId">Resource</Label>
        <Select
          value={formData.resourceId || ''}
          onValueChange={(value) => handleChange('resourceId', value)}
          required
        >
          <SelectTrigger id="resourceId">
            <SelectValue placeholder="Select a resource" />
          </SelectTrigger>
          <SelectContent>
            {mockResources.map(resource => (
              <SelectItem 
                key={resource.id} 
                value={resource.id}
                disabled={resource.status !== 'Available' && resource.id !== initialData?.resourceId}
              >
                {resource.name} ({resource.status === 'Available' ? 'Available' : resource.status})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="userName">Booked By</Label>
        <Input 
          id="userName" 
          value={formData.userName || ''} 
          readOnly 
          className="bg-muted/50"
        />
         <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
            <Info size={12} /> This is automatically set for the logged-in user.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="startTime">Start Time</Label>
           <Select
            value={formData.startTime ? format(new Date(formData.startTime), 'HH:mm') : ''}
            onValueChange={(value) => handleTimeChange('startTime', value)}
            required
          >
            <SelectTrigger id="startTime">
              <SelectValue placeholder="Select start time" />
            </SelectTrigger>
            <SelectContent>
              {timeSlots.map(slot => <SelectItem key={`start-${slot}`} value={slot}>{slot}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="endTime">End Time</Label>
          <Select
            value={formData.endTime ? format(new Date(formData.endTime), 'HH:mm') : ''}
            onValueChange={(value) => handleTimeChange('endTime', value)}
            required
          >
            <SelectTrigger id="endTime">
              <SelectValue placeholder="Select end time" />
            </SelectTrigger>
            <SelectContent>
              {timeSlots.map(slot => <SelectItem key={`end-${slot}`} value={slot}>{slot}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
       <div>
        <Label htmlFor="notes">Notes (Optional)</Label>
        <Textarea 
          id="notes" 
          value={formData.notes || ''} 
          onChange={(e) => handleChange('notes', e.target.value)}
          placeholder="Any specific requirements or purpose of booking..."
        />
      </div>
      <DialogFooter className="pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit">{initialData?.id ? "Save Changes" : "Create Booking"}</Button>
      </DialogFooter>
    </form>
  );
}

    