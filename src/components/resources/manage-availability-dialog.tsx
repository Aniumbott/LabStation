
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
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
import type { Resource, AvailabilitySlot, DayOfWeek } from '@/types';
import { daysOfWeekArray } from '@/types';
import { format, startOfDay, isValid as isValidDateFn, parseISO, addDays, eachDayOfInterval, getDay, isBefore } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Separator } from '../ui/separator';
import { ScrollArea } from '../ui/scroll-area';
import { Label } from '../ui/label';
import { Loader2, Save, X, Copy, CalendarDays, CheckCircle, AlertCircle } from 'lucide-react';
import { DateRange } from 'react-day-picker';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { cn } from '@/lib/utils';

const timeSlotsExamples = [
  "09:00-17:00 (Full Day)",
  "09:00-12:00, 13:00-17:00 (With Lunch Break)",
  "10:00-10:30, 14:00-14:30 (Specific short slots)"
];

interface ManageAvailabilityDialogProps {
  resource: Resource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (updatedAvailability: AvailabilitySlot[]) => Promise<void>;
}

export function ManageAvailabilityDialog({ resource, open, onOpenChange, onSave }: ManageAvailabilityDialogProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(() => startOfDay(new Date()));
  const [slotsInput, setSlotsInput] = useState<string>('');
  const [isUnavailableForDay, setIsUnavailableForDay] = useState<boolean>(false);
  
  const [dialogAvailability, setDialogAvailability] = useState<AvailabilitySlot[]>([]);

  // For Bulk Apply
  const [targetDaysOfWeek, setTargetDaysOfWeek] = useState<DayOfWeek[]>([]);
  const [bulkApplyRange, setBulkApplyRange] = useState<DateRange | undefined>(undefined);
  const [isBulkApplyCalendarOpen, setIsBulkApplyCalendarOpen] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const initializeDialogState = useCallback(() => {
    setDialogAvailability(resource.availability ? [...resource.availability.map(a => ({...a, slots: [...a.slots]}))] : []);
    const initialDate = startOfDay(new Date());
    setSelectedDate(initialDate);
    
    const currentAvailabilityForInitialDate = resource.availability?.find(avail => avail.date === format(initialDate, 'yyyy-MM-dd'));
    if (currentAvailabilityForInitialDate) {
      setSlotsInput(currentAvailabilityForInitialDate.slots.join(', '));
      setIsUnavailableForDay(currentAvailabilityForInitialDate.slots.length === 0);
    } else {
      setSlotsInput('09:00-17:00'); // Default sensible slots
      setIsUnavailableForDay(false);
    }
    setTargetDaysOfWeek([]);
    setBulkApplyRange(undefined);
  }, [resource.availability]);

  useEffect(() => {
    if (open) {
      setIsSubmitting(false);
      initializeDialogState();
    }
  }, [open, initializeDialogState]);

  useEffect(() => {
    if (selectedDate && open) {
      const dateStr = format(selectedDate, 'yyyy-MM-dd');
      const currentAvailabilityForSelectedDate = dialogAvailability.find(avail => avail.date === dateStr);
      if (currentAvailabilityForSelectedDate) {
        setSlotsInput(currentAvailabilityForSelectedDate.slots.join(', '));
        setIsUnavailableForDay(currentAvailabilityForSelectedDate.slots.length === 0);
      } else {
        setSlotsInput('09:00-17:00'); 
        setIsUnavailableForDay(false);
      }
    }
  }, [selectedDate, dialogAvailability, open]);

  const parseSlotsInput = (input: string): string[] => {
    return input
      .split(',')
      .map(s => s.trim())
      .filter(s => {
        if (s === '') return false;
        const slotRegex = /^\d{2}:\d{2}-\d{2}:\d{2}$/;
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
  };

  const handleUpdateSingleDay = () => {
    if (!selectedDate) {
      toast({ title: "No Date Selected", description: "Please select a date to update.", variant: "destructive" });
      return;
    }
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    let newSlotsForDay: string[] = [];

    if (isUnavailableForDay) {
      newSlotsForDay = [];
    } else {
      newSlotsForDay = parseSlotsInput(slotsInput);
      if (newSlotsForDay.length === 0 && slotsInput.trim() !== '') {
        toast({ title: "No Valid Slots", description: "No valid time slots were entered. The day will be treated as having no specific slots defined.", variant: "default", duration: 7000 });
      }
    }

    setDialogAvailability(prev => {
      const existingIndex = prev.findIndex(a => a.date === dateStr);
      if (existingIndex !== -1) {
        const updated = [...prev];
        updated[existingIndex] = { ...updated[existingIndex], slots: newSlotsForDay };
        return updated;
      } else {
        return [...prev, { date: dateStr, slots: newSlotsForDay }];
      }
    });
    toast({ title: "Day Updated (Locally)", description: `Availability for ${format(selectedDate, 'PPP')} updated. Save all changes to persist.`, icon: <CheckCircle className="h-4 w-4 text-green-500"/> });
  };
  
  const handleBulkApplyConfiguration = () => {
    if (!selectedDate) {
      toast({ title: "No Template Date", description: "Please select a date in Step 1 to use as the template.", variant: "destructive" });
      return;
    }
    if (!bulkApplyRange?.from || targetDaysOfWeek.length === 0) {
      toast({ title: "Missing Information", description: "Please select a date range and target days of the week for bulk apply.", variant: "destructive" });
      return;
    }

    const templateSlots = isUnavailableForDay ? [] : parseSlotsInput(slotsInput);
    if (templateSlots.length === 0 && slotsInput.trim() !== '' && !isUnavailableForDay) {
      toast({ title: "No Valid Slots in Template", description: "The template slots (from Step 1) are invalid. Cannot apply.", variant: "destructive" });
      return;
    }

    const startDate = startOfDay(bulkApplyRange.from);
    const endDate = startOfDay(bulkApplyRange.to || bulkApplyRange.from); 

    if (isBefore(endDate, startDate)) {
      toast({ title: "Invalid Date Range", description: "End date cannot be before start date for bulk apply.", variant: "destructive" });
      return;
    }

    let updatedCount = 0;
    const newDialogAvailability = [...dialogAvailability];
    const datesInRange = eachDayOfInterval({ start: startDate, end: endDate });

    datesInRange.forEach(currentDateIter => {
      const dayIndex = getDay(currentDateIter); 
      const dayName = daysOfWeekArray[dayIndex];

      if (targetDaysOfWeek.includes(dayName)) {
        const dateStr = format(currentDateIter, 'yyyy-MM-dd');
        const existingIndex = newDialogAvailability.findIndex(a => a.date === dateStr);
        if (existingIndex !== -1) {
          newDialogAvailability[existingIndex] = { ...newDialogAvailability[existingIndex], slots: [...templateSlots] };
        } else {
          newDialogAvailability.push({ date: dateStr, slots: [...templateSlots] });
        }
        updatedCount++;
      }
    });

    setDialogAvailability(newDialogAvailability.sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()));
    toast({ title: "Bulk Apply Successful (Locally)", description: `Configuration from ${format(selectedDate, 'PPP')} applied to ${updatedCount} day(s). Save all changes to persist.`, icon: <CheckCircle className="h-4 w-4 text-green-500"/> });
  };


  const handleSaveAllChanges = async () => {
    setIsSubmitting(true);
    try {
      const availabilityToSave = dialogAvailability
        .filter(a => a.slots.length > 0 || resource.availability?.find(ra => ra.date === a.date))
        .sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      await onSave(availabilityToSave);
    } catch (error: any) {
      console.error("Error in ManageAvailabilityDialog handleSaveAllChanges:", error);
      toast({ title: "Save Error", description: `Could not save availability: ${error.message}`, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const sortedDialogAvailability = useMemo(() => {
    return [...dialogAvailability].sort((a, b) => {
        try { return parseISO(a.date).getTime() - parseISO(b.date).getTime(); }
        catch(e) { return 0;}
    });
  }, [dialogAvailability]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Manage Daily Availability for "{resource.name}"</DialogTitle>
          <DialogDescription>
            Select a date to define its specific time slots, or use the bulk apply feature.
            Changes are local until "Save All Changes" is pressed.
          </DialogDescription>
        </DialogHeader>
        <Separator />
        <div className="grid md:grid-cols-3 gap-6 py-4 max-h-[70vh]">
          <div className="md:col-span-1 space-y-4 border-r md:pr-6 flex flex-col">
            <div className="flex flex-col items-center">
              <Label className="mb-2 text-center font-semibold">1. Select Date to Configure/Use as Template</Label>
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(startOfDay(date))}
                className="rounded-md border self-center"
                disabled={(date) => date < startOfDay(new Date())}
              />
            </div>

            <div className="space-y-1 flex-grow flex flex-col">
              <Label htmlFor="availabilitySlots" className="font-medium">
                Time Slots for {selectedDate ? format(selectedDate, 'PPP') : 'selected date'}:
              </Label>
              <Textarea
                id="availabilitySlots"
                placeholder="e.g., 09:00-12:00, 13:00-17:00"
                value={slotsInput}
                onChange={(e) => setSlotsInput(e.target.value)}
                disabled={isUnavailableForDay || !selectedDate || isSubmitting}
                rows={3}
                className="flex-grow"
              />
              <p className="text-xs text-muted-foreground">
                Comma-separated HH:mm-HH:mm. Examples:
              </p>
              <ul className="text-xs text-muted-foreground list-disc pl-5">
                {timeSlotsExamples.map(ex => <li key={ex}>{ex}</li>)}
              </ul>
            </div>

            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="isUnavailableForDay"
                checked={isUnavailableForDay}
                onCheckedChange={(checked) => {
                  setIsUnavailableForDay(checked as boolean);
                  if (checked) setSlotsInput('');
                }}
                disabled={!selectedDate || isSubmitting}
              />
              <Label htmlFor="isUnavailableForDay" className="text-sm font-medium">
                Mark this day as Unavailable
              </Label>
            </div>
            <Button onClick={handleUpdateSingleDay} size="sm" variant="outline" disabled={!selectedDate || isSubmitting}>
              Update This Day's Slots (Locally)
            </Button>
          </div>

          <div className="md:col-span-1 space-y-4 border-r md:pr-6 flex flex-col">
            <Label className="font-semibold">2. Bulk Apply Template to Range</Label>
            <div className="space-y-1">
              <Label>Target Days of Week:</Label>
              <div className="grid grid-cols-3 gap-2 pt-1">
                {daysOfWeekArray.map((day) => (
                  <div key={day} className="flex items-center space-x-2">
                    <Checkbox
                      id={`dow-${day}`}
                      checked={targetDaysOfWeek.includes(day)}
                      onCheckedChange={(checked) => {
                        setTargetDaysOfWeek(prev => 
                          checked ? [...prev, day] : prev.filter(d => d !== day)
                        );
                      }}
                      disabled={isSubmitting}
                    />
                    <Label htmlFor={`dow-${day}`} className="text-sm font-normal">{day.substring(0,3)}</Label>
                  </div>
                ))}
              </div>
            </div>
             <div className="space-y-1">
                <Label htmlFor="bulkApplyRange">Target Date Range for Bulk Apply:</Label>
                 <Popover open={isBulkApplyCalendarOpen} onOpenChange={setIsBulkApplyCalendarOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        id="bulkApplyRange"
                        variant={"outline"}
                        className={cn(
                          "w-full justify-start text-left font-normal h-10",
                          !bulkApplyRange && "text-muted-foreground"
                        )}
                        disabled={isSubmitting}
                      >
                        <CalendarDays className="mr-2 h-4 w-4" />
                        {bulkApplyRange?.from ? (
                          bulkApplyRange.to ? (
                            <>
                              {format(bulkApplyRange.from, "LLL dd, y")} - {format(bulkApplyRange.to, "LLL dd, y")}
                            </>
                          ) : (
                            format(bulkApplyRange.from, "LLL dd, y")
                          )
                        ) : (
                          <span>Pick a date range</span>
                        )}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                            initialFocus
                            mode="range"
                            defaultMonth={bulkApplyRange?.from}
                            selected={bulkApplyRange}
                            onSelect={setBulkApplyRange}
                            numberOfMonths={1}
                            disabled={(date) => date < startOfDay(new Date())}
                        />
                    </PopoverContent>
                </Popover>
            </div>
            <Button onClick={handleBulkApplyConfiguration} size="sm" variant="secondary" disabled={isSubmitting || !selectedDate || !bulkApplyRange?.from || targetDaysOfWeek.length === 0}>
              <Copy className="mr-2 h-4 w-4" /> Apply Template to Range (Locally)
            </Button>
            <p className="text-xs text-muted-foreground pt-2">
              Applies the slot configuration (or "Unavailable" status) from Step 1 to the selected days within the chosen date range.
            </p>
          </div>
          
          <div className="md:col-span-1 space-y-2 flex flex-col">
            <Label className="font-semibold">3. Current Availability (Local Session)</Label>
            <ScrollArea className="border rounded-md p-2 flex-grow min-h-[200px]">
              {sortedDialogAvailability.length > 0 ? (
                <ul className="space-y-1 text-sm">
                  {sortedDialogAvailability.map(avail => (
                    <li key={avail.date} className="text-xs border-b last:border-b-0 pb-1">
                      <span className="font-medium">{isValidDateFn(parseISO(avail.date)) ? format(parseISO(avail.date), 'EEE, MMM dd, yyyy') : 'Invalid Date'}</span>:
                      <span className="ml-1 text-muted-foreground">
                        {avail.slots.length > 0 ? avail.slots.join('; ') : <span className="italic text-orange-600">Unavailable</span>}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-4">No specific daily availability defined yet for this session.</p>
              )}
            </ScrollArea>
             <p className="text-xs text-muted-foreground pt-1">
               This list reflects changes you make. Press "Save All Changes" to persist to the database.
            </p>
          </div>
        </div>
        <Separator />
        <DialogFooter className="pt-6">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSaveAllChanges} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            Save All Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
