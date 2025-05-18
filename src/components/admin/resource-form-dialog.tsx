
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
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, X, PlusCircle } from 'lucide-react';
import type { Resource, ResourceType, ResourceStatus } from '@/types';
import { parseISO, format } from 'date-fns';

const labsList: Resource['lab'][] = ['Lab A', 'Lab B', 'Lab C', 'General Lab']; // Re-define or pass as prop
const resourceStatusesList: ResourceStatus[] = ['Available', 'Booked', 'Maintenance']; // Re-define or pass as prop


const resourceFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).max(100, { message: 'Name cannot exceed 100 characters.' }),
  resourceTypeId: z.string().min(1, { message: 'Please select a resource type.' }),
  lab: z.enum(labsList, { required_error: 'Please select a lab.' }),
  status: z.enum(resourceStatusesList, { required_error: 'Please select a status.'}),
  description: z.string().max(500, { message: 'Description cannot exceed 500 characters.' }).optional().or(z.literal('')),
  imageUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  dataAiHint: z.string().max(50, {message: 'AI hint cannot exceed 50 characters.'}).optional().or(z.literal('')),
  manufacturer: z.string().max(100).optional().or(z.literal('')),
  model: z.string().max(100).optional().or(z.literal('')),
  serialNumber: z.string().max(100).optional().or(z.literal('')),
  purchaseDate: z.string().optional().refine((val) => {
    if (!val || val === '') return true; // Allow empty
    return !isNaN(Date.parse(val)); // Check if it's a valid date string
  }, { message: "Invalid date format for purchase date." }).or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  features: z.string().max(200, {message: "Features list cannot exceed 200 characters."}).optional().or(z.literal('')), // Comma-separated
});

export type ResourceFormValues = z.infer<typeof resourceFormSchema>;

interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialResource: Resource | null;
  onSave: (data: ResourceFormValues) => void;
  resourceTypes: ResourceType[];
  labs: Resource['lab'][];
  statuses: ResourceStatus[];
}

export function ResourceFormDialog({ 
    open, onOpenChange, initialResource, onSave, 
    resourceTypes, labs, statuses 
}: ResourceFormDialogProps) {
  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: {
      name: '',
      resourceTypeId: '',
      lab: undefined,
      status: 'Available',
      description: '',
      imageUrl: '',
      dataAiHint: '',
      manufacturer: '',
      model: '',
      serialNumber: '',
      purchaseDate: '',
      notes: '',
      features: '',
    },
  });

  useEffect(() => {
    if (open) {
      if (initialResource) {
        form.reset({
          name: initialResource.name,
          resourceTypeId: initialResource.resourceTypeId,
          lab: initialResource.lab,
          status: initialResource.status,
          description: initialResource.description || '',
          imageUrl: initialResource.imageUrl || '',
          dataAiHint: initialResource.dataAiHint || '',
          manufacturer: initialResource.manufacturer || '',
          model: initialResource.model || '',
          serialNumber: initialResource.serialNumber || '',
          purchaseDate: initialResource.purchaseDate ? format(parseISO(initialResource.purchaseDate), 'yyyy-MM-dd') : '',
          notes: initialResource.notes || '',
          features: initialResource.features?.join(', ') || '',
        });
      } else {
        form.reset({ // Default values for new resource
          name: '',
          resourceTypeId: resourceTypes.length > 0 ? resourceTypes[0].id : '',
          lab: labs.length > 0 ? labs[0] : undefined,
          status: 'Available',
          description: '',
          imageUrl: 'https://placehold.co/300x200.png',
          dataAiHint: 'lab equipment',
          manufacturer: '',
          model: '',
          serialNumber: '',
          purchaseDate: '',
          notes: '',
          features: '',
        });
      }
    }
  }, [open, initialResource, form, resourceTypes, labs]);

  function onSubmit(data: ResourceFormValues) {
    const dataToSave = {
        ...data,
        purchaseDate: data.purchaseDate ? parseISO(data.purchaseDate).toISOString() : undefined,
    };
    onSave(dataToSave as ResourceFormValues); // Type assertion might be needed if purchaseDate strictly needs string
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{initialResource ? 'Edit Resource' : 'Add New Resource'}</DialogTitle>
          <DialogDescription>
            {initialResource ? `Modify details for "${initialResource.name}".` : 'Provide information for the new lab resource.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] pr-6">
            <div className="space-y-4 py-2 pb-4">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Resource Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Quantum Spectrometer X1" {...field} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                    control={form.control}
                    name="resourceTypeId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Resource Type</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                            <SelectContent>
                            {resourceTypes.map(type => (
                                <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                    <FormField
                    control={form.control}
                    name="lab"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Lab</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a lab" /></SelectTrigger></FormControl>
                            <SelectContent>
                            {labs.map(labName => (
                                <SelectItem key={labName} value={labName}>{labName}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>

                <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="Detailed description of the resource..." {...field} rows={3} /></FormControl>
                    <FormMessage />
                    </FormItem>
                )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="imageUrl"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Image URL</FormLabel>
                            <FormControl><Input type="url" placeholder="https://placehold.co/300x200.png" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="dataAiHint"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Image AI Hint (Optional)</FormLabel>
                            <FormControl><Input placeholder="e.g., microscope electronics" {...field} /></FormControl>
                            <FormDescription>Keywords for AI image search (max 2 words).</FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                        control={form.control}
                        name="manufacturer"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Manufacturer (Optional)</FormLabel>
                            <FormControl><Input placeholder="e.g., Thermo Fisher" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="model"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Model (Optional)</FormLabel>
                            <FormControl><Input placeholder="e.g., Spectron 5000" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="serialNumber"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Serial Number (Optional)</FormLabel>
                            <FormControl><Input placeholder="e.g., SN-12345XYZ" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="purchaseDate"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Purchase Date (Optional)</FormLabel>
                            <FormControl><Input type="date" {...field} /></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                            <SelectContent>
                            {statuses.map(statusVal => (
                                <SelectItem key={statusVal} value={statusVal}>{statusVal}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                    />
                </div>
                <FormField
                    control={form.control}
                    name="features"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Features (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., High Resolution, Auto Sampler, WiFi Enabled" {...field} rows={2}/></FormControl>
                        <FormDescription>Enter comma-separated values.</FormDescription>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Notes (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="Any additional notes or special instructions..." {...field} rows={2}/></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
            </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t">
              <DialogClose asChild>
                <Button type="button" variant="outline">
                    <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
              </DialogClose>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting 
                  ? (initialResource ? 'Saving...' : 'Creating...') 
                  : (initialResource ? <><Save className="mr-2 h-4 w-4" /> Save Changes</> : <><PlusCircle className="mr-2 h-4 w-4" /> Create Resource</>)
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
