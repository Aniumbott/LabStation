
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, CheckCircle, AlertTriangle, Construction, CalendarDays, Info, ListChecks, Thermometer, ChevronRight, Loader2, Tag, Building, WandSparkles, FileText, ShoppingCart, Wrench, Edit, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { allAdminMockResources } from '@/app/admin/resources/page'; 
import type { Resource, ResourceType, ResourceStatus } from '@/types';
import { format, parseISO, isValid, startOfToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ResourceFormDialog, ResourceFormValues } from '@/components/admin/resource-form-dialog';
import { initialMockResourceTypes } from '@/app/admin/resource-types/page';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

// Define labsList and resourceStatusesList if not globally available or pass as props if needed
const labsList: Resource['lab'][] = ['Lab A', 'Lab B', 'Lab C', 'General Lab'];
const resourceStatusesList: ResourceStatus[] = ['Available', 'Booked', 'Maintenance'];

function ResourceDetailPageSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeader 
        title={<Skeleton className="h-8 w-3/4 rounded-md bg-muted" />} 
        description={<Skeleton className="h-4 w-1/2 rounded-md bg-muted mt-1" />} 
        icon={Tag}
        actions={<Skeleton className="h-9 w-24 rounded-md bg-muted" />}
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
        </div>
      </div>
    </div>
  );
}

const getResourceStatusBadgeStyle = (status: Resource['status'], className?: string) => {
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

const DetailItem = ({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value?: string | null | undefined }) => {
    if (!value && value !==0 ) return null;
    return (
      <div className="flex items-start text-sm py-1">
        <Icon className="h-4 w-4 mr-3 mt-0.5 text-muted-foreground flex-shrink-0" />
        <span className="font-medium text-muted-foreground w-32">{label}:</span>
        <span className="text-foreground flex-1">{value}</span>
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
      setTimeout(() => { // Simulate API delay
        const foundResource = allAdminMockResources.find(r => r.id === resourceId);
        setResource(foundResource || null);
        setIsLoading(false);
      }, 300); 
    } else {
      setIsLoading(false);
    }
  }, [resourceId]);

  const handleSaveResource = (data: ResourceFormValues) => {
    if (resource) {
        const resourceType = initialMockResourceTypes.find(rt => rt.id === data.resourceTypeId);
        if (!resourceType) {
            toast({ title: "Error", description: "Selected resource type not found.", variant: "destructive"});
            return;
        }
        const updatedResource = {
            ...resource,
            ...data,
            resourceTypeName: resourceType.name,
            features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
            purchaseDate: data.purchaseDate ? parseISO(data.purchaseDate).toISOString() : resource.purchaseDate, // Ensure correct date format
        };
        setResource(updatedResource);
        // Note: This mock update won't persist in allAdminMockResources in the admin list page
        // without a global state or backend.
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
      // Note: This mock deletion won't persist in allAdminMockResources in the admin list page
      // without a global state or backend.
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

  if (isLoading) {
    return <ResourceDetailPageSkeleton />;
  }

  if (!resource) {
    return (
      <div className="space-y-8">
        <PageHeader title="Resource Not Found" icon={AlertTriangle} 
            actions={
             <Button variant="outline" onClick={() => router.push('/admin/resources')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Manage Resources
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
        icon={Tag}
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => router.push('/admin/resources')}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to List
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
              <AlertDialogContent>
                  <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                      This action cannot be undone. This will permanently delete the resource
                      <span className="font-semibold"> "{resource.name}"</span>.
                  </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction variant="destructive" onClick={handleConfirmDelete}>
                      Delete
                  </AlertDialogAction>
                  </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        }
      />

      <div className="grid md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 space-y-6">
            <Card className="shadow-lg">
                <CardContent className="p-0">
                    <div className="relative w-full h-64 md:h-80 rounded-t-lg overflow-hidden">
                        <Image src={resource.imageUrl || 'https://placehold.co/300x200.png'} alt={resource.name} layout="fill" objectFit="cover" data-ai-hint={resource.dataAiHint || 'lab equipment'} />
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

           {(resource.lastCalibration || resource.nextCalibration) && (resource.lastCalibration !== 'N/A' || resource.nextCalibration !== 'N/A') && (
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2"><Thermometer className="text-primary h-5 w-5" /> Calibration</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm">
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
                    {getResourceStatusBadgeStyle(resource.status)}
                </div>
              <CardDescription>Type: {resource.resourceTypeName} | Lab: {resource.lab}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-base text-foreground leading-relaxed">{resource.description}</p>
              
              <Separator className="my-6" />
              
              <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><WandSparkles className="text-primary h-5 w-5"/> Specifications</h3>
              <div className="space-y-1">
                <DetailItem icon={Building} label="Manufacturer" value={resource.manufacturer} />
                <DetailItem icon={Tag} label="Model" value={resource.model} />
                <DetailItem icon={Info} label="Serial #" value={resource.serialNumber} />
                <DetailItem icon={ShoppingCart} label="Purchase Date" value={formatDateSafe(resource.purchaseDate, undefined)} />
              </div>

              {resource.notes && (
                <>
                  <Separator className="my-6" />
                  <h3 className="text-lg font-semibold mb-3 flex items-center gap-2"><FileText className="text-primary h-5 w-5"/> Notes</h3>
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
                // If closing, refetch or update resource state if needed, but mock setup limits this
            }}
            initialResource={resource} 
            onSave={handleSaveResource}
            resourceTypes={initialMockResourceTypes} 
            labs={labsList} 
            statuses={resourceStatusesList} 
        />
      )}
    </div>
    </TooltipProvider>
  );
}
