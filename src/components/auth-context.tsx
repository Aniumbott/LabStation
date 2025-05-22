
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
import { auth, db } from '@/lib/firebase';
import { doc, setDoc, getDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { addNotification } from '@/lib/mock-data'; // Keep for now, might be replaced by Firestore notifications

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
        // User is signed in, now fetch their profile from Firestore
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const userProfileData = userDocSnap.data() as Omit<User, 'id' | 'email' | 'name'>; // Firestore part
          if (userProfileData.status === 'active') {
            setCurrentUser({
              id: firebaseUser.uid,
              name: firebaseUser.displayName || userProfileData.name || '', // Prioritize Firebase Auth displayName
              email: firebaseUser.email || '',
              role: userProfileData.role,
              status: userProfileData.status,
              avatarUrl: firebaseUser.photoURL || userProfileData.avatarUrl,
              createdAt: userProfileData.createdAt,
            });
          } else if (userProfileData.status === 'pending_approval') {
             console.log("User account is pending approval.");
             await firebaseSignOut(auth); // Log them out if pending
             setCurrentUser(null);
          } else {
            // User status is suspended or other, log them out.
            console.log(`User account status: ${userProfileData.status}. Logging out.`);
            await firebaseSignOut(auth);
            setCurrentUser(null);
          }
        } else {
          // User document doesn't exist in Firestore, which is unexpected for a logged-in user.
          // This could happen if a user was created in Firebase Auth but their Firestore doc creation failed or was deleted.
          // Or, if it's a new signup still in the process of being fully set up.
          console.warn("User authenticated with Firebase, but no profile found in Firestore. Logging out.");
          await firebaseSignOut(auth);
          setCurrentUser(null);
        }
      } else {
        // User is signed out
        setCurrentUser(null);
      }
      setIsLoading(false);
    });

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    setIsLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle setting currentUser after fetching Firestore profile
      // We can check status immediately here too if needed for quicker feedback
      const userDocRef = doc(db, "users", userCredential.user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.status === 'pending_approval') {
          await firebaseSignOut(auth); // Log out if pending
          setIsLoading(false);
          return { success: false, message: "Account pending approval. Please wait for an admin." };
        }
        if (userData.status === 'suspended') {
          await firebaseSignOut(auth); // Log out if suspended
          setIsLoading(false);
          return { success: false, message: "Your account has been suspended." };
        }
      } else {
          // Should not happen if signup creates the doc
          await firebaseSignOut(auth);
          setIsLoading(false);
          return { success: false, message: "User profile not found." };
      }
      setIsLoading(false);
      return { success: true };
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase login error:", error);
      return { success: false, message: error.message || 'Login failed.' };
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will set currentUser to null
    } catch (error) {
      console.error("Firebase logout error:", error);
    }
    // setIsLoading(false) will be handled by onAuthStateChanged
  };

  const signup = async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      // Update Firebase Auth profile (displayName)
      await firebaseUpdateProfile(firebaseUser, { displayName: name });

      // Create user document in Firestore
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const newUserProfile: Omit<User, 'id'> = {
        name: name,
        email: firebaseUser.email || email, // Use email from auth if available
        role: 'Researcher', // Default role
        status: 'pending_approval',
        avatarUrl: firebaseUser.photoURL || 'https://placehold.co/100x100.png', // Default avatar
        createdAt: new Date().toISOString(),
      };
      await setDoc(userDocRef, newUserProfile);
      
      // Log out the user immediately after signup, as they need admin approval
      await firebaseSignOut(auth);

      // Add notification for admin (mock for now)
      // In a real app, this might be a Cloud Function triggered on user creation
      const adminUser = { id: 'u1' }; // Placeholder for finding an admin
      if (adminUser) {
          addNotification(
              adminUser.id, 
              'New Signup Request',
              `User ${name} (${email}) has signed up and is awaiting approval.`,
              'signup_pending_admin',
              '/admin/users' 
          );
      }
      setIsLoading(false);
      return { success: true, message: 'Signup successful! Your request is awaiting admin approval.', userId: firebaseUser.uid };
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase signup error:", error);
      return { success: false, message: error.message || 'Signup failed.' };
    }
  };

  const updateUserProfile = useCallback(async (updatedFields: Partial<Pick<User, 'name' | 'avatarUrl'>>): Promise<{ success: boolean; message?: string }> => {
    if (!auth.currentUser) { // Check Firebase auth.currentUser
      return { success: false, message: "No user logged in." };
    }
    setIsLoading(true);
    try {
      const firebaseUser = auth.currentUser;
      const updatesForAuth: { displayName?: string; photoURL?: string } = {};
      if (updatedFields.name) {
        updatesForAuth.displayName = updatedFields.name;
      }
      if (updatedFields.avatarUrl) {
        updatesForAuth.photoURL = updatedFields.avatarUrl;
      }

      if (Object.keys(updatesForAuth).length > 0) {
        await firebaseUpdateProfile(firebaseUser, updatesForAuth);
      }

      // Update Firestore document
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const updatesForFirestore: Partial<User> = {};
      if (updatedFields.name) updatesForFirestore.name = updatedFields.name;
      if (updatedFields.avatarUrl) updatesForFirestore.avatarUrl = updatedFields.avatarUrl;
      
      if (Object.keys(updatesForFirestore).length > 0) {
        await updateDoc(userDocRef, updatesForFirestore);
      }
      
      // Refetch and update local currentUser state
      // This will trigger onAuthStateChanged if displayName or photoURL changed,
      // but for other fields like 'role' (if we allow editing it), we might need manual update.
      // For now, onAuthStateChanged should pick up displayName change.
      // If you also update role/status from profile, you'd need to:
      // const updatedDoc = await getDoc(userDocRef);
      // setCurrentUser({ ...currentUser, ...updatedDoc.data(), ...updatesForAuth });
      // For just name and avatarUrl, onAuthStateChanged listener should handle it.

      setIsLoading(false);
      return { success: true, message: "Profile updated successfully." };
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase profile update error:", error);
      return { success: false, message: error.message || "Failed to update profile." };
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
