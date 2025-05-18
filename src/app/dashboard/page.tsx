
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
import { format, isValid, parseISO } from 'date-fns';
import { cn } from '@/lib/utils';
import { allAdminMockResources } from '@/app/admin/resources/page'; // Import from admin resources

const mockBookings: Booking[] = [
  { id: 'b1', resourceId: '1', resourceName: 'Electron Microscope Alpha', userId: 'user1', userName: 'Dr. Smith', startTime: new Date(new Date().setDate(new Date().getDate() + 1)), endTime: new Date(new Date(new Date().setDate(new Date().getDate() + 1)).setHours(new Date().getHours() + 2)), status: 'Confirmed' },
  { id: 'b2', resourceId: '4', resourceName: 'High-Speed Centrifuge Pro', userId: 'user2', userName: 'Dr. Jones', startTime: new Date(new Date().setDate(new Date().getDate() + 2)), endTime: new Date(new Date(new Date().setDate(new Date().getDate() + 2)).setHours(new Date().getHours() + 3)), status: 'Pending' },
];


export default function DashboardPage() {
  const frequentlyUsedResources = allAdminMockResources.slice(0, 2); // Use resources from admin page

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

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of lab resources and your bookings."
        icon={LayoutDashboard}
      />

      <section>
        <h2 className="text-2xl font-semibold mb-4">Frequently Used Resources</h2>
        {frequentlyUsedResources.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {frequentlyUsedResources.map((resource) => (
              <Card key={resource.id} className="flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300">
                <CardHeader>
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
                <CardContent className="flex-grow space-y-3">
                  <div className="relative w-full h-40 rounded-md overflow-hidden mb-2">
                    <Image src={resource.imageUrl} alt={resource.name} layout="fill" objectFit="cover" data-ai-hint={resource.dataAiHint || 'lab equipment'} />
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{resource.description}</p>
                   {resource.features && resource.features.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold mb-1 text-muted-foreground">Features:</h4>
                      <div className="flex flex-wrap gap-1">
                        {resource.features.slice(0, 3).map((feature, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">{feature}</Badge>
                        ))}
                        {resource.features.length > 3 && <Badge variant="secondary" className="text-xs">...</Badge>}
                      </div>
                    </div>
                  )}
                  {(resource.lastCalibration || resource.nextCalibration) && (
                     <div className="text-xs text-muted-foreground space-y-0.5 pt-1 border-t border-dashed mt-2">
                        {resource.lastCalibration && resource.lastCalibration !== 'N/A' && <p>Last Calibrated: {isValid(parseISO(resource.lastCalibration)) ? format(parseISO(resource.lastCalibration), 'MMM dd, yyyy') : resource.lastCalibration}</p>}
                        {resource.nextCalibration && resource.nextCalibration !== 'N/A' && <p>Next Due: {isValid(parseISO(resource.nextCalibration)) ? format(parseISO(resource.nextCalibration), 'MMM dd, yyyy') : resource.nextCalibration}</p>}
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button asChild size="sm" className="w-full" disabled={resource.status !== 'Available'}>
                    <Link href={`/bookings?resourceId=${resource.id}`}>
                      <CalendarPlus className="mr-2 h-4 w-4" />
                       {resource.status === 'Available' ? 'Book Now' : resource.status}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-6 text-center shadow-lg">
            <p className="text-muted-foreground">No frequently used resources configured. Explore resources via <Link href="/admin/resources" className="text-primary hover:underline">Manage Resources</Link>.</p>
          </Card>
        )}
        {allAdminMockResources.length > 2 && frequentlyUsedResources.length > 0 && (
            <div className="mt-4 text-right">
                <Button variant="outline" asChild>
                    <Link href="/admin/resources">View All Resources <ChevronRight className="ml-2 h-4 w-4" /></Link>
                </Button>
            </div>
        )}
      </section>

      <Separator />

      <section>
        <h2 className="text-2xl font-semibold mb-4">Your Upcoming Bookings</h2>
        {mockBookings.length > 0 ? (
          <Card className="shadow-lg">
            <CardContent className="p-0">
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
                  {mockBookings.map((booking) => (
                    <TableRow key={booking.id}>
                      <TableCell className="font-medium">{booking.resourceName}</TableCell>
                      <TableCell>{format(booking.startTime, 'MMM dd, yyyy')}</TableCell>
                      <TableCell>{format(booking.startTime, 'p')} - {format(booking.endTime, 'p')}</TableCell>
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
                          <Link href={`/bookings?bookingId=${booking.id}&date=${format(booking.startTime, 'yyyy-MM-dd')}`}>View/Edit</Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
            <CardFooter className="justify-end pt-4">
                 <Button variant="outline" asChild>
                    <Link href="/bookings">View All Bookings <ChevronRight className="ml-2 h-4 w-4" /></Link>
                </Button>
            </CardFooter>
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
