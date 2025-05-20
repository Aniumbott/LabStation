
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LayoutDashboard, CalendarPlus, ChevronRight, CheckCircle, AlertTriangle, Construction, Clock } from 'lucide-react';
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
import { format, isValid, isPast, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { allAdminMockResources, initialBookings, getWaitlistPosition } from '@/lib/mock-data';
import { useState, useEffect } from 'react';
import { useAuth } from '@/components/auth-context';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [frequentlyUsedResources, setFrequentlyUsedResources] = useState<Resource[]>([]);
  const [upcomingUserBookings, setUpcomingUserBookings] = useState<Booking[]>([]);

  useEffect(() => {
    // Simulate fetching frequently used resources; here, just take the first few.
    setFrequentlyUsedResources(allAdminMockResources.slice(0, 2)); 
    
    if (currentUser) {
      const filteredBookings = initialBookings
        .filter(b => {
            const startTimeDate = new Date(b.startTime); // Ensure startTime is a Date object
            return isValid(startTimeDate) && !isPast(startTimeDate) && b.status !== 'Cancelled' && b.userId === currentUser.id;
        })
        .map(b => ({...b, createdAt: b.createdAt ? new Date(b.createdAt) : new Date(b.startTime) })) 
        .sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
        .slice(0, 5);
      setUpcomingUserBookings(filteredBookings);
    } else {
      setUpcomingUserBookings([]);
    }
  }, [currentUser]);


  const getResourceStatusBadge = (status: Resource['status']) => {
    switch (status) {
      case 'Available':
        return <Badge className={cn("bg-green-500 hover:bg-green-600 text-white border-transparent")}><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Booked':
        return <Badge className={cn("bg-yellow-500 hover:bg-yellow-600 text-yellow-950 border-transparent")}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Maintenance':
        return <Badge className={cn("bg-orange-500 hover:bg-orange-600 text-white border-transparent")}><Construction className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      default:
        return <Badge variant="outline"><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
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
          {allAdminMockResources.length > 2 && frequentlyUsedResources.length > 0 && (
            <Button asChild variant="outline" size="sm">
              <Link href="/admin/resources">View All <ChevronRight className="ml-1.5 h-4 w-4" /></Link>
            </Button>
          )}
        </div>
        {frequentlyUsedResources.length > 0 ? (
          <div className="grid w-fit gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
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
                  <CardDescription>{resource.lab} - {resource.resourceTypeName}</CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-grow space-y-3">
                  <div className="relative w-full h-40 rounded-md overflow-hidden">
                    <Image src={resource.imageUrl} alt={resource.name} layout="fill" objectFit="cover" />
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
          <Card className="p-6 text-center shadow-lg">
            <p className="text-muted-foreground">No frequently used resources configured. Explore resources via <Link href="/admin/resources" className="text-primary hover:underline">Resources</Link>.</p>
          </Card>
        )}
      </section>

      <Separator />

      <section>
        <h2 className="text-2xl font-semibold mb-4">Your Upcoming Bookings</h2>
        {currentUser && upcomingUserBookings.length > 0 ? (
          <Card className="shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto rounded-lg border shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Resource</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upcomingUserBookings.map((booking) => {
                      const startTimeDate = new Date(booking.startTime);
                      const endTimeDate = new Date(booking.endTime);
                      const waitlistPosition = getWaitlistPosition(booking, initialBookings);
                      return (
                        <TableRow key={booking.id}>
                          <TableCell className="font-medium">{booking.resourceName}</TableCell>
                          <TableCell>{isValid(startTimeDate) ? format(startTimeDate, 'MMM dd, yyyy') : 'Invalid Date'}</TableCell>
                          <TableCell>{isValid(startTimeDate) && isValid(endTimeDate) ? `${format(startTimeDate, 'p')} - ${format(endTimeDate, 'p')}` : 'Invalid Time'}</TableCell>
                          <TableCell>
                            <Badge
                                className={cn(
                                    "whitespace-nowrap text-xs px-2 py-0.5 border-transparent",
                                    booking.status === 'Confirmed' && 'bg-green-500 text-white hover:bg-green-600',
                                    booking.status === 'Pending' && 'bg-yellow-500 text-yellow-950 hover:bg-yellow-600',
                                    booking.status === 'Cancelled' && 'bg-gray-400 text-white hover:bg-gray-500',
                                    booking.status === 'Waitlisted' && 'bg-purple-500 text-white hover:bg-purple-600'
                                )}
                            >
                                {booking.status} {booking.status === 'Waitlisted' && waitlistPosition != null && `(#${waitlistPosition})`}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" asChild>
                              <Link href={`/bookings?bookingId=${booking.id}&date=${format(startTimeDate, 'yyyy-MM-dd')}`}>View/Edit</Link>
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
          <Card className="p-6 text-center shadow-lg">
             <p className="text-muted-foreground">
               {currentUser ? "You have no upcoming bookings." : "Please log in to see your bookings."}
             </p>
             {currentUser && (
                <Button asChild className="mt-4">
                    <Link href="/admin/resources">Find Resources to Book</Link>
                </Button>
             )}
          </Card>
        )}
      </section>
    </div>
  );
}

    