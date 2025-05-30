
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
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, X, PlusCircle, Network, Info, Loader2 } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { Resource, ResourceStatus, ResourceType } from '@/types';
import { labsList, resourceStatusesList } from '@/lib/app-constants'; // resourceStatusesList now has updated values
import { parseISO, format, isValid as isValidDateFn } from 'date-fns';
import { Timestamp } from 'firebase/firestore';
import { Separator } from '@/components/ui/separator';

const VALID_REMOTE_PROTOCOLS = ['RDP', 'SSH', 'VNC', 'Other'] as const;
const NONE_PROTOCOL_VALUE = "--none-protocol--";

const resourceFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).max(100, { message: 'Name cannot exceed 100 characters.' }),
  resourceTypeId: z.string().min(1, { message: 'Please select a resource type.' }),
  lab: z.enum(labsList as [string, ...string[]], { required_error: 'Please select a lab.' }),
  status: z.enum(resourceStatusesList as [ResourceStatus, ...ResourceStatus[]], { required_error: 'Please select a status.'}), // Uses updated list
  description: z.string().max(500, { message: 'Description cannot exceed 500 characters.' }).optional().or(z.literal('')),
  imageUrl: z.string().url({ message: 'Please enter a valid URL for the image.' }).optional().or(z.literal('')),
  manufacturer: z.string().max(100).optional().or(z.literal('')),
  model: z.string().max(100).optional().or(z.literal('')),
  serialNumber: z.string().max(100).optional().or(z.literal('')),
  purchaseDate: z.string().optional().refine((val) => {
    if (val === '' || val === undefined || val === null) return true;
    return isValidDateFn(parseISO(val));
  }, {
    message: "Invalid date format. Use YYYY-MM-DD or leave empty.",
  }).or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  features: z.string().max(200, {message: "Features list cannot exceed 200 characters."}).optional().or(z.literal('')),
  remoteAccess: z.object({
    ipAddress: z.string().max(45).optional().or(z.literal('')),
    hostname: z.string().max(255).optional().or(z.literal('')),
    protocol: z.enum(VALID_REMOTE_PROTOCOLS).or(z.literal('')).optional(),
    username: z.string().max(100).optional().or(z.literal('')),
    port: z.preprocess(
      (val) => (String(val ?? '').trim() === '' ? undefined : String(val).trim()),
      z.string().transform((val) => {
        if (val === undefined || val === '') return undefined;
        const num = Number(val);
        return isNaN(num) ? undefined : num;
      }).pipe(z.number().int().min(1).max(65535).optional().nullable())
    ),
    notes: z.string().max(500).optional().or(z.literal('')),
  }).optional(),
  allowQueueing: z.boolean().optional(),
});

export type ResourceFormValues = z.infer<typeof resourceFormSchema>;

interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialResource: Resource | null;
  onSave: (data: ResourceFormValues, resourceIdToUpdate?: string) => Promise<void>;
  resourceTypes: ResourceType[];
}

export function ResourceFormDialog({
    open, onOpenChange, initialResource, onSave, resourceTypes
}: ResourceFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: { // Will be overridden by resetForm
        name: '',
        resourceTypeId: '',
        lab: undefined,
        status: 'Working', // Default new status
        description: '',
        imageUrl: '',
        manufacturer: '',
        model: '',
        serialNumber: '',
        purchaseDate: '',
        notes: '',
        features: '',
        remoteAccess: {
          ipAddress: '', hostname: '', protocol: '', username: '', port: undefined, notes: '',
        },
        allowQueueing: false,
    },
  });

  const resetForm = useCallback(() => {
    if (initialResource) {
      form.reset({
        name: initialResource.name,
        resourceTypeId: initialResource.resourceTypeId,
        lab: initialResource.lab,
        status: initialResource.status, // This will now be 'Working', 'Maintenance', or 'Broken'
        description: initialResource.description || '',
        imageUrl: initialResource.imageUrl || '',
        manufacturer: initialResource.manufacturer || '',
        model: initialResource.model || '',
        serialNumber: initialResource.serialNumber || '',
        purchaseDate: initialResource.purchaseDate && isValidDateFn(initialResource.purchaseDate)
                        ? format(initialResource.purchaseDate, 'yyyy-MM-dd')
                        : '',
        notes: initialResource.notes || '',
        features: Array.isArray(initialResource.features) ? initialResource.features.join(', ') : '',
        remoteAccess: {
          ipAddress: initialResource.remoteAccess?.ipAddress || '',
          hostname: initialResource.remoteAccess?.hostname || '',
          protocol: initialResource.remoteAccess?.protocol || '',
          username: initialResource.remoteAccess?.username || '',
          port: initialResource.remoteAccess?.port ?? undefined,
          notes: initialResource.remoteAccess?.notes || '',
        },
        allowQueueing: initialResource.allowQueueing ?? false,
      });
    } else {
      form.reset({
        name: '',
        resourceTypeId: resourceTypes.length > 0 ? resourceTypes[0].id : '',
        lab: labsList.length > 0 ? labsList[0] : undefined,
        status: 'Working', // Default for new resources
        description: '',
        imageUrl: '',
        manufacturer: '',
        model: '',
        serialNumber: '',
        purchaseDate: '',
        notes: '',
        features: '',
        remoteAccess: {
          ipAddress: '', hostname: '', protocol: '', username: '', port: undefined, notes: '',
        },
        allowQueueing: false,
      });
    }
  }, [initialResource, resourceTypes, form.reset]);

  useEffect(() => {
    if (open) {
      setIsSubmitting(false);
      resetForm();
    }
  }, [open, initialResource, resourceTypes, form.reset, resetForm]);


  async function onSubmit(data: ResourceFormValues) {
    setIsSubmitting(true);
    try {
        const processedData: ResourceFormValues = {
            ...data,
            imageUrl: data.imageUrl || '',
            remoteAccess: data.remoteAccess ? {
                ...data.remoteAccess,
                port: data.remoteAccess.port === null || data.remoteAccess.port === undefined ? undefined : Number(data.remoteAccess.port),
            } : undefined,
        };

        if (processedData.remoteAccess) {
            const ra = processedData.remoteAccess;
            const allEmptyOrInvalid = !ra.ipAddress && !ra.hostname && !ra.protocol && !ra.username && (ra.port === undefined || ra.port === null) && !ra.notes;
            if (allEmptyOrInvalid) {
                processedData.remoteAccess = undefined;
            }
        }
      await onSave(processedData, initialResource?.id);

    } catch (error) {
      console.error("Error during resource save submission:", error);
    } finally {
      setIsSubmitting(false);
    }
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
            <ScrollArea className="max-h-[70vh] overflow-y-auto pr-2">
            <div className="space-y-6 py-2 pb-4 px-1">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                      <FormItem>
                      <FormLabel>Resource Name <span className="text-destructive">*</span></FormLabel>
                      <FormControl><Input placeholder="e.g., Keysight Oscilloscope MSOX3054T" {...field} disabled={isSubmitting}/></FormControl>
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
                          <FormLabel>Resource Type <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''} disabled={resourceTypes.length === 0 || isSubmitting}>
                              <FormControl><SelectTrigger>
                                  <SelectValue placeholder={resourceTypes.length > 0 ? "Select a type" : "No types defined"} />
                              </SelectTrigger></FormControl>
                              <SelectContent>
                              {resourceTypes.length > 0 ? resourceTypes.map(type => (
                                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                              )) : <SelectItem value="disabled_placeholder_no_types" disabled>No resource types available. Please add types first.</SelectItem>}
                              </SelectContent>
                          </Select>
                          {resourceTypes.length === 0 && <FormDescription className="text-destructive">Please define resource types in Admin &gt; Resource Types before adding resources.</FormDescription>}
                          <FormMessage />
                          </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="lab"
                      render={({ field }) => (
                          <FormItem>
                          <FormLabel>Lab <span className="text-destructive">*</span></FormLabel>
                          <Select onValueChange={field.onChange} value={field.value || ''} disabled={isSubmitting}>
                              <FormControl><SelectTrigger><SelectValue placeholder="Select a lab" /></SelectTrigger></FormControl>
                              <SelectContent>
                              {labsList.map(labName => (
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
                      <FormLabel>Description (Optional)</FormLabel>
                      <FormControl><Textarea placeholder="Detailed description of the resource..." {...field} value={field.value ?? ''} rows={3} disabled={isSubmitting}/></FormControl>
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
                            <FormLabel>Image URL (Optional)</FormLabel>
                            <FormControl><Input type="url" placeholder="https://placehold.co/600x400.png" {...field} value={field.value ?? ''} disabled={isSubmitting}/></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                     <FormField
                        control={form.control}
                        name="purchaseDate"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Purchase Date (Optional)</FormLabel>
                            <FormControl><Input type="date" {...field} value={field.value ?? ''} disabled={isSubmitting}/></FormControl>
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
                            <FormControl><Input placeholder="e.g., Keysight" {...field} value={field.value ?? ''} disabled={isSubmitting}/></FormControl>
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
                            <FormControl><Input placeholder="e.g., MSOX3054T" {...field} value={field.value ?? ''} disabled={isSubmitting}/></FormControl>
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
                            <FormControl><Input placeholder="e.g., MY58012345" {...field} value={field.value ?? ''} disabled={isSubmitting}/></FormControl>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Operational Status <span className="text-destructive">*</span></FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || 'Working'} disabled={isSubmitting}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                            <SelectContent>
                            {resourceStatusesList.map(statusVal => (
                                <SelectItem key={statusVal} value={statusVal}>{statusVal}</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="features"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Key Features (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., 500 MHz Bandwidth, 4 Analog Channels, 16 Digital Channels" {...field} value={field.value ?? ''} rows={2} disabled={isSubmitting}/></FormControl>
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
                        <FormLabel>General Notes (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="Any additional notes or special instructions..." {...field} value={field.value ?? ''} rows={2} disabled={isSubmitting}/></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                 <FormField
                    control={form.control}
                    name="allowQueueing"
                    render={({ field }) => (
                        <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-md border p-3 shadow-sm bg-background">
                        <FormControl>
                            <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                            disabled={isSubmitting}
                            />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                            <FormLabel className="cursor-pointer">
                            Allow Waitlisting/Queueing
                            </FormLabel>
                            <FormDescription>
                            Permit users to join a waitlist if this resource is already booked.
                            </FormDescription>
                        </div>
                        </FormItem>
                    )}
                 />

                <Separator />
                <div>
                    <h3 className="text-md font-medium mb-3 flex items-center"><Network className="mr-2 h-5 w-5 text-primary" /> Remote Access Details (Optional)</h3>
                    <div className="space-y-4 pl-2 border-l-2 border-muted ml-2.5">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="remoteAccess.ipAddress"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>IP Address (Optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g., 192.168.1.100" {...field} value={field.value ?? ''} disabled={isSubmitting}/></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="remoteAccess.hostname"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Hostname (Optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g., scope-01.lab.internal" {...field} value={field.value ?? ''} disabled={isSubmitting}/></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <FormField
                                control={form.control}
                                name="remoteAccess.protocol"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Protocol (Optional)</FormLabel>
                                    <Select
                                      onValueChange={(v) => field.onChange(v === NONE_PROTOCOL_VALUE ? '' : v)}
                                      value={field.value === '' || field.value === undefined || field.value === null ? NONE_PROTOCOL_VALUE : field.value}
                                      disabled={isSubmitting}
                                    >
                                        <FormControl><SelectTrigger><SelectValue placeholder="Select protocol" /></SelectTrigger></FormControl>
                                        <SelectContent>
                                            <SelectItem value={NONE_PROTOCOL_VALUE}>None</SelectItem>
                                            {VALID_REMOTE_PROTOCOLS.map(p => (
                                                <SelectItem key={p} value={p}>{p}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={form.control}
                                name="remoteAccess.port"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Port (Optional)</FormLabel>
                                    <FormControl><Input
                                        type="text"
                                        placeholder="e.g., 22, 3389"
                                        {...field}
                                        value={field.value === null || field.value === undefined ? '' : String(field.value)}
                                        onChange={e => field.onChange(e.target.value)}
                                        disabled={isSubmitting}
                                     /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="remoteAccess.username"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Username (Optional)</FormLabel>
                                    <FormControl><Input placeholder="e.g., labuser" {...field}  value={field.value ?? ''} disabled={isSubmitting}/></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <FormField
                            control={form.control}
                            name="remoteAccess.notes"
                            render={({ field }) => (
                                <FormItem>
                                <FormLabel>Connection Notes (Optional)</FormLabel>
                                <FormControl><Textarea placeholder="e.g., VPN required, specific client versions, credential location..." {...field} value={field.value ?? ''} rows={2} disabled={isSubmitting}/></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>
            </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                    <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || (resourceTypes.length === 0 && !initialResource) }>
                {isSubmitting
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : (initialResource ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)
                }
                {isSubmitting
                  ? (initialResource ? 'Saving...' : 'Creating...')
                  : (initialResource ? 'Save Changes' : 'Create Resource')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
