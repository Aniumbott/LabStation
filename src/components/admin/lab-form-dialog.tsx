
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
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Save, X, PlusCircle, Loader2 } from 'lucide-react';
import type { Lab } from '@/types';

const labFormSchema = z.object({
  name: z.string().min(2, { message: 'Lab name must be at least 2 characters.' }).max(100, { message: 'Name cannot exceed 100 characters.' }),
  location: z.string().max(150, { message: 'Location cannot exceed 150 characters.' }).optional().or(z.literal('')),
  description: z.string().max(500, { message: 'Description cannot exceed 500 characters.' }).optional().or(z.literal('')),
});

export type LabFormValues = z.infer<typeof labFormSchema>;

interface LabFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialLab: Lab | null;
  onSave: (data: LabFormValues) => Promise<void>;
}

export function LabFormDialog({ open, onOpenChange, initialLab, onSave }: LabFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<LabFormValues>({
    resolver: zodResolver(labFormSchema),
    defaultValues: {
      name: '',
      location: '',
      description: '',
    },
  });

  const resetForm = useCallback(() => {
    if (initialLab) {
      form.reset({
        name: initialLab.name,
        location: initialLab.location || '',
        description: initialLab.description || '',
      });
    } else {
      form.reset({
        name: '',
        location: '',
        description: '',
      });
    }
  }, [initialLab, form]);

  useEffect(() => {
    if (open) {
      setIsSubmitting(false);
      resetForm();
    }
  }, [open, resetForm]);

  async function onSubmit(data: LabFormValues) {
    setIsSubmitting(true);
    try {
      await onSave(data);
    } catch (error) {
      // Parent handles toast
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialLab ? 'Edit Lab' : 'Add New Lab'}</DialogTitle>
          <DialogDescription>
            {initialLab ? `Modify details for "${initialLab.name}".` : 'Provide information for the new lab.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mt-4 space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Lab Name <span className="text-destructive">*</span></FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Main Electronics Lab" {...field} disabled={isSubmitting}/>
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
                  <FormLabel>Location (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Building A, Room 101" {...field} value={field.value || ''} disabled={isSubmitting}/>
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
                    <Textarea placeholder="A brief description of the lab and its purpose..." {...field} value={field.value || ''} disabled={isSubmitting} rows={3}/>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter className="pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : (initialLab ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)
                }
                {isSubmitting
                  ? (initialLab ? 'Saving...' : 'Adding Lab...')
                  : (initialLab ? 'Save Changes' : 'Add Lab')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
