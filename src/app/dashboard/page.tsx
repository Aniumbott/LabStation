
'use client';

import Image from 'next/image';
import Link from 'next/link';
import { LayoutDashboard, CalendarPlus, ChevronRight, CheckCircle, Wrench, Loader2, ThumbsUp, Clock, X, User as UserIconLucide, XCircle, Building, KeyRound, University, PlusCircle, LogOut, Ban, Package, CalendarDays, Info } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import type { Resource, Booking, Lab, LabMembership, LabMembershipStatus } from '@/types';
import { Separator } from '@/components/ui/separator';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableSkeleton } from '@/components/ui/table-skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { format, isValid, isPast, parseISO, compareAsc, startOfToday, startOfDay } from 'date-fns';
import { cn, formatDateSafe, getResourceStatusBadge } from '@/lib/utils';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/components/auth-context';
import { useToast } from '@/hooks/use-toast';
import { requestLabAccess_SA, cancelLabAccessRequest_SA, leaveLab_SA } from '@/lib/db-helpers';
import { getDashboardData_SA } from '@/lib/actions/data.actions';


const safeConvertToDate = (value: any, fieldName: string, bookingId: string): Date => {
  if (value instanceof Date && isValid(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseISO(value);
    if (isValid(parsed)) {
      return parsed;
    }
    const directDate = new Date(value);
    if (isValid(directDate)) {
        return directDate;
    }
  }
  if (typeof value === 'number') {
     const dateFromNum = new Date(value);
     if (isValid(dateFromNum)) {
         return dateFromNum;
     }
  }
  console.error(`[Dashboard] CRITICAL: Unexpected data type or invalid date for ${fieldName} in booking ${bookingId}. Using current date as fallback. Value:`, value, `Type: ${typeof value}`);
  return new Date();
};


export default function DashboardPage() {
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [frequentlyUsedResources, setFrequentlyUsedResources] = useState<(Resource & { labName?: string })[]>([]);
  const [upcomingUserBookings, setUpcomingUserBookings] = useState<(Booking & { resourceName?: string })[]>([]);

  const [allLabs, setAllLabs] = useState<Lab[]>([]);
  const [userMemberships, setUserMemberships] = useState<LabMembership[]>([]);

  const [isLoadingResources, setIsLoadingResources] = useState(true);
  const [isLoadingBookings, setIsLoadingBookings] = useState(true);
  const [isLoadingLabsAndMemberships, setIsLoadingLabsAndMemberships] = useState(true);
  const [isMembershipActionLoading, setIsMembershipActionLoading] = useState<Record<string, boolean>>({});


  const fetchDashboardData = useCallback(async () => {
    if (!currentUser || !currentUser.id) {
      setFrequentlyUsedResources([]);
      setUpcomingUserBookings([]);
      setAllLabs([]);
      setUserMemberships([]);
      setIsLoadingResources(false);
      setIsLoadingBookings(false);
      setIsLoadingLabsAndMemberships(false);
      return;
    }

    setIsLoadingResources(true);
    setIsLoadingBookings(true);
    setIsLoadingLabsAndMemberships(true);

    try {
      const result = await getDashboardData_SA(currentUser.id);

      if (result.success && result.data) {
        const { labs, userLabMemberships, recentResources, upcomingBookings } = result.data;

        // Set labs
        setAllLabs(labs);

        // Set memberships (only for non-admin users)
        if (currentUser.role !== 'Admin') {
          setUserMemberships(userLabMemberships);
        } else {
          setUserMemberships([]);
        }
        setIsLoadingLabsAndMemberships(false);

        // Set resources with lab names
        const resourcesWithLabName = recentResources.map(r => ({
          ...r,
          labName: r.labName || (r.labId ? 'Unknown Lab' : 'Global/No Lab'),
          imageUrl: r.imageUrl || 'https://placehold.co/600x400.png',
          features: r.features || [],
          purchaseDate: r.purchaseDate ? safeConvertToDate(r.purchaseDate, 'purchaseDate', r.id) : undefined,
          lastUpdatedAt: r.lastUpdatedAt ? safeConvertToDate(r.lastUpdatedAt, 'lastUpdatedAt', r.id) : undefined,
          createdAt: r.createdAt ? safeConvertToDate(r.createdAt, 'createdAt', r.id) : undefined,
        }));
        setFrequentlyUsedResources(resourcesWithLabName);
        setIsLoadingResources(false);

        // Set bookings with proper date conversion
        const now = new Date();
        const processedBookings = upcomingBookings.map(b => ({
          ...b,
          startTime: safeConvertToDate(b.startTime, 'startTime', b.id),
          endTime: safeConvertToDate(b.endTime, 'endTime', b.id),
          createdAt: safeConvertToDate(b.createdAt, 'createdAt', b.id),
        })).filter(b => b.endTime >= now && b.status !== 'Cancelled');
        setUpcomingUserBookings(processedBookings);
        setIsLoadingBookings(false);
      } else {
        toast({ title: "Error Loading Dashboard Data", description: result.message || "Failed to load dashboard data.", variant: "destructive" });
        setAllLabs([]);
        setUserMemberships([]);
        setFrequentlyUsedResources([]);
        setUpcomingUserBookings([]);
        setIsLoadingLabsAndMemberships(false);
        setIsLoadingResources(false);
        setIsLoadingBookings(false);
      }
    } catch (error: any) {
      toast({ title: "Error Loading Dashboard Data", description: error.message || "An unexpected error occurred.", variant: "destructive" });
      setAllLabs([]);
      setUserMemberships([]);
      setFrequentlyUsedResources([]);
      setUpcomingUserBookings([]);
      setIsLoadingLabsAndMemberships(false);
      setIsLoadingResources(false);
      setIsLoadingBookings(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const userActiveLabs = useMemo(() => {
    if (!currentUser || currentUser.role === 'Admin') return [];
    return allLabs.filter(lab => userMemberships.some(m => m.labId === lab.id && m.status === 'active'));
  }, [currentUser, allLabs, userMemberships]);

  const userPendingLabRequests = useMemo(() => {
    if (!currentUser || currentUser.role === 'Admin') return [];
    return userMemberships.filter(m => m.status === 'pending_approval')
      .map(m => ({ ...m, labName: allLabs.find(l => l.id === m.labId)?.name || 'Unknown Lab' }));
  }, [currentUser, userMemberships, allLabs]);

  const availableLabsForRequest = useMemo(() => {
    if (!currentUser || currentUser.role === 'Admin') return [];
    return allLabs.filter(lab =>
      !userMemberships.some(m => m.labId === lab.id && (m.status === 'active' || m.status === 'pending_approval'))
    );
  }, [currentUser, allLabs, userMemberships]);

  const handleRequestAccess = async (labId: string, labName: string) => {
    if (!currentUser) return;
    setIsMembershipActionLoading(prev => ({ ...prev, [labId]: true }));
    const result = await requestLabAccess_SA(currentUser.id, currentUser.name, labId, labName);
    if (result.success) {
      toast({ title: "Request Submitted", description: result.message });
      fetchDashboardData(); // Refresh memberships
    } else {
      toast({ title: "Request Failed", description: result.message, variant: "destructive" });
    }
    setIsMembershipActionLoading(prev => ({ ...prev, [labId]: false }));
  };

  const handleCancelRequest = async (membershipId: string, labName: string) => {
    if (!currentUser || !membershipId) return;
    setIsMembershipActionLoading(prev => ({ ...prev, [membershipId]: true }));
    const result = await cancelLabAccessRequest_SA(currentUser.id, currentUser.name, membershipId, labName);
    if (result.success) {
      toast({ title: "Request Cancelled", description: result.message });
      fetchDashboardData(); // Refresh memberships
    } else {
      toast({ title: "Cancellation Failed", description: result.message, variant: "destructive" });
    }
    setIsMembershipActionLoading(prev => ({ ...prev, [membershipId]: false }));
  };

  const handleLeaveLab = async (membershipId: string, labName: string) => {
    if (!currentUser || !membershipId) return;
    setIsMembershipActionLoading(prev => ({ ...prev, [membershipId]: true }));
    const result = await leaveLab_SA(currentUser.id, currentUser.name, membershipId, labName);
    if (result.success) {
      toast({ title: "Left Lab", description: result.message });
      fetchDashboardData(); // Refresh memberships
    } else {
      toast({ title: "Failed to Leave Lab", description: result.message, variant: "destructive" });
    }
    setIsMembershipActionLoading(prev => ({ ...prev, [membershipId]: false }));
  };


  const getBookingStatusBadge = (status: Booking['status']) => {
    switch (status) {
      case 'Confirmed':
        return <Badge className={cn("bg-green-500 text-white hover:bg-green-600 border-transparent")}><CheckCircle className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Pending':
        return <Badge className={cn("bg-yellow-500 text-yellow-950 hover:bg-yellow-600 border-transparent")}><Clock className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      case 'Cancelled':
        return <Badge className={cn("bg-gray-400 text-white hover:bg-gray-500 border-transparent")}><X className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
       case 'Waitlisted':
         return <Badge className={cn("bg-purple-500 text-white hover:bg-purple-600 border-transparent")}><UserIconLucide className="mr-1 h-3.5 w-3.5" />{status}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };


  const isLoadingAll = isLoadingResources || isLoadingBookings || isLoadingLabsAndMemberships;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Overview of lab resources, your bookings, and lab access."
        icon={LayoutDashboard}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoadingAll ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))
        ) : (
          <>
            <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
              <div className="rounded-md bg-primary/10 p-2 flex-shrink-0"><CalendarDays className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold">{upcomingUserBookings.length}</p><p className="text-xs text-muted-foreground">Upcoming Bookings</p></div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
              <div className="rounded-md bg-primary/10 p-2 flex-shrink-0"><Package className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold">{frequentlyUsedResources.filter(r => r.status === 'Working').length}</p><p className="text-xs text-muted-foreground">Working Resources</p></div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
              <div className="rounded-md bg-primary/10 p-2 flex-shrink-0"><University className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold">{userActiveLabs.length || allLabs.length}</p><p className="text-xs text-muted-foreground">Active Labs</p></div>
            </div>
            <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-4">
              <div className="rounded-md bg-primary/10 p-2 flex-shrink-0"><Clock className="h-5 w-5 text-primary" /></div>
              <div><p className="text-2xl font-bold">{userPendingLabRequests.length}</p><p className="text-xs text-muted-foreground">Pending Requests</p></div>
            </div>
          </>
        )}
      </div>

      <section>
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold">Frequently Used Resources</h2>
          {frequentlyUsedResources.length > 0 && (
             <Button asChild variant="outline" size="sm">
              <Link href="/admin/resources">View All</Link>
            </Button>
          )}
        </div>
        {isLoadingResources ? (
          <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 w-fit">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-64 w-full md:max-w-md rounded-lg" />
            ))}
          </div>
        ) : frequentlyUsedResources.length > 0 ? (
          <div className="w-fit grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-2">
            {frequentlyUsedResources.map((resource) => (
              <Card key={resource.id} className="w-full md:max-w-md flex flex-col shadow-lg hover:shadow-xl transition-shadow duration-300 p-4">
                <CardHeader className="p-0 pb-3">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-lg hover:text-primary transition-colors">
                      <Link href={`/admin/resources/${resource.id}`}>
                        {resource.name}
                      </Link>
                    </CardTitle>
                    {getResourceStatusBadge(resource.status)}
                  </div>
                  <CardDescription className="flex items-center gap-1">
                     <Building className="h-3.5 w-3.5 text-muted-foreground"/> {resource.labName || 'N/A'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 flex-grow space-y-3">
                  <div className="relative w-full h-40 rounded-md overflow-hidden">
                    <Image src={resource.imageUrl || 'https://placehold.co/600x400.png'} alt={resource.name} fill style={{objectFit:"cover"}} data-ai-hint="lab equipment"/>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{resource.description}</p>
                </CardContent>
                <CardFooter className="p-0 pt-3">
                  <Button asChild size="sm" className="w-full" disabled={resource.status !== 'Working'}>
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
          <EmptyState
            icon={Package}
            title="No resources to display"
            description="Explore available resources and make a booking."
            action={
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/resources">Browse Resources</Link>
              </Button>
            }
          />
        )}
      </section>

      <Separator />

      <section>
        <h2 className="text-xl font-semibold mb-4">Your Upcoming Bookings</h2>
        <div className="rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Resource</TableHead>
                <TableHead className="font-semibold text-foreground">Date & Time</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoadingBookings ? (
                <TableSkeleton rows={3} cols={4} />
              ) : upcomingUserBookings.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4}>
                    <EmptyState
                      icon={CalendarDays}
                      title="No upcoming bookings"
                      description={currentUser ? "You have no upcoming bookings." : "Please log in to see your bookings."}
                      action={currentUser ? (
                        <Button asChild size="sm">
                          <Link href="/admin/resources">Find Resources to Book</Link>
                        </Button>
                      ) : undefined}
                    />
                  </TableCell>
                </TableRow>
              ) : (
                upcomingUserBookings.map((booking) => (
                  <TableRow key={booking.id} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="font-medium">{booking.resourceName || 'Loading...'}</TableCell>
                    <TableCell>
                      <div>{formatDateSafe(booking.startTime, 'Invalid Date', 'MMM dd, yyyy')}</div>
                      <div className="text-xs text-muted-foreground">
                        {isValid(booking.startTime) && isValid(booking.endTime) ? `${format(booking.startTime, 'p')} - ${format(booking.endTime, 'p')}` : 'Invalid Time'}
                      </div>
                    </TableCell>
                    <TableCell>{getBookingStatusBadge(booking.status)}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/bookings?bookingId=${booking.id}&date=${isValid(booking.startTime) ? format(booking.startTime, 'yyyy-MM-dd') : ''}`}>View/Edit</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        {upcomingUserBookings.length > 0 && (
          <div className="flex justify-end mt-3">
            <Button variant="outline" asChild size="sm">
              <Link href="/bookings">View All Bookings <ChevronRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </div>
        )}
      </section>

      {currentUser && currentUser.role !== 'Admin' && (
        <>
          <Separator />
          <section>
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">My Labs</h2>
            </div>
            {isLoadingLabsAndMemberships ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
                </div>
            ) : userActiveLabs.length > 0 ? (
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                    {userActiveLabs.map(lab => {
                        const membership = userMemberships.find(m => m.labId === lab.id && m.status === 'active');
                        return (
                            <Card key={lab.id} className="shadow-md hover:shadow-lg transition-shadow">
                                <CardHeader>
                                    <CardTitle className="text-lg flex items-center gap-2"><University className="h-5 w-5 text-primary"/>{lab.name}</CardTitle>
                                    {lab.location && <CardDescription>{lab.location}</CardDescription>}
                                </CardHeader>
                                <CardContent>
                                    <p className="text-sm text-muted-foreground line-clamp-2">{lab.description || "No description available for this lab."}</p>
                                </CardContent>
                                <CardFooter className="flex flex-col gap-2">
                                    <Button variant="outline" size="sm" asChild className="w-full">
                                        <Link href={`/admin/resources?labId=${lab.id}`}>View Resources</Link>
                                    </Button>
                                    {membership?.id && (
                                        <Button variant="destructive" size="sm" className="w-full" onClick={() => handleLeaveLab(membership.id!, lab.name)} disabled={isMembershipActionLoading[membership.id!]}>
                                            {isMembershipActionLoading[membership.id!] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <LogOut className="mr-2 h-4 w-4"/>}
                                            Leave Lab
                                        </Button>
                                    )}
                                </CardFooter>
                            </Card>
                        );
                    })}
                </div>
            ) : (
                <EmptyState
                  icon={KeyRound}
                  title="No active lab access"
                  description="You can request access to available labs below."
                />
            )}
          </section>

          {userPendingLabRequests.length > 0 && (
            <>
              <Separator />
              <section>
                <h2 className="text-xl font-semibold mb-4">Pending Lab Access Requests</h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {userPendingLabRequests.map(req => (
                    <Card key={req.id} className="shadow-sm border-dashed">
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2"><Clock className="h-5 w-5 text-yellow-500"/>{req.labName}</CardTitle>
                        <CardDescription>Status: Pending Approval</CardDescription>
                      </CardHeader>
                      <CardFooter>
                        <Button variant="outline" size="sm" className="w-full" onClick={() => handleCancelRequest(req.id!, req.labName!)} disabled={isMembershipActionLoading[req.id!]}>
                           {isMembershipActionLoading[req.id!] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <XCircle className="mr-2 h-4 w-4"/>}
                          Cancel Request
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </section>
            </>
          )}

          {availableLabsForRequest.length > 0 && (
            <>
              <Separator />
              <section>
                <h2 className="text-xl font-semibold mb-4">Available Labs</h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {availableLabsForRequest.map(lab => (
                    <Card key={lab.id} className="shadow-sm">
                      <CardHeader>
                        <CardTitle className="text-lg">{lab.name}</CardTitle>
                        {lab.location && <CardDescription>{lab.location}</CardDescription>}
                      </CardHeader>
                       <CardContent>
                         <p className="text-sm text-muted-foreground line-clamp-2">{lab.description || "No description."}</p>
                       </CardContent>
                      <CardFooter>
                        <Button variant="default" size="sm" className="w-full" onClick={() => handleRequestAccess(lab.id, lab.name)} disabled={isMembershipActionLoading[lab.id]}>
                          {isMembershipActionLoading[lab.id] ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <PlusCircle className="mr-2 h-4 w-4"/>}
                          Request Access
                        </Button>
                      </CardFooter>
                    </Card>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
