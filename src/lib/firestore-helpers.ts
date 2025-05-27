
'use server';

import { db, auth } from '@/lib/firebase'; // Ensure auth is imported
import { collection, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import type { Notification as NotificationAppType, NotificationType, AuditLogEntry, AuditActionType } from '@/types';


export async function addNotification(
  userId: string, // Recipient ID
  title: string,
  message: string,
  type: NotificationType,
  linkTo?: string | undefined
): Promise<void> {
  console.log("--- [firestore-helpers/addNotification V2 DEBUG] ENTERING FUNCTION ---");
  const currentFirebaseUser = auth.currentUser; // Get current auth state *directly* from Firebase JS SDK
  
  if (!currentFirebaseUser) {
    console.error("!!! CRITICAL ERROR IN addNotification V2 DEBUG !!! Firebase JS SDK reports NO authenticated user (auth.currentUser is null) at function entry. Aborting notification creation.");
    // It's possible the Firestore rules check request.auth, which might differ if the token is stale,
    // but this client-side check is a strong indicator.
    throw new Error("addNotification: Client-side Firebase auth.currentUser is null. Cannot create notification.");
  }
  console.log("[firestore-helpers/addNotification V2 DEBUG] Client-side Firebase Auth User UID:", currentFirebaseUser.uid);
  console.log("[firestore-helpers/addNotification V2 DEBUG] Parameters received:", { userId, title, message, type, linkTo });


  if (!userId || !title || !message || !type) {
    console.error("!!! CRITICAL ERROR IN addNotification V2 DEBUG !!! Missing required parameters.", { userId, title, message, type });
    throw new Error("addNotification: Critical parameters (userId, title, message, or type) are missing or falsy.");
  }

  // EXTREMELY SIMPLIFIED PAYLOAD FOR DEBUGGING
  // Using only fields that are absolutely necessary and have simple string types
  // Temporarily using a client-side timestamp to rule out serverTimestamp() issues.
  const minimalNotificationData: any = {
    userId: userId, 
    title: title,   
    message: `DEBUG PAYLOAD V2: ${message}`, 
    type: type,     
    debugClientCreatedAt: new Date().toISOString(), 
    // isRead: false, // Intentionally removed for debugging
    // linkTo: linkTo, // Intentionally removed for debugging
    // createdAt: serverTimestamp(), // Temporarily replaced
  };

  console.log("[firestore-helpers/addNotification V2 DEBUG] Attempting to add EXTREMELY SIMPLIFIED notification to Firestore. Data:", JSON.stringify(minimalNotificationData));

  try {
    const docRef = await addDoc(collection(db, 'notifications'), minimalNotificationData);
    console.log("!!! SUCCESS !!! [firestore-helpers/addNotification V2 DEBUG] Successfully added EXTREMELY SIMPLIFIED notification to Firestore. Doc ID:", docRef.id, "For user:", userId);
  } catch (e: any) {
    console.error("!!! FIRESTORE ERROR IN addNotification V2 DEBUG !!! Error adding EXTREMELY SIMPLIFIED notification. Full error object:", e);
    console.error("[firestore-helpers/addNotification V2 DEBUG] Data that failed:", JSON.stringify(minimalNotificationData));
    if (e.code === 7 || e.code === 'permission-denied') { // Explicitly check for permission denied code
        console.error("Firebase detailed error code for PERMISSION_DENIED:", e.code, e.toString());
    }
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
  if (!actingUserId || !actingUserName || !action || !params.details) {
    console.error("[firestore-helpers/addAuditLog] CRITICAL: Called with invalid or missing parameters.", { actingUserId, actingUserName, action, params });
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
