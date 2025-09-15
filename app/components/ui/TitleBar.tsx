'use client';

import { useRouter } from 'next/navigation';

interface TitleBarProps {
  title: string;
  onBack?: () => void;
}

export default function TitleBar({ title, onBack }: TitleBarProps) {
  const router = useRouter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.push('/');
    }
  };

  return (
    <div className="mb-6 flex items-center">
      <button
        onClick={handleBack}
        className="mr-4 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
      </button>
      <h1 className="text-2xl font-bold text-center flex-1">{title}</h1>
      <div className="w-6"></div> {/* Spacer for centering */}
    </div>
  );
}