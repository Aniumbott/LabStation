
'use client';

import { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo, ReactNode } from 'react';
import type { Lab, ResourceType, User } from '@/types';
import { useAuth } from '@/components/auth-context';
import { getLabs_SA, getResourceTypes_SA, getUsers_SA } from '@/lib/actions/data.actions';

interface AdminDataContextType {
  labs: Lab[];
  resourceTypes: ResourceType[];
  allUsers: User[];
  allTechnicians: User[];
  isLoading: boolean;
  refetch: () => void;
}

const AdminDataContext = createContext<AdminDataContextType | undefined>(undefined);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useAuth();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [resourceTypes, setResourceTypes] = useState<ResourceType[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Tracks which user ID we last completed a fetch for.
  // This allows us to detect when we need a fresh fetch after logout → re-login.
  const fetchedForUserIdRef = useRef<string | null>(null);

  // Reset loading state immediately when the current user changes.
  // This effect runs before the fetchData effect (effects run in declaration order),
  // so admin pages see isLoading=true right away instead of briefly showing empty state.
  useEffect(() => {
    if (currentUser?.role === 'Admin') {
      // A different admin (or same admin after logout/re-login) needs fresh data.
      if (fetchedForUserIdRef.current !== currentUser.id) {
        setIsLoading(true);
      }
    } else {
      // Non-admin or logged out: clear data immediately.
      setLabs([]);
      setResourceTypes([]);
      setAllUsers([]);
      setIsLoading(false);
      fetchedForUserIdRef.current = null;
    }
  }, [currentUser]);

  const fetchData = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'Admin') {
      setLabs([]);
      setResourceTypes([]);
      setAllUsers([]);
      setIsLoading(false);
      fetchedForUserIdRef.current = null;
      return;
    }

    setIsLoading(true);
    try {
      const [labsResult, typesResult, usersResult] = await Promise.all([
        getLabs_SA(),
        getResourceTypes_SA(),
        getUsers_SA(currentUser.id)
      ]);

      const fetchedLabs: Lab[] = labsResult.success && labsResult.data ? labsResult.data : [];
      const fetchedTypes: ResourceType[] = typesResult.success && typesResult.data ? typesResult.data : [];
      const fetchedUsers: User[] = usersResult.success && usersResult.data ? usersResult.data.map(u => ({
        ...u,
        createdAt: u.createdAt ? new Date(u.createdAt) : new Date()
      })) : [];

      setLabs(fetchedLabs);
      setResourceTypes(fetchedTypes);
      setAllUsers(fetchedUsers);
      fetchedForUserIdRef.current = currentUser.id;

    } catch (error) {
      console.error("Failed to fetch admin data context:", error);
      setLabs([]);
      setResourceTypes([]);
      setAllUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const allTechnicians = useMemo(() => allUsers.filter(u => u.role === 'Technician' || u.role === 'Admin'), [allUsers]);

  const value = useMemo(() => ({
    labs,
    resourceTypes,
    allUsers,
    allTechnicians,
    isLoading,
    refetch: fetchData,
  }), [labs, resourceTypes, allUsers, allTechnicians, isLoading, fetchData]);

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
