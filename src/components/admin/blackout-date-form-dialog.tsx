
'use client';

import { useEffect, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
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
import { format, parseISO, isValid, startOfDay } from 'date-fns';
import { cn } from '@/lib/utils';

const blackoutDateFormSchema = z.object({
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
  onSave: (data: BlackoutDateFormValues) => Promise<void>; // Make onSave async
}

export function BlackoutDateFormDialog({ open, onOpenChange, initialBlackoutDate, onSave }: BlackoutDateFormDialogProps) {
  const form = useForm<BlackoutDateFormValues>({
    resolver: zodResolver(blackoutDateFormSchema),
    defaultValues: {
      date: startOfDay(new Date()),
      reason: '',
    },
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setIsSubmitting(false); // Reset submitting state
      if (initialBlackoutDate) {
        const dateToSet = initialBlackoutDate.date && isValid(parseISO(initialBlackoutDate.date)) ? parseISO(initialBlackoutDate.date) : startOfDay(new Date());
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
  }, [open, initialBlackoutDate, form.reset, form]); // Added form to dependencies

  async function onSubmit(data: BlackoutDateFormValues) {
    setIsSubmitting(true);
    try {
      await onSave(data);
      // Parent component will handle closing the dialog on successful save
    } catch (error) {
      // Error toast handled by parent
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
            {initialBlackoutDate ? `Modify the blackout date for ${format(initialBlackoutDate.date && isValid(parseISO(initialBlackoutDate.date)) ? parseISO(initialBlackoutDate.date) : new Date(), 'PPP')}.` : 'Select a date and optionally provide a reason for lab closure.'}
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
                        >
                          {field.value && isValid(field.value) ? ( // Check if field.value is valid Date
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
                    <Input placeholder="e.g., Public Holiday, Lab Maintenance" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
