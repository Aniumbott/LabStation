
'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ListChecks, PlusCircle, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon } from 'lucide-react';
import type { ResourceType } from '@/types';
import { initialMockResourceTypes, addAuditLog } from '@/lib/mock-data';
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
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';


export default function ResourceTypesPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>(() => JSON.parse(JSON.stringify(initialMockResourceTypes)));
  const [typeToDelete, setTypeToDelete] = useState<ResourceType | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ResourceType | null>(null);

  // Active filters for the page
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  // Filter Dialog State
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState(activeSearchTerm);


  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
    }
  }, [isFilterDialogOpen, activeSearchTerm]);

  const filteredResourceTypes = useMemo(() => {
    let currentTypes = [...resourceTypes];
    const lowerSearchTerm = activeSearchTerm.toLowerCase();
    if (activeSearchTerm) {
      currentTypes = currentTypes.filter(type =>
        type.name.toLowerCase().includes(lowerSearchTerm) ||
        (type.description && type.description.toLowerCase().includes(lowerSearchTerm))
      );
    }
    return currentTypes.sort((a, b) => a.name.localeCompare(b.name));
  }, [resourceTypes, activeSearchTerm]);

  const handleApplyDialogFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFilters = () => {
    setTempSearchTerm('');
  };

  const resetAllActivePageFilters = () => {
    setActiveSearchTerm('');
    resetDialogFilters();
    setIsFilterDialogOpen(false);
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
      const updatedType = { ...editingType, ...data };
      const updatedTypes = resourceTypes.map(rt => rt.id === editingType.id ? updatedType : rt);
      setResourceTypes(updatedTypes);
      const globalIndex = initialMockResourceTypes.findIndex(rt => rt.id === editingType.id);
      if (globalIndex !== -1) initialMockResourceTypes[globalIndex] = updatedType;
      addAuditLog(currentUser?.id || 'SYSTEM_ADMIN', currentUser?.name || 'System Admin', 'RESOURCE_TYPE_UPDATED', { entityType: 'ResourceType', entityId: updatedType.id, details: `Resource Type '${updatedType.name}' updated.`});
      toast({
        title: 'Resource Type Updated',
        description: `Resource Type "${data.name}" has been updated.`,
      });
    } else {
      const newType: ResourceType = {
        id: `rt${initialMockResourceTypes.length + 1 + Date.now()}`,
        ...data,
      };
      setResourceTypes(prevTypes => [...prevTypes, newType].sort((a, b) => a.name.localeCompare(b.name)));
      initialMockResourceTypes.push(newType);
      initialMockResourceTypes.sort((a, b) => a.name.localeCompare(b.name));
      addAuditLog(currentUser?.id || 'SYSTEM_ADMIN', currentUser?.name || 'System Admin', 'RESOURCE_TYPE_CREATED', { entityType: 'ResourceType', entityId: newType.id, details: `Resource Type '${newType.name}' created.`});
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

    const globalIndex = initialMockResourceTypes.findIndex(rt => rt.id === typeId);
    if (globalIndex !== -1) initialMockResourceTypes.splice(globalIndex, 1);
    addAuditLog(currentUser?.id || 'SYSTEM_ADMIN', currentUser?.name || 'System Admin', 'RESOURCE_TYPE_DELETED', { entityType: 'ResourceType', entityId: typeId, details: `Resource Type '${deletedType?.name || typeId}' deleted.`});
    toast({
      title: "Resource Type Deleted",
      description: `Resource Type "${deletedType?.name}" has been removed.`,
      variant: "destructive"
    });
    setTypeToDelete(null);
  };

  const activeFilterCount = [activeSearchTerm !== ''].filter(Boolean).length;
  const canAddResourceTypes = currentUser?.role === 'Admin';
  const canManageResourceTypes = currentUser?.role === 'Admin';


  return (
    <TooltipProvider>
    <div className="space-y-8">
      <PageHeader
        title="Resource Types"
        description="Define and manage categories for lab resources."
        icon={ListChecks}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
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
                    <Label htmlFor="typeSearchDialog" className="text-sm font-medium mb-1 block">Search by Name/Description</Label>
                     <div className="relative">
                       <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                        id="typeSearchDialog"
                        type="search"
                        placeholder="Keyword..."
                        value={tempSearchTerm}
                        onChange={(e) => setTempSearchTerm(e.target.value.toLowerCase())}
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
                  <Button onClick={handleApplyDialogFilters}>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {canAddResourceTypes && (
              <Button onClick={handleOpenNewDialog}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add
              </Button>
            )}
          </div>
        }
      />

      {filteredResourceTypes.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                {canManageResourceTypes && <TableHead className="text-right w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResourceTypes.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{type.description || 'N/A'}</TableCell>
                    {canManageResourceTypes && (
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
                    )}
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card className="text-center py-10 text-muted-foreground bg-card border-0 shadow-none">
          <CardContent>
            <ListChecks className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">
                {activeSearchTerm ? "No Resource Types Match Filter" : "No Resource Types Defined"}
            </p>
            <p className="text-sm mb-4">
                {activeSearchTerm
                    ? "Try adjusting your search criteria."
                    : (canAddResourceTypes ? "Add resource types to categorize your lab equipment and assets." : "No resource types have been defined.")
                }
            </p>
            {activeSearchTerm && (
                <Button variant="outline" onClick={resetAllActivePageFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
            )}
            {!activeSearchTerm && !filteredResourceTypes.length && canAddResourceTypes && (
                <Button onClick={handleOpenNewDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First Resource Type
                </Button>
            )}
          </CardContent>
        </Card>
      )}
      <ResourceTypeFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        initialType={editingType}
        onSave={handleSaveType}
      />
    </div>
    </TooltipProvider>
  );
}
