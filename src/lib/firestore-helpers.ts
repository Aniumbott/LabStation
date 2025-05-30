
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore'; // Correct import for Admin SDK Timestamp
import type { Notification as NotificationAppType, AuditLogEntry, AuditActionType, NotificationType as AppNotificationType, Booking } from '@/types';

// V7 DEBUG (Admin SDK)
export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: AppNotificationType,
  linkToParam?: string | undefined
): Promise<void> {
  const functionName = "addNotification V7 DEBUG (Admin SDK)";
  console.log(`--- [${functionName}] ENTERING FUNCTION ---`);
  console.log(`[${functionName}] typeof window:`, typeof window); // Should be 'undefined'

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

// V7 DEBUG (Admin SDK)
export async function addAuditLog(
  actingUserId: string,
  actingUserName: string,
  action: AuditActionType,
  params: {
    entityType?: AuditLogEntry['entityType'] | undefined;
    entityId?: string | undefined;
    details: string;
  }
): Promise<void> {
  const functionName = "addAuditLog V7 DEBUG (Admin SDK)";
  console.log(`--- [${functionName}] ENTERING FUNCTION ---`);
  console.log(`[${functionName}] typeof window:`, typeof window); // Should be 'undefined'

  const paramsReceived = { actingUserId, actingUserName, action, params };
  console.log(`[${functionName}] Parameters received:`, JSON.stringify(paramsReceived, null, 2));


  if (!actingUserId || !actingUserName || !action || !params.details) {
     const errorMsg = `Missing required parameters for audit log. Data: ${JSON.stringify(paramsReceived, null, 2)}`;
    console.error(`!!! CRITICAL ERROR IN ${functionName} !!! ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const newLogData: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp: FieldValue } & { entityType?: string, entityId?: string } = {
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    details: params.details,
    timestamp: FieldValue.serverTimestamp(),
  };

  if (params.entityType !== undefined) newLogData.entityType = params.entityType;
  if (params.entityId !== undefined) newLogData.entityId = params.entityId;
  
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
    // 1. Fetch waitlisted bookings for this resource, ordered by creation time (FIFO)
    // Firestore Index Required: bookings (resourceId ASC, status ASC, createdAt ASC)
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

    // Convert Firestore Timestamps to JS Dates for comparison
    const freedStart = freedSlotStartTime;
    const freedEnd = freedSlotEndTime;

    for (const docSnap of waitlistSnapshot.docs) {
      const waitlistedBookingData = docSnap.data();
      const waitlistedBookingId = docSnap.id;

      // Ensure startTime and endTime are JS Dates
      const waitlistedStartTime = (waitlistedBookingData.startTime as Timestamp).toDate();
      const waitlistedEndTime = (waitlistedBookingData.endTime as Timestamp).toDate();
      const waitlistedUserId = waitlistedBookingData.userId;
      const waitlistedUserName = waitlistedBookingData.userName || 'Waitlisted User'; // userName might not be on booking doc, fetch if needed or use a placeholder

      console.log(`[${functionName}] Evaluating waitlisted booking ${waitlistedBookingId} for user ${waitlistedUserId}: ${waitlistedStartTime.toISOString()} to ${waitlistedEndTime.toISOString()}`);

      // 2a. Check if the waitlisted booking fits within the freed slot
      if (waitlistedStartTime >= freedStart && waitlistedEndTime <= freedEnd) {
        console.log(`[${functionName}] Booking ${waitlistedBookingId} fits within the freed slot.`);

        // 2b. Perform a new conflict check for this specific waitlisted booking's time
        // against other 'Confirmed' or 'Pending' bookings
        const conflictQuery = adminDb.collection('bookings')
          .where('resourceId', '==', resourceId)
          .where('status', 'in', ['Confirmed', 'Pending'])
          .where('startTime', '<', Timestamp.fromDate(waitlistedEndTime))
          .where('endTime', '>', Timestamp.fromDate(waitlistedStartTime));

        const conflictSnapshot = await conflictQuery.get();

        if (conflictSnapshot.empty) {
          console.log(`[${functionName}] No conflicts found for booking ${waitlistedBookingId}. Promoting to 'Pending'.`);
          // 3. Promote the booking
          const bookingDocRef = adminDb.collection('bookings').doc(waitlistedBookingId);
          await bookingDocRef.update({ status: 'Pending' });

          // 4. Add Audit Log
          // For audit log, try to get acting user name (system or admin who triggered indirectly)
          // For simplicity, we'll log it as a system action for now.
          await addAuditLog(
            'SYSTEM_WAITLIST_PROMOTION', // Or a specific admin user ID if available
            'System',
            'BOOKING_PROMOTED',
            {
              entityType: 'Booking',
              entityId: waitlistedBookingId,
              details: `Booking for resource ${resourceId} by user ${waitlistedUserId} automatically promoted from waitlist to Pending.`
            }
          );

          // 5. Send Notifications
          // To promoted user
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

          // To Admins/Lab Managers
          try {
            const adminUsersQuery = adminDb.collection('users').where('role', 'in', ['Admin', 'Lab Manager']);
            const adminSnapshot = await adminUsersQuery.get();
            const adminNotificationPromises = adminSnapshot.docs.map(adminDoc => {
              return addNotification(
                adminDoc.id,
                'Booking Promoted - Needs Approval',
                `A waitlisted booking for ${resourceId} by user ${waitlistedUserId} has been promoted to 'Pending' and requires approval.`,
                'booking_promoted_admin',
                `/admin/booking-requests?bookingId=${waitlistedBookingId}`
              );
            });
            await Promise.all(adminNotificationPromises);
          } catch (adminNotifError) {
            console.error(`[${functionName}] Failed to send 'promoted_admin' notifications:`, adminNotifError);
          }

          console.log(`[${functionName}] Successfully promoted booking ${waitlistedBookingId}. Exiting waitlist processing for this slot.`);
          return; // Promoted one, so we're done for this freed slot.
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
    // Do not re-throw here to prevent breaking the calling function if waitlist processing fails
  }
}


// V3 Server Action for creating a booking using Admin SDK
export async function createBooking_SA(
  bookingPayload: {
    resourceId: string;
    startTime: Date;
    endTime: Date;
    status: 'Pending' | 'Waitlisted';
    notes?: string;
  },
  actingUser: { id: string; name: string }
): Promise<string> { // Returns new booking ID
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
    throw new Error("User information is missing for creating booking.");
  }

  const dataToSave = {
    ...bookingPayload,
    userId: actingUser.id, // Ensure booking is created for the acting user
    createdAt: FieldValue.serverTimestamp(),
    // Ensure startTime and endTime are Firestore Timestamps
    startTime: Timestamp.fromDate(new Date(bookingPayload.startTime)),
    endTime: Timestamp.fromDate(new Date(bookingPayload.endTime)),
  };

  console.log(`[${functionName}] Attempting to add booking to Firestore. Data:`, JSON.stringify(dataToSave, null, 2));

  try {
    const docRef = await adminDb.collection('bookings').add(dataToSave);
    console.log(`!!! SUCCESS !!! [${functionName}] Successfully created booking with Admin SDK. Doc ID: ${docRef.id}`);

    // Add audit log for booking creation
    try {
      await addAuditLog(
        actingUser.id,
        actingUser.name,
        bookingPayload.status === 'Waitlisted' ? 'BOOKING_WAITLISTED' : 'BOOKING_CREATED',
        {
          entityType: 'Booking',
          entityId: docRef.id,
          details: `Booking for resource ${bookingPayload.resourceId} created by ${actingUser.name}. Status: ${bookingPayload.status}.`
        }
      );
    } catch (auditError: any) {
      console.error(`[${functionName}] Failed to add audit log for booking ${docRef.id}:`, auditError.toString());
      // Non-critical, so don't re-throw, but log it.
    }
    return docRef.id; // Return the new booking ID
  } catch (e: any) {
    console.error(`!!! FIRESTORE ERROR IN ${functionName} !!! FirebaseError:`, e.toString());
    console.error(`[${functionName}] Error Code:`, e.code);
    console.error(`[${functionName}] Error Message:`, e.message);
    if (e.details) {
      console.error(`[${functionName}] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName}] Full error object:`, e);
    console.error(`[${functionName}] Booking data that failed:`, JSON.stringify(dataToSave, null, 2));
    throw e; // Re-throw the error so the client can handle it
  }
}

    