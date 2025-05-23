
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
import { doc, setDoc, getDoc, updateDoc, serverTimestamp, Timestamp, collection, query, where, getDocs } from 'firebase/firestore';
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
    // Try to load user from localStorage on initial mount for mock persistence
    const storedUserString = typeof window !== 'undefined' ? localStorage.getItem('labstation_user') : null;
    if (storedUserString) {
      try {
        const storedUser = JSON.parse(storedUserString) as User & { createdAt: string };
        // Basic validation against mock data if needed, or just trust localStorage for mock
        // For now, we directly set it, assuming it's valid from a previous mock session
        setCurrentUser({ ...storedUser, createdAt: new Date(storedUser.createdAt) });
      } catch (e) {
        console.error("Error parsing stored user from localStorage", e);
        if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
      }
    }
    // setIsLoading(false); // Initial loading of localStorage is quick

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      console.log("AuthContext: onAuthStateChanged triggered. Firebase user UID:", firebaseUser?.uid);
      setIsLoading(true);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('login_message');
      }

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
                localStorage.setItem('labstation_user', JSON.stringify({ ...appUser, createdAt: appUser.createdAt.toISOString() }));
              }
              console.log("AuthContext: User profile active. CurrentUser set for:", appUser.email);
            } else {
              let message = 'Your account is not active.';
              if (userProfileData.status === 'pending_approval') {
                message = 'Your account is awaiting admin approval. Please check back later or contact an administrator.';
              } else if (userProfileData.status === 'suspended') {
                message = 'Your account has been suspended. Please contact an administrator.';
              }
              console.warn("AuthContext: User profile status not 'active'. Firestore status:", userProfileData.status, "Message:", message);
              if (typeof window !== 'undefined') localStorage.setItem('login_message', message);
              await firebaseSignOut(auth); // Crucial: sign out if not active in Firestore
              setCurrentUser(null);
              if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
            }
          } else {
            const profileNotFoundMsg = 'User profile not found in Firestore database. Please complete signup or contact support if you believe this is an error.';
            console.warn("AuthContext: Firestore user profile NOT FOUND for UID:", firebaseUser.uid, " This usually means the user signed up with Firebase Auth, but their profile document was not created or was deleted from Firestore. Signing out.");
            if (typeof window !== 'undefined') localStorage.setItem('login_message', profileNotFoundMsg);
            await firebaseSignOut(auth); // Sign out if profile doesn't exist
            setCurrentUser(null);
            if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
          }
        } catch (error) {
          console.error("AuthContext: Error fetching Firestore user profile:", error);
          const profileErrorMsg = 'Error retrieving your profile during login. Please try again or contact support.';
          if (typeof window !== 'undefined') localStorage.setItem('login_message', profileErrorMsg);
          try {
            await firebaseSignOut(auth);
          } catch (signOutError) {
            console.error("AuthContext: Error signing out after profile fetch error:", signOutError);
          }
          setCurrentUser(null);
          if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
        }
      } else {
        console.log("AuthContext: No Firebase user (onAuthStateChanged). Clearing local user state.");
        setCurrentUser(null);
        if (typeof window !== 'undefined') {
          localStorage.removeItem('labstation_user');
          localStorage.removeItem('login_message'); // Clear any stale login messages
        }
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    
    console.log(`AuthContext: Attempting login for email: [${email}]`);
    setIsLoading(true);
    if (typeof window !== 'undefined') localStorage.removeItem('login_message');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle setting currentUser and isLoading to false upon success.
      return { success: true };
    } catch (error: any) {
      console.error("Firebase login error object:", error); // Log the entire error object
      let message = "Login failed. An unknown error occurred. Please try again.";

      if (error.code === 'auth/invalid-credential') {
        message = "Login Failed: Invalid email or password. Firebase rejected these credentials. Please VERY CAREFULLY verify: 1) The email and password are typed correctly. 2) This user account exists and is ENABLED in your Firebase project ('labstation-xadyr' -> Authentication -> Users). 3) Your .env.local file has the CORRECT Firebase config for 'labstation-xadyr'. 4) The user's Firestore document in the 'users' collection has 'status: \"active\"'.";
        console.error("CRITICAL FIREBASE ERROR (auth/invalid-credential): This means Firebase does not recognize the email/password for an enabled account in the currently configured project. Double-check your .env.local and Firebase Authentication console for user '", email, "'.");
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        message = "Invalid email or password provided.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Access to this account has been temporarily disabled due to many failed login attempts. You can reset your password or try again later.";
      } else if (error.code === 'auth/user-disabled') {
         message = "This user account has been disabled by an administrator in Firebase Authentication.";
      } else if (error.code === 'auth/network-request-failed') {
        message = "Network error during login. Please check your internet connection and Firebase project setup (especially API key and auth domain in .env.local).";
      }
      
      if (typeof window !== 'undefined') localStorage.setItem('login_message', message);
      setIsLoading(false); // Ensure loading is false on caught error during login attempt
      return { success: false, message: message };
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    console.log("AuthContext: Attempting logout.");
    setIsLoading(true); // Indicate loading during logout process
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will set currentUser to null and clear localStorage
    } catch (error) {
      console.error("AuthContext: Firebase logout error:", error);
      // Even if Firebase signout fails, clear local state as a fallback
      setCurrentUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('labstation_user');
        localStorage.removeItem('login_message');
      }
    } finally {
      // onAuthStateChanged will ultimately set isLoading to false after it processes the sign-out.
      // We can set it here too, but onAuthStateChanged is the authority.
      // setIsLoading(false); 
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    setIsLoading(true);
    if (typeof window !== 'undefined') localStorage.removeItem('login_message');
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
        createdAt: serverTimestamp(), // Use serverTimestamp for new user creation
      };
      await setDoc(userDocRef, newUserProfileData);
      
      addAuditLog(firebaseUser.uid, name, 'USER_CREATED', { entityType: 'User', entityId: firebaseUser.uid, details: `User ${name} (${email}) signed up. Status: pending_approval.`});
      
      // Notify admins
      const adminUsersQuery = query(collection(db, "users"), where("role", "in", ["Admin", "Lab Manager"]));
      const adminUsersSnapshot = await getDocs(adminUsersQuery);
      adminUsersSnapshot.forEach(adminDoc => {
        if (adminDoc.id !== firebaseUser.uid) { 
            addNotification(
              adminDoc.id,
              'New Signup Request',
              `User ${name} (${email}) has signed up and is awaiting approval.`,
              'signup_pending_admin',
              '/admin/users' 
            );
        }
      });
      
      await firebaseSignOut(auth); 
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
      } else if (error.code === 'auth/invalid-email') {
        message = "The email address is not valid.";
      }
      return { success: false, message };
    }
  }, []);

  const updateUserProfile = useCallback(async (updatedFields: Partial<Pick<User, 'name' | 'avatarUrl'>>): Promise<{ success: boolean; message?: string }> => {
    const firebaseUser = auth.currentUser; // Get current Firebase Auth user
    if (!firebaseUser || !currentUser) { // Also check for context's currentUser
      return { success: false, message: "No user logged in or user data unavailable." };
    }
    
    setIsLoading(true);
    try {
      const updatesForAuth: { displayName?: string; photoURL?: string } = {};
      if (updatedFields.name && updatedFields.name !== currentUser.name) {
        updatesForAuth.displayName = updatedFields.name;
      }
      // if (updatedFields.avatarUrl && updatedFields.avatarUrl !== currentUser.avatarUrl) {
      //   updatesForAuth.photoURL = updatedFields.avatarUrl; // Not currently editable in profile form
      // }
      
      if (Object.keys(updatesForAuth).length > 0) {
        await firebaseUpdateProfile(firebaseUser, updatesForAuth);
      }

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const firestoreUpdates: Partial<Pick<User, 'name' | 'avatarUrl'>> = {};
      if(updatedFields.name) firestoreUpdates.name = updatedFields.name;
      // if(updatedFields.avatarUrl) firestoreUpdates.avatarUrl = updatedFields.avatarUrl;

      if (Object.keys(firestoreUpdates).length > 0) {
        await updateDoc(userDocRef, firestoreUpdates);
        addAuditLog(currentUser.id, currentUser.name || 'User', 'USER_UPDATED', { entityType: 'User', entityId: currentUser.id, details: `Profile updated: ${Object.keys(firestoreUpdates).join(', ')} changed.`});
      }
      
      // Re-fetch the user profile to update context
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
            localStorage.setItem('labstation_user', JSON.stringify({...updatedAppUser, createdAt: updatedAppUser.createdAt.toISOString()}));
        }
      }
      
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
