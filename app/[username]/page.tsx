'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getUserByUsername } from '@/app/lib/firebase-db';
import { useAuth } from '@/app/contexts/AuthContext';
import type { User } from '@/app/types';
import { Heading } from '@/app/components/ui/Typography';
import ProfileCard from '@/app/components/ui/ProfileCard';
import LoadingAnimation from '@/app/components/ui/LoadingAnimation';
import TitleBar from '@/app/components/ui/TitleBar';

export default function UserProfilePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [profileUser, setProfileUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [warmingUp, setWarmingUp] = useState(false);

  useEffect(() => {
    loadUser();
  }, [params.username]);

  const loadUser = async () => {
    try {
      const username = (params.username as string).replace('@', '');
      const user = await getUserByUsername(username);

      if (!user) {
        router.push('/');
        return;
      }

      setProfileUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const handleSchedule = async () => {
    if (!profileUser || !currentUser) return;

    setWarmingUp(true);
    try {
      // Warm up availability cache
      const response = await fetch('/api/find-common-times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1Id: currentUser.id,
          user2Id: profileUser.id,
          constraints: {
            duration: 60,
            startDate: new Date().toISOString(),
            endDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          },
        }),
      });

      if (response.ok) {
        router.push(`/${profileUser.username}/schedule`);
      }
    } catch (error) {
      console.error('Error warming up availability:', error);
    } finally {
      setWarmingUp(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <LoadingAnimation />
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <div className="text-center">
          <Heading as="h2" className="mb-2">User not found</Heading>
          <button
            onClick={() => router.push('/')}
            className="gradient-link hover:opacity-80 transition-opacity"
          >
            Go home
          </button>
        </div>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === profileUser.id;

  return (
    <div className="min-h-screen  px-4 py-8">
      <div className="max-w-md mx-auto">
        <TitleBar title="Connect" />

        {/* Profile Card */}
        <div className="mb-6">
          <ProfileCard
            user={profileUser}
            actionButton={
              <>
                {/* Mutual context if both users have location */}
                {currentUser && currentUser.location && profileUser.location && !isOwnProfile && (
                  <div className="mb-4 p-3 bg-orange-50 rounded-lg text-sm text-orange-700">
                    <p>
                      You&apos;re in {currentUser.location.city} • {profileUser.displayName} is in {profileUser.location.city}
                    </p>
                  </div>
                )}

                {/* Action Button */}
                {!isOwnProfile ? (
                  <button
                    onClick={handleSchedule}
                    disabled={warmingUp}
                    className="w-full py-3 px-4 gradient-primary text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {warmingUp ? (
                      <>
                        <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        Preparing...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        Schedule
                      </>
                    )}
                  </button>
                ) : (
                  <div className="bg-orange-50 rounded-lg p-4 text-center">
                    <p className="text-orange-700">This is your profile</p>
                    <button
                      onClick={() => router.push('/')}
                      className="mt-2 gradient-link hover:opacity-80 transition-opacity font-medium"
                    >
                      Go to dashboard
                    </button>
                  </div>
                )}
              </>
            }
          />
        </div>

      </div>
    </div>
  );
}