
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, CheckCircle, AlertTriangle, Construction, CalendarDays, Info, ListChecks, Thermometer, ChevronRight, Loader2, Tag, Building, WandSparkles, FileText, ShoppingCart, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { allMockResources } from '../page'; 
import type { Resource } from '@/types';
import { format, parseISO, isValid, startOfToday } from 'date-fns';
import { cn } from '@/lib/utils';

const getResourceStatusBadge = (status: Resource['status'], className?: string) => {
    const baseClasses = `inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors ${className || ''}`;
    switch (status) {
      case 'Available':
        return <Badge className={`${baseClasses} bg-green-500 text-white border-transparent hover:bg-green-600`}><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Booked':
        return <Badge className={`${baseClasses} bg-yellow-500 text-yellow-950 border-transparent hover:bg-yellow-600`}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Maintenance':
        return <Badge className={`${baseClasses} bg-orange-500 text-white border-transparent hover:bg-orange-600`}><Construction className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      default:
        return <Badge variant="outline" className={baseClasses}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    }
};

const formatDateSafe = (dateString?: string, emptyVal: string = 'N/A') => {
    if (!dateString || dateString === 'N/A') return emptyVal;
    const date = parseISO(dateString);
    return isValid(date) ? format(date, 'PPP') : emptyVal;
};

function ResourceDetailPageSkeleton() {
  return (
    <div className="space-y-8 animate-pulse">
      <div className="space-y-2">
        <div className="h-8 w-3/4 rounded-md bg-muted"></div>
        <div className="h-4 w-1/2 rounded-md bg-muted"></div>
      </div>
      <div className="grid md:grid-cols-3 gap-8 items-start">
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-lg">
            <CardContent className="p-0">
              <div className="w-full h-80 rounded-t-lg bg-muted"></div>
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader><div className="h-6 w-1/2 rounded-md bg-muted"></div></CardHeader>
            <CardContent className="space-y-2">
              <div className="h-4 w-full rounded-md bg-muted"></div>
              <div className="h-4 w-5/6 rounded-md bg-muted"></div>
              <div className="h-4 w-full rounded-md bg-muted"></div>
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="h-7 w-3/5 rounded-md bg-muted mb-1"></div>
              <div className="h-4 w-2/5 rounded-md bg-muted"></div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-4 w-full rounded-md bg-muted"></div>
              <div className="h-4 w-full rounded-md bg-muted"></div>
              <div className="h-4 w-3/4 rounded-md bg-muted"></div>
              <Separator className="my-4"/>
              <div className="h-5 w-1/4 rounded-md bg-muted mb-2"></div>
              <div className="h-4 w-1/2 rounded-md bg-muted"></div>
              <div className="h-4 w-1/2 rounded-md bg-muted"></div>
              <div className="h-4 w-1/2 rounded-md bg-muted"></div>
            </CardContent>
            <CardFooter>
                <div className="h-9 w-1/3 rounded-md bg-muted"></div>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const resourceId = params.resourceId as string;
  const [resource, setResource] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (resourceId) {
      // Simulate API call delay
      setTimeout(() => {
        const foundResource = allMockResources.find(r => r.id === resourceId);
        setResource(foundResource || null);
        setIsLoading(false);
      }, 300); 
    }
  }, [resourceId]);

  if (isLoading) {
    return <ResourceDetailPageSkeleton />;
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
            <Button variant="outline" onClick={() => router.push('/resources')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Resource Search
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  const today = startOfToday();
  const upcomingAvailability = resource.availability?.filter(avail => {
    if (!avail || !avail.date) return false;
    try {
        const availDate = parseISO(avail.date); 
        return isValid(availDate) && availDate >= today;
    } catch (e) {
        return false; 
    }
  }) || [];

  const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string | null }) => {
    if (!value) return null;
    return (
      <div className="flex items-start text-sm">
        <Icon className="h-4 w-4 mr-2 mt-0.5 text-muted-foreground flex-shrink-0" />
        <span className="font-medium text-muted-foreground w-32">{label}:</span>
        <span className="text-foreground flex-1">{value}</span>
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title={resource.name}
        description={`Detailed information for ${resource.type} in ${resource.lab}.`}
        icon={Tag}
        actions={
          <Button variant="outline" onClick={() => router.push('/resources')}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Search
          </Button>
        }
      />

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 space-y-6">
            <Card className="shadow-lg">
                <CardContent className="p-0">
                    <div className="relative w-full h-64 md:h-80 rounded-t-lg overflow-hidden">
                        <Image src={resource.imageUrl} alt={resource.name} layout="fill" objectFit="cover" data-ai-hint={resource.dataAiHint || 'lab equipment'} />
                    </div>
                </CardContent>
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

           {(resource.lastCalibration || resource.nextCalibration) && (resource.lastCalibration !== 'N/A' || resource.nextCalibration !== 'N/A') && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2"><Thermometer className="text-primary" /> Calibration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1 text-sm">
                {resource.lastCalibration && resource.lastCalibration !== 'N/A' && (
                    <p><span className="font-medium text-foreground">Last:</span> {formatDateSafe(resource.lastCalibration)}</p>
                )}
                {resource.nextCalibration && resource.nextCalibration !== 'N/A' && (
                  <p><span className="font-medium text-foreground">Next Due:</span> {formatDateSafe(resource.nextCalibration)}</p>
                )}
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
              
              <Separator className="my-6" />
              
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><WandSparkles className="text-primary"/> Specifications</h3>
              <div className="space-y-2">
                <DetailItem icon={Building} label="Manufacturer" value={resource.manufacturer} />
                <DetailItem icon={Tag} label="Model" value={resource.model} />
                <DetailItem icon={Info} label="Serial #" value={resource.serialNumber} />
                <DetailItem icon={ShoppingCart} label="Purchase Date" value={formatDateSafe(resource.purchaseDate, 'Not specified')} />
              </div>

              {resource.notes && (
                <>
                  <Separator className="my-6" />
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><FileText className="text-primary"/> Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resource.notes}</p>
                </>
              )}
            </CardContent>
            <CardFooter className="border-t pt-6">
                 <Button asChild className="w-full sm:w-auto" disabled={resource.status !== 'Available'}>
                    <Link href={`/bookings?resourceId=${resource.id}`}>
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        {resource.status === 'Available' ? 'Book This Resource' : resource.status}
                    </Link>
                </Button>
            </CardFooter>
          </Card>

          {upcomingAvailability.length > 0 && (
             <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="text-primary" /> Availability</CardTitle>
                    <CardDescription>Check specific time slots and book on the bookings page.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                    {upcomingAvailability
                        .slice(0, 5) 
                        .map((avail, index) => (
                        <li key={index} className="text-sm p-2 border-b last:border-b-0">
                            <span className="font-medium text-foreground">{isValid(parseISO(avail.date)) ? format(parseISO(avail.date), 'PPP') : 'Invalid Date'}</span>:
                            <span className="text-muted-foreground ml-2">
                                {avail.slots.join(', ').length > 50 ? 'Multiple slots available' : avail.slots.join(', ')}
                            </span>
                        </li>
                    ))}
                    </ul>
                    {upcomingAvailability.length > 5 && (
                         <p className="text-xs text-muted-foreground mt-2 text-center">More dates available on the booking page...</p>
                    )}
                </CardContent>
                 <CardFooter className="justify-center border-t pt-4">
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
