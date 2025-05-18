
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

const mockResources: Resource[] = [
  {
    id: '1',
    name: 'Electron Microscope Alpha',
    type: 'Microscope',
    lab: 'Lab A',
    status: 'Available',
    description: 'High-resolution electron microscope for advanced material analysis and detailed imaging of various samples. Includes EDX spectroscopy capabilities.',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'microscope electronics',
    features: ['SEM', 'TEM', 'EDX'],
    lastCalibration: '2023-12-01',
    nextCalibration: '2024-06-01',
    availability: [{ date: 'Today', slots: ['14:00-16:00'] }, { date: 'Tomorrow', slots: ['10:00-12:00'] }],
  },
  {
    id: '2',
    name: 'BioSafety Cabinet Omega',
    type: 'Incubator',
    lab: 'Lab B',
    status: 'Booked',
    description: 'Class II Type A2 biosafety cabinet for sterile work with cell cultures and other sensitive biological materials.',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'lab cabinet',
    features: ['HEPA Filtered', 'UV Sterilization'],
    lastCalibration: '2024-01-15',
    nextCalibration: '2024-07-15',
    availability: [{ date: 'Tomorrow', slots: ['09:00-11:00'] }],
  },
  {
    id: '3',
    name: 'HPLC System Zeta',
    type: 'HPLC System',
    lab: 'Lab C',
    status: 'Maintenance',
    description: 'High-performance liquid chromatography system for precise compound separation and quantification.',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'hplc chemistry',
    features: ['Autosampler', 'UV Detector', 'Diode Array Detector'],
    lastCalibration: '2023-11-10',
    nextCalibration: 'N/A',
  },
];

const mockBookings: Booking[] = [
  { id: 'b1', resourceId: '1', resourceName: 'Electron Microscope Alpha', userId: 'user1', userName: 'Dr. Smith', startTime: new Date(new Date().setDate(new Date().getDate() + 1)), endTime: new Date(new Date(new Date().setDate(new Date().getDate() + 1)).setHours(new Date().getHours() + 2)), status: 'Confirmed' },
  { id: 'b2', resourceId: '4', resourceName: 'Centrifuge MaxSpin', userId: 'user2', userName: 'Dr. Jones', startTime: new Date(new Date().setDate(new Date().getDate() + 2)), endTime: new Date(new Date(new Date().setDate(new Date().getDate() + 2)).setHours(new Date().getHours() + 3)), status: 'Pending' },
];


export default function DashboardPage() {
  const availableResources = mockResources.filter(r => r.status === 'Available').slice(0, 2);

  const getResourceStatusBadge = (status: Resource['status']) => {
    const baseBadgeClass = "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors";
    switch (status) {
      case 'Available':
        return <Badge className={`${baseBadgeClass} bg-green-500 text-white border-transparent hover:bg-green-600`}><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Booked':
        return <Badge className={`${baseBadgeClass} bg-yellow-400 text-yellow-900 border-transparent hover:bg-yellow-500`}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Maintenance':
        return <Badge className={`${baseBadgeClass} bg-orange-500 text-white border-transparent hover:bg-orange-600`}><Construction className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      default:
        return <Badge variant="outline" className={baseBadgeClass}><AlertTriangle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
    }
  };

  const getBookingStatusVariant = (status: Booking['status']): 'default' | 'secondary' | 'outline' | 'destructive' => {
    switch (status) {
      case 'Confirmed':
        return 'default';
      case 'Pending':
        return 'secondary';
      case 'Cancelled':
        return 'outline';
      default:
        return 'outline';
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
        <h2 className="text-2xl font-semibold mb-4">Quick Available Resources</h2>
        {availableResources.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2">
            {availableResources.map((resource) => (
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
                  <CardDescription>{resource.lab} - {resource.type}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow space-y-3">
                  <div className="relative w-full h-40 rounded-md overflow-hidden mb-2">
                    <Image src={resource.imageUrl} alt={resource.name} layout="fill" objectFit="cover" data-ai-hint={resource.dataAiHint} />
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
                        {resource.lastCalibration && resource.lastCalibration !== 'N/A' && <p>Last Calibrated: {format(parseISO(resource.lastCalibration), 'MMM dd, yyyy')}</p>}
                        {resource.nextCalibration && resource.nextCalibration !== 'N/A' && <p>Next Due: {format(parseISO(resource.nextCalibration), 'MMM dd, yyyy')}</p>}
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
            <p className="text-muted-foreground">No resources immediately available. Try the full <Link href="/resources" className="text-primary hover:underline">Resource Search</Link>.</p>
          </Card>
        )}
        {mockResources.length > 2 && availableResources.length > 0 && (
            <div className="mt-4 text-right">
                <Button variant="outline" asChild>
                    <Link href="/resources">View All Resources <ChevronRight className="ml-2 h-4 w-4" /></Link>
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
                        <Badge variant={getBookingStatusVariant(booking.status)}>
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
                <Link href="/resources">Find Resources to Book</Link>
             </Button>
          </Card>
        )}
      </section>
    </div>
  );
}
