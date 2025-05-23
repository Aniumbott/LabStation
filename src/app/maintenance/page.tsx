
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Wrench, PlusCircle, Edit, Filter as FilterIcon, FilterX, Search as SearchIcon, ListFilter, CheckCircle, AlertCircle, PenToolIcon, Loader2, Info, X } from 'lucide-react';
import type { MaintenanceRequest, MaintenanceRequestStatus, User, Resource, RoleName } from '@/types';
import { maintenanceRequestStatuses, addNotification, addAuditLog } from '@/lib/mock-data';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { format, parseISO, isValid as isValidDate } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { MaintenanceRequestFormDialog, MaintenanceRequestFormValues } from '@/components/maintenance/maintenance-request-form-dialog';
import { cn, formatDateSafe } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, updateDoc, doc, serverTimestamp, Timestamp, getDoc, orderBy } from 'firebase/firestore';


const getMaintenanceStatusBadge = (status: MaintenanceRequestStatus) => {
  switch (status) {
    case 'Open':
      return <Badge variant="destructive" className="bg-red-500 text-white border-transparent"><AlertCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'In Progress':
      return <Badge variant="secondary" className="bg-yellow-500 text-yellow-950 border-transparent"><PenToolIcon className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Resolved':
      return <Badge className="bg-blue-500 text-white border-transparent"><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Closed':
      return <Badge className="bg-green-500 text-white border-transparent"><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
};

export default function MaintenanceRequestsPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [allTechnicians, setAllTechnicians] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null);

  // Filter Dialog State
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterStatus, setTempFilterStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>('all');
  const [tempFilterTechnicianId, setTempFilterTechnicianId] = useState<string>('all');

  // Active Page Filters
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterStatus, setActiveFilterStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterTechnicianId, setActiveFilterTechnicianId] = useState<string>('all');


  const fetchMaintenanceData = useCallback(async () => {
    setIsLoading(true);
    try {
      // Firestore Index required: maintenanceRequests collection: dateReported (DESC)
      const requestsQuery = query(collection(db, "maintenanceRequests"), orderBy("dateReported", "desc"));
      const requestsSnapshot = await getDocs(requestsQuery);
      const fetchedRequestsPromises = requestsSnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        let resourceName = 'Unknown Resource';
        let reportedByUserName = 'Unknown User';
        let assignedTechnicianName: string | undefined = undefined;

        if (data.resourceId) {
          const resourceDoc = await getDoc(doc(db, 'resources', data.resourceId));
          if (resourceDoc.exists()) resourceName = resourceDoc.data()?.name || resourceName;
        }
        if (data.reportedByUserId) {
          const userDoc = await getDoc(doc(db, 'users', data.reportedByUserId));
          if (userDoc.exists()) reportedByUserName = userDoc.data()?.name || reportedByUserName;
        }
        if (data.assignedTechnicianId) {
          const techDoc = await getDoc(doc(db, 'users', data.assignedTechnicianId));
          if (techDoc.exists()) assignedTechnicianName = techDoc.data()?.name;
        }

        return {
          id: docSnap.id,
          ...data,
          dateReported: data.dateReported instanceof Timestamp ? data.dateReported.toDate() : new Date(),
          dateResolved: data.dateResolved instanceof Timestamp ? data.dateResolved.toDate() : undefined,
          // Add resourceName, reportedByUserName, assignedTechnicianName for display (denormalized client-side)
          resourceName,
          reportedByUserName,
          assignedTechnicianName,
        } as MaintenanceRequest & { resourceName: string, reportedByUserName: string, assignedTechnicianName?: string }; // Augment type
      });
      const resolvedRequests = (await Promise.all(fetchedRequestsPromises)) as MaintenanceRequest[];
      setRequests(resolvedRequests);

      // Fetch All Resources
      // Firestore Index required: resources collection: name (ASC)
      const resourcesQuery = query(collection(db, "resources"), orderBy("name", "asc"));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      setAllResources(resourcesSnapshot.docs.map(d => ({id: d.id, ...d.data()} as Resource)));

      // Fetch All Technicians
      // Firestore Index required: users collection: role (ASC), name (ASC)
      const techniciansQuery = query(collection(db, "users"), where("role", "==", "Technician"), orderBy("name", "asc"));
      const techniciansSnapshot = await getDocs(techniciansQuery);
      setAllTechnicians(techniciansSnapshot.docs.map(d => ({id: d.id, ...d.data()} as User)));

    } catch (error: any) {
      console.error("Error fetching maintenance data:", error);
      toast({ title: "Error", description: `Failed to load maintenance data. ${error.message}`, variant: "destructive" });
      setRequests([]);
      setAllResources([]);
      setAllTechnicians([]);
    }
    setIsLoading(false);
  }, [toast]);

  useEffect(() => {
    fetchMaintenanceData();
  }, [fetchMaintenanceData]);

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterStatus(activeFilterStatus);
      setTempFilterResourceId(activeFilterResourceId);
      setTempFilterTechnicianId(activeFilterTechnicianId);
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterStatus, activeFilterResourceId, activeFilterTechnicianId]);


  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      // @ts-ignore (client-side augmented properties)
      const searchMatch = !activeSearchTerm || (req.resourceName && req.resourceName.toLowerCase().includes(lowerSearchTerm)) || (req.reportedByUserName && req.reportedByUserName.toLowerCase().includes(lowerSearchTerm)) || (req.issueDescription && req.issueDescription.toLowerCase().includes(lowerSearchTerm)) || (req.assignedTechnicianName && req.assignedTechnicianName.toLowerCase().includes(lowerSearchTerm));
      const statusMatch = activeFilterStatus === 'all' || req.status === activeFilterStatus;
      const resourceMatch = activeFilterResourceId === 'all' || req.resourceId === activeFilterResourceId;
      let technicianMatch = true;
      if (activeFilterTechnicianId !== 'all') {
         if (activeFilterTechnicianId === 'unassigned') {
           technicianMatch = !req.assignedTechnicianId;
         } else {
          technicianMatch = req.assignedTechnicianId === activeFilterTechnicianId;
         }
      }
      return searchMatch && statusMatch && resourceMatch && technicianMatch;
    });
  }, [requests, activeSearchTerm, activeFilterStatus, activeFilterResourceId, activeFilterTechnicianId]);

  const handleApplyDialogFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterStatus(tempFilterStatus);
    setActiveFilterResourceId(tempFilterResourceId);
    setActiveFilterTechnicianId(tempFilterTechnicianId);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFilters = () => {
    setTempSearchTerm('');
    setTempFilterStatus('all');
    setTempFilterResourceId('all');
    setTempFilterTechnicianId('all');
  };

  const resetAllActivePageFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterStatus('all');
    setActiveFilterResourceId('all');
    setActiveFilterTechnicianId('all');
    resetDialogFilters();
    setIsFilterDialogOpen(false);
  };

  const handleOpenNewDialog = () => {
    if (!currentUser) {
      toast({ title: "Login Required", description: "You must be logged in to log a maintenance request.", variant: "destructive" });
      return;
    }
    setEditingRequest(null);
    setIsFormDialogOpen(true);
  };

  const handleOpenEditDialog = (request: MaintenanceRequest) => {
    setEditingRequest(request);
    setIsFormDialogOpen(true);
  };

  const handleSaveRequest = async (data: MaintenanceRequestFormValues) => {
    if (!currentUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive"});
      return;
    }

    const resource = allResources.find(r => r.id === data.resourceId);
    if (!resource) {
      toast({ title: "Error", description: "Selected resource not found.", variant: "destructive" });
      return;
    }

    const requestDataToSave: any = {
      resourceId: data.resourceId,
      issueDescription: data.issueDescription,
      status: data.status,
      assignedTechnicianId: data.assignedTechnicianId || null,
      resolutionNotes: data.resolutionNotes || null,
    };

    setIsLoading(true);
    if (editingRequest) {
      try {
        if (data.status === 'Resolved' || data.status === 'Closed') {
          if (!editingRequest.dateResolved) {
            requestDataToSave.dateResolved = serverTimestamp();
          }
        } else {
          requestDataToSave.dateResolved = null;
        }
        const requestDocRef = doc(db, "maintenanceRequests", editingRequest.id);
        await updateDoc(requestDocRef, requestDataToSave);

        // @ts-ignore
        addAuditLog(currentUser.id, currentUser.name, 'MAINTENANCE_UPDATED', { entityType: 'MaintenanceRequest', entityId: editingRequest.id, details: `Maintenance request for '${editingRequest.resourceName}' updated. Status: ${data.status}.`});
        // @ts-ignore
        toast({ title: 'Request Updated', description: `Maintenance request for "${editingRequest.resourceName}" has been updated.` });

        if ((data.status === 'Resolved' && editingRequest.status !== 'Resolved') && editingRequest.reportedByUserId) {
          addNotification( editingRequest.reportedByUserId, 'Maintenance Resolved', `The issue reported for ${resource.name} has been resolved.`, 'maintenance_resolved', '/maintenance');
        } else if (data.assignedTechnicianId && data.assignedTechnicianId !== editingRequest.assignedTechnicianId) {
           if(data.assignedTechnicianId) {
            addNotification( data.assignedTechnicianId, 'Maintenance Task Assigned', `You have been assigned a maintenance task for ${resource.name}: ${data.issueDescription.substring(0,50)}...`, 'maintenance_assigned', '/maintenance');
          }
        }
      } catch (error) {
        console.error("Error updating maintenance request:", error);
        toast({ title: "Update Failed", description: "Could not update maintenance request.", variant: "destructive" });
      }
    } else {
      try {
        const newRequestPayload = {
          ...requestDataToSave,
          reportedByUserId: currentUser.id,
          dateReported: serverTimestamp(),
          dateResolved: (data.status === 'Resolved' || data.status === 'Closed') ? serverTimestamp() : null,
        };
        const docRef = await addDoc(collection(db, "maintenanceRequests"), newRequestPayload);

        addAuditLog(currentUser.id, currentUser.name, 'MAINTENANCE_CREATED', { entityType: 'MaintenanceRequest', entityId: docRef.id, details: `New maintenance request for '${resource.name}' logged.`});
        toast({ title: 'Request Logged', description: `New maintenance request for "${resource.name}" has been logged.` });

        const usersToNotifyQuery = query(collection(db, 'users'), where('role', 'in', ['Admin', 'Lab Manager', 'Technician']));
        const usersToNotifySnapshot = await getDocs(usersToNotifyQuery);

        if(requestDataToSave.assignedTechnicianId){
          addNotification( requestDataToSave.assignedTechnicianId, 'New Maintenance Request Assigned', `New request for ${resource.name}: ${data.issueDescription.substring(0, 50)}... has been assigned to you.`, 'maintenance_assigned', '/maintenance');
        } else {
            usersToNotifySnapshot.forEach(userDoc => {
                 addNotification( userDoc.id, 'New Unassigned Maintenance Request', `New request for ${resource.name}: ${data.issueDescription.substring(0, 50)}... needs attention.`, 'maintenance_new', '/maintenance');
            });
        }
      } catch (error) {
         console.error("Error logging maintenance request:", error);
        toast({ title: "Logging Failed", description: "Could not log maintenance request.", variant: "destructive" });
      }
    }
    setIsFormDialogOpen(false);
    setEditingRequest(null);
    await fetchMaintenanceData();
  };

  const activeFilterCount = [
    activeSearchTerm !== '',
    activeFilterStatus !== 'all',
    activeFilterResourceId !== 'all',
    activeFilterTechnicianId !== 'all',
  ].filter(Boolean).length;

  const canEditMaintenanceRequest = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Lab Manager' || currentUser.role === 'Technician');


  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PageHeader
          title="Maintenance Requests"
          description="Log, track, and manage service requests for lab resources."
          icon={Wrench}
          actions={
            <div className="flex items-center gap-2 flex-wrap">
              <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <ListFilter className="mr-2 h-4 w-4" />
                    Filters
                    {activeFilterCount > 0 && (
                      <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">
                        {activeFilterCount}
                      </Badge>
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Filter Maintenance Requests</DialogTitle>
                    <DialogDescription>
                      Refine the list of maintenance requests.
                    </DialogDescription>
                  </DialogHeader>
                  <Separator className="my-4" />
                  <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    <div>
                      <Label htmlFor="maintenanceSearchDialog" className="text-sm font-medium mb-1 block">Search (Resource/Reporter/Issue/Tech)</Label>
                      <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          id="maintenanceSearchDialog"
                          type="search"
                          placeholder="Keyword..."
                          value={tempSearchTerm}
                          onChange={(e) => setTempSearchTerm(e.target.value)}
                          className="h-9 pl-8"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                       <div>
                        <Label htmlFor="maintenanceStatusDialog" className="text-sm font-medium mb-1 block">Status</Label>
                        <Select value={tempFilterStatus} onValueChange={(v) => setTempFilterStatus(v as MaintenanceRequestStatus | 'all')}>
                            <SelectTrigger id="maintenanceStatusDialog" className="h-9"><SelectValue placeholder="Filter by Status" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Statuses</SelectItem>
                                {maintenanceRequestStatuses.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                            </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="maintenanceResourceDialog" className="text-sm font-medium mb-1 block">Resource</Label>
                        <Select value={tempFilterResourceId} onValueChange={setTempFilterResourceId}>
                            <SelectTrigger id="maintenanceResourceDialog" className="h-9"><SelectValue placeholder="Filter by Resource" /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">All Resources</SelectItem>
                                {allResources.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                            </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="maintenanceTechnicianDialog" className="text-sm font-medium mb-1 block">Assigned Technician</Label>
                      <Select value={tempFilterTechnicianId} onValueChange={setTempFilterTechnicianId}>
                          <SelectTrigger id="maintenanceTechnicianDialog" className="h-9"><SelectValue placeholder="Filter by Technician" /></SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all">All Technicians</SelectItem>
                              <SelectItem value="unassigned">Unassigned</SelectItem>
                              {allTechnicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                          </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter className="pt-6 border-t">
                    <Button variant="ghost" onClick={resetDialogFilters} className="mr-auto">
                      <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                    </Button>
                    <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}><X className="mr-2 h-4 w-4" />Cancel</Button>
                    <Button onClick={handleApplyDialogFilters}>Apply Filters</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button onClick={handleOpenNewDialog}>
                <PlusCircle className="mr-2 h-4 w-4" /> Log New Request
              </Button>
            </div>
          }
        />

        {isLoading ? (
            <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading requests...</div>
        ) : filteredRequests.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Maintenance Requests ({filteredRequests.length})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto rounded-lg border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Issue</TableHead>
                      <TableHead>Reported By</TableHead>
                      <TableHead>Date Reported</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Assigned To</TableHead>
                      {canEditMaintenanceRequest && <TableHead className="text-right w-[100px]">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRequests.map((request) => (
                      <TableRow key={request.id}>
                        {/* @ts-ignore */}
                        <TableCell className="font-medium">{request.resourceName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{request.issueDescription}</TableCell>
                        {/* @ts-ignore */}
                        <TableCell>{request.reportedByUserName}</TableCell>
                        <TableCell>
                          {formatDateSafe(request.dateReported)}
                        </TableCell>
                        <TableCell>{getMaintenanceStatusBadge(request.status)}</TableCell>
                        {/* @ts-ignore */}
                        <TableCell>{request.assignedTechnicianName || <span className="text-xs italic text-muted-foreground">Unassigned</span>}</TableCell>
                        {canEditMaintenanceRequest && (
                          <TableCell className="text-right space-x-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditDialog(request)}>
                                  <Edit className="h-4 w-4" />
                                  <span className="sr-only">Edit Request</span>
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p>Edit Request</p></TooltipContent>
                            </Tooltip>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="text-center py-10 text-muted-foreground bg-card border-0 shadow-none">
            <CardContent>
              <Wrench className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">
                {activeFilterCount > 0 ? "No Requests Match Filters" : "No Active Maintenance Requests"}
              </p>
              <p className="text-sm mb-4">
                {activeFilterCount > 0
                  ? "Try adjusting your filter criteria."
                  : "All systems operational, or no issues reported yet."}
              </p>
              {activeFilterCount > 0 ? (
                <Button variant="outline" onClick={resetAllActivePageFilters}>
                  <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
              ) : (
                 currentUser && (
                  <Button onClick={handleOpenNewDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Log First Maintenance Request
                  </Button>
                )
              )}
            </CardContent>
          </Card>
        )}
      </div>
      {isFormDialogOpen && (
        <MaintenanceRequestFormDialog
            open={isFormDialogOpen}
            onOpenChange={(isOpen) => {
                setIsFormDialogOpen(isOpen);
                if (!isOpen) setEditingRequest(null);
            }}
            initialRequest={editingRequest}
            onSave={handleSaveRequest}
            technicians={allTechnicians}
            resources={allResources}
            currentUserRole={currentUser?.role}
        />
      )}
    </TooltipProvider>
  );
}
