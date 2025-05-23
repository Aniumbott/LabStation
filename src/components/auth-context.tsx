
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
import { addNotification } from '@/lib/mock-data';

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
            const userProfileData = userDocSnap.data() as Omit<User, 'id' | 'email' | 'name'>;
            
            if (userProfileData.status === 'active') {
              setCurrentUser({
                id: firebaseUser.uid,
                name: firebaseUser.displayName || userProfileData.name || '',
                email: firebaseUser.email || '',
                role: userProfileData.role,
                status: userProfileData.status,
                avatarUrl: firebaseUser.photoURL || userProfileData.avatarUrl,
                createdAt: userProfileData.createdAt, // Ensure this is handled if it's a Firestore Timestamp
              });
            } else {
              // User exists in Firestore but is not 'active' (e.g., pending, suspended)
              console.log(`User ${firebaseUser.uid} status is ${userProfileData.status}. Logging out.`);
              await firebaseSignOut(auth); // Ensure Firebase session is cleared
              setCurrentUser(null);
              // Optionally, save a flag to localStorage to show a specific message on login page
              if (typeof window !== 'undefined') {
                if (userProfileData.status === 'pending_approval') {
                    localStorage.setItem('login_message', 'Account pending approval.');
                } else if (userProfileData.status === 'suspended') {
                    localStorage.setItem('login_message', 'Account suspended.');
                }
              }
            }
          } else {
            // User authenticated with Firebase, but no profile in Firestore. This is an inconsistent state.
            console.warn(`User ${firebaseUser.uid} authenticated with Firebase, but no profile found in Firestore. Logging out.`);
            await firebaseSignOut(auth); // Clear Firebase session
            setCurrentUser(null);
          }
        } catch (error) {
          console.error("Error fetching user profile from Firestore:", error);
          await firebaseSignOut(auth); // Clear Firebase session on error
          setCurrentUser(null);
        }
      } else {
        // No Firebase user
        setCurrentUser(null);
      }
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password?: string): Promise<{ success: boolean; message?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    setIsLoading(true);
    // Clear any previous login messages
    if (typeof window !== 'undefined') {
        localStorage.removeItem('login_message');
    }
    try {
      // Step 1: Authenticate with Firebase
      await signInWithEmailAndPassword(auth, email, password);
      // If successful, onAuthStateChanged will trigger.
      // It will then fetch Firestore data and check status.
      // The success of this function now means Firebase Auth was successful.
      // The actual "app login" (setting currentUser) happens in onAuthStateChanged.
      // If onAuthStateChanged decides the user isn't 'active', it will sign them out from Firebase too.
      setIsLoading(false); // Potentially set by onAuthStateChanged too
      return { success: true };
    } catch (error: any) {
      setIsLoading(false);
      console.error("Firebase login error:", error);
      let message = "Login failed. Please check your credentials.";
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        message = "Invalid email or password.";
      } else if (error.code === 'auth/too-many-requests') {
        message = "Access to this account has been temporarily disabled due to many failed login attempts. You can immediately restore it by resetting your password or you can try again later.";
      }
      return { success: false, message };
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      await firebaseSignOut(auth);
      if (typeof window !== 'undefined') {
        localStorage.removeItem('currentUser'); // Keep this for non-Firebase session persistence if needed elsewhere or as fallback
        localStorage.removeItem('login_message');
      }
      // onAuthStateChanged will set currentUser to null
    } catch (error) {
      console.error("Firebase logout error:", error);
      // Still ensure isLoading is set to false if logout errors out
      setIsLoading(false);
    }
    // setIsLoading(false) will be handled by onAuthStateChanged successfully setting currentUser to null
  };

  const signup = async (name: string, email: string, password?: string): Promise<{ success: boolean; message: string; userId?: string }> => {
    if (!password) return { success: false, message: "Password is required." };
    setIsLoading(true);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;
      
      await firebaseUpdateProfile(firebaseUser, { displayName: name });

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const newUserProfile: Omit<User, 'id'> = {
        name: name,
        email: firebaseUser.email || email,
        role: 'Researcher',
        status: 'pending_approval',
        avatarUrl: firebaseUser.photoURL || 'https://placehold.co/100x100.png',
        createdAt: new Date().toISOString(), // Use ISO string for consistency
      };
      await setDoc(userDocRef, newUserProfile);
      
      // Notify admin (Example: target admin user with ID 'u1' for mock)
      const adminUser = { id: 'u1', name: 'Admin User' }; // This should be fetched or predefined
      if (adminUser) {
          addNotification(
              adminUser.id, 
              'New Signup Request',
              `User ${name} (${email}) has signed up and is awaiting approval.`,
              'signup_pending_admin',
              '/admin/users' 
          );
      }
      
      // Important: Sign out user after signup so they can't access app until approved
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
      }
      return { success: false, message };
    }
  };

  const updateUserProfile = useCallback(async (updatedFields: Partial<Pick<User, 'name' | 'avatarUrl'>>): Promise<{ success: boolean; message?: string }> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return { success: false, message: "No user logged in." };
    }
    
    setIsLoading(true);
    try {
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

      const userDocRef = doc(db, "users", firebaseUser.uid);
      const updatesForFirestore: Partial<User> = {};
      if (updatedFields.name) updatesForFirestore.name = updatedFields.name;
      if (updatedFields.avatarUrl) updatesForFirestore.avatarUrl = updatedFields.avatarUrl;
      
      if (Object.keys(updatesForFirestore).length > 0) {
        await updateDoc(userDocRef, updatesForFirestore);
      }
      
      // Update local currentUser state to reflect changes immediately
      setCurrentUser(prevUser => {
        if (!prevUser) return null;
        return {
          ...prevUser,
          ...updatesForAuth, // these come from Firebase Auth profile
          ...(updatesForFirestore.name && { name: updatesForFirestore.name }), // ensure name is updated if changed
          ...(updatesForFirestore.avatarUrl && { avatarUrl: updatesForFirestore.avatarUrl }),
        };
      });
      
      // Update localStorage
      if (typeof window !== 'undefined' && currentUser) {
        const updatedUserForStorage = {
          ...currentUser,
          ...(updatesForAuth.displayName && {name: updatesForAuth.displayName}),
          ...(updatesForAuth.photoURL && {avatarUrl: updatesForAuth.photoURL}),
          ...(updatesForFirestore.name && { name: updatesForFirestore.name }),
          ...(updatesForFirestore.avatarUrl && { avatarUrl: updatesForFirestore.avatarUrl }),
        };
         localStorage.setItem('currentUser', JSON.stringify(updatedUserForStorage));
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
