import { db } from './firebase';
import {
  collection,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy,
  limit,
} from 'firebase/firestore';
import type { User, Calendar, Connection, Meeting } from '@/app/types';

export const getUserByUsername = async (username: string): Promise<User | null> => {
  const q = query(collection(db, 'users'), where('username', '==', username));
  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  return querySnapshot.docs[0].data() as User;
};

export const getUserById = async (userId: string): Promise<User | null> => {
  const userRef = doc(db, 'users', userId);
  const userDoc = await getDoc(userRef);

  if (!userDoc.exists()) {
    return null;
  }

  return userDoc.data() as User;
};

export const updateUserProfile = async (userId: string, updates: Partial<User>) => {
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};

export const getUserCalendars = async (userId: string): Promise<Calendar[]> => {
  const q = query(collection(db, 'calendars'), where('userId', '==', userId));
  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id,
  })) as Calendar[];
};

export const addCalendar = async (calendar: Omit<Calendar, 'id' | 'createdAt' | 'updatedAt'>) => {
  const calendarData = {
    ...calendar,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'calendars'), calendarData);
  return docRef.id;
};

export const updateCalendar = async (calendarId: string, updates: Partial<Calendar>) => {
  const calendarRef = doc(db, 'calendars', calendarId);
  await updateDoc(calendarRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
};


export const deleteCalendar = async (calendarId: string) => {
  // Get calendar data before deletion to access Cal.com integration info
  const calendarRef = doc(db, 'calendars', calendarId);
  const calendarDoc = await getDoc(calendarRef);
  const calendarData = calendarDoc.exists() ? calendarDoc.data() as Calendar : null;

  // Disconnect calendar from Cal.com (but keep the managed user for other calendars)
  if (calendarData?.calcomIntegrationId && calendarData?.connectedProviders?.length) {
    try {
      const { disconnectCalcomCalendar } = await import('@/app/lib/calcom');

      // Disconnect each connected provider
      for (const provider of calendarData.connectedProviders) {
        try {
          await disconnectCalcomCalendar(
            provider as 'google' | 'office365' | 'apple',
            calendarData.calcomIntegrationId,
            calendarData.calcomAccessToken || ''
          );
          console.log(`${provider} calendar disconnected from Cal.com managed user`);
        } catch (providerError) {
          console.error(`Failed to disconnect ${provider} from Cal.com:`, providerError);
          // Continue with other providers
        }
      }
    } catch (calcomError) {
      console.error('Failed to disconnect calendar from Cal.com:', calcomError);
      // Don't block calendar deletion if Cal.com cleanup fails
    }
  }

  // Delete calendar document from Firestore
  await deleteDoc(calendarRef);
};

export const getConnection = async (user1Id: string, user2Id: string): Promise<Connection | null> => {
  const q = query(
    collection(db, 'connections'),
    where('user1Id', 'in', [user1Id, user2Id]),
    where('user2Id', 'in', [user1Id, user2Id])
  );

  const querySnapshot = await getDocs(q);

  if (querySnapshot.empty) {
    return null;
  }

  return querySnapshot.docs[0].data() as Connection;
};

export const createConnection = async (user1Id: string, user2Id: string) => {
  const connectionData = {
    user1Id,
    user2Id,
    status: 'connected' as const,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'connections'), connectionData);
  return docRef.id;
};

export const createMeeting = async (meeting: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>) => {
  const meetingData = {
    ...meeting,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, 'meetings'), meetingData);
  return docRef.id;
};

export const getUserMeetings = async (userId: string): Promise<Meeting[]> => {
  const q = query(
    collection(db, 'meetings'),
    where('organizerId', '==', userId),
    orderBy('startTime', 'asc'),
    limit(20)
  );

  const querySnapshot = await getDocs(q);

  return querySnapshot.docs.map(doc => ({
    ...doc.data(),
    id: doc.id,
  })) as Meeting[];
};

export const getDefaultSchedulableHours = (category: 'work' | 'personal') => {
  if (category === 'work') {
    return {
      monday: [{ start: '09:00', end: '17:00' }],
      tuesday: [{ start: '09:00', end: '17:00' }],
      wednesday: [{ start: '09:00', end: '17:00' }],
      thursday: [{ start: '09:00', end: '17:00' }],
      friday: [{ start: '09:00', end: '17:00' }],
      saturday: [],
      sunday: [],
    };
  } else {
    return {
      monday: [{ start: '08:00', end: '09:00' }, { start: '17:00', end: '22:00' }],
      tuesday: [{ start: '08:00', end: '09:00' }, { start: '17:00', end: '22:00' }],
      wednesday: [{ start: '08:00', end: '09:00' }, { start: '17:00', end: '22:00' }],
      thursday: [{ start: '08:00', end: '09:00' }, { start: '17:00', end: '22:00' }],
      friday: [{ start: '08:00', end: '09:00' }, { start: '17:00', end: '22:00' }],
      saturday: [{ start: '08:00', end: '12:00' }],
      sunday: [{ start: '08:00', end: '12:00' }],
    };
  }
};