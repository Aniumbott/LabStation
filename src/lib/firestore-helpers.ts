
'use server';

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Notification as NotificationAppType, NotificationType, AuditLogEntry, AuditActionType } from '@/types';


export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string
): Promise<void> {
  if (!userId || !title || !message || !type) {
    console.error("addNotification called with invalid or missing critical parameters:", { userId, title, message, type });
    // Potentially throw an error or return early if critical data is missing
    return;
  }

  const newNotificationData: Omit<NotificationAppType, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
    userId,
    title,
    message,
    type,
    isRead: false,
    linkTo: linkTo, // Firestore handles undefined by not storing the field
    createdAt: serverTimestamp() as Timestamp,
  };

  console.log("[firestore-helpers] Attempting to add notification to Firestore. Data:", JSON.stringify(newNotificationData, null, 2));

  try {
    const docRef = await addDoc(collection(db, 'notifications'), newNotificationData);
    console.log("[firestore-helpers] Successfully added notification to Firestore. Doc ID:", docRef.id, "For user:", userId, "Type:", type, "Title:", title);
  } catch (e: any) {
    console.error("[firestore-helpers] Error adding notification to Firestore. Full error object:", e);
    console.error("[firestore-helpers] Notification data that failed to add:", JSON.stringify(newNotificationData, (key, value) => {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Timestamp') {
            return '[Firebase Timestamp]';
        }
        return value;
    }, 2));
    // Optionally re-throw to be caught by the caller
    // throw e; 
  }
}

export async function addAuditLog(
  actingUserId: string,
  actingUserName: string,
  action: AuditActionType,
  params: {
    entityType?: AuditLogEntry['entityType'];
    entityId?: string;
    details: string;
  }
): Promise<void> {
  if (!actingUserId || !actingUserName || !action || !params.details) {
    console.error("addAuditLog called with invalid or missing critical parameters:", { actingUserId, actingUserName, action, params });
    return;
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
  try {
    const docRef = await addDoc(collection(db, 'auditLogs'), newLogData);
    console.log("[firestore-helpers] Audit log added to Firestore. Doc ID:", docRef.id, "For action:", action);
  } catch (e: any) {
    console.error("[firestore-helpers] Error adding audit log to Firestore:", e);
     console.error("[firestore-helpers] Audit log data that failed to add:", JSON.stringify(newLogData, (key, value) => {
        if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'Timestamp') {
            return '[Firebase Timestamp]';
        }
        return value;
    }, 2));
  }
}
