
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
    const storedUserString = typeof window !== 'undefined' ? localStorage.getItem('labstation_user') : null;
    if (storedUserString) {
      try {
        const storedUser = JSON.parse(storedUserString) as User;
        if (storedUser && storedUser.id && storedUser.email && storedUser.role) {
          if (storedUser.createdAt && typeof storedUser.createdAt === 'string') {
            storedUser.createdAt = new Date(storedUser.createdAt);
          }
          setCurrentUser(storedUser);
        } else {
          if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
        }
      } catch (error) {
        console.error("Error parsing stored user from localStorage:", error);
        if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
      }
    }
    // Firebase onAuthStateChanged will eventually take precedence if an active session exists.
    // The setIsLoading(false) is handled by onAuthStateChanged.
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
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
                createdAt: userProfileData.createdAt instanceof Timestamp ? userProfileData.createdAt.toDate() : new Date(),
              };
              setCurrentUser(appUser);
              if (typeof window !== 'undefined') {
                localStorage.setItem('labstation_user', JSON.stringify({ ...appUser, createdAt: appUser.createdAt.toISOString() }));
              }
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
              if (typeof window !== 'undefined') localStorage.removeItem('labstation_user');
            }
          } else {
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

  const login = useCallback(async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    setIsLoading(true);
    if (typeof window !== 'undefined') localStorage.removeItem('login_message');
    
    console.log("AuthContext: Attempting login for email:", email);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle success and setting isLoading to false
      return { success: true };
    } catch (error: any) {
      console.error("Firebase login error object:", error); // Log the full error object
      let detailedMessage = "Login failed. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential' || error.code === 'auth/invalid-email') {
        detailedMessage = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        detailedMessage = "Access to this account has been temporarily disabled due to many failed login attempts. You can reset your password or try again later.";
      } else if (error.code === 'auth/user-disabled') {
         detailedMessage = "This user account has been disabled in Firebase Authentication.";
      }
      // Store message for LoginPage to pick up if needed, but also return it directly.
      if (typeof window !== 'undefined') localStorage.setItem('login_message', detailedMessage);
      setIsLoading(false);
      return { success: false, message: detailedMessage };
    }
  }, []);

  const logout = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    try {
      await firebaseSignOut(auth);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('labstation_user');
        localStorage.removeItem('login_message');
      }
      // onAuthStateChanged will set currentUser to null and isLoading to false.
    } catch (error) {
      console.error("Firebase logout error:", error);
      setCurrentUser(null); // Force clear on error
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

      await firebaseUpdateProfile(firebaseUser, { displayName: name, photoURL: 'https://placehold.co/100x100.png' });

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

      const adminUsersSnapshot = await getDocs(query(collection(db, "users"), where("role", "==", "Admin")));
      adminUsersSnapshot.forEach(adminDoc => {
        addNotification(
          adminDoc.id,
          'New Signup Request',
          `User ${name} (${email}) has signed up and is awaiting approval.`,
          'signup_pending_admin',
          '/admin/users'
        );
      });
      
      addAuditLog(firebaseUser.uid, name, 'USER_CREATED', { entityType: 'User', entityId: firebaseUser.uid, details: `User ${name} (${email}) signed up. Status: pending_approval.`});
      
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
            createdAt: updatedProfileData.createdAt instanceof Timestamp ? updatedProfileData.createdAt.toDate() : new Date(),
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
