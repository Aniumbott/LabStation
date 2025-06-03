
'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { Input } from "@/components/ui/input";
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Save, X, PlusCircle, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import type { BlackoutDate, Lab } from '@/types';
import { format, parseISO, isValid as isValidDateFn, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

const blackoutDateFormSchema = z.object({
  labId: z.string().optional().nullable(),
  date: z.date({ 
    required_error: "A date is required.",
    invalid_type_error: "That's not a valid date!",
  }),
  reason: z.string().max(100, { message: 'Reason cannot exceed 100 characters.' }).optional().or(z.literal('')),
});

export type BlackoutDateFormValues = z.infer<typeof blackoutDateFormSchema>;

interface BlackoutDateFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialBlackoutDate: BlackoutDate | null;
  onSave: (data: BlackoutDateFormValues) => Promise<void>;
  labs: Lab[];
  currentLabContextId?: string; // Optional: To pre-fill "Applies To"
}

const GLOBAL_CLOSURE_VALUE = "--global--"; // Represents the null/undefined labId for global closures

export function BlackoutDateFormDialog({ open, onOpenChange, initialBlackoutDate, onSave, labs, currentLabContextId }: BlackoutDateFormDialogProps) {
  const form = useForm<BlackoutDateFormValues>({
    resolver: zodResolver(blackoutDateFormSchema),
    defaultValues: {
      labId: currentLabContextId && currentLabContextId !== GLOBAL_CLOSURE_VALUE ? currentLabContextId : GLOBAL_CLOSURE_VALUE,
      date: startOfDay(new Date()),
      reason: '',
    },
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    let defaultLabId = GLOBAL_CLOSURE_VALUE;
    if (initialBlackoutDate) {
        defaultLabId = initialBlackoutDate.labId || GLOBAL_CLOSURE_VALUE;
    } else if (currentLabContextId && currentLabContextId !== GLOBAL_CLOSURE_VALUE) {
        defaultLabId = currentLabContextId;
    }

    const dateToSet = initialBlackoutDate?.date && isValidDateFn(parseISO(initialBlackoutDate.date)) 
                      ? parseISO(initialBlackoutDate.date) 
                      : startOfDay(new Date());
    form.reset({
      labId: defaultLabId,
      date: dateToSet,
      reason: initialBlackoutDate?.reason || '',
    });
  }, [initialBlackoutDate, form.reset, currentLabContextId]);


  useEffect(() => {
    if (open) {
      setIsSubmitting(false);
      resetForm();
    }
  }, [open, initialBlackoutDate, currentLabContextId, form.reset, resetForm]);

  async function onSubmit(data: BlackoutDateFormValues) {
    setIsSubmitting(true);
    const dataToSave = {
      ...data,
      labId: data.labId === GLOBAL_CLOSURE_VALUE ? null : data.labId,
    };
    try {
      await onSave(dataToSave); 
    } catch (error) {
      console.error("Error in BlackoutDateFormDialog onSubmit:", error);
    } finally {
      setIsSubmitting(false);
    }
  }
  
  const dialogDescription = useMemo(() => {
    if (initialBlackoutDate && initialBlackoutDate.date) {
        const labName = initialBlackoutDate.labId ? (labs.find(l=>l.id === initialBlackoutDate.labId)?.name || 'Specific Lab') : 'All Labs';
        return `Modify the blackout. Applies to: ${labName}.`;
    }
    const contextLabName = currentLabContextId && currentLabContextId !== GLOBAL_CLOSURE_VALUE 
                           ? (labs.find(l => l.id === currentLabContextId)?.name || 'Selected Lab') 
                           : 'Global (All Labs)';
    return `Select a date for the new closure. It will default to applying to: ${contextLabName}. You can change this below.`;
  }, [initialBlackoutDate, labs, currentLabContextId]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialBlackoutDate ? 'Edit Blackout Date' : 'Add New Blackout Date'}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2 pb-4">
            <FormField
              control={form.control}
              name="labId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Applies To</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value || GLOBAL_CLOSURE_VALUE} 
                    disabled={isSubmitting}
                  >
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value={GLOBAL_CLOSURE_VALUE}>Global (All Labs)</SelectItem>
                      {labs.map(lab => (
                        <SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Date</FormLabel>
                  <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          variant={"outline"}
                          className={cn(
                            "w-full justify-start text-left font-normal h-10",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isSubmitting}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value && isValidDateFn(field.value) ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => {
                            if(date) field.onChange(startOfDay(date));
                            setIsCalendarOpen(false);
                        }}
                        disabled={(date) => date < startOfDay(new Date()) && !initialBlackoutDate } 
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
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Public Holiday, Lab Maintenance" {...field} value={field.value || ''} disabled={isSubmitting} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : (initialBlackoutDate ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)
                }
                {isSubmitting
                  ? (initialBlackoutDate ? 'Saving...' : 'Adding...')
                  : (initialBlackoutDate ? 'Save Changes' : 'Add Date')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
