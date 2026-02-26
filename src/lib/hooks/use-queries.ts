'use client';

/**
 * TanStack Query hooks wrapping every server-action read + common mutations.
 *
 * Benefits over the previous useCallback+useEffect pattern:
 *  - Stale-while-revalidate: navigate back → instant render from cache
 *  - Request deduplication: multiple components asking for the same key = 1 fetch
 *  - Precise invalidation: mutations call invalidateQueries on related keys
 *  - Optimistic updates: notification mutations update the UI before the server confirms
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { Notification as AppNotification } from '@/types';

import {
  getDashboardData_SA,
  getResources_SA,
  getResourceById_SA,
  getResourceTypes_SA,
  getBookings_SA,
  getPendingBookings_SA,
  getLabs_SA,
  getLabMemberships_SA,
  getAllLabMemberships_SA,
  getUsers_SA,
  getNotifications_SA,
  getAuditLogs_SA,
  getMaintenanceRequests_SA,
  getBlackoutDates_SA,
  getRecurringBlackoutRules_SA,
} from '@/lib/actions/data.actions';
import {
  markNotificationRead_SA,
  markAllNotificationsRead_SA,
  deleteNotification_SA,
  deleteAllNotifications_SA,
} from '@/lib/actions/notification.actions';

import { qk } from '@/lib/query-keys';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: unwrap ActionResponse<T> into T, throwing on failure
// ─────────────────────────────────────────────────────────────────────────────
interface ActionResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
}

async function unwrap<T>(promise: Promise<ActionResponse<T>>): Promise<T> {
  const result = await promise;
  if (!result.success || result.data === undefined || result.data === null) {
    throw new Error(result.message ?? 'Request failed');
  }
  return result.data as T;
}

// ─────────────────────────────────────────────────────────────────────────────
// READ HOOKS
// ─────────────────────────────────────────────────────────────────────────────

/** Composite dashboard query — returns labs, memberships, resources, bookings. */
export function useDashboardData(userId: string | undefined) {
  return useQuery({
    queryKey: qk.dashboard(userId ?? ''),
    queryFn: () => unwrap(getDashboardData_SA(userId!)),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** All resources (with resourceTypeName, labName). staleTime 60 s. */
export function useResources() {
  return useQuery({
    queryKey: qk.resources(),
    queryFn: () => unwrap(getResources_SA()),
    staleTime: 60_000,
  });
}

/** Single resource by ID (includes unavailability + bookings). */
export function useResourceById(resourceId: string | undefined) {
  return useQuery({
    queryKey: qk.resourceById(resourceId ?? ''),
    queryFn: () => unwrap(getResourceById_SA(resourceId!)),
    enabled: !!resourceId,
    staleTime: 30_000,
  });
}

/** All resource types. Very stable, staleTime 2 min. */
export function useResourceTypes() {
  return useQuery({
    queryKey: qk.resourceTypes(),
    queryFn: () => unwrap(getResourceTypes_SA()),
    staleTime: 120_000,
  });
}

/** Bookings with optional userId / status filters. */
export function useBookings(filters?: { userId?: string; status?: string[] }) {
  return useQuery({
    queryKey: qk.bookings(filters),
    queryFn: () => unwrap(getBookings_SA(filters ?? {})),
    staleTime: 30_000,
  });
}

/** Pending + Waitlisted bookings (admin view). */
export function usePendingBookings() {
  return useQuery({
    queryKey: qk.pendingBookings(),
    queryFn: () => unwrap(getPendingBookings_SA()),
    staleTime: 30_000,
  });
}

/** All labs. Very stable, staleTime 2 min. */
export function useLabs() {
  return useQuery({
    queryKey: qk.labs(),
    queryFn: () => unwrap(getLabs_SA()),
    staleTime: 120_000,
  });
}

/** Lab memberships for a specific user. */
export function useLabMemberships(userId: string | undefined) {
  return useQuery({
    queryKey: qk.labMemberships(userId ?? ''),
    queryFn: () => unwrap(getLabMemberships_SA(userId!)),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/** All lab memberships (admin view). */
export function useAllLabMemberships() {
  return useQuery({
    queryKey: qk.allLabMemberships(),
    queryFn: () => unwrap(getAllLabMemberships_SA()),
    staleTime: 30_000,
  });
}

/**
 * All users (admin-only). callerUserId is required by the server action
 * for permission checking.
 */
export function useUsers(callerUserId: string | undefined) {
  return useQuery({
    queryKey: qk.users(),
    queryFn: () => unwrap(getUsers_SA(callerUserId!)),
    enabled: !!callerUserId,
    staleTime: 60_000,
  });
}

/**
 * Notifications for a user. Dates are rehydrated to Date objects via
 * the select transform so downstream code doesn't need to convert.
 */
export function useNotifications(userId: string | undefined) {
  return useQuery({
    queryKey: qk.notifications(userId ?? ''),
    queryFn: () =>
      unwrap(getNotifications_SA(userId!)).then((notifications) =>
        notifications.map((n) => ({
          ...n,
          createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
        }))
      ),
    enabled: !!userId,
    staleTime: 30_000,
  });
}

/**
 * All audit log entries. Timestamps rehydrated to Date objects.
 * staleTime 60 s — logs are append-only so cached results stay valid longer.
 */
export function useAuditLogs() {
  return useQuery({
    queryKey: qk.auditLogs(),
    queryFn: () =>
      unwrap(getAuditLogs_SA()).then((logs) =>
        logs.map((log) => ({
          ...log,
          timestamp: log.timestamp ? new Date(log.timestamp) : new Date(),
        }))
      ),
    staleTime: 60_000,
  });
}

/** All maintenance requests. */
export function useMaintenanceRequests() {
  return useQuery({
    queryKey: qk.maintenanceRequests(),
    queryFn: () => unwrap(getMaintenanceRequests_SA()),
    staleTime: 30_000,
  });
}

/** All blackout dates. Very stable, staleTime 2 min. */
export function useBlackoutDates() {
  return useQuery({
    queryKey: qk.blackoutDates(),
    queryFn: () => unwrap(getBlackoutDates_SA()),
    staleTime: 120_000,
  });
}

/** All recurring blackout rules. Very stable, staleTime 2 min. */
export function useRecurringRules() {
  return useQuery({
    queryKey: qk.recurringRules(),
    queryFn: () => unwrap(getRecurringBlackoutRules_SA()),
    staleTime: 120_000,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// MUTATION HOOKS — all include optimistic updates + rollback + invalidation
// ─────────────────────────────────────────────────────────────────────────────

/** Mark a single notification as read — optimistically updates the cache. */
export function useMarkNotificationRead(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { callerUserId: string; notificationId: string }) => {
      const result = await markNotificationRead_SA(args);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onMutate: async ({ notificationId }) => {
      await queryClient.cancelQueries({ queryKey: qk.notifications(userId) });
      const prev = queryClient.getQueryData<AppNotification[]>(qk.notifications(userId));
      queryClient.setQueryData<AppNotification[]>(
        qk.notifications(userId),
        (old) => old?.map((n) => (n.id === notificationId ? { ...n, isRead: true } : n)) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(qk.notifications(userId), context?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications(userId) });
    },
  });
}

/** Mark ALL notifications as read — optimistically marks every item. */
export function useMarkAllNotificationsRead(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { callerUserId: string }) => {
      const result = await markAllNotificationsRead_SA(args);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: qk.notifications(userId) });
      const prev = queryClient.getQueryData<AppNotification[]>(qk.notifications(userId));
      queryClient.setQueryData<AppNotification[]>(
        qk.notifications(userId),
        (old) => old?.map((n) => ({ ...n, isRead: true })) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(qk.notifications(userId), context?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications(userId) });
    },
  });
}

/** Delete a single notification — optimistically removes it from the list. */
export function useDeleteNotification(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { callerUserId: string; notificationId: string }) => {
      const result = await deleteNotification_SA(args);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onMutate: async ({ notificationId }) => {
      await queryClient.cancelQueries({ queryKey: qk.notifications(userId) });
      const prev = queryClient.getQueryData<AppNotification[]>(qk.notifications(userId));
      queryClient.setQueryData<AppNotification[]>(
        qk.notifications(userId),
        (old) => old?.filter((n) => n.id !== notificationId) ?? []
      );
      return { prev };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(qk.notifications(userId), context?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications(userId) });
    },
  });
}

/** Delete ALL notifications — optimistically clears the list. */
export function useDeleteAllNotifications(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (args: { callerUserId: string }) => {
      const result = await deleteAllNotifications_SA(args);
      if (!result.success) throw new Error(result.message);
      return result;
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: qk.notifications(userId) });
      const prev = queryClient.getQueryData<AppNotification[]>(qk.notifications(userId));
      queryClient.setQueryData<AppNotification[]>(qk.notifications(userId), []);
      return { prev };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(qk.notifications(userId), context?.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: qk.notifications(userId) });
    },
  });
}
