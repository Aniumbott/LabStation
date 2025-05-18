
'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, Filter, CalendarPlus, XCircle, CalendarDays, CheckCircle, AlertTriangle, Construction } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Resource } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format, addDays, parseISO, isValid } from 'date-fns';

const todayStr = format(new Date(), 'yyyy-MM-dd');
const tomorrowStr = format(addDays(new Date(), 1), 'yyyy-MM-dd');
const dayAfterTomorrowStr = format(addDays(new Date(), 2), 'yyyy-MM-dd');

const allMockResources: Resource[] = [
  { 
    id: '1', 
    name: 'Electron Microscope Alpha', 
    type: 'Microscope', 
    lab: 'Lab A', 
    status: 'Available', 
    description: 'High-resolution electron microscope for various sample analyses.', 
    imageUrl: 'https://placehold.co/300x200.png', 
    dataAiHint: 'microscope electronics', 
    features: ['SEM', 'TEM', 'EDX'], 
    lastCalibration: '2023-12-01', 
    nextCalibration: '2024-06-01',
    availability: [
      { date: todayStr, slots: ['14:00-16:00', '16:00-18:00'] },
      { date: tomorrowStr, slots: ['10:00-12:00'] }
    ]
  },
  { 
    id: '2', 
    name: 'BioSafety Cabinet Omega', 
    type: 'Incubator', 
    lab: 'Lab B', 
    status: 'Booked', 
    description: 'Class II Type A2 biosafety cabinet for sterile cell culture work.', 
    imageUrl: 'https://placehold.co/300x200.png', 
    dataAiHint: 'lab cabinet', 
    features: ['HEPA Filtered', 'UV Sterilization'], 
    lastCalibration: '2024-01-15', 
    nextCalibration: '2024-07-15',
    availability: [
      { date: tomorrowStr, slots: ['09:00-11:00', '11:00-13:00'] },
      { date: dayAfterTomorrowStr, slots: ['Full Day Booked'] } // Example for non-specific slots
    ] 
  },
  { 
    id: '3', 
    name: 'HPLC System Zeta', 
    type: 'HPLC System', 
    lab: 'Lab C', 
    status: 'Maintenance', 
    description: 'High-performance liquid chromatography for compound separation.', 
    imageUrl: 'https://placehold.co/300x200.png', 
    dataAiHint: 'hplc chemistry', 
    features: ['Autosampler', 'UV Detector', 'Diode Array Detector'], 
    lastCalibration: '2023-11-10', 
    nextCalibration: '2024-05-10',
    availability: [] // No specific availability due to maintenance
  },
  { 
    id: '4', 
    name: 'High-Speed Centrifuge Pro', 
    type: 'Centrifuge', 
    lab: 'Lab A', 
    status: 'Available', 
    description: 'Refrigerated centrifuge capable of speeds up to 20,000 RPM.', 
    imageUrl: 'https://placehold.co/300x200.png', 
    dataAiHint: 'centrifuge science', 
    features: ['Refrigerated', 'Multiple Rotors', 'Programmable'], 
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
    type: 'Microscope', 
    lab: 'Lab B', 
    status: 'Available', 
    description: 'Advanced laser scanning confocal system for live cell imaging.', 
    imageUrl: 'https://placehold.co/300x200.png', 
    dataAiHint: 'microscope laser', 
    features: ['Live Cell Imaging', 'Multi-channel', 'Z-stack'], 
    lastCalibration: '2024-03-01', 
    nextCalibration: '2024-09-01',
    availability: [
      { date: tomorrowStr, slots: ['Full Day Available'] }
    ]
  },
  { 
    id: '6', 
    name: 'Chemical Fume Hood Ventus', 
    type: 'Fume Hood', 
    lab: 'General Lab', 
    status: 'Booked', 
    description: 'Standard chemical fume hood for protection against hazardous fumes.', 
    imageUrl: 'https://placehold.co/300x200.png', 
    dataAiHint: 'fume hood', 
    features: ['Airflow Monitor', 'Sash Sensor'], 
    lastCalibration: 'N/A', 
    nextCalibration: 'N/A',
    availability: [
        { date: todayStr, slots: ['Booked until 15:00'] },
        { date: dayAfterTomorrowStr, slots: ['09:00-12:00'] }
    ]
  },
];

const resourceTypes = Array.from(new Set(allMockResources.map(r => r.type)));
const labs = Array.from(new Set(allMockResources.map(r => r.lab)));

export default function ResourcesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedLab, setSelectedLab] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const filteredResources = useMemo(() => {
    let resources = allMockResources;

    if (searchTerm) {
      resources = resources.filter(resource => 
        resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resource.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedType) {
      resources = resources.filter(resource => resource.type === selectedType);
    }
    if (selectedLab) {
      resources = resources.filter(resource => resource.lab === selectedLab);
    }
    if (selectedDate) {
      const dateStrToFilter = format(selectedDate, 'yyyy-MM-dd');
      resources = resources.filter(resource => 
        resource.availability?.some(avail => avail.date === dateStrToFilter && avail.slots.length > 0 && !avail.slots.includes('Full Day Booked'))
      );
    }
    return resources;
  }, [searchTerm, selectedType, selectedLab, selectedDate]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedType('');
    setSelectedLab('');
    setSelectedDate(undefined);
  }

  const getResourceStatusBadge = (status: Resource['status']) => {
    switch (status) {
      case 'Available':
        return <Badge variant="default" className="absolute top-2 right-2"><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Booked':
        return <Badge variant="secondary" className="absolute top-2 right-2"><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Maintenance':
        return <Badge variant="destructive" className="absolute top-2 right-2"><Construction className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      default:
        return <Badge variant="outline" className="absolute top-2 right-2">{status}</Badge>;
    }
  };

  const formatDateSafe = (dateString?: string) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'MMM dd, yyyy') : 'Invalid Date';
  };


  if (!isClient) {
    return null; 
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Resource Search"
        description="Find and filter available lab resources."
        icon={Search}
        actions={
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="mr-2 h-4 w-4" /> {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
        }
      />

      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name, type, or keyword..."
            className="pl-10 w-full"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {showFilters && (
          <Card className="p-4 sm:p-6 bg-muted/50 shadow-md border">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Types</SelectItem>
                  {resourceTypes.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedLab} onValueChange={setSelectedLab}>
                <SelectTrigger>
                  <SelectValue placeholder="Filter by Lab" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All Labs</SelectItem>
                  {labs.map(lab => (
                    <SelectItem key={lab} value={lab}>{lab}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal bg-background hover:bg-accent/50">
                    <CalendarDays className="mr-2 h-4 w-4 text-muted-foreground"/>
                    {selectedDate ? format(selectedDate, 'PPP') : <span>Filter by Date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                    disabled={(date) => date < addDays(new Date(), -1) } // Disable past dates, allow today
                  />
                </PopoverContent>
              </Popover>
              
              <Button variant="ghost" onClick={resetFilters} className="text-destructive hover:text-destructive-foreground hover:bg-destructive/10 lg:col-start-4">
                <XCircle className="mr-2 h-4 w-4" /> Reset Filters
              </Button>
            </div>
          </Card>
        )}
      </div>

      {filteredResources.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredResources.map((resource) => (
            <Card key={resource.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
              <CardHeader className="p-0">
                <div className="relative w-full h-48 rounded-t-lg overflow-hidden">
                  <Image src={resource.imageUrl} alt={resource.name} layout="fill" objectFit="cover" data-ai-hint={resource.dataAiHint} />
                   {getResourceStatusBadge(resource.status)}
                </div>
                <div className="p-4">
                    <CardTitle className="text-lg mb-1">{resource.name}</CardTitle>
                    <CardDescription>{resource.lab} - {resource.type}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="flex-grow p-4 pt-0">
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{resource.description}</p>
                {resource.features && resource.features.length > 0 && (
                  <div className="mb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Features</h4>
                    <div className="flex flex-wrap gap-1">
                      {resource.features.map(feature => <Badge key={feature} variant="outline" className="text-xs">{feature}</Badge>)}
                    </div>
                  </div>
                )}
                {(resource.lastCalibration || resource.nextCalibration) && (
                     <div className="text-xs text-muted-foreground space-y-0.5 mt-2">
                       {resource.lastCalibration && <p>Last Calibrated: {formatDateSafe(resource.lastCalibration)}</p>}
                       {resource.nextCalibration && <p>Next Calibration: {formatDateSafe(resource.nextCalibration)}</p>}
                    </div>
                  )}
              </CardContent>
              <CardFooter className="p-4 pt-0">
                <Button asChild size="sm" className="w-full" disabled={resource.status !== 'Available'}>
                  <Link href={`/bookings?resourceId=${resource.id}${selectedDate ? `&date=${format(selectedDate, 'yyyy-MM-dd')}`: ''}`}>
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
          <p className="text-muted-foreground mb-4">Try adjusting your search terms or filters, or select a different date.</p>
          <Button onClick={resetFilters} variant="outline">Clear All Filters</Button>
        </Card>
      )}
    </div>
  );
}
