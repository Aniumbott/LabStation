/**
 * Centralized, type-safe query key factory for TanStack Query.
 * All query keys live here so invalidations are consistent across the app.
 */
export const qk = {
  // ── Dashboard ─────────────────────────────────────────────────────────────
  dashboard: (userId: string) => ['dashboard', userId] as const,

  // ── Resources ─────────────────────────────────────────────────────────────
  resources: () => ['resources'] as const,
  resourceById: (id: string) => ['resources', id] as const,
  resourceTypes: () => ['resourceTypes'] as const,

  // ── Bookings ──────────────────────────────────────────────────────────────
  bookings: (filters?: { userId?: string; status?: string[] }) =>
    ['bookings', filters ?? {}] as const,
  pendingBookings: () => ['bookings', 'pending'] as const,

  // ── Labs & Memberships ────────────────────────────────────────────────────
  labs: () => ['labs'] as const,
  labMemberships: (userId: string) => ['labMemberships', userId] as const,
  allLabMemberships: () => ['labMemberships', 'all'] as const,

  // ── Users ─────────────────────────────────────────────────────────────────
  users: () => ['users'] as const,

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: (userId: string) => ['notifications', userId] as const,

  // ── Audit log ─────────────────────────────────────────────────────────────
  auditLogs: () => ['auditLogs'] as const,

  // ── Lab operations ────────────────────────────────────────────────────────
  maintenanceRequests: () => ['maintenanceRequests'] as const,
  blackoutDates: () => ['blackoutDates'] as const,
  recurringRules: () => ['recurringRules'] as const,
} as const;
