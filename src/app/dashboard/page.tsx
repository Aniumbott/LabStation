import Image from 'next/image';
import Link from 'next/link';
import { LayoutDashboard, CalendarPlus, ChevronRight } from 'lucide-react';
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
import { format } from 'date-fns';

const mockResources: Resource[] = [
  {
    id: '1',
    name: 'Electron Microscope Alpha',
    type: 'Microscope',
    lab: 'Lab A',
    status: 'Available',
    description: 'High-resolution electron microscope for advanced material analysis.',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'microscope electronics',
    availability: [{ date: 'Today', slots: ['10:00-12:00', '14:00-16:00'] }],
  },
  {
    id: '2',
    name: 'BioSafety Cabinet Omega',
    type: 'Incubator', // Assuming this category covers it or need to expand types
    lab: 'Lab B',
    status: 'Booked',
    description: 'Class II Type A2 biosafety cabinet for sterile work.',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'lab cabinet',
    availability: [{ date: 'Tomorrow', slots: ['09:00-11:00'] }],
  },
  {
    id: '3',
    name: 'HPLC System Zeta',
    type: 'HPLC System',
    lab: 'Lab C',
    status: 'Maintenance',
    description: 'High-performance liquid chromatography system for compound separation.',
    imageUrl: 'https://placehold.co/600x400.png',
    dataAiHint: 'hplc chemistry',
  },
];

const mockBookings: Booking[] = [
  { id: 'b1', resourceId: '1', resourceName: 'Electron Microscope Alpha', userId: 'user1', userName: 'Dr. Smith', startTime: new Date(new Date().setDate(new Date().getDate() + 1)), endTime: new Date(new Date().setDate(new Date().getDate() + 1)), status: 'Confirmed' },
  { id: 'b2', resourceId: '4', resourceName: 'Centrifuge MaxSpin', userId: 'user2', userName: 'Dr. Jones', startTime: new Date(new Date().setDate(new Date().getDate() + 2)), endTime: new Date(new Date().setDate(new Date().getDate() + 2)), status: 'Confirmed' },
];


export default function DashboardPage() {
  const availableResources = mockResources.filter(r => r.status === 'Available').slice(0, 2);

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
              <Card key={resource.id} className="flex flex-col">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg">{resource.name}</CardTitle>
                    <Badge variant={resource.status === 'Available' ? 'default' : 'secondary'} className={resource.status === 'Available' ? 'bg-green-500 text-white' : ''}>
                      {resource.status}
                    </Badge>
                  </div>
                  <CardDescription>{resource.lab} - {resource.type}</CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="relative w-full h-40 rounded-md overflow-hidden mb-4">
                    <Image src={resource.imageUrl} alt={resource.name} layout="fill" objectFit="cover" data-ai-hint={resource.dataAiHint} />
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{resource.description}</p>
                  {resource.availability && resource.availability.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-1">Next Available:</h4>
                      <ul className="text-xs list-disc list-inside text-muted-foreground">
                        {resource.availability.map(avail => 
                          avail.slots.map(slot => <li key={slot}>{avail.date} at {slot}</li>)
                        )}
                      </ul>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button asChild size="sm" className="w-full">
                    <Link href={`/bookings?resourceId=${resource.id}`}>
                      <CalendarPlus className="mr-2 h-4 w-4" /> Book Now
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <p className="text-muted-foreground">No resources immediately available. Try the full <Link href="/resources" className="text-primary hover:underline">Resource Search</Link>.</p>
        )}
        {availableResources.length > 0 && (
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
          <Card>
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
                      <TableCell><Badge variant={booking.status === 'Confirmed' ? 'default' : 'secondary'}  className={booking.status === 'Confirmed' ? 'bg-green-500 text-white' : ''}>{booking.status}</Badge></TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" asChild>
                          <Link href={`/bookings/${booking.id}`}>View/Edit</Link>
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
          <Card className="p-6 text-center">
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
