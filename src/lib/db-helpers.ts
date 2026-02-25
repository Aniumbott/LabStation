'use server';

import { prisma } from '@/lib/prisma';
import type { AuditLogEntry, AuditActionType, NotificationType as AppNotificationType } from '@/types';


export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: AppNotificationType,
  linkToParam?: string | undefined
): Promise<void> {
  const functionName = "addNotification (Prisma)";

  const paramsReceived = { userId, title, message, type, linkToParam };

  if (!userId || !title || !message || !type) {
    const errorMsg = `Missing required parameters for notification. Data: ${JSON.stringify(paramsReceived, null, 2)}`;
    console.error(`!!! CRITICAL ERROR IN ${functionName} !!! ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const finalLinkTo = typeof linkToParam === 'string' && linkToParam.trim() !== '' ? linkToParam.trim() : undefined;

  try {
    await prisma.notification.create({
      data: {
        userId,
        title,
        message,
        type,
        isRead: false,
        linkTo: finalLinkTo,
      },
    });
  } catch (e: any) {
    console.error(`!!! PRISMA ERROR IN ${functionName} !!!`, e.toString());
    console.error(`[${functionName}] Error Message:`, e.message);
    console.error(`[${functionName}] Notification data that failed:`, JSON.stringify(paramsReceived, null, 2));
    throw e;
  }
}


export async function addAuditLog(
  actingUserId: string,
  actingUserName: string,
  action: AuditActionType,
  params: {
    entityType?: AuditLogEntry['entityType'] | undefined;
    entityId?: string | undefined;
    secondaryEntityType?: AuditLogEntry['secondaryEntityType'] | undefined;
    secondaryEntityId?: string | undefined;
    details: string;
  }
): Promise<void> {
  const functionName = "addAuditLog (Prisma)";

  const paramsReceived = { actingUserId, actingUserName, action, params };

  if (!actingUserId || !actingUserName || !action || !params.details) {
    const errorMsg = `Missing required parameters for audit log. Data: ${JSON.stringify(paramsReceived, null, 2)}`;
    console.error(`!!! CRITICAL ERROR IN ${functionName} !!! ${errorMsg}`);
    throw new Error(errorMsg);
  }

  try {
    await prisma.auditLog.create({
      data: {
        userId: actingUserId,
        userName: actingUserName,
        action,
        details: params.details,
        entityType: params.entityType ?? undefined,
        entityId: params.entityId ?? undefined,
        secondaryEntityType: params.secondaryEntityType ?? undefined,
        secondaryEntityId: params.secondaryEntityId ?? undefined,
      },
    });
  } catch (e: any) {
    console.error(`!!! PRISMA ERROR IN ${functionName} !!!`, e.toString());
    console.error(`[${functionName}] Error Message:`, e.message);
    console.error(`[${functionName}] Audit log data that failed:`, JSON.stringify(paramsReceived, null, 2));
    throw e;
  }
}


export async function processWaitlistForResource(
  resourceId: string,
  freedSlotStartTime: Date,
  freedSlotEndTime: Date,
  triggeringAction: 'admin_reject' | 'user_cancel_confirmed'
): Promise<void> {
  const functionName = "processWaitlistForResource (Prisma)";

  try {
    // Get all waitlisted bookings for this resource, ordered by creation time
    const waitlistedBookings = await prisma.booking.findMany({
      where: {
        resourceId,
        status: 'Waitlisted',
      },
      orderBy: { createdAt: 'asc' },
    });

    if (waitlistedBookings.length === 0) {
      return;
    }

    const resource = await prisma.resource.findUnique({
      where: { id: resourceId },
    });
    const resourceName = resource?.name || 'the resource';
    const resourceLabId = resource?.labId || null;

    const freedStart = freedSlotStartTime;
    const freedEnd = freedSlotEndTime;

    for (const waitlistedBooking of waitlistedBookings) {
      const waitlistedStartTime = waitlistedBooking.startTime;
      const waitlistedEndTime = waitlistedBooking.endTime;
      const waitlistedUserId = waitlistedBooking.userId;
      const waitlistedBookingId = waitlistedBooking.id;

      const user = await prisma.user.findUnique({
        where: { id: waitlistedUserId },
      });
      const waitlistedUserName = user?.name || 'Waitlisted User';

      if (waitlistedStartTime >= freedStart && waitlistedEndTime <= freedEnd) {
        // Check for conflicts with confirmed/pending bookings
        const conflicts = await prisma.booking.findMany({
          where: {
            resourceId,
            status: { in: ['Confirmed', 'Pending'] },
            startTime: { lt: waitlistedEndTime },
            endTime: { gt: waitlistedStartTime },
          },
        });

        if (conflicts.length === 0) {
          // Promote the booking from Waitlisted to Pending
          await prisma.booking.update({
            where: { id: waitlistedBookingId },
            data: { status: 'Pending' },
          });

          await addAuditLog(
            'SYSTEM_WAITLIST_PROMOTION',
            'System',
            'BOOKING_PROMOTED',
            {
              entityType: 'Booking',
              entityId: waitlistedBookingId,
              details: `Booking for resource ${resourceName} (ID: ${resourceId}) by user ${waitlistedUserName} (ID: ${waitlistedUserId}) automatically promoted from waitlist to Pending.`
            }
          );

          try {
            await addNotification(
              waitlistedUserId,
              'Booking Promoted from Waitlist!',
              `Your waitlisted booking for ${resourceName} starting at ${waitlistedStartTime.toLocaleTimeString()} on ${waitlistedStartTime.toLocaleDateString()} has been promoted to 'Pending'. It now awaits admin approval.`,
              'booking_promoted_user',
              `/bookings?bookingId=${waitlistedBookingId}`
            );
          } catch (userNotifError) {
            console.warn(`[${functionName}] Failed to send 'promoted_user' notification to ${waitlistedUserId}:`, userNotifError);
          }

          try {
            // Get all admins and technicians
            const allAdminsAndTechs = await prisma.user.findMany({
              where: { role: { in: ['Admin', 'Technician'] } },
              select: { id: true },
            });
            let finalAdminIdsToNotify = allAdminsAndTechs.map(u => u.id);

            if (resourceLabId) {
              const labMemberships = await prisma.labMembership.findMany({
                where: { labId: resourceLabId, status: 'active' },
                select: { userId: true },
              });
              const labMemberUserIds = labMemberships.map(m => m.userId);

              const filtered = finalAdminIdsToNotify.filter(adminId => labMemberUserIds.includes(adminId));
              if (filtered.length > 0) {
                finalAdminIdsToNotify = filtered;
              }
            }

            const adminNotificationPromises = finalAdminIdsToNotify.map(adminId => {
              return addNotification(
                adminId,
                'Booking Promoted - Needs Approval',
                `A waitlisted booking for ${resourceName} by user ${waitlistedUserName} has been promoted to 'Pending' and requires approval.`,
                'booking_promoted_admin',
                `/admin/booking-requests?bookingId=${waitlistedBookingId}`
              );
            });
            await Promise.all(adminNotificationPromises);
          } catch (adminNotifError) {
            console.warn(`[${functionName}] Failed to send 'promoted_admin' notifications:`, adminNotifError);
          }
          return;
        }
      }
    }

  } catch (error: any) {
    console.error(`!!! ERROR IN ${functionName} for resource ${resourceId} !!!`, error.toString());
    if (error.message) console.error(`[${functionName}] Error Message:`, error.message);
  }
}



export async function manageLabMembership_SA(
  adminUserId: string,
  adminUserName: string,
  targetUserId: string,
  targetUserName: string,
  labId: string,
  labName: string,
  action: 'grant' | 'revoke' | 'approve_request' | 'reject_request',
  membershipDocIdToUpdate?: string
): Promise<{ success: boolean; message: string }> {
  const functionName = "manageLabMembership_SA";

  if (!adminUserId || !adminUserName || !targetUserId || !labId || !labName) {
    throw new Error("Missing required parameters for managing lab membership.");
  }

  try {
    // Find existing membership either by ID or by userId+labId
    let existingMembership: { id: string; userId: string; labId: string; status: string } | null = null;
    if (membershipDocIdToUpdate) {
      existingMembership = await prisma.labMembership.findUnique({
        where: { id: membershipDocIdToUpdate },
      });
    } else {
      existingMembership = await prisma.labMembership.findUnique({
        where: { userId_labId: { userId: targetUserId, labId } },
      });
    }

    if (action === 'grant') {
      if (existingMembership) {
        await prisma.labMembership.update({
          where: { id: existingMembership.id },
          data: {
            status: 'active',
            roleInLab: 'Member',
            actingAdminId: adminUserId,
          },
        });
      } else {
        existingMembership = await prisma.labMembership.create({
          data: {
            userId: targetUserId,
            labId,
            status: 'active',
            roleInLab: 'Member',
            actingAdminId: adminUserId,
          },
        });
      }
      await addAuditLog(adminUserId, adminUserName, 'LAB_MEMBERSHIP_GRANTED', {
        entityType: 'LabMembership', entityId: existingMembership!.id, secondaryEntityType: 'User', secondaryEntityId: targetUserId, details: `Admin ${adminUserName} granted user ${targetUserName} access to lab ${labName}.`
      });
      await addNotification(targetUserId, 'Lab Access Granted', `You have been granted access to ${labName}.`, 'lab_access_approved', '/dashboard');
      return { success: true, message: `Access to ${labName} granted for ${targetUserName}.` };

    } else if (action === 'approve_request') {
      if (!membershipDocIdToUpdate || !existingMembership) throw new Error("Membership document ID required for approval.");
      await prisma.labMembership.update({
        where: { id: membershipDocIdToUpdate },
        data: { status: 'active', actingAdminId: adminUserId },
      });
      await addAuditLog(adminUserId, adminUserName, 'LAB_MEMBERSHIP_APPROVED', {
        entityType: 'LabMembership', entityId: membershipDocIdToUpdate, secondaryEntityType: 'User', secondaryEntityId: targetUserId, details: `Admin ${adminUserName} approved lab access request for ${targetUserName} to lab ${labName}.`
      });
      await addNotification(targetUserId, 'Lab Access Approved!', `Your request to access ${labName} has been approved.`, 'lab_access_approved', '/dashboard');
      return { success: true, message: `Lab access request for ${targetUserName} to ${labName} approved.` };

    } else if (action === 'reject_request') {
      if (!membershipDocIdToUpdate || !existingMembership) throw new Error("Membership document ID required for rejection.");
      await prisma.labMembership.update({
        where: { id: membershipDocIdToUpdate },
        data: { status: 'rejected', actingAdminId: adminUserId },
      });
      await addAuditLog(adminUserId, adminUserName, 'LAB_MEMBERSHIP_REJECTED', {
        entityType: 'LabMembership', entityId: membershipDocIdToUpdate, secondaryEntityType: 'User', secondaryEntityId: targetUserId, details: `Admin ${adminUserName} rejected lab access request for ${targetUserName} to lab ${labName}.`
      });
      await addNotification(targetUserId, 'Lab Access Request Rejected', `Your request to access ${labName} has been rejected.`, 'lab_access_rejected', '/dashboard');
      return { success: true, message: `Lab access request for ${targetUserName} to ${labName} rejected.` };

    } else if (action === 'revoke') {
      if (existingMembership) {
        const membershipId = existingMembership.id;
        await prisma.labMembership.delete({
          where: { id: membershipId },
        });
        await addAuditLog(adminUserId, adminUserName, 'LAB_MEMBERSHIP_REVOKED', {
          entityType: 'LabMembership', entityId: membershipId, secondaryEntityType: 'User', secondaryEntityId: targetUserId, details: `Admin ${adminUserName} revoked ${targetUserName}'s access to lab ${labName}.`
        });
        await addNotification(targetUserId, 'Lab Access Revoked', `Your access to ${labName} has been revoked by an administrator.`, 'lab_access_revoked', '/dashboard');
        return { success: true, message: `Access to ${labName} revoked for ${targetUserName}.` };
      } else {
        return { success: false, message: `${targetUserName} does not have existing access to ${labName} to revoke.` };
      }
    }
    return { success: false, message: "Invalid action specified." };
  } catch (error: any) {
    console.error(`!!! PRISMA ERROR IN ${functionName} !!!`, error.toString());
    throw error;
  }
}

export async function requestLabAccess_SA(
    requestingUserId: string,
    requestingUserName: string,
    labId: string,
    labName: string
): Promise<{ success: boolean; message: string; membershipId?: string }> {
    const functionName = "requestLabAccess_SA";

    try {
        // Check for existing active or pending membership
        const existingMembership = await prisma.labMembership.findUnique({
            where: { userId_labId: { userId: requestingUserId, labId } },
        });

        if (existingMembership && (existingMembership.status === 'active' || existingMembership.status === 'pending_approval')) {
            return { success: false, message: `You already have an '${existingMembership.status}' membership for ${labName}.` };
        }

        // If a rejected/revoked membership exists, update it; otherwise create new
        let membership;
        if (existingMembership) {
            membership = await prisma.labMembership.update({
                where: { id: existingMembership.id },
                data: { status: 'pending_approval' },
            });
        } else {
            membership = await prisma.labMembership.create({
                data: {
                    userId: requestingUserId,
                    labId,
                    status: 'pending_approval',
                },
            });
        }

        await addAuditLog(requestingUserId, requestingUserName, 'LAB_MEMBERSHIP_REQUESTED', {
            entityType: 'LabMembership', entityId: membership.id, secondaryEntityType: 'Lab', secondaryEntityId: labId,
            details: `User ${requestingUserName} requested access to lab ${labName}.`
        });

        // Notify all admins
        const adminUsers = await prisma.user.findMany({
            where: { role: 'Admin' },
            select: { id: true },
        });
        for (const admin of adminUsers) {
            addNotification(
                admin.id,
                'New Lab Access Request',
                `${requestingUserName} has requested access to ${labName}. Please review in Lab Management.`,
                'lab_access_request_received',
                '/admin/lab-operations?tab=lab-access-requests'
            );
        }

        return { success: true, message: `Request to join ${labName} submitted. You will be notified once an admin reviews it.`, membershipId: membership.id };
    } catch (error: any) {
        console.error(`!!! PRISMA ERROR IN ${functionName} !!!`, error.toString());
        return { success: false, message: `Failed to request access: ${error.message}` };
    }
}

export async function cancelLabAccessRequest_SA(
    requestingUserId: string,
    requestingUserName: string,
    membershipId: string,
    labName: string
): Promise<{ success: boolean; message: string }> {
    const functionName = "cancelLabAccessRequest_SA";

    try {
        const membership = await prisma.labMembership.findUnique({
            where: { id: membershipId },
        });

        if (!membership) {
            return { success: false, message: "Request not found." };
        }
        if (membership.userId !== requestingUserId) {
            return { success: false, message: "You can only cancel your own requests." };
        }
        if (membership.status !== 'pending_approval') {
            return { success: false, message: "This request can no longer be cancelled (it may have been processed)." };
        }

        await prisma.labMembership.delete({
            where: { id: membershipId },
        });

        await addAuditLog(requestingUserId, requestingUserName, 'LAB_MEMBERSHIP_CANCELLED', {
            entityType: 'LabMembership', entityId: membershipId, secondaryEntityType: 'Lab', secondaryEntityId: membership.labId,
            details: `User ${requestingUserName} cancelled their request to access lab ${labName}.`
        });

        return { success: true, message: `Your request to join ${labName} has been cancelled.` };
    } catch (error: any) {
        console.error(`!!! PRISMA ERROR IN ${functionName} !!!`, error.toString());
        return { success: false, message: `Failed to cancel request: ${error.message}` };
    }
}

export async function leaveLab_SA(
    requestingUserId: string,
    requestingUserName: string,
    membershipId: string,
    labName: string
): Promise<{ success: boolean; message: string }> {
    const functionName = "leaveLab_SA";

    try {
        const membership = await prisma.labMembership.findUnique({
            where: { id: membershipId },
        });

        if (!membership) {
            return { success: false, message: "Membership not found." };
        }
        if (membership.userId !== requestingUserId) {
            return { success: false, message: "You can only leave labs you are a member of." };
        }
        if (membership.status !== 'active') {
            return { success: false, message: "You can only leave labs where your membership is active." };
        }

        await prisma.labMembership.delete({
            where: { id: membershipId },
        });

        await addAuditLog(requestingUserId, requestingUserName, 'LAB_MEMBERSHIP_LEFT', {
            entityType: 'LabMembership', entityId: membershipId, secondaryEntityType: 'Lab', secondaryEntityId: membership.labId,
            details: `User ${requestingUserName} left lab ${labName}.`
        });

        // Notify all admins
        const adminUsers = await prisma.user.findMany({
            where: { role: 'Admin' },
            select: { id: true },
        });
        for (const admin of adminUsers) {
            addNotification(
                admin.id,
                'User Left Lab',
                `${requestingUserName} has voluntarily left ${labName}.`,
                'lab_access_left',
                `/admin/users`
            );
        }

        return { success: true, message: `You have successfully left ${labName}.` };
    } catch (error: any) {
        console.error(`!!! PRISMA ERROR IN ${functionName} !!!`, error.toString());
        return { success: false, message: `Failed to leave lab: ${error.message}` };
    }
}
