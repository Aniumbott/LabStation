
'use client';

import type { User, RoleName } from '@/types';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { updateUserProfile_SA } from '@/lib/actions/user.actions';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  signup: (name: string, email: string, password?: string) => Promise<{ success: boolean; message: string; userId?: string }>;
  updateUserProfile: (updatedFields: Partial<Pick<User, 'name' | 'avatarUrl'>>) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'labstation_user';
const MESSAGE_KEY = 'login_message';

function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Rehydrate createdAt as a Date
    if (parsed.createdAt) parsed.createdAt = new Date(parsed.createdAt);
    return parsed as User;
  } catch {
    return null;
  }
}

function storeUser(user: User | null): void {
  if (typeof window === 'undefined') return;
  if (user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function clearLoginMessage(): void {
  if (typeof window !== 'undefined') localStorage.removeItem(MESSAGE_KEY);
}

function setLoginMessage(message: string): void {
  if (typeof window !== 'undefined') localStorage.setItem(MESSAGE_KEY, message);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(getStoredUser);
  const [isLoading, setIsLoading] = useState(true);
  const didMount = useRef(false);
  const queryClient = useQueryClient();

  // Fetch the authenticated user from the JWT cookie via the API route.
  const fetchMe = useCallback(async (): Promise<User | null> => {
    try {
      const res = await fetch('/api/auth/me');
      if (!res.ok) {
        // Any non-OK response (including 401) means no valid session.
        setCurrentUser(null);
        storeUser(null);
        return null;
      }
      const data = await res.json();
      const user: User = {
        ...data.user,
        createdAt: data.user.createdAt ? new Date(data.user.createdAt) : new Date(),
      };
      setCurrentUser(user);
      storeUser(user);
      return user;
    } catch {
      setCurrentUser(null);
      storeUser(null);
      return null;
    }
  }, []);

  // On mount: quick hydration from localStorage, then validate with /api/auth/me
  useEffect(() => {
    if (didMount.current) return;
    didMount.current = true;

    (async () => {
      // currentUser is already hydrated from localStorage via the lazy initialiser.
      // Now validate against the server.
      await fetchMe();
      setIsLoading(false);
    })();
  }, [fetchMe]);

  const login = useCallback(async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    if (!password) return { success: false, message: 'Password is required.' };

    setIsLoading(true);
    clearLoginMessage();

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        const message = data.message || 'Login failed. Please check your credentials or contact support.';
        setLoginMessage(message);
        setIsLoading(false);
        return { success: false, message };
      }

      // Successful login — hydrate user state.
      const user: User = {
        ...data.user,
        createdAt: data.user.createdAt ? new Date(data.user.createdAt) : new Date(),
      };
      setCurrentUser(user);
      storeUser(user);
      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      const message = error.message || 'Login failed. Please try again.';
      setLoginMessage(message);
      setIsLoading(false);
      return { success: false, message };
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {
      // Even if the API call fails, clear local state.
    }
    // Clear the entire React Query cache so no stale data leaks to the next
    // session (e.g. admin data visible to the next non-admin user).
    queryClient.clear();
    setCurrentUser(null);
    storeUser(null);
    clearLoginMessage();
    setIsLoading(false);
  }, [queryClient]);

  const signup = useCallback(async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
    if (!password) return { success: false, message: 'Password is required.' };

    setIsLoading(true);
    clearLoginMessage();

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await res.json();

      setIsLoading(false);

      if (!res.ok || !data.success) {
        return { success: false, message: data.message || 'Signup failed. Please try again.' };
      }

      // On success do NOT set currentUser — the user is pending approval.
      return { success: true, message: data.message || 'Signup successful! Your request is awaiting admin approval.', userId: data.userId };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, message: error.message || 'Signup failed. Please try again.' };
    }
  }, []);

  const updateUserProfile = useCallback(async (updatedFields: Partial<Pick<User, 'name' | 'avatarUrl'>>): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) {
      return { success: false, message: 'No user logged in or user data unavailable.' };
    }

    setIsLoading(true);

    try {
      const result = await updateUserProfile_SA({
        callerUserId: currentUser.id,
        targetUserId: currentUser.id,
        name: updatedFields.name,
        avatarUrl: updatedFields.avatarUrl,
      });

      if (!result.success) {
        setIsLoading(false);
        return { success: false, message: result.message || 'Failed to update profile.' };
      }

      // Re-fetch the authoritative user state from the server.
      await fetchMe();
      setIsLoading(false);
      return { success: true, message: 'Profile updated successfully.' };
    } catch (error: any) {
      setIsLoading(false);
      return { success: false, message: error.message || 'Failed to update profile.' };
    }
  }, [currentUser, fetchMe]);

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, logout, signup, updateUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
