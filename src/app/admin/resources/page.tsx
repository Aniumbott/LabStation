
'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { PageHeader } from '@/components/layout/page-header';
import { ClipboardList, PlusCircle, Filter as FilterIcon, FilterX, CheckCircle, AlertTriangle, Construction, CalendarPlus, Search as SearchIcon, Calendar as CalendarIcon, Loader2 } from 'lucide-react';
import type { Resource, ResourceStatus } from '@/types';
// Removed allAdminMockResources from this import as it's defined locally or will be fetched from Firestore
import { initialMockResourceTypes, labsList } from '@/lib/mock-data';
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
import { Calendar } from '@/components/ui/calendar';
import { useToast } from '@/hooks/use-toast';
import { ResourceFormDialog, ResourceFormValues } from '@/components/admin/resource-form-dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, startOfDay, isValid, parseISO, isSameDay, isWithinInterval } from 'date-fns';
import { cn } from '@/lib/utils';

// This array will be replaced by Firestore fetching in a future step.
// For now, it defines the mock resources managed by this admin page.
export const allAdminMockResources: Resource[] = [
  {
    id: 'res1',
    name: 'Keysight MSOX3054T Oscilloscope',
    resourceTypeId: 'rt1',
    resourceTypeName: 'Oscilloscope',
    lab: 'Electronics Lab 1',
    status: 'Available',
    description: 'Mixed Signal Oscilloscope with 500 MHz bandwidth, 4 analog channels, and 16 digital channels. Includes built-in waveform generator and serial protocol analysis capabilities. Ideal for debugging embedded systems and mixed-signal designs.',
    imageUrl: 'https://placehold.co/600x400.png',
    manufacturer: 'Keysight Technologies',
    model: 'MSOX3054T',
    serialNumber: 'MY58012345',
    purchaseDate: '2022-08-15T00:00:00.000Z',
    notes: 'Standard probe set included. Handle with care.',
    features: ['500 MHz Bandwidth', '4 Analog Channels', '16 Digital Channels', 'Waveform Generator', 'Serial Protocol Analysis'],
    availability: [
      { date: format(startOfDay(new Date()), 'yyyy-MM-dd'), slots: ['09:00-12:00', '13:00-17:00'] },
      { date: format(addDays(startOfDay(new Date()), 1), 'yyyy-MM-dd'), slots: ['09:00-17:00'] },
      { date: format(addDays(startOfDay(new Date()), 2), 'yyyy-MM-dd'), slots: ['10:00-15:00'] },
    ],
    unavailabilityPeriods: [
      { id: 'unavail1-1', startDate: format(addDays(startOfDay(new Date()), 10), 'yyyy-MM-dd'), endDate: format(addDays(startOfDay(new Date()), 15), 'yyyy-MM-dd'), reason: "Annual Calibration" }
    ],
    remoteAccess: {
      hostname: "scope-01.lab.internal",
      protocol: "VNC",
      notes: "Requires Lab VPN access."
    },
    allowQueueing: true,
  },
  {
    id: 'res2',
    name: 'Rigol DP832 Programmable Power Supply',
    resourceTypeId: 'rt2',
    resourceTypeName: 'Power Supply',
    lab: 'Electronics Lab 1',
    status: 'Booked',
    description: 'Triple output programmable DC power supply with high resolution and advanced features. CH1: 0-30V/0-3A, CH2: 0-30V/0-3A, CH3: 0-5V/0-3A.',
    imageUrl: 'https://placehold.co/600x400.png',
    manufacturer: 'Rigol Technologies',
    model: 'DP832',
    serialNumber: 'DP8A20123456',
    purchaseDate: '2021-05-20T00:00:00.000Z',
    notes: 'Ensure load is disconnected before changing voltage settings.',
    features: ['Triple Output', 'Programmable', 'High Resolution Display', 'Over-Voltage/Current Protection'],
    availability: [
       { date: format(startOfDay(new Date()), 'yyyy-MM-dd'), slots: ['09:00-11:00'] }, // Booked later today
       { date: format(addDays(startOfDay(new Date()), 1), 'yyyy-MM-dd'), slots: ['09:00-17:00'] },
    ],
    allowQueueing: true,
  },
  {
    id: 'res3',
    name: 'Siglent SDG2042X Function Generator',
    resourceTypeId: 'rt3',
    resourceTypeName: 'Function Generator',
    lab: 'RF Lab',
    status: 'Available',
    description: 'Dual-channel arbitrary waveform generator with 40 MHz bandwidth and 1.2 GSa/s sampling rate. TrueArb & EasyPulse technology.',
    imageUrl: 'https://placehold.co/600x400.png',
    manufacturer: 'Siglent Technologies',
    model: 'SDG2042X',
    serialNumber: 'SDG2XBADCAFE',
    purchaseDate: '2023-01-10T00:00:00.000Z',
    notes: 'BNC cables available separately.',
    features: ['40 MHz Max Output Frequency', 'Dual Channel', '1.2 GSa/s Sample Rate', '16-bit Vertical Resolution'],
    unavailabilityPeriods: [
      { id: 'unavail3-1', startDate: format(addDays(startOfDay(new Date()), 5), 'yyyy-MM-dd'), endDate: format(addDays(startOfDay(new Date()), 7), 'yyyy-MM-dd'), reason: "Output Amplifier Repair" }
    ],
    allowQueueing: false,
  },
  {
    id: 'res4',
    name: 'Weller WE1010NA Digital Soldering Station',
    resourceTypeId: 'rt6',
    resourceTypeName: 'Soldering Station',
    lab: 'Prototyping Lab',
    status: 'Maintenance',
    description: '70W digital soldering station with temperature control. Ideal for professional soldering tasks and electronics assembly.',
    imageUrl: 'https://placehold.co/600x400.png',
    manufacturer: 'Weller',
    model: 'WE1010NA',
    serialNumber: 'WEA1B2C3D4',
    purchaseDate: '2020-11-01T00:00:00.000Z',
    notes: 'Remember to tin the tip after use. Various tip sizes available.',
    features: ['70W Power', 'Digital Temperature Control', 'ESD Safe', 'Heat-resistant Silicon Cable'],
    allowQueueing: false,
  },
  {
    id: 'res5',
    name: 'Rohde & Schwarz FPC1500 Spectrum Analyzer',
    resourceTypeId: 'rt4',
    resourceTypeName: 'Spectrum Analyzer',
    lab: 'RF Lab',
    status: 'Available',
    description: 'Spectrum Analyzer, 5 kHz to 1 GHz, upgradeable to 3 GHz. Features tracking generator and vector network analysis capabilities.',
    imageUrl: 'https://placehold.co/600x400.png',
    manufacturer: 'Rohde & Schwarz',
    model: 'FPC1500',
    serialNumber: 'RSFPC1500-001',
    purchaseDate: '2023-03-01T00:00:00.000Z',
    notes: 'Handle RF connectors with care. Use torque wrench if specified.',
    features: ['5 kHz to 1 GHz (Upgradeable)', 'Tracking Generator', 'Vector Network Analysis Option', '10.1-inch WXGA Display'],
    availability: [
      { date: format(startOfDay(new Date()), 'yyyy-MM-dd'), slots: ['14:00-17:00'] },
      { date: format(addDays(startOfDay(new Date()), 3), 'yyyy-MM-dd'), slots: ['09:00-12:00', '13:00-16:00'] },
    ],
    allowQueueing: true,
  },
   {
    id: 'res6',
    name: 'FPGA Dev Node Alpha',
    resourceTypeId: 'rt9', // Assuming rt9 is 'FPGA Development Board' or similar
    resourceTypeName: 'FPGA Development Board',
    lab: 'Prototyping Lab',
    status: 'Available',
    description: 'High-performance FPGA development node with Zynq UltraScale+ MPSoC. Suitable for hardware acceleration and embedded vision projects.',
    imageUrl: 'https://placehold.co/600x400.png',
    manufacturer: 'Xilinx',
    model: 'ZCU102 Evaluation Kit',
    serialNumber: 'XADCZCU102-9876',
    purchaseDate: '2023-06-01T00:00:00.000Z',
    notes: 'Access via SSH. Ensure Vivado version compatibility.',
    features: ['Zynq UltraScale+ MPSoC', 'DDR4 Memory', 'Multiple Peripherals', 'FMC Expansion'],
    remoteAccess: {
      hostname: "fpga-alpha.lab.internal",
      protocol: "SSH",
      username: "labuser",
      notes: "Default password 'fpgaUserPass'. Please change on first use."
    },
    availability: [
        { date: format(startOfDay(new Date()), 'yyyy-MM-dd'), slots: ['09:00-17:00'] },
    ],
    allowQueueing: true,
  },
];


const getStatusBadge = (status: ResourceStatus) => {
  switch (status) {
    case 'Available':
      return <Badge className={cn("bg-green-500 hover:bg-green-600 text-white border-transparent")}><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Booked':
      return <Badge className={cn("bg-yellow-500 hover:bg-yellow-600 text-yellow-950 border-transparent")}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    case 'Maintenance':
      return <Badge className={cn("bg-orange-500 hover:bg-orange-600 text-white border-transparent")}><Construction className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    default:
      return <Badge variant="outline"><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
  }
};

export default function AdminResourcesPage() {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [resources, setResources] = useState<Resource[]>(() => JSON.parse(JSON.stringify(allAdminMockResources)));
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [editingResource, setEditingResource] = useState<Resource | null>(null);

  // Active filters for the page
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeFilterTypeId, setActiveFilterTypeId] = useState<string>('all');
  const [activeFilterLab, setActiveFilterLab] = useState<string>('all');
  const [activeSelectedDate, setActiveSelectedDate] = useState<Date | undefined>(undefined);

  // Filter Dialog State
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  const [tempSearchTerm, setTempSearchTerm] = useState(activeSearchTerm);
  const [tempFilterTypeId, setTempFilterTypeId] = useState<string>(activeFilterTypeId);
  const [tempFilterLab, setTempFilterLab] = useState<string>(activeFilterLab);
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | undefined>(activeSelectedDate);
  const [currentMonthInDialog, setCurrentMonthInDialog] = useState<Date>(startOfDay(new Date()));


  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempFilterTypeId(activeFilterTypeId);
      setTempFilterLab(activeFilterLab);
      setTempSelectedDate(activeSelectedDate);
      setCurrentMonthInDialog(activeSelectedDate || startOfDay(new Date()));
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeFilterTypeId, activeFilterLab, activeSelectedDate]);

  const filteredResources = useMemo(() => {
    let currentResources = [...resources];
    const lowerSearchTerm = activeSearchTerm.toLowerCase();
    if (activeSearchTerm) {
      currentResources = currentResources.filter(resource =>
        resource.name.toLowerCase().includes(lowerSearchTerm) ||
        (resource.description && resource.description.toLowerCase().includes(lowerSearchTerm)) ||
        (resource.manufacturer && resource.manufacturer.toLowerCase().includes(lowerSearchTerm)) ||
        (resource.model && resource.model.toLowerCase().includes(lowerSearchTerm))
      );
    }
    if (activeFilterTypeId !== 'all') {
      currentResources = currentResources.filter(resource => resource.resourceTypeId === activeFilterTypeId);
    }
    if (activeFilterLab !== 'all') {
      currentResources = currentResources.filter(resource => resource.lab === activeFilterLab);
    }
    if (activeSelectedDate) {
      const dateToFilterStr = format(startOfDay(activeSelectedDate), 'yyyy-MM-dd');
      currentResources = currentResources.filter(resource => {
        if (resource.status !== 'Available') return false;

        // Check resource-specific unavailability periods
        const isUnavailableDueToPeriod = resource.unavailabilityPeriods?.some(period => {
            const periodStart = startOfDay(parseISO(period.startDate));
            const periodEnd = startOfDay(parseISO(period.endDate));
            return isSameDay(startOfDay(activeSelectedDate), periodStart) || isSameDay(startOfDay(activeSelectedDate), periodEnd) || isWithinInterval(startOfDay(activeSelectedDate), { start: periodStart, end: periodEnd });
        });
        if (isUnavailableDueToPeriod) return false;
        
        // Check daily availability slots
        const dayAvailability = resource.availability?.find(avail => avail.date === dateToFilterStr);
        return dayAvailability && dayAvailability.slots.length > 0;
      });
    }
    return currentResources.sort((a,b) => a.name.localeCompare(b.name));
  }, [resources, activeSearchTerm, activeFilterTypeId, activeFilterLab, activeSelectedDate]);

  const handleApplyDialogFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveFilterTypeId(tempFilterTypeId);
    setActiveFilterLab(tempFilterLab);
    setActiveSelectedDate(tempSelectedDate);
    setIsFilterDialogOpen(false);
  };

  const resetDialogFilters = () => {
    setTempSearchTerm('');
    setTempFilterTypeId('all');
    setTempFilterLab('all');
    setTempSelectedDate(undefined);
    setCurrentMonthInDialog(startOfDay(new Date()));
  };

  const resetAllActivePageFilters = () => {
    setActiveSearchTerm('');
    setActiveFilterTypeId('all');
    setActiveFilterLab('all');
    setActiveSelectedDate(undefined);
    resetDialogFilters();
    setIsFilterDialogOpen(false);
  };


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
      const updatedResource: Resource = {
        ...editingResource,
        ...data,
        imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
        resourceTypeName: resourceType.name,
        features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
        purchaseDate: data.purchaseDate && isValid(parseISO(data.purchaseDate)) ? parseISO(data.purchaseDate).toISOString() : editingResource.purchaseDate,
        remoteAccess: data.remoteAccess && Object.values(data.remoteAccess).some(v => v !== undefined && v !== '') ? {
          ...data.remoteAccess,
          port: data.remoteAccess.port, // Ensure port is handled as number or undefined
        } : undefined,
        // Keep existing availability and unavailability unless specifically managed elsewhere
        availability: editingResource.availability || [], 
        unavailabilityPeriods: editingResource.unavailabilityPeriods || [],
      };
      
      const updatedResources = resources.map(r => r.id === editingResource.id ? updatedResource : r);
      setResources(updatedResources);
      
      const globalIndex = allAdminMockResources.findIndex(r => r.id === editingResource.id);
      if (globalIndex !== -1) allAdminMockResources[globalIndex] = updatedResource;

      toast({
        title: 'Resource Updated',
        description: `Resource "${data.name}" has been updated.`,
      });
    } else {
      const newResource: Resource = {
        id: `res${allAdminMockResources.length + 1 + Date.now()}`,
        name: data.name,
        resourceTypeId: data.resourceTypeId,
        resourceTypeName: resourceType.name,
        lab: data.lab,
        status: data.status,
        description: data.description || '',
        imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
        manufacturer: data.manufacturer || undefined,
        model: data.model || undefined,
        serialNumber: data.serialNumber || undefined,
        purchaseDate: data.purchaseDate && isValid(parseISO(data.purchaseDate)) ? parseISO(data.purchaseDate).toISOString() : undefined,
        notes: data.notes || undefined,
        features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
        availability: [], 
        unavailabilityPeriods: [],
        remoteAccess: data.remoteAccess && Object.values(data.remoteAccess).some(v => v !== undefined && v !== '') ? {
           ...data.remoteAccess,
           port: data.remoteAccess.port, // Ensure port is handled as number or undefined
        } : undefined,
        allowQueueing: data.status === 'Available', // Example: default to true if available
      };
      const updatedResources = [...resources, newResource].sort((a,b) => a.name.localeCompare(b.name));
      setResources(updatedResources);
      allAdminMockResources.push(newResource); 
      allAdminMockResources.sort((a,b) => a.name.localeCompare(b.name));
      toast({
        title: 'Resource Created',
        description: `Resource "${data.name}" has been created.`,
      });
    }
    setIsFormDialogOpen(false);
    setEditingResource(null);
  };

  const activeFilterCount = [activeSearchTerm !== '', activeFilterTypeId !== 'all', activeFilterLab !== 'all', activeSelectedDate !== undefined].filter(Boolean).length;
  const canAddResources = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Lab Manager');

  return (
    <div className="space-y-8">
      <PageHeader
        title="Resources"
        description="Browse, filter, and manage all lab resources. Click resource name for details & edit actions."
        icon={ClipboardList}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
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
              <DialogContent className="w-full max-w-xs sm:max-w-sm md:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Filter Resources</DialogTitle>
                  <DialogDescription>
                    Refine the list of available lab resources.
                  </DialogDescription>
                </DialogHeader>
                <Separator className="my-4" />
                <ScrollArea className="max-h-[65vh] pr-2">
                <div className="space-y-6 py-1">
                  <div>
                    <Label htmlFor="resourceSearchDialog" className="text-sm font-medium mb-1 block">Search (Name/Keyword)</Label>
                    <div className="relative">
                        <SearchIcon className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                        id="resourceSearchDialog"
                        type="search"
                        placeholder="Name, manufacturer, model..."
                        value={tempSearchTerm}
                        onChange={(e) => setTempSearchTerm(e.target.value.toLowerCase())}
                        className="h-9 pl-8"
                        />
                    </div>
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
                                    <FilterX className="mr-2 h-4 w-4" /> Clear Date Selection
                                </Button>
                            }
                            classNames={{ caption_label: "text-base font-semibold", day: "h-10 w-10", head_cell: "w-10" }}
                        />
                      </div>
                  </div>
                </div>
                </ScrollArea>
                <DialogFooter className="pt-6 border-t">
                   <Button variant="ghost" onClick={resetDialogFilters} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset Dialog Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyDialogFilters}>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
            {canAddResources && (
                <Button onClick={handleOpenNewDialog}>
                  <PlusCircle className="mr-2 h-4 w-4" /> Add
                </Button>
            )}
          </div>
        }
      />

      {filteredResources.length > 0 ? (
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
                      variant="default"
                      disabled={resource.status !== 'Available'}
                      className="h-8 text-xs"
                    >
                      <Link href={`/bookings?resourceId=${resource.id}${activeSelectedDate ? `&date=${format(activeSelectedDate, 'yyyy-MM-dd')}`: ''}`}>
                        <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />
                        Book
                      </Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ) : (
         <Card className="text-center py-10 text-muted-foreground bg-card border-0 shadow-none">
          <CardContent>
            <ClipboardList className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p className="text-lg font-medium">
                {activeFilterCount > 0 ? "No Resources Match Filters" : "No Resources Found"}
            </p>
            <p className="text-sm mb-4">
                {activeFilterCount > 0
                    ? "Try adjusting your search or filter criteria."
                    : (canAddResources ? "There are currently no resources in the catalog. Add one to get started!" : "There are currently no resources in the system.")
                }
            </p>
            {activeFilterCount > 0 ? (
                <Button variant="outline" onClick={resetAllActivePageFilters}>
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                </Button>
            ) : (
              !filteredResources.length && canAddResources && (
                <Button onClick={handleOpenNewDialog}>
                    <PlusCircle className="mr-2 h-4 w-4" /> Add First Resource
                </Button>
              )
            )}
          </CardContent>
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
      />
    </div>
  );
}
