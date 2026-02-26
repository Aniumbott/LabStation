import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

// ── Mock all server-action modules before any hook imports ───────────────────
vi.mock('@/lib/actions/data.actions', () => ({
  getNotifications_SA: vi.fn(),
  getAuditLogs_SA: vi.fn(),
  getDashboardData_SA: vi.fn(),
  getResources_SA: vi.fn(),
  getResourceById_SA: vi.fn(),
  getResourceTypes_SA: vi.fn(),
  getBookings_SA: vi.fn(),
  getPendingBookings_SA: vi.fn(),
  getLabs_SA: vi.fn(),
  getLabMemberships_SA: vi.fn(),
  getAllLabMemberships_SA: vi.fn(),
  getUsers_SA: vi.fn(),
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

// Import hooks AFTER the mocks are registered
import {
  useNotifications,
  useAuditLogs,
  useDashboardData,
  useMarkNotificationRead,
  useDeleteNotification,
} from '@/lib/hooks/use-queries';

import * as dataActions from '@/lib/actions/data.actions';
import * as notifActions from '@/lib/actions/notification.actions';

// ── Test helpers ──────────────────────────────────────────────────────────────
function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

// ── useNotifications ──────────────────────────────────────────────────────────
describe('useNotifications', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled when userId is undefined', () => {
    const { result } = renderHook(() => useNotifications(undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.isPending).toBe(true); // disabled queries stay pending
    expect(result.current.data).toBeUndefined();
  });

  it('fetches notifications when userId is provided', async () => {
    const raw = [
      {
        id: 'n1',
        userId: 'u1',
        title: 'Test',
        message: 'Hello',
        type: 'booking_confirmed',
        isRead: false,
        createdAt: '2024-01-15T10:00:00.000Z',
        linkTo: null,
      },
    ];
    vi.mocked(dataActions.getNotifications_SA).mockResolvedValue({
      success: true,
      data: raw as any,
    });

    const { result } = renderHook(() => useNotifications('u1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(dataActions.getNotifications_SA).toHaveBeenCalledWith('u1');
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].id).toBe('n1');
    // createdAt should be rehydrated to a Date object
    expect(result.current.data![0].createdAt).toBeInstanceOf(Date);
  });

  it('throws when the server action returns success: false', async () => {
    vi.mocked(dataActions.getNotifications_SA).mockResolvedValue({
      success: false,
      message: 'Unauthorized',
    });

    const { result } = renderHook(() => useNotifications('u1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('Unauthorized');
  });

  it('returns empty array when server returns empty data', async () => {
    vi.mocked(dataActions.getNotifications_SA).mockResolvedValue({
      success: true,
      data: [],
    });

    const { result } = renderHook(() => useNotifications('u1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

// ── useAuditLogs ──────────────────────────────────────────────────────────────
describe('useAuditLogs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches audit logs and rehydrates timestamps', async () => {
    const rawLogs = [
      {
        id: 'log-1',
        timestamp: '2024-03-01T12:00:00.000Z',
        userId: 'admin-1',
        userName: 'Admin User',
        action: 'USER_CREATED',
        details: 'Created user Alice',
      },
    ];
    vi.mocked(dataActions.getAuditLogs_SA).mockResolvedValue({
      success: true,
      data: rawLogs as any,
    });

    const { result } = renderHook(() => useAuditLogs(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].timestamp).toBeInstanceOf(Date);
    expect(result.current.data![0].userName).toBe('Admin User');
  });

  it('surfaces server-action error', async () => {
    vi.mocked(dataActions.getAuditLogs_SA).mockResolvedValue({
      success: false,
      message: 'DB error',
    });

    const { result } = renderHook(() => useAuditLogs(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error).message).toBe('DB error');
  });
});

// ── useDashboardData ──────────────────────────────────────────────────────────
describe('useDashboardData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('is disabled when userId is undefined', () => {
    const { result } = renderHook(() => useDashboardData(undefined), {
      wrapper: makeWrapper(),
    });
    expect(result.current.isLoading).toBe(false);
  });

  it('fetches dashboard data for a given userId', async () => {
    const mockData = {
      labs: [{ id: 'lab-1', name: 'Chemistry Lab', createdAt: new Date(), lastUpdatedAt: new Date() }],
      userLabMemberships: [],
      recentResources: [],
      upcomingBookings: [],
    };
    vi.mocked(dataActions.getDashboardData_SA).mockResolvedValue({
      success: true,
      data: mockData as any,
    });

    const { result } = renderHook(() => useDashboardData('u1'), {
      wrapper: makeWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(dataActions.getDashboardData_SA).toHaveBeenCalledWith('u1');
    expect(result.current.data?.labs).toHaveLength(1);
    expect(result.current.data?.labs[0].name).toBe('Chemistry Lab');
  });
});

// ── useMarkNotificationRead (optimistic mutation) ─────────────────────────────
describe('useMarkNotificationRead', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls markNotificationRead_SA with correct args on mutate', async () => {
    vi.mocked(notifActions.markNotificationRead_SA).mockResolvedValue({
      success: true,
    });

    const { result } = renderHook(() => useMarkNotificationRead('u1'), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ callerUserId: 'u1', notificationId: 'n1' });

    expect(notifActions.markNotificationRead_SA).toHaveBeenCalledWith({
      callerUserId: 'u1',
      notificationId: 'n1',
    });
  });

  it('throws when server action returns success: false', async () => {
    vi.mocked(notifActions.markNotificationRead_SA).mockResolvedValue({
      success: false,
      message: 'Not found',
    });

    const { result } = renderHook(() => useMarkNotificationRead('u1'), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ callerUserId: 'u1', notificationId: 'n1' })
    ).rejects.toThrow('Not found');
  });
});

// ── useDeleteNotification (optimistic mutation) ───────────────────────────────
describe('useDeleteNotification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteNotification_SA with correct args', async () => {
    vi.mocked(notifActions.deleteNotification_SA).mockResolvedValue({
      success: true,
    });

    const { result } = renderHook(() => useDeleteNotification('u1'), {
      wrapper: makeWrapper(),
    });

    await result.current.mutateAsync({ callerUserId: 'u1', notificationId: 'n99' });

    expect(notifActions.deleteNotification_SA).toHaveBeenCalledWith({
      callerUserId: 'u1',
      notificationId: 'n99',
    });
  });

  it('throws on server-action failure', async () => {
    vi.mocked(notifActions.deleteNotification_SA).mockResolvedValue({
      success: false,
      message: 'Permission denied',
    });

    const { result } = renderHook(() => useDeleteNotification('u1'), {
      wrapper: makeWrapper(),
    });

    await expect(
      result.current.mutateAsync({ callerUserId: 'u1', notificationId: 'n99' })
    ).rejects.toThrow('Permission denied');
  });
});
