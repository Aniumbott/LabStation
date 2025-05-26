
'use server'; 

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Notification as NotificationAppType, NotificationType, AuditLogEntry, AuditActionType } from '@/types'; // Renamed Notification to NotificationAppType


export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string 
): Promise<void> {
  const newNotificationData: Omit<NotificationAppType, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
    userId,
    title,
    message,
    type,
    isRead: false,
    linkTo: linkTo, // Will be undefined if not passed, which Firestore handles well
    createdAt: serverTimestamp() as Timestamp, 
  };
  try {
    await addDoc(collection(db, 'notifications'), newNotificationData);
    console.log("Notification added to Firestore for user:", userId, "Type:", type);
  } catch (e) {
    console.error("Error adding notification to Firestore: ", e);
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
  const newLogData: Omit<AuditLogEntry, 'id' | 'timestamp'> & { timestamp: any } = {
    userId: actingUserId,
    userName: actingUserName,
    action: action,
    entityType: params.entityType || undefined, // Store undefined if not provided
    entityId: params.entityId || undefined,     // Store undefined if not provided
    details: params.details,
    timestamp: serverTimestamp(), 
  };
  try {
    await addDoc(collection(db, 'auditLogs'), newLogData);
    console.log("Audit log added to Firestore for action:", action);
  } catch (e) {
    console.error("Error adding audit log to Firestore: ", e);
  }
}

