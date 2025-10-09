
'use client';

import type { FC } from 'react';
import { BarChartHorizontalBig, Edit, Package as PackageIcon, UsersRound, Briefcase, BarChart3, ClipboardList, AlertTriangle, Percent, Clock, Hourglass, Users2 } from 'lucide-react';
import type { Lab, Booking, MaintenanceRequest, Resource, User, MaintenanceRequestStatus } from '@/types';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHeader, TableRow, TableHead } from "@/components/ui/table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { useMemo } from 'react';
import { subDays, startOfHour, differenceInHours, format } from 'date-fns';
import { maintenanceRequestStatuses as appMaintenanceStatuses } from '@/lib/app-constants';

interface ReportItem { name: string; count: number; fill?: string; }
interface UtilizationItem { name: string; utilization: number; }
interface PeakHourItem { hour: string; count: number; }
interface LabUserUsageReportItem { userId: string; userName: string; avatarUrl?: string; totalBookingsInLab: number; totalHoursBookedInLab: number; }

const CHART_COLORS = {
  bookings: "hsl(var(--chart-1))",
  maintenance: {
    Open: "hsl(var(--destructive))",
    "In Progress": "hsl(var(--chart-3))",
    Resolved: "hsl(var(--chart-4))",
    Closed: "hsl(var(--chart-2))",
  },
  utilization: "hsl(var(--chart-2))",
  peakHours: "hsl(var(--chart-3))",
  waitlist: "hsl(var(--chart-4))",
  userUsage: "hsl(var(--chart-5))",
};

const chartTooltipConfig = { cursor: false, content: <ChartTooltipContent indicator="dot" hideLabel />, };
const chartLegendConfig = { content: <ChartLegendContent nameKey="name" className="text-xs mt-2" />, };

interface LabSpecificOverviewTabProps {
  selectedLabDetails: Lab;
  labSpecificStats: { resourceCount: number; activeMemberCount: number; openMaintenanceCount: number };
  handleOpenEditSelectedLabDialog: () => void;
  labSpecificBookings: (Booking & { resourceName?: string, userName?: string })[];
  labSpecificMaintenanceRequests: MaintenanceRequest[];
  labSpecificResources: Resource[];
  allUsersData: User[];
  isLoadingData: boolean;
}

export const LabSpecificOverviewTab: FC<LabSpecificOverviewTabProps> = ({
  selectedLabDetails, labSpecificStats, handleOpenEditSelectedLabDialog,
  labSpecificBookings, labSpecificMaintenanceRequests, labSpecificResources, allUsersData, isLoadingData
}) => {

    const bookingsPerLabResource: ReportItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData) return [];
        const report: ReportItem[] = [];
        labSpecificResources.forEach(resource => {
            const count = labSpecificBookings.filter(b => b.resourceId === resource.id && b.status !== 'Cancelled').length;
            if (count > 0) report.push({ name: resource.name, count });
        });
        return report.sort((a, b) => b.count - a.count).slice(0, 7);
    }, [selectedLabDetails, labSpecificResources, labSpecificBookings, isLoadingData]);

    const bookingsLabChartConfig = useMemo(() => {
      const config: ChartConfig = {};
      bookingsPerLabResource.forEach(item => { config[item.name] = { label: item.name, color: CHART_COLORS.bookings }; });
      config["count"] = { label: "Bookings", color: CHART_COLORS.bookings };
      return config;
    }, [bookingsPerLabResource]);

    const maintenanceByStatusForLab: ReportItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData) return [];
        const report: ReportItem[] = [];
        appMaintenanceStatuses.forEach(status => {
            const count = labSpecificMaintenanceRequests.filter(req => req.status === status).length;
            if (count > 0) report.push({ name: status, count, fill: CHART_COLORS.maintenance[status as MaintenanceRequestStatus] });
        });
        return report;
    }, [selectedLabDetails, labSpecificMaintenanceRequests, isLoadingData]);

    const maintenanceLabChartConfig = useMemo(() => {
      const config: ChartConfig = {};
      maintenanceByStatusForLab.forEach(item => { config[item.name] = { label: item.name, color: item.fill! }; });
      return config;
    }, [maintenanceByStatusForLab]);

    const labResourceUtilization: UtilizationItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData) return [];
        const report: UtilizationItem[] = [];
        const today = new Date();
        const thirtyDaysAgo = subDays(today, 30);
        labSpecificResources.forEach(resource => {
            const bookedDays = new Set<string>();
            labSpecificBookings.forEach(booking => {
                if (!booking.startTime) return;
                const bookingDate = new Date(booking.startTime);
                if (booking.resourceId === resource.id && booking.status === 'Confirmed') {
                    if (bookingDate >= thirtyDaysAgo && bookingDate <= today) bookedDays.add(format(bookingDate, 'yyyy-MM-dd'));
                }
            });
            const utilizationPercentage = (bookedDays.size / 30) * 100;
            if (utilizationPercentage > 0) report.push({ name: resource.name, utilization: Math.round(utilizationPercentage) });
        });
        return report.sort((a, b) => b.utilization - a.utilization).slice(0, 7);
    }, [selectedLabDetails, labSpecificResources, labSpecificBookings, isLoadingData]);

    const utilizationLabChartConfig = useMemo(() => {
      const config: ChartConfig = {};
      labResourceUtilization.forEach(item => { config[item.name] = { label: item.name, color: CHART_COLORS.utilization }; });
      config["utilization"] = { label: "Utilization %", color: CHART_COLORS.utilization };
      return config;
    }, [labResourceUtilization]);

    const peakBookingHoursForLab: PeakHourItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData) return [];
        const hourCounts: { [hour: string]: number } = {};
        labSpecificBookings.forEach(booking => {
            if (!booking.startTime) return;
            if (booking.status === 'Confirmed') {
                const hour = format(startOfHour(new Date(booking.startTime)), 'HH:00');
                hourCounts[hour] = (hourCounts[hour] || 0) + 1;
            }
        });
        return Object.entries(hourCounts)
            .map(([hour, count]) => ({ hour, count }))
            .sort((a, b) => parseInt(a.hour.split(':')[0]) - parseInt(b.hour.split(':')[0]));
    }, [selectedLabDetails, labSpecificBookings, isLoadingData]);
    
    const peakHoursLabChartConfig = useMemo(() => {
     const config: ChartConfig = {};
     peakBookingHoursForLab.forEach(item => { config[item.hour] = { label: item.hour, color: CHART_COLORS.peakHours }; });
     config["count"] = { label: "Bookings", color: CHART_COLORS.peakHours };
     return config;
    }, [peakBookingHoursForLab]);

    const waitlistedPerLabResource: ReportItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData) return [];
        const report: ReportItem[] = [];
        labSpecificResources.forEach(resource => {
            if (resource.allowQueueing) {
                const count = labSpecificBookings.filter(b => b.resourceId === resource.id && b.status === 'Waitlisted').length;
                if (count > 0) report.push({ name: resource.name, count });
            }
        });
        return report.sort((a, b) => b.count - a.count).slice(0, 7);
    }, [selectedLabDetails, labSpecificResources, labSpecificBookings, isLoadingData]);

    const waitlistLabChartConfig = useMemo(() => {
      const config: ChartConfig = {};
      waitlistedPerLabResource.forEach(item => { config[item.name] = { label: item.name, color: CHART_COLORS.waitlist }; });
      config["count"] = { label: "Waitlisted", color: CHART_COLORS.waitlist };
      return config;
    }, [waitlistedPerLabResource]);

    const labUserActivityReport: LabUserUsageReportItem[] = useMemo(() => {
        if (!selectedLabDetails || isLoadingData || allUsersData.length === 0) return [];
        const usageMap = new Map<string, LabUserUsageReportItem>();
        labSpecificBookings.forEach(booking => {
            if (booking.status === 'Cancelled' || !booking.userId) return;
            let userReport = usageMap.get(booking.userId);
            if (!userReport) {
                const userDetails = allUsersData.find(u => u.id === booking.userId);
                userReport = {
                    userId: booking.userId,
                    userName: userDetails?.name || 'Unknown User',
                    avatarUrl: userDetails?.avatarUrl,
                    totalBookingsInLab: 0,
                    totalHoursBookedInLab: 0,
                };
            }
            userReport.totalBookingsInLab += 1;
            if (booking.status === 'Confirmed' && booking.startTime && booking.endTime) {
                userReport.totalHoursBookedInLab += differenceInHours(new Date(booking.endTime), new Date(booking.startTime));
            }
            usageMap.set(booking.userId, userReport);
        });
        return Array.from(usageMap.values())
            .filter(item => item.totalBookingsInLab > 0)
            .sort((a, b) => b.totalBookingsInLab - a.totalBookingsInLab)
            .slice(0, 7);
    }, [selectedLabDetails, labSpecificBookings, allUsersData, isLoadingData]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
        <Card className="shadow-lg lg:col-span-2 md:col-span-1">
          <CardHeader className="flex flex-row items-start justify-between gap-2">
            <div>
              <CardTitle className="text-2xl">{selectedLabDetails.name}</CardTitle>
              {selectedLabDetails.location && <CardDescription>{selectedLabDetails.location}</CardDescription>}
            </div>
            <Button variant="outline" size="icon" className="h-8 w-8 flex-shrink-0" onClick={handleOpenEditSelectedLabDialog}><Edit className="h-4 w-4"/></Button>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{selectedLabDetails.description || 'No description provided.'}</p>
          </CardContent>
        </Card>
        <Card className="shadow-lg lg:col-span-3 md:col-span-1">
          <CardHeader><CardTitle className="text-xl flex items-center gap-2"><BarChartHorizontalBig className="h-5 w-5 text-primary"/>Key Statistics</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2"><PackageIcon className="h-5 w-5 text-muted-foreground"/> <span className="font-medium">Resources</span></div>
                <Badge variant="secondary" className="text-lg">{labSpecificStats.resourceCount}</Badge>
            </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2"><UsersRound className="h-5 w-5 text-muted-foreground"/> <span className="font-medium">Active Members</span></div>
                <Badge variant="secondary" className="text-lg">{labSpecificStats.activeMemberCount}</Badge>
            </div>
              <div className="flex items-center justify-between p-2 bg-muted/30 rounded-md">
                <div className="flex items-center gap-2"><Briefcase className="h-5 w-5 text-muted-foreground"/> <span className="font-medium">Open Maintenance</span></div>
                <Badge variant="secondary" className="text-lg">{labSpecificStats.openMaintenanceCount}</Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary"/> Lab Performance Dashboard: {selectedLabDetails.name}
          </CardTitle>
          <CardDescription>Key performance indicators for this lab.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-1"><ClipboardList className="h-4 w-4"/>Bookings per Resource</CardTitle></CardHeader>
              <CardContent>
                {bookingsPerLabResource.length > 0 ? (
                  <ChartContainer config={bookingsLabChartConfig} className="min-h-[250px] w-full">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={bookingsPerLabResource} margin={{ top: 5, right: 5, left: -25, bottom: 40 }}>
                        <CartesianGrid vertical={false} strokeDasharray="3 3" />
                        <XAxis dataKey="name" tickLine={false} axisLine={false} tickMargin={8} angle={-30} textAnchor="end" interval={0} height={50} className="text-xs"/>
                        <YAxis tickLine={false} axisLine={false} tickMargin={8} allowDecimals={false} />
                        <ChartTooltip {...chartTooltipConfig} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={3} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : <p className="text-muted-foreground text-center text-sm py-8">No booking data for this lab.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-1"><AlertTriangle className="h-4 w-4"/>Maintenance Status</CardTitle></CardHeader>
              <CardContent className="flex justify-center">
                {maintenanceByStatusForLab.length > 0 ? (
                  <ChartContainer config={maintenanceLabChartConfig} className="min-h-[250px] max-w-[280px] w-full aspect-square">
                    <ResponsiveContainer width="100%" height={250}>
                      <RechartsPieChart>
                        <ChartTooltip {...chartTooltipConfig} />
                        <Pie data={maintenanceByStatusForLab} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={70} labelLine={false} label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}>
                          {maintenanceByStatusForLab.map((entry) => (<Cell key={`cell-${entry.name}`} fill={entry.fill} className="stroke-background focus:outline-none"/> ))}
                        </Pie>
                        <ChartLegend {...chartLegendConfig} />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : <p className="text-muted-foreground text-center text-sm py-8">No maintenance data for this lab.</p>}
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-1"><Percent className="h-4 w-4"/>Resource Utilization (30d)</CardTitle></CardHeader>
              <CardContent>
                {labResourceUtilization.length > 0 ? (
                  <ChartContainer config={utilizationLabChartConfig} className="min-h-[250px] w-full">
                    <ResponsiveContainer width="100%" height={250}>
                      <BarChart data={labResourceUtilization} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                        <XAxis type="number" tickLine={false} axisLine={false} tickMargin={8} unit="%" domain={[0,100]} />
                        <YAxis dataKey="name" type="category" tickLine={false} axisLine={false} tickMargin={8} width={100} className="text-xs truncate"/>
                        <ChartTooltip content={<ChartTooltipContent formatter={(value, name, props) => `${props.payload.name}: ${value}%`} indicator="dot" />} />
                        <Bar dataKey="utilization" fill="var(--color-utilization)" radius={3} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : <p className="text-muted-foreground text-center text-sm py-8">No utilization data for this lab.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-1"><Clock className="h-4 w-4"/>Peak Booking Hours</CardTitle></CardHeader>
              <CardContent>
                {peakBookingHoursForLab.length > 0 ? (
                  <ChartContainer config={peakHoursLabChartConfig} className="min-h-[250px] w-full">
                    <ResponsiveContainer width="100%" height={250}>
                      <LineChart data={peakBookingHoursForLab} margin={{ top: 5, right: 20, left: -20, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" tickLine={false} axisLine={true} tickMargin={8} className="text-xs"/>
                        <YAxis tickLine={false} axisLine={true} tickMargin={8} allowDecimals={false}/>
                        <ChartTooltip {...chartTooltipConfig} />
                        <Line type="monotone" dataKey="count" stroke="var(--color-count)" strokeWidth={2} dot={{r:3, fill: "var(--color-count)"}} activeDot={{r:5}} />
                      </LineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : <p className="text-muted-foreground text-center text-sm py-8">No peak hours data for this lab.</p>}
              </CardContent>
            </Card>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-1"><Hourglass className="h-4 w-4"/>Current Waitlist Size</CardTitle></CardHeader>
              <CardContent>
                {waitlistedPerLabResource.length > 0 ? (
                  <ChartContainer config={waitlistLabChartConfig} className="min-h-[250px] w-full">
                    <ResponsiveContainer width="100%" height={Math.max(150, waitlistedPerLabResource.length * 40)}>
                      <BarChart data={waitlistedPerLabResource} layout="vertical" margin={{ top: 5, right: 25, left: 10, bottom: 5 }}>
                        <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                        <XAxis type="number" allowDecimals={false} />
                        <YAxis dataKey="name" type="category" width={100} className="text-xs truncate"/>
                        <ChartTooltip {...chartTooltipConfig} />
                        <Bar dataKey="count" fill="var(--color-count)" radius={3} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : <p className="text-muted-foreground text-center text-sm py-8">No waitlisted items for this lab.</p>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-1"><Users2 className="h-4 w-4"/>Top User Activity</CardTitle></CardHeader>
              <CardContent className="p-0">
                {labUserActivityReport.length > 0 ? (
                  <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>User</TableHead><TableHead className="text-center">Bookings</TableHead><TableHead className="text-right">Hours</TableHead></TableRow></TableHeader>
                    <TableBody>
                    {labUserActivityReport.map(item => (
                      <TableRow key={item.userId}>
                      <TableCell><div className="flex items-center gap-2"><Avatar className="h-7 w-7 text-xs"><AvatarImage src={item.avatarUrl} alt={item.userName} data-ai-hint="user avatar"/><AvatarFallback>{item.userName.charAt(0)}</AvatarFallback></Avatar>{item.userName}</div></TableCell>
                      <TableCell className="text-center">{item.totalBookingsInLab}</TableCell>
                      <TableCell className="text-right">{item.totalHoursBookedInLab.toFixed(1)}</TableCell>
                      </TableRow>
                    ))}
                    </TableBody>
                  </Table>
                  </div>
                ) : <p className="text-muted-foreground text-center text-sm py-8 px-3">No user activity data for this lab.</p>}
              </CardContent>
            </Card>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
