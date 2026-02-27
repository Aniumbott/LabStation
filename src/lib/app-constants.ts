
import type { RoleName, MaintenanceRequestStatus, ResourceStatus, Booking } from '@/types';

export const userRolesList: RoleName[] = ['Admin', 'Technician', 'Researcher'];
export const maintenanceRequestStatuses: MaintenanceRequestStatus[] = ['Open', 'In Progress', 'Resolved', 'Closed'];
export const resourceStatusesList: ResourceStatus[] = ['Working', 'Maintenance', 'Broken'];
export const bookingStatusesForFilter: (Booking['status'] | 'all')[] = ['all', 'Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];
export const bookingStatusesForForm: Booking['status'][] = ['Confirmed', 'Pending', 'Waitlisted', 'Cancelled'];

export const PLACEHOLDER_IMAGE = 'https://placehold.co/600x400.png';
export const PLACEHOLDER_AVATAR = 'https://placehold.co/100x100.png';
