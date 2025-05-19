
export interface ResourceType {
  id: string;
  name: string;
  description?: string;
}

export type ResourceStatus = 'Available' | 'Booked' | 'Maintenance';

export interface RemoteAccessDetails {
  ipAddress?: string;
  hostname?: string;
  protocol?: 'RDP' | 'SSH' | 'VNC' | 'Other';
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
  resourceTypeName: string;
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
  purchaseDate?: string; // ISO string
  notes?: string;
  remoteAccess?: RemoteAccessDetails;
}

export interface BookingUsageDetails {
  actualStartTime?: string; // ISO string
  actualEndTime?: string;   // ISO string
  outcome?: 'Success' | 'Failure' | 'Interrupted' | 'Not Applicable';
  dataStorageLocation?: string;
  usageComments?: string;
}
export const BookingUsageOutcomes: Array<BookingUsageDetails['outcome']> = ['Success', 'Failure', 'Interrupted', 'Not Applicable'];


export interface Booking {
  id:string;
  resourceId: string;
  resourceName: string;
  userId: string;
  userName: string;
  startTime: Date;
  endTime: Date;
  status: 'Confirmed' | 'Pending' | 'Cancelled';
  notes?: string;
  usageDetails?: BookingUsageDetails;
}

export type RoleName = 'Admin' | 'Lab Manager' | 'Technician' | 'Researcher';

export interface User {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  avatarUrl?: string;
}

export type MaintenanceRequestStatus = 'Open' | 'In Progress' | 'Resolved' | 'Closed';

export interface MaintenanceRequest {
  id: string;
  resourceId: string;
  resourceName: string;
  reportedByUserId: string;
  reportedByUserName: string;
  issueDescription: string;
  status: MaintenanceRequestStatus;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string; // Denormalized
  dateReported: string; // ISO string
  dateResolved?: string; // ISO string
  resolutionNotes?: string;
}

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_pending_approval'
  | 'booking_rejected'
  | 'maintenance_new'
  | 'maintenance_assigned'
  | 'maintenance_resolved';

export interface Notification {
  id: string;
  userId: string; // For whom the notification is
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string; // ISO string
  linkTo?: string; // Optional link for action, e.g., to view the specific booking
}

export interface BlackoutDate {
  id: string;
  date: string; // YYYY-MM-DD format
  reason?: string;
}
