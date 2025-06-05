
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DateRange } from 'react-day-picker';
import type { Resource, UnavailabilityPeriod } from '@/types';
import { format, startOfDay, isValid as isValidDateFn, parseISO, isBefore, isSameDay, max, min, formatISO } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { Trash2, PlusCircle, Loader2, Save, X } from 'lucide-react';

interface ManageUnavailabilityDialogProps {
  resource: Resource;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveUnavailability: (updatedPeriods: UnavailabilityPeriod[]) => Promise<void>;
}

export function ManageUnavailabilityDialog({ resource, open, onOpenChange, onSaveUnavailability }: ManageUnavailabilityDialogProps) {
  const [currentPeriods, setCurrentPeriods] = useState<UnavailabilityPeriod[]>([]);
  const [selectedDateRange, setSelectedDateRange] = useState<DateRange | undefined>(undefined);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const initializeDialogState = useCallback(() => {
    setIsSubmitting(false);
    setCurrentPeriods(resource.unavailabilityPeriods ? 
      [...resource.unavailabilityPeriods.map(p => ({
        ...p, 
        id: p.id || (`unavail-${Date.now()}-${Math.random().toString(36).substring(2,9)}`)
      }))] 
      : []
    );
    setSelectedDateRange(undefined);
    setReason('');
  }, [resource.unavailabilityPeriods]);


  useEffect(() => {
    if (open) {
      initializeDialogState();
    }
  }, [open, initializeDialogState]);

  const handleAddPeriod = () => {
    if (!selectedDateRange || !selectedDateRange.from) {
      toast({ title: "Invalid Date Range", description: "Please select a start date for the period.", variant: "destructive" });
      return;
    }
    const fromDate = startOfDay(selectedDateRange.from);
    const toDate = selectedDateRange.to ? startOfDay(selectedDateRange.to) : fromDate;

    if (isBefore(toDate, fromDate)) {
      toast({ title: "Invalid Date Range", description: "End date cannot be before start date.", variant: "destructive" });
      return;
    }

    const newPeriod: UnavailabilityPeriod = {
      id: `unavail-${Date.now()}-${Math.random().toString(36).substring(2,9)}`,
      startDate: formatISO(fromDate, { representation: 'date' }), 
      endDate: formatISO(toDate, { representation: 'date' }),     
      reason: reason.trim() || undefined,
    };

    const newStart = fromDate;
    const newEnd = toDate;

    const overlap = currentPeriods.some(p => {
        const pStart = parseISO(p.startDate); 
        const pEnd = parseISO(p.endDate);
        return (newStart <= pEnd && newEnd >= pStart);
    });

    if(overlap) {
        toast({ title: "Overlap Detected", description: "This period overlaps or is adjacent to an existing unavailability period. Please adjust or delete the existing period.", variant: "destructive", duration: 7000 });
        return;
    }

    const updatedPeriods = [...currentPeriods, newPeriod].sort((a,b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
    setCurrentPeriods(updatedPeriods);
    setSelectedDateRange(undefined);
    setReason('');
    toast({ title: "Period Added (Locally)", description: "New unavailability period added. Click 'Save Changes' to persist all modifications." });
  };

  const handleDeletePeriod = (periodId: string) => {
    const updatedPeriods = currentPeriods.filter(p => p.id !== periodId);
    setCurrentPeriods(updatedPeriods);
    toast({ title: "Period Removed (Locally)", description: "Unavailability period removed. Click 'Save Changes' to persist all modifications." });
  };

  const handleSaveChanges = async () => {
    setIsSubmitting(true);
    try {
        const periodsToSave = currentPeriods.map(p => ({...p, id: String(p.id) }));
        await onSaveUnavailability(periodsToSave);
    } catch (error) {
        // Parent handles toast
    } finally {
        setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Manage Unavailability for "{resource.name}"</DialogTitle>
          <DialogDescription>
            Define periods when this resource will be unavailable for booking.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[65vh] mt-4">
          <div className="space-y-6 pr-1">
            <div>
              <h3 className="text-lg font-semibold mb-2">Add New Unavailability Period</h3>
              <div className="space-y-4 p-4 border rounded-md">
                <div>
                  <Label htmlFor="unavailabilityDateRange">Date Range</Label>
                  <Calendar
                    id="unavailabilityDateRange"
                    mode="range"
                    selected={selectedDateRange}
                    onSelect={setSelectedDateRange}
                    numberOfMonths={1}
                    disabled={(date) => date < startOfDay(new Date())} 
                    className="rounded-md border p-0 [&_button]:h-8 [&_button]:w-8 [&_caption_label]:text-sm mt-1"
                  />
                   <p className="text-xs text-muted-foreground mt-1">
                    Selected: {selectedDateRange?.from ? format(selectedDateRange.from, 'PPP') : 'None'} - {selectedDateRange?.to ? format(selectedDateRange.to, 'PPP') : (selectedDateRange?.from ? format(selectedDateRange.from, 'PPP') : 'None')}
                  </p>
                </div>
                <div>
                  <Label htmlFor="unavailabilityReason">Reason (Optional)</Label>
                  <Input
                    id="unavailabilityReason"
                    placeholder="e.g., Scheduled Maintenance, Lab Holiday"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-1"
                  />
                </div>
                <Button onClick={handleAddPeriod} size="sm" disabled={isSubmitting || !selectedDateRange?.from}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Period to List
                </Button>
              </div>
            </div>

            <div className="pt-2">
              <h3 className="text-lg font-semibold mb-2">Current Unavailability Periods ({currentPeriods.length})</h3>
              {currentPeriods.length > 0 ? (
                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {currentPeriods.map((period) => (
                        <TableRow key={period.id}>
                          <TableCell>{isValidDateFn(parseISO(period.startDate)) ? format(parseISO(period.startDate), 'PPP') : 'Invalid Date'}</TableCell>
                          <TableCell>{isValidDateFn(parseISO(period.endDate)) ? format(parseISO(period.endDate), 'PPP') : 'Invalid Date'}</TableCell>
                          <TableCell>{period.reason || <span className="italic text-muted-foreground">N/A</span>}</TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDeletePeriod(period.id)} disabled={isSubmitting}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete Period</span>
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No unavailability periods defined for this resource.</p>
              )}
            </div>
          </div>
        </ScrollArea>
        <DialogFooter className="pt-6 border-t">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            <X className="mr-2 h-4 w-4" /> Cancel
          </Button>
          <Button onClick={handleSaveChanges} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {isSubmitting ? 'Saving...' : 'Save All Changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
