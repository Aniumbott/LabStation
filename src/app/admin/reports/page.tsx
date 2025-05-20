
'use client';

import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { BarChart3, ClipboardList, AlertTriangle, Users, PieChart } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Separator } from '@/components/ui/separator';
import {
  allAdminMockResources,
  initialBookings,
  initialMaintenanceRequests,
  maintenanceRequestStatuses,
  initialMockUsers,
  userRolesList,
} from '@/lib/mock-data';
import type { Resource, Booking, MaintenanceRequest, User, RoleName, MaintenanceRequestStatus } from '@/types';

interface ReportItem {
  name: string;
  count: number;
}

export default function ReportsPage() {
  const bookingsPerResource = useMemo(() => {
    const report: ReportItem[] = [];
    allAdminMockResources.forEach(resource => {
      const count = initialBookings.filter(
        booking => booking.resourceId === resource.id && booking.status !== 'Cancelled'
      ).length;
      report.push({ name: resource.name, count });
    });
    return report.sort((a, b) => b.count - a.count);
  }, []);

  const maintenanceByStatus = useMemo(() => {
    const report: ReportItem[] = [];
    maintenanceRequestStatuses.forEach(status => {
      const count = initialMaintenanceRequests.filter(req => req.status === status).length;
      report.push({ name: status, count });
    });
    return report;
  }, []);

  const usersByRole = useMemo(() => {
    const report: ReportItem[] = [];
    userRolesList.forEach(role => {
      const count = initialMockUsers.filter(user => user.role === role).length;
      report.push({ name: role, count });
    });
    return report;
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports &amp; Analytics"
        description="View various statistics on lab usage and resource management."
        icon={BarChart3}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Bookings per Resource
            </CardTitle>
            <CardDescription>Total non-cancelled bookings for each lab resource.</CardDescription>
          </CardHeader>
          <CardContent>
            {bookingsPerResource.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Resource Name</TableHead>
                    <TableHead className="text-right">Bookings</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookingsPerResource.slice(0, 7).map(item => ( // Show top 7
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No booking data available.</p>
            )}
             {bookingsPerResource.length > 7 && <p className="text-xs text-muted-foreground mt-2">...and more.</p>}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-primary" />
              Maintenance Request Status
            </CardTitle>
            <CardDescription>Summary of maintenance requests by their current status.</CardDescription>
          </CardHeader>
          <CardContent>
            {maintenanceByStatus.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {maintenanceByStatus.map(item => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No maintenance data available.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              User Role Distribution
            </CardTitle>
            <CardDescription>Number of users assigned to each role.</CardDescription>
          </CardHeader>
          <CardContent>
            {usersByRole.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usersByRole.map(item => (
                    <TableRow key={item.name}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="text-right">{item.count}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-muted-foreground">No user data available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card className="shadow-lg border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PieChart className="h-5 w-5 text-primary" />
            Advanced Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            More advanced reports and visualizations are coming soon, including:
          </p>
          <ul className="list-disc list-inside text-muted-foreground mt-2 space-y-1 text-sm">
            <li>Resource Utilization Percentages</li>
            <li>Peak Booking Hours Analysis</li>
            <li>Average Queue Wait Times (when queueing is fully implemented)</li>
            <li>Calibration Compliance Tracking</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

    