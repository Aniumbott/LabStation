'use server';

import { prisma } from '@/lib/prisma';
import type {
  User,
  Lab,
  LabMembership,
  Resource,
  ResourceType,
  Booking,
  Notification,
  AuditLogEntry,
  BlackoutDate,
  RecurringBlackoutRule,
  MaintenanceRequest,
  UnavailabilityPeriod,
  RemoteAccessDetails,
  BookingUsageDetails,
  DayOfWeek,
} from '@/types';

// =============================================================================
// Response type
// =============================================================================

interface ActionResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
}

// =============================================================================
// Helper: Serialize dates in Prisma results to plain JS Date objects
// (Prisma already returns JS Dates, but we ensure no Prisma model leakage)
// =============================================================================

function toPlainObject<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

// =============================================================================
// USER READS
// =============================================================================

/**
 * Returns all users ordered by name. Intended for admin usage.
 */
export async function getUsers_SA(
  callerUserId: string
): Promise<ActionResponse<User[]>> {
  try {
    if (!callerUserId) {
      return { success: false, message: 'Caller user ID is required.' };
    }

    const users = await prisma.user.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
    });

    const mapped: User[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role as User['role'],
      avatarUrl: u.avatarUrl ?? undefined,
      status: u.status as User['status'],
      createdAt: u.createdAt,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getUsers_SA] Error:', error);
    return { success: false, message: 'Failed to fetch users.' };
  }
}

/**
 * Returns a single user by ID.
 */
export async function getUserById_SA(
  userId: string
): Promise<ActionResponse<User>> {
  try {
    if (!userId) {
      return { success: false, message: 'User ID is required.' };
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        avatarUrl: true,
        status: true,
        createdAt: true,
      },
    });

    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    const mapped: User = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role as User['role'],
      avatarUrl: user.avatarUrl ?? undefined,
      status: user.status as User['status'],
      createdAt: user.createdAt,
    };

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getUserById_SA] Error:', error);
    return { success: false, message: 'Failed to fetch user.' };
  }
}

// =============================================================================
// LAB READS
// =============================================================================

/**
 * Returns all labs ordered by name.
 */
export async function getLabs_SA(): Promise<ActionResponse<Lab[]>> {
  try {
    const labs = await prisma.lab.findMany({
      orderBy: { name: 'asc' },
    });

    const mapped: Lab[] = labs.map((l) => ({
      id: l.id,
      name: l.name,
      location: l.location ?? undefined,
      description: l.description ?? undefined,
      createdAt: l.createdAt,
      lastUpdatedAt: l.updatedAt,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getLabs_SA] Error:', error);
    return { success: false, message: 'Failed to fetch labs.' };
  }
}

/**
 * Returns lab memberships for a specific user.
 */
export async function getLabMemberships_SA(
  userId: string
): Promise<ActionResponse<LabMembership[]>> {
  try {
    if (!userId) {
      return { success: false, message: 'User ID is required.' };
    }

    const memberships = await prisma.labMembership.findMany({
      where: { userId },
      include: {
        user: { select: { name: true } },
        lab: { select: { name: true } },
        actingAdmin: { select: { name: true } },
      },
    });

    const mapped: LabMembership[] = memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      labId: m.labId,
      status: m.status as LabMembership['status'],
      roleInLab: (m.roleInLab as LabMembership['roleInLab']) ?? undefined,
      requestedAt: m.requestedAt as unknown as LabMembership['requestedAt'],
      updatedAt: m.updatedAt as unknown as LabMembership['updatedAt'],
      actingAdminId: m.actingAdminId ?? undefined,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getLabMemberships_SA] Error:', error);
    return { success: false, message: 'Failed to fetch lab memberships.' };
  }
}

/**
 * Returns all lab memberships (admin view).
 */
export async function getAllLabMemberships_SA(): Promise<ActionResponse<LabMembership[]>> {
  try {
    const memberships = await prisma.labMembership.findMany({
      include: {
        user: { select: { name: true } },
        lab: { select: { name: true } },
        actingAdmin: { select: { name: true } },
      },
    });

    const mapped: LabMembership[] = memberships.map((m) => ({
      id: m.id,
      userId: m.userId,
      labId: m.labId,
      status: m.status as LabMembership['status'],
      roleInLab: (m.roleInLab as LabMembership['roleInLab']) ?? undefined,
      requestedAt: m.requestedAt as unknown as LabMembership['requestedAt'],
      updatedAt: m.updatedAt as unknown as LabMembership['updatedAt'],
      actingAdminId: m.actingAdminId ?? undefined,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getAllLabMemberships_SA] Error:', error);
    return { success: false, message: 'Failed to fetch all lab memberships.' };
  }
}

// =============================================================================
// RESOURCE READS
// =============================================================================

/**
 * Returns all resources ordered by name, including resourceType and lab relations.
 */
export async function getResources_SA(): Promise<ActionResponse<(Resource & { resourceTypeName?: string; labName?: string })[]>> {
  try {
    const resources = await prisma.resource.findMany({
      orderBy: { name: 'asc' },
      include: {
        resourceType: true,
        lab: true,
      },
    });

    const mapped = resources.map((r) => ({
      id: r.id,
      name: r.name,
      resourceTypeId: r.resourceTypeId,
      labId: r.labId,
      status: r.status as Resource['status'],
      description: r.description ?? undefined,
      imageUrl: r.imageUrl ?? undefined,
      features: JSON.parse(r.features || '[]') as string[],
      manufacturer: r.manufacturer ?? undefined,
      model: r.model ?? undefined,
      serialNumber: r.serialNumber ?? undefined,
      purchaseDate: r.purchaseDate ?? null,
      notes: r.notes ?? undefined,
      remoteAccess: JSON.parse(r.remoteAccess || 'null') as RemoteAccessDetails | null,
      allowQueueing: r.allowQueueing,
      createdAt: r.createdAt,
      lastUpdatedAt: r.updatedAt,
      // Additional relation data
      resourceTypeName: r.resourceType?.name,
      labName: r.lab?.name,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getResources_SA] Error:', error);
    return { success: false, message: 'Failed to fetch resources.' };
  }
}

/**
 * Returns a single resource by ID with all relations including
 * resourceType, lab, unavailabilityPeriods, and bookings.
 */
export async function getResourceById_SA(
  resourceId: string
): Promise<ActionResponse<Resource & {
  resourceTypeName?: string;
  labName?: string;
  bookings?: Booking[];
}>> {
  try {
    if (!resourceId) {
      return { success: false, message: 'Resource ID is required.' };
    }

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
      include: {
        resourceType: true,
        lab: true,
        unavailabilityPeriods: true,
        bookings: {
          include: {
            resource: { select: { name: true } },
            user: { select: { name: true } },
          },
        },
      },
    });

    if (!resource) {
      return { success: false, message: 'Resource not found.' };
    }

    const unavailabilityPeriods: UnavailabilityPeriod[] = resource.unavailabilityPeriods.map((up) => ({
      id: up.id,
      startDate: up.startDate,
      endDate: up.endDate,
      reason: up.reason ?? undefined,
    }));

    const bookings: Booking[] = resource.bookings.map((b) => ({
      id: b.id,
      resourceId: b.resourceId,
      userId: b.userId,
      startTime: b.startTime,
      endTime: b.endTime,
      createdAt: b.createdAt,
      status: b.status as Booking['status'],
      notes: b.notes ?? undefined,
      usageDetails: JSON.parse(b.usageDetails || 'null') as BookingUsageDetails | null,
      resourceName: b.resource?.name,
      userName: b.user?.name,
    }));

    const mapped = {
      id: resource.id,
      name: resource.name,
      resourceTypeId: resource.resourceTypeId,
      labId: resource.labId,
      status: resource.status as Resource['status'],
      description: resource.description ?? undefined,
      imageUrl: resource.imageUrl ?? undefined,
      features: JSON.parse(resource.features || '[]') as string[],
      unavailabilityPeriods,
      manufacturer: resource.manufacturer ?? undefined,
      model: resource.model ?? undefined,
      serialNumber: resource.serialNumber ?? undefined,
      purchaseDate: resource.purchaseDate ?? null,
      notes: resource.notes ?? undefined,
      remoteAccess: JSON.parse(resource.remoteAccess || 'null') as RemoteAccessDetails | null,
      allowQueueing: resource.allowQueueing,
      createdAt: resource.createdAt,
      lastUpdatedAt: resource.updatedAt,
      // Relation data
      resourceTypeName: resource.resourceType?.name,
      labName: resource.lab?.name,
      bookings,
    };

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getResourceById_SA] Error:', error);
    return { success: false, message: 'Failed to fetch resource.' };
  }
}

/**
 * Returns all resource types ordered by name.
 */
export async function getResourceTypes_SA(): Promise<ActionResponse<ResourceType[]>> {
  try {
    const types = await prisma.resourceType.findMany({
      orderBy: { name: 'asc' },
    });

    const mapped: ResourceType[] = types.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description ?? undefined,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getResourceTypes_SA] Error:', error);
    return { success: false, message: 'Failed to fetch resource types.' };
  }
}

// =============================================================================
// BOOKING READS
// =============================================================================

/**
 * Returns bookings with optional filters, ordered by startTime ascending.
 * If userId is provided, filters by that user. If status array is provided,
 * filters by statuses in that array.
 */
export async function getBookings_SA(input: {
  userId?: string;
  status?: string[];
}): Promise<ActionResponse<Booking[]>> {
  try {
    const where: Record<string, unknown> = {};

    if (input.userId) {
      where.userId = input.userId;
    }

    if (input.status && input.status.length > 0) {
      where.status = { in: input.status };
    }

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { startTime: 'asc' },
      include: {
        resource: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    const mapped: Booking[] = bookings.map((b) => ({
      id: b.id,
      resourceId: b.resourceId,
      userId: b.userId,
      startTime: b.startTime,
      endTime: b.endTime,
      createdAt: b.createdAt,
      status: b.status as Booking['status'],
      notes: b.notes ?? undefined,
      usageDetails: JSON.parse(b.usageDetails || 'null') as BookingUsageDetails | null,
      resourceName: b.resource?.name,
      userName: b.user?.name,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getBookings_SA] Error:', error);
    return { success: false, message: 'Failed to fetch bookings.' };
  }
}

/**
 * Returns a single booking by ID with resource and user names.
 */
export async function getBookingById_SA(
  bookingId: string
): Promise<ActionResponse<Booking>> {
  try {
    if (!bookingId) {
      return { success: false, message: 'Booking ID is required.' };
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        resource: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    if (!booking) {
      return { success: false, message: 'Booking not found.' };
    }

    const mapped: Booking = {
      id: booking.id,
      resourceId: booking.resourceId,
      userId: booking.userId,
      startTime: booking.startTime,
      endTime: booking.endTime,
      createdAt: booking.createdAt,
      status: booking.status as Booking['status'],
      notes: booking.notes ?? undefined,
      usageDetails: JSON.parse(booking.usageDetails || 'null') as BookingUsageDetails | null,
      resourceName: booking.resource?.name,
      userName: booking.user?.name,
    };

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getBookingById_SA] Error:', error);
    return { success: false, message: 'Failed to fetch booking.' };
  }
}

/**
 * Returns bookings where status is 'Pending' or 'Waitlisted', ordered by startTime.
 */
export async function getPendingBookings_SA(): Promise<ActionResponse<Booking[]>> {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        status: { in: ['Pending', 'Waitlisted'] },
      },
      orderBy: { startTime: 'asc' },
      include: {
        resource: { select: { name: true } },
        user: { select: { name: true } },
      },
    });

    const mapped: Booking[] = bookings.map((b) => ({
      id: b.id,
      resourceId: b.resourceId,
      userId: b.userId,
      startTime: b.startTime,
      endTime: b.endTime,
      createdAt: b.createdAt,
      status: b.status as Booking['status'],
      notes: b.notes ?? undefined,
      usageDetails: JSON.parse(b.usageDetails || 'null') as BookingUsageDetails | null,
      resourceName: b.resource?.name,
      userName: b.user?.name,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getPendingBookings_SA] Error:', error);
    return { success: false, message: 'Failed to fetch pending bookings.' };
  }
}

// =============================================================================
// NOTIFICATION READS
// =============================================================================

/**
 * Returns notifications for a user, ordered by createdAt descending.
 */
export async function getNotifications_SA(
  userId: string
): Promise<ActionResponse<Notification[]>> {
  try {
    if (!userId) {
      return { success: false, message: 'User ID is required.' };
    }

    const notifications = await prisma.notification.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    const mapped: Notification[] = notifications.map((n) => ({
      id: n.id,
      userId: n.userId,
      title: n.title,
      message: n.message,
      type: n.type as Notification['type'],
      isRead: n.isRead,
      createdAt: n.createdAt,
      linkTo: n.linkTo ?? undefined,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getNotifications_SA] Error:', error);
    return { success: false, message: 'Failed to fetch notifications.' };
  }
}

// =============================================================================
// AUDIT LOG READS
// =============================================================================

/**
 * Returns all audit logs ordered by timestamp descending.
 */
export async function getAuditLogs_SA(): Promise<ActionResponse<AuditLogEntry[]>> {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { timestamp: 'desc' },
    });

    const mapped: AuditLogEntry[] = logs.map((l) => ({
      id: l.id,
      timestamp: l.timestamp,
      userId: l.userId,
      userName: l.userName,
      action: l.action as AuditLogEntry['action'],
      entityType: (l.entityType as AuditLogEntry['entityType']) ?? undefined,
      entityId: l.entityId ?? undefined,
      secondaryEntityType: (l.secondaryEntityType as AuditLogEntry['secondaryEntityType']) ?? undefined,
      secondaryEntityId: l.secondaryEntityId ?? undefined,
      details: l.details,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getAuditLogs_SA] Error:', error);
    return { success: false, message: 'Failed to fetch audit logs.' };
  }
}

// =============================================================================
// LAB OPERATIONS READS
// =============================================================================

/**
 * Returns all blackout dates ordered by date.
 */
export async function getBlackoutDates_SA(): Promise<ActionResponse<BlackoutDate[]>> {
  try {
    const dates = await prisma.blackoutDate.findMany({
      orderBy: { date: 'asc' },
    });

    const mapped: BlackoutDate[] = dates.map((d) => ({
      id: d.id,
      labId: d.labId ?? null,
      date: d.date,
      reason: d.reason ?? undefined,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getBlackoutDates_SA] Error:', error);
    return { success: false, message: 'Failed to fetch blackout dates.' };
  }
}

/**
 * Returns all recurring blackout rules ordered by name.
 */
export async function getRecurringBlackoutRules_SA(): Promise<ActionResponse<RecurringBlackoutRule[]>> {
  try {
    const rules = await prisma.recurringBlackoutRule.findMany({
      orderBy: { name: 'asc' },
    });

    const mapped: RecurringBlackoutRule[] = rules.map((r) => ({
      id: r.id,
      labId: r.labId ?? null,
      name: r.name,
      daysOfWeek: JSON.parse(r.daysOfWeek || '[]') as DayOfWeek[],
      reason: r.reason ?? undefined,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getRecurringBlackoutRules_SA] Error:', error);
    return { success: false, message: 'Failed to fetch recurring blackout rules.' };
  }
}

/**
 * Returns all maintenance requests ordered by dateReported descending.
 * Includes resource name, reporter name, and assigned technician name.
 */
export async function getMaintenanceRequests_SA(): Promise<ActionResponse<MaintenanceRequest[]>> {
  try {
    const requests = await prisma.maintenanceRequest.findMany({
      orderBy: { dateReported: 'desc' },
      include: {
        resource: { select: { name: true } },
        reportedBy: { select: { name: true } },
        assignedTechnician: { select: { name: true } },
      },
    });

    const mapped: MaintenanceRequest[] = requests.map((r) => ({
      id: r.id,
      resourceId: r.resourceId,
      reportedByUserId: r.reportedByUserId,
      issueDescription: r.issueDescription,
      status: r.status as MaintenanceRequest['status'],
      assignedTechnicianId: r.assignedTechnicianId ?? null,
      dateReported: r.dateReported,
      dateResolved: r.dateResolved ?? null,
      resourceName: r.resource?.name,
      reportedByUserName: r.reportedBy?.name,
      assignedTechnicianName: r.assignedTechnician?.name,
    }));

    return { success: true, data: toPlainObject(mapped) };
  } catch (error: unknown) {
    console.error('[getMaintenanceRequests_SA] Error:', error);
    return { success: false, message: 'Failed to fetch maintenance requests.' };
  }
}

// =============================================================================
// DASHBOARD READS
// =============================================================================

/**
 * Composite function for the dashboard page. Returns:
 * - labs: all labs
 * - userLabMemberships: lab memberships for the given user
 * - recentResources: 3 most recent resources (ordered by name)
 * - upcomingBookings: next 5 upcoming bookings for the user (endTime >= now)
 */
export async function getDashboardData_SA(userId: string): Promise<
  ActionResponse<{
    labs: Lab[];
    userLabMemberships: LabMembership[];
    recentResources: (Resource & { resourceTypeName?: string; labName?: string })[];
    upcomingBookings: Booking[];
  }>
> {
  try {
    if (!userId) {
      return { success: false, message: 'User ID is required.' };
    }

    const now = new Date();

    // Run all queries in parallel for performance
    const [labsRaw, membershipsRaw, resourcesRaw, bookingsRaw] = await Promise.all([
      // All labs
      prisma.lab.findMany({
        orderBy: { name: 'asc' },
      }),

      // User's lab memberships
      prisma.labMembership.findMany({
        where: { userId },
        include: {
          user: { select: { name: true } },
          lab: { select: { name: true } },
          actingAdmin: { select: { name: true } },
        },
      }),

      // Recent resources (limit 3, ordered by name)
      prisma.resource.findMany({
        orderBy: { name: 'asc' },
        take: 3,
        include: {
          resourceType: true,
          lab: true,
        },
      }),

      // Upcoming bookings for this user (endTime >= now, ordered by startTime, limit 5)
      prisma.booking.findMany({
        where: {
          userId,
          endTime: { gte: now },
        },
        orderBy: { startTime: 'asc' },
        take: 5,
        include: {
          resource: { select: { name: true } },
          user: { select: { name: true } },
        },
      }),
    ]);

    // Map labs
    const labs: Lab[] = labsRaw.map((l) => ({
      id: l.id,
      name: l.name,
      location: l.location ?? undefined,
      description: l.description ?? undefined,
      createdAt: l.createdAt,
      lastUpdatedAt: l.updatedAt,
    }));

    // Map memberships
    const userLabMemberships: LabMembership[] = membershipsRaw.map((m) => ({
      id: m.id,
      userId: m.userId,
      labId: m.labId,
      status: m.status as LabMembership['status'],
      roleInLab: (m.roleInLab as LabMembership['roleInLab']) ?? undefined,
      requestedAt: m.requestedAt as unknown as LabMembership['requestedAt'],
      updatedAt: m.updatedAt as unknown as LabMembership['updatedAt'],
      actingAdminId: m.actingAdminId ?? undefined,
    }));

    // Map resources
    const recentResources = resourcesRaw.map((r) => ({
      id: r.id,
      name: r.name,
      resourceTypeId: r.resourceTypeId,
      labId: r.labId,
      status: r.status as Resource['status'],
      description: r.description ?? undefined,
      imageUrl: r.imageUrl ?? undefined,
      features: JSON.parse(r.features || '[]') as string[],
      manufacturer: r.manufacturer ?? undefined,
      model: r.model ?? undefined,
      serialNumber: r.serialNumber ?? undefined,
      purchaseDate: r.purchaseDate ?? null,
      notes: r.notes ?? undefined,
      remoteAccess: JSON.parse(r.remoteAccess || 'null') as RemoteAccessDetails | null,
      allowQueueing: r.allowQueueing,
      createdAt: r.createdAt,
      lastUpdatedAt: r.updatedAt,
      resourceTypeName: r.resourceType?.name,
      labName: r.lab?.name,
    }));

    // Map bookings
    const upcomingBookings: Booking[] = bookingsRaw.map((b) => ({
      id: b.id,
      resourceId: b.resourceId,
      userId: b.userId,
      startTime: b.startTime,
      endTime: b.endTime,
      createdAt: b.createdAt,
      status: b.status as Booking['status'],
      notes: b.notes ?? undefined,
      usageDetails: JSON.parse(b.usageDetails || 'null') as BookingUsageDetails | null,
      resourceName: b.resource?.name,
      userName: b.user?.name,
    }));

    return {
      success: true,
      data: toPlainObject({
        labs,
        userLabMemberships,
        recentResources,
        upcomingBookings,
      }),
    };
  } catch (error: unknown) {
    console.error('[getDashboardData_SA] Error:', error);
    return { success: false, message: 'Failed to fetch dashboard data.' };
  }
}
