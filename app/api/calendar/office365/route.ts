import { NextRequest, NextResponse } from 'next/server';
import { saveCalendarCredentials } from '@/app/lib/calcom';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      console.error('Office365 OAuth error:', error);
      return NextResponse.redirect(new URL('/oauth-callback?error=office365_oauth_failed', request.url));
    }

    // For Cal.com managed users, the OAuth flow is handled internally
    // When we get here without a code, it usually means the OAuth was processed by Cal.com
    if (!code) {
      console.log('No authorization code received - Cal.com likely processed OAuth internally');
      return NextResponse.redirect(new URL('/oauth-callback?calendar_oauth_completed=true', request.url));
    }

    // Save Office365 Calendar credentials to Cal.com
    await saveCalendarCredentials('office365', code, state || '');

    console.log('Office365 OAuth credentials saved successfully to Cal.com');

    // Redirect to OAuth callback handler which will determine correct destination
    return NextResponse.redirect(new URL('/oauth-callback?success=true', request.url));

  } catch (error) {
    console.error('Office365 OAuth callback error:', error);
    return NextResponse.redirect(new URL('/oauth-callback?error=callback_error', request.url));
  }
}