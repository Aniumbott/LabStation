
'use client';

import type { User, RoleName } from '@/types'; // Added RoleName for future use if needed
import { mockLoginUser, mockSignupUser, initialMockUsers, pendingSignups, addNotification } from '@/lib/mock-data';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

const LOCAL_STORAGE_USER_KEY = 'labstation_currentUser';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean; // To track initial auth check
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  signup: (name: string, email: string, password?: string) => Promise<{ success: boolean; message: string; userId?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true

  useEffect(() => {
    // Try to load user from localStorage on initial mount
    try {
      const storedUserString = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (storedUserString) {
        const storedUser: User = JSON.parse(storedUserString);
        // Optional: Re-validate user against mock data in case it changed
        // For this mock, we'll trust localStorage, but in a real app, you'd validate a token.
        const validatedUser = initialMockUsers.find(u => u.id === storedUser.id && u.email === storedUser.email);
        if (validatedUser && validatedUser.status === 'active') {
          setCurrentUser(validatedUser);
        } else {
          // User from localStorage is no longer valid or not active
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        }
      }
    } catch (error) {
      console.error("Error loading user from localStorage:", error);
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY); // Clear corrupted data
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    // setIsLoading(true); // No need to set loading here, login is quick
    const user = mockLoginUser(email, password);
    if (user) {
      setCurrentUser(user);
      try {
        localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
      } catch (error) {
        console.error("Error saving user to localStorage:", error);
      }
      // setIsLoading(false);
      return { success: true };
    } else {
      // setIsLoading(false);
      const existingUser = initialMockUsers.find(u => u.email === email) || pendingSignups.find(u => u.email === email);
      if (existingUser?.status === 'pending_approval') {
        return { success: false, message: 'Account pending approval. Please wait for an admin.' };
      }
      return { success: false, message: 'Invalid email or password, or account not active.' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    try {
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    } catch (error) {
      console.error("Error removing user from localStorage:", error);
    }
  };

  const signup = async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
    // mockSignupUser already handles adding to pendingSignups and notifying admin
    return mockSignupUser(name, email, password);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, logout, signup }}>
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
