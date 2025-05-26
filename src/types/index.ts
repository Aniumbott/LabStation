
import type { Timestamp } from 'firebase/firestore';

export interface ResourceType {
  id: string;
  name: string;
  description?: string;
}

export type ResourceStatus = 'Available' | 'Booked' | 'Maintenance';

export interface RemoteAccessDetails {
  ipAddress?: string;
  hostname?: string;
  protocol?: 'RDP' | 'SSH' | 'VNC' | 'Other' | '';
  username?: string;
  port?: number | null;
  notes?: string;
}

export interface UnavailabilityPeriod {
  id: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
  reason?: string;
}

export interface Resource {
  id: string;
  name: string;
  resourceTypeId: string;
  lab: 'Electronics Lab 1' | 'RF Lab' | 'Prototyping Lab' | 'General Test Area';
  status: ResourceStatus;
  description?: string;
  imageUrl?: string;
  features?: string[];
  unavailabilityPeriods?: UnavailabilityPeriod[];
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: Date | null;
  notes?: string;
  remoteAccess?: RemoteAccessDetails | null;
  allowQueueing?: boolean;
  lastUpdatedAt?: Date;
  createdAt?: Date;
}

export interface BookingUsageDetails {
  actualStartTime?: string | undefined; // Stored as ISO string
  actualEndTime?: string | undefined;   // Stored as ISO string
  outcome?: 'Success' | 'Failure' | 'Interrupted' | 'Not Applicable';
  dataStorageLocation?: string | undefined;
  usageComments?: string | undefined;
}
export const BookingUsageOutcomes: Array<BookingUsageDetails['outcome']> = ['Success', 'Failure', 'Interrupted', 'Not Applicable'];


export interface Booking {
  id: string;
  resourceId: string;
  userId: string;
  startTime: Date;
  endTime: Date;
  createdAt: Date;
  status: 'Confirmed' | 'Pending' | 'Cancelled' | 'Waitlisted';
  notes?: string;
  usageDetails?: BookingUsageDetails | null;
}

export type RoleName = 'Admin' | 'Lab Manager' | 'Technician' | 'Researcher';

export type UserStatus = 'active' | 'pending_approval' | 'suspended';

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  avatarUrl?: string;
  status: UserStatus;
  createdAt: Date;
}

export type MaintenanceRequestStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface MaintenanceRequest {
  id: string;
  resourceId: string;
  reportedByUserId: string;
  issueDescription: string;
  status: MaintenanceRequestStatus;
  assignedTechnicianId?: string | null;
  dateReported: Date;
  dateResolved?: Date | null;
  resolutionNotes?: string | null;
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
  id: string; // Will be Firestore generated ID when fetched
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Date; // Converted from Firestore Timestamp on fetch
  linkTo?: string | null; // Allow null for Firestore compatibility
}

export interface BlackoutDate {
  id: string;
  date: string; // YYYY-MM-DD format
  reason?: string;
}

export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export const daysOfWeekArray: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


export interface RecurringBlackoutRule {
  id: string;
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
  id: string; // Will be Firestore generated ID when fetched
  timestamp: Date; // Converted from Firestore Timestamp on fetch
  userId: string;
  userName: string;
  action: AuditActionType;
  entityType?: 'User' | 'Resource' | 'Booking' | 'MaintenanceRequest' | 'ResourceType' | 'BlackoutDate' | 'RecurringBlackoutRule' | null;
  entityId?: string | null;
  details: string;
}
