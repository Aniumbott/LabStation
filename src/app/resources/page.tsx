'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Search, Filter, CalendarPlus, XCircle } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Resource } from '@/types';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

const allMockResources: Resource[] = [
  { id: '1', name: 'Electron Microscope Alpha', type: 'Microscope', lab: 'Lab A', status: 'Available', description: 'High-resolution electron microscope.', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'microscope electronics', features: ['SEM', 'TEM'], lastCalibration: '2023-12-01', nextCalibration: '2024-06-01' },
  { id: '2', name: 'BioSafety Cabinet Omega', type: 'Incubator', lab: 'Lab B', status: 'Booked', description: 'Class II Type A2 biosafety cabinet.', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'lab cabinet', features: ['HEPA Filtered'], lastCalibration: '2024-01-15', nextCalibration: '2024-07-15' },
  { id: '3', name: 'HPLC System Zeta', type: 'HPLC System', lab: 'Lab C', status: 'Maintenance', description: 'For compound separation.', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'hplc chemistry', features: ['Autosampler', 'UV Detector'], lastCalibration: '2023-11-10', nextCalibration: '2024-05-10' },
  { id: '4', name: 'High-Speed Centrifuge Pro', type: 'Centrifuge', lab: 'Lab A', status: 'Available', description: 'Up to 20,000 RPM.', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'centrifuge science', features: ['Refrigerated', 'Multiple Rotors'], lastCalibration: '2024-02-20', nextCalibration: '2024-08-20' },
  { id: '5', name: 'Confocal Microscope Zeiss', type: 'Microscope', lab: 'Lab B', status: 'Available', description: 'Laser scanning confocal system.', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'microscope laser', features: ['Live Cell Imaging'], lastCalibration: '2024-03-01', nextCalibration: '2024-09-01' },
  { id: '6', name: 'Chemical Fume Hood Ventus', type: 'Fume Hood', lab: 'General Lab', status: 'Booked', description: 'Protects from hazardous fumes.', imageUrl: 'https://placehold.co/300x200.png', dataAiHint: 'fume hood', features: ['Airflow Monitor'], lastCalibration: 'N/A', nextCalibration: 'N/A' },
];

const resourceTypes = Array.from(new Set(allMockResources.map(r => r.type)));
const labs = Array.from(new Set(allMockResources.map(r => r.lab)));

export default function ResourcesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('');
  const [selectedLab, setSelectedLab] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const [showFilters, setShowFilters] = useState(false);

  // Defer rendering until client-side to avoid hydration issues with initial state
  const [isClient, setIsClient] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);


  const filteredResources = useMemo(() => {
    return allMockResources.filter(resource => {
      const matchesSearch = resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                            resource.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesType = selectedType ? resource.type === selectedType : true;
      const matchesLab = selectedLab ? resource.lab === selectedLab : true;
      // Date filtering logic would be more complex, e.g., checking resource.availability
      // For now, we'll skip date-based filtering in this example
      return matchesSearch && matchesType && matchesLab;
    });
  }, [searchTerm, selectedType, selectedLab, selectedDate]);

  const resetFilters = () => {
    setSearchTerm('');
    setSelectedType('');
    setSelectedLab('');
    setSelectedDate(undefined);
  }

  if (!isClient) {
    return null; // Or a loading spinner
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
          <Card className="p-4 sm:p-6 bg-muted/50">
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
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {selectedDate ? format(selectedDate, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selectedDate}
                    onSelect={setSelectedDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              
              <Button variant="ghost" onClick={resetFilters} className="text-destructive hover:text-destructive-foreground hover:bg-destructive/90 lg:col-start-4">
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
              <CardHeader>
                <div className="relative w-full h-48 rounded-t-lg overflow-hidden mb-2">
                  <Image src={resource.imageUrl} alt={resource.name} layout="fill" objectFit="cover" data-ai-hint={resource.dataAiHint} />
                   <Badge variant={resource.status === 'Available' ? 'default' : 'secondary'} 
                         className={`absolute top-2 right-2 ${resource.status === 'Available' ? 'bg-green-500 text-white' : resource.status === 'Maintenance' ? 'bg-yellow-500 text-black' : 'bg-slate-500 text-white'}`}>
                    {resource.status}
                  </Badge>
                </div>
                <CardTitle className="text-lg">{resource.name}</CardTitle>
                <CardDescription>{resource.lab} - {resource.type}</CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <p className="text-sm text-muted-foreground mb-3 line-clamp-3">{resource.description}</p>
                {resource.features && resource.features.length > 0 && (
                  <div className="mb-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Features</h4>
                    <div className="flex flex-wrap gap-1">
                      {resource.features.map(feature => <Badge key={feature} variant="outline" className="text-xs">{feature}</Badge>)}
                    </div>
                  </div>
                )}
                {resource.nextCalibration && (
                  <p className="text-xs text-muted-foreground">
                    Next Calibration: {
                      !isNaN(new Date(resource.nextCalibration).getTime())
                        ? format(new Date(resource.nextCalibration), 'MMM dd, yyyy')
                        : resource.nextCalibration
                    }
                  </p>
                )}
              </CardContent>
              <CardFooter>
                <Button asChild size="sm" className="w-full" disabled={resource.status !== 'Available'}>
                  <Link href={`/bookings?resourceId=${resource.id}`}>
                    <CalendarPlus className="mr-2 h-4 w-4" /> 
                    {resource.status === 'Available' ? 'Book Now' : resource.status}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="text-center p-10 col-span-full">
          <Search className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Resources Found</h3>
          <p className="text-muted-foreground mb-4">Try adjusting your search terms or filters.</p>
          <Button onClick={resetFilters}>Clear All Filters</Button>
        </Card>
      )}
    </div>
  );
}
