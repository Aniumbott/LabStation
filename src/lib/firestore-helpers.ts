
'use server';

import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import type { Notification as NotificationAppType, AuditLogEntry, AuditActionType, NotificationType as AppNotificationType } from '@/types';

export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: AppNotificationType,
  linkToParam?: string | undefined
): Promise<void> {
  const functionName = "addNotification V7 (Admin SDK)";
  // console.log(`--- [${functionName}] ENTERING FUNCTION ---`);

  const paramsReceived = { userId, title, message, type, linkToParam };
  // console.log(`[${functionName}] Parameters received:`, JSON.stringify(paramsReceived, null, 2));

  if (!userId || !title || !message || !type) {
    const errorMsg = `!!! CRITICAL ERROR IN ${functionName} !!! Missing required parameters. Data: ${JSON.stringify(paramsReceived, null, 2)}`;
    console.error(errorMsg);
    throw new Error(errorMsg);
  }

  const finalLinkTo = typeof linkToParam === 'string' && linkToParam.trim() !== '' ? linkToParam.trim() : undefined;

  const newNotificationData: Omit<NotificationAppType, 'id' | 'createdAt'> & { createdAt: FieldValue } & { linkTo?: string } = {
    userId: userId, // This is the recipient's User ID
    title: title,
    message: message,
    type: type,
    isRead: false,
    createdAt: FieldValue.serverTimestamp(),
  };
  if (finalLinkTo !== undefined) {
    newNotificationData.linkTo = finalLinkTo;
  }

  // console.log(`[${functionName}] Attempting to add notification to Firestore using Admin SDK. Data:`, JSON.stringify(newNotificationData, null, 2));

  try {
    const docRef = await adminDb.collection('notifications').add(newNotificationData);
    console.log(`[${functionName}] Successfully added notification. Doc ID: ${docRef.id}, UserID: ${userId}, Type: ${type}`);
  } catch (e: any) {
    console.error(`!!! FIRESTORE ADMIN SDK ERROR IN ${functionName} !!!`);
    console.error(`[${functionName}] Error Code:`, e.code);
    console.error(`[${functionName}] Error Message:`, e.message);
    if (e.details) {
      console.error(`[${functionName}] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName}] Notification data that failed:`, JSON.stringify(newNotificationData, null, 2));
    throw e; // Re-throw the error so the caller can handle it (e.g., show a toast)
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
  const functionName = "addAuditLog V7 (Admin SDK)";
  // console.log(`--- [${functionName}] ENTERING FUNCTION ---`);

  const paramsReceived = { actingUserId, actingUserName, action, params };
  // console.log(`[${functionName}] Parameters received:`, JSON.stringify(paramsReceived, null, 2));

  if (!actingUserId || !actingUserName || !action || !params.details) {
    const errorMsg = `!!! CRITICAL ERROR IN ${functionName} !!! Missing required parameters. Data: ${JSON.stringify(paramsReceived, null, 2)}`;
    console.error(errorMsg);
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

  // console.log(`[${functionName}] Attempting to add audit log to Firestore using Admin SDK. Data:`, JSON.stringify(newLogData, null, 2));

  try {
    const docRef = await adminDb.collection('auditLogs').add(newLogData);
    console.log(`[${functionName}] Successfully added audit log. Doc ID: ${docRef.id}, Action: ${action}, User: ${actingUserName}`);
  } catch (e: any) {
    console.error(`!!! FIRESTORE ADMIN SDK ERROR IN ${functionName} !!!`);
    console.error(`[${functionName}] Error Code:`, e.code);
    console.error(`[${functionName}] Error Message:`, e.message);
    if (e.details) {
      console.error(`[${functionName}] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName}] Audit log data that failed:`, JSON.stringify(newLogData, null, 2));
    throw e; // Re-throw the error
  }
}
