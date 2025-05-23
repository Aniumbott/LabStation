
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CalendarOff, PlusCircle, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon, Repeat, X, Loader2 } from 'lucide-react';
import type { BlackoutDate, RecurringBlackoutRule, RoleName } from '@/types';
import { addAuditLog } from '@/lib/mock-data'; // AuditLog is still mock
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
} from "@/components/ui/alert-dialog"; // AlertDialogTrigger is used via AlertDialog
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { BlackoutDateFormDialog, BlackoutDateFormValues } from '@/components/admin/blackout-date-form-dialog';
import { RecurringBlackoutRuleFormDialog, RecurringBlackoutRuleFormValues } from '@/components/admin/recurring-blackout-rule-form-dialog';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy } from 'firebase/firestore';

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

  // Filter Dialog State
  const [isDateFilterDialogOpen, setIsDateFilterDialogOpen] = useState(false);
  const [tempDateSearchTerm, setTempDateSearchTerm] = useState('');
  const [activeDateSearchTerm, setActiveDateSearchTerm] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch Blackout Dates
      // Firestore Index required: blackoutDates collection: date (ASC)
      const boQuery = query(collection(db, "blackoutDates"), orderBy("date", "asc"));
      const boSnapshot = await getDocs(boQuery);
      setBlackoutDates(boSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as BlackoutDate)));

      // Fetch Recurring Rules
      // Firestore Index required: recurringBlackoutRules collection: name (ASC)
      const rrQuery = query(collection(db, "recurringBlackoutRules"), orderBy("name", "asc"));
      const rrSnapshot = await getDocs(rrQuery);
      setRecurringRules(rrSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as RecurringBlackoutRule)));

    } catch (error: any) {
      console.error("Error fetching blackout data:", error);
      toast({ title: "Error", description: `Failed to load blackout data. ${error.message}`, variant: "destructive" });
      setBlackoutDates([]);
      setRecurringRules([]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (isDateFilterDialogOpen) {
      setTempDateSearchTerm(activeDateSearchTerm);
    }
  }, [isDateFilterDialogOpen, activeDateSearchTerm]);

  const filteredBlackoutDates = useMemo(() => {
    return blackoutDates.filter(bd => {
        const lowerSearchTerm = activeDateSearchTerm.toLowerCase();
        return !activeDateSearchTerm ||
               (bd.reason && bd.reason.toLowerCase().includes(lowerSearchTerm)) ||
               (bd.date && format(parseISO(bd.date), 'PPP').toLowerCase().includes(lowerSearchTerm));
    });
    // Already sorted by Firestore query
  }, [blackoutDates, activeDateSearchTerm]);

  const handleOpenNewDateDialog = () => {
    setEditingBlackoutDate(null);
    setIsDateFormDialogOpen(true);
  };

  const handleOpenEditDateDialog = (blackoutDate: BlackoutDate) => {
    setEditingBlackoutDate(blackoutDate);
    setIsDateFormDialogOpen(true);
  };

  const handleSaveBlackoutDate = async (data: BlackoutDateFormValues) => {
    if (!currentUser) return;
    const formattedDateOnly = format(data.date, 'yyyy-MM-dd'); // Store date as YYYY-MM-DD string
    const displayDate = format(data.date, 'PPP');

    const blackoutData = {
      date: formattedDateOnly,
      reason: data.reason || null, // Store null if empty
    };

    setIsLoading(true);
    try {
      if (editingBlackoutDate) {
        const docRef = doc(db, "blackoutDates", editingBlackoutDate.id);
        await updateDoc(docRef, blackoutData);
        addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_UPDATED', { entityType: 'BlackoutDate', entityId: editingBlackoutDate.id, details: `Blackout Date for ${displayDate} updated. Reason: ${blackoutData.reason || 'N/A'}`});
        toast({ title: 'Blackout Date Updated', description: `Blackout date for ${displayDate} has been updated.` });
      } else {
        const docRef = await addDoc(collection(db, "blackoutDates"), blackoutData);
        addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_CREATED', { entityType: 'BlackoutDate', entityId: docRef.id, details: `Blackout Date for ${displayDate} created. Reason: ${blackoutData.reason || 'N/A'}`});
        toast({ title: 'Blackout Date Added', description: `Blackout date for ${displayDate} has been added.` });
      }
      setIsDateFormDialogOpen(false);
      setEditingBlackoutDate(null);
      await fetchData();
    } catch (error) {
      console.error("Error saving blackout date:", error);
      toast({ title: "Save Failed", description: "Could not save blackout date.", variant: "destructive"});
      setIsLoading(false); // Ensure loading is false on error
    }
  };

  const handleDeleteBlackoutDate = async (blackoutDateId: string) => {
    if(!currentUser) return;
    const deletedDate = blackoutDates.find(bd => bd.id === blackoutDateId);
    if (!deletedDate) return;

    setIsLoading(true);
    try {
      const docRef = doc(db, "blackoutDates", blackoutDateId);
      await deleteDoc(docRef);
      addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_DELETED', { entityType: 'BlackoutDate', entityId: blackoutDateId, details: `Blackout Date for ${format(parseISO(deletedDate.date), 'PPP')} (Reason: ${deletedDate.reason || 'N/A'}) deleted.`});
      toast({ title: "Blackout Date Removed", description: `Blackout date for "${format(parseISO(deletedDate.date), 'PPP')}" has been removed.`, variant: "destructive" });
      setDateToDelete(null);
      await fetchData();
    } catch (error) {
        console.error("Error deleting blackout date:", error);
        toast({ title: "Delete Failed", description: "Could not remove blackout date.", variant: "destructive"});
        setIsLoading(false);
    }
  };

  const handleApplyDateDialogFilters = () => {
    setActiveDateSearchTerm(tempDateSearchTerm);
    setIsDateFilterDialogOpen(false);
  };

  const resetDateDialogFilters = () => {
    setTempDateSearchTerm('');
  };

  const resetAllActiveDatePageFilters = () => {
    setActiveDateSearchTerm('');
    resetDateDialogFilters();
    setIsDateFilterDialogOpen(false);
  };

  const activeDateFilterCount = [activeDateSearchTerm !== ''].filter(Boolean).length;

  const handleOpenNewRecurringDialog = () => {
    setEditingRecurringRule(null);
    setIsRecurringFormDialogOpen(true);
  };

  const handleOpenEditRecurringDialog = (rule: RecurringBlackoutRule) => {
    setEditingRecurringRule(rule);
    setIsRecurringFormDialogOpen(true);
  };

  const handleSaveRecurringRule = async (data: RecurringBlackoutRuleFormValues) => {
    if (!currentUser) return;
    const ruleData = {
      name: data.name,
      daysOfWeek: data.daysOfWeek,
      reason: data.reason || null,
    };
    setIsLoading(true);
    try {
      if (editingRecurringRule) {
        const docRef = doc(db, "recurringBlackoutRules", editingRecurringRule.id);
        await updateDoc(docRef, ruleData);
        addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_UPDATED', { entityType: 'RecurringBlackoutRule', entityId: editingRecurringRule.id, details: `Recurring rule '${ruleData.name}' updated.`});
        toast({ title: 'Recurring Rule Updated', description: `Recurring rule "${data.name}" has been updated.` });
      } else {
        const docRef = await addDoc(collection(db, "recurringBlackoutRules"), ruleData);
        addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_CREATED', { entityType: 'RecurringBlackoutRule', entityId: docRef.id, details: `Recurring rule '${ruleData.name}' created.`});
        toast({ title: 'Recurring Rule Added', description: `Recurring rule "${data.name}" has been added.` });
      }
      setIsRecurringFormDialogOpen(false);
      setEditingRecurringRule(null);
      await fetchData();
    } catch (error) {
      console.error("Error saving recurring rule:", error);
      toast({ title: "Save Failed", description: "Could not save recurring rule.", variant: "destructive"});
      setIsLoading(false);
    }
  };

  const handleDeleteRecurringRule = async (ruleId: string) => {
    if(!currentUser) return;
    const deletedRule = recurringRules.find(r => r.id === ruleId);
    if (!deletedRule) return;

    setIsLoading(true);
    try {
      const docRef = doc(db, "recurringBlackoutRules", ruleId);
      await deleteDoc(docRef);
      addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_DELETED', { entityType: 'RecurringBlackoutRule', entityId: ruleId, details: `Recurring rule '${deletedRule.name}' deleted.`});
      toast({ title: "Recurring Rule Removed", description: `Recurring rule "${deletedRule.name}" has been removed.`, variant: "destructive" });
      setRuleToDelete(null);
      await fetchData();
    } catch (error) {
      console.error("Error deleting recurring rule:", error);
      toast({ title: "Delete Failed", description: "Could not remove recurring rule.", variant: "destructive"});
      setIsLoading(false);
    }
  };

  const canManageBlackouts = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Lab Manager');

  if (isLoading && blackoutDates.length === 0 && recurringRules.length === 0) { // Show loader only on initial full load
    return <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading blackout data...</div>;
  }

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PageHeader
          title="Lab Blackout Dates & Recurring Closures"
          description="Define specific dates and recurring rules when the entire lab is closed or unavailable."
          icon={CalendarOff}
        />

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Specific Blackout Dates</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Manage individual lab closure dates.</p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
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
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Filter Blackout Dates</DialogTitle>
                    <DialogDescription>Refine the list of blackout dates by keyword (reason or date).</DialogDescription>
                  </DialogHeader>
                  <Separator className="my-4" />
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="blackoutSearchDialog" className="text-sm font-medium mb-1 block">Search (Reason/Date)</Label>
                      <div className="relative">
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
                  <DialogFooter className="pt-6 border-t">
                    <Button variant="ghost" onClick={resetDateDialogFilters} className="mr-auto">
                      <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                    </Button>
                    <Button variant="outline" onClick={() => setIsDateFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button>
                    <Button onClick={handleApplyDateDialogFilters}>Apply Filters</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {canManageBlackouts && (
                <Button onClick={handleOpenNewDateDialog} size="sm">
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Blackout Date
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading && filteredBlackoutDates.length === 0 && !activeDateSearchTerm ? (
                <div className="text-center py-10 text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />Fetching dates...</div>
            ) : filteredBlackoutDates.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border shadow-sm">
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
                        <TableCell className="font-medium">{isValidDate(parseISO(bd.date)) ? format(parseISO(bd.date), 'PPP') : 'Invalid Date'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{bd.reason || 'N/A'}</TableCell>
                        {canManageBlackouts && (
                          <TableCell className="text-right space-x-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditDateDialog(bd)}>
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit Blackout Date</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Edit Blackout Date</p></TooltipContent>
                            </Tooltip>
                            <AlertDialog> {/* Removed AlertDialogTrigger from TooltipTrigger child */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setDateToDelete(bd)}>
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Delete Blackout Date</span>
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Delete Blackout Date</p></TooltipContent>
                              </Tooltip>
                              {dateToDelete && dateToDelete.id === bd.id && (
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will remove the blackout date
                                      <span className="font-semibold"> "{isValidDate(parseISO(dateToDelete.date)) ? format(parseISO(dateToDelete.date), 'PPP') : ''}"</span>.
                                      All resources will be considered available on this day unless specified otherwise.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setDateToDelete(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction variant="destructive" onClick={() => handleDeleteBlackoutDate(dateToDelete.id)}>
                                      Delete Blackout Date
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              )}
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
                     canManageBlackouts && !isLoading && ( // Ensure not loading before showing "Add First"
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
          <CardHeader className="flex flex-row items-center justify-between">
             <div>
              <CardTitle>Recurring Lab Closures</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">Manage weekly or other recurring unavailability rules.</p>
            </div>
            {canManageBlackouts && (
              <Button onClick={handleOpenNewRecurringDialog} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Add Recurring Rule
              </Button>
            )}
          </CardHeader>
          <CardContent>
             {isLoading && recurringRules.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground"><Loader2 className="mx-auto h-6 w-6 animate-spin text-primary mb-2" />Fetching rules...</div>
            ) : recurringRules.length > 0 ? (
              <div className="overflow-x-auto rounded-lg border shadow-sm">
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
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditRecurringDialog(rule)}>
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit Recurring Rule</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Edit Recurring Rule</p></TooltipContent>
                            </Tooltip>
                            <AlertDialog> {/* Removed AlertDialogTrigger from TooltipTrigger child */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setRuleToDelete(rule)}>
                                      <Trash2 className="h-4 w-4" />
                                      <span className="sr-only">Delete Recurring Rule</span>
                                    </Button>
                                  </AlertDialogTrigger>
                                </TooltipTrigger>
                                <TooltipContent><p>Delete Recurring Rule</p></TooltipContent>
                              </Tooltip>
                              {ruleToDelete && ruleToDelete.id === rule.id && (
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      This action cannot be undone. This will remove the recurring rule
                                      <span className="font-semibold"> "{ruleToDelete.name}"</span>.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel onClick={() => setRuleToDelete(null)}>Cancel</AlertDialogCancel>
                                    <AlertDialogAction variant="destructive" onClick={() => handleDeleteRecurringRule(ruleToDelete.id)}>
                                      Delete Recurring Rule
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              )}
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
                   {canManageBlackouts && !isLoading && ( // Ensure not loading before showing "Add First"
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
