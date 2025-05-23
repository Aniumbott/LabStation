
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
import { Checkbox } from '@/components/ui/checkbox';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Save, X, PlusCircle, Loader2 } from 'lucide-react';
import type { RecurringBlackoutRule, DayOfWeek } from '@/types';
import { daysOfWeekArray } from '@/types';


const recurringBlackoutRuleFormSchema = z.object({
  name: z.string().min(2, { message: 'Rule name must be at least 2 characters.' }).max(100, { message: 'Rule name cannot exceed 100 characters.' }),
  daysOfWeek: z.array(z.enum(daysOfWeekArray)).min(1, { message: "Please select at least one day of the week." }),
  reason: z.string().max(100, { message: 'Reason cannot exceed 100 characters.' }).optional().or(z.literal('')),
});

export type RecurringBlackoutRuleFormValues = z.infer<typeof recurringBlackoutRuleFormSchema>;

interface RecurringBlackoutRuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRule: RecurringBlackoutRule | null;
  onSave: (data: RecurringBlackoutRuleFormValues) => Promise<void>; // Make onSave async
}

export function RecurringBlackoutRuleFormDialog({ open, onOpenChange, initialRule, onSave }: RecurringBlackoutRuleFormDialogProps) {
  const form = useForm<RecurringBlackoutRuleFormValues>({
    resolver: zodResolver(recurringBlackoutRuleFormSchema),
    defaultValues: {
      name: '',
      daysOfWeek: [],
      reason: '',
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setIsSubmitting(false); // Reset submitting state
      if (initialRule) {
        form.reset({
          name: initialRule.name,
          daysOfWeek: initialRule.daysOfWeek || [],
          reason: initialRule.reason || '',
        });
      } else {
        form.reset({
          name: '',
          daysOfWeek: [],
          reason: '',
        });
      }
    }
  }, [open, initialRule, form.reset, form]); // Added form to dependency array

  async function onSubmit(data: RecurringBlackoutRuleFormValues) {
    setIsSubmitting(true);
    try {
        await onSave(data);
        // Parent component will handle closing the dialog on successful save
    } catch (error) {
        // Error toast handled by parent
        console.error("Error in RecurringBlackoutRuleFormDialog onSubmit:", error);
    } finally {
        setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialRule ? 'Edit Recurring Lab Closure Rule' : 'Add New Recurring Lab Closure Rule'}</DialogTitle>
          <DialogDescription>
            {initialRule ? `Modify the rule "${initialRule.name}".` : 'Define a new weekly recurring closure for the lab.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-2 pb-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rule Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Weekend Closure, Weekly Maintenance" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="daysOfWeek"
              render={() => (
                <FormItem>
                  <div className="mb-2">
                    <FormLabel className="text-base">Days of the Week</FormLabel>
                    <FormDescription>
                      Select the days this rule applies to.
                    </FormDescription>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
                  {daysOfWeekArray.map((day) => (
                    <FormField
                      key={day}
                      control={form.control}
                      name="daysOfWeek"
                      render={({ field }) => {
                        return (
                          <FormItem
                            key={day}
                            className="flex flex-row items-start space-x-3 space-y-0"
                          >
                            <FormControl>
                              <Checkbox
                                checked={field.value?.includes(day)}
                                onCheckedChange={(checked) => {
                                  return checked
                                    ? field.onChange([...(field.value || []), day])
                                    : field.onChange(
                                        (field.value || []).filter(
                                          (value) => value !== day
                                        )
                                      )
                                }}
                              />
                            </FormControl>
                            <FormLabel className="font-normal">
                              {day}
                            </FormLabel>
                          </FormItem>
                        )
                      }}
                    />
                  ))}
                  </div>
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
                    <Input placeholder="e.g., Lab closed, Scheduled cleaning" {...field} value={field.value || ''} />
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
                  : (initialRule ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)
                }
                {isSubmitting
                  ? (initialRule ? 'Saving...' : 'Adding Rule...')
                  : (initialRule ? 'Save Changes' : 'Add Rule')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
