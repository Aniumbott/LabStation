
import type { RoleName, MaintenanceRequestStatus, ResourceStatus, Booking, Resource } from '@/types';

export const userRolesList: RoleName[] = ['Admin', 'Technician', 'Researcher']; // Removed 'Lab Manager'
export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const labsList: Resource['lab'][] = ['Electronics Lab 1', 'RF Lab', 'Prototyping Lab', 'General Test Area'];
export const resourceStatusesList: ResourceStatus[] = ['Working', 'Maintenance', 'Broken'];
export const bookingStatusesForFilter: (Booking['status'] | 'all')[] = ['all', 'Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const bookingStatusesForForm: Booking['status'][] = ['Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
