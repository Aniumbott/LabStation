
'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { ClipboardList, PlusCircle, Filter as FilterIcon, FilterX, CheckCircle, AlertTriangle, Construction, CalendarDays, CalendarPlus, Search as SearchIcon, Calendar as CalendarIcon } from 'lucide-react';
import type { Resource, ResourceStatus } from '@/types';
import { allAdminMockResources, initialMockResourceTypes, labsList } from '@/lib/mock-data';
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
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { ResourceFormDialog, ResourceFormValues } from '@/components/admin/resource-form-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, startOfDay, isSameDay, parseISO, isValid, addDays } from 'date-fns';

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

export default function ResourcesPage() {
  const { toast } = useToast();
  const [resources, setResources] = useState<Resource[]>(() => JSON.parse(JSON.stringify(allAdminMockResources)));
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  // Active filters for the page
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterTypeId, setActiveFilterTypeId] = useState<string>('all');
  const [activeFilterLab, setActiveFilterLab] = useState<string>('all');
  const [activeSelectedDate, setActiveSelectedDate] = useState<Date | undefined>(undefined);

  // Temp filters for Dialog
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterTypeId, setTempFilterTypeId] = useState<string>('all');
  const [tempFilterLab, setTempFilterLab] = useState<string>('all');
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonthInDialog, setCurrentMonthInDialog] = useState<Date>(startOfDay(new Date()));
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterTypeId(activeFilterTypeId);
      setTempFilterLab(activeFilterLab);
      setTempSelectedDate(activeSelectedDate);
      if (activeSelectedDate) setCurrentMonthInDialog(activeSelectedDate); else setCurrentMonthInDialog(startOfDay(new Date()));
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterTypeId, activeFilterLab, activeSelectedDate]);

  const filteredResources = useMemo(() => {
    let currentResources = [...resources];
    if (activeSearchTerm) {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      currentResources = currentResources.filter(resource =>
        resource.name.toLowerCase().includes(lowerSearchTerm) ||
        (resource.description && resource.description.toLowerCase().includes(lowerSearchTerm)) ||
        (resource.manufacturer && resource.manufacturer.toLowerCase().includes(lowerSearchTerm)) ||
        (resource.model && resource.model.toLowerCase().includes(lowerSearchTerm))
      );
    }
    if (activeFilterTypeId !== 'all') {
      currentResources = currentResources.filter(resource => resource.resourceTypeId === activeFilterTypeId);
    }
    if (activeFilterLab !== 'all') {
      currentResources = currentResources.filter(resource => resource.lab === activeFilterLab);
    }
    if (activeSelectedDate) {
      const dateStrToFilter = format(activeSelectedDate, 'yyyy-MM-dd');
      currentResources = currentResources.filter(resource =>
        resource.availability?.some(avail => avail.date === dateStrToFilter && avail.slots.length > 0 && !avail.slots.includes('Full Day Booked')) && resource.status === 'Available'
      );
    }
    return currentResources.sort((a,b) => a.name.localeCompare(b.name));
  }, [resources, activeSearchTerm, activeFilterTypeId, activeFilterLab, activeSelectedDate]);

  const handleApplyFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterTypeId(tempFilterTypeId);
    setActiveFilterLab(tempFilterLab);
    setActiveSelectedDate(tempSelectedDate);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFilters = () => {
    setTempSearchTerm('');
    setTempFilterTypeId('all');
    setTempFilterLab('all');
    setTempSelectedDate(undefined);
    setCurrentMonthInDialog(startOfDay(new Date()));
  };
  
  const resetAllActiveFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterTypeId('all');
    setActiveFilterLab('all');
    setActiveSelectedDate(undefined);
    resetDialogFilters();
    setIsFilterDialogOpen(false);
  };


  const handleOpenNewDialog = () => {
    setEditingResource(null);
    setIsFormDialogOpen(true);
  };
  
  const handleSaveResource = (data: ResourceFormValues) => {
    const resourceType = initialMockResourceTypes.find(rt => rt.id === data.resourceTypeId);
    if (!resourceType) {
        toast({ title: "Error", description: "Selected resource type not found.", variant: "destructive"});
        return;
    }

    if (editingResource) {
      setResources(prevResources => prevResources.map(r => r.id === editingResource.id ? {
        ...editingResource,
        ...data,
        name: data.name,
        resourceTypeId: data.resourceTypeId,
        resourceTypeName: resourceType.name, 
        lab: data.lab,
        status: data.status,
        description: data.description || '',
        imageUrl: data.imageUrl || 'https://placehold.co/300x200.png',
        manufacturer: data.manufacturer || undefined,
        model: data.model || undefined,
        serialNumber: data.serialNumber || undefined,
        purchaseDate: data.purchaseDate && isValid(parseISO(data.purchaseDate)) ? parseISO(data.purchaseDate).toISOString() : undefined,
        notes: data.notes || undefined,
        features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
        availability: editingResource.availability,
        remoteAccess: data.remoteAccess && Object.values(data.remoteAccess).some(v => v !== '' && v !== undefined && v !== null) ? {
          ...data.remoteAccess,
          port: data.remoteAccess.port ? Number(data.remoteAccess.port) : undefined,
        } : undefined,
      } : r));
      toast({
        title: 'Resource Updated',
        description: `Resource "${data.name}" has been updated.`,
      });
    } else {
      const newResource: Resource = {
        id: `res${resources.length + 1 + Date.now()}`,
        ...data,
        name: data.name,
        resourceTypeId: data.resourceTypeId,
        resourceTypeName: resourceType.name, 
        lab: data.lab,
        status: data.status,
        description: data.description || '',
        imageUrl: data.imageUrl || 'https://placehold.co/300x200.png',
        manufacturer: data.manufacturer || undefined,
        model: data.model || undefined,
        serialNumber: data.serialNumber || undefined,
        purchaseDate: data.purchaseDate && isValid(parseISO(data.purchaseDate)) ? parseISO(data.purchaseDate).toISOString() : undefined,
        notes: data.notes || undefined,
        features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
        availability: [], 
        remoteAccess: data.remoteAccess && Object.values(data.remoteAccess).some(v => v !== '' && v !== undefined && v !== null) ? {
          ...data.remoteAccess,
          port: data.remoteAccess.port ? Number(data.remoteAccess.port) : undefined,
        } : undefined,
      };
      setResources(prevResources => [...prevResources, newResource]);
      toast({
        title: 'Resource Created',
        description: `Resource "${data.name}" has been created.`,
      });
    }
    setIsFormDialogOpen(false);
    setEditingResource(null);
  };

  const activeFilterCount = [activeSearchTerm !== '', activeFilterTypeId !== 'all', activeFilterLab !== 'all', activeSelectedDate !== undefined].filter(Boolean).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Resources"
        description="Browse, filter, and manage all lab resources. Click resource name for details."
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
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Filter Resources</DialogTitle>
                  <DialogDescription>
                    Refine the list of available lab resources.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2">
                  <div>
                    <Label htmlFor="resourceSearchDialog" className="text-sm font-medium mb-1 block">Search by Name/Keyword</Label>
                    <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                        id="resourceSearchDialog"
                        type="search"
                        placeholder="Name, manufacturer, model..."
                        value={tempSearchTerm}
                        onChange={(e) => setTempSearchTerm(e.target.value.toLowerCase())}
                        className="h-9 pl-8"
                        />
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="resourceTypeFilterDialog" className="text-sm font-medium mb-1 block">Type</Label>
                      <Select value={tempFilterTypeId} onValueChange={setTempFilterTypeId}>
                        <SelectTrigger id="resourceTypeFilterDialog" className="h-9"><SelectValue placeholder="Filter by Type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {initialMockResourceTypes.map(type => (
                            <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="resourceLabFilterDialog" className="text-sm font-medium mb-1 block">Lab</Label>
                      <Select value={tempFilterLab} onValueChange={setTempFilterLab}>
                        <SelectTrigger id="resourceLabFilterDialog" className="h-9"><SelectValue placeholder="Filter by Lab" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Labs</SelectItem>
                          {labsList.map(lab => (
                            <SelectItem key={lab} value={lab}>{lab}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Separator />
                  <div>
                      <Label className="text-sm font-medium mb-2 block">Available On</Label>
                      <div className="flex justify-center items-center rounded-md border p-2">
                        <Calendar
                            mode="single"
                            selected={tempSelectedDate}
                            onSelect={setTempSelectedDate}
                            month={currentMonthInDialog}
                            onMonthChange={setCurrentMonthInDialog}
                            disabled={(date) => date < startOfDay(addDays(new Date(), -90)) }
                            footer={ tempSelectedDate &&
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setTempSelectedDate(undefined)}
                                    className="w-full mt-2 text-xs"
                                >
                                    Clear Date Selection
                                </Button>
                            }
                            classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }}
                        />
                      </div>
                  </div>
                </div>
                <DialogFooter className="pt-6">
                   <Button variant="ghost" onClick={resetDialogFilters} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyFilters}>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={handleOpenNewDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add
            </Button>
          </div>
        }
      />

      {filteredResources.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Lab</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.map((resource) => (
                <TableRow key={resource.id}>
                  <TableCell>
                    <Link href={`/resources/${resource.id}`}>
                      <Image
                          src={resource.imageUrl || 'https://placehold.co/100x100.png'}
                          alt={resource.name}
                          width={40} height={40}
                          className="rounded-md object-cover h-10 w-10 hover:opacity-80 transition-opacity"
                      />
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                     <Link href={`/resources/${resource.id}`} className="hover:text-primary hover:underline">
                        {resource.name}
                     </Link>
                  </TableCell>
                  <TableCell>{resource.resourceTypeName}</TableCell>
                  <TableCell>{resource.lab}</TableCell>
                  <TableCell>{getStatusBadge(resource.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      asChild
                      size="sm"
                      variant={resource.status !== 'Available' ? "outline" : "default"}
                      disabled={resource.status !== 'Available'}
                      className="h-8 text-xs"
                    >
                      <Link href={`/bookings?resourceId=${resource.id}${activeSelectedDate ? `&date=${format(activeSelectedDate, 'yyyy-MM-dd')}`: ''}`}>
                        <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                        {resource.status === 'Available' ? 'Book' : resource.status}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
         <Card className="text-center py-10 text-muted-foreground bg-card rounded-lg border">
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
             <Button variant="outline" onClick={resetAllActiveFilters}>
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
        onOpenChange={(isOpen) => {
            setIsFormDialogOpen(isOpen);
            if (!isOpen) setEditingResource(null);
        }}
        initialResource={editingResource}
        onSave={handleSaveResource}
      />
    </div>
  );
}
