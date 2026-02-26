import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Mock server actions ────────────────────────────────────────────────────────
vi.mock('@/lib/actions/data.actions', () => ({
  getLabs_SA: vi.fn(),
  getResourceTypes_SA: vi.fn(),
  getUsers_SA: vi.fn(),
  // Other actions used by use-queries.ts (unused in this test but required for module resolution)
  getNotifications_SA: vi.fn(),
  getAuditLogs_SA: vi.fn(),
  getDashboardData_SA: vi.fn(),
  getResources_SA: vi.fn(),
  getResourceById_SA: vi.fn(),
  getBookings_SA: vi.fn(),
  getPendingBookings_SA: vi.fn(),
  getLabMemberships_SA: vi.fn(),
  getAllLabMemberships_SA: vi.fn(),
  getMaintenanceRequests_SA: vi.fn(),
  getBlackoutDates_SA: vi.fn(),
  getRecurringBlackoutRules_SA: vi.fn(),
}));

vi.mock('@/lib/actions/notification.actions', () => ({
  markNotificationRead_SA: vi.fn(),
  markAllNotificationsRead_SA: vi.fn(),
  deleteNotification_SA: vi.fn(),
  deleteAllNotifications_SA: vi.fn(),
}));

// ── Mock auth context ─────────────────────────────────────────────────────────
const mockUseAuth = vi.fn();
vi.mock('@/components/auth-context', () => ({
  useAuth: () => mockUseAuth(),
}));

import * as dataActions from '@/lib/actions/data.actions';
import { AdminDataProvider, useAdminData } from '@/contexts/AdminDataContext';

// ── Helper: wrapper with QueryClientProvider + AdminDataProvider ───────────────
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AdminDataProvider>{children}</AdminDataProvider>
      </QueryClientProvider>
    );
  };
}

const MOCK_ADMIN = {
  id: 'admin-1',
  name: 'Admin User',
  email: 'admin@test.com',
  role: 'Admin' as const,
  status: 'active' as const,
  createdAt: new Date(),
};

const MOCK_RESEARCHER = {
  id: 'user-1',
  name: 'Researcher User',
  email: 'researcher@test.com',
  role: 'Researcher' as const,
  status: 'active' as const,
  createdAt: new Date(),
};

describe('AdminDataContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Non-admin: no fetches, isLoading = false ──────────────────────────────
  it('does NOT fetch data and keeps isLoading=false for non-admin users', async () => {
    mockUseAuth.mockReturnValue({ currentUser: MOCK_RESEARCHER });

    const { result } = renderHook(() => useAdminData(), { wrapper: makeWrapper() });

    // Allow any async effects to settle
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(dataActions.getLabs_SA).not.toHaveBeenCalled();
    expect(dataActions.getResourceTypes_SA).not.toHaveBeenCalled();
    expect(dataActions.getUsers_SA).not.toHaveBeenCalled();

    expect(result.current.labs).toEqual([]);
    expect(result.current.resourceTypes).toEqual([]);
    expect(result.current.allUsers).toEqual([]);
  });

  // ── Null user: isLoading = false ──────────────────────────────────────────
  it('returns empty state when currentUser is null', async () => {
    mockUseAuth.mockReturnValue({ currentUser: null });

    const { result } = renderHook(() => useAdminData(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.labs).toEqual([]);
    expect(result.current.allUsers).toEqual([]);
  });

  // ── Admin: fetches all three resources ────────────────────────────────────
  it('fetches labs, resourceTypes, and users for Admin users', async () => {
    mockUseAuth.mockReturnValue({ currentUser: MOCK_ADMIN });

    vi.mocked(dataActions.getLabs_SA).mockResolvedValue({
      success: true,
      data: [{ id: 'lab-1', name: 'Physics Lab', createdAt: new Date(), lastUpdatedAt: new Date() }] as any,
    });
    vi.mocked(dataActions.getResourceTypes_SA).mockResolvedValue({
      success: true,
      data: [{ id: 'rt-1', name: 'Laser' }] as any,
    });
    vi.mocked(dataActions.getUsers_SA).mockResolvedValue({
      success: true,
      data: [
        { id: 'u1', name: 'Alice', email: 'alice@test.com', role: 'Researcher', status: 'active', createdAt: new Date().toISOString() },
        { id: 'u2', name: 'Bob', email: 'bob@test.com', role: 'Technician', status: 'active', createdAt: new Date().toISOString() },
      ] as any,
    });

    const { result } = renderHook(() => useAdminData(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.labs).toHaveLength(1);
    expect(result.current.labs[0].name).toBe('Physics Lab');
    expect(result.current.resourceTypes).toHaveLength(1);
    expect(result.current.allUsers).toHaveLength(2);
  });

  // ── allTechnicians derived correctly ──────────────────────────────────────
  it('derives allTechnicians from allUsers (Technician + Admin roles)', async () => {
    mockUseAuth.mockReturnValue({ currentUser: MOCK_ADMIN });

    vi.mocked(dataActions.getLabs_SA).mockResolvedValue({ success: true, data: [] });
    vi.mocked(dataActions.getResourceTypes_SA).mockResolvedValue({ success: true, data: [] });
    vi.mocked(dataActions.getUsers_SA).mockResolvedValue({
      success: true,
      data: [
        { id: 'u1', role: 'Researcher', name: 'Alice', email: 'a@t.com', status: 'active', createdAt: new Date().toISOString() },
        { id: 'u2', role: 'Technician', name: 'Bob', email: 'b@t.com', status: 'active', createdAt: new Date().toISOString() },
        { id: 'u3', role: 'Admin', name: 'Carol', email: 'c@t.com', status: 'active', createdAt: new Date().toISOString() },
      ] as any,
    });

    const { result } = renderHook(() => useAdminData(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Only Technician + Admin should be in allTechnicians
    expect(result.current.allTechnicians).toHaveLength(2);
    expect(result.current.allTechnicians.map(u => u.id)).toEqual(['u2', 'u3']);
  });

  // ── refetch invalidates queries ───────────────────────────────────────────
  it('exposes a refetch function that triggers re-fetching', async () => {
    mockUseAuth.mockReturnValue({ currentUser: MOCK_ADMIN });

    vi.mocked(dataActions.getLabs_SA).mockResolvedValue({ success: true, data: [] });
    vi.mocked(dataActions.getResourceTypes_SA).mockResolvedValue({ success: true, data: [] });
    vi.mocked(dataActions.getUsers_SA).mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useAdminData(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const callCountBefore = vi.mocked(dataActions.getLabs_SA).mock.calls.length;

    // Calling refetch should mark queries stale and trigger new fetches
    result.current.refetch();

    await waitFor(() => {
      expect(vi.mocked(dataActions.getLabs_SA).mock.calls.length).toBeGreaterThan(callCountBefore);
    });
  });

  // ── useAdminData throws outside provider ──────────────────────────────────
  it('throws when used outside AdminDataProvider', () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
    );

    // Suppress console.error for this expected throw
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAdminData(), { wrapper })).toThrow(
      'useAdminData must be used within an AdminDataProvider'
    );
    consoleSpy.mockRestore();
  });
});
