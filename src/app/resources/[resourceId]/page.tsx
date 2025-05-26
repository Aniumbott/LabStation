
'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft, CalendarPlus, Info, ListChecks, SlidersHorizontal, FileText, ShoppingCart, Wrench, Edit, Trash2, Network, Globe, Fingerprint, KeyRound, ExternalLink, Archive, History, CalendarCog, CalendarX, Loader2, PackageSearch, Clock, CalendarDays, AlertCircle, CheckCircle, Construction, User as UserIconLucide, Calendar as CalendarIcon } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/components/auth-context';
import type { Resource, ResourceType, Booking, UnavailabilityPeriod, RoleName } from '@/types';
import { format, parseISO, isValid as isValidDateFn, startOfDay as fnsStartOfDay, isBefore, compareAsc, isWithinInterval, isSameDay, addDays as dateFnsAddDays, Timestamp as FirestoreTimestamp } from 'date-fns'; // Renamed Timestamp import
import { cn, formatDateSafe, getResourceStatusBadge } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';
import { ResourceFormDialog, type ResourceFormValues } from '@/components/admin/resource-form-dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ManageUnavailabilityDialog } from '@/components/resources/manage-unavailability-dialog';
import { db } from '@/lib/firebase';
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore'; // This is Firestore Timestamp
import { addAuditLog } from '@/lib/firestore-helpers';
import { labsList, resourceStatusesList } from '@/lib/app-constants';


function ResourceDetailPageSkeleton() {
  return (
    <div className="space-y-8">
      <PageHeader
        title={<Skeleton className="h-8 w-3/4 rounded-md bg-muted" />}
        description={<div className="mt-1"><Skeleton className="h-4 w-1/2 rounded-md bg-muted" /></div>}
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
            <CardHeader><Skeleton className="h-6 w-1/3 rounded-md bg-muted mb-2" /></CardHeader>
            <CardContent className="space-y-2">
              <Skeleton className="h-4 w-full rounded-md bg-muted" />
              <Skeleton className="h-4 w-5/6 rounded-md bg-muted" />
            </CardContent>
          </Card>
           <Card className="shadow-lg">
            <CardHeader><Skeleton className="h-6 w-1/2 rounded-md bg-muted mb-2" /></CardHeader>
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
              <Skeleton className="h-4 w-2/5 rounded-md bg-muted mt-1" />
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

const DetailItem = ({ icon: IconElement, label, value, isLink = false, className }: { icon: React.ElementType, label: string, value?: string | number | Date | null | undefined, isLink?: boolean, className?: string }) => {
  if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) {
    return (
         <div className={cn("flex items-start text-sm py-1.5", className)}>
            <IconElement className="h-4 w-4 mr-3 mt-0.5 text-muted-foreground flex-shrink-0" />
            <span className="font-medium text-muted-foreground w-32">{label}:</span>
            <span className="text-foreground flex-1 italic">N/A</span>
        </div>
    );
  }
  
  let displayValue = '';
  if (value instanceof Date) { 
    displayValue = formatDateSafe(value, 'N/A', 'PPP');
  } else {
    displayValue = String(value);
  }

  return (
    <div className={cn("flex items-start text-sm py-1.5", className)}>
      <IconElement className="h-4 w-4 mr-3 mt-0.5 text-muted-foreground flex-shrink-0" />
      <span className="font-medium text-muted-foreground w-32">{label}:</span>
      {isLink && typeof value === 'string' && (value.startsWith('http') || value.startsWith('//') || value.startsWith('mailto:')) ? (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex-1 break-all">
          {value} <ExternalLink className="inline-block h-3 w-3 ml-1" />
        </a>
      ) : (
        <span className="text-foreground flex-1 break-words">{displayValue}</span>
      )}
    </div>
  );
};

function NotFoundMessage({ resourceIdParam }: { resourceIdParam: string | null }) {
  const router = useRouter();
  return (
    <div className="space-y-8">
      <PageHeader title="Resource Not Found" icon={PackageSearch}
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
          <CardTitle className="text-destructive">Error 404</CardTitle>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">The resource with ID "{resourceIdParam || 'unknown'}" could not be found in Firestore.</p>
          <p className="text-muted-foreground text-xs mt-1">Please check the ID or ensure the resource exists in the database.</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { currentUser } = useAuth();
  
  const [resource, setResource] = useState<Resource | null>(null);
  const [resourceTypeName, setResourceTypeName] = useState<string>('Loading...');
  const [isLoading, setIsLoading] = useState(true);
  
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false);
  const [isAlertOpen, setIsAlertOpen] = useState(false); 
  const [resourceToDeleteId, setResourceToDeleteId] = useState<string | null>(null);

  const [isUnavailabilityDialogOpen, setIsUnavailabilityDialogOpen] = useState(false);
  const [resourceUserBookings, setResourceUserBookings] = useState<Booking[]>([]);
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
        const fetchedResource: Resource = {
          id: docSnap.id,
          name: data.name || 'Unnamed Resource',
          resourceTypeId: data.resourceTypeId || '',
          lab: data.lab || (labsList.length > 0 ? labsList[0] : 'Electronics Lab 1'),
          status: data.status || 'Available',
          description: data.description || '',
          imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
          manufacturer: data.manufacturer || undefined,
          model: data.model || undefined,
          serialNumber: data.serialNumber || undefined,
          purchaseDate: data.purchaseDate instanceof Timestamp ? data.purchaseDate.toDate() : undefined,
          notes: data.notes || undefined,
          remoteAccess: data.remoteAccess ? {
            ipAddress: data.remoteAccess.ipAddress || undefined,
            hostname: data.remoteAccess.hostname || undefined,
            protocol: data.remoteAccess.protocol || '',
            username: data.remoteAccess.username || undefined,
            port: data.remoteAccess.port ?? undefined,
            notes: data.remoteAccess.notes || undefined,
          } : undefined,
          allowQueueing: data.allowQueueing ?? false,
          unavailabilityPeriods: Array.isArray(data.unavailabilityPeriods) ? data.unavailabilityPeriods.map((p: any) => ({...p, id: p.id || ('unavail-' + Date.now() + '-' + Math.random().toString(36).substring(2,9)), startDate: p.startDate, endDate: p.endDate, reason: p.reason })) : [],
          features: Array.isArray(data.features) ? data.features : [],
          lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate() : undefined,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
        };
        setResource(fetchedResource);

        if (fetchedResource.resourceTypeId && typeof fetchedResource.resourceTypeId === 'string') {
          try {
            const typeDocRef = doc(db, "resourceTypes", fetchedResource.resourceTypeId);
            const typeSnap = await getDoc(typeDocRef);
            if (typeSnap.exists()) {
              setResourceTypeName(typeSnap.data()?.name || 'Unknown Type');
            } else {
              console.warn(`Resource type with ID ${fetchedResource.resourceTypeId} not found.`);
              setResourceTypeName('N/A (Type Not Found)');
            }
          } catch (typeError: any) {
            console.error("Error fetching resource type:", typeError);
            toast({ title: "Error", description: `Could not load resource type details: ${typeError.message}`, variant: "destructive"});
            setResourceTypeName('Error Loading Type');
          }
        } else {
          if (fetchedResource.resourceTypeId) console.warn(`Resource ${resourceId} has invalid resourceTypeId: ${fetchedResource.resourceTypeId}`);
          setResourceTypeName('N/A');
        }
      } else {
        console.log(`ResourceDetailPage: No such document with ID: ${resourceId}`);
        setResource(null);
      }
    } catch (error: any) {
      console.error("ResourceDetailPage: Error fetching resource details:", error);
      toast({
        title: "Error Fetching Resource",
        description: `Could not load resource details. ${error.message}`,
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
    if (isFormDialogOpen) { 
      const fetchTypes = async () => {
        try {
          const typesCollectionRef = collection(db, "resourceTypes");
          const typesQueryInstance = query(typesCollectionRef, orderBy("name", "asc"));
          const typesSnapshot = await getDocs(typesQueryInstance);
          const types = typesSnapshot.docs.map(docSnap => ({
            id: docSnap.id,
            ...(docSnap.data() as Omit<ResourceType, 'id'>),
          }));
          setFetchedResourceTypesForDialog(types);
        } catch (error: any) {
          console.error("Error fetching resource types for dialog:", error);
          toast({ title: "Error Loading Data", description: `Could not load resource types for the edit form: ${error.message}`, variant: "destructive" });
          setFetchedResourceTypesForDialog([]);
        }
      };
      fetchTypes();
    }
  }, [isFormDialogOpen, toast]);

  useEffect(() => {
    const fetchBookingsForResourceUser = async () => {
      if (!resourceId || !currentUser?.id) {
        setResourceUserBookings([]);
        return;
      }
      try {
        // Firestore Index Required: bookings (resourceId ASC, userId ASC, startTime DESC)
        const bookingsQueryInstance = query(
          collection(db, "bookings"),
          where("resourceId", "==", resourceId),
          where("userId", "==", currentUser.id),
          orderBy("startTime", "desc")
        );
        const querySnapshot = await getDocs(bookingsQueryInstance);
        const bookingsData = querySnapshot.docs.map(docSnap => {
          const data = docSnap.data();
          return {
            id: docSnap.id,
            resourceId: data.resourceId,
            userId: data.userId,
            startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(),
            endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(),
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            status: data.status,
            notes: data.notes,
            usageDetails: data.usageDetails ? {
                ...data.usageDetails,
                actualStartTime: data.usageDetails.actualStartTime instanceof Timestamp ? data.usageDetails.actualStartTime.toDate() : undefined,
                actualEndTime: data.usageDetails.actualEndTime instanceof Timestamp ? data.usageDetails.actualEndTime.toDate() : undefined,
            } : undefined,
          } as Booking;
        });
        setResourceUserBookings(bookingsData);
      } catch (error:any) {
        console.error("Error fetching user bookings for resource:", error);
        toast({ title: "Error Fetching Bookings", description: `Could not load your past bookings for this resource. ${error.message}`, variant: "destructive" });
        setResourceUserBookings([]);
      }
    };

    if (resource && currentUser) { 
      fetchBookingsForResourceUser();
    }
  }, [resourceId, currentUser, resource, toast]);


  const canManageResource = useMemo(() => {
    if (!currentUser) return false;
    return currentUser.role === 'Admin' || currentUser.role === 'Lab Manager';
  }, [currentUser]);

  const userPastBookingsForResource = useMemo(() => {
    if (!resource || !currentUser || !resourceUserBookings || resourceUserBookings.length === 0) return [];
    return resourceUserBookings
      .filter(
        (booking: Booking) =>
          booking.startTime && isValidDateFn(booking.startTime) && isBefore(booking.startTime, new Date()) &&
          booking.status !== 'Cancelled'
      )
      .sort((a, b) => compareAsc(b.startTime, a.startTime));
  }, [resource, currentUser, resourceUserBookings]);

  const sortedUnavailabilityPeriods = useMemo(() => {
    if (!resource || !Array.isArray(resource.unavailabilityPeriods)) return [];
    return [...resource.unavailabilityPeriods].sort((a, b) => {
      try { return parseISO(a.startDate).getTime() - parseISO(b.startDate).getTime(); }
      catch(e) { return 0;}
    });
  }, [resource]);

  const handleOpenEditDialog = useCallback(() => {
    if (resource) {
      setIsFormDialogOpen(true);
    }
  }, [resource]);

  const handleSaveResource = useCallback(async (data: ResourceFormValues) => {
    if (!currentUser || !canManageResource || !resource?.id) { 
        toast({ title: "Permission Denied", description: "Not authorized or resource not found for update.", variant: "destructive" });
        setIsFormDialogOpen(false);
        return;
    }
    
    let purchaseDateForFirestore: Timestamp | null = null;
    if (data.purchaseDate && isValidDateFn(parseISO(data.purchaseDate))) {
        purchaseDateForFirestore = Timestamp.fromDate(parseISO(data.purchaseDate));
    } else if (!data.purchaseDate) {
        purchaseDateForFirestore = null;
    }
    
    const remoteAccessDataForFirestore = data.remoteAccess
      ? {
          ipAddress: data.remoteAccess.ipAddress || null,
          hostname: data.remoteAccess.hostname || null,
          protocol: data.remoteAccess.protocol || '',
          username: data.remoteAccess.username || null,
          port: data.remoteAccess.port ?? null,
          notes: data.remoteAccess.notes || null,
        }
      : undefined;

    const firestorePayload: any = {
      name: data.name,
      resourceTypeId: data.resourceTypeId,
      lab: data.lab,
      status: data.status,
      description: data.description || '',
      imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
      manufacturer: data.manufacturer || null,
      model: data.model || null,
      serialNumber: data.serialNumber || null,
      purchaseDate: purchaseDateForFirestore,
      notes: data.notes || null,
      features: data.features?.split(',').map(f => f.trim()).filter(f => f) || [],
      remoteAccess: remoteAccessDataForFirestore,
      allowQueueing: data.allowQueueing ?? resource.allowQueueing ?? false,
      lastUpdatedAt: serverTimestamp(),
    };
            
    Object.keys(firestorePayload).forEach(key => {
      if (firestorePayload[key] === undefined && key !== 'remoteAccess' && key !== 'allowQueueing') {
          firestorePayload[key] = null;
      }
    });
    if (firestorePayload.remoteAccess) {
        Object.keys(firestorePayload.remoteAccess).forEach(key => {
            if ((firestorePayload.remoteAccess as any)[key] === undefined) {
                 (firestorePayload.remoteAccess as any)[key] = null;
            }
        });
         const ra = firestorePayload.remoteAccess;
         const allRemoteAccessEffectivelyNull = !ra.ipAddress && !ra.hostname && !ra.protocol && !ra.username && ra.port === null && !ra.notes;
         if(allRemoteAccessEffectivelyNull) firestorePayload.remoteAccess = undefined;
    }
    
    try {
        const resourceDocRef = doc(db, "resources", resource.id);
        await updateDoc(resourceDocRef, firestorePayload);
        addAuditLog(currentUser.id, currentUser.name || 'User', 'RESOURCE_UPDATED', { entityType: 'Resource', entityId: resource.id, details: `Resource '${data.name}' updated by ${currentUser.name}.`});
        toast({ title: 'Resource Updated', description: `Resource "${data.name}" has been updated.` });
        await fetchResourceData(); 
    } catch (error: any) {
        console.error("Error updating resource:", error);
        toast({ title: "Update Failed", description: `Could not update resource: ${error.message}`, variant: "destructive" });
    }
    setIsFormDialogOpen(false);
  }, [currentUser, canManageResource, resource, fetchResourceData, toast]);

   const handleConfirmDelete = useCallback(async () => {
    if (!resourceToDeleteId || !currentUser || !canManageResource || !resource) {
        toast({ title: "Error", description: "No resource selected for deletion or permission denied.", variant: "destructive" });
        setIsAlertOpen(false);
        setResourceToDeleteId(null);
        return;
    }
    try {
        const resourceDocRef = doc(db, "resources", resourceToDeleteId);
        await deleteDoc(resourceDocRef);
        addAuditLog(currentUser.id, currentUser.name || 'User', 'RESOURCE_DELETED', { entityType: 'Resource', entityId: resourceToDeleteId, details: `Resource '${resource.name}' (ID: ${resourceToDeleteId}) deleted by ${currentUser.name}.`});
        toast({ title: "Resource Deleted", description: `Resource "${resource.name}" has been removed.`, variant: "destructive" });
        router.push('/admin/resources');
    } catch (error: any) {
        console.error("Error deleting resource:", error);
        toast({ title: "Delete Failed", description: `Could not delete resource: ${error.message}`, variant: "destructive" });
    } finally {
      setIsAlertOpen(false);
      setResourceToDeleteId(null);
    }
  }, [resourceToDeleteId, currentUser, canManageResource, resource, router, toast]);

  const handleSaveUnavailability = useCallback(async (updatedPeriods: UnavailabilityPeriod[]) => {
    if (!resource || !currentUser || !canManageResource) {
        toast({ title: "Error", description: "Cannot save unavailability. Resource not loaded or permission denied.", variant: "destructive"});
        return;
    }
    try {
      const resourceDocRef = doc(db, "resources", resource.id);
      const periodsToSave = updatedPeriods.map(p => ({...p, id: String(p.id)}));
      await updateDoc(resourceDocRef, { unavailabilityPeriods: periodsToSave, lastUpdatedAt: serverTimestamp() });
      addAuditLog(currentUser.id, currentUser.name || 'User', 'RESOURCE_UPDATED', { entityType: 'Resource', entityId: resource.id, details: `Unavailability periods for resource '${resource.name}' updated by ${currentUser.name}.`});
      toast({ title: 'Unavailability Updated', description: `Unavailability periods for ${resource.name} have been updated.` });
      setResource(prev => prev ? ({ ...prev, unavailabilityPeriods: periodsToSave, lastUpdatedAt: new Date() }) : null);
    } catch (error: any) {
      console.error("Error updating unavailability:", error);
      toast({ title: "Update Failed", description: `Could not save unavailability periods: ${error.message}`, variant: "destructive" });
    }
  }, [resource, currentUser, canManageResource, toast]);


  if (isLoading) {
    return <ResourceDetailPageSkeleton />;
  }

  if (!resource && !isLoading) {
    return <NotFoundMessage resourceIdParam={resourceId} />;
  }
  
  if (!resource) return <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin text-primary"/></div>; 

  const canBookResource = resource.status === 'Available';

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
                    <Button variant="outline" size="icon" onClick={handleOpenEditDialog}>
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
                           <Button variant="destructive" size="icon" onClick={() => { setResourceToDeleteId(resource.id); setIsAlertOpen(true); }}>
                                <Trash2 className="h-4 w-4" />
                                <span className="sr-only">Delete Resource</span>
                            </Button>
                       </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent><p>Delete Resource</p></TooltipContent>
                  </Tooltip>
                  {resourceToDeleteId && (
                    <AlertDialogContent>
                        <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the resource
                            <span className="font-semibold"> "{resource.name}"</span> from Firestore.
                        </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {setIsAlertOpen(false); setResourceToDeleteId(null);}}>Cancel</AlertDialogCancel>
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
                        <Image src={resource.imageUrl || 'https://placehold.co/600x400.png'} alt={resource.name} layout="fill" objectFit="cover" data-ai-hint="lab equipment" />
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
                      <li key={period.id || period.startDate} className="pb-2 border-b border-dashed last:border-b-0 last:pb-0">
                        <p className="font-medium text-foreground">
                          {formatDateSafe(parseISO(period.startDate), 'N/A', 'PPP')} - {formatDateSafe(parseISO(period.endDate), 'N/A', 'PPP')}
                        </p>
                        {period.reason && <p className="text-xs text-muted-foreground mt-0.5">Reason: {period.reason}</p>}
                      </li>
                    ))}
                    {sortedUnavailabilityPeriods.length > 5 && <p className="text-xs text-muted-foreground mt-2">...and more periods defined.</p>}
                  </ul>
                </CardContent>
              </Card>
            )}

             {currentUser && resourceUserBookings.length > 0 && (
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
                 <CardDescription>
                    Type: {resourceTypeName} | Lab: {resource.lab}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {resource.description ? (
                <p className="text-base text-foreground leading-relaxed">{resource.description}</p>
              ) : (
                <p className="text-sm text-muted-foreground italic">No description provided.</p>
              )}

              <Separator className="my-4" />
              <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><SlidersHorizontal className="text-primary h-5 w-5"/> Specifications</h3>
              <div className="space-y-1">
                <DetailItem icon={Wrench} label="Manufacturer" value={resource.manufacturer} />
                <DetailItem icon={Archive} label="Model" value={resource.model} />
                <DetailItem icon={UserIconLucide} label="Serial #" value={resource.serialNumber} />
                <DetailItem icon={CalendarIcon} label="Purchase Date" value={resource.purchaseDate} />
              </div>

              {resource.remoteAccess && (Object.values(resource.remoteAccess).some(val => val || typeof val === 'number') || resource.remoteAccess.port !== undefined) && (
                <>
                  <Separator className="my-4" />
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2"><Network className="text-primary h-5 w-5"/> Remote Access</h3>
                  <div className="space-y-1">
                    <DetailItem icon={Globe} label="IP Address" value={resource.remoteAccess.ipAddress} isLink={!!resource.remoteAccess.ipAddress} />
                    <DetailItem icon={Globe} label="Hostname" value={resource.remoteAccess.hostname} isLink={!!resource.remoteAccess.hostname} />
                    <DetailItem icon={ListChecks} label="Protocol" value={resource.remoteAccess.protocol} />
                    <DetailItem icon={KeyRound} label="Username" value={resource.remoteAccess.username} />
                    <DetailItem icon={Fingerprint} label="Port" value={resource.remoteAccess.port?.toString()} />
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
            {resource && resource.status === 'Available' && (
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="text-xl flex items-center gap-2">
                    <CalendarDays className="text-primary h-5 w-5" /> General Availability
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    This resource is generally available for booking during standard lab hours unless an unavailability period is active or it's a lab-wide blackout day.
                  </p>
                </CardContent>
                 <CardFooter className="justify-center border-t pt-4">
                    <Button variant="outline" asChild>
                        <Link href={`/bookings?resourceId=${resource.id}`}>
                            View Full Calendar &amp; Book <ExternalLink className="ml-2 h-3 w-3" />
                        </Link>
                    </Button>
                 </CardFooter>
              </Card>
           )}
        </div>
      </div>

      {resource && isFormDialogOpen && (
        <ResourceFormDialog
            open={isFormDialogOpen}
            onOpenChange={(isOpen) => {
                setIsFormDialogOpen(isOpen);
            }}
            initialResource={resource} 
            onSave={handleSaveResource}
            resourceTypes={fetchedResourceTypesForDialog}
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
