/**
 * Firebase Firestore → SQLite (Prisma) Migration Script
 *
 * Reads all 11 Firestore collections and writes them to the local SQLite database
 * using Prisma. Preserves original Firestore document IDs so foreign keys stay consistent.
 *
 * Usage:
 *   npx tsx scripts/migrate-firebase-to-sqlite.ts
 *
 * Prerequisites:
 *   - .env.local must contain FIREBASE_SERVICE_ACCOUNT_KEY_JSON (or GOOGLE_APPLICATION_CREDENTIALS)
 *     and NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   - DATABASE_URL must point to your SQLite file (e.g. file:./dev.db)
 *   - Run `npx prisma migrate dev` or `npx prisma db push` first so tables exist
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.local from project root
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });

import admin from 'firebase-admin';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

// ---------------------------------------------------------------------------
// Initialise Firebase Admin SDK
// ---------------------------------------------------------------------------
const serviceAccountKeyJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON;
const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;
const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

if (!projectId) {
  throw new Error('NEXT_PUBLIC_FIREBASE_PROJECT_ID is not set in .env.local');
}

let credential: admin.credential.Credential;

if (serviceAccountKeyJson) {
  const serviceAccount = JSON.parse(serviceAccountKeyJson);
  credential = admin.credential.cert(serviceAccount);
  console.log('Firebase Admin: Using FIREBASE_SERVICE_ACCOUNT_KEY_JSON');
} else if (googleAppCreds) {
  credential = admin.credential.applicationDefault();
  console.log('Firebase Admin: Using GOOGLE_APPLICATION_CREDENTIALS');
} else {
  throw new Error(
    'Set FIREBASE_SERVICE_ACCOUNT_KEY_JSON or GOOGLE_APPLICATION_CREDENTIALS in .env.local'
  );
}

admin.initializeApp({
  credential,
  databaseURL: `https://${projectId}.firebaseio.com`,
});

const adminDb = admin.firestore();
const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a Firestore Timestamp (or any date-like value) to a JS Date. */
function toDate(value: unknown): Date | undefined {
  if (!value) return undefined;
  if (typeof (value as any).toDate === 'function') {
    return (value as any).toDate();
  }
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
  }
  return undefined;
}

/** Safely convert a value to a JSON string (for fields stored as JSON text). */
function toJsonString(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value; // already a string
  return JSON.stringify(value);
}

/** Read every document in a Firestore collection. */
async function readCollection(collectionName: string) {
  const snapshot = await adminDb.collection(collectionName).get();
  console.log(`  Firestore: "${collectionName}" has ${snapshot.size} documents`);
  return snapshot.docs;
}

// ---------------------------------------------------------------------------
// Migration functions – one per collection
// ---------------------------------------------------------------------------

async function migrateUsers() {
  console.log('\n--- Migrating users → User ---');
  const docs = await readCollection('users');
  let created = 0;
  let skipped = 0;

  for (const doc of docs) {
    const d = doc.data();
    const email: string = d.email ?? `${doc.id}@unknown.com`;
    const passwordHash = await bcrypt.hash(email, 10);

    try {
      await prisma.user.create({
        data: {
          id: doc.id,
          name: d.name ?? d.displayName ?? 'Unknown',
          email,
          passwordHash,
          role: d.role ?? 'Researcher',
          avatarUrl: d.avatarUrl ?? d.photoURL ?? null,
          status: d.status ?? 'active',
          mustChangePassword: true,
          createdAt: toDate(d.createdAt) ?? new Date(),
          updatedAt: toDate(d.updatedAt) ?? new Date(),
        },
      });
      created++;
    } catch (err: any) {
      // Unique constraint on email – skip duplicate
      if (err?.code === 'P2002') {
        skipped++;
        console.log(`  Skipped duplicate user email: ${email}`);
      } else {
        console.error(`  Error creating user ${doc.id}:`, err.message);
        skipped++;
      }
    }
  }
  console.log(`  Users created: ${created}, skipped: ${skipped}`);
}

async function migrateLabs() {
  console.log('\n--- Migrating labs → Lab ---');
  const docs = await readCollection('labs');
  let created = 0;

  for (const doc of docs) {
    const d = doc.data();
    try {
      await prisma.lab.create({
        data: {
          id: doc.id,
          name: d.name ?? 'Unnamed Lab',
          location: d.location ?? null,
          description: d.description ?? null,
          createdAt: toDate(d.createdAt) ?? new Date(),
          updatedAt: toDate(d.updatedAt) ?? new Date(),
        },
      });
      created++;
    } catch (err: any) {
      console.error(`  Error creating lab ${doc.id}:`, err.message);
    }
  }
  console.log(`  Labs created: ${created}`);
}

async function migrateResourceTypes() {
  console.log('\n--- Migrating resourceTypes → ResourceType ---');
  const docs = await readCollection('resourceTypes');
  let created = 0;

  for (const doc of docs) {
    const d = doc.data();
    try {
      await prisma.resourceType.create({
        data: {
          id: doc.id,
          name: d.name ?? 'Unknown Type',
          description: d.description ?? null,
        },
      });
      created++;
    } catch (err: any) {
      console.error(`  Error creating resourceType ${doc.id}:`, err.message);
    }
  }
  console.log(`  ResourceTypes created: ${created}`);
}

async function migrateResources() {
  console.log('\n--- Migrating resources → Resource + UnavailabilityPeriod ---');
  const docs = await readCollection('resources');
  let resourcesCreated = 0;
  let periodsCreated = 0;

  for (const doc of docs) {
    const d = doc.data();
    try {
      await prisma.resource.create({
        data: {
          id: doc.id,
          name: d.name ?? 'Unnamed Resource',
          resourceTypeId: d.resourceTypeId ?? d.typeId ?? '',
          labId: d.labId ?? '',
          status: d.status ?? 'Working',
          description: d.description ?? null,
          imageUrl: d.imageUrl ?? null,
          features: toJsonString(d.features),
          manufacturer: d.manufacturer ?? null,
          model: d.model ?? null,
          serialNumber: d.serialNumber ?? null,
          purchaseDate: toDate(d.purchaseDate) ?? null,
          notes: d.notes ?? null,
          remoteAccess: toJsonString(d.remoteAccess),
          allowQueueing: d.allowQueueing ?? false,
          createdAt: toDate(d.createdAt) ?? new Date(),
          updatedAt: toDate(d.updatedAt) ?? new Date(),
        },
      });
      resourcesCreated++;

      // Extract embedded unavailabilityPeriods array
      const periods: any[] = d.unavailabilityPeriods ?? [];
      for (const p of periods) {
        try {
          await prisma.unavailabilityPeriod.create({
            data: {
              resourceId: doc.id,
              startDate: p.startDate ?? '',
              endDate: p.endDate ?? '',
              reason: p.reason ?? null,
            },
          });
          periodsCreated++;
        } catch (err: any) {
          console.error(`  Error creating unavailabilityPeriod for resource ${doc.id}:`, err.message);
        }
      }
    } catch (err: any) {
      console.error(`  Error creating resource ${doc.id}:`, err.message);
    }
  }
  console.log(`  Resources created: ${resourcesCreated}`);
  console.log(`  UnavailabilityPeriods created: ${periodsCreated}`);
}

async function migrateBookings() {
  console.log('\n--- Migrating bookings → Booking ---');
  const docs = await readCollection('bookings');
  let created = 0;
  let skipped = 0;

  for (const doc of docs) {
    const d = doc.data();
    try {
      await prisma.booking.create({
        data: {
          id: doc.id,
          resourceId: d.resourceId ?? '',
          userId: d.userId ?? '',
          startTime: toDate(d.startTime) ?? new Date(),
          endTime: toDate(d.endTime) ?? new Date(),
          status: d.status ?? 'Pending',
          notes: d.notes ?? null,
          usageDetails: toJsonString(d.usageDetails),
          createdAt: toDate(d.createdAt) ?? new Date(),
          updatedAt: toDate(d.updatedAt) ?? new Date(),
        },
      });
      created++;
    } catch (err: any) {
      console.error(`  Error creating booking ${doc.id}:`, err.message);
      skipped++;
    }
  }
  console.log(`  Bookings created: ${created}, skipped: ${skipped}`);
}

async function migrateLabMemberships() {
  console.log('\n--- Migrating labMemberships → LabMembership ---');
  const docs = await readCollection('labMemberships');
  let created = 0;
  let skipped = 0;

  // Track (userId, labId) pairs we have already inserted to respect the @@unique constraint
  const seen = new Set<string>();

  for (const doc of docs) {
    const d = doc.data();
    const userId = d.userId ?? '';
    const labId = d.labId ?? '';
    const key = `${userId}::${labId}`;

    if (seen.has(key)) {
      console.log(`  Skipping duplicate labMembership (userId=${userId}, labId=${labId})`);
      skipped++;
      continue;
    }
    seen.add(key);

    try {
      await prisma.labMembership.create({
        data: {
          id: doc.id,
          userId,
          labId,
          status: d.status ?? 'pending_approval',
          roleInLab: d.roleInLab ?? null,
          requestedAt: toDate(d.requestedAt) ?? toDate(d.createdAt) ?? new Date(),
          updatedAt: toDate(d.updatedAt) ?? new Date(),
          actingAdminId: d.actingAdminId ?? null,
        },
      });
      created++;
    } catch (err: any) {
      if (err?.code === 'P2002') {
        console.log(`  Skipping duplicate labMembership (userId=${userId}, labId=${labId}) [DB constraint]`);
        skipped++;
      } else {
        console.error(`  Error creating labMembership ${doc.id}:`, err.message);
        skipped++;
      }
    }
  }
  console.log(`  LabMemberships created: ${created}, skipped: ${skipped}`);
}

async function migrateNotifications() {
  console.log('\n--- Migrating notifications → Notification ---');
  const docs = await readCollection('notifications');
  let created = 0;
  let skipped = 0;

  for (const doc of docs) {
    const d = doc.data();
    try {
      await prisma.notification.create({
        data: {
          id: doc.id,
          userId: d.userId ?? '',
          title: d.title ?? '',
          message: d.message ?? '',
          type: d.type ?? 'General',
          isRead: d.isRead ?? false,
          linkTo: d.linkTo ?? null,
          createdAt: toDate(d.createdAt) ?? new Date(),
        },
      });
      created++;
    } catch (err: any) {
      console.error(`  Error creating notification ${doc.id}:`, err.message);
      skipped++;
    }
  }
  console.log(`  Notifications created: ${created}, skipped: ${skipped}`);
}

async function migrateAuditLogs() {
  console.log('\n--- Migrating auditLogs → AuditLog ---');
  const docs = await readCollection('auditLogs');
  let created = 0;
  let skipped = 0;

  // Pre-load the set of known user IDs so we can null-out invalid FK references
  const allUsers = await prisma.user.findMany({ select: { id: true } });
  const validUserIds = new Set(allUsers.map((u) => u.id));

  for (const doc of docs) {
    const d = doc.data();
    let userId: string = d.userId ?? '';

    // If userId is not a real user (e.g. "SYSTEM_WAITLIST_PROMOTION"), we still
    // store it because the FK is optional (User?). However, if the schema
    // enforces FK at the DB level we need to set it to a valid ID or null.
    // The Prisma schema says `user User? @relation(...)` which means the column
    // is nullable at DB level only if there is no NOT NULL constraint.
    // Since the model field `userId String` is non-optional in the schema,
    // we always write the string but wrap in try/catch in case the FK fails.
    const userIdForDb = validUserIds.has(userId) ? userId : null;

    try {
      await prisma.auditLog.create({
        data: {
          id: doc.id,
          timestamp: toDate(d.timestamp) ?? toDate(d.createdAt) ?? new Date(),
          userId: userIdForDb as any, // may be null for system entries
          userName: d.userName ?? d.userId ?? 'SYSTEM',
          action: d.action ?? 'UNKNOWN',
          entityType: d.entityType ?? null,
          entityId: d.entityId ?? null,
          secondaryEntityType: d.secondaryEntityType ?? null,
          secondaryEntityId: d.secondaryEntityId ?? null,
          details: typeof d.details === 'string' ? d.details : JSON.stringify(d.details ?? {}),
        },
      });
      created++;
    } catch (err: any) {
      console.error(`  Error creating auditLog ${doc.id} (userId="${userId}"):`, err.message);
      skipped++;
    }
  }
  console.log(`  AuditLogs created: ${created}, skipped: ${skipped}`);
}

async function migrateMaintenanceRequests() {
  console.log('\n--- Migrating maintenanceRequests → MaintenanceRequest ---');
  const docs = await readCollection('maintenanceRequests');
  let created = 0;
  let skipped = 0;

  for (const doc of docs) {
    const d = doc.data();
    try {
      await prisma.maintenanceRequest.create({
        data: {
          id: doc.id,
          resourceId: d.resourceId ?? '',
          reportedByUserId: d.reportedByUserId ?? d.reportedBy ?? '',
          issueDescription: d.issueDescription ?? d.description ?? '',
          status: d.status ?? 'Open',
          assignedTechnicianId: d.assignedTechnicianId ?? d.assignedTo ?? null,
          dateReported: toDate(d.dateReported) ?? toDate(d.createdAt) ?? new Date(),
          dateResolved: toDate(d.dateResolved) ?? null,
          resolutionNotes: d.resolutionNotes ?? null,
        },
      });
      created++;
    } catch (err: any) {
      console.error(`  Error creating maintenanceRequest ${doc.id}:`, err.message);
      skipped++;
    }
  }
  console.log(`  MaintenanceRequests created: ${created}, skipped: ${skipped}`);
}

async function migrateBlackoutDates() {
  console.log('\n--- Migrating blackoutDates → BlackoutDate ---');
  const docs = await readCollection('blackoutDates');
  let created = 0;

  for (const doc of docs) {
    const d = doc.data();
    try {
      await prisma.blackoutDate.create({
        data: {
          id: doc.id,
          labId: d.labId ?? null,
          date: d.date ?? '',
          reason: d.reason ?? null,
        },
      });
      created++;
    } catch (err: any) {
      console.error(`  Error creating blackoutDate ${doc.id}:`, err.message);
    }
  }
  console.log(`  BlackoutDates created: ${created}`);
}

async function migrateRecurringBlackoutRules() {
  console.log('\n--- Migrating recurringBlackoutRules → RecurringBlackoutRule ---');
  const docs = await readCollection('recurringBlackoutRules');
  let created = 0;

  for (const doc of docs) {
    const d = doc.data();
    try {
      await prisma.recurringBlackoutRule.create({
        data: {
          id: doc.id,
          labId: d.labId ?? null,
          name: d.name ?? 'Unnamed Rule',
          daysOfWeek: toJsonString(d.daysOfWeek) ?? '[]',
          reason: d.reason ?? null,
        },
      });
      created++;
    } catch (err: any) {
      console.error(`  Error creating recurringBlackoutRule ${doc.id}:`, err.message);
    }
  }
  console.log(`  RecurringBlackoutRules created: ${created}`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('==========================================================');
  console.log('  Firebase Firestore → SQLite (Prisma) Migration');
  console.log('==========================================================');
  console.log(`  Project ID : ${projectId}`);
  console.log(`  Database   : ${process.env.DATABASE_URL}`);
  console.log(`  Started at : ${new Date().toISOString()}`);
  console.log('==========================================================');

  // Order matters: parent tables first, then dependent tables
  await migrateUsers();
  await migrateLabs();
  await migrateResourceTypes();
  await migrateResources();        // depends on Lab, ResourceType
  await migrateBookings();          // depends on Resource, User
  await migrateLabMemberships();    // depends on User, Lab
  await migrateNotifications();     // depends on User
  await migrateAuditLogs();         // depends on User (optional)
  await migrateMaintenanceRequests(); // depends on Resource, User
  await migrateBlackoutDates();     // depends on Lab (optional)
  await migrateRecurringBlackoutRules(); // depends on Lab (optional)

  console.log('\n==========================================================');
  console.log('  Migration complete!');
  console.log(`  Finished at: ${new Date().toISOString()}`);
  console.log('==========================================================');
}

main()
  .catch((err) => {
    console.error('\nMigration failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
