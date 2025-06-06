
'use client';

import type { FC } from 'react';
import { Filter as FilterIcon, FilterX, Search as SearchIcon, CheckCircle2, PlusCircle, Package as PackageIcon, User as UserIconLucide, AlertTriangle, CalendarClock, Info as InfoIcon, UserCog, Wrench, Edit } from 'lucide-react';
import type { MaintenanceRequest, MaintenanceRequestStatus, User, Resource, RoleName } from '@/types';
import { Button } from "@/components/ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import {
  Dialog as FilterSortDialog,
  DialogContent as FilterSortDialogContent,
  DialogHeader as FilterSortDialogHeader,
  DialogTitle as FilterSortDialogTitle,
  DialogFooter as FilterSortDialogFooter,
  DialogTrigger as FilterSortDialogTrigger,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, AlertCircle, PenToolIcon, CheckCircle as LucideCheckCircle } from 'lucide-react';
import { formatDateSafe } from '@/lib/utils';
import { maintenanceRequestStatuses } from '@/lib/app-constants';

const getMaintenanceStatusBadge = (status: MaintenanceRequestStatus) => {
  switch (status) {
    case 'Open': return <Badge variant="destructive" className="bg-red-500 text-white border-transparent"><AlertCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'In Progress': return <Badge variant="secondary" className="bg-yellow-500 text-yellow-950 border-transparent"><PenToolIcon className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Resolved': return <Badge className="bg-blue-500 text-white border-transparent"><LucideCheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Closed': return <Badge className="bg-green-500 text-white border-transparent"><LucideCheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default: return <Badge variant="outline">{status}</Badge>;
  }
};

interface SystemMaintenanceLogTabProps {
  isLoadingData: boolean;
  filteredMaintenanceRequests: (MaintenanceRequest & { resourceName?: string; resourceLabId?: string; reportedByUserName?: string; assignedTechnicianName?: string; })[];
  activeMaintenanceFilterCount: number;
  isMaintenanceFilterDialogOpen: boolean;
  setIsMaintenanceFilterDialogOpen: (isOpen: boolean) => void;
  tempMaintenanceSearchTerm: string;
  setTempMaintenanceSearchTerm: (term: string) => void;
  tempMaintenanceFilterStatus: MaintenanceRequestStatus | 'all';
  setTempMaintenanceFilterStatus: (status: MaintenanceRequestStatus | 'all') => void;
  tempMaintenanceFilterResourceId: string;
  setTempMaintenanceFilterResourceId: (id: string) => void;
  tempMaintenanceFilterTechnicianId: string;
  setTempMaintenanceFilterTechnicianId: (id: string) => void;
  allResourcesForCountsAndChecks: Resource[];
  allTechniciansForMaintenance: User[];
  resetMaintenanceDialogFiltersOnly: () => void;
  handleApplyMaintenanceDialogFilters: () => void;
  resetAllActiveMaintenancePageFilters: () => void;
  canManageAny: boolean;
  handleOpenNewMaintenanceDialog: () => void;
  canEditAnyMaintenanceRequest: boolean;
  handleOpenEditMaintenanceDialog: (request: MaintenanceRequest) => void;
}

export const SystemMaintenanceLogTab: FC<SystemMaintenanceLogTabProps> = ({
  isLoadingData, filteredMaintenanceRequests, activeMaintenanceFilterCount,
  isMaintenanceFilterDialogOpen, setIsMaintenanceFilterDialogOpen,
  tempMaintenanceSearchTerm, setTempMaintenanceSearchTerm,
  tempMaintenanceFilterStatus, setTempMaintenanceFilterStatus,
  tempMaintenanceFilterResourceId, setTempMaintenanceFilterResourceId,
  tempMaintenanceFilterTechnicianId, setTempMaintenanceFilterTechnicianId,
  allResourcesForCountsAndChecks, allTechniciansForMaintenance,
  resetMaintenanceDialogFiltersOnly, handleApplyMaintenanceDialogFilters, resetAllActiveMaintenancePageFilters,
  canManageAny, handleOpenNewMaintenanceDialog, canEditAnyMaintenanceRequest, handleOpenEditMaintenanceDialog
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div>
          <CardTitle className="text-xl">System-Wide Maintenance Log</CardTitle>
          <CardDescription className="text-sm text-muted-foreground mt-1">View and manage all maintenance requests across labs.</CardDescription>
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
                <Button onClick={handleApplyMaintenanceDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button>
              </FilterSortDialogFooter>
            </FilterSortDialogContent>
          </FilterSortDialog>
          {canManageAny && <Button onClick={handleOpenNewMaintenanceDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoadingData && filteredMaintenanceRequests.length === 0 ? (
          <div className="text-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary mx-auto mb-2"/>Fetching requests...</div>
        ) : filteredMaintenanceRequests.length > 0 ? (
          <div className="overflow-x-auto rounded-b-md border">
            <TooltipProvider>
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
            </TooltipProvider>
          </div>
        ) : (
          <div className="text-center py-10 text-muted-foreground">
            <Wrench className="h-12 w-12 mx-auto mb-3 opacity-50"/>
            <p className="font-medium">{activeMaintenanceFilterCount > 0 ? "No requests match filters." : "No maintenance requests."}</p>
            {activeMaintenanceFilterCount > 0 ? (<Button variant="outline" size="sm" onClick={resetAllActiveMaintenancePageFilters}><FilterX className="mr-2 h-4 w-4"/>Reset Filters</Button>) : (canManageAny && (<Button onClick={handleOpenNewMaintenanceDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add</Button>))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
