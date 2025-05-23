
'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation'; // Added useRouter import
import { PageHeader } from '@/components/layout/page-header';
import {
  ClipboardList, PlusCircle, Filter as FilterIcon, FilterX, Search as SearchIcon, Calendar as CalendarIconLucide, Loader2, X, CalendarPlus // Added CalendarPlus
} from 'lucide-react';
import type { Resource, ResourceStatus, ResourceType } from '@/types';
import { labsList } from '@/lib/mock-data';
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
import { Calendar as ShadCNCalendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { ResourceFormDialog, ResourceFormValues } from '@/components/admin/resource-form-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfDay, isValid as isValidDateFn, parseISO, isWithinInterval, addDays as dateFnsAddDays } from 'date-fns'; // Removed Timestamp
import { cn, formatDateSafe, getResourceStatusBadge } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, query, orderBy, where } from 'firebase/firestore';


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

  const fetchResourcesAndTypes = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const resourcesQuery = query(collection(db, "resources"), orderBy("name", "asc"));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const fetchedResourcesPromises = resourcesSnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Resource',
          resourceTypeId: data.resourceTypeId || '',
          lab: data.lab as Resource['lab'] || (labsList.length > 0 ? labsList[0] : 'Unknown Lab'),
          status: data.status as ResourceStatus || 'Available',
          description: data.description || '',
          imageUrl: data.imageUrl || 'https://placehold.co/300x200.png',
          manufacturer: data.manufacturer,
          model: data.model,
          serialNumber: data.serialNumber,
          purchaseDate: data.purchaseDate instanceof Timestamp ? data.purchaseDate.toDate() : undefined,
          notes: data.notes,
          features: Array.isArray(data.features) ? data.features : [],
          remoteAccess: data.remoteAccess ? {
            ipAddress: data.remoteAccess.ipAddress,
            hostname: data.remoteAccess.hostname,
            protocol: data.remoteAccess.protocol,
            username: data.remoteAccess.username,
            port: data.remoteAccess.port,
            notes: data.remoteAccess.notes,
          } : undefined,
          allowQueueing: data.allowQueueing ?? false,
          availability: Array.isArray(data.availability) ? data.availability.map((a: any) => ({
            ...a,
            date: typeof a.date === 'string' ? a.date : (a.date instanceof Timestamp ? format(a.date.toDate(), 'yyyy-MM-dd') : undefined)
          })).filter(a => a.date) : [],
          unavailabilityPeriods: Array.isArray(data.unavailabilityPeriods) ? data.unavailabilityPeriods.map((p: any) => ({
            ...p,
            id: p.id || ('unavail-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9)),
            startDate: typeof p.startDate === 'string' ? p.startDate : (p.startDate instanceof Timestamp ? format(p.startDate.toDate(), 'yyyy-MM-dd') : undefined),
            endDate: typeof p.endDate === 'string' ? p.endDate : (p.endDate instanceof Timestamp ? format(p.endDate.toDate(), 'yyyy-MM-dd') : undefined),
            reason: p.reason
          })).filter(p => p.startDate && p.endDate) : [],
          lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate() : undefined,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
        } as Resource;
      });
      const fetchedResources = await Promise.all(fetchedResourcesPromises);
      setResources(fetchedResources);

      const typesQuery = query(collection(db, "resourceTypes"), orderBy("name", "asc"));
      const typesSnapshot = await getDocs(typesQuery);
      const rTypes: ResourceType[] = typesSnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...(docSnap.data() as Omit<ResourceType, 'id'>),
      }));
      setFetchedResourceTypes(rTypes);

    } catch (error: any) {
      console.error("Error fetching resources or types: ", error);
      toast({ title: "Database Error", description: `Failed to fetch data: ${error.message}`, variant: "destructive" });
      setResources([]);
      setFetchedResourceTypes([]);
    }
    setIsLoadingData(false);
  }, [toast]);


  useEffect(() => {
    fetchResourcesAndTypes();
  }, [fetchResourcesAndTypes]);

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
    return resources.filter(resource => {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      const nameMatch = resource.name.toLowerCase().includes(lowerSearchTerm);
      const descriptionMatch = resource.description && resource.description.toLowerCase().includes(lowerSearchTerm);
      const manufacturerMatch = resource.manufacturer && resource.manufacturer.toLowerCase().includes(lowerSearchTerm);
      const modelMatch = resource.model && resource.model.toLowerCase().includes(lowerSearchTerm);
      const searchMatch = nameMatch || descriptionMatch || manufacturerMatch || modelMatch;

      const typeMatch = activeFilterTypeId === 'all' || resource.resourceTypeId === activeFilterTypeId;
      const labMatch = activeFilterLab === 'all' || resource.lab === activeFilterLab;

      let dateMatch = true;
      if (activeSelectedDate) {
        if (resource.status !== 'Available') {
          dateMatch = false;
        } else {
          const dateToFilter = startOfDay(activeSelectedDate);
          const dateToFilterStr = format(dateToFilter, 'yyyy-MM-dd');
          
          const isSpecificallyUnavailableResource = resource.unavailabilityPeriods?.some(period => {
            if (!period.startDate || !period.endDate) return false;
            try {
              const periodStart = startOfDay(parseISO(period.startDate));
              const periodEnd = startOfDay(parseISO(period.endDate)); // End of day for comparison
              return isValidDateFn(periodStart) && isValidDateFn(periodEnd) &&
                     isWithinInterval(dateToFilter, { start: periodStart, end: periodEnd });
            } catch (e) { console.warn("Error parsing resource unavailability period dates:", e); return false; }
          });

          if (isSpecificallyUnavailableResource) {
            dateMatch = false;
          } else {
            const dayAvailability = resource.availability?.find(avail => avail.date === dateToFilterStr);
            dateMatch = !!(dayAvailability && Array.isArray(dayAvailability.slots) && dayAvailability.slots.length > 0);
          }
        }
      }
      return searchMatch && typeMatch && labMatch && dateMatch;
    });
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

  const handleOpenEditDialog = (resource: Resource) => {
    setEditingResource(resource);
    setIsFormDialogOpen(true);
  };
  
  const handleSaveResource = async (data: ResourceFormValues, resourceIdToUpdate?: string) => {
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Lab Manager')) {
      toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }
    
    const resourceType = fetchedResourceTypes.find(rt => rt.id === data.resourceTypeId);
    if (!resourceType) {
      toast({ title: "Invalid Resource Type", description: "Selected resource type is not valid.", variant: "destructive" });
      return;
    }
    
    const purchaseTimestamp = data.purchaseDate && isValidDateFn(parseISO(data.purchaseDate)) ? Timestamp.fromDate(parseISO(data.purchaseDate)) : null;

    const resourceDataForFirestore: Omit<Resource, 'id' | 'availability' | 'unavailabilityPeriods' | 'createdAt' | 'lastUpdatedAt' | 'purchaseDate'> & { purchaseDate?: Timestamp | null, createdAt?: Timestamp, lastUpdatedAt?: Timestamp } = {
      name: data.name,
      resourceTypeId: data.resourceTypeId,
      lab: data.lab,
      status: data.status,
      description: data.description || '',
      imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
      manufacturer: data.manufacturer || undefined,
      model: data.model || undefined,
      serialNumber: data.serialNumber || undefined,
      purchaseDate: purchaseTimestamp,
      notes: data.notes || undefined,
      features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
      remoteAccess: data.remoteAccess && Object.values(data.remoteAccess).some(v => v || typeof v === 'number') ? {
         ipAddress: data.remoteAccess.ipAddress || undefined,
         hostname: data.remoteAccess.hostname || undefined,
         protocol: data.remoteAccess.protocol || '',
         username: data.remoteAccess.username || undefined,
         port: data.remoteAccess.port ?? undefined,
         notes: data.remoteAccess.notes || undefined,
      } : undefined,
      allowQueueing: data.allowQueueing ?? false,
    };
    
    const cleanDbData = Object.fromEntries(Object.entries(resourceDataForFirestore).filter(([_, v]) => v !== undefined));


    const auditAction = editingResource ? 'RESOURCE_UPDATED' : 'RESOURCE_CREATED';
    const auditDetails = `Resource '${data.name}' ${editingResource ? 'updated' : 'created'}.`;

    setIsLoadingData(true);
    try {
      if (editingResource) {
        const resourceDocRef = doc(db, "resources", editingResource.id);
        const existingDocSnap = await getDoc(resourceDocRef);
        const existingData = existingDocSnap.data();

        const dataWithExistingSchedules = {
            ...cleanDbData,
            lastUpdatedAt: serverTimestamp(),
            // Preserve schedules unless managed by a separate mechanism on this form
            availability: existingData?.availability || [], 
            unavailabilityPeriods: existingData?.unavailabilityPeriods || [],
        };
        await updateDoc(resourceDocRef, dataWithExistingSchedules);
        addAuditLog(currentUser.id, currentUser.name || 'User', auditAction, { entityType: 'Resource', entityId: editingResource.id, details: auditDetails });
        toast({ title: 'Resource Updated', description: `Resource "${data.name}" has been updated.` });
      } else {
        const dataForNewResource = {
            ...cleanDbData,
            createdAt: serverTimestamp(),
            lastUpdatedAt: serverTimestamp(),
            availability: [], 
            unavailabilityPeriods: [], 
        };
        const docRef = await addDoc(collection(db, "resources"), dataForNewResource);
        addAuditLog(currentUser.id, currentUser.name || 'User', auditAction, { entityType: 'Resource', entityId: docRef.id, details: auditDetails });
        toast({ title: 'Resource Created', description: `Resource "${data.name}" has been created.` });
      }
      setIsFormDialogOpen(false);
      setEditingResource(null);
      await fetchResourcesAndTypes(); // Refetch all data
    } catch (error: any) {
        console.error(`Error ${editingResource ? 'updating' : 'creating'} resource:`, error);
        toast({ title: "Database Error", description: `Failed to ${editingResource ? 'update' : 'create'} resource: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  };

   const handleDeleteResource = async (resourceToDelete: Resource) => {
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Lab Manager')) {
      toast({ title: "Permission Denied", description: "You are not authorized to delete resources.", variant: "destructive" });
      return;
    }
    setIsLoadingData(true);
    try {
      await deleteDoc(doc(db, "resources", resourceToDelete.id));
      addAuditLog(currentUser.id, currentUser.name || 'User', 'RESOURCE_DELETED', { entityType: 'Resource', entityId: resourceToDelete.id, details: `Resource '${resourceToDelete.name}' deleted.`});
      toast({ title: "Resource Deleted", description: `Resource "${resourceToDelete.name}" has been removed.`, variant: "destructive" });
      await fetchResourcesAndTypes(); // Refresh the list
    } catch (error: any) {
      console.error("Error deleting resource:", error);
      toast({ title: "Delete Failed", description: `Could not delete resource: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  };


  const activeFilterCount = useMemo(() => [
    activeSearchTerm !== '',
    activeFilterTypeId !== 'all',
    activeFilterLab !== 'all',
    activeSelectedDate !== undefined
  ].filter(Boolean).length, [activeSearchTerm, activeFilterTypeId, activeFilterLab, activeSelectedDate]);

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
              <DialogContent className="w-full max-w-lg">
                <DialogHeader>
                  <DialogTitle>Filter Resources</DialogTitle>
                  <DialogDescription>
                    Refine the list of available lab resources.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <ScrollArea className="max-h-[65vh] overflow-y-auto pr-2">
                  <div className="space-y-6 py-1 px-1">
                    <div>
                      <Label htmlFor="resourceSearchDialog">Search (Name/Keyword)</Label>
                      <div className="relative mt-1">
                          <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                          id="resourceSearchDialog"
                          type="search"
                          placeholder="Name, manufacturer, model..."
                          value={tempSearchTerm}
                          onChange={(e) => setTempSearchTerm(e.target.value)}
                          className="h-9 pl-8"
                          />
                      </div>
                    </div>
                    <Separator />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="resourceTypeFilterDialog">Type</Label>
                        <Select value={tempFilterTypeId} onValueChange={setTempFilterTypeId}>
                          <SelectTrigger id="resourceTypeFilterDialog" className="h-9 mt-1"><SelectValue placeholder="Filter by Type" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {fetchedResourceTypes.map(type => (
                              <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="resourceLabFilterDialog">Lab</Label>
                        <Select value={tempFilterLab} onValueChange={setTempFilterLab}>
                          <SelectTrigger id="resourceLabFilterDialog" className="h-9 mt-1"><SelectValue placeholder="Filter by Lab" /></SelectTrigger>
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
                        <Label className="mb-2 block">Available On</Label>
                        <div className="flex justify-center items-center rounded-md border p-2">
                          <ShadCNCalendar
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
                                      onClick={() => { setTempSelectedDate(undefined); setCurrentMonthInDialog(startOfDay(new Date()));} }
                                      className="w-full mt-2 text-xs"
                                  >
                                      <FilterX className="mr-2 h-4 w-4" /> Reset Date Filter
                                  </Button>
                              }
                              classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }}
                          />
                        </div>
                    </div>
                  </div>
                </ScrollArea>
                <DialogFooter className="pt-6 border-t mt-4">
                   <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button>
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
        <div className="flex justify-center items-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /> Loading resources...</div>
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
         <Card className="text-center py-10 text-muted-foreground border-0 shadow-none">
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
              !isLoadingData && resources.length === 0 && canAddResources && (
                <Button onClick={handleOpenNewDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First Resource
                </Button>
              )
            )}
          </CardContent>
        </Card>
      )}
      {isFormDialogOpen && (
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
