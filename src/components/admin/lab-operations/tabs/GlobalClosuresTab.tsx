
'use client';

import type { FC } from 'react';
import { CalendarDays, Repeat, PlusCircle, Filter as FilterIcon, FilterX, CheckCircle2, CalendarOff, Edit, Trash2, Tag, FileText, Search as SearchIcon } from 'lucide-react';
import type { BlackoutDate, RecurringBlackoutRule } from '@/types';
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

interface GlobalClosuresTabProps {
  isLoadingData: boolean;
  activeGlobalClosuresTab: string;
  setActiveGlobalClosuresTab: (tab: string) => void;
  isGlobalClosureFilterDialogOpen: boolean;
  setIsGlobalClosureFilterDialogOpen: (isOpen: boolean) => void;
  activeGlobalClosureFilterCount: number;
  tempGlobalClosureSearchTerm: string;
  setTempGlobalClosureSearchTerm: (term: string) => void;
  resetGlobalClosureDialogFiltersOnly: () => void;
  handleApplyGlobalClosureDialogFilters: () => void;
  resetAllActiveGlobalClosurePageFilters: () => void;
  filteredGlobalBlackoutDates: BlackoutDate[];
  activeGlobalClosureSearchTerm: string;
  handleOpenNewGlobalDateDialog: () => void;
  handleOpenEditGlobalDateDialog: (bd: BlackoutDate) => void;
  globalDateToDelete: BlackoutDate | null;
  setGlobalDateToDelete: (bd: BlackoutDate | null) => void;
  handleDeleteGlobalBlackoutDate: (id: string) => void;
  filteredGlobalRecurringRules: RecurringBlackoutRule[];
  handleOpenNewGlobalRecurringDialog: () => void;
  handleOpenEditGlobalRecurringDialog: (rule: RecurringBlackoutRule) => void;
  globalRuleToDelete: RecurringBlackoutRule | null;
  setGlobalRuleToDelete: (rule: RecurringBlackoutRule | null) => void;
  handleDeleteGlobalRecurringRule: (id: string) => void;
}

export const GlobalClosuresTab: FC<GlobalClosuresTabProps> = ({
  isLoadingData, activeGlobalClosuresTab, setActiveGlobalClosuresTab,
  isGlobalClosureFilterDialogOpen, setIsGlobalClosureFilterDialogOpen, activeGlobalClosureFilterCount,
  tempGlobalClosureSearchTerm, setTempGlobalClosureSearchTerm,
  resetGlobalClosureDialogFiltersOnly, handleApplyGlobalClosureDialogFilters, resetAllActiveGlobalClosurePageFilters,
  filteredGlobalBlackoutDates, activeGlobalClosureSearchTerm,
  handleOpenNewGlobalDateDialog, handleOpenEditGlobalDateDialog,
  globalDateToDelete, setGlobalDateToDelete, handleDeleteGlobalBlackoutDate,
  filteredGlobalRecurringRules, handleOpenNewGlobalRecurringDialog, handleOpenEditGlobalRecurringDialog,
  globalRuleToDelete, setGlobalRuleToDelete, handleDeleteGlobalRecurringRule
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div><CardTitle className="text-xl">Global Lab Closures</CardTitle><CardDescription className="text-sm text-muted-foreground mt-1">Manage blackout dates and recurring rules that apply system-wide (to all labs).</CardDescription></div>
        <FilterSortDialog open={isGlobalClosureFilterDialogOpen} onOpenChange={setIsGlobalClosureFilterDialogOpen}>
          <FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter {activeGlobalClosureFilterCount > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeGlobalClosureFilterCount}</Badge>}</Button></FilterSortDialogTrigger>
          <FilterSortDialogContent className="sm:max-w-md">
            <FilterSortDialogHeader><FilterSortDialogTitle>Filter Global Closures</FilterSortDialogTitle></FilterSortDialogHeader>
            <Separator className="my-3" />
            <div className="space-y-3">
              <div className="relative"><Label htmlFor="globalClosureSearchDialog">Search (Reason/Name/Date)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="globalClosureSearchDialog" value={tempGlobalClosureSearchTerm} onChange={e => setTempGlobalClosureSearchTerm(e.target.value)} placeholder="e.g., Holiday, Weekend, Jan 1" className="mt-1 h-9 pl-8"/></div>
            </div>
            <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetGlobalClosureDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button onClick={handleApplyGlobalClosureDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter>
          </FilterSortDialogContent>
        </FilterSortDialog>
      </CardHeader>
      <CardContent>
        <Tabs value={activeGlobalClosuresTab} onValueChange={setActiveGlobalClosuresTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="specific-dates-global"><CalendarDays className="mr-2 h-4 w-4"/>Specific Dates</TabsTrigger>
            <TabsTrigger value="recurring-rules-global"><Repeat className="mr-2 h-4 w-4"/>Recurring Rules</TabsTrigger>
          </TabsList>
          <TabsContent value="specific-dates-global">
            <div className="flex justify-end mb-3">
              <Button onClick={handleOpenNewGlobalDateDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Global Date</Button>
            </div>
            {isLoadingData && filteredGlobalBlackoutDates.length === 0 && !activeGlobalClosureSearchTerm ? ( <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/></div>
            ) : filteredGlobalBlackoutDates.length > 0 ? (
              <div className="overflow-x-auto rounded-b-md border">
                 <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><div className="flex items-center gap-1"><CalendarDays className="h-4 w-4 text-muted-foreground"/>Date</div></TableHead>
                      <TableHead><div className="flex items-center gap-1"><FileText className="h-4 w-4 text-muted-foreground"/>Reason</div></TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>{filteredGlobalBlackoutDates.map(bd => (
                  <TableRow key={bd.id}><TableCell className="font-medium">{formatDateSafe(parseISO(bd.date), 'Invalid Date', 'PPP')}</TableCell><TableCell className="text-sm text-muted-foreground">{bd.reason || 'N/A'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditGlobalDateDialog(bd)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Date</TooltipContent></Tooltip>
                    <AlertDialog open={globalDateToDelete?.id === bd.id} onOpenChange={(isOpen) => !isOpen && setGlobalDateToDelete(null)}>
                      <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setGlobalDateToDelete(bd)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Date</TooltipContent></Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Global Blackout on {formatDateSafe(globalDateToDelete ? parseISO(globalDateToDelete.date) : new Date(), '', 'PPP')}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => globalDateToDelete && handleDeleteGlobalBlackoutDate(globalDateToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell></TableRow>
                ))}</TableBody></Table>
                </TooltipProvider>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground"><CalendarOff className="h-10 w-10 mx-auto mb-2 opacity-50"/><p className="font-medium">{activeGlobalClosureSearchTerm ? "No global dates match filter." : "No global specific blackout dates."}</p></div>
            )}
          </TabsContent>
          <TabsContent value="recurring-rules-global">
              <div className="flex justify-end mb-3">
              <Button onClick={handleOpenNewGlobalRecurringDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Global Rule</Button>
            </div>
            {isLoadingData && filteredGlobalRecurringRules.length === 0 && !activeGlobalClosureSearchTerm ? ( <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/></div>
            ) : filteredGlobalRecurringRules.length > 0 ? (
              <div className="overflow-x-auto rounded-b-md border">
                <TooltipProvider>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead><div className="flex items-center gap-1"><Tag className="h-4 w-4 text-muted-foreground"/>Rule Name</div></TableHead>
                      <TableHead><div className="flex items-center gap-1"><Repeat className="h-4 w-4 text-muted-foreground"/>Days</div></TableHead>
                      <TableHead><div className="flex items-center gap-1"><FileText className="h-4 w-4 text-muted-foreground"/>Reason</div></TableHead>
                      <TableHead className="text-right w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>{filteredGlobalRecurringRules.map(rule => (
                  <TableRow key={rule.id}><TableCell className="font-medium">{rule.name}</TableCell><TableCell className="text-sm text-muted-foreground">{rule.daysOfWeek.join(', ')}</TableCell><TableCell className="text-sm text-muted-foreground">{rule.reason || 'N/A'}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditGlobalRecurringDialog(rule)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Rule</TooltipContent></Tooltip>
                    <AlertDialog open={globalRuleToDelete?.id === rule.id} onOpenChange={(isOpen) => !isOpen && setGlobalRuleToDelete(null)}>
                      <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setGlobalRuleToDelete(rule)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Rule</TooltipContent></Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete Global Rule "{globalRuleToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => globalRuleToDelete && handleDeleteGlobalRecurringRule(globalRuleToDelete.id)}>Delete Rule</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell></TableRow>
                ))}</TableBody></Table>
                </TooltipProvider>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground"><Repeat className="h-10 w-10 mx-auto mb-2 opacity-50"/><p className="font-medium">{activeGlobalClosureSearchTerm ? "No global rules match filter." : "No global recurring closure rules."}</p></div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};
