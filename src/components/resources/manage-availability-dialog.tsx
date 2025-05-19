
'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import type { Resource } from '@/types';
import { format, parseISO, startOfDay, isValid } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';

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
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(startOfDay(new Date()));
  const [availabilitySlots, setAvailabilitySlots] = useState<string>('');
  const [isUnavailable, setIsUnavailable] = useState<boolean>(false);
  const { toast } = useToast();

  useEffect(() => {
    if (open && selectedDate && resource.availability) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const existingAvailability = resource.availability.find(avail => avail.date === dateStr);
      if (existingAvailability) {
        setAvailabilitySlots(existingAvailability.slots.join(', '));
        setIsUnavailable(existingAvailability.slots.length === 0);
      } else {
        setAvailabilitySlots(''); // Default to empty if no specific availability is set
        setIsUnavailable(false);
      }
    } else if (open) {
      setSelectedDate(startOfDay(new Date())); // Ensure a date is selected when opening
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
    if (!isUnavailable) {
      finalSlots = availabilitySlots.split(',').map(s => s.trim()).filter(s => s !== '');
      if (finalSlots.length === 0 && availabilitySlots.trim() !== '') {
         // If input was not empty but resulted in zero slots after processing, it might be an invalid format.
         // For now, we'll let it save as zero slots, effectively "unavailable unless specific slots are entered"
         // A more robust validation for time slot format could be added here.
      }
    }
    // If isUnavailable is true, finalSlots remains empty, effectively marking it unavailable.
    onSave(dateStr, finalSlots);
  };

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
        <ScrollArea className="h-[60vh] pr-4">
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
                  disabled={isUnavailable}
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  Enter comma-separated time ranges. Examples:
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
                />
                <Label htmlFor="isUnavailable" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Mark entire day as Unavailable
                </Label>
              </div>

              {resource.availability && selectedDate && (
                <div className="pt-2">
                  <p className="text-sm font-medium text-muted-foreground">Current saved slots for {format(selectedDate, 'PPP')}:</p>
                  <p className="text-sm p-2 bg-muted rounded-md min-h-[2.5rem] mt-1">
                    {resource.availability.find(a => a.date === format(selectedDate!, 'yyyy-MM-dd'))?.slots.join(', ') || (isUnavailable ? 'Marked as unavailable' : 'No specific slots defined (assumed available or needs setup)')}
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
