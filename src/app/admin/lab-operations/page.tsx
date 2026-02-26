
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PageHeader } from '@/components/layout/page-header';
import { Cog, Loader2, Building, Globe } from 'lucide-react';
import type { ResourceType, Resource, Lab, BlackoutDate, RecurringBlackoutRule, MaintenanceRequest, User, LabMembership, Booking } from '@/types';
import { useAuth } from '@/components/auth-context';
import { useAdminData } from '@/contexts/AdminDataContext';
import { Button } from "@/components/ui/button";
import { useToast } from '@/hooks/use-toast';
import { LabFormDialog, LabFormValues } from '@/components/admin/lab-form-dialog';
import { BlackoutDateFormDialog, BlackoutDateFormValues as BlackoutDateDialogFormValues } from '@/components/admin/blackout-date-form-dialog';
import { RecurringBlackoutRuleFormDialog, RecurringBlackoutRuleFormValues as RecurringRuleDialogFormValues } from '@/components/admin/recurring-blackout-rule-form-dialog';
import { MaintenanceRequestFormDialog, MaintenanceRequestFormValues as MaintenanceDialogFormValues } from '@/components/admin/maintenance-request-form-dialog';
import { ManageUserLabAccessDialog } from '@/components/admin/manage-user-lab-access-dialog';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { manageLabMembership_SA } from '@/lib/db-helpers';
import { getResources_SA, getMaintenanceRequests_SA, getBlackoutDates_SA, getRecurringBlackoutRules_SA, getAllLabMemberships_SA, getBookings_SA } from '@/lib/actions/data.actions';
import { createLab_SA, updateLab_SA, deleteLab_SA } from '@/lib/actions/lab.actions';
import { createBlackoutDate_SA, deleteBlackoutDate_SA, createRecurringRule_SA, deleteRecurringRule_SA, createMaintenanceRequest_SA, updateMaintenanceRequest_SA } from '@/lib/actions/lab-operations.actions';

// Import Tab Components
import { ManageLabsTab } from '@/components/admin/lab-operations/tabs/ManageLabsTab';
import { GlobalClosuresTab } from '@/components/admin/lab-operations/tabs/GlobalClosuresTab';
import { SystemMaintenanceLogTab } from '@/components/admin/lab-operations/tabs/SystemMaintenanceLogTab';
import { LabAccessRequestsTab } from '@/components/admin/lab-operations/tabs/LabAccessRequestsTab';
import { LabSpecificOverviewTab } from '@/components/admin/lab-operations/tabs/LabSpecificOverviewTab';
import { LabSpecificClosuresTab } from '@/components/admin/lab-operations/tabs/LabSpecificClosuresTab';
import { LabSpecificMaintenanceTab } from '@/components/admin/lab-operations/tabs/LabSpecificMaintenanceTab';
import { LabSpecificMembersTab } from '@/components/admin/lab-operations/tabs/LabSpecificMembersTab';
import { cn, formatDateSafe } from '@/lib/utils';
import { isValid as isValidDateFn, parseISO } from 'date-fns';

const GLOBAL_CONTEXT_VALUE = "--system-wide--";

interface LabMembershipRequest extends LabMembership {
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
  labName?: string;
}

interface LabMembershipDisplay extends LabMembership {
  userName: string;
  userEmail: string;
  userAvatarUrl?: string;
}

type LabSortableColumn = 'name' | 'location' | 'resourceCount' | 'memberCount';

export default function LabOperationsCenterPage() {
    const { toast } = useToast();
    const { currentUser, isLoading: authIsLoading } = useAuth();
    const searchParamsObj = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();

    const {
      labs,
      allUsers: allUsersData,
      allTechnicians: allTechniciansForMaintenance,
      isLoading: isAdminDataLoading
    } = useAdminData();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [activeContextId, setActiveContextId] = useState<string>(GLOBAL_CONTEXT_VALUE);
    
    const [allResourcesForCountsAndChecks, setAllResourcesForCountsAndChecks] = useState<Resource[]>([]);
    const [labToDelete, setLabToDelete] = useState<Lab | null>(null);
    const [isLabFormDialogOpen, setIsLabFormDialogOpen] = useState(false);
    const [editingLab, setEditingLab] = useState<Lab | null>(null);
    const [isLabFilterDialogOpen, setIsLabFilterDialogOpen] = useState(false);
    const [tempLabSearchTerm, setTempLabSearchTerm] = useState('');
    const [activeLabSearchTerm, setActiveLabSearchTerm] = useState('');
    const [tempLabSortBy, setTempLabSortBy] = useState<string>('name-asc');
    const [activeLabSortBy, setActiveLabSortBy] = useState<string>('name-asc');

    const [allBlackoutDates, setAllBlackoutDates] = useState<BlackoutDate[]>([]);
    const [allRecurringRules, setAllRecurringRules] = useState<RecurringBlackoutRule[]>([]);
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
    
    const [activeLabClosuresTab, setActiveLabClosuresTab] = useState('specific-dates-lab');
    const [isLabSpecificDateFormDialogOpen, setIsLabSpecificDateFormDialogOpen] = useState(false);
    const [editingLabSpecificBlackoutDate, setEditingLabSpecificBlackoutDate] = useState<BlackoutDate | null>(null);
    const [labSpecificDateToDelete, setLabSpecificDateToDelete] = useState<BlackoutDate | null>(null);
    const [isLabSpecificRecurringFormDialogOpen, setIsLabSpecificRecurringFormDialogOpen] = useState(false);
    const [editingLabSpecificRecurringRule, setEditingLabSpecificRecurringRule] = useState<RecurringBlackoutRule | null>(null);
    const [labSpecificRuleToDelete, setLabSpecificRuleToDelete] = useState<RecurringBlackoutRule | null>(null);
    const [isLabSpecificClosureFilterDialogOpen, setIsLabSpecificClosureFilterDialogOpen] = useState(false);
    const [tempLabSpecificClosureSearchTerm, setTempLabSpecificClosureSearchTerm] = useState('');
    const [activeLabSpecificClosureSearchTerm, setActiveLabSpecificClosureSearchTerm] = useState('');

    const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
    const [isMaintenanceFormDialogOpen, setIsMaintenanceFormDialogOpen] = useState(false);
    const [editingMaintenanceRequest, setEditingMaintenanceRequest] = useState<MaintenanceRequest | null>(null);
    
    const [isMaintenanceFilterDialogOpen, setIsMaintenanceFilterDialogOpen] = useState(false);
    const [tempMaintenanceSearchTerm, setTempMaintenanceSearchTerm] = useState('');
    const [tempMaintenanceFilterStatus, setTempMaintenanceFilterStatus] = useState<MaintenanceRequest['status'] | 'all'>('all');
    const [tempMaintenanceFilterResourceId, setTempMaintenanceFilterResourceId] = useState<string>('all');
    const [tempMaintenanceFilterTechnicianId, setTempMaintenanceFilterTechnicianId] = useState<string>('all');
    const [activeMaintenanceSearchTerm, setActiveMaintenanceSearchTerm] = useState('');
    const [activeMaintenanceFilterStatus, setActiveMaintenanceFilterStatus] = useState<MaintenanceRequest['status'] | 'all'>('all');
    const [activeMaintenanceFilterResourceId, setActiveMaintenanceFilterResourceId] = useState<string>('all');
    const [activeMaintenanceFilterTechnicianId, setActiveMaintenanceFilterTechnicianId] = useState<string>('all');

    const [isLabSpecificMaintenanceFilterDialogOpen, setIsLabSpecificMaintenanceFilterDialogOpen] = useState(false);
    const [tempLabSpecificMaintenanceSearchTerm, setTempLabSpecificMaintenanceSearchTerm] = useState('');
    const [activeLabSpecificMaintenanceSearchTerm, setActiveLabSpecificMaintenanceSearchTerm] = useState('');
    const [tempLabSpecificMaintenanceStatusFilter, setTempLabSpecificMaintenanceStatusFilter] = useState<MaintenanceRequest['status'] | 'all'>('all');
    const [activeLabSpecificMaintenanceStatusFilter, setActiveLabSpecificMaintenanceStatusFilter] = useState<MaintenanceRequest['status'] | 'all'>('all');
    const [tempLabSpecificMaintenanceResourceIdFilter, setTempLabSpecificMaintenanceResourceIdFilter] = useState<string>('all'); 
    const [activeLabSpecificMaintenanceResourceIdFilter, setActiveLabSpecificMaintenanceResourceIdFilter] = useState<string>('all');
    const [tempLabSpecificMaintenanceTechnicianIdFilter, setTempLabSpecificMaintenanceTechnicianIdFilter] = useState<string>('all');
    const [activeLabSpecificMaintenanceTechnicianIdFilter, setActiveLabSpecificMaintenanceTechnicianIdFilter] = useState<string>('all');

    const [allLabAccessRequests, setAllLabAccessRequests] = useState<LabMembershipRequest[]>([]); 
    const [userLabMemberships, setUserLabMemberships] = useState<LabMembership[]>([]); 
    const [isProcessingLabAccessAction, setIsProcessingLabAccessAction] = useState<Record<string, boolean>>({});
    const [isLabAccessRequestLoading, setIsLabAccessRequestLoading] = useState(true);
    const [isLabSpecificMemberAddDialogOpen, setIsLabSpecificMemberAddDialogOpen] = useState(false);
    const [allBookingsState, setAllBookingsState] = useState<(Booking & { resourceName?: string, userName?: string })[]>([]);


    const canManageAny = useMemo(() => currentUser && currentUser.role === 'Admin', [currentUser]);

    const fetchRemainingData = useCallback(async () => {
      if (!canManageAny) {
        setIsLoadingData(false);
        setIsLabAccessRequestLoading(false);
        return;
      }
      setIsLoadingData(true);
      setIsLabAccessRequestLoading(true);
      try {
        const [resourcesResult, maintenanceResult, blackoutResult, recurringResult, membershipsResult, bookingsResult] = await Promise.all([
          getResources_SA(),
          getMaintenanceRequests_SA(),
          getBlackoutDates_SA(),
          getRecurringBlackoutRules_SA(),
          getAllLabMemberships_SA(),
          getBookings_SA({}),
        ]);

        const fetchedResourcesAll = resourcesResult.success && resourcesResult.data ? resourcesResult.data : [];
        setAllResourcesForCountsAndChecks(fetchedResourcesAll);

        setMaintenanceRequests(maintenanceResult.success && maintenanceResult.data ? maintenanceResult.data : []);

        setAllBlackoutDates(blackoutResult.success && blackoutResult.data ? blackoutResult.data : []);
        setAllRecurringRules(recurringResult.success && recurringResult.data ? recurringResult.data : []);

        const allFetchedMemberships = membershipsResult.success && membershipsResult.data ? membershipsResult.data : [];
        setUserLabMemberships(allFetchedMemberships);

        const pendingRequests = allFetchedMemberships
            .filter(m => m.status === 'pending_approval')
            .map((membershipData) => {
                const user = allUsersData.find(u => u.id === membershipData.userId);
                const lab = labs.find(l => l.id === membershipData.labId);
                return {
                    ...membershipData,
                    id: membershipData.id!,
                    userName: user?.name || 'Unknown User',
                    userEmail: user?.email || 'N/A',
                    userAvatarUrl: user?.avatarUrl,
                    labName: lab?.name || 'Unknown Lab',
                } as LabMembershipRequest;
            });
        setAllLabAccessRequests(pendingRequests);

        const fetchedBookings = bookingsResult.success && bookingsResult.data ? bookingsResult.data : [];
        setAllBookingsState(fetchedBookings as (Booking & { resourceName?: string, userName?: string })[]);

      } catch (error: any) {
        toast({ title: "Error", description: `Failed to load operational data: ${error.message}`, variant: "destructive" });
      } finally {
        setIsLoadingData(false);
        setIsLabAccessRequestLoading(false);
      }
    }, [toast, canManageAny, allUsersData, labs]);

    useEffect(() => {
        if (!isAdminDataLoading) {
            fetchRemainingData();
        }
    }, [fetchRemainingData, isAdminDataLoading]);

    useEffect(() => {
      const preselectedLabIdFromUrl = searchParamsObj.get('labId');
      if (preselectedLabIdFromUrl && labs.find(l => l.id === preselectedLabIdFromUrl)) {
        setActiveContextId(preselectedLabIdFromUrl);
      } else if (preselectedLabIdFromUrl) {
        const newSearchParams = new URLSearchParams(searchParamsObj.toString());
        newSearchParams.delete('labId');
        router.replace(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
        setActiveContextId(GLOBAL_CONTEXT_VALUE);
      }
    }, [searchParamsObj, labs, router, pathname]);

    const selectedLabDetails = useMemo(() => labs.find(lab => lab.id === activeContextId), [labs, activeContextId]);

    const handleContextChange = (newContextId: string) => {
        setActiveContextId(newContextId);
        const newSearchParams = new URLSearchParams(searchParamsObj.toString());
        if (newContextId === GLOBAL_CONTEXT_VALUE) {
            newSearchParams.delete('labId');
        } else {
            newSearchParams.set('labId', newContextId);
        }
        router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    };

    const pageHeaderActionsContent = (
      <div className="flex items-center gap-2">
        <Select value={activeContextId} onValueChange={handleContextChange}>
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
    
    const handleOpenEditSelectedLabDialog = useCallback(() => { 
        if (selectedLabDetails) {
          setEditingLab(selectedLabDetails);
          setIsLabFormDialogOpen(true);
        }
    }, [selectedLabDetails]);

    const handleSaveLab = useCallback(async (data: LabFormValues) => {
        if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; }
        setIsLoadingData(true);
        try {
            if (editingLab) {
                const result = await updateLab_SA({
                    callerUserId: currentUser.id,
                    labId: editingLab.id,
                    name: data.name,
                    location: data.location || undefined,
                    description: data.description || undefined,
                });
                if (!result.success) { toast({ title: "Save Error", description: result.message || "Could not update lab.", variant: "destructive" }); return; }
            } else {
                const result = await createLab_SA({
                    callerUserId: currentUser.id,
                    name: data.name,
                    location: data.location || undefined,
                    description: data.description || undefined,
                });
                if (!result.success) { toast({ title: "Save Error", description: result.message || "Could not create lab.", variant: "destructive" }); return; }
            }
            toast({ title: `Lab ${editingLab ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingLab ? 'updated' : 'created'}.` });
            setIsLabFormDialogOpen(false);
            setEditingLab(null);
            fetchRemainingData();
        } catch (error: any) {
            toast({ title: "Save Error", description: `Could not save lab: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoadingData(false);
        }
    }, [currentUser, canManageAny, editingLab, fetchRemainingData, toast]);

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
            const result = await deleteLab_SA({ callerUserId: currentUser.id, labId });
            if (!result.success) { toast({ title: "Delete Error", description: result.message || "Could not delete lab.", variant: "destructive" }); return; }
            toast({ title: "Lab Deleted", description: `Lab "${deletedLab.name}" removed.`, variant: "destructive" });
            setLabToDelete(null);
            fetchRemainingData();
            if (activeContextId === labId) {
                setActiveContextId(GLOBAL_CONTEXT_VALUE);
            }
        } catch (error: any) {
            toast({ title: "Delete Error", description: `Could not delete lab: ${error.message}`, variant: "destructive" });
        } finally {
            setIsLoadingData(false);
        }
    }, [currentUser, canManageAny, labs, allResourcesForCountsAndChecks, userLabMemberships, fetchRemainingData, toast, activeContextId]);

    const activeLabFilterCount = useMemo(() => [activeLabSearchTerm !== '', activeLabSortBy !== 'name-asc'].filter(Boolean).length, [activeLabSearchTerm, activeLabSortBy]);

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
            const dateString = bd.date;
            const dateMatch = dateString && isValidDateFn(parseISO(dateString)) && formatDateSafe(parseISO(dateString), '', 'PPP').toLowerCase().includes(lowerSearchTerm);
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
        const formattedDateOnly = formatDateSafe(data.date, '', 'yyyy-MM-dd');
        setIsLoadingData(true);
        try {
            if (editingGlobalBlackoutDate) {
                // Global blackout dates: delete old and create new (no update SA for blackout dates)
                const deleteResult = await deleteBlackoutDate_SA({ callerUserId: currentUser.id, blackoutDateId: editingGlobalBlackoutDate.id });
                if (!deleteResult.success) { toast({ title: "Save Failed", description: deleteResult.message || "Could not update global blackout date.", variant: "destructive" }); return; }
                const createResult = await createBlackoutDate_SA({ callerUserId: currentUser.id, date: formattedDateOnly, reason: data.reason || undefined });
                if (!createResult.success) { toast({ title: "Save Failed", description: createResult.message || "Could not recreate global blackout date.", variant: "destructive" }); return; }
                toast({ title: 'Global Blackout Date Updated'});
            } else {
                const result = await createBlackoutDate_SA({ callerUserId: currentUser.id, date: formattedDateOnly, reason: data.reason || undefined });
                if (!result.success) { toast({ title: "Save Failed", description: result.message || "Could not add global blackout date.", variant: "destructive" }); return; }
                toast({ title: 'Global Blackout Date Added'});
            }
            setIsGlobalDateFormDialogOpen(false);
            setEditingGlobalBlackoutDate(null);
            fetchRemainingData();
        } catch (error: any) { toast({ title: "Save Failed", description: `Failed to save global blackout date: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, editingGlobalBlackoutDate, fetchRemainingData, toast]);

    const handleDeleteGlobalBlackoutDate = useCallback(async (blackoutDateId: string) => {
        if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; }
        setIsLoadingData(true);
        try {
            const result = await deleteBlackoutDate_SA({ callerUserId: currentUser.id, blackoutDateId });
            if (!result.success) { toast({ title: "Delete Failed", description: result.message || "Could not delete global blackout date.", variant: "destructive" }); return; }
            toast({ title: "Global Blackout Date Removed", variant: "destructive" });
            setGlobalDateToDelete(null);
            fetchRemainingData();
        } catch (error: any) { toast({ title: "Delete Failed", description: `Failed to delete global blackout date: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, fetchRemainingData, toast]);

    const handleOpenNewGlobalRecurringDialog = useCallback(() => { setEditingGlobalRecurringRule(null); setIsGlobalRecurringFormDialogOpen(true); }, []);
    const handleOpenEditGlobalRecurringDialog = useCallback((rule: RecurringBlackoutRule) => { setEditingGlobalRecurringRule(rule); setIsGlobalRecurringFormDialogOpen(true); }, []);

    const handleSaveGlobalRecurringRule = useCallback(async (data: RecurringRuleDialogFormValues) => {
        if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; }
        setIsLoadingData(true);
        try {
            if (editingGlobalRecurringRule) {
                // Global recurring rules: delete old and create new (no update SA for recurring rules)
                const deleteResult = await deleteRecurringRule_SA({ callerUserId: currentUser.id, ruleId: editingGlobalRecurringRule.id });
                if (!deleteResult.success) { toast({ title: "Save Failed", description: deleteResult.message || "Could not update global recurring rule.", variant: "destructive" }); return; }
                const createResult = await createRecurringRule_SA({ callerUserId: currentUser.id, name: data.name, daysOfWeek: data.daysOfWeek, reason: data.reason || undefined });
                if (!createResult.success) { toast({ title: "Save Failed", description: createResult.message || "Could not recreate global recurring rule.", variant: "destructive" }); return; }
                toast({ title: 'Global Recurring Rule Updated'});
            } else {
                const result = await createRecurringRule_SA({ callerUserId: currentUser.id, name: data.name, daysOfWeek: data.daysOfWeek, reason: data.reason || undefined });
                if (!result.success) { toast({ title: "Save Failed", description: result.message || "Could not add global recurring rule.", variant: "destructive" }); return; }
                toast({ title: 'Global Recurring Rule Added'});
            }
            setIsGlobalRecurringFormDialogOpen(false);
            setEditingGlobalRecurringRule(null);
            fetchRemainingData();
        } catch (error: any) { toast({ title: "Save Failed", description: `Failed to save global recurring rule: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, editingGlobalRecurringRule, fetchRemainingData, toast]);

    const handleDeleteGlobalRecurringRule = useCallback(async (ruleId: string) => {
        if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; }
        setIsLoadingData(true);
        try {
            const result = await deleteRecurringRule_SA({ callerUserId: currentUser.id, ruleId });
            if (!result.success) { toast({ title: "Delete Failed", description: result.message || "Could not delete global recurring rule.", variant: "destructive" }); return; }
            toast({ title: "Global Recurring Rule Removed", variant: "destructive" });
            setGlobalRuleToDelete(null);
            fetchRemainingData();
        } catch (error: any) { toast({ title: "Delete Failed", description: `Failed to delete global recurring rule: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, fetchRemainingData, toast]);
    
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

    useEffect(() => {
        if (isLabSpecificClosureFilterDialogOpen) {
            setTempLabSpecificClosureSearchTerm(activeLabSpecificClosureSearchTerm);
        }
    }, [isLabSpecificClosureFilterDialogOpen, activeLabSpecificClosureSearchTerm]);

    const filteredLabSpecificBlackoutDates = useMemo(() => {
        return allBlackoutDates.filter(bd => {
            const isForCurrentLab = bd.labId === activeContextId;
            const lowerSearchTerm = activeLabSpecificClosureSearchTerm.toLowerCase();
            const reasonMatch = bd.reason && bd.reason.toLowerCase().includes(lowerSearchTerm);
            const dateString = bd.date;
            const dateMatch = dateString && isValidDateFn(parseISO(dateString)) && formatDateSafe(parseISO(dateString), '', 'PPP').toLowerCase().includes(lowerSearchTerm);
            return isForCurrentLab && (!activeLabSpecificClosureSearchTerm || reasonMatch || dateMatch);
        });
    }, [allBlackoutDates, activeContextId, activeLabSpecificClosureSearchTerm]);

    const filteredLabSpecificRecurringRules = useMemo(() => {
        return allRecurringRules.filter(rule => {
            const isForCurrentLab = rule.labId === activeContextId;
            const lowerSearchTerm = activeLabSpecificClosureSearchTerm.toLowerCase();
            const nameMatch = rule.name && rule.name.toLowerCase().includes(lowerSearchTerm);
            const reasonMatch = rule.reason && rule.reason.toLowerCase().includes(lowerSearchTerm);
            return isForCurrentLab && (!activeLabSpecificClosureSearchTerm || nameMatch || reasonMatch);
        });
    }, [allRecurringRules, activeContextId, activeLabSpecificClosureSearchTerm]);

    const handleOpenNewLabSpecificDateDialog = useCallback(() => { setEditingLabSpecificBlackoutDate(null); setIsLabSpecificDateFormDialogOpen(true); }, []);
    const handleOpenEditLabSpecificDateDialog = useCallback((bd: BlackoutDate) => { setEditingLabSpecificBlackoutDate(bd); setIsLabSpecificDateFormDialogOpen(true); }, []);

    const handleSaveLabSpecificBlackoutDate = useCallback(async (data: BlackoutDateDialogFormValues) => {
        if (!currentUser || !currentUser.id || !currentUser.name || activeContextId === GLOBAL_CONTEXT_VALUE) { toast({ title: "Error", description: "Cannot save lab-specific date without lab context or auth.", variant: "destructive" }); return; }
        const formattedDateOnly = formatDateSafe(data.date, '', 'yyyy-MM-dd');
        setIsLoadingData(true);
        try {
            if (editingLabSpecificBlackoutDate) {
                // Lab-specific blackout dates: delete old and create new (no update SA for blackout dates)
                const deleteResult = await deleteBlackoutDate_SA({ callerUserId: currentUser.id, blackoutDateId: editingLabSpecificBlackoutDate.id });
                if (!deleteResult.success) { toast({ title: "Save Failed", description: deleteResult.message || "Could not update lab blackout date.", variant: "destructive" }); return; }
                const createResult = await createBlackoutDate_SA({ callerUserId: currentUser.id, labId: activeContextId, date: formattedDateOnly, reason: data.reason || undefined });
                if (!createResult.success) { toast({ title: "Save Failed", description: createResult.message || "Could not recreate lab blackout date.", variant: "destructive" }); return; }
                toast({ title: 'Lab Blackout Date Updated'});
            } else {
                const result = await createBlackoutDate_SA({ callerUserId: currentUser.id, labId: activeContextId, date: formattedDateOnly, reason: data.reason || undefined });
                if (!result.success) { toast({ title: "Save Failed", description: result.message || "Could not add lab blackout date.", variant: "destructive" }); return; }
                toast({ title: 'Lab Blackout Date Added'});
            }
            setIsLabSpecificDateFormDialogOpen(false);
            setEditingLabSpecificBlackoutDate(null);
            fetchRemainingData();
        } catch (error: any) { toast({ title: "Save Failed", description: `Failed to save lab-specific blackout date: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, editingLabSpecificBlackoutDate, activeContextId, fetchRemainingData, toast]);

    const handleDeleteLabSpecificBlackoutDate = useCallback(async (blackoutDateId: string) => {
        if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; }
        setIsLoadingData(true);
        try {
            const result = await deleteBlackoutDate_SA({ callerUserId: currentUser.id, blackoutDateId });
            if (!result.success) { toast({ title: "Delete Failed", description: result.message || "Could not delete lab blackout date.", variant: "destructive" }); return; }
            toast({ title: "Lab Blackout Date Removed", variant: "destructive" });
            setLabSpecificDateToDelete(null);
            fetchRemainingData();
        } catch (error: any) { toast({ title: "Delete Failed", description: `Failed to delete lab-specific blackout date: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, fetchRemainingData, toast]);

    const handleOpenNewLabSpecificRecurringDialog = useCallback(() => { setEditingLabSpecificRecurringRule(null); setIsLabSpecificRecurringFormDialogOpen(true); }, []);
    const handleOpenEditLabSpecificRecurringDialog = useCallback((rule: RecurringBlackoutRule) => { setEditingLabSpecificRecurringRule(rule); setIsLabSpecificRecurringFormDialogOpen(true); }, []);

    const handleSaveLabSpecificRecurringRule = useCallback(async (data: RecurringRuleDialogFormValues) => {
        if (!currentUser || !currentUser.id || !currentUser.name || activeContextId === GLOBAL_CONTEXT_VALUE) { toast({ title: "Error", description: "Cannot save lab-specific rule without lab context or auth.", variant: "destructive" }); return; }
        setIsLoadingData(true);
        try {
            if (editingLabSpecificRecurringRule) {
                // Lab-specific recurring rules: delete old and create new (no update SA for recurring rules)
                const deleteResult = await deleteRecurringRule_SA({ callerUserId: currentUser.id, ruleId: editingLabSpecificRecurringRule.id });
                if (!deleteResult.success) { toast({ title: "Save Failed", description: deleteResult.message || "Could not update lab recurring rule.", variant: "destructive" }); return; }
                const createResult = await createRecurringRule_SA({ callerUserId: currentUser.id, labId: activeContextId, name: data.name, daysOfWeek: data.daysOfWeek, reason: data.reason || undefined });
                if (!createResult.success) { toast({ title: "Save Failed", description: createResult.message || "Could not recreate lab recurring rule.", variant: "destructive" }); return; }
                toast({ title: 'Lab Recurring Rule Updated'});
            } else {
                const result = await createRecurringRule_SA({ callerUserId: currentUser.id, labId: activeContextId, name: data.name, daysOfWeek: data.daysOfWeek, reason: data.reason || undefined });
                if (!result.success) { toast({ title: "Save Failed", description: result.message || "Could not add lab recurring rule.", variant: "destructive" }); return; }
                toast({ title: 'Lab Recurring Rule Added'});
            }
            setIsLabSpecificRecurringFormDialogOpen(false);
            setEditingLabSpecificRecurringRule(null);
            fetchRemainingData();
        } catch (error: any) { toast({ title: "Save Failed", description: `Failed to save lab-specific recurring rule: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, editingLabSpecificRecurringRule, activeContextId, fetchRemainingData, toast]);

    const handleDeleteLabSpecificRecurringRule = useCallback(async (ruleId: string) => {
        if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; }
        setIsLoadingData(true);
        try {
            const result = await deleteRecurringRule_SA({ callerUserId: currentUser.id, ruleId });
            if (!result.success) { toast({ title: "Delete Failed", description: result.message || "Could not delete lab recurring rule.", variant: "destructive" }); return; }
            toast({ title: "Lab Recurring Rule Removed", variant: "destructive" });
            setLabSpecificRuleToDelete(null);
            fetchRemainingData();
        } catch (error: any) { toast({ title: "Delete Failed", description: `Failed to delete lab-specific recurring rule: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, fetchRemainingData, toast]);

    const handleApplyLabSpecificClosureDialogFilters = useCallback(() => {
        setActiveLabSpecificClosureSearchTerm(tempLabSpecificClosureSearchTerm);
        setIsLabSpecificClosureFilterDialogOpen(false);
    }, [tempLabSpecificClosureSearchTerm]);

    const resetLabSpecificClosureDialogFiltersOnly = useCallback(() => {
        setTempLabSpecificClosureSearchTerm('');
    }, []);

    const resetAllActiveLabSpecificClosurePageFilters = useCallback(() => {
        setActiveLabSpecificClosureSearchTerm('');
        resetLabSpecificClosureDialogFiltersOnly();
        setIsLabSpecificClosureFilterDialogOpen(false);
    }, [resetLabSpecificClosureDialogFiltersOnly]);
    
    const activeLabSpecificClosureFilterCount = useMemo(() => [activeLabSpecificClosureSearchTerm !== ''].filter(Boolean).length, [activeLabSpecificClosureSearchTerm]);

    const labSpecificStats = useMemo(() => {
        if (!selectedLabDetails) return { resourceCount: 0, activeMemberCount: 0, openMaintenanceCount: 0 };
        const resourceCount = allResourcesForCountsAndChecks.filter(res => res.labId === selectedLabDetails.id).length;
        const activeMemberCount = userLabMemberships.filter(mem => mem.labId === selectedLabDetails.id && mem.status === 'active').length;
        const openMaintenanceCount = maintenanceRequests.filter(req => {
            const resourceForRequest = allResourcesForCountsAndChecks.find(r => r.id === req.resourceId);
            return resourceForRequest?.labId === selectedLabDetails.id && req.status === 'Open';
        }).length;
        return { resourceCount, activeMemberCount, openMaintenanceCount };
    }, [selectedLabDetails, allResourcesForCountsAndChecks, userLabMemberships, maintenanceRequests]);


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
                resourceLabId: resource?.labId, 
                reportedByUserName: reporter?.name || 'Unknown User',
                assignedTechnicianName: technician?.name,
            };
        }).filter(req => {
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

    useEffect(() => {
      if (isLabSpecificMaintenanceFilterDialogOpen) {
        setTempLabSpecificMaintenanceSearchTerm(activeLabSpecificMaintenanceSearchTerm);
        setTempLabSpecificMaintenanceStatusFilter(activeLabSpecificMaintenanceStatusFilter);
        setTempLabSpecificMaintenanceResourceIdFilter(activeLabSpecificMaintenanceResourceIdFilter);
        setTempLabSpecificMaintenanceTechnicianIdFilter(activeLabSpecificMaintenanceTechnicianIdFilter);
      }
    }, [isLabSpecificMaintenanceFilterDialogOpen, activeLabSpecificMaintenanceSearchTerm, activeLabSpecificMaintenanceStatusFilter, activeLabSpecificMaintenanceResourceIdFilter, activeLabSpecificMaintenanceTechnicianIdFilter]);
    
    const labSpecificFilteredMaintenanceRequests = useMemo(() => {
      if (activeContextId === GLOBAL_CONTEXT_VALUE) return []; 
      
      return maintenanceRequests
        .map(req => { 
            const resource = allResourcesForCountsAndChecks.find(r => r.id === req.resourceId);
            const reporter = allUsersData.find(u => u.id === req.reportedByUserId);
            const technician = allTechniciansForMaintenance.find(t => t.id === req.assignedTechnicianId);
            return {
                ...req,
                resourceName: resource?.name || 'Unknown Resource',
                resourceLabId: resource?.labId,
                reportedByUserName: reporter?.name || 'Unknown User',
                assignedTechnicianName: technician?.name,
            };
        })
        .filter(req => req.resourceLabId === activeContextId) 
        .filter(req => { 
            const lowerSearchTerm = activeLabSpecificMaintenanceSearchTerm.toLowerCase();
            const searchMatch = !activeLabSpecificMaintenanceSearchTerm ||
                (req.resourceName && req.resourceName.toLowerCase().includes(lowerSearchTerm)) ||
                (req.reportedByUserName && req.reportedByUserName.toLowerCase().includes(lowerSearchTerm)) ||
                (req.issueDescription && req.issueDescription.toLowerCase().includes(lowerSearchTerm)) ||
                (req.assignedTechnicianName && req.assignedTechnicianName.toLowerCase().includes(lowerSearchTerm));
            
            const statusMatch = activeLabSpecificMaintenanceStatusFilter === 'all' || req.status === activeLabSpecificMaintenanceStatusFilter;
            
            const resourceMatch = activeLabSpecificMaintenanceResourceIdFilter === 'all' || req.resourceId === activeLabSpecificMaintenanceResourceIdFilter;
            
            let technicianMatch = true;
            if (activeLabSpecificMaintenanceTechnicianIdFilter !== 'all') {
                if (activeLabSpecificMaintenanceTechnicianIdFilter === '--unassigned--') {
                    technicianMatch = !req.assignedTechnicianId;
                } else {
                    technicianMatch = req.assignedTechnicianId === activeLabSpecificMaintenanceTechnicianIdFilter;
                }
            }
            return searchMatch && statusMatch && resourceMatch && technicianMatch;
        });
    }, [
      maintenanceRequests, allResourcesForCountsAndChecks, allUsersData, allTechniciansForMaintenance, activeContextId,
      activeLabSpecificMaintenanceSearchTerm, activeLabSpecificMaintenanceStatusFilter, 
      activeLabSpecificMaintenanceResourceIdFilter, activeLabSpecificMaintenanceTechnicianIdFilter
    ]);

    const handleApplyLabSpecificMaintenanceDialogFilters = useCallback(() => {
      setActiveLabSpecificMaintenanceSearchTerm(tempLabSpecificMaintenanceSearchTerm.toLowerCase());
      setActiveLabSpecificMaintenanceStatusFilter(tempLabSpecificMaintenanceStatusFilter);
      setActiveLabSpecificMaintenanceResourceIdFilter(tempLabSpecificMaintenanceResourceIdFilter);
      setActiveLabSpecificMaintenanceTechnicianIdFilter(tempLabSpecificMaintenanceTechnicianIdFilter);
      setIsLabSpecificMaintenanceFilterDialogOpen(false);
    }, [tempLabSpecificMaintenanceSearchTerm, tempLabSpecificMaintenanceStatusFilter, tempLabSpecificMaintenanceResourceIdFilter, tempLabSpecificMaintenanceTechnicianIdFilter]);

    const resetLabSpecificMaintenanceDialogFiltersOnly = useCallback(() => {
      setTempLabSpecificMaintenanceSearchTerm('');
      setTempLabSpecificMaintenanceStatusFilter('all');
      setTempLabSpecificMaintenanceResourceIdFilter('all');
      setTempLabSpecificMaintenanceTechnicianIdFilter('all');
    }, []);

    const resetAllActiveLabSpecificMaintenancePageFilters = useCallback(() => {
      setActiveLabSpecificMaintenanceSearchTerm('');
      setActiveLabSpecificMaintenanceStatusFilter('all');
      setActiveLabSpecificMaintenanceResourceIdFilter('all');
      setActiveLabSpecificMaintenanceTechnicianIdFilter('all');
      resetLabSpecificMaintenanceDialogFiltersOnly();
      setIsLabSpecificMaintenanceFilterDialogOpen(false);
    }, [resetLabSpecificMaintenanceDialogFiltersOnly]);
    
    const activeLabSpecificMaintenanceFilterCount = useMemo(() => [
      activeLabSpecificMaintenanceSearchTerm !== '', 
      activeLabSpecificMaintenanceStatusFilter !== 'all', 
      activeLabSpecificMaintenanceResourceIdFilter !== 'all', 
      activeLabSpecificMaintenanceTechnicianIdFilter !== 'all'
    ].filter(Boolean).length, [
      activeLabSpecificMaintenanceSearchTerm, activeLabSpecificMaintenanceStatusFilter, 
      activeLabSpecificMaintenanceResourceIdFilter, activeLabSpecificMaintenanceTechnicianIdFilter
    ]);

    const resourcesForLabSpecificMaintenanceFilter = useMemo(() => {
        if (activeContextId === GLOBAL_CONTEXT_VALUE) return [];
        return allResourcesForCountsAndChecks.filter(r => r.labId === activeContextId);
    }, [allResourcesForCountsAndChecks, activeContextId]);


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

        const resolvedTechnicianId = data.assignedTechnicianId === '--unassigned--' || !data.assignedTechnicianId ? undefined : data.assignedTechnicianId;

        setIsLoadingData(true);
        try {
            if (editingMaintenanceRequest) {
                const result = await updateMaintenanceRequest_SA({
                    callerUserId: currentUser.id,
                    requestId: editingMaintenanceRequest.id,
                    status: data.status,
                    assignedTechnicianId: resolvedTechnicianId,
                    resolutionNotes: data.resolutionNotes || undefined,
                });
                if (!result.success) { toast({ title: "Update Failed", description: result.message || "Could not update maintenance request.", variant: "destructive" }); return; }
                toast({ title: 'Request Updated'});
            } else {
                const result = await createMaintenanceRequest_SA({
                    callerUserId: currentUser.id,
                    resourceId: data.resourceId,
                    issueDescription: data.issueDescription,
                    assignedTechnicianId: resolvedTechnicianId,
                });
                if (!result.success) { toast({ title: "Logging Failed", description: result.message || "Could not log maintenance request.", variant: "destructive" }); return; }
                toast({ title: 'Request Logged'});
            }
            setIsMaintenanceFormDialogOpen(false);
            setEditingMaintenanceRequest(null);
            fetchRemainingData();
        } catch (error: any) { toast({ title: `${editingMaintenanceRequest ? "Update" : "Logging"} Failed`, description: `Failed to ${editingMaintenanceRequest ? "update" : "log"} request: ${error.message}`, variant: "destructive" });
        } finally { setIsLoadingData(false); }
    }, [currentUser, editingMaintenanceRequest, allResourcesForCountsAndChecks, fetchRemainingData, toast]);

    const activeMaintenanceFilterCount = useMemo(() => [activeMaintenanceSearchTerm !== '', activeMaintenanceFilterStatus !== 'all', activeMaintenanceFilterResourceId !== 'all', activeMaintenanceFilterTechnicianId !== 'all'].filter(Boolean).length, [activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId]);
    const canEditAnyMaintenanceRequest = useMemo(() => currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Technician'), [currentUser]);

    const handleMembershipAction = useCallback(async (
        targetUserId: string, targetUserName: string, labId: string, labName: string,
        action: 'grant' | 'revoke' | 'approve_request' | 'reject_request',
        membershipDocIdToUpdate?: string
      ) => {
        if (!currentUser || !currentUser.id || !currentUser.name) {
          toast({ title: "Authentication Error", variant: "destructive" });
          return;
        }
        
        const actionKey = membershipDocIdToUpdate || `${targetUserId}-${labId}-${action}`;
        setIsProcessingLabAccessAction(prev => ({ ...prev, [actionKey]: true }));

        try {
          const result = await manageLabMembership_SA(
            currentUser.id, currentUser.name,
            targetUserId, targetUserName,
            labId, labName,
            action, membershipDocIdToUpdate
          );
          if (result.success) {
            toast({ title: "Success", description: result.message });
            fetchRemainingData(); 
          } else {
            toast({ title: "Action Failed", description: result.message, variant: "destructive" });
          }
        } catch (error: any) {
          toast({ title: "Error", description: `Failed to process request: ${error.message}`, variant: "destructive" });
        } finally {
          setIsProcessingLabAccessAction(prev => ({ ...prev, [actionKey]: false }));
        }
    }, [currentUser, fetchRemainingData, toast]);

    const labSpecificMembershipsDisplay = useMemo(() => {
      if (activeContextId === GLOBAL_CONTEXT_VALUE || isLoadingData) return [];
      
      return userLabMemberships
        .filter(membership => membership.labId === activeContextId)
        .map(membership => {
          const user = allUsersData.find(u => u.id === membership.userId);
          return {
            ...membership,
            userName: user?.name || 'Unknown User',
            userEmail: user?.email || 'N/A',
            userAvatarUrl: user?.avatarUrl,
          } as LabMembershipDisplay;
        })
        .sort((a, b) => {
          if (a.status === 'pending_approval' && b.status !== 'pending_approval') return -1;
          if (a.status !== 'pending_approval' && b.status === 'pending_approval') return 1;
          return a.userName.localeCompare(b.userName);
        });
    }, [activeContextId, userLabMemberships, allUsersData, isLoadingData]);

    const labSpecificResources = useMemo(() => {
        if (!selectedLabDetails) return [];
        return allResourcesForCountsAndChecks.filter(res => res.labId === selectedLabDetails.id);
    }, [selectedLabDetails, allResourcesForCountsAndChecks]);

    const labSpecificBookings = useMemo(() => {
        if (!selectedLabDetails) return [];
        const labResourceIds = labSpecificResources.map(r => r.id);
        return allBookingsState.filter(b => labResourceIds.includes(b.resourceId!));
    }, [selectedLabDetails, labSpecificResources, allBookingsState]);
    
    const labSpecificMaintenanceDataForReport = useMemo(() => {
        if (!selectedLabDetails) return [];
        const labResourceIds = labSpecificResources.map(r => r.id);
        return maintenanceRequests.filter(req => labResourceIds.includes(req.resourceId));
    }, [selectedLabDetails, labSpecificResources, maintenanceRequests]);

    const [currentActiveSystemTab, setCurrentActiveSystemTab] = useState(searchParamsObj.get('tab') || "labs");
    const [currentActiveLabTab, setCurrentActiveLabTab] = useState(searchParamsObj.get('tab') || "lab-details");

    useEffect(() => {
        const tabFromUrl = searchParamsObj.get('tab');
        if (activeContextId === GLOBAL_CONTEXT_VALUE) {
            if (tabFromUrl && ["labs", "global-closures", "maintenance-log", "lab-access-requests"].includes(tabFromUrl)) {
                setCurrentActiveSystemTab(tabFromUrl);
            } else if (tabFromUrl) {
                setCurrentActiveSystemTab("labs");
                const newSearchParams = new URLSearchParams(searchParamsObj.toString());
                newSearchParams.set('tab', "labs");
                router.replace(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
            }
        } else {
             if (tabFromUrl && ["lab-details", "lab-closures", "lab-maintenance", "lab-members"].includes(tabFromUrl)) {
                setCurrentActiveLabTab(tabFromUrl);
            } else if (tabFromUrl) {
                setCurrentActiveLabTab("lab-details");
                const newSearchParams = new URLSearchParams(searchParamsObj.toString());
                newSearchParams.set('tab', "lab-details");
                router.replace(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
            }
        }
    }, [activeContextId, searchParamsObj, router, pathname]);

    const handleSystemTabChange = (newTab: string) => {
        setCurrentActiveSystemTab(newTab);
        const newSearchParams = new URLSearchParams(searchParamsObj.toString());
        newSearchParams.set('tab', newTab);
        router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    };
    
    const handleLabTabChange = (newTab: string) => {
        setCurrentActiveLabTab(newTab);
        const newSearchParams = new URLSearchParams(searchParamsObj.toString());
        newSearchParams.set('tab', newTab);
        router.push(`${pathname}?${newSearchParams.toString()}`, { scroll: false });
    };


    if (!currentUser || !canManageAny) {
      return ( <div className="space-y-6"><PageHeader title="Lab Operations Center" icon={Cog} description="Access Denied." /><Card className="text-center py-10 text-muted-foreground"><CardContent><p>You do not have permission.</p></CardContent></Card></div>);
    }

  return (
    <div className="space-y-6">
        <PageHeader
          title="Lab Operations Center"
          description="Manage all aspects of your lab operations, from system-wide settings to individual lab details."
          icon={Cog}
          actions={pageHeaderActionsContent}
        />
        {(isLoadingData || isAdminDataLoading) && (
          <div className="flex justify-center items-center py-20">
              <Loader2 className="h-12 w-12 animate-spin text-primary"/>
              <p className="ml-4 text-lg text-muted-foreground">Loading Lab Operations Data...</p>
          </div>
        )}

        {!(isLoadingData || isAdminDataLoading) && activeContextId === GLOBAL_CONTEXT_VALUE && (
          <Tabs value={currentActiveSystemTab} onValueChange={handleSystemTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="labs">Manage Labs</TabsTrigger>
              <TabsTrigger value="global-closures">Global Closures</TabsTrigger>
              <TabsTrigger value="maintenance-log">Maintenance Log</TabsTrigger>
              <TabsTrigger value="lab-access-requests">Lab Access Requests</TabsTrigger>
            </TabsList>

            <TabsContent value="labs" className="mt-6">
                <ManageLabsTab
                    labs={filteredLabs}
                    isLoadingData={isLoadingData || isAdminDataLoading}
                    activeLabFilterCount={activeLabFilterCount}
                    isLabFilterDialogOpen={isLabFilterDialogOpen}
                    setIsLabFilterDialogOpen={setIsLabFilterDialogOpen}
                    tempLabSearchTerm={tempLabSearchTerm}
                    setTempLabSearchTerm={setTempLabSearchTerm}
                    tempLabSortBy={tempLabSortBy}
                    setTempLabSortBy={setTempLabSortBy}
                    resetLabDialogFiltersOnly={resetLabDialogFiltersOnly}
                    handleApplyLabDialogFilters={handleApplyLabDialogFilters}
                    resetAllActiveLabPageFilters={resetAllActiveLabPageFilters}
                    canManageAny={canManageAny}
                    handleOpenNewLabDialog={handleOpenNewLabDialog}
                    setActiveContextId={handleContextChange}
                    setLabToDelete={setLabToDelete}
                    labToDelete={labToDelete}
                    handleDeleteLab={handleDeleteLab}
                />
            </TabsContent>
            
            <TabsContent value="global-closures" className="mt-6">
                <GlobalClosuresTab
                    isLoadingData={isLoadingData || isAdminDataLoading}
                    activeGlobalClosuresTab={activeGlobalClosuresTab}
                    setActiveGlobalClosuresTab={setActiveGlobalClosuresTab}
                    isGlobalClosureFilterDialogOpen={isGlobalClosureFilterDialogOpen}
                    setIsGlobalClosureFilterDialogOpen={setIsGlobalClosureFilterDialogOpen}
                    activeGlobalClosureFilterCount={activeGlobalClosureFilterCount}
                    tempGlobalClosureSearchTerm={tempGlobalClosureSearchTerm}
                    setTempGlobalClosureSearchTerm={setTempGlobalClosureSearchTerm}
                    resetGlobalClosureDialogFiltersOnly={resetGlobalClosureDialogFiltersOnly}
                    handleApplyGlobalClosureDialogFilters={handleApplyGlobalClosureDialogFilters}
                    resetAllActiveGlobalClosurePageFilters={resetAllActiveGlobalClosurePageFilters}
                    filteredGlobalBlackoutDates={filteredGlobalBlackoutDates}
                    activeGlobalClosureSearchTerm={activeGlobalClosureSearchTerm}
                    handleOpenNewGlobalDateDialog={handleOpenNewGlobalDateDialog}
                    handleOpenEditGlobalDateDialog={handleOpenEditGlobalDateDialog}
                    globalDateToDelete={globalDateToDelete}
                    setGlobalDateToDelete={setGlobalDateToDelete}
                    handleDeleteGlobalBlackoutDate={handleDeleteGlobalBlackoutDate}
                    filteredGlobalRecurringRules={filteredGlobalRecurringRules}
                    handleOpenNewGlobalRecurringDialog={handleOpenNewGlobalRecurringDialog}
                    handleOpenEditGlobalRecurringDialog={handleOpenEditGlobalRecurringDialog}
                    globalRuleToDelete={globalRuleToDelete}
                    setGlobalRuleToDelete={setGlobalRuleToDelete}
                    handleDeleteGlobalRecurringRule={handleDeleteGlobalRecurringRule}
                />
            </TabsContent>
            
            <TabsContent value="maintenance-log" className="mt-6">
                <SystemMaintenanceLogTab
                    isLoadingData={isLoadingData || isAdminDataLoading}
                    filteredMaintenanceRequests={filteredMaintenanceRequests}
                    activeMaintenanceFilterCount={activeMaintenanceFilterCount}
                    isMaintenanceFilterDialogOpen={isMaintenanceFilterDialogOpen}
                    setIsMaintenanceFilterDialogOpen={setIsMaintenanceFilterDialogOpen}
                    tempMaintenanceSearchTerm={tempMaintenanceSearchTerm}
                    setTempMaintenanceSearchTerm={setTempMaintenanceSearchTerm}
                    tempMaintenanceFilterStatus={tempMaintenanceFilterStatus}
                    setTempMaintenanceFilterStatus={setTempMaintenanceFilterStatus}
                    tempMaintenanceFilterResourceId={tempMaintenanceFilterResourceId}
                    setTempMaintenanceFilterResourceId={setTempMaintenanceFilterResourceId}
                    tempMaintenanceFilterTechnicianId={tempMaintenanceFilterTechnicianId}
                    setTempMaintenanceFilterTechnicianId={setTempMaintenanceFilterTechnicianId}
                    allResourcesForCountsAndChecks={allResourcesForCountsAndChecks}
                    allTechniciansForMaintenance={allTechniciansForMaintenance}
                    resetMaintenanceDialogFiltersOnly={resetMaintenanceDialogFiltersOnly}
                    handleApplyMaintenanceDialogFilters={handleApplyMaintenanceDialogFilters}
                    resetAllActiveMaintenancePageFilters={resetAllActiveMaintenancePageFilters}
                    canManageAny={canManageAny}
                    handleOpenNewMaintenanceDialog={handleOpenNewMaintenanceDialog}
                    canEditAnyMaintenanceRequest={canEditAnyMaintenanceRequest}
                    handleOpenEditMaintenanceDialog={handleOpenEditMaintenanceDialog}
                />
            </TabsContent>

            <TabsContent value="lab-access-requests" className="mt-6">
                <LabAccessRequestsTab
                    isLabAccessRequestLoading={isLabAccessRequestLoading}
                    allLabAccessRequests={allLabAccessRequests}
                    handleMembershipAction={handleMembershipAction}
                    isProcessingLabAccessAction={isProcessingLabAccessAction}
                />
            </TabsContent>
          </Tabs>
        )}

        {!(isLoadingData || isAdminDataLoading) && activeContextId !== GLOBAL_CONTEXT_VALUE && selectedLabDetails && (
           <Tabs value={currentActiveLabTab} onValueChange={handleLabTabChange} className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                  <TabsTrigger value="lab-details">Lab Overview</TabsTrigger>
                  <TabsTrigger value="lab-closures">Closures</TabsTrigger>
                  <TabsTrigger value="lab-maintenance">Maintenance</TabsTrigger>
                  <TabsTrigger value="lab-members">Members</TabsTrigger>
              </TabsList>

              <TabsContent value="lab-details" className="mt-6">
                  <LabSpecificOverviewTab
                    selectedLabDetails={selectedLabDetails}
                    labSpecificStats={labSpecificStats}
                    handleOpenEditSelectedLabDialog={handleOpenEditSelectedLabDialog}
                    labSpecificBookings={labSpecificBookings}
                    labSpecificMaintenanceRequests={labSpecificMaintenanceDataForReport}
                    labSpecificResources={labSpecificResources}
                    allUsersData={allUsersData}
                    isLoadingData={isLoadingData}
                  />
              </TabsContent>
              <TabsContent value="lab-closures" className="mt-6">
                  <LabSpecificClosuresTab
                    selectedLabDetails={selectedLabDetails}
                    isLoadingData={isLoadingData}
                    activeLabClosuresTab={activeLabClosuresTab}
                    setActiveLabClosuresTab={setActiveLabClosuresTab}
                    isLabSpecificClosureFilterDialogOpen={isLabSpecificClosureFilterDialogOpen}
                    setIsLabSpecificClosureFilterDialogOpen={setIsLabSpecificClosureFilterDialogOpen}
                    activeLabSpecificClosureFilterCount={activeLabSpecificClosureFilterCount}
                    tempLabSpecificClosureSearchTerm={tempLabSpecificClosureSearchTerm}
                    setTempLabSpecificClosureSearchTerm={setTempLabSpecificClosureSearchTerm}
                    resetLabSpecificClosureDialogFiltersOnly={resetLabSpecificClosureDialogFiltersOnly}
                    handleApplyLabSpecificClosureDialogFilters={handleApplyLabSpecificClosureDialogFilters}
                    resetAllActiveLabSpecificClosurePageFilters={resetAllActiveLabSpecificClosurePageFilters}
                    filteredLabSpecificBlackoutDates={filteredLabSpecificBlackoutDates}
                    activeLabSpecificClosureSearchTerm={activeLabSpecificClosureSearchTerm}
                    handleOpenNewLabSpecificDateDialog={handleOpenNewLabSpecificDateDialog}
                    handleOpenEditLabSpecificDateDialog={handleOpenEditLabSpecificDateDialog}
                    labSpecificDateToDelete={labSpecificDateToDelete}
                    setLabSpecificDateToDelete={setLabSpecificDateToDelete}
                    handleDeleteLabSpecificBlackoutDate={handleDeleteLabSpecificBlackoutDate}
                    filteredLabSpecificRecurringRules={filteredLabSpecificRecurringRules}
                    handleOpenNewLabSpecificRecurringDialog={handleOpenNewLabSpecificRecurringDialog}
                    handleOpenEditLabSpecificRecurringDialog={handleOpenEditLabSpecificRecurringDialog}
                    labSpecificRuleToDelete={labSpecificRuleToDelete}
                    setLabSpecificRuleToDelete={setLabSpecificRuleToDelete}
                    handleDeleteLabSpecificRecurringRule={handleDeleteLabSpecificRecurringRule}
                  />
              </TabsContent>
              <TabsContent value="lab-maintenance" className="mt-6">
                  <LabSpecificMaintenanceTab
                    selectedLabDetails={selectedLabDetails}
                    isLoadingData={isLoadingData}
                    labSpecificFilteredMaintenanceRequests={labSpecificFilteredMaintenanceRequests}
                    activeLabSpecificMaintenanceFilterCount={activeLabSpecificMaintenanceFilterCount}
                    isLabSpecificMaintenanceFilterDialogOpen={isLabSpecificMaintenanceFilterDialogOpen}
                    setIsLabSpecificMaintenanceFilterDialogOpen={setIsLabSpecificMaintenanceFilterDialogOpen}
                    tempLabSpecificMaintenanceSearchTerm={tempLabSpecificMaintenanceSearchTerm}
                    setTempLabSpecificMaintenanceSearchTerm={setTempLabSpecificMaintenanceSearchTerm}
                    tempLabSpecificMaintenanceStatusFilter={tempLabSpecificMaintenanceStatusFilter}
                    setTempLabSpecificMaintenanceStatusFilter={setTempLabSpecificMaintenanceStatusFilter}
                    tempLabSpecificMaintenanceResourceIdFilter={tempLabSpecificMaintenanceResourceIdFilter}
                    setTempLabSpecificMaintenanceResourceIdFilter={setTempLabSpecificMaintenanceResourceIdFilter}
                    tempLabSpecificMaintenanceTechnicianIdFilter={tempLabSpecificMaintenanceTechnicianIdFilter}
                    setTempLabSpecificMaintenanceTechnicianIdFilter={setTempLabSpecificMaintenanceTechnicianIdFilter}
                    resourcesForLabSpecificMaintenanceFilter={resourcesForLabSpecificMaintenanceFilter}
                    allTechniciansForMaintenance={allTechniciansForMaintenance}
                    resetLabSpecificMaintenanceDialogFiltersOnly={resetLabSpecificMaintenanceDialogFiltersOnly}
                    handleApplyLabSpecificMaintenanceDialogFilters={handleApplyLabSpecificMaintenanceDialogFilters}
                    resetAllActiveLabSpecificMaintenancePageFilters={resetAllActiveLabSpecificMaintenancePageFilters}
                    canManageAny={canManageAny}
                    handleOpenNewMaintenanceDialog={handleOpenNewMaintenanceDialog}
                    canEditAnyMaintenanceRequest={canEditAnyMaintenanceRequest}
                    handleOpenEditMaintenanceDialog={handleOpenEditMaintenanceDialog}
                  />
              </TabsContent>
              <TabsContent value="lab-members" className="mt-6">
                  <LabSpecificMembersTab
                    selectedLabDetails={selectedLabDetails}
                    isLoadingData={isLoadingData}
                    labSpecificMembershipsDisplay={labSpecificMembershipsDisplay}
                    canManageAny={canManageAny}
                    setIsLabSpecificMemberAddDialogOpen={setIsLabSpecificMemberAddDialogOpen}
                    handleMembershipAction={handleMembershipAction}
                    isProcessingLabAccessAction={isProcessingLabAccessAction}
                  />
              </TabsContent>
          </Tabs>
        )}

        {isLabFormDialogOpen && currentUser && (<LabFormDialog open={isLabFormDialogOpen} onOpenChange={(isOpen) => { setIsLabFormDialogOpen(isOpen); if (!isOpen) setEditingLab(null); }} initialLab={editingLab} onSave={handleSaveLab} />)}
        
        {isGlobalDateFormDialogOpen && currentUser && (<BlackoutDateFormDialog open={isGlobalDateFormDialogOpen} onOpenChange={setIsGlobalDateFormDialogOpen} initialBlackoutDate={editingGlobalBlackoutDate} onSave={handleSaveGlobalBlackoutDate} labs={labs} currentLabContextId={GLOBAL_CONTEXT_VALUE} />)}
        {isGlobalRecurringFormDialogOpen && currentUser && (<RecurringBlackoutRuleFormDialog open={isGlobalRecurringFormDialogOpen} onOpenChange={setIsGlobalRecurringFormDialogOpen} initialRule={editingGlobalRecurringRule} onSave={handleSaveGlobalRecurringRule} labs={labs} currentLabContextId={GLOBAL_CONTEXT_VALUE} />)}

        {isLabSpecificDateFormDialogOpen && currentUser && activeContextId !== GLOBAL_CONTEXT_VALUE && (<BlackoutDateFormDialog open={isLabSpecificDateFormDialogOpen} onOpenChange={setIsLabSpecificDateFormDialogOpen} initialBlackoutDate={editingLabSpecificBlackoutDate} onSave={handleSaveLabSpecificBlackoutDate} labs={labs} currentLabContextId={activeContextId} />)}
        {isLabSpecificRecurringFormDialogOpen && currentUser && activeContextId !== GLOBAL_CONTEXT_VALUE && (<RecurringBlackoutRuleFormDialog open={isLabSpecificRecurringFormDialogOpen} onOpenChange={setIsLabSpecificRecurringFormDialogOpen} initialRule={editingLabSpecificRecurringRule} onSave={handleSaveLabSpecificRecurringRule} labs={labs} currentLabContextId={activeContextId} />)}
        
        {isMaintenanceFormDialogOpen && currentUser && (
          <MaintenanceRequestFormDialog
            open={isMaintenanceFormDialogOpen}
            onOpenChange={(isOpen) => {
                setIsMaintenanceFormDialogOpen(isOpen);
                if (!isOpen) setEditingMaintenanceRequest(null);
            }}
            initialRequest={editingMaintenanceRequest}
            onSave={handleSaveMaintenanceRequest}
            currentUserRole={currentUser?.role}
            labContextId={activeContextId === GLOBAL_CONTEXT_VALUE ? undefined : activeContextId} 
          />
        )}
        {currentUser && selectedLabDetails && isLabSpecificMemberAddDialogOpen && (
          <ManageUserLabAccessDialog
            targetUser={null} 
            allLabs={labs}
            open={isLabSpecificMemberAddDialogOpen}
            onOpenChange={setIsLabSpecificMemberAddDialogOpen}
            onMembershipUpdate={fetchRemainingData}
            preselectedLabId={activeContextId} 
          />
        )}
      </div>
  );
}

    
    