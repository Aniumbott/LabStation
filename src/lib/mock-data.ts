
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
import { Timestamp } from 'firebase/firestore'; // For consistency, though we convert to JS Date

// --- Static Lists (Application Configuration Data) ---
export const userRolesList: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];
export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const labsList: Resource['lab'][] = ['Electronics Lab 1', 'RF Lab', 'Prototyping Lab', 'General Test Area'];
export const resourceStatusesList: Array<Resource['status']> = ['Available', 'Booked', 'Maintenance'];
export const bookingStatusesForFilter: (Booking['status'] | 'all')[] = ['all', 'Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const bookingStatusesForForm: Booking['status'][] = ['Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const daysOfWeekArray: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


// --- Dynamic Data Arrays ---
// These arrays will be empty as data is fetched from Firestore.
// They are kept here as a reference to the structure or if needed for specific client-side only scenarios temporarily.
export let initialMockUsers: User[] = [];
export let initialMockResourceTypes: ResourceType[] = [];
export let allAdminMockResources: Resource[] = [];
export let initialBookings: Booking[] = [];
export let initialMaintenanceRequests: MaintenanceRequest[] = [];
export let initialBlackoutDates: BlackoutDate[] = [];
export let initialRecurringBlackoutRules: RecurringBlackoutRule[] = [];


// --- Notifications & Audit Logs (In-memory placeholders for now) ---
// In a full production app, these would also be Firestore collections.
export let initialNotifications: Notification[] = [];

export function addNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string
): void {
  const newNotification: Notification = {
    id: `n${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    userId,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date(), // Use JS Date for consistency with frontend types
    linkTo,
  };
  initialNotifications.unshift(newNotification);
  // In a real app, this would be: await addDoc(collection(db, 'notifications'), { ...newNotification, createdAt: serverTimestamp() });
}

export let initialAuditLogs: AuditLogEntry[] = [];

export function addAuditLog(
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
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    timestamp: new Date(), // Use JS Date
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
  };
  initialAuditLogs.unshift(newLog);
  // In a real app, this would be: await addDoc(collection(db, 'auditLogs'), { ...newLog, timestamp: serverTimestamp() });
}
