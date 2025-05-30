
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { Archive, ListChecks, PackagePlus, Edit, Trash2, Filter as FilterIcon, FilterX, Search as SearchIcon, Loader2, X, CheckCircle2, Building, PlusCircle } from 'lucide-react';
import type { ResourceType, Resource, Lab, RoleName } from '@/types';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { db } from '@/lib/firebase';
import { collection, getDocs, doc, addDoc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, Timestamp, writeBatch } from 'firebase/firestore';
import { addAuditLog } from '@/lib/firestore-helpers';

type ResourceTypeSortableColumn = 'name' | 'resourceCount' | 'description';
const resourceTypeSortOptions: { value: string; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'resourceCount-asc', label: 'Resources (Low to High)' },
  { value: 'resourceCount-desc', label: 'Resources (High to Low)' },
  { value: 'description-asc', label: 'Description (A-Z)' },
  { value: 'description-desc', label: 'Description (Z-A)' },
];

type LabSortableColumn = 'name' | 'location';
const labSortOptions: { value: string; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' },
  { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'location-asc', label: 'Location (A-Z)' },
  { value: 'location-desc', label: 'Location (Z-A)' },
];

export default function LabManagementPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();

  // Resource Types State
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [isLoadingResourceTypes, setIsLoadingResourceTypes] = useState(true);
  const [typeToDelete, setTypeToDelete] = useState<ResourceType | null>(null);
  const [isResourceTypeFormDialogOpen, setIsResourceTypeFormDialogOpen] = useState(false);
  const [editingType, setEditingType] = useState<ResourceType | null>(null);
  const [isResourceTypeFilterDialogOpen, setIsResourceTypeFilterDialogOpen] = useState(false);
  const [tempResourceTypeSearchTerm, setTempResourceTypeSearchTerm] = useState('');
  const [activeResourceTypeSearchTerm, setActiveResourceTypeSearchTerm] = useState('');
  const [tempResourceTypeSortBy, setTempResourceTypeSortBy] = useState<string>('name-asc');
  const [activeResourceTypeSortBy, setActiveResourceTypeSortBy] = useState<string>('name-asc');

  // Labs State
  const [labs, setLabs] = useState<Lab[]>([]);
  const [isLoadingLabs, setIsLoadingLabs] = useState(true);
  const [labToDelete, setLabToDelete] = useState<Lab | null>(null);
  const [isLabFormDialogOpen, setIsLabFormDialogOpen] = useState(false);
  const [editingLab, setEditingLab] = useState<Lab | null>(null);
  const [isLabFilterDialogOpen, setIsLabFilterDialogOpen] = useState(false);
  const [tempLabSearchTerm, setTempLabSearchTerm] = useState('');
  const [activeLabSearchTerm, setActiveLabSearchTerm] = useState('');
  const [tempLabSortBy, setTempLabSortBy] = useState<string>('name-asc');
  const [activeLabSortBy, setActiveLabSortBy] = useState<string>('name-asc');


  const canManageInventory = useMemo(() => currentUser && currentUser.role === 'Admin', [currentUser]);

  // --- Resource Types Logic ---
  const fetchResourceTypesData = useCallback(async () => {
    if (!canManageInventory) {
      setIsLoadingResourceTypes(false); setResourceTypes([]); setAllResources([]); return;
    }
    setIsLoadingResourceTypes(true);
    try {
      const typesQuery = query(collection(db, "resourceTypes"), orderBy("name", "asc"));
      const typesSnapshot = await getDocs(typesQuery);
      const fetchedTypes: ResourceType[] = typesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as ResourceType));
      setResourceTypes(fetchedTypes);

      const resourcesQuery = query(collection(db, "resources"));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const fetchedResources: Resource[] = resourcesSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as Pick<Resource, 'id' | 'resourceTypeId'>) as Resource);
      setAllResources(fetchedResources);
    } catch (error: any) {
      console.error("Error fetching resource types data:", error);
      toast({ title: "Error", description: `Failed to load resource types: ${error.message}`, variant: "destructive" });
    }
    setIsLoadingResourceTypes(false);
  }, [toast, canManageInventory]);

  useEffect(() => { fetchResourceTypesData(); }, [fetchResourceTypesData]);
  useEffect(() => {
    if (isResourceTypeFilterDialogOpen) {
      setTempResourceTypeSearchTerm(activeResourceTypeSearchTerm);
      setTempResourceTypeSortBy(activeResourceTypeSortBy);
    }
  }, [isResourceTypeFilterDialogOpen, activeResourceTypeSearchTerm, activeResourceTypeSortBy]);

  const filteredResourceTypesWithCount = useMemo(() => {
    let currentTypes = [...resourceTypes];
    const lowerSearchTerm = activeResourceTypeSearchTerm.toLowerCase();
    if (activeResourceTypeSearchTerm) {
      currentTypes = currentTypes.filter(type => type.name.toLowerCase().includes(lowerSearchTerm) || (type.description && type.description.toLowerCase().includes(lowerSearchTerm)));
    }
    const [column, direction] = activeResourceTypeSortBy.split('-') as [ResourceTypeSortableColumn, 'asc' | 'desc'];
    let typesWithCount = currentTypes.map(type => ({ ...type, resourceCount: allResources.filter(res => res.resourceTypeId === type.id).length, }));
    typesWithCount.sort((a, b) => {
      let comparison = 0;
      const valA = a[column]; const valB = b[column];
      if (column === 'resourceCount') comparison = (valA as number) - (valB as number);
      else if (column === 'name') comparison = (valA as string).toLowerCase().localeCompare((valB as string).toLowerCase());
      else if (column === 'description') comparison = (a.description || '').toLowerCase().localeCompare((b.description || '').toLowerCase());
      return direction === 'asc' ? comparison : -comparison;
    });
    return typesWithCount;
  }, [resourceTypes, allResources, activeResourceTypeSearchTerm, activeResourceTypeSortBy]);

  const handleApplyResourceTypeDialogFilters = useCallback(() => {
    setActiveResourceTypeSearchTerm(tempResourceTypeSearchTerm);
    setActiveResourceTypeSortBy(tempResourceTypeSortBy);
    setIsResourceTypeFilterDialogOpen(false);
  }, [tempResourceTypeSearchTerm, tempResourceTypeSortBy]);

  const resetResourceTypeDialogFiltersOnly = useCallback(() => { setTempResourceTypeSearchTerm(''); setTempResourceTypeSortBy('name-asc'); }, []);
  const resetAllActiveResourceTypePageFilters = useCallback(() => {
    setActiveResourceTypeSearchTerm(''); setActiveResourceTypeSortBy('name-asc');
    resetResourceTypeDialogFiltersOnly(); setIsResourceTypeFilterDialogOpen(false);
  }, [resetResourceTypeDialogFiltersOnly]);

  const handleOpenNewResourceTypeDialog = () => { setEditingType(null); setIsResourceTypeFormDialogOpen(true); };
  const handleOpenEditResourceTypeDialog = (type: ResourceType) => { setEditingType(type); setIsResourceTypeFormDialogOpen(true); };

  const handleSaveResourceType = async (data: ResourceTypeFormValues) => {
    if (!currentUser || !currentUser.name || !canManageInventory) {
      toast({ title: "Permission Denied", variant: "destructive" }); return;
    }
    setIsLoadingResourceTypes(true);
    try {
      const typeDataToSave = { name: data.name, description: data.description || null };
      const auditAction = editingType ? 'RESOURCE_TYPE_UPDATED' : 'RESOURCE_TYPE_CREATED';
      let entityId = editingType ? editingType.id : '';

      if (editingType) {
        await updateDoc(doc(db, "resourceTypes", entityId), typeDataToSave);
      } else {
        const docRef = await addDoc(collection(db, "resourceTypes"), typeDataToSave);
        entityId = docRef.id;
      }
      addAuditLog(currentUser.id, currentUser.name, auditAction, { entityType: 'ResourceType', entityId, details: `Resource Type '${data.name}' ${editingType ? 'updated' : 'created'}.` });
      toast({ title: `Resource Type ${editingType ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingType ? 'updated' : 'created'}.` });
      setIsResourceTypeFormDialogOpen(false); setEditingType(null); await fetchResourceTypesData();
    } catch (error: any) {
      toast({ title: "Save Error", description: `Could not save resource type: ${error.message}`, variant: "destructive" });
    } finally { setIsLoadingResourceTypes(false); }
  };

  const handleDeleteResourceType = async (typeId: string) => {
    if (!currentUser || !currentUser.name || !canManageInventory) {
      toast({ title: "Permission Denied", variant: "destructive" }); return;
    }
    const deletedType = resourceTypes.find(rt => rt.id === typeId);
    if (!deletedType) { toast({ title: "Error", description: "Resource type not found.", variant: "destructive" }); return; }
    const resourcesOfThisType = allResources.filter(res => res.resourceTypeId === typeId).length;
    if (resourcesOfThisType > 0) {
      toast({ title: "Deletion Blocked", description: `Cannot delete "${deletedType.name}" as ${resourcesOfThisType} resource(s) are assigned. Reassign them first.`, variant: "destructive", duration: 7000 });
      setTypeToDelete(null); return;
    }
    setIsLoadingResourceTypes(true);
    try {
      await deleteDoc(doc(db, "resourceTypes", typeId));
      addAuditLog(currentUser.id, currentUser.name, 'RESOURCE_TYPE_DELETED', { entityType: 'ResourceType', entityId: typeId, details: `Resource Type '${deletedType.name}' deleted.` });
      toast({ title: "Resource Type Deleted", description: `"${deletedType.name}" removed.`, variant: "destructive" });
      setTypeToDelete(null); await fetchResourceTypesData();
    } catch (error: any) {
      toast({ title: "Delete Error", description: `Could not delete resource type: ${error.message}`, variant: "destructive" });
    } finally { setIsLoadingResourceTypes(false); }
  };
  const activeResourceTypeFilterCount = [activeResourceTypeSearchTerm !== '', activeResourceTypeSortBy !== 'name-asc'].filter(Boolean).length;

  // --- Labs Logic ---
  const fetchLabsData = useCallback(async () => {
    if (!canManageInventory) { setIsLoadingLabs(false); setLabs([]); return; }
    setIsLoadingLabs(true);
    try {
      const labsQuery = query(collection(db, "labs"), orderBy("name", "asc"));
      const labsSnapshot = await getDocs(labsQuery);
      const fetchedLabs: Lab[] = labsSnapshot.docs.map(docSnap => ({
        id: docSnap.id, ...docSnap.data(),
        createdAt: (docSnap.data().createdAt as Timestamp)?.toDate(),
        lastUpdatedAt: (docSnap.data().lastUpdatedAt as Timestamp)?.toDate(),
      } as Lab));
      setLabs(fetchedLabs);
    } catch (error: any) {
      console.error("Error fetching labs data:", error);
      toast({ title: "Error", description: `Failed to load labs: ${error.message}`, variant: "destructive" });
    }
    setIsLoadingLabs(false);
  }, [toast, canManageInventory]);

  useEffect(() => { fetchLabsData(); }, [fetchLabsData]);
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
      currentLabs = currentLabs.filter(lab => lab.name.toLowerCase().includes(lowerSearchTerm) || (lab.location && lab.location.toLowerCase().includes(lowerSearchTerm)) || (lab.description && lab.description.toLowerCase().includes(lowerSearchTerm)));
    }
    const [column, direction] = activeLabSortBy.split('-') as [LabSortableColumn, 'asc' | 'desc'];
    currentLabs.sort((a, b) => {
      let comparison = 0;
      if (column === 'name') comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
      else if (column === 'location') comparison = (a.location || '').toLowerCase().localeCompare((b.location || '').toLowerCase());
      return direction === 'asc' ? comparison : -comparison;
    });
    return currentLabs;
  }, [labs, activeLabSearchTerm, activeLabSortBy]);

  const handleApplyLabDialogFilters = useCallback(() => {
    setActiveLabSearchTerm(tempLabSearchTerm); setActiveLabSortBy(tempLabSortBy);
    setIsLabFilterDialogOpen(false);
  }, [tempLabSearchTerm, tempLabSortBy]);

  const resetLabDialogFiltersOnly = useCallback(() => { setTempLabSearchTerm(''); setTempLabSortBy('name-asc'); }, []);
  const resetAllActiveLabPageFilters = useCallback(() => {
    setActiveLabSearchTerm(''); setActiveLabSortBy('name-asc');
    resetLabDialogFiltersOnly(); setIsLabFilterDialogOpen(false);
  }, [resetLabDialogFiltersOnly]);

  const handleOpenNewLabDialog = () => { setEditingLab(null); setIsLabFormDialogOpen(true); };
  const handleOpenEditLabDialog = (lab: Lab) => { setEditingLab(lab); setIsLabFormDialogOpen(true); };

  const handleSaveLab = async (data: LabFormValues) => {
    if (!currentUser || !currentUser.name || !canManageInventory) {
      toast({ title: "Permission Denied", variant: "destructive" }); return;
    }
    setIsLoadingLabs(true);
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
      addAuditLog(currentUser.id, currentUser.name, auditAction, { entityType: 'Lab', entityId, details: `Lab '${data.name}' ${editingLab ? 'updated' : 'created'}.` });
      toast({ title: `Lab ${editingLab ? 'Updated' : 'Created'}`, description: `"${data.name}" has been ${editingLab ? 'updated' : 'created'}.` });
      setIsLabFormDialogOpen(false); setEditingLab(null); await fetchLabsData();
    } catch (error: any) {
      toast({ title: "Save Error", description: `Could not save lab: ${error.message}`, variant: "destructive" });
    } finally { setIsLoadingLabs(false); }
  };

  const handleDeleteLab = async (labId: string) => {
    if (!currentUser || !currentUser.name || !canManageInventory) {
      toast({ title: "Permission Denied", variant: "destructive" }); return;
    }
    const deletedLab = labs.find(lab => lab.id === labId);
    if (!deletedLab) { toast({ title: "Error", description: "Lab not found.", variant: "destructive" }); return; }

    const resourcesInThisLab = allResources.filter(res => res.lab === deletedLab.name).length;
    if (resourcesInThisLab > 0) {
      toast({ title: "Deletion Blocked", description: `Cannot delete lab "${deletedLab.name}" as ${resourcesInThisLab} resource(s) are currently assigned to it. Please reassign them first.`, variant: "destructive", duration: 7000 });
      setLabToDelete(null); return;
    }

    setIsLoadingLabs(true);
    try {
      await deleteDoc(doc(db, "labs", labId));
      addAuditLog(currentUser.id, currentUser.name, 'LAB_DELETED', { entityType: 'Lab', entityId: labId, details: `Lab '${deletedLab.name}' deleted.` });
      toast({ title: "Lab Deleted", description: `Lab "${deletedLab.name}" removed.`, variant: "destructive" });
      setLabToDelete(null); await fetchLabsData();
    } catch (error: any) {
      toast({ title: "Delete Error", description: `Could not delete lab: ${error.message}`, variant: "destructive" });
    } finally { setIsLoadingLabs(false); }
  };
  const activeLabFilterCount = [activeLabSearchTerm !== '', activeLabSortBy !== 'name-asc'].filter(Boolean).length;

  if (!currentUser || !canManageInventory) {
    return (
      <div className="space-y-8">
        <PageHeader title="Lab Management" icon={Archive} description="Access Denied." />
        <Card className="text-center py-10 text-muted-foreground">
          <CardContent><p>You do not have permission to manage lab setup and resource types.</p></CardContent>
        </Card>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-8">
        <PageHeader
          title="Lab Management"
          description="Define and manage labs, resource types, and other core lab configurations."
          icon={Archive}
        />
        <Tabs defaultValue="labs" className="w-full">
          <TabsList className="grid w-full grid-cols-2 md:max-w-md">
            <TabsTrigger value="labs">Manage Labs</TabsTrigger>
            <TabsTrigger value="resource-types">Manage Resource Types</TabsTrigger>
          </TabsList>

          <TabsContent value="labs" className="mt-6">
            <Card>
              <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div><CardTitle className="text-xl">Labs</CardTitle><p className="text-sm text-muted-foreground mt-1">Define and manage laboratory locations.</p></div>
                <div className="flex gap-2 flex-wrap">
                  <FilterSortDialog open={isLabFilterDialogOpen} onOpenChange={setIsLabFilterDialogOpen}>
                    <FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter &amp; Sort</Button></FilterSortDialogTrigger>
                    <FilterSortDialogContent className="sm:max-w-md">
                      <FilterSortDialogHeader><FilterSortDialogTitle>Filter &amp; Sort Labs</FilterSortDialogTitle></FilterSortDialogHeader>
                      <Separator className="my-3" />
                      <div className="space-y-3">
                        <div className="relative">
                          <Label htmlFor="labSearchDialog">Search (Name/Loc/Desc)</Label>
                          <SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" />
                          <Input id="labSearchDialog" value={tempLabSearchTerm} onChange={e => setTempLabSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/>
                        </div>
                        <div><Label htmlFor="labSortDialog">Sort by</Label><Select value={tempLabSortBy} onValueChange={setTempLabSortBy}><SelectTrigger id="labSortDialog" className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{labSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
                      </div>
                      <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetLabDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button variant="outline" onClick={() => setIsLabFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button><Button onClick={handleApplyLabDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter>
                    </FilterSortDialogContent>
                  </FilterSortDialog>
                  {canManageInventory && <Button onClick={handleOpenNewLabDialog} size="sm"><PackagePlus className="mr-2 h-4 w-4"/>Add Lab</Button>}
                </div>
              </CardHeader>
              <CardContent className="p-0">
                {isLoadingLabs && filteredLabs.length === 0 && !activeLabSearchTerm ? ( <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
                ) : filteredLabs.length > 0 ? (
                  <div className="overflow-x-auto rounded-md border shadow-sm"><Table>
                    <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Location</TableHead><TableHead>Description</TableHead>{canManageInventory && <TableHead className="text-right w-[100px]">Actions</TableHead>}</TableRow></TableHeader>
                    <TableBody>{filteredLabs.map(lab => (<TableRow key={lab.id}><TableCell className="font-medium">{lab.name}</TableCell><TableCell>{lab.location || 'N/A'}</TableCell><TableCell className="text-sm text-muted-foreground max-w-xs truncate" title={lab.description || undefined}>{lab.description || 'N/A'}</TableCell>
                      {canManageInventory && <TableCell className="text-right space-x-1">
                        <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditLabDialog(lab)} disabled={isLoadingLabs}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Lab</TooltipContent></Tooltip>
                        <AlertDialog open={labToDelete?.id === lab.id} onOpenChange={(isOpen) => !isOpen && setLabToDelete(null)}>
                          <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setLabToDelete(lab)} disabled={isLoadingLabs}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Lab</TooltipContent></Tooltip>
                          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{labToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Ensure no resources are assigned to this lab.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => labToDelete && handleDeleteLab(labToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                        </AlertDialog>
                      </TableCell>}
                    </TableRow>))}
                    </TableBody></Table></div>
                ) : ( <div className="text-center py-10 text-muted-foreground"><Building className="h-12 w-12 mx-auto mb-3 opacity-50"/><p className="font-medium">{activeLabFilterCount > 0 ? "No labs match criteria." : "No labs defined yet."}</p>{activeLabFilterCount > 0 && <Button variant="link" onClick={resetAllActiveLabPageFilters} className="mt-2 text-xs"><FilterX className="mr-1.5 h-3.5 w-3.5"/>Reset Filters</Button>}</div>)}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="resource-types" className="mt-6">
            <Card>
                <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                    <div><CardTitle className="text-xl">Resource Types</CardTitle><p className="text-sm text-muted-foreground mt-1">Define and manage categories for lab resources.</p></div>
                    <div className="flex gap-2 flex-wrap">
                    <FilterSortDialog open={isResourceTypeFilterDialogOpen} onOpenChange={setIsResourceTypeFilterDialogOpen}>
                        <FilterSortDialogTrigger asChild><Button variant="outline" size="sm"><FilterIcon className="mr-2 h-4 w-4" />Filter &amp; Sort</Button></FilterSortDialogTrigger>
                        <FilterSortDialogContent className="sm:max-w-md">
                        <FilterSortDialogHeader><FilterSortDialogTitle>Filter &amp; Sort Resource Types</FilterSortDialogTitle></FilterSortDialogHeader>
                        <Separator className="my-3" />
                        <div className="space-y-3">
                            <div className="relative"><Label htmlFor="typeSearchDialog">Search (Name/Desc)</Label><SearchIcon className="absolute left-2.5 top-[calc(1.25rem_+_8px)] h-4 w-4 text-muted-foreground" /><Input id="typeSearchDialog" value={tempResourceTypeSearchTerm} onChange={e => setTempResourceTypeSearchTerm(e.target.value)} placeholder="Keyword..." className="mt-1 h-9 pl-8"/></div>
                            <div><Label htmlFor="typeSortDialog">Sort by</Label><Select value={tempResourceTypeSortBy} onValueChange={setTempResourceTypeSortBy}><SelectTrigger id="typeSortDialog" className="mt-1 h-9"><SelectValue /></SelectTrigger><SelectContent>{resourceTypeSortOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetResourceTypeDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button variant="outline" onClick={() => setIsResourceTypeFilterDialogOpen(false)}><X className="mr-2 h-4 w-4"/>Cancel</Button><Button onClick={handleApplyResourceTypeDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter>
                        </FilterSortDialogContent>
                    </FilterSortDialog>
                    {canManageInventory && <Button onClick={handleOpenNewResourceTypeDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Type</Button>}
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoadingResourceTypes && filteredResourceTypesWithCount.length === 0 && !activeResourceTypeSearchTerm ? ( <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
                    ) : filteredResourceTypesWithCount.length > 0 ? (
                    <div className="overflow-x-auto border rounded-md shadow-sm">
                        <Table>
                        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Description</TableHead><TableHead className="text-center"># Resources</TableHead>{canManageInventory && <TableHead className="text-right w-[100px]">Actions</TableHead>}</TableRow></TableHeader>
                        <TableBody>{filteredResourceTypesWithCount.map(type => (<TableRow key={type.id}><TableCell className="font-medium">{type.name}</TableCell><TableCell className="text-sm text-muted-foreground max-w-md truncate" title={type.description || undefined}>{type.description || 'N/A'}</TableCell><TableCell className="text-center">{type.resourceCount}</TableCell>
                        {canManageInventory && <TableCell className="text-right space-x-1">
                            <Tooltip><TooltipTrigger asChild><Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleOpenEditResourceTypeDialog(type)} disabled={isLoadingResourceTypes}><Edit className="h-4 w-4"/></Button></TooltipTrigger><TooltipContent>Edit Type</TooltipContent></Tooltip>
                            <AlertDialog open={typeToDelete?.id === type.id} onOpenChange={(isOpen) => !isOpen && setTypeToDelete(null)}>
                            <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setTypeToDelete(type)} disabled={isLoadingResourceTypes}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger><TooltipContent>Delete Type</TooltipContent></Tooltip>
                            <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete "{typeToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Ensure no resources use this type.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={() => typeToDelete && handleDeleteResourceType(typeToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
                            </AlertDialog>
                        </TableCell>}
                        </TableRow>))}
                        </TableBody></Table></div>
                    ) : ( <div className="text-center py-10 text-muted-foreground"><ListChecks className="h-12 w-12 mx-auto mb-3 opacity-50"/><p className="font-medium">{activeResourceTypeFilterCount > 0 ? "No types match criteria." : "No resource types defined."}</p>{activeResourceTypeFilterCount > 0 && <Button variant="link" onClick={resetAllActiveResourceTypePageFilters} className="mt-2 text-xs"><FilterX className="mr-1.5 h-3.5 w-3.5"/>Reset Filters</Button>}</div>)}
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {isResourceTypeFormDialogOpen && currentUser && (
        <ResourceTypeFormDialog open={isResourceTypeFormDialogOpen} onOpenChange={(isOpen) => { setIsResourceTypeFormDialogOpen(isOpen); if (!isOpen) setEditingType(null); }} initialType={editingType} onSave={handleSaveResourceType} />
      )}
      {isLabFormDialogOpen && currentUser && (
        <LabFormDialog open={isLabFormDialogOpen} onOpenChange={(isOpen) => { setIsLabFormDialogOpen(isOpen); if (!isOpen) setEditingLab(null); }} initialLab={editingLab} onSave={handleSaveLab} />
      )}
    </TooltipProvider>
  );
}
