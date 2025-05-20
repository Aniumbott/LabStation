
'use client';

import { useMemo } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { BarChart3, ClipboardList, AlertTriangle, Users, PieChart as PieChartIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

interface ReportItem {
  name: string;
  count: number;
  fill?: string; // For PieChart colors
}

const CHART_COLORS = {
  bookings: "hsl(var(--chart-1))",
  maintenance: {
    Open: "hsl(var(--chart-2))",
    "In Progress": "hsl(var(--chart-3))",
    Resolved: "hsl(var(--chart-4))",
    Closed: "hsl(var(--chart-5))",
  },
  users: "hsl(var(--chart-1))",
};

export default function ReportsPage() {
  const bookingsPerResource: ReportItem[] = useMemo(() => {
    const report: ReportItem[] = [];
    allAdminMockResources.forEach(resource => {
      const count = initialBookings.filter(
        booking => booking.resourceId === resource.id && booking.status !== 'Cancelled'
      ).length;
      if (count > 0) { // Only include resources with bookings for cleaner chart
         report.push({ name: resource.name, count });
      }
    });
    return report.sort((a, b) => b.count - a.count).slice(0, 10); // Show top 10
  }, []);

  const bookingsChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    bookingsPerResource.forEach(item => {
      config[item.name] = {
        label: item.name,
        color: CHART_COLORS.bookings,
      };
    });
    config["count"] = { label: "Bookings", color: CHART_COLORS.bookings };
    return config;
  }, [bookingsPerResource]);


  const maintenanceByStatus: ReportItem[] = useMemo(() => {
    const report: ReportItem[] = [];
    maintenanceRequestStatuses.forEach(status => {
      const count = initialMaintenanceRequests.filter(req => req.status === status).length;
      if (count > 0) {
        report.push({ name: status, count, fill: CHART_COLORS.maintenance[status] });
      }
    });
    return report;
  }, []);
  
  const maintenanceChartConfig = useMemo(() => {
    const config: ChartConfig = {};
     maintenanceByStatus.forEach(item => {
      config[item.name] = {
        label: item.name,
        color: item.fill!,
      };
    });
    return config;
  }, [maintenanceByStatus]);


  const usersByRole: ReportItem[] = useMemo(() => {
    const report: ReportItem[] = [];
    userRolesList.forEach(role => {
      const count = initialMockUsers.filter(user => user.role === role).length;
       if (count > 0) {
        report.push({ name: role, count });
       }
    });
    return report;
  }, []);

  const usersChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    usersByRole.forEach(item => {
      config[item.name] = {
        label: item.name,
        color: CHART_COLORS.users,
      };
    });
    config["count"] = { label: "Users", color: CHART_COLORS.users };
    return config;
  }, [usersByRole]);


  return (
    <div className="space-y-8">
      <PageHeader
        title="Reports & Analytics"
        description="View various statistics on lab usage and resource management."
        icon={BarChart3}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-lg md:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              Bookings per Resource (Top 10)
            </CardTitle>
            <CardDescription>Total non-cancelled bookings for each lab resource.</CardDescription>
          </CardHeader>
          <CardContent>
            {bookingsPerResource.length > 0 ? (
              <ChartContainer config={bookingsChartConfig} className="min-h-[300px] w-full">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={bookingsPerResource} margin={{ top: 5, right: 20, left: -20, bottom: 40 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={80}
                      className="text-xs"
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">No booking data available to display chart.</p>
            )}
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
          <CardContent className="flex justify-center">
            {maintenanceByStatus.length > 0 ? (
              <ChartContainer config={maintenanceChartConfig} className="min-h-[250px] max-w-[300px] w-full aspect-square">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent hideLabel indicator="dot" />}
                    />
                    <Pie
                      data={maintenanceByStatus}
                      dataKey="count"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      innerRadius={50}
                      labelLine={false}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {maintenanceByStatus.map((entry) => (
                        <Cell key={`cell-${entry.name}`} fill={entry.fill} className="stroke-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"/>
                      ))}
                    </Pie>
                     <ChartLegend content={<ChartLegendContent nameKey="name" className="text-xs mt-2"/>} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">No maintenance data available.</p>
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
              <ChartContainer config={usersChartConfig} className="min-h-[250px] w-full">
                 <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={usersByRole} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}/>
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} className="text-xs"/>
                     <ChartTooltip
                      cursor={false}
                      content={<ChartTooltipContent indicator="dot" />}
                    />
                    <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">No user data available.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card className="shadow-lg border-dashed">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <PieChartIcon className="h-5 w-5 text-primary" />
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
            <li>Average Queue Wait Times</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
