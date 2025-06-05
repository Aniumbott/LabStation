
'use client';

import { useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import type { Booking, BookingUsageDetails } from '@/types';
import { BookingUsageOutcomes } from '@/types';
import { format, parseISO, isValid } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { Save, X } from 'lucide-react';

const logUsageFormSchema = z.object({
  actualStartTime: z.string().optional().refine(val => !val || isValid(parseISO(val)), {
    message: "Invalid start date/time format. Use YYYY-MM-DDTHH:mm",
  }),
  actualEndTime: z.string().optional().refine(val => !val || isValid(parseISO(val)), {
    message: "Invalid end date/time format. Use YYYY-MM-DDTHH:mm",
  }),
  outcome: z.enum(BookingUsageOutcomes as [string, ...string[]]).optional(),
  dataStorageLocation: z.string().max(255, "Cannot exceed 255 characters.").optional().or(z.literal('')),
  usageComments: z.string().max(1000, "Cannot exceed 1000 characters.").optional().or(z.literal('')),
}).refine(data => {
  if (data.actualStartTime && data.actualEndTime) {
    return parseISO(data.actualEndTime) > parseISO(data.actualStartTime);
  }
  return true;
}, {
  message: "Actual end time must be after actual start time.",
  path: ["actualEndTime"],
});

type LogUsageFormValues = z.infer<typeof logUsageFormSchema>;

interface LogUsageFormDialogProps {
  booking: Booking;
  open: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onSaveUsage: (usageData: BookingUsageDetails) => void;
}

const formatForDateTimeLocal = (isoString?: string): string => {
  if (!isoString) return '';
  try {
    const date = parseISO(isoString);
    if (isValid(date)) {
      return format(date, "yyyy-MM-dd'T'HH:mm");
    }
  } catch (e) { /* ignore parse error, return empty */ }
  return '';
};


export function LogUsageFormDialog({ booking, open, onOpenChange, onSaveUsage }: LogUsageFormDialogProps) {
  const form = useForm<LogUsageFormValues>({
    resolver: zodResolver(logUsageFormSchema),
    defaultValues: {
      actualStartTime: formatForDateTimeLocal(booking.usageDetails?.actualStartTime || booking.startTime.toISOString()),
      actualEndTime: formatForDateTimeLocal(booking.usageDetails?.actualEndTime || booking.endTime.toISOString()),
      outcome: booking.usageDetails?.outcome || 'Not Applicable',
      dataStorageLocation: booking.usageDetails?.dataStorageLocation || '',
      usageComments: booking.usageDetails?.usageComments || '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        actualStartTime: formatForDateTimeLocal(booking.usageDetails?.actualStartTime || booking.startTime.toISOString()),
        actualEndTime: formatForDateTimeLocal(booking.usageDetails?.actualEndTime || booking.endTime.toISOString()),
        outcome: booking.usageDetails?.outcome || 'Not Applicable',
        dataStorageLocation: booking.usageDetails?.dataStorageLocation || '',
        usageComments: booking.usageDetails?.usageComments || '',
      });
    }
  }, [open, booking, form.reset]);

  function onSubmit(data: LogUsageFormValues) {
    const usageDataToSave: BookingUsageDetails = {
      actualStartTime: data.actualStartTime ? parseISO(data.actualStartTime).toISOString() : undefined,
      actualEndTime: data.actualEndTime ? parseISO(data.actualEndTime).toISOString() : undefined,
      outcome: data.outcome,
      dataStorageLocation: data.dataStorageLocation || undefined,
      usageComments: data.usageComments || undefined,
    };
    onSaveUsage(usageDataToSave);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log Usage for {booking.resourceName}</DialogTitle>
          <DialogDescription>
            Record details for the booking on {format(new Date(booking.startTime), 'PPP')}.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[60vh] mt-4">
              <div className="space-y-4 pr-1">
                <FormField
                  control={form.control}
                  name="actualStartTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual Start Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="actualEndTime"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Actual End Time</FormLabel>
                      <FormControl>
                        <Input type="datetime-local" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="outcome"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Outcome</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select outcome" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {BookingUsageOutcomes.map(outcomeValue => (
                            <SelectItem key={outcomeValue} value={outcomeValue!}>
                              {outcomeValue}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dataStorageLocation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Data Storage Location (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., /project-x/run12_data, Notebook #123" {...field} value={field.value || ''}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="usageComments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Usage Comments (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Any comments about the session, issues, or results..." {...field} value={field.value || ''} rows={3} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                <Save className="mr-2 h-4 w-4" /> Save Usage
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
