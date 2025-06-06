
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import type { Notification as NotificationAppType, AuditLogEntry, AuditActionType, NotificationType as AppNotificationType, Booking, LabMembership, LabMembershipStatus } from '@/types';


export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: AppNotificationType,
  linkToParam?: string | undefined
): Promise<void> {
  const functionName = "addNotification V7 DEBUG (Admin SDK)";

  const paramsReceived = { userId, title, message, type, linkToParam };

  if (!userId || !title || !message || !type) {
    const errorMsg = `Missing required parameters for notification. Data: ${JSON.stringify(paramsReceived, null, 2)}`;
    console.error(`!!! CRITICAL ERROR IN ${functionName} !!! ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const finalLinkTo = typeof linkToParam === 'string' && linkToParam.trim() !== '' ? linkToParam.trim() : undefined;

  const newNotificationData: Omit<NotificationAppType, 'id' | 'createdAt'> & { createdAt: FieldValue } & { linkTo?: string } = {
    userId: userId,
    title: title,
    message: message,
    type: type,
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  };

  if (finalLinkTo !== undefined) {
    newNotificationData.linkTo = finalLinkTo;
  }

  try {
    const docRef = await adminDb.collection('notifications').add(newNotificationData);
  } catch (e: any) {
    console.error(`!!! FIRESTORE ERROR IN ${functionName} !!! FirebaseError:`, e.toString());
    console.error(`[${functionName}] Error Code:`, e.code);
    console.error(`[${functionName}] Error Message:`, e.message);
    if (e.details) {
      console.error(`[${functionName}] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName}] Full error object:`, e);
    console.error(`[${functionName}] Notification data that failed:`, JSON.stringify(newNotificationData, null, 2));
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
  const functionName = "addAuditLog V8 (Admin SDK)";

  const paramsReceived = { actingUserId, actingUserName, action, params };

  if (!actingUserId || !actingUserName || !action || !params.details) {
     const errorMsg = `Missing required parameters for audit log. Data: ${JSON.stringify(paramsReceived, null, 2)}`;
    console.error(`!!! CRITICAL ERROR IN ${functionName} !!! ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const newLogData: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp: FieldValue } & { entityType?: string, entityId?: string, secondaryEntityType?: string, secondaryEntityId?: string } = {
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    details: params.details,
    timestamp: FieldValue.serverTimestamp(),
  };

  if (params.entityType !== undefined) newLogData.entityType = params.entityType;
  if (params.entityId !== undefined) newLogData.entityId = params.entityId;
  if (params.secondaryEntityType !== undefined) newLogData.secondaryEntityType = params.secondaryEntityType;
  if (params.secondaryEntityId !== undefined) newLogData.secondaryEntityId = params.secondaryEntityId;

  try {
    const docRef = await adminDb.collection('auditLogs').add(newLogData);
  } catch (e: any) {
    console.error(`!!! FIRESTORE ERROR IN ${functionName} !!! FirebaseError:`, e.toString());
    console.error(`[${functionName}] Error Code:`, e.code);
    console.error(`[${functionName}] Error Message:`, e.message);
     if (e.details) {
      console.error(`[${functionName}] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName}] Full error object:`, e);
    console.error(`[${functionName}] Audit log data that failed:`, JSON.stringify(newLogData, null, 2));
    throw e;
  }
}


export async function processWaitlistForResource(
  resourceId: string,
  freedSlotStartTime: Date,
  freedSlotEndTime: Date,
  triggeringAction: 'admin_reject' | 'user_cancel_confirmed'
): Promise<void> {
  const functionName = "processWaitlistForResource V1 (Admin SDK)";

  try {
    const waitlistQuery = adminDb.collection('bookings')
      .where('resourceId', '==', resourceId)
      .where('status', '==', 'Waitlisted')
      .orderBy('createdAt', 'asc');

    const waitlistSnapshot = await waitlistQuery.get();

    if (waitlistSnapshot.empty) {
      return;
    }

    const freedStart = freedSlotStartTime;
    const freedEnd = freedSlotEndTime;

    for (const docSnap of waitlistSnapshot.docs) {
      const waitlistedBookingData = docSnap.data();
      const waitlistedBookingId = docSnap.id;

      const waitlistedStartTime = (waitlistedBookingData.startTime as Timestamp).toDate();
      const waitlistedEndTime = (waitlistedBookingData.endTime as Timestamp).toDate();
      const waitlistedUserId = waitlistedBookingData.userId;
      const waitlistedUserName = waitlistedBookingData.userName || 'Waitlisted User';

      if (waitlistedStartTime >= freedStart && waitlistedEndTime <= freedEnd) {
        const conflictQuery = adminDb.collection('bookings')
          .where('resourceId', '==', resourceId)
          .where('status', 'in', ['Confirmed', 'Pending'])
          .where('startTime', '<', Timestamp.fromDate(waitlistedEndTime))
          .where('endTime', '>', Timestamp.fromDate(waitlistedStartTime));

        const conflictSnapshot = await conflictQuery.get();

        if (conflictSnapshot.empty) {
          const bookingDocRef = adminDb.collection('bookings').doc(waitlistedBookingId);
          await bookingDocRef.update({ status: 'Pending' });

          await addAuditLog(
            'SYSTEM_WAITLIST_PROMOTION',
            'System',
            'BOOKING_PROMOTED',
            {
              entityType: 'Booking',
              entityId: waitlistedBookingId,
              details: `Booking for resource ${resourceId} by user ${waitlistedUserId} automatically promoted from waitlist to Pending.`
            }
          );

          try {
            const resourceDoc = await adminDb.collection('resources').doc(resourceId).get();
            const resourceName = resourceDoc.exists ? resourceDoc.data()?.name || 'the resource' : 'the resource';

            await addNotification(
              waitlistedUserId,
              'Booking Promoted from Waitlist!',
              `Your waitlisted booking for ${resourceName} starting at ${waitlistedStartTime.toLocaleTimeString()} on ${waitlistedStartTime.toLocaleDateString()} has been promoted to 'Pending'. It now awaits admin approval.`,
              'booking_promoted_user',
              `/bookings?bookingId=${waitlistedBookingId}`
            );
          } catch (userNotifError) {
            console.error(`[${functionName}] Failed to send 'promoted_user' notification to ${waitlistedUserId}:`, userNotifError);
          }

          try {
            const adminUsersQuery = adminDb.collection('users').where('role', 'in', ['Admin', 'Technician']);
            const adminSnapshot = await adminUsersQuery.get();
            const adminNotificationPromises = adminSnapshot.docs.map(adminDoc => {
              return addNotification(
                adminDoc.id,
                'Booking Promoted - Needs Approval',
                `A waitlisted booking for ${resourceId} by user ${waitlistedUserId} (${waitlistedUserName}) has been promoted to 'Pending' and requires approval.`,
                'booking_promoted_admin',
                `/admin/booking-requests?bookingId=${waitlistedBookingId}`
              );
            });
            await Promise.all(adminNotificationPromises);
          } catch (adminNotifError) {
            console.error(`[${functionName}] Failed to send 'promoted_admin' notifications:`, adminNotifError);
          }
          return;
        }
      }
    }

  } catch (error: any) {
    console.error(`!!! ERROR IN ${functionName} for resource ${resourceId} !!!`, error.toString());
    if (error.code) console.error(`[${functionName}] Error Code:`, error.code);
    if (error.message) console.error(`[${functionName}] Error Message:`, error.message);
    if (error.details) console.error(`[${functionName}] Firestore Error Details:`, error.details);
    console.error(`[${functionName}] Full error object:`, error);
  }
}


export async function createBooking_SA(
  bookingPayload: {
    resourceId: string;
    userId: string;
    startTime: Date;
    endTime: Date;
    status: 'Pending' | 'Waitlisted';
    notes?: string;
  },
  actingUser: { id: string; name: string }
): Promise<string> {
  const functionName = "createBooking_SA V3 (Admin SDK)";

  if (!adminDb) {
    console.error(`!!! CRITICAL ERROR IN ${functionName} !!! adminDb is not initialized!`);
    throw new Error("Firebase Admin SDK is not initialized on the server.");
  }

  if (!actingUser || !actingUser.id || !actingUser.name) {
    throw new Error("Acting user information is missing for creating booking.");
  }
  if (!bookingPayload.userId) {
    throw new Error("User ID for whom the booking is being made is missing.");
  }

  const dataToSave = {
    resourceId: bookingPayload.resourceId,
    userId: bookingPayload.userId,
    startTime: Timestamp.fromDate(new Date(bookingPayload.startTime)),
    endTime: Timestamp.fromDate(new Date(bookingPayload.endTime)),
    status: bookingPayload.status,
    notes: bookingPayload.notes || '',
    createdAt: FieldValue.serverTimestamp(),
  };

  try {
    const docRef = await adminDb.collection('bookings').add(dataToSave);

    let auditDetails = `Booking for resource ${bookingPayload.resourceId} (User: ${bookingPayload.userId}) created by ${actingUser.name}. Status: ${bookingPayload.status}.`;
    if (actingUser.id !== bookingPayload.userId) {
        auditDetails = `Booking for resource ${bookingPayload.resourceId} for user ${bookingPayload.userId} created by Admin ${actingUser.name}. Status: ${bookingPayload.status}.`;
    }

    try {
      await addAuditLog(
        actingUser.id,
        actingUser.name,
        bookingPayload.status === 'Waitlisted' ? 'BOOKING_WAITLISTED' : 'BOOKING_CREATED',
        {
          entityType: 'Booking',
          entityId: docRef.id,
          details: auditDetails
        }
      );
    } catch (auditError: any) {
      console.error(`[${functionName}] Failed to add audit log for booking ${docRef.id}:`, auditError.toString());
    }
    return docRef.id;
  } catch (e: any) {
    console.error(`!!! FIRESTORE ERROR IN ${functionName} !!! FirebaseError:`, e.toString());
    console.error(`[${functionName}] Error Code:`, e.code);
    console.error(`[${functionName}] Error Message:`, e.message);
    if (e.details) {
      console.error(`[${functionName}] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName}] Full error object:`, e);
    console.error(`[${functionName}] Booking data that failed:`, JSON.stringify(dataToSave, null, 2));
    throw e;
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
  const functionName = "manageLabMembership_SA V2";

  if (!adminUserId || !adminUserName || !targetUserId || !labId || !labName) {
    throw new Error("Missing required parameters for managing lab membership.");
  }

  const now = FieldValue.serverTimestamp();

  try {
    let membershipDocRef;
    if (membershipDocIdToUpdate) {
      membershipDocRef = adminDb.collection('labMemberships').doc(membershipDocIdToUpdate);
    } else {
      const q = adminDb.collection('labMemberships')
        .where('userId', '==', targetUserId)
        .where('labId', '==', labId)
        .limit(1);
      const snapshot = await q.get();
      if (!snapshot.empty) {
        membershipDocRef = snapshot.docs[0].ref;
      }
    }

    if (action === 'grant') {
      const membershipData: Partial<LabMembership> & { updatedAt: FieldValue, actingAdminId: string, status: LabMembershipStatus, userId: string, labId: string, roleInLab?: 'Member' } = {
        userId: targetUserId,
        labId: labId,
        status: 'active',
        roleInLab: 'Member',
        updatedAt: now,
        actingAdminId: adminUserId,
      };
      if (membershipDocRef) {
        await membershipDocRef.update(membershipData);
      } else {
        membershipData.requestedAt = now as Timestamp;
        membershipDocRef = adminDb.collection('labMemberships').doc();
        await membershipDocRef.set(membershipData);
      }
      await addAuditLog(adminUserId, adminUserName, 'LAB_MEMBERSHIP_GRANTED', {
        entityType: 'LabMembership', entityId: membershipDocRef.id, secondaryEntityType: 'User', secondaryEntityId: targetUserId, details: `Admin ${adminUserName} granted user ${targetUserName} access to lab ${labName}.`
      });
      await addNotification(targetUserId, 'Lab Access Granted', `You have been granted access to ${labName}.`, 'lab_access_approved', '/dashboard');
      return { success: true, message: `Access to ${labName} granted for ${targetUserName}.` };

    } else if (action === 'approve_request') {
      if (!membershipDocIdToUpdate || !membershipDocRef) throw new Error("Membership document ID required for approval.");
      await membershipDocRef.update({ status: 'active', updatedAt: now, actingAdminId: adminUserId });
      await addAuditLog(adminUserId, adminUserName, 'LAB_MEMBERSHIP_APPROVED', {
        entityType: 'LabMembership', entityId: membershipDocIdToUpdate, secondaryEntityType: 'User', secondaryEntityId: targetUserId, details: `Admin ${adminUserName} approved lab access request for ${targetUserName} to lab ${labName}.`
      });
      await addNotification(targetUserId, 'Lab Access Approved!', `Your request to access ${labName} has been approved.`, 'lab_access_approved', '/dashboard');
      return { success: true, message: `Lab access request for ${targetUserName} to ${labName} approved.` };

    } else if (action === 'reject_request') {
      if (!membershipDocIdToUpdate || !membershipDocRef) throw new Error("Membership document ID required for rejection.");
      await membershipDocRef.update({ status: 'rejected', updatedAt: now, actingAdminId: adminUserId });
      await addAuditLog(adminUserId, adminUserName, 'LAB_MEMBERSHIP_REJECTED', {
        entityType: 'LabMembership', entityId: membershipDocIdToUpdate, secondaryEntityType: 'User', secondaryEntityId: targetUserId, details: `Admin ${adminUserName} rejected lab access request for ${targetUserName} to lab ${labName}.`
      });
      await addNotification(targetUserId, 'Lab Access Request Rejected', `Your request to access ${labName} has been rejected.`, 'lab_access_rejected', '/dashboard');
      return { success: true, message: `Lab access request for ${targetUserName} to ${labName} rejected.` };

    } else if (action === 'revoke') {
      if (membershipDocRef) {
        await membershipDocRef.delete();
        await addAuditLog(adminUserId, adminUserName, 'LAB_MEMBERSHIP_REVOKED', {
          entityType: 'LabMembership', entityId: membershipDocRef.id, secondaryEntityType: 'User', secondaryEntityId: targetUserId, details: `Admin ${adminUserName} revoked ${targetUserName}'s access to lab ${labName}.`
        });
        await addNotification(targetUserId, 'Lab Access Revoked', `Your access to ${labName} has been revoked by an administrator.`, 'lab_access_revoked', '/dashboard');
        return { success: true, message: `Access to ${labName} revoked for ${targetUserName}.` };
      } else {
        return { success: false, message: `${targetUserName} does not have existing access to ${labName} to revoke.` };
      }
    }
    return { success: false, message: "Invalid action specified." };
  } catch (error: any) {
    console.error(`!!! FIRESTORE ERROR IN ${functionName} !!!`, error.toString());
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
        const existingQuery = adminDb.collection('labMemberships')
            .where('userId', '==', requestingUserId)
            .where('labId', '==', labId)
            .where('status', 'in', ['active', 'pending_approval'])
            .limit(1);
        const existingSnapshot = await existingQuery.get();
        if (!existingSnapshot.empty) {
            const existingStatus = existingSnapshot.docs[0].data().status;
            return { success: false, message: `You already have an '${existingStatus}' membership for ${labName}.` };
        }

        const newMembershipData: Omit<LabMembership, 'id'> = {
            userId: requestingUserId,
            labId: labId,
            status: 'pending_approval',
            requestedAt: Timestamp.now(),
            updatedAt: Timestamp.now(),
        };
        const docRef = await adminDb.collection('labMemberships').add(newMembershipData);

        await addAuditLog(requestingUserId, requestingUserName, 'LAB_MEMBERSHIP_REQUESTED', {
            entityType: 'LabMembership', entityId: docRef.id, secondaryEntityType: 'Lab', secondaryEntityId: labId,
            details: `User ${requestingUserName} requested access to lab ${labName}.`
        });

        const adminUsersQuery = adminDb.collection('users').where('role', '==', 'Admin');
        const adminSnapshot = await adminUsersQuery.get();
        adminSnapshot.forEach(adminDoc => {
            addNotification(
                adminDoc.id,
                'New Lab Access Request',
                `${requestingUserName} has requested access to ${labName}. Please review in Lab Management.`,
                'lab_access_request_received',
                '/admin/lab-operations?tab=lab-access-requests' // Note: This link might need updating to /admin/lab-operations?tab=lab-access-requests
            );
        });

        return { success: true, message: `Request to join ${labName} submitted. You will be notified once an admin reviews it.`, membershipId: docRef.id };
    } catch (error: any) {
        console.error(`!!! FIRESTORE ERROR IN ${functionName} !!!`, error.toString());
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
        const membershipDocRef = adminDb.collection('labMemberships').doc(membershipId);
        const docSnap = await membershipDocRef.get();

        if (!docSnap.exists) {
            return { success: false, message: "Request not found." };
        }
        if (docSnap.data()?.userId !== requestingUserId) {
            return { success: false, message: "You can only cancel your own requests." };
        }
        if (docSnap.data()?.status !== 'pending_approval') {
            return { success: false, message: "This request can no longer be cancelled (it may have been processed)." };
        }

        await membershipDocRef.delete();

        await addAuditLog(requestingUserId, requestingUserName, 'LAB_MEMBERSHIP_CANCELLED', {
            entityType: 'LabMembership', entityId: membershipId, secondaryEntityType: 'Lab', secondaryEntityId: docSnap.data()?.labId,
            details: `User ${requestingUserName} cancelled their request to access lab ${labName}.`
        });

        return { success: true, message: `Your request to join ${labName} has been cancelled.` };
    } catch (error: any) {
        console.error(`!!! FIRESTORE ERROR IN ${functionName} !!!`, error.toString());
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
        const membershipDocRef = adminDb.collection('labMemberships').doc(membershipId);
        const docSnap = await membershipDocRef.get();

        if (!docSnap.exists) {
            return { success: false, message: "Membership not found." };
        }
        if (docSnap.data()?.userId !== requestingUserId) {
            return { success: false, message: "You can only leave labs you are a member of." };
        }
        if (docSnap.data()?.status !== 'active') {
            return { success: false, message: "You can only leave labs where your membership is active." };
        }

        await membershipDocRef.delete();

        await addAuditLog(requestingUserId, requestingUserName, 'LAB_MEMBERSHIP_LEFT', {
            entityType: 'LabMembership', entityId: membershipId, secondaryEntityType: 'Lab', secondaryEntityId: docSnap.data()?.labId,
            details: `User ${requestingUserName} left lab ${labName}.`
        });
        
        const adminUsersQuery = adminDb.collection('users').where('role', '==', 'Admin');
        const adminSnapshot = await adminUsersQuery.get();
        adminSnapshot.forEach(adminDoc => {
            addNotification(
                adminDoc.id,
                'User Left Lab',
                `${requestingUserName} has voluntarily left ${labName}.`,
                'lab_access_left',
                `/admin/users`
            );
        });

        return { success: true, message: `You have successfully left ${labName}.` };
    } catch (error: any) {
        console.error(`!!! FIRESTORE ERROR IN ${functionName} !!!`, error.toString());
        return { success: false, message: `Failed to leave lab: ${error.message}` };
    }
}
