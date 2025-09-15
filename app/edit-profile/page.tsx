'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import { getUserCalendars, addCalendar, updateCalendar, deleteCalendar, getDefaultSchedulableHours, updateUserProfile } from '@/app/lib/firebase-db';
import { getCalendarOAuthUrl, checkCalendarConnection } from '@/app/lib/calcom';
import { syncAvailableHoursToCalcom } from '@/app/lib/calcom-schedules';
import { deleteAccount, logOut } from '@/app/lib/firebase';
import CalendarManagement from '@/app/components/ui/CalendarManagement';
import LoadingAnimation from '@/app/components/ui/LoadingAnimation';
import type { Calendar, SchedulableHours } from '@/app/types';
import { Heading, Text } from '@/app/components/ui/Typography';
import Button from '@/app/components/ui/Button';

const TIME_OPTIONS = Array.from({ length: 96 }, (_, i) => {
  const hour = Math.floor(i / 4);
  const minute = (i % 4) * 15;
  return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
});

export default function CalendarsPage() {
  const { user, loading, refreshUser } = useAuth();
  const router = useRouter();
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [isDirty, setIsDirty] = useState(false);
  const [expandedCalendar, setExpandedCalendar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [isAddingCalendar, setIsAddingCalendar] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    } else if (user) {
      loadCalendars();
    }
  }, [user, loading, router]);

  // Check for OAuth callback and update connected providers
  useEffect(() => {
    const handleOAuthCallback = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const success = urlParams.get('success');
      const calendarOAuthCompleted = urlParams.get('calendar_oauth_completed');
      const provider = sessionStorage.getItem('connecting-provider');
      const calendarId = sessionStorage.getItem('connecting-calendar-id');

      console.log('OAuth callback check:', { success, calendarOAuthCompleted, provider, calendarId, user: !!user });


      // If OAuth completed but user not ready yet, wait for user
      if ((success === 'true' || calendarOAuthCompleted === 'true') && provider && calendarId && !user) {
        console.log('OAuth completed but user not ready yet, will retry when user loads');
        return;
      }

      // Handle any OAuth callback (regardless of specific success params)
      if ((success === 'true' || calendarOAuthCompleted === 'true') && provider && calendarId && user) {

        // For Cal.com managed users, check the connection status via API
        try {
          console.log(`${provider} calendar OAuth completed successfully, attempting to mark as connected`);

          // Try to get the current calendar from the database
          let currentCalendar = null;
          try {
            const allCalendars = await getUserCalendars(user.id);
            currentCalendar = allCalendars.find(c => c.id === calendarId);
          } catch (calendarFetchError) {
            console.warn('Failed to fetch calendars:', calendarFetchError);
            // Continue without calendar data - we'll just mark as connected
          }

          // Get fresh tokens from sessionStorage and update calendar
          const freshAccessToken = sessionStorage.getItem('calcom-access-token');
          const freshRefreshToken = sessionStorage.getItem('calcom-refresh-token');
          const defaultScheduleId = sessionStorage.getItem('calcom-default-schedule-id');

          // Get the default schedule ID that was found during calendar creation
          // This should be available in the user's calcomScheduleId (we'll copy it to the calendar)

          // Get actual calendar details including email from Cal.com
          let calendarEmail = user.email; // fallback to user email
          let calendarName = '';

          if (freshAccessToken) {
            try {
              const { getConnectedCalendarDetails } = await import('@/app/lib/calcom');
              const calendarDetails = await getConnectedCalendarDetails(provider as any, freshAccessToken);

              if (calendarDetails.email) {
                calendarEmail = calendarDetails.email;
                console.log('Found actual calendar email:', calendarEmail);
              }

              if (calendarDetails.name) {
                calendarName = calendarDetails.name;
                console.log('Found calendar name:', calendarName);
              }
            } catch (error) {
              console.warn('Failed to get calendar details from Cal.com:', error);
              // Continue with user email as fallback
            }
          }

          // Mark calendar as connected and update with fresh tokens
          try {
            const connectedProviders = [provider as any];
            const updateData: any = {
              connectedProviders,
              connectionStatus: 'connected',
              email: calendarEmail // Update with actual calendar email
            };

            // Update with fresh tokens if available
            if (freshAccessToken && freshRefreshToken) {
              console.log('Updating calendar with fresh Cal.com tokens from OAuth completion');
              updateData.calcomAccessToken = freshAccessToken;
              updateData.calcomRefreshToken = freshRefreshToken;

              // Store the calendar-specific default schedule ID if available
              if (defaultScheduleId) {
                console.log('Storing calendar-specific schedule ID in calendar record:', defaultScheduleId);
                updateData.calcomScheduleId = defaultScheduleId;
              } else {
                // If no default schedule ID (when reusing managed user), create a new schedule for this calendar on first save
                console.log('No default schedule ID found, will create new schedule for this calendar on first save');
              }
            }

            await updateCalendar(calendarId, updateData);

            // Update local state with fresh tokens so they persist for future saves
            if (freshAccessToken && freshRefreshToken) {
              setCalendars(calendars.map(cal =>
                cal.id === calendarId
                  ? {
                      ...cal,
                      calcomAccessToken: freshAccessToken,
                      calcomRefreshToken: freshRefreshToken,
                      calcomScheduleId: updateData.calcomScheduleId,
                      connectedProviders,
                      connectionStatus: 'connected',
                      email: calendarEmail // Update with actual calendar email
                    }
                  : cal
              ));
            }

            console.log('Successfully marked calendar as connected - ready for availability configuration');
          } catch (updateError) {
            console.error('Failed to update calendar status:', updateError);
            // Don't fail the flow - OAuth was successful, this is just a status update
          }

          // Availability will be synced to Cal.com when user clicks "Save Changes"
          console.log('Calendar connected successfully. Configure availability and click Save to sync with Cal.com.');

          // Try to reload calendars
          try {
            await loadCalendars();
          } catch (loadError) {
            console.warn('Failed to reload calendars (probably Firebase permissions):', loadError);
            // Don't fail the flow - just continue
          }

          // Show success message even if some operations failed
          console.log('OAuth flow completed successfully');

          // Clean up session storage
          sessionStorage.removeItem('connecting-provider');
          sessionStorage.removeItem('connecting-calendar-id');
          sessionStorage.removeItem('calcom-access-token');
          sessionStorage.removeItem('calcom-refresh-token');
          sessionStorage.removeItem('calcom-default-schedule-id');

          // Clean up URL parameters
          const url = new URL(window.location.href);
          url.searchParams.delete('success');
          url.searchParams.delete('calendar_oauth_completed');
          window.history.replaceState({}, '', url.toString());

        } catch (error) {
          console.error('Error in OAuth callback handling:', error);
          // Try to mark as failed if possible, but don't block the user
          try {
            if (calendarId) {
              await updateCalendar(calendarId, {
                connectionStatus: 'failed'
              });
            }
            await loadCalendars();
          } catch (updateError) {
            console.warn('Could not mark calendar as failed:', updateError);
          }

          // Clean up session storage even on error
          sessionStorage.removeItem('connecting-provider');
          sessionStorage.removeItem('connecting-calendar-id');
          sessionStorage.removeItem('calcom-access-token');
          sessionStorage.removeItem('calcom-refresh-token');
        }

        // Clear URL params
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    };

    handleOAuthCallback();
  }, [user]);

  // Debug user loading
  useEffect(() => {
    console.log('User state changed:', { user: !!user, id: user?.id, loading });
  }, [user, loading]);

  const loadCalendars = async () => {
    if (!user) return;
    try {
      const userCalendars = await getUserCalendars(user.id);
      // Only show calendars that are connected (not connecting or failed)
      const connectedCalendars = userCalendars.filter(cal => cal.connectionStatus === 'connected' || !cal.connectionStatus);
      setCalendars(connectedCalendars);
      if (connectedCalendars.length > 0) {
        setExpandedCalendar(connectedCalendars[0].id);
      }
    } catch (error) {
      console.error('Error loading calendars:', error);
    }
  };

  const handleCalendarCreated = async (calendarIdFromProvider: string, managedUserId: string, accessToken: string, refreshToken: string, defaultScheduleId?: string): Promise<string> => {
    setIsAddingCalendar(true);
    try {
      const isFirstCalendar = calendars.length === 0;

      // Simple logic: All calendars default to personal (user can change later)
      const defaultCategory: 'work' | 'personal' = 'personal';

      // Simple default assignment: Only first calendar is default
      const shouldBeDefault = isFirstCalendar;

      const newCalendar: Omit<Calendar, 'id' | 'createdAt' | 'updatedAt'> = {
        userId: user!.id,
        provider: 'calcom',
        email: user!.email,
        category: defaultCategory,
        isDefault: shouldBeDefault,
        schedulableHours: getDefaultSchedulableHours(defaultCategory),
        calcomIntegrationId: managedUserId, // Will be the user's single managed user
        calcomAccessToken: accessToken,     // Shared from user's managed user
        calcomRefreshToken: refreshToken,   // Shared from user's managed user
        connectionStatus: 'connecting',
      };

      const calendarId = await addCalendar(newCalendar);

      // Store the default schedule ID in the user profile if provided
      if (defaultScheduleId && user) {
        console.log('Storing default schedule ID in user profile:', defaultScheduleId);
        try {
          await updateUserProfile(user.id, { calcomScheduleId: defaultScheduleId });
          // Refresh user data to reflect the change
          await refreshUser();
        } catch (error) {
          console.error('Error storing schedule ID in user profile:', error);
          // Don't throw - calendar creation succeeded, this is just optimization
        }
      }

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

  const handleCategoryChange = (calendarId: string, category: 'work' | 'personal') => {
    setCalendars(calendars.map(cal => {
      if (cal.id === calendarId) {
        const updatedCal = { ...cal, category };
        const hasOtherDefault = calendars.some(c => c.id !== calendarId && c.category === category && c.isDefault);
        if (!hasOtherDefault) {
          updatedCal.isDefault = true;
        }
        return updatedCal;
      }
      return cal;
    }));
    setIsDirty(true);
  };

  const handleDefaultToggle = (calendarId: string) => {
    setCalendars(calendars.map(cal => {
      return { ...cal, isDefault: cal.id === calendarId };
    }));
    setIsDirty(true);
  };

  const handleTimeChange = (calendarId: string, day: keyof SchedulableHours, slotIndex: number, field: 'start' | 'end', value: string) => {
    setCalendars(calendars.map(cal => {
      if (cal.id === calendarId) {
        const updatedHours = { ...cal.schedulableHours };
        if (updatedHours[day].length === 0) {
          updatedHours[day] = [{ start: '09:00', end: '17:00' }];
        }
        if (!updatedHours[day][slotIndex]) {
          updatedHours[day][slotIndex] = { start: '09:00', end: '17:00' };
        }
        updatedHours[day][slotIndex] = {
          ...updatedHours[day][slotIndex],
          [field]: value
        };
        return { ...cal, schedulableHours: updatedHours };
      }
      return cal;
    }));
    setIsDirty(true);
  };

  const handleAddTimeSlot = (calendarId: string, day: keyof SchedulableHours) => {
    setCalendars(calendars.map(cal => {
      if (cal.id === calendarId) {
        const updatedHours = { ...cal.schedulableHours };
        updatedHours[day] = [...updatedHours[day], { start: '09:00', end: '17:00' }];
        return { ...cal, schedulableHours: updatedHours };
      }
      return cal;
    }));
    setIsDirty(true);
  };

  const handleRemoveTimeSlot = (calendarId: string, day: keyof SchedulableHours, slotIndex: number) => {
    setCalendars(calendars.map(cal => {
      if (cal.id === calendarId) {
        const updatedHours = { ...cal.schedulableHours };
        updatedHours[day] = updatedHours[day].filter((_, index) => index !== slotIndex);
        return { ...cal, schedulableHours: updatedHours };
      }
      return cal;
    }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      for (const calendar of calendars) {
        // Update calendar in database
        await updateCalendar(calendar.id, {
          category: calendar.category,
          isDefault: calendar.isDefault,
          schedulableHours: calendar.schedulableHours,
        });

        // Sync to Cal.com if this calendar has a Cal.com integration
        if (calendar.calcomIntegrationId && user) {
          try {
            console.log('Syncing updated availability to Cal.com for calendar:', calendar.id);

            // Get fresh access token using refresh token if needed
            let accessToken = calendar.calcomAccessToken;
            let refreshToken = calendar.calcomRefreshToken;

            console.log('Calendar tokens debug:', {
              hasAccessToken: !!accessToken,
              hasRefreshToken: !!refreshToken,
              calendarId: calendar.id,
              managedUserId: calendar.calcomIntegrationId
            });

            if (!accessToken || !refreshToken) {
              console.log('No Cal.com tokens stored, attempting to force refresh for existing managed user');
              try {
                const { forceRefreshCalcomManagedUserTokens } = await import('@/app/lib/calcom');
                const freshTokens = await forceRefreshCalcomManagedUserTokens(calendar.calcomIntegrationId!);

                // Update calendar with the fresh tokens
                await updateCalendar(calendar.id, {
                  calcomAccessToken: freshTokens.accessToken,
                  calcomRefreshToken: freshTokens.refreshToken,
                });

                // Update local state so tokens persist for future saves
                setCalendars(calendars.map(cal =>
                  cal.id === calendar.id
                    ? { ...cal, calcomAccessToken: freshTokens.accessToken, calcomRefreshToken: freshTokens.refreshToken }
                    : cal
                ));

                // Use the fresh tokens
                accessToken = freshTokens.accessToken;
                refreshToken = freshTokens.refreshToken;
                console.log('Successfully retrieved and stored fresh tokens for existing calendar');
              } catch (tokenError) {
                console.error('Failed to get fresh tokens for existing calendar:', tokenError);
                console.warn('Skipping Cal.com sync for this calendar');
                continue;
              }
            }

            // Try to sync with current token, refresh if it fails with 401
            try {
              const syncedScheduleId = await syncAvailableHoursToCalcom(
                user.id,
                calendar.schedulableHours,
                user.timezone,
                calendar.calcomIntegrationId!,
                accessToken,
                calendar.calcomScheduleId
              );

              // Update calendar with the schedule ID if it changed or is new
              if (syncedScheduleId && syncedScheduleId !== calendar.calcomScheduleId) {
                console.log('Updating calendar with new schedule ID:', syncedScheduleId);
                await updateCalendar(calendar.id, { calcomScheduleId: syncedScheduleId });

                // Update local state as well
                setCalendars(calendars.map(cal =>
                  cal.id === calendar.id ? { ...cal, calcomScheduleId: syncedScheduleId } : cal
                ));
              }

              console.log('Successfully synced updated availability to Cal.com');
            } catch (syncError: any) {
              // If we get a 401, try to refresh the token
              if (syncError.message.includes('401') || syncError.message.includes('Unauthorized')) {
                console.log('Access token expired, refreshing...');
                try {
                  const { refreshCalcomManagedUserToken } = await import('@/app/lib/calcom');
                  const refreshedTokens = await refreshCalcomManagedUserToken(
                    calendar.calcomIntegrationId!,
                    refreshToken
                  );

                  // Update calendar with new tokens
                  await updateCalendar(calendar.id, {
                    calcomAccessToken: refreshedTokens.accessToken,
                    calcomRefreshToken: refreshedTokens.refreshToken,
                  });

                  // Update local state
                  setCalendars(calendars.map(cal =>
                    cal.id === calendar.id
                      ? { ...cal, calcomAccessToken: refreshedTokens.accessToken, calcomRefreshToken: refreshedTokens.refreshToken }
                      : cal
                  ));

                  // Retry sync with new token
                  const syncedScheduleId = await syncAvailableHoursToCalcom(
                    user.id,
                    calendar.schedulableHours,
                    user.timezone,
                    calendar.calcomIntegrationId!,
                    refreshedTokens.accessToken,
                    calendar.calcomScheduleId
                  );

                  // Update calendar with the schedule ID if it changed or is new
                  if (syncedScheduleId && syncedScheduleId !== calendar.calcomScheduleId) {
                    console.log('Updating calendar with new schedule ID after token refresh:', syncedScheduleId);
                    await updateCalendar(calendar.id, { calcomScheduleId: syncedScheduleId });

                    // Update local state as well
                    setCalendars(calendars.map(cal =>
                      cal.id === calendar.id ? { ...cal, calcomScheduleId: syncedScheduleId } : cal
                    ));
                  }
                  console.log('Successfully synced after token refresh');

                  // Refresh user data to get updated schedule ID if a new one was created
                  await refreshUser();
                } catch (refreshError) {
                  console.error('Failed to refresh token and sync:', refreshError);
                  throw refreshError;
                }
              } else {
                throw syncError;
              }
            }
          } catch (syncError) {
            console.warn('Failed to sync updated availability to Cal.com:', syncError);
            // Don't fail the save - just log the warning
          }
        }
      }
      setIsDirty(false);
    } catch (error) {
      console.error('Error saving calendars:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnectCalendar = async (calendarId: string) => {
    try {
      await deleteCalendar(calendarId);
      setCalendars(calendars.filter(cal => cal.id !== calendarId));

      // If the expanded calendar was the one we deleted, close it
      if (expandedCalendar === calendarId) {
        setExpandedCalendar(null);
      }

      // Calendar disconnected successfully - no alert needed
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      alert('Failed to disconnect calendar. Please try again.');
    }
  };


  const handleSignOut = async () => {
    try {
      await logOut();
      router.push('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
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

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <div className="animate-pulse">
          <LoadingAnimation />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      <div className="max-w-md mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => router.push('/')}
            className="hover:gradient-text transition-colors"
          >
            <Text variant="small" as="span">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Text>
          </button>
          <Heading as="h1">Edit Profile</Heading>
          <div className="w-5"></div> {/* Spacer to center the title */}
        </div>

        {/* Calendar Management */}
        <div className="mb-6">
          <CalendarManagement
            variant="detailed"
            calendars={calendars}
            setCalendars={setCalendars}
            user={user!}
            onCalendarCreated={handleCalendarCreated}
            isAddingCalendar={isAddingCalendar}
            expandedCalendar={expandedCalendar}
            onToggleExpanded={(calendarId) => {
              setExpandedCalendar(expandedCalendar === calendarId ? null : calendarId);
            }}
            onCalendarUpdate={(updatedCalendar) => {
              setCalendars(calendars.map(cal => cal.id === updatedCalendar.id ? updatedCalendar : cal));
              setIsDirty(true);
            }}
            onCalendarDelete={(calendarId) => {
              setCalendars(calendars.filter(cal => cal.id !== calendarId));
              if (expandedCalendar === calendarId) {
                setExpandedCalendar(null);
              }
            }}
            onCategoryChange={handleCategoryChange}
            onDefaultToggle={handleDefaultToggle}
            onTimeChange={handleTimeChange}
            onAddTimeSlot={handleAddTimeSlot}
            onRemoveTimeSlot={handleRemoveTimeSlot}
          />
        </div>

        {/* Save Button */}
        <div className="mb-3">
          <Button
            onClick={handleSave}
            disabled={saving || !isDirty}
            fullWidth
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>

        {/* Sign Out Button */}
        <div className="text-center">
          <button
            onClick={handleSignOut}
            className="hover:gradient-text transition-colors"
          >
            <Text variant="gradient">Sign Out</Text>
          </button>
        </div>

      </div>
    </div>
  );
}