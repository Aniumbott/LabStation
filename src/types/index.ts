
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
  port?: number;
  notes?: string;
}

export interface AvailabilitySlot {
  date: string; // YYYY-MM-DD
  slots: string[]; // e.g., ["09:00-12:00", "13:00-17:00"]
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
  description: string;
  imageUrl: string;
  features?: string[];
  availability?: AvailabilitySlot[];
  unavailabilityPeriods?: UnavailabilityPeriod[];
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: Date; // Changed from string to Date for frontend model
  notes?: string;
  remoteAccess?: RemoteAccessDetails;
  allowQueueing?: boolean;
}

export interface BookingUsageDetails {
  actualStartTime?: Date; // Changed from string to Date
  actualEndTime?: Date;   // Changed from string to Date
  outcome?: 'Success' | 'Failure' | 'Interrupted' | 'Not Applicable';
  dataStorageLocation?: string;
  usageComments?: string;
}
export const BookingUsageOutcomes: Array<BookingUsageDetails['outcome']> = ['Success', 'Failure', 'Interrupted', 'Not Applicable'];


export interface Booking {
  id: string;
  resourceId: string;
  userId: string;
  startTime: Date; // JS Date object
  endTime: Date;   // JS Date object
  createdAt: Date; // JS Date object
  status: 'Confirmed' | 'Pending' | 'Cancelled' | 'Waitlisted';
  notes?: string;
  usageDetails?: BookingUsageDetails;
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
  createdAt: Date; // Changed from string to Date
}

export type MaintenanceRequestStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface MaintenanceRequest {
  id: string;
  resourceId: string;
  reportedByUserId: string;
  issueDescription: string;
  status: MaintenanceRequestStatus;
  assignedTechnicianId?: string;
  dateReported: Date; // Changed from string to Date
  dateResolved?: Date; // Changed from string to Date
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
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string; // Keep as ISO string for display, source is Firestore Timestamp
  linkTo?: string;
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
  id: string;
  timestamp: string; // Keep as ISO string for display, source is Firestore Timestamp
  userId: string;
  userName: string;
  action: AuditActionType;
  entityType?: 'User' | 'Resource' | 'Booking' | 'MaintenanceRequest' | 'ResourceType' | 'BlackoutDate' | 'RecurringBlackoutRule';
  entityId?: string;
  details: string;
}
