
'use client';

// All original imports are kept, but most will be unused temporarily.
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation'; // Added
import { PageHeader } from '@/components/layout/page-header';
import { Cog, ListChecks, PackagePlus, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon, Loader2, X, CheckCircle2, Building, PlusCircle, CalendarOff, Repeat, Wrench, ListFilter, PenToolIcon, AlertCircle, CheckCircle as LucideCheckCircle, Globe, Users, ThumbsUp, ThumbsDown, Settings, SlidersHorizontal, ArrowLeft, Settings2, ShieldCheck, ShieldOff, CalendarDays, Info as InfoIcon, Package as PackageIcon, Users2, UserCog, CalendarCheck } from 'lucide-react';
import type { ResourceType, Resource, Lab, BlackoutDate, RecurringBlackoutRule, MaintenanceRequest, MaintenanceRequestStatus, User, LabMembership, LabMembershipStatus, DayOfWeek } from '@/types';
import { useAuth } from '@/components/auth-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import {
  Dialog as FilterSortDialog, // Renamed to avoid conflict with ShadCN's Dialog
  DialogContent as FilterSortDialogContent,
  DialogDescription as FilterSortDialogDescription,
  DialogHeader as FilterSortDialogHeader,
  DialogTitle as FilterSortDialogTitle,
  DialogFooter as FilterSortDialogFooter,
  DialogTrigger as FilterSortDialogTrigger,
} from '@/components/ui/dialog'; // Keep this alias for Filter/Sort dialogs
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
import { cn, formatDateSafe, getResourceStatusBadge as getResourceUIAvailabilityBadge } from '@/lib/utils'; // Renamed to avoid conflict

// Sorting options
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

// Helper: Maintenance Status Badge (Specific to this page to avoid conflicts if utils.tsx is changed)
const getMaintenanceStatusBadge = (status: MaintenanceRequestStatus) => {
  switch (status) {
    case 'Open': return <Badge variant="destructive" className="bg-red-500 text-white border-transparent"><AlertCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'In Progress': return <Badge variant="secondary" className="bg-yellow-500 text-yellow-950 border-transparent"><PenToolIcon className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Resolved': return <Badge className="bg-blue-500 text-white border-transparent"><LucideCheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Closed': return <Badge className="bg-green-500 text-white border-transparent"><LucideCheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};


export default function LabOperationsCenterPage() {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const searchParamsObj = useSearchParams();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [activeContextId, setActiveContextId] = useState<string>(GLOBAL_CONTEXT_VALUE);
    const [isLabAccessRequestLoading, setIsLabAccessRequestLoading] = useState(true);

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
    const [labToDelete, setLabToDelete] = useState<Lab | null>(null);
    const [isLabFormDialogOpen, setIsLabFormDialogOpen] = useState(false);
    const [editingLab, setEditingLab] = useState<Lab | null>(null);
    const [isLabFilterDialogOpen, setIsLabFilterDialogOpen] = useState(false);
    const [tempLabSearchTerm, setTempLabSearchTerm] = useState('');
    const [activeLabSearchTerm, setActiveLabSearchTerm] = useState('');
    const [tempLabSortBy, setTempLabSortBy] = useState<string>('name-asc');
    const [activeLabSortBy, setActiveLabSortBy] = useState<string>('name-asc');

    // --- Blackout Dates & Recurring Rules State (Used by both Global and Lab-Specific) ---
    const [allBlackoutDates, setAllBlackoutDates] = useState<BlackoutDate[]>([]);
    const [allRecurringRules, setAllRecurringRules] = useState<RecurringBlackoutRule[]>([]);

    // --- Global Closures State ---
    const [activeGlobalClosuresTab, setActiveGlobalClosuresTab] = useState('specific-dates-global');
    const [isGlobalDateFormDialogOpen, setIsGlobalDateFormDialogOpen] = useState(false);
    const [editingGlobalBlackoutDate, setEditingGlobalBlackoutDate] = useState<BlackoutDate | null>(null);
    const [globalDateToDelete, setGlobalDateToDelete] = useState<BlackoutDate | null>(null);
    const [isGlobalRecurringFormDialogOpen, setIsGlobalRecurringFormDialogOpen] = useState(false);
    const [editingGlobalRecurringRule, setEditingGlobalRecurringRule] = useState<RecurringBlackoutRule | null>(null);
    const [globalRuleToDelete, setGlobalRuleToDelete] = useState<RecurringBlackoutRule | null>(null);
    const [isGlobalClosureFilterDialogOpen, setIsGlobalClosureFilterDialogOpen] = useState(false);
    const [tempGlobalClosureSearchTerm, setTempGlobalClosureSearchTerm] = useState('');
    const [activeGlobalClosureSearchTerm, setActiveGlobalClosureSearchTerm] = useState('');

    // --- Maintenance Requests State ---
    const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
    const [allTechniciansForMaintenance, setAllTechniciansForMaintenance] = useState<User[]>([]);
    const [allUsersData, setAllUsersData] = useState<User[]>([]);
    const [isMaintenanceFormDialogOpen, setIsMaintenanceFormDialogOpen] = useState(false);
    const [editingMaintenanceRequest, setEditingMaintenanceRequest] = useState<MaintenanceRequest | null>(null);
    const [isMaintenanceFilterDialogOpen, setIsMaintenanceFilterDialogOpen] = useState(false);
    const [tempMaintenanceSearchTerm, setTempMaintenanceSearchTerm] = useState('');
    const [tempMaintenanceFilterStatus, setTempMaintenanceFilterStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
    const [tempMaintenanceFilterResourceId, setTempMaintenanceFilterResourceId] = useState<string>('all');
    const [tempMaintenanceFilterTechnicianId, setTempMaintenanceFilterTechnicianId] = useState<string>('all');
    const [activeMaintenanceSearchTerm, setActiveMaintenanceSearchTerm] = useState('');
    const [activeMaintenanceFilterStatus, setActiveMaintenanceFilterStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
    const [activeMaintenanceFilterResourceId, setActiveMaintenanceFilterResourceId] = useState<string>('all');
    const [activeMaintenanceFilterTechnicianId, setActiveMaintenanceFilterTechnicianId] = useState<string>('all');


    // --- Lab Access & Membership State ---
    const [allLabAccessRequests, setAllLabAccessRequests] = useState<LabMembershipRequest[]>([]);
    const [userLabMemberships, setUserLabMemberships] = useState<LabMembership[]>([]);

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

        setAllBlackoutDates(boSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as BlackoutDate)));
        setAllRecurringRules(rrSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as RecurringBlackoutRule)));

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
        const preselectedLabIdFromUrl = searchParamsObj.get('labId');
        if (preselectedLabIdFromUrl && labs.find(l => l.id === preselectedLabIdFromUrl)) {
          setActiveContextId(preselectedLabIdFromUrl);
        } else if (preselectedLabIdFromUrl) {
          // If labId in URL is invalid, default to global
          setActiveContextId(GLOBAL_CONTEXT_VALUE);
        }
        // If no labId in URL, activeContextId remains as its initial value (GLOBAL_CONTEXT_VALUE)
      }, [searchParamsObj, labs]); // labs dependency ensures this runs after labs are fetched

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
    }, []);

    const handleOpenEditResourceTypeDialog = useCallback((type: ResourceType) => {
        setEditingType(type);
        setIsResourceTypeFormDialogOpen(true);
    }, []);

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
    useEffect(() => {
        if (isLabFilterDialogOpen) {
            setTempLabSearchTerm(activeLabSearchTerm);
            setTempLabSortBy(activeLabSortBy);
        }
    }, [isLabFilterDialogOpen, activeLabSearchTerm, activeLabSortBy]);

    const filteredLabs = useMemo(() => {
        let currentLabs = [...labs];
        const lowerSearchTerm = activeLabSearchTerm.toLowerCase();
        if (activeLabSearchTerm) {
            currentLabs = currentLabs.filter(lab =>
                lab.name.toLowerCase().includes(lowerSearchTerm) ||
                (lab.location && lab.location.toLowerCase().includes(lowerSearchTerm)) ||
                (lab.description && lab.description.toLowerCase().includes(lowerSearchTerm))
            );
        }
        const [column, direction] = activeLabSortBy.split('-') as [LabSortableColumn, 'asc' | 'desc'];
        const labsWithCounts = currentLabs.map(lab => ({
            ...lab,
            resourceCount: allResourcesForCountsAndChecks.filter(res => res.labId === lab.id).length,
            memberCount: userLabMemberships.filter(mem => mem.labId === lab.id && mem.status === 'active').length,
        }));

        labsWithCounts.sort((a, b) => {
            let comparison = 0;
            if (column === 'name') comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
            else if (column === 'location') comparison = (a.location || '').toLowerCase().localeCompare((b.location || '').toLowerCase());
            else if (column === 'resourceCount') comparison = a.resourceCount - b.resourceCount;
            else if (column === 'memberCount') comparison = a.memberCount - b.memberCount;
            return direction === 'asc' ? comparison : -comparison;
        });
        return labsWithCounts;
    }, [labs, activeLabSearchTerm, activeLabSortBy, allResourcesForCountsAndChecks, userLabMemberships]);

    const handleApplyLabDialogFilters = useCallback(() => {
        setActiveLabSearchTerm(tempLabSearchTerm);
        setActiveLabSortBy(tempLabSortBy);
        setIsLabFilterDialogOpen(false);
    }, [tempLabSearchTerm, tempLabSortBy]);

    const resetLabDialogFiltersOnly = useCallback(() => {
        setTempLabSearchTerm('');
        setTempLabSortBy('name-asc');
    }, []);

    const resetAllActiveLabPageFilters = useCallback(() => {
        setActiveLabSearchTerm('');
        setActiveLabSortBy('name-asc');
        resetLabDialogFiltersOnly();
        setIsLabFilterDialogOpen(false);
    }, [resetLabDialogFiltersOnly]);

    const handleOpenNewLabDialog = useCallback(() => {
        setEditingLab(null);
        setIsLabFormDialogOpen(true);
    }, []);

    const handleOpenEditLabDialog = useCallback((lab: Lab) => {
        setEditingLab(lab);
        setIsLabFormDialogOpen(true);
    }, []);

    const handleSaveLab = useCallback(async (data: LabFormValues) => {
        if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; }
        setIsLoadingData(true);
        try {
            const labDataToSave: Partial<Omit<Lab, 'id' | 'createdAt' | 'lastUpdatedAt'>> & { lastUpdatedAt?: any, createdAt?: any } = {
                name: data.name,
                location: data.location || null,
                description: data.description || null,
            };
            const auditAction = editingLab ? 'LAB_UPDATED' : 'LAB_CREATED';
            let entityId = editingLab ? editingLab.id : '';
            if (editingLab) {
                labDataToSave.lastUpdatedAt = serverTimestamp();
                await updateDoc(doc(db, "labs", entityId), labDataToSave as any);
            } else {
                labDataToSave.createdAt = serverTimestamp();
                const docRef = await addDoc(collection(db, "labs"), labDataToSave as any);
                entityId = docRef.id;
            }
            await addAuditLog(currentUser.id, currentUser.name, auditAction, { entityType: 'Lab', entityId, details: `Lab '${data.name}' ${editingLab ? 'updated' : 'created'}.` });
            toast({ title: `Lab ${editingLab ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingLab ? 'updated' : 'created'}.` });
            setIsLabFormDialogOpen(false);
            setEditingLab(null);
            await fetchAllAdminData();
        } catch (error: any) {
            toast({ title: "Save Error", description: `Could not save lab: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoadingData(false);
        }
    }, [currentUser, canManageAny, editingLab, fetchAllAdminData, toast, setIsLoadingData, setIsLabFormDialogOpen, setEditingLab]);

    const handleDeleteLab = useCallback(async (labId: string) => {
        if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; }
        const deletedLab = labs.find(lab => lab.id === labId);
        if (!deletedLab) { toast({ title: "Error", description: "Lab not found.", variant: "destructive" }); return; }
        const resourcesInThisLab = allResourcesForCountsAndChecks.filter(res => res.labId === labId).length;
        if (resourcesInThisLab > 0) {
            toast({ title: "Deletion Blocked", description: `Cannot delete lab "${deletedLab.name}" as ${resourcesInThisLab} resource(s) are assigned. Reassign them first.`, variant: "destructive", duration: 7000 });
            setLabToDelete(null);
            return;
        }
        const membersInThisLab = userLabMemberships.filter(mem => mem.labId === labId && mem.status === 'active').length;
        if (membersInThisLab > 0) {
            toast({ title: "Deletion Blocked", description: `Cannot delete lab "${deletedLab.name}" as it has ${membersInThisLab} active member(s). Please remove or reassign members first.`, variant: "destructive", duration: 7000 });
            setLabToDelete(null);
            return;
        }

        setIsLoadingData(true);
        try {
            await deleteDoc(doc(db, "labs", labId));
            await addAuditLog(currentUser.id, currentUser.name, 'LAB_DELETED', { entityType: 'Lab', entityId: labId, details: `Lab '${deletedLab.name}' deleted.` });
            toast({ title: "Lab Deleted", description: `Lab "${deletedLab.name}" removed.`, variant: "destructive" });
            setLabToDelete(null);
            await fetchAllAdminData();
            if (activeContextId === labId) {
                setActiveContextId(GLOBAL_CONTEXT_VALUE);
            }
        } catch (error: any) {
            toast({ title: "Delete Error", description: `Could not delete lab: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoadingData(false);
        }
    }, [currentUser, canManageAny, labs, allResourcesForCountsAndChecks, userLabMemberships, fetchAllAdminData, toast, setIsLoadingData, setLabToDelete, activeContextId, setActiveContextId]);

    const activeLabFilterCount = useMemo(() => [activeLabSearchTerm !== '', activeLabSortBy !== 'name-asc'].filter(Boolean).length, [activeLabSearchTerm, activeLabSortBy]);

    // --- Global Closures Logic ---
    useEffect(() => {
        if (isGlobalClosureFilterDialogOpen) {
            setTempGlobalClosureSearchTerm(activeGlobalClosureSearchTerm);
        }
    }, [isGlobalClosureFilterDialogOpen, activeGlobalClosureSearchTerm]);
    
    const filteredGlobalBlackoutDates = useMemo(() => {
        return allBlackoutDates.filter(bd => {
            const isGlobal = !bd.labId;
            const lowerSearchTerm = activeGlobalClosureSearchTerm.toLowerCase();
            const reasonMatch = bd.reason && bd.reason.toLowerCase().includes(lowerSearchTerm);
            const dateString = typeof bd.date === 'string' ? bd.date : (bd.date as unknown as Timestamp)?.toDate()?.toISOString().split('T')[0];
            const dateMatch = dateString && isValidDateFn(parseISO(dateString)) && format(parseISO(dateString), 'PPP').toLowerCase().includes(lowerSearchTerm);
            return isGlobal && (!activeGlobalClosureSearchTerm || reasonMatch || dateMatch);
        });
    }, [allBlackoutDates, activeGlobalClosureSearchTerm]);

    const filteredGlobalRecurringRules = useMemo(() => {
        return allRecurringRules.filter(rule => {
            const isGlobal = !rule.labId;
            const lowerSearchTerm = activeGlobalClosureSearchTerm.toLowerCase();
            const nameMatch = rule.name && rule.name.toLowerCase().includes(lowerSearchTerm);
            const reasonMatch = rule.reason && rule.reason.toLowerCase().includes(lowerSearchTerm);
            return isGlobal && (!activeGlobalClosureSearchTerm || nameMatch || reasonMatch);
        });
    }, [allRecurringRules, activeGlobalClosureSearchTerm]);

    const handleOpenNewGlobalDateDialog = useCallback(() => { setEditingGlobalBlackoutDate(null); setIsGlobalDateFormDialogOpen(true); }, []);
    const handleOpenEditGlobalDateDialog = useCallback((bd: BlackoutDate) => { setEditingGlobalBlackoutDate(bd); setIsGlobalDateFormDialogOpen(true); }, []);
    
    const handleSaveGlobalBlackoutDate = useCallback(async (data: BlackoutDateDialogFormValues) => {
        if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; }
        const formattedDateOnly = format(data.date, 'yyyy-MM-dd');
        const displayDate = format(data.date, 'PPP');
        const blackoutDataToSave: Omit<BlackoutDate, 'id'> = {
            labId: null, 
            date: formattedDateOnly,
            reason: data.reason || undefined,
        };
        setIsLoadingData(true);
        try {
            if (editingGlobalBlackoutDate) {
                await updateDoc(doc(db, "blackoutDates", editingGlobalBlackoutDate.id), blackoutDataToSave as any);
                addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_UPDATED', { entityType: 'BlackoutDate', entityId: editingGlobalBlackoutDate.id, details: `Global Blackout Date for ${displayDate} updated. Reason: ${data.reason || 'N/A'}`});
                toast({ title: 'Global Blackout Date Updated'});
            } else {
                const docRef = await addDoc(collection(db, "blackoutDates"), blackoutDataToSave);
                addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_CREATED', { entityType: 'BlackoutDate', entityId: docRef.id, details: `Global Blackout Date for ${displayDate} created. Reason: ${data.reason || 'N/A'}`});
                toast({ title: 'Global Blackout Date Added'});
            }
            setIsGlobalDateFormDialogOpen(false);
            setEditingGlobalBlackoutDate(null);
            await fetchAllAdminData();
        } catch (error: any) { toast({ title: "Save Failed", description: `Failed to save global blackout date: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, editingGlobalBlackoutDate, fetchAllAdminData, toast]);

    const handleDeleteGlobalBlackoutDate = useCallback(async (blackoutDateId: string) => {
        if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; }
        const deletedDateObj = allBlackoutDates.find(bd => bd.id === blackoutDateId);
        if (!deletedDateObj) return;
        const dateString = typeof deletedDateObj.date === 'string' ? deletedDateObj.date : (deletedDateObj.date as unknown as Timestamp)?.toDate()?.toISOString().split('T')[0];
        setIsLoadingData(true);
        try {
            await deleteDoc(doc(db, "blackoutDates", blackoutDateId));
            addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_DELETED', { entityType: 'BlackoutDate', entityId: blackoutDateId, details: `Global Blackout Date for ${dateString ? format(parseISO(dateString), 'PPP') : 'Invalid Date'} (Reason: ${deletedDateObj.reason || 'N/A'}) deleted.`});
            toast({ title: "Global Blackout Date Removed", variant: "destructive" });
            setGlobalDateToDelete(null);
            await fetchAllAdminData();
        } catch (error: any) { toast({ title: "Delete Failed", description: `Failed to delete global blackout date: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, allBlackoutDates, fetchAllAdminData, toast]);

    const handleOpenNewGlobalRecurringDialog = useCallback(() => { setEditingGlobalRecurringRule(null); setIsGlobalRecurringFormDialogOpen(true); }, []);
    const handleOpenEditGlobalRecurringDialog = useCallback((rule: RecurringBlackoutRule) => { setEditingGlobalRecurringRule(rule); setIsGlobalRecurringFormDialogOpen(true); }, []);

    const handleSaveGlobalRecurringRule = useCallback(async (data: RecurringRuleDialogFormValues) => {
        if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; }
        const ruleDataToSave: Omit<RecurringBlackoutRule, 'id'> = {
            labId: null, 
            name: data.name,
            daysOfWeek: data.daysOfWeek,
            reason: data.reason || undefined,
        };
        setIsLoadingData(true);
        try {
            if (editingGlobalRecurringRule) {
                await updateDoc(doc(db, "recurringBlackoutRules", editingGlobalRecurringRule.id), ruleDataToSave as any);
                addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_UPDATED', { entityType: 'RecurringBlackoutRule', entityId: editingGlobalRecurringRule.id, details: `Global recurring rule '${data.name}' updated.`});
                toast({ title: 'Global Recurring Rule Updated'});
            } else {
                const docRef = await addDoc(collection(db, "recurringBlackoutRules"), ruleDataToSave);
                addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_CREATED', { entityType: 'RecurringBlackoutRule', entityId: docRef.id, details: `Global recurring rule '${data.name}' created.`});
                toast({ title: 'Global Recurring Rule Added'});
            }
            setIsGlobalRecurringFormDialogOpen(false);
            setEditingGlobalRecurringRule(null);
            await fetchAllAdminData();
        } catch (error: any) { toast({ title: "Save Failed", description: `Failed to save global recurring rule: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, editingGlobalRecurringRule, fetchAllAdminData, toast]);

    const handleDeleteGlobalRecurringRule = useCallback(async (ruleId: string) => {
        if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; }
        const deletedRuleObj = allRecurringRules.find(r => r.id === ruleId);
        if (!deletedRuleObj) return;
        setIsLoadingData(true);
        try {
            await deleteDoc(doc(db, "recurringBlackoutRules", ruleId));
            addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_DELETED', { entityType: 'RecurringBlackoutRule', entityId: ruleId, details: `Global recurring rule '${deletedRuleObj.name}' deleted.`});
            toast({ title: "Global Recurring Rule Removed", variant: "destructive" });
            setGlobalRuleToDelete(null);
            await fetchAllAdminData();
        } catch (error: any) { toast({ title: "Delete Failed", description: `Failed to delete global recurring rule: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, allRecurringRules, fetchAllAdminData, toast]);
    
    const handleApplyGlobalClosureDialogFilters = useCallback(() => {
        setActiveGlobalClosureSearchTerm(tempGlobalClosureSearchTerm);
        setIsGlobalClosureFilterDialogOpen(false);
    }, [tempGlobalClosureSearchTerm]);

    const resetGlobalClosureDialogFiltersOnly = useCallback(() => {
        setTempGlobalClosureSearchTerm('');
    }, []);
    
    const resetAllActiveGlobalClosurePageFilters = useCallback(() => {
        setActiveGlobalClosureSearchTerm('');
        resetGlobalClosureDialogFiltersOnly();
        setIsGlobalClosureFilterDialogOpen(false);
    }, [resetGlobalClosureDialogFiltersOnly]);

    const activeGlobalClosureFilterCount = useMemo(() => [activeGlobalClosureSearchTerm !== ''].filter(Boolean).length, [activeGlobalClosureSearchTerm]);


    // --- Maintenance Requests Logic (System-Wide View) ---
    useEffect(() => {
        if (isMaintenanceFilterDialogOpen) {
            setTempMaintenanceSearchTerm(activeMaintenanceSearchTerm);
            setTempMaintenanceFilterStatus(activeMaintenanceFilterStatus);
            setTempMaintenanceFilterResourceId(activeMaintenanceFilterResourceId);
            setTempMaintenanceFilterTechnicianId(activeMaintenanceFilterTechnicianId);
        }
    }, [isMaintenanceFilterDialogOpen, activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId]);

    const filteredMaintenanceRequests = useMemo(() => {
        return maintenanceRequests.map(req => {
            const resource = allResourcesForCountsAndChecks.find(r => r.id === req.resourceId);
            const reporter = allUsersData.find(u => u.id === req.reportedByUserId);
            const technician = allTechniciansForMaintenance.find(t => t.id === req.assignedTechnicianId);
            return {
                ...req,
                resourceName: resource?.name || 'Unknown Resource',
                resourceLabId: resource?.labId, // Needed for filtering by lab context
                reportedByUserName: reporter?.name || 'Unknown User',
                assignedTechnicianName: technician?.name,
            };
        }).filter(req => {
            // For global view, no lab context filter is applied here. It will be applied for lab-specific view.
            const lowerSearchTerm = activeMaintenanceSearchTerm.toLowerCase();
            const searchMatch = !activeMaintenanceSearchTerm ||
                (req.resourceName && req.resourceName.toLowerCase().includes(lowerSearchTerm)) ||
                (req.reportedByUserName && req.reportedByUserName.toLowerCase().includes(lowerSearchTerm)) ||
                (req.issueDescription && req.issueDescription.toLowerCase().includes(lowerSearchTerm)) ||
                (req.assignedTechnicianName && req.assignedTechnicianName.toLowerCase().includes(lowerSearchTerm));
            const statusMatch = activeMaintenanceFilterStatus === 'all' || req.status === activeMaintenanceFilterStatus;
            const resourceMatch = activeMaintenanceFilterResourceId === 'all' || req.resourceId === activeMaintenanceFilterResourceId;
            let technicianMatch = true;
            if (activeMaintenanceFilterTechnicianId !== 'all') {
                if (activeMaintenanceFilterTechnicianId === '--unassigned--') {
                    technicianMatch = !req.assignedTechnicianId;
                } else {
                    technicianMatch = req.assignedTechnicianId === activeMaintenanceFilterTechnicianId;
                }
            }
            return searchMatch && statusMatch && resourceMatch && technicianMatch;
        });
    }, [maintenanceRequests, allResourcesForCountsAndChecks, allTechniciansForMaintenance, allUsersData, activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId]);

    const handleApplyMaintenanceDialogFilters = useCallback(() => {
        setActiveMaintenanceSearchTerm(tempMaintenanceSearchTerm.toLowerCase());
        setActiveMaintenanceFilterStatus(tempMaintenanceFilterStatus);
        setActiveMaintenanceFilterResourceId(tempMaintenanceFilterResourceId);
        setActiveMaintenanceFilterTechnicianId(tempMaintenanceFilterTechnicianId);
        setIsMaintenanceFilterDialogOpen(false);
    }, [tempMaintenanceSearchTerm, tempMaintenanceFilterStatus, tempMaintenanceFilterResourceId, tempMaintenanceFilterTechnicianId]);

    const resetMaintenanceDialogFiltersOnly = useCallback(() => {
        setTempMaintenanceSearchTerm('');
        setTempMaintenanceFilterStatus('all');
        setTempMaintenanceFilterResourceId('all');
        setTempMaintenanceFilterTechnicianId('all');
    }, []);

    const resetAllActiveMaintenancePageFilters = useCallback(() => {
        setActiveMaintenanceSearchTerm('');
        setActiveMaintenanceFilterStatus('all');
        setActiveMaintenanceFilterResourceId('all');
        setActiveMaintenanceFilterTechnicianId('all');
        resetMaintenanceDialogFiltersOnly();
        setIsMaintenanceFilterDialogOpen(false);
    }, [resetMaintenanceDialogFiltersOnly]);

    const handleOpenNewMaintenanceDialog = useCallback(() => {
        if (!currentUser) return;
        setEditingMaintenanceRequest(null);
        setIsMaintenanceFormDialogOpen(true);
    }, [currentUser]);

    const handleOpenEditMaintenanceDialog = useCallback((request: MaintenanceRequest) => {
        setEditingMaintenanceRequest(request);
        setIsMaintenanceFormDialogOpen(true);
    }, []);

    const handleSaveMaintenanceRequest = useCallback(async (data: MaintenanceDialogFormValues) => {
        if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Error", variant: "destructive"}); return;}
        const resource = allResourcesForCountsAndChecks.find(r => r.id === data.resourceId);
        if (!resource) { toast({ title: "Error", variant: "destructive" }); return;}

        let dateResolvedForFirestore: Timestamp | null = null;
        if ((data.status === 'Resolved' || data.status === 'Closed') && data.dateResolved && isValidDateFn(parseISO(data.dateResolved))) {
            dateResolvedForFirestore = Timestamp.fromDate(parseISO(data.dateResolved));
        } else if ((data.status === 'Resolved' || data.status === 'Closed') && !editingMaintenanceRequest?.dateResolved) {
            dateResolvedForFirestore = serverTimestamp() as Timestamp;
        } else if (editingMaintenanceRequest?.dateResolved && (data.status === 'Resolved' || data.status === 'Closed')) {
            dateResolvedForFirestore = Timestamp.fromDate(editingMaintenanceRequest.dateResolved);
        }

        const requestDataToSave: any = {
            resourceId: data.resourceId,
            issueDescription: data.issueDescription,
            status: data.status,
            assignedTechnicianId: data.assignedTechnicianId === '--unassigned--' || !data.assignedTechnicianId ? null : data.assignedTechnicianId,
            resolutionNotes: data.resolutionNotes || null,
            dateResolved: dateResolvedForFirestore,
        };
        setIsLoadingData(true);
        try {
            if (editingMaintenanceRequest) {
                await updateDoc(doc(db, "maintenanceRequests", editingMaintenanceRequest.id), requestDataToSave);
                await addAuditLog(currentUser.id, currentUser.name, 'MAINTENANCE_UPDATED', { entityType: 'MaintenanceRequest', entityId: editingMaintenanceRequest.id, details: `Maintenance request for '${resource.name}' updated. Status: ${data.status}.`});
                toast({ title: 'Request Updated'});
                if ((data.status === 'Resolved' && editingMaintenanceRequest.status !== 'Resolved') && editingMaintenanceRequest.reportedByUserId !== currentUser.id && editingMaintenanceRequest.reportedByUserId) {
                    await addNotification( editingMaintenanceRequest.reportedByUserId, 'Maintenance Resolved', `Issue for ${resource.name} resolved.`, 'maintenance_resolved', `/maintenance?requestId=${editingMaintenanceRequest.id}`);
                }
                if (data.assignedTechnicianId && data.assignedTechnicianId !== editingMaintenanceRequest.assignedTechnicianId && data.assignedTechnicianId !== '--unassigned--') {
                    await addNotification( data.assignedTechnicianId, 'Maintenance Task Assigned', `Task for ${resource.name}: ${data.issueDescription.substring(0,50)}...`, 'maintenance_assigned', `/maintenance?requestId=${editingMaintenanceRequest.id}`);
                }
            } else {
                const newRequestPayload = { ...requestDataToSave, reportedByUserId: currentUser.id, dateReported: serverTimestamp(), };
                const docRef = await addDoc(collection(db, "maintenanceRequests"), newRequestPayload);
                await addAuditLog(currentUser.id, currentUser.name, 'MAINTENANCE_CREATED', { entityType: 'MaintenanceRequest', entityId: docRef.id, details: `New request for '${resource.name}' by ${currentUser.name}.`});
                toast({ title: 'Request Logged'});
                const techIdForNotification = requestDataToSave.assignedTechnicianId;
                if(techIdForNotification && techIdForNotification !== '--unassigned--'){
                    await addNotification( techIdForNotification, 'New Maintenance Request Assigned', `New request for ${resource.name}: ${data.issueDescription.substring(0, 50)}... assigned.`, 'maintenance_assigned', `/maintenance?requestId=${docRef.id}`);
                } else {
                    const usersToNotifyQuery = query(collection(db, 'users'), where('role', 'in', ['Admin', 'Technician']), orderBy('name', 'asc'));
                    const usersToNotifySnapshot = await getDocs(usersToNotifyQuery);
                    const notificationPromises = usersToNotifySnapshot.docs.map(userDoc => {
                        if(userDoc.id !== currentUser?.id) {
                            return addNotification( userDoc.id, 'New Unassigned Maintenance Request', `New request for ${resource.name}: ${data.issueDescription.substring(0, 50)}... needs attention.`, 'maintenance_new', '/admin/inventory?tab=maintenance-log');
                        } return Promise.resolve();
                    });
                    await Promise.all(notificationPromises);
                }
            }
            setIsMaintenanceFormDialogOpen(false);
            setEditingMaintenanceRequest(null);
            await fetchAllAdminData();
        } catch (error: any) { toast({ title: `${editingMaintenanceRequest ? "Update" : "Logging"} Failed`, description: `Failed to ${editingMaintenanceRequest ? "update" : "log"} request: ${error.message}`, variant: "destructive" });
        } finally { setIsLoadingData(false); }
    }, [currentUser, editingMaintenanceRequest, allResourcesForCountsAndChecks, fetchAllAdminData, toast]);

    const activeMaintenanceFilterCount = useMemo(() => [activeMaintenanceSearchTerm !== '', activeMaintenanceFilterStatus !== 'all', activeMaintenanceFilterResourceId !== 'all', activeMaintenanceFilterTechnicianId !== 'all'].filter(Boolean).length, [activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId]);
    const canEditAnyMaintenanceRequest = useMemo(() => currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Technician'), [currentUser]);

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
        // setIsProcessingAction(prev => ({ ...prev, [actionKey]: { action, loading: true } }));

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
          // setIsProcessingAction(prev => ({ ...prev, [actionKey]: { action, loading: false } }));
        }
    }, [currentUser, fetchAllAdminData, toast]);


    if (!currentUser || !canManageAny) {
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

            <TabsContent value="labs" className="mt-6">
              <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div><CardTitle className="text-xl">Labs</CardTitle><p className="text-sm text-muted-foreground mt-1">Define laboratory locations and view their resource/member counts.</p></div>
                  <div className="flex gap-2 flex-wrap">
                    <FilterSortDialog open={isLabFilterDialogOpen} onOpenChange={setIsLabFilterDialogOpen}>
                      <FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter & Sort {activeLabFilterCount > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeLabFilterCount}</Badge>}</Button></FilterSortDialogTrigger>
                      <FilterSortDialogContent className="sm:max-w-md">
                        <FilterSortDialogHeader><FilterSortDialogTitle>Filter & Sort Labs</FilterSortDialogTitle></FilterSortDialogHeader>
                        <Separator className="my-3" />
                        <div className="space-y-3">
                          <div className="relative"><Label htmlFor="labSearchDialog">Search (Name/Loc/Desc)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="labSearchDialog" value={tempLabSearchTerm} onChange={e => setTempLabSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/></div>
                          <div><Label htmlFor="labSortDialog">Sort by</Label><Select value={tempLabSortBy} onValueChange={setTempLabSortBy}><SelectTrigger id="labSortDialog" className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{labSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetLabDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button variant="outline" onClick={() => setIsLabFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button><Button onClick={handleApplyLabDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter>
                      </FilterSortDialogContent>
                    </FilterSortDialog>
                    {canManageAny && <Button onClick={handleOpenNewLabDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Lab</Button>}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingData && filteredLabs.length === 0 && !activeLabSearchTerm ? ( <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
                  ) : filteredLabs.length > 0 ? (
                    <div className="overflow-x-auto rounded-md border shadow-sm">
                      <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead className="text-center">Resources</TableHead><TableHead className="text-center">Members</TableHead>{canManageAny && <TableHead className="text-right w-[140px]">Actions</TableHead>}</TableRow></TableHeader>
                        <TableBody>{filteredLabs.map(lab => (
                          <TableRow key={lab.id}>
                            <TableCell className="font-medium">{lab.name}</TableCell>
                            <TableCell>{lab.location || 'N/A'}</TableCell>
                            <TableCell className="text-center">{(lab as any).resourceCount ?? 0}</TableCell>
                            <TableCell className="text-center">{(lab as any).memberCount ?? 0}</TableCell>
                            {canManageAny && <TableCell className="text-right space-x-1">
                               <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setActiveContextId(lab.id)}><Settings2 className="mr-1.5 h-3.5 w-3.5"/>Manage</Button>
                              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditLabDialog(lab)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Lab Details</TooltipContent></Tooltip>
                              <AlertDialog open={labToDelete?.id === lab.id} onOpenChange={(isOpen) => !isOpen && setLabToDelete(null)}>
                                <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setLabToDelete(lab)} disabled={isLoadingData || ((lab as any).resourceCount ?? 0) > 0 || ((lab as any).memberCount ?? 0) > 0}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger>
                                <TooltipContent>{((lab as any).resourceCount ?? 0) > 0 || ((lab as any).memberCount ?? 0) > 0 ? "Cannot delete: lab has resources or members" : "Delete Lab"}</TooltipContent>
                                </Tooltip>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Delete "{labToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Ensure no resources are assigned and no members are active.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => labToDelete && handleDeleteLab(labToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter>
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
                      <Building className="h-12 w-12 mx-auto mb-3 opacity-50"/>
                      <p className="font-medium">{activeLabFilterCount > 0 ? "No labs match criteria." : "No labs defined."}</p>
                      {activeLabFilterCount > 0 && <Button variant="link" onClick={resetAllActiveLabPageFilters} className="mt-2 text-xs"><FilterX className="mr-1.5 h-3.5 w-3.5"/>Reset Filters</Button>}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
            
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
                                <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setTypeToDelete(type)} disabled={isLoadingData || type.resourceCount > 0}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger>
                                <TooltipContent>{type.resourceCount > 0 ? "Cannot delete: type in use" : "Delete Type"}</TooltipContent>
                                </Tooltip>
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
            
            <TabsContent value="global-closures" className="mt-6">
              <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div><CardTitle className="text-xl">Global Lab Closures</CardTitle><p className="text-sm text-muted-foreground mt-1">Manage blackout dates and recurring rules that apply system-wide (to all labs).</p></div>
                     <FilterSortDialog open={isGlobalClosureFilterDialogOpen} onOpenChange={setIsGlobalClosureFilterDialogOpen}>
                      <FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter Closures {activeGlobalClosureFilterCount > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeGlobalClosureFilterCount}</Badge>}</Button></FilterSortDialogTrigger>
                      <FilterSortDialogContent className="sm:max-w-md">
                        <FilterSortDialogHeader><FilterSortDialogTitle>Filter Global Closures</FilterSortDialogTitle></FilterSortDialogHeader>
                        <Separator className="my-3" />
                        <div className="space-y-3">
                          <div className="relative"><Label htmlFor="globalClosureSearchDialog">Search (Reason/Name/Date)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="globalClosureSearchDialog" value={tempGlobalClosureSearchTerm} onChange={e => setTempGlobalClosureSearchTerm(e.target.value)} placeholder="e.g., Holiday, Weekend, Jan 1" className="mt-1 h-9 pl-8"/></div>
                        </div>
                        <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetGlobalClosureDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button variant="outline" onClick={() => setIsGlobalClosureFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button><Button onClick={handleApplyGlobalClosureDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter>
                      </FilterSortDialogContent>
                    </FilterSortDialog>
                </CardHeader>
                <CardContent>
                  <Tabs value={activeGlobalClosuresTab} onValueChange={setActiveGlobalClosuresTab} className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                      <TabsTrigger value="specific-dates-global"><CalendarDays className="mr-2 h-4 w-4"/>Specific Dates</TabsTrigger>
                      <TabsTrigger value="recurring-rules-global"><Repeat className="mr-2 h-4 w-4"/>Recurring Rules</TabsTrigger>
                    </TabsList>
                    <TabsContent value="specific-dates-global">
                      <div className="flex justify-end mb-3">
                        <Button onClick={handleOpenNewGlobalDateDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Global Date</Button>
                      </div>
                      {isLoadingData && filteredGlobalBlackoutDates.length === 0 && !activeGlobalClosureSearchTerm ? ( <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/></div>
                      ) : filteredGlobalBlackoutDates.length > 0 ? (
                        <div className="overflow-x-auto border rounded-md shadow-sm">
                          <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reason</TableHead><TableHead className="text-right w-[100px]">Actions</TableHead></TableRow></TableHeader>
                          <TableBody>{filteredGlobalBlackoutDates.map(bd => (
                            <TableRow key={bd.id}><TableCell className="font-medium">{formatDateSafe(parseISO(bd.date), 'Invalid Date', 'PPP')}</TableCell><TableCell className="text-sm text-muted-foreground">{bd.reason || 'N/A'}</TableCell>
                            <TableCell className="text-right space-x-1">
                              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditGlobalDateDialog(bd)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Date</TooltipContent></Tooltip>
                              <AlertDialog open={globalDateToDelete?.id === bd.id} onOpenChange={(isOpen) => !isOpen && setGlobalDateToDelete(null)}>
                                <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setGlobalDateToDelete(bd)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Date</TooltipContent></Tooltip>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Delete Global Blackout on {formatDateSafe(globalDateToDelete ? parseISO(globalDateToDelete.date) : new Date(), '', 'PPP')}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => globalDateToDelete && handleDeleteGlobalBlackoutDate(globalDateToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell></TableRow>
                          ))}</TableBody></Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground"><CalendarOff className="h-10 w-10 mx-auto mb-2 opacity-50"/><p className="font-medium">{activeGlobalClosureSearchTerm ? "No global dates match filter." : "No global specific blackout dates."}</p></div>
                      )}
                    </TabsContent>
                    <TabsContent value="recurring-rules-global">
                       <div className="flex justify-end mb-3">
                        <Button onClick={handleOpenNewGlobalRecurringDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Global Rule</Button>
                      </div>
                      {isLoadingData && filteredGlobalRecurringRules.length === 0 && !activeGlobalClosureSearchTerm ? ( <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/></div>
                      ) : filteredGlobalRecurringRules.length > 0 ? (
                        <div className="overflow-x-auto border rounded-md shadow-sm">
                          <Table><TableHeader><TableRow><TableHead>Rule Name</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead><TableHead className="text-right w-[100px]">Actions</TableHead></TableRow></TableHeader>
                          <TableBody>{filteredGlobalRecurringRules.map(rule => (
                            <TableRow key={rule.id}><TableCell className="font-medium">{rule.name}</TableCell><TableCell className="text-sm text-muted-foreground">{rule.daysOfWeek.join(', ')}</TableCell><TableCell className="text-sm text-muted-foreground">{rule.reason || 'N/A'}</TableCell>
                            <TableCell className="text-right space-x-1">
                              <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditGlobalRecurringDialog(rule)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Rule</TooltipContent></Tooltip>
                              <AlertDialog open={globalRuleToDelete?.id === rule.id} onOpenChange={(isOpen) => !isOpen && setGlobalRuleToDelete(null)}>
                                <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setGlobalRuleToDelete(rule)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Rule</TooltipContent></Tooltip>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Delete Global Rule "{globalRuleToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => globalRuleToDelete && handleDeleteGlobalRecurringRule(globalRuleToDelete.id)}>Delete Rule</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </TableCell></TableRow>
                          ))}</TableBody></Table>
                        </div>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground"><Repeat className="h-10 w-10 mx-auto mb-2 opacity-50"/><p className="font-medium">{activeGlobalClosureSearchTerm ? "No global rules match filter." : "No global recurring closure rules."}</p></div>
                      )}
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="maintenance-log" className="mt-6">
              <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                  <div>
                    <CardTitle className="text-xl">System-Wide Maintenance Log</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">View and manage all maintenance requests across labs.</p>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <FilterSortDialog open={isMaintenanceFilterDialogOpen} onOpenChange={setIsMaintenanceFilterDialogOpen}>
                      <FilterSortDialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <ListFilter className="mr-2 h-4 w-4" />Filters 
                          {activeMaintenanceFilterCount > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeMaintenanceFilterCount}</Badge>}
                        </Button>
                      </FilterSortDialogTrigger>
                      <FilterSortDialogContent className="w-full max-w-lg">
                        <FilterSortDialogHeader><FilterSortDialogTitle>Filter Maintenance Requests</FilterSortDialogTitle></FilterSortDialogHeader>
                        <Separator className="my-3" />
                        <div className="space-y-3">
                          <div className="relative">
                            <Label htmlFor="maintenanceSearchDialogSys">Search (Resource/Reporter/Issue/Tech)</Label>
                            <SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" />
                            <Input id="maintenanceSearchDialogSys" value={tempMaintenanceSearchTerm} onChange={e => setTempMaintenanceSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <Label htmlFor="maintenanceStatusDialogSys">Status</Label>
                              <Select value={tempMaintenanceFilterStatus} onValueChange={(v) => setTempMaintenanceFilterStatus(v as MaintenanceRequestStatus | 'all')}>
                                <SelectTrigger id="maintenanceStatusDialogSys" className="h-9 mt-1"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Statuses</SelectItem>{maintenanceRequestStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                            <div>
                              <Label htmlFor="maintenanceResourceDialogSys">Resource</Label>
                              <Select value={tempMaintenanceFilterResourceId} onValueChange={setTempMaintenanceFilterResourceId} disabled={allResourcesForCountsAndChecks.length === 0}>
                                <SelectTrigger id="maintenanceResourceDialogSys" className="h-9 mt-1"><SelectValue placeholder={allResourcesForCountsAndChecks.length > 0 ? "Filter by Resource" : "No resources"} /></SelectTrigger>
                                <SelectContent><SelectItem value="all">All Resources</SelectItem>{allResourcesForCountsAndChecks.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div>
                            <Label htmlFor="maintenanceTechnicianDialogSys">Assigned Technician</Label>
                            <Select value={tempMaintenanceFilterTechnicianId} onValueChange={setTempMaintenanceFilterTechnicianId} disabled={allTechniciansForMaintenance.length === 0}>
                              <SelectTrigger id="maintenanceTechnicianDialogSys" className="h-9 mt-1"><SelectValue placeholder={allTechniciansForMaintenance.length > 0 ? "Filter by Technician" : "No technicians"} /></SelectTrigger>
                              <SelectContent><SelectItem value="all">All/Any</SelectItem><SelectItem value="--unassigned--">Unassigned</SelectItem>{allTechniciansForMaintenance.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </div>
                        </div>
                        <FilterSortDialogFooter className="mt-4 pt-4 border-t">
                          <Button variant="ghost" onClick={resetMaintenanceDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button>
                          <Button variant="outline" onClick={() => setIsMaintenanceFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button>
                          <Button onClick={handleApplyMaintenanceDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button>
                        </FilterSortDialogFooter>
                      </FilterSortDialogContent>
                    </FilterSortDialog>
                    {canManageAny && <Button onClick={handleOpenNewMaintenanceDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Log Request</Button>}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingData && filteredMaintenanceRequests.length === 0 ? (
                    <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2"/>Fetching requests...</div>
                  ) : filteredMaintenanceRequests.length > 0 ? (
                    <div className="overflow-x-auto border rounded-md">
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Resource</TableHead><TableHead className="min-w-[200px]">Issue</TableHead><TableHead>Reported By</TableHead>
                          <TableHead>Date Reported</TableHead><TableHead>Status</TableHead><TableHead>Assigned To</TableHead>
                          {canEditAnyMaintenanceRequest && <TableHead className="text-right w-[100px]">Actions</TableHead>}
                        </TableRow></TableHeader>
                        <TableBody>{filteredMaintenanceRequests.map((request) => (
                          <TableRow key={request.id}>
                            <TableCell className="font-medium">{request.resourceName}</TableCell>
                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={request.issueDescription}>{request.issueDescription}</TableCell>
                            <TableCell>{request.reportedByUserName}</TableCell>
                            <TableCell>{formatDateSafe(request.dateReported, 'N/A', 'MMM dd, yyyy')}</TableCell>
                            <TableCell>{getMaintenanceStatusBadge(request.status)}</TableCell>
                            <TableCell>{request.assignedTechnicianName || <span className="text-xs italic text-muted-foreground">Unassigned</span>}</TableCell>
                            {canEditAnyMaintenanceRequest && (
                              <TableCell className="text-right space-x-1">
                                <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditMaintenanceDialog(request)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Request</TooltipContent></Tooltip>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}</TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <Wrench className="h-12 w-12 mx-auto mb-3 opacity-50"/>
                      <p className="font-medium">{activeMaintenanceFilterCount > 0 ? "No requests match filters." : "No maintenance requests."}</p>
                      {activeMaintenanceFilterCount > 0 ? (<Button variant="outline" size="sm" onClick={resetAllActiveMaintenancePageFilters}><FilterX className="mr-2 h-4 w-4"/>Reset Filters</Button>) : (canManageAny && (<Button onClick={handleOpenNewMaintenanceDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Log First Request</Button>))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="lab-access-requests" className="mt-6"><Card><CardHeader><CardTitle>System-Wide Lab Access Requests</CardTitle></CardHeader><CardContent><p>Lab access requests management UI will be here.</p></CardContent></Card></TabsContent>
          </Tabs>
        )}

        {!isLoadingData && activeContextId !== GLOBAL_CONTEXT_VALUE && selectedLabDetails && (
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
        )}


        {isResourceTypeFormDialogOpen && currentUser && (<ResourceTypeFormDialog open={isResourceTypeFormDialogOpen} onOpenChange={(isOpen) => { setIsResourceTypeFormDialogOpen(isOpen); if (!isOpen) setEditingType(null); }} initialType={editingType} onSave={handleSaveResourceType} />)}
        {isLabFormDialogOpen && currentUser && (<LabFormDialog open={isLabFormDialogOpen} onOpenChange={(isOpen) => { setIsLabFormDialogOpen(isOpen); if (!isOpen) setEditingLab(null); }} initialLab={editingLab} onSave={handleSaveLab} />)}
        
        {isGlobalDateFormDialogOpen && currentUser && (<BlackoutDateFormDialog open={isGlobalDateFormDialogOpen} onOpenChange={setIsGlobalDateFormDialogOpen} initialBlackoutDate={editingGlobalBlackoutDate} onSave={handleSaveGlobalBlackoutDate} labs={labs} currentLabContextId={GLOBAL_CONTEXT_VALUE} />)}
        {isGlobalRecurringFormDialogOpen && currentUser && (<RecurringBlackoutRuleFormDialog open={isGlobalRecurringFormDialogOpen} onOpenChange={setIsGlobalRecurringFormDialogOpen} initialRule={editingGlobalRecurringRule} onSave={handleSaveGlobalRecurringRule} labs={labs} currentLabContextId={GLOBAL_CONTEXT_VALUE} />)}
        
        {isMaintenanceFormDialogOpen && currentUser && (
          <MaintenanceRequestFormDialog
            open={isMaintenanceFormDialogOpen}
            onOpenChange={(isOpen) => {
                setIsMaintenanceFormDialogOpen(isOpen);
                if (!isOpen) setEditingMaintenanceRequest(null);
            }}
            initialRequest={editingMaintenanceRequest}
            onSave={handleSaveMaintenanceRequest}
            technicians={allTechniciansForMaintenance}
            resources={allResourcesForCountsAndChecks} // Pass all resources for global context
            currentUserRole={currentUser?.role}
            labContextId={activeContextId === GLOBAL_CONTEXT_VALUE ? undefined : activeContextId} // Pass lab context if specific lab is selected
          />
        )}
      </div>
    </TooltipProvider>
  );
}
