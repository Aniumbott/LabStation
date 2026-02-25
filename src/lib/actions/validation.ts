import { z } from 'zod';

// --- Booking ---

export const CreateBookingSchema = z.object({
  callerUserId: z.string().min(1, 'Caller user ID is required.'),
  resourceId: z.string().min(1, 'Resource ID is required.'),
  userId: z.string().min(1, 'User ID is required.'),
  startTime: z.string().datetime({ message: 'Invalid start time.' }),
  endTime: z.string().datetime({ message: 'Invalid end time.' }),
  notes: z.string().max(1000).optional(),
});

export const UpdateBookingSchema = z.object({
  callerUserId: z.string().min(1),
  bookingId: z.string().min(1),
  status: z.enum(['Confirmed', 'Pending', 'Waitlisted', 'Cancelled']).optional(),
  notes: z.string().max(1000).optional(),
  resourceId: z.string().min(1).optional(),
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
});

export const CancelBookingSchema = z.object({
  callerUserId: z.string().min(1),
  bookingId: z.string().min(1),
});

export const ApproveRejectBookingSchema = z.object({
  callerUserId: z.string().min(1),
  bookingId: z.string().min(1),
});

// --- User ---

export const CreateUserProfileSchema = z.object({
  callerUserId: z.string().min(1),
  name: z.string().min(2).max(100),
  email: z.string().email(),
  role: z.enum(['Admin', 'Technician', 'Researcher']),
});

export const ApproveUserSchema = z.object({
  callerUserId: z.string().min(1),
  targetUserId: z.string().min(1),
});

export const RejectUserSchema = z.object({
  callerUserId: z.string().min(1),
  targetUserId: z.string().min(1),
});

export const DeleteUserSchema = z.object({
  callerUserId: z.string().min(1),
  targetUserId: z.string().min(1),
});

export const UpdateUserRoleSchema = z.object({
  callerUserId: z.string().min(1),
  targetUserId: z.string().min(1),
  role: z.enum(['Admin', 'Technician', 'Researcher']),
});

export const UpdateUserProfileSchema = z.object({
  callerUserId: z.string().min(1),
  targetUserId: z.string().min(1),
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['Admin', 'Technician', 'Researcher']).optional(),
  avatarUrl: z.string().optional(),
});

// --- Resource ---

export const CreateResourceSchema = z.object({
  callerUserId: z.string().min(1),
  name: z.string().min(1).max(200),
  resourceTypeId: z.string().min(1),
  labId: z.string(),
  status: z.enum(['Working', 'Maintenance', 'Broken']),
  description: z.string().optional(),
  imageUrl: z.string().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  purchaseDate: z.string().nullable().optional(),
  notes: z.string().optional(),
  features: z.array(z.string()).optional(),
  allowQueueing: z.boolean().optional(),
  remoteAccess: z.object({
    ipAddress: z.string().optional(),
    hostname: z.string().optional(),
    protocol: z.enum(['RDP', 'SSH', 'VNC', 'Other', '']).optional(),
    username: z.string().optional(),
    port: z.number().nullable().optional(),
    notes: z.string().optional(),
  }).nullable().optional(),
});

export const UpdateResourceSchema = CreateResourceSchema.partial().extend({
  callerUserId: z.string().min(1),
  resourceId: z.string().min(1),
});

export const DeleteResourceSchema = z.object({
  callerUserId: z.string().min(1),
  resourceId: z.string().min(1),
});

export const UpdateResourceUnavailabilitySchema = z.object({
  callerUserId: z.string().min(1),
  resourceId: z.string().min(1),
  periods: z.array(z.object({
    id: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    reason: z.string().optional(),
  })),
});

// --- Resource Type ---

export const CreateResourceTypeSchema = z.object({
  callerUserId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const UpdateResourceTypeSchema = z.object({
  callerUserId: z.string().min(1),
  typeId: z.string().min(1),
  name: z.string().min(1).max(100),
  description: z.string().optional(),
});

export const DeleteResourceTypeSchema = z.object({
  callerUserId: z.string().min(1),
  typeId: z.string().min(1),
});

// --- Lab ---

export const CreateLabSchema = z.object({
  callerUserId: z.string().min(1),
  name: z.string().min(1).max(100),
  location: z.string().optional(),
  description: z.string().optional(),
});

export const UpdateLabSchema = z.object({
  callerUserId: z.string().min(1),
  labId: z.string().min(1),
  name: z.string().min(1).max(100).optional(),
  location: z.string().optional(),
  description: z.string().optional(),
});

export const DeleteLabSchema = z.object({
  callerUserId: z.string().min(1),
  labId: z.string().min(1),
});

// --- Blackout Dates ---

export const CreateBlackoutDateSchema = z.object({
  callerUserId: z.string().min(1),
  labId: z.string().nullable().optional(),
  date: z.string().min(1),
  reason: z.string().optional(),
});

export const DeleteBlackoutDateSchema = z.object({
  callerUserId: z.string().min(1),
  blackoutDateId: z.string().min(1),
});

// --- Recurring Blackout Rules ---

export const CreateRecurringRuleSchema = z.object({
  callerUserId: z.string().min(1),
  labId: z.string().nullable().optional(),
  name: z.string().min(1).max(100),
  daysOfWeek: z.array(z.enum(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])).min(1),
  reason: z.string().optional(),
});

export const DeleteRecurringRuleSchema = z.object({
  callerUserId: z.string().min(1),
  ruleId: z.string().min(1),
});

// --- Maintenance Requests ---

export const CreateMaintenanceRequestSchema = z.object({
  callerUserId: z.string().min(1),
  resourceId: z.string().min(1),
  issueDescription: z.string().min(1),
  assignedTechnicianId: z.string().nullable().optional(),
});

export const UpdateMaintenanceRequestSchema = z.object({
  callerUserId: z.string().min(1),
  requestId: z.string().min(1),
  status: z.enum(['Open', 'In Progress', 'Resolved', 'Closed']).optional(),
  assignedTechnicianId: z.string().nullable().optional(),
  resolutionNotes: z.string().optional(),
});

// --- Notification ---

export const NotificationActionSchema = z.object({
  callerUserId: z.string().min(1),
  notificationId: z.string().min(1),
});

export const BulkNotificationActionSchema = z.object({
  callerUserId: z.string().min(1),
});

// --- Auth ---

export const ChangePasswordSchema = z.object({
  callerUserId: z.string().min(1),
  currentPassword: z.string().min(1, 'Current password is required.'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters.'),
});
