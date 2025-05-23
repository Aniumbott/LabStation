
'use client';

import { useState, useEffect, useMemo } from 'react';
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
import { format, startOfDay, isValid, parseISO, addDays } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Label } from '../ui/label';
import { Loader2, Save } from 'lucide-react'; // Added Loader2 and Save

const timeSlotsExamples = [
  "09:00-17:00 (Full Day)",
  "09:00-12:00, 13:00-17:00 (With Lunch Break)",
  "10:00-10:30, 14:00-14:30 (Specific short slots)"
];

interface ManageAvailabilityDialogProps {
  resource: Resource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (date: string, newSlots: string[]) => Promise<void>; // Make onSave async
}

export function ManageAvailabilityDialog({ resource, open, onOpenChange, onSave }: ManageAvailabilityDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => startOfDay(new Date()));
  const [availabilitySlots, setAvailabilitySlots] = useState<string>('');
  const [isUnavailable, setIsUnavailable] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open) {
        setIsSubmitting(false); // Reset submitting state
        const initialDate = startOfDay(new Date());
        setSelectedDate(initialDate); // Always default to today on open or re-evaluate if prop changes
        
        const dateStr = format(initialDate, 'yyyy-MM-dd');
        const currentAvailability = resource.availability?.find(avail => avail.date === dateStr);
        if (currentAvailability) {
            setAvailabilitySlots(currentAvailability.slots.join(', '));
            setIsUnavailable(currentAvailability.slots.length === 0 && currentAvailability.slots !== undefined); // Explicitly unavailable
        } else {
            setAvailabilitySlots(''); // Default for a new date
            setIsUnavailable(false);
        }
    }
  }, [open, resource.availability]); // Only react to open and resource.availability changing (e.g. new resource selected)

  // Effect to update form when selectedDate changes
  useEffect(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const currentAvailability = resource.availability?.find(avail => avail.date === dateStr);
      if (currentAvailability) {
        setAvailabilitySlots(currentAvailability.slots.join(', '));
        setIsUnavailable(currentAvailability.slots.length === 0 && currentAvailability.slots !== undefined);
      } else {
        setAvailabilitySlots('');
        setIsUnavailable(false);
      }
    }
  }, [selectedDate, resource.availability]);


  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(startOfDay(date));
    }
  };

  const handleSaveClick = async () => {
    if (!selectedDate) {
      toast({ title: "Error", description: "Please select a date.", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    let finalSlots: string[] = [];

    if (isUnavailable) {
      finalSlots = []; // Explicitly mark as unavailable by empty slots array
    } else {
      finalSlots = availabilitySlots
        .split(',')
        .map(s => s.trim())
        .filter(s => {
          const slotRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
          if (s === '') return false; // Ignore empty strings from split
          if (!slotRegex.test(s)) {
            toast({ title: "Invalid Slot Format", description: `Slot "${s}" is not in HH:mm-HH:mm format. It will be ignored.`, variant: "destructive", duration: 5000 });
            return false;
          }
          try {
            const [startStrFull, endStrFull] = s.split('-');
            const [startH, startM] = startStrFull.split(':').map(Number);
            const [endH, endM] = endStrFull.split(':').map(Number);
            if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM) || startH < 0 || startH > 23 || startM < 0 || startM > 59 || endH < 0 || endH > 23 || endM < 0 || endM > 59) {
                 toast({ title: "Invalid Time Value", description: `Slot "${s}" contains invalid hour or minute values. It will be ignored.`, variant: "destructive", duration: 5000 }); return false;
            }
            if (startH > endH || (startH === endH && startM >= endM)) {
                 toast({ title: "Invalid Slot Time", description: `In slot "${s}", start time must be before end time. It will be ignored.`, variant: "destructive", duration: 5000 });
                return false;
            }
          } catch (e) {
             toast({ title: "Slot Parsing Error", description: `Error parsing slot "${s}". It will be ignored.`, variant: "destructive", duration: 5000 });
            return false;
          }
          return true;
        });

      if (finalSlots.length === 0 && availabilitySlots.trim() !== '' && !isUnavailable) {
        // User entered text but it was all invalid, effectively making it unavailable
        toast({ title: "No Valid Slots", description: "No valid time slots were entered. Please check format (HH:mm-HH:mm) and times. Saving as unavailable for this date.", variant: "default", duration: 7000 });
      }
    }
    try {
        await onSave(dateStr, finalSlots);
        // Parent handles closing dialog on success
    } catch (error) {
        // Error toast handled by parent's onSave implementation
        console.error("Error in ManageAvailabilityDialog handleSaveClick:", error);
    } finally {
        setIsSubmitting(false);
    }
  };

  const currentSavedSlotsForDate = useMemo(() => {
    if (!selectedDate || !resource.availability) return 'Not defined';
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
            Select a date and define available time slots or mark the day as unavailable.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <ScrollArea className="max-h-[65vh] overflow-y-auto pr-2">
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
                  disabled={isUnavailable || !selectedDate || isSubmitting}
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
                  onCheckedChange={(checked) => {
                      setIsUnavailable(checked as boolean);
                      if (checked) setAvailabilitySlots(''); // Clear slots if marked unavailable
                  }}
                  disabled={!selectedDate || isSubmitting}
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
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={handleSaveClick} disabled={!selectedDate || isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSubmitting ? 'Saving...' : 'Save Availability'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
