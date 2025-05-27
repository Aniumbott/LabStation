
'use server';

import { db, auth } from '@/lib/firebase'; // auth is firebase client SDK
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Notification as NotificationAppType, NotificationType, AuditLogEntry, AuditActionType } from '@/types';

export async function addNotification(
  userId: string, // Recipient ID
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string | undefined // Kept linkTo as it's a common field and might be useful later
): Promise<void> {
  console.log("--- [firestore-helpers/addNotification V4 DEBUG] ENTERING FUNCTION ---");
  console.log("[firestore-helpers/addNotification V4 DEBUG] Parameters received:", { userId, title, message, type, linkTo });

  if (!userId || !title || !message || !type) {
    const errorMsg = "[firestore-helpers/addNotification V4 DEBUG] CRITICAL: Missing required parameters.";
    console.error(errorMsg, { userId, title, message, type });
    throw new Error("addNotification: Critical parameters (userId, title, message, or type) are missing or falsy.");
  }

  // SUPER MINIMAL payload for testing Firestore permissions
  const newNotificationData = {
    userId: userId,
    title: title,
    message: message,
    type: type,
    createdAt: serverTimestamp() as Timestamp,
    // Temporarily removing isRead and linkTo for extreme debugging
    isRead: false, // Firestore needs a defined value if the field is part of an index or rule logic, let's keep it simple.
    // linkTo: linkTo, // Temporarily removed
  };

  console.log("[firestore-helpers/addNotification V4 DEBUG] Attempting to add VERY MINIMAL notification to Firestore. Data:", JSON.stringify(newNotificationData));

  try {
    const docRef = await addDoc(collection(db, 'notifications'), newNotificationData);
    console.log("!!! SUCCESS !!! [firestore-helpers/addNotification V4 DEBUG] Successfully added VERY MINIMAL notification to Firestore. Doc ID:", docRef.id, "For user:", userId);
  } catch (e: any) {
    const errorMsg = "!!! FIRESTORE ERROR IN addNotification (V4 DEBUG) !!!";
    console.error(errorMsg, "Error object:", e);
    console.error("[firestore-helpers/addNotification V4 DEBUG] Data that failed:", JSON.stringify(newNotificationData));
    if (e.code === 7 || e.code === 'permission-denied') {
        console.error("Firebase detailed error code for PERMISSION_DENIED:", e.code, e.toString());
    }
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
  console.log("--- [firestore-helpers/addAuditLog] ENTERING FUNCTION ---");
  console.log("[firestore-helpers/addAuditLog] Parameters received:", { actingUserId, actingUserName, action, params });

  if (!actingUserId || !actingUserName || !action || !params.details) {
    const errorMsg = "[firestore-helpers/addAuditLog] CRITICAL: Called with invalid or missing parameters.";
    console.error(errorMsg, { actingUserId, actingUserName, action, params });
    throw new Error("addAuditLog: Critical parameters (actingUserId, actingUserName, action, or params.details) are missing or falsy.");
  }

  const newLogData: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp: Timestamp } = {
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
    timestamp: serverTimestamp() as Timestamp,
  };

  console.log("[firestore-helpers/addAuditLog] Attempting to add audit log to Firestore. Data:", JSON.stringify(newLogData, null, 2));

  try {
    const docRef = await addDoc(collection(db, 'auditLogs'), newLogData);
    console.log(`!!! SUCCESS !!! [firestore-helpers/addAuditLog] Successfully added audit log. Doc ID: ${docRef.id}`);
  } catch (e: any) {
    const errorMsg = "!!! FIRESTORE ERROR IN addAuditLog !!!";
    console.error(errorMsg, "Error object:", e);
    console.error("[firestore-helpers/addAuditLog] Audit log data that failed to add:", JSON.stringify(newLogData, (key, value) => {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Timestamp') {
            return '[Firebase Timestamp]';
        }
        return value;
    }, 2));
    throw e;
  }
}
