
'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type { Lab, ResourceType, User } from '@/types';
import { db } from '@/lib/firebase';
import { collection, query, orderBy, getDocs, Timestamp } from 'firebase/firestore';
import { useAuth } from '@/components/auth-context';

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

  const fetchData = useCallback(async () => {
    if (!currentUser || currentUser.role !== 'Admin') {
      setLabs([]);
      setResourceTypes([]);
      setAllUsers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [labsSnapshot, typesSnapshot, usersSnapshot] = await Promise.all([
        getDocs(query(collection(db, 'labs'), orderBy('name'))),
        getDocs(query(collection(db, 'resourceTypes'), orderBy('name'))),
        getDocs(query(collection(db, 'users'), orderBy('name')))
      ]);

      const fetchedLabs: Lab[] = labsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Lab));
      const fetchedTypes: ResourceType[] = typesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ResourceType));
      const fetchedUsers: User[] = usersSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : new Date()
        } as User;
      });

      setLabs(fetchedLabs);
      setResourceTypes(fetchedTypes);
      setAllUsers(fetchedUsers);

    } catch (error) {
      console.error("Failed to fetch admin data context:", error);
      // In case of error, set to empty to avoid partial data states
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
