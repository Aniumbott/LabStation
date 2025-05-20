
'use client';

import { useState, useMemo, useEffect } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Wrench, PlusCircle, Edit, Filter as FilterIcon, FilterX, Search as SearchIcon, ListFilter, CheckCircle, AlertCircle, PenToolIcon } from 'lucide-react';
import type { MaintenanceRequest, MaintenanceRequestStatus, User, Resource, RoleName } from '@/types';
import { initialMaintenanceRequests, maintenanceRequestStatuses, initialMockUsers, allAdminMockResources, addNotification } from '@/lib/mock-data';
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
import { format, parseISO, isValid } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { MaintenanceRequestFormDialog, MaintenanceRequestFormValues } from '@/components/maintenance/maintenance-request-form-dialog';
import { cn } from '@/lib/utils';

const getStatusBadge = (status: MaintenanceRequestStatus) => {
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
  const [requests, setRequests] = useState<MaintenanceRequest[]>(() => JSON.parse(JSON.stringify(initialMaintenanceRequests)));
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<MaintenanceRequest | null>(null);

  // Active filters
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterStatus, setActiveFilterStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
  const [activeFilterResourceId, setActiveFilterResourceId] = useState<string>('all');
  const [activeFilterTechnicianId, setActiveFilterTechnicianId] = useState<string>('all');

  // Temp filters for Dialog
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterStatus, setTempFilterStatus] = useState<MaintenanceRequestStatus | 'all'>('all');
  const [tempFilterResourceId, setTempFilterResourceId] = useState<string>('all');
  const [tempFilterTechnicianId, setTempFilterTechnicianId] = useState<string>('all');

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterStatus(activeFilterStatus);
      setTempFilterResourceId(activeFilterResourceId);
      setTempFilterTechnicianId(activeFilterTechnicianId);
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterStatus, activeFilterResourceId, activeFilterTechnicianId]);

  const technicians = useMemo(() => initialMockUsers.filter(user => user.role === 'Technician'), []);

  const filteredRequests = useMemo(() => {
    let currentRequests = [...requests];
    const lowerSearchTerm = activeSearchTerm.toLowerCase();
    if (activeSearchTerm) {
      currentRequests = currentRequests.filter(req =>
        req.resourceName.toLowerCase().includes(lowerSearchTerm) ||
        req.reportedByUserName.toLowerCase().includes(lowerSearchTerm) ||
        req.issueDescription.toLowerCase().includes(lowerSearchTerm) ||
        (req.assignedTechnicianName && req.assignedTechnicianName.toLowerCase().includes(lowerSearchTerm))
      );
    }
    if (activeFilterStatus !== 'all') {
      currentRequests = currentRequests.filter(req => req.status === activeFilterStatus);
    }
    if (activeFilterResourceId !== 'all') {
      currentRequests = currentRequests.filter(req => req.resourceId === activeFilterResourceId);
    }
    if (activeFilterTechnicianId !== 'all') {
       if (activeFilterTechnicianId === 'unassigned') {
         currentRequests = currentRequests.filter(req => !req.assignedTechnicianId);
       } else {
        currentRequests = currentRequests.filter(req => req.assignedTechnicianId === activeFilterTechnicianId);
       }
    }
    return currentRequests.sort((a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime());
  }, [requests, activeSearchTerm, activeFilterStatus, activeFilterResourceId, activeFilterTechnicianId]);

  const handleApplyFilters = () => {
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

  const resetAllActiveFilters = () => {
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

  const handleSaveRequest = (data: MaintenanceRequestFormValues) => {
    const resource = allAdminMockResources.find(r => r.id === data.resourceId);
    const technician = technicians.find(t => t.id === data.assignedTechnicianId);
    
    if (!resource) {
      toast({ title: "Error", description: "Selected resource not found.", variant: "destructive" });
      return;
    }
    
    if (editingRequest) {
      const updatedRequest: MaintenanceRequest = {
        ...editingRequest,
        ...data,
        resourceName: resource.name,
        assignedTechnicianName: technician?.name,
        dateResolved: (data.status === 'Resolved' || data.status === 'Closed') && !editingRequest.dateResolved ? new Date().toISOString() : editingRequest.dateResolved,
      };
      setRequests(requests.map(req => req.id === editingRequest.id ? updatedRequest : req));
      const globalIndex = initialMaintenanceRequests.findIndex(r => r.id === editingRequest.id);
      if (globalIndex !== -1) initialMaintenanceRequests[globalIndex] = updatedRequest;
      toast({ title: 'Request Updated', description: `Maintenance request for "${resource.name}" has been updated.` });
      
      if (updatedRequest.status === 'Resolved' && editingRequest.status !== 'Resolved' && updatedRequest.reportedByUserId) {
        addNotification(
          updatedRequest.reportedByUserId,
          'Maintenance Resolved',
          `The issue reported for ${resource.name} has been resolved.`,
          'maintenance_resolved',
          '/maintenance'
        );
      } else if (updatedRequest.assignedTechnicianId && updatedRequest.assignedTechnicianId !== editingRequest.assignedTechnicianId) {
         addNotification(
          updatedRequest.assignedTechnicianId,
          'Maintenance Task Assigned',
          `You have been assigned a maintenance task for ${resource.name}: ${updatedRequest.issueDescription.substring(0,50)}...`,
          'maintenance_assigned',
          '/maintenance'
        );
      }

    } else {
      if (!currentUser) {
        toast({ title: "Error", description: "You must be logged in to log a request.", variant: "destructive"});
        return;
      }
      const newRequest: MaintenanceRequest = {
        id: `mr${requests.length + 1 + Date.now()}`,
        ...data,
        resourceName: resource.name,
        reportedByUserId: currentUser.id,
        reportedByUserName: currentUser.name,
        assignedTechnicianName: technician?.name,
        dateReported: new Date().toISOString(),
        dateResolved: (data.status === 'Resolved' || data.status === 'Closed') ? new Date().toISOString() : undefined,
      };
      setRequests(prevRequests => [newRequest, ...prevRequests].sort((a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime()));
      initialMaintenanceRequests.unshift(newRequest); 
      initialMaintenanceRequests.sort((a, b) => new Date(b.dateReported).getTime() - new Date(a.dateReported).getTime());

      toast({ title: 'Request Logged', description: `New maintenance request for "${resource.name}" has been logged.` });
      
      const targetTechnicianId = newRequest.assignedTechnicianId || (technicians.length > 0 ? technicians[0].id : 'u1'); 
      if(targetTechnicianId){
        addNotification(
            targetTechnicianId,
            'New Maintenance Request',
            `New request for ${resource.name}: ${newRequest.issueDescription.substring(0, 50)}...`,
            'maintenance_new',
            '/maintenance'
        );
      }
    }
    setIsFormDialogOpen(false);
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
                          onChange={(e) => setTempSearchTerm(e.target.value.toLowerCase())}
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
                                {allAdminMockResources.map(r => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
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
                              {technicians.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                          </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter className="pt-6 border-t">
                    <Button variant="ghost" onClick={resetDialogFilters} className="mr-auto">
                      <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                    </Button>
                    <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleApplyFilters}>Apply Filters</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Button onClick={handleOpenNewDialog}>
                <PlusCircle className="mr-2 h-4 w-4" /> Log New Request
              </Button>
            </div>
          }
        />

        {filteredRequests.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Active Requests ({filteredRequests.length})</CardTitle>
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
                        <TableCell className="font-medium">{request.resourceName}</TableCell>
                        <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{request.issueDescription}</TableCell>
                        <TableCell>{request.reportedByUserName}</TableCell>
                        <TableCell>
                          {isValid(parseISO(request.dateReported)) ? format(parseISO(request.dateReported), 'MMM dd, yyyy') : 'Invalid Date'}
                        </TableCell>
                        <TableCell>{getStatusBadge(request.status)}</TableCell>
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
                <Button variant="outline" onClick={resetAllActiveFilters}>
                  <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
              ) : (
                <Button onClick={handleOpenNewDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Log First Maintenance Request
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
      <MaintenanceRequestFormDialog
        open={isFormDialogOpen}
        onOpenChange={setIsFormDialogOpen}
        initialRequest={editingRequest}
        onSave={handleSaveRequest}
        technicians={technicians}
        resources={allAdminMockResources}
        currentUserRole={currentUser?.role}
      />
    </TooltipProvider>
  );
}
