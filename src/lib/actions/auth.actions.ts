'use server';

import { prisma } from '@/lib/prisma';
import { verifyPassword, hashPassword } from '@/lib/auth';
import { ChangePasswordSchema } from './validation';
import { addAuditLog } from '@/lib/db-helpers';

export async function changePassword_SA(input: {
  callerUserId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ success: boolean; message: string }> {
  const parsed = ChangePasswordSchema.parse(input);

  try {
    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: parsed.callerUserId },
    });

    if (!user) {
      return { success: false, message: 'User not found.' };
    }

    // Verify current password with bcrypt
    const isPasswordValid = await verifyPassword(parsed.currentPassword, user.passwordHash);
    if (!isPasswordValid) {
      return { success: false, message: 'Current password is incorrect.' };
    }

    // Hash new password and update
    const newPasswordHash = await hashPassword(parsed.newPassword);
    await prisma.user.update({
      where: { id: parsed.callerUserId },
      data: { passwordHash: newPasswordHash },
    });

    // Audit log
    try {
      await addAuditLog(parsed.callerUserId, user.name, 'USER_UPDATED', {
        entityType: 'User',
        entityId: parsed.callerUserId,
        details: `User ${user.name} changed their password.`,
      });
    } catch {
      // Audit log failure shouldn't block password change
    }

    return { success: true, message: 'Password changed successfully.' };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'An unexpected error occurred.';
    console.error('[changePassword_SA] Error:', message);
    return { success: false, message: 'Failed to change password. Please try again.' };
  }
}
