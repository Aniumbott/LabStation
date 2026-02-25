'use server';

import { prisma } from '@/lib/prisma';
import { verifyUserRole } from './helpers';

export async function markNotificationRead_SA(input: {
  callerUserId: string;
  notificationId: string;
}): Promise<{ success: boolean; message?: string }> {
  if (!input.callerUserId || !input.notificationId) {
    return { success: false, message: 'Missing required fields.' };
  }

  await verifyUserRole(input.callerUserId, ['Admin', 'Technician', 'Researcher']);

  const notification = await prisma.notification.findUnique({
    where: { id: input.notificationId },
  });
  if (!notification) {
    return { success: false, message: 'Notification not found.' };
  }

  // Verify ownership
  if (notification.userId !== input.callerUserId) {
    return { success: false, message: 'You can only manage your own notifications.' };
  }

  try {
    await prisma.notification.update({
      where: { id: input.notificationId },
      data: { isRead: true },
    });
    return { success: true };
  } catch (error: unknown) {
    console.error('[markNotificationRead_SA] Error:', error);
    return { success: false, message: 'Failed to mark notification as read.' };
  }
}

export async function markAllNotificationsRead_SA(input: {
  callerUserId: string;
}): Promise<{ success: boolean; message?: string }> {
  if (!input.callerUserId) {
    return { success: false, message: 'Missing required fields.' };
  }

  await verifyUserRole(input.callerUserId, ['Admin', 'Technician', 'Researcher']);

  try {
    await prisma.notification.updateMany({
      where: { userId: input.callerUserId, isRead: false },
      data: { isRead: true },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[markAllNotificationsRead_SA] Error:', error);
    return { success: false, message: 'Failed to mark all notifications as read.' };
  }
}

export async function deleteNotification_SA(input: {
  callerUserId: string;
  notificationId: string;
}): Promise<{ success: boolean; message?: string }> {
  if (!input.callerUserId || !input.notificationId) {
    return { success: false, message: 'Missing required fields.' };
  }

  await verifyUserRole(input.callerUserId, ['Admin', 'Technician', 'Researcher']);

  const notification = await prisma.notification.findUnique({
    where: { id: input.notificationId },
  });
  if (!notification) {
    return { success: false, message: 'Notification not found.' };
  }

  if (notification.userId !== input.callerUserId) {
    return { success: false, message: 'You can only manage your own notifications.' };
  }

  try {
    await prisma.notification.delete({
      where: { id: input.notificationId },
    });
    return { success: true };
  } catch (error: unknown) {
    console.error('[deleteNotification_SA] Error:', error);
    return { success: false, message: 'Failed to delete notification.' };
  }
}

export async function deleteAllNotifications_SA(input: {
  callerUserId: string;
}): Promise<{ success: boolean; message?: string }> {
  if (!input.callerUserId) {
    return { success: false, message: 'Missing required fields.' };
  }

  await verifyUserRole(input.callerUserId, ['Admin', 'Technician', 'Researcher']);

  try {
    await prisma.notification.deleteMany({
      where: { userId: input.callerUserId },
    });

    return { success: true };
  } catch (error: unknown) {
    console.error('[deleteAllNotifications_SA] Error:', error);
    return { success: false, message: 'Failed to delete all notifications.' };
  }
}
