
import type { RoleName, MaintenanceRequestStatus, Notification, NotificationType, BlackoutDate, RecurringBlackoutRule, AuditLogEntry, AuditActionType, DayOfWeek, Booking } from '@/types';
import { format, addDays, set, subDays, parseISO, startOfDay, isValid as isValidDate, getDay, isBefore } from 'date-fns';

// --- Static Lists (Can remain as they are not dynamic DB data) ---
export const userRolesList: RoleName[] = ['Admin', 'Lab Manager', 'Technician', 'Researcher'];
export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const labsList = ['Electronics Lab 1', 'RF Lab', 'Prototyping Lab', 'General Test Area'];
export const resourceStatusesList: Array<Resource['status']> = ['Available', 'Booked', 'Maintenance'];
export const bookingStatusesForFilter: (Booking['status'] | 'all')[] = ['all', 'Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const bookingStatusesForForm: Booking['status'][] = ['Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const daysOfWeekArray: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

// --- Dynamic Data Arrays (These will now be largely empty or removed, data comes from Firestore) ---

// initialMockUsers is effectively removed. User data comes from Firebase Auth and Firestore /users collection.
// The AuthContext and User Admin page will handle this.
// export let initialMockUsers: User[] = []; // No longer the source of truth

// allAdminMockResources will be fetched from Firestore.
// export let allAdminMockResources: Resource[] = [];

// initialMockResourceTypes will be fetched from Firestore.
// export let initialMockResourceTypes: ResourceType[] = [];

// initialBookings will be fetched from Firestore.
// export let initialBookings: Booking[] = [];

// initialMaintenanceRequests will be fetched from Firestore.
// export let initialMaintenanceRequests: MaintenanceRequest[] = [];

// initialBlackoutDates will be fetched from Firestore.
// export let initialBlackoutDates: BlackoutDate[] = [];

// initialRecurringBlackoutRules will be fetched from Firestore.
// export let initialRecurringBlackoutRules: RecurringBlackoutRule[] = [];


// --- Notifications & Audit Logs (These will be populated dynamically by the app against Firestore) ---
// For now, we can keep them as in-memory arrays for the mock setup, but ideally, these also go to Firestore.
// To simplify this transition step, let's keep these as mock arrays that get populated by the app.
// In a full Firestore migration, these would also be Firestore collections.

export let initialNotifications: Notification[] = [];

export function addNotification(
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
  // In a real app: await addDoc(collection(db, 'notifications'), newNotificationData);
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
  // In a real app: await addDoc(collection(db, 'auditLogs'), newLogData);
}


// --- Helper Functions (Can remain, but those modifying mock arrays might need adjustment or become Firestore specific) ---

// getWaitlistPosition might need to fetch allBookings from Firestore if not already available.
// For now, assuming allBookings is passed from a component that has fetched it.
export function getWaitlistPosition(booking: Booking, allBookings: Booking[]): number | null {
  if (booking.status !== 'Waitlisted' || !booking.createdAt) {
    return null;
  }
  const conflictingWaitlistedBookings = allBookings.filter(b =>
    b.resourceId === booking.resourceId &&
    b.status === 'Waitlisted' &&
    b.createdAt &&
    (new Date(b.startTime) < new Date(booking.endTime) && new Date(b.endTime) > new Date(booking.startTime))
  );
  const sortedWaitlist = conflictingWaitlistedBookings
    .filter(b => b.createdAt)
    .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());
  const positionIndex = sortedWaitlist.findIndex(b => b.id === booking.id);
  return positionIndex !== -1 ? positionIndex + 1 : null;
}

// processQueueForResource will need significant refactoring to work with Firestore.
// This function currently directly modifies initialBookings.
// For this step, we will comment it out. We'll address queue processing with Firestore later.
/*
export function processQueueForResource(resourceId: string): void {
  const resource = allAdminMockResources.find(r => r.id === resourceId);
  if (!resource || !resource.allowQueueing) {
    return;
  }

  const waitlistedBookingsForResource = initialBookings
    .filter(b => b.resourceId === resourceId && b.status === 'Waitlisted' && b.createdAt)
    .sort((a, b) => new Date(a.createdAt!).getTime() - new Date(b.createdAt!).getTime());

  if (waitlistedBookingsForResource.length > 0) {
    const bookingToPromote = waitlistedBookingsForResource[0];
    const bookingIndexInGlobal = initialBookings.findIndex(b => b.id === bookingToPromote.id);

    if (bookingIndexInGlobal !== -1) {
      const promoteStartTime = new Date(bookingToPromote.startTime);
      const promoteEndTime = new Date(bookingToPromote.endTime);

      const conflictingActiveBooking = initialBookings.find(existingBooking => {
        if (existingBooking.id === bookingToPromote.id) return false;
        if (existingBooking.resourceId !== resourceId) return false;
        if (existingBooking.status === 'Cancelled' || existingBooking.status === 'Waitlisted') return false;
        
        const existingStartTime = new Date(existingBooking.startTime);
        const existingEndTime = new Date(existingBooking.endTime);
        return (promoteStartTime < existingEndTime && promoteEndTime > existingStartTime);
      });

      if (conflictingActiveBooking) {
        console.log(`QUEUE_PROCESS: Cannot promote booking ${bookingToPromote.id}. Slot still blocked by active booking ${conflictingActiveBooking.id}.`);
        return; 
      }

      initialBookings[bookingIndexInGlobal].status = 'Pending';
      
      addAuditLog(
        'SYSTEM_QUEUE', // Or a specific system user ID
        'System',
        'BOOKING_PROMOTED',
        { entityType: 'Booking', entityId: bookingToPromote.id, details: `Booking for '${bookingToPromote.resourceName}' by ${bookingToPromote.userName} promoted from waitlist to Pending.` }
      );
      addNotification(
        bookingToPromote.userId,
        'Promoted from Waitlist!',
        `Your waitlisted booking for ${bookingToPromote.resourceName} on ${format(promoteStartTime, 'MMM dd, HH:mm')} has been promoted and is now pending approval. Please check your bookings.`,
        'booking_promoted_user',
        `/bookings?bookingId=${bookingToPromote.id}`
      );

      const adminUser = initialMockUsers.find(u => u.role === 'Admin' || u.role === 'Lab Manager');
      if(adminUser){
        addNotification(
            adminUser.id,
            'Booking Promoted from Waitlist',
            `Waitlisted booking for ${bookingToPromote.resourceName} by ${bookingToPromote.userName} on ${format(promoteStartTime, 'MMM dd, HH:mm')} has been promoted to Pending and requires your approval.`,
            'booking_promoted_admin',
            '/admin/booking-requests'
        );
      }
    }
  }
}
*/

// The following variables related to specific mock user IDs are no longer needed
// as users come from Firebase.
// export const mockAdminUserId = 'u1';
// export const mockManagerUserId = 'u2';
// export const mockTechnicianUserId = 'u3';
// export const mockResearcherUserId = 'u4';
// export const mockCurrentUser: User = initialMockUsers[3]; // Default to Researcher

// Note: `mockLoginUser`, `mockSignupUser`, `mockApproveSignup`, `mockRejectSignup`
// were removed because AuthContext now handles Firebase Auth directly.
// Their logic for adding to pendingSignups or initialMockUsers is now part of AuthContext or
// will be handled by Firestore operations.
