
'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, CheckCircle, AlertTriangle, Construction, CalendarDays, Info, ListChecks, SlidersHorizontal, FileText, ShoppingCart, Wrench, Edit, Trash2, Network, Globe, Fingerprint, KeyRound, ExternalLink, Archive, History, Building, ChevronRight, CalendarCog, CalendarX, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { allAdminMockResources, initialMockResourceTypes, labsList, resourceStatusesList, initialBookings } from '@/lib/mock-data';
import { useAuth } from '@/components/auth-context';
import type { Resource, ResourceType, ResourceStatus, Booking, UnavailabilityPeriod } from '@/types';
import { format, parseISO, isValid, startOfToday, isPast, startOfDay as fnsStartOfDay, isWithinInterval, isSameDay } from 'date-fns';
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
import { ManageAvailabilityDialog } from '@/components/resources/manage-availability-dialog';
import { ManageUnavailabilityDialog } from '@/components/resources/manage-unavailability-dialog';

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
            <Skeleton className="h-9 w-9 rounded-md bg-muted" />
          </div>
        }
      />
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-lg">
            <CardContent className="p-0">
              <Skeleton className="w-full h-80 rounded-t-lg" />
            </CardContent>
          </Card>
           <Card className="shadow-lg">
            <CardHeader><Skeleton className="h-6 w-3/4 rounded-md" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
            </CardContent>
          </Card>
           <Card className="shadow-lg">
            <CardHeader><Skeleton className="h-6 w-3/4 rounded-md" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md" />
              <Skeleton className="h-4 w-5/6 rounded-md" />
            </CardContent>
          </Card>
          <Card className="shadow-lg">
            <CardHeader><Skeleton className="h-6 w-1/2 rounded-md" /></CardHeader>
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
          <Card className="shadow-lg">
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
    switch (status) {
      case 'Available':
        return <Badge className={cn("bg-green-500 hover:bg-green-600 text-white border-transparent", className)}><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Booked':
        return <Badge className={cn("bg-yellow-500 hover:bg-yellow-600 text-yellow-950 border-transparent", className)}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Maintenance':
        return <Badge className={cn("bg-orange-500 hover:bg-orange-600 text-white border-transparent", className)}><Construction className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      default:
        return <Badge variant="outline" className={className}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
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
  // All hooks are called at the top level
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [resource, setResource] = useState<Resource | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
  const [isUnavailabilityDialogOpen, setIsUnavailabilityDialogOpen] = useState(false);

  const resourceId = params.resourceId as string;

  useEffect(() => {
    if (resourceId) {
      setIsLoading(true);
      setTimeout(() => { // Simulate fetch delay
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
    if (!resource || !currentUser) return [];
    return initialBookings
      .filter(booking =>
        booking.resourceId === resource.id &&
        booking.userId === currentUser.id &&
        booking.startTime && isValid(new Date(booking.startTime)) && isPast(new Date(booking.startTime)) &&
        booking.status !== 'Cancelled'
      )
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [resource, currentUser]);

  const sortedUnavailabilityPeriods = useMemo(() => {
    if (!resource || !resource.unavailabilityPeriods) { 
      return [];
    }
    return [...resource.unavailabilityPeriods].sort((a, b) => parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime());
  }, [resource]);

  const canManageResource = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Lab Manager');
  const canBookResource = resource ? resource.status === 'Available' : false;

  const handleSaveResource = (data: ResourceFormValues) => {
    if (resource) {
        const resourceType = initialMockResourceTypes.find(rt => rt.id === data.resourceTypeId);
        if (!resourceType) {
            toast({ title: "Error", description: "Selected resource type not found.", variant: "destructive"});
            return;
        }
        const updatedResourceData: Resource = {
            ...resource,
            ...data,
            imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
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
            availability: resource.availability || [],
            unavailabilityPeriods: resource.unavailabilityPeriods || [],
        };

        const resourceIndexInGlobalArray = allAdminMockResources.findIndex(r => r.id === resource.id);
        if (resourceIndexInGlobalArray !== -1) {
            allAdminMockResources[resourceIndexInGlobalArray] = updatedResourceData;
        }
        setResource(updatedResourceData); // Update local state to re-render detail page
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
            allAdminMockResources.splice(resourceIndex, 1);
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

  const handleSaveAvailability = (date: string, newSlots: string[]) => {
    if (resource) {
      const updatedAvailability = resource.availability ? [...resource.availability] : [];
      const dateIndex = updatedAvailability.findIndex(avail => avail.date === date);

      if (newSlots.length > 0) {
        if (dateIndex !== -1) {
          updatedAvailability[dateIndex].slots = newSlots;
        } else {
          updatedAvailability.push({ date, slots: newSlots });
        }
      } else {
        if (dateIndex !== -1) {
          updatedAvailability[dateIndex].slots = []; 
        } else {
           updatedAvailability.push({ date, slots: [] });
        }
      }
      
      updatedAvailability.sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      const updatedResource = { ...resource, availability: updatedAvailability };
      
      // Update local state for immediate reflection on the detail page
      setResource(updatedResource);

      // Update "global" mock array
      const globalIndex = allAdminMockResources.findIndex(r => r.id === resource.id);
      if (globalIndex !== -1) {
        allAdminMockResources[globalIndex] = updatedResource;
      }
      
      toast({
        title: 'Availability Updated',
        description: `Daily slots for ${resource.name} on ${format(parseISO(date), 'PPP')} have been updated.`,
      });
    }
  };

  const handleSaveUnavailability = (updatedPeriods: UnavailabilityPeriod[]) => {
    if (resource) {
      const updatedResource = { ...resource, unavailabilityPeriods: updatedPeriods };
      setResource(updatedResource); // Update local state

      const globalIndex = allAdminMockResources.findIndex(r => r.id === resource.id);
      if (globalIndex !== -1) {
        allAdminMockResources[globalIndex] = updatedResource;
      }
      toast({
        title: 'Unavailability Updated',
        description: `Unavailability periods for ${resource.name} have been updated.`,
      });
    }
  };

  // Conditional returns after all hooks have been called
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

  const today = fnsStartOfDay(new Date());
  const upcomingAvailability = resource.availability?.filter(avail => {
    if (!avail || !avail.date) return false;
    try {
        const availDate = parseISO(avail.date);
        return isValid(availDate) && availDate >= today && avail.slots.length > 0;
    } catch (e) {
        return false;
    }
  }).sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime()) || [];

  // JSX Render
  return (
    <TooltipProvider>
    <div className="space-y-8">
      <PageHeader
        title={resource.name}
        description={`Detailed information for ${resource.resourceTypeName} in ${resource.lab}.`}
        icon={Archive}
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" asChild>
                <Link href="/admin/resources">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
                </Link>
            </Button>
            {canManageResource && (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => setIsUnavailabilityDialogOpen(true)}>
                      <CalendarX className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Set Unavailability Periods</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => setIsAvailabilityDialogOpen(true)}>
                      <CalendarCog className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Manage Daily Availability</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => setIsFormDialogOpen(true)}>
                      <Edit className="h-4 w-4" />
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
              </>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 space-y-6">
            <Card className="shadow-lg">
                <CardContent className="p-0">
                    <div className="relative w-full h-64 md:h-80 rounded-t-lg overflow-hidden">
                        <Image src={resource.imageUrl || 'https://placehold.co/600x400.png'} alt={resource.name} layout="fill" objectFit="cover" />
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

            {sortedUnavailabilityPeriods.length > 0 && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2"><CalendarX className="text-destructive h-5 w-5" /> Defined Unavailability</CardTitle>
                   <CardDescription>This resource is scheduled to be unavailable during these periods.</CardDescription>
                </CardHeader>
                <CardContent>
                   <ul className="space-y-2 text-sm">
                    {sortedUnavailabilityPeriods.slice(0,5).map((period) => (
                      <li key={period.id} className="pb-2 border-b border-dashed last:border-b-0 last:pb-0">
                        <p className="font-medium text-foreground">
                          {format(parseISO(period.startDate), 'MMM dd, yyyy')} - {format(parseISO(period.endDate), 'MMM dd, yyyy')}
                        </p>
                        {period.reason && <p className="text-xs text-muted-foreground mt-0.5">Reason: {period.reason}</p>}
                      </li>
                    ))}
                    {sortedUnavailabilityPeriods.length > 5 && <p className="text-xs text-muted-foreground mt-2">...and more periods defined.</p>}
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
                        <p className="font-medium text-foreground">{format(new Date(booking.startTime), 'PPP, p')}</p>
                        {booking.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">Notes: {booking.notes}</p>}
                      </li>
                    ))}
                     {userPastBookingsForResource.length > 5 && <p className="text-xs text-muted-foreground mt-2">...and more.</p>}
                  </ul>
                </CardContent>
              </Card>
             )}
             {currentUser && userPastBookingsForResource.length === 0 && (
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
                 <Button asChild className="w-full sm:w-auto" disabled={!canBookResource}>
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
                    <CardTitle className="text-xl flex items-center gap-2"><CalendarDays className="text-primary h-5 w-5" /> Upcoming Daily Availability</CardTitle>
                    <CardDescription>Defined available slots for specific days. Check full calendar for all options.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="space-y-2">
                    {upcomingAvailability
                        .slice(0, 5)
                        .map((avail, index) => (
                        <li key={index} className="text-sm p-2 border-b last:border-b-0">
                            <span className="font-medium text-foreground">{isValid(parseISO(avail.date)) ? format(parseISO(avail.date), 'PPP') : 'Invalid Date'}</span>:
                            <span className="text-muted-foreground ml-2 break-all">
                                {avail.slots.join(', ').length > 70 ? 'Multiple slots available' : avail.slots.join(', ')}
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
           {upcomingAvailability.length === 0 && resource.status === 'Available' && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <CalendarDays className="text-primary h-5 w-5" /> Upcoming Daily Availability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    No specific daily availability slots defined for upcoming dates. Resource might be generally available or its schedule needs to be set up. Check defined unavailability periods.
                  </p>
                </CardContent>
                {canManageResource && (
                    <CardFooter className="justify-center border-t pt-4">
                    <Button variant="outline" onClick={() => setIsAvailabilityDialogOpen(true)}>
                        <CalendarCog className="mr-2 h-4 w-4" /> Define Daily Slots
                    </Button>
                    </CardFooter>
                )}
              </Card>
           )}
        </div>
      </div>

      {resource && (
        <ResourceFormDialog
            open={isFormDialogOpen}
            onOpenChange={setIsFormDialogOpen}
            initialResource={resource}
            onSave={handleSaveResource}
        />
      )}
       {resource && (
        <ManageAvailabilityDialog
          resource={resource}
          open={isAvailabilityDialogOpen}
          onOpenChange={setIsAvailabilityDialogOpen}
          onSave={handleSaveAvailability}
        />
      )}
      {resource && (
        <ManageUnavailabilityDialog
          resource={resource}
          open={isUnavailabilityDialogOpen}
          onOpenChange={setIsUnavailabilityDialogOpen}
          onSaveUnavailability={handleSaveUnavailability}
        />
      )}
    </div>
    </TooltipProvider>
  );
}
