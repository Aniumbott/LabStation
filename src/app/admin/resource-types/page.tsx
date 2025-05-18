
'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ListChecks, PlusCircle, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon } from 'lucide-react';
import type { ResourceType } from '@/types';
import { initialMockResourceTypes } from '@/lib/mock-data'; // Updated import
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
  AlertDialogTrigger, 
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
import { ResourceTypeFormDialog, ResourceTypeFormValues } from '@/components/admin/resource-type-form-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';

// initialMockResourceTypes is now imported from lib/mock-data

export default function ResourceTypeManagementPage() {
  const { toast } = useToast();
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>(initialMockResourceTypes);
  const [typeToDelete, setTypeToDelete] = useState<ResourceType | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ResourceType | null>(null);

  // Active filter
  const [searchTerm, setSearchTerm] = useState('');
  
  // Temp filter for Dialog
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(searchTerm);
    }
  }, [isFilterDialogOpen, searchTerm]);

  const filteredResourceTypes = useMemo(() => {
    let currentTypes = [...resourceTypes];
    if (searchTerm) {
      currentTypes = currentTypes.filter(type =>
        type.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (type.description && type.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    return currentTypes.sort((a, b) => a.name.localeCompare(b.name));
  }, [resourceTypes, searchTerm]);

  const handleApplyFilters = () => {
    setSearchTerm(tempSearchTerm);
    setIsFilterDialogOpen(false);
  };

  const resetFilters = () => {
    // Reset temp filters in dialog
    setTempSearchTerm('');
    // To actually clear active filters and update list, call handleApplyFilters after reset
    // or reset active filters directly here if preferred. For now, this just resets dialog state.
  };
  
  const resetAllActiveFilters = () => {
    setSearchTerm('');
    setTempSearchTerm('');
  };


  const handleOpenNewDialog = () => {
    setEditingType(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (type: ResourceType) => {
    setEditingType(type);
    setIsFormDialogOpen(true);
  };

  const handleSaveType = (data: ResourceTypeFormValues) => {
    if (editingType) {
      setResourceTypes(resourceTypes.map(rt => rt.id === editingType.id ? { ...editingType, ...data } : rt));
      toast({
        title: 'Resource Type Updated',
        description: `Resource Type "${data.name}" has been updated.`,
      });
    } else {
      const newType: ResourceType = {
        id: `rt${resourceTypes.length + 1 + Date.now()}`,
        ...data,
      };
      setResourceTypes([...resourceTypes, newType]);
      toast({
        title: 'Resource Type Created',
        description: `Resource Type "${data.name}" has been created.`,
      });
    }
    setIsFormDialogOpen(false);
  };

  const handleDeleteType = (typeId: string) => {
    const deletedType = resourceTypes.find(rt => rt.id === typeId);
    setResourceTypes(currentTypes => currentTypes.filter(type => type.id !== typeId));
    toast({
      title: "Resource Type Deleted",
      description: `Resource Type "${deletedType?.name}" has been removed.`,
      variant: "destructive"
    });
    setTypeToDelete(null);
  };
  
  const activeFilterCount = [searchTerm !== ''].filter(Boolean).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Resource Type Management"
        description="Define and manage categories for lab resources."
        icon={ListChecks}
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
                  <DialogTitle>Filter Resource Types</DialogTitle>
                  <DialogDescription>
                    Refine the list of resource types by keyword.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="typeSearchDialog" className="text-sm font-medium">Search by Name/Description</Label>
                    <Input
                      id="typeSearchDialog"
                      type="search"
                      placeholder="Keyword..."
                      value={tempSearchTerm}
                      onChange={(e) => setTempSearchTerm(e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                </div>
                <DialogFooter className="pt-6">
                  <Button variant="ghost" onClick={() => { resetFilters(); }} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Filter
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyFilters}>Apply Filter</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Button onClick={handleOpenNewDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Type
            </Button>
          </div>
        }
      />

      {filteredResourceTypes.length > 0 ? (
        <TooltipProvider>
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResourceTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{type.description || 'N/A'}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditDialog(type)}>
                            <Edit className="h-4 w-4" />
                            <span className="sr-only">Edit Resource Type</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent><p>Edit Resource Type</p></TooltipContent>
                      </Tooltip>
                      
                      <AlertDialog>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <AlertDialogTrigger asChild>
                               <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setTypeToDelete(type)}>
                                  <Trash2 className="h-4 w-4" />
                                  <span className="sr-only">Delete Resource Type</span>
                              </Button>
                            </AlertDialogTrigger>
                          </TooltipTrigger>
                          <TooltipContent><p>Delete Resource Type</p></TooltipContent>
                        </Tooltip>
                        {typeToDelete && typeToDelete.id === type.id && (
                            <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                This action cannot be undone. This will remove the resource type
                                <span className="font-semibold"> "{typeToDelete.name}"</span>.
                                This might affect existing resources categorized under this type.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel onClick={() => setTypeToDelete(null)}>Cancel</AlertDialogCancel>
                                <AlertDialogAction variant="destructive" onClick={() => handleDeleteType(typeToDelete.id)}>
                                Delete Resource Type
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
          <ListChecks className="mx-auto h-12 w-12 mb-4" />
           <p className="text-lg font-medium">
            {searchTerm ? "No Resource Types Match Filter" : "No Resource Types Defined"}
          </p>
          <p className="text-sm mb-4">
            {searchTerm
                ? "Try adjusting your search criteria." 
                : "Add resource types to categorize your lab equipment and assets."
            }
          </p>
          {searchTerm ? (
             <Button variant="outline" onClick={() => { resetAllActiveFilters(); handleApplyFilters(); }}>
                <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
            </Button>
          ) : (
            <Button onClick={handleOpenNewDialog}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add First Resource Type
            </Button>
          )}
        </Card>
      )}
      <ResourceTypeFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        initialType={editingType}
        onSave={handleSaveType}
      />
    </div>
  );
}
