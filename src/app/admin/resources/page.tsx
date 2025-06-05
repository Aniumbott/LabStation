
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
import { Package, PlusCircle, Filter as FilterIcon, FilterX, Search as SearchIcon, Calendar as CalendarIconLucide, Loader2, CheckCircle2, Building, ListChecks, Edit, Trash2 } from 'lucide-react';
import type { Resource, ResourceStatus, ResourceType, Lab, LabMembership } from '@/types';
import { resourceStatusesList } from '@/lib/app-constants';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
}from "@/components/ui/alert-dialog";
import { Calendar as ShadCNCalendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { ResourceFormDialog, ResourceFormValues } from '@/components/admin/resource-form-dialog';
import { ResourceTypeFormDialog, ResourceTypeFormValues } from '@/components/admin/resource-type-form-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfDay, isValid as isValidDateFn, parseISO, isWithinInterval, Timestamp as FirestoreTimestamp } from 'date-fns';
import { cn, formatDateSafe, getResourceStatusBadge } from '@/lib/utils';
import { db } from '@/lib/firebase';
import {
  collection,
  getDocs,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  query,
  orderBy,
  where,
  Timestamp
} from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { addAuditLog } from '@/lib/firestore-helpers';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';


type ResourceTypeSortableColumn = 'name' | 'resourceCount' | 'description';
const resourceTypeSortOptions: { value: string; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' }, { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'resourceCount-asc', label: 'Resources (Low-High)' }, { value: 'resourceCount-desc', label: 'Resources (High-Low)' },
];


export default function AdminResourcesPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const router = useRouter();

  const [allResourcesDataSource, setAllResourcesDataSource] = useState<Resource[]>([]);
  const [fetchedResourceTypes, setFetchedResourceTypes] = useState<ResourceType[]>([]);
  const [fetchedLabs, setFetchedLabs] = useState<Lab[]>([]);
  const [userLabMemberships, setUserLabMemberships] = useState<LabMembership[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState("resources");

  const [isResourceFormDialogOpen, setIsResourceFormDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  const [isResourceFilterDialogOpen, setIsResourceFilterDialogOpen] = useState(false);
  const [tempResourceSearchTerm, setTempResourceSearchTerm] = useState('');
  const [tempResourceFilterTypeId, setTempResourceFilterTypeId] = useState<string>('all');
  const [tempResourceFilterLabId, setTempResourceFilterLabId] = useState<string>('all');
  const [tempResourceSelectedDate, setTempResourceSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonthInResourceDialog, setCurrentMonthInResourceDialog] = useState<Date>(startOfDay(new Date()));

  const [activeResourceSearchTerm, setActiveResourceSearchTerm] = useState('');
  const [activeResourceFilterTypeId, setActiveResourceFilterTypeId] = useState<string>('all');
  const [activeResourceFilterLabId, setActiveResourceFilterLabId] = useState<string>('all');
  const [activeResourceSelectedDate, setActiveResourceSelectedDate] = useState<Date | undefined>(undefined);

  const [typeToDelete, setTypeToDelete] = useState<ResourceType | null>(null);
  const [isResourceTypeFormDialogOpen, setIsResourceTypeFormDialogOpen] = useState(false);
  const [editingResourceType, setEditingResourceType] = useState<ResourceType | null>(null);
  const [isResourceTypeFilterSortDialogOpen, setIsResourceTypeFilterSortDialogOpen] = useState(false);
  const [tempResourceTypeSearchTerm, setTempResourceTypeSearchTerm] = useState('');
  const [activeResourceTypeSearchTerm, setActiveResourceTypeSearchTerm] = useState('');
  const [tempResourceTypeSortBy, setTempResourceTypeSortBy] = useState<string>('name-asc');
  const [activeResourceTypeSortBy, setActiveResourceTypeSortBy] = useState<string>('name-asc');


  const canManageResourcesAndTypes = useMemo(() => currentUser && currentUser.role === 'Admin', [currentUser]);

  const fetchInitialData = useCallback(async () => {
    setIsLoadingData(true);
    try {
      const labsQueryInstance = query(collection(db, "labs"), orderBy("name", "asc"));
      const labsSnapshot = await getDocs(labsQueryInstance);
      const rLabs: Lab[] = labsSnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        name: docSnap.data().name || 'Unnamed Lab',
        location: docSnap.data().location,
        description: docSnap.data().description,
      }));
      setFetchedLabs(rLabs);

      let activeUserLabIds: string[] = [];
      if (currentUser && currentUser.id && currentUser.role !== 'Admin') {
        const membershipsQuery = query(collection(db, 'labMemberships'), where('userId', '==', currentUser.id), where('status', '==', 'active'));
        const membershipsSnapshot = await getDocs(membershipsQuery);
        const memberships = membershipsSnapshot.docs.map(mDoc => mDoc.data() as LabMembership);
        setUserLabMemberships(memberships);
        activeUserLabIds = memberships.map(m => m.labId);
      }

      const resourcesQuery = query(collection(db, "resources"), orderBy("name", "asc"));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const fetchedResourcesPromises = resourcesSnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Resource',
          resourceTypeId: data.resourceTypeId || '',
          labId: data.labId || '',
          status: data.status || 'Working',
          description: data.description || '',
          imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
          manufacturer: data.manufacturer,
          model: data.model,
          serialNumber: data.serialNumber,
          purchaseDate: data.purchaseDate instanceof Timestamp ? data.purchaseDate.toDate() : undefined,
          notes: data.notes,
          features: Array.isArray(data.features) ? data.features : [],
          remoteAccess: data.remoteAccess ? {
            ipAddress: data.remoteAccess.ipAddress,
            hostname: data.remoteAccess.hostname,
            protocol: data.remoteAccess.protocol || '',
            username: data.remoteAccess.username,
            port: data.remoteAccess.port ?? undefined,
            notes: data.remoteAccess.notes,
          } : undefined,
          allowQueueing: data.allowQueueing ?? false,
          unavailabilityPeriods: Array.isArray(data.unavailabilityPeriods) ? data.unavailabilityPeriods.map((p: any) => ({...p, id: p.id || ('unavail-' + Date.now() + '-' + Math.random().toString(36).substring(2,9)), startDate: p.startDate, endDate: p.endDate, reason: p.reason })) : [],
          lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate() : undefined,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
        } as Resource;
      });
      let fetchedResources = await Promise.all(fetchedResourcesPromises);

      if (currentUser && currentUser.role !== 'Admin') {
        fetchedResources = fetchedResources.filter(resource => activeUserLabIds.includes(resource.labId) || !resource.labId);
      }
      setAllResourcesDataSource(fetchedResources);

      const typesQueryInstance = query(collection(db, "resourceTypes"), orderBy("name", "asc"));
      const typesSnapshot = await getDocs(typesQueryInstance);
      const rTypes: ResourceType[] = typesSnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        name: docSnap.data().name || 'Unnamed Type',
        description: docSnap.data().description || '',
      }));
      setFetchedResourceTypes(rTypes);

    } catch (error: any) {
      toast({ title: "Data Load Error", description: `Failed to load initial data: ${error.message}`, variant: "destructive" });
      setAllResourcesDataSource([]);
      setFetchedResourceTypes([]);
      setFetchedLabs([]);
      setUserLabMemberships([]);
    }
    setIsLoadingData(false);
  }, [currentUser, toast]);


  useEffect(() => {
    if (currentUser) {
        fetchInitialData();
    }
  }, [fetchInitialData, currentUser]);

  useEffect(() => {
    if (isResourceFilterDialogOpen) {
      setTempResourceSearchTerm(activeResourceSearchTerm);
      setTempResourceFilterTypeId(activeResourceFilterTypeId);
      setTempResourceFilterLabId(activeResourceFilterLabId);
      setTempResourceSelectedDate(activeResourceSelectedDate);
      setCurrentMonthInResourceDialog(activeResourceSelectedDate || startOfDay(new Date()));
    }
  }, [isResourceFilterDialogOpen, activeResourceSearchTerm, activeResourceFilterTypeId, activeResourceFilterLabId, activeResourceSelectedDate]);

  const filteredResources = useMemo(() => {
    return allResourcesDataSource.map(resource => {
      const type = fetchedResourceTypes.find(rt => rt.id === resource.resourceTypeId);
      const lab = fetchedLabs.find(l => l.id === resource.labId);
      return { ...resource, resourceTypeName: type?.name || 'N/A', labName: lab?.name || (resource.labId ? 'Unknown Lab' : 'Global/No Lab') };
    }).filter(resource => {
      const lowerSearchTerm = activeResourceSearchTerm.toLowerCase();
      const searchMatch = !activeResourceSearchTerm ||
        resource.name.toLowerCase().includes(lowerSearchTerm) ||
        (resource.description && resource.description.toLowerCase().includes(lowerSearchTerm)) ||
        (resource.manufacturer && resource.manufacturer.toLowerCase().includes(lowerSearchTerm)) ||
        (resource.model && resource.model.toLowerCase().includes(lowerSearchTerm)) ||
        (resource.resourceTypeName && resource.resourceTypeName.toLowerCase().includes(lowerSearchTerm)) ||
        (resource.labName && resource.labName.toLowerCase().includes(lowerSearchTerm));

      const typeMatch = activeResourceFilterTypeId === 'all' || resource.resourceTypeId === activeResourceFilterTypeId;
      let labMatch = activeResourceFilterLabId === 'all' || resource.labId === activeResourceFilterLabId;
      if (activeResourceFilterLabId === '--global--') {
        labMatch = !resource.labId;
      }


      let dateMatch = true;
      if (activeResourceSelectedDate) {
        const dateToFilter = startOfDay(activeResourceSelectedDate);
        const isUnavailabilityOverlap = resource.unavailabilityPeriods?.some(period => {
            if (!period.startDate || !period.endDate) return false;
            try {
                const periodStart = startOfDay(parseISO(period.startDate));
                const periodEnd = startOfDay(parseISO(period.endDate));
                return isValidDateFn(periodStart) && isValidDateFn(periodEnd) &&
                       isWithinInterval(dateToFilter, { start: periodStart, end: periodEnd });
            } catch (e) { return false; }
        });

        if (isUnavailabilityOverlap) {
            dateMatch = false;
        } else {
            dateMatch = resource.status === 'Working';
        }
      }
      return searchMatch && typeMatch && labMatch && dateMatch;
    });
  }, [allResourcesDataSource, fetchedResourceTypes, fetchedLabs, activeResourceSearchTerm, activeResourceFilterTypeId, activeResourceFilterLabId, activeResourceSelectedDate]);


  const handleApplyResourceDialogFilters = useCallback(() => {
    setActiveResourceSearchTerm(tempResourceSearchTerm);
    setActiveResourceFilterTypeId(tempResourceFilterTypeId);
    setActiveResourceFilterLabId(tempResourceFilterLabId);
    setActiveResourceSelectedDate(tempResourceSelectedDate);
    setIsResourceFilterDialogOpen(false);
  }, [tempResourceSearchTerm, tempResourceFilterTypeId, tempResourceFilterLabId, tempResourceSelectedDate]);

  const resetResourceDialogFiltersOnly = useCallback(() => {
    setTempResourceSearchTerm('');
    setTempResourceFilterTypeId('all');
    setTempResourceFilterLabId('all');
    setTempResourceSelectedDate(undefined);
    setCurrentMonthInResourceDialog(startOfDay(new Date()));
  }, []);

  const resetAllActiveResourcePageFilters = useCallback(() => {
    setActiveResourceSearchTerm('');
    setActiveResourceFilterTypeId('all');
    setActiveResourceFilterLabId('all');
    setActiveResourceSelectedDate(undefined);
    resetResourceDialogFiltersOnly();
    setIsResourceFilterDialogOpen(false);
  }, [resetResourceDialogFiltersOnly]);

  const handleOpenNewResourceDialog = useCallback(() => {
    if (fetchedResourceTypes.length === 0 && canManageResourcesAndTypes) {
        toast({ title: "No Resource Types Defined", description: "Please add resource types before adding a resource.", variant: "destructive" });
        setActiveTab("types");
        return;
    }
    if (fetchedLabs.length === 0 && canManageResourcesAndTypes) {
        toast({ title: "No Labs Defined", description: "Please add labs in Lab Operations before adding a resource.", variant: "destructive" });
        router.push('/admin/lab-management-v2?tab=labs');
        return;
    }
    setEditingResource(null);
    setIsResourceFormDialogOpen(true);
  }, [fetchedResourceTypes, fetchedLabs, toast, router, canManageResourcesAndTypes]);


  const handleSaveResource = useCallback(async (data: ResourceFormValues) => {
    if (!currentUser || !canManageResourcesAndTypes) {
      toast({ title: "Permission Denied", description: "You are not authorized.", variant: "destructive" });
      setIsResourceFormDialogOpen(false);
      return;
    }

    const resourceType = fetchedResourceTypes.find(rt => rt.id === data.resourceTypeId);
    if (!resourceType) {
      toast({ title: "Invalid Resource Type", variant: "destructive" }); return;
    }
    const labIdForSave = data.labId === '--global--' ? '' : data.labId;
    const lab = fetchedLabs.find(l => l.id === labIdForSave);
     if (labIdForSave !== '' && !lab) {
      toast({ title: "Invalid Lab Selected", variant: "destructive" }); return;
    }


    let purchaseDateForFirestore: Timestamp | null = null;
    if (data.purchaseDate && isValidDateFn(parseISO(data.purchaseDate))) {
        purchaseDateForFirestore = Timestamp.fromDate(parseISO(data.purchaseDate));
    } else if (data.purchaseDate === '' || data.purchaseDate === undefined) {
        purchaseDateForFirestore = null;
    }

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

    const firestorePayload: any = {
      name: data.name,
      resourceTypeId: data.resourceTypeId,
      labId: labIdForSave,
      status: data.status,
      description: data.description || '',
      imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      serialNumber: data.serialNumber || null,
      purchaseDate: purchaseDateForFirestore,
      notes: data.notes || null,
      features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
      remoteAccess: remoteAccessDataForFirestore,
      allowQueueing: data.allowQueueing ?? editingResource?.allowQueueing ?? false,
      lastUpdatedAt: serverTimestamp(),
    };

    Object.keys(firestorePayload).forEach(key => {
        if (firestorePayload[key] === undefined && key !== 'remoteAccess' && key !== 'allowQueueing') {
            firestorePayload[key] = null;
        }
    });
    if (firestorePayload.remoteAccess) {
        Object.keys(firestorePayload.remoteAccess).forEach((key) => {
            if ((firestorePayload.remoteAccess as any)[key] === undefined) {
                 (firestorePayload.remoteAccess as any)[key] = null;
            }
        });
        const ra = firestorePayload.remoteAccess;
        const allRemoteAccessEffectivelyNull = !ra.ipAddress && !ra.hostname && !ra.protocol && !ra.username && (ra.port === undefined || ra.port === null) && !ra.notes;
        if (allRemoteAccessEffectivelyNull) {
            firestorePayload.remoteAccess = undefined;
        }
    }

    const isEditing = !!editingResource;
    const auditAction = isEditing ? 'RESOURCE_UPDATED' : 'RESOURCE_CREATED';
    const labNameForAudit = labIdForSave === '' ? 'Global/No Lab' : (lab?.name || 'Unknown Lab');
    const auditDetails = `Resource '${data.name}' ${isEditing ? 'updated' : 'created'} by ${currentUser.name}. Status: ${data.status}, Lab: ${labNameForAudit}.`;

    setIsLoadingData(true);
    try {
      if (isEditing && editingResource?.id) {
        const resourceDocRef = doc(db, "resources", editingResource.id);
        await updateDoc(resourceDocRef, firestorePayload);
        addAuditLog(currentUser.id, currentUser.name || 'Admin', auditAction, { entityType: 'Resource', entityId: editingResource.id, details: auditDetails });
        toast({ title: 'Resource Updated', description: `Resource "${data.name}" has been updated.` });
      } else {
        const newResourceData = {
            ...firestorePayload,
            createdAt: serverTimestamp(),
            unavailabilityPeriods: [],
        };
        if (!isEditing && newResourceData.hasOwnProperty('lastUpdatedAt')) {
          delete newResourceData.lastUpdatedAt;
        }
        const docRef = await addDoc(collection(db, "resources"), newResourceData);
        addAuditLog(currentUser.id, currentUser.name || 'Admin', auditAction, { entityType: 'Resource', entityId: docRef.id, details: auditDetails });
        toast({ title: 'Resource Created', description: `Resource "${data.name}" has been created.` });
      }
      setIsResourceFormDialogOpen(false);
      setEditingResource(null);
      await fetchInitialData();
    } catch (error: any) {
        toast({ title: "Save Failed", description: `Could not save resource: ${error.message}`, variant: "destructive" });
        setIsLoadingData(false);
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser, canManageResourcesAndTypes, editingResource, fetchedResourceTypes, fetchedLabs, fetchInitialData, toast]);


  const activeResourceFilterCount = useMemo(() => [
    activeResourceSearchTerm !== '',
    activeResourceFilterTypeId !== 'all',
    activeResourceFilterLabId !== 'all',
    activeResourceSelectedDate !== undefined
  ].filter(Boolean).length, [activeResourceSearchTerm, activeResourceFilterTypeId, activeResourceFilterLabId, activeResourceSelectedDate]);

  useEffect(() => {
    if (isResourceTypeFilterSortDialogOpen) {
        setTempResourceTypeSearchTerm(activeResourceTypeSearchTerm);
        setTempResourceTypeSortBy(activeResourceTypeSortBy);
    }
  }, [isResourceTypeFilterSortDialogOpen, activeResourceTypeSearchTerm, activeResourceTypeSortBy]);

  const filteredResourceTypesForDisplay = useMemo(() => {
    let currentTypes = [...fetchedResourceTypes];
    const lowerSearchTerm = activeResourceTypeSearchTerm.toLowerCase();
    if (activeResourceTypeSearchTerm) {
      currentTypes = currentTypes.filter(type =>
        type.name.toLowerCase().includes(lowerSearchTerm) ||
        (type.description && type.description.toLowerCase().includes(lowerSearchTerm))
      );
    }
    const [column, direction] = activeResourceTypeSortBy.split('-') as [ResourceTypeSortableColumn, 'asc' | 'desc'];
    let typesWithCount = currentTypes.map(type => ({
      ...type,
      resourceCount: allResourcesDataSource.filter(res => res.resourceTypeId === type.id).length,
    }));
    typesWithCount.sort((a, b) => {
      let comparison = 0;
      const valA = a[column as keyof typeof a];
      const valB = b[column as keyof typeof b];

      if (column === 'resourceCount') {
        comparison = (valA as number) - (valB as number);
      } else if (column === 'name') {
        comparison = (valA as string).toLowerCase().localeCompare((valB as string).toLowerCase());
      } else if (column === 'description') {
        comparison = (a.description || '').toLowerCase().localeCompare((b.description || '').toLowerCase());
      }
      return direction === 'asc' ? comparison : -comparison;
    });
    return typesWithCount;
  }, [fetchedResourceTypes, allResourcesDataSource, activeResourceTypeSearchTerm, activeResourceTypeSortBy]);

  const handleApplyResourceTypeFilterSort = useCallback(() => {
      setActiveResourceTypeSearchTerm(tempResourceTypeSearchTerm);
      setActiveResourceTypeSortBy(tempResourceTypeSortBy);
      setIsResourceTypeFilterSortDialogOpen(false);
  }, [tempResourceTypeSearchTerm, tempResourceTypeSortBy]);

  const resetResourceTypeFilterSortDialog = useCallback(() => {
      setTempResourceTypeSearchTerm('');
      setTempResourceTypeSortBy('name-asc');
  }, []);

  const resetAllActiveResourceTypePageFiltersSort = useCallback(() => {
      setActiveResourceTypeSearchTerm('');
      setActiveResourceTypeSortBy('name-asc');
      resetResourceTypeFilterSortDialog();
      setIsResourceTypeFilterSortDialogOpen(false);
  }, [resetResourceTypeFilterSortDialog]);

  const handleOpenNewResourceTypeDialog = useCallback(() => {
      setEditingResourceType(null);
      setIsResourceTypeFormDialogOpen(true);
  }, []);

  const handleOpenEditResourceTypeDialog = useCallback((type: ResourceType) => {
      setEditingResourceType(type);
      setIsResourceTypeFormDialogOpen(true);
  }, []);

  const handleSaveResourceType = useCallback(async (data: ResourceTypeFormValues) => {
      if (!currentUser || !currentUser.name || !canManageResourcesAndTypes) { toast({ title: "Permission Denied", variant: "destructive" }); return; }
      setIsLoadingData(true);
      try {
          const typeDataToSave = { name: data.name, description: data.description || null };
          const auditAction = editingResourceType ? 'RESOURCE_TYPE_UPDATED' : 'RESOURCE_TYPE_CREATED';
          let entityId = editingResourceType ? editingResourceType.id : '';
          if (editingResourceType) {
              await updateDoc(doc(db, "resourceTypes", entityId), typeDataToSave);
          } else {
              const docRef = await addDoc(collection(db, "resourceTypes"), typeDataToSave);
              entityId = docRef.id;
          }
          await addAuditLog(currentUser.id, currentUser.name, auditAction, { entityType: 'ResourceType', entityId, details: `Resource Type '${data.name}' ${editingResourceType ? 'updated' : 'created'}.` });
          toast({ title: `Resource Type ${editingResourceType ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingResourceType ? 'updated' : 'created'}.` });
          setIsResourceTypeFormDialogOpen(false);
          setEditingResourceType(null);
          await fetchInitialData();
      } catch (error: any) {
          toast({ title: "Save Failed", description: `Could not save resource type: ${error.message}`, variant: "destructive" });
          setIsLoadingData(false);
      } finally {
          setIsLoadingData(false);
      }
  }, [currentUser, canManageResourcesAndTypes, editingResourceType, fetchInitialData, toast]);

  const handleDeleteResourceType = useCallback(async (typeId: string) => {
      if (!currentUser || !currentUser.name || !canManageResourcesAndTypes) { toast({ title: "Permission Denied", variant: "destructive" }); return; }
      const deletedType = fetchedResourceTypes.find(rt => rt.id === typeId);
      if (!deletedType) { toast({ title: "Error", description: "Resource type not found.", variant: "destructive" }); return; }
      const resourcesOfThisType = allResourcesDataSource.filter(res => res.resourceTypeId === typeId).length;
      if (resourcesOfThisType > 0) {
          toast({ title: "Deletion Blocked", description: `Cannot delete "${deletedType.name}" as ${resourcesOfThisType} resource(s) are assigned. Reassign them first.`, variant: "destructive", duration: 7000 });
          setTypeToDelete(null);
          return;
      }
      setIsLoadingData(true);
      try {
          await deleteDoc(doc(db, "resourceTypes", typeId));
          await addAuditLog(currentUser.id, currentUser.name, 'RESOURCE_TYPE_DELETED', { entityType: 'ResourceType', entityId: typeId, details: `Resource Type '${deletedType.name}' deleted.` });
          toast({ title: "Resource Type Deleted", description: `"${deletedType.name}" removed.`, variant: "destructive" });
          setTypeToDelete(null);
          await fetchInitialData();
      } catch (error: any) {
          toast({ title: "Delete Error", description: `Could not delete resource type: ${error.message}`, variant: "destructive" });
          setIsLoadingData(false);
      } finally {
          setIsLoadingData(false);
      }
  }, [currentUser, canManageResourcesAndTypes, fetchedResourceTypes, allResourcesDataSource, fetchInitialData, toast]);

  const activeResourceTypeFilterSortCount = useMemo(() => [activeResourceTypeSearchTerm !== '', activeResourceTypeSortBy !== 'name-asc'].filter(Boolean).length, [activeResourceTypeSearchTerm, activeResourceTypeSortBy]);


  const pageDescription = currentUser?.role === 'Admin'
    ? "Browse, filter, add, and manage all lab resources and their types. Click resource name for details."
    : "Browse and filter available lab resources from labs you have access to. Click resource name for details.";

  const pageHeaderActions = (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="inline-flex h-9 items-center justify-center rounded-md bg-muted p-0.5 text-muted-foreground">
            <TabsTrigger value="resources" className="px-3 py-1.5 text-sm h-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Resources</TabsTrigger>
            {canManageResourcesAndTypes && (<TabsTrigger value="types" className="px-3 py-1.5 text-sm h-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm">Types</TabsTrigger>)}
        </TabsList>
    </Tabs>
  );


  return (
    <div className="space-y-8">
      <PageHeader
        title="Resources & Types"
        description={pageDescription}
        icon={Package}
        actions={pageHeaderActions}
      />
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsContent value="resources" className="mt-0">
            <Card className="shadow-none">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                        <CardTitle className="text-xl">Resource Catalog</CardTitle>
                        <CardDescription>View and manage all lab resources.</CardDescription>
                    </div>
                     <div className="flex items-center gap-2 flex-wrap">
                        <Dialog open={isResourceFilterDialogOpen} onOpenChange={setIsResourceFilterDialogOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" size="sm">
                            <FilterIcon className="mr-2 h-4 w-4" />
                            Filter
                            {activeResourceFilterCount > 0 && (
                                <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">
                                {activeResourceFilterCount}
                                </Badge>
                            )}
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="w-full sm:max-w-lg">
                            <DialogHeader className="mt-4">
                            <DialogTitle>Filter Resources</DialogTitle>
                            <DialogDescription>Refine the list of available lab resources.</DialogDescription>
                            </DialogHeader>
                            <ScrollArea className="max-h-[60vh] mt-4">
                            <div className="space-y-6 pl-1 pr-2 pb-2">
                                <div>
                                <Label htmlFor="resourceSearchDialog">Search (Name/Keyword)</Label>
                                <div className="relative mt-1">
                                    <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input id="resourceSearchDialog" type="search" placeholder="Name, manufacturer, model, type, lab..." value={tempResourceSearchTerm} onChange={(e) => setTempResourceSearchTerm(e.target.value)} className="h-9 pl-8"/>
                                </div>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="resourceTypeFilterDialog">Type</Label>
                                    <Select value={tempResourceFilterTypeId} onValueChange={setTempResourceFilterTypeId} disabled={fetchedResourceTypes.length === 0}>
                                    <SelectTrigger id="resourceTypeFilterDialog" className="h-9 mt-1"><SelectValue placeholder={fetchedResourceTypes.length > 0 ? "Filter by Type" : "No types available"} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Types</SelectItem>
                                        {fetchedResourceTypes.map(type => (<SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>))}
                                    </SelectContent>
                                    </Select>
                                    {fetchedResourceTypes.length === 0 && <p className="text-xs text-muted-foreground mt-1">No resource types found. Add types in the 'Resource Types' tab.</p>}
                                </div>
                                <div>
                                    <Label htmlFor="resourceLabFilterDialog">Lab</Label>
                                    <Select value={tempResourceFilterLabId} onValueChange={setTempResourceFilterLabId} disabled={fetchedLabs.length === 0}>
                                    <SelectTrigger id="resourceLabFilterDialog" className="h-9 mt-1"><SelectValue placeholder={fetchedLabs.length > 0 ? "Filter by Lab" : "No labs available"} /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Labs</SelectItem>
                                        <SelectItem value="--global--">Global / No Lab</SelectItem>
                                        { (currentUser?.role === 'Admin' ? fetchedLabs : fetchedLabs.filter(lab => userLabMemberships.some(m => m.labId === lab.id && m.status === 'active')))
                                            .map(lab => (<SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>))}
                                    </SelectContent>
                                    </Select>
                                    {fetchedLabs.length === 0 && <p className="text-xs text-muted-foreground mt-1">No labs found. Add labs in Lab Operations.</p>}
                                    {currentUser?.role !== 'Admin' && fetchedLabs.filter(lab => userLabMemberships.some(m => m.labId === lab.id && m.status === 'active')).length === 0 && fetchedLabs.length > 0 &&
                                        <p className="text-xs text-muted-foreground mt-1">You currently have no active lab memberships. Request access via your dashboard.</p>}
                                </div>
                                </div>
                                
                                <div>
                                    <Label className="mb-2 block text-sm font-medium">Available On (Optional)</Label>
                                    <div className="flex justify-center items-center rounded-md border p-2">
                                    <ShadCNCalendar mode="single" selected={tempResourceSelectedDate} onSelect={setTempResourceSelectedDate} month={currentMonthInResourceDialog} onMonthChange={setCurrentMonthInResourceDialog} disabled={(date) => date < startOfDay(new Date()) } footer={ tempResourceSelectedDate && <Button variant="ghost" size="sm" onClick={() => { setTempResourceSelectedDate(undefined); setCurrentMonthInResourceDialog(startOfDay(new Date()));} } className="w-full mt-2 text-xs"><FilterX className="mr-2 h-4 w-4" /> Reset Date Filter</Button>} classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }} />
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1">Filters for resources with status 'Working' on selected date, excluding unavailability.</p>
                                </div>
                            </div>
                            </ScrollArea>
                            <DialogFooter className="pt-6 border-t">
                            <Button variant="ghost" onClick={resetResourceDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4" /> Reset</Button>
                            <Button onClick={handleApplyResourceDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button>
                            </DialogFooter>
                        </DialogContent>
                        </Dialog>
                        {canManageResourcesAndTypes && (
                            <Button onClick={handleOpenNewResourceDialog} size="sm">
                            <PlusCircle className="mr-2 h-4 w-4" /> Add
                            </Button>
                        )}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingData && allResourcesDataSource.length === 0 ? (
                    <div className="flex justify-center items-center py-10 text-muted-foreground"><Loader2 className="mr-2 h-8 w-8 animate-spin text-primary" /> Loading resources...</div>
                  ) : filteredResources.length > 0 ? (
                    <div className="overflow-x-auto border rounded-b-lg">
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
                                <Link href={`/admin/resources/${resource.id}`}>
                                  <Image src={resource.imageUrl || 'https://placehold.co/100x100.png'} alt={resource.name} width={40} height={40} className="rounded-md object-cover h-10 w-10 hover:opacity-80 transition-opacity" data-ai-hint="lab equipment"/>
                                </Link>
                              </TableCell>
                              <TableCell className="font-medium">
                                <Link href={`/admin/resources/${resource.id}`} className="hover:text-primary hover:underline">{resource.name}</Link>
                              </TableCell>
                              <TableCell>{resource.resourceTypeName || 'N/A'}</TableCell>
                              <TableCell>{resource.labName || 'N/A'}</TableCell>
                              <TableCell>{getResourceStatusBadge(resource.status)}</TableCell>
                              <TableCell className="text-right">
                                <Button asChild size="sm" variant="default" disabled={resource.status !== 'Working'} className="h-8 text-xs">
                                  <Link href={`/bookings?resourceId=${resource.id}${activeResourceSelectedDate ? `&date=${format(activeResourceSelectedDate, 'yyyy-MM-dd')}`: ''}`}>
                                    <CalendarIconLucide className="mr-1.5 h-3.5 w-3.5" />Book
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
                        <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
                        <p className="text-lg font-medium">{activeResourceFilterCount > 0 ? "No Resources Match Filters" : "No Resources Found"}</p>
                        <p className="text-sm mb-4">{activeResourceFilterCount > 0 ? "Try adjusting your filter or search criteria." : (canManageResourcesAndTypes ? "There are currently no resources in the catalog. Add one to get started!" : "There are currently no resources accessible to you. Request lab access via your dashboard or contact an admin.")}</p>
                        {activeResourceFilterCount > 0 ? (<Button variant="outline" onClick={resetAllActiveResourcePageFilters}><FilterX className="mr-2 h-4 w-4" /> Reset All Filters</Button>
                        ): (!isLoadingData && allResourcesDataSource.length === 0 && canManageResourcesAndTypes && (<Button onClick={handleOpenNewResourceDialog}><PlusCircle className="mr-2 h-4 w-4" /> Add First Resource</Button>))}
                      </CardContent>
                    </Card>
                  )}
                </CardContent>
            </Card>
        </TabsContent>

        {canManageResourcesAndTypes && (
            <TabsContent value="types" className="mt-0">
            <Card className="shadow-none">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div><CardTitle className="text-xl">Manage Resource Types</CardTitle><CardDescription>Define categories for lab resources.</CardDescription></div>
                <div className="flex gap-2 flex-wrap">
                    <Dialog open={isResourceTypeFilterSortDialogOpen} onOpenChange={setIsResourceTypeFilterSortDialogOpen}>
                    <DialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter {activeResourceTypeFilterSortCount > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeResourceTypeFilterSortCount}</Badge>}</Button></DialogTrigger>
                    <DialogContent className="sm:max-w-md">
                        <DialogHeader className="mt-4"><DialogTitle>Filter & Sort Resource Types</DialogTitle></DialogHeader>
                        
                        <div className="space-y-3 mt-4 pl-1 pr-2 pb-2">
                             <div>
                                <Label htmlFor="typeSearchDialog">Search (Name/Desc)</Label>
                                <div className="relative mt-1">
                                    <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                                    <Input id="typeSearchDialog" value={tempResourceTypeSearchTerm} onChange={e => setTempResourceTypeSearchTerm(e.target.value)} placeholder="Keyword..." className="h-9 pl-8"/>
                                </div>
                            </div>
                            <div>
                                <Label htmlFor="typeSortDialog">Sort by</Label>
                                <Select value={tempResourceTypeSortBy} onValueChange={setTempResourceTypeSortBy}>
                                    <SelectTrigger id="typeSortDialog" className="mt-1 h-9"><SelectValue /></SelectTrigger>
                                    <SelectContent>{resourceTypeSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        <DialogFooter className="pt-6 border-t"><Button variant="ghost" onClick={resetResourceTypeFilterSortDialog} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button onClick={handleApplyResourceTypeFilterSort}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></DialogFooter>
                    </DialogContent>
                    </Dialog>
                    <Button onClick={handleOpenNewResourceTypeDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add</Button>
                </div>
                </CardHeader>
                <CardContent className="p-0">
                {isLoadingData && filteredResourceTypesForDisplay.length === 0 && !activeResourceTypeSearchTerm ? ( <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
                ) : filteredResourceTypesForDisplay.length > 0 ? (
                    <div className="overflow-x-auto border rounded-b-md">
                    <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-center"># Resources</TableHead><TableHead className="text-right w-[100px]">Actions</TableHead></TableRow></TableHeader>
                        <TableBody>{filteredResourceTypesForDisplay.map(type => (
                        <TableRow key={type.id}>
                            <TableCell className="font-medium">{type.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={type.description || undefined}>{type.description || 'N/A'}</TableCell>
                            <TableCell className="text-center">{type.resourceCount}</TableCell>
                            <TableCell className="text-right space-x-1">
                              <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditResourceTypeDialog(type)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Type</TooltipContent></Tooltip></TooltipProvider>
                              <AlertDialog open={!!typeToDelete && typeToDelete.id === type.id} onOpenChange={(isOpen) => !isOpen && setTypeToDelete(null)}>
                                  <TooltipProvider><Tooltip><TooltipTrigger asChild>
                                          <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setTypeToDelete(type)} disabled={isLoadingData || type.resourceCount > 0}><Trash2 className="h-4 w-4"/></Button>
                                  </TooltipTrigger><TooltipContent>{type.resourceCount > 0 ? "Cannot delete: type in use" : "Delete Type"}</TooltipContent></Tooltip></TooltipProvider>
                                  <AlertDialogContent>
                                      <AlertDialogHeader className="mt-4"><AlertDialogTitle>Delete "{typeToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Ensure no resources use this type.</AlertDialogDescription></AlertDialogHeader>
                                      <AlertDialogFooter className="pt-6 border-t"><AlertDialogAction variant="destructive" onClick={() => typeToDelete && handleDeleteResourceType(typeToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>
                        </TableRow>
                        ))}</TableBody>
                    </Table>
                    </div>
                ) : (
                    <div className="text-center py-10 text-muted-foreground">
                    <ListChecks className="h-12 w-12 mx-auto mb-3 opacity-50"/>
                    <p className="font-medium">{activeResourceTypeFilterSortCount > 0 ? "No types match criteria." : "No resource types defined."}</p>
                    {activeResourceTypeFilterSortCount > 0 && <Button variant="link" onClick={resetAllActiveResourceTypePageFiltersSort} className="mt-2 text-xs"><FilterX className="mr-1.5 h-3.5 w-3.5"/>Reset Filters</Button>}
                    </div>
                )}
                </CardContent>
            </Card>
            </TabsContent>
        )}
      </Tabs>

      {isResourceFormDialogOpen && (
        <ResourceFormDialog open={isResourceFormDialogOpen} onOpenChange={(isOpen) => { setIsResourceFormDialogOpen(isOpen); if (!isOpen) setEditingResource(null);}} initialResource={editingResource} onSave={handleSaveResource} resourceTypes={fetchedResourceTypes} labs={currentUser?.role === 'Admin' ? fetchedLabs : fetchedLabs.filter(lab => userLabMemberships.some(m => m.labId === lab.id && m.status === 'active'))}/>
      )}
      {isResourceTypeFormDialogOpen && (<ResourceTypeFormDialog open={isResourceTypeFormDialogOpen} onOpenChange={(isOpen) => { setIsResourceTypeFormDialogOpen(isOpen); if (!isOpen) setEditingResourceType(null); }} initialType={editingResourceType} onSave={handleSaveResourceType} />)}

    </div>
  );
}
