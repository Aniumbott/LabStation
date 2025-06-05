
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { History, Filter as FilterIcon, Search as SearchIcon, X, Loader2, FilterX, CheckCircle2 } from 'lucide-react';
import type { AuditLogEntry, AuditActionType } from '@/types';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateSafe, cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, orderBy, Timestamp } from 'firebase/firestore';
import { AuditLogDetailsDialog } from '@/components/admin/audit-log-details-dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

const auditActionTypesForFilter: AuditActionType[] = [
  'USER_CREATED', 'USER_UPDATED', 'USER_DELETED', 'USER_APPROVED', 'USER_REJECTED',
  'RESOURCE_CREATED', 'RESOURCE_UPDATED', 'RESOURCE_DELETED',
  'RESOURCE_TYPE_CREATED', 'RESOURCE_TYPE_UPDATED', 'RESOURCE_TYPE_DELETED',
  'LAB_CREATED', 'LAB_UPDATED', 'LAB_DELETED',
  'BOOKING_CREATED', 'BOOKING_UPDATED', 'BOOKING_APPROVED', 'BOOKING_REJECTED', 'BOOKING_CANCELLED', 'BOOKING_PROMOTED', 'BOOKING_WAITLISTED',
  'MAINTENANCE_CREATED', 'MAINTENANCE_UPDATED',
  'BLACKOUT_DATE_CREATED', 'BLACKOUT_DATE_UPDATED', 'BLACKOUT_DATE_DELETED',
  'RECURRING_RULE_CREATED', 'RECURRING_RULE_UPDATED', 'RECURRING_RULE_DELETED'
];


export default function AuditLogPage() {
  const { currentUser } = useAuth();
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempActionType, setTempActionType] = useState<AuditActionType | 'all'>('all');

  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeActionType, setActiveActionType] = useState<AuditActionType | 'all'>('all');

  // State for details dialog
  const [selectedLogForDetails, setSelectedLogForDetails] = useState<AuditLogEntry | null>(null);
  const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const logsQuery = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"));
      const querySnapshot = await getDocs(logsQuery);
      const fetchedLogs: AuditLogEntry[] = querySnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          ...data,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(),
        } as AuditLogEntry;
      });
      setAuditLogs(fetchedLogs);
    } catch (error: any) {
      setAuditLogs([]);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (currentUser?.role === 'Admin') {
      fetchAuditLogs();
    } else {
      setAuditLogs([]);
      setIsLoading(false);
    }
  }, [currentUser, fetchAuditLogs]);

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempActionType(activeActionType);
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeActionType]);

  const filteredLogs = useMemo(() => {
    if (currentUser?.role !== 'Admin') return [];
    return auditLogs.filter(log => {
      const lowerSearchTerm = activeSearchTerm.toLowerCase();
      const searchMatch = !activeSearchTerm ||
        (log.userName && log.userName.toLowerCase().includes(lowerSearchTerm)) ||
        (log.action && log.action.toLowerCase().includes(lowerSearchTerm)) ||
        (log.entityType && log.entityType.toLowerCase().includes(lowerSearchTerm)) ||
        (log.entityId && log.entityId.toLowerCase().includes(lowerSearchTerm)) ||
        (log.details && log.details.toLowerCase().includes(lowerSearchTerm));

      const actionTypeMatch = activeActionType === 'all' || log.action === activeActionType;

      return searchMatch && actionTypeMatch;
    });
  }, [auditLogs, activeSearchTerm, activeActionType, currentUser]);

  const handleApplyDialogFilters = useCallback(() => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveActionType(tempActionType);
    setIsFilterDialogOpen(false);
  }, [tempSearchTerm, tempActionType]);

  const resetDialogFiltersOnly = useCallback(() => {
    setTempSearchTerm('');
    setTempActionType('all');
  }, []);

  const resetAllPageFilters = useCallback(() => {
    setActiveSearchTerm('');
    setActiveActionType('all');
    resetDialogFiltersOnly();
    setIsFilterDialogOpen(false);
  }, [resetDialogFiltersOnly]);

  const handleRowClick = (log: AuditLogEntry) => {
    setSelectedLogForDetails(log);
    setIsDetailsDialogOpen(true);
  };

  const activeFilterCount = useMemo(() => [activeSearchTerm !== '', activeActionType !== 'all'].filter(Boolean).length, [activeSearchTerm, activeActionType]);

  if (currentUser?.role !== 'Admin') {
    return (
      <div className="space-y-8">
        <PageHeader title="Audit Log" icon={History} description="Access Denied." />
        <Card className="text-center py-10 text-muted-foreground">
          <CardContent>
            <p>You do not have permission to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Audit Log"
        description="Track significant actions performed within the system. Click a row for details."
        icon={History}
        actions={
          <Dialog open={isFilterDialogOpen} onOpenChange={setIsFilterDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <FilterIcon className="mr-2 h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2 rounded-full px-1.5 py-0.5 text-xs">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </DialogTrigger>
            <DialogContent className="w-full sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Filter Audit Logs</DialogTitle>
                <DialogDescription>
                  Refine the list of audit log entries.
                </DialogDescription>
              </DialogHeader>
              <Separator className="my-4" />
              <ScrollArea className="max-h-[60vh]">
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="auditSearchDialog">Search (User, Action, Entity, Details)</Label>
                    <div className="relative mt-1">
                      <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="auditSearchDialog"
                        type="search"
                        placeholder="Keyword..."
                        value={tempSearchTerm}
                        onChange={(e) => setTempSearchTerm(e.target.value)}
                        className="h-9 pl-8"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="auditActionTypeDialog">Action Type</Label>
                    <Select value={tempActionType} onValueChange={(v) => setTempActionType(v as AuditActionType | 'all')}>
                      <SelectTrigger id="auditActionTypeDialog" className="h-9 mt-1">
                        <SelectValue placeholder="Filter by Action Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Action Types</SelectItem>
                        {auditActionTypesForFilter.map(type => (
                          <SelectItem key={type} value={type}>{type.replace(/_/g, ' ')}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="pt-4">
                <Button variant="ghost" onClick={resetDialogFiltersOnly} className="mr-auto">
                  <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                </Button>
                <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>
                  <X className="mr-2 h-4 w-4" />Cancel
                </Button>
                <Button onClick={handleApplyDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4" />Apply Filters</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        }
      />

      {isLoading ? (
        <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading audit logs...</div>
      ) : filteredLogs.length > 0 ? (
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Timestamp</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id} onClick={() => handleRowClick(log)} className="cursor-pointer hover:bg-muted/50">
                  <TableCell>{log.userName || 'N/A'}</TableCell>
                  <TableCell><Badge variant="outline">{log.action.replace(/_/g, ' ')}</Badge></TableCell>
                  <TableCell className="whitespace-nowrap">{formatDateSafe(log.timestamp, 'N/A', 'MMM dd, yyyy, p')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
        <Card className="text-center py-10 text-muted-foreground border-0 shadow-none">
          <CardContent>
            <History className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">
              {activeFilterCount > 0 ? "No Audit Logs Match Filters" : "No Audit Logs Found"}
            </p>
            <p className="text-sm mb-4">
              {activeFilterCount > 0
                ? "Try adjusting your filter criteria."
                : "No system actions have been logged yet."}
            </p>
            {activeFilterCount > 0 && (
                <Button variant="outline" onClick={resetAllPageFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
            )}
          </CardContent>
        </Card>
      )}

      <AuditLogDetailsDialog
        logEntry={selectedLogForDetails}
        isOpen={isDetailsDialogOpen}
        onOpenChange={setIsDetailsDialogOpen}
      />
    </div>
  );
}
    