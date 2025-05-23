
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
import { format, addDays, set, subDays, parseISO, startOfDay, isValid as isValidDate, getDay, isBefore } from 'date-fns';
// Note: db import removed as core mock data functions are being removed or refactored into components/contexts.

// --- Static Lists (Application Configuration Data - Kept for now) ---
export const userRolesList: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];
export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const labsList = ['Electronics Lab 1', 'RF Lab', 'Prototyping Lab', 'General Test Area'];
export const resourceStatusesList: Array<Resource['status']> = ['Available', 'Booked', 'Maintenance'];
export const bookingStatusesForFilter: (Booking['status'] | 'all')[] = ['all', 'Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const bookingStatusesForForm: Booking['status'][] = ['Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const daysOfWeekArray: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- Mock Resource Types (Kept for now, used by forms, to be moved to Firestore later) ---
export const initialMockResourceTypes: ResourceType[] = [
  { id: 'rt1', name: 'Oscilloscope', description: 'For visualizing voltage signals over time.' },
  { id: 'rt2', name: 'Power Supply', description: 'Provides DC or AC power to test circuits.' },
  { id: 'rt3', name: 'Function Generator', description: 'Generates various types of electrical waveforms.' },
  { id: 'rt4', name: 'Spectrum Analyzer', description: 'Measures magnitude of an input signal versus frequency.' },
  { id: 'rt5', name: 'Digital Multimeter (DMM)', description: 'Measures voltage, current, and resistance.' },
  { id: 'rt6', name: 'Soldering Station', description: 'For assembling or repairing electronics.' },
  { id: 'rt7', name: 'Logic Analyzer', description: 'Captures and displays signals from a digital system.' },
  { id: 'rt8', name: 'Test Probe Set', description: 'Assorted probes for connecting test equipment.' },
  { id: 'rt9', name: 'FPGA Development Board', description: 'Programmable logic device for custom hardware acceleration.'},
  { id: 'rt10', name: 'Environmental Chamber', description: 'For testing devices under controlled temperature and humidity.' },
  { id: 'rt11', name: 'Network Analyzer (VNA)', description: 'Measures network parameters of electrical networks.' },
  { id: 'rt12', name: 'Microscope (Inspection)', description: 'For visual inspection of PCBs and components.' },
];


// --- Main Data Arrays - REMOVED / EMPTIED ---
// These arrays will now be empty as data is fetched from Firestore.
// Pages relying on them will need to be refactored to use Firestore.
export let initialMockUsers: User[] = [];
export let allAdminMockResources: Resource[] = [];
export let initialBookings: Booking[] = [];
export let initialMaintenanceRequests: MaintenanceRequest[] = [];
export let initialBlackoutDates: BlackoutDate[] = [];
export let initialRecurringBlackoutRules: RecurringBlackoutRule[] = [];


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
  console.log("Mock Notification Added:", newNotification);
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
  console.log("Mock Audit Log Added:", newLog);
  // Example Firestore: await addDoc(collection(db, 'auditLogs'), Omit<AuditLogEntry, 'id'>...);
}

// Functions like getWaitlistPosition and processQueueForResource are removed
// as they depended on the now-empty initialBookings and allAdminMockResources.
// They will need to be re-implemented with Firestore logic.
