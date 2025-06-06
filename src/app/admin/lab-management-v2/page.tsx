
'use client';

// All original imports are kept, but most will be unused temporarily.
import { useState, useMemo, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation'; // Added
import { PageHeader } from '@/components/layout/page-header';
import { Cog, ListChecks, PackagePlus, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon, Loader2, X, CheckCircle2, Building, PlusCircle, CalendarOff, Repeat, Wrench, PenToolIcon, AlertCircle, CheckCircle as LucideCheckCircle, Globe, Users, ThumbsUp, ThumbsDown, Settings, SlidersHorizontal, ArrowLeft, Settings2, ShieldCheck, ShieldOff, CalendarDays, Info as InfoIcon, Package as PackageIcon, Users2, UserCog, CalendarCheck, BarChartHorizontalBig, UsersRound, ActivitySquare, UserPlus2, Briefcase, MapPin, Tag, FileText, CalendarClock, User as UserIconLucide, AlertTriangle, BarChart3, ClipboardList, PieChart as PieChartIconComp, Percent, Hourglass, Clock } from 'lucide-react';
import type { ResourceType, Resource, Lab, BlackoutDate, RecurringBlackoutRule, MaintenanceRequest, MaintenanceRequestStatus, User, LabMembership, LabMembershipStatus, DayOfWeek, Booking } from '@/types';
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
import { db, auth } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp, writeBatch, where, limit } from 'firebase/firestore';
import { addNotification, addAuditLog, manageLabMembership_SA } from '@/lib/firestore-helpers';
import { daysOfWeekArray, maintenanceRequestStatuses } from '@/lib/app-constants';
import { format, parseISO, isValid as isValidDateFn, isBefore, compareAsc, subDays, startOfHour, differenceInHours } from 'date-fns';
import { cn, formatDateSafe, getResourceStatusBadge as getResourceUIAvailabilityBadge } from '@/lib/utils';
import Link from 'next/link';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  PieChart as RechartsPieChart, // Aliased to avoid conflict with lucide icon
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';


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

const labSortOptions: { value: string; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' }, { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'location-asc', label: 'Location (A-Z)' }, { value: 'location-desc', label: 'Location (Z-A)' },
  { value: 'resourceCount-asc', label: 'Resources (Low-High)' }, { value: 'resourceCount-desc', label: 'Resources (High-Low)' },
  { value: 'memberCount-asc', label: 'Members (Low-High)' }, { value: 'memberCount-desc', label: 'Members (High-Low)' },
];

interface ReportItem {
  name: string;
  count: number;
  fill?: string;
}

interface UtilizationItem {
  name: string;
  utilization: number;
}

interface PeakHourItem {
  hour: string;
  count: number;
}

interface LabUserUsageReportItem {
  userId: string;
  userName: string;
  avatarUrl?: string;
  totalBookingsInLab: number;
  totalHoursBookedInLab: number;
}

const CHART_COLORS = {
  bookings: "hsl(var(--chart-1))",
  maintenance: {
    Open: "hsl(var(--destructive))", // Use destructive for Open
    "In Progress": "hsl(var(--chart-3))", // Keep chart-3 for In Progress (often yellow/orange)
    Resolved: "hsl(var(--chart-4))", // Keep chart-4 for Resolved (often blue)
    Closed: "hsl(var(--chart-2))", // Use chart-2 for Closed (often green)
  },
  utilization: "hsl(var(--chart-2))",
  peakHours: "hsl(var(--chart-3))",
  waitlist: "hsl(var(--chart-4))",
  userUsage: "hsl(var(--chart-5))",
};

const chartTooltipConfig = {
  cursor: false,
  content: <ChartTooltipContent indicator="dot" hideLabel />,
};
const chartLegendConfig = {
 content: <ChartLegendContent nameKey="name" className="text-xs mt-2" />,
};


const getMaintenanceStatusBadge = (status: MaintenanceRequestStatus) => {
  switch (status) {
    case 'Open': return <Badge variant="destructive" className="bg-red-500 text-white border-transparent"><AlertCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'In Progress': return <Badge variant="secondary" className="bg-yellow-500 text-yellow-950 border-transparent"><PenToolIcon className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Resolved': return <Badge className="bg-blue-500 text-white border-transparent"><LucideCheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Closed': return <Badge className="bg-green-500 text-white border-transparent"><LucideCheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

const getLabMembershipStatusBadgeClasses = (status: LabMembershipStatus): string => {
    switch (status) {
      case 'active': return 'bg-green-500 text-white hover:bg-green-600 border-transparent';
      case 'pending_approval': return 'bg-yellow-500 text-yellow-950 hover:bg-yellow-600 border-transparent';
      case 'rejected':
      case 'revoked':
        return 'bg-red-500 text-white hover:bg-red-600 border-transparent';
      default: return 'bg-gray-500 text-white hover:bg-gray-600 border-transparent';
    }
};


export default function LabOperationsCenterPage() {
    const { toast } = useToast();
    const { currentUser, isLoading: authIsLoading } = useAuth();
    const searchParamsObj = useSearchParams();

    const [isLoadingData, setIsLoadingData] = useState(true);
    const [activeContextId, setActiveContextId] = useState<string>(GLOBAL_CONTEXT_VALUE);
    
    const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]); // Still needed for ResourceFormDialog if triggered from here
    const [allResourcesForCountsAndChecks, setAllResourcesForCountsAndChecks] = useState<Resource[]>([]);

    const [labs, setLabs] = useState<Lab[]>([]);
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

    const [isLabSpecificMaintenanceFilterDialogOpen, setIsLabSpecificMaintenanceFilterDialogOpen] = useState(false);
    const [tempLabSpecificMaintenanceSearchTerm, setTempLabSpecificMaintenanceSearchTerm] = useState('');
    const [activeLabSpecificMaintenanceSearchTerm, setActiveLabSpecificMaintenanceSearchTerm] = useState('');
    const [tempLabSpecificMaintenanceStatusFilter, setTempLabSpecificMaintenanceStatusFilter] = useState<MaintenanceRequestStatus | 'all'>('all');
    const [activeLabSpecificMaintenanceStatusFilter, setActiveLabSpecificMaintenanceStatusFilter] = useState<MaintenanceRequestStatus | 'all'>('all');
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

    const fetchAllAdminData = useCallback(async () => {
      if (!canManageAny) {
        setIsLoadingData(false);
        setIsLabAccessRequestLoading(false);
        return;
      }
      setIsLoadingData(true);
      setIsLabAccessRequestLoading(true);
      try {
        const [labsSnapshot, typesSnapshot, resourcesSnapshot, usersSnapshot, techniciansSnapshot, maintenanceSnapshot, boSnapshot, rrSnapshot, membershipsSnapshot, bookingsSnapshot] = await Promise.all([
          getDocs(query(collection(db, "labs"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "resourceTypes"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "resources"))),
          getDocs(query(collection(db, "users"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "users"), where("role", "==", "Technician"), orderBy("name", "asc"))),
          getDocs(query(collection(db, "maintenanceRequests"), orderBy("dateReported", "desc"))),
          getDocs(query(collection(db, "blackoutDates"), orderBy("date", "asc"))),
          getDocs(query(collection(db, "recurringBlackoutRules"), orderBy("name", "asc"))),
          getDocs(query(collection(db, 'labMemberships'), orderBy('requestedAt', 'asc'))), 
          getDocs(query(collection(db, "bookings"), orderBy("startTime", "asc"))),
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
        
        const bookingsWithDetailsPromises = bookingsSnapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            const resource = fetchedResourcesAll.find(r => r.id === data.resourceId);
            const user = fetchedUsersAll.find(u => u.id === data.userId);
            return {
              id: docSnap.id,
              ...data,
              startTime: (data.startTime as Timestamp).toDate(),
              endTime: (data.endTime as Timestamp).toDate(),
              createdAt: (data.createdAt as Timestamp)?.toDate(),
              resourceName: resource?.name || 'Unknown Resource',
              userName: user?.name || 'Unknown User',
            } as Booking & { resourceName?: string, userName?: string };
          });
        setAllBookingsState(await Promise.all(bookingsWithDetailsPromises));


      } catch (error: any) {
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
            const dateString = typeof bd.date === 'string' ? bd.date : (bd.date as unknown as Timestamp)?.toDate()?.toISOString().split('T')[0];
            const dateMatch = dateString && isValidDateFn(parseISO(dateString)) && format(parseISO(dateString), 'PPP').toLowerCase().includes(lowerSearchTerm);
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
        const formattedDateOnly = format(data.date, 'yyyy-MM-dd');
        const displayDate = format(data.date, 'PPP');
        const blackoutDataToSave: Omit<BlackoutDate, 'id'> = {
            labId: activeContextId, 
            date: formattedDateOnly,
            reason: data.reason || undefined,
        };
        setIsLoadingData(true);
        try {
            if (editingLabSpecificBlackoutDate) {
                await updateDoc(doc(db, "blackoutDates", editingLabSpecificBlackoutDate.id), blackoutDataToSave as any);
                addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_UPDATED', { entityType: 'BlackoutDate', entityId: editingLabSpecificBlackoutDate.id, details: `Lab-specific Blackout Date for ${displayDate} (Lab ID: ${activeContextId}) updated. Reason: ${data.reason || 'N/A'}`});
                toast({ title: 'Lab Blackout Date Updated'});
            } else {
                const docRef = await addDoc(collection(db, "blackoutDates"), blackoutDataToSave);
                addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_CREATED', { entityType: 'BlackoutDate', entityId: docRef.id, details: `Lab-specific Blackout Date for ${displayDate} (Lab ID: ${activeContextId}) created. Reason: ${data.reason || 'N/A'}`});
                toast({ title: 'Lab Blackout Date Added'});
            }
            setIsLabSpecificDateFormDialogOpen(false);
            setEditingLabSpecificBlackoutDate(null);
            await fetchAllAdminData();
        } catch (error: any) { toast({ title: "Save Failed", description: `Failed to save lab-specific blackout date: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, editingLabSpecificBlackoutDate, activeContextId, fetchAllAdminData, toast]);

    const handleDeleteLabSpecificBlackoutDate = useCallback(async (blackoutDateId: string) => {
        if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; }
        const deletedDateObj = allBlackoutDates.find(bd => bd.id === blackoutDateId);
        if (!deletedDateObj) return;
        const dateString = typeof deletedDateObj.date === 'string' ? deletedDateObj.date : (deletedDateObj.date as unknown as Timestamp)?.toDate()?.toISOString().split('T')[0];
        setIsLoadingData(true);
        try {
            await deleteDoc(doc(db, "blackoutDates", blackoutDateId));
            addAuditLog(currentUser.id, currentUser.name, 'BLACKOUT_DATE_DELETED', { entityType: 'BlackoutDate', entityId: blackoutDateId, details: `Lab-specific Blackout Date for ${dateString ? format(parseISO(dateString), 'PPP') : 'Invalid Date'} (Lab ID: ${deletedDateObj.labId}, Reason: ${deletedDateObj.reason || 'N/A'}) deleted.`});
            toast({ title: "Lab Blackout Date Removed", variant: "destructive" });
            setLabSpecificDateToDelete(null);
            await fetchAllAdminData();
        } catch (error: any) { toast({ title: "Delete Failed", description: `Failed to delete lab-specific blackout date: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, allBlackoutDates, fetchAllAdminData, toast]);

    const handleOpenNewLabSpecificRecurringDialog = useCallback(() => { setEditingLabSpecificRecurringRule(null); setIsLabSpecificRecurringFormDialogOpen(true); }, []);
    const handleOpenEditLabSpecificRecurringDialog = useCallback((rule: RecurringBlackoutRule) => { setEditingLabSpecificRecurringRule(rule); setIsLabSpecificRecurringFormDialogOpen(true); }, []);

    const handleSaveLabSpecificRecurringRule = useCallback(async (data: RecurringRuleDialogFormValues) => {
        if (!currentUser || !currentUser.id || !currentUser.name || activeContextId === GLOBAL_CONTEXT_VALUE) { toast({ title: "Error", description: "Cannot save lab-specific rule without lab context or auth.", variant: "destructive" }); return; }
        const ruleDataToSave: Omit<RecurringBlackoutRule, 'id'> = {
            labId: activeContextId, 
            name: data.name,
            daysOfWeek: data.daysOfWeek,
            reason: data.reason || undefined,
        };
        setIsLoadingData(true);
        try {
            if (editingLabSpecificRecurringRule) {
                await updateDoc(doc(db, "recurringBlackoutRules", editingLabSpecificRecurringRule.id), ruleDataToSave as any);
                addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_UPDATED', { entityType: 'RecurringBlackoutRule', entityId: editingLabSpecificRecurringRule.id, details: `Lab-specific recurring rule '${data.name}' (Lab ID: ${activeContextId}) updated.`});
                toast({ title: 'Lab Recurring Rule Updated'});
            } else {
                const docRef = await addDoc(collection(db, "recurringBlackoutRules"), ruleDataToSave);
                addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_CREATED', { entityType: 'RecurringBlackoutRule', entityId: docRef.id, details: `Lab-specific recurring rule '${data.name}' (Lab ID: ${activeContextId}) created.`});
                toast({ title: 'Lab Recurring Rule Added'});
            }
            setIsLabSpecificRecurringFormDialogOpen(false);
            setEditingLabSpecificRecurringRule(null);
            await fetchAllAdminData();
        } catch (error: any) { toast({ title: "Save Failed", description: `Failed to save lab-specific recurring rule: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, editingLabSpecificRecurringRule, activeContextId, fetchAllAdminData, toast]);

    const handleDeleteLabSpecificRecurringRule = useCallback(async (ruleId: string) => {
        if(!currentUser || !currentUser.id || !currentUser.name) { toast({ title: "Auth Error", variant: "destructive" }); return; }
        const deletedRuleObj = allRecurringRules.find(r => r.id === ruleId);
        if (!deletedRuleObj) return;
        setIsLoadingData(true);
        try {
            await deleteDoc(doc(db, "recurringBlackoutRules", ruleId));
            addAuditLog(currentUser.id, currentUser.name, 'RECURRING_RULE_DELETED', { entityType: 'RecurringBlackoutRule', entityId: ruleId, details: `Lab-specific recurring rule '${deletedRuleObj.name}' (Lab ID: ${deletedRuleObj.labId}) deleted.`});
            toast({ title: "Lab Recurring Rule Removed", variant: "destructive" });
            setLabSpecificRuleToDelete(null);
            await fetchAllAdminData();
        } catch (error: any) { toast({ title: "Delete Failed", description: `Failed to delete lab-specific recurring rule: ${error.message}`, variant: "destructive"});
        } finally { setIsLoadingData(false); }
    }, [currentUser, allRecurringRules, fetchAllAdminData, toast]);

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
            fetchAllAdminData(); 
          } else {
            toast({ title: "Action Failed", description: result.message, variant: "destructive" });
          }
        } catch (error: any) {
          toast({ title: "Error", description: `Failed to process request: ${error.message}`, variant: "destructive" });
        } finally {
          setIsProcessingLabAccessAction(prev => ({ ...prev, [actionKey]: false }));
        }
    }, [currentUser, fetchAllAdminData, toast]);

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


    // Lab Specific Reports Data
    const labSpecificResources = useMemo(() => {
        if (!selectedLabDetails) return [];
        return allResourcesForCountsAndChecks.filter(res => res.labId === selectedLabDetails.id);
    }, [selectedLabDetails, allResourcesForCountsAndChecks]);

    const labSpecificBookings = useMemo(() => {
        if (!selectedLabDetails) return [];
        const labResourceIds = labSpecificResources.map(r => r.id);
        return allBookingsState.filter(b => labResourceIds.includes(b.resourceId));
    }, [selectedLabDetails, labSpecificResources, allBookingsState]);
    
    const labSpecificMaintenanceRequests = useMemo(() => {
        if (!selectedLabDetails) return [];
        const labResourceIds = labSpecificResources.map(r => r.id);
        return maintenanceRequests.filter(req => labResourceIds.includes(req.resourceId));
    }, [selectedLabDetails, labSpecificResources, maintenanceRequests]);


    // Chart Data Calculations (Lab Specific)
    const bookingsPerLabResource: ReportItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData) return [];
        const report: ReportItem[] = [];
        labSpecificResources.forEach(resource => {
            const count = labSpecificBookings.filter(b => b.resourceId === resource.id && b.status !== 'Cancelled').length;
            if (count > 0) report.push({ name: resource.name, count });
        });
        return report.sort((a, b) => b.count - a.count).slice(0, 7);
    }, [selectedLabDetails, labSpecificResources, labSpecificBookings, isLoadingData]);

    const bookingsLabChartConfig = useMemo(() => {
      const config: ChartConfig = {};
      bookingsPerLabResource.forEach(item => { config[item.name] = { label: item.name, color: CHART_COLORS.bookings }; });
      config["count"] = { label: "Bookings", color: CHART_COLORS.bookings };
      return config;
    }, [bookingsPerLabResource]);

    const maintenanceByStatusForLab: ReportItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData) return [];
        const report: ReportItem[] = [];
        maintenanceRequestStatuses.forEach(status => {
            const count = labSpecificMaintenanceRequests.filter(req => req.status === status).length;
            if (count > 0) report.push({ name: status, count, fill: CHART_COLORS.maintenance[status] });
        });
        return report;
    }, [selectedLabDetails, labSpecificMaintenanceRequests, isLoadingData]);

    const maintenanceLabChartConfig = useMemo(() => {
      const config: ChartConfig = {};
      maintenanceByStatusForLab.forEach(item => { config[item.name] = { label: item.name, color: item.fill! }; });
      return config;
    }, [maintenanceByStatusForLab]);

    const labResourceUtilization: UtilizationItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData) return [];
        const report: UtilizationItem[] = [];
        const today = new Date();
        const thirtyDaysAgo = subDays(today, 30);
        labSpecificResources.forEach(resource => {
            const bookedDays = new Set<string>();
            labSpecificBookings.forEach(booking => {
                if (!booking.startTime || !isValidDateFn(booking.startTime)) return;
                const bookingDate = booking.startTime;
                if (booking.resourceId === resource.id && booking.status === 'Confirmed') {
                    if (bookingDate >= thirtyDaysAgo && bookingDate <= today) bookedDays.add(format(bookingDate, 'yyyy-MM-dd'));
                }
            });
            const utilizationPercentage = (bookedDays.size / 30) * 100;
            if (utilizationPercentage > 0) report.push({ name: resource.name, utilization: Math.round(utilizationPercentage) });
        });
        return report.sort((a, b) => b.utilization - a.utilization).slice(0, 7);
    }, [selectedLabDetails, labSpecificResources, labSpecificBookings, isLoadingData]);

    const utilizationLabChartConfig = useMemo(() => {
      const config: ChartConfig = {};
      labResourceUtilization.forEach(item => { config[item.name] = { label: item.name, color: CHART_COLORS.utilization }; });
      config["utilization"] = { label: "Utilization %", color: CHART_COLORS.utilization };
      return config;
    }, [labResourceUtilization]);

    const peakBookingHoursForLab: PeakHourItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData) return [];
        const hourCounts: { [hour: string]: number } = {};
        labSpecificBookings.forEach(booking => {
            if (!booking.startTime || !isValidDateFn(booking.startTime)) return;
            if (booking.status === 'Confirmed') {
                const hour = format(startOfHour(booking.startTime), 'HH:00');
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            }
        });
        return Object.entries(hourCounts)
            .map(([hour, count]) => ({ hour, count }))
            .sort((a, b) => parseInt(a.hour.split(':')[0]) - parseInt(b.hour.split(':')[0]));
    }, [selectedLabDetails, labSpecificBookings, isLoadingData]);
    
    const peakHoursLabChartConfig = useMemo(() => {
     const config: ChartConfig = {};
     peakBookingHoursForLab.forEach(item => { config[item.hour] = { label: item.hour, color: CHART_COLORS.peakHours }; });
     config["count"] = { label: "Bookings", color: CHART_COLORS.peakHours };
     return config;
    }, [peakBookingHoursForLab]);

    const waitlistedPerLabResource: ReportItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData) return [];
        const report: ReportItem[] = [];
        labSpecificResources.forEach(resource => {
            if (resource.allowQueueing) {
                const count = labSpecificBookings.filter(b => b.resourceId === resource.id && b.status === 'Waitlisted').length;
                if (count > 0) report.push({ name: resource.name, count });
            }
        });
        return report.sort((a, b) => b.count - a.count).slice(0, 7);
    }, [selectedLabDetails, labSpecificResources, labSpecificBookings, isLoadingData]);

    const waitlistLabChartConfig = useMemo(() => {
      const config: ChartConfig = {};
      waitlistedPerLabResource.forEach(item => { config[item.name] = { label: item.name, color: CHART_COLORS.waitlist }; });
      config["count"] = { label: "Waitlisted", color: CHART_COLORS.waitlist };
      return config;
    }, [waitlistedPerLabResource]);

    const labUserActivityReport: LabUserUsageReportItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData || allUsersData.length === 0) return [];
        const usageMap = new Map<string, LabUserUsageReportItem>();
        labSpecificBookings.forEach(booking => {
            if (booking.status === 'Cancelled') return;
            let userReport = usageMap.get(booking.userId);
            if (!userReport) {
                const userDetails = allUsersData.find(u => u.id === booking.userId);
                userReport = {
                    userId: booking.userId,
                    userName: userDetails?.name || 'Unknown User',
                    avatarUrl: userDetails?.avatarUrl,
                    totalBookingsInLab: 0,
                    totalHoursBookedInLab: 0,
                };
            }
            userReport.totalBookingsInLab += 1;
            if (booking.status === 'Confirmed' && booking.startTime && booking.endTime && isValidDateFn(booking.startTime) && isValidDateFn(booking.endTime)) {
                userReport.totalHoursBookedInLab += differenceInHours(booking.endTime, booking.startTime);
            }
            usageMap.set(booking.userId, userReport);
        });
        return Array.from(usageMap.values())
            .filter(item => item.totalBookingsInLab > 0)
            .sort((a, b) => b.totalBookingsInLab - a.totalBookingsInLab)
            .slice(0, 7);
    }, [selectedLabDetails, labSpecificBookings, allUsersData, isLoadingData]);


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
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
              <TabsTrigger value="labs">Manage Labs</TabsTrigger>
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
                      <FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter {activeLabFilterCount > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeLabFilterCount}</Badge>}</Button></FilterSortDialogTrigger>
                      <FilterSortDialogContent className="sm:max-w-md">
                        <FilterSortDialogHeader><FilterSortDialogTitle>Filter & Sort Labs</FilterSortDialogTitle></FilterSortDialogHeader>
                        <Separator className="my-3" />
                        <div className="space-y-3">
                          <div className="relative"><Label htmlFor="labSearchDialog">Search (Name/Loc/Desc)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="labSearchDialog" value={tempLabSearchTerm} onChange={e => setTempLabSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/></div>
                          <div><Label htmlFor="labSortDialog">Sort by</Label><Select value={tempLabSortBy} onValueChange={setTempLabSortBy}><SelectTrigger id="labSortDialog" className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{labSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetLabDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><AlertDialogCancel>Cancel</AlertDialogCancel><Button onClick={handleApplyLabDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter>
                      </FilterSortDialogContent>
                    </FilterSortDialog>
                    {canManageAny && <Button onClick={handleOpenNewLabDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Lab</Button>}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingData && filteredLabs.length === 0 && !activeLabSearchTerm ? ( <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
                  ) : filteredLabs.length > 0 ? (
                    <div className="overflow-x-auto rounded-b-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead><div className="flex items-center gap-1"><Building className="h-4 w-4 text-muted-foreground"/>Name</div></TableHead>
                            <TableHead><div className="flex items-center gap-1"><MapPin className="h-4 w-4 text-muted-foreground"/>Location</div></TableHead>
                            <TableHead className="text-center"><div className="flex items-center justify-center gap-1"><PackageIcon className="h-4 w-4 text-muted-foreground"/>Resources</div></TableHead>
                            <TableHead className="text-center"><div className="flex items-center justify-center gap-1"><UsersRound className="h-4 w-4 text-muted-foreground"/>Members</div></TableHead>
                            {canManageAny && <TableHead className="text-right w-[100px]">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
                        <TableBody>{filteredLabs.map(lab => (
                          <TableRow key={lab.id}>
                            <TableCell className="font-medium">{lab.name}</TableCell>
                            <TableCell>{lab.location || 'N/A'}</TableCell>
                            <TableCell className="text-center">{(lab as any).resourceCount ?? 0}</TableCell>
                            <TableCell className="text-center">{(lab as any).memberCount ?? 0}</TableCell>
                            {canManageAny && <TableCell className="text-right space-x-1">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setActiveContextId(lab.id)}>
                                      <Settings2 className="h-4 w-4"/>
                                      <span className="sr-only">Manage Lab</span>
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Manage Lab</p></TooltipContent>
                                </Tooltip>
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
            
            <TabsContent value="global-closures" className="mt-6">
              <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div><CardTitle className="text-xl">Global Lab Closures</CardTitle><p className="text-sm text-muted-foreground mt-1">Manage blackout dates and recurring rules that apply system-wide (to all labs).</p></div>
                     <FilterSortDialog open={isGlobalClosureFilterDialogOpen} onOpenChange={setIsGlobalClosureFilterDialogOpen}>
                      <FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter {activeGlobalClosureFilterCount > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeGlobalClosureFilterCount}</Badge>}</Button></FilterSortDialogTrigger>
                      <FilterSortDialogContent className="sm:max-w-md">
                        <FilterSortDialogHeader><FilterSortDialogTitle>Filter Global Closures</FilterSortDialogTitle></FilterSortDialogHeader>
                        <Separator className="my-3" />
                        <div className="space-y-3">
                          <div className="relative"><Label htmlFor="globalClosureSearchDialog">Search (Reason/Name/Date)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="globalClosureSearchDialog" value={tempGlobalClosureSearchTerm} onChange={e => setTempGlobalClosureSearchTerm(e.target.value)} placeholder="e.g., Holiday, Weekend, Jan 1" className="mt-1 h-9 pl-8"/></div>
                        </div>
                        <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetGlobalClosureDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><AlertDialogCancel>Cancel</AlertDialogCancel><Button onClick={handleApplyGlobalClosureDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter>
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
                        <div className="overflow-x-auto rounded-b-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead><div className="flex items-center gap-1"><CalendarDays className="h-4 w-4 text-muted-foreground"/>Date</div></TableHead>
                                <TableHead><div className="flex items-center gap-1"><FileText className="h-4 w-4 text-muted-foreground"/>Reason</div></TableHead>
                                <TableHead className="text-right w-[100px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
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
                        <div className="overflow-x-auto rounded-b-md border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead><div className="flex items-center gap-1"><Tag className="h-4 w-4 text-muted-foreground"/>Rule Name</div></TableHead>
                                <TableHead><div className="flex items-center gap-1"><Repeat className="h-4 w-4 text-muted-foreground"/>Days</div></TableHead>
                                <TableHead><div className="flex items-center gap-1"><FileText className="h-4 w-4 text-muted-foreground"/>Reason</div></TableHead>
                                <TableHead className="text-right w-[100px]">Actions</TableHead>
                              </TableRow>
                            </TableHeader>
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
                          <FilterIcon className="mr-2 h-4 w-4" />Filter 
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
                          <AlertDialogCancel>Cancel</AlertDialogCancel><Button onClick={handleApplyMaintenanceDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button>
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
                    <div className="overflow-x-auto rounded-b-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead><div className="flex items-center gap-1"><PackageIcon className="h-4 w-4 text-muted-foreground"/>Resource</div></TableHead>
                            <TableHead className="min-w-[200px]"><div className="flex items-center gap-1"><AlertTriangle className="h-4 w-4 text-muted-foreground"/>Issue</div></TableHead>
                            <TableHead><div className="flex items-center gap-1"><UserIconLucide className="h-4 w-4 text-muted-foreground"/>Reported By</div></TableHead>
                            <TableHead><div className="flex items-center gap-1"><CalendarClock className="h-4 w-4 text-muted-foreground"/>Date Reported</div></TableHead>
                            <TableHead><div className="flex items-center gap-1"><InfoIcon className="h-4 w-4 text-muted-foreground"/>Status</div></TableHead>
                            <TableHead><div className="flex items-center gap-1"><UserCog className="h-4 w-4 text-muted-foreground"/>Assigned To</div></TableHead>
                            {canEditAnyMaintenanceRequest && <TableHead className="text-right w-[100px]">Actions</TableHead>}
                          </TableRow>
                        </TableHeader>
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

            <TabsContent value="lab-access-requests" className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-xl"><div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-muted-foreground"/>System-Wide Lab Access Requests</div></CardTitle>
                  <CardDescription>Review and manage pending requests for lab access from all users for all labs.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  {isLabAccessRequestLoading ? (
                    <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
                  ) : allLabAccessRequests.length > 0 ? (
                    <div className="overflow-x-auto rounded-b-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead><div className="flex items-center gap-1"><UserIconLucide className="h-4 w-4 text-muted-foreground"/>User</div></TableHead>
                            <TableHead><div className="flex items-center gap-1"><Building className="h-4 w-4 text-muted-foreground"/>Lab Requested</div></TableHead>
                            <TableHead><div className="flex items-center gap-1"><CalendarClock className="h-4 w-4 text-muted-foreground"/>Date Requested</div></TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allLabAccessRequests.map(req => (
                            <TableRow key={req.id}>
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <Avatar className="h-8 w-8">
                                    <AvatarImage src={req.userAvatarUrl} alt={req.userName} data-ai-hint="user avatar"/>
                                    <AvatarFallback>{(req.userName || 'U').charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <div className="font-medium">{req.userName}</div>
                                    <div className="text-xs text-muted-foreground">{req.userEmail}</div>
                                  </div>
                                </div>
                              </TableCell>
                              <TableCell>{req.labName}</TableCell>
                              <TableCell>{req.requestedAt ? formatDateSafe(req.requestedAt, 'N/A', 'PPP p') : 'N/A'}</TableCell>
                              <TableCell className="text-right space-x-1">
                                 <Tooltip>
                                  <TooltipTrigger asChild>
                                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(req.userId, req.userName!, req.labId, req.labName!, 'approve_request', req.id)} disabled={isProcessingLabAccessAction[req.id!]}>
                                          {isProcessingLabAccessAction[req.id!] ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsUp className="h-4 w-4 text-green-600" />}
                                          <span className="sr-only">Approve Request</span>
                                      </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Approve Request</p></TooltipContent>
                                 </Tooltip>
                                 <Tooltip>
                                  <TooltipTrigger asChild>
                                      <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(req.userId, req.userName!, req.labId, req.labName!, 'reject_request', req.id)} disabled={isProcessingLabAccessAction[req.id!]}>
                                           {isProcessingLabAccessAction[req.id!] ? <Loader2 className="h-4 w-4 animate-spin"/> : <ThumbsDown className="h-4 w-4" />}
                                          <span className="sr-only">Reject Request</span>
                                      </Button>
                                  </TooltipTrigger>
                                  <TooltipContent><p>Reject Request</p></TooltipContent>
                                 </Tooltip>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-3 opacity-50"/>
                      <p className="font-medium">No pending lab access requests system-wide.</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}

        {!isLoadingData && activeContextId !== GLOBAL_CONTEXT_VALUE && selectedLabDetails && (
           <Tabs defaultValue={searchParamsObj.get('tab') || "lab-details"} className="w-full">
              <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
                  <TabsTrigger value="lab-details">Lab Overview & Reports</TabsTrigger>
                  <TabsTrigger value="lab-closures">Closures</TabsTrigger>
                  <TabsTrigger value="lab-maintenance">Maintenance</TabsTrigger>
                  <TabsTrigger value="lab-members">Members & Access</TabsTrigger>
              </TabsList>

              <TabsContent value="lab-details" className="mt-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-1 space-y-6">
                    <Card className="shadow-lg">
                        <CardHeader className="flex flex-row items-start justify-between gap-2">
                            <div>
                                <CardTitle className="text-2xl">{selectedLabDetails.name}</CardTitle>
                                {selectedLabDetails.location && <CardDescription>{selectedLabDetails.location}</CardDescription>}
                            </div>
                            <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleOpenEditSelectedLabDialog}><Edit className="h-4 w-4"/></Button>
                        </CardHeader>
                        <CardContent>
                            <p className="text-sm text-muted-foreground">{selectedLabDetails.description || 'No description provided.'}</p>
                        </CardContent>
                    </Card>
                    <Card className="shadow-lg">
                        <CardHeader><CardTitle className="text-xl flex items-center gap-2"><BarChartHorizontalBig className="h-5 w-5 text-primary"/>Key Statistics</CardTitle></CardHeader>
                        <CardContent className="space-y-3">
                            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                                <div className="flex items-center gap-2"><PackageIcon className="h-5 w-5 text-muted-foreground"/> <span className="font-medium">Resources</span></div>
                                <Badge variant="secondary" className="text-lg">{labSpecificStats.resourceCount}</Badge>
                            </div>
                             <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                                <div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-muted-foreground"/> <span className="font-medium">Active Members</span></div>
                                <Badge variant="secondary" className="text-lg">{labSpecificStats.activeMemberCount}</Badge>
                            </div>
                             <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                                <div className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-muted-foreground"/> <span className="font-medium">Open Maintenance</span></div>
                                <Badge variant="secondary" className="text-lg">{labSpecificStats.openMaintenanceCount}</Badge>
                            </div>
                        </CardContent>
                    </Card>
                  </div>
                  <div className="lg:col-span-2 space-y-6">
                    {/* Lab Specific Reports Section */}
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="text-xl flex items-center gap-2">
                                <BarChart3 className="h-5 w-5 text-primary"/>
                                Lab Performance Dashboard: {selectedLabDetails.name}
                            </CardTitle>
                            <CardDescription>Key performance indicators for this lab.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-8">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader><CardTitle className="text-base flex items-center gap-1"><ClipboardList className="h-4 w-4"/>Bookings per Resource</CardTitle></CardHeader>
                                    <CardContent>
                                        {bookingsPerLabResource.length > 0 ? (
                                            <ChartContainer config={bookingsLabChartConfig} className="min-h-[250px] w-full">
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <BarChart data={bookingsPerLabResource} margin={{ top: 5, right: 5, left: -25, bottom: 40 }}>
                                                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                                                        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-30} textAnchor="end" interval={0} height={50} className="text-xs"/>
                                                        <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                                                        <ChartTooltip {...chartTooltipConfig} />
                                                        <Bar dataKey="count" fill="var(--color-count)" radius={3} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </ChartContainer>
                                        ) : <p className="text-muted-foreground text-center text-sm py-8">No booking data.</p>}
                                    </CardContent>
                                </Card>
                                 <Card>
                                    <CardHeader><CardTitle className="text-base flex items-center gap-1"><AlertTriangle className="h-4 w-4"/>Maintenance Status</CardTitle></CardHeader>
                                    <CardContent className="flex justify-center">
                                        {maintenanceByStatusForLab.length > 0 ? (
                                            <ChartContainer config={maintenanceLabChartConfig} className="min-h-[250px] max-w-[280px] w-full aspect-square">
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <RechartsPieChart>
                                                        <ChartTooltip {...chartTooltipConfig} />
                                                        <Pie data={maintenanceByStatusForLab} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                                                          {maintenanceByStatusForLab.map((entry) => (<Cell key={`cell-${entry.name}`} fill={entry.fill} className="stroke-background focus:outline-none"/> ))}
                                                        </Pie>
                                                        <ChartLegend {...chartLegendConfig} />
                                                    </RechartsPieChart>
                                                </ResponsiveContainer>
                                            </ChartContainer>
                                        ) : <p className="text-muted-foreground text-center text-sm py-8">No maintenance data.</p>}
                                    </CardContent>
                                </Card>
                            </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader><CardTitle className="text-base flex items-center gap-1"><Percent className="h-4 w-4"/>Resource Utilization (30d)</CardTitle></CardHeader>
                                    <CardContent>
                                        {labResourceUtilization.length > 0 ? (
                                            <ChartContainer config={utilizationLabChartConfig} className="min-h-[250px] w-full">
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <BarChart data={labResourceUtilization} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                                                        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                                        <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} unit="%" domain={[0,100]} />
                                                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} className="text-xs truncate"/>
                                                        <ChartTooltip content={<ChartTooltipContent formatter={(value, name, props) => `${props.payload.name}: ${value}%`} indicator="dot" />} />
                                                        <Bar dataKey="utilization" fill="var(--color-utilization)" radius={3} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </ChartContainer>
                                        ) : <p className="text-muted-foreground text-center text-sm py-8">No utilization data.</p>}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader><CardTitle className="text-base flex items-center gap-1"><Clock className="h-4 w-4"/>Peak Booking Hours</CardTitle></CardHeader>
                                    <CardContent>
                                        {peakBookingHoursForLab.length > 0 ? (
                                            <ChartContainer config={peakHoursLabChartConfig} className="min-h-[250px] w-full">
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <LineChart data={peakBookingHoursForLab} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                                                        <CartesianGrid strokeDasharray="3 3" />
                                                        <XAxis dataKey="hour" tickLine={false} axisLine={true} tickMargin={8} className="text-xs"/>
                                                        <YAxis tickLine={false} axisLine={true} tickMargin={8} allowDecimals={false}/>
                                                        <ChartTooltip {...chartTooltipConfig} />
                                                        <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={{r:3, fill: "var(--color-count)"}} activeDot={{r:5}} />
                                                    </LineChart>
                                                </ResponsiveContainer>
                                            </ChartContainer>
                                        ) : <p className="text-muted-foreground text-center text-sm py-8">No peak hours data.</p>}
                                    </CardContent>
                                </Card>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <Card>
                                    <CardHeader><CardTitle className="text-base flex items-center gap-1"><Hourglass className="h-4 w-4"/>Current Waitlist Size</CardTitle></CardHeader>
                                    <CardContent>
                                        {waitlistedPerLabResource.length > 0 ? (
                                            <ChartContainer config={waitlistLabChartConfig} className="min-h-[250px] w-full">
                                                <ResponsiveContainer width="100%" height={Math.max(150, waitlistedPerLabResource.length * 40)}>
                                                    <BarChart data={waitlistedPerLabResource} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                                                        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                                        <XAxis type="number" allowDecimals={false} />
                                                        <YAxis dataKey="name" type="category" width={100} className="text-xs truncate"/>
                                                        <ChartTooltip {...chartTooltipConfig} />
                                                        <Bar dataKey="count" fill="var(--color-count)" radius={3} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            </ChartContainer>
                                        ) : <p className="text-muted-foreground text-center text-sm py-8">No waitlisted items.</p>}
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardHeader><CardTitle className="text-base flex items-center gap-1"><Users2 className="h-4 w-4"/>Top User Activity</CardTitle></CardHeader>
                                    <CardContent className="p-0">
                                        {labUserActivityReport.length > 0 ? (
                                            <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader><TableRow><TableHead>User</TableHead><TableHead className="text-center">Bookings</TableHead><TableHead className="text-right">Hours</TableHead></TableRow></TableHeader>
                                                <TableBody>
                                                {labUserActivityReport.map(item => (
                                                    <TableRow key={item.userId}>
                                                    <TableCell><div className="flex items-center gap-2"><Avatar className="h-7 w-7 text-xs"><AvatarImage src={item.avatarUrl} alt={item.userName}/><AvatarFallback>{item.userName.charAt(0)}</AvatarFallback></Avatar>{item.userName}</div></TableCell>
                                                    <TableCell className="text-center">{item.totalBookingsInLab}</TableCell>
                                                    <TableCell className="text-right">{item.totalHoursBookedInLab.toFixed(1)}</TableCell>
                                                    </TableRow>
                                                ))}
                                                </TableBody>
                                            </Table>
                                            </div>
                                        ) : <p className="text-muted-foreground text-center text-sm py-8 px-3">No user activity data for this lab.</p>}
                                    </CardContent>
                                </Card>
                            </div>
                        </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="lab-closures" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                        <CardTitle>{selectedLabDetails.name} - Closures</CardTitle>
                        <CardDescription>Manage specific and recurring unavailability for this lab.</CardDescription>
                    </div>
                    <FilterSortDialog open={isLabSpecificClosureFilterDialogOpen} onOpenChange={setIsLabSpecificClosureFilterDialogOpen}>
                        <FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter {activeLabSpecificClosureFilterCount > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeLabSpecificClosureFilterCount}</Badge>}</Button></FilterSortDialogTrigger>
                        <FilterSortDialogContent className="sm:max-w-md">
                            <FilterSortDialogHeader><FilterSortDialogTitle>Filter Closures for {selectedLabDetails.name}</FilterSortDialogTitle></FilterSortDialogHeader>
                            <Separator className="my-3" />
                            <div className="space-y-3">
                            <div className="relative"><Label htmlFor="labSpecificClosureSearchDialog">Search (Reason/Name/Date)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="labSpecificClosureSearchDialog" value={tempLabSpecificClosureSearchTerm} onChange={e => setTempLabSpecificClosureSearchTerm(e.target.value)} placeholder="e.g., Holiday, Weekend, Jan 1" className="mt-1 h-9 pl-8"/></div>
                            </div>
                            <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetLabSpecificClosureDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><AlertDialogCancel>Cancel</AlertDialogCancel><Button onClick={handleApplyLabSpecificClosureDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter>
                        </FilterSortDialogContent>
                    </FilterSortDialog>
                  </CardHeader>
                  <CardContent>
                    <Tabs value={activeLabClosuresTab} onValueChange={setActiveLabClosuresTab} className="w-full">
                      <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="specific-dates-lab"><CalendarDays className="mr-2 h-4 w-4"/>Specific Dates</TabsTrigger>
                        <TabsTrigger value="recurring-rules-lab"><Repeat className="mr-2 h-4 w-4"/>Recurring Rules</TabsTrigger>
                      </TabsList>
                      <TabsContent value="specific-dates-lab">
                        <div className="flex justify-end mb-3">
                          <Button onClick={handleOpenNewLabSpecificDateDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Date for {selectedLabDetails.name}</Button>
                        </div>
                        {isLoadingData && filteredLabSpecificBlackoutDates.length === 0 && !activeLabSpecificClosureSearchTerm ? ( <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/></div>
                        ) : filteredLabSpecificBlackoutDates.length > 0 ? (
                          <div className="overflow-x-auto border rounded-b-md">
                            <Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Reason</TableHead><TableHead className="text-right w-[100px]">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>{filteredLabSpecificBlackoutDates.map(bd => (
                              <TableRow key={bd.id}><TableCell className="font-medium">{formatDateSafe(parseISO(bd.date), 'Invalid Date', 'PPP')}</TableCell><TableCell className="text-sm text-muted-foreground">{bd.reason || 'N/A'}</TableCell>
                              <TableCell className="text-right space-x-1">
                                <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditLabSpecificDateDialog(bd)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Date</TooltipContent></Tooltip>
                                <AlertDialog open={labSpecificDateToDelete?.id === bd.id} onOpenChange={(isOpen) => !isOpen && setLabSpecificDateToDelete(null)}>
                                  <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setLabSpecificDateToDelete(bd)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Date</TooltipContent></Tooltip>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Delete Blackout on {formatDateSafe(labSpecificDateToDelete ? parseISO(labSpecificDateToDelete.date) : new Date(), '', 'PPP')} for {selectedLabDetails.name}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => labSpecificDateToDelete && handleDeleteLabSpecificBlackoutDate(labSpecificDateToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell></TableRow>
                            ))}</TableBody></Table>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground"><CalendarOff className="h-10 w-10 mx-auto mb-2 opacity-50"/><p className="font-medium">{activeLabSpecificClosureSearchTerm ? "No dates match filter." : `No specific blackout dates for ${selectedLabDetails.name}.`}</p></div>
                        )}
                      </TabsContent>
                      <TabsContent value="recurring-rules-lab">
                         <div className="flex justify-end mb-3">
                          <Button onClick={handleOpenNewLabSpecificRecurringDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Rule for {selectedLabDetails.name}</Button>
                        </div>
                        {isLoadingData && filteredLabSpecificRecurringRules.length === 0 && !activeLabSpecificClosureSearchTerm ? ( <div className="text-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto"/></div>
                        ) : filteredLabSpecificRecurringRules.length > 0 ? (
                          <div className="overflow-x-auto border rounded-b-md">
                            <Table><TableHeader><TableRow><TableHead>Rule Name</TableHead><TableHead>Days</TableHead><TableHead>Reason</TableHead><TableHead className="text-right w-[100px]">Actions</TableHead></TableRow></TableHeader>
                            <TableBody>{filteredLabSpecificRecurringRules.map(rule => (
                              <TableRow key={rule.id}><TableCell className="font-medium">{rule.name}</TableCell><TableCell className="text-sm text-muted-foreground">{rule.daysOfWeek.join(', ')}</TableCell><TableCell className="text-sm text-muted-foreground">{rule.reason || 'N/A'}</TableCell>
                              <TableCell className="text-right space-x-1">
                                <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditLabSpecificRecurringDialog(rule)} disabled={isLoadingData}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Rule</TooltipContent></Tooltip>
                                <AlertDialog open={labSpecificRuleToDelete?.id === rule.id} onOpenChange={(isOpen) => !isOpen && setLabSpecificRuleToDelete(null)}>
                                  <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setLabSpecificRuleToDelete(rule)} disabled={isLoadingData}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Rule</TooltipContent></Tooltip>
                                  <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Delete Rule "{labSpecificRuleToDelete?.name}" for {selectedLabDetails.name}?</AlertDialogTitle><AlertDialogDescription>This cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => labSpecificRuleToDelete && handleDeleteLabSpecificRecurringRule(labSpecificRuleToDelete.id)}>Delete Rule</AlertDialogAction></AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </TableCell></TableRow>
                            ))}</TableBody></Table>
                          </div>
                        ) : (
                          <div className="text-center py-8 text-muted-foreground"><Repeat className="h-10 w-10 mx-auto mb-2 opacity-50"/><p className="font-medium">{activeLabSpecificClosureSearchTerm ? "No rules match filter." : `No recurring closure rules for ${selectedLabDetails.name}.`}</p></div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="lab-maintenance" className="mt-6">
                <Card>
                  <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div>
                      <CardTitle>{selectedLabDetails.name} - Maintenance Log</CardTitle>
                      <CardDescription>View and manage maintenance requests for resources in this lab.</CardDescription>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                        <FilterSortDialog open={isLabSpecificMaintenanceFilterDialogOpen} onOpenChange={setIsLabSpecificMaintenanceFilterDialogOpen}>
                          <FilterSortDialogTrigger asChild>
                            <Button variant="outline" size="sm">
                              <FilterIcon className="mr-2 h-4 w-4" />Filter
                              {activeLabSpecificMaintenanceFilterCount > 0 && <Badge variant="secondary" className="ml-1 rounded-full px-1.5 text-xs">{activeLabSpecificMaintenanceFilterCount}</Badge>}
                            </Button>
                          </FilterSortDialogTrigger>
                          <FilterSortDialogContent className="w-full max-w-lg">
                            <FilterSortDialogHeader><FilterSortDialogTitle>Filter Maintenance for {selectedLabDetails.name}</FilterSortDialogTitle></FilterSortDialogHeader>
                            <Separator className="my-3" />
                            <div className="space-y-3">
                              <div className="relative">
                                <Label htmlFor="labMaintenanceSearchDialog">Search (Resource/Reporter/Issue/Tech)</Label>
                                <SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" />
                                <Input id="labMaintenanceSearchDialog" value={tempLabSpecificMaintenanceSearchTerm} onChange={e => setTempLabSpecificMaintenanceSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                  <Label htmlFor="labMaintenanceStatusDialog">Status</Label>
                                  <Select value={tempLabSpecificMaintenanceStatusFilter} onValueChange={(v) => setTempLabSpecificMaintenanceStatusFilter(v as MaintenanceRequestStatus | 'all')}>
                                    <SelectTrigger id="labMaintenanceStatusDialog" className="h-9 mt-1"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Statuses</SelectItem>{maintenanceRequestStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="labMaintenanceResourceDialog">Resource (in this lab)</Label>
                                  <Select value={tempLabSpecificMaintenanceResourceIdFilter} onValueChange={setTempLabSpecificMaintenanceResourceIdFilter} disabled={resourcesForLabSpecificMaintenanceFilter.length === 0}>
                                    <SelectTrigger id="labMaintenanceResourceDialog" className="h-9 mt-1"><SelectValue placeholder={resourcesForLabSpecificMaintenanceFilter.length > 0 ? "Filter by Resource" : "No resources in lab"} /></SelectTrigger>
                                    <SelectContent><SelectItem value="all">All Resources in {selectedLabDetails.name}</SelectItem>{resourcesForLabSpecificMaintenanceFilter.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div>
                                <Label htmlFor="labMaintenanceTechnicianDialog">Assigned Technician</Label>
                                <Select value={tempLabSpecificMaintenanceTechnicianIdFilter} onValueChange={setTempLabSpecificMaintenanceTechnicianIdFilter} disabled={allTechniciansForMaintenance.length === 0}>
                                  <SelectTrigger id="labMaintenanceTechnicianDialog" className="h-9 mt-1"><SelectValue placeholder={allTechniciansForMaintenance.length > 0 ? "Filter by Technician" : "No technicians"} /></SelectTrigger>
                                  <SelectContent><SelectItem value="all">All/Any</SelectItem><SelectItem value="--unassigned--">Unassigned</SelectItem>{allTechniciansForMaintenance.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
                                </Select>
                              </div>
                            </div>
                            <FilterSortDialogFooter className="mt-4 pt-4 border-t">
                              <Button variant="ghost" onClick={resetLabSpecificMaintenanceDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button>
                              <AlertDialogCancel>Cancel</AlertDialogCancel><Button onClick={handleApplyLabSpecificMaintenanceDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button>
                            </FilterSortDialogFooter>
                          </FilterSortDialogContent>
                        </FilterSortDialog>
                        {canManageAny && <Button onClick={handleOpenNewMaintenanceDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Log Request for this Lab</Button>}
                    </div>
                  </CardHeader>
                  <CardContent className="p-0">
                    {isLoadingData && labSpecificFilteredMaintenanceRequests.length === 0 ? (
                        <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2"/>Fetching requests for {selectedLabDetails.name}...</div>
                    ) : labSpecificFilteredMaintenanceRequests.length > 0 ? (
                        <div className="overflow-x-auto border rounded-b-md">
                        <Table>
                            <TableHeader><TableRow>
                            <TableHead>Resource</TableHead><TableHead className="min-w-[200px]">Issue</TableHead><TableHead>Reported By</TableHead>
                            <TableHead>Date Reported</TableHead><TableHead>Status</TableHead><TableHead>Assigned To</TableHead>
                            {canEditAnyMaintenanceRequest && <TableHead className="text-right w-[100px]">Actions</TableHead>}
                            </TableRow></TableHeader>
                            <TableBody>{labSpecificFilteredMaintenanceRequests.map((request) => (
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
                        <p className="font-medium">{activeLabSpecificMaintenanceFilterCount > 0 ? `No requests match filters for ${selectedLabDetails.name}.` : `No maintenance requests for ${selectedLabDetails.name}.`}</p>
                        {activeLabSpecificMaintenanceFilterCount > 0 ? (<Button variant="outline" size="sm" onClick={resetAllActiveLabSpecificMaintenancePageFilters}><FilterX className="mr-2 h-4 w-4"/>Reset Lab Filters</Button>) : (canManageAny && (<Button onClick={handleOpenNewMaintenanceDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Log First Request for this Lab</Button>))}
                        </div>
                    )}
                    </CardContent>
                </Card>
              </TabsContent>
              <TabsContent value="lab-members" className="mt-6">
                <Card>
                    <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div>
                            <CardTitle>{selectedLabDetails.name} - Members & Access</CardTitle>
                            <CardDescription>Manage user access and view members of this lab.</CardDescription>
                        </div>
                        <Button size="sm" onClick={() => setIsLabSpecificMemberAddDialogOpen(true)} disabled={!canManageAny}>
                            <UserPlus2 className="mr-2 h-4 w-4"/> Add New Member to {selectedLabDetails.name}
                        </Button>
                    </CardHeader>
                    <CardContent className="p-0">
                        {isLoadingData && labSpecificMembershipsDisplay.length === 0 ? (
                            <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2"/>Loading lab members...</div>
                        ) : labSpecificMembershipsDisplay.length > 0 ? (
                            <div className="overflow-x-auto border rounded-b-md">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead><div className="flex items-center gap-1"><UserIconLucide className="h-4 w-4 text-muted-foreground"/>User</div></TableHead>
                                            <TableHead><div className="flex items-center gap-1"><InfoIcon className="h-4 w-4 text-muted-foreground"/>Status in Lab</div></TableHead>
                                            <TableHead><div className="flex items-center gap-1"><ActivitySquare className="h-4 w-4 text-muted-foreground"/>Last Activity</div></TableHead>
                                            <TableHead className="text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {labSpecificMembershipsDisplay.map(member => (
                                            <TableRow key={member.id || member.userId}>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-8 w-8">
                                                            <AvatarImage src={member.userAvatarUrl} alt={member.userName} data-ai-hint="user avatar"/>
                                                            <AvatarFallback>{member.userName.charAt(0)}</AvatarFallback>
                                                        </Avatar>
                                                        <div>
                                                            <div className="font-medium">{member.userName}</div>
                                                            <div className="text-xs text-muted-foreground">{member.userEmail}</div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge className={cn("capitalize", getLabMembershipStatusBadgeClasses(member.status))}>
                                                        {member.status.replace('_', ' ')}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell>{formatDateSafe(member.updatedAt ? (member.updatedAt as Timestamp).toDate() : (member.requestedAt as Timestamp)?.toDate(), 'N/A', 'PPP p')}</TableCell>
                                                <TableCell className="text-right space-x-1">
                                                    {member.status === 'pending_approval' && (
                                                        <>
                                                            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(member.userId, member.userName, selectedLabDetails.id, selectedLabDetails.name, 'approve_request', member.id)} disabled={isProcessingLabAccessAction[member.id!] || isLoadingData}><ThumbsUp className="h-4 w-4 text-green-600"/></Button></TooltipTrigger><TooltipContent>Approve Request</TooltipContent></Tooltip>
                                                            <Tooltip><TooltipTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(member.userId, member.userName, selectedLabDetails.id, selectedLabDetails.name, 'reject_request', member.id)} disabled={isProcessingLabAccessAction[member.id!] || isLoadingData}><ThumbsDown className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Reject Request</TooltipContent></Tooltip>
                                                        </>
                                                    )}
                                                    {member.status === 'active' && (
                                                        <Tooltip><TooltipTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(member.userId, member.userName, selectedLabDetails.id, selectedLabDetails.name, 'revoke', member.id)} disabled={isProcessingLabAccessAction[member.id!] || isLoadingData}><ShieldOff className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Revoke Access</TooltipContent></Tooltip>
                                                    )}
                                                    {(member.status === 'rejected' || member.status === 'revoked') && (
                                                         <Tooltip><TooltipTrigger asChild><Button variant="default" size="icon" className="h-8 w-8" onClick={() => handleMembershipAction(member.userId, member.userName, selectedLabDetails.id, selectedLabDetails.name, 'grant', member.id)} disabled={isProcessingLabAccessAction[member.id!] || isLoadingData}><PlusCircle className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Re-Grant Access</TooltipContent></Tooltip>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        ) : (
                             <div className="text-center py-10 text-muted-foreground">
                                <Users2 className="h-12 w-12 mx-auto mb-3 opacity-50"/>
                                <p className="font-medium">No members or pending requests for {selectedLabDetails.name}.</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
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
            technicians={allTechniciansForMaintenance}
            resources={allResourcesForCountsAndChecks} 
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
            onMembershipUpdate={fetchAllAdminData}
            preselectedLabId={activeContextId} 
          />
        )}
      </div>
    </TooltipProvider>
  );
}

