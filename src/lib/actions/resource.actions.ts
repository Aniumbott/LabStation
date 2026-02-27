'use server';

import { prisma } from '@/lib/prisma';
import { verifyUserRole } from './helpers';
import { CreateResourceSchema, UpdateResourceSchema, DeleteResourceSchema, UpdateResourceUnavailabilitySchema, CreateResourceTypeSchema, UpdateResourceTypeSchema, DeleteResourceTypeSchema } from './validation';
import { addAuditLog } from '@/lib/db-helpers';
import { PLACEHOLDER_IMAGE } from '@/lib/app-constants';

export async function createResource_SA(input: {
  callerUserId: string;
  name: string;
  resourceTypeId: string;
  labId: string;
  status: 'Working' | 'Maintenance' | 'Broken';
  description?: string;
  imageUrl?: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  purchaseDate?: string | null;
  notes?: string;
  features?: string[];
  allowQueueing?: boolean;
  remoteAccess?: { ipAddress?: string; hostname?: string; protocol?: string; username?: string; port?: number | null; notes?: string } | null;
}): Promise<{ success: boolean; resourceId?: string; message?: string }> {
  const parsed = CreateResourceSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  try {
    const newResource = await prisma.resource.create({
      data: {
        name: parsed.name,
        resourceTypeId: parsed.resourceTypeId,
        labId: parsed.labId || '',
        status: parsed.status,
        description: parsed.description || '',
        imageUrl: parsed.imageUrl || PLACEHOLDER_IMAGE,
        manufacturer: parsed.manufacturer || '',
        model: parsed.model || '',
        serialNumber: parsed.serialNumber || '',
        notes: parsed.notes || '',
        features: JSON.stringify(parsed.features || []),
        allowQueueing: parsed.allowQueueing || false,
        purchaseDate: parsed.purchaseDate ? new Date(parsed.purchaseDate) : null,
        remoteAccess: parsed.remoteAccess ? JSON.stringify(parsed.remoteAccess) : null,
      },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'RESOURCE_CREATED', {
        entityType: 'Resource', entityId: newResource.id,
        details: `Admin ${caller.name} created resource '${parsed.name}'.`,
      });
    } catch { /* ok */ }

    return { success: true, resourceId: newResource.id };
  } catch (error: unknown) {
    console.error('[createResource_SA] Error:', error);
    return { success: false, message: 'Failed to create resource.' };
  }
}

export async function updateResource_SA(input: {
  callerUserId: string;
  resourceId: string;
  [key: string]: unknown;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = UpdateResourceSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const resource = await prisma.resource.findUnique({
    where: { id: parsed.resourceId },
  });
  if (!resource) {
    return { success: false, message: 'Resource not found.' };
  }

  try {
    const { callerUserId, resourceId, ...updateFields } = parsed;
    const updateData: Record<string, unknown> = {};

    // Map each field appropriately
    if (updateFields.name !== undefined) updateData.name = updateFields.name;
    if (updateFields.resourceTypeId !== undefined) updateData.resourceTypeId = updateFields.resourceTypeId;
    if (updateFields.labId !== undefined) updateData.labId = updateFields.labId;
    if (updateFields.status !== undefined) updateData.status = updateFields.status;
    if (updateFields.description !== undefined) updateData.description = updateFields.description;
    if (updateFields.imageUrl !== undefined) updateData.imageUrl = updateFields.imageUrl;
    if (updateFields.manufacturer !== undefined) updateData.manufacturer = updateFields.manufacturer;
    if (updateFields.model !== undefined) updateData.model = updateFields.model;
    if (updateFields.serialNumber !== undefined) updateData.serialNumber = updateFields.serialNumber;
    if (updateFields.notes !== undefined) updateData.notes = updateFields.notes;
    if (updateFields.allowQueueing !== undefined) updateData.allowQueueing = updateFields.allowQueueing;
    if (updateFields.features !== undefined) updateData.features = JSON.stringify(updateFields.features);
    if (updateFields.purchaseDate !== undefined) updateData.purchaseDate = updateFields.purchaseDate ? new Date(updateFields.purchaseDate) : null;
    if (updateFields.remoteAccess !== undefined) updateData.remoteAccess = updateFields.remoteAccess ? JSON.stringify(updateFields.remoteAccess) : null;

    await prisma.resource.update({
      where: { id: resourceId },
      data: updateData,
    });

    try {
      await addAuditLog(callerUserId, caller.name, 'RESOURCE_UPDATED', {
        entityType: 'Resource', entityId: resourceId,
        details: `Admin ${caller.name} updated resource '${resource.name}'.`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[updateResource_SA] Error:', error);
    return { success: false, message: 'Failed to update resource.' };
  }
}

export async function deleteResource_SA(input: {
  callerUserId: string;
  resourceId: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = DeleteResourceSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const resource = await prisma.resource.findUnique({
    where: { id: parsed.resourceId },
  });
  if (!resource) {
    return { success: false, message: 'Resource not found.' };
  }
  const resourceName = resource.name || 'Unknown';

  try {
    await prisma.resource.delete({
      where: { id: parsed.resourceId },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'RESOURCE_DELETED', {
        entityType: 'Resource', entityId: parsed.resourceId,
        details: `Admin ${caller.name} deleted resource '${resourceName}'.`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[deleteResource_SA] Error:', error);
    return { success: false, message: 'Failed to delete resource.' };
  }
}

export async function updateResourceUnavailability_SA(input: {
  callerUserId: string;
  resourceId: string;
  periods: Array<{ id: string; startDate: string; endDate: string; reason?: string }>;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = UpdateResourceUnavailabilitySchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const resource = await prisma.resource.findUnique({
    where: { id: parsed.resourceId },
  });
  if (!resource) {
    return { success: false, message: 'Resource not found.' };
  }

  try {
    // Delete all existing periods and create new ones
    await prisma.$transaction([
      prisma.unavailabilityPeriod.deleteMany({
        where: { resourceId: parsed.resourceId },
      }),
      prisma.unavailabilityPeriod.createMany({
        data: parsed.periods.map((p) => ({
          id: p.id,
          resourceId: parsed.resourceId,
          startDate: p.startDate,
          endDate: p.endDate,
          reason: p.reason || '',
        })),
      }),
    ]);

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'RESOURCE_UPDATED', {
        entityType: 'Resource', entityId: parsed.resourceId,
        details: `Admin ${caller.name} updated unavailability periods for resource '${resource.name}'.`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[updateResourceUnavailability_SA] Error:', error);
    return { success: false, message: 'Failed to update unavailability.' };
  }
}

// --- Resource Type actions ---

export async function createResourceType_SA(input: {
  callerUserId: string;
  name: string;
  description?: string;
}): Promise<{ success: boolean; typeId?: string; message?: string }> {
  const parsed = CreateResourceTypeSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  try {
    const newType = await prisma.resourceType.create({
      data: {
        name: parsed.name,
        description: parsed.description || '',
      },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'RESOURCE_TYPE_CREATED', {
        entityType: 'ResourceType', entityId: newType.id,
        details: `Admin ${caller.name} created resource type '${parsed.name}'.`,
      });
    } catch { /* ok */ }

    return { success: true, typeId: newType.id };
  } catch (error: unknown) {
    console.error('[createResourceType_SA] Error:', error);
    return { success: false, message: 'Failed to create resource type.' };
  }
}

export async function updateResourceType_SA(input: {
  callerUserId: string;
  typeId: string;
  name: string;
  description?: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = UpdateResourceTypeSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  try {
    await prisma.resourceType.update({
      where: { id: parsed.typeId },
      data: {
        name: parsed.name,
        description: parsed.description || '',
      },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'RESOURCE_TYPE_UPDATED', {
        entityType: 'ResourceType', entityId: parsed.typeId,
        details: `Admin ${caller.name} updated resource type '${parsed.name}'.`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[updateResourceType_SA] Error:', error);
    return { success: false, message: 'Failed to update resource type.' };
  }
}

export async function deleteResourceType_SA(input: {
  callerUserId: string;
  typeId: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = DeleteResourceTypeSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const resourceType = await prisma.resourceType.findUnique({
    where: { id: parsed.typeId },
  });
  if (!resourceType) {
    return { success: false, message: 'Resource type not found.' };
  }

  // Check if any resources use this type
  const resourcesUsing = await prisma.resource.findFirst({
    where: { resourceTypeId: parsed.typeId },
  });
  if (resourcesUsing) {
    return { success: false, message: 'Cannot delete: resources still use this type.' };
  }

  try {
    await prisma.resourceType.delete({
      where: { id: parsed.typeId },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'RESOURCE_TYPE_DELETED', {
        entityType: 'ResourceType', entityId: parsed.typeId,
        details: `Admin ${caller.name} deleted resource type '${resourceType.name}'.`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[deleteResourceType_SA] Error:', error);
    return { success: false, message: 'Failed to delete resource type.' };
  }
}
