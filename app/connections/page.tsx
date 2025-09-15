'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/contexts/AuthContext';
import Link from 'next/link';
import LoadingAnimation from '@/app/components/ui/LoadingAnimation';
import { Heading, Text } from '@/app/components/ui/Typography';

export default function ConnectionsPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [connections, setConnections] = useState([]);
  const [loadingConnections, setLoadingConnections] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/');
    } else if (user) {
      loadConnections();
    }
  }, [user, loading, router]);

  const loadConnections = async () => {
    try {
      // TODO: Implement actual connections loading
      // For now, simulate empty connections
      await new Promise(resolve => setTimeout(resolve, 500));
      setConnections([]);
    } catch (error) {
      console.error('Error loading connections:', error);
    } finally {
      setLoadingConnections(false);
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
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <Heading as="h1">Your Connections</Heading>
          </div>
        </div>

        {loadingConnections ? (
          <div className="flex items-center justify-center py-12">
            <LoadingAnimation size="sm" />
          </div>
        ) : connections.length === 0 ? (
          // Empty state
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <Heading as="h3" className="mb-2">No connections yet</Heading>
            <Text variant="subdued" className="text-gray-600 mb-6">
              Share your Cal Connect link with others to start scheduling meetings together.
            </Text>
            <Link
              href="/"
              className="inline-flex items-center px-4 py-2 gradient-primary text-white font-medium rounded-lg transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Share Your Link
            </Link>
          </div>
        ) : (
          // Connections list (when implemented)
          <div className="space-y-4">
            {/* Future: List of connections */}
          </div>
        )}
      </div>
    </div>
  );
}