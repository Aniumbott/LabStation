
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
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { addNotification, addAuditLog } from '@/lib/mock-data'; // AuditLog and Notification are still mock

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
            const userProfileData = userDocSnap.data();
            if (userProfileData.status === 'active') {
              const appUser: User = {
                id: firebaseUser.uid,
                name: userProfileData.name || firebaseUser.displayName || 'Unnamed User',
                email: userProfileData.email || firebaseUser.email || '',
                role: userProfileData.role as RoleName,
                status: userProfileData.status as User['status'],
                avatarUrl: userProfileData.avatarUrl || firebaseUser.photoURL || 'https://placehold.co/100x100.png',
                createdAt: userProfileData.createdAt instanceof Timestamp ? userProfileData.createdAt.toDate() : new Date(userProfileData.createdAt || Date.now()),
              };
              setCurrentUser(appUser);
              if (typeof window !== 'undefined') {
                localStorage.setItem('labstation_user', JSON.stringify(appUser));
                localStorage.removeItem('login_message');
              }
            } else {
              let message = 'Your account is not active.';
              if (userProfileData.status === 'pending_approval') {
                message = 'Account pending approval. Please wait for an admin.';
              } else if (userProfileData.status === 'suspended') {
                message = 'Your account has been suspended.';
              }
              if (typeof window !== 'undefined') localStorage.setItem('login_message', message);
              await firebaseSignOut(auth); // Sign out from Firebase if not active in Firestore
              setCurrentUser(null);
              if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
            }
          } else {
            console.warn(`User ${firebaseUser.uid} authenticated with Firebase but no Firestore profile found. Signing out.`);
            if (typeof window !== 'undefined') localStorage.setItem('login_message', 'User profile not found. Please contact support.');
            await firebaseSignOut(auth);
            setCurrentUser(null);
            if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
          }
        } catch (error) {
          console.error("Error fetching Firestore user profile:", error);
          if (typeof window !== 'undefined') localStorage.setItem('login_message', 'Error retrieving your profile.');
          await firebaseSignOut(auth);
          setCurrentUser(null);
          if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
        }
      } else {
        setCurrentUser(null);
        if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Attempt to load user from localStorage on initial client-side mount
  useEffect(() => {
    if (typeof window !== 'undefined' && !auth.currentUser) { // Only if Firebase hasn't initialized auth yet
      const storedUser = localStorage.getItem('labstation_user');
      if (storedUser) {
        try {
          const parsedUser: User = JSON.parse(storedUser);
           // Basic check, onAuthStateChanged will be the ultimate authority
          if (parsedUser && parsedUser.id && parsedUser.status === 'active') {
            // Temporarily set for faster UI update, onAuthStateChanged will confirm
            // setCurrentUser(parsedUser); 
            // This can cause issues if Firebase session is truly expired.
            // It's safer to let onAuthStateChanged be the sole source of truth for setting currentUser initially.
          } else {
            localStorage.removeItem('labstation_user'); // Clear invalid stored user
          }
        } catch (e) {
          console.error("Failed to parse user from localStorage", e);
          localStorage.removeItem('labstation_user');
        }
      }
    }
    // We set isLoading to false initially true and let onAuthStateChanged handle it.
    // This effect is more about cleanup of potentially stale localStorage data.
  }, []);


  const login = async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    setIsLoading(true);
    if (typeof window !== 'undefined') localStorage.removeItem('login_message');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will now handle setting currentUser and isLoading to false after Firestore check
      return { success: true }; // Firebase auth success, actual app login depends on onAuthStateChanged
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
      setIsLoading(false); // Set loading false here on explicit error
      return { success: false, message };
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will set currentUser to null.
      if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
    } catch (error) {
      console.error("Firebase logout error:", error);
      // Manually clear state just in case
      setCurrentUser(null);
      if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
      setIsLoading(false);
    }
  };

  const signup = async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Update Firebase Auth profile (optional but good practice)
      await firebaseUpdateProfile(firebaseUser, { displayName: name, photoURL: 'https://placehold.co/100x100.png' });

      // Create user profile in Firestore
      const userDocRef = doc(db, "users", firebaseUser.uid);
      const newUserProfileData = {
        name: name,
        email: firebaseUser.email || email,
        role: 'Researcher' as RoleName,
        status: 'pending_approval' as User['status'],
        avatarUrl: firebaseUser.photoURL || 'https://placehold.co/100x100.png',
        createdAt: serverTimestamp(),
      };
      await setDoc(userDocRef, newUserProfileData);

      // Notify admin (mock notification)
      addNotification(
        "u1", // Placeholder for actual Admin User ID lookup
        'New Signup Request',
        `User ${name} (${email}) has signed up and is awaiting approval.`,
        'signup_pending_admin',
        '/admin/users' // Now points to the unified users page
      );
      addAuditLog(firebaseUser.uid, name, 'USER_CREATED', { entityType: 'User', entityId: firebaseUser.uid, details: `User ${name} (${email}) signed up. Status: pending_approval.`});


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
    if (!firebaseUser || !currentUser) { // Check against context's currentUser as well
      return { success: false, message: "No user logged in or user data unavailable." };
    }
    
    setIsLoading(true);
    try {
      const updatesForAuth: { displayName?: string; photoURL?: string } = {};
      if (updatedFields.name && updatedFields.name !== currentUser.name) {
        updatesForAuth.displayName = updatedFields.name;
      }
      if (updatedFields.avatarUrl && updatedFields.avatarUrl !== currentUser.avatarUrl) {
        updatesForAuth.photoURL = updatedFields.avatarUrl;
      }
      
      if (Object.keys(updatesForAuth).length > 0) {
        await firebaseUpdateProfile(firebaseUser, updatesForAuth);
      }

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const firestoreUpdates: Partial<Pick<User, 'name' | 'avatarUrl'>> = {};
      if(updatedFields.name) firestoreUpdates.name = updatedFields.name;
      // Avatar URL update in Firestore (if different from Auth or if Auth doesn't have one)
      if(updatedFields.avatarUrl && updatedFields.avatarUrl !== (userDocSnap.data()?.avatarUrl || firebaseUser.photoURL)) {
          firestoreUpdates.avatarUrl = updatedFields.avatarUrl;
      } else if (!updatedFields.avatarUrl && firebaseUser.photoURL && firebaseUser.photoURL !== (userDocSnap.data()?.avatarUrl)) {
          // If form clears avatarUrl but Firebase Auth has one, sync it to Firestore
          firestoreUpdates.avatarUrl = firebaseUser.photoURL;
      }


      if (Object.keys(firestoreUpdates).length > 0) {
        await updateDoc(userDocRef, firestoreUpdates);
        addAuditLog(currentUser.id, currentUser.name, 'USER_UPDATED', { entityType: 'User', entityId: currentUser.id, details: `Profile updated: ${Object.keys(firestoreUpdates).join(', ')} changed.`});
      }
      
      // Refetch the user data from Firestore to ensure context has the latest
      const updatedUserDocSnap = await getDoc(userDocRef);
      if (updatedUserDocSnap.exists()) {
        const updatedProfileData = updatedUserDocSnap.data();
        const updatedAppUser: User = {
          id: firebaseUser.uid,
          name: updatedProfileData.name || firebaseUser.displayName || 'Unnamed User',
          email: updatedProfileData.email || firebaseUser.email || '',
          role: updatedProfileData.role as RoleName,
          status: updatedProfileData.status as User['status'],
          avatarUrl: updatedProfileData.avatarUrl || firebaseUser.photoURL || 'https://placehold.co/100x100.png',
          createdAt: updatedProfileData.createdAt instanceof Timestamp ? updatedProfileData.createdAt.toDate() : new Date(updatedProfileData.createdAt || Date.now()),
        };
        setCurrentUser(updatedAppUser);
        if (typeof window !== 'undefined') {
            localStorage.setItem('labstation_user', JSON.stringify(updatedAppUser));
        }
      }
      
      setIsLoading(false);
      return { success: true, message: "Profile updated successfully." };
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase profile update error:", error);
      return { success: false, message: error.message || "Failed to update profile." };
    }
  }, [currentUser]); // Added currentUser as a dependency

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
