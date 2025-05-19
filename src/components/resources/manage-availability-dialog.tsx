
'use client';

import { useState, useEffect } from 'react';
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
        setIsUnavailable(currentAvailability.slots.length === 0 && currentAvailability.slots.join(', ') === ''); // Explicitly unavailable
      } else {
        // If no specific availability, default to empty slots (meaning needs setup)
        setAvailabilitySlots('');
        setIsUnavailable(false);
      }
    } else if (open && !selectedDate) {
      // If dialog opens without a date somehow, ensure defaults
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
      // Explicitly setting as unavailable means empty slots array
      finalSlots = [];
    } else {
      // Process input string into an array of slots
      finalSlots = availabilitySlots
        .split(',')
        .map(s => s.trim())
        .filter(s => s !== ''); // Remove empty strings resulting from multiple commas or trailing comma

      // Optional: Add validation for slot format (e.g., HH:mm-HH:mm) here if needed
      // For now, we assume valid format if not marked unavailable and input is provided
      if (finalSlots.length === 0 && availabilitySlots.trim() !== '') {
        toast({ title: "Warning", description: "Input for slots was provided but resulted in no valid slots after processing. Check format. Saving as unavailable for now if not intended.", variant: "default" });
         // If input string was not empty but processing resulted in zero slots,
         // treat it as unavailable to avoid ambiguity.
         // Or, you could alert the user and prevent saving.
         // For this iteration, we save it as effectively unavailable if string was present but parsed to nothing.
      }
    }
    
    onSave(dateStr, finalSlots);
    onOpenChange(false); // Close dialog on save
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
                disabled={(date) => date < startOfDay(new Date())} // Optional: disable past dates
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
