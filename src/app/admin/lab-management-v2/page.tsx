
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Cog, ListChecks, PackagePlus, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon, Loader2, X, CheckCircle2, Building, PlusCircle, CalendarOff, Repeat, Wrench, ListFilter, PenToolIcon, AlertCircle, CheckCircle as LucideCheckCircle, Globe, Users, ThumbsUp, ThumbsDown, Settings2 as LabAccessIcon, Settings } from 'lucide-react';
import type { ResourceType, Resource, Lab, RoleName, BlackoutDate, RecurringBlackoutRule, MaintenanceRequest, MaintenanceRequestStatus, User, LabMembership } from '@/types';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
}from "@/components/ui/alert-dialog";
import {
  Dialog as FilterSortDialog,
  DialogContent as FilterSortDialogContent,
  DialogDescription as FilterSortDialogDescription,
  DialogFooter as FilterSortDialogFooter,
  DialogHeader as FilterSortDialogHeader,
  DialogTitle as FilterSortDialogTitle,
  DialogTrigger as FilterSortDialogTrigger,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { ResourceTypeFormDialog, ResourceTypeFormValues } from '@/components/admin/resource-type-form-dialog';
import { LabFormDialog, LabFormValues } from '@/components/admin/lab-form-dialog';
import { BlackoutDateFormDialog, BlackoutDateFormValues as BlackoutDateDialogFormValues } from '@/components/admin/blackout-date-form-dialog';
import { RecurringBlackoutRuleFormDialog, RecurringBlackoutRuleFormValues as RecurringRuleDialogFormValues } from '@/components/admin/recurring-blackout-rule-form-dialog';
import { MaintenanceRequestFormDialog, MaintenanceRequestFormValues as MaintenanceDialogFormValues } from '@/components/maintenance/maintenance-request-form-dialog';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp, writeBatch, where } from 'firebase/firestore';
import { addAuditLog, addNotification, manageLabMembership_SA } from '@/lib/firestore-helpers';
import { daysOfWeekArray, maintenanceRequestStatuses } from '@/lib/app-constants';
import { format, parseISO, isValid as isValidDateFn } from 'date-fns';
import { cn, formatDateSafe } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';


type ResourceTypeSortableColumn = 'name' | 'resourceCount' | 'description';
const resourceTypeSortOptions: { value: string; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' }, { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'resourceCount-asc', label: 'Resources (Low-High)' }, { value: 'resourceCount-desc', label: 'Resources (High-Low)' },
  { value: 'description-asc', label: 'Description (A-Z)' }, { value: 'description-desc', label: 'Description (Z-A)' },
];
type LabSortableColumn = 'name' | 'location';
const labSortOptions: { value: string; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' }, { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'location-asc', label: 'Location (A-Z)' }, { value: 'location-desc', label: 'Location (Z-A)' },
];

const getMaintenanceStatusBadge = (status: MaintenanceRequestStatus) => {
  switch (status) {
    case 'Open': return <Badge variant="destructive" className="bg-red-500 text-white border-transparent"><AlertCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'In Progress': return <Badge variant="secondary" className="bg-yellow-500 text-yellow-950 border-transparent"><PenToolIcon className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Resolved': return <Badge className="bg-blue-500 text-white border-transparent"><LucideCheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Closed': return <Badge className="bg-green-500 text-white border-transparent"><LucideCheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

interface LabMembershipRequest extends LabMembership {
  userName?: string;
  userEmail?: string;
  userAvatarUrl?: string;
  labName?: string;
}

const GLOBAL_CONTEXT_VALUE = "__GLOBAL_OVERVIEW__";


export default function LabOperationsCenterPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [isLoadingData, setIsLoadingData] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("manage-labs"); // Updated default tab

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
  
  const [activeLabContextId, setActiveLabContextId] = useState<string>(GLOBAL_CONTEXT_VALUE);
  const [isClosureFilterDialogOpen, setIsClosureFilterDialogOpen] = useState(false); // For keyword search in closures
  const [tempClosureSearchTerm, setTempClosureSearchTerm] = useState('');
  const [activeClosureSearchTerm, setActiveClosureSearchTerm] = useState('');


  const [maintenanceRequests, setMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [allTechniciansForMaintenance, setAllTechniciansForMaintenance] = useState<User[]>([]);
  const [allUsersForMaintenance, setAllUsersForMaintenance] = useState<User[]>([]);
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

  const [labAccessRequests, setLabAccessRequests] = useState<LabMembershipRequest[]>([]);
  const [isLabAccessRequestLoading, setIsLabAccessRequestLoading] = useState(true);
  const [isProcessingLabAccessRequest, setIsProcessingLabAccessRequest] = useState<Record<string, {action: 'approve_request' | 'reject_request', loading: boolean}>>({});
  const [isLabAccessFilterDialogOpen, setIsLabAccessFilterDialogOpen] = useState(false); // For keyword search of user


  const canManageAny = useMemo(() => currentUser && currentUser.role === 'Admin', [currentUser]);

  const fetchAllAdminData = useCallback(async () => {
    if (!canManageAny) {
      setIsLoadingData(false);
      setResourceTypes([]); setAllResourcesForCountsAndChecks([]); setLabs([]);
      setBlackoutDates([]); setRecurringRules([]);
      setMaintenanceRequests([]); setAllTechniciansForMaintenance([]); setAllUsersForMaintenance([]);
      setLabAccessRequests([]); setIsLabAccessRequestLoading(false);
      return;
    }
    setIsLoadingData(true);
    setIsLabAccessRequestLoading(true);
    try {
      const labsQuery = query(collection(db, "labs"), orderBy("name", "asc"));
      const labsSnapshot = await getDocs(labsQuery);
      const fetchedLabs = labsSnapshot.docs.map(docSnap => ({id: docSnap.id, ...docSnap.data(), createdAt: (docSnap.data().createdAt as Timestamp)?.toDate(), lastUpdatedAt: (docSnap.data().lastUpdatedAt as Timestamp)?.toDate()} as Lab));
      setLabs(fetchedLabs);

      const typesQuery = query(collection(db, "resourceTypes"), orderBy("name", "asc"));
      const typesSnapshot = await getDocs(typesQuery);
      setResourceTypes(typesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ResourceType)));

      const resourcesQuery = query(collection(db, "resources"));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const fetchedResourcesAll = resourcesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Resource));
      setAllResourcesForCountsAndChecks(fetchedResourcesAll);

      const boQuery = query(collection(db, "blackoutDates"), orderBy("date", "asc"));
      const boSnapshot = await getDocs(boQuery);
      setBlackoutDates(boSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as BlackoutDate)));
      const rrQuery = query(collection(db, "recurringBlackoutRules"), orderBy("name", "asc"));
      const rrSnapshot = await getDocs(rrQuery);
      setRecurringRules(rrSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as RecurringBlackoutRule)));

      const usersSnapshot = await getDocs(query(collection(db, "users"), orderBy("name", "asc")));
      const fetchedUsersAll = usersSnapshot.docs.map(d => ({id: d.id, ...d.data(), createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date()} as User));
      setAllUsersForMaintenance(fetchedUsersAll);

      const techniciansQuery = query(collection(db, "users"), where("role", "==", "Technician"), orderBy("name", "asc"));
      const techniciansSnapshot = await getDocs(techniciansQuery);
      setAllTechniciansForMaintenance(techniciansSnapshot.docs.map(d => ({id: d.id, ...d.data(), createdAt: (d.data().createdAt as Timestamp)?.toDate() || new Date()} as User)));

      const requestsQueryInstance = query(collection(db, "maintenanceRequests"), orderBy("dateReported", "desc"));
      const requestsSnapshot = await getDocs(requestsQueryInstance);
      const fetchedMaintenance = requestsSnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return { id: docSnap.id, ...data, dateReported: (data.dateReported as Timestamp)?.toDate() || new Date(), dateResolved: (data.dateResolved as Timestamp)?.toDate() } as MaintenanceRequest;
      });
      setMaintenanceRequests(fetchedMaintenance);

      const labAccessQuery = query(collection(db, 'labMemberships'), where('status', '==', 'pending_approval'), orderBy('requestedAt', 'asc'));
      const labAccessSnapshot = await getDocs(labAccessQuery);
      const pendingRequestsPromises = labAccessSnapshot.docs.map(async (memberDoc) => {
          const membershipData = memberDoc.data() as LabMembership;
          const user = fetchedUsersAll.find(u => u.id === membershipData.userId);
          const lab = fetchedLabs.find(l => l.id === membershipData.labId);
          return {
              ...membershipData,
              id: memberDoc.id, 
              userName: user?.name || 'Unknown User',
              userEmail: user?.email || 'N/A',
              userAvatarUrl: user?.avatarUrl,
              labName: lab?.name || 'Unknown Lab',
              requestedAt: (membershipData.requestedAt as Timestamp)?.toDate()
          } as LabMembershipRequest;
      });
      const fetchedLabAccessRequests = await Promise.all(pendingRequestsPromises);
      setLabAccessRequests(fetchedLabAccessRequests);
      setIsLabAccessRequestLoading(false);

    } catch (error: any) {
      console.error("Error fetching admin data:", error);
      toast({ title: "Error", description: `Failed to load data: ${error.message}`, variant: "destructive" });
      setIsLabAccessRequestLoading(false);
    }
    setIsLoadingData(false);
  }, [toast, canManageAny]);

  useEffect(() => { fetchAllAdminData(); }, [fetchAllAdminData]);


  const handleLabAccessRequestAction = async (
    membershipId: string,
    targetUserId: string,
    targetUserName: string,
    labId: string,
    labName: string,
    action: 'approve_request' | 'reject_request'
  ) => {
    if (!currentUser || !currentUser.id || !currentUser.name) {
        toast({ title: "Authentication Error", variant: "destructive" });
        return;
    }
    setIsProcessingLabAccessRequest(prev => ({...prev, [membershipId]: {action, loading: true}}));
    try {
      const result = await manageLabMembership_SA(
        currentUser.id,
        currentUser.name,
        targetUserId,
        targetUserName,
        labId,
        labName,
        action,
        membershipId
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
      setIsProcessingLabAccessRequest(prev => ({...prev, [membershipId]: {action, loading: false}}));
    }
  };

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

  useEffect(() => { if (isLabFilterDialogOpen) { setTempLabSearchTerm(activeLabSearchTerm); setTempLabSortBy(activeLabSortBy);}}, [isLabFilterDialogOpen, activeLabSearchTerm, activeLabSortBy]);
  const filteredLabs = useMemo(() => {
    let currentLabs = [...labs]; const lowerSearchTerm = activeLabSearchTerm.toLowerCase(); if (activeLabSearchTerm) { currentLabs = currentLabs.filter(lab => lab.name.toLowerCase().includes(lowerSearchTerm) || (lab.location && lab.location.toLowerCase().includes(lowerSearchTerm)) || (lab.description && lab.description.toLowerCase().includes(lowerSearchTerm)));} const [column, direction] = activeLabSortBy.split('-') as [LabSortableColumn, 'asc' | 'desc']; currentLabs.sort((a, b) => { let comparison = 0; if (column === 'name') comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase()); else if (column === 'location') comparison = (a.location || '').toLowerCase().localeCompare((b.location || '').toLowerCase()); return direction === 'asc' ? comparison : -comparison; }); return currentLabs;
  }, [labs, activeLabSearchTerm, activeLabSortBy]);
  const handleApplyLabDialogFilters = useCallback(() => { setActiveLabSearchTerm(tempLabSearchTerm); setActiveLabSortBy(tempLabSortBy); setIsLabFilterDialogOpen(false);}, [tempLabSearchTerm, tempLabSortBy]);
  const resetLabDialogFiltersOnly = useCallback(() => { setTempLabSearchTerm(''); setTempLabSortBy('name-asc'); }, []);
  const resetAllActiveLabPageFilters = useCallback(() => { setActiveLabSearchTerm(''); setActiveLabSortBy('name-asc'); resetLabDialogFiltersOnly(); setIsLabFilterDialogOpen(false);}, [resetLabDialogFiltersOnly]);
  const handleOpenNewLabDialog = () => { setEditingLab(null); setIsLabFormDialogOpen(true); };
  const handleOpenEditLabDialog = (lab: Lab) => { setEditingLab(lab); setIsLabFormDialogOpen(true); };
  const handleSaveLab = async (data: LabFormValues) => {
    if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; } setIsLoadingData(true); try { const labDataToSave: Partial<Omit<Lab, 'id' | 'createdAt' | 'lastUpdatedAt'>> & { lastUpdatedAt?: any, createdAt?: any } = { name: data.name, location: data.location || null, description: data.description || null, }; const auditAction = editingLab ? 'LAB_UPDATED' : 'LAB_CREATED'; let entityId = editingLab ? editingLab.id : ''; if (editingLab) { labDataToSave.lastUpdatedAt = serverTimestamp(); await updateDoc(doc(db, "labs", entityId), labDataToSave as any); } else { labDataToSave.createdAt = serverTimestamp(); const docRef = await addDoc(collection(db, "labs"), labDataToSave as any); entityId = docRef.id; } addAuditLog(currentUser.id, currentUser.name, auditAction, { entityType: 'Lab', entityId, details: `Lab '${data.name}' ${editingLab ? 'updated' : 'created'}.` }); toast({ title: `Lab ${editingLab ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingLab ? 'updated' : 'created'}.` }); setIsLabFormDialogOpen(false); setEditingLab(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Save Error", description: `Could not save lab: ${error.message}`, variant: "destructive" }); } finally { setIsLoadingData(false); }
  };
  const handleDeleteLab = async (labId: string) => {
    if (!currentUser || !currentUser.name || !canManageAny) { toast({ title: "Permission Denied", variant: "destructive" }); return; } const deletedLab = labs.find(lab => lab.id === labId); if (!deletedLab) { toast({ title: "Error", description: "Lab not found.", variant: "destructive" }); return; } const resourcesInThisLab = allResourcesForCountsAndChecks.filter(res => res.labId === labId).length; if (resourcesInThisLab > 0) { toast({ title: "Deletion Blocked", description: `Cannot delete lab "${deletedLab.name}" as ${resourcesInThisLab} resource(s) are assigned. Reassign them first.`, variant: "destructive", duration: 7000 }); setLabToDelete(null); return; } setIsLoadingData(true); try { await deleteDoc(doc(db, "labs", labId)); addAuditLog(currentUser.id, currentUser.name, 'LAB_DELETED', { entityType: 'Lab', entityId: labId, details: `Lab '${deletedLab.name}' deleted.` }); toast({ title: "Lab Deleted", description: `Lab "${deletedLab.name}" removed.`, variant: "destructive" }); setLabToDelete(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Delete Error", description: `Could not delete lab: ${error.message}`, variant: "destructive" }); } finally { setIsLoadingData(false); }
  };
  const activeLabFilterCount = useMemo(() => [activeLabSearchTerm !== '', activeLabSortBy !== 'name-asc'].filter(Boolean).length, [activeLabSearchTerm, activeLabSortBy]);

  // Closures Logic (Contextual)
  useEffect(() => { if (isClosureFilterDialogOpen) { setTempClosureSearchTerm(activeClosureSearchTerm); }}, [isClosureFilterDialogOpen, activeClosureSearchTerm]);
  const filteredBlackoutDates = useMemo(() => {
    return blackoutDates.filter(bd => {
        const labMatch = activeLabContextId === GLOBAL_CONTEXT_VALUE ? !bd.labId : bd.labId === activeLabContextId;
        const lowerSearchTerm = activeClosureSearchTerm.toLowerCase();
        const reasonMatch = bd.reason && bd.reason.toLowerCase().includes(lowerSearchTerm);
        const dateMatch = bd.date && isValidDateFn(parseISO(bd.date)) && format(parseISO(bd.date), 'PPP').toLowerCase().includes(lowerSearchTerm);
        return labMatch && (!activeClosureSearchTerm || reasonMatch || dateMatch);
    });
  }, [blackoutDates, activeLabContextId, activeClosureSearchTerm]);
  const filteredRecurringRules = useMemo(() => {
    return recurringRules.filter(rule => {
        const labMatch = activeLabContextId === GLOBAL_CONTEXT_VALUE ? !rule.labId : rule.labId === activeLabContextId;
        const lowerSearchTerm = activeClosureSearchTerm.toLowerCase();
        const nameMatch = rule.name && rule.name.toLowerCase().includes(lowerSearchTerm);
        const reasonMatch = rule.reason && rule.reason.toLowerCase().includes(lowerSearchTerm);
        return labMatch && (!activeClosureSearchTerm || nameMatch || reasonMatch);
    });
  }, [recurringRules, activeLabContextId, activeClosureSearchTerm]);
  const handleOpenNewDateDialog = useCallback(() => { setEditingBlackoutDate(null); setIsDateFormDialogOpen(true); }, []);
  const handleOpenEditDateDialog = useCallback((bd: BlackoutDate) => { setEditingBlackoutDate(bd); setIsDateFormDialogOpen(true); }, []);
  const handleSaveBlackoutDate = useCallback(async (data: BlackoutDateDialogFormValues) => {
    if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; } const formattedDateOnly = format(data.date, 'yyyy-MM-dd'); const displayDate = format(data.date, 'PPP'); const blackoutDataToSave: Omit<BlackoutDate, 'id'> = { labId: data.labId === '--global--' ? null : data.labId, date: formattedDateOnly, reason: data.reason || undefined, }; setIsLoadingData(true); try { if (editingBlackoutDate) { await updateDoc(doc(db, "blackoutDates", editingBlackoutDate.id), blackoutDataToSave as any); addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_UPDATED', { entityType: 'BlackoutDate', entityId: editingBlackoutDate.id, details: `Blackout Date for ${displayDate} updated. Lab: ${blackoutDataToSave.labId || 'Global'}. Reason: ${data.reason || 'N/A'}`}); toast({ title: 'Blackout Date Updated'}); } else { const docRef = await addDoc(collection(db, "blackoutDates"), blackoutDataToSave); addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_CREATED', { entityType: 'BlackoutDate', entityId: docRef.id, details: `Blackout Date for ${displayDate} created. Lab: ${blackoutDataToSave.labId || 'Global'}. Reason: ${data.reason || 'N/A'}`}); toast({ title: 'Blackout Date Added'}); } setIsDateFormDialogOpen(false); setEditingBlackoutDate(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Save Failed", variant: "destructive"});} finally { setIsLoadingData(false); }
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
    if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; } const ruleDataToSave: Omit<RecurringBlackoutRule, 'id'> = { labId: data.labId === '--global--' ? null : data.labId, name: data.name, daysOfWeek: data.daysOfWeek, reason: data.reason || undefined, }; setIsLoadingData(true); try { if (editingRecurringRule) { await updateDoc(doc(db, "recurringBlackoutRules", editingRecurringRule.id), ruleDataToSave as any); addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_UPDATED', { entityType: 'RecurringBlackoutRule', entityId: editingRecurringRule.id, details: `Recurring rule '${data.name}' updated. Lab: ${ruleDataToSave.labId || 'Global'}.`}); toast({ title: 'Recurring Rule Updated'}); } else { const docRef = await addDoc(collection(db, "recurringBlackoutRules"), ruleDataToSave); addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_CREATED', { entityType: 'RecurringBlackoutRule', entityId: docRef.id, details: `Recurring rule '${data.name}' created. Lab: ${ruleDataToSave.labId || 'Global'}.`}); toast({ title: 'Recurring Rule Added'}); } setIsRecurringFormDialogOpen(false); setEditingRecurringRule(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Save Failed", variant: "destructive"});} finally { setIsLoadingData(false); }
  }, [currentUser, editingRecurringRule, fetchAllAdminData, toast]);
  const handleDeleteRecurringRule = useCallback(async (ruleId: string) => {
    if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; } const deletedRuleObj = recurringRules.find(r => r.id === ruleId); if (!deletedRuleObj) return; setIsLoadingData(true); try { await deleteDoc(doc(db, "recurringBlackoutRules", ruleId)); addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_DELETED', { entityType: 'RecurringBlackoutRule', entityId: ruleId, details: `Recurring rule '${deletedRuleObj.name}' (Lab: ${deletedRuleObj.labId || 'Global'}) deleted.`}); toast({ title: "Recurring Rule Removed", variant: "destructive" }); setRuleToDelete(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: "Delete Failed", variant: "destructive"});} finally { setIsLoadingData(false); }
  }, [currentUser, recurringRules, fetchAllAdminData, toast]);

  useEffect(() => { if (isMaintenanceFilterDialogOpen) { setTempMaintenanceSearchTerm(activeMaintenanceSearchTerm); setTempMaintenanceFilterStatus(activeMaintenanceFilterStatus); setTempMaintenanceFilterResourceId(activeMaintenanceFilterResourceId); setTempMaintenanceFilterTechnicianId(activeMaintenanceFilterTechnicianId); setTempMaintenanceFilterLabId(activeMaintenanceFilterLabId); }}, [isMaintenanceFilterDialogOpen, activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId, activeMaintenanceFilterLabId]);
  const filteredMaintenanceRequests = useMemo(() => {
    return maintenanceRequests.map(req => {
      const resource = allResourcesForCountsAndChecks.find(r => r.id === req.resourceId);
      const reporter = allUsersForMaintenance.find(u => u.id === req.reportedByUserId);
      const technician = allTechniciansForMaintenance.find(t => t.id === req.assignedTechnicianId);
      return { ...req, resourceName: resource?.name || 'Unknown Resource', resourceLabId: resource?.labId, reportedByUserName: reporter?.name || 'Unknown User', assignedTechnicianName: technician?.name, };
    }).filter(req => {
      const lowerSearchTerm = activeMaintenanceSearchTerm.toLowerCase();
      const searchMatch = !activeMaintenanceSearchTerm || (req.resourceName && req.resourceName.toLowerCase().includes(lowerSearchTerm)) || (req.reportedByUserName && req.reportedByUserName.toLowerCase().includes(lowerSearchTerm)) || (req.issueDescription && req.issueDescription.toLowerCase().includes(lowerSearchTerm)) || (req.assignedTechnicianName && req.assignedTechnicianName.toLowerCase().includes(lowerSearchTerm));
      const statusMatch = activeMaintenanceFilterStatus === 'all' || req.status === activeMaintenanceFilterStatus;
      const resourceMatch = activeMaintenanceFilterResourceId === 'all' || req.resourceId === activeMaintenanceFilterResourceId;
      const labMatch = activeMaintenanceFilterLabId === 'all' || req.resourceLabId === activeMaintenanceFilterLabId;
      let technicianMatch = true; if (activeMaintenanceFilterTechnicianId !== 'all') { if (activeMaintenanceFilterTechnicianId === '--unassigned--') { technicianMatch = !req.assignedTechnicianId; } else { technicianMatch = req.assignedTechnicianId === activeMaintenanceFilterTechnicianId; } }
      return searchMatch && statusMatch && resourceMatch && labMatch && technicianMatch;
    });
  }, [maintenanceRequests, allResourcesForCountsAndChecks, allTechniciansForMaintenance, allUsersForMaintenance, activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId, activeMaintenanceFilterLabId]);
  const handleApplyMaintenanceDialogFilters = useCallback(() => { setActiveMaintenanceSearchTerm(tempMaintenanceSearchTerm.toLowerCase()); setActiveMaintenanceFilterStatus(tempMaintenanceFilterStatus); setActiveMaintenanceFilterResourceId(tempMaintenanceFilterResourceId); setActiveMaintenanceFilterTechnicianId(tempMaintenanceFilterTechnicianId); setActiveMaintenanceFilterLabId(tempMaintenanceFilterLabId); setIsMaintenanceFilterDialogOpen(false); }, [tempMaintenanceSearchTerm, tempMaintenanceFilterStatus, tempMaintenanceFilterResourceId, tempMaintenanceFilterTechnicianId, tempMaintenanceFilterLabId]);
  const resetMaintenanceDialogFiltersOnly = useCallback(() => { setTempMaintenanceSearchTerm(''); setTempMaintenanceFilterStatus('all'); setTempMaintenanceFilterResourceId('all'); setTempMaintenanceFilterTechnicianId('all'); setTempMaintenanceFilterLabId('all'); }, []);
  const resetAllActiveMaintenancePageFilters = useCallback(() => { setActiveMaintenanceSearchTerm(''); setActiveMaintenanceFilterStatus('all'); setActiveMaintenanceFilterResourceId('all'); setActiveMaintenanceFilterTechnicianId('all'); setActiveMaintenanceFilterLabId('all'); resetMaintenanceDialogFiltersOnly(); setIsMaintenanceFilterDialogOpen(false); }, [resetMaintenanceDialogFiltersOnly]);
  const handleOpenNewMaintenanceDialog = useCallback(() => { if (!currentUser) return; setEditingMaintenanceRequest(null); setIsMaintenanceFormDialogOpen(true); }, [currentUser]);
  const handleOpenEditMaintenanceDialog = useCallback((request: MaintenanceRequest) => { setEditingMaintenanceRequest(request); setIsMaintenanceFormDialogOpen(true); }, []);
  const handleSaveMaintenanceRequest = useCallback(async (data: MaintenanceDialogFormValues) => {
    if (!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Error", variant: "destructive"}); return;} const resource = allResourcesForCountsAndChecks.find(r => r.id === data.resourceId); if (!resource) { toast({ title: "Error", variant: "destructive" }); return;} let dateResolvedForFirestore: Timestamp | null = null; if ((data.status === 'Resolved' || data.status === 'Closed') && data.dateResolved && isValidDateFn(new Date(data.dateResolved))) { dateResolvedForFirestore = Timestamp.fromDate(new Date(data.dateResolved)); } else if ((data.status === 'Resolved' || data.status === 'Closed') && !editingMaintenanceRequest?.dateResolved) { dateResolvedForFirestore = serverTimestamp() as Timestamp; } else if (editingMaintenanceRequest?.dateResolved && (data.status === 'Resolved' || data.status === 'Closed')) { dateResolvedForFirestore = Timestamp.fromDate(editingMaintenanceRequest.dateResolved); } const requestDataToSave: any = { resourceId: data.resourceId, issueDescription: data.issueDescription, status: data.status, assignedTechnicianId: data.assignedTechnicianId === '--unassigned--' || !data.assignedTechnicianId ? null : data.assignedTechnicianId, resolutionNotes: data.resolutionNotes || null, dateResolved: dateResolvedForFirestore, }; setIsLoadingData(true); try { if (editingMaintenanceRequest) { await updateDoc(doc(db, "maintenanceRequests", editingMaintenanceRequest.id), requestDataToSave); await addAuditLog(currentUser.id, currentUser.name, 'MAINTENANCE_UPDATED', { entityType: 'MaintenanceRequest', entityId: editingMaintenanceRequest.id, details: `Maintenance request for '${resource.name}' updated. Status: ${data.status}.`}); toast({ title: 'Request Updated'}); if ((data.status === 'Resolved' && editingMaintenanceRequest.status !== 'Resolved') && editingMaintenanceRequest.reportedByUserId !== currentUser.id && editingMaintenanceRequest.reportedByUserId) { await addNotification( editingMaintenanceRequest.reportedByUserId, 'Maintenance Resolved', `Issue for ${resource.name} resolved.`, 'maintenance_resolved', '/maintenance');} if (data.assignedTechnicianId && data.assignedTechnicianId !== editingMaintenanceRequest.assignedTechnicianId && data.assignedTechnicianId !== '--unassigned--') { await addNotification( data.assignedTechnicianId, 'Maintenance Task Assigned', `Task for ${resource.name}: ${data.issueDescription.substring(0,50)}...`, 'maintenance_assigned', '/maintenance');} } else { const newRequestPayload = { ...requestDataToSave, reportedByUserId: currentUser.id, dateReported: serverTimestamp(), }; const docRef = await addDoc(collection(db, "maintenanceRequests"), newRequestPayload); await addAuditLog(currentUser.id, currentUser.name, 'MAINTENANCE_CREATED', { entityType: 'MaintenanceRequest', entityId: docRef.id, details: `New request for '${resource.name}' by ${currentUser.name}.`}); toast({ title: 'Request Logged'}); const techIdForNotification = requestDataToSave.assignedTechnicianId; if(techIdForNotification && techIdForNotification !== '--unassigned--'){ await addNotification( techIdForNotification, 'New Maintenance Request Assigned', `New request for ${resource.name}: ${data.issueDescription.substring(0, 50)}... assigned.`, 'maintenance_assigned', '/maintenance');} else { const usersToNotifyQuery = query(collection(db, 'users'), where('role', 'in', ['Admin', 'Technician']), orderBy('name', 'asc')); const usersToNotifySnapshot = await getDocs(usersToNotifyQuery); const notificationPromises = usersToNotifySnapshot.docs.map(userDoc => { if(userDoc.id !== currentUser?.id) { return addNotification( userDoc.id, 'New Unassigned Maintenance Request', `New request for ${resource.name}: ${data.issueDescription.substring(0, 50)}... needs attention.`, 'maintenance_new', '/maintenance');} return Promise.resolve(); }); await Promise.all(notificationPromises);}} setIsMaintenanceFormDialogOpen(false); setEditingMaintenanceRequest(null); await fetchAllAdminData(); } catch (error: any) { toast({ title: `${editingMaintenanceRequest ? "Update" : "Logging"} Failed`, variant: "destructive" });} finally { setIsLoadingData(false); }
  }, [currentUser, editingMaintenanceRequest, allResourcesForCountsAndChecks, fetchAllAdminData, toast]);
  const activeMaintenanceFilterCount = useMemo(() => [activeMaintenanceSearchTerm !== '', activeMaintenanceFilterStatus !== 'all', activeMaintenanceFilterResourceId !== 'all', activeMaintenanceFilterTechnicianId !== 'all', activeMaintenanceFilterLabId !== 'all'].filter(Boolean).length, [activeMaintenanceSearchTerm, activeMaintenanceFilterStatus, activeMaintenanceFilterResourceId, activeMaintenanceFilterTechnicianId, activeMaintenanceFilterLabId]);
  const canEditAnyMaintenanceRequest = useMemo(() => currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Technician'), [currentUser]);

  // Lab Access Requests Logic (Contextual)
  useEffect(() => { if (isLabAccessFilterDialogOpen) { /* Removed tempLabAccessFilterLabId logic */ }}, [isLabAccessFilterDialogOpen]);
  const filteredLabAccessRequests = useMemo(() => {
    if (activeLabContextId === GLOBAL_CONTEXT_VALUE) return []; // No requests for global view
    return labAccessRequests.filter(req => req.labId === activeLabContextId);
  }, [labAccessRequests, activeLabContextId]);
  // Removed handleApplyLabAccessDialogFilters, resetLabAccessDialogFiltersOnly, resetAllActiveLabAccessPageFilters as lab filtering is now via context
  // const activeLabAccessFilterCount = useMemo(() => [activeLabAccessFilterLabId !== 'all'].filter(Boolean).length, [activeLabAccessFilterLabId]); // This is no longer needed
  const activeLabAccessFilterCount = 0; // Placeholder if needed elsewhere, effectively 0 for this tab now.


  if (!currentUser || !canManageAny) {
    return ( <div className="space-y-8"><PageHeader title="Lab Operations Center" icon={Cog} description="Access Denied." /><Card className="text-center py-10 text-muted-foreground"><CardContent><p>You do not have permission.</p></CardContent></Card></div>);
  }

  const currentLabContextName = activeLabContextId === GLOBAL_CONTEXT_VALUE ? "Global Settings / All Labs Overview" : (labs.find(l => l.id === activeLabContextId)?.name || "Unknown Lab");

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PageHeader title="Lab Operations Center" description="Manage labs, resource types, closures, maintenance, and lab access requests." icon={Cog} />
        <Tabs defaultValue="manage-labs" onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-1 md:grid-cols-3">
            <TabsTrigger value="manage-labs"><Settings className="mr-2 h-4 w-4"/>Manage Labs, Closures & Access</TabsTrigger>
            <TabsTrigger value="resource-types"><ListChecks className="mr-2 h-4 w-4"/>Resource Types</TabsTrigger>
            <TabsTrigger value="maintenance"><Wrench className="mr-2 h-4 w-4"/>Maintenance</TabsTrigger>
          </TabsList>

          <TabsContent value="manage-labs" className="mt-6 space-y-6">
            <div className="flex items-center gap-4 p-4 border rounded-md bg-muted/50">
                <Label htmlFor="labContextSelect" className="text-sm font-medium whitespace-nowrap">Selected Lab Context:</Label>
                <Select value={activeLabContextId} onValueChange={setActiveLabContextId}>
                    <SelectTrigger id="labContextSelect" className="w-full sm:w-auto min-w-[280px] h-9">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={GLOBAL_CONTEXT_VALUE}><Globe className="inline-block mr-2 h-4 w-4"/>Global Settings / All Labs Overview</SelectItem>
                        {labs.map(lab => (<SelectItem key={lab.id} value={lab.id}><Building className="inline-block mr-2 h-4 w-4"/>{lab.name}</SelectItem>))}
                    </SelectContent>
                </Select>
            </div>
            
            <Card><CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"><div><CardTitle className="text-xl">All Labs</CardTitle><p className="text-sm text-muted-foreground mt-1">Define and manage all laboratory locations.</p></div><div className="flex gap-2 flex-wrap"><FilterSortDialog open={isLabFilterDialogOpen} onOpenChange={setIsLabFilterDialogOpen}><FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter & Sort Labs</Button></FilterSortDialogTrigger><FilterSortDialogContent className="sm:max-w-md"><FilterSortDialogHeader><FilterSortDialogTitle>Filter & Sort Labs</FilterSortDialogTitle></FilterSortDialogHeader><Separator className="my-3" /><div className="space-y-3"><div className="relative"><Label htmlFor="labSearchDialog">Search (Name/Loc/Desc)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="labSearchDialog" value={tempLabSearchTerm} onChange={e => setTempLabSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/></div><div><Label htmlFor="labSortDialog">Sort by</Label><Select value={tempLabSortBy} onValueChange={setTempLabSortBy}><SelectTrigger id="labSortDialog" className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{labSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div></div><FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetLabDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button variant="outline" onClick={() => setIsLabFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button><Button onClick={handleApplyLabDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter></FilterSortDialogContent></FilterSortDialog>{canManageAny && <Button onClick={handleOpenNewLabDialog} size="sm"><PackagePlus className="mr-2 h-4 w-4"/>Add Lab</Button>}</div></CardHeader><CardContent className="p-0">{isLoadingData && filteredLabs.length === 0 && !activeLabSearchTerm ? ( <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>) : filteredLabs.length > 0 ? (<div className="overflow-x-auto rounded-md border shadow-sm"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead>Description</TableHead>{canManageAny && <TableHead className="text-right w-[100px]">Actions</TableHead>}</TableRow></TableHeader><TableBody>{filteredLabs.map(lab => (<TableRow key={lab.id}><TableCell className="font-medium">{lab.name}</TableCell><TableCell>{lab.location || 'N/A'}</TableCell><TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={lab.description || undefined}>{lab.description || 'N/A'}</TableCell>{canManageAny && <TableCell className="text-right space-x-1"><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditLabDialog(lab)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Lab</TooltipContent></Tooltip><AlertDialog open={labToDelete?.id === lab.id} onOpenChange={(isOpen) => !isOpen && setLabToDelete(null)}><Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setLabToDelete(lab)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Lab</TooltipContent></Tooltip><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{labToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Ensure no resources are assigned.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => labToDelete && handleDeleteLab(labToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell>}</TableRow>))}</TableBody></Table></div>) : ( <div className="text-center py-10 text-muted-foreground"><Building className="h-12 w-12 mx-auto mb-3 opacity-50"/><p className="font-medium">{activeLabFilterCount > 0 ? "No labs match criteria." : "No labs defined."}</p>{activeLabFilterCount > 0 && <Button variant="link" onClick={resetAllActiveLabPageFilters} className="mt-2 text-xs"><FilterX className="mr-1.5 h-3.5 w-3.5"/>Reset Filters</Button>}</div>)}</CardContent></Card>

            <Card><CardHeader className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2"><div><CardTitle>Specific Blackout Dates ({filteredBlackoutDates.length})</CardTitle><p className="text-sm text-muted-foreground mt-1">Manage individual lab closure dates for: <span className="font-semibold">{currentLabContextName}</span>.</p></div><div className="flex gap-2 flex-wrap"><FilterSortDialog open={isClosureFilterDialogOpen} onOpenChange={setIsClosureFilterDialogOpen}><FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter Closures{activeClosureFilterCount > 0 && (<Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeClosureFilterCount}</Badge>)}</Button></FilterSortDialogTrigger><FilterSortDialogContent className="w-full max-w-md"><FilterSortDialogHeader><FilterSortDialogTitle>Filter Closures by Keyword</FilterSortDialogTitle><FilterSortDialogDescription>Filter by reason or date for the current lab context.</FilterSortDialogDescription></FilterSortDialogHeader><Separator className="my-3" /><div className="space-y-3"><div className="relative"><Label htmlFor="closureSearchDialog">Search (Reason/Date/Rule Name)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="closureSearchDialog" value={tempClosureSearchTerm} onChange={(e) => setTempClosureSearchTerm(e.target.value)} placeholder="e.g., Holiday, May 20..." className="mt-1 h-9 pl-8"/></div></div><FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetClosureDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset Keyword</Button><Button variant="outline" onClick={() => setIsClosureFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button><Button onClick={handleApplyClosureDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter></FilterSortDialogContent></FilterSortDialog>{canManageAny && <Button onClick={handleOpenNewDateDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Blackout Date</Button>}</div></CardHeader><CardContent className="p-0">{isLoadingData && filteredBlackoutDates.length === 0 && !activeClosureSearchTerm ? ( <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2"/>Fetching dates...</div>) : filteredBlackoutDates.length > 0 ? (<div className="overflow-x-auto border rounded-md"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reason</TableHead>{canManageAny && <TableHead className="text-right w-[100px]">Actions</TableHead>}</TableRow></TableHeader><TableBody>{filteredBlackoutDates.map((bd) => (<TableRow key={bd.id}><TableCell className="font-medium">{isValidDateFn(parseISO(bd.date)) ? format(parseISO(bd.date), 'PPP') : 'Invalid Date'}</TableCell><TableCell className="text-sm text-muted-foreground">{bd.reason || 'N/A'}</TableCell>{canManageAny && (<TableCell className="text-right space-x-1"><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditDateDialog(bd)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit</TooltipContent></Tooltip><AlertDialog open={dateToDelete?.id === bd.id} onOpenChange={(isOpen) => !isOpen && setDateToDelete(null)}><Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setDateToDelete(bd)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete</TooltipContent></Tooltip><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{dateToDelete && isValidDateFn(parseISO(dateToDelete.date)) ? format(parseISO(dateToDelete.date), 'PPP') : ''}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => dateToDelete && handleDeleteBlackoutDate(dateToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell>)}</TableRow>))}</TableBody></Table></div>) : (<div className="text-center py-10 text-muted-foreground"><CalendarOff className="h-10 w-10 mx-auto mb-3 opacity-50"/><p className="font-medium">{activeClosureFilterCount > 0 || activeClosureSearchTerm ? "No dates match filter for current context." : `No specific blackout dates for ${currentLabContextName}.`}</p>{(activeClosureFilterCount > 0 || activeClosureSearchTerm) ? (<Button variant="outline" size="sm" onClick={resetAllActiveClosurePageFilters}><FilterX className="mr-2 h-4 w-4"/>Reset Keyword Filter</Button>) : (!isLoadingData && filteredBlackoutDates.length === 0 && canManageAny && (<Button onClick={handleOpenNewDateDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add First Blackout Date</Button>))}</div>)}</CardContent></Card>
            
            <Card><CardHeader className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-2"><div><CardTitle>Recurring Lab Closures ({filteredRecurringRules.length})</CardTitle><p className="text-sm text-muted-foreground mt-1">Manage weekly unavailability for: <span className="font-semibold">{currentLabContextName}</span>.</p></div>{canManageAny && <Button onClick={handleOpenNewRecurringDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Recurring Rule</Button>}</CardHeader><CardContent className="p-0">{isLoadingData && filteredRecurringRules.length === 0 && !activeClosureSearchTerm ? ( <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2"/>Fetching rules...</div>) : filteredRecurringRules.length > 0 ? (<div className="overflow-x-auto border rounded-md"><Table><TableHeader><TableRow><TableHead>Rule Name</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead>{canManageAny && <TableHead className="text-right w-[100px]">Actions</TableHead>}</TableRow></TableHeader><TableBody>{filteredRecurringRules.map((rule) => (<TableRow key={rule.id}><TableCell className="font-medium">{rule.name}</TableCell><TableCell className="text-sm text-muted-foreground">{rule.daysOfWeek.join(', ')}</TableCell><TableCell className="text-sm text-muted-foreground">{rule.reason || 'N/A'}</TableCell>{canManageAny && (<TableCell className="text-right space-x-1"><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditRecurringDialog(rule)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Rule</TooltipContent></Tooltip><AlertDialog open={ruleToDelete?.id === rule.id} onOpenChange={(isOpen) => !isOpen && setRuleToDelete(null)}><Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:text-destructive-foreground hover:bg-destructive h-8 w-8" onClick={() => setRuleToDelete(rule)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Rule</TooltipContent></Tooltip><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{ruleToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => ruleToDelete && handleDeleteRecurringRule(ruleToDelete.id)}>Delete Rule</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell>)}</TableRow>))}</TableBody></Table></div>) : (<div className="text-center py-10 text-muted-foreground"><Repeat className="h-10 w-10 mx-auto mb-3 opacity-50"/><p className="font-medium">{activeClosureFilterCount > 0 || activeClosureSearchTerm ? "No rules match filter for current context." : `No recurring closure rules for ${currentLabContextName}.`}</p>{(activeClosureFilterCount > 0 || activeClosureSearchTerm) ? (<Button variant="outline" size="sm" onClick={resetAllActiveClosurePageFilters}><FilterX className="mr-2 h-4 w-4"/>Reset Keyword Filter</Button>) :(!isLoadingData && filteredRecurringRules.length === 0 && canManageAny && (<Button onClick={handleOpenNewRecurringDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add First Recurring Rule</Button>))}</div>)}</CardContent></Card>
          
            {activeLabContextId !== GLOBAL_CONTEXT_VALUE && (
                <Card>
                  <CardHeader>
                    <CardTitle>Lab Access Requests for {currentLabContextName} ({filteredLabAccessRequests.length})</CardTitle>
                    <CardDescription>Review and manage pending requests for this lab.</CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLabAccessRequestLoading && filteredLabAccessRequests.length === 0 ? (
                      <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
                    ) : filteredLabAccessRequests.length > 0 ? (
                      <div className="overflow-x-auto border rounded-md shadow-sm">
                        <Table>
                          <TableHeader><TableRow><TableHead>User</TableHead><TableHead>Date Requested</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                          <TableBody>
                            {filteredLabAccessRequests.map(req => (
                              <TableRow key={req.id}>
                                <TableCell><div className="flex items-center gap-2"><Avatar className="h-8 w-8"><AvatarImage src={req.userAvatarUrl} alt={req.userName} data-ai-hint="user avatar" /><AvatarFallback>{(req.userName || 'U').charAt(0)}</AvatarFallback></Avatar><div><div className="font-medium">{req.userName}</div><div className="text-xs text-muted-foreground">{req.userEmail}</div></div></div></TableCell>
                                <TableCell>{req.requestedAt ? formatDateSafe(req.requestedAt, 'N/A', 'PPP p') : 'N/A'}</TableCell>
                                <TableCell className="text-right space-x-1">
                                   <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleLabAccessRequestAction(req.id!, req.userId, req.userName!, req.labId, req.labName!, 'approve_request')} disabled={isProcessingLabAccessRequest[req.id!]?.loading}>{isProcessingLabAccessRequest[req.id!]?.loading && isProcessingLabAccessRequest[req.id!]?.action === 'approve_request' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsUp className="h-4 w-4 text-green-600" />}<span className="sr-only">Approve</span></Button></TooltipTrigger><TooltipContent>Approve Request</TooltipContent></Tooltip>
                                   <Tooltip><TooltipTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleLabAccessRequestAction(req.id!, req.userId, req.userName!, req.labId, req.labName!, 'reject_request')} disabled={isProcessingLabAccessRequest[req.id!]?.loading}>{isProcessingLabAccessRequest[req.id!]?.loading && isProcessingLabAccessRequest[req.id!]?.action === 'reject_request' ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsDown className="h-4 w-4" />}<span className="sr-only">Reject</span></Button></TooltipTrigger><TooltipContent>Reject Request</TooltipContent></Tooltip>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    ) : (
                      <div className="text-center py-10 text-muted-foreground">
                        <Users className="h-12 w-12 mx-auto mb-3 opacity-50"/>
                        <p className="font-medium">No pending lab access requests for {currentLabContextName}.</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
            )}
             {activeLabContextId === GLOBAL_CONTEXT_VALUE && (
                 <Card className="text-center py-10 text-muted-foreground border-dashed">
                    <CardContent>
                        <Building className="h-10 w-10 mx-auto mb-3 opacity-50"/>
                        <p className="font-medium">Select a Specific Lab</p>
                        <p className="text-sm">To view and manage lab access requests, please select a specific lab from the dropdown above.</p>
                    </CardContent>
                </Card>
            )}
          </TabsContent>
          
          <TabsContent value="resource-types" className="mt-6"><Card><CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"><div><CardTitle className="text-xl">Resource Types</CardTitle><p className="text-sm text-muted-foreground mt-1">Define categories for lab resources.</p></div><div className="flex gap-2 flex-wrap"><FilterSortDialog open={isResourceTypeFilterDialogOpen} onOpenChange={setIsResourceTypeFilterDialogOpen}><FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter & Sort</Button></FilterSortDialogTrigger><FilterSortDialogContent className="sm:max-w-md"><FilterSortDialogHeader><FilterSortDialogTitle>Filter & Sort Resource Types</FilterSortDialogTitle></FilterSortDialogHeader><Separator className="my-3" /><div className="space-y-3"><div className="relative"><Label htmlFor="typeSearchDialog">Search (Name/Desc)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="typeSearchDialog" value={tempResourceTypeSearchTerm} onChange={e => setTempResourceTypeSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/></div><div><Label htmlFor="typeSortDialog">Sort by</Label><Select value={tempResourceTypeSortBy} onValueChange={setTempResourceTypeSortBy}><SelectTrigger id="typeSortDialog" className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{resourceTypeSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div></div><FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetResourceTypeDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button variant="outline" onClick={() => setIsResourceTypeFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button><Button onClick={handleApplyResourceTypeDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter></FilterSortDialogContent></FilterSortDialog>{canManageAny && <Button onClick={handleOpenNewResourceTypeDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Type</Button>}</div></CardHeader><CardContent className="p-0">{isLoadingData && filteredResourceTypesWithCount.length === 0 && !activeResourceTypeSearchTerm ? ( <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>) : filteredResourceTypesWithCount.length > 0 ? (<div className="overflow-x-auto border rounded-md shadow-sm"><Table><TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-center"># Resources</TableHead>{canManageAny && <TableHead className="text-right w-[100px]">Actions</TableHead>}</TableRow></TableHeader><TableBody>{filteredResourceTypesWithCount.map(type => (<TableRow key={type.id}><TableCell className="font-medium">{type.name}</TableCell><TableCell className="text-sm text-muted-foreground max-w-md truncate" title={type.description || undefined}>{type.description || 'N/A'}</TableCell><TableCell className="text-center">{type.resourceCount}</TableCell>{canManageAny && <TableCell className="text-right space-x-1"><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditResourceTypeDialog(type)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Type</TooltipContent></Tooltip><AlertDialog open={typeToDelete?.id === type.id} onOpenChange={(isOpen) => !isOpen && setTypeToDelete(null)}><Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setTypeToDelete(type)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Type</TooltipContent></Tooltip><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{typeToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Ensure no resources use this type.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => typeToDelete && handleDeleteResourceType(typeToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></TableCell>}</TableRow>))}</TableBody></Table></div>) : ( <div className="text-center py-10 text-muted-foreground"><ListChecks className="h-12 w-12 mx-auto mb-3 opacity-50"/><p className="font-medium">{activeResourceTypeFilterCount > 0 ? "No types match criteria." : "No resource types defined."}</p>{activeResourceTypeFilterCount > 0 && <Button variant="link" onClick={resetAllActiveResourceTypePageFilters} className="mt-2 text-xs"><FilterX className="mr-1.5 h-3.5 w-3.5"/>Reset Filters</Button>}</div>)}</CardContent></Card></TabsContent>
          
          <TabsContent value="maintenance" className="mt-6"><Card><CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2"><div><CardTitle>Maintenance Log</CardTitle><p className="text-sm text-muted-foreground mt-1">Admin view of all maintenance requests.</p></div><div className="flex gap-2 flex-wrap"><FilterSortDialog open={isMaintenanceFilterDialogOpen} onOpenChange={setIsMaintenanceFilterDialogOpen}><FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><ListFilter className="mr-2 h-4 w-4" />Filters {activeMaintenanceFilterCount > 0 && (<Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeMaintenanceFilterCount}</Badge>)}</Button></FilterSortDialogTrigger><FilterSortDialogContent className="w-full max-w-lg"><FilterSortDialogHeader><FilterSortDialogTitle>Filter Maintenance Requests</FilterSortDialogTitle></FilterSortDialogHeader><Separator className="my-3" /><div className="space-y-3"><div className="relative"><Label htmlFor="maintenanceSearchDialog">Search (Resource/Reporter/Issue/Tech)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="maintenanceSearchDialog" value={tempMaintenanceSearchTerm} onChange={e => setTempMaintenanceSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><Label htmlFor="maintenanceStatusDialog">Status</Label><Select value={tempMaintenanceFilterStatus} onValueChange={(v) => setTempMaintenanceFilterStatus(v as MaintenanceRequestStatus | 'all')}><SelectTrigger id="maintenanceStatusDialog" className="h-9 mt-1"><SelectValue placeholder="Filter by Status" /></SelectTrigger><SelectContent><SelectItem value="all">All Statuses</SelectItem>{maintenanceRequestStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="maintenanceResourceDialog">Resource</Label><Select value={tempMaintenanceFilterResourceId} onValueChange={setTempMaintenanceFilterResourceId} disabled={allResourcesForCountsAndChecks.length === 0}><SelectTrigger id="maintenanceResourceDialog" className="h-9 mt-1"><SelectValue placeholder={allResourcesForCountsAndChecks.length > 0 ? "Filter by Resource" : "No resources"} /></SelectTrigger><SelectContent><SelectItem value="all">All Resources</SelectItem>{allResourcesForCountsAndChecks.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent></Select></div></div><div className="grid grid-cols-1 sm:grid-cols-2 gap-4"><div><Label htmlFor="maintenanceTechnicianDialog">Assigned Technician</Label><Select value={tempMaintenanceFilterTechnicianId} onValueChange={setTempMaintenanceFilterTechnicianId} disabled={allTechniciansForMaintenance.length === 0}><SelectTrigger id="maintenanceTechnicianDialog" className="h-9 mt-1"><SelectValue placeholder={allTechniciansForMaintenance.length > 0 ? "Filter by Technician" : "No technicians"} /></SelectTrigger><SelectContent><SelectItem value="all">All/Any</SelectItem><SelectItem value="--unassigned--">Unassigned</SelectItem>{allTechniciansForMaintenance.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select></div><div><Label htmlFor="maintenanceLabFilterDialog">Lab (of Resource)</Label><Select value={tempMaintenanceFilterLabId} onValueChange={setTempMaintenanceFilterLabId} disabled={labs.length === 0}><SelectTrigger id="maintenanceLabFilterDialog" className="mt-1 h-9"><SelectValue placeholder="Filter by Lab"/></SelectTrigger><SelectContent><SelectItem value="all">All Labs</SelectItem>{labs.map(lab => (<SelectItem key={lab.id} value={lab.id}>{lab.name}</SelectItem>))}</SelectContent></Select></div></div></div><FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetMaintenanceDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button variant="outline" onClick={() => setIsMaintenanceFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button><Button onClick={handleApplyMaintenanceDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter></FilterSortDialogContent></FilterSortDialog>{canManageAny && <Button onClick={handleOpenNewMaintenanceDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Log Request</Button>}</div></CardHeader><CardContent className="p-0">{isLoadingData && filteredMaintenanceRequests.length === 0 ? ( <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2"/>Fetching requests...</div>) : filteredMaintenanceRequests.length > 0 ? (<div className="overflow-x-auto border rounded-md"><Table><TableHeader><TableRow><TableHead>Resource</TableHead><TableHead className="min-w-[200px]">Issue</TableHead><TableHead>Reported By</TableHead><TableHead>Date Reported</TableHead><TableHead>Status</TableHead><TableHead>Assigned To</TableHead>{canEditAnyMaintenanceRequest && <TableHead className="text-right w-[100px]">Actions</TableHead>}</TableRow></TableHeader><TableBody>{filteredMaintenanceRequests.map((request) => { const reporter = allUsersForMaintenance.find(u => u.id === request.reportedByUserId); const technician = allUsersForMaintenance.find(u => u.id === request.assignedTechnicianId); const resource = allResourcesForCountsAndChecks.find(r => r.id === request.resourceId); return (<TableRow key={request.id}><TableCell className="font-medium">{resource?.name || 'Unknown Resource'}</TableCell><TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={request.issueDescription}>{request.issueDescription}</TableCell><TableCell>{reporter?.name || 'Unknown User'}</TableCell><TableCell>{formatDateSafe(request.dateReported, 'N/A', 'MMM dd, yyyy')}</TableCell><TableCell>{getMaintenanceStatusBadge(request.status)}</TableCell><TableCell>{technician?.name || <span className="text-xs italic text-muted-foreground">Unassigned</span>}</TableCell>{canEditAnyMaintenanceRequest && (<TableCell className="text-right space-x-1"><Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditMaintenanceDialog(request)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Request</TooltipContent></Tooltip></TableCell>)}</TableRow>);})}</TableBody></Table></div>) : (<div className="text-center py-10 text-muted-foreground"><Wrench className="h-12 w-12 mx-auto mb-3 opacity-50"/><p className="font-medium">{activeMaintenanceFilterCount > 0 ? "No requests match filters." : "No maintenance requests."}</p>{activeMaintenanceFilterCount > 0 ? (<Button variant="outline" size="sm" onClick={resetAllActiveMaintenancePageFilters}><FilterX className="mr-2 h-4 w-4"/>Reset Filters</Button>) : (canManageAny && (<Button onClick={handleOpenNewMaintenanceDialog} size="sm" className="mt-2"><PlusCircle className="mr-2 h-4 w-4"/>Log First Request</Button>))}</div>)}</CardContent></Card></TabsContent>
          
        </Tabs>
      </div>

      {isResourceTypeFormDialogOpen && currentUser && (<ResourceTypeFormDialog open={isResourceTypeFormDialogOpen} onOpenChange={(isOpen) => { setIsResourceTypeFormDialogOpen(isOpen); if (!isOpen) setEditingType(null); }} initialType={editingType} onSave={handleSaveResourceType} />)}
      {isLabFormDialogOpen && currentUser && (<LabFormDialog open={isLabFormDialogOpen} onOpenChange={(isOpen) => { setIsLabFormDialogOpen(isOpen); if (!isOpen) setEditingLab(null); }} initialLab={editingLab} onSave={handleSaveLab} />)}
      {isDateFormDialogOpen && currentUser && (<BlackoutDateFormDialog open={isDateFormDialogOpen} onOpenChange={setIsDateFormDialogOpen} initialBlackoutDate={editingBlackoutDate} onSave={handleSaveBlackoutDate} labs={labs} currentLabContextId={activeLabContextId} />)}
      {isRecurringFormDialogOpen && currentUser && (<RecurringBlackoutRuleFormDialog open={isRecurringFormDialogOpen} onOpenChange={setIsRecurringFormDialogOpen} initialRule={editingRecurringRule} onSave={handleSaveRecurringRule} labs={labs} currentLabContextId={activeLabContextId} />)}
      {isMaintenanceFormDialogOpen && currentUser && (<MaintenanceRequestFormDialog open={isMaintenanceFormDialogOpen} onOpenChange={(isOpen) => { setIsMaintenanceFormDialogOpen(isOpen); if (!isOpen) setEditingMaintenanceRequest(null);}} initialRequest={editingMaintenanceRequest} onSave={handleSaveMaintenanceRequest} technicians={allTechniciansForMaintenance} resources={allResourcesForCountsAndChecks} currentUserRole={currentUser?.role}/> )}
    </TooltipProvider>
  );
}
