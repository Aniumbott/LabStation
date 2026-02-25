'use server';

import { prisma } from '@/lib/prisma';
import { verifyUserRole } from './helpers';
import { CreateBookingSchema, CancelBookingSchema, ApproveRejectBookingSchema, UpdateBookingSchema } from './validation';
import { addAuditLog, addNotification, processWaitlistForResource } from '@/lib/db-helpers';

/**
 * Creates a booking using a Prisma transaction for atomic conflict detection.
 * Fixes C-03: Race condition in booking conflict detection.
 */
export async function createBookingTransactional_SA(input: {
  callerUserId: string;
  resourceId: string;
  userId: string;
  startTime: string; // ISO datetime
  endTime: string;   // ISO datetime
  notes?: string;
}): Promise<{ success: boolean; bookingId?: string; status?: 'Pending' | 'Waitlisted'; message?: string }> {
  const parsed = CreateBookingSchema.parse(input);

  // Verify caller is an active user
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin', 'Technician', 'Researcher']);

  // If creating for another user, only Admins can do that
  if (parsed.callerUserId !== parsed.userId) {
    await verifyUserRole(parsed.callerUserId, ['Admin']);
  }

  const startDate = new Date(parsed.startTime);
  const endDate = new Date(parsed.endTime);

  if (startDate >= endDate) {
    return { success: false, message: 'End time must be after start time.' };
  }

  // Get resource to check allowQueueing and status
  const resource = await prisma.resource.findUnique({
    where: { id: parsed.resourceId },
  });
  if (!resource) {
    return { success: false, message: 'Resource not found.' };
  }
  if (resource.status !== 'Working') {
    return { success: false, message: 'Resource is not available for booking.' };
  }

  try {
    // TRANSACTION: atomically check for conflicts and create the booking
    const result = await prisma.$transaction(async (tx) => {
      // Query for conflicting bookings within the transaction
      const conflicts = await tx.booking.findMany({
        where: {
          resourceId: parsed.resourceId,
          status: { in: ['Confirmed', 'Pending'] },
          startTime: { lt: endDate },
          endTime: { gt: startDate },
        },
      });

      const hasConflict = conflicts.length > 0;

      let finalStatus: 'Pending' | 'Waitlisted' = 'Pending';

      if (hasConflict) {
        if (resource.allowQueueing) {
          finalStatus = 'Waitlisted';
        } else {
          throw new Error('CONFLICT');
        }
      }

      // Create the booking within the same transaction
      const newBooking = await tx.booking.create({
        data: {
          resourceId: parsed.resourceId,
          userId: parsed.userId,
          startTime: startDate,
          endTime: endDate,
          status: finalStatus,
          notes: parsed.notes || '',
        },
      });

      return { bookingId: newBooking.id, status: finalStatus };
    }, {
      isolationLevel: 'Serializable',
    });

    // After transaction succeeds, audit + notifications (outside transaction)
    const auditAction = result.status === 'Waitlisted' ? 'BOOKING_WAITLISTED' : 'BOOKING_CREATED';
    let auditDetails = `Booking for resource ${parsed.resourceId} created by ${caller.name}. Status: ${result.status}.`;
    if (parsed.callerUserId !== parsed.userId) {
      auditDetails = `Booking for resource ${parsed.resourceId} for user ${parsed.userId} created by Admin ${caller.name}. Status: ${result.status}.`;
    }

    try {
      await addAuditLog(parsed.callerUserId, caller.name, auditAction as any, {
        entityType: 'Booking',
        entityId: result.bookingId,
        details: auditDetails,
      });
    } catch {
      // Audit failure shouldn't block booking creation
    }

    return { success: true, bookingId: result.bookingId, status: result.status };
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'CONFLICT') {
      return { success: false, message: 'Resource is already booked for this time slot and queueing is not enabled.' };
    }
    console.error('[createBookingTransactional_SA] Error:', error);
    return { success: false, message: 'Failed to create booking.' };
  }
}

/**
 * Updates a booking with server-side authorization.
 * Fixes C-04: Missing authorization on booking mutations.
 */
export async function updateBooking_SA(input: {
  callerUserId: string;
  bookingId: string;
  status?: 'Confirmed' | 'Pending' | 'Waitlisted' | 'Cancelled';
  notes?: string;
  resourceId?: string;
  startTime?: string;
  endTime?: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = UpdateBookingSchema.parse(input);

  // Get the booking to verify ownership
  const booking = await prisma.booking.findUnique({
    where: { id: parsed.bookingId },
  });
  if (!booking) {
    return { success: false, message: 'Booking not found.' };
  }

  // Verify caller role
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin', 'Technician', 'Researcher']);

  // Authorization rules
  if (caller.role === 'Researcher') {
    if (booking.userId !== parsed.callerUserId) {
      return { success: false, message: 'You can only modify your own bookings.' };
    }
    if (parsed.status && parsed.status !== 'Cancelled') {
      return { success: false, message: 'You can only cancel bookings, not change their status.' };
    }
  }

  if (caller.role === 'Technician') {
    if (booking.userId !== parsed.callerUserId && parsed.status && parsed.status !== 'Cancelled') {
      return { success: false, message: 'Technicians can only cancel bookings for other users.' };
    }
  }

  // Only admins can confirm bookings
  if (parsed.status === 'Confirmed' && caller.role !== 'Admin') {
    return { success: false, message: 'Only admins can confirm bookings.' };
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (parsed.status !== undefined) updateData.status = parsed.status;
    if (parsed.notes !== undefined) updateData.notes = parsed.notes;
    if (parsed.resourceId !== undefined) updateData.resourceId = parsed.resourceId;
    if (parsed.startTime !== undefined) updateData.startTime = new Date(parsed.startTime);
    if (parsed.endTime !== undefined) updateData.endTime = new Date(parsed.endTime);

    if (Object.keys(updateData).length === 0) {
      return { success: false, message: 'No changes provided.' };
    }

    await prisma.booking.update({
      where: { id: parsed.bookingId },
      data: updateData,
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'BOOKING_UPDATED', {
        entityType: 'Booking',
        entityId: parsed.bookingId,
        details: `Booking updated by ${caller.name}.${parsed.status ? ' Status: ' + parsed.status + '.' : ''}`,
      });
    } catch {
      // Audit failure shouldn't block update
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('[updateBooking_SA] Error:', error);
    return { success: false, message: 'Failed to update booking.' };
  }
}

/**
 * Cancels a booking with ownership verification.
 */
export async function cancelBooking_SA(input: {
  callerUserId: string;
  bookingId: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = CancelBookingSchema.parse(input);

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.bookingId },
  });
  if (!booking) {
    return { success: false, message: 'Booking not found.' };
  }

  const caller = await verifyUserRole(parsed.callerUserId, ['Admin', 'Technician', 'Researcher']);

  // Ownership check: only owner or Admin can cancel
  if (caller.role !== 'Admin' && booking.userId !== parsed.callerUserId) {
    return { success: false, message: 'You can only cancel your own bookings.' };
  }

  if (booking.status === 'Cancelled') {
    return { success: false, message: 'Booking is already cancelled.' };
  }

  const originalStatus = booking.status;
  const resourceId = booking.resourceId;

  try {
    await prisma.booking.update({
      where: { id: parsed.bookingId },
      data: { status: 'Cancelled' },
    });

    // Get resource name for notifications
    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });
    const resourceName = resource?.name || 'Resource';

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'BOOKING_CANCELLED', {
        entityType: 'Booking',
        entityId: parsed.bookingId,
        details: `Booking for ${resourceName} cancelled by ${caller.name}. Previous status: ${originalStatus}.`,
      });
    } catch { /* audit failure ok */ }

    // If it was Confirmed, process waitlist
    if (originalStatus === 'Confirmed') {
      const startTime = booking.startTime;
      const endTime = booking.endTime;
      try {
        await processWaitlistForResource(resourceId, startTime, endTime, 'user_cancel_confirmed');
      } catch { /* waitlist processing failure ok */ }
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('[cancelBooking_SA] Error:', error);
    return { success: false, message: 'Failed to cancel booking.' };
  }
}

/**
 * Approves a booking (Admin only).
 */
export async function approveBooking_SA(input: {
  callerUserId: string;
  bookingId: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = ApproveRejectBookingSchema.parse(input);

  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.bookingId },
  });
  if (!booking) {
    return { success: false, message: 'Booking not found.' };
  }

  if (booking.status !== 'Pending') {
    return { success: false, message: `Cannot approve a booking with status '${booking.status}'.` };
  }

  try {
    await prisma.booking.update({
      where: { id: parsed.bookingId },
      data: { status: 'Confirmed' },
    });

    const resource = await prisma.resource.findUnique({
      where: { id: booking.resourceId },
    });
    const resourceName = resource?.name || 'Resource';

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'BOOKING_APPROVED', {
        entityType: 'Booking',
        entityId: parsed.bookingId,
        details: `Booking for ${resourceName} approved by ${caller.name}.`,
      });
    } catch { /* ok */ }

    try {
      await addNotification(
        booking.userId,
        'Booking Approved!',
        `Your booking for ${resourceName} has been approved.`,
        'booking_confirmed',
        `/bookings?bookingId=${parsed.bookingId}`
      );
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[approveBooking_SA] Error:', error);
    return { success: false, message: 'Failed to approve booking.' };
  }
}

/**
 * Rejects a booking (Admin only).
 */
export async function rejectBooking_SA(input: {
  callerUserId: string;
  bookingId: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = ApproveRejectBookingSchema.parse(input);

  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const booking = await prisma.booking.findUnique({
    where: { id: parsed.bookingId },
  });
  if (!booking) {
    return { success: false, message: 'Booking not found.' };
  }

  if (booking.status === 'Cancelled' || booking.status === 'Confirmed') {
    return { success: false, message: `Cannot reject a booking with status '${booking.status}'.` };
  }

  try {
    await prisma.booking.update({
      where: { id: parsed.bookingId },
      data: { status: 'Cancelled' },
    });

    const resource = await prisma.resource.findUnique({
      where: { id: booking.resourceId },
    });
    const resourceName = resource?.name || 'Resource';

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'BOOKING_REJECTED', {
        entityType: 'Booking',
        entityId: parsed.bookingId,
        details: `Booking for ${resourceName} rejected by ${caller.name}.`,
      });
    } catch { /* ok */ }

    try {
      await addNotification(
        booking.userId,
        'Booking Rejected',
        `Your booking for ${resourceName} has been rejected.`,
        'booking_rejected',
        `/bookings?bookingId=${parsed.bookingId}`
      );
    } catch { /* ok */ }

    // Process waitlist after rejection
    const startTime = booking.startTime;
    const endTime = booking.endTime;
    try {
      await processWaitlistForResource(booking.resourceId, startTime, endTime, 'admin_reject');
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[rejectBooking_SA] Error:', error);
    return { success: false, message: 'Failed to reject booking.' };
  }
}

/**
 * Logs usage details for a completed booking.
 */
export async function logBookingUsage_SA(input: {
  callerUserId: string;
  bookingId: string;
  usageDetails: {
    actualStartTime?: string;
    actualEndTime?: string;
    outcome?: 'Success' | 'Failure' | 'Interrupted' | 'Not Applicable';
    dataStorageLocation?: string;
    usageComments?: string;
  };
}): Promise<{ success: boolean; message?: string }> {
  if (!input.callerUserId || !input.bookingId) {
    return { success: false, message: 'Missing required fields.' };
  }

  const booking = await prisma.booking.findUnique({
    where: { id: input.bookingId },
  });
  if (!booking) {
    return { success: false, message: 'Booking not found.' };
  }

  const caller = await verifyUserRole(input.callerUserId, ['Admin', 'Technician', 'Researcher']);

  // Only owner or admin can log usage
  if (caller.role !== 'Admin' && booking.userId !== input.callerUserId) {
    return { success: false, message: 'You can only log usage for your own bookings.' };
  }

  try {
    await prisma.booking.update({
      where: { id: input.bookingId },
      data: { usageDetails: JSON.stringify(input.usageDetails) },
    });

    try {
      await addAuditLog(input.callerUserId, caller.name, 'BOOKING_UPDATED', {
        entityType: 'Booking',
        entityId: input.bookingId,
        details: `Usage logged for booking by ${caller.name}. Outcome: ${input.usageDetails.outcome || 'N/A'}.`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[logBookingUsage_SA] Error:', error);
    return { success: false, message: 'Failed to log usage.' };
  }
}
