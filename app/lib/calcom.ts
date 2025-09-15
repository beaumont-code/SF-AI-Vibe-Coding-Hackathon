// Cal.com API integration functions
const CALCOM_API_BASE = process.env.CAL_API_URL || 'https://api.cal.com/v2';
const CALCOM_CLIENT_ID = process.env.NEXT_PUBLIC_CALCOM_CLIENT_ID;
const CALCOM_JWT_TOKEN = process.env.NEXT_PUBLIC_CALCOM_JWT_TOKEN;

interface CalcomManagedUser {
  managedUserId: string;
  accessToken: string;
  refreshToken: string;
  defaultScheduleId?: string;
}

export async function createCalcomManagedUser(
  email: string,
  displayName: string,
  timezone?: string
): Promise<CalcomManagedUser> {
  console.log('Creating Cal.com managed user for:', email);

  const userTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
  console.log('Using timezone for managed user:', userTimezone);

  // Use the correct v2 endpoint with OAuth client ID
  const response = await fetch(`${CALCOM_API_BASE}/oauth-clients/${CALCOM_CLIENT_ID}/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cal-secret-key': CALCOM_JWT_TOKEN!,
    },
    body: JSON.stringify({
      email,
      name: displayName,
      timeZone: userTimezone, // This will create a default schedule!
      weekStart: 'Monday',
      timeFormat: 24,
    }),
  });

  if (!response.ok) {
    if (response.status === 409) {
      // User already exists, extract the existing user ID from error message
      const errorText = await response.text();
      console.log('Cal.com user already exists:', errorText);

      try {
        const errorData = JSON.parse(errorText);
        const existingUserId = errorData.error?.details?.message?.match(/Existing user ID=(\d+)/)?.[1];

        if (existingUserId) {
          console.log('Using existing Cal.com user ID:', existingUserId);

          // Get fresh access token for existing user
          const refreshResponse = await fetch(`${CALCOM_API_BASE}/oauth-clients/${CALCOM_CLIENT_ID}/users/${existingUserId}/force-refresh`, {
            method: 'POST',
            headers: {
              'x-cal-secret-key': CALCOM_JWT_TOKEN!,
            },
          });

          if (refreshResponse.ok) {
            const refreshData = await refreshResponse.json();
            console.log('Refreshed tokens for existing user:', refreshData.status);

            const accessToken = refreshData.data?.accessToken || refreshData.accessToken;

            // Get the default schedule ID for this existing managed user
            let defaultScheduleId: string | undefined;
            try {
              const schedulesResponse = await fetch(`${CALCOM_API_BASE}/schedules`, {
                method: 'GET',
                headers: {
                  'Authorization': `Bearer ${accessToken}`,
                },
              });

              if (schedulesResponse.ok) {
                const schedulesData = await schedulesResponse.json();
                console.log('Existing user schedules:', schedulesData);
                console.log('Fetch schedules - managedUserId:', existingUserId);
                console.log('Fetch schedules - access token (first 50 chars):', accessToken.substring(0, 50) + '...');

                // Find the default schedule
                const schedules = schedulesData.data || [];
                const defaultSchedule = schedules.find((schedule: any) => schedule.isDefault);
                if (defaultSchedule) {
                  defaultScheduleId = defaultSchedule.id.toString();
                  console.log('Found existing user default schedule ID:', defaultScheduleId);
                }
              } else {
                console.warn('Failed to fetch existing user schedules:', await schedulesResponse.text());
              }
            } catch (error) {
              console.warn('Error fetching existing user default schedule:', error);
            }

            return {
              managedUserId: existingUserId,
              accessToken,
              refreshToken: refreshData.data?.refreshToken || refreshData.refreshToken,
              defaultScheduleId,
            };
          } else {
            console.error('Failed to refresh tokens for existing user:', await refreshResponse.text());
            // Fallback to JWT token - this shouldn't have a refresh token since it's not a managed user token
            throw new Error('Failed to refresh tokens for existing user and no fallback refresh token available');
          }
        }
      } catch (parseError) {
        console.error('Failed to parse error response:', parseError);
      }
    }

    const errorText = await response.text();
    console.error('Cal.com API error:', response.status, errorText);
    throw new Error(`Failed to create Cal.com managed user: ${errorText}`);
  }

  const data = await response.json();
  console.log('Cal.com managed user created:', data);

  const managedUserId = data.data?.user?.id?.toString() || data.user?.id?.toString();
  const accessToken = data.data?.accessToken || data.accessToken;
  const refreshToken = data.data?.refreshToken || data.refreshToken;

  if (!managedUserId) {
    console.error('Failed to extract managedUserId from response:', data);
    throw new Error('Cal.com API did not return a valid managed user ID');
  }

  if (!accessToken) {
    console.error('Failed to extract accessToken from response:', data);
    throw new Error('Cal.com API did not return a valid access token');
  }

  if (!refreshToken) {
    console.error('Failed to extract refreshToken from response:', data);
    throw new Error('Cal.com API did not return a valid refresh token');
  }

  // Get the default schedule ID for this managed user
  let defaultScheduleId: string | undefined;
  try {
    const schedulesResponse = await fetch(`${CALCOM_API_BASE}/schedules`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (schedulesResponse.ok) {
      const schedulesData = await schedulesResponse.json();
      console.log('User schedules:', schedulesData);
      console.log('Fetch new user schedules - managedUserId:', managedUserId);
      console.log('Fetch new user schedules - access token (first 50 chars):', accessToken.substring(0, 50) + '...');

      // Find the default schedule
      const schedules = schedulesData.data || [];
      const defaultSchedule = schedules.find((schedule: any) => schedule.isDefault);
      if (defaultSchedule) {
        defaultScheduleId = defaultSchedule.id.toString();
        console.log('Found default schedule ID:', defaultScheduleId);
      }
    } else {
      console.warn('Failed to fetch user schedules:', await schedulesResponse.text());
    }
  } catch (error) {
    console.warn('Error fetching default schedule:', error);
  }

  return {
    managedUserId,
    accessToken,
    refreshToken,
    defaultScheduleId,
  };
}

export async function getCalendarOAuthUrl(
  provider: 'google' | 'office365' | 'apple',
  managedUserId: string,
  accessToken: string
): Promise<string> {
  console.log(`Getting ${provider} OAuth URL for managed user:`, managedUserId);

  // For apple, return a direct Cal.com URL
  if (provider === 'apple') {
    return `https://app.cal.com/apps/apple-calendar?user=${managedUserId}`;
  }

  // Use correct v2 endpoint and GET method with query parameters
  const redirectUri = `${window.location.origin}/api/calendar/${provider}`;
  const params = new URLSearchParams({
    isDryRun: 'false',
    redir: redirectUri,
  });

  // Try managed user access token first, then fall back to API key format
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // If access token looks like a managed user token (JWT), use it as Bearer
  if (accessToken && accessToken.includes('.')) {
    authHeaders['Authorization'] = `Bearer ${accessToken}`;
  } else if (CALCOM_JWT_TOKEN) {
    // Otherwise, try using the client secret as an API key
    const apiKey = CALCOM_JWT_TOKEN.startsWith('cal_') ? CALCOM_JWT_TOKEN : `cal_${CALCOM_JWT_TOKEN}`;
    authHeaders['Authorization'] = `Bearer ${apiKey}`;
  } else {
    throw new Error('No valid authentication token available for Cal.com API');
  }

  const response = await fetch(`${CALCOM_API_BASE}/calendars/${provider}/connect?${params}`, {
    method: 'GET',
    headers: authHeaders,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Cal.com ${provider} OAuth URL error:`, response.status, errorText);
    throw new Error(`Failed to get ${provider} OAuth URL: ${errorText}`);
  }

  const data = await response.json();
  console.log(`${provider} OAuth URL retrieved:`, data);

  // Log the full data structure to debug
  console.log(`${provider} OAuth URL data structure:`, JSON.stringify(data, null, 2));

  return data.data?.url || data.data?.authUrl || data.data?.oauthUrl || data.oauthUrl || data.url || data.authUrl || data.connectUrl;
}

export async function saveCalendarCredentials(
  provider: 'google' | 'office365',
  code: string,
  state: string,
  managedUserId?: string
): Promise<any> {
  console.log(`Saving ${provider} calendar credentials`);

  // Use correct v2 endpoint for saving credentials
  const response = await fetch(`${CALCOM_API_BASE}/calendars/save-google-or-outlook-calendar-credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${CALCOM_JWT_TOKEN}`,
    },
    body: JSON.stringify({
      provider,
      code,
      state,
      managedUserId,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Cal.com ${provider} credentials save error:`, response.status, errorText);
    throw new Error(`Failed to save ${provider} credentials: ${errorText}`);
  }

  const data = await response.json();
  console.log(`${provider} credentials saved:`, data);

  return data;
}


export async function deleteCalcomManagedUser(managedUserId: string): Promise<void> {
  console.log('Deleting Cal.com managed user:', managedUserId);

  const response = await fetch(`${CALCOM_API_BASE}/oauth-clients/${CALCOM_CLIENT_ID}/users/${managedUserId}`, {
    method: 'DELETE',
    headers: {
      'x-cal-secret-key': CALCOM_JWT_TOKEN!,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();

    // If user is not found (404), consider it a success since the user is already gone
    if (response.status === 404) {
      console.log('Cal.com managed user not found (already deleted):', managedUserId);
      return;
    }

    console.error('Cal.com user deletion error:', response.status, errorText);
    throw new Error(`Failed to delete Cal.com managed user: ${errorText}`);
  }

  console.log('Cal.com managed user deleted successfully');
}

export async function checkCalendarConnection(
  provider: 'google' | 'office365' | 'apple',
  managedUserId: string,
  accessToken: string
): Promise<{ connected: boolean; calendars?: any[] }> {
  console.log(`Checking ${provider} calendar connection for managed user:`, managedUserId);

  // Try managed user access token first, then fall back to API key format
  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // If access token looks like a managed user token (JWT), use it as Bearer
  if (accessToken && accessToken.includes('.')) {
    authHeaders['Authorization'] = `Bearer ${accessToken}`;
  } else if (CALCOM_JWT_TOKEN) {
    // Otherwise, try using the client secret as an API key
    const apiKey = CALCOM_JWT_TOKEN.startsWith('cal_') ? CALCOM_JWT_TOKEN : `cal_${CALCOM_JWT_TOKEN}`;
    authHeaders['Authorization'] = `Bearer ${apiKey}`;
  } else {
    throw new Error('No valid authentication token available for Cal.com API');
  }

  const response = await fetch(`${CALCOM_API_BASE}/calendars/${provider}/check`, {
    method: 'GET',
    headers: authHeaders,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Cal.com ${provider} calendar check error:`, response.status, errorText);
    return { connected: false };
  }

  const data = await response.json();
  console.log(`${provider} calendar connection status:`, data);

  return {
    connected: data.status === 'success' || data.data?.connected === true,
    calendars: data.data?.calendars || []
  };
}

export async function getConnectedCalendarDetails(
  provider: 'google' | 'office365' | 'apple',
  accessToken: string
): Promise<{ email?: string; name?: string; calendars?: any[] }> {
  console.log(`Getting connected ${provider} calendar details`);

  const authHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // If access token looks like a managed user token (JWT), use it as Bearer
  if (accessToken && accessToken.includes('.')) {
    authHeaders['Authorization'] = `Bearer ${accessToken}`;
  } else if (CALCOM_JWT_TOKEN) {
    // Otherwise, try using the client secret as an API key
    const apiKey = CALCOM_JWT_TOKEN.startsWith('cal_') ? CALCOM_JWT_TOKEN : `cal_${CALCOM_JWT_TOKEN}`;
    authHeaders['Authorization'] = `Bearer ${apiKey}`;
  } else {
    throw new Error('No valid authentication token available for Cal.com API');
  }

  const response = await fetch(`${CALCOM_API_BASE}/calendars`, {
    method: 'GET',
    headers: authHeaders,
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Cal.com calendars fetch error:`, response.status, errorText);
    throw new Error(`Failed to get calendar details: ${errorText}`);
  }

  const data = await response.json();
  console.log(`Connected calendars data:`, data);

  // Look for the calendar that matches the provider
  // Cal.com returns calendars under data.connectedCalendars
  const connectedCalendars = data.data?.connectedCalendars || [];

  const providerCalendar = connectedCalendars.find((cal: any) => {
    const integrationName = cal.integration?.type ||
                           cal.integration?.name ||
                           cal.integration?.slug ||
                           cal.integration?.title ||
                           (typeof cal.integration === 'string' ? cal.integration : '');

    if (typeof integrationName === 'string') {
      return integrationName.toLowerCase().includes(provider.toLowerCase()) ||
             (provider === 'office365' && integrationName.toLowerCase().includes('outlook')) ||
             (provider === 'office365' && integrationName.toLowerCase().includes('office365'));
    }
    return false;
  });

  console.log(`Found ${provider} calendar:`, providerCalendar);

  if (providerCalendar) {
    // Extract email from the calendar structure
    const email = providerCalendar.primary?.email ||
                 providerCalendar.email ||
                 providerCalendar.primaryEmail ||
                 providerCalendar.user?.email ||
                 (providerCalendar.calendars && providerCalendar.calendars[0]?.email);

    const name = providerCalendar.primary?.name ||
                providerCalendar.name ||
                providerCalendar.displayName ||
                providerCalendar.summary ||
                providerCalendar.integration?.title;

    return {
      email,
      name,
      calendars: [providerCalendar]
    };
  }

  return { calendars: [] };
}

export async function revokeGoogleOAuthToken(accessToken: string): Promise<void> {
  console.log('Revoking Google OAuth token...');

  try {
    const response = await fetch('https://oauth2.googleapis.com/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `token=${encodeURIComponent(accessToken)}`,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Google OAuth token revocation error:', response.status, errorText);
      throw new Error(`Failed to revoke Google OAuth token: ${errorText}`);
    }

    console.log('Google OAuth token revoked successfully');
  } catch (error) {
    console.error('Error revoking Google OAuth token:', error);
    throw error;
  }
}

export async function disconnectCalcomCalendar(
  provider: 'google' | 'office365' | 'apple',
  managedUserId: string,
  accessToken: string
): Promise<void> {
  console.log(`Disconnecting ${provider} calendar for managed user:`, managedUserId);

  try {
    // First, get all calendars to find the credential ID for this provider
    console.log('Fetching calendars to find credential ID for', provider);
    const calendarsResponse = await fetch(`${CALCOM_API_BASE}/calendars`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!calendarsResponse.ok) {
      const errorText = await calendarsResponse.text();
      console.error('Failed to fetch calendars:', calendarsResponse.status, errorText);
      throw new Error(`Failed to fetch calendars: ${errorText}`);
    }

    const calendarsData = await calendarsResponse.json();
    console.log('Full calendars response:', calendarsData);
    console.log('calendarsData.data type:', typeof calendarsData.data);
    console.log('calendarsData.data value:', calendarsData.data);
    console.log('Is calendarsData.data an array?', Array.isArray(calendarsData.data));

    // Handle different possible response structures
    let calendars = [];

    if (Array.isArray(calendarsData.data)) {
      calendars = calendarsData.data;
    } else if (Array.isArray(calendarsData)) {
      calendars = calendarsData;
    } else if (calendarsData.data && typeof calendarsData.data === 'object') {
      // Sometimes the data might be an object with calendar arrays inside
      console.log('Data is an object, checking properties:', Object.keys(calendarsData.data));
      const dataKeys = Object.keys(calendarsData.data);
      // Look for arrays within the data object
      for (const key of dataKeys) {
        if (Array.isArray(calendarsData.data[key])) {
          console.log(`Found array in data.${key}:`, calendarsData.data[key]);
          calendars = calendarsData.data[key];
          break;
        }
      }
    }

    console.log('Final parsed calendars array:', calendars, 'length:', calendars.length);

    if (!Array.isArray(calendars) || calendars.length === 0) {
      console.log(`No calendars found or calendars is not an array - already disconnected or never connected`);
      return;
    }

    const targetCalendar = calendars.find((cal: any) => {
      console.log('Checking calendar:', cal);
      console.log('Integration object:', cal.integration);

      // Check different possible integration field formats
      const integrationName = cal.integration?.type ||
                             cal.integration?.name ||
                             cal.integration?.slug ||
                             cal.integration?.title ||
                             (typeof cal.integration === 'string' ? cal.integration : '');

      console.log('Integration name extracted:', integrationName);

      if (typeof integrationName === 'string') {
        const matches = integrationName.toLowerCase().includes(provider.toLowerCase());
        console.log(`Checking if "${integrationName}" includes "${provider}": ${matches}`);
        return matches;
      }

      return false;
    });

    if (!targetCalendar) {
      console.log(`${provider} calendar credentials not found - already disconnected or never connected`);
      return; // Consider this success since the goal is to disconnect
    }

    const credentialId = targetCalendar.credentialId || targetCalendar.id;
    console.log(`Found credential ID for ${provider}:`, credentialId);

    // Now disconnect using the correct endpoint and credential ID
    const response = await fetch(`${CALCOM_API_BASE}/calendars/${credentialId}/disconnect`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: credentialId,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();

      // If credentials are not found (404), it means the calendar is already disconnected
      if (response.status === 404) {
        console.log(`${provider} calendar credentials not found - already disconnected or never connected`);
        return; // Don't throw an error, this is expected
      }

      console.error(`Cal.com ${provider} calendar disconnect error:`, response.status, errorText);
      throw new Error(`Failed to disconnect ${provider} calendar: ${errorText}`);
    }

    console.log(`${provider} calendar disconnected successfully from Cal.com`);
  } catch (error) {
    console.error(`Error during ${provider} calendar disconnect:`, error);
    // Don't throw - treat disconnect errors as non-fatal
    console.log(`${provider} calendar credentials not found - already disconnected or never connected`);
  }
}

export async function refreshCalcomManagedUserToken(
  managedUserId: string,
  refreshToken: string
): Promise<{ accessToken: string; refreshToken: string }> {
  console.log('Refreshing Cal.com managed user token for:', managedUserId);

  const response = await fetch(`${CALCOM_API_BASE}/oauth-clients/${CALCOM_CLIENT_ID}/users/${managedUserId}/refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cal-secret-key': CALCOM_JWT_TOKEN!,
    },
    body: JSON.stringify({
      refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Cal.com token refresh error:', response.status, errorText);
    throw new Error(`Failed to refresh Cal.com token: ${errorText}`);
  }

  const data = await response.json();
  console.log('Cal.com token refreshed successfully');

  const newAccessToken = data.data?.accessToken || data.accessToken;
  const newRefreshToken = data.data?.refreshToken || data.refreshToken;

  if (!newAccessToken || !newRefreshToken) {
    console.error('Failed to extract tokens from refresh response:', data);
    throw new Error('Cal.com API did not return valid refreshed tokens');
  }

  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
  };
}

export async function forceRefreshCalcomManagedUserTokens(
  managedUserId: string
): Promise<{ accessToken: string; refreshToken: string }> {
  console.log('Force refreshing Cal.com managed user tokens for:', managedUserId);

  const response = await fetch(`${CALCOM_API_BASE}/oauth-clients/${CALCOM_CLIENT_ID}/users/${managedUserId}/force-refresh`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-cal-secret-key': CALCOM_JWT_TOKEN!,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Cal.com force refresh error:', response.status, errorText);
    throw new Error(`Failed to force refresh Cal.com tokens: ${errorText}`);
  }

  const data = await response.json();
  console.log('Cal.com tokens force refreshed successfully');

  const accessToken = data.data?.accessToken || data.accessToken;
  const refreshToken = data.data?.refreshToken || data.refreshToken;

  if (!accessToken || !refreshToken) {
    console.error('Failed to extract tokens from force refresh response:', data);
    throw new Error('Cal.com API did not return valid tokens');
  }

  return {
    accessToken,
    refreshToken,
  };
}

export async function completeCalendarCleanup(
  provider: 'google' | 'office365' | 'apple',
  managedUserId: string,
  accessToken: string
): Promise<void> {
  console.log(`Starting complete cleanup for ${provider} calendar...`);

  try {
    // 1. Disconnect calendar from Cal.com
    try {
      await disconnectCalcomCalendar(provider, managedUserId, accessToken);
    } catch (error) {
      console.error('Failed to disconnect from Cal.com:', error);
      // Don't fail the whole process if this fails
    }

    // 2. Revoke OAuth tokens (only for Google currently)
    if (provider === 'google') {
      try {
        await revokeGoogleOAuthToken(accessToken);
      } catch (error) {
        console.error('Failed to revoke Google OAuth token:', error);
        // Don't fail the whole process if this fails
      }
    }

    console.log(`Complete cleanup finished for ${provider} calendar`);
  } catch (error) {
    console.error(`Error during ${provider} calendar cleanup:`, error);
    throw error;
  }
}