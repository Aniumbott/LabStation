
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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Save, X, PlusCircle } from 'lucide-react';
import type { ResourceType } from '@/types';

const resourceTypeFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).max(50, { message: 'Name cannot exceed 50 characters.' }),
  description: z.string().max(200, { message: 'Description cannot exceed 200 characters.' }).optional().or(z.literal('')),
});

export type ResourceTypeFormValues = z.infer<typeof resourceTypeFormSchema>;

interface ResourceTypeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialType: ResourceType | null;
  onSave: (data: ResourceTypeFormValues) => void;
}

export function ResourceTypeFormDialog({ open, onOpenChange, initialType, onSave }: ResourceTypeFormDialogProps) {
  const form = useForm<ResourceTypeFormValues>({
    resolver: zodResolver(resourceTypeFormSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (initialType) {
        form.reset({
          name: initialType.name,
          description: initialType.description || '',
        });
      } else {
        form.reset({
          name: '',
          description: '',
        });
      }
    }
  }, [open, initialType, form.reset]);

  function onSubmit(data: ResourceTypeFormValues) {
    onSave(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initialType ? 'Edit Resource Type' : 'Add New Resource Type'}</DialogTitle>
          <DialogDescription>
            {initialType ? `Modify details for "${initialType.name}".` : 'Provide information for the new resource category.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 py-2 pb-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Electron Microscope" {...field} />
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
                    <Textarea placeholder="A brief description of this resource category..." {...field} value={field.value || ''}/>
                  </FormControl>
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
                  ? (initialType ? 'Saving...' : 'Creating...') 
                  : (initialType ? <><Save className="mr-2 h-4 w-4" /> Save Changes</> : <><PlusCircle className="mr-2 h-4 w-4" /> Create Type</>)
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
