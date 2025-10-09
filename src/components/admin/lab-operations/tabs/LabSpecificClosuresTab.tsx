
'use client';

import type { FC } from 'react';
import { CalendarDays, Repeat, PlusCircle, Filter as FilterIcon, FilterX, CheckCircle2, CalendarOff, Edit, Trash2, Tag, FileText, Search as SearchIcon } from 'lucide-react';
import type { Lab, BlackoutDate, RecurringBlackoutRule } from '@/types';
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Dialog as FilterSortDialog,
  DialogContent as FilterSortDialogContent,
  DialogHeader as FilterSortDialogHeader,
  DialogTitle as FilterSortDialogTitle,
  DialogFooter as FilterSortDialogFooter,
  DialogTrigger as FilterSortDialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2 } from 'lucide-react';
import { formatDateSafe } from '@/lib/utils';
import { parseISO } from 'date-fns';

interface LabSpecificClosuresTabProps {
  selectedLabDetails: Lab;
  isLoadingData: boolean;
  activeLabClosuresTab: string;
  setActiveLabClosuresTab: (tab: string) => void;
  isLabSpecificClosureFilterDialogOpen: boolean;
  setIsLabSpecificClosureFilterDialogOpen: (isOpen: boolean) => void;
  activeLabSpecificClosureFilterCount: number;
  tempLabSpecificClosureSearchTerm: string;
  setTempLabSpecificClosureSearchTerm: (term: string) => void;
  resetLabSpecificClosureDialogFiltersOnly: () => void;
  handleApplyLabSpecificClosureDialogFilters: () => void;
  resetAllActiveLabSpecificClosurePageFilters: () => void;
  filteredLabSpecificBlackoutDates: BlackoutDate[];
  activeLabSpecificClosureSearchTerm: string;
  handleOpenNewLabSpecificDateDialog: () => void;
  handleOpenEditLabSpecificDateDialog: (bd: BlackoutDate) => void;
  labSpecificDateToDelete: BlackoutDate | null;
  setLabSpecificDateToDelete: (bd: BlackoutDate | null) => void;
  handleDeleteLabSpecificBlackoutDate: (id: string) => void;
  filteredLabSpecificRecurringRules: RecurringBlackoutRule[];
  handleOpenNewLabSpecificRecurringDialog: () => void;
  handleOpenEditLabSpecificRecurringDialog: (rule: RecurringBlackoutRule) => void;
  labSpecificRuleToDelete: RecurringBlackoutRule | null;
  setLabSpecificRuleToDelete: (rule: RecurringBlackoutRule | null) => void;
  handleDeleteLabSpecificRecurringRule: (id: string) => void;
}

export const LabSpecificClosuresTab: FC<LabSpecificClosuresTabProps> = ({
  selectedLabDetails, isLoadingData, activeLabClosuresTab, setActiveLabClosuresTab,
  isLabSpecificClosureFilterDialogOpen, setIsLabSpecificClosureFilterDialogOpen, activeLabSpecificClosureFilterCount,
  tempLabSpecificClosureSearchTerm, setTempLabSpecificClosureSearchTerm,
  resetLabSpecificClosureDialogFiltersOnly, handleApplyLabSpecificClosureDialogFilters, resetAllActiveLabSpecificClosurePageFilters,
  filteredLabSpecificBlackoutDates, activeLabSpecificClosureSearchTerm,
  handleOpenNewLabSpecificDateDialog, handleOpenEditLabSpecificDateDialog,
  labSpecificDateToDelete, setLabSpecificDateToDelete, handleDeleteLabSpecificBlackoutDate,
  filteredLabSpecificRecurringRules, handleOpenNewLabSpecificRecurringDialog, handleOpenEditLabSpecificRecurringDialog,
  labSpecificRuleToDelete, setLabSpecificRuleToDelete, handleDeleteLabSpecificRecurringRule
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
            <CardTitle>{selectedLabDetails.name} - Closures</CardTitle>
            <CardDescription>Manage specific and recurring unavailability for this lab.</CardDescription>
        </div>
        <FilterSortDialog open={isLabSpecificClosureFilterDialogOpen} onOpenChange={setIsLabSpecificClosureFilterDialogOpen}>
            <FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter {activeLabSpecificClosureFilterCount > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeLabSpecificClosureFilterCount}</Badge>}</Button></FilterSortDialogTrigger>
            <FilterSortDialogContent className="sm:max-w-md">
                <FilterSortDialogHeader><FilterSortDialogTitle>Filter Closures for {selectedLabDetails.name}</FilterSortDialogTitle></FilterSortDialogHeader>
                <Separator className="my-3" />
                <div className="space-y-3">
                <div className="relative"><Label htmlFor="labSpecificClosureSearchDialog">Search (Reason/Name/Date)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="labSpecificClosureSearchDialog" value={tempLabSpecificClosureSearchTerm} onChange={e => setTempLabSpecificClosureSearchTerm(e.target.value)} placeholder="e.g., Holiday, Weekend, Jan 1" className="mt-1 h-9 pl-8"/></div>
                </div>
                <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetLabSpecificClosureDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button onClick={handleApplyLabSpecificClosureDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter>
            </FilterSortDialogContent>
        </FilterSortDialog>
      </CardHeader>
      <CardContent>
        <Tabs value={activeLabClosuresTab} onValueChange={setActiveLabClosuresTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="specific-dates-lab"><CalendarDays className="mr-2 h-4 w-4"/>Specific Dates</TabsTrigger>
            <TabsTrigger value="recurring-rules-lab"><Repeat className="mr-2 h-4 w-4"/>Recurring Rules</TabsTrigger>
          </TabsList>
          <TabsContent value="specific-dates-lab">
            <div className="flex justify-end mb-3">
              <Button onClick={handleOpenNewLabSpecificDateDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add</Button>
            </div>
            {isLoadingData && filteredLabSpecificBlackoutDates.length === 0 && !activeLabSpecificClosureSearchTerm ? ( <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/></div>
            ) : filteredLabSpecificBlackoutDates.length > 0 ? (
              <div className="overflow-x-auto border rounded-b-md">
                <TooltipProvider>
                <Table><TableHeader><TableRow><TableHead><div className="flex items-center gap-1"><CalendarDays className="h-4 w-4 text-muted-foreground"/>Date</div></TableHead><TableHead><div className="flex items-center gap-1"><FileText className="h-4 w-4 text-muted-foreground"/>Reason</div></TableHead><TableHead className="text-right w-[100px]">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{filteredLabSpecificBlackoutDates.map(bd => (
                  <TableRow key={bd.id}><TableCell className="font-medium">{formatDateSafe(parseISO(bd.date), 'Invalid Date', 'PPP')}</TableCell><TableCell className="text-sm text-muted-foreground">{bd.reason || 'N/A'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditLabSpecificDateDialog(bd)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Date</TooltipContent></Tooltip>
                    <AlertDialog open={labSpecificDateToDelete?.id === bd.id} onOpenChange={(isOpen) => !isOpen && setLabSpecificDateToDelete(null)}>
                      <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setLabSpecificDateToDelete(bd)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Date</TooltipContent></Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Blackout on {formatDateSafe(labSpecificDateToDelete ? parseISO(labSpecificDateToDelete.date) : new Date(), '', 'PPP')} for {selectedLabDetails.name}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => labSpecificDateToDelete && handleDeleteLabSpecificBlackoutDate(labSpecificDateToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell></TableRow>
                ))}</TableBody></Table>
                </TooltipProvider>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground"><CalendarOff className="h-10 w-10 mx-auto mb-2 opacity-50"/><p className="font-medium">{activeLabSpecificClosureSearchTerm ? "No dates match filter." : `No specific blackout dates for ${selectedLabDetails.name}.`}</p></div>
            )}
          </TabsContent>
          <TabsContent value="recurring-rules-lab">
              <div className="flex justify-end mb-3">
              <Button onClick={handleOpenNewLabSpecificRecurringDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add</Button>
            </div>
            {isLoadingData && filteredLabSpecificRecurringRules.length === 0 && !activeLabSpecificClosureSearchTerm ? ( <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/></div>
            ) : filteredLabSpecificRecurringRules.length > 0 ? (
              <div className="overflow-x-auto border rounded-b-md">
                <TooltipProvider>
                <Table><TableHeader><TableRow><TableHead><div className="flex items-center gap-1"><Tag className="h-4 w-4 text-muted-foreground"/>Rule Name</div></TableHead><TableHead><div className="flex items-center gap-1"><Repeat className="h-4 w-4 text-muted-foreground"/>Days</div></TableHead><TableHead><div className="flex items-center gap-1"><FileText className="h-4 w-4 text-muted-foreground"/>Reason</div></TableHead><TableHead className="text-right w-[100px]">Actions</TableHead></TableRow></TableHeader>
                <TableBody>{filteredLabSpecificRecurringRules.map(rule => (
                  <TableRow key={rule.id}><TableCell className="font-medium">{rule.name}</TableCell><TableCell className="text-sm text-muted-foreground">{rule.daysOfWeek.join(', ')}</TableCell><TableCell className="text-sm text-muted-foreground">{rule.reason || 'N/A'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditLabSpecificRecurringDialog(rule)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Rule</TooltipContent></Tooltip>
                    <AlertDialog open={labSpecificRuleToDelete?.id === rule.id} onOpenChange={(isOpen) => !isOpen && setLabSpecificRuleToDelete(null)}>
                      <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setLabSpecificRuleToDelete(rule)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Rule</TooltipContent></Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Rule "{labSpecificRuleToDelete?.name}" for {selectedLabDetails.name}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => labSpecificRuleToDelete && handleDeleteLabSpecificRecurringRule(labSpecificRuleToDelete.id)}>Delete Rule</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell></TableRow>
                ))}</TableBody></Table>
                </TooltipProvider>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground"><Repeat className="h-10 w-10 mx-auto mb-2 opacity-50"/><p className="font-medium">{activeLabSpecificClosureSearchTerm ? "No rules match filter." : `No recurring closure rules for ${selectedLabDetails.name}.`}</p></div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
