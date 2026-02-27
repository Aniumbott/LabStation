
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
import { Package, PlusCircle, Filter as FilterIcon, FilterX, Search as SearchIcon, Calendar as CalendarIconLucide, CheckCircle2, Building, ListChecks, Edit, Trash2, Tag, Info, FileText, Image as ImageIconLucide } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import type { Resource, ResourceStatus, ResourceType, Lab, LabMembership } from '@/types';
import { resourceStatusesList, PLACEHOLDER_IMAGE, PLACEHOLDER_AVATAR } from '@/lib/app-constants';
import { useAuth } from '@/components/auth-context';
import { useAdminData } from '@/contexts/AdminDataContext';
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
  AlertDialogCancel,
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
import { format, startOfDay, isValid as isValidDateFn, parseISO, isWithinInterval } from 'date-fns';
import { cn, formatDateSafe, getResourceStatusBadge } from '@/lib/utils';
import { getResources_SA, getLabMemberships_SA } from '@/lib/actions/data.actions';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import {
  createResource_SA,
  updateResource_SA,
  deleteResource_SA,
  createResourceType_SA,
  updateResourceType_SA,
  deleteResourceType_SA,
} from '@/lib/actions/resource.actions';
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
  
  const { labs: fetchedLabs, resourceTypes: fetchedResourceTypes, isLoading: isAdminDataLoading, refetch: refetchAdminData } = useAdminData();

  const [allResourcesDataSource, setAllResourcesDataSource] = useState<Resource[]>([]);
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

  const fetchResourcePageData = useCallback(async () => {
    if (!currentUser) {
        setIsLoadingData(false);
        return;
    }
    setIsLoadingData(true);
    try {
      let activeUserLabIds: string[] = [];
      if (currentUser.id && currentUser.role !== 'Admin') {
        const membershipsResult = await getLabMemberships_SA(currentUser.id);
        const memberships: LabMembership[] = membershipsResult.success && membershipsResult.data
          ? membershipsResult.data.filter(m => m.status === 'active')
          : [];
        setUserLabMemberships(memberships);
        activeUserLabIds = memberships.map(m => m.labId);
      }

      const resourcesResult = await getResources_SA();
      let fetchedResources: Resource[] = resourcesResult.success && resourcesResult.data ? resourcesResult.data : [];

      if (currentUser.role !== 'Admin') {
        fetchedResources = fetchedResources.filter(resource => activeUserLabIds.includes(resource.labId) || !resource.labId);
      }
      setAllResourcesDataSource(fetchedResources);
    } catch (error: unknown) {
      toast({ title: "Data Load Error", description: `Failed to load resources: ${(error as Error).message}`, variant: "destructive" });
      setAllResourcesDataSource([]);
      setUserLabMemberships([]);
    }
    setIsLoadingData(false);
  }, [currentUser, toast]);


  useEffect(() => {
    if (!isAdminDataLoading) {
      fetchResourcePageData();
    }
  }, [fetchResourcePageData, isAdminDataLoading]);

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
        router.push('/admin/lab-operations?tab=labs');
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

    const purchaseDateStr = (data.purchaseDate && isValidDateFn(parseISO(data.purchaseDate)))
      ? data.purchaseDate
      : null;

    let remoteAccessForSA: { ipAddress?: string; hostname?: string; protocol?: string; username?: string; port?: number | null; notes?: string } | null = null;
    if (data.remoteAccess) {
      const ra = data.remoteAccess;
      const allEffectivelyNull = !ra.ipAddress && !ra.hostname && !ra.protocol && !ra.username && (ra.port === undefined || ra.port === null) && !ra.notes;
      if (!allEffectivelyNull) {
        remoteAccessForSA = {
          ipAddress: ra.ipAddress || undefined,
          hostname: ra.hostname || undefined,
          protocol: ra.protocol || '',
          username: ra.username || undefined,
          port: ra.port ?? null,
          notes: ra.notes || undefined,
        };
      }
    }

    const isEditing = !!editingResource;

    setIsLoadingData(true);
    try {
      if (isEditing && editingResource?.id) {
        const result = await updateResource_SA({
          callerUserId: currentUser.id,
          resourceId: editingResource.id,
          name: data.name,
          resourceTypeId: data.resourceTypeId,
          labId: labIdForSave,
          status: data.status,
          description: data.description || '',
          imageUrl: data.imageUrl || PLACEHOLDER_IMAGE,
          manufacturer: data.manufacturer || undefined,
          model: data.model || undefined,
          serialNumber: data.serialNumber || undefined,
          purchaseDate: purchaseDateStr,
          notes: data.notes || undefined,
          features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
          remoteAccess: remoteAccessForSA,
          allowQueueing: data.allowQueueing ?? editingResource.allowQueueing ?? false,
        });
        if (!result.success) {
          toast({ title: 'Update Failed', description: result.message || 'Could not update resource.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Resource Updated', description: `Resource "${data.name}" has been updated.` });
      } else {
        const result = await createResource_SA({
          callerUserId: currentUser.id,
          name: data.name,
          resourceTypeId: data.resourceTypeId,
          labId: labIdForSave,
          status: data.status,
          description: data.description || '',
          imageUrl: data.imageUrl || PLACEHOLDER_IMAGE,
          manufacturer: data.manufacturer || undefined,
          model: data.model || undefined,
          serialNumber: data.serialNumber || undefined,
          purchaseDate: purchaseDateStr,
          notes: data.notes || undefined,
          features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
          remoteAccess: remoteAccessForSA,
          allowQueueing: data.allowQueueing ?? false,
        });
        if (!result.success) {
          toast({ title: 'Create Failed', description: result.message || 'Could not create resource.', variant: 'destructive' });
          return;
        }
        toast({ title: 'Resource Created', description: `Resource "${data.name}" has been created.` });
      }
      setIsResourceFormDialogOpen(false);
      setEditingResource(null);
      await fetchResourcePageData();
      refetchAdminData();
    } catch (error: unknown) {
        toast({ title: "Save Failed", description: `Could not save resource: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsLoadingData(false);
    }
  }, [currentUser, canManageResourcesAndTypes, editingResource, fetchedResourceTypes, fetchedLabs, fetchResourcePageData, toast, refetchAdminData]);


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
          if (editingResourceType) {
              const result = await updateResourceType_SA({
                callerUserId: currentUser.id,
                typeId: editingResourceType.id,
                name: data.name,
                description: data.description || undefined,
              });
              if (!result.success) {
                toast({ title: "Update Failed", description: result.message || 'Could not update resource type.', variant: "destructive" });
                return;
              }
          } else {
              const result = await createResourceType_SA({
                callerUserId: currentUser.id,
                name: data.name,
                description: data.description || undefined,
              });
              if (!result.success) {
                toast({ title: "Create Failed", description: result.message || 'Could not create resource type.', variant: "destructive" });
                return;
              }
          }
          toast({ title: `Resource Type ${editingResourceType ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingResourceType ? 'updated' : 'created'}.` });
          setIsResourceTypeFormDialogOpen(false);
          setEditingResourceType(null);
          refetchAdminData();
      } catch (error: unknown) {
          toast({ title: "Save Failed", description: `Could not save resource type: ${(error as Error).message}`, variant: "destructive" });
      } finally {
          setIsLoadingData(false);
      }
  }, [currentUser, canManageResourcesAndTypes, editingResourceType, refetchAdminData, toast]);

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
          const result = await deleteResourceType_SA({ callerUserId: currentUser.id, typeId });
          if (!result.success) {
            toast({ title: "Delete Failed", description: result.message || 'Could not delete resource type.', variant: "destructive" });
            return;
          }
          toast({ title: "Resource Type Deleted", description: `"${deletedType.name}" removed.`, variant: "destructive" });
          setTypeToDelete(null);
          refetchAdminData();
      } catch (error: unknown) {
          toast({ title: "Delete Error", description: `Could not delete resource type: ${(error as Error).message}`, variant: "destructive" });
      } finally {
          setIsLoadingData(false);
      }
  }, [currentUser, canManageResourcesAndTypes, fetchedResourceTypes, allResourcesDataSource, refetchAdminData, toast]);

  const activeResourceTypeFilterSortCount = useMemo(() => [activeResourceTypeSearchTerm !== '', activeResourceTypeSortBy !== 'name-asc'].filter(Boolean).length, [activeResourceTypeSearchTerm, activeResourceTypeSortBy]);


  const pageDescription = currentUser?.role === 'Admin'
    ? "Browse, filter, add, and manage all lab resources and their types. Click resource name for details."
    : "Browse and filter available lab resources from labs you have access to. Click resource name for details.";

  const pageHeaderActions = (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="inline-flex h-9 items-center justify-center rounded-md bg-muted p-0.5 text-muted-foreground">
            <TabsTrigger value="resources" className="px-3 py-1.5 text-sm h-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2">
              <Package className="h-4 w-4" /> Resources
            </TabsTrigger>
            {canManageResourcesAndTypes && (
            <TabsTrigger value="types" className="px-3 py-1.5 text-sm h-full data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm flex items-center gap-2">
              <ListChecks className="h-4 w-4" /> Types
            </TabsTrigger>
            )}
        </TabsList>
    </Tabs>
  );


  return (
    <div className="space-y-6">
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
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="font-semibold text-foreground w-[90px]">
                            <div className="flex items-center gap-1">
                              <ImageIconLucide className="h-4 w-4 text-muted-foreground" />Image
                            </div>
                          </TableHead>
                          <TableHead className="font-semibold text-foreground"><Tag className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Name</TableHead>
                          <TableHead className="font-semibold text-foreground"><ListChecks className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Type</TableHead>
                          <TableHead className="font-semibold text-foreground"><Building className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Lab</TableHead>
                          <TableHead className="font-semibold text-foreground"><Info className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Status</TableHead>
                          <TableHead className="font-semibold text-foreground text-right w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {isLoadingData && allResourcesDataSource.length === 0 ? (
                          <TableSkeleton rows={5} cols={6} />
                        ) : filteredResources.length > 0 ? (
                          filteredResources.map((resource) => (
                            <TableRow key={resource.id} className="hover:bg-muted/30 transition-colors">
                              <TableCell>
                                <Link href={`/admin/resources/${resource.id}`}>
                                  <Image src={resource.imageUrl || PLACEHOLDER_AVATAR} alt={resource.name} width={40} height={40} className="rounded-md object-cover h-10 w-10 hover:opacity-80 transition-opacity" data-ai-hint="lab equipment"/>
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
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6}>
                              <EmptyState
                                icon={Package}
                                title={activeResourceFilterCount > 0 ? "No Resources Match Filters" : "No Resources Found"}
                                description={activeResourceFilterCount > 0 ? "Try adjusting your filter or search criteria." : (canManageResourcesAndTypes ? "There are currently no resources in the catalog. Add one to get started!" : "There are currently no resources accessible to you. Request lab access via your dashboard.")}
                                action={activeResourceFilterCount > 0 ? (
                                  <Button variant="outline" onClick={resetAllActiveResourcePageFilters}><FilterX className="mr-2 h-4 w-4" /> Reset All Filters</Button>
                                ) : (!isLoadingData && allResourcesDataSource.length === 0 && canManageResourcesAndTypes ? (
                                  <Button onClick={handleOpenNewResourceDialog}><PlusCircle className="mr-2 h-4 w-4" /> Add First Resource</Button>
                                ) : undefined)}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
            </Card>
        </TabsContent>

        {canManageResourcesAndTypes && (
            <TabsContent value="types" className="mt-0">
            <Card className="shadow-none">
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div><CardTitle className="text-xl">Resource Types</CardTitle><CardDescription>Define categories for lab resources.</CardDescription></div>
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
                  <div className="rounded-lg border border-border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableHead className="font-semibold text-foreground"><Tag className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Name</TableHead>
                          <TableHead className="font-semibold text-foreground"><FileText className="inline-block mr-1 h-4 w-4 text-muted-foreground" />Description</TableHead>
                          <TableHead className="font-semibold text-foreground text-center"><Package className="inline-block mr-1 h-4 w-4 text-muted-foreground" /># Resources</TableHead>
                          <TableHead className="font-semibold text-foreground text-right w-[100px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(isLoadingData || isAdminDataLoading) && filteredResourceTypesForDisplay.length === 0 && !activeResourceTypeSearchTerm ? (
                          <TableSkeleton rows={5} cols={4} />
                        ) : filteredResourceTypesForDisplay.length > 0 ? (
                          filteredResourceTypesForDisplay.map(type => (
                            <TableRow key={type.id} className="hover:bg-muted/30 transition-colors">
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
                                        <AlertDialogFooter className="pt-6 border-t"><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => typeToDelete && handleDeleteResourceType(typeToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={4}>
                              <EmptyState
                                icon={ListChecks}
                                title={activeResourceTypeFilterSortCount > 0 ? "No types match criteria." : "No resource types defined."}
                                action={activeResourceTypeFilterSortCount > 0 ? (
                                  <Button variant="link" onClick={resetAllActiveResourceTypePageFiltersSort} className="mt-2 text-xs"><FilterX className="mr-1.5 h-3.5 w-3.5"/>Reset Filters</Button>
                                ) : undefined}
                              />
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
            </Card>
            </TabsContent>
        )}
      </Tabs>

      {isResourceFormDialogOpen && (
        <ResourceFormDialog open={isResourceFormDialogOpen} onOpenChange={(isOpen) => { setIsResourceFormDialogOpen(isOpen); if (!isOpen) setEditingResource(null);}} initialResource={editingResource} onSave={handleSaveResource}/>
      )}
      {isResourceTypeFormDialogOpen && (<ResourceTypeFormDialog open={isResourceTypeFormDialogOpen} onOpenChange={(isOpen) => { setIsResourceTypeFormDialogOpen(isOpen); if (!isOpen) setEditingResourceType(null); }} initialType={editingResourceType} onSave={handleSaveResourceType} />)}

    </div>
  );
}

    