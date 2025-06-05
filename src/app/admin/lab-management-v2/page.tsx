
'use client';

// All original imports are kept, but most will be unused temporarily.
import { useState, useMemo, useEffect, useCallback } from 'react';
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
import { MaintenanceRequestFormDialog, MaintenanceRequestFormValues as MaintenanceDialogFormValues } from '@/components/admin/maintenance-request-form-dialog';
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

export default function LabOperationsCenterPage({
  searchParams,
}: {
  searchParams?: { tab?: string; labId?: string };
}) {
    const { toast } = useToast();
    const { currentUser } = useAuth();
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [activeContextId, setActiveContextId] = useState<string>(GLOBAL_CONTEXT_VALUE); // For context selector
    const [isLabAccessRequestLoading, setIsLoadingLabAccessRequestLoading] = useState(true); // Separate loading for access requests

    // Tab state for nested tabs within closure sections
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
    const [isClosureFilterDialogOpen, setIsClosureFilterDialogOpen] = useState(false); // For specific and recurring closures
    const [tempClosureSearchTerm, setTempClosureSearchTerm] = useState(''); // For specific and recurring closures
    const [activeClosureSearchTerm, setActiveClosureSearchTerm] = useState(''); // For specific and recurring closures

    // --- Maintenance Requests State ---
    const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
    const [allTechniciansForMaintenance, setAllTechniciansForMaintenance] = useState<User[]>([]);
    const [allUsersData, setAllUsersData] = useState<User[]>([]); // All users for reporter names, lab access etc.
    const [isMaintenanceFormDialogOpen, setIsMaintenanceFormDialogOpen] = useState(false);
    const [editingMaintenanceRequest, setEditingMaintenanceRequest] = useState<MaintenanceRequest | null>(null);
    const [isMaintenanceFilterDialogOpen, setIsMaintenanceFilterDialogOpen] = useState(false);
    const [tempMaintenanceSearchTerm, setTempMaintenanceSearchTerm] = useState('');
    const [tempMaintenanceFilterStatus, setTempMaintenanceFilterStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
    const [tempMaintenanceFilterResourceId, setTempMaintenanceFilterResourceId] = useState<string>('all');
    const [tempMaintenanceFilterTechnicianId, setTempMaintenanceFilterTechnicianId] = useState<string>('all');
    const [tempMaintenanceFilterLabId, setTempMaintenanceFilterLabId] = useState<string>('all'); // Used when in global context
    const [activeMaintenanceSearchTerm, setActiveMaintenanceSearchTerm] = useState('');
    const [activeMaintenanceFilterStatus, setActiveMaintenanceFilterStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
    const [activeMaintenanceFilterResourceId, setActiveMaintenanceFilterResourceId] = useState<string>('all');
    const [activeMaintenanceFilterTechnicianId, setActiveMaintenanceFilterTechnicianId] = useState<string>('all');
    const [activeMaintenanceFilterLabId, setActiveMaintenanceFilterLabId] = useState<string>('all'); // Used when in global context

    // --- Lab Access Requests & Management State ---
    const [allLabAccessRequests, setAllLabAccessRequests] = useState<LabMembershipRequest[]>([]); // Pending requests system-wide
    const [userLabMemberships, setUserLabMemberships] = useState<LabMembership[]>([]); // All membership docs for calculations
    const [isProcessingAction, setIsProcessingAction] = useState<Record<string, {action: 'grant' | 'revoke' | 'approve_request' | 'reject_request', loading: boolean}>>({}); // For individual user-lab actions
    const [isManualAddMemberDialogOpen, setIsManualAddMemberDialogOpen] = useState(false); // Dialog state for manual grant
    // Filters for "System-Wide Lab Access Requests" table (when activeContextId is GLOBAL_CONTEXT_VALUE)
    const [isSystemWideAccessRequestsFilterOpen, setIsSystemWideAccessRequestsFilterOpen] = useState(false);
    const [tempSystemWideAccessRequestsFilterLabId, setTempSystemWideAccessRequestsFilterLabId] = useState('all');
    const [activeSystemWideAccessRequestsFilterLabId, setActiveSystemWideAccessRequestsFilterLabId] = useState('all');
    const [tempSystemWideAccessRequestsFilterUser, setTempSystemWideAccessRequestsFilterUser] = useState('');
    const [activeSystemWideAccessRequestsFilterUser, setActiveSystemWideAccessRequestsFilterUser] = useState('');

    const canManageAny = useMemo(() => currentUser && currentUser.role === 'Admin', [currentUser]);

    const fetchAllAdminData = useCallback(async () => {
      if (!canManageAny) {
        setIsLoadingData(false);
        setIsLabAccessRequestLoading(false); // Ensure this is also set
        return;
      }
      setIsLoadingData(true);
      setIsLabAccessRequestLoading(true); // Set specific loader for access requests
      try {
        // Use Promise.all to fetch data concurrently
        const [labsSnapshot, typesSnapshot, resourcesSnapshot, usersSnapshot, techniciansSnapshot, maintenanceSnapshot, boSnapshot, rrSnapshot, membershipsSnapshot] = await Promise.all([
          getDocs(query(collection(db, "labs"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "resourceTypes"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "resources"))), // No specific order needed here, just for counts/checks
          getDocs(query(collection(db, "users"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "users"), where("role", "==", "Technician"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "maintenanceRequests"), orderBy("dateReported", "desc"))),
          getDocs(query(collection(db, "blackoutDates"), orderBy("date", "asc"))),
          getDocs(query(collection(db, "recurringBlackoutRules"), orderBy("name", "asc"))),
          getDocs(query(collection(db, 'labMemberships'))), // Fetch all memberships
        ]);

        const fetchedLabs = labsSnapshot.docs.map(docSnap => ({id: docSnap.id, ...docSnap.data(), createdAt: (docSnap.data().createdAt as Timestamp)?.toDate(), lastUpdatedAt: (docSnap.data().lastUpdatedAt as Timestamp)?.toDate()} as Lab));
        setLabs(fetchedLabs);

        setResourceTypes(typesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ResourceType)));

        const fetchedResourcesAll = resourcesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Resource));
        setAllResourcesForCountsAndChecks(fetchedResourcesAll);

        const fetchedUsersAll = usersSnapshot.docs.map(d => ({id: d.id, ...d.data(), createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date()} as User));
        setAllUsersData(fetchedUsersAll); // Used by Maintenance and Lab Access Requests

        setAllTechniciansForMaintenance(techniciansSnapshot.docs.map(d => ({id: d.id, ...d.data(), createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date()} as User)));

        setMaintenanceRequests(maintenanceSnapshot.docs.map(docSnap => {
            const data = docSnap.data();
            return { id: docSnap.id, ...data, dateReported: (data.dateReported as Timestamp)?.toDate() || new Date(), dateResolved: (data.dateResolved as Timestamp)?.toDate() } as MaintenanceRequest;
        }));

        setBlackoutDates(boSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as BlackoutDate))); // labId will be null or string
        setRecurringRules(rrSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as RecurringBlackoutRule))); // labId will be null or string

        // Process all memberships
        const allFetchedMemberships = membershipsSnapshot.docs.map(mDoc => ({ id: mDoc.id, ...mDoc.data() } as LabMembership));
        setUserLabMemberships(allFetchedMemberships); // Store all for calculations (e.g., lab member counts)

        // Populate pending lab access requests (LabMembershipRequest type)
        const pendingRequestsPromises = allFetchedMemberships
            .filter(m => m.status === 'pending_approval')
            .map(async (membershipData) => {
                const user = fetchedUsersAll.find(u => u.id === membershipData.userId);
                const lab = fetchedLabs.find(l => l.id === membershipData.labId);
                return {
                    ...membershipData,
                    id: membershipData.id!, // Assuming all fetched docs have an ID
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
        setIsLabAccessRequestLoading(false); // Ensure this is set on error too
      } finally {
        setIsLoadingData(false);
        setIsLabAccessRequestLoading(false); // All data, including access requests, done loading
      }
    }, [toast, canManageAny]);

    useEffect(() => { fetchAllAdminData(); }, [fetchAllAdminData]);

    useEffect(() => {
        const preselectedLabId = searchParams?.labId;
        if (preselectedLabId && labs.find(l => l.id === preselectedLabId)) {
          setActiveContextId(preselectedLabId);
        } else if (preselectedLabId) {
          // If labId in URL doesn't exist, default to global or show error?
          // For now, defaulting to global if labId is invalid/not found.
          setActiveContextId(GLOBAL_CONTEXT_VALUE);
        }
      }, [searchParams, labs]);

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

    // --- Universal Section Logic (Rendered Based on Context) ---
    // Placeholder for Resource Types (System-Wide only)
    // Placeholder for Labs List (System-Wide only)
    // Placeholder for Lab Closures (System-Wide or Lab-Specific)
    // Placeholder for Maintenance (System-Wide or Lab-Specific based on resource's lab)
    // Placeholder for Lab Access (System-Wide requests or Lab-Specific members)

    // --- Resource Types Logic (Only for GLOBAL_CONTEXT_VALUE) ---
    // ... (all existing Resource Types logic from original file)

    // --- Labs List Logic (Only for GLOBAL_CONTEXT_VALUE) ---
    // ... (all existing Labs List logic from original file)

    // --- Lab Closures Logic (Context-Aware) ---
    // ... (all existing Blackout Dates & Recurring Rules logic, adapted for context)

    // --- Maintenance Requests Logic (Context-Aware) ---
    // ... (all existing Maintenance Requests logic, adapted for context)

    // --- Lab Access & Membership Logic (Context-Aware) ---
    // ... (all existing Lab Access Requests logic, adapted for context)

    // This is the permission check immediately before the main return
    if (!currentUser || !canManageAny) {
      return ( <div className="space-y-8"><PageHeader title="Lab Operations Center" icon={Cog} description="Access Denied." /><Card className="text-center py-10 text-muted-foreground"><CardContent><p>You do not have permission.</p></CardContent></Card></div>);
    }


  // The `maintenanceForSelectedLab` and other dependent useMemos that were previously commented out
  // will be restored in subsequent steps once their dependencies are confirmed to be error-free.
  // For now, they remain commented to ensure the parsing error is not from them.

  /*
    // const filteredLabAccessRequests = useMemo(() => {
    //   // ... logic ...
    // }, [allLabAccessRequests, activeContextId, activeSystemWideAccessRequestsFilterLabId, activeSystemWideAccessRequestsFilterUser]);

    // const activeLabMembers = useMemo(() => {
    //   // ... logic ...
    // }, [userLabMemberships, allUsersData, activeContextId]);

    // const resourcesInSelectedLab = useMemo(() => allResourcesForCountsAndChecks.filter(r => r.labId === activeContextId), [allResourcesForCountsAndChecks, activeContextId]);

    // const maintenanceForSelectedLab = useMemo(() => {
    //   return maintenanceRequests.filter(mr => resourcesInSelectedLab.some(r => r.id === mr.resourceId));
    // }, [maintenanceRequests, resourcesInSelectedLab]);
  */

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lab Operations Center"
        description="Manage all aspects of your lab operations, from system-wide settings to individual lab details."
        icon={Cog}
        actions={pageHeaderActionsContent}
      />
      {/* The rest of the UI (Tabs, Cards, etc.) will be restored in subsequent steps */}
      {isLoadingData && (
        <div className="flex justify-center items-center py-20">
            <Loader2 className="h-12 w-12 animate-spin text-primary"/>
            <p className="ml-4 text-lg text-muted-foreground">Loading Lab Operations Data...</p>
        </div>
      )}

      {!isLoadingData && activeContextId === GLOBAL_CONTEXT_VALUE && (
        <Tabs defaultValue={searchParams?.tab || "labs"} className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:grid-cols-5">
            <TabsTrigger value="labs">Manage Labs</TabsTrigger>
            <TabsTrigger value="resource-types">Resource Types</TabsTrigger>
            <TabsTrigger value="global-closures">Global Closures</TabsTrigger>
            <TabsTrigger value="maintenance-log">Maintenance Log</TabsTrigger>
            <TabsTrigger value="lab-access-requests">Lab Access Requests</TabsTrigger>
          </TabsList>
          {/* Content for GLOBAL_CONTEXT_VALUE tabs will be restored here */}
        </Tabs>
      )}

      {!isLoadingData && activeContextId !== GLOBAL_CONTEXT_VALUE && selectedLabDetails && (
         <Tabs defaultValue={searchParams?.tab || "lab-details"} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                <TabsTrigger value="lab-details">Lab Overview</TabsTrigger>
                <TabsTrigger value="lab-closures">Closures</TabsTrigger>
                <TabsTrigger value="lab-maintenance">Maintenance</TabsTrigger>
                <TabsTrigger value="lab-members">Members & Access</TabsTrigger>
            </TabsList>
            {/* Content for Lab-Specific context tabs will be restored here */}
        </Tabs>
      )}

      {/* Dialogs will be restored here */}
    </div>
  );
}
