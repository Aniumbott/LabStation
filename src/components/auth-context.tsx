
'use client';

import type { User, RoleName } from '@/types';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  type User as FirebaseUser,
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { addNotification, addAuditLog } from '@/lib/mock-data';

interface AuthContextType {
  currentUser: User | null;
  isLoading: boolean;
  login: (email: string, password?: string) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  signup: (name: string, email: string, password?: string) => Promise<{ success: boolean; message: string; userId?: string }>;
  updateUserProfile: (updatedFields: Partial<Pick<User, 'name' | 'avatarUrl'>>) => Promise<{ success: boolean; message?: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setIsLoading(true);
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userProfileData = userDocSnap.data() as Omit<User, 'id' | 'email'>;

            if (userProfileData.status === 'active') {
              const appUser: User = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || userProfileData.name || '',
                email: firebaseUser.email || '',
                role: userProfileData.role,
                status: userProfileData.status,
                avatarUrl: firebaseUser.photoURL || userProfileData.avatarUrl,
                createdAt: userProfileData.createdAt && typeof userProfileData.createdAt === 'object' && 'toDate' in userProfileData.createdAt
                  // @ts-ignore Firestore Timestamp
                  ? userProfileData.createdAt.toDate().toISOString()
                  // @ts-ignore
                  : userProfileData.createdAt || new Date().toISOString(),
              };
              setCurrentUser(appUser);
              if (typeof window !== 'undefined') localStorage.removeItem('login_message');
            } else {
              let message = 'Your account is not active.';
              if (userProfileData.status === 'pending_approval') {
                message = 'Account pending approval. Please wait for an admin.';
              } else if (userProfileData.status === 'suspended') {
                message = 'Your account has been suspended.';
              }
              if (typeof window !== 'undefined') localStorage.setItem('login_message', message);
              await firebaseSignOut(auth);
              setCurrentUser(null);
            }
          } else {
             console.warn(`User ${firebaseUser.uid} authenticated with Firebase but no Firestore profile found. Signing out.`);
             if (typeof window !== 'undefined') localStorage.setItem('login_message', 'User profile not found. Please contact support or try signing up again if this is unexpected.');
            await firebaseSignOut(auth);
            setCurrentUser(null);
          }
        } catch (error) {
          console.error("Error fetching Firestore user profile:", error);
          if (typeof window !== 'undefined') localStorage.setItem('login_message', 'Error retrieving your profile.');
          await firebaseSignOut(auth);
          setCurrentUser(null);
        }
      } else {
        setCurrentUser(null);
        if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    setIsLoading(true);
    if (typeof window !== 'undefined') localStorage.removeItem('login_message');

    try {
      // Firebase Authentication
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle fetching Firestore profile, setting currentUser, and isLoading=false
      // If onAuthStateChanged determines user isn't active, it will sign them out from Firebase too.
      return { success: true };
    } catch (error: any) {
      console.error("Firebase login error:", error);
      let message = "Login failed. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Access to this account has been temporarily disabled due to many failed login attempts.";
      } else if (error.code === 'auth/user-disabled') {
         message = "This user account has been disabled by Firebase.";
      }
      setIsLoading(false);
      return { success: false, message };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will set currentUser to null and isLoading to false.
      // Also clear local storage explicitly
      if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
    } catch (error) {
      console.error("Firebase logout error:", error);
      setCurrentUser(null); // Manually clear on error
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      await firebaseUpdateProfile(firebaseUser, { displayName: name });

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const newUserProfileData = {
        name: name,
        email: firebaseUser.email || email,
        role: 'Researcher' as RoleName,
        status: 'pending_approval' as User['status'],
        avatarUrl: firebaseUser.photoURL || 'https://placehold.co/100x100.png',
        createdAt: serverTimestamp(), // Use Firestore server timestamp
      };
      await setDoc(userDocRef, newUserProfileData);

      // Add admin notification for new signup
      // Assuming admin 'u1' from previous mock data is a placeholder for a real admin UID
      // In a real system, you'd have a better way to target admins or a collection for pending tasks.
      const adminToNotify = "ADMIN_USER_ID_PLACEHOLDER"; // Replace with actual Admin UID or system
      if(adminToNotify !== "ADMIN_USER_ID_PLACEHOLDER"){
         await addNotification(
            adminToNotify,
            'New Signup Request',
            `User ${name} (${email}) has signed up and is awaiting approval.`,
            'signup_pending_admin',
            '/admin/users' // Link to users page where pending users are visible
        );
      } else {
        console.warn("Admin UID for signup notification not configured.")
      }


      await firebaseSignOut(auth); // Sign out user immediately; they need approval
      setIsLoading(false);
      return { success: true, message: 'Signup successful! Your request is awaiting admin approval.', userId: firebaseUser.uid };
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase signup error:", error);
      let message = "Signup failed. Please try again.";
      if (error.code === 'auth/email-already-in-use') {
        message = "This email address is already in use by another account.";
      } else if (error.code === 'auth/weak-password') {
        message = "Password is too weak. It should be at least 6 characters.";
      }
      return { success: false, message };
    }
  };

 const updateUserProfile = useCallback(async (updatedFields: Partial<Pick<User, 'name' | 'avatarUrl'>>): Promise<{ success: boolean; message?: string }> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !currentUser) {
      return { success: false, message: "No user logged in." };
    }
    
    setIsLoading(true);
    try {
      const updatesForAuth: { displayName?: string; photoURL?: string } = {};
      if (updatedFields.name && updatedFields.name !== firebaseUser.displayName) {
        updatesForAuth.displayName = updatedFields.name;
      }
      if (updatedFields.avatarUrl && updatedFields.avatarUrl !== firebaseUser.photoURL) {
        updatesForAuth.photoURL = updatedFields.avatarUrl;
      }
      if (Object.keys(updatesForAuth).length > 0) {
        await firebaseUpdateProfile(firebaseUser, updatesForAuth);
      }

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const firestoreUpdates: Partial<Pick<User, 'name' | 'avatarUrl'>> = {};
      if(updatedFields.name) firestoreUpdates.name = updatedFields.name;
      if(updatedFields.avatarUrl) firestoreUpdates.avatarUrl = updatedFields.avatarUrl;
      
      if (Object.keys(firestoreUpdates).length > 0) {
        await updateDoc(userDocRef, firestoreUpdates);
      }
      
      setCurrentUser(prevUser => {
        if (!prevUser) return null;
        const updatedAppUser = {
          ...prevUser,
          name: updatedFields.name || prevUser.name,
          avatarUrl: updatedFields.avatarUrl || prevUser.avatarUrl,
        };
        if (typeof window !== 'undefined') {
            localStorage.setItem('labstation_user', JSON.stringify(updatedAppUser));
        }
        return updatedAppUser;
      });
      
      setIsLoading(false);
      return { success: true, message: "Profile updated successfully." };
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase profile update error:", error);
      return { success: false, message: error.message || "Failed to update profile." };
    }
  }, [currentUser]);

  // Attempt to load user from localStorage on initial mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('labstation_user');
      if (storedUser) {
        try {
          const parsedUser: User = JSON.parse(storedUser);
          // Basic validation: check if essential fields exist and if this user still "exists" in Firebase Auth
          // A more robust check might involve re-validating the session with Firebase if needed.
          // For this mock, if local user matches an existing auth user, we assume it's valid.
          if (parsedUser && parsedUser.id && auth.currentUser && auth.currentUser.uid === parsedUser.id) {
             // Further check: Fetch from Firestore to ensure status is still active.
             // This is now handled by onAuthStateChanged, so the localStorage load is more of a quick pre-fill.
             // onAuthStateChanged will be the ultimate source of truth.
          } else {
             // localStorage user doesn't match current auth state, clear it.
             localStorage.removeItem('labstation_user');
          }
        } catch (e) {
          console.error("Failed to parse user from localStorage", e);
          localStorage.removeItem('labstation_user');
        }
      }
    }
  }, []);


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
