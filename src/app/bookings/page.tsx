
'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, PlusCircle, Edit3, X, Clock, UserCircle } from 'lucide-react';
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
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Booking, Resource } from '@/types';
import { format, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';

const mockResources: Resource[] = [
  { id: '1', name: 'Electron Microscope Alpha', type: 'Microscope', lab: 'Lab A', status: 'Available', description: '', imageUrl: '' },
  { id: '2', name: 'BioSafety Cabinet Omega', type: 'Incubator', lab: 'Lab B', status: 'Available', description: '', imageUrl: '' },
  { id: '3', name: 'HPLC System Zeta', type: 'HPLC System', lab: 'Lab C', status: 'Available', description: '', imageUrl: '' },
];

const initialBookings: Booking[] = [
  { id: 'b1', resourceId: '1', resourceName: 'Electron Microscope Alpha', userId: 'user1', userName: 'Dr. Ada Lovelace', startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 2, 10, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 2, 12, 0), status: 'Confirmed', notes: 'Routine sample analysis.' },
  { id: 'b2', resourceId: '2', resourceName: 'BioSafety Cabinet Omega', userId: 'user2', userName: 'Dr. Charles Babbage', startTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 3, 14, 0), endTime: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() + 3, 16, 0), status: 'Pending', notes: 'Cell culture experiment setup.' },
];


// Helper to generate time slots
const timeSlots = ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00'];

export default function BookingsPage() {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [bookings, setBookings] = useState<Booking[]>(initialBookings);
  const [isClient, setIsClient] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [currentBooking, setCurrentBooking] = useState<Partial<Booking> | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const bookingsForSelectedDate = selectedDate
    ? bookings.filter(
        (booking) => format(booking.startTime, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd')
      )
    : [];

  const handleDateSelect = (date?: Date) => {
    setSelectedDate(date);
  };
  
  const handleOpenForm = (booking?: Booking) => {
    const defaultStartTime = selectedDate ? new Date(selectedDate) : new Date();
    // Ensure the date part is from selectedDate, time part is default or from booking
    if (selectedDate) {
        defaultStartTime.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    }
    defaultStartTime.setHours(9,0,0,0); // Default to 9 AM on selected day

    let bookingData: Partial<Booking>;
    if (booking) {
        // Ensure startTime and endTime for existing booking are Date objects
        bookingData = {
            ...booking,
            startTime: new Date(booking.startTime),
            endTime: new Date(booking.endTime),
        };
    } else {
        bookingData = { 
            startTime: defaultStartTime, 
            endTime: new Date(defaultStartTime.getTime() + 2 * 60 * 60 * 1000) // Default 2 hour slot
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

    // Conflict detection
    const conflictingBooking = bookings.find(existingBooking => {
        if (existingBooking.resourceId !== formData.resourceId) return false;
        if (existingBooking.status === 'Cancelled') return false; // Ignore cancelled bookings

        // Check if it's the same booking being edited (currentBooking will have an id if editing)
        if (currentBooking && currentBooking.id && existingBooking.id === currentBooking.id) {
            return false;
        }
        
        // Ensure date part matches for comparison
        if(format(existingBooking.startTime, 'yyyy-MM-dd') !== format(proposedStartTime, 'yyyy-MM-dd')) return false;

        const existingStartTime = new Date(existingBooking.startTime);
        const existingEndTime = new Date(existingBooking.endTime);

        // Check for overlap: (StartA < EndB) and (EndA > StartB)
        return proposedStartTime < existingEndTime && proposedEndTime > existingStartTime;
    });

    if (conflictingBooking) {
        toast({
            title: "Booking Conflict",
            description: `This time slot for ${resource.name} is already booked by ${conflictingBooking.userName} from ${format(conflictingBooking.startTime, 'p')} to ${format(conflictingBooking.endTime, 'p')}.`,
            variant: "destructive",
            duration: 5000,
        });
        return;
    }

    const newBookingData = {
        ...formData,
        startTime: proposedStartTime, // ensure it's a Date object
        endTime: proposedEndTime,   // ensure it's a Date object
        resourceName: resource.name,
        status: formData.status || 'Pending', // Default status
    } as Booking;


    if (currentBooking && currentBooking.id) { // Editing existing booking
      setBookings(bookings.map(b => b.id === currentBooking.id ? { ...b, ...newBookingData, id: b.id } : b));
      toast({ title: "Success", description: "Booking updated successfully."});
    } else { // Creating new booking
      setBookings([...bookings, { ...newBookingData, id: `b${bookings.length + 1 + Date.now()}` }]);
      toast({ title: "Success", description: "Booking created successfully."});
    }
    setIsFormOpen(false);
    setCurrentBooking(null);
  };

  const handleCancelBooking = (bookingId: string) => {
    setBookings(bookings.map(b => b.id === bookingId ? { ...b, status: 'Cancelled' } : b));
    toast({ title: "Info", description: "Booking cancelled."});
  };

  const getBookingStatusVariant = (status: Booking['status']): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (status) {
      case 'Confirmed':
        return 'default'; // Primary color (currently red by theme)
      case 'Pending':
        return 'secondary';
      case 'Cancelled':
        return 'outline';
      default:
        return 'outline';
    }
  };

  if (!isClient) {
    return null; // Or a loading spinner
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Booking Calendar"
        description="Manage your lab resource bookings."
        icon={CalendarDays}
        actions={
          <Button onClick={() => handleOpenForm()}>
            <PlusCircle className="mr-2 h-4 w-4" /> New Booking
          </Button>
        }
      />

      <div className="grid md:grid-cols-3 gap-8">
        <Card className="md:col-span-1 shadow-lg">
          <CardHeader>
            <CardTitle>Select Date</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              className="rounded-md border"
              disabled={(date) => date < new Date(new Date().setDate(new Date().getDate() -1)) } // Disable past dates
            />
          </CardContent>
        </Card>

        <Card className="md:col-span-2 shadow-lg">
          <CardHeader>
            <CardTitle>
              Bookings for {selectedDate ? format(selectedDate, 'PPP') : 'selected date'}
            </CardTitle>
            <CardDescription>
              {bookingsForSelectedDate.length > 0 
                ? `${bookingsForSelectedDate.filter(b => b.status !== 'Cancelled').length} active booking(s) found.`
                : "No bookings for this date. Click 'New Booking' to add one."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {bookingsForSelectedDate.length > 0 ? (
              <ul className="space-y-4">
                {bookingsForSelectedDate.map((booking) => (
                  <li key={booking.id} className="p-4 border rounded-lg shadow-sm bg-card hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start">
                        <div>
                            <h3 className="font-semibold text-lg text-primary">{booking.resourceName}</h3>
                            <p className="text-sm text-muted-foreground flex items-center gap-1"><UserCircle size={14}/> {booking.userName}</p>
                        </div>
                         <Badge variant={getBookingStatusVariant(booking.status)}>
                            {booking.status}
                        </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1"><Clock size={14} /> {format(new Date(booking.startTime), 'p')} - {format(new Date(booking.endTime), 'p')}</p>
                    {booking.notes && <p className="text-sm mt-2 pt-2 border-t border-dashed">{booking.notes}</p>}
                    {booking.status !== 'Cancelled' && (
                        <div className="mt-3 flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleOpenForm(booking)}>
                            <Edit3 className="mr-2 h-3 w-3" /> Edit
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => handleCancelBooking(booking.id)}>
                            <X className="mr-2 h-3 w-3" /> Cancel
                        </Button>
                        </div>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-center py-10">
                <CalendarDays className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No bookings scheduled for this day.</p>
                 <Button onClick={() => handleOpenForm()} className="mt-4">
                    <PlusCircle className="mr-2 h-4 w-4" /> Create a Booking
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-[525px]">
          <DialogHeader>
            <DialogTitle>{currentBooking?.id ? 'Edit Booking' : 'Create New Booking'}</DialogTitle>
            <DialogDescription>
              Fill in the details below to {currentBooking?.id ? 'update your' : 'schedule a new'} booking.
            </DialogDescription>
          </DialogHeader>
          <BookingForm 
            initialData={currentBooking} 
            onSave={handleSaveBooking} 
            onCancel={() => setIsFormOpen(false)}
            selectedDate={selectedDate}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}


interface BookingFormProps {
  initialData?: Partial<Booking> | null;
  onSave: (data: Partial<Booking>) => void;
  onCancel: () => void;
  selectedDate?: Date;
}

function BookingForm({ initialData, onSave, onCancel, selectedDate }: BookingFormProps) {
  const [formData, setFormData] = useState<Partial<Booking>>(() => {
    const baseDate = initialData?.startTime ? new Date(initialData.startTime) : (selectedDate || new Date());
    if (selectedDate) { // Ensure form date matches selected calendar date for new bookings
        baseDate.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    }
    
    if (initialData) {
        return {
            ...initialData,
            startTime: new Date(initialData.startTime!),
            endTime: new Date(initialData.endTime!),
        };
    }
    
    const defaultStartTime = new Date(baseDate);
    defaultStartTime.setHours(9,0,0,0);
    const defaultEndTime = new Date(defaultStartTime.getTime() + 2 * 60 * 60 * 1000); // Default 2h

    return { startTime: defaultStartTime, endTime: defaultEndTime, resourceId: '', userName: '', notes: '' };
  });


  useEffect(() => {
    if (initialData) {
        const newStartTime = new Date(initialData.startTime!);
        const newEndTime = new Date(initialData.endTime!);
        // If selectedDate is provided and we are editing, ensure date part of initialData aligns
        // This is mainly for when opening an existing booking from a different date view
        if (selectedDate && format(newStartTime, 'yyyy-MM-dd') !== format(selectedDate, 'yyyy-MM-dd')) {
             newStartTime.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
             newEndTime.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
             // Keep original times if possible, or reset if date change makes times invalid (e.g., across DST)
             // For simplicity, we'll keep the hour/minute from initialData here.
             newStartTime.setHours(new Date(initialData.startTime!).getHours(), new Date(initialData.startTime!).getMinutes());
             newEndTime.setHours(new Date(initialData.endTime!).getHours(), new Date(initialData.endTime!).getMinutes());
        }
        setFormData(prev => ({ ...prev, ...initialData, startTime: newStartTime, endTime: newEndTime }));

    } else if (selectedDate) {
        const newStartTime = new Date(selectedDate);
        newStartTime.setHours(9,0,0,0); // Default 9 AM
        const newEndTime = new Date(newStartTime.getTime() + 2 * 60 * 60 * 1000); // Default 2h slot
        setFormData(prev => ({ 
            ...prev, 
            startTime: newStartTime, 
            endTime: newEndTime,
            resourceId: prev.resourceId || '', // Retain other fields if any
            userName: prev.userName || '',
            notes: prev.notes || ''
        }));
    }
  }, [initialData, selectedDate]);


  const handleChange = (field: keyof Booking, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleTimeChange = (field: 'startTime' | 'endTime', timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    // Base the new Date on the existing date in formData for that field, or selectedDate if not set
    let baseDateForTimeChange = formData[field] ? new Date(formData[field]!) : (selectedDate || new Date());
    
    // Ensure the date part is from selectedDate if opening a new form or if start/end times are being set
    // This keeps the date consistent with the calendar selection.
    if (selectedDate) {
        baseDateForTimeChange.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    }

    const newDate = new Date(baseDateForTimeChange);
    newDate.setHours(hours, minutes, 0, 0);
    handleChange(field, newDate);
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
            {mockResources.filter(r => r.status === 'Available' || r.id === initialData?.resourceId).map(resource => (
              <SelectItem key={resource.id} value={resource.id}>{resource.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="userName">Your Name</Label>
        <Input 
          id="userName" 
          value={formData.userName || ''} 
          onChange={(e) => handleChange('userName', e.target.value)} 
          required 
          placeholder="e.g., Dr. Marie Curie"
        />
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
      <DialogFooter>
        <DialogClose asChild>
            <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        </DialogClose>
        <Button type="submit">Save Booking</Button>
      </DialogFooter>
    </form>
  );
}

