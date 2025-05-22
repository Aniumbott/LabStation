
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
  logout: () => Promise<void>;
  signup: (name: string, email: string, password?: string) => Promise<{ success: boolean; message: string; userId?: string }>;
  updateUserProfile: (updatedFields: Partial<Pick<User, 'name'>>) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true); // Start with loading true

  useEffect(() => {
    // This simulates session restoration. In a real Firebase app,
    // you'd use onAuthStateChanged listener here.
    setIsLoading(true);
    try {
      const storedUserString = localStorage.getItem(LOCAL_STORAGE_USER_KEY);
      if (storedUserString) {
        const storedUser: User = JSON.parse(storedUserString);
        // Simple validation against mock data; Firebase handles this robustly.
        const validatedUser = initialMockUsers.find(u => u.id === storedUser.id && u.email === storedUser.email);
        if (validatedUser && validatedUser.status === 'active') {
          setCurrentUser(validatedUser);
        } else {
          localStorage.removeItem(LOCAL_STORAGE_USER_KEY); // Clear invalid stored user
        }
      }
    } catch (error) {
      console.error("Error loading user from localStorage:", error);
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    // In a real app, this would be:
    // const userCredential = await signInWithEmailAndPassword(auth, email, password);
    // setCurrentUser(mapFirebaseUserToAppUser(userCredential.user));
    // localStorage persistence would be handled by Firebase.
    console.log('Attempting login with (mock):', email);
    await new Promise(resolve => setTimeout(resolve, 500)); // Simulate network delay

    const loginResult = mockLoginUser(email, password);
    if (loginResult.success && loginResult.user) {
        setCurrentUser(loginResult.user);
        try {
          localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(loginResult.user));
        } catch (error) {
          console.error("Error saving user to localStorage:", error);
          // Non-critical for mock, but in real app, might inform user or retry
        }
        return { success: true };
    }
    return { success: false, message: loginResult.message || 'Login failed.' };
  };

  const logout = async (): Promise<void> => {
    // In a real app, this would be: await signOut(auth);
    // onAuthStateChanged would then set currentUser to null.
    console.log('Attempting logout (mock)');
    await new Promise(resolve => setTimeout(resolve, 200)); // Simulate network delay

    setCurrentUser(null);
    try {
      localStorage.removeItem(LOCAL_STORAGE_USER_KEY);
    } catch (error) {
      console.error("Error removing user from localStorage:", error);
    }
  };

  const signup = async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
    // In a real app:
    // const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // await updateProfile(userCredential.user, { displayName: name });
    // Then, you'd likely save additional user details (like role, status 'pending_approval') to Firestore.
    console.log('Attempting signup with (mock):', name, email);
    await new Promise(resolve => setTimeout(resolve, 700)); // Simulate network delay

    return mockSignupUser(name, email, password); // This already adds to initialMockUsers with 'pending_approval'
  };

  const updateUserProfile = useCallback(async (updatedFields: Partial<Pick<User, 'name'>>): Promise<{ success: boolean; message?: string }> => {
    if (!currentUser) {
      return { success: false, message: "No user logged in." };
    }
    // In a real app:
    // await updateProfile(auth.currentUser, { displayName: updatedFields.name });
    // await updateDoc(doc(firestore, "users", currentUser.id), { name: updatedFields.name });
    console.log('Attempting to update profile (mock):', updatedFields);
    await new Promise(resolve => setTimeout(resolve, 400)); // Simulate network delay

    const updatedUser = { ...currentUser, ...updatedFields };
    setCurrentUser(updatedUser);

    try {
      localStorage.setItem(LOCAL_STORAGE_USER_KEY, JSON.stringify(updatedUser));
    } catch (error) {
      console.error("Error saving updated user to localStorage:", error);
      return { success: false, message: "Failed to save profile to local storage." };
    }

    // Update in our mock global user list
    const userIndex = initialMockUsers.findIndex(u => u.id === currentUser.id);
    if (userIndex !== -1) {
      initialMockUsers[userIndex] = { ...initialMockUsers[userIndex], ...updatedUser };
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
