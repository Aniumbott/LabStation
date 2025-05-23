
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
import { db } from './firebase'; // For potential future direct Firestore interaction in helpers
import { collection, addDoc } from 'firebase/firestore';


// --- Static Lists (Application Configuration Data) ---
export const userRolesList: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];
export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const labsList = ['Electronics Lab 1', 'RF Lab', 'Prototyping Lab', 'General Test Area'];
export const resourceStatusesList: Array<Resource['status']> = ['Available', 'Booked', 'Maintenance'];
export const bookingStatusesForFilter: (Booking['status'] | 'all')[] = ['all', 'Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const bookingStatusesForForm: Booking['status'][] = ['Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const daysOfWeekArray: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- Mock Resource Types (Small, managed by admin, might be kept as mock for some time or moved to Firestore) ---
// For now, keeping this as other forms depend on it. Will be moved to Firestore next.
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


// --- Main Data Arrays - These will be REMOVED as data now lives in Firestore ---
// The application will now fetch data from Firestore for these entities.
// Empty arrays are left as placeholders to prevent import errors in files not yet refactored.
export let initialMockUsers: User[] = []; // Data fetched from Firestore 'users' collection
export let allAdminMockResources: Resource[] = []; // Data fetched from Firestore 'resources' collection
export let initialBookings: Booking[] = []; // Data fetched from Firestore 'bookings' collection
export let initialMaintenanceRequests: MaintenanceRequest[] = []; // Data fetched from Firestore 'maintenanceRequests' collection
export let initialBlackoutDates: BlackoutDate[] = []; // Data fetched from Firestore 'blackoutDates' collection
export let initialRecurringBlackoutRules: RecurringBlackoutRule[] = []; // Data fetched from Firestore 'recurringBlackoutRules' collection


// --- Notifications & Audit Logs (In-memory for mock setup, would also be Firestore collections) ---
export let initialNotifications: Notification[] = [];

export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string
) {
  const newNotification: Omit<Notification, 'id'> = { // Omit ID as Firestore will generate it
    userId,
    title,
    message,
    type,
    isRead: false,
    createdAt: new Date().toISOString(),
    linkTo,
  };
  // Placeholder: In a real app, this would be an Firestore addDoc call
  // For mock:
  const mockId = `n${initialNotifications.length + 1 + Date.now()}`;
  initialNotifications.unshift({id: mockId, ...newNotification});
  console.log("Mock Notification Added:", {id: mockId, ...newNotification});
  // Example Firestore: await addDoc(collection(db, 'notifications'), newNotification);
}

export let initialAuditLogs: AuditLogEntry[] = [];

export async function addAuditLog(
  actingUserId: string,
  actingUserName: string, // Keep for mock, in real app fetch or pass if already have it
  action: AuditActionType,
  params: {
    entityType?: AuditLogEntry['entityType'];
    entityId?: string;
    details: string;
  }
) {
  const newLog: Omit<AuditLogEntry, 'id'> = { // Omit ID
    timestamp: new Date().toISOString(),
    userId: actingUserId,
    userName: actingUserName, // For audit logs, denormalizing acting user's name is common
    action: action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
  };
  // Placeholder: In a real app, this would be an Firestore addDoc call
  // For mock:
  const mockId = `log-${Date.now()}`;
  initialAuditLogs.unshift({id: mockId, ...newLog});
  console.log("Mock Audit Log Added:", {id: mockId, ...newLog});
  // Example Firestore: await addDoc(collection(db, 'auditLogs'), newLog);
}

// --- Helper Functions (Relying on passed 'allBookings' or need Firestore refactor) ---

// getWaitlistPosition will need refactoring to work with Firestore queries
// For now, it will likely not function correctly as initialBookings is empty.
export function getWaitlistPosition(booking: Booking, allBookings: Booking[]): number | null {
  if (booking.status !== 'Waitlisted' || !booking.createdAt) {
    return null;
  }
  // This logic will need to be adapted for Firestore, likely querying bookings
  // for the same resource, status, and time, then ordering by createdAt.
  const conflictingWaitlistedBookings = allBookings.filter(b =>
    b.resourceId === booking.resourceId &&
    b.status === 'Waitlisted' &&
    b.createdAt && // Ensure createdAt exists
    (b.startTime < booking.endTime && b.endTime > booking.startTime)
  );

  const sortedWaitlist = conflictingWaitlistedBookings
    .filter(b => b.createdAt) // Double check for safety
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  const positionIndex = sortedWaitlist.findIndex(b => b.id === booking.id);
  return positionIndex !== -1 ? positionIndex + 1 : null;
}


// processQueueForResource needs a significant refactor for Firestore.
// It involves querying, updating multiple documents, and potentially transactions.
// Commenting out for now as it directly manipulates mock arrays.
/*
export async function processQueueForResource(resourceId: string): Promise<void> {
  // 1. Fetch the resource to check allowQueueing (from Firestore)
  // 2. Query waitlisted bookings for this resource, ordered by createdAt (from Firestore)
  // 3. If waitlisted bookings exist:
  //    a. Take the first one (bookingToPromote).
  //    b. Check if the slot for bookingToPromote is *actually* free now
  //       (Query confirmed/pending bookings for conflict with bookingToPromote's times).
  //    c. If free, update bookingToPromote's status to 'Pending' (in Firestore).
  //    d. Call addNotification for user and admin (save to Firestore 'notifications').
  //    e. Call addAuditLog (save to Firestore 'auditLogs').

  console.warn("processQueueForResource needs to be refactored for Firestore.");

  // Original mock logic (commented out):
  // const resource = allAdminMockResources.find(r => r.id === resourceId);
  // if (!resource || !resource.allowQueueing) {
  //   return;
  // }
  // ... (rest of the original logic that manipulates initialBookings) ...
}
*/

// The functions mockLoginUser, mockSignupUser, mockApproveSignup, mockRejectSignup
// were removed as AuthContext now handles Firebase Auth directly, and user profile
// CUD operations are managed by the Users admin page against Firestore.
