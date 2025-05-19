
'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { CalendarOff, PlusCircle, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon } from 'lucide-react';
import type { BlackoutDate } from '@/types';
import { initialBlackoutDates, mockCurrentUser } from '@/lib/mock-data';
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
} from "@/components/ui/alert-dialog";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { BlackoutDateFormDialog, BlackoutDateFormValues } from '@/components/admin/blackout-date-form-dialog';

export default function BlackoutDatesPage() {
  const { toast } = useToast();
  const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>(() => JSON.parse(JSON.stringify(initialBlackoutDates)));
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingBlackoutDate, setEditingBlackoutDate] = useState<BlackoutDate | null>(null);
  const [dateToDelete, setDateToDelete] = useState<BlackoutDate | null>(null);

  // Filter Dialog State
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  
  // Active filter state
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
    }
  }, [isFilterDialogOpen, activeSearchTerm]);

  const filteredBlackoutDates = useMemo(() => {
    let currentDates = [...blackoutDates];
    if (activeSearchTerm) {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      currentDates = currentDates.filter(bd =>
        (bd.reason && bd.reason.toLowerCase().includes(lowerSearchTerm)) ||
        format(parseISO(bd.date), 'PPP').toLowerCase().includes(lowerSearchTerm)
      );
    }
    return currentDates.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
  }, [blackoutDates, activeSearchTerm]);

  const handleOpenNewDialog = () => {
    setEditingBlackoutDate(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (blackoutDate: BlackoutDate) => {
    setEditingBlackoutDate(blackoutDate);
    setIsFormDialogOpen(true);
  };

  const handleSaveBlackoutDate = (data: BlackoutDateFormValues) => {
    if (editingBlackoutDate) {
      const updatedDates = blackoutDates.map(bd =>
        bd.id === editingBlackoutDate.id ? { ...editingBlackoutDate, ...data, date: format(data.date, 'yyyy-MM-dd') } : bd
      );
      setBlackoutDates(updatedDates);
      const globalIndex = initialBlackoutDates.findIndex(bd => bd.id === editingBlackoutDate.id);
      if (globalIndex !== -1) initialBlackoutDates[globalIndex] = { ...initialBlackoutDates[globalIndex], ...data, date: format(data.date, 'yyyy-MM-dd') };
      toast({
        title: 'Blackout Date Updated',
        description: `Blackout date for ${format(data.date, 'PPP')} has been updated.`,
      });
    } else {
      const newDate: BlackoutDate = {
        id: `bo${blackoutDates.length + 1 + Date.now()}`,
        date: format(data.date, 'yyyy-MM-dd'),
        reason: data.reason,
      };
      setBlackoutDates(prev => [...prev, newDate].sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()));
      initialBlackoutDates.push(newDate);
      initialBlackoutDates.sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      toast({
        title: 'Blackout Date Added',
        description: `Blackout date for ${format(data.date, 'PPP')} has been added.`,
      });
    }
    setIsFormDialogOpen(false);
  };

  const handleDeleteBlackoutDate = (blackoutDateId: string) => {
    const deletedDate = blackoutDates.find(bd => bd.id === blackoutDateId);
    setBlackoutDates(currentDates => currentDates.filter(bd => bd.id !== blackoutDateId));
    
    const globalIndex = initialBlackoutDates.findIndex(bd => bd.id === blackoutDateId);
    if (globalIndex !== -1) initialBlackoutDates.splice(globalIndex, 1);

    toast({
      title: "Blackout Date Removed",
      description: `Blackout date for "${deletedDate ? format(parseISO(deletedDate.date), 'PPP') : ''}" has been removed.`,
      variant: "destructive"
    });
    setDateToDelete(null);
  };
  
  const handleApplyFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFilters = () => {
    setTempSearchTerm('');
  };

  const resetAllActiveFilters = () => {
    setActiveSearchTerm('');
    resetDialogFilters();
    setIsFilterDialogOpen(false);
  };
  
  const activeFilterCount = [activeSearchTerm !== ''].filter(Boolean).length;
  const canManageBlackouts = mockCurrentUser.role === 'Admin' || mockCurrentUser.role === 'Lab Manager';


  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PageHeader
          title="Lab Blackout Dates"
          description="Define and manage dates when the entire lab is closed or unavailable."
          icon={CalendarOff}
          actions={
            <div className="flex items-center gap-2">
              <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <FilterIcon className="mr-2 h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Filter Blackout Dates</DialogTitle>
                    <DialogDescription>
                      Refine the list of blackout dates by keyword (reason or date).
                    </DialogDescription>
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
                          value={tempSearchTerm}
                          onChange={(e) => setTempSearchTerm(e.target.value)}
                          className="h-9 pl-8"
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter className="pt-6 border-t">
                    <Button variant="ghost" onClick={resetDialogFilters} className="mr-auto">
                      <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                    </Button>
                    <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleApplyFilters}>Apply Filters</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {canManageBlackouts && (
                <Button onClick={handleOpenNewDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add Blackout Date
                </Button>
              )}
            </div>
          }
        />

        {filteredBlackoutDates.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Defined Blackout Dates ({filteredBlackoutDates.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
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
                        <TableCell className="font-medium">{format(parseISO(bd.date), 'PPP')}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{bd.reason || 'N/A'}</TableCell>
                        {canManageBlackouts && (
                          <TableCell className="text-right space-x-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditDialog(bd)}>
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit Blackout Date</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Edit Blackout Date</p></TooltipContent>
                            </Tooltip>
                            <AlertDialog>
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
                                      <span className="font-semibold"> "{format(parseISO(dateToDelete.date), 'PPP')}"</span>.
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
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-10 text-muted-foreground bg-card border-0 shadow-none">
            <CardContent>
              <CalendarOff className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {activeSearchTerm ? "No Blackout Dates Match Filter" : "No Lab Blackout Dates Defined"}
              </p>
              <p className="text-sm mb-4">
                {activeSearchTerm
                  ? "Try adjusting your search criteria."
                  : "Add lab-wide closure dates or holidays here."}
              </p>
              {activeSearchTerm ? (
                <Button variant="outline" onClick={resetAllActiveFilters}>
                  <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
              ) : (
                canManageBlackouts && (
                  <Button onClick={handleOpenNewDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First Blackout Date
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        )}
      </div>
      {canManageBlackouts && (
        <BlackoutDateFormDialog
            open={isFormDialogOpen}
            onOpenChange={setIsFormDialogOpen}
            initialBlackoutDate={editingBlackoutDate}
            onSave={handleSaveBlackoutDate}
        />
      )}
    </TooltipProvider>
  );
}
