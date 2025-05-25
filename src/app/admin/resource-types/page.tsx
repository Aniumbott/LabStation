
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { ListChecks, PlusCircle, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon, Loader2, X } from 'lucide-react'; // Added X
import type { ResourceType } from '@/types';
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
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from 'firebase/firestore';
import { addAuditLog } from '@/lib/mock-data';


export default function ResourceTypesPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [typeToDelete, setTypeToDelete] = useState<ResourceType | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ResourceType | null>(null);

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [activeSearchTerm, setActiveSearchTerm] = useState('');


  const fetchResourceTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      // Firestore Index Required: resourceTypes (name ASC) - usually created automatically for simple orderBy
      const typesQuery = query(collection(db, "resourceTypes"), orderBy("name", "asc"));
      const querySnapshot = await getDocs(typesQuery);
      const fetchedTypes: ResourceType[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Type',
          description: data.description || undefined,
        } as ResourceType;
      });
      setResourceTypes(fetchedTypes);
    } catch (error: any) {
      console.error("Error fetching resource types:", error);
      toast({ title: "Error", description: `Failed to load resource types: ${error.message}`, variant: "destructive" });
      setResourceTypes([]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    if (currentUser?.role === 'Admin') {
      fetchResourceTypes();
    } else {
      setResourceTypes([]);
      setIsLoading(false);
    }
  }, [currentUser, fetchResourceTypes]);


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
    return currentTypes; // Already sorted by Firestore query
  }, [resourceTypes, activeSearchTerm]);

  const handleApplyDialogFilters = useCallback(() => {
    setActiveSearchTerm(tempSearchTerm);
    setIsFilterDialogOpen(false);
  }, [tempSearchTerm]);

  const resetDialogFiltersOnly = useCallback(() => {
    setTempSearchTerm('');
  }, []);

  const resetAllActivePageFilters = useCallback(() => {
    setActiveSearchTerm('');
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
      const typeDataToSave: Omit<ResourceType, 'id'> = { // Omit id as Firestore generates it for new docs
        name: data.name,
        description: data.description || undefined, // Store undefined if empty for cleaner Firestore docs
      };

      if (editingType) {
        const typeDocRef = doc(db, "resourceTypes", editingType.id);
        await updateDoc(typeDocRef, typeDataToSave);
        addAuditLog(currentUser.id, currentUser.name, 'RESOURCE_TYPE_UPDATED', { entityType: 'ResourceType', entityId: editingType.id, details: `Resource Type '${data.name}' updated.`});
        toast({ title: 'Resource Type Updated', description: `Resource Type "${data.name}" has been updated.` });
      } else {
        const docRef = await addDoc(collection(db, "resourceTypes"), typeDataToSave);
        // No need to update the document with its own ID if not part of ResourceType
        addAuditLog(currentUser.id, currentUser.name, 'RESOURCE_TYPE_CREATED', { entityType: 'ResourceType', entityId: docRef.id, details: `Resource Type '${data.name}' created.`});
        toast({ title: 'Resource Type Created', description: `Resource Type "${data.name}" has been created.` });
      }
      setIsFormDialogOpen(false);
      setEditingType(null);
      await fetchResourceTypes();
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

    setIsLoading(true);
    try {
        const typeDocRef = doc(db, "resourceTypes", typeId);
        await deleteDoc(typeDocRef);
        addAuditLog(currentUser.id, currentUser.name, 'RESOURCE_TYPE_DELETED', { entityType: 'ResourceType', entityId: typeId, details: `Resource Type '${deletedType.name}' deleted.`});
        toast({ title: "Resource Type Deleted", description: `Resource Type "${deletedType.name}" has been removed.`, variant: "destructive" });
        setTypeToDelete(null);
        await fetchResourceTypes();
    } catch (error: any) {
        console.error("Error deleting resource type:", error);
        toast({ title: "Delete Error", description: `Could not delete resource type: ${error.message}`, variant: "destructive" });
    } finally {
        setIsLoading(false);
    }
  };

  const activeFilterCount = [activeSearchTerm !== ''].filter(Boolean).length;
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
                </div>
                <DialogFooter className="pt-6 border-t mt-4">
                   <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}><X className="mr-2 h-4 w-4" />Cancel</Button>
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

      {isLoading ? (
        <div className="flex justify-center items-center py-10 text-muted-foreground">
          <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading resource types...
        </div>
      ) : filteredResourceTypes.length > 0 ? (
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
                                  This might affect existing resources categorized under this type.
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
                {activeSearchTerm ? "No Resource Types Match Filter" : "No Resource Types Defined"}
            </p>
            <p className="text-sm mb-4">
                {activeSearchTerm
                    ? "Try adjusting your search criteria or ensure types are added in Firestore."
                    : (canAddResourceTypes ? "Add resource types to categorize your lab equipment and assets. Ensure they exist in your Firestore 'resourceTypes' collection." : "No resource types have been defined in Firestore.")
                }
            </p>
            {activeSearchTerm && canManageResourceTypes && (
                <Button variant="outline" onClick={resetAllActivePageFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
            )}
            {!activeSearchTerm && !resourceTypes.length && canAddResourceTypes && (
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
