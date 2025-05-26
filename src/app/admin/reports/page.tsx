
'use client';

import { useMemo, useState, useEffect, useCallback } from 'react';
import { PageHeader } from '@/components/layout/page-header';
import { BarChart3, ClipboardList, AlertTriangle, Users as Users2Icon, PieChart as PieChartIcon, Percent, Clock, Hourglass, Loader2, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import type { Resource, Booking, MaintenanceRequest, User, RoleName, MaintenanceRequestStatus } from '@/types';
import { maintenanceRequestStatuses, userRolesList } from '@/lib/mock-data';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from '@/components/ui/button';
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
  ResponsiveContainer,
} from 'recharts';
import { cn, formatDateSafe } from '@/lib/utils';
import { differenceInDays, parseISO, startOfHour, format as formatDateFn, subDays, isValid as isValidDate } from 'date-fns';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';

interface ReportItem {
  name: string;
  count: number;
  fill?: string;
}

interface UtilizationItem {
  name: string;
  utilization: number;
}

interface PeakHourItem {
  hour: string;
  count: number;
}

interface UserUsageReportItem {
  userId: string;
  userName: string;
  avatarUrl?: string;
  totalBookings: number;
  totalHoursBooked: number;
  lastBookingDate?: Date;
}

type UserUsageSortableColumn = 'userName' | 'totalBookings' | 'totalHoursBooked' | 'lastBookingDate';


const CHART_COLORS = {
  bookings: "hsl(var(--chart-1))",
  maintenance: {
    Open: "hsl(var(--chart-2))",
    "In Progress": "hsl(var(--chart-3))",
    Resolved: "hsl(var(--chart-4))",
    Closed: "hsl(var(--chart-5))",
  },
  utilization: "hsl(var(--chart-2))",
  peakHours: "hsl(var(--chart-3))",
  waitlist: "hsl(var(--chart-4))",
  userUsage: "hsl(var(--chart-5))", // Added for consistency, though not a chart
};

const chartTooltipConfig = {
  cursor: false,
  content: <ChartTooltipContent indicator="dot" hideLabel />,
};
const chartLegendConfig = {
 content: <ChartLegendContent nameKey="name" className="text-xs mt-2" />,
};


export default function ReportsPage() {
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [allBookings, setAllBookings] = useState<Booking[]>([]);
  const [allMaintenanceRequests, setAllMaintenanceRequests] = useState<MaintenanceRequest[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [userUsageSortColumn, setUserUsageSortColumn] = useState<UserUsageSortableColumn>('totalBookings');
  const [userUsageSortDirection, setUserUsageSortDirection] = useState<'asc' | 'desc'>('desc');


  const fetchDataForReports = useCallback(async () => {
    setIsLoading(true);
    try {
      const resourcesSnapshot = await getDocs(collection(db, "resources"));
      setAllResources(resourcesSnapshot.docs.map(d => {
        const data = d.data();
        return {
          id: d.id, ...data,
          purchaseDate: data.purchaseDate instanceof Timestamp ? data.purchaseDate.toDate() : undefined,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : undefined,
          lastUpdatedAt: data.lastUpdatedAt instanceof Timestamp ? data.lastUpdatedAt.toDate() : undefined,
          unavailabilityPeriods: Array.isArray(data.unavailabilityPeriods) ? data.unavailabilityPeriods : [],
        } as Resource;
      }));

      const bookingsSnapshot = await getDocs(collection(db, "bookings"));
      setAllBookings(bookingsSnapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id, ...data,
            startTime: data.startTime instanceof Timestamp ? data.startTime.toDate() : new Date(),
            endTime: data.endTime instanceof Timestamp ? data.endTime.toDate() : new Date(),
            createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date(),
            usageDetails: data.usageDetails ? {
                ...data.usageDetails,
                actualStartTime: data.usageDetails.actualStartTime instanceof Timestamp ? data.usageDetails.actualStartTime.toDate() : undefined,
                actualEndTime: data.usageDetails.actualEndTime instanceof Timestamp ? data.usageDetails.actualEndTime.toDate() : undefined,
            } : undefined,
          } as Booking;
      }));

      const maintenanceSnapshot = await getDocs(collection(db, "maintenanceRequests"));
      setAllMaintenanceRequests(maintenanceSnapshot.docs.map(d => {
          const data = d.data();
          return {
            id: d.id, ...data,
            dateReported: data.dateReported instanceof Timestamp ? data.dateReported.toDate() : new Date(),
            dateResolved: data.dateResolved instanceof Timestamp ? data.dateResolved.toDate() : undefined
          } as MaintenanceRequest;
      }));

      const usersSnapshot = await getDocs(collection(db, "users"));
        setAllUsers(usersSnapshot.docs.map(d => {
            const data = d.data();
            return {
                id: d.id, ...data,
                createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : (data.createdAt ? new Date(data.createdAt) : new Date()),
            } as User;
        }));

    } catch (error) {
      console.error("Error fetching data for reports:", error);
      // Add toast notification for error
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    fetchDataForReports();
  }, [fetchDataForReports]);


  const bookingsPerResource: ReportItem[] = useMemo(() => {
    if (isLoading) return [];
    const report: ReportItem[] = [];
    allResources.forEach(resource => {
      const count = allBookings.filter(
        booking => booking.resourceId === resource.id && booking.status !== 'Cancelled'
      ).length;
      if (count > 0) {
         report.push({ name: resource.name, count });
      }
    });
    return report.sort((a, b) => b.count - a.count).slice(0, 10);
  }, [allResources, allBookings, isLoading]);

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
    if (isLoading) return [];
    const report: ReportItem[] = [];
    maintenanceRequestStatuses.forEach(status => {
      const count = allMaintenanceRequests.filter(req => req.status === status).length;
      if (count > 0) {
        report.push({ name: status, count, fill: CHART_COLORS.maintenance[status] });
      }
    });
    return report;
  }, [allMaintenanceRequests, isLoading]);

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

  const resourceUtilization: UtilizationItem[] = useMemo(() => {
    if (isLoading) return [];
    const report: UtilizationItem[] = [];
    const today = new Date();
    const thirtyDaysAgo = subDays(today, 30);

    allResources.forEach(resource => {
      const bookedDays = new Set<string>();
      allBookings.forEach(booking => {
        if (!booking.startTime || !isValidDate(booking.startTime)) return;

        const bookingDate = booking.startTime;
        if (booking.resourceId === resource.id && booking.status === 'Confirmed') {
          if (bookingDate >= thirtyDaysAgo && bookingDate <= today) {
            bookedDays.add(formatDateFn(bookingDate, 'yyyy-MM-dd'));
          }
        }
      });
      const utilizationPercentage = (bookedDays.size / 30) * 100;
      if (bookedDays.size > 0) {
        report.push({ name: resource.name, utilization: Math.round(utilizationPercentage) });
      }
    });
    return report.sort((a, b) => b.utilization - a.utilization).slice(0, 7);
  }, [allResources, allBookings, isLoading]);

  const utilizationChartConfig = useMemo(() => {
    const config: ChartConfig = {};
     resourceUtilization.forEach(item => {
      config[item.name] = {
        label: item.name,
        color: CHART_COLORS.utilization,
      };
    });
    config["utilization"] = { label: "Utilization %", color: CHART_COLORS.utilization };
    return config;
  }, [resourceUtilization]);

  const peakBookingHours: PeakHourItem[] = useMemo(() => {
    if (isLoading) return [];
    const hourCounts: { [hour: string]: number } = {};
    allBookings.forEach(booking => {
      if (!booking.startTime || !isValidDate(booking.startTime)) return;
      
      if (booking.status === 'Confirmed') {
        const bookingDate = booking.startTime;
        const hour = formatDateFn(startOfHour(bookingDate), 'HH:00');
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
      }
    });
    return Object.entries(hourCounts)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => parseInt(a.hour.split(':')[0]) - parseInt(b.hour.split(':')[0]));
  }, [allBookings, isLoading]);

  const peakHoursChartConfig = useMemo(() => {
     const config: ChartConfig = {};
     peakBookingHours.forEach(item => {
      config[item.hour] = {
        label: item.hour,
        color: CHART_COLORS.peakHours,
      };
    });
    config["count"] = { label: "Bookings", color: CHART_COLORS.peakHours };
    return config;
  }, [peakBookingHours]);


  const waitlistedPerResource: ReportItem[] = useMemo(() => {
    if (isLoading) return [];
    const report: ReportItem[] = [];
    allResources.forEach(resource => {
      if (resource.allowQueueing) {
        const count = allBookings.filter(
          booking => booking.resourceId === resource.id && booking.status === 'Waitlisted'
        ).length;
        if (count > 0) {
          report.push({ name: resource.name, count });
        }
      }
    });
    return report.sort((a, b) => b.count - a.count);
  }, [allResources, allBookings, isLoading]);

  const waitlistChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    waitlistedPerResource.forEach(item => {
      config[item.name] = {
        label: item.name,
        color: CHART_COLORS.waitlist,
      };
    });
    config["count"] = { label: "Waitlisted", color: CHART_COLORS.waitlist };
    return config;
  }, [waitlistedPerResource]);

  const processedUserUsageData = useMemo(() => {
    if (isLoading || allUsers.length === 0 || allBookings.length === 0) return [];

    const usageMap = new Map<string, UserUsageReportItem>();

    allUsers.forEach(user => {
      usageMap.set(user.id, {
        userId: user.id,
        userName: user.name || 'Unknown User',
        avatarUrl: user.avatarUrl,
        totalBookings: 0,
        totalHoursBooked: 0,
        lastBookingDate: undefined,
      });
    });

    allBookings.forEach(booking => {
      if (booking.status === 'Cancelled') return;

      const userReport = usageMap.get(booking.userId);
      if (userReport) {
        userReport.totalBookings += 1;

        if (booking.status === 'Confirmed') {
          const startTime = booking.startTime;
          const endTime = booking.endTime;
          if (isValidDate(startTime) && isValidDate(endTime) && endTime > startTime) {
            const durationMs = endTime.getTime() - startTime.getTime();
            userReport.totalHoursBooked += durationMs / (1000 * 60 * 60);
          }
        }

        if (isValidDate(booking.startTime)) {
          if (!userReport.lastBookingDate || booking.startTime > userReport.lastBookingDate) {
            userReport.lastBookingDate = booking.startTime;
          }
        }
      }
    });

    let sortedData = Array.from(usageMap.values()).filter(item => item.totalBookings > 0);

    sortedData.sort((a, b) => {
      let comparison = 0;
      switch (userUsageSortColumn) {
        case 'userName':
          comparison = a.userName.localeCompare(b.userName);
          break;
        case 'totalBookings':
          comparison = a.totalBookings - b.totalBookings;
          break;
        case 'totalHoursBooked':
          comparison = a.totalHoursBooked - b.totalHoursBooked;
          break;
        case 'lastBookingDate':
          const dateA = a.lastBookingDate?.getTime() || 0;
          const dateB = b.lastBookingDate?.getTime() || 0;
          comparison = dateA - dateB;
          break;
      }
      return userUsageSortDirection === 'asc' ? comparison : -comparison;
    });

    return sortedData;
  }, [allUsers, allBookings, isLoading, userUsageSortColumn, userUsageSortDirection]);

  const handleSortUserUsage = (column: UserUsageSortableColumn) => {
    if (userUsageSortColumn === column) {
      setUserUsageSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setUserUsageSortColumn(column);
      setUserUsageSortDirection('desc');
    }
  };

  const renderSortIcon = (column: UserUsageSortableColumn) => {
    if (userUsageSortColumn !== column) return <ArrowUpDown className="ml-2 h-4 w-4 opacity-30" />;
    return userUsageSortDirection === 'asc' ? <ArrowUp className="ml-2 h-4 w-4 text-primary" /> : <ArrowDown className="ml-2 h-4 w-4 text-primary" />;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[calc(100vh-200px)] text-muted-foreground">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="ml-3 text-sm">Loading report data...</p>
      </div>
    );
  }

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
                  <BarChart data={bookingsPerResource} margin={{ top: 5, right: 20, left: -20, bottom: 50 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      angle={-45}
                      textAnchor="end"
                      interval={0}
                      height={70}
                      className="text-xs"
                    />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                    <ChartTooltip {...chartTooltipConfig} />
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
                    <ChartTooltip {...chartTooltipConfig} />
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
                     <ChartLegend {...chartLegendConfig} />
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
              <Percent className="h-5 w-5 text-primary" />
              Resource Utilization (Last 30 Days)
            </CardTitle>
            <CardDescription>Percentage of days a resource had confirmed bookings in the last 30 days.</CardDescription>
          </CardHeader>
          <CardContent>
            {resourceUtilization.length > 0 ? (
              <ChartContainer config={utilizationChartConfig} className="min-h-[250px] w-full">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={resourceUtilization} margin={{ top: 5, right: 20, left: -20, bottom: 50 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-45} textAnchor="end" interval={0} height={70} className="text-xs" />
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} unit="%" domain={[0, 100]} />
                    <ChartTooltip content={<ChartTooltipContent formatter={(value, name, props) => `${props.payload.name}: ${value}%`} indicator="dot" />} />
                    <Bar dataKey="utilization" fill="var(--color-utilization)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">No utilization data available.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              Peak Booking Hours
            </CardTitle>
            <CardDescription>Number of confirmed bookings per hour of the day (all time).</CardDescription>
          </CardHeader>
          <CardContent>
            {peakBookingHours.length > 0 ? (
              <ChartContainer config={peakHoursChartConfig} className="min-h-[250px] w-full">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={peakBookingHours} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis dataKey="hour" tickLine={false} axisLine={false} tickMargin={8} className="text-xs"/>
                    <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                    <ChartTooltip {...chartTooltipConfig} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">No booking data for peak hours analysis.</p>
            )}
          </CardContent>
        </Card>

        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Hourglass className="h-5 w-5 text-primary" />
              Current Waitlist Size
            </CardTitle>
            <CardDescription>Number of waitlisted bookings per resource.</CardDescription>
          </CardHeader>
          <CardContent>
            {waitlistedPerResource.length > 0 ? (
              <ChartContainer config={waitlistChartConfig} className="min-h-[250px] w-full">
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={waitlistedPerResource} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false}/>
                    <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={120} className="text-xs"/>
                     <ChartTooltip {...chartTooltipConfig} />
                    <Bar dataKey="count" fill="var(--color-count)" radius={4} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            ) : (
              <p className="text-muted-foreground text-center py-10">No resources currently have a waitlist.</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator className="my-8" />

       <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users2Icon className="h-5 w-5 text-primary" />
              User Activity Report
            </CardTitle>
            <CardDescription>Overview of booking activity by user.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
                <div className="text-center py-10 text-muted-foreground">Loading user activity...</div>
            ) : processedUserUsageData.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[250px]">
                        <Button variant="ghost" onClick={() => handleSortUserUsage('userName')} className="px-1">
                          User {renderSortIcon('userName')}
                        </Button>
                      </TableHead>
                      <TableHead className="text-center">
                        <Button variant="ghost" onClick={() => handleSortUserUsage('totalBookings')} className="px-1">
                          Total Bookings {renderSortIcon('totalBookings')}
                        </Button>
                      </TableHead>
                      <TableHead className="text-center">
                        <Button variant="ghost" onClick={() => handleSortUserUsage('totalHoursBooked')} className="px-1">
                          Total Hours Booked {renderSortIcon('totalHoursBooked')}
                        </Button>
                      </TableHead>
                      <TableHead className="text-right">
                        <Button variant="ghost" onClick={() => handleSortUserUsage('lastBookingDate')} className="px-1">
                          Last Booking {renderSortIcon('lastBookingDate')}
                        </Button>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedUserUsageData.map((item) => (
                      <TableRow key={item.userId}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                              <AvatarImage src={item.avatarUrl} alt={item.userName} data-ai-hint="user avatar" />
                              <AvatarFallback>{item.userName.split(' ').map(n => n[0]).join('').toUpperCase()}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{item.userName}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.totalBookings}</TableCell>
                        <TableCell className="text-center">{item.totalHoursBooked.toFixed(1)} hours</TableCell>
                        <TableCell className="text-right">{formatDateSafe(item.lastBookingDate, 'N/A', 'PPP')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-10">No user booking data available.</p>
            )}
          </CardContent>
        </Card>

    </div>
  );
}
