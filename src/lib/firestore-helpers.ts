
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
  console.log(`--- [${functionName}] ENTERING FUNCTION ---`);
  console.log(`[${functionName}] typeof window:`, typeof window); 

  const paramsReceived = { userId, title, message, type, linkToParam };
  console.log(`[${functionName}] Parameters received:`, JSON.stringify(paramsReceived, null, 2));

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

  console.log(`[${functionName}] Attempting to add notification to Firestore. Data:`, JSON.stringify(newNotificationData, null, 2));

  try {
    const docRef = await adminDb.collection('notifications').add(newNotificationData);
    console.log(`!!! SUCCESS !!! [${functionName}] Successfully added notification to Firestore. Doc ID: ${docRef.id}, UserID: ${userId}, Type: ${type}`);
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
  console.log(`--- [${functionName}] ENTERING FUNCTION ---`);

  const paramsReceived = { actingUserId, actingUserName, action, params };
  console.log(`[${functionName}] Parameters received:`, JSON.stringify(paramsReceived, null, 2));


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
  
  console.log(`[${functionName}] Attempting to add audit log to Firestore. Data:`, JSON.stringify(newLogData, null, 2));

  try {
    const docRef = await adminDb.collection('auditLogs').add(newLogData);
    console.log(`!!! SUCCESS !!! [${functionName}] Successfully added audit log to Firestore. Doc ID: ${docRef.id}, Action: ${action}, User: ${actingUserName}`);
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
  console.log(`--- [${functionName}] ENTERING for resource ${resourceId} ---`);
  console.log(`[${functionName}] Freed slot: ${freedSlotStartTime.toISOString()} to ${freedSlotEndTime.toISOString()}`);
  console.log(`[${functionName}] Triggered by: ${triggeringAction}`);

  try {
    const waitlistQuery = adminDb.collection('bookings')
      .where('resourceId', '==', resourceId)
      .where('status', '==', 'Waitlisted')
      .orderBy('createdAt', 'asc');

    const waitlistSnapshot = await waitlistQuery.get();

    if (waitlistSnapshot.empty) {
      console.log(`[${functionName}] No waitlisted bookings found for resource ${resourceId}.`);
      return;
    }

    console.log(`[${functionName}] Found ${waitlistSnapshot.docs.length} waitlisted bookings for resource ${resourceId}.`);

    const freedStart = freedSlotStartTime;
    const freedEnd = freedSlotEndTime;

    for (const docSnap of waitlistSnapshot.docs) {
      const waitlistedBookingData = docSnap.data();
      const waitlistedBookingId = docSnap.id;

      const waitlistedStartTime = (waitlistedBookingData.startTime as Timestamp).toDate();
      const waitlistedEndTime = (waitlistedBookingData.endTime as Timestamp).toDate();
      const waitlistedUserId = waitlistedBookingData.userId;
      const waitlistedUserName = waitlistedBookingData.userName || 'Waitlisted User'; 

      console.log(`[${functionName}] Evaluating waitlisted booking ${waitlistedBookingId} for user ${waitlistedUserId}: ${waitlistedStartTime.toISOString()} to ${waitlistedEndTime.toISOString()}`);

      if (waitlistedStartTime >= freedStart && waitlistedEndTime <= freedEnd) {
        console.log(`[${functionName}] Booking ${waitlistedBookingId} fits within the freed slot.`);

        const conflictQuery = adminDb.collection('bookings')
          .where('resourceId', '==', resourceId)
          .where('status', 'in', ['Confirmed', 'Pending'])
          .where('startTime', '<', Timestamp.fromDate(waitlistedEndTime))
          .where('endTime', '>', Timestamp.fromDate(waitlistedStartTime));

        const conflictSnapshot = await conflictQuery.get();

        if (conflictSnapshot.empty) {
          console.log(`[${functionName}] No conflicts found for booking ${waitlistedBookingId}. Promoting to 'Pending'.`);
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

          console.log(`[${functionName}] Successfully promoted booking ${waitlistedBookingId}. Exiting waitlist processing for this slot.`);
          return; 
        } else {
          console.log(`[${functionName}] Booking ${waitlistedBookingId} conflicts with another existing Confirmed/Pending booking. Skipping.`);
        }
      } else {
        console.log(`[${functionName}] Booking ${waitlistedBookingId} does not fit into the freed slot. Skipping.`);
      }
    }
    console.log(`[${functionName}] No suitable waitlisted booking found to promote for resource ${resourceId} in the freed slot.`);

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
  console.log(`--- [${functionName}] ENTERING FUNCTION ---`);
  console.log(`[${functionName}] typeof window:`, typeof window);
  console.log(`[${functionName}] bookingPayload received:`, JSON.stringify(bookingPayload));
  console.log(`[${functionName}] actingUser received:`, JSON.stringify(actingUser));

  if (!adminDb) {
    console.error(`!!! CRITICAL ERROR IN ${functionName} !!! adminDb is not initialized!`);
    throw new Error("Firebase Admin SDK is not initialized on the server.");
  }
  console.log("[createBooking_SA V3] Using adminDb instance:", adminDb ? "adminDb is available" : "adminDb IS NULL OR UNDEFINED!!!");


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

  console.log(`[${functionName}] Attempting to add booking to Firestore. Data:`, JSON.stringify(dataToSave, null, 2));

  try {
    const docRef = await adminDb.collection('bookings').add(dataToSave);
    console.log(`!!! SUCCESS !!! [${functionName}] Successfully created booking with Admin SDK. Doc ID: ${docRef.id}`);

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
  action: 'grant' | 'revoke'
): Promise<{ success: boolean; message: string }> {
  const functionName = "manageLabMembership_SA";
  console.log(`--- [${functionName}] ENTERING ---`, { adminUserId, targetUserId, labId, action });

  if (!adminUserId || !adminUserName || !targetUserId || !labId || !labName) {
    throw new Error("Missing required parameters for managing lab membership.");
  }

  const membershipQuery = adminDb.collection('labMemberships')
    .where('userId', '==', targetUserId)
    .where('labId', '==', labId)
    .limit(1);

  try {
    const snapshot = await membershipQuery.get();
    let existingMembershipDoc: FirebaseFirestore.DocumentSnapshot | undefined = undefined;
    if (!snapshot.empty) {
      existingMembershipDoc = snapshot.docs[0];
    }

    if (action === 'grant') {
      const membershipData: Omit<LabMembership, 'id'> & {updatedAt: FieldValue} = {
        userId: targetUserId,
        labId: labId,
        status: 'active',
        roleInLab: 'Member', // Default role
        updatedAt: FieldValue.serverTimestamp(),
        actingAdminId: adminUserId,
      };
      if (existingMembershipDoc) {
        await existingMembershipDoc.ref.update({
          status: 'active',
          roleInLab: 'Member', // Ensure role is set if re-activating
          updatedAt: FieldValue.serverTimestamp(),
          actingAdminId: adminUserId,
        });
         console.log(`[${functionName}] Membership for user ${targetUserId} in lab ${labId} updated to active.`);
      } else {
        membershipData.requestedAt = FieldValue.serverTimestamp() as Timestamp; // Set requestedAt if new
        await adminDb.collection('labMemberships').add(membershipData);
        console.log(`[${functionName}] New active membership created for user ${targetUserId} in lab ${labId}.`);
      }
      await addAuditLog(adminUserId, adminUserName, 'LAB_MEMBERSHIP_GRANTED', {
        entityType: 'LabMembership', 
        entityId: targetUserId, // User is primary entity
        secondaryEntityType: 'Lab',
        secondaryEntityId: labId,
        details: `Admin ${adminUserName} granted user ${targetUserName} (ID: ${targetUserId}) access to lab ${labName} (ID: ${labId}).`
      });
      await addNotification(targetUserId, 'Lab Access Granted', `You have been granted access to ${labName}.`, 'lab_access_approved', '/dashboard');
      return { success: true, message: `Access to ${labName} granted for ${targetUserName}.` };

    } else if (action === 'revoke') {
      if (existingMembershipDoc) {
        await existingMembershipDoc.ref.delete();
        console.log(`[${functionName}] Membership for user ${targetUserId} in lab ${labId} deleted (revoked).`);
        await addAuditLog(adminUserId, adminUserName, 'LAB_MEMBERSHIP_REVOKED', {
          entityType: 'LabMembership',
          entityId: targetUserId,
          secondaryEntityType: 'Lab',
          secondaryEntityId: labId,
          details: `Admin ${adminUserName} revoked user ${targetUserName}'s (ID: ${targetUserId}) access to lab ${labName} (ID: ${labId}).`
        });
        await addNotification(targetUserId, 'Lab Access Revoked', `Your access to ${labName} has been revoked by an administrator.`, 'lab_access_revoked', '/dashboard');
        return { success: true, message: `Access to ${labName} revoked for ${targetUserName}.` };
      } else {
        console.log(`[${functionName}] No existing membership found to revoke for user ${targetUserId} in lab ${labId}.`);
        return { success: false, message: `${targetUserName} does not have existing access to ${labName} to revoke.` };
      }
    }
    return { success: false, message: "Invalid action." }; // Should not happen
  } catch (error: any) {
    console.error(`!!! FIRESTORE ERROR IN ${functionName} !!!`, error.toString());
    throw error;
  }
}
