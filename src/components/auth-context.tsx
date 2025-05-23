
'use client';

import type { User, RoleName } from '@/types';
import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useState, useCallback }
from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile as firebaseUpdateProfile,
  type User as FirebaseUser
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { addNotification } from '@/lib/mock-data'; // Keep for admin notification on new signup

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
                name: firebaseUser.displayName || userProfileData.name || '', // Prioritize Firebase Auth displayName
                email: firebaseUser.email || '', // Prioritize Firebase Auth email
                role: userProfileData.role,
                status: userProfileData.status,
                avatarUrl: firebaseUser.photoURL || userProfileData.avatarUrl,
                createdAt: userProfileData.createdAt, // Ensure this field exists or handle if not
              };
              setCurrentUser(appUser);
              if (typeof window !== 'undefined') localStorage.removeItem('login_message');
            } else {
              if (typeof window !== 'undefined') {
                if (userProfileData.status === 'pending_approval') {
                  localStorage.setItem('login_message', 'Account pending approval. Please wait for an admin.');
                } else if (userProfileData.status === 'suspended') {
                  localStorage.setItem('login_message', 'Your account has been suspended.');
                }
              }
              await firebaseSignOut(auth);
              setCurrentUser(null);
            }
          } else {
            // No Firestore profile, means signup might be incomplete or user deleted from Firestore
            // This case is tricky: if just signed up, profile might not be there yet.
            // For robustness, if no profile, treat as not fully logged in for app purposes.
             console.warn(`User ${firebaseUser.uid} authenticated with Firebase but no Firestore profile found. Signing out.`);
             if (typeof window !== 'undefined') localStorage.setItem('login_message', 'User profile not found. Please contact support or try signing up again.');
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
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle setting currentUser and isLoading=false
      return { success: true };
    } catch (error: any) {
      console.error("Firebase login error:", error);
      let message = "Login failed. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Access to this account has been temporarily disabled due to many failed login attempts.";
      } else if (error.code === 'auth/user-disabled') {
         message = "This user account has been disabled.";
      }
      setIsLoading(false); // Ensure loading is false on direct error
      return { success: false, message };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will set currentUser to null and isLoading to false.
    } catch (error) {
      console.error("Firebase logout error:", error);
      setCurrentUser(null); // Manually clear on error
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
    if (!password) return { success: false, message: "Password is required.", userId: undefined };
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update Firebase Auth profile (optional, but good for displayName)
      await firebaseUpdateProfile(firebaseUser, { displayName: name });

      // Create user document in Firestore
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const newUserProfileData: Omit<User, 'id'> = {
        name: name,
        email: firebaseUser.email || email, // Use email from FirebaseUser if available
        role: 'Researcher', // Default role
        status: 'pending_approval', // Default status
        avatarUrl: firebaseUser.photoURL || 'https://placehold.co/100x100.png',
        createdAt: new Date().toISOString(), // Or serverTimestamp() if you prefer Firestore's handling
      };
      await setDoc(userDocRef, newUserProfileData);

      // For mock-data based notification system:
      // Find an admin to notify. In a real app, this might involve querying admins or a topic.
      // For simplicity, we can try to notify a known admin ID if it exists, or just log.
      // This part is tricky without knowing admin UIDs.
      // For the demo, we can assume a known admin user ID if it exists in mock-data or skip if not.
      // const adminUser = initialMockUsers.find(u => u.role === 'Admin'); // This line will break as initialMockUsers is removed
      // if (adminUser) {
      // This is tricky now. We'll have to find a way to notify admins.
      // For now, let's rely on admins checking the Users page.
      // A better approach would be a Cloud Function listening to new user docs.
      console.log(`New user ${name} (${email}) signed up. Needs approval. Admin UID to notify would be needed.`);
      // Add a generic notification or specific if admin ID is known.
      // For example, if you have a fixed admin UID 'admin_user_id_placeholder':
      // addNotification(
      //     'admin_user_id_placeholder',
      //     'New Signup Request',
      //     `User ${name} (${email}) has signed up and is awaiting approval.`,
      //     'signup_pending_admin',
      //     '/admin/users'
      // );


      await firebaseSignOut(auth); // Sign out user immediately after signup; they need approval
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
    if (!firebaseUser || !currentUser) { // Check against context's currentUser as well
      return { success: false, message: "No user logged in." };
    }
    
    setIsLoading(true);
    try {
      // Update Firebase Auth profile
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

      // Update Firestore user document
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const firestoreUpdates: Partial<Omit<User, 'id' | 'email' | 'role' | 'status' | 'createdAt'>> = {};
      if(updatedFields.name) firestoreUpdates.name = updatedFields.name;
      if(updatedFields.avatarUrl) firestoreUpdates.avatarUrl = updatedFields.avatarUrl;
      
      if (Object.keys(firestoreUpdates).length > 0) {
        await updateDoc(userDocRef, firestoreUpdates);
      }
      
      // Update local currentUser state
      setCurrentUser(prevUser => {
        if (!prevUser) return null;
        const updatedAppUser = {
          ...prevUser,
          name: updatedFields.name || prevUser.name,
          avatarUrl: updatedFields.avatarUrl || prevUser.avatarUrl,
        };
        return updatedAppUser;
      });
      
      setIsLoading(false);
      return { success: true, message: "Profile updated successfully." };
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase profile update error:", error);
      return { success: false, message: error.message || "Failed to update profile." };
    }
  }, [currentUser]); // Added currentUser to dependency array

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
