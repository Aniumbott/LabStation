
'use client';

import { useState, useEffect, useMemo } from 'react'; // Added useMemo here
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from '@/components/ui/calendar';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { Resource } from '@/types';
import { format, startOfDay, isValid, parseISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Label } from '../ui/label';

const timeSlotsExamples = [
  "09:00-17:00 (Full Day)",
  "09:00-12:00, 13:00-17:00 (With Lunch Break)",
  "10:00-10:30, 14:00-14:30 (Specific short slots)"
];

interface ManageAvailabilityDialogProps {
  resource: Resource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (date: string, newSlots: string[]) => void;
}

export function ManageAvailabilityDialog({ resource, open, onOpenChange, onSave }: ManageAvailabilityDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => startOfDay(new Date()));
  const [availabilitySlots, setAvailabilitySlots] = useState<string>('');
  const [isUnavailable, setIsUnavailable] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const currentAvailability = resource.availability?.find(avail => avail.date === dateStr);
      if (currentAvailability) {
        setAvailabilitySlots(currentAvailability.slots.join(', '));
        // Ensure isUnavailable is true if slots array is empty, even if it has other non-string values from bad data
        setIsUnavailable(currentAvailability.slots.length === 0);
      } else {
        setAvailabilitySlots('');
        setIsUnavailable(false);
      }
    } else if (open && !selectedDate) {
      setSelectedDate(startOfDay(new Date()));
      setAvailabilitySlots('');
      setIsUnavailable(false);
    }
  }, [open, selectedDate, resource.availability]);

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(startOfDay(date));
    }
  };

  const handleSaveClick = () => {
    if (!selectedDate) {
      toast({ title: "Error", description: "Please select a date.", variant: "destructive" });
      return;
    }
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    let finalSlots: string[] = [];

    if (isUnavailable) {
      finalSlots = [];
    } else {
      finalSlots = availabilitySlots
        .split(',')
        .map(s => s.trim())
        .filter(s => {
          // Basic validation for slot format HH:mm-HH:mm
          const slotRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
          if (s === '' || !slotRegex.test(s)) {
            if (s !== '') { // Only toast if there was an attempt at a slot
                 toast({
                    title: "Invalid Slot Format",
                    description: `Slot "${s}" is not in HH:mm-HH:mm format and will be ignored.`,
                    variant: "destructive",
                    duration: 5000
                });
            }
            return false;
          }
          // Further validation: start time < end time
          try {
            const [startStr, endStr] = s.split('-');
            const [startH, startM] = startStr.split(':').map(Number);
            const [endH, endM] = endStr.split(':').map(Number);
            if (startH > endH || (startH === endH && startM >= endM)) {
                 toast({
                    title: "Invalid Slot Time",
                    description: `In slot "${s}", start time must be before end time. It will be ignored.`,
                    variant: "destructive",
                    duration: 5000
                });
                return false;
            }
          } catch (e) {
            // Catch parsing errors just in case, though regex should prevent most
             toast({
                title: "Slot Parsing Error",
                description: `Error parsing slot "${s}". It will be ignored.`,
                variant: "destructive",
                duration: 5000
            });
            return false;
          }
          return true;
        });
      
      if (finalSlots.length === 0 && availabilitySlots.trim() !== '') {
        toast({ title: "No Valid Slots", description: "No valid time slots were entered after processing. Please check the format (HH:mm-HH:mm) and ensure start time is before end time for each slot. Saving as unavailable for now.", variant: "default", duration: 7000 });
      }
    }
    
    onSave(dateStr, finalSlots);
    // onOpenChange(false); // Dialog is typically closed by the parent page after successful save
  };
  
  const currentSavedSlotsForDate = useMemo(() => {
    if (!selectedDate || !resource.availability) return 'Not defined (assumed generally available or needs setup)';
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const existing = resource.availability.find(a => a.date === dateStr);
    if (existing) {
      return existing.slots.length > 0 ? existing.slots.join(', ') : 'Marked as unavailable';
    }
    return 'Not defined for this date';
  }, [selectedDate, resource.availability]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Availability for "{resource.name}"</DialogTitle>
          <DialogDescription>
            Select a date and define available time slots or mark the day as unavailable. Changes apply only to the selected date.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <ScrollArea className="h-[65vh] pr-4">
          <div className="grid md:grid-cols-2 gap-6 py-4">
            <div className="flex flex-col items-center">
              <Label className="mb-2 text-center font-semibold">Select Date</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className="rounded-md border"
                disabled={(date) => date < startOfDay(new Date())} 
              />
            </div>
            <div className="space-y-4">
              <h3 className="font-semibold text-lg">
                Set Availability for: {selectedDate ? format(selectedDate, 'PPP') : 'No date selected'}
              </h3>
              
              <div className="space-y-1">
                <Label htmlFor="availabilitySlots">Available Time Slots</Label>
                <Textarea
                  id="availabilitySlots"
                  placeholder="e.g., 09:00-12:00, 13:00-17:00"
                  value={availabilitySlots}
                  onChange={(e) => setAvailabilitySlots(e.target.value)}
                  disabled={isUnavailable || !selectedDate}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Enter comma-separated time ranges (HH:mm-HH:mm). Examples:
                </p>
                <ul className="text-xs text-muted-foreground list-disc pl-5">
                  {timeSlotsExamples.map(ex => <li key={ex}>{ex}</li>)}
                </ul>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <Checkbox
                  id="isUnavailable"
                  checked={isUnavailable}
                  onCheckedChange={(checked) => setIsUnavailable(checked as boolean)}
                  disabled={!selectedDate}
                />
                <Label htmlFor="isUnavailable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Mark entire day as Unavailable
                </Label>
              </div>
              
              {selectedDate && (
                <div className="pt-2">
                  <p className="text-sm font-medium text-muted-foreground">Current saved slots for {format(selectedDate, 'PPP')}:</p>
                  <p className="text-sm p-2 bg-muted rounded-md min-h-[2.5rem] mt-1 break-words">
                    {currentSavedSlotsForDate}
                  </p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
        <Separator />
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSaveClick} disabled={!selectedDate}>Save Availability</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

