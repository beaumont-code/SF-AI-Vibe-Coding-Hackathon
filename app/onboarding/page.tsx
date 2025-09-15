'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getUserCalendars, addCalendar, updateCalendar, getDefaultSchedulableHours, updateUserProfile } from '@/app/lib/firebase-db';
import { syncAvailableHoursToCalcom } from '@/app/lib/calcom-schedules';
import CalendarManagement from '@/app/components/ui/CalendarManagement';
import LoadingAnimation from '@/app/components/ui/LoadingAnimation';
import type { Calendar } from '@/app/types';
import { Heading, Text } from '@/app/components/ui/Typography';
import Button from '@/app/components/ui/Button';

export default function OnboardingPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [isAddingCalendar, setIsAddingCalendar] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    } else if (user) {
      loadCalendars();
    }
  }, [user, loading, router]);

  // Debug user loading
  useEffect(() => {
    console.log('Onboarding user state changed:', { user: !!user, id: user?.id, loading });
  }, [user, loading]);

  // Check for OAuth callback and update connected providers
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const calendarOAuthCompleted = urlParams.get('calendar_oauth_completed');
      const provider = sessionStorage.getItem('connecting-provider');
      const calendarId = sessionStorage.getItem('connecting-calendar-id');

      console.log('Onboarding OAuth callback check:', { success, calendarOAuthCompleted, provider, calendarId, user: !!user });

      // If OAuth completed but user not ready yet, wait for user
      if ((success === 'true' || calendarOAuthCompleted === 'true') && provider && calendarId && !user) {
        console.log('OAuth completed but user not ready yet, will retry when user loads');
        return;
      }

      // Handle any OAuth callback (regardless of specific success params)
      if ((success === 'true' || calendarOAuthCompleted === 'true') && provider && calendarId && user) {
        // Since user completed OAuth flow successfully, mark as connected
        try {
          console.log(`${provider} calendar OAuth completed successfully, attempting to mark as connected`);

          // Try to mark calendar as connected
          try {
            const connectedProviders = [provider as any];
            console.log('Updating calendar status to connected:', { calendarId, connectedProviders });
            await updateCalendar(calendarId, {
              connectedProviders,
              connectionStatus: 'connected'
            });
            console.log('Successfully marked calendar as connected');
          } catch (updateError) {
            console.error('Failed to update calendar status:', updateError);
            // Don't fail the flow - OAuth was successful, Firebase is just having issues
          }

          // Try to get the updated calendar to sync availability to Cal.com
          let connectedCalendar = null;
          try {
            console.log('Fetching updated calendars after marking as connected...');
            const updatedCalendars = await getUserCalendars(user!.id);
            connectedCalendar = updatedCalendars.find(cal => cal.id === calendarId);
            console.log('Found connected calendar:', !!connectedCalendar);
          } catch (calendarFetchError) {
            console.error('Failed to fetch calendars:', calendarFetchError);
            // Continue without calendar data
          }

          if (connectedCalendar?.calcomIntegrationId) {
            try {
              console.log('Syncing availability to Cal.com for newly connected calendar');
              // Get access token from session storage or use stored token
              const accessToken = sessionStorage.getItem('calcom-access-token') || connectedCalendar.calcomIntegrationId;

              await syncAvailableHoursToCalcom(
                user!.id,
                connectedCalendar.schedulableHours,
                user!.timezone,
                connectedCalendar.calcomIntegrationId,
                accessToken
              );
              console.log('Successfully synced availability to Cal.com');
            } catch (syncError) {
              console.warn('Failed to sync availability to Cal.com:', syncError);
              // Don't fail the connection - just log the warning
            }
          }

          // Try to reload calendars
          try {
            console.log('Reloading calendars after OAuth completion...');
            await loadCalendars();
            console.log('Successfully reloaded calendars');
          } catch (loadError) {
            console.error('Failed to reload calendars:', loadError);
            // Don't fail the flow - just continue
          }

          // Show success message even if some operations failed
          console.log('OAuth flow completed successfully on onboarding page');

        } catch (error) {
          console.error('Error in OAuth callback handling:', error);
          // Try to mark as failed if possible, but don't block the user
          try {
            await updateCalendar(calendarId, {
              connectionStatus: 'failed'
            });
            await loadCalendars();
          } catch (updateError) {
            console.warn('Could not mark calendar as failed due to Firebase permissions:', updateError);
          }
        }

        // Clear session storage and URL params
        console.log('Cleaning up session storage and URL parameters...');
        sessionStorage.removeItem('connecting-provider');
        sessionStorage.removeItem('connecting-calendar-id');
        sessionStorage.removeItem('calcom-access-token');
        sessionStorage.removeItem('oauth-origin-page');
        window.history.replaceState({}, document.title, window.location.pathname);
        console.log('Cleanup completed');
      }
    };

    handleOAuthCallback();
  }, [user]);

  const loadCalendars = async () => {
    if (!user) return;
    try {
      const userCalendars = await getUserCalendars(user.id);
      // Only show calendars that are connected (not connecting or failed)
      const connectedCalendars = userCalendars.filter(cal => cal.connectionStatus === 'connected' || !cal.connectionStatus);
      setCalendars(connectedCalendars);
    } catch (error) {
      console.error('Error loading calendars:', error);
    }
  };

  const handleCalendarCreated = async (calendarIdFromProvider: string, managedUserId: string, accessToken: string, refreshToken: string): Promise<string> => {
    setIsAddingCalendar(true);
    try {
      const isFirstCalendar = calendars.length === 0;
      const category = isFirstCalendar ? 'personal' : 'work';

      const newCalendar: Omit<Calendar, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user!.id,
        provider: 'calcom',
        email: user!.email,
        category,
        isDefault: isFirstCalendar || (category === 'work' && !calendars.find(c => c.category === 'work' && c.isDefault)),
        schedulableHours: getDefaultSchedulableHours(category),
        calcomIntegrationId: managedUserId,
        calcomAccessToken: accessToken,
        calcomRefreshToken: refreshToken,
        connectionStatus: 'connecting',
      };

      const calendarId = await addCalendar(newCalendar);
      // Don't show calendar in UI yet - wait for OAuth completion

      return calendarId;
    } catch (error) {
      console.error('Error creating calendar:', error);
      alert('Calendar creation error: ' + (error as Error).message);
      throw error;
    } finally {
      setIsAddingCalendar(false);
    }
  };

  const handleDone = async () => {
    try {
      // Mark onboarding as completed
      await updateUserProfile(user!.id, {
        onboardingCompleted: true
      });

      // Refresh user data to get updated onboarding status
      await refreshUser();

      // Navigate to home page
      router.push('/');
    } catch (error) {
      console.error('Error completing onboarding:', error);
      alert('Failed to complete onboarding. Please try again.');
    }
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <LoadingAnimation />
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center space-y-2 mb-6">
          <Heading as="h1">Connect your Cal</Heading>
          <Text variant="base">
            Add your personal and work calendars to make finding time to meet effortless.
          </Text>
        </div>

        {/* Calendar Management */}
        <div className="mb-6">
          <CalendarManagement
            variant="simple"
            calendars={calendars}
            setCalendars={setCalendars}
            user={user}
            onCalendarCreated={handleCalendarCreated}
            isAddingCalendar={isAddingCalendar}
          />
        </div>

        {/* Done Button */}
        <Button
          onClick={handleDone}
          fullWidth
        >
          Done
        </Button>
      </div>
    </div>
  );
}