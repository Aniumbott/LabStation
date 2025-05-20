
'use client';

import type { User, RoleName } from '@/types';
import { mockLoginUser, mockSignupUser, initialMockUsers, addNotification } from '@/lib/mock-data';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const LOCAL_STORAGE_USER_KEY = 'labstation_currentUser';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean; // To track initial auth check
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => void;
  signup: (name: string, email: string, password?: string) => Promise<{ success: boolean; message: string; userId?: string }>;
  updateUserProfile: (updatedFields: Partial<Pick<User, 'name'>>) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true

  useEffect(() => {
    setIsLoading(true);
    try {
      const storedUserString = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (storedUserString) {
        const storedUser: User = JSON.parse(storedUserString);
        const validatedUser = initialMockUsers.find(u => u.id === storedUser.id && u.email === storedUser.email);
        if (validatedUser && validatedUser.status === 'active') {
          setCurrentUser(validatedUser);
        } else {
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
        }
      }
    } catch (error) {
      console.error("Error loading user from localStorage:", error);
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    const user = mockLoginUser(email, password);
    if (user) {
      if (user.status === 'pending_approval') {
        return { success: false, message: 'Account pending approval. Please wait for an admin.' };
      }
      if (user.status === 'active') {
        setCurrentUser(user);
        try {
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(user));
        } catch (error) {
          console.error("Error saving user to localStorage:", error);
        }
        return { success: true };
      }
    }
    return { success: false, message: 'Invalid email or password, or account not active/pending.' };
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
    return mockSignupUser(name, email, password);
  };

  const updateUserProfile = useCallback(async (updatedFields: Partial<Pick<User, 'name'>>): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) {
      return { success: false, message: "No user logged in." };
    }
    const updatedUser = { ...currentUser, ...updatedFields };
    setCurrentUser(updatedUser);

    try {
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updatedUser));
    } catch (error) {
      console.error("Error saving updated user to localStorage:", error);
      // Optionally, revert setCurrentUser if localStorage fails critically
      return { success: false, message: "Failed to save profile to local storage." };
    }

    // Update in mock data for session consistency
    const userIndex = initialMockUsers.findIndex(u => u.id === currentUser.id);
    if (userIndex !== -1) {
      initialMockUsers[userIndex] = { ...initialMockUsers[userIndex], ...updatedFields };
    }
    return { success: true, message: "Profile updated successfully." };
  }, [currentUser]);


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
