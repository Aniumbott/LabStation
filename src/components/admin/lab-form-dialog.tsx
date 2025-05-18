
'use client';

import { useEffect } from 'react';
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { PlusCircle, Save, X } from 'lucide-react';
import type { Lab } from '@/types';

const labFormSchema = z.object({
  name: z.string().min(2, { message: 'Lab name must be at least 2 characters.' }),
  location: z.string().min(3, { message: 'Location must be at least 3 characters.' }),
  description: z.string().optional(),
  timezone: z.string().min(1, { message: 'Please select or enter a timezone.' }),
});

export type LabFormValues = z.infer<typeof labFormSchema>;

interface LabFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLab: Lab | null;
  onSave: (data: LabFormValues) => void;
  timezones: string[];
}

export function LabFormDialog({ open, onOpenChange, initialLab, onSave, timezones }: LabFormDialogProps) {
  const form = useForm<LabFormValues>({
    resolver: zodResolver(labFormSchema),
    defaultValues: {
      name: '',
      location: '',
      description: '',
      timezone: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (initialLab) {
        form.reset({
          name: initialLab.name,
          location: initialLab.location,
          description: initialLab.description || '',
          timezone: initialLab.timezone,
        });
      } else {
        form.reset({
          name: '',
          location: '',
          description: '',
          timezone: timezones.includes('UTC') ? 'UTC' : timezones[0] || '', // Default to UTC or first in list
        });
      }
    }
  }, [open, initialLab, form, timezones]);

  function onSubmit(data: LabFormValues) {
    onSave(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialLab ? 'Edit Lab' : 'Add New Lab'}</DialogTitle>
          <DialogDescription>
            {initialLab ? `Modify the details for ${initialLab.name}.` : 'Provide the information for the new lab.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2 pb-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lab Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Central Research Lab" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Building A, Room 101" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea placeholder="e.g., Main interdisciplinary research facility." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timezone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Timezone</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a timezone" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the primary timezone for this lab.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting 
                  ? (initialLab ? 'Saving...' : 'Creating...') 
                  : (initialLab ? <><Save className="mr-2 h-4 w-4" /> Save Changes</> : <><PlusCircle className="mr-2 h-4 w-4" /> Create Lab</>)
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
