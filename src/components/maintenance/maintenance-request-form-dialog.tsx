
'use client';

import { useEffect, useMemo } from 'react';
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
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, X, PlusCircle, Loader2 } from 'lucide-react';
import type { MaintenanceRequest, MaintenanceRequestStatus, User, Resource, RoleName } from '@/types';
import { maintenanceRequestStatuses } from '@/lib/mock-data';

const UNASSIGNED_TECHNICIAN_VALUE = "--unassigned--";

const maintenanceRequestFormSchema = z.object({
  resourceId: z.string().min(1, { message: 'Please select a resource.' }),
  issueDescription: z.string().min(10, { message: 'Issue description must be at least 10 characters.' }).max(1000, { message: 'Description cannot exceed 1000 characters.' }),
  status: z.enum(maintenanceRequestStatuses as [MaintenanceRequestStatus, ...MaintenanceRequestStatus[]], { required_error: 'Please select a status.'}),
  assignedTechnicianId: z.string().optional().or(z.literal('')),
  resolutionNotes: z.string().max(1000).optional().or(z.literal('')),
}).refine(data => {
  if ((data.status === 'Resolved' || data.status === 'Closed') && (!data.resolutionNotes || data.resolutionNotes.trim() === '')) {
    return false;
  }
  return true;
}, {
  message: 'Resolution notes are required when status is Resolved or Closed.',
  path: ['resolutionNotes'],
});

export type MaintenanceRequestFormValues = z.infer<typeof maintenanceRequestFormSchema>;

interface MaintenanceRequestFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialRequest: MaintenanceRequest | null;
  onSave: (data: MaintenanceRequestFormValues) => Promise<void>; // Make onSave async
  technicians: User[];
  resources: Resource[];
  currentUserRole?: RoleName;
}


export function MaintenanceRequestFormDialog({
    open, onOpenChange, initialRequest, onSave, technicians, resources, currentUserRole
}: MaintenanceRequestFormDialogProps) {
  const form = useForm<MaintenanceRequestFormValues>({
    resolver: zodResolver(maintenanceRequestFormSchema),
    // Default values set in useEffect
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
  }, [open, initialRequest, resources, form.reset, form]); // Added form to dependency array

  async function onSubmit(data: MaintenanceRequestFormValues) {
    const dataToSave = {
      ...data,
      assignedTechnicianId: data.assignedTechnicianId === UNASSIGNED_TECHNICIAN_VALUE || data.assignedTechnicianId === '' ? undefined : data.assignedTechnicianId,
    };
    await onSave(dataToSave);
    // Parent component (MaintenanceRequestsPage) will handle closing the dialog on successful save
  }

  const canEditSensitiveFields = useMemo(() => {
    if (!currentUserRole) return false;
    return currentUserRole === 'Admin' || currentUserRole === 'Lab Manager' || currentUserRole === 'Technician';
  }, [currentUserRole]);

  const formIsSubmitting = form.formState.isSubmitting;


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialRequest ? 'Edit Maintenance Request' : 'Log New Maintenance Request'}</DialogTitle>
          <DialogDescription>
            {/* @ts-ignore client-side augmented property */}
            {initialRequest ? `Update details for request on "${initialRequest.resourceName}".` : 'Provide information for the new maintenance request.'}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="max-h-[60vh] overflow-y-auto pr-2">
            <div className="space-y-4 py-2 pb-4">
                <FormField
                    control={form.control}
                    name="resourceId"
                    render={({ field }) => (
                        <FormItem>
                        <FormLabel>Resource</FormLabel>
                        <Select
                            onValueChange={field.onChange}
                            value={field.value || ''}
                            disabled={!!initialRequest || resources.length === 0}
                        >
                            <FormControl><SelectTrigger><SelectValue placeholder={resources.length > 0 ? "Select a resource" : "No resources available"} /></SelectTrigger></FormControl>
                            <SelectContent>
                            {resources.map(res => (
                                <SelectItem key={res.id} value={res.id}>{res.name} ({res.lab})</SelectItem>
                            ))}
                            </SelectContent>
                        </Select>
                        {!!initialRequest && <FormDescription>Resource cannot be changed after logging.</FormDescription>}
                        {resources.length === 0 && <FormDescription className="text-destructive">No resources found. Add resources first.</FormDescription>}
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
                        <FormControl><Textarea placeholder="Detailed description of the problem..." {...field} value={field.value || ''} rows={5} /></FormControl>
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
                            <Select onValueChange={field.onChange} value={field.value || 'Open'} disabled={!canEditSensitiveFields && !!initialRequest}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                <SelectContent>
                                {maintenanceRequestStatuses.map(statusVal => (
                                    <SelectItem key={statusVal} value={statusVal}>{statusVal}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            {(!canEditSensitiveFields && !!initialRequest) && <FormDescription>Status can only be changed by authorized personnel.</FormDescription>}
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
                            <Select
                                onValueChange={(value) => field.onChange(value === UNASSIGNED_TECHNICIAN_VALUE ? '' : value)}
                                value={field.value || UNASSIGNED_TECHNICIAN_VALUE}
                                disabled={!canEditSensitiveFields && !!initialRequest}
                            >
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a technician" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value={UNASSIGNED_TECHNICIAN_VALUE}>Unassigned</SelectItem>
                                {technicians.map(tech => (
                                    <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            {(!canEditSensitiveFields && !!initialRequest) && <FormDescription>Technician assignment can only be changed by authorized personnel.</FormDescription>}
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
                            <FormLabel>Resolution Notes {watchStatus === 'Resolved' || watchStatus === 'Closed' ? <span className="text-destructive">*</span> : ''}</FormLabel>
                            <FormControl><Textarea placeholder="Describe the resolution steps taken..." {...field} value={field.value || ''} rows={4} disabled={!canEditSensitiveFields && !!initialRequest} /></FormControl>
                             <FormDescription>Required if status is Resolved or Closed.
                             {(!canEditSensitiveFields && !!initialRequest) && " Only authorized personnel can add resolution notes."}
                             </FormDescription>
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
              <Button type="submit" disabled={formIsSubmitting || (!canEditSensitiveFields && !!initialRequest && initialRequest.status !== 'Open')}>
                {formIsSubmitting
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : (initialRequest ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)
                }
                {formIsSubmitting
                  ? (initialRequest ? 'Saving...' : 'Logging Request...')
                  : (initialRequest ? 'Save Changes' : 'Log Request')
                }
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
