'use client';

import { useAuth } from '@/app/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import SignInView from '@/app/components/views/SignInView';
import CalConnectView from '@/app/components/views/CalConnectView';
import LoadingAnimation from '@/app/components/ui/LoadingAnimation';

export default function Home() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user && !loading) {
      // Check if user needs onboarding
      const needsOnboarding = !user.onboardingCompleted;

      if (needsOnboarding) {
        console.log('User needs onboarding, redirecting...');
        router.replace('/onboarding');
      }
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center ">
        <LoadingAnimation />
      </div>
    );
  }

  // Conditionally render based on authentication state
  return user ? <CalConnectView /> : <SignInView />;
}