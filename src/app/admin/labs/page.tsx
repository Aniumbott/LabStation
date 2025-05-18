
'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Building, PlusCircle, Edit, Trash2, Filter as FilterIcon, FilterX } from 'lucide-react';
import type { Lab } from '@/types';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from '@/components/ui/button';
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
  AlertDialogTrigger, // Added import
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { LabFormDialog, LabFormValues } from '@/components/admin/lab-form-dialog';

// Mock Timezones for selection
export const commonTimezones = [
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Asia/Tokyo", "Australia/Sydney", "UTC"
];

const initialMockLabs: Lab[] = [
  { id: 'lab1', name: 'Central Research Lab', location: 'Building A, Room 101', description: 'Main interdisciplinary research facility.', timezone: 'America/New_York' },
  { id: 'lab2', name: 'BioLab Alpha', location: 'Building B, Floor 2', description: 'Specialized in molecular biology.', timezone: 'America/Chicago' },
  { id: 'lab3', name: 'Chemistry Annex', location: 'Building C, Room 50', timezone: 'Europe/London' },
];

export default function LabManagementPage() {
  const { toast } = useToast();
  const [labs, setLabs] = useState<Lab[]>(initialMockLabs);
  const [labToDelete, setLabToDelete] = useState<Lab | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<Lab | null>(null);

  // Active filters
  const [searchTerm, setSearchTerm] = useState('');

  // Temporary filters for Dialog
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(searchTerm);
    }
  }, [isFilterDialogOpen, searchTerm]);

  const filteredLabs = useMemo(() => {
    let currentLabs = [...labs];
    if (searchTerm) {
      currentLabs = currentLabs.filter(lab =>
        lab.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        lab.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lab.description && lab.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return currentLabs;
  }, [labs, searchTerm]);

  const handleApplyFilters = () => {
    setSearchTerm(tempSearchTerm);
    setIsFilterDialogOpen(false);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setTempSearchTerm('');
  };

  const handleOpenNewLabDialog = () => {
    setEditingLab(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEditLabDialog = (lab: Lab) => {
    setEditingLab(lab);
    setIsFormDialogOpen(true);
  };

  const handleSaveLab = (data: LabFormValues) => {
    if (editingLab) {
      setLabs(labs.map(l => l.id === editingLab.id ? { ...editingLab, ...data } : l));
      toast({
        title: 'Lab Updated',
        description: `Lab ${data.name} has been updated.`,
      });
    } else {
      const newLab: Lab = {
        id: `lab${labs.length + 1 + Date.now()}`,
        ...data,
      };
      setLabs([...labs, newLab]);
      toast({
        title: 'Lab Created',
        description: `Lab ${data.name} has been created.`,
      });
    }
    setIsFormDialogOpen(false);
  };

  const handleDeleteLab = (labId: string) => {
    const deletedLab = labs.find(l => l.id === labId);
    setLabs(currentLabs => currentLabs.filter(lab => lab.id !== labId));
    toast({
      title: "Lab Deleted",
      description: `Lab "${deletedLab?.name}" has been removed.`,
      variant: "destructive"
    });
    setLabToDelete(null);
  };
  
  const activeFilterCount = [searchTerm !== ''].filter(Boolean).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Lab Management"
        description="Define and manage laboratory spaces within the system."
        icon={Building}
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
                  <DialogTitle>Filter Labs</DialogTitle>
                  <DialogDescription>
                    Refine the list of labs by searching below.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="labSearchDialog" className="text-sm font-medium">Search</Label>
                    <Input
                      id="labSearchDialog"
                      type="search"
                      placeholder="Name, location, description..."
                      value={tempSearchTerm}
                      onChange={(e) => setTempSearchTerm(e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                </div>
                <DialogFooter className="pt-6">
                  <Button variant="ghost" onClick={resetFilters} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Filter
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyFilters}>Apply Filter</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button onClick={handleOpenNewLabDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Lab
            </Button>
          </div>
        }
      />

      {filteredLabs.length > 0 ? (
        <TooltipProvider>
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Timezone</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLabs.map((lab) => (
                  <TableRow key={lab.id}>
                    <TableCell className="font-medium">{lab.name}</TableCell>
                    <TableCell>{lab.location}</TableCell>
                    <TableCell><Badge variant="outline">{lab.timezone}</Badge></TableCell>
                    <TableCell className="text-sm text-muted-foreground truncate max-w-xs">{lab.description || '-'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditLabDialog(lab)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit Lab</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Edit Lab</p>
                        </TooltipContent>
                      </Tooltip>
                      
                      <AlertDialog>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                               <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setLabToDelete(lab)}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete Lab</span>
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent>
                             <p>Delete Lab</p>
                          </TooltipContent>
                        </Tooltip>
                        {labToDelete && labToDelete.id === lab.id && (
                            <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will remove the lab 
                                <span className="font-semibold"> {labToDelete.name}</span> from the system. 
                                Any associated zones and resources might be affected (in a real system).
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setLabToDelete(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction variant="destructive" onClick={() => handleDeleteLab(labToDelete.id)}>
                                Delete Lab
                                </AlertDialogAction>
                            </AlertDialogFooter>
                            </AlertDialogContent>
                        )}
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        </TooltipProvider>
      ) : (
        <Card className="text-center py-10 text-muted-foreground bg-card rounded-lg border shadow-sm">
          <Building className="mx-auto h-12 w-12 mb-4" />
           <p className="text-lg font-medium">
            {searchTerm ? "No Labs Match Filters" : "No Labs Found"}
          </p>
          <p className="text-sm mb-4">
            {searchTerm 
                ? "Try adjusting your search criteria." 
                : "There are currently no labs defined in the system. Add one to get started!"
            }
          </p>
          {searchTerm ? (
             <Button variant="outline" onClick={() => { resetFilters(); handleApplyFilters(); }}>
                <FilterX className="mr-2 h-4 w-4" /> Reset Filter
            </Button>
          ) : (
            <Button onClick={handleOpenNewLabDialog}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add First Lab
            </Button>
          )}
        </Card>
      )}
      <LabFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        initialLab={editingLab}
        onSave={handleSaveLab}
        timezones={commonTimezones}
      />
    </div>
  );
}
