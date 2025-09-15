'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth, db, handleGoogleRedirectResult } from '@/app/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import type { User } from '@/app/types';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  refreshUser: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = async () => {
    if (firebaseUser) {
      try {
        console.log('Refreshing user data from Firestore...');
        const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          console.log('User data refreshed:', userData.username);
          setUser(userData);
        }
      } catch (error) {
        console.error('Error refreshing user data:', error);
      }
    }
  };

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    const isRedirectHandled = false;

    const initializeAuth = async () => {
      try {
        // First set up the auth state listener
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          console.log('Auth state changed:', firebaseUser?.uid || 'signed out');
          setFirebaseUser(firebaseUser);

          if (firebaseUser) {
            console.log('Firebase user found, loading user data...');
            try {
              console.log('Fetching user data from Firestore...');
              const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
              if (userDoc.exists()) {
                const userData = userDoc.data() as User;
                console.log('User data loaded:', userData.username);
                setUser(userData);
              } else {
                console.log('No user document found in Firestore, creating new user...');
                // Create a new user document (this handles the case where account was deleted)
                try {
                  const { setDoc, serverTimestamp } = await import('firebase/firestore');
                  const username = firebaseUser.email?.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || `user${Date.now()}`;

                  const userData = {
                    id: firebaseUser.uid,
                    email: firebaseUser.email!,
                    displayName: firebaseUser.displayName || 'User',
                    username,
                    photoURL: firebaseUser.photoURL || undefined,
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    onboardingCompleted: false, // This will ensure they go to onboarding
                  } as User;

                  await setDoc(doc(db, 'users', firebaseUser.uid), {
                    ...userData,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                  });

                  console.log('New user document created:', username);
                  setUser(userData);
                } catch (createError) {
                  console.error('Error creating user document:', createError);
                  // Fallback: create a minimal user object from Firebase data
                  setUser({
                    id: firebaseUser.uid,
                    email: firebaseUser.email!,
                    displayName: firebaseUser.displayName || 'User',
                    username: firebaseUser.email?.split('@')[0] || 'user',
                    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    onboardingCompleted: false,
                  } as User);
                }
              }
            } catch (error) {
              console.error('Error fetching user data:', error);
              // If Firestore fails, create a minimal user object from Firebase
              setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email!,
                displayName: firebaseUser.displayName || 'User',
                username: firebaseUser.email?.split('@')[0] || 'user',
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                createdAt: new Date(),
                updatedAt: new Date(),
              } as User);
            }
          } else {
            console.log('User signed out');
            setUser(null);
          }

          // Always set loading to false once auth state is determined
          console.log('Setting loading to false - auth state determined');
          setLoading(false);
        });

        // Since we're using popup auth, we don't need to handle redirect results
        // Loading state will be set to false by onAuthStateChanged callback
      } catch (error) {
        console.error('Error initializing auth:', error);
        setLoading(false);
      }
    };

    initializeAuth();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}