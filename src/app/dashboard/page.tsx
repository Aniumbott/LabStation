
import Image from 'next/image';
import Link from 'next/link';
import { LayoutDashboard, CalendarPlus, ChevronRight, CheckCircle, AlertTriangle, Construction } from 'lucide-react';
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
import { format, isValid, parseISO, isPast } from 'date-fns';
import { cn } from '@/lib/utils';
import { allAdminMockResources, initialBookings, mockCurrentUser } from '@/lib/mock-data';


export default function DashboardPage() {
  // Simulate frequently used by taking the first few resources for demo
  const frequentlyUsedResources = allAdminMockResources.slice(0, 2); 

  const getResourceStatusBadge = (status: Resource['status']) => {
    switch (status) {
      case 'Available':
        return <Badge className="bg-green-500 hover:bg-green-600 text-white border-transparent"><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Booked':
        return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-yellow-950 border-transparent"><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Maintenance':
        return <Badge className="bg-orange-500 hover:bg-orange-600 text-white border-transparent"><Construction className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      default:
        return <Badge variant="outline"><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    }
  };

  const upcomingUserBookings = initialBookings
    .filter(b => {
        const startTime = new Date(b.startTime);
        return isValid(startTime) && !isPast(startTime) && b.status !== 'Cancelled' && b.userId === mockCurrentUser.id;
    })
    .sort((a,b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
    .slice(0, 5);


  return (
    <div className="space-y-8"> {/* Removed max-w-5xl w-full mx-auto from here */}
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
          <div className="grid gap-6 md:grid-cols-2">
            {frequentlyUsedResources.map((resource) => (
              <Card key={resource.id} className="w-full md:max-w-lg flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300"> {/* Added md:max-w-lg */}
                <CardHeader className="p-4">
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
                <CardContent className="p-4 pt-0 flex-grow space-y-3">
                  <div className="relative w-full h-40 rounded-md overflow-hidden">
                    <Image src={resource.imageUrl} alt={resource.name} layout="fill" objectFit="cover" data-ai-hint="microscope electronics" />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{resource.description}</p>
                </CardContent>
                <CardFooter className="p-4 pt-0">
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

      <section> {/* This section will now be wider by default */}
        <h2 className="text-2xl font-semibold mb-4">Your Upcoming Bookings</h2>
        {upcomingUserBookings.length > 0 ? (
          <Card className="shadow-lg">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
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
                    {upcomingUserBookings.map((booking) => (
                      <TableRow key={booking.id}>
                        <TableCell className="font-medium">{booking.resourceName}</TableCell>
                        <TableCell>{format(new Date(booking.startTime), 'MMM dd, yyyy')}</TableCell>
                        <TableCell>{format(new Date(booking.startTime), 'p')} - {format(new Date(booking.endTime), 'p')}</TableCell>
                        <TableCell>
                          <Badge
                              className={cn(
                                  "whitespace-nowrap text-xs px-2 py-0.5 border-transparent",
                                  booking.status === 'Confirmed' && 'bg-green-500 text-white hover:bg-green-600',
                                  booking.status === 'Pending' && 'bg-yellow-500 text-yellow-950 hover:bg-yellow-600',
                                  booking.status === 'Cancelled' && 'bg-gray-400 text-white hover:bg-gray-500'
                              )}
                          >
                              {booking.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" asChild>
                            <Link href={`/bookings?bookingId=${booking.id}&date=${format(new Date(booking.startTime), 'yyyy-MM-dd')}`}>View/Edit</Link>
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
            {upcomingUserBookings.length > 0 && (
                <CardFooter className="justify-end pt-4">
                    <Button variant="outline" asChild>
                        <Link href="/bookings">View All Bookings <ChevronRight className="ml-2 h-4 w-4" /></Link>
                    </Button>
                </CardFooter>
            )}
          </Card>
        ) : (
          <Card className="p-6 text-center shadow-lg">
             <p className="text-muted-foreground">You have no upcoming bookings.</p>
             <Button asChild className="mt-4">
                <Link href="/admin/resources">Find Resources to Book</Link>
             </Button>
          </Card>
        )}
      </section>
    </div>
  );
}
