
'use server';

import { db } from '@/lib/firebase'; // db is client SDK Firestore
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Notification as NotificationAppType, NotificationType as AppNotificationType, AuditLogEntry, AuditActionType } from '@/types';

export async function addNotification(
  userId: string, // Recipient ID
  title: string,
  message: string,
  type: AppNotificationType,
  linkToParam?: string | null | undefined // Explicitly allow null/undefined from call site
): Promise<void> {
  const functionName = "addNotification";
  console.log(`--- [${functionName} V3 DEBUG] ENTERING FUNCTION ---`);
  const receivedParams = { userId, title, message, type, linkToParam };
  console.log(`[${functionName} V3 DEBUG] Parameters received:`, JSON.stringify(receivedParams));

  if (!userId || !title || !message || !type) {
    const errorMsg = `${functionName}: Critical parameters (userId, title, message, or type) are missing or falsy.`;
    console.error(`!!! CRITICAL ERROR IN ${functionName} !!!`, errorMsg, receivedParams);
    throw new Error(errorMsg);
  }

  // Ensure linkTo is either a valid string or undefined
  const finalLinkTo = (linkToParam && typeof linkToParam === 'string' && linkToParam.trim() !== '') ? linkToParam.trim() : undefined;

  // Construct the data to be saved, ensuring all fields are defined as per NotificationAppType or are optional
  const newNotificationData: Omit<NotificationAppType, 'id'> & { createdAt: Timestamp } = {
    userId: userId,
    title: title,
    message: message,
    type: type,
    createdAt: serverTimestamp() as Timestamp,
    isRead: false, // Default isRead to false
  };

  if (finalLinkTo !== undefined) {
    newNotificationData.linkTo = finalLinkTo;
  }

  console.log(`[${functionName} V3 DEBUG] Attempting to add notification to Firestore. Data:`, JSON.stringify(newNotificationData));

  try {
    const docRef = await addDoc(collection(db, 'notifications'), newNotificationData);
    console.log(`!!! SUCCESS !!! [${functionName} V3 DEBUG] Successfully added notification to Firestore. Doc ID:`, docRef.id, "For user:", userId);
  } catch (e: any) {
    console.error(`!!! FIRESTORE ERROR IN ${functionName} !!!`, "Error object:", e);
    if (e.details) {
      console.error(`[${functionName} V3 DEBUG] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName} V3 DEBUG] Data that failed:`, JSON.stringify(newNotificationData));
    throw e; // Re-throw the error to be caught by the caller
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
  const functionName = "addAuditLog";
  console.log(`--- [${functionName}] ENTERING FUNCTION ---`);
  const receivedParams = { actingUserId, actingUserName, action, params };
  console.log(`[${functionName}] Parameters received:`, JSON.stringify(receivedParams));

  if (!actingUserId || !actingUserName || !action || !params.details) {
    const errorMsg = `${functionName}: Critical parameters (actingUserId, actingUserName, action, or params.details) are missing or falsy.`;
    console.error(`!!! CRITICAL ERROR IN ${functionName} !!!`, errorMsg, receivedParams);
    throw new Error(errorMsg); // Throw an error for explicit failure
  }

  const newLogData: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp: Timestamp } = {
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    entityType: params.entityType, // Will be undefined if not provided
    entityId: params.entityId,     // Will be undefined if not provided
    details: params.details,
    timestamp: serverTimestamp() as Timestamp,
  };

  console.log(`[${functionName}] Attempting to add audit log to Firestore. Data:`, JSON.stringify(newLogData, null, 2));

  try {
    const docRef = await addDoc(collection(db, 'auditLogs'), newLogData);
    console.log(`!!! SUCCESS !!! [${functionName}] Successfully added audit log. Doc ID: ${docRef.id}`);
  } catch (e: any) {
    console.error(`!!! FIRESTORE ERROR IN ${functionName} !!!`, "Error object:", e);
    if (e.details) {
      console.error(`[${functionName}] Firestore Error Details:`, e.details);
    }
    console.error(`[${functionName}] Audit log data that failed to add:`, JSON.stringify(newLogData, (key, value) => {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Timestamp') {
            return '[Firebase Timestamp]';
        }
        return value;
    }, 2));
    throw e; // Re-throw the error
  }
}
