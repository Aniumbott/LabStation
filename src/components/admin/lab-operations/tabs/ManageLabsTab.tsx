
'use client';

import type { FC } from 'react';
import { Building, PlusCircle, Filter as FilterIcon, FilterX, Search as SearchIcon, Settings2, Trash2, Package as PackageIcon, MapPin, UsersRound, CheckCircle2 } from 'lucide-react';
import type { Lab } from '@/types';
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
import { Loader2 } from 'lucide-react';

type LabSortableColumn = 'name' | 'location' | 'resourceCount' | 'memberCount';
const labSortOptions: { value: string; label: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)' }, { value: 'name-desc', label: 'Name (Z-A)' },
  { value: 'location-asc', label: 'Location (A-Z)' }, { value: 'location-desc', label: 'Location (Z-A)' },
  { value: 'resourceCount-asc', label: 'Resources (Low-High)' }, { value: 'resourceCount-desc', label: 'Resources (High-Low)' },
  { value: 'memberCount-asc', label: 'Members (Low-High)' }, { value: 'memberCount-desc', label: 'Members (High-Low)' },
];

interface ManageLabsTabProps {
  labs: (Lab & { resourceCount: number; memberCount: number })[];
  isLoadingData: boolean;
  activeLabFilterCount: number;
  isLabFilterDialogOpen: boolean;
  setIsLabFilterDialogOpen: (isOpen: boolean) => void;
  tempLabSearchTerm: string;
  setTempLabSearchTerm: (term: string) => void;
  tempLabSortBy: string;
  setTempLabSortBy: (sort: string) => void;
  resetLabDialogFiltersOnly: () => void;
  handleApplyLabDialogFilters: () => void;
  resetAllActiveLabPageFilters: () => void;
  canManageAny: boolean;
  handleOpenNewLabDialog: () => void;
  setActiveContextId: (id: string) => void;
  setLabToDelete: (lab: Lab | null) => void;
  labToDelete: Lab | null;
  handleDeleteLab: (id: string) => void;
}

export const ManageLabsTab: FC<ManageLabsTabProps> = ({
  labs, isLoadingData, activeLabFilterCount, isLabFilterDialogOpen, setIsLabFilterDialogOpen,
  tempLabSearchTerm, setTempLabSearchTerm, tempLabSortBy, setTempLabSortBy,
  resetLabDialogFiltersOnly, handleApplyLabDialogFilters, resetAllActiveLabPageFilters,
  canManageAny, handleOpenNewLabDialog, setActiveContextId, setLabToDelete, labToDelete, handleDeleteLab,
}) => {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div><CardTitle className="text-xl">Labs</CardTitle><CardDescription className="text-sm text-muted-foreground mt-1">Define laboratory locations and view their resource/member counts.</CardDescription></div>
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
              <FilterSortDialogFooter className="mt-4 pt-4 border-t"><Button variant="ghost" onClick={resetLabDialogFiltersOnly} className="mr-auto"><FilterX className="mr-2 h-4 w-4"/>Reset</Button><Button onClick={handleApplyLabDialogFilters}><CheckCircle2 className="mr-2 h-4 w-4"/>Apply</Button></FilterSortDialogFooter>
            </FilterSortDialogContent>
          </FilterSortDialog>
          {canManageAny && <Button onClick={handleOpenNewLabDialog} size="sm"><PlusCircle className="mr-2 h-4 w-4"/>Add Lab</Button>}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoadingData && labs.length === 0 && !tempLabSearchTerm ? ( <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary mx-auto"/></div>
        ) : labs.length > 0 ? (
          <div className="overflow-x-auto rounded-b-md border">
            <TooltipProvider>
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
              <TableBody>{labs.map(lab => (
                <TableRow key={lab.id}>
                  <TableCell className="font-medium">{lab.name}</TableCell>
                  <TableCell>{lab.location || 'N/A'}</TableCell>
                  <TableCell className="text-center">{lab.resourceCount ?? 0}</TableCell>
                  <TableCell className="text-center">{lab.memberCount ?? 0}</TableCell>
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
                      <Tooltip><TooltipTrigger asChild><AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 hover:text-destructive h-8 w-8" onClick={() => setLabToDelete(lab)} disabled={isLoadingData || (lab.resourceCount ?? 0) > 0 || (lab.memberCount ?? 0) > 0}><Trash2 className="h-4 w-4"/></Button></AlertDialogTrigger></TooltipTrigger>
                      <TooltipContent>{(lab.resourceCount ?? 0) > 0 || (lab.memberCount ?? 0) > 0 ? "Cannot delete: lab has resources or members" : "Delete Lab"}</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader><AlertDialogTitle>Delete "{labToDelete?.name}"?</AlertDialogTitle><AlertDialogDescription>This cannot be undone. Ensure no resources are assigned and no members are active.</AlertDialogDescription></AlertDialogHeader>
                        <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => labToDelete && handleDeleteLab(labToDelete.id)}>Delete</AlertDialogAction></AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>}
                </TableRow>
              ))}
              </TableBody>
            </Table>
            </TooltipProvider>
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
  );
};
