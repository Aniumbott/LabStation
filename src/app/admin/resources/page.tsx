
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { ClipboardList, PlusCircle, Filter as FilterIcon, CalendarPlus, Search as SearchIcon, Calendar as CalendarIcon, Loader2, FilterX } from 'lucide-react';
import type { Resource, ResourceType, ResourceStatus } from '@/types';
import { initialMockResourceTypes, labsList } from '@/lib/mock-data';
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { ResourceFormDialog, ResourceFormValues } from '@/components/admin/resource-form-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfDay, isValid, parseISO, isWithinInterval, addDays as dateFnsAddDays } from 'date-fns';
import { cn, formatDateSafe, getResourceStatusBadge } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, query, where, orderBy } from 'firebase/firestore';
import { useRouter } from 'next/navigation'; // Added useRouter import

export default function AdminResourcesPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [resources, setResources] = useState<Resource[]>([]);
  const [fetchedResourceTypes, setFetchedResourceTypes] = useState<ResourceType[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterTypeId, setTempFilterTypeId] = useState<string>('all');
  const [tempFilterLab, setTempFilterLab] = useState<string>('all');
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonthInDialog, setCurrentMonthInDialog] = useState<Date>(startOfDay(new Date()));

  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterTypeId, setActiveFilterTypeId] = useState<string>('all');
  const [activeFilterLab, setActiveFilterLab] = useState<string>('all');
  const [activeSelectedDate, setActiveSelectedDate] = useState<Date | undefined>(undefined);

  const fetchData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const resourcesSnapshot = await getDocs(query(collection(db, "resources"), orderBy("name", "asc")));
      const fetchedResourcesPromises = resourcesSnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Resource',
          resourceTypeId: data.resourceTypeId || '',
          lab: data.lab || labsList[0], // Assuming labsList has at least one entry
          status: data.status || 'Available',
          description: data.description || '',
          imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
          manufacturer: data.manufacturer,
          model: data.model,
          serialNumber: data.serialNumber,
          purchaseDate: data.purchaseDate ? (typeof data.purchaseDate === 'string' ? data.purchaseDate : (data.purchaseDate as Timestamp).toDate().toISOString()) : undefined,
          notes: data.notes,
          features: Array.isArray(data.features) ? data.features : [],
          remoteAccess: data.remoteAccess,
          allowQueueing: data.allowQueueing ?? false,
          availability: Array.isArray(data.availability) ? data.availability.map((a: any) => ({...a, date: typeof a.date === 'string' ? a.date : (a.date?.toDate ? format(a.date.toDate(), 'yyyy-MM-dd') : a.date) })) : [],
          unavailabilityPeriods: Array.isArray(data.unavailabilityPeriods) ? data.unavailabilityPeriods.map((p: any) => ({...p, id: p.id || ('unavail-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9)), startDate: typeof p.startDate === 'string' ? p.startDate : (p.startDate?.toDate ? format(p.startDate.toDate(), 'yyyy-MM-dd') : p.startDate), endDate: typeof p.endDate === 'string' ? p.endDate : (p.endDate?.toDate ? format(p.endDate.toDate(), 'yyyy-MM-dd') : p.endDate), reason: p.reason })) : [],
        } as Resource;
      });
      const fetchedResources = await Promise.all(fetchedResourcesPromises);
      setResources(fetchedResources);

      const typesSnapshot = await getDocs(query(collection(db, "resourceTypes"), orderBy("name", "asc")));
      const rTypes: ResourceType[] = typesSnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data(),
      } as ResourceType));
      setFetchedResourceTypes(rTypes);

    } catch (error) {
      console.error("Error fetching resources or types: ", error);
      toast({ title: "Error", description: "Failed to fetch data from database. Check console for details.", variant: "destructive" });
    }
    setIsLoadingData(false);
  }, [toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);


  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterTypeId(activeFilterTypeId);
      setTempFilterLab(activeFilterLab);
      setTempSelectedDate(activeSelectedDate);
      setCurrentMonthInDialog(activeSelectedDate || startOfDay(new Date()));
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterTypeId, activeFilterLab, activeSelectedDate]);

  const filteredResources = useMemo(() => {
    let currentResources = [...resources];
    const lowerSearchTerm = activeSearchTerm.toLowerCase();

    if (activeSearchTerm) {
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
      const dateToFilter = startOfDay(activeSelectedDate);
      const dateToFilterStr = format(dateToFilter, 'yyyy-MM-dd');
      
      currentResources = currentResources.filter(resource => {
        if (resource.status !== 'Available') return false;

        const isSpecificallyUnavailable = resource.unavailabilityPeriods?.some(period => {
          if (!period.startDate || !period.endDate) return false;
          try {
            const periodStart = parseISO(period.startDate);
            const periodEnd = parseISO(period.endDate); // End of the day for end date
            return isValid(periodStart) && isValid(periodEnd) && 
                   isWithinInterval(dateToFilter, { start: startOfDay(periodStart), end: startOfDay(periodEnd) });
          } catch (e) { return false; }
        });
        if (isSpecificallyUnavailable) return false;
        
        const dayAvailability = resource.availability?.find(avail => avail.date === dateToFilterStr);
        return dayAvailability && Array.isArray(dayAvailability.slots) && dayAvailability.slots.length > 0;
      });
    }
    return currentResources;
  }, [resources, activeSearchTerm, activeFilterTypeId, activeFilterLab, activeSelectedDate]);

  const handleApplyDialogFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterTypeId(tempFilterTypeId);
    setActiveFilterLab(tempFilterLab);
    setActiveSelectedDate(tempSelectedDate);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFiltersOnly = () => {
    setTempSearchTerm('');
    setTempFilterTypeId('all');
    setTempFilterLab('all');
    setTempSelectedDate(undefined);
    setCurrentMonthInDialog(startOfDay(new Date()));
  };

  const resetAllActivePageFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterTypeId('all');
    setActiveFilterLab('all');
    setActiveSelectedDate(undefined);
    resetDialogFiltersOnly();
    setIsFilterDialogOpen(false);
  };

  const handleOpenNewDialog = () => {
    if (fetchedResourceTypes.length === 0) {
        toast({
            title: "No Resource Types Defined",
            description: "Please add resource types first before adding resources.",
            variant: "destructive",
        });
        return;
    }
    setEditingResource(null);
    setIsFormDialogOpen(true);
  };
  const router = useRouter();


  const handleOpenEditDialog = (resource: Resource) => {
    setEditingResource(resource);
    setIsFormDialogOpen(true);
  };

  const handleSaveResource = async (data: ResourceFormValues) => {
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Lab Manager')) {
      toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }

    const resourceType = fetchedResourceTypes.find(rt => rt.id === data.resourceTypeId);
    if (!resourceType) {
        toast({ title: "Error", description: "Selected resource type not found.", variant: "destructive"});
        return;
    }

    const resourceDataToSave: Omit<Resource, 'id' | 'availability' | 'unavailabilityPeriods'> & { purchaseDate?: Timestamp | null, availability?: any[], unavailabilityPeriods?: any[]} = {
      name: data.name,
      resourceTypeId: data.resourceTypeId,
      lab: data.lab,
      status: data.status,
      description: data.description || '',
      imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
      manufacturer: data.manufacturer || undefined,
      model: data.model || undefined,
      serialNumber: data.serialNumber || undefined,
      purchaseDate: data.purchaseDate && isValid(parseISO(data.purchaseDate)) ? Timestamp.fromDate(parseISO(data.purchaseDate)) : null,
      notes: data.notes || undefined,
      features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
      remoteAccess: data.remoteAccess && Object.values(data.remoteAccess).some(v => v !== undefined && v !== '' && v !== null) ? {
         ipAddress: data.remoteAccess.ipAddress || undefined,
         hostname: data.remoteAccess.hostname || undefined,
         protocol: data.remoteAccess.protocol || undefined,
         username: data.remoteAccess.username || undefined,
         port: data.remoteAccess.port ?? undefined, 
         notes: data.remoteAccess.notes || undefined,
      } : undefined,
      allowQueueing: data.allowQueueing ?? false,
    };
    
    const cleanDbData = Object.fromEntries(Object.entries(resourceDataToSave).filter(([_, v]) => v !== undefined));


    setIsLoadingData(true);
    const auditAction = editingResource ? 'RESOURCE_UPDATED' : 'RESOURCE_CREATED';
    const auditDetails = `Resource '${data.name}' ${editingResource ? 'updated' : 'created'}.`;

    if (editingResource) {
      try {
        const resourceDocRef = doc(db, "resources", editingResource.id);
        const dataWithExistingSchedules = {
            ...cleanDbData,
            availability: editingResource.availability || [],
            unavailabilityPeriods: editingResource.unavailabilityPeriods || [],
        };
        await updateDoc(resourceDocRef, dataWithExistingSchedules);
        toast({ title: 'Resource Updated', description: `Resource "${data.name}" has been updated.` });
      } catch (error) {
        console.error("Error updating resource:", error);
        toast({ title: "Error", description: "Failed to update resource. Check console.", variant: "destructive" });
      }
    } else {
      try {
        const dataForNewResource = {
            ...cleanDbData,
            availability: [], 
            unavailabilityPeriods: [],
        };
        const docRef = await addDoc(collection(db, "resources"), dataForNewResource);
        // No audit log for new resource ID as it's generated by Firestore
        toast({ title: 'Resource Created', description: `Resource "${data.name}" has been created.` });
      } catch (error) {
        console.error("Error creating resource:", error);
        toast({ title: "Error", description: "Failed to create resource. Check console.", variant: "destructive" });
      }
    }
    // Firestore Audit Log
    // addAuditLog(currentUser.id, currentUser.name || 'Admin/Manager', auditAction, { entityType: 'Resource', entityId: editingResource?.id || 'NEW_RESOURCE', details: auditDetails });
    setIsFormDialogOpen(false);
    setEditingResource(null);
    await fetchData(); 
  };

  const activeFilterCount = [
    activeSearchTerm !== '',
    activeFilterTypeId !== 'all',
    activeFilterLab !== 'all',
    activeSelectedDate !== undefined
  ].filter(Boolean).length;
  
  const canAddResources = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Lab Manager');

  return (
    <div className="space-y-8">
      <PageHeader
        title="Resources"
        description="Browse, filter, and manage all lab resources. Click resource name for details & admin actions."
        icon={ClipboardList}
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
              <DialogContent className="w-full max-w-xs sm:max-w-sm md:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Filter Resources</DialogTitle>
                  <DialogDescription>
                    Refine the list of available lab resources.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <ScrollArea className="max-h-[65vh] overflow-y-auto pr-2">
                <div className="space-y-6 py-1">
                  <div>
                    <Label htmlFor="resourceSearchDialog" className="text-sm font-medium mb-1 block">Search (Name/Keyword)</Label>
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
                          {fetchedResourceTypes.map(type => (
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
                            disabled={(date) => date < startOfDay(new Date()) } 
                            footer={ tempSelectedDate &&
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setTempSelectedDate(undefined)}
                                    className="w-full mt-2 text-xs"
                                >
                                    <FilterX className="mr-2 h-4 w-4" /> Clear Date Selection
                                </Button>
                            }
                            classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }}
                        />
                      </div>
                  </div>
                </div>
                </ScrollArea>
                <DialogFooter className="pt-6 border-t">
                   <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyDialogFilters}>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {canAddResources && (
                <Button onClick={handleOpenNewDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add
                </Button>
            )}
          </div>
        }
      />

      {isLoadingData ? (
        <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading resources...</div>
      ) : filteredResources.length > 0 ? (
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
              {filteredResources.map((resource) => {
                const resourceType = fetchedResourceTypes.find(rt => rt.id === resource.resourceTypeId);
                const resourceTypeNameDisplay = resourceType ? resourceType.name : 'N/A';

                return (
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
                  <TableCell>{resourceTypeNameDisplay}</TableCell>
                  <TableCell>{resource.lab}</TableCell>
                  <TableCell>{getResourceStatusBadge(resource.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      asChild
                      size="sm"
                      variant="default"
                      disabled={resource.status !== 'Available'}
                      className="h-8 text-xs"
                    >
                      <Link href={`/bookings?resourceId=${resource.id}${activeSelectedDate ? `&date=${format(activeSelectedDate, 'yyyy-MM-dd')}`: ''}`}>
                        <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                        Book
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              )})}
            </TableBody>
          </Table>
        </div>
      ) : (
         <Card className="text-center py-10 text-muted-foreground bg-card border-0 shadow-none">
          <CardContent>
            <ClipboardList className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">
                {activeFilterCount > 0 ? "No Resources Match Filters" : "No Resources Found"}
            </p>
            <p className="text-sm mb-4">
                {activeFilterCount > 0
                    ? "Try adjusting your search or filter criteria."
                    : (canAddResources ? "There are currently no resources in the catalog. Add one to get started!" : "There are currently no resources in the system.")
                }
            </p>
            {activeFilterCount > 0 ? (
                <Button variant="outline" onClick={resetAllActivePageFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
            ) : (
              !filteredResources.length && canAddResources && (
                <Button onClick={handleOpenNewDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First Resource
                </Button>
              )
            )}
          </CardContent>
        </Card>
      )}
      {isFormDialogOpen && fetchedResourceTypes.length >= 0 && ( 
        <ResourceFormDialog
            open={isFormDialogOpen}
            onOpenChange={(isOpen) => {
                setIsFormDialogOpen(isOpen);
                if (!isOpen) setEditingResource(null);
            }}
            initialResource={editingResource}
            onSave={handleSaveResource}
            resourceTypes={fetchedResourceTypes} 
        />
      )}
    </div>
  );
}
