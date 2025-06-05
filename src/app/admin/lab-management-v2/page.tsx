
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
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp, writeBatch, where } from 'firebase/firestore';
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
    const [labToDelete, setLabToDelete] = useState<Lab | null>(null);
    const [isLabFormDialogOpen, setIsLabFormDialogOpen] = useState(false);
    const [editingLab, setEditingLab] = useState<Lab | null>(null);
    const [isLabFilterDialogOpen, setIsLabFilterDialogOpen] = useState(false);
    const [tempLabSearchTerm, setTempLabSearchTerm] = useState('');
    const [activeLabSearchTerm, setActiveLabSearchTerm] = useState('');
    const [tempLabSortBy, setTempLabSortBy] = useState<string>('name-asc');
    const [activeLabSortBy, setActiveLabSortBy] = useState<string>('name-asc');

    // --- Blackout Dates & Recurring Rules State ---
    const [blackoutDates, setBlackoutDates] = useState<BlackoutDate[]>([]);
    const [recurringRules, setRecurringRules] = useState<RecurringBlackoutRule[]>([]);
    const [isDateFormDialogOpen, setIsDateFormDialogOpen] = useState(false);
    const [editingBlackoutDate, setEditingBlackoutDate] = useState<BlackoutDate | null>(null);
    const [dateToDelete, setDateToDelete] = useState<BlackoutDate | null>(null);
    const [isRecurringFormDialogOpen, setIsRecurringFormDialogOpen] = useState(false);
    const [editingRecurringRule, setEditingRecurringRule] = useState<RecurringBlackoutRule | null>(null);
    const [ruleToDelete, setRuleToDelete] = useState<RecurringBlackoutRule | null>(null);
    const [isClosureFilterDialogOpen, setIsClosureFilterDialogOpen] = useState(false);
    const [tempClosureSearchTerm, setTempClosureSearchTerm] = useState('');
    const [activeClosureSearchTerm, setActiveClosureSearchTerm] = useState('');

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
    const [tempMaintenanceFilterLabId, setTempMaintenanceFilterLabId] = useState<string>('all');
    const [activeMaintenanceSearchTerm, setActiveMaintenanceSearchTerm] = useState('');
    const [activeMaintenanceFilterStatus, setActiveMaintenanceFilterStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
    const [activeMaintenanceFilterResourceId, setActiveMaintenanceFilterResourceId] = useState<string>('all');
    const [activeMaintenanceFilterTechnicianId, setActiveMaintenanceFilterTechnicianId] = useState<string>('all');
    const [activeMaintenanceFilterLabId, setActiveMaintenanceFilterLabId] = useState<string>('all');

    // --- Lab Access & Membership State ---
    const [allLabAccessRequests, setAllLabAccessRequests] = useState<LabMembershipRequest[]>([]);
    const [userLabMemberships, setUserLabMemberships] = useState<LabMembership[]>([]);
    const [isProcessingAction, setIsProcessingAction] = useState<Record<string, {action: 'grant' | 'revoke' | 'approve_request' | 'reject_request', loading: boolean}>>({});
    const [isManualAddMemberDialogOpen, setIsManualAddMemberDialogOpen] = useState(false);
    const [isSystemWideAccessRequestsFilterOpen, setIsSystemWideAccessRequestsFilterOpen] = useState(false);
    const [tempSystemWideAccessRequestsFilterLabId, setTempSystemWideAccessRequestsFilterLabId] = useState('all');
    const [activeSystemWideAccessRequestsFilterLabId, setActiveSystemWideAccessRequestsFilterLabId] = useState('all');
    const [tempSystemWideAccessRequestsFilterUser, setTempSystemWideAccessRequestsFilterUser] = useState('');
    const [activeSystemWideAccessRequestsFilterUser, setActiveSystemWideAccessRequestsFilterUser] = useState('');

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
        setIsLabAccessRequestLoading(false);
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
          setActiveContextId(GLOBAL_CONTEXT_VALUE);
        }
      }, [searchParamsObj, labs]); 

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
    useEffect(() => { if (isResourceTypeFilterDialogOpen) { setTempResourceTypeSearchTerm(activeResourceTypeSearchTerm); setTempResourceTypeSortBy(activeResourceTypeSortBy);}}, [isResourceTypeFilterDialogOpen, activeResourceTypeSearchTerm, activeResourceTypeSortBy]);
    const filteredResourceTypesWithCount = useMemo(() => {
      let currentTypes = [...resourceTypes]; const lowerSearchTerm = activeResourceTypeSearchTerm.toLowerCase(); if (activeResourceTypeSearchTerm) { currentTypes = currentTypes.filter(type => type.name.toLowerCase().includes(lowerSearchTerm) || (type.description && type.description.toLowerCase().includes(lowerSearchTerm)));} const [column, direction] = activeResourceTypeSortBy.split('-') as [ResourceTypeSortableColumn, 'asc' | 'desc']; let typesWithCount = currentTypes.map(type => ({ ...type, resourceCount: allResourcesForCountsAndChecks.filter(res => res.resourceTypeId === type.id).length, })); typesWithCount.sort((a, b) => { let comparison = 0; const valA = a[column]; const valB = b[column]; if (column === 'resourceCount') comparison = (valA as number) - (valB as number); else if (column === 'name') comparison = (valA as string).toLowerCase().localeCompare((valB as string).toLowerCase()); else if (column === 'description') comparison = (a.description || '').toLowerCase().localeCompare((b.description || '').toLowerCase()); return direction === 'asc' ? comparison : -comparison; }); return typesWithCount;
    }, [resourceTypes, allResourcesForCountsAndChecks, activeResourceTypeSearchTerm, activeResourceTypeSortBy]);
    const handleApplyResourceTypeDialogFilters = useCallback(() => { setActiveResourceTypeSearchTerm(tempResourceTypeSearchTerm); setActiveResourceTypeSortBy(tempResourceTypeSortBy); setIsResourceTypeFilterDialogOpen(false);}, [tempResourceTypeSearchTerm, tempResourceTypeSortBy]);
    const resetResourceTypeDialogFiltersOnly = useCallback(() => { setTempResourceTypeSearchTerm(''); setTempResourceTypeSortBy('name-asc'); }, []);
    const resetAllActiveResourceTypePageFilters = useCallback(() => { setActiveResourceTypeSearchTerm(''); setActiveResourceTypeSortBy('name-asc'); resetResourceTypeDialogFiltersOnly(); setIsResourceTypeFilterDialogOpen(false);}, [resetResourceTypeDialogFiltersOnly]);
    const handleOpenNewResourceTypeDialog = () => { setEditingType(null); setIsResourceTypeFormDialogOpen(true); };
    const handleOpenEditResourceTypeDialog = (type: ResourceType) => { setEditingType(type); setIsResourceTypeFormDialogOpen(true); };
    const handleSaveResourceType = useCallback(async (data: ResourceTypeFormValues) => {
        if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; } setIsLoadingData(true); try { const typeDataToSave = { name: data.name, description: data.description || null }; const auditAction = editingType ? 'RESOURCE_TYPE_UPDATED' : 'RESOURCE_TYPE_CREATED'; let entityId = editingType ? editingType.id : ''; if (editingType) { await updateDoc(doc(db, "resourceTypes", entityId), typeDataToSave); } else { const docRef = await addDoc(collection(db, "resourceTypes"), typeDataToSave); entityId = docRef.id; } await addAuditLog(currentUser.id, currentUser.name, auditAction, { entityType: 'ResourceType', entityId, details: `Resource Type '${data.name}' ${editingType ? 'updated' : 'created'}.` }); toast({ title: `Resource Type ${editingType ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingType ? 'updated' : 'created'}.` }); setIsResourceTypeFormDialogOpen(false); setEditingType(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Save Error", description: `Could not save resource type: ${error.message}`, variant: "destructive" }); } finally { setIsLoadingData(false); }
    }, [currentUser, canManageAny, editingType, fetchAllAdminData, toast]);
    const handleDeleteResourceType = useCallback(async (typeId: string) => {
        if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; } const deletedType = resourceTypes.find(rt => rt.id === typeId); if (!deletedType) { toast({ title: "Error", description: "Resource type not found.", variant: "destructive" }); return; } const resourcesOfThisType = allResourcesForCountsAndChecks.filter(res => res.resourceTypeId === typeId).length; if (resourcesOfThisType > 0) { toast({ title: "Deletion Blocked", description: `Cannot delete "${deletedType.name}" as ${resourcesOfThisType} resource(s) are assigned. Reassign them first.`, variant: "destructive", duration: 7000 }); setTypeToDelete(null); return; } setIsLoadingData(true); try { await deleteDoc(doc(db, "resourceTypes", typeId)); await addAuditLog(currentUser.id, currentUser.name, 'RESOURCE_TYPE_DELETED', { entityType: 'ResourceType', entityId: typeId, details: `Resource Type '${deletedType.name}' deleted.` }); toast({ title: "Resource Type Deleted", description: `"${deletedType.name}" removed.`, variant: "destructive" }); setTypeToDelete(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Delete Error", description: `Could not delete resource type: ${error.message}`, variant: "destructive" }); } finally { setIsLoadingData(false); }
    }, [currentUser, canManageAny, resourceTypes, allResourcesForCountsAndChecks, fetchAllAdminData, toast]);
    const activeResourceTypeFilterCount = useMemo(() => [activeResourceTypeSearchTerm !== '', activeResourceTypeSortBy !== 'name-asc'].filter(Boolean).length, [activeResourceTypeSearchTerm, activeResourceTypeSortBy]);


    // --- Labs List Logic (Only for GLOBAL_CONTEXT_VALUE) ---
    // useEffect(() => { if (isLabFilterDialogOpen) { setTempLabSearchTerm(activeLabSearchTerm); setTempLabSortBy(activeLabSortBy);}}, [isLabFilterDialogOpen, activeLabSearchTerm, activeLabSortBy]);
    // const filteredLabsWithCounts = useMemo(() => {
    //     let currentLabs = [...labs]; const lowerSearchTerm = activeLabSearchTerm.toLowerCase(); if (activeLabSearchTerm) { currentLabs = currentLabs.filter(lab => lab.name.toLowerCase().includes(lowerSearchTerm) || (lab.location && lab.location.toLowerCase().includes(lowerSearchTerm)) || (lab.description && lab.description.toLowerCase().includes(lowerSearchTerm)));} const [column, direction] = activeLabSortBy.split('-') as [LabSortableColumn, 'asc' | 'desc'];
    //     let labsWithDetails = currentLabs.map(lab => ({ ...lab, resourceCount: allResourcesForCountsAndChecks.filter(res => res.labId === lab.id).length, memberCount: userLabMemberships.filter(mem => mem.labId === lab.id && mem.status === 'active').length }));
    //     labsWithDetails.sort((a, b) => { let comparison = 0; const valA = a[column]; const valB = b[column]; if (column === 'name') comparison = (valA as string).toLowerCase().localeCompare((valB as string).toLowerCase()); else if (column === 'location') comparison = (a.location || '').toLowerCase().localeCompare((b.location || '').toLowerCase()); else if (column === 'resourceCount' || column === 'memberCount') comparison = (valA as number) - (valB as number); return direction === 'asc' ? comparison : -comparison; }); return labsWithDetails;
    // }, [labs, activeLabSearchTerm, activeLabSortBy, allResourcesForCountsAndChecks, userLabMemberships]);
    // const handleApplyLabDialogFilters = useCallback(() => { setActiveLabSearchTerm(tempLabSearchTerm); setActiveLabSortBy(tempLabSortBy); setIsLabFilterDialogOpen(false);}, [tempLabSearchTerm, tempLabSortBy]);
    // const resetLabDialogFiltersOnly = useCallback(() => { setTempLabSearchTerm(''); setTempLabSortBy('name-asc'); }, []);
    // const resetAllActiveLabPageFilters = useCallback(() => { setActiveLabSearchTerm(''); setActiveLabSortBy('name-asc'); resetLabDialogFiltersOnly(); setIsLabFilterDialogOpen(false);}, [resetLabDialogFiltersOnly]);
    // const handleOpenNewLabDialog = () => { setEditingLab(null); setIsLabFormDialogOpen(true); };
    // const handleOpenEditLabDialog = (lab: Lab) => { setEditingLab(lab); setIsLabFormDialogOpen(true); };
    // const handleSaveLab = useCallback(async (data: LabFormValues) => {
    //     if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; } setIsLoadingData(true); try { const labDataToSave: Partial<Omit<Lab, 'id' | 'createdAt' | 'lastUpdatedAt'>> & { lastUpdatedAt?: any, createdAt?: any } = { name: data.name, location: data.location || null, description: data.description || null, }; const auditAction = editingLab ? 'LAB_UPDATED' : 'LAB_CREATED'; let entityId = editingLab ? editingLab.id : ''; if (editingLab) { labDataToSave.lastUpdatedAt = serverTimestamp(); await updateDoc(doc(db, "labs", entityId), labDataToSave as any); } else { labDataToSave.createdAt = serverTimestamp(); const docRef = await addDoc(collection(db, "labs"), labDataToSave as any); entityId = docRef.id; } await addAuditLog(currentUser.id, currentUser.name, auditAction, { entityType: 'Lab', entityId, details: `Lab '${data.name}' ${editingLab ? 'updated' : 'created'}.` }); toast({ title: `Lab ${editingLab ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingLab ? 'updated' : 'created'}.` }); setIsLabFormDialogOpen(false); setEditingLab(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Save Error", description: `Could not save lab: ${error.message}`, variant: "destructive" }); } finally { setIsLoadingData(false); }
    // }, [currentUser, canManageAny, editingLab, fetchAllAdminData, toast]);
    // const handleDeleteLab = useCallback(async (labId: string) => {
    //     if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; } const deletedLab = labs.find(lab => lab.id === labId); if (!deletedLab) { toast({ title: "Error", description: "Lab not found.", variant: "destructive" }); return; } const resourcesInThisLab = allResourcesForCountsAndChecks.filter(res => res.labId === labId).length; if (resourcesInThisLab > 0) { toast({ title: "Deletion Blocked", description: `Cannot delete lab "${deletedLab.name}" as ${resourcesInThisLab} resource(s) are assigned. Reassign them first.`, variant: "destructive", duration: 7000 }); setLabToDelete(null); return; } setIsLoadingData(true); try { await deleteDoc(doc(db, "labs", labId)); await addAuditLog(currentUser.id, currentUser.name, 'LAB_DELETED', { entityType: 'Lab', entityId: labId, details: `Lab '${deletedLab.name}' deleted.` }); toast({ title: "Lab Deleted", description: `Lab "${deletedLab.name}" removed.`, variant: "destructive" }); setLabToDelete(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Delete Error", description: `Could not delete lab: ${error.message}`, variant: "destructive" }); } finally { setIsLoadingData(false); }
    // }, [currentUser, canManageAny, labs, allResourcesForCountsAndChecks, fetchAllAdminData, toast]);
    // const activeLabFilterCount = useMemo(() => [activeLabSearchTerm !== '', activeLabSortBy !== 'name-asc'].filter(Boolean).length, [activeLabSearchTerm, activeLabSortBy]);

    // --- Lab Closures Logic (Context-Aware) ---
    // useEffect(() => { if (isClosureFilterDialogOpen) { setTempClosureSearchTerm(activeClosureSearchTerm); }}, [isClosureFilterDialogOpen, activeClosureSearchTerm]);
    // const filteredBlackoutDates = useMemo(() => {
    //     return blackoutDates.filter(bd => {
    //         const contextMatch = activeContextId === GLOBAL_CONTEXT_VALUE ? true : (bd.labId === activeContextId || (!bd.labId && activeContextId === GLOBAL_CONTEXT_VALUE));
    //         const labIdForFilter = activeContextId === GLOBAL_CONTEXT_VALUE ? null : activeContextId;
    //         const isGlobalOrMatchesContext = bd.labId === labIdForFilter || (!bd.labId && labIdForFilter === null);

    //         if (activeContextId !== GLOBAL_CONTEXT_VALUE && bd.labId !== activeContextId && bd.labId !== null) return false; 
    //         if (activeContextId === GLOBAL_CONTEXT_VALUE && bd.labId !== null) return false; 
            
    //         const lowerSearchTerm = activeClosureSearchTerm.toLowerCase();
    //         const reasonMatch = bd.reason && bd.reason.toLowerCase().includes(lowerSearchTerm);
    //         const dateMatch = bd.date && isValidDateFn(parseISO(bd.date)) && format(parseISO(bd.date), 'PPP').toLowerCase().includes(lowerSearchTerm);
    //         return (!activeClosureSearchTerm || reasonMatch || dateMatch);
    //     });
    // }, [blackoutDates, activeClosureSearchTerm, activeContextId]);
    // const filteredRecurringRules = useMemo(() => {
    //     return recurringRules.filter(rule => {
    //         if (activeContextId !== GLOBAL_CONTEXT_VALUE && rule.labId !== activeContextId && rule.labId !== null) return false;
    //         if (activeContextId === GLOBAL_CONTEXT_VALUE && rule.labId !== null) return false;

    //         const lowerSearchTerm = activeClosureSearchTerm.toLowerCase();
    //         const nameMatch = rule.name && rule.name.toLowerCase().includes(lowerSearchTerm);
    //         const reasonMatch = rule.reason && rule.reason.toLowerCase().includes(lowerSearchTerm);
    //         return (!activeClosureSearchTerm || nameMatch || reasonMatch);
    //     });
    // }, [recurringRules, activeClosureSearchTerm, activeContextId]);
    // const handleOpenNewDateDialog = useCallback(() => { setEditingBlackoutDate(null); setIsDateFormDialogOpen(true); }, []);
    // const handleOpenEditDateDialog = useCallback((bd: BlackoutDate) => { setEditingBlackoutDate(bd); setIsDateFormDialogOpen(true); }, []);
    // const handleSaveBlackoutDate = useCallback(async (data: BlackoutDateDialogFormValues) => {
    //     if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; } const formattedDateOnly = format(data.date, 'yyyy-MM-dd'); const displayDate = format(data.date, 'PPP'); const blackoutDataToSave: Omit<BlackoutDate, 'id'> = { labId: data.labId === '--global--' || data.labId === null ? null : data.labId, date: formattedDateOnly, reason: data.reason || undefined, }; setIsLoadingData(true); try { if (editingBlackoutDate) { await updateDoc(doc(db, "blackoutDates", editingBlackoutDate.id), blackoutDataToSave as any); await addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_UPDATED', { entityType: 'BlackoutDate', entityId: editingBlackoutDate.id, details: `Blackout Date for ${displayDate} updated. Lab: ${blackoutDataToSave.labId || 'Global'}. Reason: ${data.reason || 'N/A'}`}); toast({ title: 'Blackout Date Updated'}); } else { const docRef = await addDoc(collection(db, "blackoutDates"), blackoutDataToSave); await addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_CREATED', { entityType: 'BlackoutDate', entityId: docRef.id, details: `Blackout Date for ${displayDate} created. Lab: ${blackoutDataToSave.labId || 'Global'}. Reason: ${data.reason || 'N/A'}`}); toast({ title: 'Blackout Date Added'}); } setIsDateFormDialogOpen(false); setEditingBlackoutDate(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Save Failed", variant: "destructive"});} finally { setIsLoadingData(false); }
    // }, [currentUser, editingBlackoutDate, fetchAllAdminData, toast]);
    // const handleDeleteBlackoutDate = useCallback(async (blackoutDateId: string) => {
    //     if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; } const deletedDateObj = blackoutDates.find(bd => bd.id === blackoutDateId); if (!deletedDateObj) return; setIsLoadingData(true); try { await deleteDoc(doc(db, "blackoutDates", blackoutDateId)); await addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_DELETED', { entityType: 'BlackoutDate', entityId: blackoutDateId, details: `Blackout Date for ${format(parseISO(deletedDateObj.date), 'PPP')} (Lab: ${deletedDateObj.labId || 'Global'}, Reason: ${deletedDateObj.reason || 'N/A'}) deleted.`}); toast({ title: "Blackout Date Removed", variant: "destructive" }); setDateToDelete(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Delete Failed", variant: "destructive"});} finally { setIsLoadingData(false); }
    // }, [currentUser, blackoutDates, fetchAllAdminData, toast]);
    // const handleApplyClosureDialogFilters = useCallback(() => { setActiveClosureSearchTerm(tempClosureSearchTerm); setIsClosureFilterDialogOpen(false); }, [tempClosureSearchTerm]);
    // const resetClosureDialogFiltersOnly = useCallback(() => { setTempClosureSearchTerm(''); }, []);
    // const resetAllActiveClosurePageFilters = useCallback(() => { setActiveClosureSearchTerm(''); resetClosureDialogFiltersOnly(); setIsClosureFilterDialogOpen(false); }, [resetClosureDialogFiltersOnly]);
    // const activeClosureFilterCount = useMemo(() => [activeClosureSearchTerm !== ''].filter(Boolean).length, [activeClosureSearchTerm]);
    // const handleOpenNewRecurringDialog = useCallback(() => { setEditingRecurringRule(null); setIsRecurringFormDialogOpen(true); }, []);
    // const handleOpenEditRecurringDialog = useCallback((rule: RecurringBlackoutRule) => { setEditingRecurringRule(rule); setIsRecurringFormDialogOpen(true); }, []);
    // const handleSaveRecurringRule = useCallback(async (data: RecurringRuleDialogFormValues) => {
    //     if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; } const ruleDataToSave: Omit<RecurringBlackoutRule, 'id'> = { labId: data.labId === '--global--' || data.labId === null ? null : data.labId, name: data.name, daysOfWeek: data.daysOfWeek, reason: data.reason || undefined, }; setIsLoadingData(true); try { if (editingRecurringRule) { await updateDoc(doc(db, "recurringBlackoutRules", editingRecurringRule.id), ruleDataToSave as any); await addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_UPDATED', { entityType: 'RecurringBlackoutRule', entityId: editingRecurringRule.id, details: `Recurring rule '${data.name}' updated. Lab: ${ruleDataToSave.labId || 'Global'}.`}); toast({ title: 'Recurring Rule Updated'}); } else { const docRef = await addDoc(collection(db, "recurringBlackoutRules"), ruleDataToSave); await addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_CREATED', { entityType: 'RecurringBlackoutRule', entityId: docRef.id, details: `Recurring rule '${data.name}' created. Lab: ${ruleDataToSave.labId || 'Global'}.`}); toast({ title: 'Recurring Rule Added'}); } setIsRecurringFormDialogOpen(false); setEditingRecurringRule(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Save Failed", variant: "destructive"});} finally { setIsLoadingData(false); }
    // }, [currentUser, editingRecurringRule, fetchAllAdminData, toast]);
    // const handleDeleteRecurringRule = useCallback(async (ruleId: string) => {
    //     if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; } const deletedRuleObj = recurringRules.find(r => r.id === ruleId); if (!deletedRuleObj) return; setIsLoadingData(true); try { await deleteDoc(doc(db, "recurringBlackoutRules", ruleId)); await addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_DELETED', { entityType: 'RecurringBlackoutRule', entityId: ruleId, details: `Recurring rule '${deletedRuleObj.name}' (Lab: ${deletedRuleObj.labId || 'Global'}) deleted.`}); toast({ title: "Recurring Rule Removed", variant: "destructive" }); setRuleToDelete(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Delete Failed", variant: "destructive"});} finally { setIsLoadingData(false); }
    // }, [currentUser, recurringRules, fetchAllAdminData, toast]);

    // --- Maintenance Requests Logic (Context-Aware) ---
    // useEffect(() => { if (isMaintenanceFilterDialogOpen) { setTempMaintenanceSearchTerm(activeMaintenanceSearchTerm); setTempMaintenanceFilterStatus(activeMaintenanceFilterStatus); setTempMaintenanceFilterResourceId(activeMaintenanceFilterResourceId); setTempMaintenanceFilterTechnicianId(activeMaintenanceFilterTechnicianId); setTempMaintenanceFilterLabId(activeMaintenanceFilterLabId); }}, [isMaintenanceFilterDialogOpen, activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId, activeMaintenanceFilterLabId]);
    // const filteredMaintenanceRequests = useMemo(() => {
    //   let reqs = maintenanceRequests.map(req => {
    //     const resource = allResourcesForCountsAndChecks.find(r => r.id === req.resourceId);
    //     const reporter = allUsersData.find(u => u.id === req.reportedByUserId);
    //     const technician = allTechniciansForMaintenance.find(t => t.id === req.assignedTechnicianId);
    //     return { ...req, resourceName: resource?.name || 'Unknown Resource', resourceLabId: resource?.labId, reportedByUserName: reporter?.name || 'Unknown User', assignedTechnicianName: technician?.name, };
    //   });

    //   if (activeContextId !== GLOBAL_CONTEXT_VALUE) {
    //     reqs = reqs.filter(req => req.resourceLabId === activeContextId);
    //   } else {
    //     if (activeMaintenanceFilterLabId !== 'all') {
    //       reqs = reqs.filter(req => req.resourceLabId === activeMaintenanceFilterLabId);
    //     }
    //   }
    //   return reqs.filter(req => {
    //     const lowerSearchTerm = activeMaintenanceSearchTerm.toLowerCase();
    //     const searchMatch = !activeMaintenanceSearchTerm || (req.resourceName && req.resourceName.toLowerCase().includes(lowerSearchTerm)) || (req.reportedByUserName && req.reportedByUserName.toLowerCase().includes(lowerSearchTerm)) || (req.issueDescription && req.issueDescription.toLowerCase().includes(lowerSearchTerm)) || (req.assignedTechnicianName && req.assignedTechnicianName.toLowerCase().includes(lowerSearchTerm));
    //     const statusMatch = activeMaintenanceFilterStatus === 'all' || req.status === activeMaintenanceFilterStatus;
    //     const resourceMatch = activeMaintenanceFilterResourceId === 'all' || req.resourceId === activeMaintenanceFilterResourceId;
    //     let technicianMatch = true;
    //     if (activeMaintenanceFilterTechnicianId !== 'all') {
    //       if (activeMaintenanceFilterTechnicianId === '--unassigned--') { technicianMatch = !req.assignedTechnicianId; } else { technicianMatch = req.assignedTechnicianId === activeMaintenanceFilterTechnicianId; }
    //     }
    //     return searchMatch && statusMatch && resourceMatch && technicianMatch;
    //   });
    // }, [maintenanceRequests, allResourcesForCountsAndChecks, allTechniciansForMaintenance, allUsersData, activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId, activeContextId, activeMaintenanceFilterLabId]);
    // const handleApplyMaintenanceDialogFilters = useCallback(() => { setActiveMaintenanceSearchTerm(tempMaintenanceSearchTerm.toLowerCase()); setActiveMaintenanceFilterStatus(tempMaintenanceFilterStatus); setActiveMaintenanceFilterResourceId(tempMaintenanceFilterResourceId); setActiveMaintenanceFilterTechnicianId(tempMaintenanceFilterTechnicianId); setActiveMaintenanceFilterLabId(tempMaintenanceFilterLabId); setIsMaintenanceFilterDialogOpen(false); }, [tempMaintenanceSearchTerm, tempMaintenanceFilterStatus, tempMaintenanceFilterResourceId, tempMaintenanceFilterTechnicianId, tempMaintenanceFilterLabId]);
    // const resetMaintenanceDialogFiltersOnly = useCallback(() => { setTempMaintenanceSearchTerm(''); setTempMaintenanceFilterStatus('all'); setTempMaintenanceFilterResourceId('all'); setTempMaintenanceFilterTechnicianId('all'); setTempMaintenanceFilterLabId('all'); }, []);
    // const resetAllActiveMaintenancePageFilters = useCallback(() => { setActiveMaintenanceSearchTerm(''); setActiveMaintenanceFilterStatus('all'); setActiveMaintenanceFilterResourceId('all'); setActiveMaintenanceFilterTechnicianId('all'); setActiveMaintenanceFilterLabId('all'); resetMaintenanceDialogFiltersOnly(); setIsMaintenanceFilterDialogOpen(false); }, [resetMaintenanceDialogFiltersOnly]);
    // const handleOpenNewMaintenanceDialog = useCallback(() => { if (!currentUser) return; setEditingMaintenanceRequest(null); setIsMaintenanceFormDialogOpen(true); }, [currentUser]);
    // const handleOpenEditMaintenanceDialog = useCallback((request: MaintenanceRequest) => { setEditingMaintenanceRequest(request); setIsMaintenanceFormDialogOpen(true); }, []);
    // const handleSaveMaintenanceRequest = useCallback(async (data: MaintenanceDialogFormValues) => {
    //   if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Error", variant: "destructive"}); return;} const resource = allResourcesForCountsAndChecks.find(r => r.id === data.resourceId); if (!resource) { toast({ title: "Error", variant: "destructive" }); return;} let dateResolvedForFirestore: Timestamp | null = null; if ((data.status === 'Resolved' || data.status === 'Closed') && data.dateResolved && isValidDateFn(new Date(data.dateResolved))) { dateResolvedForFirestore = Timestamp.fromDate(new Date(data.dateResolved)); } else if ((data.status === 'Resolved' || data.status === 'Closed') && !editingMaintenanceRequest?.dateResolved) { dateResolvedForFirestore = serverTimestamp() as Timestamp; } else if (editingMaintenanceRequest?.dateResolved && (data.status === 'Resolved' || data.status === 'Closed')) { dateResolvedForFirestore = Timestamp.fromDate(editingMaintenanceRequest.dateResolved); } 
    //   const requestDataToSave: any = { resourceId: data.resourceId, issueDescription: data.issueDescription, status: data.status, assignedTechnicianId: data.assignedTechnicianId === '--unassigned--' || !data.assignedTechnicianId ? null : data.assignedTechnicianId, resolutionNotes: data.resolutionNotes || null, dateResolved: dateResolvedForFirestore };
    //   setIsLoadingData(true); try { if (editingMaintenanceRequest) { await updateDoc(doc(db, "maintenanceRequests", editingMaintenanceRequest.id), requestDataToSave); await addAuditLog(currentUser.id, currentUser.name, 'MAINTENANCE_UPDATED', { entityType: 'MaintenanceRequest', entityId: editingMaintenanceRequest.id, details: `Maintenance request for '${resource.name}' updated. Status: ${data.status}.`}); toast({ title: 'Request Updated'}); if ((data.status === 'Resolved' && editingMaintenanceRequest.status !== 'Resolved') && editingMaintenanceRequest.reportedByUserId !== currentUser.id && editingMaintenanceRequest.reportedByUserId) { await addNotification( editingMaintenanceRequest.reportedByUserId, 'Maintenance Resolved', `Issue for ${resource.name} resolved.`, 'maintenance_resolved', '/maintenance');} if (data.assignedTechnicianId && data.assignedTechnicianId !== editingMaintenanceRequest.assignedTechnicianId && data.assignedTechnicianId !== '--unassigned--') { await addNotification( data.assignedTechnicianId, 'Maintenance Task Assigned', `Task for ${resource.name}: ${data.issueDescription.substring(0,50)}...`, 'maintenance_assigned', '/maintenance');} } else { const newRequestPayload = { ...requestDataToSave, reportedByUserId: currentUser.id, dateReported: serverTimestamp(), }; const docRef = await addDoc(collection(db, "maintenanceRequests"), newRequestPayload); await addAuditLog(currentUser.id, currentUser.name, 'MAINTENANCE_CREATED', { entityType: 'MaintenanceRequest', entityId: docRef.id, details: `New request for '${resource.name}' by ${currentUser.name}.`}); toast({ title: 'Request Logged'}); const techIdForNotification = requestDataToSave.assignedTechnicianId; if(techIdForNotification && techIdForNotification !== '--unassigned--'){ await addNotification( techIdForNotification, 'New Maintenance Request Assigned', `New request for ${resource.name}: ${data.issueDescription.substring(0, 50)}... assigned.`, 'maintenance_assigned', '/maintenance');} else { const usersToNotifyQuery = query(collection(db, 'users'), where('role', 'in', ['Admin', 'Technician']), orderBy('name', 'asc')); const usersToNotifySnapshot = await getDocs(usersToNotifyQuery); const notificationPromises = usersToNotifySnapshot.docs.map(userDoc => { if(userDoc.id !== currentUser?.id) { return addNotification( userDoc.id, 'New Unassigned Maintenance Request', `New request for ${resource.name}: ${data.issueDescription.substring(0, 50)}... needs attention.`, 'maintenance_new', '/maintenance');} return Promise.resolve(); }); await Promise.all(notificationPromises);}} setIsMaintenanceFormDialogOpen(false); setEditingMaintenanceRequest(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: `${editingMaintenanceRequest ? "Update" : "Logging"} Failed`, variant: "destructive" });} finally { setIsLoadingData(false); }
    // }, [currentUser, editingMaintenanceRequest, allResourcesForCountsAndChecks, fetchAllAdminData, toast]);
    // const activeMaintenanceFilterCount = useMemo(() => {
    //   let count = [activeMaintenanceSearchTerm !== '', activeMaintenanceFilterStatus !== 'all', activeMaintenanceFilterResourceId !== 'all', activeMaintenanceFilterTechnicianId !== 'all'].filter(Boolean).length;
    //   if(activeContextId === GLOBAL_CONTEXT_VALUE && activeMaintenanceFilterLabId !== 'all') count++;
    //   return count;
    // }, [activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId, activeContextId, activeMaintenanceFilterLabId]);
    // const canEditAnyMaintenanceRequest = useMemo(() => currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Technician'), [currentUser]);

    // --- Lab Access & Membership Logic (Context-Aware) ---
    // const handleMembershipAction = useCallback(async (
    //     targetUserId: string, targetUserName: string, labId: string, labName: string,
    //     action: 'grant' | 'revoke' | 'approve_request' | 'reject_request',
    //     membershipDocIdToUpdate?: string
    //   ) => {
    //     if (!currentUser || !currentUser.id || !currentUser.name) {
    //       toast({ title: "Authentication Error", variant: "destructive" });
    //       return;
    //     }
    //     const actionKey = membershipDocIdToUpdate || `${targetUserId}-${labId}-${action}`;
    //     setIsProcessingAction(prev => ({ ...prev, [actionKey]: { action, loading: true } }));
    
    //     try {
    //       const result = await manageLabMembership_SA(
    //         currentUser.id, currentUser.name,
    //         targetUserId, targetUserName,
    //         labId, labName,
    //         action, membershipDocIdToUpdate
    //       );
    //       if (result.success) {
    //         toast({ title: "Success", description: result.message });
    //         fetchAllAdminData(); 
    //       } else {
    //         toast({ title: "Action Failed", description: result.message, variant: "destructive" });
    //       }
    //     } catch (error: any) {
    //       toast({ title: "Error", description: `Failed to process request: ${error.message}`, variant: "destructive" });
    //     } finally {
    //       setIsProcessingAction(prev => ({ ...prev, [actionKey]: { action, loading: false } }));
    //     }
    // }, [currentUser, fetchAllAdminData, toast]);

    // useEffect(() => {
    //   if (isSystemWideAccessRequestsFilterOpen) {
    //     setTempSystemWideAccessRequestsFilterLabId(activeSystemWideAccessRequestsFilterLabId);
    //     setTempSystemWideAccessRequestsFilterUser(activeSystemWideAccessRequestsFilterUser);
    //   }
    // }, [isSystemWideAccessRequestsFilterOpen, activeSystemWideAccessRequestsFilterLabId, activeSystemWideAccessRequestsFilterUser]);
    
    // const filteredLabAccessRequests = useMemo(() => {
    //   let requests = allLabAccessRequests;
    //   if (activeContextId !== GLOBAL_CONTEXT_VALUE) { // Filter by current lab context if not global
    //      requests = requests.filter(req => req.labId === activeContextId);
    //   } else { // If global context, apply global filters
    //      if (activeSystemWideAccessRequestsFilterLabId !== 'all') {
    //        requests = requests.filter(req => req.labId === activeSystemWideAccessRequestsFilterLabId);
    //      }
    //   }
    //   if (activeSystemWideAccessRequestsFilterUser) {
    //     const lowerSearch = activeSystemWideAccessRequestsFilterUser.toLowerCase();
    //     requests = requests.filter(req => (req.userName && req.userName.toLowerCase().includes(lowerSearch)) || (req.userEmail && req.userEmail.toLowerCase().includes(lowerSearch)));
    //   }
    //   return requests;
    // }, [allLabAccessRequests, activeContextId, activeSystemWideAccessRequestsFilterLabId, activeSystemWideAccessRequestsFilterUser]);
    
    // const activeLabMembers = useMemo(() => {
    //   if (activeContextId === GLOBAL_CONTEXT_VALUE) return []; // Don't show for global
    //   return userLabMemberships
    //     .filter(mem => mem.labId === activeContextId && mem.status === 'active')
    //     .map(mem => {
    //       const user = allUsersData.find(u => u.id === mem.userId);
    //       return { ...mem, userName: user?.name || 'Unknown User', userEmail: user?.email || 'N/A', userAvatarUrl: user?.avatarUrl };
    //     });
    // }, [userLabMemberships, allUsersData, activeContextId]);
    
    // const resourcesInSelectedLab = useMemo(() => allResourcesForCountsAndChecks.filter(r => r.labId === activeContextId), [allResourcesForCountsAndChecks, activeContextId]);
    
    // const maintenanceForSelectedLab = useMemo(() => {
    //   return maintenanceRequests.filter(mr => resourcesInSelectedLab.some(r => r.id === mr.resourceId));
    // }, [maintenanceRequests, resourcesInSelectedLab]);
    

    // const handleApplySystemWideAccessRequestsFilter = useCallback(() => {
    //   setActiveSystemWideAccessRequestsFilterLabId(tempSystemWideAccessRequestsFilterLabId);
    //   setActiveSystemWideAccessRequestsFilterUser(tempSystemWideAccessRequestsFilterUser);
    //   setIsSystemWideAccessRequestsFilterOpen(false);
    // }, [tempSystemWideAccessRequestsFilterLabId, tempSystemWideAccessRequestsFilterUser]);
    // const resetSystemWideAccessRequestsFilterDialogOnly = useCallback(() => {
    //   setTempSystemWideAccessRequestsFilterLabId('all');
    //   setTempSystemWideAccessRequestsFilterUser('');
    // }, []);
    // const resetAllActiveSystemWideAccessRequestsFilters = useCallback(() => {
    //   setActiveSystemWideAccessRequestsFilterLabId('all');
    //   setActiveSystemWideAccessRequestsFilterUser('');
    //   resetSystemWideAccessRequestsFilterDialogOnly();
    //   setIsSystemWideAccessRequestsFilterOpen(false);
    // }, [resetSystemWideAccessRequestsFilterDialogOnly]);
    // const activeSystemWideAccessRequestsFilterCount = useMemo(() => [activeSystemWideAccessRequestsFilterLabId !== 'all', activeSystemWideAccessRequestsFilterUser !== ''].filter(Boolean).length, [activeSystemWideAccessRequestsFilterLabId, activeSystemWideAccessRequestsFilterUser]);


    if (!currentUser || !canManageAny) {
      return ( <div className="space-y-8"><PageHeader title="Lab Operations Center" icon={Cog} description="Access Denied." /><Card className="text-center py-10 text-muted-foreground"><CardContent><p>You do not have permission.</p></CardContent></Card></div>);
    }

  return (
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

      {!isLoadingData && activeContextId !== GLOBAL_CONTEXT_VALUE && selectedLabDetails && (
         <Tabs defaultValue={searchParamsObj.get('tab') || "lab-details"} className="w-full"> 
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                <TabsTrigger value="lab-details">Lab Overview</TabsTrigger>
                <TabsTrigger value="lab-closures">Closures</TabsTrigger>
                <TabsTrigger value="lab-maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="lab-members">Members & Access</TabsTrigger>
            </TabsList>
            {/* Placeholder for lab-specific tabs */}
            <TabsContent value="lab-details" className="mt-6"><Card><CardHeader><CardTitle>{selectedLabDetails.name} - Overview</CardTitle></CardHeader><CardContent><p>Lab-specific overview content here.</p></CardContent></Card></TabsContent>
            <TabsContent value="lab-closures" className="mt-6"><Card><CardHeader><CardTitle>{selectedLabDetails.name} - Closures</CardTitle></CardHeader><CardContent><p>Lab-specific closures management here.</p></CardContent></Card></TabsContent>
            <TabsContent value="lab-maintenance" className="mt-6"><Card><CardHeader><CardTitle>{selectedLabDetails.name} - Maintenance</CardTitle></CardHeader><CardContent><p>Lab-specific maintenance log here.</p></CardContent></Card></TabsContent>
            <TabsContent value="lab-members" className="mt-6"><Card><CardHeader><CardTitle>{selectedLabDetails.name} - Members & Access</Title></CardHeader><CardContent><p>Lab-specific members and access management here.</p></CardContent></Card></TabsContent>
        </Tabs>
      )}


      {isResourceTypeFormDialogOpen && currentUser && (<ResourceTypeFormDialog open={isResourceTypeFormDialogOpen} onOpenChange={(isOpen) => { setIsResourceTypeFormDialogOpen(isOpen); if (!isOpen) setEditingType(null); }} initialType={editingType} onSave={handleSaveResourceType} />)}
      {isLabFormDialogOpen && currentUser && (<LabFormDialog open={isLabFormDialogOpen} onOpenChange={(isOpen) => { setIsLabFormDialogOpen(isOpen); if (!isOpen) setEditingLab(null); }} initialLab={editingLab} onSave={handleSaveLab} />)}
      {isDateFormDialogOpen && currentUser && (<BlackoutDateFormDialog open={isDateFormDialogOpen} onOpenChange={setIsDateFormDialogOpen} initialBlackoutDate={editingBlackoutDate} onSave={handleSaveBlackoutDate} labs={labs} currentLabContextId={activeContextId} />)}
      {isRecurringFormDialogOpen && currentUser && (<RecurringBlackoutRuleFormDialog open={isRecurringFormDialogOpen} onOpenChange={setIsRecurringFormDialogOpen} initialRule={editingRecurringRule} onSave={handleSaveRecurringRule} labs={labs} currentLabContextId={activeContextId} />)}
      {isMaintenanceFormDialogOpen && currentUser && (<MaintenanceRequestFormDialog open={isMaintenanceFormDialogOpen} onOpenChange={(isOpen) => { setIsMaintenanceFormDialogOpen(isOpen); if (!isOpen) setEditingMaintenanceRequest(null);}} initialRequest={editingMaintenanceRequest} onSave={handleSaveMaintenanceRequest} technicians={allTechniciansForMaintenance} resources={allResourcesForCountsAndChecks} currentUserRole={currentUser?.role} labContextId={activeContextId !== GLOBAL_CONTEXT_VALUE ? activeContextId : undefined}/> )}
      {isManualAddMemberDialogOpen && currentUser && (
        <ManageUserLabAccessDialog
            targetUser={null} 
            allLabs={labs}
            open={isManualAddMemberDialogOpen}
            onOpenChange={(isOpen) => {
                setIsManualAddMemberDialogOpen(isOpen);
            }}
            onMembershipUpdate={fetchAllAdminData}
            performMembershipAction={handleMembershipAction}
            preselectedLabId={activeContextId !== GLOBAL_CONTEXT_VALUE ? activeContextId : undefined}
        />
      )}
    </div>
  );
}
