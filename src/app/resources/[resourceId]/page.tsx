
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, CheckCircle, AlertTriangle, Construction, CalendarDays, Info, ListChecks, SlidersHorizontal, FileText, ShoppingCart, Wrench, Edit, Trash2, Network, Globe, Fingerprint, KeyRound, ExternalLink, Archive, History, Building, ChevronRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { allAdminMockResources, initialMockResourceTypes, labsList, resourceStatusesList, initialBookings, mockCurrentUser } from '@/lib/mock-data';
import type { Resource, ResourceType, ResourceStatus, Booking } from '@/types';
import { format, parseISO, isValid, startOfToday, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ResourceFormDialog, ResourceFormValues } from '@/components/admin/resource-form-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

function ResourceDetailPageSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeader
        title={<Skeleton className="h-8 w-3/4 rounded-md bg-muted" />}
        description={<Skeleton className="h-4 w-1/2 rounded-md bg-muted mt-1" />}
        icon={Archive}
        actions={
          <div className="flex items-center gap-2">
            <Skeleton className="h-9 w-24 rounded-md bg-muted" />
            <Skeleton className="h-9 w-9 rounded-md bg-muted" />
            <Skeleton className="h-9 w-9 rounded-md bg-muted" />
          </div>
        }
      />
      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-lg">
            <CardContent className="p-0">
              <Skeleton className="w-full h-80 rounded-t-lg" />
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader><Skeleton className="h-6 w-1/2 rounded-md" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
            </CardContent>
          </Card>
           <Card className="shadow-lg"> {/* Skeleton for Past Bookings */}
            <CardHeader><Skeleton className="h-6 w-3/4 rounded-md" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
            </CardContent>
          </Card>
           <Card className="shadow-lg"> {/* Skeleton for Remote Access */}
            <CardHeader><Skeleton className="h-6 w-3/4 rounded-md" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-start">
                <Skeleton className="h-7 w-3/5 rounded-md mb-1" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
              <Skeleton className="h-4 w-2/5 rounded-md" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-3/4 rounded-md" />
              <Separator className="my-4"/>
              <Skeleton className="h-5 w-1/4 rounded-md mb-2" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
              <Skeleton className="h-4 w-1/2 rounded-md" />
            </CardContent>
            <CardFooter>
                <Skeleton className="h-10 w-1/3 rounded-md" />
            </CardFooter>
          </Card>
          <Card className="shadow-lg"> {/* Skeleton for Availability */}
            <CardHeader><Skeleton className="h-6 w-1/2 rounded-md" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

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
    try {
        const date = parseISO(dateString);
        return isValid(date) ? format(date, 'PPP') : (dateString === '' ? emptyVal : dateString);
    } catch {
        return dateString;
    }
};

const DetailItem = ({ icon: Icon, label, value, isLink = false }: { icon: React.ElementType, label: string, value?: string | number | null | undefined, isLink?: boolean }) => {
    if (!value && value !==0 ) return null;
    const displayValue = value === '' ? 'N/A' : value;
    return (
      <div className="flex items-start text-sm py-1.5">
        <Icon className="h-4 w-4 mr-3 mt-0.5 text-muted-foreground flex-shrink-0" />
        <span className="font-medium text-muted-foreground w-32">{label}:</span>
        {isLink && typeof displayValue === 'string' && displayValue !== 'N/A' && (displayValue.startsWith('http') || displayValue.startsWith('//')) ? (
          <a href={displayValue} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex-1 break-all">
            {displayValue} <ExternalLink className="inline-block h-3 w-3 ml-1" />
          </a>
        ) : (
          <span className="text-foreground flex-1 break-words">{String(displayValue)}</span>
        )}
      </div>
    );
};

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const resourceId = params.resourceId as string;

  const [resource, setResource] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);

  useEffect(() => {
    if (resourceId) {
      setIsLoading(true);
      // Simulate API call delay
      setTimeout(() => {
        const foundResource = allAdminMockResources.find(r => r.id === resourceId);
        setResource(foundResource || null);
        setIsLoading(false);
      }, 300);
    } else {
      setIsLoading(false);
      setResource(null);
    }
  }, [resourceId]);

  const userPastBookingsForResource = useMemo(() => {
    if (!resource || !mockCurrentUser) return [];
    return initialBookings
      .filter(booking =>
        booking.resourceId === resource.id &&
        booking.userId === mockCurrentUser.id &&
        isValid(parseISO(booking.startTime.toString())) && isPast(parseISO(booking.startTime.toString())) &&
        booking.status !== 'Cancelled'
      )
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [resource]);

  const handleSaveResource = (data: ResourceFormValues) => {
    if (resource) {
        const resourceType = initialMockResourceTypes.find(rt => rt.id === data.resourceTypeId);
        if (!resourceType) {
            toast({ title: "Error", description: "Selected resource type not found.", variant: "destructive"});
            return;
        }
        const updatedResource: Resource = {
            ...resource,
            ...data,
            resourceTypeName: resourceType.name,
            features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
            purchaseDate: data.purchaseDate && isValid(parseISO(data.purchaseDate)) ? parseISO(data.purchaseDate).toISOString() : resource.purchaseDate,
            remoteAccess: data.remoteAccess && Object.values(data.remoteAccess).some(v => v !== '' && v !== undefined && v !== null) ? {
              ipAddress: data.remoteAccess.ipAddress || undefined,
              hostname: data.remoteAccess.hostname || undefined,
              protocol: data.remoteAccess.protocol || undefined,
              username: data.remoteAccess.username || undefined,
              port: data.remoteAccess.port ? Number(data.remoteAccess.port) : undefined,
              notes: data.remoteAccess.notes || undefined,
            } : undefined,
        };
        setResource(updatedResource); // Update local state for immediate UI reflection

        // Note: This updates the mock array in memory.
        // In a real app, this would be an API call.
        // This change will persist for the session but not if the app reloads fresh from `allAdminMockResources`.
        const resourceIndex = allAdminMockResources.findIndex(r => r.id === resource.id);
        if (resourceIndex !== -1) {
            allAdminMockResources[resourceIndex] = updatedResource;
        }
        toast({
            title: 'Resource Updated',
            description: `Resource "${data.name}" has been updated.`,
        });
    }
    setIsFormDialogOpen(false);
  };

  const handleConfirmDelete = () => {
    if (resource) {
      const resourceIndex = allAdminMockResources.findIndex(r => r.id === resource.id);
        if (resourceIndex !== -1) {
            allAdminMockResources.splice(resourceIndex, 1); // Remove from mock array
        }
      toast({
        title: "Resource Deleted",
        description: `Resource "${resource.name}" has been removed.`,
        variant: "destructive"
      });
      setIsAlertOpen(false);
      router.push('/admin/resources');
    }
  };

  if (isLoading) {
    return <ResourceDetailPageSkeleton />;
  }

  if (!resource) {
    return (
      <div className="space-y-8">
        <PageHeader title="Resource Not Found" icon={AlertTriangle}
            actions={
             <Button variant="outline" asChild onClick={() => router.push('/admin/resources')}>
                <Link href="/admin/resources">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to Resources
                </Link>
            </Button>
            }
        />
        <Card className="max-w-2xl mx-auto shadow-lg border-destructive">
          <CardHeader className="items-center">
            <CardTitle className="text-destructive">Resource Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground">The resource with ID "{resourceId}" could not be found.</p>
          </CardContent>
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
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()) || [];

  return (
    <TooltipProvider>
    <div className="space-y-8">
      <PageHeader
        title={resource.name}
        description={`Detailed information for ${resource.resourceTypeName} in ${resource.lab}.`}
        icon={Archive}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
                <Link href="/admin/resources">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
                </Link>
            </Button>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="icon" onClick={() => setIsFormDialogOpen(true)}>
                  <Edit className="h-4 w-4" />
                  <span className="sr-only">Edit Resource</span>
                </Button>
              </TooltipTrigger>
              <TooltipContent><p>Edit Resource</p></TooltipContent>
            </Tooltip>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                   <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="icon">
                          <Trash2 className="h-4 w-4" />
                          <span className="sr-only">Delete Resource</span>
                      </Button>
                    </AlertDialogTrigger>
                </TooltipTrigger>
                <TooltipContent><p>Delete Resource</p></TooltipContent>
              </Tooltip>
              {isAlertOpen && (
                <AlertDialogContent>
                    <AlertDialogHeader>
                    <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                    <AlertDialogDescription>
                        This action cannot be undone. This will permanently delete the resource
                        <span className="font-semibold"> "{resource.name}"</span>.
                    </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => setIsAlertOpen(false)}>Cancel</AlertDialogCancel>
                    <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
                        Delete
                    </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
              )}
            </AlertDialog>
          </div>
        }
      />

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 space-y-6">
            <Card className="shadow-lg">
                <CardContent className="p-0">
                    <div className="relative w-full h-64 md:h-80 rounded-t-lg overflow-hidden">
                        <Image src={resource.imageUrl || 'https://placehold.co/300x200.png'} alt={resource.name} layout="fill" objectFit="cover" />
                    </div>
                </CardContent>
            </Card>

            {resource.features && resource.features.length > 0 && (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="text-xl flex items-center gap-2"><ListChecks className="text-primary h-5 w-5" /> Key Features</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-1.5 text-sm list-disc list-inside text-muted-foreground">
                        {resource.features.map((feature, index) => (
                            <li key={index}>{feature}</li>
                        ))}
                        </ul>
                    </CardContent>
                </Card>
            )}

            {userPastBookingsForResource.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><History className="text-primary h-5 w-5" /> Your Past Bookings</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 text-sm">
                    {userPastBookingsForResource.slice(0,5).map((booking) => (
                      <li key={booking.id} className="pb-2 border-b border-dashed last:border-b-0 last:pb-0">
                        <p className="font-medium text-foreground">{format(parseISO(booking.startTime.toString()), 'PPP, p')}</p>
                        {booking.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">Notes: {booking.notes}</p>}
                      </li>
                    ))}
                     {userPastBookingsForResource.length > 5 && <p className="text-xs text-muted-foreground mt-2">...and more.</p>}
                  </ul>
                </CardContent>
              </Card>
            )}
             {userPastBookingsForResource.length === 0 && (
                 <Card className="shadow-lg">
                     <CardHeader>
                         <CardTitle className="text-xl flex items-center gap-2"><History className="text-primary h-5 w-5" /> Your Past Bookings</CardTitle>
                     </CardHeader>
                     <CardContent>
                         <p className="text-sm text-muted-foreground">You have no past bookings for this resource.</p>
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
              <CardDescription>Type: {resource.resourceTypeName} | Lab: {resource.lab}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-base text-foreground leading-relaxed">{resource.description}</p>

              <Separator className="my-4" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><SlidersHorizontal className="text-primary h-5 w-5"/> Specifications</h3>
              <div className="space-y-1">
                <DetailItem icon={Wrench} label="Manufacturer" value={resource.manufacturer} />
                <DetailItem icon={Archive} label="Model" value={resource.model} />
                <DetailItem icon={Info} label="Serial #" value={resource.serialNumber} />
                <DetailItem icon={ShoppingCart} label="Purchase Date" value={formatDateSafe(resource.purchaseDate, undefined)} />
              </div>

              {resource.remoteAccess && (
                <>
                  <Separator className="my-4" />
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Network className="text-primary h-5 w-5"/> Remote Access</h3>
                  <div className="space-y-1">
                    <DetailItem icon={Globe} label="IP Address" value={resource.remoteAccess.ipAddress} isLink={!!resource.remoteAccess.ipAddress} />
                    <DetailItem icon={Globe} label="Hostname" value={resource.remoteAccess.hostname} isLink={!!resource.remoteAccess.hostname} />
                    <DetailItem icon={ListChecks} label="Protocol" value={resource.remoteAccess.protocol} />
                    <DetailItem icon={KeyRound} label="Username" value={resource.remoteAccess.username} />
                    <DetailItem icon={Fingerprint} label="Port" value={resource.remoteAccess.port} />
                    {resource.remoteAccess.notes && <DetailItem icon={FileText} label="RA Notes" value={resource.remoteAccess.notes} />}
                  </div>
                </>
              )}

              {resource.notes && (
                <>
                  <Separator className="my-4" />
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><FileText className="text-primary h-5 w-5"/> General Notes</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{resource.notes}</p>
                </>
              )}
            </CardContent>
            <CardFooter className="border-t pt-6">
                 <Button asChild className="w-full sm:w-auto" disabled={resource.status !== 'Available'}>
                    <Link href={`/bookings?resourceId=${resource.id}`}>
                        <CalendarPlus className="mr-2 h-4 w-4" />
                        Book This Resource
                    </Link>
                </Button>
            </CardFooter>
          </Card>

          {upcomingAvailability.length > 0 && (
             <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="text-primary h-5 w-5" /> Availability</CardTitle>
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
                            View Full Calendar &amp; Book <ChevronRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                 </CardFooter>
             </Card>
          )}
        </div>
      </div>

      {resource && (
        <ResourceFormDialog
            open={isFormDialogOpen}
            onOpenChange={(isOpen) => {
                setIsFormDialogOpen(isOpen);
            }}
            initialResource={resource}
            onSave={handleSaveResource}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
