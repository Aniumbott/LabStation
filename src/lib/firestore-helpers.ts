
'use server';

import { db } from '@/lib/firebase'; // db is client SDK Firestore
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Notification as NotificationAppType, AuditLogEntry, AuditActionType, NotificationType as AppNotificationType } from '@/types';
// Removed import { auth as firebaseAuth } from '@/lib/firebase'; as it's not used here and can be confusing in server context

export async function addNotification(
  userId: string, // Parameter kept for signature, but will be ignored in this test
  title: string, // Parameter kept for signature, but will be ignored in this test
  message: string, // Parameter kept for signature, but will be ignored in this test
  type: AppNotificationType, // Parameter kept for signature, but will be ignored in this test
  linkToParam?: string | undefined // Parameter kept for signature, but will be ignored in this test
): Promise<void> {
  const functionName = "addNotification V8 DEBUG (Hardcoded Test)";
  console.log(`--- [${functionName}] ENTERING FUNCTION ---`);
  console.log(`[${functionName}] typeof window: ${typeof window}`); // Should be 'undefined'
  // Log original params for context, though we won't use them for the write
  console.log(`[${functionName}] Original Params received:`, JSON.stringify({ userId, title, message, type, linkToParam }));


  const hardcodedNotificationData: Omit<NotificationAppType, 'id'> & { createdAt: Timestamp } = {
    userId: "HARDCODED_RECIPIENT_TEST_UID", // Use a known, valid UID for testing if needed, or a placeholder
    title: "Hardcoded Test Notification Title",
    message: "This is a hardcoded test notification message.",
    type: "booking_confirmed" as AppNotificationType,
    createdAt: serverTimestamp() as Timestamp,
    isRead: false,
    linkTo: "/bookings/hardcoded-test-link",
  };

  console.log(`[${functionName}] Attempting to add HARDCODED notification to Firestore. Data:`, JSON.stringify(hardcodedNotificationData, null, 2));

  try {
    const docRef = await addDoc(collection(db, 'notifications'), hardcodedNotificationData);
    console.log(`!!! SUCCESS !!! [${functionName}] Successfully added HARDCODED notification. Doc ID: ${docRef.id}`);
  } catch (e: any) {
    console.error(`!!! FIRESTORE ERROR IN ${functionName} (HARDCODED TEST) !!!`);
    console.error(`[${functionName}] Error Code:`, e.code);
    console.error(`[${functionName}] Error Message:`, e.message);
    if (e.details) {
      console.error(`[${functionName}] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName}] Error Stack:`, e.stack ? e.stack.split('\n').slice(0, 5).join('\n') : 'No stack'); // Limit stack trace
    console.error(`[${functionName}] HARDCODED Notification data that failed:`, JSON.stringify(hardcodedNotificationData, null, 2));
    throw e; // Re-throw the error so the caller (and Next.js) knows it failed
  }
}

export async function addAuditLog(
  actingUserId: string, // Parameter kept for signature, but will be ignored in this test
  actingUserName: string, // Parameter kept for signature, but will be ignored in this test
  action: AuditActionType, // Parameter kept for signature, but will be ignored in this test
  params: {
    entityType?: AuditLogEntry['entityType'] | undefined;
    entityId?: string | undefined;
    details: string; // Parameter kept for signature, but will be ignored in this test
  }
): Promise<void> {
  const functionName = "addAuditLog V8 DEBUG (Hardcoded Test)";
  console.log(`--- [${functionName}] ENTERING FUNCTION ---`);
  console.log(`[${functionName}] typeof window: ${typeof window}`); // Should be 'undefined'
  // Log original params for context, though we won't use them for the write
  console.log(`[${functionName}] Original Params received:`, JSON.stringify({ actingUserId, actingUserName, action, params }));

  const hardcodedLogData: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp: Timestamp } = {
    userId: "HARDCODED_ADMIN_TEST_UID", // Use your admin UID here for testing if needed, or a placeholder
    userName: "Hardcoded Test Admin User",
    action: "USER_APPROVED" as AuditActionType, // Example action
    entityType: "User" as const,
    entityId: "hardcoded_test_entity_id",
    details: "This is a hardcoded audit log for testing server action auth context from addAuditLog.",
    timestamp: serverTimestamp() as Timestamp,
  };

  console.log(`[${functionName}] Attempting to add HARDCODED audit log to Firestore. Data:`, JSON.stringify(hardcodedLogData, null, 2));

  try {
    const docRef = await addDoc(collection(db, 'auditLogs'), hardcodedLogData);
    console.log(`!!! SUCCESS !!! [${functionName}] Successfully added HARDCODED audit log. Doc ID: ${docRef.id}`);
  } catch (e: any) {
    console.error(`!!! FIRESTORE ERROR IN ${functionName} (HARDCODED TEST) !!!`);
    console.error(`[${functionName}] Error Code:`, e.code);
    console.error(`[${functionName}] Error Message:`, e.message);
    if (e.details) {
      console.error(`[${functionName}] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName}] Error Stack:`, e.stack ? e.stack.split('\n').slice(0, 5).join('\n') : 'No stack'); // Limit stack trace
    console.error(`[${functionName}] HARDCODED Audit log data that failed:`, JSON.stringify(hardcodedLogData, null, 2));
    throw e; // Re-throw the error
  }
}
