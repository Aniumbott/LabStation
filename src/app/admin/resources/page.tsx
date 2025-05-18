
'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { ClipboardList, PlusCircle, Filter as FilterIcon, FilterX, CheckCircle, AlertTriangle, Construction, CalendarDays, CalendarPlus, Network } from 'lucide-react';
import type { Resource, ResourceType, ResourceStatus, RemoteAccessDetails } from '@/types'; // Added RemoteAccessDetails
import { initialMockResourceTypes } from '@/app/admin/resource-types/page';
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
  // AlertDialogTrigger, // No longer directly used from here for delete
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { ResourceFormDialog, ResourceFormValues } from '@/components/admin/resource-form-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format, startOfDay, isSameDay, addDays, parseISO, isValid } from 'date-fns';

const todayStr = format(new Date(), 'yyyy-MM-dd');
const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
const dayAfterTomorrowStr = format(addDays(new Date(), 2), 'yyyy-MM-dd');


export const allAdminMockResources: Resource[] = [
  {
    id: '1',
    name: 'Electron Microscope Alpha',
    resourceTypeId: 'rt1',
    resourceTypeName: 'Microscope',
    lab: 'Lab A',
    status: 'Available',
    manufacturer: 'Thermo Fisher Scientific',
    model: 'Quanta SEM',
    serialNumber: 'SN-EMA-001',
    purchaseDate: '2022-08-15',
    description: 'High-resolution scanning electron microscope (SEM) designed for advanced material analysis, biological sample imaging, and nanoparticle characterization. Features multiple detectors for secondary electron, backscattered electron, and X-ray microanalysis (EDX). User-friendly software interface with automated functions for ease of use. Ideal for both novice and experienced users requiring detailed surface morphology and elemental composition data.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'microscope electronics',
    features: ['High Vacuum Mode', 'Low Vacuum Mode', 'EDX Spectroscopy', 'Automated Stage Control', 'Image Stitching'],
    lastCalibration: '2023-12-01',
    nextCalibration: '2024-06-01',
    availability: [
      { date: todayStr, slots: ['14:00-16:00', '16:00-18:00'] },
      { date: tomorrowStr, slots: ['10:00-12:00'] }
    ],
    notes: 'Handle with care. Requires 30 min warm-up time before use.',
    remoteAccess: {
      ipAddress: '192.168.1.101',
      protocol: 'RDP',
      username: 'sem_user',
      notes: 'Access via internal VPN only. Default password: "password123" (change on first login).'
    }
  },
  {
    id: '2',
    name: 'BioSafety Cabinet Omega',
    resourceTypeId: 'rt4', // Incubator
    resourceTypeName: 'Incubator',
    lab: 'Lab B',
    status: 'Booked',
    manufacturer: 'Baker Company',
    model: 'SterilGARD e3',
    serialNumber: 'SN-BSC-002',
    purchaseDate: '2023-01-20',
    description: 'Class II Type A2 biosafety cabinet providing personnel, product, and environmental protection for work with biological agents up to BSL-3. Features HEPA filtration, ergonomic design, and intuitive controls for safe and efficient sterile work. Equipped with UV light for decontamination cycles. Suitable for cell culture, microbiology, and other sensitive applications.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'lab cabinet',
    features: ['HEPA Filtered Airflow', 'UV Decontamination Cycle', 'Adjustable Sash Height', 'Airflow Alarm System', 'Quiet Operation'],
    lastCalibration: '2024-01-15',
    nextCalibration: '2024-07-15',
    availability: [
      { date: tomorrowStr, slots: ['09:00-11:00', '11:00-13:00'] },
      { date: dayAfterTomorrowStr, slots: ['Full Day Booked'] }
    ],
    notes: 'UV light cycle runs automatically after each use. Ensure sash is fully closed.'
  },
   {
    id: '3',
    name: 'HPLC System Zeta',
    resourceTypeId: 'rt3', // HPLC System
    resourceTypeName: 'HPLC System',
    lab: 'Lab C',
    status: 'Maintenance',
    manufacturer: 'Agilent Technologies',
    model: '1260 Infinity II',
    serialNumber: 'SN-HPLC-003',
    purchaseDate: '2021-05-10',
    description: 'Versatile high-performance liquid chromatography (HPLC) system for analytical and semi-preparative applications.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'hplc chemistry',
    features: ['Quaternary Solvent Delivery', 'Autosampler', 'DAD Detector'],
    lastCalibration: '2023-11-10',
    nextCalibration: '2024-05-10',
    availability: [],
  },
  {
    id: '4',
    name: 'High-Speed Centrifuge Pro',
    resourceTypeId: 'rt2', // Centrifuge
    resourceTypeName: 'Centrifuge',
    lab: 'Lab A',
    status: 'Available',
    manufacturer: 'Eppendorf',
    model: '5810R',
    serialNumber: 'SN-CENT-004',
    purchaseDate: '2023-06-05',
    description: 'Refrigerated high-speed centrifuge for various applications.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'centrifuge science',
    features: ['Refrigerated', 'Max 20,000 RPM'],
    lastCalibration: '2024-02-20',
    nextCalibration: '2024-08-20',
    availability: [
      { date: todayStr, slots: ['09:00-17:00'] },
      { date: dayAfterTomorrowStr, slots: ['10:00-12:00', '14:00-16:00'] }
    ]
  },
  {
    id: 'rt8-instance',
    name: 'FPGA Dev Node Alpha',
    resourceTypeId: 'rt8',
    resourceTypeName: 'FPGA Node',
    lab: 'Lab C',
    status: 'Available',
    manufacturer: 'Xilinx',
    model: 'Alveo U250',
    serialNumber: 'XFL-FPGA-01A',
    purchaseDate: '2023-09-01',
    description: 'High-performance FPGA node for compute acceleration and custom hardware development. Suitable for machine learning, video processing, and financial computing.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'fpga circuit board',
    features: ['PCIe Gen3 x16', '28GB HBM2', 'On-board DDR4'],
    lastCalibration: 'N/A',
    nextCalibration: 'N/A',
    availability: [
        { date: todayStr, slots: ['09:00-12:00', '13:00-17:00'] },
        { date: tomorrowStr, slots: ['09:00-17:00'] },
    ],
    notes: 'Requires Vivado Design Suite for development.',
    remoteAccess: {
        hostname: 'fpga-node-alpha.lab.internal',
        protocol: 'SSH',
        username: 'dev_user',
        port: 22,
        notes: 'Access restricted to lab network. Key-based authentication required.'
    }
  },
];

const labsList: Resource['lab'][] = ['Lab A', 'Lab B', 'Lab C', 'General Lab'];
const resourceStatusesList: ResourceStatus[] = ['Available', 'Booked', 'Maintenance'];

const getStatusBadge = (status: ResourceStatus) => {
  switch (status) {
    case 'Available':
      return <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent"><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Booked':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950 border-transparent"><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Maintenance':
      return <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-transparent"><Construction className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default:
      return <Badge variant="outline"><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
  }
};

export default function ManageResourcesPage() {
  const { toast } = useToast();
  // This state will hold a deep copy of the mock resources for client-side modifications
  const [resources, setResources] = useState<Resource[]>(() => JSON.parse(JSON.stringify(allAdminMockResources)));
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  // Active filters
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterTypeId, setActiveFilterTypeId] = useState<string>('all'); // Store type ID now
  const [activeFilterLab, setActiveFilterLab] = useState<string>('all');
  const [activeSelectedDate, setActiveSelectedDate] = useState<Date | undefined>(undefined);

  // Temp filters for Dialog
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempFilterTypeId, setTempFilterTypeId] = useState<string>('all');
  const [tempFilterLab, setTempFilterLab] = useState<string>('all');
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonthInDialog, setCurrentMonthInDialog] = useState<Date>(startOfDay(new Date()));
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);

  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterTypeId(activeFilterTypeId);
      setTempFilterLab(activeFilterLab);
      setTempSelectedDate(activeSelectedDate);
      if (activeSelectedDate) setCurrentMonthInDialog(activeSelectedDate); else setCurrentMonthInDialog(startOfDay(new Date()));
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterTypeId, activeFilterLab, activeSelectedDate]);

  const filteredResources = useMemo(() => {
    let currentResources = [...resources];
    if (activeSearchTerm) {
      currentResources = currentResources.filter(resource =>
        resource.name.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
        (resource.description && resource.description.toLowerCase().includes(activeSearchTerm.toLowerCase())) ||
        (resource.manufacturer && resource.manufacturer.toLowerCase().includes(activeSearchTerm.toLowerCase())) ||
        (resource.model && resource.model.toLowerCase().includes(activeSearchTerm.toLowerCase()))
      );
    }
    if (activeFilterTypeId !== 'all') {
      currentResources = currentResources.filter(resource => resource.resourceTypeId === activeFilterTypeId);
    }
    if (activeFilterLab !== 'all') {
      currentResources = currentResources.filter(resource => resource.lab === activeFilterLab);
    }
    if (activeSelectedDate) {
      const dateStrToFilter = format(activeSelectedDate, 'yyyy-MM-dd');
      currentResources = currentResources.filter(resource =>
        resource.availability?.some(avail => avail.date === dateStrToFilter && avail.slots.length > 0 && !avail.slots.includes('Full Day Booked')) && resource.status === 'Available'
      );
    }
    return currentResources.sort((a,b) => a.name.localeCompare(b.name));
  }, [resources, activeSearchTerm, activeFilterTypeId, activeFilterLab, activeSelectedDate]);

  const handleApplyFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterTypeId(tempFilterTypeId);
    setActiveFilterLab(tempFilterLab);
    setActiveSelectedDate(tempSelectedDate);
    setIsFilterDialogOpen(false);
  };

  const resetFilters = () => {
    // Reset temp filters in dialog
    setTempSearchTerm('');
    setTempFilterTypeId('all');
    setTempFilterLab('all');
    setTempSelectedDate(undefined);
    setCurrentMonthInDialog(startOfDay(new Date()));
    // To actually clear active filters and update list, call handleApplyFilters after reset
    // or reset active filters directly here if preferred. For now, this just resets dialog state.
  };

  const resetAllActiveFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterTypeId('all');
    setActiveFilterLab('all');
    setActiveSelectedDate(undefined);
    // also reset temp filters to match
    resetFilters();
  }


  const handleOpenNewDialog = () => {
    setEditingResource(null);
    setIsFormDialogOpen(true);
  };

  const handleSaveResource = (data: ResourceFormValues) => {
    const resourceType = initialMockResourceTypes.find(rt => rt.id === data.resourceTypeId);
    if (!resourceType) {
        toast({ title: "Error", description: "Selected resource type not found.", variant: "destructive"});
        return;
    }

    if (editingResource) {
      setResources(prevResources => prevResources.map(r => r.id === editingResource.id ? {
        ...editingResource,
        ...data,
        name: data.name,
        resourceTypeId: data.resourceTypeId,
        resourceTypeName: resourceType.name,
        lab: data.lab,
        status: data.status,
        description: data.description || '',
        imageUrl: data.imageUrl || 'https://placehold.co/300x200.png',
        dataAiHint: data.dataAiHint || 'lab equipment',
        manufacturer: data.manufacturer || undefined,
        model: data.model || undefined,
        serialNumber: data.serialNumber || undefined,
        purchaseDate: data.purchaseDate ? parseISO(data.purchaseDate).toISOString() : undefined,
        notes: data.notes || undefined,
        features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
        // Keep existing availability & calibration unless form is extended to edit these
        availability: editingResource.availability,
        lastCalibration: editingResource.lastCalibration,
        nextCalibration: editingResource.nextCalibration,
        remoteAccess: data.remoteAccess && Object.values(data.remoteAccess).some(v => v !== '' && v !== undefined) ? {
          ...data.remoteAccess,
          port: data.remoteAccess.port ? Number(data.remoteAccess.port) : undefined,
        } : undefined,
      } : r));
      toast({
        title: 'Resource Updated',
        description: `Resource "${data.name}" has been updated.`,
      });
    } else {
      const newResource: Resource = {
        id: `res${resources.length + 1 + Date.now()}`,
        ...data,
        name: data.name,
        resourceTypeId: data.resourceTypeId,
        resourceTypeName: resourceType.name,
        lab: data.lab,
        status: data.status,
        description: data.description || '',
        imageUrl: data.imageUrl || 'https://placehold.co/300x200.png',
        dataAiHint: data.dataAiHint || 'lab equipment',
        manufacturer: data.manufacturer || undefined,
        model: data.model || undefined,
        serialNumber: data.serialNumber || undefined,
        purchaseDate: data.purchaseDate ? parseISO(data.purchaseDate).toISOString() : undefined,
        notes: data.notes || undefined,
        features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
        availability: [],
        lastCalibration: undefined, // Or prompt user / set default
        nextCalibration: undefined, // Or prompt user / set default
        remoteAccess: data.remoteAccess && Object.values(data.remoteAccess).some(v => v !== '' && v !== undefined) ? {
          ...data.remoteAccess,
          port: data.remoteAccess.port ? Number(data.remoteAccess.port) : undefined,
        } : undefined,
      };
      setResources(prevResources => [...prevResources, newResource]);
      toast({
        title: 'Resource Created',
        description: `Resource "${data.name}" has been created.`,
      });
    }
    setIsFormDialogOpen(false);
    setEditingResource(null);
  };

  // Note: Delete functionality is now primarily on the detail page.
  // This can be removed if not used by a global delete confirmation dialog.

  const activeFilterCount = [activeSearchTerm !== '', activeFilterTypeId !== 'all', activeFilterLab !== 'all', activeSelectedDate !== undefined].filter(Boolean).length;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Manage Resources"
        description="Browse, filter, and manage all lab resources. Click resource name for details and admin actions."
        icon={ClipboardList}
        actions={
          <div className="flex items-center gap-2">
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
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Filter Resources</DialogTitle>
                  <DialogDescription>
                    Refine the list of available lab resources.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <div className="space-y-6 max-h-[65vh] overflow-y-auto pr-2">
                  <div>
                    <Label htmlFor="resourceSearchDialog" className="text-sm font-medium mb-1 block">Search by Name/Keyword</Label>
                    <Input
                      id="resourceSearchDialog"
                      type="search"
                      placeholder="Name, manufacturer, model..."
                      value={tempSearchTerm}
                      onChange={(e) => setTempSearchTerm(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <Separator />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="resourceTypeFilterDialog" className="text-sm font-medium mb-1 block">Type</Label>
                      <Select value={tempFilterTypeId} onValueChange={setTempFilterTypeId}>
                        <SelectTrigger id="resourceTypeFilterDialog" className="h-9"><SelectValue placeholder="Filter by Type" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {initialMockResourceTypes.map(type => (
                            <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="resourceLabFilterDialog" className="text-sm font-medium mb-1 block">Lab</Label>
                      <Select value={tempFilterLab} onValueChange={setTempFilterLab}>
                        <SelectTrigger id="resourceLabFilterDialog" className="h-9"><SelectValue placeholder="Filter by Lab" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Labs</SelectItem>
                          {labsList.map(lab => (
                            <SelectItem key={lab} value={lab}>{lab}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Separator />
                  <div>
                      <Label className="text-sm font-medium mb-2 block">Available On</Label>
                      <div className="flex justify-center items-center rounded-md border p-2">
                        <Calendar
                            mode="single"
                            selected={tempSelectedDate}
                            onSelect={setTempSelectedDate}
                            month={currentMonthInDialog}
                            onMonthChange={setCurrentMonthInDialog}
                            disabled={(date) => date < startOfDay(new Date()) }
                            footer={ tempSelectedDate &&
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setTempSelectedDate(undefined)}
                                    className="w-full mt-2 text-xs"
                                >
                                    Clear Date Selection
                                </Button>
                            }
                            classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }}
                        />
                      </div>
                  </div>
                </div>
                <DialogFooter className="pt-6">
                   <Button variant="ghost" onClick={() => { resetFilters(); }} className="mr-auto"> {/* Reset only temp filters */}
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyFilters}>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            <Button onClick={handleOpenNewDialog}>
              <PlusCircle className="mr-2 h-4 w-4" /> Add New Resource
            </Button>
          </div>
        }
      />

      {filteredResources.length > 0 ? (
        <TooltipProvider>
        <div className="overflow-x-auto rounded-lg border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Image</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Lab</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right w-[150px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredResources.map((resource) => (
                <TableRow key={resource.id}>
                  <TableCell>
                    <Link href={`/resources/${resource.id}`}>
                      <Image
                          src={resource.imageUrl || 'https://placehold.co/100x100.png'}
                          alt={resource.name}
                          width={40} height={40}
                          className="rounded-md object-cover h-10 w-10 hover:opacity-80 transition-opacity"
                          data-ai-hint={resource.dataAiHint || 'lab equipment'}
                      />
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">
                     <Link href={`/resources/${resource.id}`} className="hover:text-primary hover:underline">
                        {resource.name}
                     </Link>
                  </TableCell>
                  <TableCell>{resource.resourceTypeName}</TableCell>
                  <TableCell>{resource.lab}</TableCell>
                  <TableCell>{getStatusBadge(resource.status)}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      asChild
                      size="sm"
                      variant={resource.status !== 'Available' ? "outline" : "default"}
                      disabled={resource.status !== 'Available'}
                      className="h-8 text-xs"
                    >
                      <Link href={`/bookings?resourceId=${resource.id}${activeSelectedDate ? `&date=${format(activeSelectedDate, 'yyyy-MM-dd')}`: ''}`}>
                        <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                        {resource.status === 'Available' ? 'Book' : resource.status}
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        </TooltipProvider>
      ) : (
         <Card className="text-center py-10 text-muted-foreground bg-card rounded-lg border shadow-sm">
          <ClipboardList className="mx-auto h-12 w-12 mb-4" />
           <p className="text-lg font-medium">
            {activeFilterCount > 0 ? "No Resources Match Filters" : "No Resources Found"}
          </p>
          <p className="text-sm mb-4">
            {activeFilterCount > 0
                ? "Try adjusting your search or filter criteria."
                : "There are currently no resources in the catalog. Add one to get started!"
            }
          </p>
          {activeFilterCount > 0 ? (
             <Button variant="outline" onClick={() => { resetAllActiveFilters(); setIsFilterDialogOpen(false); }}>
                <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
            </Button>
          ) : (
            <Button onClick={handleOpenNewDialog}>
                <PlusCircle className="mr-2 h-4 w-4" /> Add First Resource
            </Button>
          )}
        </Card>
      )}
      <ResourceFormDialog
        open={isFormDialogOpen}
        onOpenChange={(isOpen) => {
            setIsFormDialogOpen(isOpen);
            if (!isOpen) setEditingResource(null);
        }}
        initialResource={editingResource}
        onSave={handleSaveResource}
        resourceTypes={initialMockResourceTypes}
        labs={labsList}
        statuses={resourceStatusesList}
      />

      {/* Delete confirmation dialog is handled on the resource detail page */}
    </div>
  );
}
