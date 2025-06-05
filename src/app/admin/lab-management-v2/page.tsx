
'use client';

// All original imports are kept, but most will be unused temporarily.
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation'; // Added
import { PageHeader } from '@/components/layout/page-header';
import { Cog, ListChecks, PackagePlus, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon, Loader2, X, CheckCircle2, Building, PlusCircle, CalendarOff, Repeat, Wrench, ListFilter, PenToolIcon, AlertCircle, CheckCircle as LucideCheckCircle, Globe, Users, ThumbsUp, ThumbsDown, Settings, SlidersHorizontal, ArrowLeft, Settings2, ShieldCheck, ShieldOff, CalendarDays, Info as InfoIcon, Package as PackageIcon, Users2, UserCog } from 'lucide-react';
import type { ResourceType, Resource, Lab, BlackoutDate, RecurringBlackoutRule, MaintenanceRequest, MaintenanceRequestStatus, User, LabMembership, LabMembershipStatus } from '@/types';
import { useAuth } from '@/components/auth-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Dialog as FilterSortDialog,
  DialogContent as FilterSortDialogContent,
  DialogDescription as FilterSortDialogDescription,
  DialogHeader as FilterSortDialogHeader,
  DialogTitle as FilterSortDialogTitle,
  DialogFooter as FilterSortDialogFooter,
  DialogTrigger as FilterSortDialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import { ResourceTypeFormDialog, ResourceTypeFormValues } from '@/components/admin/resource-type-form-dialog';
import { LabFormDialog, LabFormValues } from '@/components/admin/lab-form-dialog';
import { BlackoutDateFormDialog, BlackoutDateFormValues as BlackoutDateDialogFormValues } from '@/components/admin/blackout-date-form-dialog';
import { RecurringBlackoutRuleFormDialog, RecurringBlackoutRuleFormValues as RecurringRuleDialogFormValues } from '@/components/admin/recurring-blackout-rule-form-dialog';
import { MaintenanceRequestFormDialog, MaintenanceRequestFormValues as MaintenanceDialogFormValues } from '@/components/maintenance/maintenance-request-form-dialog';
import { ManageUserLabAccessDialog } from '@/components/admin/manage-user-lab-access-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp, writeBatch, where, limit } from 'firebase/firestore';
import { addNotification, addAuditLog, manageLabMembership_SA } from '@/lib/firestore-helpers';
import { daysOfWeekArray, maintenanceRequestStatuses } from '@/lib/app-constants';
import { format, parseISO, isValid as isValidDateFn } from 'date-fns';
import { cn, formatDateSafe } from '@/lib/utils';

// Sorting options (moved from commented block)
type ResourceTypeSortableColumn = 'name' | 'resourceCount' | 'description';
type LabSortableColumn = 'name' | 'location' | 'resourceCount' | 'memberCount';
const resourceTypeSortOptions: { value: string; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' }, { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'resourceCount-asc', label: 'Resources (Low-High)' }, { value: 'resourceCount-desc', label: 'Resources (High-Low)' },
];
const labSortOptions: { value: string; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' }, { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'location-asc', label: 'Location (A-Z)' }, { value: 'location-desc', label: 'Location (Z-A)' },
  { value: 'resourceCount-asc', label: 'Resources (Low-High)' }, { value: 'resourceCount-desc', label: 'Resources (High-Low)' },
  { value: 'memberCount-asc', label: 'Members (Low-High)' }, { value: 'memberCount-desc', label: 'Members (High-Low)' },
];

const GLOBAL_CONTEXT_VALUE = "--system-wide--";

interface LabMembershipRequest extends LabMembership {
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
  labName?: string;
}

export default function LabOperationsCenterPage() {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const searchParamsObj = useSearchParams();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [activeContextId, setActiveContextId] = useState<string>(GLOBAL_CONTEXT_VALUE);
    const [isLabAccessRequestLoading, setIsLabAccessRequestLoading] = useState(true);

    const [activeGlobalClosuresTab, setActiveGlobalClosuresTab] = useState('specific-dates-global');
    const [activeLabSpecificClosuresTab, setActiveLabSpecificClosuresTab] = useState('specific-dates-lab');

    // --- Resource Types State ---
    const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
    const [allResourcesForCountsAndChecks, setAllResourcesForCountsAndChecks] = useState<Resource[]>([]);
    const [typeToDelete, setTypeToDelete] = useState<ResourceType | null>(null);
    const [isResourceTypeFormDialogOpen, setIsResourceTypeFormDialogOpen] = useState(false);
    const [editingType, setEditingType] = useState<ResourceType | null>(null);
    const [isResourceTypeFilterDialogOpen, setIsResourceTypeFilterDialogOpen] = useState(false);
    const [tempResourceTypeSearchTerm, setTempResourceTypeSearchTerm] = useState('');
    const [activeResourceTypeSearchTerm, setActiveResourceTypeSearchTerm] = useState('');
    const [tempResourceTypeSortBy, setTempResourceTypeSortBy] = useState<string>('name-asc');
    const [activeResourceTypeSortBy, setActiveResourceTypeSortBy] = useState<string>('name-asc');

    // --- Labs State ---
    const [labs, setLabs] = useState<Lab[]>([]);
    // const [labToDelete, setLabToDelete] = useState<Lab | null>(null);
    // const [isLabFormDialogOpen, setIsLabFormDialogOpen] = useState(false);
    // const [editingLab, setEditingLab] = useState<Lab | null>(null);
    // const [isLabFilterDialogOpen, setIsLabFilterDialogOpen] = useState(false);
    // const [tempLabSearchTerm, setTempLabSearchTerm] = useState('');
    // const [activeLabSearchTerm, setActiveLabSearchTerm] = useState('');
    // const [tempLabSortBy, setTempLabSortBy] = useState<string>('name-asc');
    // const [activeLabSortBy, setActiveLabSortBy] = useState<string>('name-asc');

    // --- Blackout Dates & Recurring Rules State ---
    const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);
    const [recurringRules, setRecurringRules] = useState<RecurringBlackoutRule[]>([]);
    // const [isDateFormDialogOpen, setIsDateFormDialogOpen] = useState(false);
    // const [editingBlackoutDate, setEditingBlackoutDate] = useState<BlackoutDate | null>(null);
    // const [dateToDelete, setDateToDelete] = useState<BlackoutDate | null>(null);
    // const [isRecurringFormDialogOpen, setIsRecurringFormDialogOpen] = useState(false);
    // const [editingRecurringRule, setEditingRecurringRule] = useState<RecurringBlackoutRule | null>(null);
    // const [ruleToDelete, setRuleToDelete] = useState<RecurringBlackoutRule | null>(null);
    // const [isClosureFilterDialogOpen, setIsClosureFilterDialogOpen] = useState(false);
    // const [tempClosureSearchTerm, setTempClosureSearchTerm] = useState('');
    // const [activeClosureSearchTerm, setActiveClosureSearchTerm] = useState('');

    // --- Maintenance Requests State ---
    const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
    const [allTechniciansForMaintenance, setAllTechniciansForMaintenance] = useState<User[]>([]);
    const [allUsersData, setAllUsersData] = useState<User[]>([]);
    // const [isMaintenanceFormDialogOpen, setIsMaintenanceFormDialogOpen] = useState(false);
    // const [editingMaintenanceRequest, setEditingMaintenanceRequest] = useState<MaintenanceRequest | null>(null);
    // const [isMaintenanceFilterDialogOpen, setIsMaintenanceFilterDialogOpen] = useState(false);
    // const [tempMaintenanceSearchTerm, setTempMaintenanceSearchTerm] = useState('');
    // const [tempMaintenanceFilterStatus, setTempMaintenanceFilterStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
    // const [tempMaintenanceFilterResourceId, setTempMaintenanceFilterResourceId] = useState<string>('all');
    // const [tempMaintenanceFilterTechnicianId, setTempMaintenanceFilterTechnicianId] = useState<string>('all');
    // const [tempMaintenanceFilterLabId, setTempMaintenanceFilterLabId] = useState<string>('all');
    // const [activeMaintenanceSearchTerm, setActiveMaintenanceSearchTerm] = useState('');
    // const [activeMaintenanceFilterStatus, setActiveMaintenanceFilterStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
    // const [activeMaintenanceFilterResourceId, setActiveMaintenanceFilterResourceId] = useState<string>('all');
    // const [activeMaintenanceFilterTechnicianId, setActiveMaintenanceFilterTechnicianId] = useState<string>('all');
    // const [activeMaintenanceFilterLabId, setActiveMaintenanceFilterLabId] = useState<string>('all');

    // --- Lab Access & Membership State ---
    const [allLabAccessRequests, setAllLabAccessRequests] = useState<LabMembershipRequest[]>([]);
    const [userLabMemberships, setUserLabMemberships] = useState<LabMembership[]>([]);
    // const [isProcessingAction, setIsProcessingAction] = useState<Record<string, {action: 'grant' | 'revoke' | 'approve_request' | 'reject_request', loading: boolean}>>({});
    // const [isManualAddMemberDialogOpen, setIsManualAddMemberDialogOpen] = useState(false);
    // const [isSystemWideAccessRequestsFilterOpen, setIsSystemWideAccessRequestsFilterOpen] = useState(false);
    // const [tempSystemWideAccessRequestsFilterLabId, setTempSystemWideAccessRequestsFilterLabId] = useState('all');
    // const [activeSystemWideAccessRequestsFilterLabId, setActiveSystemWideAccessRequestsFilterLabId] = useState('all');
    // const [tempSystemWideAccessRequestsFilterUser, setTempSystemWideAccessRequestsFilterUser] = useState('');
    // const [activeSystemWideAccessRequestsFilterUser, setActiveSystemWideAccessRequestsFilterUser] = useState('');

    const canManageAny = useMemo(() => currentUser && currentUser.role === 'Admin', [currentUser]);

    const fetchAllAdminData = useCallback(async () => {
      if (!canManageAny) {
        setIsLoadingData(false);
        setIsLabAccessRequestLoading(false);
        return;
      }
      setIsLoadingData(true);
      setIsLabAccessRequestLoading(true);
      try {
        const [labsSnapshot, typesSnapshot, resourcesSnapshot, usersSnapshot, techniciansSnapshot, maintenanceSnapshot, boSnapshot, rrSnapshot, membershipsSnapshot] = await Promise.all([
          getDocs(query(collection(db, "labs"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "resourceTypes"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "resources"))),
          getDocs(query(collection(db, "users"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "users"), where("role", "==", "Technician"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "maintenanceRequests"), orderBy("dateReported", "desc"))),
          getDocs(query(collection(db, "blackoutDates"), orderBy("date", "asc"))),
          getDocs(query(collection(db, "recurringBlackoutRules"), orderBy("name", "asc"))),
          getDocs(query(collection(db, 'labMemberships'))),
        ]);

        const fetchedLabs = labsSnapshot.docs.map(docSnap => ({id: docSnap.id, ...docSnap.data(), createdAt: (docSnap.data().createdAt as Timestamp)?.toDate(), lastUpdatedAt: (docSnap.data().lastUpdatedAt as Timestamp)?.toDate()} as Lab));
        setLabs(fetchedLabs);

        setResourceTypes(typesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ResourceType)));

        const fetchedResourcesAll = resourcesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Resource));
        setAllResourcesForCountsAndChecks(fetchedResourcesAll);

        const fetchedUsersAll = usersSnapshot.docs.map(d => ({id: d.id, ...d.data(), createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date()} as User));
        setAllUsersData(fetchedUsersAll);

        setAllTechniciansForMaintenance(techniciansSnapshot.docs.map(d => ({id: d.id, ...d.data(), createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date()} as User)));

        setMaintenanceRequests(maintenanceSnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return { id: docSnap.id, ...data, dateReported: (data.dateReported as Timestamp)?.toDate() || new Date(), dateResolved: (data.dateResolved as Timestamp)?.toDate() } as MaintenanceRequest;
        }));

        setBlackoutDates(boSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as BlackoutDate)));
        setRecurringRules(rrSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as RecurringBlackoutRule)));

        const allFetchedMemberships = membershipsSnapshot.docs.map(mDoc => ({ id: mDoc.id, ...mDoc.data() } as LabMembership));
        setUserLabMemberships(allFetchedMemberships);

        const pendingRequestsPromises = allFetchedMemberships
            .filter(m => m.status === 'pending_approval')
            .map(async (membershipData) => {
                const user = fetchedUsersAll.find(u => u.id === membershipData.userId);
                const lab = fetchedLabs.find(l => l.id === membershipData.labId);
                return {
                    ...membershipData,
                    id: membershipData.id!,
                    userName: user?.name || 'Unknown User',
                    userEmail: user?.email || 'N/A',
                    userAvatarUrl: user?.avatarUrl,
                    labName: lab?.name || 'Unknown Lab',
                    requestedAt: (membershipData.requestedAt as Timestamp)?.toDate()
                } as LabMembershipRequest;
            });
        setAllLabAccessRequests(await Promise.all(pendingRequestsPromises));

      } catch (error: any) {
        console.error("Error fetching admin data:", error);
        toast({ title: "Error", description: `Failed to load data: ${error.message}`, variant: "destructive" });
      } finally {
        setIsLoadingData(false);
        setIsLabAccessRequestLoading(false);
      }
    }, [toast, canManageAny]);

    useEffect(() => { fetchAllAdminData(); }, [fetchAllAdminData]);

    useEffect(() => {
        const preselectedLabId = searchParamsObj.get('labId');
        if (preselectedLabId && labs.find(l => l.id === preselectedLabId)) {
          setActiveContextId(preselectedLabId);
        } else if (preselectedLabId) {
          // If labId in URL is invalid or not found, default to global
          setActiveContextId(GLOBAL_CONTEXT_VALUE);
        }
      }, [searchParamsObj, labs]); // Added labs to dependency array

    const selectedLabDetails = useMemo(() => labs.find(lab => lab.id === activeContextId), [labs, activeContextId]);

    const pageHeaderActionsContent = (
      <div className="flex items-center gap-2">
        <Select value={activeContextId} onValueChange={setActiveContextId}>
            <SelectTrigger
                id="labContextSelectPageHeader"
                className={cn(
                    "w-auto min-w-[200px] sm:min-w-[240px] h-9 text-sm",
                    activeContextId === GLOBAL_CONTEXT_VALUE ? "bg-primary/10 border-primary/30 font-semibold" : ""
                )}
            >
                <SelectValue placeholder="Select Context..." />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={GLOBAL_CONTEXT_VALUE} className="text-sm py-1.5">
                    <Globe className="inline-block mr-2 h-4 w-4 text-muted-foreground"/>System-Wide Settings
                </SelectItem>
                {labs.length > 0 && <Separator className="my-1"/>}
                {labs.map(lab => (
                    <SelectItem key={lab.id} value={lab.id} className="text-sm py-1.5">
                        <Building className="inline-block mr-2 h-4 w-4 text-muted-foreground"/>{lab.name}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
      </div>
    );

    // --- Resource Types Logic (Only for GLOBAL_CONTEXT_VALUE) ---
    useEffect(() => {
        if (isResourceTypeFilterDialogOpen) {
            setTempResourceTypeSearchTerm(activeResourceTypeSearchTerm);
            setTempResourceTypeSortBy(activeResourceTypeSortBy);
        }
    }, [isResourceTypeFilterDialogOpen, activeResourceTypeSearchTerm, activeResourceTypeSortBy]);

    const filteredResourceTypesWithCount = useMemo(() => {
      let currentTypes = [...resourceTypes];
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
        resourceCount: allResourcesForCountsAndChecks.filter(res => res.resourceTypeId === type.id).length,
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
    }, [resourceTypes, allResourcesForCountsAndChecks, activeResourceTypeSearchTerm, activeResourceTypeSortBy]);

    const handleApplyResourceTypeDialogFilters = useCallback(() => {
        setActiveResourceTypeSearchTerm(tempResourceTypeSearchTerm);
        setActiveResourceTypeSortBy(tempResourceTypeSortBy);
        setIsResourceTypeFilterDialogOpen(false);
    }, [tempResourceTypeSearchTerm, tempResourceTypeSortBy]);

    const resetResourceTypeDialogFiltersOnly = useCallback(() => {
        setTempResourceTypeSearchTerm('');
        setTempResourceTypeSortBy('name-asc');
    }, []);

    const resetAllActiveResourceTypePageFilters = useCallback(() => {
        setActiveResourceTypeSearchTerm('');
        setActiveResourceTypeSortBy('name-asc');
        resetResourceTypeDialogFiltersOnly();
        setIsResourceTypeFilterDialogOpen(false);
    }, [resetResourceTypeDialogFiltersOnly]);

    const handleOpenNewResourceTypeDialog = useCallback(() => {
        setEditingType(null);
        setIsResourceTypeFormDialogOpen(true);
    }, [setEditingType, setIsResourceTypeFormDialogOpen]);

    const handleOpenEditResourceTypeDialog = useCallback((type: ResourceType) => {
        setEditingType(type);
        setIsResourceTypeFormDialogOpen(true);
    }, [setEditingType, setIsResourceTypeFormDialogOpen]);

    const handleSaveResourceType = useCallback(async (data: ResourceTypeFormValues) => {
        if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; }
        setIsLoadingData(true);
        try {
            const typeDataToSave = { name: data.name, description: data.description || null };
            const auditAction = editingType ? 'RESOURCE_TYPE_UPDATED' : 'RESOURCE_TYPE_CREATED';
            let entityId = editingType ? editingType.id : '';
            if (editingType) {
                await updateDoc(doc(db, "resourceTypes", entityId), typeDataToSave);
            } else {
                const docRef = await addDoc(collection(db, "resourceTypes"), typeDataToSave);
                entityId = docRef.id;
            }
            await addAuditLog(currentUser.id, currentUser.name, auditAction, { entityType: 'ResourceType', entityId, details: `Resource Type '${data.name}' ${editingType ? 'updated' : 'created'}.` });
            toast({ title: `Resource Type ${editingType ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingType ? 'updated' : 'created'}.` });
            setIsResourceTypeFormDialogOpen(false);
            setEditingType(null);
            await fetchAllAdminData();
        } catch (error: any) {
            toast({ title: "Save Error", description: `Could not save resource type: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoadingData(false);
        }
    }, [currentUser, canManageAny, editingType, fetchAllAdminData, toast, setIsLoadingData, setIsResourceTypeFormDialogOpen, setEditingType]);

    const handleDeleteResourceType = useCallback(async (typeId: string) => {
        if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; }
        const deletedType = resourceTypes.find(rt => rt.id === typeId);
        if (!deletedType) { toast({ title: "Error", description: "Resource type not found.", variant: "destructive" }); return; }
        const resourcesOfThisType = allResourcesForCountsAndChecks.filter(res => res.resourceTypeId === typeId).length;
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
            await fetchAllAdminData();
        } catch (error: any) {
            toast({ title: "Delete Error", description: `Could not delete resource type: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoadingData(false);
        }
    }, [currentUser, canManageAny, resourceTypes, allResourcesForCountsAndChecks, fetchAllAdminData, toast, setIsLoadingData, setTypeToDelete]);

    const activeResourceTypeFilterCount = useMemo(() => [activeResourceTypeSearchTerm !== '', activeResourceTypeSortBy !== 'name-asc'].filter(Boolean).length, [activeResourceTypeSearchTerm, activeResourceTypeSortBy]);


    // --- Labs List Logic (Only for GLOBAL_CONTEXT_VALUE) ---
    // ... (Currently Commented Out) ...

    // --- Lab Closures Logic (Context-Aware) ---
    // ... (Currently Commented Out) ...

    // --- Maintenance Requests Logic (Context-Aware) ---
    // ... (Currently Commented Out) ...

    // --- Lab Access & Membership Logic (Context-Aware) ---
    const handleMembershipAction = useCallback(async (
        targetUserId: string, targetUserName: string, labId: string, labName: string,
        action: 'grant' | 'revoke' | 'approve_request' | 'reject_request',
        membershipDocIdToUpdate?: string
      ) => {
        if (!currentUser || !currentUser.id || !currentUser.name) {
          toast({ title: "Authentication Error", variant: "destructive" });
          return;
        }
        // const actionKey = membershipDocIdToUpdate || `${targetUserId}-${labId}-${action}`;
        // setIsProcessingAction(prev => ({ ...prev, [actionKey]: { action, loading: true } })); // Assuming setIsProcessingAction is defined

        try {
          const result = await manageLabMembership_SA(
            currentUser.id, currentUser.name,
            targetUserId, targetUserName,
            labId, labName,
            action, membershipDocIdToUpdate
          );
          if (result.success) {
            toast({ title: "Success", description: result.message });
            fetchAllAdminData();
          } else {
            toast({ title: "Action Failed", description: result.message, variant: "destructive" });
          }
        } catch (error: any) {
          toast({ title: "Error", description: `Failed to process request: ${error.message}`, variant: "destructive" });
        } finally {
          // setIsProcessingAction(prev => ({ ...prev, [actionKey]: { action, loading: false } })); // Assuming setIsProcessingAction is defined
        }
    }, [currentUser, fetchAllAdminData, toast]);

    // ... (Other commented out sections for Labs, Closures, Maintenance, Access/Membership) ...

    if (!currentUser || !canManageAny) { // Main permission check for the whole page
      return ( <div className="space-y-8"><PageHeader title="Lab Operations Center" icon={Cog} description="Access Denied." /><Card className="text-center py-10 text-muted-foreground"><CardContent><p>You do not have permission.</p></CardContent></Card></div>);
    }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <PageHeader
          title="Lab Operations Center"
          description="Manage all aspects of your lab operations, from system-wide settings to individual lab details."
          icon={Cog}
          actions={pageHeaderActionsContent}
        />
        {isLoadingData && (
          <div className="flex justify-center items-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary"/>
              <p className="ml-4 text-lg text-muted-foreground">Loading Lab Operations Data...</p>
          </div>
        )}

        {!isLoadingData && activeContextId === GLOBAL_CONTEXT_VALUE && (
          <Tabs defaultValue={searchParamsObj.get('tab') || "labs"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
              <TabsTrigger value="labs">Manage Labs</TabsTrigger>
              <TabsTrigger value="resource-types">Resource Types</TabsTrigger>
              <TabsTrigger value="global-closures">Global Closures</TabsTrigger>
              <TabsTrigger value="maintenance-log">Maintenance Log</TabsTrigger>
              <TabsTrigger value="lab-access-requests">Lab Access Requests</TabsTrigger>
            </TabsList>

            {/* System-Wide View: Resource Types Tab */}
            <TabsContent value="resource-types" className="mt-6">
              <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div><CardTitle className="text-xl">Resource Types</CardTitle><p className="text-sm text-muted-foreground mt-1">Define categories for lab resources.</p></div>
                  <div className="flex gap-2 flex-wrap">
                    <FilterSortDialog open={isResourceTypeFilterDialogOpen} onOpenChange={setIsResourceTypeFilterDialogOpen}>
                      <FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter & Sort {activeResourceTypeFilterCount > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeResourceTypeFilterCount}</Badge>}</Button></FilterSortDialogTrigger>
                      <FilterSortDialogContent className="sm:max-w-md">
                        <FilterSortDialogHeader><FilterSortDialogTitle>Filter & Sort Resource Types</FilterSortDialogTitle></FilterSortDialogHeader>
                        <Separator className="my-3" />
                        <div className="space-y-3">
                          <div className="relative"><Label htmlFor="typeSearchDialog">Search (Name/Desc)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="typeSearchDialog" value={tempResourceTypeSearchTerm} onChange={e => setTempResourceTypeSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/></div>
                          <div><Label htmlFor="typeSortDialog">Sort by</Label><Select value={tempResourceTypeSortBy} onValueChange={setTempResourceTypeSortBy}><SelectTrigger id="typeSortDialog" className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{resourceTypeSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetResourceTypeDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button variant="outline" onClick={() => setIsResourceTypeFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button><Button onClick={handleApplyResourceTypeDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter>
                      </FilterSortDialogContent>
                    </FilterSortDialog>
                    {canManageAny && <Button onClick={handleOpenNewResourceTypeDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Type</Button>}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingData && filteredResourceTypesWithCount.length === 0 && !activeResourceTypeSearchTerm ? ( <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
                  ) : filteredResourceTypesWithCount.length > 0 ? (
                    <div className="overflow-x-auto border rounded-md shadow-sm">
                      <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-center"># Resources</TableHead>{canManageAny && <TableHead className="text-right w-[100px]">Actions</TableHead>}</TableRow></TableHeader>
                        <TableBody>{filteredResourceTypesWithCount.map(type => (
                          <TableRow key={type.id}>
                            <TableCell className="font-medium">{type.name}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-md truncate" title={type.description || undefined}>{type.description || 'N/A'}</TableCell>
                            <TableCell className="text-center">{type.resourceCount}</TableCell>
                            {canManageAny && <TableCell className="text-right space-x-1">
                              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditResourceTypeDialog(type)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Type</TooltipContent></Tooltip>
                              <AlertDialog open={typeToDelete?.id === type.id} onOpenChange={(isOpen) => !isOpen && setTypeToDelete(null)}>
                                <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setTypeToDelete(type)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Type</TooltipContent></Tooltip>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Delete "{typeToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Ensure no resources use this type.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => typeToDelete && handleDeleteResourceType(typeToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell>}
                          </TableRow>
                        ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <ListChecks className="h-12 w-12 mx-auto mb-3 opacity-50"/>
                      <p className="font-medium">{activeResourceTypeFilterCount > 0 ? "No types match criteria." : "No resource types defined."}</p>
                      {activeResourceTypeFilterCount > 0 && <Button variant="link" onClick={resetAllActiveResourceTypePageFilters} className="mt-2 text-xs"><FilterX className="mr-1.5 h-3.5 w-3.5"/>Reset Filters</Button>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
             {/* Placeholder for other system-wide tabs */}
            <TabsContent value="labs" className="mt-6"><Card><CardHeader><CardTitle>Manage Labs</CardTitle></CardHeader><CardContent><p>Lab management UI (list, add, edit, delete labs) will be here.</p></CardContent></Card></TabsContent>
            <TabsContent value="global-closures" className="mt-6"><Card><CardHeader><CardTitle>Global Closures</CardTitle></CardHeader><CardContent><p>Global blackout dates and recurring rules UI will be here.</p></CardContent></Card></TabsContent>
            <TabsContent value="maintenance-log" className="mt-6"><Card><CardHeader><CardTitle>System-Wide Maintenance Log</CardTitle></CardHeader><CardContent><p>Full maintenance log UI will be here.</p></CardContent></Card></TabsContent>
            <TabsContent value="lab-access-requests" className="mt-6"><Card><CardHeader><CardTitle>System-Wide Lab Access Requests</CardTitle></CardHeader><CardContent><p>Lab access requests management UI will be here.</p></CardContent></Card></TabsContent>
          </Tabs>
        )}

        {/* {!isLoadingData && activeContextId !== GLOBAL_CONTEXT_VALUE && selectedLabDetails && (
           <Tabs defaultValue={searchParamsObj.get('tab') || "lab-details"} className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                  <TabsTrigger value="lab-details">Lab Overview</TabsTrigger>
                  <TabsTrigger value="lab-closures">Closures</TabsTrigger>
                  <TabsTrigger value="lab-maintenance">Maintenance</TabsTrigger>
                  <TabsTrigger value="lab-members">Members & Access</TabsTrigger>
              </TabsList>

              <TabsContent value="lab-details" className="mt-6"><Card><CardHeader><CardTitle>{selectedLabDetails.name} - Overview</CardTitle></CardHeader><CardContent><p>Lab-specific overview content here.</p></CardContent></Card></TabsContent>
              <TabsContent value="lab-closures" className="mt-6"><Card><CardHeader><CardTitle>{selectedLabDetails.name} - Closures</CardTitle></CardHeader><CardContent><p>Lab-specific closures management here.</p></CardContent></Card></TabsContent>
              <TabsContent value="lab-maintenance" className="mt-6"><Card><CardHeader><CardTitle>{selectedLabDetails.name} - Maintenance</CardTitle></CardHeader><CardContent><p>Lab-specific maintenance log here.</p></CardContent></Card></TabsContent>
              <TabsContent value="lab-members" className="mt-6"><Card><CardHeader><CardTitle>{selectedLabDetails.name} - Members & Access</CardTitle></CardHeader><CardContent><p>Lab-specific members and access management here.</p></CardContent></Card></TabsContent>
          </Tabs>
        )} */}


        {isResourceTypeFormDialogOpen && currentUser && (<ResourceTypeFormDialog open={isResourceTypeFormDialogOpen} onOpenChange={(isOpen) => { setIsResourceTypeFormDialogOpen(isOpen); if (!isOpen) setEditingType(null); }} initialType={editingType} onSave={handleSaveResourceType} />)}
        {/* {isLabFormDialogOpen && currentUser && (<LabFormDialog open={isLabFormDialogOpen} onOpenChange={(isOpen) => { setIsLabFormDialogOpen(isOpen); if (!isOpen) setEditingLab(null); }} initialLab={editingLab} onSave={handleSaveLab} />)} */}
        {/* {isDateFormDialogOpen && currentUser && (<BlackoutDateFormDialog open={isDateFormDialogOpen} onOpenChange={setIsDateFormDialogOpen} initialBlackoutDate={editingBlackoutDate} onSave={handleSaveBlackoutDate} labs={labs} currentLabContextId={activeContextId} />)} */}
        {/* {isRecurringFormDialogOpen && currentUser && (<RecurringBlackoutRuleFormDialog open={isRecurringFormDialogOpen} onOpenChange={setIsRecurringFormDialogOpen} initialRule={editingRecurringRule} onSave={handleSaveRecurringRule} labs={labs} currentLabContextId={activeContextId} />)} */}
        {/* {isMaintenanceFormDialogOpen && currentUser && (<MaintenanceRequestFormDialog open={isMaintenanceFormDialogOpen} onOpenChange={(isOpen) => { setIsMaintenanceFormDialogOpen(isOpen); if (!isOpen) setEditingMaintenanceRequest(null);}} initialRequest={editingMaintenanceRequest} onSave={handleSaveMaintenanceRequest} technicians={allTechniciansForMaintenance} resources={allResourcesForCountsAndChecks} currentUserRole={currentUser?.role} labContextId={activeContextId !== GLOBAL_CONTEXT_VALUE ? activeContextId : undefined}/> )} */}
        {/* {isManualAddMemberDialogOpen && currentUser && (
          <ManageUserLabAccessDialog
              targetUser={null}
              allLabs={labs}
              open={isManualAddMemberDialogOpen}
              onOpenChange={(isOpen) => {
                  setIsManualAddMemberDialogOpen(isOpen);
              }}
              onMembershipUpdate={fetchAllAdminData}
              performMembershipAction={handleMembershipAction} // Pass the correctly scoped action handler
              preselectedLabId={activeContextId !== GLOBAL_CONTEXT_VALUE ? activeContextId : undefined}
          />
        )} */}
      </div>
    </TooltipProvider>
  );
}
