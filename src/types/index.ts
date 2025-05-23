
export interface ResourceType {
  id: string; // Firestore document ID
  name: string;
  description?: string;
}

export type ResourceStatus = 'Available' | 'Booked' | 'Maintenance';

export interface RemoteAccessDetails {
  ipAddress?: string;
  hostname?: string;
  protocol?: 'RDP' | 'SSH' | 'VNC' | 'Other' | '';
  username?: string;
  port?: number;
  notes?: string;
}

export interface AvailabilitySlot {
  date: string; // YYYY-MM-DD
  slots: string[]; // e.g., ["09:00-12:00", "13:00-17:00"]
}

export interface UnavailabilityPeriod {
  id: string; // Can be a sub-collection or just an ID within the array
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason?: string;
}

export interface Resource {
  id: string; // Firestore document ID
  name: string;
  resourceTypeId: string; // ID of document in 'resourceTypes' collection
  // resourceTypeName: string; // REMOVED - Fetch from ResourceType
  lab: 'Electronics Lab 1' | 'RF Lab' | 'Prototyping Lab' | 'General Test Area';
  status: ResourceStatus;
  description: string;
  imageUrl: string;
  features?: string[];
  availability?: AvailabilitySlot[];
  unavailabilityPeriods?: UnavailabilityPeriod[];
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string; // Firestore Timestamp (store as ISO string if not directly using Timestamp type in frontend model)
  notes?: string;
  remoteAccess?: RemoteAccessDetails;
  allowQueueing?: boolean;
}

export interface BookingUsageDetails {
  actualStartTime?: string; // Firestore Timestamp (ISO string)
  actualEndTime?: string;   // Firestore Timestamp (ISO string)
  outcome?: 'Success' | 'Failure' | 'Interrupted' | 'Not Applicable';
  dataStorageLocation?: string;
  usageComments?: string;
}
export const BookingUsageOutcomes: Array<BookingUsageDetails['outcome'] | undefined> = ['Success', 'Failure', 'Interrupted', 'Not Applicable', undefined];


export interface Booking {
  id: string; // Firestore document ID
  resourceId: string; // ID of document in 'resources' collection
  // resourceName: string; // REMOVED - Fetch from Resource
  userId: string; // Firebase Auth UID of the user
  // userName: string; // REMOVED - Fetch from User
  startTime: Date; // Or string (ISO) then convert. For Firestore, use Timestamp.
  endTime: Date;   // Or string (ISO)
  createdAt: Date; // Or string (ISO)
  status: 'Confirmed' | 'Pending' | 'Cancelled' | 'Waitlisted';
  notes?: string;
  usageDetails?: BookingUsageDetails;
}

export type RoleName = 'Admin' | 'Lab Manager' | 'Technician' | 'Researcher';
export type UserStatus = 'active' | 'pending_approval' | 'suspended';

export interface User {
  id: string; // Firebase Auth UID, also Firestore document ID
  name: string;
  email: string;
  role: RoleName;
  avatarUrl?: string;
  status: UserStatus;
  createdAt?: string; // Firestore Timestamp (ISO string)
}

export type MaintenanceRequestStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface MaintenanceRequest {
  id: string; // Firestore document ID
  resourceId: string; // ID of document in 'resources' collection
  // resourceName: string; // REMOVED - Fetch from Resource
  reportedByUserId: string; // Firebase Auth UID
  // reportedByUserName: string; // REMOVED - Fetch from User
  issueDescription: string;
  status: MaintenanceRequestStatus;
  assignedTechnicianId?: string; // Firebase Auth UID
  // assignedTechnicianName?: string; // REMOVED - Fetch from User (Technician)
  dateReported: string; // Firestore Timestamp (ISO string)
  dateResolved?: string; // Firestore Timestamp (ISO string)
  resolutionNotes?: string;
}

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_pending_approval'
  | 'booking_rejected'
  | 'booking_waitlisted'
  | 'booking_promoted_user'
  | 'booking_promoted_admin'
  | 'maintenance_new'
  | 'maintenance_assigned'
  | 'maintenance_resolved'
  | 'signup_approved'
  | 'signup_pending_admin';

export interface Notification {
  id: string; // Firestore document ID
  userId: string; // Firebase Auth UID of the recipient
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string; // Firestore Timestamp (ISO string)
  linkTo?: string;
}

export interface BlackoutDate {
  id: string; // Firestore document ID (or use date as ID if unique)
  date: string; // YYYY-MM-DD format
  reason?: string;
}

export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export const daysOfWeekArray: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


export interface RecurringBlackoutRule {
  id: string; // Firestore document ID
  name: string;
  daysOfWeek: DayOfWeek[];
  reason?: string;
}

export type AuditActionType =
  | 'USER_CREATED' | 'USER_UPDATED' | 'USER_DELETED' | 'USER_APPROVED' | 'USER_REJECTED'
  | 'RESOURCE_CREATED' | 'RESOURCE_UPDATED' | 'RESOURCE_DELETED'
  | 'RESOURCE_TYPE_CREATED' | 'RESOURCE_TYPE_UPDATED' | 'RESOURCE_TYPE_DELETED'
  | 'BOOKING_CREATED' | 'BOOKING_UPDATED' | 'BOOKING_APPROVED' | 'BOOKING_REJECTED' | 'BOOKING_CANCELLED' | 'BOOKING_PROMOTED' | 'BOOKING_WAITLISTED'
  | 'MAINTENANCE_CREATED' | 'MAINTENANCE_UPDATED'
  | 'BLACKOUT_DATE_CREATED' | 'BLACKOUT_DATE_UPDATED' | 'BLACKOUT_DATE_DELETED'
  | 'RECURRING_RULE_CREATED' | 'RECURRING_RULE_UPDATED' | 'RECURRING_RULE_DELETED';

export interface AuditLogEntry {
  id: string; // Firestore document ID
  timestamp: string; // Firestore Timestamp (ISO string)
  userId: string;    // Firebase Auth UID of acting user
  userName: string;  // Denormalized name of acting user for log readability
  action: AuditActionType;
  entityType?: 'User' | 'Resource' | 'Booking' | 'MaintenanceRequest' | 'ResourceType' | 'BlackoutDate' | 'RecurringBlackoutRule';
  entityId?: string; // Document ID of the affected entity
  details: string;
}
