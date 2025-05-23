
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
    // Attempt to load user from localStorage on initial mount for persistence
    // Firebase's onAuthStateChanged will eventually take over for actual session management
    try {
      const storedUserString = typeof window !== 'undefined' ? localStorage.getItem('labstation_user') : null;
      if (storedUserString) {
        const storedUser = JSON.parse(storedUserString) as User;
        // Basic validation of stored user object
        if (storedUser && storedUser.id && storedUser.email && storedUser.role) {
          if (storedUser.createdAt && typeof storedUser.createdAt === 'string') {
            storedUser.createdAt = new Date(storedUser.createdAt);
          }
          // For mock/localStorage persistence, we optimistically set user.
          // onAuthStateChanged will verify against actual Firebase Auth.
          // setCurrentUser(storedUser); // Temporarily comment out to let onAuthStateChanged be the sole source
        } else {
          if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
        }
      }
    } catch (error) {
      console.error("AuthContext: Error parsing stored user from localStorage:", error);
      if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
    }
    // setIsLoading(false); // Let onAuthStateChanged handle setting isLoading to false
  }, []);


  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      setIsLoading(true); // Set loading true at the start of any auth state change
      if (typeof window !== 'undefined') {
        localStorage.removeItem('login_message'); // Clear any stale login messages
      }

      if (firebaseUser) {
        console.log("AuthContext: Firebase user detected (onAuthStateChanged):", firebaseUser.uid, firebaseUser.email);
        const userDocRef = doc(db, "users", firebaseUser.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            const userProfileData = userDocSnap.data();
            console.log("AuthContext: Firestore profile found:", userProfileData);

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
                // Store as ISO string for Date
                localStorage.setItem('labstation_user', JSON.stringify({ ...appUser, createdAt: appUser.createdAt.toISOString() }));
              }
              console.log("AuthContext: User set as active and current:", appUser.email);
            } else {
              let message = 'Your account is not active.';
              if (userProfileData.status === 'pending_approval') {
                message = 'Account pending approval. Please wait for an admin.';
              } else if (userProfileData.status === 'suspended') {
                message = 'Your account has been suspended.';
              }
              console.warn("AuthContext: User profile status not active:", userProfileData.status, message);
              if (typeof window !== 'undefined') localStorage.setItem('login_message', message);
              await firebaseSignOut(auth); // Sign out from Firebase Auth if not active in our system
              setCurrentUser(null);
              if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
            }
          } else {
            console.warn("AuthContext: Firestore user profile NOT FOUND for UID:", firebaseUser.uid);
            if (typeof window !== 'undefined') localStorage.setItem('login_message', 'User profile not found in database. Please contact support or ensure you have completed the signup process.');
            await firebaseSignOut(auth); // Sign out as profile is missing
            setCurrentUser(null);
            if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
          }
        } catch (error) {
          console.error("AuthContext: Error fetching Firestore user profile:", error);
          if (typeof window !== 'undefined') localStorage.setItem('login_message', 'Error retrieving your profile. Please try again.');
          await firebaseSignOut(auth); // Sign out on error
          setCurrentUser(null);
          if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
        }
      } else {
        console.log("AuthContext: No Firebase user (onAuthStateChanged).");
        setCurrentUser(null);
        if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
      }
      setIsLoading(false); // Set loading false after all checks
    });
    return () => unsubscribe();
  }, []);

  const login = useCallback(async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    
    console.log("AuthContext: Attempting Firebase login for email:", email);
    setIsLoading(true);
    if (typeof window !== 'undefined') localStorage.removeItem('login_message');
    
    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle success and setting isLoading to false, and fetching profile
      return { success: true };
    } catch (error: any) {
      console.error("Firebase login error details:", error); // Full error object
      let message = "Login failed. Please check your credentials and try again.";

      if (error.code === 'auth/invalid-credential') {
        message = "Login Failed: Invalid credentials. Please verify your email and password in your Firebase Authentication user list. Ensure the account exists and is enabled there.";
        console.error(
            "AuthContext Critical: Received 'auth/invalid-credential'. " +
            "This means Firebase Authentication rejected the email/password combination. " +
            "TROUBLESHOOTING STEPS (USER/ADMIN): " +
            "1. VERIFY EMAIL & PASSWORD: Are they typed exactly as registered in Firebase Authentication? Passwords are case-sensitive. " +
            "2. CHECK FIREBASE AUTHENTICATION CONSOLE: " +
            "   a) Go to your Firebase project > Authentication > Users tab. " +
            "   b) Does the user (e.g., admin@labstation.com) EXIST in this list? " +
            "   c) Is the account ENABLED (not disabled)? " +
            "3. CHECK .ENV.LOCAL: Ensure it points to the correct Firebase project. " +
            "If these are all correct, and the problem persists, there might be a temporary Firebase service issue."
        );
      } else if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-email') {
        message = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Access to this account has been temporarily disabled due to many failed login attempts. You can reset your password or try again later.";
      } else if (error.code === 'auth/user-disabled') {
         message = "This user account has been disabled by an administrator in Firebase Authentication.";
      }
      
      if (typeof window !== 'undefined') localStorage.setItem('login_message', message);
      setIsLoading(false); // Set loading false here as onAuthStateChanged might not trigger a quick update on failure
      return { success: false, message: message };
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    console.log("AuthContext: Attempting logout.");
    try {
      await firebaseSignOut(auth);
      // onAuthStateChanged will set currentUser to null and clear localStorage
      console.log("AuthContext: Firebase sign out successful. onAuthStateChanged will clear local state.");
    } catch (error) {
      console.error("AuthContext: Firebase logout error:", error);
      // Force clear local state just in case onAuthStateChanged doesn't fire or is delayed
      setCurrentUser(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('labstation_user');
        localStorage.removeItem('login_message');
      }
      setIsLoading(false);
    }
  }, []);

  const signup = useCallback(async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
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
        createdAt: serverTimestamp(),
      };
      await setDoc(userDocRef, newUserProfileData);
      
      addAuditLog(firebaseUser.uid, name, 'USER_CREATED', { entityType: 'User', entityId: firebaseUser.uid, details: `User ${name} (${email}) signed up. Status: pending_approval.`});
      
      const adminUsersQuery = query(collection(db, "users"), where("role", "in", ["Admin", "Lab Manager"]));
      const adminUsersSnapshot = await getDocs(adminUsersQuery);
      adminUsersSnapshot.forEach(adminDoc => {
        if (adminDoc.id !== firebaseUser.uid) { // Don't notify admin if they are the one signing up (edge case)
            addNotification(
              adminDoc.id,
              'New Signup Request',
              `User ${name} (${email}) has signed up and is awaiting approval.`,
              'signup_pending_admin',
              '/admin/users' // Link to the users page where pending users are listed
            );
        }
      });
      
      await firebaseSignOut(auth); // Sign out the new user, they need to be approved first
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
    const firebaseUser = auth.currentUser;
    if (!firebaseUser || !currentUser) {
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
      if(updatedFields.avatarUrl) firestoreUpdates.avatarUrl = updatedFields.avatarUrl;

      if (Object.keys(firestoreUpdates).length > 0) {
        await updateDoc(userDocRef, firestoreUpdates);
        addAuditLog(currentUser.id, currentUser.name || 'User', 'USER_UPDATED', { entityType: 'User', entityId: currentUser.id, details: `Profile updated: ${Object.keys(firestoreUpdates).join(', ')} changed.`});
      }
      
      // Fetch updated profile from Firestore to update context
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
