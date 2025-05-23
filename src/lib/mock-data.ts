
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
import { Timestamp } from 'firebase/firestore'; // Import Timestamp

// --- Static Lists (Application Configuration Data - Kept) ---
export const userRolesList: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];
export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const labsList = ['Electronics Lab 1', 'RF Lab', 'Prototyping Lab', 'General Test Area'];
export const resourceStatusesList: Array<Resource['status']> = ['Available', 'Booked', 'Maintenance'];
export const bookingStatusesForFilter: (Booking['status'] | 'all')[] = ['all', 'Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const bookingStatusesForForm: Booking['status'][] = ['Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const daysOfWeekArray: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


// --- Main Data Arrays - EMPTIED ---
// These arrays are now empty. Data should be fetched from Firestore.
// Pages relying on these will need to be refactored to use Firestore.
export let initialMockUsers: User[] = [];
export let allAdminMockResources: Resource[] = [];
export let initialBookings: Booking[] = [];
export let initialMaintenanceRequests: MaintenanceRequest[] = [];
export let initialBlackoutDates: BlackoutDate[] = [];
export let initialRecurringBlackoutRules: RecurringBlackoutRule[] = [];
export let initialMockResourceTypes: ResourceType[] = [];


// --- Notifications & Audit Logs (In-memory for mock setup, would also be Firestore collections) ---
export let initialNotifications: Notification[] = [];

export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string
) {
  const newNotification: Notification = {
    id: `n${initialNotifications.length + 1 + Date.now()}`,
    userId,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date().toISOString(),
    linkTo,
  };
  initialNotifications.unshift(newNotification);
  // console.log("Mock Notification Added:", newNotification);
  // Example Firestore: await addDoc(collection(db, 'notifications'), Omit<Notification, 'id'>...);
}

export let initialAuditLogs: AuditLogEntry[] = [];

export async function addAuditLog(
  actingUserId: string,
  actingUserName: string,
  action: AuditActionType,
  params: {
    entityType?: AuditLogEntry['entityType'];
    entityId?: string;
    details: string;
  }
) {
  const newLog: AuditLogEntry = {
    id: `log-${Date.now()}`,
    timestamp: new Date().toISOString(),
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
  };
  initialAuditLogs.unshift(newLog);
  // console.log("Mock Audit Log Added:", newLog);
  // Example Firestore: await addDoc(collection(db, 'auditLogs'), Omit<AuditLogEntry, 'id'>...);
}

// Placeholder functions that were previously manipulating mock data are now removed.
// They will be re-implemented with Firestore logic within their respective pages/components.
// Example: getWaitlistPosition, processQueueForResource, mockLoginUser, mockSignupUser etc.
// are now handled by AuthContext using Firebase Auth and specific Firestore queries on pages.
