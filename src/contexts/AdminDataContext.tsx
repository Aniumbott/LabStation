
'use client';

import {
  createContext,
  useContext,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Lab, Resource, ResourceType, User } from '@/types';
import { useAuth } from '@/components/auth-context';
import { getLabs_SA, getResources_SA, getResourceTypes_SA, getUsers_SA } from '@/lib/actions/data.actions';
import { qk } from '@/lib/query-keys';

// ─── Inline helper (avoids circular import with use-queries.ts) ───────────────
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

// ─── Context shape ────────────────────────────────────────────────────────────
interface AdminDataContextType {
  labs: Lab[];
  resources: Resource[];
  resourceTypes: ResourceType[];
  allUsers: User[];
  allTechnicians: User[];
  isLoading: boolean;
  refetch: () => void;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

// ─────────────────────────────────────────────────────────────────────────────
// Provider — backed by TanStack Query instead of manual useState/useEffect.
//
// Benefits vs the previous implementation:
//  • Navigate away and back → data served instantly from cache (no spinner).
//  • Multiple admin pages requesting the same data → 1 network call (dedup).
//  • refetch() calls invalidateQueries so the UI keeps showing cached data
//    while the background refetch completes (no loading flash on mutations).
//  • Non-admin users: queries are disabled; isLoading = false immediately.
//  • Cache is cleared on logout (see auth-context.tsx), so no stale admin
//    data leaks to the next non-admin session.
// ─────────────────────────────────────────────────────────────────────────────
export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const isAdmin = currentUser?.role === 'Admin';
  const callerUserId = currentUser?.id;

  // ── Labs ──────────────────────────────────────────────────────────────────
  const labsQuery = useQuery({
    queryKey: qk.labs(),
    queryFn: () => unwrap(getLabs_SA()),
    enabled: isAdmin,
    staleTime: 120_000, // labs change rarely
  });

  // ── Resources ─────────────────────────────────────────────────────────────
  const resourcesQuery = useQuery({
    queryKey: qk.resources(),
    queryFn: () => unwrap(getResources_SA()),
    enabled: isAdmin,
    staleTime: 60_000,
  });

  // ── Resource types ────────────────────────────────────────────────────────
  const resourceTypesQuery = useQuery({
    queryKey: qk.resourceTypes(),
    queryFn: () => unwrap(getResourceTypes_SA()),
    enabled: isAdmin,
    staleTime: 120_000,
  });

  // ── Users ─────────────────────────────────────────────────────────────────
  const usersQuery = useQuery({
    queryKey: qk.users(),
    queryFn: () =>
      unwrap(getUsers_SA(callerUserId!)).then((users) =>
        users.map((u) => ({
          ...u,
          createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
        }))
      ),
    enabled: isAdmin && !!callerUserId,
    staleTime: 60_000,
  });

  /**
   * Invalidate all three admin query keys → React Query refetches them in the
   * background while the UI keeps showing the existing cached data.
   */
  const refetch = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: qk.labs() });
    queryClient.invalidateQueries({ queryKey: qk.resources() });
    queryClient.invalidateQueries({ queryKey: qk.resourceTypes() });
    queryClient.invalidateQueries({ queryKey: qk.users() });
  }, [queryClient]);

  const labs: Lab[] = labsQuery.data ?? [];
  const resources: Resource[] = resourcesQuery.data ?? [];
  const resourceTypes: ResourceType[] = resourceTypesQuery.data ?? [];
  const allUsers: User[] = usersQuery.data ?? [];

  // isLoading is true only while a query is pending AND actively fetching.
  // Disabled queries (non-admins) report isLoading = false immediately.
  const isLoading = isAdmin
    ? labsQuery.isLoading || resourcesQuery.isLoading || resourceTypesQuery.isLoading || usersQuery.isLoading
    : false;

  const allTechnicians = useMemo(
    () => allUsers.filter((u) => u.role === 'Technician' || u.role === 'Admin'),
    [allUsers]
  );

  const value = useMemo(
    () => ({ labs, resources, resourceTypes, allUsers, allTechnicians, isLoading, refetch }),
    [labs, resources, resourceTypes, allUsers, allTechnicians, isLoading, refetch]
  );

  return (
    <AdminDataContext.Provider value={value}>
      {children}
    </AdminDataContext.Provider>
  );
}

export function useAdminData() {
  const context = useContext(AdminDataContext);
  if (context === undefined) {
    throw new Error('useAdminData must be used within an AdminDataProvider');
  }
  return context;
}
