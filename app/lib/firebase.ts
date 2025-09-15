import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult, signOut, setPersistence, browserLocalPersistence, deleteUser, reauthenticateWithPopup, reauthenticateWithRedirect } from 'firebase/auth';
import { getFirestore, doc, setDoc, getDoc, updateDoc, serverTimestamp, deleteDoc } from 'firebase/firestore';
import type { User } from '@/app/types';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
};

// Debug logging to check config
console.log('Firebase config:', {
  ...firebaseConfig,
  apiKey: firebaseConfig.apiKey ? 'present' : 'missing'
});

const app = initializeApp(firebaseConfig, {
  // Prevent Firebase from trying to auto-detect config
  automaticDataCollectionEnabled: false
});
export const auth = getAuth(app);
export const db = getFirestore(app);

// Initialize auth persistence immediately
const initializePersistence = async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);
    console.log('Auth persistence set successfully');
  } catch (error) {
    console.error('Error setting auth persistence:', error);
  }
};

// Call initialization immediately
initializePersistence();

const googleProvider = new GoogleAuthProvider();
googleProvider.addScope('profile');
googleProvider.addScope('email');
// Force Google to show account selector by setting prompt to 'select_account'
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export const signInWithGoogle = async () => {
  try {
    // Use popup for better UX and to avoid redirect issues
    const result = await signInWithPopup(auth, googleProvider);
    return await handleSignInResult(result);
  } catch (error) {
    console.error('Error with Google sign-in popup:', error);
    throw error;
  }
};

// Shared function to handle authentication result (for both popup and redirect)
const handleSignInResult = async (result: any) => {
  if (!result || !result.user) {
    return null;
  }

  const user = result.user;

  // Clear any stale pendingAccountDeletion entries
  const pendingDeletion = localStorage.getItem('pendingAccountDeletion');
  if (pendingDeletion && pendingDeletion !== user.uid) {
    console.log('Clearing stale pendingAccountDeletion entry');
    localStorage.removeItem('pendingAccountDeletion');
  }

  // Normal sign-in flow
  const userRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    const username = user.email?.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '') || `user${Date.now()}`;

    const userData: Partial<User> = {
      id: user.uid,
      email: user.email!,
      displayName: user.displayName || 'User',
      username,
      photoURL: user.photoURL || undefined,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await setDoc(userRef, {
      ...userData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { user: userData, isNewUser: true };
  } else {
    await updateDoc(userRef, {
      updatedAt: serverTimestamp(),
    });

    return { user: userSnap.data() as User, isNewUser: false };
  }
};

// Function to handle redirect result after user returns from Google (production)
export const handleGoogleRedirectResult = async () => {
  try {
    const result = await getRedirectResult(auth);
    return await handleSignInResult(result);
  } catch (error) {
    console.error('Error handling Google redirect result:', error);
    throw error;
  }
};

export const logOut = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

export const deleteAccount = async () => {
  try {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No user is currently signed in');
    }

    // Pre-emptively re-authenticate to avoid the two-step process
    console.log('Pre-authenticating for account deletion...');
    try {
      await reauthenticateWithPopup(user, googleProvider);
      console.log('Pre-authentication completed successfully');
    } catch (reauthError: any) {
      if (reauthError.code === 'auth/popup-closed-by-user') {
        throw new Error('Authentication cancelled by user');
      }
      console.log('Pre-authentication failed, will try deletion anyway:', reauthError.message);
      // Continue with deletion attempt - maybe it won't be needed
    }

    console.log('Attempting account deletion...');

    try {
      // Get user data before deletion to access calendar information
      const userRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userRef);
      const userData = userDoc.exists() ? userDoc.data() : null;

      // Clean up all Cal.com integrations and OAuth tokens
      try {
        const { getUserCalendars } = await import('@/app/lib/firebase-db');
        const { deleteCalcomManagedUser, completeCalendarCleanup } = await import('@/app/lib/calcom');

        // Get all user's calendars to clean them up
        const userCalendars = await getUserCalendars(user.uid);
        const calcomIntegrationIds = new Set<string>();

        for (const calendar of userCalendars) {
          if (calendar.calcomIntegrationId) {
            calcomIntegrationIds.add(calendar.calcomIntegrationId);

            // Clean up each connected provider if they exist
            if (calendar.connectedProviders?.length) {
              for (const provider of calendar.connectedProviders) {
                try {
                  console.log(`Cleaning up ${provider} calendar for managed user ${calendar.calcomIntegrationId}`);
                  // Note: We don't have stored access tokens, so this will have limited effectiveness
                  // await completeCalendarCleanup(provider, calendar.calcomIntegrationId, accessToken);
                  console.log(`Would clean up ${provider} calendar integration`);
                } catch (cleanupError) {
                  console.error(`Failed to cleanup ${provider} integration:`, cleanupError);
                  // Don't block account deletion
                }
              }
            }
          }
        }

        // Delete unique Cal.com managed users
        for (const managedUserId of calcomIntegrationIds) {
          try {
            await deleteCalcomManagedUser(managedUserId);
            console.log(`Cal.com managed user ${managedUserId} deleted`);
          } catch (calcomError) {
            console.error(`Failed to delete Cal.com managed user ${managedUserId}:`, calcomError);
            // Don't block account deletion if Cal.com cleanup fails
          }
        }

        // Also check for legacy calcomIntegrationId on user object
        if (userData?.calcomIntegrationId && !calcomIntegrationIds.has(userData.calcomIntegrationId)) {
          try {
            await deleteCalcomManagedUser(userData.calcomIntegrationId);
            console.log(`Legacy Cal.com managed user ${userData.calcomIntegrationId} deleted`);
          } catch (calcomError) {
            console.error('Failed to delete legacy Cal.com managed user:', calcomError);
          }
        }
      } catch (cleanupError) {
        console.error('Error during Cal.com cleanup:', cleanupError);
        // Don't block account deletion if cleanup fails
      }

      // Delete user document from Firestore
      await deleteDoc(userRef);

      // Delete the Firebase Auth user account
      try {
        await deleteUser(user);
        console.log('Firebase Auth user deleted successfully');
      } catch (authDeleteError: any) {
        // Handle specific Firebase Auth errors gracefully
        if (authDeleteError.code === 'auth/user-not-found' || authDeleteError.code === 'auth/user-token-expired') {
          console.log('Firebase Auth user already deleted or session expired');
        } else if (authDeleteError.code === 'auth/requires-recent-login') {
          // Re-throw this error so it can be caught by the outer try-catch
          console.log('Recent authentication required, propagating error...');
          throw authDeleteError;
        } else {
          console.error('Failed to delete Firebase Auth user:', authDeleteError);
          // Don't throw - continue with cleanup for other errors
        }
      }

      // Clean up local storage after successful deletion
      localStorage.clear();
      sessionStorage.clear();

      // Clear IndexedDB (where Firebase might store data)
      if ('indexedDB' in window) {
        const databases = await indexedDB.databases();
        for (const db of databases) {
          if (db.name && db.name.includes('firebase')) {
            indexedDB.deleteDatabase(db.name);
          }
        }
      }

      console.log('Account successfully deleted');
    } catch (deleteError: any) {
      // Since we already re-authenticated, just throw the error
      console.error('Account deletion failed even after authentication:', deleteError);
      throw deleteError;
    }
  } catch (error) {
    console.error('Error deleting account:', error);
    throw error;
  }
};

export default app;
