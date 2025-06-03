
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Cog, ListChecks, PackagePlus, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon, Loader2, X, CheckCircle2, Building, PlusCircle, CalendarOff, Repeat, Wrench, ListFilter, PenToolIcon, AlertCircle, CheckCircle as LucideCheckCircle, Globe, Users, ThumbsUp, ThumbsDown, Settings, SlidersHorizontal, ArrowRightCircle, Settings2, ShieldCheck, ShieldOff } from 'lucide-react';
import type { ResourceType, Resource, Lab, BlackoutDate, RecurringBlackoutRule, MaintenanceRequest, MaintenanceRequestStatus, User, LabMembership, LabMembershipStatus } from '@/types';
import { useAuth } from '@/components/auth-context';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog as FilterSortDialog, DialogContent as FilterSortDialogContent, DialogHeader as FilterSortDialogHeader, DialogTitle as FilterSortDialogTitle, DialogFooter as FilterSortDialogFooter } from '@/components/ui/dialog';
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
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs"; // Removed TabsTrigger as it's not directly used at top level now
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp, writeBatch, where } from 'firebase/firestore';
import { addAuditLog, addNotification, manageLabMembership_SA } from '@/lib/firestore-helpers';
import { daysOfWeekArray, maintenanceRequestStatuses } from '@/lib/app-constants';
import { format, parseISO, isValid as isValidDateFn } from 'date-fns';
import { cn, formatDateSafe } from '@/lib/utils';

type ResourceTypeSortableColumn = 'name' | 'resourceCount' | 'description';
const resourceTypeSortOptions: { value: string; label: string }[] = [ { value: 'name-asc', label: 'Name (A-Z)' }, { value: 'name-desc', label: 'Name (Z-A)' }, { value: 'resourceCount-asc', label: 'Resources (Low-High)' }, { value: 'resourceCount-desc', label: 'Resources (High-Low)' }, { value: 'description-asc', label: 'Description (A-Z)' }, { value: 'description-desc', label: 'Description (Z-A)' }];
type LabSortableColumn = 'name' | 'location' | 'resourceCount' | 'memberCount';
const labSortOptions: { value: string; label: string }[] = [ { value: 'name-asc', label: 'Name (A-Z)' }, { value: 'name-desc', label: 'Name (Z-A)' }, { value: 'location-asc', label: 'Location (A-Z)' }, { value: 'location-desc', label: 'Location (Z-A)' }, { value: 'resourceCount-asc', label: 'Resources (Low-High)' }, { value: 'resourceCount-desc', label: 'Resources (High-Low)' }, { value: 'memberCount-asc', label: 'Members (Low-High)' }, { value: 'memberCount-desc', label: 'Members (High-Low)' }];


const getMaintenanceStatusBadge = (status: MaintenanceRequestStatus) => {
  switch (status) {
    case 'Open': return <Badge variant="destructive" className="bg-red-500 text-white border-transparent"><AlertCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'In Progress': return <Badge variant="secondary" className="bg-yellow-500 text-yellow-950 border-transparent"><PenToolIcon className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Resolved': return <Badge className="bg-blue-500 text-white border-transparent"><LucideCheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Closed': return <Badge className="bg-green-500 text-white border-transparent"><LucideCheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};
interface LabMembershipRequest extends LabMembership { userName?: string; userEmail?: string; userAvatarUrl?: string; labName?: string; }
const GLOBAL_CONTEXT_VALUE = "__GLOBAL_OVERVIEW__";

export default function LabOperationsCenterPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeContextId, setActiveContextId] = useState<string>(GLOBAL_CONTEXT_VALUE);

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

  const [labs, setLabs] = useState<Lab[]>([]);
  const [labToDelete, setLabToDelete] = useState<Lab | null>(null);
  const [isLabFormDialogOpen, setIsLabFormDialogOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<Lab | null>(null);
  const [isLabFilterDialogOpen, setIsLabFilterDialogOpen] = useState(false);
  const [tempLabSearchTerm, setTempLabSearchTerm] = useState('');
  const [activeLabSearchTerm, setActiveLabSearchTerm] = useState('');
  const [tempLabSortBy, setTempLabSortBy] = useState<string>('name-asc');
  const [activeLabSortBy, setActiveLabSortBy] = useState<string>('name-asc');

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
  
  const [isLabAccessRequestLoading, setIsLabAccessRequestLoading] = useState(true); // Re-added
  const [allLabAccessRequests, setAllLabAccessRequests] = useState<LabMembershipRequest[]>([]); // For global view
  const [userLabMemberships, setUserLabMemberships] = useState<LabMembership[]>([]);
  const [isProcessingLabAccessRequest, setIsProcessingLabAccessRequest] = useState<Record<string, {action: 'approve_request' | 'reject_request' | 'grant' | 'revoke', loading: boolean}>>({});
  const [selectedUserForManualAdd, setSelectedUserForManualAdd] = useState<User | null>(null);
  const [isManualAddMemberDialogOpen, setIsManualAddMemberDialogOpen] = useState(false);
  const [isSystemWideAccessRequestsFilterOpen, setIsSystemWideAccessRequestsFilterOpen] = useState(false);
  const [tempSystemWideAccessRequestsFilterLabId, setTempSystemWideAccessRequestsFilterLabId] = useState('all');
  const [activeSystemWideAccessRequestsFilterLabId, setActiveSystemWideAccessRequestsFilterLabId] = useState('all');
  const [tempSystemWideAccessRequestsFilterUser, setTempSystemWideAccessRequestsFilterUser] = useState('');
  const [activeSystemWideAccessRequestsFilterUser, setActiveSystemWideAccessRequestsFilterUser] = useState('');


  const canManageAny = useMemo(() => currentUser && currentUser.role === 'Admin', [currentUser]);

  const fetchAllAdminData = useCallback(async () => {
    if (!canManageAny) { /* handle no permissions */ setIsLoadingData(false); return; }
    setIsLoadingData(true); setIsLoadingLabAccessRequestLoading(true);
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
      setMaintenanceRequests(maintenanceSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data(), dateReported: (docSnap.data().dateReported as Timestamp)?.toDate() || new Date(), dateResolved: (docSnap.data().dateResolved as Timestamp)?.toDate() } as MaintenanceRequest)));
      setBlackoutDates(boSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as BlackoutDate)));
      setRecurringRules(rrSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as RecurringBlackoutRule)));
      
      const allFetchedMemberships = membershipsSnapshot.docs.map(mDoc => ({ id: mDoc.id, ...mDoc.data() } as LabMembership));
      setUserLabMemberships(allFetchedMemberships); 

      const pendingRequestsPromises = allFetchedMemberships.filter(m => m.status === 'pending_approval').map(async (membershipData) => {
          const user = fetchedUsersAll.find(u => u.id === membershipData.userId);
          const lab = fetchedLabs.find(l => l.id === membershipData.labId);
          return { ...membershipData, id: membershipData.id, userName: user?.name || 'Unknown User', userEmail: user?.email || 'N/A', userAvatarUrl: user?.avatarUrl, labName: lab?.name || 'Unknown Lab', requestedAt: (membershipData.requestedAt as Timestamp)?.toDate()} as LabMembershipRequest;
      });
      setAllLabAccessRequests(await Promise.all(pendingRequestsPromises));

    } catch (error: any) {
      console.error("Error fetching admin data:", error);
      toast({ title: "Error", description: `Failed to load data: ${error.message}`, variant: "destructive" });
      setIsLabAccessRequestLoading(false);
    }
    setIsLoadingData(false); setIsLoadingLabAccessRequestLoading(false);
  }, [toast, canManageAny]);

  useEffect(() => { fetchAllAdminData(); }, [fetchAllAdminData]);

  const handleMembershipAction = async (
    targetUserId: string, targetUserName: string, labId: string, labName: string,
    action: 'grant' | 'revoke' | 'approve_request' | 'reject_request', membershipDocIdToUpdate?: string
  ) => {
    if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Authentication Error", variant: "destructive" }); return; }
    const uniqueActionId = membershipDocIdToUpdate || `${labId}-${targetUserId}`;
    setIsProcessingLabAccessRequest(prev => ({...prev, [uniqueActionId]: {action, loading: true}}));
    try {
      const result = await manageLabMembership_SA( currentUser.id, currentUser.name, targetUserId, targetUserName, labId, labName, action, membershipDocIdToUpdate );
      if (result.success) { toast({ title: "Success", description: result.message }); fetchAllAdminData(); } 
      else { toast({ title: "Action Failed", description: result.message, variant: "destructive" }); }
    } catch (error: any) { toast({ title: "Error", description: `Failed to process request: ${error.message}`, variant: "destructive" }); }
    finally { setIsProcessingLabAccessRequest(prev => ({...prev, [uniqueActionId]: {action, loading: false}})); }
  };

  // Resource Types Logic
  useEffect(() => { if (isResourceTypeFilterDialogOpen) { setTempResourceTypeSearchTerm(activeResourceTypeSearchTerm); setTempResourceTypeSortBy(activeResourceTypeSortBy);}}, [isResourceTypeFilterDialogOpen, activeResourceTypeSearchTerm, activeResourceTypeSortBy]);
  const filteredResourceTypesWithCount = useMemo(() => {
    let currentTypes = [...resourceTypes]; const lowerSearchTerm = activeResourceTypeSearchTerm.toLowerCase(); if (activeResourceTypeSearchTerm) { currentTypes = currentTypes.filter(type => type.name.toLowerCase().includes(lowerSearchTerm) || (type.description && type.description.toLowerCase().includes(lowerSearchTerm)));} const [column, direction] = activeResourceTypeSortBy.split('-') as [ResourceTypeSortableColumn, 'asc' | 'desc']; let typesWithCount = currentTypes.map(type => ({ ...type, resourceCount: allResourcesForCountsAndChecks.filter(res => res.resourceTypeId === type.id).length, })); typesWithCount.sort((a, b) => { let comparison = 0; const valA = a[column]; const valB = b[column]; if (column === 'resourceCount') comparison = (valA as number) - (valB as number); else if (column === 'name') comparison = (valA as string).toLowerCase().localeCompare((valB as string).toLowerCase()); else if (column === 'description') comparison = (a.description || '').toLowerCase().localeCompare((b.description || '').toLowerCase()); return direction === 'asc' ? comparison : -comparison; }); return typesWithCount;
  }, [resourceTypes, allResourcesForCountsAndChecks, activeResourceTypeSearchTerm, activeResourceTypeSortBy]);
  const handleApplyResourceTypeDialogFilters = useCallback(() => { setActiveResourceTypeSearchTerm(tempResourceTypeSearchTerm); setActiveResourceTypeSortBy(tempResourceTypeSortBy); setIsResourceTypeFilterDialogOpen(false);}, [tempResourceTypeSearchTerm, tempResourceTypeSortBy]);
  const resetResourceTypeDialogFiltersOnly = useCallback(() => { setTempResourceTypeSearchTerm(''); setTempResourceTypeSortBy('name-asc'); }, []);
  const resetAllActiveResourceTypePageFilters = useCallback(() => { setActiveResourceTypeSearchTerm(''); setActiveResourceTypeSortBy('name-asc'); resetResourceTypeDialogFiltersOnly(); setIsResourceTypeFilterDialogOpen(false);}, [resetResourceTypeDialogFiltersOnly]);
  const handleOpenNewResourceTypeDialog = () => { setEditingType(null); setIsResourceTypeFormDialogOpen(true); };
  const handleOpenEditResourceTypeDialog = (type: ResourceType) => { setEditingType(type); setIsResourceTypeFormDialogOpen(true); };
  const handleSaveResourceType = async (data: ResourceTypeFormValues) => {
    if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; } setIsLoadingData(true); try { const typeDataToSave = { name: data.name, description: data.description || null }; const auditAction = editingType ? 'RESOURCE_TYPE_UPDATED' : 'RESOURCE_TYPE_CREATED'; let entityId = editingType ? editingType.id : ''; if (editingType) { await updateDoc(doc(db, "resourceTypes", entityId), typeDataToSave); } else { const docRef = await addDoc(collection(db, "resourceTypes"), typeDataToSave); entityId = docRef.id; } addAuditLog(currentUser.id, currentUser.name, auditAction, { entityType: 'ResourceType', entityId, details: `Resource Type '${data.name}' ${editingType ? 'updated' : 'created'}.` }); toast({ title: `Resource Type ${editingType ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingType ? 'updated' : 'created'}.` }); setIsResourceTypeFormDialogOpen(false); setEditingType(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Save Error", description: `Could not save resource type: ${error.message}`, variant: "destructive" }); } finally { setIsLoadingData(false); }
  };
  const handleDeleteResourceType = async (typeId: string) => {
    if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; } const deletedType = resourceTypes.find(rt => rt.id === typeId); if (!deletedType) { toast({ title: "Error", description: "Resource type not found.", variant: "destructive" }); return; } const resourcesOfThisType = allResourcesForCountsAndChecks.filter(res => res.resourceTypeId === typeId).length; if (resourcesOfThisType > 0) { toast({ title: "Deletion Blocked", description: `Cannot delete "${deletedType.name}" as ${resourcesOfThisType} resource(s) are assigned. Reassign them first.`, variant: "destructive", duration: 7000 }); setTypeToDelete(null); return; } setIsLoadingData(true); try { await deleteDoc(doc(db, "resourceTypes", typeId)); addAuditLog(currentUser.id, currentUser.name, 'RESOURCE_TYPE_DELETED', { entityType: 'ResourceType', entityId: typeId, details: `Resource Type '${deletedType.name}' deleted.` }); toast({ title: "Resource Type Deleted", description: `"${deletedType.name}" removed.`, variant: "destructive" }); setTypeToDelete(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Delete Error", description: `Could not delete resource type: ${error.message}`, variant: "destructive" }); } finally { setIsLoadingData(false); }
  };
  const activeResourceTypeFilterCount = useMemo(() => [activeResourceTypeSearchTerm !== '', activeResourceTypeSortBy !== 'name-asc'].filter(Boolean).length, [activeResourceTypeSearchTerm, activeResourceTypeSortBy]);

  // Labs Logic
  useEffect(() => { if (isLabFilterDialogOpen) { setTempLabSearchTerm(activeLabSearchTerm); setTempLabSortBy(activeLabSortBy);}}, [isLabFilterDialogOpen, activeLabSearchTerm, activeLabSortBy]);
  const filteredLabsWithCounts = useMemo(() => {
    let currentLabs = [...labs]; const lowerSearchTerm = activeLabSearchTerm.toLowerCase(); if (activeLabSearchTerm) { currentLabs = currentLabs.filter(lab => lab.name.toLowerCase().includes(lowerSearchTerm) || (lab.location && lab.location.toLowerCase().includes(lowerSearchTerm)) || (lab.description && lab.description.toLowerCase().includes(lowerSearchTerm)));} const [column, direction] = activeLabSortBy.split('-') as [LabSortableColumn, 'asc' | 'desc']; let labsWithData = currentLabs.map(lab => ({ ...lab, resourceCount: allResourcesForCountsAndChecks.filter(r => r.labId === lab.id).length, memberCount: userLabMemberships.filter(m => m.labId === lab.id && m.status === 'active').length })); labsWithData.sort((a, b) => { let comparison = 0; if (column === 'name') comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase()); else if (column === 'location') comparison = (a.location || '').toLowerCase().localeCompare((b.location || '').toLowerCase()); else if (column === 'resourceCount') comparison = a.resourceCount - b.resourceCount; else if (column === 'memberCount') comparison = a.memberCount - b.memberCount; return direction === 'asc' ? comparison : -comparison; }); return labsWithData;
  }, [labs, activeLabSearchTerm, activeLabSortBy, allResourcesForCountsAndChecks, userLabMemberships]);
  const handleApplyLabDialogFilters = useCallback(() => { setActiveLabSearchTerm(tempLabSearchTerm); setActiveLabSortBy(tempLabSortBy); setIsLabFilterDialogOpen(false);}, [tempLabSearchTerm, tempLabSortBy]);
  const resetLabDialogFiltersOnly = useCallback(() => { setTempLabSearchTerm(''); setTempLabSortBy('name-asc'); }, []);
  const resetAllActiveLabPageFilters = useCallback(() => { setActiveLabSearchTerm(''); setActiveLabSortBy('name-asc'); resetLabDialogFiltersOnly(); setIsLabFilterDialogOpen(false);}, [resetLabDialogFiltersOnly]);
  const handleOpenNewLabDialog = () => { setEditingLab(null); setIsLabFormDialogOpen(true); };
  const handleOpenEditLabDialog = (lab: Lab) => { setEditingLab(lab); setIsLabFormDialogOpen(true); };
  const handleSaveLab = async (data: LabFormValues) => {
    if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; } setIsLoadingData(true); try { const labDataToSave: Partial<Omit<Lab, 'id' | 'createdAt' | 'lastUpdatedAt'>> & { lastUpdatedAt?: any, createdAt?: any } = { name: data.name, location: data.location || null, description: data.description || null, }; const auditAction = editingLab ? 'LAB_UPDATED' : 'LAB_CREATED'; let entityId = editingLab ? editingLab.id : ''; if (editingLab) { labDataToSave.lastUpdatedAt = serverTimestamp(); await updateDoc(doc(db, "labs", entityId), labDataToSave as any); } else { labDataToSave.createdAt = serverTimestamp(); const docRef = await addDoc(collection(db, "labs"), labDataToSave as any); entityId = docRef.id; } addAuditLog(currentUser.id, currentUser.name, auditAction, { entityType: 'Lab', entityId, details: `Lab '${data.name}' ${editingLab ? 'updated' : 'created'}.` }); toast({ title: `Lab ${editingLab ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingLab ? 'updated' : 'created'}.` }); setIsLabFormDialogOpen(false); setEditingLab(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Save Error", description: `Could not save lab: ${error.message}`, variant: "destructive" }); } finally { setIsLoadingData(false); }
  };
  const handleDeleteLab = async (labId: string) => {
    if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; } const deletedLab = labs.find(lab => lab.id === labId); if (!deletedLab) { toast({ title: "Error", description: "Lab not found.", variant: "destructive" }); return; } const resourcesInThisLab = allResourcesForCountsAndChecks.filter(res => res.labId === labId).length; if (resourcesInThisLab > 0) { toast({ title: "Deletion Blocked", description: `Cannot delete lab "${deletedLab.name}" as ${resourcesInThisLab} resource(s) are assigned. Reassign them first.`, variant: "destructive", duration: 7000 }); setLabToDelete(null); return; } const activeMemberships = userLabMemberships.filter(m => m.labId === labId && m.status === 'active').length; if (activeMemberships > 0) { toast({ title: "Deletion Blocked", description: `Cannot delete lab "${deletedLab.name}" as it has ${activeMemberships} active member(s). Revoke their access first.`, variant: "destructive", duration: 7000 }); setLabToDelete(null); return; } setIsLoadingData(true); try { await deleteDoc(doc(db, "labs", labId)); addAuditLog(currentUser.id, currentUser.name, 'LAB_DELETED', { entityType: 'Lab', entityId: labId, details: `Lab '${deletedLab.name}' deleted.` }); toast({ title: "Lab Deleted", description: `Lab "${deletedLab.name}" removed.`, variant: "destructive" }); setLabToDelete(null); await fetchAllAdminData(); if(activeContextId === labId) setActiveContextId(GLOBAL_CONTEXT_VALUE); } catch (error: any) { toast({ title: "Delete Error", description: `Could not delete lab: ${error.message}`, variant: "destructive" }); } finally { setIsLoadingData(false); }
  };
  const activeLabFilterCount = useMemo(() => [activeLabSearchTerm !== '', activeLabSortBy !== 'name-asc'].filter(Boolean).length, [activeLabSearchTerm, activeLabSortBy]);

  // Closures Logic (Contextual)
  useEffect(() => { if (isClosureFilterDialogOpen) { setTempClosureSearchTerm(activeClosureSearchTerm); }}, [isClosureFilterDialogOpen, activeClosureSearchTerm]);
  const filteredBlackoutDates = useMemo(() => {
    return blackoutDates.filter(bd => {
        const labMatch = activeContextId === GLOBAL_CONTEXT_VALUE ? !bd.labId : bd.labId === activeContextId;
        const lowerSearchTerm = activeClosureSearchTerm.toLowerCase();
        const reasonMatch = bd.reason && bd.reason.toLowerCase().includes(lowerSearchTerm);
        const dateMatch = bd.date && isValidDateFn(parseISO(bd.date)) && format(parseISO(bd.date), 'PPP').toLowerCase().includes(lowerSearchTerm);
        return labMatch && (!activeClosureSearchTerm || reasonMatch || dateMatch);
    });
  }, [blackoutDates, activeContextId, activeClosureSearchTerm]);
  const filteredRecurringRules = useMemo(() => {
    return recurringRules.filter(rule => {
        const labMatch = activeContextId === GLOBAL_CONTEXT_VALUE ? !rule.labId : rule.labId === activeContextId;
        const lowerSearchTerm = activeClosureSearchTerm.toLowerCase();
        const nameMatch = rule.name && rule.name.toLowerCase().includes(lowerSearchTerm);
        const reasonMatch = rule.reason && rule.reason.toLowerCase().includes(lowerSearchTerm);
        return labMatch && (!activeClosureSearchTerm || nameMatch || reasonMatch);
    });
  }, [recurringRules, activeContextId, activeClosureSearchTerm]);
  const handleOpenNewDateDialog = useCallback(() => { setEditingBlackoutDate(null); setIsDateFormDialogOpen(true); }, []);
  const handleOpenEditDateDialog = useCallback((bd: BlackoutDate) => { setEditingBlackoutDate(bd); setIsDateFormDialogOpen(true); }, []);
  const handleSaveBlackoutDate = useCallback(async (data: BlackoutDateDialogFormValues) => {
    if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; } const formattedDateOnly = format(data.date, 'yyyy-MM-dd'); const displayDate = format(data.date, 'PPP'); const blackoutDataToSave: Omit<BlackoutDate, 'id'> = { labId: data.labId === GLOBAL_CONTEXT_VALUE ? null : data.labId, date: formattedDateOnly, reason: data.reason || undefined, }; setIsLoadingData(true); try { if (editingBlackoutDate) { await updateDoc(doc(db, "blackoutDates", editingBlackoutDate.id), blackoutDataToSave as any); addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_UPDATED', { entityType: 'BlackoutDate', entityId: editingBlackoutDate.id, details: `Blackout Date for ${displayDate} updated. Lab: ${blackoutDataToSave.labId || 'Global'}. Reason: ${data.reason || 'N/A'}`}); toast({ title: 'Blackout Date Updated'}); } else { const docRef = await addDoc(collection(db, "blackoutDates"), blackoutDataToSave); addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_CREATED', { entityType: 'BlackoutDate', entityId: docRef.id, details: `Blackout Date for ${displayDate} created. Lab: ${blackoutDataToSave.labId || 'Global'}. Reason: ${data.reason || 'N/A'}`}); toast({ title: 'Blackout Date Added'}); } setIsDateFormDialogOpen(false); setEditingBlackoutDate(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Save Failed", variant: "destructive"});} finally { setIsLoadingData(false); }
  }, [currentUser, editingBlackoutDate, fetchAllAdminData, toast]);
  const handleDeleteBlackoutDate = useCallback(async (blackoutDateId: string) => {
    if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; } const deletedDateObj = blackoutDates.find(bd => bd.id === blackoutDateId); if (!deletedDateObj) return; setIsLoadingData(true); try { await deleteDoc(doc(db, "blackoutDates", blackoutDateId)); addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_DELETED', { entityType: 'BlackoutDate', entityId: blackoutDateId, details: `Blackout Date for ${format(parseISO(deletedDateObj.date), 'PPP')} (Lab: ${deletedDateObj.labId || 'Global'}, Reason: ${deletedDateObj.reason || 'N/A'}) deleted.`}); toast({ title: "Blackout Date Removed", variant: "destructive" }); setDateToDelete(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Delete Failed", variant: "destructive"});} finally { setIsLoadingData(false); }
  }, [currentUser, blackoutDates, fetchAllAdminData, toast]);
  const handleApplyClosureDialogFilters = useCallback(() => { setActiveClosureSearchTerm(tempClosureSearchTerm); setIsClosureFilterDialogOpen(false); }, [tempClosureSearchTerm]);
  const resetClosureDialogFiltersOnly = useCallback(() => { setTempClosureSearchTerm(''); }, []);
  const resetAllActiveClosurePageFilters = useCallback(() => { setActiveClosureSearchTerm(''); resetClosureDialogFiltersOnly(); setIsClosureFilterDialogOpen(false); }, [resetClosureDialogFiltersOnly]);
  const activeClosureFilterCount = useMemo(() => [activeClosureSearchTerm !== ''].filter(Boolean).length, [activeClosureSearchTerm]);
  const handleOpenNewRecurringDialog = useCallback(() => { setEditingRecurringRule(null); setIsRecurringFormDialogOpen(true); }, []);
  const handleOpenEditRecurringDialog = useCallback((rule: RecurringBlackoutRule) => { setEditingRecurringRule(rule); setIsRecurringFormDialogOpen(true); }, []);
  const handleSaveRecurringRule = useCallback(async (data: RecurringRuleDialogFormValues) => {
    if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; } const ruleDataToSave: Omit<RecurringBlackoutRule, 'id'> = { labId: data.labId === GLOBAL_CONTEXT_VALUE ? null : data.labId, name: data.name, daysOfWeek: data.daysOfWeek, reason: data.reason || undefined, }; setIsLoadingData(true); try { if (editingRecurringRule) { await updateDoc(doc(db, "recurringBlackoutRules", editingRecurringRule.id), ruleDataToSave as any); addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_UPDATED', { entityType: 'RecurringBlackoutRule', entityId: editingRecurringRule.id, details: `Recurring rule '${data.name}' updated. Lab: ${ruleDataToSave.labId || 'Global'}.`}); toast({ title: 'Recurring Rule Updated'}); } else { const docRef = await addDoc(collection(db, "recurringBlackoutRules"), ruleDataToSave); addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_CREATED', { entityType: 'RecurringBlackoutRule', entityId: docRef.id, details: `Recurring rule '${data.name}' created. Lab: ${ruleDataToSave.labId || 'Global'}.`}); toast({ title: 'Recurring Rule Added'}); } setIsRecurringFormDialogOpen(false); setEditingRecurringRule(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Save Failed", variant: "destructive"});} finally { setIsLoadingData(false); }
  }, [currentUser, editingRecurringRule, fetchAllAdminData, toast]);
  const handleDeleteRecurringRule = useCallback(async (ruleId: string) => {
    if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; } const deletedRuleObj = recurringRules.find(r => r.id === ruleId); if (!deletedRuleObj) return; setIsLoadingData(true); try { await deleteDoc(doc(db, "recurringBlackoutRules", ruleId)); addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_DELETED', { entityType: 'RecurringBlackoutRule', entityId: ruleId, details: `Recurring rule '${deletedRuleObj.name}' (Lab: ${deletedRuleObj.labId || 'Global'}) deleted.`}); toast({ title: "Recurring Rule Removed", variant: "destructive" }); setRuleToDelete(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Delete Failed", variant: "destructive"});} finally { setIsLoadingData(false); }
  }, [currentUser, recurringRules, fetchAllAdminData, toast]);

  // Maintenance Logic
  useEffect(() => { if (isMaintenanceFilterDialogOpen) { setTempMaintenanceSearchTerm(activeMaintenanceSearchTerm); setTempMaintenanceFilterStatus(activeMaintenanceFilterStatus); setTempMaintenanceFilterResourceId(activeMaintenanceFilterResourceId); setTempMaintenanceFilterTechnicianId(activeMaintenanceFilterTechnicianId); setTempMaintenanceFilterLabId(activeMaintenanceFilterLabId); }}, [isMaintenanceFilterDialogOpen, activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId, activeMaintenanceFilterLabId]);
  const filteredMaintenanceRequests = useMemo(() => {
    return maintenanceRequests.map(req => {
      const resource = allResourcesForCountsAndChecks.find(r => r.id === req.resourceId);
      const reporter = allUsersData.find(u => u.id === req.reportedByUserId);
      const technician = allTechniciansForMaintenance.find(t => t.id === req.assignedTechnicianId);
      return { ...req, resourceName: resource?.name || 'Unknown Resource', resourceLabId: resource?.labId, reportedByUserName: reporter?.name || 'Unknown User', assignedTechnicianName: technician?.name, };
    }).filter(req => {
      const lowerSearchTerm = activeMaintenanceSearchTerm.toLowerCase();
      const searchMatch = !activeMaintenanceSearchTerm || (req.resourceName && req.resourceName.toLowerCase().includes(lowerSearchTerm)) || (req.reportedByUserName && req.reportedByUserName.toLowerCase().includes(lowerSearchTerm)) || (req.issueDescription && req.issueDescription.toLowerCase().includes(lowerSearchTerm)) || (req.assignedTechnicianName && req.assignedTechnicianName.toLowerCase().includes(lowerSearchTerm));
      const statusMatch = activeMaintenanceFilterStatus === 'all' || req.status === activeMaintenanceFilterStatus;
      const resourceMatch = activeMaintenanceFilterResourceId === 'all' || req.resourceId === activeMaintenanceFilterResourceId;
      const labMatch = activeContextId === GLOBAL_CONTEXT_VALUE ? (activeMaintenanceFilterLabId === 'all' || req.resourceLabId === activeMaintenanceFilterLabId) : req.resourceLabId === activeContextId;
      let technicianMatch = true; if (activeMaintenanceFilterTechnicianId !== 'all') { if (activeMaintenanceFilterTechnicianId === '--unassigned--') { technicianMatch = !req.assignedTechnicianId; } else { technicianMatch = req.assignedTechnicianId === activeMaintenanceFilterTechnicianId; } }
      return searchMatch && statusMatch && resourceMatch && labMatch && technicianMatch;
    });
  }, [maintenanceRequests, allResourcesForCountsAndChecks, allTechniciansForMaintenance, allUsersData, activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId, activeMaintenanceFilterLabId, activeContextId]);
  const handleApplyMaintenanceDialogFilters = useCallback(() => { setActiveMaintenanceSearchTerm(tempMaintenanceSearchTerm.toLowerCase()); setActiveMaintenanceFilterStatus(tempMaintenanceFilterStatus); setActiveMaintenanceFilterResourceId(tempMaintenanceFilterResourceId); setActiveMaintenanceFilterTechnicianId(tempMaintenanceFilterTechnicianId); setActiveMaintenanceFilterLabId(tempMaintenanceFilterLabId); setIsMaintenanceFilterDialogOpen(false); }, [tempMaintenanceSearchTerm, tempMaintenanceFilterStatus, tempMaintenanceFilterResourceId, tempMaintenanceFilterTechnicianId, tempMaintenanceFilterLabId]);
  const resetMaintenanceDialogFiltersOnly = useCallback(() => { setTempMaintenanceSearchTerm(''); setTempMaintenanceFilterStatus('all'); setTempMaintenanceFilterResourceId('all'); setTempMaintenanceFilterTechnicianId('all'); setTempMaintenanceFilterLabId(activeContextId === GLOBAL_CONTEXT_VALUE ? 'all' : activeContextId); }, [activeContextId]);
  const resetAllActiveMaintenancePageFilters = useCallback(() => { setActiveMaintenanceSearchTerm(''); setActiveMaintenanceFilterStatus('all'); setActiveMaintenanceFilterResourceId('all'); setActiveMaintenanceFilterTechnicianId('all'); setActiveMaintenanceFilterLabId(activeContextId === GLOBAL_CONTEXT_VALUE ? 'all' : activeContextId); resetMaintenanceDialogFiltersOnly(); setIsMaintenanceFilterDialogOpen(false); }, [resetMaintenanceDialogFiltersOnly, activeContextId]);
  const handleOpenNewMaintenanceDialog = useCallback(() => { if (!currentUser) return; setEditingMaintenanceRequest(null); setIsMaintenanceFormDialogOpen(true); }, [currentUser]);
  const handleOpenEditMaintenanceDialog = useCallback((request: MaintenanceRequest) => { setEditingMaintenanceRequest(request); setIsMaintenanceFormDialogOpen(true); }, []);
  const handleSaveMaintenanceRequest = useCallback(async (data: MaintenanceDialogFormValues) => {
    if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Error", variant: "destructive"}); return;} const resource = allResourcesForCountsAndChecks.find(r => r.id === data.resourceId); if (!resource) { toast({ title: "Error", variant: "destructive" }); return;} let dateResolvedForFirestore: Timestamp | null = null; if ((data.status === 'Resolved' || data.status === 'Closed') && data.dateResolved && isValidDateFn(new Date(data.dateResolved))) { dateResolvedForFirestore = Timestamp.fromDate(new Date(data.dateResolved)); } else if ((data.status === 'Resolved' || data.status === 'Closed') && !editingMaintenanceRequest?.dateResolved) { dateResolvedForFirestore = serverTimestamp() as Timestamp; } else if (editingMaintenanceRequest?.dateResolved && (data.status === 'Resolved' || data.status === 'Closed')) { dateResolvedForFirestore = Timestamp.fromDate(editingMaintenanceRequest.dateResolved); } const requestDataToSave: any = { resourceId: data.resourceId, issueDescription: data.issueDescription, status: data.status, assignedTechnicianId: data.assignedTechnicianId === '--unassigned--' || !data.assignedTechnicianId ? null : data.assignedTechnicianId, resolutionNotes: data.resolutionNotes || null, dateResolved: dateResolvedForFirestore, }; setIsLoadingData(true); try { if (editingMaintenanceRequest) { await updateDoc(doc(db, "maintenanceRequests", editingMaintenanceRequest.id), requestDataToSave); await addAuditLog(currentUser.id, currentUser.name, 'MAINTENANCE_UPDATED', { entityType: 'MaintenanceRequest', entityId: editingMaintenanceRequest.id, details: `Maintenance request for '${resource.name}' updated. Status: ${data.status}.`}); toast({ title: 'Request Updated'}); if ((data.status === 'Resolved' && editingMaintenanceRequest.status !== 'Resolved') && editingMaintenanceRequest.reportedByUserId !== currentUser.id && editingMaintenanceRequest.reportedByUserId) { await addNotification( editingMaintenanceRequest.reportedByUserId, 'Maintenance Resolved', `Issue for ${resource.name} resolved.`, 'maintenance_resolved', '/maintenance');} if (data.assignedTechnicianId && data.assignedTechnicianId !== editingMaintenanceRequest.assignedTechnicianId && data.assignedTechnicianId !== '--unassigned--') { await addNotification( data.assignedTechnicianId, 'Maintenance Task Assigned', `Task for ${resource.name}: ${data.issueDescription.substring(0,50)}...`, 'maintenance_assigned', '/maintenance');} } else { const newRequestPayload = { ...requestDataToSave, reportedByUserId: currentUser.id, dateReported: serverTimestamp(), }; const docRef = await addDoc(collection(db, "maintenanceRequests"), newRequestPayload); await addAuditLog(currentUser.id, currentUser.name, 'MAINTENANCE_CREATED', { entityType: 'MaintenanceRequest', entityId: docRef.id, details: `New request for '${resource.name}' by ${currentUser.name}.`}); toast({ title: 'Request Logged'}); const techIdForNotification = requestDataToSave.assignedTechnicianId; if(techIdForNotification && techIdForNotification !== '--unassigned--'){ await addNotification( techIdForNotification, 'New Maintenance Request Assigned', `New request for ${resource.name}: ${data.issueDescription.substring(0, 50)}... assigned.`, 'maintenance_assigned', '/maintenance');} else { const usersToNotifyQuery = query(collection(db, 'users'), where('role', 'in', ['Admin', 'Technician']), orderBy('name', 'asc')); const usersToNotifySnapshot = await getDocs(usersToNotifyQuery); const notificationPromises = usersToNotifySnapshot.docs.map(userDoc => { if(userDoc.id !== currentUser?.id) { return addNotification( userDoc.id, 'New Unassigned Maintenance Request', `New request for ${resource.name}: ${data.issueDescription.substring(0, 50)}... needs attention.`, 'maintenance_new', '/maintenance');} return Promise.resolve(); }); await Promise.all(notificationPromises);}} setIsMaintenanceFormDialogOpen(false); setEditingMaintenanceRequest(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: `${editingMaintenanceRequest ? "Update" : "Logging"} Failed`, variant: "destructive" });} finally { setIsLoadingData(false); }
  }, [currentUser, editingMaintenanceRequest, allResourcesForCountsAndChecks, fetchAllAdminData, toast]);
  const activeMaintenanceFilterCount = useMemo(() => [activeMaintenanceSearchTerm !== '', activeMaintenanceFilterStatus !== 'all', activeMaintenanceFilterResourceId !== 'all', activeMaintenanceFilterTechnicianId !== 'all', (activeContextId === GLOBAL_CONTEXT_VALUE && activeMaintenanceFilterLabId !== 'all')].filter(Boolean).length, [activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId, activeMaintenanceFilterLabId, activeContextId]);
  const canEditAnyMaintenanceRequest = useMemo(() => currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Technician'), [currentUser]);

  // Lab Access Requests Logic (Contextual)
  const filteredLabAccessRequests = useMemo(() => {
    return activeContextId === GLOBAL_CONTEXT_VALUE
      ? allLabAccessRequests.filter(req => 
          (activeSystemWideAccessRequestsFilterLabId === 'all' || req.labId === activeSystemWideAccessRequestsFilterLabId) &&
          (activeSystemWideAccessRequestsFilterUser.trim() === '' || 
           (req.userName && req.userName.toLowerCase().includes(activeSystemWideAccessRequestsFilterUser.toLowerCase())) ||
           (req.userEmail && req.userEmail.toLowerCase().includes(activeSystemWideAccessRequestsFilterUser.toLowerCase()))
          )
        )
      : allLabAccessRequests.filter(req => req.labId === activeContextId);
  }, [allLabAccessRequests, activeContextId, activeSystemWideAccessRequestsFilterLabId, activeSystemWideAccessRequestsFilterUser]);

  const handleApplySystemWideAccessRequestsFilter = useCallback(() => {
    setActiveSystemWideAccessRequestsFilterLabId(tempSystemWideAccessRequestsFilterLabId);
    setActiveSystemWideAccessRequestsFilterUser(tempSystemWideAccessRequestsFilterUser);
    setIsSystemWideAccessRequestsFilterOpen(false);
  }, [tempSystemWideAccessRequestsFilterLabId, tempSystemWideAccessRequestsFilterUser]);

  const resetSystemWideAccessRequestsFilterOnly = useCallback(() => {
    setTempSystemWideAccessRequestsFilterLabId('all');
    setTempSystemWideAccessRequestsFilterUser('');
  }, []);
  
  const activeSystemWideAccessRequestsFilterCount = useMemo(() => [
    activeSystemWideAccessRequestsFilterLabId !== 'all',
    activeSystemWideAccessRequestsFilterUser !== ''
  ].filter(Boolean).length, [activeSystemWideAccessRequestsFilterLabId, activeSystemWideAccessRequestsFilterUser]);


  const activeLabMembers = useMemo(() => {
    if (activeContextId === GLOBAL_CONTEXT_VALUE) return [];
    return userLabMemberships.filter(m => m.labId === activeContextId && m.status === 'active')
        .map(m => {
            const user = allUsersData.find(u => u.id === m.userId);
            return { ...m, userName: user?.name || 'Unknown User', userEmail: user?.email || 'N/A', userAvatarUrl: user?.avatarUrl };
        });
  }, [userLabMemberships, allUsersData, activeContextId]);

  const selectedLabDetails = useMemo(() => labs.find(lab => lab.id === activeContextId), [labs, activeContextId]);
  const resourcesInSelectedLab = useMemo(() => allResourcesForCountsAndChecks.filter(r => r.labId === activeContextId), [allResourcesForCountsAndChecks, activeContextId]);
  const maintenanceForSelectedLab = useMemo(() => maintenanceRequests.filter(mr => resourcesInSelectedLab.some(r => r.id === mr.resourceId)), [maintenanceRequests, resourcesInSelectedLab]);


  if (!currentUser || !canManageAny) { return ( <div className="space-y-8"><PageHeader title="Lab Operations Center" icon={Cog} description="Access Denied." /><Card className="text-center py-10 text-muted-foreground"><CardContent><p>You do not have permission.</p></CardContent></Card></div>); }
  const currentManagingLabName = activeContextId === GLOBAL_CONTEXT_VALUE ? "System-Wide Settings" : (labs.find(l => l.id === activeContextId)?.name || "Selected Lab");

  return (
    <TooltipProvider>
    <div className="space-y-6">
      <PageHeader title="Lab Operations Center" description="Manage labs, resource types, closures, maintenance, and lab access." icon={Cog} />
      
      <div className="flex items-center gap-4 p-4 border rounded-md bg-muted/30 shadow-sm">
        <Label htmlFor="labContextSelect" className="text-sm font-medium whitespace-nowrap shrink-0">Currently Managing:</Label>
        <Select value={activeContextId} onValueChange={setActiveContextId}>
          <SelectTrigger id="labContextSelect" className="w-full sm:w-auto min-w-[280px] h-10 text-base">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={GLOBAL_CONTEXT_VALUE} className="text-base py-2"><Globe className="inline-block mr-2 h-5 w-5 text-muted-foreground"/>System-Wide Settings</SelectItem>
            <Separator/>
            {labs.map(lab => (<SelectItem key={lab.id} value={lab.id} className="text-base py-2"><Building className="inline-block mr-2 h-5 w-5 text-muted-foreground"/>{lab.name}</SelectItem>))}
          </SelectContent>
        </Select>
      </div>

      {isLoadingData ? (
        <div className="flex justify-center items-center py-20"><Loader2 className="h-12 w-12 animate-spin text-primary"/></div>
      ) : (
        <>
          {/* SYSTEM-WIDE SETTINGS VIEW */}
          {activeContextId === GLOBAL_CONTEXT_VALUE && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div><CardTitle className="text-xl">All Labs ({filteredLabsWithCounts.length})</CardTitle><CardDescription>View, add, or manage operations for individual labs.</CardDescription></div>
                    <div className="flex gap-2">
                        <FilterSortDialog open={isLabFilterDialogOpen} onOpenChange={setIsLabFilterDialogOpen}><FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter & Sort</Button></FilterSortDialogTrigger><FilterSortDialogContent className="sm:max-w-md"><FilterSortDialogHeader><FilterSortDialogTitle>Filter & Sort Labs</FilterSortDialogTitle></FilterSortDialogHeader><Separator className="my-3" /><div className="space-y-3"><div className="relative"><Label htmlFor="labSearchDialog">Search (Name/Loc/Desc)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="labSearchDialog" value={tempLabSearchTerm} onChange={e => setTempLabSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/></div><div><Label htmlFor="labSortDialog">Sort by</Label><Select value={tempLabSortBy} onValueChange={setTempLabSortBy}><SelectTrigger id="labSortDialog" className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{labSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div></div><FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetLabDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button variant="outline" onClick={() => setIsLabFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button><Button onClick={handleApplyLabDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter></FilterSortDialogContent></FilterSortDialog>
                        <Button onClick={handleOpenNewLabDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Lab</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {filteredLabsWithCounts.length > 0 ? (<div className="overflow-x-auto border-t"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead className="text-center">Resources</TableHead><TableHead className="text-center">Members</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filteredLabsWithCounts.map(lab => (<TableRow key={lab.id}><TableCell className="font-medium">{lab.name}</TableCell><TableCell>{lab.location || 'N/A'}</TableCell><TableCell className="text-center">{lab.resourceCount}</TableCell><TableCell className="text-center">{lab.memberCount}</TableCell><TableCell className="text-right space-x-1"><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditLabDialog(lab)}><Edit /></Button></TooltipTrigger><TooltipContent>Edit Lab Details</TooltipContent></Tooltip><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setActiveContextId(lab.id)}><Settings className="text-primary"/></Button></TooltipTrigger><TooltipContent>Manage Lab Operations</TooltipContent></Tooltip><AlertDialog open={labToDelete?.id === lab.id} onOpenChange={(isOpen) => !isOpen && setLabToDelete(null)}><Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setLabToDelete(lab)}><Trash2 /></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Lab</TooltipContent></Tooltip><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{labToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Ensure no resources or active memberships are assigned.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => labToDelete && handleDeleteLab(labToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody></Table></div>) : (<p className="p-6 text-center text-muted-foreground">No labs defined yet.</p>)}
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div><CardTitle className="text-xl">Resource Types ({filteredResourceTypesWithCount.length})</CardTitle><CardDescription>Define categories for lab resources.</CardDescription></div>
                     <div className="flex gap-2">
                        <FilterSortDialog open={isResourceTypeFilterDialogOpen} onOpenChange={setIsResourceTypeFilterDialogOpen}><FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter & Sort</Button></FilterSortDialogTrigger><FilterSortDialogContent className="sm:max-w-md"><FilterSortDialogHeader><FilterSortDialogTitle>Filter & Sort Resource Types</FilterSortDialogTitle></FilterSortDialogHeader><Separator className="my-3" /><div className="space-y-3"><div className="relative"><Label htmlFor="typeSearchDialog">Search (Name/Desc)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="typeSearchDialog" value={tempResourceTypeSearchTerm} onChange={e => setTempResourceTypeSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/></div><div><Label htmlFor="typeSortDialog">Sort by</Label><Select value={tempResourceTypeSortBy} onValueChange={setTempResourceTypeSortBy}><SelectTrigger id="typeSortDialog" className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{resourceTypeSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div></div><FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetResourceTypeDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button variant="outline" onClick={() => setIsResourceTypeFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button><Button onClick={handleApplyResourceTypeDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter></FilterSortDialogContent></FilterSortDialog>
                        <Button onClick={handleOpenNewResourceTypeDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Type</Button>
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {filteredResourceTypesWithCount.length > 0 ? (<div className="overflow-x-auto border-t"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-center"># Resources</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader><TableBody>{filteredResourceTypesWithCount.map(type => (<TableRow key={type.id}><TableCell className="font-medium">{type.name}</TableCell><TableCell className="text-sm text-muted-foreground max-w-md truncate" title={type.description || undefined}>{type.description || 'N/A'}</TableCell><TableCell className="text-center">{type.resourceCount}</TableCell><TableCell className="text-right space-x-1"><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditResourceTypeDialog(type)}><Edit /></Button></TooltipTrigger><TooltipContent>Edit Type</TooltipContent></Tooltip><AlertDialog open={typeToDelete?.id === type.id} onOpenChange={(isOpen) => !isOpen && setTypeToDelete(null)}><Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setTypeToDelete(type)}><Trash2 /></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Type</TooltipContent></Tooltip><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{typeToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Ensure no resources use this type.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => typeToDelete && handleDeleteResourceType(typeToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody></Table></div>) : (<p className="p-6 text-center text-muted-foreground">No resource types defined.</p>)}
                  </CardContent>
                </Card>
              </div>

              <div className="lg:col-span-1 space-y-6">
                <Card>
                  <CardHeader><CardTitle className="text-xl flex items-center gap-2"><SlidersHorizontal/>System At a Glance</CardTitle></CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="flex justify-between"><span>Total Labs:</span><span className="font-semibold">{labs.length}</span></div>
                    <div className="flex justify-between"><span>Total Resources:</span><span className="font-semibold">{allResourcesForCountsAndChecks.length}</span></div>
                    <div className="flex justify-between"><span>Total Users:</span><span className="font-semibold">{allUsersData.length}</span></div>
                    <div className="flex justify-between"><span>Pending Lab Access:</span><span className="font-semibold">{allLabAccessRequests.length}</span></div>
                    <div className="flex justify-between"><span>Open Maintenance:</span><span className="font-semibold">{maintenanceRequests.filter(mr => mr.status === 'Open' || mr.status === 'In Progress').length}</span></div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div><CardTitle className="text-xl">Global Lab Closures</CardTitle><CardDescription>Closures affecting all labs.</CardDescription></div>
                     <FilterSortDialog open={isClosureFilterDialogOpen} onOpenChange={setIsClosureFilterDialogOpen}><FilterSortDialogTrigger asChild><Button variant="outline" size="xs" className="h-7"><FilterIcon className="mr-1.5 h-3.5 w-3.5" />Filter</Button></FilterSortDialogTrigger><FilterSortDialogContent className="w-full max-w-md"><FilterSortDialogHeader><FilterSortDialogTitle>Filter Global Closures</FilterSortDialogTitle></FilterSortDialogHeader><Separator className="my-3" /><div className="space-y-3"><div className="relative"><Label htmlFor="closureSearchDialogGlobal">Search (Reason/Date/Name)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="closureSearchDialogGlobal" value={tempClosureSearchTerm} onChange={(e) => setTempClosureSearchTerm(e.target.value)} placeholder="e.g., Holiday..." className="mt-1 h-9 pl-8"/></div></div><FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetClosureDialogFiltersOnly} className="mr-auto"><FilterX />Reset</Button><Button variant="outline" onClick={() => setIsClosureFilterDialogOpen(false)}><X />Cancel</Button><Button onClick={handleApplyClosureDialogFilters}><CheckCircle2 />Apply</Button></FilterSortDialogFooter></FilterSortDialogContent></FilterSortDialog>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="specific-dates-global">
                      <TabsList className="grid w-full grid-cols-2 mb-2 h-9"><TabsContent value="specific-dates-global" className="text-xs px-2 py-1.5">Specific Dates</TabsContent><TabsContent value="recurring-rules-global" className="text-xs px-2 py-1.5">Recurring Rules</TabsContent></TabsList>
                      <TabsContent value="specific-dates-global">
                        <Button onClick={handleOpenNewDateDialog} size="sm" className="w-full mb-2"><PlusCircle className="mr-2 h-4 w-4"/>Add Global Blackout Date</Button>
                        {filteredBlackoutDates.length > 0 ? (<div className="max-h-60 overflow-y-auto border rounded-md"><Table><TableHeader><TableRow><TableHead className="text-xs p-2">Date</TableHead><TableHead className="text-xs p-2">Reason</TableHead><TableHead className="text-right p-2"></TableHead></TableRow></TableHeader><TableBody>{filteredBlackoutDates.map(bd => (<TableRow key={bd.id}><TableCell className="text-xs p-2">{formatDateSafe(parseISO(bd.date), 'N/A', 'MMM dd, yyyy')}</TableCell><TableCell className="text-xs p-2 truncate max-w-[100px]" title={bd.reason}>{bd.reason || 'N/A'}</TableCell><TableCell className="text-right p-1 space-x-0.5"><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOpenEditDateDialog(bd)}><Edit className="h-3.5 w-3.5"/></Button><AlertDialog open={dateToDelete?.id === bd.id} onOpenChange={(isOpen) => !isOpen && setDateToDelete(null)}><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDateToDelete(bd)}><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Global Blackout?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => dateToDelete && handleDeleteBlackoutDate(dateToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-center text-xs text-muted-foreground py-3">No global specific dates.</p>}
                      </TabsContent>
                      <TabsContent value="recurring-rules-global">
                        <Button onClick={handleOpenNewRecurringDialog} size="sm" className="w-full mb-2"><PlusCircle className="mr-2 h-4 w-4"/>Add Global Recurring Rule</Button>
                        {filteredRecurringRules.length > 0 ? (<div className="max-h-60 overflow-y-auto border rounded-md"><Table><TableHeader><TableRow><TableHead className="text-xs p-2">Rule</TableHead><TableHead className="text-xs p-2">Days</TableHead><TableHead className="text-right p-2"></TableHead></TableRow></TableHeader><TableBody>{filteredRecurringRules.map(rule => (<TableRow key={rule.id}><TableCell className="text-xs p-2 font-medium truncate max-w-[100px]" title={rule.name}>{rule.name}</TableCell><TableCell className="text-xs p-2 truncate max-w-[100px]" title={rule.daysOfWeek.join(', ')}>{rule.daysOfWeek.join(', ')}</TableCell><TableCell className="text-right p-1 space-x-0.5"><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOpenEditRecurringDialog(rule)}><Edit className="h-3.5 w-3.5"/></Button><AlertDialog open={ruleToDelete?.id === rule.id} onOpenChange={(isOpen) => !isOpen && setRuleToDelete(null)}><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setRuleToDelete(rule)}><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Global Rule?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => ruleToDelete && handleDeleteRecurringRule(ruleToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-center text-xs text-muted-foreground py-3">No global recurring rules.</p>}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div><CardTitle className="text-xl flex items-center gap-2"><Users/>All Pending Lab Access Requests ({filteredLabAccessRequests.length})</CardTitle><CardDescription>Review requests for access to any lab.</CardDescription></div>
                        <FilterSortDialog open={isSystemWideAccessRequestsFilterOpen} onOpenChange={setIsSystemWideAccessRequestsFilterOpen}>
                            <FilterSortDialogTrigger asChild><Button variant="outline" size="xs" className="h-7"><FilterIcon className="mr-1.5 h-3.5 w-3.5" />Filter</Button></FilterSortDialogTrigger>
                            <FilterSortDialogContent className="sm:max-w-md">
                                <FilterSortDialogHeader><FilterSortDialogTitle>Filter System-Wide Access Requests</FilterSortDialogTitle></FilterSortDialogHeader><Separator className="my-3" />
                                <div className="space-y-3">
                                    <div><Label htmlFor="sysWideAccessUserSearch">Search User (Name/Email)</Label><Input id="sysWideAccessUserSearch" value={tempSystemWideAccessRequestsFilterUser} onChange={(e) => setTempSystemWideAccessRequestsFilterUser(e.target.value)} placeholder="User keyword..." className="mt-1 h-9"/></div>
                                    <div><Label htmlFor="sysWideAccessLabFilter">Filter by Lab Requested</Label><Select value={tempSystemWideAccessRequestsFilterLabId} onValueChange={setTempSystemWideAccessRequestsFilterLabId}><SelectTrigger id="sysWideAccessLabFilter" className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Labs</SelectItem>{labs.map(l => <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>)}</SelectContent></Select></div>
                                </div>
                                <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetSystemWideAccessRequestsFilterOnly} className="mr-auto"><FilterX />Reset</Button><Button variant="outline" onClick={() => setIsSystemWideAccessRequestsFilterOpen(false)}><X />Cancel</Button><Button onClick={handleApplySystemWideAccessRequestsFilter}><CheckCircle2 />Apply</Button></FilterSortDialogFooter>
                            </FilterSortDialogContent>
                        </FilterSortDialog>
                    </CardHeader>
                    <CardContent className="p-0">
                    {isLabAccessRequestLoading ? <div className="text-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary"/></div> : filteredLabAccessRequests.length > 0 ? (<div className="max-h-96 overflow-y-auto border-t"><Table><TableHeader><TableRow><TableHead className="p-2 text-xs">User</TableHead><TableHead className="p-2 text-xs">Lab Req.</TableHead><TableHead className="text-right p-2 text-xs">Actions</TableHead></TableRow></TableHeader><TableBody>{filteredLabAccessRequests.map(req => (<TableRow key={req.id}><TableCell className="p-2 text-xs font-medium">{req.userName}</TableCell><TableCell className="p-2 text-xs">{req.labName}</TableCell><TableCell className="text-right p-1 space-x-0.5"><Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleMembershipAction(req.userId, req.userName!, req.labId, req.labName!, 'approve_request', req.id)} disabled={isProcessingLabAccessRequest[req.id!]?.loading}><ThumbsUp className="text-green-600 h-3.5 w-3.5"/></Button><Button size="icon" variant="outline" className="h-7 w-7" onClick={() => handleMembershipAction(req.userId, req.userName!, req.labId, req.labName!, 'reject_request', req.id)} disabled={isProcessingLabAccessRequest[req.id!]?.loading}><ThumbsDown className="text-red-500 h-3.5 w-3.5"/></Button></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-center text-sm text-muted-foreground py-6">{activeSystemWideAccessRequestsFilterCount > 0 ? "No requests match filters." : "No pending lab access requests system-wide."}</p>}
                    </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div><CardTitle className="text-xl">All Maintenance Requests</CardTitle><CardDescription>System-wide maintenance log.</CardDescription></div>
                    <Button variant="outline" size="xs" className="h-7" onClick={() => setIsMaintenanceFilterDialogOpen(true)}><FilterIcon className="mr-1.5 h-3.5 w-3.5"/>Filter</Button>
                  </CardHeader>
                  <CardContent className="p-0">
                      {filteredMaintenanceRequests.length > 0 ? (<div className="overflow-x-auto border-t"><Table><TableHeader><TableRow><TableHead>Resource</TableHead><TableHead className="min-w-[150px]">Issue</TableHead><TableHead>Reported</TableHead><TableHead>Status</TableHead><TableHead>Assigned</TableHead><TableHead className="text-right"></TableHead></TableRow></TableHeader><TableBody>{filteredMaintenanceRequests.map((request) => (<TableRow key={request.id}><TableCell className="font-medium">{request.resourceName}</TableCell><TableCell className="text-xs text-muted-foreground max-w-[150px] truncate" title={request.issueDescription}>{request.issueDescription}</TableCell><TableCell className="text-xs">{request.reportedByUserName}</TableCell><TableCell>{getMaintenanceStatusBadge(request.status)}</TableCell><TableCell className="text-xs">{request.assignedTechnicianName || <span className="italic">Unassigned</span>}</TableCell><TableCell className="text-right p-1"><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOpenEditMaintenanceDialog(request)}><Edit className="h-3.5 w-3.5"/></Button></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-center text-sm text-muted-foreground py-6">{activeMaintenanceFilterCount > 0 ? "No requests match filters." : "No maintenance requests."}</p>}
                  </CardContent>
                </Card>
              </div>
            </div>
          )}

          {/* LAB-SPECIFIC VIEW */}
          {activeContextId !== GLOBAL_CONTEXT_VALUE && selectedLabDetails && (
            <div className="space-y-6">
              <div className="flex justify-between items-center p-4 border-b mb-6">
                <h2 className="text-2xl font-semibold flex items-center gap-2"><Building className="h-6 w-6 text-primary"/>Managing Lab: {selectedLabDetails.name}</h2>
                <Button variant="outline" onClick={() => setActiveContextId(GLOBAL_CONTEXT_VALUE)}><ArrowRightCircle className="mr-2 h-4 w-4 rotate-180"/>Back to System-Wide</Button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between">
                      <div><CardTitle className="text-xl">Lab Overview & Stats</CardTitle><CardDescription>{selectedLabDetails.location || "No location specified"}</CardDescription></div>
                      <Button variant="outline" size="sm" onClick={() => handleOpenEditLabDialog(selectedLabDetails)}><Edit className="mr-2 h-4 w-4"/>Edit Details</Button>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm text-muted-foreground">{selectedLabDetails.description || "No description provided for this lab."}</p>
                        <Separator/>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm pt-2">
                            <div className="p-3 bg-muted/50 rounded-md"><span className="font-medium block text-foreground">Resources:</span> <span className="text-lg font-bold text-primary">{resourcesInSelectedLab.length}</span></div>
                            <div className="p-3 bg-muted/50 rounded-md"><span className="font-medium block text-foreground">Active Members:</span> <span className="text-lg font-bold text-primary">{activeLabMembers.length}</span></div>
                            <div className="p-3 bg-muted/50 rounded-md"><span className="font-medium block text-foreground">Open Maintenance:</span> <span className="text-lg font-bold text-primary">{maintenanceForSelectedLab.filter(mr => mr.status === 'Open' || mr.status === 'In Progress').length}</span></div>
                        </div>
                    </CardContent>
                  </Card>
                   <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div><CardTitle className="text-xl">Members & Access Requests</CardTitle><CardDescription>Manage users with access to {selectedLabDetails.name}.</CardDescription></div>
                        <Button size="sm" onClick={() => setIsManualAddMemberDialogOpen(true)}><Users className="mr-2 h-4 w-4"/>Add Member Manually</Button>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="active-members">
                        <TabsList className="grid w-full grid-cols-2 mb-2 h-9"><TabsContent value="active-members" className="text-xs px-2 py-1.5">Active Members ({activeLabMembers.length})</TabsContent><TabsContent value="pending-requests" className="text-xs px-2 py-1.5">Pending Requests ({filteredLabAccessRequests.length})</TabsContent></TabsList>
                        <TabsContent value="active-members">
                            {activeLabMembers.length > 0 ? (<div className="max-h-80 overflow-y-auto border rounded-md"><Table><TableHeader><TableRow><TableHead className="p-2 text-xs">User</TableHead><TableHead className="p-2 text-xs">Email</TableHead><TableHead className="text-right p-2 text-xs">Actions</TableHead></TableRow></TableHeader><TableBody>{activeLabMembers.map(member => (<TableRow key={member.userId}><TableCell className="p-2 text-xs font-medium flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={member.userAvatarUrl} alt={member.userName}/><AvatarFallback>{member.userName?.charAt(0)}</AvatarFallback></Avatar>{member.userName}</TableCell><TableCell className="p-2 text-xs">{member.userEmail}</TableCell><TableCell className="text-right p-1"><Button variant="destructive" size="xs" className="h-7" onClick={() => handleMembershipAction(member.userId, member.userName!, selectedLabDetails.id, selectedLabDetails.name, 'revoke', member.id)} disabled={isProcessingLabAccessRequest[member.id!]?.loading}><ShieldOff className="mr-1.5 h-3.5 w-3.5"/>Revoke</Button></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-center text-sm text-muted-foreground py-4">No active members in this lab.</p>}
                        </TabsContent>
                        <TabsContent value="pending-requests">
                            {filteredLabAccessRequests.length > 0 ? (<div className="max-h-80 overflow-y-auto border rounded-md"><Table><TableHeader><TableRow><TableHead className="p-2 text-xs">User</TableHead><TableHead className="p-2 text-xs">Email</TableHead><TableHead className="p-2 text-xs">Requested</TableHead><TableHead className="text-right p-2 text-xs">Actions</TableHead></TableRow></TableHeader><TableBody>{filteredLabAccessRequests.map(req => (<TableRow key={req.id}><TableCell className="p-2 text-xs font-medium flex items-center gap-2"><Avatar className="h-6 w-6"><AvatarImage src={req.userAvatarUrl} alt={req.userName}/><AvatarFallback>{req.userName?.charAt(0)}</AvatarFallback></Avatar>{req.userName}</TableCell><TableCell className="p-2 text-xs">{req.userEmail}</TableCell><TableCell className="p-2 text-xs">{formatDateSafe(req.requestedAt, 'N/A', 'MMM dd, yy')}</TableCell><TableCell className="text-right p-1 space-x-0.5"><Button size="xs" variant="outline" className="h-7 text-green-600 border-green-600 hover:bg-green-50" onClick={() => handleMembershipAction(req.userId, req.userName!, req.labId, req.labName!, 'approve_request', req.id)} disabled={isProcessingLabAccessRequest[req.id!]?.loading}><ThumbsUp className="mr-1 h-3 w-3"/>Approve</Button><Button size="xs" variant="outline" className="h-7 text-red-600 border-red-600 hover:bg-red-50" onClick={() => handleMembershipAction(req.userId, req.userName!, req.labId, req.labName!, 'reject_request', req.id)} disabled={isProcessingLabAccessRequest[req.id!]?.loading}><ThumbsDown className="mr-1 h-3 w-3"/>Reject</Button></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-center text-sm text-muted-foreground py-4">No pending access requests for this lab.</p>}
                        </TabsContent>
                        </Tabs>
                    </CardContent>
                  </Card>
                </div>
                <div className="lg:col-span-1 space-y-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div><CardTitle className="text-xl">Closures for {selectedLabDetails.name}</CardTitle></div>
                         <FilterSortDialog open={isClosureFilterDialogOpen} onOpenChange={setIsClosureFilterDialogOpen}><FilterSortDialogTrigger asChild><Button variant="outline" size="xs" className="h-7"><FilterIcon className="mr-1.5 h-3.5 w-3.5" />Filter</Button></FilterSortDialogTrigger><FilterSortDialogContent className="w-full max-w-md"><FilterSortDialogHeader><FilterSortDialogTitle>Filter Closures for {selectedLabDetails.name}</FilterSortDialogTitle></FilterSortDialogHeader><Separator className="my-3" /><div className="space-y-3"><div className="relative"><Label htmlFor="closureSearchDialogLab">Search (Reason/Date/Name)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="closureSearchDialogLab" value={tempClosureSearchTerm} onChange={(e) => setTempClosureSearchTerm(e.target.value)} placeholder="e.g., Maintenance..." className="mt-1 h-9 pl-8"/></div></div><FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetClosureDialogFiltersOnly} className="mr-auto"><FilterX />Reset</Button><Button variant="outline" onClick={() => setIsClosureFilterDialogOpen(false)}><X />Cancel</Button><Button onClick={handleApplyClosureDialogFilters}><CheckCircle2 />Apply</Button></FilterSortDialogFooter></FilterSortDialogContent></FilterSortDialog>
                    </CardHeader>
                    <CardContent>
                        <Tabs defaultValue="specific-dates-lab">
                        <TabsList className="grid w-full grid-cols-2 mb-2 h-9"><TabsContent value="specific-dates-lab" className="text-xs px-2 py-1.5">Specific Dates</TabsContent><TabsContent value="recurring-rules-lab" className="text-xs px-2 py-1.5">Recurring Rules</TabsContent></TabsList>
                        <TabsContent value="specific-dates-lab">
                            <Button onClick={handleOpenNewDateDialog} size="sm" className="w-full mb-2"><PlusCircle />Add Specific Date for This Lab</Button>
                            {filteredBlackoutDates.length > 0 ? (<div className="max-h-60 overflow-y-auto border rounded-md"><Table><TableHeader><TableRow><TableHead className="text-xs p-2">Date</TableHead><TableHead className="text-xs p-2">Reason</TableHead><TableHead className="text-right p-2"></TableHead></TableRow></TableHeader><TableBody>{filteredBlackoutDates.map(bd => (<TableRow key={bd.id}><TableCell className="text-xs p-2">{formatDateSafe(parseISO(bd.date), 'N/A', 'MMM dd, yyyy')}</TableCell><TableCell className="text-xs p-2 truncate max-w-[100px]" title={bd.reason}>{bd.reason || 'N/A'}</TableCell><TableCell className="text-right p-1 space-x-0.5"><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOpenEditDateDialog(bd)}><Edit className="h-3.5 w-3.5"/></Button><AlertDialog open={dateToDelete?.id === bd.id} onOpenChange={(isOpen) => !isOpen && setDateToDelete(null)}><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDateToDelete(bd)}><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Blackout for {selectedLabDetails.name}?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => dateToDelete && handleDeleteBlackoutDate(dateToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-center text-xs text-muted-foreground py-3">No specific dates for this lab.</p>}
                        </TabsContent>
                        <TabsContent value="recurring-rules-lab">
                            <Button onClick={handleOpenNewRecurringDialog} size="sm" className="w-full mb-2"><PlusCircle />Add Recurring Rule for This Lab</Button>
                            {filteredRecurringRules.length > 0 ? (<div className="max-h-60 overflow-y-auto border rounded-md"><Table><TableHeader><TableRow><TableHead className="text-xs p-2">Rule</TableHead><TableHead className="text-xs p-2">Days</TableHead><TableHead className="text-right p-2"></TableHead></TableRow></TableHeader><TableBody>{filteredRecurringRules.map(rule => (<TableRow key={rule.id}><TableCell className="text-xs p-2 font-medium truncate max-w-[100px]" title={rule.name}>{rule.name}</TableCell><TableCell className="text-xs p-2 truncate max-w-[100px]" title={rule.daysOfWeek.join(', ')}>{rule.daysOfWeek.join(', ')}</TableCell><TableCell className="text-right p-1 space-x-0.5"><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOpenEditRecurringDialog(rule)}><Edit className="h-3.5 w-3.5"/></Button><AlertDialog open={ruleToDelete?.id === rule.id} onOpenChange={(isOpen) => !isOpen && setRuleToDelete(null)}><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setRuleToDelete(rule)}><Trash2 className="h-3.5 w-3.5"/></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete Rule for {selectedLabDetails.name}?</AlertDialogTitle></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => ruleToDelete && handleDeleteRecurringRule(ruleToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell></TableRow>))}</TableBody></Table></div>) : <p className="text-center text-xs text-muted-foreground py-3">No recurring rules for this lab.</p>}
                        </TabsContent>
                        </Tabs>
                    </CardContent>
                  </Card>
                   <Card>
                    <CardHeader className="flex flex-row items-center justify-between">
                        <div><CardTitle className="text-xl">Maintenance for {selectedLabDetails.name}</CardTitle></div>
                         <Button variant="outline" size="xs" className="h-7" onClick={() => setIsMaintenanceFilterDialogOpen(true)}><FilterIcon className="mr-1.5 h-3.5 w-3.5"/>Filter</Button>
                    </CardHeader>
                    <CardContent className="p-0">
                         <Button onClick={handleOpenNewMaintenanceDialog} size="sm" className="w-[calc(100%-2rem)] mx-4 mb-2"><PlusCircle/>Log Request in This Lab</Button>
                        {filteredMaintenanceRequests.length > 0 ? (<div className="max-h-96 overflow-y-auto border-t"><Table><TableHeader><TableRow><TableHead className="p-2 text-xs">Resource</TableHead><TableHead className="p-2 text-xs">Issue</TableHead><TableHead className="p-2 text-xs">Status</TableHead><TableHead className="text-right p-2 text-xs"></TableHead></TableRow></TableHeader><TableBody>{filteredMaintenanceRequests.map(req => (<TableRow key={req.id}><TableCell className="p-2 text-xs font-medium">{req.resourceName}</TableCell><TableCell className="p-2 text-xs truncate max-w-[100px]" title={req.issueDescription}>{req.issueDescription}</TableCell><TableCell className="p-2">{getMaintenanceStatusBadge(req.status)}</TableCell><TableCell className="text-right p-1"><Button variant="outline" size="icon" className="h-7 w-7" onClick={() => handleOpenEditMaintenanceDialog(req)}><Edit className="h-3.5 w-3.5"/></Button></TableCell></TableRow>))}</TableBody></Table></div>): <p className="text-center text-sm text-muted-foreground py-6">No maintenance requests for this lab.</p>}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Standard Dialogs */}
      {isResourceTypeFormDialogOpen && currentUser && (<ResourceTypeFormDialog open={isResourceTypeFormDialogOpen} onOpenChange={(isOpen) => { setIsResourceTypeFormDialogOpen(isOpen); if (!isOpen) setEditingType(null); }} initialType={editingType} onSave={handleSaveResourceType} />)}
      {isLabFormDialogOpen && currentUser && (<LabFormDialog open={isLabFormDialogOpen} onOpenChange={(isOpen) => { setIsLabFormDialogOpen(isOpen); if (!isOpen) setEditingLab(null); }} initialLab={editingLab} onSave={handleSaveLab} />)}
      {isDateFormDialogOpen && currentUser && (<BlackoutDateFormDialog open={isDateFormDialogOpen} onOpenChange={setIsDateFormDialogOpen} initialBlackoutDate={editingBlackoutDate} onSave={handleSaveBlackoutDate} labs={labs} currentLabContextId={activeContextId} />)}
      {isRecurringFormDialogOpen && currentUser && (<RecurringBlackoutRuleFormDialog open={isRecurringFormDialogOpen} onOpenChange={setIsRecurringFormDialogOpen} initialRule={editingRecurringRule} onSave={handleSaveRecurringRule} labs={labs} currentLabContextId={activeContextId} />)}
      {isMaintenanceFormDialogOpen && currentUser && (<MaintenanceRequestFormDialog open={isMaintenanceFormDialogOpen} onOpenChange={(isOpen) => { setIsMaintenanceFormDialogOpen(isOpen); if (!isOpen) setEditingMaintenanceRequest(null);}} initialRequest={editingMaintenanceRequest} onSave={handleSaveMaintenanceRequest} technicians={allTechniciansForMaintenance} resources={allResourcesForCountsAndChecks} currentUserRole={currentUser?.role} labContextId={activeContextId !== GLOBAL_CONTEXT_VALUE ? activeContextId : undefined} /> )}
      {isManualAddMemberDialogOpen && selectedLabDetails && currentUser && (<ManageUserLabAccessDialog targetUser={null} allLabs={labs} open={isManualAddMemberDialogOpen} onOpenChange={setIsManualAddMemberDialogOpen} onMembershipUpdate={fetchAllAdminData} preselectedLabId={selectedLabDetails.id} />)}
      {/* Filter Dialog for Maintenance (reused) */}
      <FilterSortDialog open={isMaintenanceFilterDialogOpen} onOpenChange={setIsMaintenanceFilterDialogOpen}>
          <FilterSortDialogContent className="w-full max-w-lg">
              <FilterSortDialogHeader><FilterSortDialogTitle>Filter Maintenance Requests {activeContextId !== GLOBAL_CONTEXT_VALUE && selectedLabDetails ? `for ${selectedLabDetails.name}`: ''}</FilterSortDialogTitle></FilterSortDialogHeader><Separator className="my-3" />
              <div className="space-y-3">
                <div className="relative"><Label htmlFor="maintSearchSystem">Search (Resource/Reporter/Issue/Tech)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="maintSearchSystem" value={tempMaintenanceSearchTerm} onChange={e => setTempMaintenanceSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label htmlFor="maintStatusSystem">Status</Label><Select value={tempMaintenanceFilterStatus} onValueChange={(v) => setTempMaintenanceFilterStatus(v as MaintenanceRequestStatus | 'all')}><SelectTrigger id="maintStatusSystem" className="h-9 mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{maintenanceRequestStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                    <div><Label htmlFor="maintResourceSystem">Resource</Label><Select value={tempMaintenanceFilterResourceId} onValueChange={setTempMaintenanceFilterResourceId} disabled={(activeContextId !== GLOBAL_CONTEXT_VALUE && selectedLabDetails ? resourcesInSelectedLab : allResourcesForCountsAndChecks).length === 0}><SelectTrigger id="maintResourceSystem" className="h-9 mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Resources</SelectItem>{(activeContextId !== GLOBAL_CONTEXT_VALUE && selectedLabDetails ? resourcesInSelectedLab : allResourcesForCountsAndChecks).map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div><Label htmlFor="maintTechSystem">Assigned Technician</Label><Select value={tempMaintenanceFilterTechnicianId} onValueChange={setTempMaintenanceFilterTechnicianId} disabled={allTechniciansForMaintenance.length === 0}><SelectTrigger id="maintTechSystem" className="h-9 mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All/Any</SelectItem><SelectItem value="--unassigned--">Unassigned</SelectItem>{allTechniciansForMaintenance.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div>
                    {activeContextId === GLOBAL_CONTEXT_VALUE && (<div><Label htmlFor="maintLabSystem">Lab (of Resource)</Label><Select value={tempMaintenanceFilterLabId} onValueChange={setTempMaintenanceFilterLabId} disabled={labs.length === 0}><SelectTrigger id="maintLabSystem" className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All Labs</SelectItem>{labs.map(lab => (<SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>))}</SelectContent></Select></div>)}
                </div>
              </div>
              <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetMaintenanceDialogFiltersOnly} className="mr-auto"><FilterX />Reset</Button><Button variant="outline" onClick={() => setIsMaintenanceFilterDialogOpen(false)}><X />Cancel</Button><Button onClick={handleApplyMaintenanceDialogFilters}><CheckCircle2 />Apply</Button></FilterSortDialogFooter>
          </FilterSortDialogContent>
      </FilterSortDialog>
    </div>
    </TooltipProvider>
  );
}
