'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import LoadingAnimation from '@/app/components/ui/LoadingAnimation';
import { Text } from '@/app/components/ui/Typography';

export default function OAuthCallbackPage() {
  const router = useRouter();

  useEffect(() => {
    const handleRedirect = () => {
      // Get OAuth completion parameters from URL
      const urlParams = new URLSearchParams(window.location.search);

      // Get origin page from session storage
      const originPage = sessionStorage.getItem('oauth-origin-page');
      console.log('OAuth callback handler - origin page:', originPage);

      // Default to edit-profile if no origin page is set
      const targetPage = originPage || '/edit-profile';

      // Preserve all query parameters for the redirect
      const redirectUrl = `${targetPage}?${urlParams.toString()}`;
      console.log('OAuth callback handler - redirecting to:', redirectUrl);

      // Redirect to the target page
      router.replace(redirectUrl);
    };

    // Small delay to ensure session storage is available
    setTimeout(handleRedirect, 100);
  }, [router]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center">
      <LoadingAnimation />
      <Text variant="base" className="mt-4">
        Completing calendar connection...
      </Text>
    </div>
  );
}