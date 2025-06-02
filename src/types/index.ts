
import type { Timestamp } from 'firebase/firestore';

export interface ResourceType {
  id: string;
  name: string;
  description?: string;
}

export type ResourceStatus = 'Working' | 'Maintenance' | 'Broken';

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

export interface Lab {
  id: string;
  name: string;
  location?: string;
  description?: string;
  createdAt?: Date;
  lastUpdatedAt?: Date;
}

export interface Resource {
  id: string;
  name: string;
  resourceTypeId: string;
  labId: string;
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
  actualStartTime?: string | undefined;
  actualEndTime?: string | undefined;
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
  resourceName?: string;
  userName?: string;
}

export type RoleName = 'Admin' | 'Technician' | 'Researcher';

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

export type LabMembershipStatus = 'active' | 'pending_approval' | 'rejected' | 'revoked';

export interface LabMembership {
  id?: string;
  userId: string;
  labId: string;
  status: LabMembershipStatus;
  roleInLab?: 'Lead' | 'Member';
  requestedAt?: Timestamp; // Timestamp for when the request was made
  updatedAt?: Timestamp; // Timestamp for last status change (approval, rejection, revocation)
  actingAdminId?: string; // User ID of admin who last changed status
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
  resourceName?: string;
  reportedByUserName?: string;
  assignedTechnicianName?: string;
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
  | 'signup_pending_admin'
  | 'lab_access_request_submitted' // User submitted a request for a lab
  | 'lab_access_request_received'  // Admin received a request for lab access
  | 'lab_access_approved'          // User's lab access request was approved
  | 'lab_access_rejected'          // User's lab access request was rejected
  | 'lab_access_revoked'           // User's lab access was revoked by admin
  | 'lab_access_left';             // User voluntarily left a lab

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: Date;
  linkTo?: string | undefined;
}

export interface BlackoutDate {
  id: string;
  labId?: string | null;
  date: string;
  reason?: string;
}

export type DayOfWeek = 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday';
export const daysOfWeekArray: DayOfWeek[] = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];


export interface RecurringBlackoutRule {
  id: string;
  labId?: string | null;
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
  | 'RECURRING_RULE_CREATED' | 'RECURRING_RULE_UPDATED' | 'RECURRING_RULE_DELETED'
  | 'LAB_CREATED' | 'LAB_UPDATED' | 'LAB_DELETED'
  | 'LAB_MEMBERSHIP_REQUESTED' | 'LAB_MEMBERSHIP_APPROVED' | 'LAB_MEMBERSHIP_REJECTED' | 'LAB_MEMBERSHIP_REVOKED' | 'LAB_MEMBERSHIP_CANCELLED' | 'LAB_MEMBERSHIP_GRANTED' | 'LAB_MEMBERSHIP_LEFT';

export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  userId: string; // User who performed the action OR system if automated
  userName: string; // Name of user or "System"
  action: AuditActionType;
  entityType?: 'User' | 'Resource' | 'Booking' | 'MaintenanceRequest' | 'ResourceType' | 'BlackoutDate' | 'RecurringBlackoutRule' | 'Lab' | 'LabMembership' | undefined;
  entityId?: string | undefined; // ID of the primary entity affected
  secondaryEntityType?: 'User' | 'Lab'; // For lab membership, e.g., User is primary, Lab is secondary or vice versa
  secondaryEntityId?: string;
  details: string;
}
