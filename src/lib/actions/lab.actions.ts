'use server';

import { prisma } from '@/lib/prisma';
import { verifyUserRole } from './helpers';
import { CreateLabSchema, UpdateLabSchema, DeleteLabSchema } from './validation';
import { addAuditLog } from '@/lib/db-helpers';

export async function createLab_SA(input: {
  callerUserId: string;
  name: string;
  location?: string;
  description?: string;
}): Promise<{ success: boolean; labId?: string; message?: string }> {
  const parsed = CreateLabSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  try {
    const newLab = await prisma.lab.create({
      data: {
        name: parsed.name,
        location: parsed.location || '',
        description: parsed.description || '',
      },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'LAB_CREATED', {
        entityType: 'Lab', entityId: newLab.id,
        details: `Admin ${caller.name} created lab '${parsed.name}'.`,
      });
    } catch { /* ok */ }

    return { success: true, labId: newLab.id };
  } catch (error: unknown) {
    console.error('[createLab_SA] Error:', error);
    return { success: false, message: 'Failed to create lab.' };
  }
}

export async function updateLab_SA(input: {
  callerUserId: string;
  labId: string;
  name?: string;
  location?: string;
  description?: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = UpdateLabSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const lab = await prisma.lab.findUnique({
    where: { id: parsed.labId },
  });
  if (!lab) {
    return { success: false, message: 'Lab not found.' };
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.location !== undefined) updateData.location = parsed.location;
    if (parsed.description !== undefined) updateData.description = parsed.description;

    await prisma.lab.update({
      where: { id: parsed.labId },
      data: updateData,
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'LAB_UPDATED', {
        entityType: 'Lab', entityId: parsed.labId,
        details: `Admin ${caller.name} updated lab '${lab.name}'.`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[updateLab_SA] Error:', error);
    return { success: false, message: 'Failed to update lab.' };
  }
}

export async function deleteLab_SA(input: {
  callerUserId: string;
  labId: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = DeleteLabSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const lab = await prisma.lab.findUnique({
    where: { id: parsed.labId },
  });
  if (!lab) {
    return { success: false, message: 'Lab not found.' };
  }

  // Check if resources are still assigned to this lab
  const resourcesUsing = await prisma.resource.findFirst({
    where: { labId: parsed.labId },
  });
  if (resourcesUsing) {
    return { success: false, message: 'Cannot delete: resources are still assigned to this lab.' };
  }

  try {
    // With Prisma, onDelete: Cascade on blackoutDates, recurringBlackoutRules,
    // and labMemberships handles cleanup automatically when the lab is deleted.
    await prisma.lab.delete({
      where: { id: parsed.labId },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'LAB_DELETED', {
        entityType: 'Lab', entityId: parsed.labId,
        details: `Admin ${caller.name} deleted lab '${lab.name}'.`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[deleteLab_SA] Error:', error);
    return { success: false, message: 'Failed to delete lab.' };
  }
}
