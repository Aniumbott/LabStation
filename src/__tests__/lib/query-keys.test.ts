import { describe, it, expect } from 'vitest';
import { qk } from '@/lib/query-keys';

/**
 * Tests for the query key factory.
 *
 * These are pure-function tests — no network, no DOM, no mocking needed.
 * They ensure that:
 *  1. Key shapes are correct (so React Query can deduplicate and invalidate
 *     correctly across the app).
 *  2. Keys are unique per entity / filter combination.
 *  3. No accidental key collisions between different data domains.
 */
describe('qk — query key factory', () => {
  // ── Dashboard ───────────────────────────────────────────────────────────
  describe('dashboard', () => {
    it('includes userId in the key', () => {
      expect(qk.dashboard('user-1')).toEqual(['dashboard', 'user-1']);
    });

    it('produces different keys for different users', () => {
      expect(qk.dashboard('user-1')).not.toEqual(qk.dashboard('user-2'));
    });
  });

  // ── Resources ────────────────────────────────────────────────────────────
  describe('resources', () => {
    it('resources key is a stable tuple', () => {
      expect(qk.resources()).toEqual(['resources']);
    });

    it('resourceById includes the id', () => {
      expect(qk.resourceById('res-42')).toEqual(['resources', 'res-42']);
    });

    it('resourceById keys differ by id', () => {
      expect(qk.resourceById('res-1')).not.toEqual(qk.resourceById('res-2'));
    });

    it('resourceTypes key is stable', () => {
      expect(qk.resourceTypes()).toEqual(['resourceTypes']);
    });

    it('resources and resourceTypes keys do not collide', () => {
      expect(qk.resources()).not.toEqual(qk.resourceTypes());
    });
  });

  // ── Bookings ─────────────────────────────────────────────────────────────
  describe('bookings', () => {
    it('produces a stable base key with no filters', () => {
      expect(qk.bookings()).toEqual(['bookings', {}]);
    });

    it('includes userId filter in key', () => {
      expect(qk.bookings({ userId: 'u1' })).toEqual(['bookings', { userId: 'u1' }]);
    });

    it('different filters produce different keys', () => {
      const a = qk.bookings({ userId: 'u1' });
      const b = qk.bookings({ userId: 'u2' });
      expect(a).not.toEqual(b);
    });

    it('pendingBookings key is unique', () => {
      expect(qk.pendingBookings()).toEqual(['bookings', 'pending']);
      expect(qk.pendingBookings()).not.toEqual(qk.bookings());
    });
  });

  // ── Labs & memberships ────────────────────────────────────────────────────
  describe('labs & memberships', () => {
    it('labs key is stable', () => {
      expect(qk.labs()).toEqual(['labs']);
    });

    it('labMemberships includes userId', () => {
      expect(qk.labMemberships('u1')).toEqual(['labMemberships', 'u1']);
    });

    it('allLabMemberships key is unique from per-user key', () => {
      expect(qk.allLabMemberships()).toEqual(['labMemberships', 'all']);
      expect(qk.allLabMemberships()).not.toEqual(qk.labMemberships('u1'));
    });
  });

  // ── Users ────────────────────────────────────────────────────────────────
  describe('users', () => {
    it('users key is stable', () => {
      expect(qk.users()).toEqual(['users']);
    });
  });

  // ── Notifications ─────────────────────────────────────────────────────────
  describe('notifications', () => {
    it('includes userId in the key', () => {
      expect(qk.notifications('u1')).toEqual(['notifications', 'u1']);
    });

    it('keys differ per user', () => {
      expect(qk.notifications('u1')).not.toEqual(qk.notifications('u2'));
    });
  });

  // ── Audit logs ────────────────────────────────────────────────────────────
  describe('auditLogs', () => {
    it('auditLogs key is stable', () => {
      expect(qk.auditLogs()).toEqual(['auditLogs']);
    });
  });

  // ── Lab operations ────────────────────────────────────────────────────────
  describe('lab operations', () => {
    it('maintenanceRequests key is stable', () => {
      expect(qk.maintenanceRequests()).toEqual(['maintenanceRequests']);
    });

    it('blackoutDates key is stable', () => {
      expect(qk.blackoutDates()).toEqual(['blackoutDates']);
    });

    it('recurringRules key is stable', () => {
      expect(qk.recurringRules()).toEqual(['recurringRules']);
    });

    it('lab operation keys are all unique', () => {
      const keys = [
        JSON.stringify(qk.maintenanceRequests()),
        JSON.stringify(qk.blackoutDates()),
        JSON.stringify(qk.recurringRules()),
      ];
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  // ── No cross-domain collisions ────────────────────────────────────────────
  describe('cross-domain uniqueness', () => {
    it('top-level domain keys are all unique', () => {
      const topLevelKeys = [
        JSON.stringify(qk.resources()),
        JSON.stringify(qk.resourceTypes()),
        JSON.stringify(qk.labs()),
        JSON.stringify(qk.users()),
        JSON.stringify(qk.auditLogs()),
        JSON.stringify(qk.maintenanceRequests()),
        JSON.stringify(qk.blackoutDates()),
        JSON.stringify(qk.recurringRules()),
      ];
      const unique = new Set(topLevelKeys);
      expect(unique.size).toBe(topLevelKeys.length);
    });
  });
});
