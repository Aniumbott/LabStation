
'use client';

import type { User } from '@/types';
import { mockLoginUser, mockSignupUser } from '@/lib/mock-data';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState } from 'react';

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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate checking for a logged-in user on mount (e.g., from localStorage in a real app)
    // For this mock, we'll start with no user logged in. User has to explicitly log in.
    // You could uncomment the below to auto-login an admin for easier dev:
    // const adminUser = mockLoginUser('admin@labstation.com', 'password');
    // if (adminUser) {
    //     setCurrentUser(adminUser);
    // }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    setIsLoading(true);
    const user = mockLoginUser(email, password);
    if (user) {
      setCurrentUser(user);
      setIsLoading(false);
      return { success: true };
    } else {
      setIsLoading(false);
      // Refine message for clarity
      const existingUser = initialMockUsers.find(u => u.email === email) || pendingSignups.find(u => u.email === email);
      if (existingUser?.status === 'pending_approval') {
        return { success: false, message: 'Account pending approval. Please wait for an admin.' };
      }
      return { success: false, message: 'Invalid email or password, or account not active.' };
    }
  };

  const logout = () => {
    setCurrentUser(null);
    // In a real app, also clear token from localStorage, etc.
    // For mock, we can also redirect to login page after logout for clarity
    // This would typically be handled by the component calling logout.
  };

  const signup = async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
    return mockSignupUser(name, email, password);
  };

  return (
    <AuthContext.Provider value={{ currentUser, isLoading, login, logout, signup }}>
      {!isLoading ? children : (
        <div className="flex flex-col items-center justify-center min-h-svh bg-background text-muted-foreground">
          {/* You can put a global loader here if needed while auth is checked */}
          {/* For now, rendering children directly or a minimal loader if children depend on auth state */}
          {children} 
        </div>
      )}
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

// Need to import initialMockUsers for login check message
import { initialMockUsers, pendingSignups } from '@/lib/mock-data';
