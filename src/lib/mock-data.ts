
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
import { db } from '@/lib/firebase'; // Added import for db
import { collection, addDoc, serverTimestamp } from 'firebase/firestore'; // Added imports for Firestore operations

// --- Static Lists (Application Configuration Data) ---
export const userRolesList: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];
export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const labsList: Resource['lab'][] = ['Electronics Lab 1', 'RF Lab', 'Prototyping Lab', 'General Test Area'];
export const resourceStatusesList: ResourceStatus[] = ['Available', 'Booked', 'Maintenance'];
export const bookingStatusesForFilter: (Booking['status'] | 'all')[] = ['all', 'Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const bookingStatusesForForm: Booking['status'][] = ['Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const daysOfWeekArray: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


// --- Dynamic Data Arrays - These are effectively deprecated if Firestore is the source of truth ---
export let initialMockUsers: User[] = [];
export let initialMockResourceTypes: ResourceType[] = [];
export let allAdminMockResources: Resource[] = [];
export let initialBookings: Booking[] = [];
export let initialMaintenanceRequests: MaintenanceRequest[] = [];
export let initialBlackoutDates: BlackoutDate[] = [];
export let initialRecurringBlackoutRules: RecurringBlackoutRule[] = [];


// --- Functions to add Notifications & Audit Logs to Firestore ---
export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string
): Promise<void> {
  const newNotificationData: Omit<Notification, 'id' | 'createdAt'> & { createdAt: any } = {
    userId,
    title,
    message,
    type,
    isRead: false,
    linkTo: linkTo || null, // Ensure null if undefined for Firestore
    createdAt: serverTimestamp(), // Use Firestore server timestamp
  };
  try {
    await addDoc(collection(db, 'notifications'), newNotificationData);
    console.log("Notification added to Firestore for user:", userId);
  } catch (e) {
    console.error("Error adding notification to Firestore: ", e);
    // Optionally, re-throw or handle more gracefully
  }
}

export async function addAuditLog(
  actingUserId: string,
  actingUserName: string,
  action: AuditActionType,
  params: {
    entityType?: AuditLogEntry['entityType'];
    entityId?: string;
    details: string;
  }
): Promise<void> {
  const newLogData: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp: any } = {
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    entityType: params.entityType || null, // Ensure null if undefined
    entityId: params.entityId || null,     // Ensure null if undefined
    details: params.details,
    timestamp: serverTimestamp(), // Use Firestore server timestamp
  };
  try {
    await addDoc(collection(db, 'auditLogs'), newLogData);
    console.log("Audit log added to Firestore for action:", action);
  } catch (e) {
    console.error("Error adding audit log to Firestore: ", e);
    // Optionally, re-throw or handle more gracefully
  }
}

// The in-memory arrays are no longer the primary store but might be useful for quick reference if not fetching,
// though generally data should come from Firestore after these changes.
export let initialNotifications: Notification[] = [];
export let initialAuditLogs: AuditLogEntry[] = [];
