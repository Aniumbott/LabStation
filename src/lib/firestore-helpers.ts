
'use server';

import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Notification as NotificationAppType, NotificationType, AuditLogEntry, AuditActionType } from '@/types';


export async function addNotification(
  userId: string, // Recipient ID
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string | undefined
): Promise<void> {
  console.log("--- [firestore-helpers/addNotification V3 DEBUG] ENTERING FUNCTION ---");
  console.log("[firestore-helpers/addNotification V3 DEBUG] Parameters received:", { userId, title, message, type, linkTo });

  if (!userId || !title || !message || !type) {
    const errorMsg = "[firestore-helpers/addNotification V3 DEBUG] CRITICAL: Missing required parameters.";
    console.error(errorMsg, { userId, title, message, type });
    // For server actions, it's often better to throw to signal failure to the client explicitly.
    throw new Error("addNotification: Critical parameters (userId, title, message, or type) are missing or falsy.");
  }

  // In a server action context, auth.currentUser (from client SDK) will be null.
  // Authentication is handled by Next.js for invoking the action, and Firestore rules
  // will use request.auth. The check for auth.currentUser has been removed.

  const newNotificationData: Omit<NotificationAppType, 'id' | 'isRead' | 'createdAt'> & { createdAt: Timestamp, isRead: boolean } = {
    userId: userId,
    title: title,
    message: message,
    type: type,
    linkTo: linkTo, // linkTo can be undefined, Firestore handles this by not storing the field
    isRead: false,
    createdAt: serverTimestamp() as Timestamp,
  };

  console.log("[firestore-helpers/addNotification V3 DEBUG] Attempting to add notification to Firestore. Data:", JSON.stringify(newNotificationData));

  try {
    const docRef = await addDoc(collection(db, 'notifications'), newNotificationData);
    console.log("!!! SUCCESS !!! [firestore-helpers/addNotification V3 DEBUG] Successfully added notification to Firestore. Doc ID:", docRef.id, "For user:", userId);
  } catch (e: any) {
    const errorMsg = "[firestore-helpers/addNotification V3 DEBUG] FIRESTORE ERROR when adding notification.";
    console.error(errorMsg, "Error object:", e);
    console.error("[firestore-helpers/addNotification V3 DEBUG] Data that failed:", JSON.stringify(newNotificationData));
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
  if (!actingUserId || !actingUserName || !action || !params.details) {
    const errorMsg = "[firestore-helpers/addAuditLog] CRITICAL: Called with invalid or missing parameters.";
    console.error(errorMsg, { actingUserId, actingUserName, action, params });
    throw new Error(errorMsg); // Throw error instead of just returning
  }

  // entityType and entityId can be undefined if not provided in params.
  // Firestore handles undefined fields by not writing them, which is acceptable.
  const newLogData: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp: Timestamp } = {
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    entityType: params.entityType,
    entityId: params.entityId,
    details: params.details,
    timestamp: serverTimestamp() as Timestamp,
  };

  try {
    const docRef = await addDoc(collection(db, 'auditLogs'), newLogData);
    console.log(`[firestore-helpers/addAuditLog] Successfully added audit log. Doc ID: ${docRef.id}`); // Added success log
  } catch (e: any) {
    console.error("[firestore-helpers/addAuditLog] Error adding audit log to Firestore:", e);
    console.error("[firestore-helpers/addAuditLog] Audit log data that failed to add:", JSON.stringify(newLogData, (key, value) => {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Timestamp') {
            return '[Firebase Timestamp]';
        }
        return value;
    }, 2));
    throw e; // Re-throw to ensure the caller is aware and it can be handled (e.g. to prevent 500)
  }
}
