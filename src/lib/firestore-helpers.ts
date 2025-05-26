
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Notification as NotificationAppType, NotificationType, AuditLogEntry, AuditActionType } from '@/types';


export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string | undefined
): Promise<void> {
  console.log("--- [firestore-helpers/addNotification] ENTERING FUNCTION ---");
  console.log("Parameters received:", { userId, title, message, type, linkTo });

  if (!userId || !title || !message || !type) {
    console.error("!!! CRITICAL ERROR IN addNotification !!! Missing required parameters. Aborting notification creation.", { userId, title, message, type });
    // For debugging, let's throw an error here to make it very obvious if this happens
    throw new Error("addNotification: Critical parameters (userId, title, message, or type) are missing or falsy.");
  }

  // TEMPORARY: Simplified data payload for debugging
  const newNotificationDataForDebug: any = {
    userId: userId,
    title: title,
    message: message,
    type: type,
    createdAt: serverTimestamp() as Timestamp,
    // isRead: false, // Temporarily removed
    // linkTo: linkTo, // Temporarily removed
  };

  console.log("[firestore-helpers/addNotification] Attempting to add SIMPLIFIED notification to Firestore. Data:", JSON.stringify(newNotificationDataForDebug, null, 2));

  try {
    const docRef = await addDoc(collection(db, 'notifications'), newNotificationDataForDebug);
    console.log("!!! SUCCESS !!! [firestore-helpers/addNotification] Successfully added SIMPLIFIED notification to Firestore. Doc ID:", docRef.id, "For user:", userId);
  } catch (e: any) {
    console.error("!!! FIRESTORE ERROR IN addNotification !!! Error adding SIMPLIFIED notification. Full error object:", e);
    console.error("Data that failed:", JSON.stringify(newNotificationDataForDebug, (key, value) => {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Timestamp') {
            return '[Firebase Timestamp]';
        }
        return value;
    }, 2));
    // Re-throwing the error so call sites can also catch it and display a toast, if they have try/catch
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
    details: string;
  }
): Promise<void> {
  if (!actingUserId || !actingUserName || !action || !params.details) {
    console.error("[firestore-helpers/addAuditLog] CRITICAL: Called with invalid or missing parameters.", { actingUserId, actingUserName, action, params });
    return;
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
  // console.log("[firestore-helpers/addAuditLog] Attempting to add audit log to Firestore. Data:", JSON.stringify(newLogData, null, 2));
  try {
    const docRef = await addDoc(collection(db, 'auditLogs'), newLogData);
    // console.log("[firestore-helpers/addAuditLog] Audit log added to Firestore. Doc ID:", docRef.id, "For action:", action);
  } catch (e: any) {
    console.error("[firestore-helpers/addAuditLog] Error adding audit log to Firestore:", e);
     console.error("[firestore-helpers/addAuditLog] Audit log data that failed to add:", JSON.stringify(newLogData, (key, value) => {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Timestamp') {
            return '[Firebase Timestamp]';
        }
        return value;
    }, 2));
  }
}
