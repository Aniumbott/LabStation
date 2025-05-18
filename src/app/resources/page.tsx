
'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, CalendarPlus, Filter as FilterIcon, FilterX, CalendarDays, CheckCircle, AlertTriangle, Construction, ChevronRight, ListChecks, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Resource, ResourceType as AppResourceType } from '@/types'; // Renamed to avoid conflict
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
import { format, addDays, parseISO, isValid, startOfDay, isSameDay } from 'date-fns';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';

const todayStr = format(new Date(), 'yyyy-MM-dd');
const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
const dayAfterTomorrowStr = format(addDays(new Date(), 2), 'yyyy-MM-dd');

// Mock Resource Types (these would ideally come from a data store or the new admin page)
const mockResourceTypes: AppResourceType[] = [
  { id: 'rt1', name: 'Microscope', description: 'Optical and electron microscopes for various imaging needs.' },
  { id: 'rt2', name: 'Centrifuge', description: 'For separating substances of different densities.' },
  { id: 'rt3', name: 'HPLC System', description: 'High-Performance Liquid Chromatography systems.' },
  { id: 'rt4', name: 'Incubator', description: 'Controlled environment for biological cultures.' },
  { id: 'rt5', name: 'Fume Hood', description: 'Ventilated enclosure for safe handling of hazardous materials.' },
  { id: 'rt6', name: 'Spectrometer', description: 'Measures properties of light over a specific portion of the electromagnetic spectrum.' },
];

export const allMockResources: Resource[] = [
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
    notes: 'Handle with care. Requires 30 min warm-up time before use.'
  },
  {
    id: '2',
    name: 'BioSafety Cabinet Omega',
    resourceTypeId: 'rt4',
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
    resourceTypeId: 'rt3',
    resourceTypeName: 'HPLC System',
    lab: 'Lab C',
    status: 'Maintenance',
    manufacturer: 'Agilent Technologies',
    model: '1260 Infinity II',
    serialNumber: 'SN-HPLC-003',
    purchaseDate: '2021-05-10',
    description: 'Versatile high-performance liquid chromatography (HPLC) system for analytical and semi-preparative applications. Equipped with a quaternary pump, autosampler, column thermostat, and a diode array detector (DAD) for comprehensive compound analysis. Software provides full system control, data acquisition, and processing capabilities. Currently undergoing scheduled maintenance.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'hplc chemistry',
    features: ['Quaternary Solvent Delivery', 'Autosampler (120 vial capacity)', 'Column Thermostatting (5-80°C)', 'Diode Array Detector (190-800nm)', 'Fraction Collector (Optional)'],
    lastCalibration: '2023-11-10',
    nextCalibration: '2024-05-10', // Past due for maintenance
    availability: [],
    notes: 'System offline for preventative maintenance until further notice. Contact lab manager for updates.'
  },
  {
    id: '4',
    name: 'High-Speed Centrifuge Pro',
    resourceTypeId: 'rt2',
    resourceTypeName: 'Centrifuge',
    lab: 'Lab A',
    status: 'Available',
    manufacturer: 'Eppendorf',
    model: 'Centrifuge 5810R',
    serialNumber: 'SN-CENT-004',
    purchaseDate: '2023-06-05',
    description: 'Refrigerated high-speed centrifuge designed for a wide range of applications including pelleting, protein purification, and DNA/RNA isolation. Offers precise temperature control and interchangeable rotors for various sample volumes and g-forces up to 25,000 x g. User-friendly interface with programmable protocols.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'centrifuge science',
    features: ['Refrigerated (-20°C to 40°C)', 'Max Speed: 20,000 RPM', 'Multiple Fixed-Angle Rotors', 'Swinging Bucket Rotor Option', 'Programmable Memory'],
    lastCalibration: '2024-02-20',
    nextCalibration: '2024-08-20',
    availability: [
      { date: todayStr, slots: ['09:00-17:00'] },
      { date: dayAfterTomorrowStr, slots: ['10:00-12:00', '14:00-16:00'] }
    ]
  },
  {
    id: '5',
    name: 'Confocal Microscope Zeiss',
    resourceTypeId: 'rt1',
    resourceTypeName: 'Microscope',
    lab: 'Lab B',
    status: 'Available',
    manufacturer: 'ZEISS',
    model: 'LSM 980 with Airyscan 2',
    serialNumber: 'SN-CMS-005',
    purchaseDate: '2023-09-01',
    description: 'Advanced laser scanning confocal microscope system optimized for high-resolution 3D imaging of fixed and live cells/tissues. Equipped with multiple laser lines, sensitive detectors, and environmental control for live cell experiments. Software allows for complex experiment design, image acquisition, and analysis.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'microscope laser',
    features: ['Multi-Laser Excitation (405, 488, 561, 640nm)', 'High-Sensitivity GaAsP Detectors', 'Live Cell Incubation Chamber', 'Z-stack & Time-lapse Imaging', 'Spectral Unmixing', 'Airyscan 2 Superresolution'],
    lastCalibration: '2024-03-01',
    nextCalibration: '2024-09-01',
    availability: [
      { date: tomorrowStr, slots: ['Full Day Available'] }
    ],
    notes: 'Booking requires prior training. Contact Dr. Eva Rostova for access.'
  },
  {
    id: '6',
    name: 'Chemical Fume Hood Ventus',
    resourceTypeId: 'rt5',
    resourceTypeName: 'Fume Hood',
    lab: 'General Lab',
    status: 'Booked',
    manufacturer: 'Labconco',
    model: 'Protector Premier',
    serialNumber: 'SN-FH-006',
    purchaseDate: '2020-03-12',
    description: 'Standard benchtop chemical fume hood providing operator protection from hazardous vapors, fumes, and dusts during chemical manipulations. Features a vertical sliding sash, internal lighting, and services for gas, air, and vacuum. Equipped with an airflow monitor to ensure safe operation.',
    imageUrl: 'https://placehold.co/300x200.png',
    dataAiHint: 'fume hood',
    features: ['Airflow Monitor & Alarm', 'Vertical Sliding Sash', 'Internal Baffles for Uniform Airflow', 'Utility Valves (Air, Gas, Vacuum)', 'Explosion-Proof Light'],
    lastCalibration: 'N/A', 
    nextCalibration: 'N/A',
    availability: [
        { date: todayStr, slots: ['Booked until 15:00', '15:00-17:00'] },
        { date: dayAfterTomorrowStr, slots: ['09:00-12:00'] }
    ]
  },
];

const labs = Array.from(new Set(allMockResources.map(r => r.lab)));
const resourceTypeNames = mockResourceTypes.map(rt => rt.name);


export default function ResourcesPage() {
  // Active filters
  const [activeSearchTerm, setActiveSearchTerm] = useState('');
  const [activeSelectedTypeName, setActiveSelectedTypeName] = useState<string>('all');
  const [activeSelectedLab, setActiveSelectedLab] = useState<string>('all');
  const [activeSelectedDate, setActiveSelectedDate] = useState<Date | undefined>(undefined);
  
  // Temporary filters for Dialog
  const [tempSearchTerm, setTempSearchTerm] = useState('');
  const [tempSelectedTypeName, setTempSelectedTypeName] = useState<string>('all');
  const [tempSelectedLab, setTempSelectedLab] = useState<string>('all');
  const [tempSelectedDate, setTempSelectedDate] = useState<Date | undefined>(undefined);
  const [currentMonthInDialog, setCurrentMonthInDialog] = useState<Date>(startOfDay(new Date()));
  const [isFilterDialogOpen, setIsFilterDialogOpen] = useState(false);
  
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Sync active filters to temp filters when dialog opens
  useEffect(() => {
    if (isFilterDialogOpen) {
      setTempSearchTerm(activeSearchTerm);
      setTempSelectedTypeName(activeSelectedTypeName);
      setTempSelectedLab(activeSelectedLab);
      setTempSelectedDate(activeSelectedDate);
      if (activeSelectedDate) setCurrentMonthInDialog(activeSelectedDate); else setCurrentMonthInDialog(startOfDay(new Date()));
    }
  }, [isFilterDialogOpen, activeSearchTerm, activeSelectedTypeName, activeSelectedLab, activeSelectedDate]);

  const filteredResources = useMemo(() => {
    let resources = allMockResources;
    if (activeSearchTerm) {
      resources = resources.filter(resource =>
        resource.name.toLowerCase().includes(activeSearchTerm.toLowerCase()) ||
        (resource.description && resource.description.toLowerCase().includes(activeSearchTerm.toLowerCase())) ||
        (resource.manufacturer && resource.manufacturer.toLowerCase().includes(activeSearchTerm.toLowerCase())) ||
        (resource.model && resource.model.toLowerCase().includes(activeSearchTerm.toLowerCase()))
      );
    }
    if (activeSelectedTypeName && activeSelectedTypeName !== 'all') {
      resources = resources.filter(resource => resource.resourceTypeName === activeSelectedTypeName);
    }
    if (activeSelectedLab && activeSelectedLab !== 'all') {
      resources = resources.filter(resource => resource.lab === activeSelectedLab);
    }
    if (activeSelectedDate) {
      const dateStrToFilter = format(activeSelectedDate, 'yyyy-MM-dd');
      resources = resources.filter(resource =>
        resource.availability?.some(avail => avail.date === dateStrToFilter && avail.slots.length > 0 && !avail.slots.includes('Full Day Booked'))
      );
    }
    return resources;
  }, [activeSearchTerm, activeSelectedTypeName, activeSelectedLab, activeSelectedDate]);

  const handleApplyFilters = () => {
    setActiveSearchTerm(tempSearchTerm);
    setActiveSelectedTypeName(tempSelectedTypeName);
    setActiveSelectedLab(tempSelectedLab);
    setActiveSelectedDate(tempSelectedDate);
    setIsFilterDialogOpen(false);
  };

  const resetAllActiveFilters = () => {
    setActiveSearchTerm('');
    setActiveSelectedTypeName('all');
    setActiveSelectedLab('all');
    setActiveSelectedDate(undefined);
    
    // Also reset dialog temp state immediately
    setTempSearchTerm('');
    setTempSelectedTypeName('all');
    setTempSelectedLab('all');
    setTempSelectedDate(undefined);
    setCurrentMonthInDialog(startOfDay(new Date()));
  };

  const getResourceStatusBadge = (status: Resource['status']) => {
    const baseClasses = "absolute top-2 right-2 inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold";
    switch (status) {
      case 'Available':
        return <Badge className={`${baseClasses} bg-green-500 text-white border-transparent`}><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Booked':
        return <Badge className={`${baseClasses} bg-yellow-500 text-yellow-950 border-transparent`}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Maintenance':
        return <Badge className={`${baseClasses} bg-orange-500 text-white border-transparent`}><Construction className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      default:
        return <Badge variant="outline" className={baseClasses}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    }
  };

  const activeFilterCount = [
    activeSearchTerm !== '',
    activeSelectedTypeName !== 'all',
    activeSelectedLab !== 'all',
    activeSelectedDate !== undefined,
  ].filter(Boolean).length;

  if (!isClient) {
    // Basic loader while client scripts are loading
    return <div className="flex justify-center items-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Loading resources...</p></div>;
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Resource Search"
        description="Find and filter available lab resources."
        icon={Search}
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
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Filter Resources</DialogTitle>
                  <DialogDescription>
                    Refine the list of available lab resources by applying filters.
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
                      <Label htmlFor="resourceTypeDialog" className="text-sm font-medium mb-1 block">Type</Label>
                      <Select value={tempSelectedTypeName} onValueChange={setTempSelectedTypeName}>
                        <SelectTrigger id="resourceTypeDialog" className="h-9">
                          <SelectValue placeholder="Filter by Type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Types</SelectItem>
                          {resourceTypeNames.map(typeName => (
                            <SelectItem key={typeName} value={typeName}>{typeName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label htmlFor="resourceLabDialog" className="text-sm font-medium mb-1 block">Lab</Label>
                      <Select value={tempSelectedLab} onValueChange={setTempSelectedLab}>
                        <SelectTrigger id="resourceLabDialog" className="h-9">
                          <SelectValue placeholder="Filter by Lab" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">All Labs</SelectItem>
                          {labs.map(lab => (
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
                  <Button variant="ghost" onClick={() => { resetAllActiveFilters(); setIsFilterDialogOpen(false);}} className="mr-auto">
                    <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
                  </Button>
                  <Button variant="outline" onClick={() => setIsFilterDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleApplyFilters}>Apply Filters</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
        }
      />

      {filteredResources.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredResources.map((resource) => (
            <Card key={resource.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="p-0">
                <div className="relative w-full h-48 rounded-t-lg overflow-hidden">
                  <Image src={resource.imageUrl} alt={resource.name} layout="fill" objectFit="cover" data-ai-hint={resource.dataAiHint || 'lab equipment'} />
                   {getResourceStatusBadge(resource.status)}
                </div>
                <div className="p-4">
                    <CardTitle className="text-lg mb-1 hover:text-primary transition-colors">
                        <Link href={`/resources/${resource.id}`}>
                            {resource.name}
                        </Link>
                    </CardTitle>
                    <CardDescription>{resource.lab} - {resource.resourceTypeName}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex-grow p-4 pt-0">
                <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{resource.description || 'No description available.'}</p>
                 {resource.features && resource.features.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold mb-1 text-muted-foreground">Key Features:</h4>
                      <div className="flex flex-wrap gap-1">
                        {resource.features.slice(0, 2).map((feature, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">{feature}</Badge>
                        ))}
                        {resource.features.length > 2 && <Badge variant="secondary" className="text-xs">+{resource.features.length - 2} more</Badge>}
                      </div>
                    </div>
                  )}
              </CardContent>
              <CardFooter className="p-4 pt-2 flex flex-col items-stretch gap-2">
                <Button asChild size="sm" className="w-full" disabled={resource.status !== 'Available'}>
                  <Link href={`/bookings?resourceId=${resource.id}${activeSelectedDate ? `&date=${format(activeSelectedDate, 'yyyy-MM-dd')}`: ''}`}>
                    <CalendarPlus className="mr-2 h-4 w-4" />
                    {resource.status === 'Available' ? 'Book Now' : resource.status}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center p-10 col-span-full shadow-lg border">
          <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Resources Found</h3>
          <p className="text-muted-foreground mb-4">
            {activeFilterCount > 0 ? "Try adjusting your search terms or filters." : "There are currently no resources to display."}
          </p>
          {activeFilterCount > 0 && (
             <Button onClick={() => { resetAllActiveFilters(); handleApplyFilters(); }} variant="outline">
                <FilterX className="mr-2 h-4 w-4" /> Reset All Filters
            </Button>
          )}
        </Card>
      )}
    </div>
  );
}
