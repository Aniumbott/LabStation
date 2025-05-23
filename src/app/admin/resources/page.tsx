
'use client';

import React, {
  useState,
  useMemo,
  useEffect,
  useCallback
} from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ClipboardList,
  PlusCircle,
  Filter as FilterIcon,
  FilterX,
  Search as SearchIcon,
  Loader2,
  X,
  CalendarPlus,
  Calendar as CalendarIconLucide, // Renamed for clarity against ShadCN Calendar
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import type { Resource, ResourceStatus, ResourceType } from '@/types';
import { labsList } from '@/lib/mock-data'; // Keep static lists
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
import { Calendar as ShadCNCalendar } from '@/components/ui/calendar'; // Renamed to avoid conflict
import { useToast } from '@/hooks/use-toast';
import { ResourceFormDialog, ResourceFormValues } from '@/components/admin/resource-form-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfDay, isValid as isValidDateFn, parseISO, isWithinInterval } from 'date-fns';
import { cn, formatDateSafe, getResourceStatusBadge } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp, query, orderBy, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';


export default function AdminResourcesPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const router = useRouter();

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
        
        let typeName = 'N/A';
        if (data.resourceTypeId) {
          try {
            const typeDocRef = doc(db, "resourceTypes", data.resourceTypeId);
            const typeSnap = await getDoc(typeDocRef);
            if (typeSnap.exists()) {
              typeName = typeSnap.data()?.name || 'N/A (Unnamed Type)';
            } else {
              console.warn(`Resource type with ID ${data.resourceTypeId} not found for resource ${docSnap.id}.`);
            }
          } catch (typeError) {
            console.error(`Error fetching resource type for resource ${docSnap.id}:`, typeError);
            typeName = 'Error Loading Type';
          }
        }

        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Resource',
          resourceTypeId: data.resourceTypeId || '',
          lab: data.lab || (labsList.length > 0 ? labsList[0] : 'Electronics Lab 1'),
          status: data.status || 'Available',
          description: data.description || '',
          imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
          manufacturer: data.manufacturer || undefined,
          model: data.model || undefined,
          serialNumber: data.serialNumber || undefined,
          purchaseDate: data.purchaseDate instanceof Timestamp ? data.purchaseDate.toDate() : undefined,
          notes: data.notes || undefined,
          features: Array.isArray(data.features) ? data.features : [],
          remoteAccess: data.remoteAccess ? {
            ipAddress: data.remoteAccess.ipAddress || undefined,
            hostname: data.remoteAccess.hostname || undefined,
            protocol: data.remoteAccess.protocol || '',
            username: data.remoteAccess.username || undefined,
            port: data.remoteAccess.port ?? undefined,
            notes: data.remoteAccess.notes || undefined,
          } : undefined,
          allowQueueing: data.allowQueueing ?? false,
          availability: Array.isArray(data.availability) ? data.availability.map((a: any) => ({...a, date: typeof a.date === 'string' ? a.date : (a.date instanceof Timestamp ? format(a.date.toDate(), 'yyyy-MM-dd') : (a.date instanceof Date ? format(a.date, 'yyyy-MM-dd') : a.date)) })) : [],
          unavailabilityPeriods: Array.isArray(data.unavailabilityPeriods) ? data.unavailabilityPeriods.map((p: any) => ({...p, id: p.id || ('unavail-' + Date.now() + '-' + Math.random().toString(36).substring(2,9)), startDate: typeof p.startDate === 'string' ? p.startDate : (p.startDate instanceof Timestamp ? format(p.startDate.toDate(), 'yyyy-MM-dd') : (p.startDate instanceof Date ? format(p.startDate, 'yyyy-MM-dd') : p.startDate)), endDate: typeof p.endDate === 'string' ? p.endDate : (p.endDate instanceof Timestamp ? format(p.endDate.toDate(), 'yyyy-MM-dd') : (p.endDate instanceof Date ? format(p.endDate, 'yyyy-MM-dd') : p.endDate)), reason: p.reason })) : [],
          lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate() : undefined,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
        } as Resource;
      });
      const fetchedResources = await Promise.all(fetchedResourcesPromises);
      setResources(fetchedResources);

      const typesQueryInstance = query(collection(db, "resourceTypes"), orderBy("name", "asc"));
      const typesSnapshot = await getDocs(typesQueryInstance);
      const rTypes: ResourceType[] = typesSnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        name: docSnap.data().name || 'Unnamed Type',
        description: docSnap.data().description || '',
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
    return resources.map(resource => { // First map to ensure resourceTypeName is present
      const type = fetchedResourceTypes.find(rt => rt.id === resource.resourceTypeId);
      return { ...resource, resourceTypeName: type?.name || 'N/A' };
    }).filter(resource => {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      const searchMatch = !activeSearchTerm ||
        resource.name.toLowerCase().includes(lowerSearchTerm) ||
        (resource.description && resource.description.toLowerCase().includes(lowerSearchTerm)) ||
        (resource.manufacturer && resource.manufacturer.toLowerCase().includes(lowerSearchTerm)) ||
        (resource.model && resource.model.toLowerCase().includes(lowerSearchTerm)) ||
        (resource.resourceTypeName && resource.resourceTypeName.toLowerCase().includes(lowerSearchTerm));

      const typeMatch = activeFilterTypeId === 'all' || resource.resourceTypeId === activeFilterTypeId;
      const labMatch = activeFilterLab === 'all' || resource.lab === activeFilterLab;

      let dateMatch = true;
      if (activeSelectedDate) {
        const dateToFilter = startOfDay(activeSelectedDate);
        const dateToFilterStr = format(dateToFilter, 'yyyy-MM-dd');

        const isUnavailabilityOverlap = resource.unavailabilityPeriods?.some(period => {
            if (!period.startDate || !period.endDate) return false;
            try {
                const periodStart = startOfDay(parseISO(period.startDate));
                const periodEnd = startOfDay(parseISO(period.endDate)); // end date is inclusive
                return isValidDateFn(periodStart) && isValidDateFn(periodEnd) &&
                       isWithinInterval(dateToFilter, { start: periodStart, end: periodEnd });
            } catch (e) { console.warn("Error parsing unavailability period dates for filter:", e); return false; }
        });

        if (isUnavailabilityOverlap) {
            dateMatch = false;
        } else {
            const dayAvailability = resource.availability?.find(avail => avail.date === dateToFilterStr);
            dateMatch = !!(dayAvailability && Array.isArray(dayAvailability.slots) && dayAvailability.slots.length > 0 && resource.status === 'Available');
        }
      }
      return searchMatch && typeMatch && labMatch && dateMatch;
    });
  }, [resources, fetchedResourceTypes, activeSearchTerm, activeFilterTypeId, activeFilterLab, activeSelectedDate]);


  const handleApplyDialogFilters = useCallback(() => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterTypeId(tempFilterTypeId);
    setActiveFilterLab(tempFilterLab);
    setActiveSelectedDate(tempSelectedDate);
    setIsFilterDialogOpen(false);
  }, [tempSearchTerm, tempFilterTypeId, tempFilterLab, tempSelectedDate]);

  const resetDialogFiltersOnly = useCallback(() => {
    setTempSearchTerm('');
    setTempFilterTypeId('all');
    setTempFilterLab('all');
    setTempSelectedDate(undefined);
    setCurrentMonthInDialog(startOfDay(new Date()));
  }, []);

  const resetAllActivePageFilters = useCallback(() => {
    setActiveSearchTerm('');
    setActiveFilterTypeId('all');
    setActiveFilterLab('all');
    setActiveSelectedDate(undefined);
    resetDialogFiltersOnly();
    setIsFilterDialogOpen(false);
  }, [resetDialogFiltersOnly]);

  const handleOpenNewDialog = useCallback(() => {
    if (fetchedResourceTypes.length === 0) {
        toast({
            title: "No Resource Types Defined",
            description: "Please add resource types first before adding resources.",
            variant: "destructive",
        });
        router.push('/admin/resource-types'); // Redirect to resource types page
        return;
    }
    setEditingResource(null);
    setIsFormDialogOpen(true);
  }, [fetchedResourceTypes, toast, router]);

  const handleOpenEditDialog = (resource: Resource) => {
    setEditingResource(resource);
    setIsFormDialogOpen(true);
  };


  const handleSaveResource = useCallback(async (data: ResourceFormValues) => {
    if (!currentUser || (currentUser.role !== 'Admin' && currentUser.role !== 'Lab Manager')) {
      toast({ title: "Permission Denied", description: "You are not authorized to perform this action.", variant: "destructive" });
      return;
    }

    const resourceType = fetchedResourceTypes.find(rt => rt.id === data.resourceTypeId);
    if (!resourceType) {
      toast({ title: "Invalid Resource Type", description: "Selected resource type is not valid.", variant: "destructive" });
      return;
    }

    const purchaseDateForFirestore: Timestamp | null = data.purchaseDate && isValidDateFn(parseISO(data.purchaseDate))
                                        ? Timestamp.fromDate(parseISO(data.purchaseDate))
                                        : null;

    const remoteAccessDataForFirestore = data.remoteAccess
      ? {
          ipAddress: data.remoteAccess.ipAddress || null,
          hostname: data.remoteAccess.hostname || null,
          protocol: data.remoteAccess.protocol || '',
          username: data.remoteAccess.username || null,
          port: data.remoteAccess.port ?? null, 
          notes: data.remoteAccess.notes || null,
        }
      : undefined;
    
    // Explicitly remove undefined sub-fields or set to null for Firestore
    if (remoteAccessDataForFirestore) {
        Object.keys(remoteAccessDataForFirestore).forEach((key) => {
            if ((remoteAccessDataForFirestore as any)[key] === undefined) {
                (remoteAccessDataForFirestore as any)[key] = null;
            }
        });
        const ra = remoteAccessDataForFirestore;
        const allEffectivelyNull = !ra.ipAddress && !ra.hostname && !ra.protocol && !ra.username && ra.port === null && !ra.notes;
        if (allEffectivelyNull && !Object.values(ra).some(v => v !== null && v !== '')) { // Check if all are actually null or empty string
           // remoteAccessDataForFirestore = undefined; // This line was problematic, Firestore expects an object or null, not undefined field value
        }
    }


    const firestorePayload: any = {
      name: data.name,
      resourceTypeId: data.resourceTypeId,
      lab: data.lab,
      status: data.status,
      description: data.description || '',
      imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      serialNumber: data.serialNumber || null,
      purchaseDate: purchaseDateForFirestore,
      notes: data.notes || null,
      features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
      remoteAccess: remoteAccessDataForFirestore || null, // Save null if remoteAccessData is undefined
      allowQueueing: data.allowQueueing ?? false, 
      lastUpdatedAt: serverTimestamp(),
    };
    
    Object.keys(firestorePayload).forEach(key => { // Ensure top-level undefined fields are converted to null for updateDoc.
        if (firestorePayload[key] === undefined && key !== 'remoteAccess') { // remoteAccess handled above
            firestorePayload[key] = null;
        }
    });


    const isEditing = !!editingResource;
    const auditAction = isEditing ? 'RESOURCE_UPDATED' : 'RESOURCE_CREATED';
    const auditDetails = `Resource '${data.name}' ${isEditing ? 'updated' : 'created'}.`;

    setIsLoadingData(true);
    try {
      if (isEditing && editingResource.id) {
        const resourceDocRef = doc(db, "resources", editingResource.id);
        await updateDoc(resourceDocRef, firestorePayload);
        addAuditLog(currentUser.id, currentUser.name || 'User', auditAction, { entityType: 'Resource', entityId: editingResource.id, details: auditDetails });
        toast({ title: 'Resource Updated', description: `Resource "${data.name}" has been updated.` });
      } else {
        const newResourceData = {
            ...firestorePayload,
            createdAt: serverTimestamp(),
            availability: [], // Initialize with empty availability
            unavailabilityPeriods: [], // Initialize with empty unavailability
        };
        // Remove lastUpdatedAt for new doc, createdAt will be used
        delete newResourceData.lastUpdatedAt;
        const docRef = await addDoc(collection(db, "resources"), newResourceData);
        addAuditLog(currentUser.id, currentUser.name || 'User', auditAction, { entityType: 'Resource', entityId: docRef.id, details: auditDetails });
        toast({ title: 'Resource Created', description: `Resource "${data.name}" has been created.` });
      }
      setIsFormDialogOpen(false);
      setEditingResource(null);
      await fetchResourcesAndTypes();
    } catch (error: any) {
        console.error(`Error ${isEditing ? 'updating' : 'creating'} resource:`, error);
        toast({ title: "Database Error", description: `Failed to ${isEditing ? 'update' : 'create'} resource: ${error.message}`, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser, editingResource, fetchedResourceTypes, fetchResourcesAndTypes, toast, addAuditLog]);


  const activeFilterCount = useMemo(() => [
    activeSearchTerm !== '',
    activeFilterTypeId !== 'all',
    activeFilterLab !== 'all',
    activeSelectedDate !== undefined
  ].filter(Boolean).length, [activeSearchTerm, activeFilterTypeId, activeFilterLab, activeSelectedDate]);

  const canAddResources = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Lab Manager');

  if (!currentUser) { // Should be handled by AppLayout, but as a safeguard
    return (
      <div className="space-y-8">
        <PageHeader title="Resources" icon={ClipboardList} description="Access Denied." />
        <Card className="text-center py-10 text-muted-foreground">
          <CardContent>
            <p>You do not have permission to view or manage resources. Please log in.</p>
            <Button onClick={() => router.push('/login')} className="mt-4">Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  return (
    <div className="space-y-8">
      <PageHeader
        title="Resources"
        description="Browse, filter, and manage all lab resources. Click resource name for details."
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
                          placeholder="Name, manufacturer, model, type..."
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
                        <Select value={tempFilterTypeId} onValueChange={setTempFilterTypeId} disabled={fetchedResourceTypes.length === 0}>
                          <SelectTrigger id="resourceTypeFilterDialog" className="h-9 mt-1"><SelectValue placeholder={fetchedResourceTypes.length > 0 ? "Filter by Type" : "No types available"} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All Types</SelectItem>
                            {fetchedResourceTypes.map(type => (
                              <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                         {fetchedResourceTypes.length === 0 && <p className="text-xs text-muted-foreground mt-1">No resource types found. Add types in Admin &gt; Resource Types.</p>}
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
                        <Label className="mb-2 block">Available On (Optional)</Label>
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
                <DialogFooter className="pt-6 border-t mt-4 flex-col sm:flex-row">
                   <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto order-1 sm:order-none">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <div className="flex justify-end gap-2 order-none sm:order-1">
                    <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button>
                    <Button onClick={handleApplyDialogFilters}>Apply Filters</Button>
                  </div>
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

      {isLoadingData && resources.length === 0 ? (
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
                <TableHead className="text-right w-[100px]">Actions</TableHead>
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
                  <TableCell>{resource.resourceTypeName || 'N/A'}</TableCell>
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
              ))}
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
                    ? "Try adjusting your filter or search criteria."
                    : (canAddResources ? "There are currently no resources in the catalog. Add one to get started!" : "There are currently no resources in the system.")
                }
            </p>
            {activeFilterCount > 0 ? (
                <Button variant="outline" onClick={resetAllActivePageFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
            ): (
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

    