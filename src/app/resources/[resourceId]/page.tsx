
'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, CheckCircle, AlertTriangle, Construction, CalendarDays, Info, ListChecks, SlidersHorizontal, FileText, ShoppingCart, Wrench, Edit, Trash2, Network, Globe, Fingerprint, KeyRound, ExternalLink, Archive, History, CalendarCog, CalendarX, Loader2 } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/components/auth-context';
import type { Resource, ResourceType, Booking, UnavailabilityPeriod } from '@/types';
import { format, parseISO, isValid, isPast, startOfDay as fnsStartOfDay } from 'date-fns';
import { cn, formatDateSafe } from '@/lib/utils';
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
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { initialMockResourceTypes, labsList, resourceStatusesList } from '@/lib/mock-data'; // For ResourceFormDialog props


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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-lg">
            <CardContent className="p-0">
              <Skeleton className="w-full h-80 rounded-t-lg bg-muted" />
            </CardContent>
          </Card>
           <Card className="shadow-lg">
            <CardHeader><Skeleton className="h-6 w-3/4 rounded-md bg-muted" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md bg-muted" />
              <Skeleton className="h-4 w-5/6 rounded-md bg-muted" />
            </CardContent>
          </Card>
        </div>
        <div className="md:col-span-2 space-y-6">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex justify-between items-start">
                <Skeleton className="h-7 w-3/5 rounded-md mb-1 bg-muted" />
                <Skeleton className="h-6 w-20 rounded-full bg-muted" />
              </div>
              <Skeleton className="h-4 w-2/5 rounded-md bg-muted" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-4 w-full rounded-md bg-muted" />
              <Skeleton className="h-4 w-full rounded-md bg-muted" />
              <Skeleton className="h-4 w-3/4 rounded-md bg-muted" />
              <Separator className="my-4"/>
              <Skeleton className="h-5 w-1/4 rounded-md mb-2 bg-muted" />
              <Skeleton className="h-4 w-1/2 rounded-md bg-muted" />
              <Skeleton className="h-4 w-1/2 rounded-md bg-muted" />
              <Skeleton className="h-4 w-1/2 rounded-md bg-muted" />
            </CardContent>
            <CardFooter>
                <Skeleton className="h-10 w-1/3 rounded-md bg-muted" />
            </CardFooter>
          </Card>
           <Card className="shadow-lg">
            <CardHeader><Skeleton className="h-6 w-1/2 rounded-md bg-muted" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md bg-muted" />
              <Skeleton className="h-4 w-5/6 rounded-md bg-muted" />
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

const DetailItem = ({ icon: Icon, label, value, isLink = false }: { icon: React.ElementType, label: string, value?: string | number | null | undefined, isLink?: boolean }) => {
    if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) return null;
    const displayValue = String(value);

    return (
      <div className="flex items-start text-sm py-1.5">
        <Icon className="h-4 w-4 mr-3 mt-0.5 text-muted-foreground flex-shrink-0" />
        <span className="font-medium text-muted-foreground w-32">{label}:</span>
        {isLink && (displayValue.startsWith('http') || displayValue.startsWith('//')) ? (
          <a href={displayValue} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex-1 break-all">
            {displayValue} <ExternalLink className="inline-block h-3 w-3 ml-1" />
          </a>
        ) : (
          <span className="text-foreground flex-1 break-words">{displayValue}</span>
        )}
      </div>
    );
};

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth();

  const [resource, setResource] = useState<Resource | null>(null);
  const [resourceTypeName, setResourceTypeName] = useState<string>('N/A');
  const [isLoading, setIsLoading] = useState(true);
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false);
  const [isAvailabilityDialogOpen, setIsAvailabilityDialogOpen] = useState(false);
  const [isUnavailabilityDialogOpen, setIsUnavailabilityDialogOpen] = useState(false);
  const [fetchedResourceTypesForDialog, setFetchedResourceTypesForDialog] = useState<ResourceType[]>([]);

  const resourceId = typeof params.resourceId === 'string' ? params.resourceId : null;

  const fetchResourceData = useCallback(async () => {
    if (!resourceId) {
      setIsLoading(false);
      setResource(null);
      return;
    }
    setIsLoading(true);
    console.log(`Fetching resource with ID: ${resourceId}`);
    try {
      const resourceDocRef = doc(db, "resources", resourceId);
      const docSnap = await getDoc(resourceDocRef);
      console.log(`Document snapshot for ID ${resourceId} exists:`, docSnap.exists());

      if (docSnap.exists()) {
        const data = docSnap.data();
        console.log("Raw document data:", data);
        const fetchedResource = {
          id: docSnap.id,
          ...data,
          purchaseDate: data.purchaseDate ? (data.purchaseDate.toDate ? data.purchaseDate.toDate().toISOString() : data.purchaseDate as string) : undefined,
          availability: Array.isArray(data.availability) ? data.availability.map(a => ({...a, date: typeof a.date === 'string' ? a.date : (a.date?.toDate ? format(a.date.toDate(), 'yyyy-MM-dd') : a.date) })) : [],
          unavailabilityPeriods: Array.isArray(data.unavailabilityPeriods) ? data.unavailabilityPeriods.map(p => ({...p, startDate: typeof p.startDate === 'string' ? p.startDate : (p.startDate?.toDate ? format(p.startDate.toDate(), 'yyyy-MM-dd') : p.startDate), endDate: typeof p.endDate === 'string' ? p.endDate : (p.endDate?.toDate ? format(p.endDate.toDate(), 'yyyy-MM-dd') : p.endDate)})) : [],
          features: Array.isArray(data.features) ? data.features : [],
        } as Resource;
        setResource(fetchedResource);

        if (fetchedResource.resourceTypeId && typeof fetchedResource.resourceTypeId === 'string') {
          try {
            const typeDocRef = doc(db, "resourceTypes", fetchedResource.resourceTypeId);
            const typeSnap = await getDoc(typeDocRef);
            if (typeSnap.exists()) {
              setResourceTypeName(typeSnap.data()?.name || 'Unknown Type');
            } else {
              console.warn(`Resource type with ID ${fetchedResource.resourceTypeId} not found.`);
              setResourceTypeName('Unknown Type');
            }
          } catch (typeError) {
            console.error("Error fetching resource type:", typeError);
            setResourceTypeName('Error Loading Type');
          }
        } else {
          console.warn(`Resource ${resourceId} has no resourceTypeId or it's invalid.`);
          setResourceTypeName('N/A');
        }
      } else {
        console.log(`No such document with ID: ${resourceId}`);
        setResource(null);
      }
    } catch (error) {
      console.error("Error fetching resource details:", error);
      toast({
        title: "Error Fetching Resource",
        description: "Could not load resource details. Please try again.",
        variant: "destructive",
      });
      setResource(null);
    } finally {
      setIsLoading(false);
    }
  }, [resourceId, toast]);

  useEffect(() => {
    fetchResourceData();
  }, [fetchResourceData]);

  useEffect(() => {
    async function loadResourceTypesForDialog() {
        // This fetches resource types for the ResourceFormDialog
        // This should ideally come from Firestore.
        // For now, using initialMockResourceTypes, but this needs update if mocks are empty.
        setFetchedResourceTypesForDialog(initialMockResourceTypes);
    }
    if(canManageResource && open){ // Only fetch if admin/manager is viewing and dialog is open
        loadResourceTypesForDialog();
    }
  }, [currentUser, open]);


  const userPastBookingsForResource = useMemo(() => {
    if (!resource || !currentUser || !initialBookings) return []; // initialBookings is empty
    return initialBookings
      .filter(
        (booking: Booking) =>
          booking.resourceId === resource.id &&
          booking.userId === currentUser.id &&
          isPast(new Date(booking.startTime)) &&
          booking.status !== 'Cancelled'
      )
      .sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [resource, currentUser]);

  const canManageResource = currentUser && (currentUser.role === 'Admin' || currentUser.role === 'Lab Manager');

  const handleSaveResource = async (data: ResourceFormValues) => {
    if (!resource || !currentUser || !canManageResource) {
        toast({ title: "Permission Denied", description: "You are not authorized to update this resource.", variant: "destructive" });
        return;
    }

    const resourceType = fetchedResourceTypesForDialog.find(rt => rt.id === data.resourceTypeId);

    const resourceDataToSave = {
      name: data.name,
      resourceTypeId: data.resourceTypeId,
      // resourceTypeName: resourceType ? resourceType.name : 'Unknown Type', // No longer storing type name in resource doc
      lab: data.lab,
      status: data.status,
      description: data.description || '',
      imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      serialNumber: data.serialNumber || null,
      purchaseDate: data.purchaseDate && isValid(parseISO(data.purchaseDate)) ? Timestamp.fromDate(parseISO(data.purchaseDate)) : null,
      notes: data.notes || null,
      features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
      remoteAccess: data.remoteAccess && Object.values(data.remoteAccess).some(v => v !== undefined && v !== '' && v !== null) ? {
         ipAddress: data.remoteAccess.ipAddress || undefined,
         hostname: data.remoteAccess.hostname || undefined,
         protocol: data.remoteAccess.protocol || undefined,
         username: data.remoteAccess.username || undefined,
         port: data.remoteAccess.port ?? undefined,
         notes: data.remoteAccess.notes || undefined,
      } : null,
      allowQueueing: data.status === 'Available',
      // Availability and unavailabilityPeriods are managed via separate dialogs.
      // We fetch the latest resource state before update, so we don't overwrite them here.
      availability: resource.availability || [],
      unavailabilityPeriods: resource.unavailabilityPeriods || [],
    };

    try {
        const resourceDocRef = doc(db, "resources", resource.id);
        await updateDoc(resourceDocRef, resourceDataToSave);
        toast({ title: 'Resource Updated', description: `Resource "${data.name}" has been updated.` });
        fetchResourceData(); // Re-fetch data to show updated details
    } catch (error) {
        console.error("Error updating resource:", error);
        toast({ title: "Update Failed", description: "Could not update resource.", variant: "destructive" });
    }
    setIsFormDialogOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!resource || !currentUser || !canManageResource) {
        toast({ title: "Permission Denied", description: "You are not authorized to delete this resource.", variant: "destructive" });
        return;
    }
    try {
        const resourceDocRef = doc(db, "resources", resource.id);
        await deleteDoc(resourceDocRef);
        toast({ title: "Resource Deleted", description: `Resource "${resource.name}" has been removed.`, variant: "destructive" });
        router.push('/admin/resources');
    } catch (error) {
        console.error("Error deleting resource:", error);
        toast({ title: "Delete Failed", description: "Could not delete resource.", variant: "destructive" });
    }
    setIsAlertOpen(false);
  };

  const handleSaveAvailability = async (date: string, newSlots: string[]) => {
    if (resource && currentUser && canManageResource) {
      const currentAvailability = resource.availability ? [...resource.availability] : [];
      const dateIndex = currentAvailability.findIndex(avail => avail.date === date);

      if (newSlots.length > 0) {
        if (dateIndex !== -1) {
          currentAvailability[dateIndex].slots = newSlots;
        } else {
          currentAvailability.push({ date, slots: newSlots });
        }
      } else {
        if (dateIndex !== -1) {
          // If slots are empty, mark as unavailable by setting slots to empty array
          currentAvailability[dateIndex].slots = [];
        } else {
           // If no entry exists and newSlots are empty, effectively it's unavailable by omission or add an empty slot entry
           currentAvailability.push({ date, slots: [] });
        }
      }
      
      currentAvailability.sort((a,b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
      
      try {
        const resourceDocRef = doc(db, "resources", resource.id);
        await updateDoc(resourceDocRef, { availability: currentAvailability });
        toast({ title: 'Availability Updated', description: `Daily slots for ${resource.name} on ${formatDateSafe(date, 'this day', 'PPP')} have been updated.` });
        setResource(prev => prev ? ({ ...prev, availability: currentAvailability }) : null);
      } catch (error) {
        console.error("Error updating availability:", error);
        toast({ title: "Update Failed", description: "Could not save availability.", variant: "destructive" });
      }
    }
  };

  const handleSaveUnavailability = async (updatedPeriods: UnavailabilityPeriod[]) => {
    if (resource && currentUser && canManageResource) {
      try {
        const resourceDocRef = doc(db, "resources", resource.id);
        await updateDoc(resourceDocRef, { unavailabilityPeriods: updatedPeriods });
        toast({ title: 'Unavailability Updated', description: `Unavailability periods for ${resource.name} have been updated.` });
        setResource(prev => prev ? ({ ...prev, unavailabilityPeriods: updatedPeriods }) : null);
      } catch (error) {
        console.error("Error updating unavailability:", error);
        toast({ title: "Update Failed", description: "Could not save unavailability periods.", variant: "destructive" });
      }
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
            <p className="text-muted-foreground">The resource with ID "{resourceId || 'unknown'}" could not be found in Firestore.</p>
            <p className="text-muted-foreground text-xs mt-1">Please check the ID or ensure the resource exists in the database.</p>
             {/* Log the actual resourceId being used */}
            <p className="text-xs text-muted-foreground mt-2">Attempted to fetch ID: {resourceId || "None provided in URL"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canBookResource = resource.status === 'Available';
  const today = fnsStartOfDay(new Date());
  const upcomingAvailability = resource.availability?.filter(avail => {
    if (!avail || !avail.date) return false;
    try {
        const availDate = parseISO(avail.date);
        return isValid(availDate) && availDate >= today && Array.isArray(avail.slots) && avail.slots.length > 0;
    } catch (e) {
        return false;
    }
  }).sort((a, b) => {
    try { return parseISO(a.date).getTime() - parseISO(b.date).getTime(); }
    catch(e) { return 0; }
  }) || [];

  const sortedUnavailabilityPeriods = useMemo(() => {
    if (!resource || !Array.isArray(resource.unavailabilityPeriods)) return [];
    return [...resource.unavailabilityPeriods].sort((a, b) => {
      try { return parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(); }
      catch(e) { return 0;}
    });
  }, [resource]);


  return (
    <TooltipProvider>
    <div className="space-y-8">
      <PageHeader
        title={resource.name}
        description={
            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 text-sm">
                <span>Type: {resourceTypeName}</span>
                <span className="hidden sm:inline">|</span>
                <span>Lab: {resource.lab}</span>
            </div>
        }
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
                       <span className="sr-only">Set Unavailability Periods</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Set Unavailability Periods</p></TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={() => setIsAvailabilityDialogOpen(true)}>
                      <CalendarCog className="h-4 w-4" />
                       <span className="sr-only">Manage Daily Availability</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent><p>Manage Daily Availability</p></TooltipContent>
                </Tooltip>
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
                          {formatDateSafe(period.startDate, 'N/A', 'PPP')} - {formatDateSafe(period.endDate, 'N/A', 'PPP')}
                        </p>
                        {period.reason && <p className="text-xs text-muted-foreground mt-0.5">Reason: {period.reason}</p>}
                      </li>
                    ))}
                    {sortedUnavailabilityPeriods.length > 5 && <p className="text-xs text-muted-foreground mt-2">...and more periods defined.</p>}
                  </ul>
                </CardContent>
              </Card>
            )}

             {currentUser && (
                 <Card className="shadow-lg">
                     <CardHeader>
                         <CardTitle className="text-xl flex items-center gap-2"><History className="text-primary h-5 w-5" /> Your Past Bookings</CardTitle>
                     </CardHeader>
                     <CardContent>
                        {userPastBookingsForResource.length > 0 ? (
                          <ul className="space-y-3 text-sm">
                            {userPastBookingsForResource.slice(0,5).map((booking) => (
                              <li key={booking.id} className="pb-2 border-b border-dashed last:border-b-0 last:pb-0">
                                <p className="font-medium text-foreground">{formatDateSafe(booking.startTime, 'N/A', 'PPP, p')}</p>
                                {booking.notes && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">Notes: {booking.notes}</p>}
                              </li>
                            ))}
                            {userPastBookingsForResource.length > 5 && <p className="text-xs text-muted-foreground mt-2">...and more.</p>}
                          </ul>
                        ) : (
                         <p className="text-sm text-muted-foreground">You have no past bookings for this resource.</p>
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
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-base text-foreground leading-relaxed">{resource.description}</p>

              <Separator className="my-4" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><SlidersHorizontal className="text-primary h-5 w-5"/> Specifications</h3>
              <div className="space-y-1">
                <DetailItem icon={Wrench} label="Manufacturer" value={resource.manufacturer} />
                <DetailItem icon={Archive} label="Model" value={resource.model} />
                <DetailItem icon={Info} label="Serial #" value={resource.serialNumber} />
                <DetailItem icon={ShoppingCart} label="Purchase Date" value={formatDateSafe(resource.purchaseDate, 'N/A', 'PPP')} />
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
                            <span className="font-medium text-foreground">{formatDateSafe(avail.date, 'Invalid Date', 'PPP')}</span>:
                            <span className="text-muted-foreground ml-2 break-all">
                                {(Array.isArray(avail.slots) && avail.slots.join(', ').length > 70) ? 'Multiple slots available' : (Array.isArray(avail.slots) ? avail.slots.join(', ') : 'N/A')}
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
            resourceTypes={fetchedResourceTypesForDialog}
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

    