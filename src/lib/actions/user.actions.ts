'use server';

import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { verifyUserRole } from './helpers';
import { CreateUserProfileSchema, ApproveUserSchema, RejectUserSchema, DeleteUserSchema, UpdateUserProfileSchema, UpdateUserRoleSchema } from './validation';
import { addAuditLog, addNotification } from '@/lib/db-helpers';
import { PLACEHOLDER_AVATAR } from '@/lib/app-constants';

export async function createUserProfile_SA(input: {
  callerUserId: string;
  name: string;
  email: string;
  role: 'Admin' | 'Technician' | 'Researcher';
}): Promise<{ success: boolean; userId?: string; message?: string }> {
  const parsed = CreateUserProfileSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  // Check email uniqueness
  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.email },
  });
  if (existingUser) {
    return { success: false, message: 'A user with this email already exists.' };
  }

  try {
    // Generate a default password hash for admin-created users
    const defaultPasswordHash = await hashPassword('changeme123');

    const newUser = await prisma.user.create({
      data: {
        name: parsed.name,
        email: parsed.email,
        role: parsed.role,
        passwordHash: defaultPasswordHash,
        avatarUrl: PLACEHOLDER_AVATAR,
        status: 'active',
        mustChangePassword: true,
      },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'USER_CREATED', {
        entityType: 'User', entityId: newUser.id,
        details: `Admin ${caller.name} created user profile for ${parsed.name} (${parsed.email}) with role ${parsed.role}.`,
      });
    } catch { /* ok */ }

    return { success: true, userId: newUser.id };
  } catch (error: unknown) {
    console.error('[createUserProfile_SA] Error:', error);
    return { success: false, message: 'Failed to create user.' };
  }
}

export async function approveUser_SA(input: {
  callerUserId: string;
  targetUserId: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = ApproveUserSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const user = await prisma.user.findUnique({
    where: { id: parsed.targetUserId },
  });
  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  if (user.status !== 'pending_approval') {
    return { success: false, message: `User status is '${user.status}', not 'pending_approval'.` };
  }

  try {
    await prisma.user.update({
      where: { id: parsed.targetUserId },
      data: { status: 'active' },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'USER_APPROVED', {
        entityType: 'User', entityId: parsed.targetUserId,
        details: `Admin ${caller.name} approved user ${user.name} (${user.email}).`,
      });
    } catch { /* ok */ }

    try {
      await addNotification(parsed.targetUserId, 'Account Approved!', 'Your account has been approved. You can now use the system.', 'signup_approved', '/dashboard');
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[approveUser_SA] Error:', error);
    return { success: false, message: 'Failed to approve user.' };
  }
}

export async function rejectUser_SA(input: {
  callerUserId: string;
  targetUserId: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = RejectUserSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const user = await prisma.user.findUnique({
    where: { id: parsed.targetUserId },
  });
  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  try {
    await prisma.user.delete({
      where: { id: parsed.targetUserId },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'USER_REJECTED', {
        entityType: 'User', entityId: parsed.targetUserId,
        details: `Admin ${caller.name} rejected user ${user.name} (${user.email}).`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[rejectUser_SA] Error:', error);
    return { success: false, message: 'Failed to reject user.' };
  }
}

export async function deleteUser_SA(input: {
  callerUserId: string;
  targetUserId: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = DeleteUserSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  if (parsed.callerUserId === parsed.targetUserId) {
    return { success: false, message: 'You cannot delete your own account.' };
  }

  const user = await prisma.user.findUnique({
    where: { id: parsed.targetUserId },
  });
  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  try {
    // Delete lab memberships first (LabMembership has onDelete: Cascade on user,
    // but we count them for the audit log)
    const membershipCount = await prisma.labMembership.count({
      where: { userId: parsed.targetUserId },
    });

    // Delete user (cascades to labMemberships, notifications)
    await prisma.user.delete({
      where: { id: parsed.targetUserId },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'USER_DELETED', {
        entityType: 'User', entityId: parsed.targetUserId,
        details: `Admin ${caller.name} deleted user ${user.name} (${user.email}) and ${membershipCount} lab membership(s).`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[deleteUser_SA] Error:', error);
    return { success: false, message: 'Failed to delete user.' };
  }
}

export async function updateUserProfile_SA(input: {
  callerUserId: string;
  targetUserId: string;
  name?: string;
  role?: 'Admin' | 'Technician' | 'Researcher';
  avatarUrl?: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = UpdateUserProfileSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const user = await prisma.user.findUnique({
    where: { id: parsed.targetUserId },
  });
  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.role !== undefined) updateData.role = parsed.role;
    if (parsed.avatarUrl !== undefined) updateData.avatarUrl = parsed.avatarUrl;

    if (Object.keys(updateData).length === 0) {
      return { success: false, message: 'No changes provided.' };
    }

    await prisma.user.update({
      where: { id: parsed.targetUserId },
      data: updateData,
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'USER_UPDATED', {
        entityType: 'User', entityId: parsed.targetUserId,
        details: `Admin ${caller.name} updated user ${parsed.targetUserId}. Changes: ${JSON.stringify(updateData)}.`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[updateUserProfile_SA] Error:', error);
    return { success: false, message: 'Failed to update user.' };
  }
}

export async function updateUserRole_SA(input: {
  callerUserId: string;
  targetUserId: string;
  role: 'Admin' | 'Technician' | 'Researcher';
}): Promise<{ success: boolean; message?: string }> {
  const parsed = UpdateUserRoleSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const user = await prisma.user.findUnique({
    where: { id: parsed.targetUserId },
  });
  if (!user) {
    return { success: false, message: 'User not found.' };
  }

  try {
    await prisma.user.update({
      where: { id: parsed.targetUserId },
      data: { role: parsed.role },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'USER_UPDATED', {
        entityType: 'User', entityId: parsed.targetUserId,
        details: `Admin ${caller.name} changed role of ${user.name} from ${user.role} to ${parsed.role}.`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[updateUserRole_SA] Error:', error);
    return { success: false, message: 'Failed to update user role.' };
  }
}
