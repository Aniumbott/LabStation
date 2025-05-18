
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, CheckCircle, AlertTriangle, Construction, CalendarDays, Info, ListChecks, Thermometer, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { allMockResources } from '../page'; // Import mock data
import type { Resource } from '@/types';
import { format, parseISO, isValid } from 'date-fns';

const getResourceStatusBadge = (status: Resource['status'], className?: string) => {
    switch (status) {
      case 'Available':
        return <Badge variant="default" className={className}><CheckCircle className="mr-2 h-4 w-4" />{status}</Badge>;
      case 'Booked':
        return <Badge variant="secondary" className={className}><AlertTriangle className="mr-2 h-4 w-4" />{status}</Badge>;
      case 'Maintenance':
        return <Badge variant="destructive" className={className}><Construction className="mr-2 h-4 w-4" />{status}</Badge>;
      default:
        return <Badge variant="outline" className={className}>{status}</Badge>;
    }
};

const formatDateSafe = (dateString?: string) => {
    if (!dateString || dateString === 'N/A') return 'N/A';
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PPP') : 'Invalid Date';
};

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const resourceId = params.resourceId as string;
  const [resource, setResource] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (resourceId) {
      const foundResource = allMockResources.find(r => r.id === resourceId);
      setResource(foundResource || null);
      setIsLoading(false);
    }
  }, [resourceId]);

  if (isLoading) {
    return (
        <div className="flex justify-center items-center h-screen">
            <Info className="h-12 w-12 animate-spin text-primary" />
            <p className="ml-4 text-lg text-muted-foreground">Loading resource details...</p>
        </div>
    );
  }

  if (!resource) {
    return (
      <div className="space-y-8">
        <PageHeader title="Resource Not Found" icon={AlertTriangle} />
        <Card className="max-w-2xl mx-auto shadow-lg border-destructive">
          <CardHeader className="items-center">
            <CardTitle className="text-destructive">Resource Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">The resource with ID "{resourceId}" could not be found.</p>
          </CardContent>
          <CardFooter className="justify-center">
            <Button onClick={() => router.push('/resources')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Resource Search
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title={resource.name}
        description={`Detailed information for ${resource.type} in ${resource.lab}.`}
        icon={Info}
        actions={
          <Button variant="outline" onClick={() => router.push('/resources')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Search
          </Button>
        }
      />

      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-1 space-y-6">
            <Card className="shadow-lg">
                <CardContent className="p-0">
                    <div className="relative w-full h-64 md:h-80 rounded-t-lg overflow-hidden">
                        <Image src={resource.imageUrl} alt={resource.name} layout="fill" objectFit="cover" data-ai-hint={resource.dataAiHint} />
                    </div>
                </CardContent>
                <CardFooter className="p-4">
                     <Button asChild className="w-full" disabled={resource.status !== 'Available'}>
                        <Link href={`/bookings?resourceId=${resource.id}`}>
                            <CalendarPlus className="mr-2 h-4 w-4" />
                            {resource.status === 'Available' ? 'Book This Resource' : resource.status}
                        </Link>
                    </Button>
                </CardFooter>
            </Card>

            {resource.features && resource.features.length > 0 && (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2"><ListChecks className="text-primary" /> Key Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm list-disc list-inside text-muted-foreground">
                        {resource.features.map((feature, index) => (
                            <li key={index}>{feature}</li>
                        ))}
                        </ul>
                    </CardContent>
                </Card>
            )}
        </div>

        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-start">
                    <CardTitle className="text-2xl">{resource.name}</CardTitle>
                    {getResourceStatusBadge(resource.status)}
                </div>
              <CardDescription>Type: {resource.type} | Lab: {resource.lab}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base text-foreground leading-relaxed">{resource.description}</p>
            </CardContent>
          </Card>
          
          {(resource.lastCalibration || resource.nextCalibration) && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2"><Thermometer className="text-primary" /> Calibration Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {resource.lastCalibration && (
                    <p><span className="font-medium text-foreground">Last Calibrated:</span> {formatDateSafe(resource.lastCalibration)}</p>
                )}
                {resource.nextCalibration && (
                  <p><span className="font-medium text-foreground">Next Calibration Due:</span> {formatDateSafe(resource.nextCalibration)}</p>
                )}
                {(resource.lastCalibration === 'N/A' && resource.nextCalibration === 'N/A') && (
                    <p className="text-muted-foreground">Calibration tracking not applicable for this resource.</p>
                )}
              </CardContent>
            </Card>
          )}

          {resource.availability && resource.availability.length > 0 && (
             <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="text-primary" /> Upcoming Availability</CardTitle>
                    <CardDescription>Check specific time slots on the booking page.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                    {resource.availability
                        .filter(avail => new Date(avail.date) >= new Date(format(new Date(), 'yyyy-MM-dd'))) // Only show today and future
                        .slice(0, 5) // Limit to 5 entries
                        .map((avail, index) => (
                        <li key={index} className="text-sm p-2 border-b last:border-b-0">
                            <span className="font-medium text-foreground">{format(parseISO(avail.date), 'PPP')}</span>: 
                            <span className="text-muted-foreground ml-2">
                                {avail.slots.join(', ').length > 50 ? 'Multiple slots available' : avail.slots.join(', ')}
                            </span>
                        </li>
                    ))}
                    </ul>
                    {resource.availability.filter(avail => new Date(avail.date) >= new Date(format(new Date(), 'yyyy-MM-dd'))).length > 5 && (
                         <p className="text-xs text-muted-foreground mt-2">More dates available...</p>
                    )}
                </CardContent>
                 <CardFooter>
                    <Button variant="outline" asChild>
                        <Link href={`/bookings?resourceId=${resource.id}`}>
                            View Full Calendar & Book <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                 </CardFooter>
             </Card>
          )}
        </div>
      </div>
    </div>
  );
}


    