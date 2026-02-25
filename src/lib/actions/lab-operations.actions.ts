'use server';

import { prisma } from '@/lib/prisma';
import { verifyUserRole } from './helpers';
import { CreateBlackoutDateSchema, DeleteBlackoutDateSchema, CreateRecurringRuleSchema, DeleteRecurringRuleSchema, CreateMaintenanceRequestSchema, UpdateMaintenanceRequestSchema } from './validation';
import { addAuditLog, addNotification } from '@/lib/db-helpers';

// --- Blackout Dates ---

export async function createBlackoutDate_SA(input: {
  callerUserId: string;
  labId?: string | null;
  date: string;
  reason?: string;
}): Promise<{ success: boolean; blackoutDateId?: string; message?: string }> {
  const parsed = CreateBlackoutDateSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  try {
    const newBlackout = await prisma.blackoutDate.create({
      data: {
        labId: parsed.labId || null,
        date: parsed.date,
        reason: parsed.reason || '',
      },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'BLACKOUT_DATE_CREATED', {
        entityType: 'BlackoutDate', entityId: newBlackout.id,
        details: `Admin ${caller.name} created blackout date for ${parsed.date}.${parsed.labId ? ' Lab: ' + parsed.labId : ' (Global)'}`,
      });
    } catch { /* ok */ }

    return { success: true, blackoutDateId: newBlackout.id };
  } catch (error: unknown) {
    console.error('[createBlackoutDate_SA] Error:', error);
    return { success: false, message: 'Failed to create blackout date.' };
  }
}

export async function deleteBlackoutDate_SA(input: {
  callerUserId: string;
  blackoutDateId: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = DeleteBlackoutDateSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const blackout = await prisma.blackoutDate.findUnique({
    where: { id: parsed.blackoutDateId },
  });
  if (!blackout) {
    return { success: false, message: 'Blackout date not found.' };
  }

  try {
    await prisma.blackoutDate.delete({
      where: { id: parsed.blackoutDateId },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'BLACKOUT_DATE_DELETED', {
        entityType: 'BlackoutDate', entityId: parsed.blackoutDateId,
        details: `Admin ${caller.name} deleted blackout date (${blackout.date}).`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[deleteBlackoutDate_SA] Error:', error);
    return { success: false, message: 'Failed to delete blackout date.' };
  }
}

// --- Recurring Blackout Rules ---

export async function createRecurringRule_SA(input: {
  callerUserId: string;
  labId?: string | null;
  name: string;
  daysOfWeek: string[];
  reason?: string;
}): Promise<{ success: boolean; ruleId?: string; message?: string }> {
  const parsed = CreateRecurringRuleSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  try {
    const newRule = await prisma.recurringBlackoutRule.create({
      data: {
        labId: parsed.labId || null,
        name: parsed.name,
        daysOfWeek: JSON.stringify(parsed.daysOfWeek),
        reason: parsed.reason || '',
      },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'RECURRING_RULE_CREATED', {
        entityType: 'RecurringBlackoutRule', entityId: newRule.id,
        details: `Admin ${caller.name} created recurring rule '${parsed.name}'.`,
      });
    } catch { /* ok */ }

    return { success: true, ruleId: newRule.id };
  } catch (error: unknown) {
    console.error('[createRecurringRule_SA] Error:', error);
    return { success: false, message: 'Failed to create recurring rule.' };
  }
}

export async function deleteRecurringRule_SA(input: {
  callerUserId: string;
  ruleId: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = DeleteRecurringRuleSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin']);

  const rule = await prisma.recurringBlackoutRule.findUnique({
    where: { id: parsed.ruleId },
  });
  if (!rule) {
    return { success: false, message: 'Recurring rule not found.' };
  }

  try {
    await prisma.recurringBlackoutRule.delete({
      where: { id: parsed.ruleId },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'RECURRING_RULE_DELETED', {
        entityType: 'RecurringBlackoutRule', entityId: parsed.ruleId,
        details: `Admin ${caller.name} deleted recurring rule '${rule.name}'.`,
      });
    } catch { /* ok */ }

    return { success: true };
  } catch (error: unknown) {
    console.error('[deleteRecurringRule_SA] Error:', error);
    return { success: false, message: 'Failed to delete recurring rule.' };
  }
}

// --- Maintenance Requests ---

export async function createMaintenanceRequest_SA(input: {
  callerUserId: string;
  resourceId: string;
  issueDescription: string;
  assignedTechnicianId?: string | null;
}): Promise<{ success: boolean; requestId?: string; message?: string }> {
  const parsed = CreateMaintenanceRequestSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin', 'Technician', 'Researcher']);

  const resource = await prisma.resource.findUnique({
    where: { id: parsed.resourceId },
  });
  if (!resource) {
    return { success: false, message: 'Resource not found.' };
  }
  const resourceName = resource.name || 'Resource';

  try {
    const newRequest = await prisma.maintenanceRequest.create({
      data: {
        resourceId: parsed.resourceId,
        reportedByUserId: parsed.callerUserId,
        issueDescription: parsed.issueDescription,
        status: 'Open',
        assignedTechnicianId: parsed.assignedTechnicianId || null,
      },
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'MAINTENANCE_CREATED', {
        entityType: 'MaintenanceRequest', entityId: newRequest.id,
        details: `${caller.name} created maintenance request for resource '${resourceName}'.`,
      });
    } catch { /* ok */ }

    // Notify assigned technician
    if (parsed.assignedTechnicianId) {
      try {
        await addNotification(parsed.assignedTechnicianId, 'Maintenance Request Assigned',
          `You have been assigned a maintenance request for '${resourceName}'.`,
          'maintenance_assigned', `/admin/lab-operations?tab=maintenance`);
      } catch { /* ok */ }
    }

    return { success: true, requestId: newRequest.id };
  } catch (error: unknown) {
    console.error('[createMaintenanceRequest_SA] Error:', error);
    return { success: false, message: 'Failed to create maintenance request.' };
  }
}

export async function updateMaintenanceRequest_SA(input: {
  callerUserId: string;
  requestId: string;
  status?: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assignedTechnicianId?: string | null;
  resolutionNotes?: string;
}): Promise<{ success: boolean; message?: string }> {
  const parsed = UpdateMaintenanceRequestSchema.parse(input);
  const caller = await verifyUserRole(parsed.callerUserId, ['Admin', 'Technician']);

  const request = await prisma.maintenanceRequest.findUnique({
    where: { id: parsed.requestId },
  });
  if (!request) {
    return { success: false, message: 'Maintenance request not found.' };
  }

  try {
    const updateData: Record<string, unknown> = {};
    if (parsed.status !== undefined) {
      updateData.status = parsed.status;
      if (parsed.status === 'Resolved' || parsed.status === 'Closed') {
        updateData.dateResolved = new Date();
      }
    }
    if (parsed.assignedTechnicianId !== undefined) updateData.assignedTechnicianId = parsed.assignedTechnicianId;
    if (parsed.resolutionNotes !== undefined) updateData.resolutionNotes = parsed.resolutionNotes;

    if (Object.keys(updateData).length === 0) {
      return { success: false, message: 'No changes provided.' };
    }

    await prisma.maintenanceRequest.update({
      where: { id: parsed.requestId },
      data: updateData,
    });

    try {
      await addAuditLog(parsed.callerUserId, caller.name, 'MAINTENANCE_UPDATED', {
        entityType: 'MaintenanceRequest', entityId: parsed.requestId,
        details: `${caller.name} updated maintenance request.${parsed.status ? ' Status: ' + parsed.status + '.' : ''}`,
      });
    } catch { /* ok */ }

    // Notify reporter if status changed to resolved
    if (parsed.status === 'Resolved') {
      const reporterUserId = request.reportedByUserId;
      if (reporterUserId) {
        try {
          await addNotification(reporterUserId, 'Maintenance Request Resolved',
            `A maintenance request you reported has been resolved.`,
            'maintenance_resolved', `/admin/lab-operations?tab=maintenance`);
        } catch { /* ok */ }
      }
    }

    return { success: true };
  } catch (error: unknown) {
    console.error('[updateMaintenanceRequest_SA] Error:', error);
    return { success: false, message: 'Failed to update maintenance request.' };
  }
}
