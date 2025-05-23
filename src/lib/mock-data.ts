
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
import { serverTimestamp, Timestamp } from 'firebase/firestore'; // Only for type consistency if needed

// --- Static Lists (Application Configuration Data) ---
export const userRolesList: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];
export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const labsList: Resource['lab'][] = ['Electronics Lab 1', 'RF Lab', 'Prototyping Lab', 'General Test Area'];
export const resourceStatusesList: ResourceStatus[] = ['Available', 'Booked', 'Maintenance'];
export const bookingStatusesForFilter: (Booking['status'] | 'all')[] = ['all', 'Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const bookingStatusesForForm: Booking['status'][] = ['Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const daysOfWeekArray: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


// --- Dynamic Data Arrays - Should be empty as data comes from Firestore ---
export let initialMockUsers: User[] = []; // Data fetched from Firestore users collection
export let initialMockResourceTypes: ResourceType[] = []; // Data fetched from Firestore resourceTypes collection
export let allAdminMockResources: Resource[] = []; // Data fetched from Firestore resources collection
export let initialBookings: Booking[] = []; // Data fetched from Firestore bookings collection
export let initialMaintenanceRequests: MaintenanceRequest[] = []; // Data fetched from Firestore maintenanceRequests collection
export let initialBlackoutDates: BlackoutDate[] = []; // Data fetched from Firestore blackoutDates collection
export let initialRecurringBlackoutRules: RecurringBlackoutRule[] = []; // Data fetched from Firestore recurringBlackoutRules collection


// --- In-memory placeholders for Notifications & Audit Logs ---
// In a full production app, these would also be Firestore collections.
// For this prototype, they are in-memory and reset on refresh.
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
    createdAt: new Date(), // JS Date for frontend consistency
    linkTo,
  };
  initialNotifications.unshift(newNotification);
  // To make this write to Firestore:
  // import { db } from '@/lib/firebase';
  // import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
  // try {
  //   await addDoc(collection(db, 'notifications'), { ...newNotification, createdAt: serverTimestamp() });
  // } catch (e) { console.error("Error adding notification to Firestore: ", e); }
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
    timestamp: new Date(), // JS Date for frontend consistency
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
  };
  initialAuditLogs.unshift(newLog);
  // To make this write to Firestore:
  // import { db } from '@/lib/firebase';
  // import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
  // try {
  //   await addDoc(collection(db, 'auditLogs'), { ...newLog, timestamp: serverTimestamp() });
  // } catch (e) { console.error("Error adding audit log to Firestore: ", e); }
}
