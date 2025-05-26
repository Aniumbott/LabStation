
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LayoutDashboard, CalendarPlus, ChevronRight, CheckCircle, AlertTriangle, Construction, Loader2, ThumbsUp, Clock, X } from 'lucide-react';
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
import { format, isValid, isPast, parseISO, compareAsc } from 'date-fns';
import { cn, formatDateSafe, getResourceStatusBadge } from '@/lib/utils';
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/components/auth-context';
import { db } from '@/lib/firebase';
import { collection, query, where, orderBy, limit, getDocs, doc, getDoc, Timestamp } from 'firebase/firestore';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [frequentlyUsedResources, setFrequentlyUsedResources] = useState<Resource[]>([]);
  const [upcomingUserBookings, setUpcomingUserBookings] = useState<Booking[]>([]);
  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    setIsLoadingResources(true);
    try {
      const resourcesQuery = query(collection(db, 'resources'), limit(3));
      const resourcesSnapshot = await getDocs(resourcesQuery);
      const fetchedResources: Resource[] = resourcesSnapshot.docs.map(docSnap => {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          name: data.name || 'Unnamed Resource',
          resourceTypeId: data.resourceTypeId || '',
          lab: data.lab || 'Unknown Lab',
          status: data.status || 'Available',
          description: data.description || '',
          imageUrl: data.imageUrl || 'https://placehold.co/600x400.png',
          features: Array.isArray(data.features) ? data.features : [],
          purchaseDate: data.purchaseDate instanceof Timestamp ? data.purchaseDate.toDate() : undefined,
          lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate() : undefined,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
          // No availability field to process
        } as Resource;
      });
      setFrequentlyUsedResources(fetchedResources);
    } catch (error) {
      console.error("Error fetching frequently used resources:", error);
    }
    setIsLoadingResources(false);

    if (currentUser) {
      setIsLoadingBookings(true);
      try {
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('userId', '==', currentUser.id),
          where('startTime', '>=', Timestamp.fromDate(new Date())),
          orderBy('startTime', 'asc'),
          limit(5)
        );
        const bookingsSnapshot = await getDocs(bookingsQuery);
        const fetchedBookingsPromises = bookingsSnapshot.docs.map(async (docSnap) => {
          const bookingData = docSnap.data();
          let resourceNameStr = 'Unknown Resource';
          if (bookingData.resourceId) {
            const resourceDocRef = doc(db, 'resources', bookingData.resourceId);
            const resourceDocSnap = await getDoc(resourceDocRef);
            if (resourceDocSnap.exists()) {
              resourceNameStr = resourceDocSnap.data()?.name || 'Unknown Resource';
            }
          }
          return {
            id: docSnap.id,
            ...bookingData,
            startTime: bookingData.startTime instanceof Timestamp ? bookingData.startTime.toDate() : new Date(),
            endTime: bookingData.endTime instanceof Timestamp ? bookingData.endTime.toDate() : new Date(),
            createdAt: bookingData.createdAt instanceof Timestamp ? bookingData.createdAt.toDate() : new Date(),
          } as Booking;
        });
        let resolvedBookings = await Promise.all(fetchedBookingsPromises);
        setUpcomingUserBookings(resolvedBookings);
      } catch (error) {
        console.error("Error fetching upcoming bookings:", error);
      }
      setIsLoadingBookings(false);
    } else {
      setUpcomingUserBookings([]);
      setIsLoadingBookings(false);
    }
  }, [currentUser]);

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
         return <Badge className={cn("bg-purple-500 text-white hover:bg-purple-600 border-transparent")}>{status}</Badge>;
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
              <Card key={resource.id} className="w-full md:max-w-lg flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300 p-4">
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
                  <Button asChild size="sm" className="w-full" disabled={resource.status !== 'Available'}>
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
              <div className="overflow-x-auto">
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
                      const resource = frequentlyUsedResources.find(r => r.id === booking.resourceId);
                      const resourceNameDisplay = resource?.name || 'Loading...'; 
                      
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
