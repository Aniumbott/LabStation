
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ListChecks, PlusCircle, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon, Loader2, X, Package, CheckCircle2, ArrowUp, ArrowDown } from 'lucide-react'; // Added Package icon, ArrowUp, ArrowDown
import type { ResourceType, Resource } from '@/types'; // Added Resource type
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
}from "@/components/ui/alert-dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'; // Added Select
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { addAuditLog } from '@/lib/firestore-helpers';

type ResourceTypeSortableColumn = 'name' | 'resourceCount' | 'description';

const sortOptions: { value: string; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'resourceCount-asc', label: 'Resources (Low to High)' },
  { value: 'resourceCount-desc', label: 'Resources (High to Low)' },
  { value: 'description-asc', label: 'Description (A-Z)' },
  { value: 'description-desc', label: 'Description (Z-A)' },
];


export default function ResourceTypesPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]); // State for all resources
  const [isLoading, setIsLoading] = useState(true);
  const [typeToDelete, setTypeToDelete] = useState<ResourceType | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ResourceType | null>(null);

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');

  const [tempSortBy, setTempSortBy] = useState<string>('name-asc'); // Temp state for dialog
  const [activeSortBy, setActiveSortBy] = useState<string>('name-asc'); // Active sort state for page


  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Fetch Resource Types - initial sort by name from Firestore
      const typesQuery = query(collection(db, "resourceTypes"), orderBy("name", "asc"));
      const typesSnapshot = await getDocs(typesQuery);
      const fetchedTypes: ResourceType[] = typesSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Type',
          description: data.description || undefined,
        } as ResourceType;
      });
      setResourceTypes(fetchedTypes);

      // Fetch All Resources
      const resourcesQuery = query(collection(db, "resources")); 
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const fetchedResources: Resource[] = resourcesSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          resourceTypeId: data.resourceTypeId,
        } as Pick<Resource, 'id' | 'resourceTypeId'> & { name?: string }; 
      });
      setAllResources(fetchedResources as Resource[]);

    } catch (error: any) {
      console.error("Error fetching data:", error);
      toast({ title: "Error", description: `Failed to load data: ${error.message}`, variant: "destructive" });
      setResourceTypes([]);
      setAllResources([]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (currentUser?.role === 'Admin') {
      fetchData();
    } else {
      setResourceTypes([]);
      setAllResources([]);
      setIsLoading(false);
    }
  }, [currentUser, fetchData]);


  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempSortBy(activeSortBy); // Sync temp sort state when dialog opens
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeSortBy]);

  const filteredResourceTypesWithCount = useMemo(() => {
    let currentTypes = [...resourceTypes];
    const lowerSearchTerm = activeSearchTerm.toLowerCase();
    if (activeSearchTerm) {
      currentTypes = currentTypes.filter(type =>
        type.name.toLowerCase().includes(lowerSearchTerm) ||
        (type.description && type.description.toLowerCase().includes(lowerSearchTerm))
      );
    }
    
    const [column, direction] = activeSortBy.split('-') as [ResourceTypeSortableColumn, 'asc' | 'desc'];

    let typesWithCount = currentTypes.map(type => ({
      ...type,
      resourceCount: allResources.filter(res => res.resourceTypeId === type.id).length,
    }));

    typesWithCount.sort((a, b) => {
        let comparison = 0;
        
        const valA = a[column];
        const valB = b[column];

        if (column === 'resourceCount') {
             comparison = (valA as number) - (valB as number);
        } else if (column === 'name') {
            comparison = (valA as string).toLowerCase().localeCompare((valB as string).toLowerCase());
        } else if (column === 'description') {
            const descA = a.description || '';
            const descB = b.description || '';
            comparison = descA.toLowerCase().localeCompare(descB.toLowerCase());
        }
        
        return direction === 'asc' ? comparison : -comparison;
    });

    return typesWithCount;
  }, [resourceTypes, allResources, activeSearchTerm, activeSortBy]);

  const handleApplyDialogFilters = useCallback(() => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveSortBy(tempSortBy); // Apply temp sort state
    setIsFilterDialogOpen(false);
  }, [tempSearchTerm, tempSortBy]);

  const resetDialogFiltersOnly = useCallback(() => {
    setTempSearchTerm('');
    setTempSortBy('name-asc'); // Reset temp sort state
  }, []);

  const resetAllActivePageFilters = useCallback(() => {
    setActiveSearchTerm('');
    setActiveSortBy('name-asc'); // Reset active sort state
    resetDialogFiltersOnly();
    setIsFilterDialogOpen(false);
  }, [resetDialogFiltersOnly]);


  const handleOpenNewDialog = () => {
    setEditingType(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (type: ResourceType) => {
    setEditingType(type);
    setIsFormDialogOpen(true);
  };

  const handleSaveType = async (data: ResourceTypeFormValues) => {
    if (!currentUser || !currentUser.name || currentUser.role !== 'Admin') {
        toast({ title: "Permission Denied", description: "You are not authorized to save resource types.", variant: "destructive" });
        return;
    }
    setIsLoading(true);
    try {
      const typeDataToSave: Omit<ResourceType, 'id'> = { 
        name: data.name,
        description: data.description || undefined,
      };

      if (editingType) {
        const typeDocRef = doc(db, "resourceTypes", editingType.id);
        await updateDoc(typeDocRef, typeDataToSave);
        addAuditLog(currentUser.id, currentUser.name, 'RESOURCE_TYPE_UPDATED', { entityType: 'ResourceType', entityId: editingType.id, details: `Resource Type '${data.name}' updated.`});
        toast({ title: 'Resource Type Updated', description: `Resource Type "${data.name}" has been updated.` });
      } else {
        const docRef = await addDoc(collection(db, "resourceTypes"), typeDataToSave);
        addAuditLog(currentUser.id, currentUser.name, 'RESOURCE_TYPE_CREATED', { entityType: 'ResourceType', entityId: docRef.id, details: `Resource Type '${data.name}' created.`});
        toast({ title: 'Resource Type Created', description: `Resource Type "${data.name}" has been created.` });
      }
      setIsFormDialogOpen(false);
      setEditingType(null);
      await fetchData();
    } catch (error: any) {
        console.error("Error saving resource type:", error);
        toast({ title: "Save Error", description: `Could not save resource type: ${error.message}`, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const handleDeleteType = async (typeId: string) => {
    if (!currentUser || !currentUser.name || currentUser.role !== 'Admin') {
        toast({ title: "Permission Denied", description: "You are not authorized to delete resource types.", variant: "destructive" });
        return;
    }
    const deletedType = resourceTypes.find(rt => rt.id === typeId);
    if (!deletedType) {
        toast({ title: "Error", description: "Resource type not found for deletion.", variant: "destructive"});
        return;
    }
     const resourcesOfThisType = allResources.filter(res => res.resourceTypeId === typeId).length;
    if (resourcesOfThisType > 0) {
      toast({
        title: "Deletion Blocked",
        description: `Cannot delete type "${deletedType.name}" as ${resourcesOfThisType} resource(s) are currently assigned to it. Please reassign them first.`,
        variant: "destructive",
        duration: 7000,
      });
      setTypeToDelete(null); 
      return;
    }

    setIsLoading(true);
    try {
        const typeDocRef = doc(db, "resourceTypes", typeId);
        await deleteDoc(typeDocRef);
        addAuditLog(currentUser.id, currentUser.name, 'RESOURCE_TYPE_DELETED', { entityType: 'ResourceType', entityId: typeId, details: `Resource Type '${deletedType.name}' deleted.`});
        toast({ title: "Resource Type Deleted", description: `Resource Type "${deletedType.name}" has been removed.`, variant: "destructive" });
        setTypeToDelete(null);
        await fetchData();
    } catch (error: any) {
        console.error("Error deleting resource type:", error);
        toast({ title: "Delete Error", description: `Could not delete resource type: ${error.message}`, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const activeFilterCount = [activeSearchTerm !== '', activeSortBy !== 'name-asc'].filter(Boolean).length;
  const canAddResourceTypes = currentUser?.role === 'Admin';
  const canManageResourceTypes = currentUser?.role === 'Admin';

  if (!currentUser || !canManageResourceTypes) {
    return (
      <div className="space-y-8">
        <PageHeader title="Resource Types" icon={ListChecks} description="Access Denied." />
        <Card className="text-center py-10 text-muted-foreground">
          <CardContent>
            <p>You do not have permission to view or manage resource types.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

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
                <Button variant="outline" size="sm">
                  <FilterIcon className="mr-2 h-4 w-4" />
                  Filters & Sort
                  {activeFilterCount > 0 && (
                    <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DialogTrigger>
              <DialogContent className="w-full max-w-md"> 
                <DialogHeader>
                  <DialogTitle>Filter & Sort Resource Types</DialogTitle>
                  <DialogDescription>
                    Refine and order the list of resource types.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="typeSearchDialog">Search by Name/Description</Label>
                     <div className="relative mt-1">
                       <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                        id="typeSearchDialog"
                        type="search"
                        placeholder="Keyword..."
                        value={tempSearchTerm}
                        onChange={(e) => setTempSearchTerm(e.target.value)}
                        className="h-9 pl-8"
                        />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="typeSortDialog">Sort by</Label>
                    <Select value={tempSortBy} onValueChange={setTempSortBy}>
                        <SelectTrigger id="typeSortDialog" className="w-full h-9 mt-1">
                            <SelectValue placeholder="Sort by..." />
                        </SelectTrigger>
                        <SelectContent>
                            {sortOptions.map(opt => (
                            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="pt-6 border-t mt-4">
                   <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}><X className="mr-2 h-4 w-4" />Cancel</Button>
                  <Button onClick={handleApplyDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {canAddResourceTypes && (
              <Button onClick={handleOpenNewDialog} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" /> Add
              </Button>
            )}
          </div>
        }
      />

      {isLoading && filteredResourceTypesWithCount.length === 0 ? (
        <div className="flex justify-center items-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading resource types...
        </div>
      ) : filteredResourceTypesWithCount.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-center">No. of Resources</TableHead>
                {canManageResourceTypes && <TableHead className="text-right w-[100px]">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResourceTypesWithCount.map((type) => (
                  <TableRow key={type.id}>
                    <TableCell className="font-medium">{type.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{type.description || 'N/A'}</TableCell>
                    <TableCell className="text-center">{type.resourceCount}</TableCell>
                    {canManageResourceTypes && (
                      <TableCell className="text-right space-x-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditDialog(type)} disabled={isLoading}>
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit Resource Type</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent><p>Edit Resource Type</p></TooltipContent>
                        </Tooltip>

                        <AlertDialog open={typeToDelete?.id === type.id} onOpenChange={(isOpen) => !isOpen && setTypeToDelete(null)}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setTypeToDelete(type)} disabled={isLoading}>
                                    <Trash2 className="h-4 w-4" />
                                    <span className="sr-only">Delete Resource Type</span>
                                </Button>
                              </AlertDialogTrigger>
                            </TooltipTrigger>
                            <TooltipContent><p>Delete Resource Type</p></TooltipContent>
                          </Tooltip>
                          <AlertDialogContent>
                              <AlertDialogHeader>
                                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                  This action cannot be undone. This will remove the resource type
                                  <span className="font-semibold"> "{typeToDelete?.name}"</span>.
                                  Ensure no resources are using this type before deleting.
                                  </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                  <AlertDialogCancel onClick={() => setTypeToDelete(null)}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction variant="destructive" onClick={() => typeToDelete && handleDeleteType(typeToDelete.id)}>
                                  Delete Resource Type
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
        <Card className="text-center py-10 text-muted-foreground border-0 shadow-none">
          <CardContent>
            <ListChecks className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">
                {activeSearchTerm || activeSortBy !== 'name-asc' ? "No Resource Types Match Criteria" : "No Resource Types Defined"}
            </p>
            <p className="text-sm mb-4">
                {activeSearchTerm || activeSortBy !== 'name-asc'
                    ? "Try adjusting your filter or sort criteria."
                    : (canAddResourceTypes ? "Add resource types to categorize your lab equipment and assets." : "No resource types have been defined.")
                }
            </p>
            {(activeSearchTerm || activeSortBy !== 'name-asc') && canManageResourceTypes && (
                <Button variant="outline" onClick={resetAllActivePageFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters & Sort
                </Button>
            )}
            {!(activeSearchTerm || activeSortBy !== 'name-asc') && !resourceTypes.length && canAddResourceTypes && (
                <Button onClick={handleOpenNewDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First Resource Type
                </Button>
            )}
          </CardContent>
        </Card>
      )}
      {isFormDialogOpen && currentUser && (
        <ResourceTypeFormDialog
            open={isFormDialogOpen}
            onOpenChange={(isOpen) => {
                setIsFormDialogOpen(isOpen);
                if (!isOpen) setEditingType(null);
            }}
            initialType={editingType}
            onSave={handleSaveType}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
