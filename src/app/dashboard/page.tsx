
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LayoutDashboard, CalendarPlus, ChevronRight, CheckCircle, AlertTriangle, Wrench, Loader2, ThumbsUp, Clock, X, User as UserIconLucide, XCircle, Building, KeyRound, University, PlusCircle, LogOut, Ban } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Resource, Booking, Lab, LabMembership, LabMembershipStatus } from '@/types';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, isValid, isPast, parseISO, compareAsc, startOfToday, startOfDay, Timestamp as FirestoreTimestamp } from 'date-fns';
import { cn, formatDateSafe, getResourceStatusBadge } from '@/lib/utils';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth-context';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';
import { requestLabAccess_SA, cancelLabAccessRequest_SA, leaveLab_SA } from '@/lib/firestore-helpers';


const safeConvertToDate = (value: any, fieldName: string, bookingId: string): Date => {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (typeof value === 'string') {
    const parsed = parseISO(value);
    if (isValid(parsed)) {
      return parsed;
    }
    const directDate = new Date(value);
    if (isValid(directDate)) {
        return directDate;
    }
  }
  if (typeof value === 'number') {
     const dateFromNum = new Date(value);
     if (isValid(dateFromNum)) {
         return dateFromNum;
     }
  }
  if (value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
    try {
        return new Timestamp(value.seconds, value.nanoseconds).toDate();
    } catch (e) {
        // Fall through
    }
  }
  console.error(`[Dashboard] CRITICAL: Unexpected data type or invalid date for ${fieldName} in booking ${bookingId}. Using current date as fallback. Value:`, value, `Type: ${typeof value}`);
  return new Date();
};


export default function DashboardPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [frequentlyUsedResources, setFrequentlyUsedResources] = useState<(Resource & { labName?: string })[]>([]);
  const [upcomingUserBookings, setUpcomingUserBookings] = useState<(Booking & { resourceName?: string })[]>([]);
  
  const [allLabs, setAllLabs] = useState<Lab[]>([]);
  const [userMemberships, setUserMemberships] = useState<LabMembership[]>([]);

  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isLoadingLabsAndMemberships, setIsLoadingLabsAndMemberships] = useState(true);
  const [isMembershipActionLoading, setIsMembershipActionLoading] = useState<Record<string, boolean>>({});


  const fetchDashboardData = useCallback(async () => {
    setIsLoadingResources(true);
    setIsLoadingBookings(true);
    setIsLoadingLabsAndMemberships(true);

    let fetchedLabs: Lab[] = [];
    try {
        const labsSnapshot = await getDocs(query(collection(db, 'labs'), orderBy('name', 'asc')));
        fetchedLabs = labsSnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Lab));
        setAllLabs(fetchedLabs);
    } catch (error: any) {
        toast({ title: "Error Loading Labs Data", variant: "destructive" });
    }

    if (currentUser && currentUser.id && currentUser.role !== 'Admin') {
        try {
            const membershipsQuery = query(collection(db, 'labMemberships'), where('userId', '==', currentUser.id));
            const membershipsSnapshot = await getDocs(membershipsQuery);
            setUserMemberships(membershipsSnapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as LabMembership)));
        } catch (error: any) {
            toast({ title: "Error Loading Your Lab Memberships", variant: "destructive" });
            setUserMemberships([]);
        }
    } else {
        setUserMemberships([]);
    }
    setIsLoadingLabsAndMemberships(false);


    try {
      const resourcesQuery = query(collection(db, 'resources'), orderBy('name', 'asc'), limit(3));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const fetchedResourcesWithLab: (Resource & { labName?: string })[] = resourcesSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const resourceIdForLog = docSnap.id;
        const lab = fetchedLabs.find(l => l.id === data.labId);
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Resource',
          resourceTypeId: data.resourceTypeId || '',
          labId: data.labId || '',
          labName: lab?.name || (data.labId ? 'Unknown Lab' : 'Global/No Lab'),
          status: data.status || 'Working',
          description: data.description || '',
          imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
          features: Array.isArray(data.features) ? data.features : [],
          purchaseDate: data.purchaseDate ? safeConvertToDate(data.purchaseDate, 'purchaseDate', resourceIdForLog) : undefined,
          lastUpdatedAt: data.lastUpdatedAt ? safeConvertToDate(data.lastUpdatedAt, 'lastUpdatedAt', resourceIdForLog) : undefined,
          createdAt: data.createdAt ? safeConvertToDate(data.createdAt, 'createdAt', resourceIdForLog) : undefined,
        } as Resource & { labName?: string };
      });
      setFrequentlyUsedResources(fetchedResourcesWithLab);
    } catch (error: any) {
      toast({ title: "Error Loading Resources", description: `Could not fetch frequently used resources: ${error.message}`, variant: "destructive"});
    } finally {
      setIsLoadingResources(false);
    }

    if (currentUser && currentUser.id) {
      const todayStart = Timestamp.fromDate(startOfToday());
      try {
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('userId', '==', currentUser.id),
          where('endTime', '>=', todayStart),
          orderBy('startTime', 'asc'),
          limit(5)
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        const fetchedBookingsPromises = bookingsSnapshot.docs.map(async (docSnap) => {
          const bookingData = docSnap.data();
          const bookingId = docSnap.id;
          let resourceNameStr = 'Unknown Resource';
          if (bookingData.resourceId) {
            const resourceDocRef = doc(db, 'resources', bookingData.resourceId);
            const resourceDocSnap = await getDoc(resourceDocRef);
            if (resourceDocSnap.exists()) {
              resourceNameStr = resourceDocSnap.data()?.name || 'Unknown Resource';
            }
          }
          return {
            id: bookingId,
            resourceId: bookingData.resourceId,
            userId: bookingData.userId,
            startTime: safeConvertToDate(bookingData.startTime, 'startTime', bookingId),
            endTime: safeConvertToDate(bookingData.endTime, 'endTime', bookingId),
            createdAt: safeConvertToDate(bookingData.createdAt, 'createdAt', bookingId),
            status: bookingData.status as Booking['status'],
            notes: bookingData.notes,
            usageDetails: bookingData.usageDetails,
            resourceName: resourceNameStr,
          } as Booking & { resourceName?: string };
        });
        let resolvedBookings = await Promise.all(fetchedBookingsPromises);
        const now = new Date();
        const clientFilteredBookings = resolvedBookings.filter(b => b.endTime >= now && b.status !== 'Cancelled');
        setUpcomingUserBookings(clientFilteredBookings);
      } catch (error: any) {
        toast({ title: "Error Loading Your Bookings", description: `Could not fetch your upcoming bookings: ${error.message}`, variant: "destructive"});
        setUpcomingUserBookings([]);
      } finally {
        setIsLoadingBookings(false);
      }
    } else {
      setUpcomingUserBookings([]);
      setIsLoadingBookings(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const userActiveLabs = useMemo(() => {
    if (!currentUser || currentUser.role === 'Admin') return [];
    return allLabs.filter(lab => userMemberships.some(m => m.labId === lab.id && m.status === 'active'));
  }, [currentUser, allLabs, userMemberships]);

  const userPendingLabRequests = useMemo(() => {
    if (!currentUser || currentUser.role === 'Admin') return [];
    return userMemberships.filter(m => m.status === 'pending_approval')
      .map(m => ({ ...m, labName: allLabs.find(l => l.id === m.labId)?.name || 'Unknown Lab' }));
  }, [currentUser, userMemberships, allLabs]);

  const availableLabsForRequest = useMemo(() => {
    if (!currentUser || currentUser.role === 'Admin') return [];
    return allLabs.filter(lab =>
      !userMemberships.some(m => m.labId === lab.id && (m.status === 'active' || m.status === 'pending_approval'))
    );
  }, [currentUser, allLabs, userMemberships]);

  const handleRequestAccess = async (labId: string, labName: string) => {
    if (!currentUser) return;
    setIsMembershipActionLoading(prev => ({ ...prev, [labId]: true }));
    const result = await requestLabAccess_SA(currentUser.id, currentUser.name, labId, labName);
    if (result.success) {
      toast({ title: "Request Submitted", description: result.message });
      fetchDashboardData(); // Refresh memberships
    } else {
      toast({ title: "Request Failed", description: result.message, variant: "destructive" });
    }
    setIsMembershipActionLoading(prev => ({ ...prev, [labId]: false }));
  };

  const handleCancelRequest = async (membershipId: string, labName: string) => {
    if (!currentUser || !membershipId) return;
    setIsMembershipActionLoading(prev => ({ ...prev, [membershipId]: true }));
    const result = await cancelLabAccessRequest_SA(currentUser.id, currentUser.name, membershipId, labName);
    if (result.success) {
      toast({ title: "Request Cancelled", description: result.message });
      fetchDashboardData(); // Refresh memberships
    } else {
      toast({ title: "Cancellation Failed", description: result.message, variant: "destructive" });
    }
    setIsMembershipActionLoading(prev => ({ ...prev, [membershipId]: false }));
  };

  const handleLeaveLab = async (membershipId: string, labName: string) => {
    if (!currentUser || !membershipId) return;
    setIsMembershipActionLoading(prev => ({ ...prev, [membershipId]: true }));
    const result = await leaveLab_SA(currentUser.id, currentUser.name, membershipId, labName);
    if (result.success) {
      toast({ title: "Left Lab", description: result.message });
      fetchDashboardData(); // Refresh memberships
    } else {
      toast({ title: "Failed to Leave Lab", description: result.message, variant: "destructive" });
    }
    setIsMembershipActionLoading(prev => ({ ...prev, [membershipId]: false }));
  };


  const getBookingStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'Confirmed':
        return <Badge className={cn("bg-green-500 text-white hover:bg-green-600 border-transparent")}><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Pending':
        return <Badge className={cn("bg-yellow-500 text-yellow-950 hover:bg-yellow-600 border-transparent")}><Clock className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Cancelled':
        return <Badge className={cn("bg-gray-400 text-white hover:bg-gray-500 border-transparent")}><X className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
       case 'Waitlisted':
         return <Badge className={cn("bg-purple-500 text-white hover:bg-purple-600 border-transparent")}><UserIconLucide className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };


  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of lab resources, your bookings, and lab access."
        icon={LayoutDashboard}
      />

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-2xl font-semibold">Frequently Used Resources</h2>
          {frequentlyUsedResources.length > 0 && (
             <Button asChild variant="outline" size="sm">
              <Link href="/admin/resources">View All</Link>
            </Button>
          )}
        </div>
        {isLoadingResources ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading resources...</div>
        ) : frequentlyUsedResources.length > 0 ? (
          <div className="w-fit grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
            {frequentlyUsedResources.map((resource) => (
              <Card key={resource.id} className="w-full md:max-w-md flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300 p-4">
                <CardHeader className="p-0 pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg hover:text-primary transition-colors">
                      <Link href={`/resources/${resource.id}`}>
                        {resource.name}
                      </Link>
                    </CardTitle>
                    {getResourceStatusBadge(resource.status)}
                  </div>
                  <CardDescription className="flex items-center gap-1">
                     <Building className="h-3.5 w-3.5 text-muted-foreground"/> {resource.labName || 'N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-grow space-y-3">
                  <div className="relative w-full h-40 rounded-md overflow-hidden">
                    <Image src={resource.imageUrl || 'https://placehold.co/600x400.png'} alt={resource.name} fill style={{objectFit:"cover"}} data-ai-hint="lab equipment"/>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{resource.description}</p>
                </CardContent>
                <CardFooter className="p-0 pt-3">
                  <Button asChild size="sm" className="w-full" disabled={resource.status !== 'Working'}>
                    <Link href={`/bookings?resourceId=${resource.id}`}>
                      <CalendarPlus className="mr-2 h-4 w-4" />
                      Book Now
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center shadow-md border-0 bg-card">
            <CardContent>
              <p className="text-muted-foreground">No frequently used resources to display. Explore resources via <Link href="/admin/resources" className="text-primary hover:underline">Resources</Link>.</p>
            </CardContent>
          </Card>
        )}
      </section>

      <Separator />

      <section>
        <h2 className="text-2xl font-semibold mb-4">Your Upcoming Bookings</h2>
        {isLoadingBookings ? (
          <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading bookings...</div>
        ) : currentUser && upcomingUserBookings.length > 0 ? (
          <Card className="shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto border rounded-t-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Date & Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingUserBookings.map((booking) => {
                      const resourceNameDisplay = booking.resourceName || 'Loading...';

                      return (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">{resourceNameDisplay}</TableCell>
                          <TableCell>
                            <div>{formatDateSafe(booking.startTime, 'Invalid Date', 'MMM dd, yyyy')}</div>
                            <div className="text-xs text-muted-foreground">
                              {isValid(booking.startTime) && isValid(booking.endTime) ? `${format(booking.startTime, 'p')} - ${format(booking.endTime, 'p')}` : 'Invalid Time'}
                            </div>
                          </TableCell>
                          <TableCell>
                            {getBookingStatusBadge(booking.status)}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/bookings?bookingId=${booking.id}&date=${isValid(booking.startTime) ? format(booking.startTime, 'yyyy-MM-dd') : ''}`}>View/Edit</Link>
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            {upcomingUserBookings.length > 0 && (
              <CardFooter className="justify-end pt-4 border-t">
                <Button variant="outline" asChild>
                  <Link href="/bookings">View All Bookings <ChevronRight className="ml-2 h-4 w-4" /></Link>
                </Button>
              </CardFooter>
            )}
          </Card>
        ) : (
          <Card className="p-6 text-center shadow-md border-0 bg-card">
            <CardContent>
              <p className="text-muted-foreground">
                {currentUser ? "You have no upcoming bookings." : "Please log in to see your bookings."}
              </p>
              {currentUser && (
                <Button asChild className="mt-4">
                  <Link href="/admin/resources">Find Resources to Book</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </section>
      
      {currentUser && currentUser.role !== 'Admin' && (
        <>
          <Separator />
          <section>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-semibold">My Labs</h2>
            </div>
            {isLoadingLabsAndMemberships ? (
                <div className="flex justify-center items-center py-10"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> Loading your lab access...</div>
            ) : userActiveLabs.length > 0 ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {userActiveLabs.map(lab => {
                        const membership = userMemberships.find(m => m.labId === lab.id && m.status === 'active');
                        return (
                            <Card key={lab.id} className="shadow-md hover:shadow-lg transition-shadow">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2"><University className="h-5 w-5 text-primary"/>{lab.name}</CardTitle>
                                    {lab.location && <CardDescription>{lab.location}</CardDescription>}
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground line-clamp-2">{lab.description || "No description available for this lab."}</p>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-2">
                                    <Button variant="outline" size="sm" asChild className="w-full">
                                        <Link href={`/admin/resources?labId=${lab.id}`}>View Resources</Link>
                                    </Button>
                                    {membership?.id && (
                                        <Button variant="destructive" size="sm" className="w-full" onClick={() => handleLeaveLab(membership.id!, lab.name)} disabled={isMembershipActionLoading[membership.id!]}>
                                            {isMembershipActionLoading[membership.id!] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogOut className="mr-2 h-4 w-4"/>}
                                            Leave Lab
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                 <Card className="p-6 text-center shadow-md border-0 bg-card">
                    <CardContent>
                    <KeyRound className="h-10 w-10 mx-auto mb-3 text-muted-foreground opacity-60"/>
                    <p className="text-muted-foreground">
                        You currently do not have active access to any labs.
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">You can request access to available labs below.</p>
                    </CardContent>
                </Card>
            )}
          </section>

          {userPendingLabRequests.length > 0 && (
            <>
              <Separator />
              <section>
                <h2 className="text-2xl font-semibold mb-4">Pending Lab Access Requests</h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {userPendingLabRequests.map(req => (
                    <Card key={req.id} className="shadow-sm border-dashed">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-yellow-500"/>{req.labName}</CardTitle>
                        <CardDescription>Status: Pending Approval</CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => handleCancelRequest(req.id!, req.labName!)} disabled={isMembershipActionLoading[req.id!]}>
                           {isMembershipActionLoading[req.id!] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
                          Cancel Request
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </section>
            </>
          )}

          {availableLabsForRequest.length > 0 && (
            <>
              <Separator />
              <section>
                <h2 className="text-2xl font-semibold mb-4">Available Labs</h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {availableLabsForRequest.map(lab => (
                    <Card key={lab.id} className="shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg">{lab.name}</CardTitle>
                        {lab.location && <CardDescription>{lab.location}</CardDescription>}
                      </CardHeader>
                       <CardContent>
                         <p className="text-sm text-muted-foreground line-clamp-2">{lab.description || "No description."}</p>
                       </CardContent>
                      <CardFooter>
                        <Button variant="default" size="sm" className="w-full" onClick={() => handleRequestAccess(lab.id, lab.name)} disabled={isMembershipActionLoading[lab.id]}>
                          {isMembershipActionLoading[lab.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                          Request Access
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}

