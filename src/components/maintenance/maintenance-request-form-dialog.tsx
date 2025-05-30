
'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
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
import { Save, X, PlusCircle, Loader2 } from 'lucide-react';
import type { MaintenanceRequest, MaintenanceRequestStatus, User, Resource, RoleName } from '@/types';
import { maintenanceRequestStatuses } from '@/lib/app-constants';
import { Timestamp, serverTimestamp } from 'firebase/firestore';
import { format, parseISO, isValid as isValidDateFn } from 'date-fns';

const UNASSIGNED_TECHNICIAN_VALUE = "--unassigned--";

const maintenanceRequestFormSchema = z.object({
  resourceId: z.string().min(1, { message: 'Please select a resource.' }),
  issueDescription: z.string().min(10, { message: 'Issue description must be at least 10 characters.' }).max(1000, { message: 'Description cannot exceed 1000 characters.' }),
  status: z.enum(maintenanceRequestStatuses as [MaintenanceRequestStatus, ...MaintenanceRequestStatus[]], { required_error: 'Please select a status.'}),
  assignedTechnicianId: z.string().optional().or(z.literal('')),
  resolutionNotes: z.string().max(1000).optional().or(z.literal('')),
  dateResolved: z.string().optional().refine(val => !val || isValidDateFn(parseISO(val)), {
    message: "Invalid resolved date/time format. Use YYYY-MM-DDTHH:mm",
  }).or(z.literal('')),
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
  onSave: (data: MaintenanceRequestFormValues) => Promise<void>;
  technicians: User[];
  resources: Resource[];
  currentUserRole?: RoleName;
}

const formatForDateTimeLocal = (date?: Date | null): string => {
  if (!date || !isValidDateFn(date)) return '';
  try {
    return format(date, "yyyy-MM-dd'T'HH:mm");
  } catch (e) { return ''; }
};

export function MaintenanceRequestFormDialog({
    open, onOpenChange, initialRequest, onSave, technicians, resources, currentUserRole
}: MaintenanceRequestFormDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const form = useForm<MaintenanceRequestFormValues>({
    resolver: zodResolver(maintenanceRequestFormSchema),
    defaultValues: {
        resourceId: '',
        issueDescription: '',
        status: 'Open',
        assignedTechnicianId: '',
        resolutionNotes: '',
        dateResolved: '',
    },
  });

  const watchStatus = form.watch('status');

  const resetForm = useCallback(() => {
    if (initialRequest) {
      form.reset({
        resourceId: initialRequest.resourceId,
        issueDescription: initialRequest.issueDescription,
        status: initialRequest.status,
        assignedTechnicianId: initialRequest.assignedTechnicianId || '',
        resolutionNotes: initialRequest.resolutionNotes || '',
        dateResolved: formatForDateTimeLocal(initialRequest.dateResolved),
      });
    } else {
      form.reset({
        resourceId: resources.length > 0 ? resources[0].id : '',
        issueDescription: '',
        status: 'Open',
        assignedTechnicianId: '',
        resolutionNotes: '',
        dateResolved: '',
      });
    }
  }, [initialRequest, resources, form.reset]);

  useEffect(() => {
    if (open) {
      setIsSubmitting(false);
      resetForm();
    }
  }, [open, initialRequest, resources, form.reset, resetForm]);

  async function onSubmit(data: MaintenanceRequestFormValues) {
    setIsSubmitting(true);
    const dataToSave = {
      ...data,
      assignedTechnicianId: data.assignedTechnicianId === UNASSIGNED_TECHNICIAN_VALUE || data.assignedTechnicianId === ''
                            ? undefined
                            : data.assignedTechnicianId,
    };
    try {
      await onSave(dataToSave);
    } catch (error) {
        console.error("Error in MaintenanceRequestFormDialog onSubmit:", error);
    } finally {
        setIsSubmitting(false);
    }
  }

  const canOnlyEditDescription = useMemo(() => {
    if (!currentUserRole || !initialRequest) return false;
    return initialRequest.status === 'Open' && currentUserRole === 'Researcher' && initialRequest.reportedByUserId === form.getValues('reportedByUserId'); // Assuming reportedByUserId is implicitly part of initialRequest and not changed
  }, [currentUserRole, initialRequest, form]);

  const canEditAsTechnician = useMemo(() => {
     if (!currentUserRole || !initialRequest) return false;
     return currentUserRole === 'Technician' && initialRequest.assignedTechnicianId === form.getValues('assignedTechnicianId'); // Assuming assignedTechnicianId is implicitly part of initialRequest
  }, [currentUserRole, initialRequest, form]);

  const canAdminister = useMemo(() => {
      return currentUserRole === 'Admin';
  }, [currentUserRole]);


  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{initialRequest ? 'Edit Maintenance Request' : 'Log New Maintenance Request'}</DialogTitle>
          <DialogDescription>
            {initialRequest ? `Update details for the request.` : 'Provide information for the new maintenance request.'}
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
                            disabled={!!initialRequest || resources.length === 0 || isSubmitting}
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
                        <FormControl><Textarea placeholder="Detailed description of the problem..." {...field} value={field.value || ''} rows={5} disabled={isSubmitting || (!!initialRequest && !canAdminister && !canEditAsTechnician && !canOnlyEditDescription)} /></FormControl>
                        {(!!initialRequest && !canAdminister && !canEditAsTechnician && !canOnlyEditDescription) && <FormDescription>Description can only be edited by authorized personnel or if you reported it and status is 'Open'.</FormDescription>}
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
                            <Select onValueChange={field.onChange} value={field.value || 'Open'} disabled={!canAdminister && !canEditAsTechnician || isSubmitting}>
                                <FormControl><SelectTrigger><SelectValue placeholder="Select status" /></SelectTrigger></FormControl>
                                <SelectContent>
                                {maintenanceRequestStatuses.map(statusVal => (
                                    <SelectItem key={statusVal} value={statusVal}>{statusVal}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            {(!canAdminister && !canEditAsTechnician) && <FormDescription>Status can only be changed by authorized personnel.</FormDescription>}
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
                                onValueChange={(value) => field.onChange(value)}
                                value={field.value || UNASSIGNED_TECHNICIAN_VALUE}
                                disabled={!canAdminister || isSubmitting}
                            >
                                <FormControl><SelectTrigger><SelectValue placeholder="Select a technician" /></SelectTrigger></FormControl>
                                <SelectContent>
                                  <SelectItem value={UNASSIGNED_TECHNICIAN_VALUE}>Unassigned</SelectItem>
                                {technicians.map(tech => (
                                    <SelectItem key={tech.id} value={tech.id}>{tech.name}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                            {!canAdminister && <FormDescription>Technician assignment can only be changed by Admins.</FormDescription>}
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>
                {(watchStatus === 'Resolved' || watchStatus === 'Closed') && (
                    <>
                     <FormField
                        control={form.control}
                        name="resolutionNotes"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Resolution Notes {watchStatus === 'Resolved' || watchStatus === 'Closed' ? <span className="text-destructive">*</span> : ''}</FormLabel>
                            <FormControl><Textarea placeholder="Describe the resolution steps taken..." {...field} value={field.value || ''} rows={4} disabled={!canAdminister && !canEditAsTechnician || isSubmitting} /></FormControl>
                             <FormDescription>Required if status is Resolved or Closed.
                             {(!canAdminister && !canEditAsTechnician) && " Only authorized personnel can add resolution notes."}
                             </FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="dateResolved"
                        render={({ field }) => (
                            <FormItem>
                            <FormLabel>Date Resolved (Optional)</FormLabel>
                            <FormControl><Input type="datetime-local" {...field} value={field.value || ''} disabled={!canAdminister && !canEditAsTechnician || isSubmitting} /></FormControl>
                            <FormDescription>Defaults to now if status is set to Resolved/Closed and no date is provided.</FormDescription>
                            <FormMessage />
                            </FormItem>
                        )}
                    />
                    </>
                )}
            </div>
            </ScrollArea>
            <DialogFooter className="pt-6 border-t mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || (!!initialRequest && !canAdminister && !canEditAsTechnician && !canOnlyEditDescription) }>
                {isSubmitting
                  ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  : (initialRequest ? <Save className="mr-2 h-4 w-4" /> : <PlusCircle className="mr-2 h-4 w-4" />)
                }
                {isSubmitting
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
