'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { logOut, deleteAccount } from '@/app/lib/firebase';
import { updateUserProfile } from '@/app/lib/firebase-db';
import Link from 'next/link';
import ProfileCard from '@/app/components/ui/ProfileCard';
import Button from '@/app/components/ui/Button';
import { Text } from '@/app/components/ui/Typography';

export default function CalConnectView() {
  const { user } = useAuth();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [location, setLocation] = useState('');
  const [isRequestingLocation, setIsRequestingLocation] = useState(false);
  const [copied, setCopied] = useState(false);
  const [adminMode, setAdminMode] = useState(false);

  useEffect(() => {
    if (user) {
      setUsername(user.username || '');
      if (user.location) {
        setLocation(`${user.location.city}, ${user.location.region}`);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && !user.location && !isRequestingLocation) {
      requestLocation();
    }
  }, [user]);

  const requestLocation = async () => {
    setIsRequestingLocation(true);
    if ('geolocation' in navigator) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });

        const { latitude, longitude } = position.coords;

        // Reverse geocode to get city, region
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await response.json();

        const city = data.address?.city || data.address?.town || data.address?.village || 'Unknown';
        const region = data.address?.state || data.address?.region || 'Unknown';

        const locationData = {
          city,
          region,
          coordinates: { lat: latitude, lng: longitude }
        };

        await updateUserProfile(user!.id, { location: locationData });
        setLocation(`${city}, ${region}`);
      } catch (error) {
        console.error('Location error:', error);
      }
    }
    setIsRequestingLocation(false);
  };

  const handleUsernameEdit = async () => {
    if (isEditingUsername && user && username !== user.username) {
      try {
        await updateUserProfile(user.id, { username });
      } catch (error) {
        console.error('Error updating username:', error);
        setUsername(user.username || '');
      }
    }
    setIsEditingUsername(!isEditingUsername);
  };

  const handleCopyLink = async () => {
    const link = `${window.location.origin}/${username}`;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Copy failed:', error);
    }
  };

  const handleSignOut = async () => {
    try {
      await logOut();
      // No need to redirect - the parent component will handle showing SignInView
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const handleNameDoubleClick = () => {
    setAdminMode(true);
  };

  const handleDeleteAccount = async () => {
    try {
      await deleteAccount();
      // Account successfully deleted - redirect without popup
      router.push('/');
    } catch (error) {
      console.error('Error deleting account:', error);
      // Check if this is just a re-authentication flow
      if (error instanceof Error && error.message.includes('Authentication required')) {
        alert('Please complete the authentication to delete your account.');
      } else {
        alert('Failed to delete account. Please try again.');
      }
    }
  };


  if (!user) {
    return null; // This shouldn't happen since the parent component handles auth state
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
        </div>

        {/* Profile Card */}
        <div className="mb-3">
          <ProfileCard
            user={user}
            showEditButton={true}
            isEditingUsername={isEditingUsername}
            username={username}
            onUsernameChange={setUsername}
            onUsernameEdit={handleUsernameEdit}
            onNameDoubleClick={handleNameDoubleClick}
            actionButton={
              <Button
                onClick={handleCopyLink}
                fullWidth
              >
                {copied ? (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Copied!
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copy link
                  </>
                )}
              </Button>
            }
          />
        </div>

        {/* Quick Actions */}
        <div className="space-y-3">
          <Link
            href="/edit-profile"
            className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 gradient-icon rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <Text variant="base">Edit profile</Text>
                  <Text variant="subdued">Manage calendars and settings</Text>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

          <Link
            href="/connections"
            className="block bg-white rounded-xl shadow-sm p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 gradient-icon rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                </div>
                <div>
                  <Text variant="base">Your connections</Text>
                  <Text variant="subdued">View and manage connections</Text>
                </div>
              </div>
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </Link>

        </div>
      </div>

      {/* Admin Mode Banner */}
      {adminMode && (
        <div className="fixed bottom-0 left-0 right-0 bg-red-600 text-white shadow-lg">
          <div className="max-w-md mx-auto px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <Text className="text-white font-medium">Admin Mode</Text>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleDeleteAccount}
                  variant="danger"
                  size="sm"
                  className="border border-white focus:ring-0 focus:ring-offset-0 focus:outline-none"
                >
                  Delete Account
                </Button>
                <button
                  onClick={() => setAdminMode(false)}
                  className="text-white hover:text-red-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}