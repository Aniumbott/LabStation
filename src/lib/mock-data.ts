
import type {
  RoleName,
  MaintenanceRequestStatus,
  Notification,
  NotificationType,
  AuditLogEntry,
  AuditActionType,
  DayOfWeek,
  User,
  ResourceType,
  Booking,
  Resource,
  MaintenanceRequest,
  BlackoutDate,
  RecurringBlackoutRule,
} from '@/types';

// --- Static Lists (Application Configuration Data - Kept) ---
export const userRolesList: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];
export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const labsList = ['Electronics Lab 1', 'RF Lab', 'Prototyping Lab', 'General Test Area'];
export const resourceStatusesList: Array<Resource['status']> = ['Available', 'Booked', 'Maintenance'];
export const bookingStatusesForFilter: (Booking['status'] | 'all')[] = ['all', 'Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const bookingStatusesForForm: Booking['status'][] = ['Confirmed', 'Pending', 'Waitlisted', 'Cancelled']; // Used in BookingFormDialog
export const daysOfWeekArray: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


// --- Dynamic Data Arrays - MUST BE EMPTY ---
// These arrays should now be empty. Data is fetched from Firestore.
export let initialMockUsers: User[] = [];
export let initialMockResourceTypes: ResourceType[] = []; // Resource Types admin page fetches from Firestore. Forms needing types should get them via props.
export let allAdminMockResources: Resource[] = []; // Admin Resources & Detail pages fetch from Firestore.
export let initialBookings: Booking[] = []; // Bookings page, Dashboard, etc., fetch from Firestore.
export let initialMaintenanceRequests: MaintenanceRequest[] = []; // Maintenance page fetches from Firestore.
export let initialBlackoutDates: BlackoutDate[] = []; // Blackout Dates admin page fetches from Firestore.
export let initialRecurringBlackoutRules: RecurringBlackoutRule[] = []; // Blackout Dates admin page fetches from Firestore.


// --- Notifications & Audit Logs (In-memory for now - will be Firestore collections later) ---
export let initialNotifications: Notification[] = [];

export function addNotification( // Note: async keyword removed as it's not doing async work now
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string
): void {
  const newNotification: Notification = {
    id: `n${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // More unique ID
    userId,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date().toISOString(),
    linkTo,
  };
  initialNotifications.unshift(newNotification);
}

export let initialAuditLogs: AuditLogEntry[] = [];

export function addAuditLog( // Note: async keyword removed
  actingUserId: string,
  actingUserName: string,
  action: AuditActionType,
  params: {
    entityType?: AuditLogEntry['entityType'];
    entityId?: string;
    details: string;
  }
): void {
  const newLog: AuditLogEntry = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`, // More unique ID
    timestamp: new Date().toISOString(),
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
  };
  initialAuditLogs.unshift(newLog);
}
