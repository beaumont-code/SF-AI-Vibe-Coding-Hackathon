'use client';

import { createCalcomManagedUser, getCalendarOAuthUrl } from '@/app/lib/calcom';
import { Text, Link } from './Typography';

interface CalendarProviderButtonsProps {
  user: {
    id: string;
    email: string;
    displayName: string;
    timezone?: string;
    calcomIntegrationId?: string;
    calcomAccessToken?: string;
    calcomRefreshToken?: string;
    calcomScheduleId?: string;
  };
  onCalendarCreated: (calendarId: string, managedUserId: string, accessToken: string, refreshToken: string, defaultScheduleId?: string) => Promise<string>;
  disabled?: boolean;
}

export default function CalendarProviderButtons({ user, onCalendarCreated, disabled }: CalendarProviderButtonsProps) {
  const handleAddCalendar = async (provider: 'google' | 'office365' | 'apple') => {
    try {
      console.log(`Setting up Cal.com integration for ${provider}...`);

      let calcomUser;

      // Check if user already has a managed user, reuse it
      if (user.calcomIntegrationId && user.calcomAccessToken && user.calcomRefreshToken) {
        console.log('Reusing existing Cal.com managed user:', user.calcomIntegrationId);
        calcomUser = {
          managedUserId: user.calcomIntegrationId,
          accessToken: user.calcomAccessToken,
          refreshToken: user.calcomRefreshToken,
          defaultScheduleId: user.calcomScheduleId
        };
      } else {
        console.log('Creating new Cal.com managed user...');
        calcomUser = await createCalcomManagedUser(
          user.email,
          user.displayName || 'User',
          user.timezone
        );

        console.log('Cal.com managed user created:', calcomUser);

        // Store the managed user info in the user profile for future reuse
        const { updateUserProfile } = await import('@/app/lib/firebase-db');
        try {
          await updateUserProfile(user.id, {
            calcomIntegrationId: calcomUser.managedUserId,
            calcomAccessToken: calcomUser.accessToken,
            calcomRefreshToken: calcomUser.refreshToken,
            calcomScheduleId: calcomUser.defaultScheduleId
          });
          console.log('Stored Cal.com managed user info in user profile');
        } catch (error) {
          console.warn('Failed to store managed user info in profile:', error);
          // Don't fail the flow, just continue
        }
      }

      // Call the callback to let parent component handle calendar creation
      const calendarId = await onCalendarCreated('', calcomUser.managedUserId, calcomUser.accessToken, calcomUser.refreshToken, calcomUser.defaultScheduleId);

      // Store information needed for OAuth callback handling
      sessionStorage.setItem('connecting-provider', provider);
      sessionStorage.setItem('connecting-calendar-id', calendarId);
      sessionStorage.setItem('calcom-access-token', calcomUser.accessToken);
      sessionStorage.setItem('calcom-refresh-token', calcomUser.refreshToken);
      if (calcomUser.defaultScheduleId) {
        sessionStorage.setItem('calcom-default-schedule-id', calcomUser.defaultScheduleId);
        console.log('Stored default schedule ID for OAuth callback:', calcomUser.defaultScheduleId);
      } else {
        sessionStorage.removeItem('calcom-default-schedule-id');
        console.log('No default schedule ID available for OAuth callback');
      }
      sessionStorage.setItem('oauth-origin-page', window.location.pathname);
      console.log('Set OAuth origin page to:', window.location.pathname);

      if (provider === 'apple') {
        // For Apple, open Cal.com directly
        const calcomUrl = `https://app.cal.com/apps/apple-calendar?user=${calcomUser.managedUserId}`;
        window.open(calcomUrl, '_blank');
        return;
      }

      // Get OAuth URL and redirect immediately for Google/Outlook
      const oauthUrl = await getCalendarOAuthUrl(provider, calcomUser.managedUserId, calcomUser.accessToken);
      window.location.href = oauthUrl;
    } catch (error) {
      console.error(`Error connecting ${provider} calendar:`, error);
      alert(`${provider} integration error: ` + (error as Error).message);
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 space-y-4">
      <button
        onClick={() => handleAddCalendar('google')}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-transparent hover:bg-gradient-to-r hover:from-red-50 hover:to-amber-50 hover:shadow-lg hover:ring-2 hover:ring-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <Text variant="base" as="span">Add Google Calendar</Text>
      </button>

      <button
        onClick={() => handleAddCalendar('office365')}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-transparent hover:bg-gradient-to-r hover:from-red-50 hover:to-amber-50 hover:shadow-lg hover:ring-2 hover:ring-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#F25022"
            d="M1 1h10v10H1z"
          />
          <path
            fill="#7FBA00"
            d="M13 1h10v10H13z"
          />
          <path
            fill="#00A4EF"
            d="M1 13h10v10H1z"
          />
          <path
            fill="#FFB900"
            d="M13 13h10v10H13z"
          />
        </svg>
        <Text variant="base" as="span">Add Microsoft Calendar</Text>
      </button>

      <button
        onClick={() => handleAddCalendar('apple')}
        disabled={disabled}
        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-200 rounded-lg hover:border-transparent hover:bg-gradient-to-r hover:from-red-50 hover:to-amber-50 hover:shadow-lg hover:ring-2 hover:ring-red-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24">
          <path
            fill="#000000"
            d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"
          />
        </svg>
        <Text variant="base" as="span">Add Apple Calendar</Text>
      </button>

      {/* Informational text */}
      <Text variant="subdued" className="text-center mt-4">
        Cal Connect uses{' '}
        <Link
          href="https://cal.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          cal.com
        </Link>
        {' '}to link to your calendars. All calendar info stored by cal.com
      </Text>
    </div>
  );
}