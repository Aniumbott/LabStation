
'use client';

import { useEffect, useState } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Save, X, PlusCircle, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import type { BlackoutDate } from '@/types';
import { format, parseISO, isValid as isValidDateFn, startOfDay, Timestamp } from 'date-fns';
import { cn } from '@/lib/utils';

const blackoutDateFormSchema = z.object({
  date: z.date({ // This will be a JS Date object from the Calendar
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
}

export function BlackoutDateFormDialog({ open, onOpenChange, initialBlackoutDate, onSave }: BlackoutDateFormDialogProps) {
  const form = useForm<BlackoutDateFormValues>({
    resolver: zodResolver(blackoutDateFormSchema),
    defaultValues: {
      date: startOfDay(new Date()), // Default to JS Date object
      reason: '',
    },
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setIsSubmitting(false);
      if (initialBlackoutDate && initialBlackoutDate.date) {
        // Firestore 'date' is a string "YYYY-MM-DD", convert to JS Date for form
        const dateToSet = isValidDateFn(parseISO(initialBlackoutDate.date)) ? parseISO(initialBlackoutDate.date) : startOfDay(new Date());
        form.reset({
          date: dateToSet,
          reason: initialBlackoutDate.reason || '',
        });
      } else {
        form.reset({
          date: startOfDay(new Date()),
          reason: '',
        });
      }
    }
  }, [open, initialBlackoutDate, form.reset]);

  async function onSubmit(data: BlackoutDateFormValues) {
    setIsSubmitting(true);
    try {
      await onSave(data); // data.date is already a JS Date object here
    } catch (error) {
      console.error("Error in BlackoutDateFormDialog onSubmit:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialBlackoutDate ? 'Edit Blackout Date' : 'Add New Blackout Date'}</DialogTitle>
          <DialogDescription>
            {initialBlackoutDate && initialBlackoutDate.date ? `Modify the blackout date for ${format(parseISO(initialBlackoutDate.date), 'PPP')}.` : 'Select a date and optionally provide a reason for lab closure.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2 pb-4">
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
                            "w-full pl-3 text-left font-normal",
                            !field.value && "text-muted-foreground"
                          )}
                          disabled={isSubmitting}
                        >
                          {field.value && isValidDateFn(field.value) ? (
                            format(field.value, "PPP")
                          ) : (
                            <span>Pick a date</span>
                          )}
                          <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
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
                        disabled={(date) => date < startOfDay(new Date()) && !initialBlackoutDate } // Allow past dates if editing
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
