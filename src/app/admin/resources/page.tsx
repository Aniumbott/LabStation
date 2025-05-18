
'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { PageHeader } from '@/components/layout/page-header';
import { ClipboardList, PlusCircle, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon, CheckCircle, AlertTriangle, Construction } from 'lucide-react';
import type { Resource, ResourceType, ResourceStatus } from '@/types';
import { allMockResources as initialGlobalMockResources } from '@/app/resources/page'; // To initialize
import { initialMockResourceTypes } from '@/app/admin/resource-types/page';
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
import { ResourceFormDialog, ResourceFormValues } from '@/components/admin/resource-form-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

const labsList: Resource['lab'][] = ['Lab A', 'Lab B', 'Lab C', 'General Lab'];
const resourceStatusesList: ResourceStatus[] = ['Available', 'Booked', 'Maintenance'];

const getStatusBadge = (status: ResourceStatus) => {
  switch (status) {
    case 'Available':
      return <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent"><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Booked':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950 border-transparent"><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Maintenance':
      return <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-transparent"><Construction className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default:
      return <Badge variant="outline"><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
  }
};

export default function ManageResourcesPage() {
  const { toast } = useToast();
  const [resources, setResources] = useState<Resource[]>(() => JSON.parse(JSON.stringify(initialGlobalMockResources))); // Deep copy
  const [resourceToDelete, setResourceToDelete] = useState<Resource | null>(null);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterTypeName, setActiveFilterTypeName] = useState<string>('all');
  const [activeFilterLab, setActiveFilterLab] = useState<string>('all');

  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterTypeName, setTempFilterTypeName] = useState<string>('all');
  const [tempFilterLab, setTempFilterLab] = useState<string>('all');
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterTypeName(activeFilterTypeName);
      setTempFilterLab(activeFilterLab);
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterTypeName, activeFilterLab]);

  const filteredResources = useMemo(() => {
    let currentResources = [...resources];
    if (activeSearchTerm) {
      currentResources = currentResources.filter(resource =>
        resource.name.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
        (resource.description && resource.description.toLowerCase().includes(activeSearchTerm.toLowerCase())) ||
        (resource.manufacturer && resource.manufacturer.toLowerCase().includes(activeSearchTerm.toLowerCase())) ||
        (resource.model && resource.model.toLowerCase().includes(activeSearchTerm.toLowerCase()))
      );
    }
    if (activeFilterTypeName !== 'all') {
      currentResources = currentResources.filter(resource => resource.resourceTypeName === activeFilterTypeName);
    }
    if (activeFilterLab !== 'all') {
      currentResources = currentResources.filter(resource => resource.lab === activeFilterLab);
    }
    return currentResources.sort((a,b) => a.name.localeCompare(b.name));
  }, [resources, activeSearchTerm, activeFilterTypeName, activeFilterLab]);

  const handleApplyFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterTypeName(tempFilterTypeName);
    setActiveFilterLab(tempFilterLab);
    setIsFilterDialogOpen(false);
  };

  const resetFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterTypeName('all');
    setActiveFilterLab('all');
    setTempSearchTerm('');
    setTempFilterTypeName('all');
    setTempFilterLab('all');
  };

  const handleOpenNewDialog = () => {
    setEditingResource(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (resource: Resource) => {
    setEditingResource(resource);
    setIsFormDialogOpen(true);
  };

  const handleSaveResource = (data: ResourceFormValues) => {
    const resourceType = initialMockResourceTypes.find(rt => rt.id === data.resourceTypeId);
    if (!resourceType) {
        toast({ title: "Error", description: "Selected resource type not found.", variant: "destructive"});
        return;
    }

    if (editingResource) {
      setResources(resources.map(r => r.id === editingResource.id ? { 
        ...editingResource, 
        ...data,
        resourceTypeName: resourceType.name, // Ensure this is updated
        // Keep existing non-form fields like availability, calibration if not in form
        availability: editingResource.availability,
        lastCalibration: editingResource.lastCalibration,
        nextCalibration: editingResource.nextCalibration,
      } : r));
      toast({
        title: 'Resource Updated',
        description: `Resource "${data.name}" has been updated.`,
      });
    } else {
      const newResource: Resource = {
        id: `res${resources.length + 1 + Date.now()}`,
        ...data,
        resourceTypeName: resourceType.name,
        // Default other fields not in form
        imageUrl: data.imageUrl || 'https://placehold.co/300x200.png',
        dataAiHint: data.dataAiHint || 'lab equipment',
        availability: [], // Default empty availability
        features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
      };
      setResources([...resources, newResource]);
      toast({
        title: 'Resource Created',
        description: `Resource "${data.name}" has been created.`,
      });
    }
    setIsFormDialogOpen(false);
  };

  const handleDeleteResource = (resourceId: string) => {
    const deletedResource = resources.find(r => r.id === resourceId);
    setResources(currentResources => currentResources.filter(resource => resource.id !== resourceId));
    toast({
      title: "Resource Deleted",
      description: `Resource "${deletedResource?.name}" has been removed.`,
      variant: "destructive"
    });
    setResourceToDelete(null);
  };

  const activeFilterCount = [activeSearchTerm !== '', activeFilterTypeName !== 'all', activeFilterLab !== 'all'].filter(Boolean).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manage Resources"
        description="Add, edit, and manage all lab resources and equipment."
        icon={ClipboardList}
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
                  <DialogTitle>Filter Resources</DialogTitle>
                  <DialogDescription>
                    Refine the list of resources.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="resourceSearchDialog">Search</Label>
                    <Input
                      id="resourceSearchDialog"
                      type="search"
                      placeholder="Name, description, model..."
                      value={tempSearchTerm}
                      onChange={(e) => setTempSearchTerm(e.target.value)}
                      className="mt-1 h-9"
                    />
                  </div>
                  <div>
                    <Label htmlFor="resourceTypeFilterDialog">Type</Label>
                    <Select value={tempFilterTypeName} onValueChange={setTempFilterTypeName}>
                      <SelectTrigger id="resourceTypeFilterDialog" className="mt-1 h-9"><SelectValue placeholder="Filter by Type" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Types</SelectItem>
                        {initialMockResourceTypes.map(type => (
                          <SelectItem key={type.id} value={type.name}>{type.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="resourceLabFilterDialog">Lab</Label>
                    <Select value={tempFilterLab} onValueChange={setTempFilterLab}>
                      <SelectTrigger id="resourceLabFilterDialog" className="mt-1 h-9"><SelectValue placeholder="Filter by Lab" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Labs</SelectItem>
                        {labsList.map(lab => (
                          <SelectItem key={lab} value={lab}>{lab}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter className="pt-6">
                   <Button variant="ghost" onClick={() => { resetFilters(); setIsFilterDialogOpen(false); }} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyFilters}>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={handleOpenNewDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Resource
            </Button>
          </div>
        }
      />

      {filteredResources.length > 0 ? (
        <TooltipProvider>
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Lab</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[120px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.map((resource) => (
                <TableRow key={resource.id}>
                  <TableCell>
                    <Image 
                        src={resource.imageUrl || 'https://placehold.co/100x100.png'} 
                        alt={resource.name} 
                        width={40} height={40} 
                        className="rounded-md object-cover h-10 w-10"
                        data-ai-hint={resource.dataAiHint || 'lab equipment'} 
                    />
                  </TableCell>
                  <TableCell className="font-medium">{resource.name}</TableCell>
                  <TableCell>{resource.resourceTypeName}</TableCell>
                  <TableCell>{resource.lab}</TableCell>
                  <TableCell>{getStatusBadge(resource.status)}</TableCell>
                  <TableCell className="text-right space-x-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditDialog(resource)}>
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit Resource</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent><p>Edit Resource</p></TooltipContent>
                    </Tooltip>
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setResourceToDelete(resource)}>
                              <Trash2 className="h-4 w-4" />
                              <span className="sr-only">Delete Resource</span>
                            </Button>
                          </AlertDialogTrigger>
                        </TooltipTrigger>
                        <TooltipContent><p>Delete Resource</p></TooltipContent>
                      </Tooltip>
                      {resourceToDelete && resourceToDelete.id === resource.id && (
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This will permanently delete the resource: <span className="font-semibold">"{resourceToDelete.name}"</span>.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel onClick={() => setResourceToDelete(null)}>Cancel</AlertDialogCancel>
                            <AlertDialogAction variant="destructive" onClick={() => handleDeleteResource(resourceToDelete.id)}>
                              Delete Resource
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
          <ClipboardList className="mx-auto h-12 w-12 mb-4" />
           <p className="text-lg font-medium">
            {activeFilterCount > 0 ? "No Resources Match Filters" : "No Resources Found"}
          </p>
          <p className="text-sm mb-4">
            {activeFilterCount > 0
                ? "Try adjusting your search or filter criteria."
                : "There are currently no resources in the catalog. Add one to get started!"
            }
          </p>
          {activeFilterCount > 0 ? (
             <Button variant="outline" onClick={() => { resetFilters(); handleApplyFilters(); }}>
                <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
            </Button>
          ) : (
            <Button onClick={handleOpenNewDialog}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add First Resource
            </Button>
          )}
        </Card>
      )}
      <ResourceFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        initialResource={editingResource}
        onSave={handleSaveResource}
        resourceTypes={initialMockResourceTypes}
        labs={labsList}
        statuses={resourceStatusesList}
      />
    </div>
  );
}
