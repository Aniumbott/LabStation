
'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form';
import { Save, X, PlusCircle, Loader2 } from 'lucide-react';
import type { RecurringBlackoutRule, DayOfWeek, Lab } from '@/types';
import { daysOfWeekArray } from '@/types';
import { ScrollArea } from '@/components/ui/scroll-area';


const recurringBlackoutRuleFormSchema = z.object({
  labId: z.string().optional().nullable(),
  name: z.string().min(2, { message: 'Rule name must be at least 2 characters.' }).max(100, { message: 'Rule name cannot exceed 100 characters.' }),
  daysOfWeek: z.array(z.enum(daysOfWeekArray)).min(1, { message: "Please select at least one day of the week." }),
  reason: z.string().max(100, { message: 'Reason cannot exceed 100 characters.' }).optional().or(z.literal('')),
});

export type RecurringBlackoutRuleFormValues = z.infer<typeof recurringBlackoutRuleFormSchema>;

interface RecurringBlackoutRuleFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRule: RecurringBlackoutRule | null;
  onSave: (data: RecurringBlackoutRuleFormValues) => Promise<void>;
  labs: Lab[];
  currentLabContextId?: string;
}

const GLOBAL_CLOSURE_VALUE = "--global--";

export function RecurringBlackoutRuleFormDialog({ open, onOpenChange, initialRule, onSave, labs, currentLabContextId }: RecurringBlackoutRuleFormDialogProps) {
  const form = useForm<RecurringBlackoutRuleFormValues>({
    resolver: zodResolver(recurringBlackoutRuleFormSchema),
    defaultValues: {
      labId: currentLabContextId && currentLabContextId !== GLOBAL_CLOSURE_VALUE ? currentLabContextId : GLOBAL_CLOSURE_VALUE,
      name: '',
      daysOfWeek: [],
      reason: '',
    },
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    let defaultLabId = GLOBAL_CLOSURE_VALUE;
    if (initialRule) {
        defaultLabId = initialRule.labId || GLOBAL_CLOSURE_VALUE;
    } else if (currentLabContextId && currentLabContextId !== GLOBAL_CLOSURE_VALUE) {
        defaultLabId = currentLabContextId;
    }
    form.reset({
      labId: defaultLabId,
      name: initialRule?.name || '',
      daysOfWeek: initialRule?.daysOfWeek || [],
      reason: initialRule?.reason || '',
    });
  }, [initialRule, form, currentLabContextId]);

  useEffect(() => {
    if (open) {
      setIsSubmitting(false);
      resetForm();
    }
  }, [open, resetForm]);

  async function onSubmit(data: RecurringBlackoutRuleFormValues) {
    setIsSubmitting(true);
    const dataToSave = {
        ...data,
        labId: data.labId === GLOBAL_CLOSURE_VALUE ? null : data.labId,
    };
    try {
        await onSave(dataToSave);
    } catch (error) {
        // Parent handles toast
    } finally {
        setIsSubmitting(false);
    }
  }

  const dialogDescription = useMemo(() => {
    if (initialRule) {
        const labName = initialRule.labId ? (labs.find(l=>l.id === initialRule.labId)?.name || 'Specific Lab') : 'All Labs';
        return `Modify the rule "${initialRule.name}". Applies to: ${labName}.`;
    }
    const contextLabName = currentLabContextId && currentLabContextId !== GLOBAL_CLOSURE_VALUE
                           ? (labs.find(l => l.id === currentLabContextId)?.name || 'Selected Lab')
                           : 'Global (All Labs)';
    return `Define a new weekly recurring closure. It will default to applying to: ${contextLabName}. You can change this below.`;
  }, [initialRule, labs, currentLabContextId]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialRule ? 'Edit Recurring Lab Closure Rule' : 'Add New Recurring Lab Closure Rule'}</DialogTitle>
          <DialogDescription>
            {dialogDescription}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4">
            <ScrollArea className="max-h-[60vh]">
              <div className="space-y-6 pr-1">
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
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rule Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Weekend Closure, Weekly Maintenance" {...field} disabled={isSubmitting}/>
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
                                    disabled={isSubmitting}
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
                        <Input placeholder="e.g., Lab closed, Scheduled cleaning" {...field} value={field.value || ''} disabled={isSubmitting}/>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t">
               <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
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

