
'use server'; // Potentially, if these are ever called from Server Components directly. For now, client-side calls are fine.

import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Notification, NotificationType, AuditLogEntry, AuditActionType } from '@/types';

export async function addNotification(
  userId: string,
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string
): Promise<void> {
  const newNotificationData: Omit<Notification, 'id' | 'createdAt'> & { createdAt: Timestamp } = {
    userId,
    title,
    message,
    type,
    isRead: false,
    linkTo: linkTo || null,
    createdAt: serverTimestamp() as Timestamp, // Use Firestore server timestamp
  };
  try {
    await addDoc(collection(db, 'notifications'), newNotificationData);
    console.log("Notification added to Firestore for user:", userId);
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
    entityType: params.entityType || null,
    entityId: params.entityId || null,
    details: params.details,
    timestamp: serverTimestamp(), // Use Firestore server timestamp
  };
  try {
    await addDoc(collection(db, 'auditLogs'), newLogData);
    console.log("Audit log added to Firestore for action:", action);
  } catch (e) {
    console.error("Error adding audit log to Firestore: ", e);
  }
}
