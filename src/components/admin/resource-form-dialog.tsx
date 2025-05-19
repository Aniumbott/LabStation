
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
import { Save, X, PlusCircle, Network } from 'lucide-react';
import type { Resource, ResourceStatus } from '@/types';
import { initialMockResourceTypes, labsList, resourceStatusesList } from '@/lib/mock-data';
import { parseISO, format, isValid as isValidDate } from 'date-fns';
import { Separator } from '@/components/ui/separator';

const VALID_REMOTE_PROTOCOLS = ['RDP', 'SSH', 'VNC', 'Other'] as const;
const NONE_PROTOCOL_VALUE = "--none-protocol--"; 

const resourceFormSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters.' }).max(100, { message: 'Name cannot exceed 100 characters.' }),
  resourceTypeId: z.string().min(1, { message: 'Please select a resource type.' }),
  lab: z.enum(labsList as [string, ...string[]], { required_error: 'Please select a lab.' }),
  status: z.enum(resourceStatusesList as [string, ...string[]], { required_error: 'Please select a status.'}),
  description: z.string().max(500, { message: 'Description cannot exceed 500 characters.' }).optional().or(z.literal('')),
  imageUrl: z.string().url({ message: 'Please enter a valid URL.' }).optional().or(z.literal('')),
  manufacturer: z.string().max(100).optional().or(z.literal('')),
  model: z.string().max(100).optional().or(z.literal('')),
  serialNumber: z.string().max(100).optional().or(z.literal('')),
  purchaseDate: z.string().optional().refine((val) => {
    if (!val || val === '') return true;
    const date = parseISO(val);
    return isValidDate(date);
  }, { message: "Invalid date format for purchase date." }).or(z.literal('')),
  notes: z.string().max(500).optional().or(z.literal('')),
  features: z.string().max(200, {message: "Features list cannot exceed 200 characters."}).optional().or(z.literal('')),
  remoteAccess: z.object({
    ipAddress: z.string().max(45).optional().or(z.literal('')),
    hostname: z.string().max(255).optional().or(z.literal('')),
    protocol: z.enum(VALID_REMOTE_PROTOCOLS).or(z.literal('')).optional(),
    username: z.string().max(100).optional().or(z.literal('')),
    port: z.coerce.number().int().min(1).max(65535).optional().or(z.literal('')),
    notes: z.string().max(500).optional().or(z.literal('')),
  }).optional(),
});

export type ResourceFormValues = z.infer<typeof resourceFormSchema>;

interface ResourceFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialResource: Resource | null;
  onSave: (data: ResourceFormValues) => void;
}

export function ResourceFormDialog({
    open, onOpenChange, initialResource, onSave,
}: ResourceFormDialogProps) {
  const form = useForm<ResourceFormValues>({
    resolver: zodResolver(resourceFormSchema),
    defaultValues: {
      name: '',
      resourceTypeId: initialMockResourceTypes.length > 0 ? initialMockResourceTypes[0].id : '',
      lab: labsList.length > 0 ? labsList[0] : undefined,
      status: 'Available',
      description: '',
      imageUrl: '',
      manufacturer: '',
      model: '',
      serialNumber: '',
      purchaseDate: '',
      notes: '',
      features: '',
      remoteAccess: {
        ipAddress: '',
        hostname: '',
        protocol: '', 
        username: '',
        port: undefined, 
        notes: '',
      }
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
          manufacturer: initialResource.manufacturer || '',
          model: initialResource.model || '',
          serialNumber: initialResource.serialNumber || '',
          purchaseDate: initialResource.purchaseDate && isValidDate(parseISO(initialResource.purchaseDate)) ? format(parseISO(initialResource.purchaseDate), 'yyyy-MM-dd') : '',
          notes: initialResource.notes || '',
          features: initialResource.features?.join(', ') || '',
          remoteAccess: {
            ipAddress: initialResource.remoteAccess?.ipAddress || '',
            hostname: initialResource.remoteAccess?.hostname || '',
            protocol: initialResource.remoteAccess?.protocol || '',
            username: initialResource.remoteAccess?.username || '',
            port: initialResource.remoteAccess?.port ?? undefined,
            notes: initialResource.remoteAccess?.notes || '',
          }
        });
      } else {
        form.reset({
          name: '',
          resourceTypeId: initialMockResourceTypes.length > 0 ? initialMockResourceTypes[0].id : '',
          lab: labsList.length > 0 ? labsList[0] : undefined,
          status: 'Available',
          description: '',
          imageUrl: 'https://placehold.co/300x200.png',
          manufacturer: '',
          model: '',
          serialNumber: '',
          purchaseDate: '',
          notes: '',
          features: '',
          remoteAccess: { 
            ipAddress: '',
            hostname: '',
            protocol: '', 
            username: '',
            port: undefined,
            notes: '',
          }
        });
      }
    }
  }, [open, initialResource, form.reset]);

  function onSubmit(data: ResourceFormValues) {
    const dataToSave: ResourceFormValues = {
        ...data,
        imageUrl: data.imageUrl || 'https://placehold.co/300x200.png', // Default if empty
        purchaseDate: data.purchaseDate ? data.purchaseDate : undefined,
        remoteAccess: data.remoteAccess ? {
            ...data.remoteAccess,
            port: data.remoteAccess.port && String(data.remoteAccess.port) !== '' ? Number(data.remoteAccess.port) : undefined,
            protocol: data.remoteAccess.protocol === '' ? undefined : data.remoteAccess.protocol,
            ipAddress: data.remoteAccess.ipAddress || undefined,
            hostname: data.remoteAccess.hostname || undefined,
            username: data.remoteAccess.username || undefined,
            notes: data.remoteAccess.notes || undefined,
        } : undefined,
    };
    if (dataToSave.remoteAccess && Object.values(dataToSave.remoteAccess).every(val => val === undefined || val === '')) {
      dataToSave.remoteAccess = undefined;
    }
    onSave(dataToSave);
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
            <ScrollArea className="h-[65vh] pr-6">
            <div className="space-y-6 py-2 pb-4">
                <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                    <FormItem>
                    <FormLabel>Resource Name</FormLabel>
                    <FormControl><Input placeholder="e.g., Keysight Oscilloscope MSOX3054T" {...field} /></FormControl>
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
                        <Select onValueChange={field.onChange} value={field.value || ''}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger></FormControl>
                            <SelectContent>
                            {initialMockResourceTypes.map(type => (
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
                        <Select onValueChange={field.onChange} value={field.value || ''}>
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
                    <FormLabel>Description</FormLabel>
                    <FormControl><Textarea placeholder="Detailed description of the resource..." {...field} value={field.value || ''} rows={3} /></FormControl>
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
                            <FormControl><Input type="url" placeholder="https://placehold.co/300x200.png" {...field} value={field.value || ''} /></FormControl>
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
                            <FormControl><Input placeholder="e.g., Keysight" {...field} value={field.value || ''} /></FormControl>
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
                            <FormControl><Input placeholder="e.g., MSOX3054T" {...field} value={field.value || ''} /></FormControl>
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
                            <FormControl><Input placeholder="e.g., MY58012345" {...field} value={field.value || ''} /></FormControl>
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
                            <FormControl><Input type="date" {...field} value={field.value || ''} /></FormControl>
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
                        <Select onValueChange={field.onChange} value={field.value || ''}>
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
                </div>
                <FormField
                    control={form.control}
                    name="features"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Features (Optional)</FormLabel>
                        <FormControl><Textarea placeholder="e.g., 500 MHz Bandwidth, 4 Analog Channels, 16 Digital Channels" {...field} value={field.value || ''} rows={2}/></FormControl>
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
                        <FormControl><Textarea placeholder="Any additional notes or special instructions..." {...field} value={field.value || ''} rows={2}/></FormControl>
                        <FormMessage />
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
                                    <FormLabel>IP Address</FormLabel>
                                    <FormControl><Input placeholder="e.g., 192.168.1.100" {...field} value={field.value || ''} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="remoteAccess.hostname"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Hostname</FormLabel>
                                    <FormControl><Input placeholder="e.g., scope-01.lab.internal" {...field} value={field.value || ''} /></FormControl>
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
                                    <FormLabel>Protocol</FormLabel>
                                    <Select
                                      onValueChange={(v) => field.onChange(v === NONE_PROTOCOL_VALUE ? '' : v)}
                                      value={field.value === '' || field.value === undefined || field.value === null ? NONE_PROTOCOL_VALUE : field.value}
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
                                    <FormLabel>Port</FormLabel>
                                    <FormControl><Input type="number" placeholder="e.g., 22 (SSH), 3389 (RDP)" {...field} value={field.value === undefined ? '' : String(field.value)} onChange={e => field.onChange(e.target.value === '' ? undefined : Number(e.target.value))} /></FormControl>
                                    <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="remoteAccess.username"
                                render={({ field }) => (
                                    <FormItem>
                                    <FormLabel>Username</FormLabel>
                                    <FormControl><Input placeholder="e.g., labuser" {...field}  value={field.value || ''}/></FormControl>
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
                                <FormLabel>Connection Notes</FormLabel>
                                <FormControl><Textarea placeholder="e.g., VPN required, specific client versions, credential location..." {...field} value={field.value || ''} rows={2} /></FormControl>
                                <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

            </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t">
              <DialogClose asChild>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
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
