
'use server';

import { adminDb } from '@/lib/firebase-admin'; // Import Admin SDK Firestore
import { FieldValue } from 'firebase-admin/firestore'; // Import Admin SDK FieldValue for serverTimestamp
import type { Notification as NotificationAppType, AuditLogEntry, AuditActionType, NotificationType as AppNotificationType } from '@/types';

// IMPORTANT:
// These functions now use the Firebase Admin SDK. This means they will BYPASS
// Firestore security rules by default. Ensure that these server actions are
// themselves protected (e.g., only callable by authenticated users through Next.js mechanisms)
// and that the logic within them correctly determines who can perform actions
// and for whom notifications/logs are created.

export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: AppNotificationType,
  linkToParam?: string | undefined
): Promise<void> {
  const functionName = "addNotification V10 (Admin SDK)";
  console.log(`--- [${functionName}] ENTERING FUNCTION ---`);
  console.log(`[${functionName}] Server Context Check (typeof window): ${typeof window}`);

  const paramsReceived = { userId, title, message, type, linkToParam };
  console.log(`[${functionName}] Parameters received:`, JSON.stringify(paramsReceived, null, 2));

  if (!userId || !title || !message || !type) {
    const errorMsg = `!!! CRITICAL ERROR IN ${functionName} !!! Missing required parameters. Data: ${JSON.stringify(paramsReceived, null, 2)}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const finalLinkTo = typeof linkToParam === 'string' && linkToParam.trim() !== '' ? linkToParam.trim() : undefined;

  // Using Admin SDK - Omit 'id' as Firestore Admin SDK generates it.
  // Use Admin SDK FieldValue for serverTimestamp.
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

  console.log(`[${functionName}] Attempting to add notification to Firestore using Admin SDK. Data:`, JSON.stringify(newNotificationData, null, 2));

  try {
    const docRef = await adminDb.collection('notifications').add(newNotificationData);
    console.log(`!!! SUCCESS !!! [${functionName}] Successfully added notification using Admin SDK. Doc ID: ${docRef.id}`);
  } catch (e: any) {
    console.error(`!!! FIRESTORE ADMIN SDK ERROR IN ${functionName} !!!`);
    console.error(`[${functionName}] Error Code:`, e.code);
    console.error(`[${functionName}] Error Message:`, e.message);
    if (e.details) {
      console.error(`[${functionName}] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName}] Error Stack:`, e.stack ? e.stack.split('\\n').slice(0, 7).join('\\n') : 'No stack');
    console.error(`[${functionName}] Notification data that failed:`, JSON.stringify(newNotificationData, null, 2));
    throw e; // Re-throw the error
  }
}

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
  const functionName = "addAuditLog V10 (Admin SDK)";
  console.log(`--- [${functionName}] ENTERING FUNCTION ---`);
  console.log(`[${functionName}] Server Context Check (typeof window): ${typeof window}`);

  const paramsReceived = { actingUserId, actingUserName, action, params };
  console.log(`[${functionName}] Parameters received:`, JSON.stringify(paramsReceived, null, 2));

  if (!actingUserId || !actingUserName || !action || !params.details) {
    const errorMsg = `!!! CRITICAL ERROR IN ${functionName} !!! Missing required parameters. Data: ${JSON.stringify(paramsReceived, null, 2)}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  // Using Admin SDK - Omit 'id' as Firestore Admin SDK generates it.
  // Use Admin SDK FieldValue for serverTimestamp.
  const newLogData: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp: FieldValue } & { entityType?: string, entityId?: string } = {
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    details: params.details,
    timestamp: FieldValue.serverTimestamp(),
  };

  if (params.entityType) newLogData.entityType = params.entityType;
  if (params.entityId) newLogData.entityId = params.entityId;

  console.log(`[${functionName}] Attempting to add audit log to Firestore using Admin SDK. Data:`, JSON.stringify(newLogData, null, 2));

  try {
    const docRef = await adminDb.collection('auditLogs').add(newLogData);
    console.log(`!!! SUCCESS !!! [${functionName}] Successfully added audit log using Admin SDK. Doc ID: ${docRef.id}`);
  } catch (e: any) {
    console.error(`!!! FIRESTORE ADMIN SDK ERROR IN ${functionName} !!!`);
    console.error(`[${functionName}] Error Code:`, e.code);
    console.error(`[${functionName}] Error Message:`, e.message);
    if (e.details) {
      console.error(`[${functionName}] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName}] Error Stack:`, e.stack ? e.stack.split('\\n').slice(0, 7).join('\\n') : 'No stack');
    console.error(`[${functionName}] Audit log data that failed:`, JSON.stringify(newLogData, null, 2));
    throw e; // Re-throw the error
  }
}
