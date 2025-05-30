
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LayoutDashboard, CalendarPlus, ChevronRight, CheckCircle, AlertTriangle, Wrench, Loader2, ThumbsUp, Clock, X, User as UserIconLucide, XCircle } from 'lucide-react'; // Updated icons
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Resource, Booking } from '@/types';
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
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-context';
import { useToast } from '@/hooks/use-toast';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';


// Helper function for robust date conversion
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
        console.warn(`[Dashboard] Parsed non-ISO date string for ${fieldName} in booking ${bookingId}:`, value);
        return directDate;
    }
    console.warn(`[Dashboard] Invalid date string for ${fieldName} in booking ${bookingId} after parseISO and new Date():`, value);
  }
  if (typeof value === 'number') {
     const dateFromNum = new Date(value);
     if (isValid(dateFromNum)) {
         console.warn(`[Dashboard] Converted number to date for ${fieldName} in booking ${bookingId}:`, value);
         return dateFromNum;
     }
  }
  if (value && typeof value.seconds === 'number' && typeof value.nanoseconds === 'number') {
    try {
        console.warn(`[Dashboard] Converting Firestore-like timestamp object for ${fieldName} in booking ${bookingId}:`, value);
        return new Timestamp(value.seconds, value.nanoseconds).toDate();
    } catch (e) {
        console.error(`[Dashboard] Error converting Firestore-like timestamp object for ${fieldName} in booking ${bookingId}:`, value, e);
    }
  }
  console.error(`[Dashboard] CRITICAL: Unexpected data type or invalid date for ${fieldName} in booking ${bookingId}. Using current date as fallback. Value:`, value, `Type: ${typeof value}`);
  return new Date();
};


export default function DashboardPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [frequentlyUsedResources, setFrequentlyUsedResources] = useState<Resource[]>([]);
  const [upcomingUserBookings, setUpcomingUserBookings] = useState<(Booking & { resourceName?: string })[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    console.log("[Dashboard V3] fetchDashboardData called. CurrentUser ID:", currentUser?.id);
    setIsLoadingResources(true);
    setIsLoadingBookings(true);

    try {
      const resourcesQuery = query(collection(db, 'resources'), orderBy('name', 'asc'), limit(3));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const fetchedResources: Resource[] = resourcesSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        const resourceIdForLog = docSnap.id;
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Resource',
          resourceTypeId: data.resourceTypeId || '',
          lab: data.lab || 'Unknown Lab',
          status: data.status || 'Working',
          description: data.description || '',
          imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
          features: Array.isArray(data.features) ? data.features : [],
          purchaseDate: data.purchaseDate ? safeConvertToDate(data.purchaseDate, 'purchaseDate', resourceIdForLog) : undefined,
          lastUpdatedAt: data.lastUpdatedAt ? safeConvertToDate(data.lastUpdatedAt, 'lastUpdatedAt', resourceIdForLog) : undefined,
          createdAt: data.createdAt ? safeConvertToDate(data.createdAt, 'createdAt', resourceIdForLog) : undefined,
        } as Resource;
      });
      setFrequentlyUsedResources(fetchedResources);
      console.log("[Dashboard V3] Fetched frequently used resources count:", fetchedResources.length);
    } catch (error: any) {
      console.error("[Dashboard V3] Error fetching frequently used resources:", error.toString(), error);
      toast({
        title: "Error Loading Resources",
        description: `Could not fetch frequently used resources: ${error.message}`,
        variant: "destructive",
      });
    } finally {
      setIsLoadingResources(false);
    }

    if (currentUser && currentUser.id) {
      console.log(`[Dashboard V3] Fetching upcoming bookings for user: ${currentUser.id}`);
      const todayStart = Timestamp.fromDate(startOfToday()); // Use Firestore Timestamp for query

      try {
        // Firestore Index Required: bookings (userId ASC, endTime ASC, startTime ASC)
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('userId', '==', currentUser.id),
          where('endTime', '>=', todayStart),
          orderBy('startTime', 'asc'),
          limit(5)
        );
        console.log("[Dashboard V3] Upcoming bookings query constructed:", bookingsQuery);
        const bookingsSnapshot = await getDocs(bookingsQuery);
        console.log(`[Dashboard V3] Firestore returned ${bookingsSnapshot.docs.length} bookings for upcoming query.`);

        const fetchedBookingsPromises = bookingsSnapshot.docs.map(async (docSnap) => {
          const bookingData = docSnap.data();
          const bookingId = docSnap.id;
          let resourceNameStr = 'Unknown Resource';
          if (bookingData.resourceId) {
            try {
              const resourceDocRef = doc(db, 'resources', bookingData.resourceId);
              const resourceDocSnap = await getDoc(resourceDocRef);
              if (resourceDocSnap.exists()) {
                resourceNameStr = resourceDocSnap.data()?.name || 'Unknown Resource';
              }
            } catch (resError) {
              console.warn(`[Dashboard V3] Could not fetch resource name for booking ${bookingId}:`, resError);
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
        console.log("[Dashboard V3] Mapped Firestore results (before client filter):", resolvedBookings.length, "bookings");
        // resolvedBookings.forEach(b => console.log(`  - ID: ${b.id}, Start: ${b.startTime?.toISOString()}, End: ${b.endTime?.toISOString()}, Status: ${b.status}`));

        // Client-side filter to ensure we only show bookings whose end time is still in the future (or now)
        // and are not cancelled.
        const now = new Date();
        const clientFilteredBookings = resolvedBookings.filter(b => b.endTime >= now && b.status !== 'Cancelled');

        console.log("[Dashboard V3] Client-side filtered results (endTime >= now && status != Cancelled):", clientFilteredBookings.length, "bookings");
        // clientFilteredBookings.forEach(b => console.log(`  - ID: ${b.id}, Start: ${b.startTime?.toISOString()}, End: ${b.endTime?.toISOString()}, Status: ${b.status}`));

        setUpcomingUserBookings(clientFilteredBookings);

      } catch (error: any) {
        console.error("[Dashboard V3] Full FirebaseError object:", error);
        console.error("[Dashboard V3] Error fetching upcoming bookings:", error.toString());
        toast({
          title: "Error Loading Your Bookings",
          description: `Could not fetch your upcoming bookings: ${error.message}`,
          variant: "destructive",
        });
        setUpcomingUserBookings([]);
      } finally {
        setIsLoadingBookings(false);
      }
    } else {
      console.log("[Dashboard V3] No current user, clearing upcoming bookings and stopping load state.");
      setUpcomingUserBookings([]);
      setIsLoadingBookings(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

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
        description="Overview of lab resources and your bookings."
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
                  <CardDescription>{resource.lab}</CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-grow space-y-3">
                  <div className="relative w-full h-40 rounded-md overflow-hidden">
                    <Image src={resource.imageUrl || 'https://placehold.co/600x400.png'} alt={resource.name} fill style={{objectFit:"cover"}} data-ai-hint="lab equipment" />
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
              <div className="overflow-x-auto border">
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
    </div>
  );
}
