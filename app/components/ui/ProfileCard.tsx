'use client';

import { ReactNode } from 'react';
import type { User } from '@/app/types';
import { Heading, Text } from './Typography';

interface ProfileCardProps {
  user: User;
  showEditButton?: boolean;
  isEditingUsername?: boolean;
  username?: string;
  onUsernameChange?: (username: string) => void;
  onUsernameEdit?: () => void;
  actionButton?: ReactNode;
  onNameDoubleClick?: () => void;
}

export default function ProfileCard({
  user,
  showEditButton = false,
  isEditingUsername = false,
  username,
  onUsernameChange,
  onUsernameEdit,
  actionButton,
  onNameDoubleClick
}: ProfileCardProps) {
  const displayUsername = username || user.username;
  const location = user.location ? `${user.location.city}, ${user.location.region}` : null;

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <div className="flex flex-col items-center text-center">
        {/* Avatar */}
        <div className="mb-4">
          {user.photoURL ? (
            <img
              src={user.photoURL}
              alt={user.displayName}
              className="w-24 h-24 rounded-full"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = 'none';
                if (target.nextElementSibling) {
                  (target.nextElementSibling as HTMLElement).style.display = 'flex';
                }
              }}
            />
          ) : null}
          <div
            className="w-24 h-24 rounded-full gradient-icon flex items-center justify-center text-white text-2xl font-semibold"
            style={{ display: user.photoURL ? 'none' : 'flex' }}
          >
            {user.displayName?.[0] || 'U'}
          </div>
        </div>

        {/* User Info */}
        <div className="w-full">
          <Heading
            as="h1"
            onDoubleClick={onNameDoubleClick}
            className={onNameDoubleClick ? 'cursor-pointer select-none' : undefined}
          >
            {user.displayName}
          </Heading>

          {/* Username */}
          <div className="flex items-center justify-center gap-2 mt-1">
            {isEditingUsername && showEditButton ? (
              <input
                type="text"
                value={displayUsername}
                onChange={(e) => onUsernameChange?.(e.target.value.replace(/[^a-z0-9]/gi, ''))}
                className="border-b border-gray-300 focus:border-orange-500 outline-none text-xs text-gray-600"
                autoFocus
              />
            ) : (
              <Text as="span" variant="small">@{displayUsername}</Text>
            )}
            {showEditButton && (
              <button
                onClick={onUsernameEdit}
                className="gradient-link text-sm hover:gradient-text"
              >
                {isEditingUsername ? 'Save' : 'Edit'}
              </button>
            )}
          </div>

          {/* Location */}
          {location && (
            <div className="flex items-center justify-center gap-1 mt-3">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <Text as="span" variant="small">{location}</Text>
            </div>
          )}
        </div>
      </div>

      {/* Action Button */}
      {actionButton && (
        <div className="mt-4">
          {actionButton}
        </div>
      )}
    </div>
  );
}