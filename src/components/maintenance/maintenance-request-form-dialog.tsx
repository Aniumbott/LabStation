
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
import type { MaintenanceRequest, MaintenanceRequestStatus, User, Resource } from '@/types';
import { maintenanceRequestStatuses } from '@/lib/mock-data';

const maintenanceRequestFormSchema = z.object({
  resourceId: z.string().min(1, { message: 'Please select a resource.' }),
  issueDescription: z.string().min(10, { message: 'Issue description must be at least 10 characters.' }).max(1000, { message: 'Description cannot exceed 1000 characters.' }),
  status: z.enum(maintenanceRequestStatuses as [string, ...string[]], { required_error: 'Please select a status.'}),
  assignedTechnicianId: z.string().optional(),
  resolutionNotes: z.string().max(1000).optional(),
});

export type MaintenanceRequestFormValues = z.infer<typeof maintenanceRequestFormSchema>;

interface MaintenanceRequestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRequest: MaintenanceRequest | null;
  onSave: (data: MaintenanceRequestFormValues) => void;
  technicians: User[];
  resources: Resource[];
}

export function MaintenanceRequestFormDialog({
    open, onOpenChange, initialRequest, onSave, technicians, resources
}: MaintenanceRequestFormDialogProps) {
  const form = useForm<MaintenanceRequestFormValues>({
    resolver: zodResolver(maintenanceRequestFormSchema),
    defaultValues: {
      resourceId: '',
      issueDescription: '',
      status: 'Open',
      assignedTechnicianId: '',
      resolutionNotes: '',
    },
  });

  const watchStatus = form.watch('status');

  useEffect(() => {
    if (open) {
      if (initialRequest) {
        form.reset({
          resourceId: initialRequest.resourceId,
          issueDescription: initialRequest.issueDescription,
          status: initialRequest.status,
          assignedTechnicianId: initialRequest.assignedTechnicianId || '',
          resolutionNotes: initialRequest.resolutionNotes || '',
        });
      } else {
        form.reset({
          resourceId: resources.length > 0 ? resources[0].id : '',
          issueDescription: '',
          status: 'Open',
          assignedTechnicianId: '',
          resolutionNotes: '',
        });
      }
    }
  }, [open, initialRequest, form, resources]);

  function onSubmit(data: MaintenanceRequestFormValues) {
    onSave(data);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialRequest ? 'Edit Maintenance Request' : 'Log New Maintenance Request'}</DialogTitle>
          <DialogDescription>
            {initialRequest ? `Update details for request on "${initialRequest.resourceName}".` : 'Provide information for the new maintenance request.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] pr-6">
            <div className="space-y-4 py-2 pb-4">
                <FormField
                    control={form.control}
                    name="resourceId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Resource</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ''} disabled={!!initialRequest}>
                            <FormControl><SelectTrigger><SelectValue placeholder="Select a resource" /></SelectTrigger></FormControl>
                            <SelectContent>
                            {resources.map(res => (
                                <SelectItem key={res.id} value={res.id}>{res.name} ({res.lab})</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        {initialRequest && <FormDescription>Resource cannot be changed after logging.</FormDescription>}
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <FormField
                    control={form.control}
                    name="issueDescription"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Issue Description</FormLabel>
                        <FormControl><Textarea placeholder="Detailed description of the problem..." {...field} rows={5} /></FormControl>
                        <FormMessage />
                        </FormItem>
                    )}
                />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="status"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Status</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                <SelectContent>
                                {maintenanceRequestStatuses.map(statusVal => (
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
                        name="assignedTechnicianId"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Assign Technician (Optional)</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value || ''}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a technician" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value="">Unassigned</SelectItem>
                                {technicians.map(tech => (
                                    <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                {(watchStatus === 'Resolved' || watchStatus === 'Closed') && (
                     <FormField
                        control={form.control}
                        name="resolutionNotes"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Resolution Notes {watchStatus === 'Resolved' && <span className="text-destructive">*</span>}</FormLabel>
                            <FormControl><Textarea placeholder="Describe the resolution steps taken..." {...field} rows={4} /></FormControl>
                             <FormDescription>Required if status is Resolved or Closed.</FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                )}
            </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting
                  ? (initialRequest ? 'Saving...' : 'Logging Request...')
                  : (initialRequest ? <><Save className="mr-2 h-4 w-4" /> Save Changes</> : <><PlusCircle className="mr-2 h-4 w-4" /> Log Request</>)
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
