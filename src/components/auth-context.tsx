
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
  type User as FirebaseUser
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase'; // Ensure db is exported from firebase.ts
import { doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { addNotification, initialMockUsers } from '@/lib/mock-data'; // Assuming initialMockUsers is for seeding or admin lookup only

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
  const [isLoading, setIsLoading] = useState(true); // Start true to load from localStorage or Firebase

  useEffect(() => {
    // Try to load user from localStorage on initial mount (client-side only)
    // This simulates session persistence for the mock environment.
    // Firebase's onAuthStateChanged will be the primary driver.
    // We don't set isLoading here initially; onAuthStateChanged handles it.
    if (typeof window !== 'undefined') {
      const storedUser = localStorage.getItem('currentUser');
      if (storedUser) {
        try {
          const user: User = JSON.parse(storedUser);
          // This is a temporary measure for mock. In real Firebase,
          // onAuthStateChanged confirms session validity.
          setCurrentUser(user);
        } catch (e) {
          console.error("Error parsing stored user from localStorage", e);
          localStorage.removeItem('currentUser');
        }
      }
    }
    // setIsLoading(false) will be definitively handled by onAuthStateChanged
  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setIsLoading(true); // Set loading true while we verify/fetch profile
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userProfileData = userDocSnap.data() as Omit<User, 'id' | 'email' | 'name'>;

            if (userProfileData.status === 'active') {
              const appUser: User = {
                id: firebaseUser.uid,
                name: firebaseUser.displayName || userProfileData.name || '',
                email: firebaseUser.email || '',
                role: userProfileData.role,
                status: userProfileData.status,
                avatarUrl: firebaseUser.photoURL || userProfileData.avatarUrl,
                createdAt: userProfileData.createdAt,
              };
              setCurrentUser(appUser);
              if (typeof window !== 'undefined') {
                localStorage.setItem('currentUser', JSON.stringify(appUser));
                localStorage.removeItem('login_message'); // Clear any previous login messages
              }
            } else {
              // User exists in Firestore but is not 'active'
              console.log(`User ${firebaseUser.uid} status is ${userProfileData.status}. Logging out from onAuthStateChanged.`);
              if (typeof window !== 'undefined') {
                if (userProfileData.status === 'pending_approval') {
                  localStorage.setItem('login_message', 'Account pending approval. Please wait for an admin.');
                } else if (userProfileData.status === 'suspended') {
                  localStorage.setItem('login_message', 'Your account has been suspended.');
                }
                localStorage.removeItem('currentUser');
              }
              await firebaseSignOut(auth); // Ensure Firebase session is cleared
              setCurrentUser(null); // Ensure app state is cleared
            }
          } else {
            // No Firestore profile, or profile deleted.
            console.warn(`User ${firebaseUser.uid} has Firebase session but no Firestore profile or invalid status. Logging out from onAuthStateChanged.`);
            if (typeof window !== 'undefined') {
              localStorage.setItem('login_message', 'User profile not found or incomplete. Please contact support.');
              localStorage.removeItem('currentUser');
            }
            await firebaseSignOut(auth);
            setCurrentUser(null);
          }
        } catch (error) {
          console.error("Error in onAuthStateChanged (fetching Firestore profile):", error);
          if (typeof window !== 'undefined') {
            localStorage.setItem('login_message', 'Error retrieving your profile.');
            localStorage.removeItem('currentUser');
          }
          await firebaseSignOut(auth);
          setCurrentUser(null);
        }
      } else {
        // No Firebase user session active
        setCurrentUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('currentUser');
          // Don't clear login_message here as it might be from a failed attempt
        }
      }
      setIsLoading(false); // All checks complete, set loading to false
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    
    setIsLoading(true); // Indicate login process starting
    if (typeof window !== 'undefined') {
        localStorage.removeItem('login_message'); // Clear previous messages
    }

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // If successful, onAuthStateChanged will:
      // 1. Set isLoading(true) again (briefly for Firestore check).
      // 2. Fetch Firestore profile.
      // 3. If profile valid and active, set currentUser and localStorage.
      // 4. Finally set isLoading(false).
      // If profile not valid/active, onAuthStateChanged will sign out from Firebase, set currentUser to null,
      // set login_message, and then set isLoading(false).
      return { success: true }; // Indicates Firebase auth call succeeded.
    } catch (error: any) {
      // This catch is for Firebase SDK errors during signInWithEmailAndPassword
      console.error("Firebase login error (signInWithEmailAndPassword):", error);
      let message = "Login failed. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
      } else if (error.code === 'auth/user-disabled') {
        message = "This user account has been disabled by an administrator.";
      }
      // Set isLoading(false) here because onAuthStateChanged might not run if signIn fails early.
      setIsLoading(false); 
      return { success: false, message };
    }
  };

  const logout = async (): Promise<void> => {
    // isLoading will be set true by onAuthStateChanged when firebaseUser becomes null
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will handle clearing currentUser, localStorage, and setting isLoading to false.
    } catch (error) {
      console.error("Firebase logout error:", error);
      // If firebaseSignOut fails, we might still be "logged in" to Firebase.
      // Manually clear app state and set loading false.
      setCurrentUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('currentUser');
      }
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
    if (!password) return { success: false, message: "Password is required.", userId: undefined };
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      await firebaseUpdateProfile(firebaseUser, { displayName: name });

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const newUserProfileData: Omit<User, 'id'> = {
        name: name,
        email: firebaseUser.email || email,
        role: 'Researcher',
        status: 'pending_approval',
        avatarUrl: firebaseUser.photoURL || 'https://placehold.co/100x100.png',
        createdAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, newUserProfileData);
      
      const adminUser = initialMockUsers.find(u => u.role === 'Admin');
      if(adminUser){
          addNotification(
              adminUser.id, 
              'New Signup Request',
              `User ${name} (${email}) has signed up and is awaiting approval.`,
              'signup_pending_admin',
              '/admin/users' 
          );
      }
      
      await firebaseSignOut(auth); 
      // onAuthStateChanged will handle setting currentUser to null and isLoading to false.
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
      return { success: false, message: "No user logged in or user data inconsistent." };
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
      const firestoreUpdates: Partial<User> = {};
      if(updatedFields.name && updatedFields.name !== currentUser.name) firestoreUpdates.name = updatedFields.name;
      if(updatedFields.avatarUrl && updatedFields.avatarUrl !== currentUser.avatarUrl) firestoreUpdates.avatarUrl = updatedFields.avatarUrl;


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
          localStorage.setItem('currentUser', JSON.stringify(updatedAppUser));
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

    