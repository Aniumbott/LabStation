
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CalendarOff, PlusCircle, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon, Repeat, X, Loader2, CheckCircle2 } from 'lucide-react';
import type { BlackoutDate, RecurringBlackoutRule, RoleName } from '@/types';
import { useAuth } from '@/components/auth-context';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger, // Added AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid as isValidDateFn, Timestamp } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { BlackoutDateFormDialog, BlackoutDateFormValues } from '@/components/admin/blackout-date-form-dialog';
import { RecurringBlackoutRuleFormDialog, RecurringBlackoutRuleFormValues } from '@/components/admin/recurring-blackout-rule-form-dialog';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { addAuditLog } from '@/lib/firestore-helpers';

export default function BlackoutDatesPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);
  const [recurringRules, setRecurringRules] = useState<RecurringBlackoutRule[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isDateFormDialogOpen, setIsDateFormDialogOpen] = useState(false);
  const [editingBlackoutDate, setEditingBlackoutDate] = useState<BlackoutDate | null>(null);
  const [dateToDelete, setDateToDelete] = useState<BlackoutDate | null>(null);

  const [isRecurringFormDialogOpen, setIsRecurringFormDialogOpen] = useState(false);
  const [editingRecurringRule, setEditingRecurringRule] = useState<RecurringBlackoutRule | null>(null);
  const [ruleToDelete, setRuleToDelete] = useState<RecurringBlackoutRule | null>(null);

  const [isDateFilterDialogOpen, setIsDateFilterDialogOpen] = useState(false);
  const [tempDateSearchTerm, setTempDateSearchTerm] = useState('');
  const [activeDateSearchTerm, setActiveDateSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const boQuery = query(collection(db, "blackoutDates"), orderBy("date", "asc"));
      const boSnapshot = await getDocs(boQuery);
      setBlackoutDates(boSnapshot.docs.map(d => {
        const data = d.data();
        // date is already string 'YYYY-MM-DD' from Firestore
        return { id: d.id, ...data } as BlackoutDate;
      }));

      const rrQuery = query(collection(db, "recurringBlackoutRules"), orderBy("name", "asc"));
      const rrSnapshot = await getDocs(rrQuery);
      setRecurringRules(rrSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as RecurringBlackoutRule)));

    } catch (error: any) {
      console.error("Error fetching blackout data:", error);
      toast({ title: "Database Error", description: `Failed to load blackout data: ${error.message}`, variant: "destructive" });
      setBlackoutDates([]);
      setRecurringRules([]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Lab Manager')) {
      fetchData();
    } else {
      setIsLoading(false);
      setBlackoutDates([]);
      setRecurringRules([]);
    }
  }, [fetchData, currentUser]);

  useEffect(() => {
    if (isDateFilterDialogOpen) {
      setTempDateSearchTerm(activeDateSearchTerm);
    }
  }, [isDateFilterDialogOpen, activeDateSearchTerm]);

  const filteredBlackoutDates = useMemo(() => {
    return blackoutDates.filter(bd => {
        const lowerSearchTerm = activeDateSearchTerm.toLowerCase();
        // Ensure bd.date and bd.reason exist before calling toLowerCase or format
        const reasonMatch = bd.reason && bd.reason.toLowerCase().includes(lowerSearchTerm);
        const dateMatch = bd.date && isValidDateFn(parseISO(bd.date)) && format(parseISO(bd.date), 'PPP').toLowerCase().includes(lowerSearchTerm);
        return !activeDateSearchTerm || reasonMatch || dateMatch;
    });
  }, [blackoutDates, activeDateSearchTerm]);

  const handleOpenNewDateDialog = useCallback(() => {
    setEditingBlackoutDate(null);
    setIsDateFormDialogOpen(true);
  }, []);

  const handleOpenEditDateDialog = useCallback((blackoutDate: BlackoutDate) => {
    setEditingBlackoutDate(blackoutDate);
    setIsDateFormDialogOpen(true);
  }, []);

  const handleSaveBlackoutDate = useCallback(async (data: BlackoutDateFormValues) => {
    if (!currentUser || !currentUser.id || !currentUser.name) {
      toast({ title: "Authentication Error", description: "You must be logged in to save blackout dates.", variant: "destructive" });
      return;
    }
    const formattedDateOnly = format(data.date, 'yyyy-MM-dd');
    const displayDate = format(data.date, 'PPP');

    const blackoutDataToSave: Omit<BlackoutDate, 'id'> = {
      date: formattedDateOnly,
      reason: data.reason || undefined, // Store undefined if reason is empty
    };

    setIsLoading(true);
    try {
      if (editingBlackoutDate) {
        const docRef = doc(db, "blackoutDates", editingBlackoutDate.id);
        await updateDoc(docRef, blackoutDataToSave);
        addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_UPDATED', { entityType: 'BlackoutDate', entityId: editingBlackoutDate.id, details: `Blackout Date for ${displayDate} updated. Reason: ${data.reason || 'N/A'}`});
        toast({ title: 'Blackout Date Updated', description: `Blackout date for ${displayDate} has been updated.` });
      } else {
        const docRef = await addDoc(collection(db, "blackoutDates"), blackoutDataToSave);
        // Optionally, update the document with its own ID if needed for your BlackoutDate type locally
        // await updateDoc(docRef, { id: docRef.id }); 
        addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_CREATED', { entityType: 'BlackoutDate', entityId: docRef.id, details: `Blackout Date for ${displayDate} created. Reason: ${data.reason || 'N/A'}`});
        toast({ title: 'Blackout Date Added', description: `Blackout date for ${displayDate} has been added.` });
      }
      setIsDateFormDialogOpen(false);
      setEditingBlackoutDate(null);
      await fetchData();
    } catch (error: any) {
      console.error("Error saving blackout date:", error);
      toast({ title: "Save Failed", description: `Could not save blackout date: ${error.message}`, variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, editingBlackoutDate, fetchData, toast]);

  const handleDeleteBlackoutDate = useCallback(async (blackoutDateId: string) => {
    if(!currentUser || !currentUser.id || !currentUser.name) {
        toast({ title: "Authentication Error", description: "You must be logged in to delete blackout dates.", variant: "destructive" });
        return;
    }
    const deletedDateObj = blackoutDates.find(bd => bd.id === blackoutDateId);
    if (!deletedDateObj) return;

    setIsLoading(true);
    try {
      const docRef = doc(db, "blackoutDates", blackoutDateId);
      await deleteDoc(docRef);
      addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_DELETED', { entityType: 'BlackoutDate', entityId: blackoutDateId, details: `Blackout Date for ${format(parseISO(deletedDateObj.date), 'PPP')} (Reason: ${deletedDateObj.reason || 'N/A'}) deleted.`});
      toast({ title: "Blackout Date Removed", description: `Blackout date for "${format(parseISO(deletedDateObj.date), 'PPP')}" has been removed.`, variant: "destructive" });
      setDateToDelete(null);
      await fetchData();
    } catch (error: any) {
        console.error("Error deleting blackout date:", error);
        toast({ title: "Delete Failed", description: `Could not remove blackout date: ${error.message}`, variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, blackoutDates, fetchData, toast]);

  const handleApplyDateDialogFilters = useCallback(() => {
    setActiveDateSearchTerm(tempDateSearchTerm);
    setIsDateFilterDialogOpen(false);
  }, [tempDateSearchTerm]);

  const resetDialogFiltersOnly = useCallback(() => { // Renamed from resetDateDialogFilters for clarity
    setTempDateSearchTerm('');
  }, []);

  const resetAllActiveDatePageFilters = useCallback(() => {
    setActiveDateSearchTerm('');
    resetDialogFiltersOnly(); 
    setIsDateFilterDialogOpen(false); 
  }, [resetDialogFiltersOnly]);


  const activeDateFilterCount = useMemo(() => [activeDateSearchTerm !== ''].filter(Boolean).length, [activeDateSearchTerm]);

  const handleOpenNewRecurringDialog = useCallback(() => {
    setEditingRecurringRule(null);
    setIsRecurringFormDialogOpen(true);
  }, []);

  const handleOpenEditRecurringDialog = useCallback((rule: RecurringBlackoutRule) => {
    setEditingRecurringRule(rule);
    setIsRecurringFormDialogOpen(true);
  }, []);

  const handleSaveRecurringRule = useCallback(async (data: RecurringBlackoutRuleFormValues) => {
    if (!currentUser || !currentUser.id || !currentUser.name) {
       toast({ title: "Authentication Error", description: "You must be logged in to save recurring rules.", variant: "destructive" });
      return;
    }
    const ruleDataToSave: Omit<RecurringBlackoutRule, 'id'> = {
      name: data.name,
      daysOfWeek: data.daysOfWeek,
      reason: data.reason || undefined,
    };

    setIsLoading(true);
    try {
      if (editingRecurringRule) {
        const docRef = doc(db, "recurringBlackoutRules", editingRecurringRule.id);
        await updateDoc(docRef, ruleDataToSave);
        addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_UPDATED', { entityType: 'RecurringBlackoutRule', entityId: editingRecurringRule.id, details: `Recurring rule '${data.name}' updated.`});
        toast({ title: 'Recurring Rule Updated', description: `Recurring rule "${data.name}" has been updated.` });
      } else {
        const docRef = await addDoc(collection(db, "recurringBlackoutRules"), ruleDataToSave);
        addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_CREATED', { entityType: 'RecurringBlackoutRule', entityId: docRef.id, details: `Recurring rule '${data.name}' created.`});
        toast({ title: 'Recurring Rule Added', description: `Recurring rule "${data.name}" has been added.` });
      }
      setIsRecurringFormDialogOpen(false);
      setEditingRecurringRule(null);
      await fetchData();
    } catch (error: any) {
      console.error("Error saving recurring rule:", error);
      toast({ title: "Save Failed", description: `Could not save recurring rule: ${error.message}`, variant: "destructive"});
    } finally {
        setIsLoading(false);
    }
  }, [currentUser, editingRecurringRule, fetchData, toast]);

  const handleDeleteRecurringRule = useCallback(async (ruleId: string) => {
    if(!currentUser || !currentUser.id || !currentUser.name) {
      toast({ title: "Authentication Error", description: "You must be logged in to delete recurring rules.", variant: "destructive" });
      return;
    }
    const deletedRuleObj = recurringRules.find(r => r.id === ruleId);
    if (!deletedRuleObj) return;

    setIsLoading(true);
    try {
      const docRef = doc(db, "recurringBlackoutRules", ruleId);
      await deleteDoc(docRef);
      addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_DELETED', { entityType: 'RecurringBlackoutRule', entityId: ruleId, details: `Recurring rule '${deletedRuleObj.name}' deleted.`});
      toast({ title: "Recurring Rule Removed", description: `Recurring rule "${deletedRuleObj.name}" has been removed.`, variant: "destructive" });
      setRuleToDelete(null);
      await fetchData();
    } catch (error: any) {
      console.error("Error deleting recurring rule:", error);
      toast({ title: "Delete Failed", description: `Could not remove recurring rule: ${error.message}`, variant: "destructive"});
    } finally {
      setIsLoading(false);
    }
  }, [currentUser, recurringRules, fetchData, toast]);

  const canManageBlackouts = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Lab Manager');

  if (!currentUser || !canManageBlackouts) {
    return (
      <div className="space-y-8">
        <PageHeader title="Lab Closures" icon={CalendarOff} description="Access Denied." />
        <Card className="text-center py-10 text-muted-foreground">
          <CardContent>
            <p>You do not have permission to view or manage lab closures.</p>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (isLoading && blackoutDates.length === 0 && recurringRules.length === 0) {
    return <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading blackout data...</div>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PageHeader
          title="Blackout Dates & Recurring Closures"
          description="Define specific dates and recurring rules when the entire lab is closed or unavailable."
          icon={CalendarOff}
          actions={ 
            canManageBlackouts && (
                <div className="flex items-center gap-2">
                <Button onClick={handleOpenNewDateDialog} size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Blackout Date
                    </Button>
                    <Button onClick={handleOpenNewRecurringDialog} size="sm">
                    <PlusCircle className="mr-2 h-4 w-4" /> Add Recurring Rule
                    </Button>
                </div>
            )
          }
        />

        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle>Specific Blackout Dates</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Manage individual lab closure dates.</p>
            </div>
            <Dialog open={isDateFilterDialogOpen} onOpenChange={setIsDateFilterDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <FilterIcon className="mr-2 h-4 w-4" />
                  Filter Dates
                  {activeDateFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">
                      {activeDateFilterCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-full max-w-md">
                <DialogHeader>
                  <DialogTitle>Filter Blackout Dates</DialogTitle>
                  <DialogDescription>Refine the list of blackout dates by keyword (reason or date).</DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="blackoutSearchDialog">Search (Reason/Date)</Label>
                    <div className="relative mt-1">
                      <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="blackoutSearchDialog"
                        type="search"
                        placeholder="e.g., Holiday, Maintenance, May 20..."
                        value={tempDateSearchTerm}
                        onChange={(e) => setTempDateSearchTerm(e.target.value)}
                        className="h-9 pl-8"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter className="pt-6 border-t mt-4">
                  <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsDateFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button>
                  <Button onClick={handleApplyDateDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading && filteredBlackoutDates.length === 0 && !activeDateSearchTerm ? (
                <div className="text-center py-10 text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />Fetching dates...</div>
            ) : filteredBlackoutDates.length > 0 ? (
              <div className="overflow-x-auto border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Reason</TableHead>
                      {canManageBlackouts && <TableHead className="text-right w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredBlackoutDates.map((bd) => (
                      <TableRow key={bd.id}>
                        <TableCell className="font-medium">{isValidDateFn(parseISO(bd.date)) ? format(parseISO(bd.date), 'PPP') : 'Invalid Date'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{bd.reason || 'N/A'}</TableCell>
                        {canManageBlackouts && (
                            <TableCell className="text-right space-x-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditDateDialog(bd)} disabled={isLoading}>
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit Blackout Date</span>
                                </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Edit Blackout Date</p></TooltipContent>
                            </Tooltip>
                            <AlertDialog open={dateToDelete?.id === bd.id} onOpenChange={(isOpen) => !isOpen && setDateToDelete(null)}>
                                <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setDateToDelete(bd)} disabled={isLoading}>
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete Blackout Date</span>
                                    </Button>
                                    </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Delete Blackout Date</p></TooltipContent>
                                </Tooltip>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will remove the blackout date
                                        <span className="font-semibold"> "{dateToDelete && isValidDateFn(parseISO(dateToDelete.date)) ? format(parseISO(dateToDelete.date), 'PPP') : ''}"</span>.
                                        All resources will be considered available on this day unless specified otherwise.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setDateToDelete(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction variant="destructive" onClick={() => dateToDelete && handleDeleteBlackoutDate(dateToDelete.id)}>
                                        Delete Blackout Date
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Card className="text-center py-10 text-muted-foreground bg-card border-0 shadow-none">
                <CardContent>
                  <CalendarOff className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p className="font-medium">
                    {activeDateFilterCount > 0 ? "No Blackout Dates Match Filter" : "No Specific Blackout Dates Defined"}
                  </p>
                  <p className="text-xs mb-3">
                    {activeDateFilterCount > 0 ? "Try adjusting your search criteria." : "Add individual lab-wide closure dates here."}
                  </p>
                  {activeDateFilterCount > 0 ? (
                    <Button variant="outline" size="sm" onClick={resetAllActiveDatePageFilters}>
                      <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                    </Button>
                  ) : (
                     !isLoading && blackoutDates.length === 0 && canManageBlackouts && (
                      <Button onClick={handleOpenNewDateDialog} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add First Blackout Date
                      </Button>
                    )
                  )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>

        <Separator className="my-8" />

        <Card>
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2">
             <div>
              <CardTitle>Recurring Lab Closures</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Manage weekly or other recurring unavailability rules.</p>
            </div>
          </CardHeader>
          <CardContent className="p-0">
             {isLoading && recurringRules.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />Fetching rules...</div>
            ) : recurringRules.length > 0 ? (
              <div className="overflow-x-auto border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rule Name</TableHead>
                      <TableHead>Days of Week</TableHead>
                      <TableHead>Reason</TableHead>
                      {canManageBlackouts && <TableHead className="text-right w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recurringRules.map((rule) => (
                      <TableRow key={rule.id}>
                        <TableCell className="font-medium">{rule.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{rule.daysOfWeek.join(', ')}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{rule.reason || 'N/A'}</TableCell>
                        {canManageBlackouts && (
                            <TableCell className="text-right space-x-1">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditRecurringDialog(rule)} disabled={isLoading}>
                                    <Edit className="h-4 w-4" />
                                    <span className="sr-only">Edit Recurring Rule</span>
                                </Button>
                                </TooltipTrigger>
                                <TooltipContent><p>Edit Recurring Rule</p></TooltipContent>
                            </Tooltip>
                            <AlertDialog open={ruleToDelete?.id === rule.id} onOpenChange={(isOpen) => !isOpen && setRuleToDelete(null)}>
                                <Tooltip>
                                <TooltipTrigger asChild>
                                    <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setRuleToDelete(rule)} disabled={isLoading}>
                                        <Trash2 className="h-4 w-4" />
                                        <span className="sr-only">Delete Recurring Rule</span>
                                    </Button>
                                    </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Delete Recurring Rule</p></TooltipContent>
                                </Tooltip>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                        This action cannot be undone. This will remove the recurring rule
                                        <span className="font-semibold"> "{ruleToDelete?.name}"</span>.
                                    </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setRuleToDelete(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction variant="destructive" onClick={() => ruleToDelete && handleDeleteRecurringRule(ruleToDelete.id)}>
                                        Delete Recurring Rule
                                    </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                            </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Card className="text-center py-10 text-muted-foreground bg-card border-0 shadow-none">
                <CardContent>
                  <Repeat className="mx-auto h-10 w-10 mb-3 opacity-50" />
                  <p className="font-medium">No Recurring Lab Closure Rules Defined</p>
                  <p className="text-xs mb-3">Add rules for regular closures like weekends or weekly maintenance.</p>
                   {!isLoading && recurringRules.length === 0 && canManageBlackouts && (
                      <Button onClick={handleOpenNewRecurringDialog} size="sm">
                        <PlusCircle className="mr-2 h-4 w-4" /> Add First Recurring Rule
                      </Button>
                    )}
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>

      {canManageBlackouts && (
        <>
          <BlackoutDateFormDialog
              open={isDateFormDialogOpen}
              onOpenChange={setIsDateFormDialogOpen}
              initialBlackoutDate={editingBlackoutDate}
              onSave={handleSaveBlackoutDate}
          />
          <RecurringBlackoutRuleFormDialog
            open={isRecurringFormDialogOpen}
            onOpenChange={setIsRecurringFormDialogOpen}
            initialRule={editingRecurringRule}
            onSave={handleSaveRecurringRule}
          />
        </>
      )}
    </TooltipProvider>
  );
}
