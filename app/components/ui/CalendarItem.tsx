'use client';

import { useState } from 'react';
import { deleteCalendar } from '@/app/lib/firebase-db';
import { completeCalendarCleanup } from '@/app/lib/calcom';
import type { Calendar, SchedulableHours } from '@/app/types';
import { Text } from './Typography';
import TimePicker from './TimePicker';

interface CalendarItemProps {
  calendar: Calendar;
  onUpdate: (calendar: Calendar) => void;
  onDelete: (calendarId: string) => void;
  onCategoryChange?: (calendarId: string, category: 'work' | 'personal') => void;
  onDefaultToggle?: (calendarId: string) => void;
  onTimeChange?: (calendarId: string, day: keyof SchedulableHours, slotIndex: number, field: 'start' | 'end', value: string) => void;
  onAddTimeSlot?: (calendarId: string, day: keyof SchedulableHours) => void;
  onRemoveTimeSlot?: (calendarId: string, day: keyof SchedulableHours, slotIndex: number) => void;
  showSettings?: boolean;
  initialExpanded?: boolean;
  isExpanded?: boolean;
  onToggleExpanded?: (calendarId: string) => void;
}

export default function CalendarItem({
  calendar,
  onUpdate,
  onDelete,
  onCategoryChange,
  onDefaultToggle,
  onTimeChange,
  onAddTimeSlot,
  onRemoveTimeSlot,
  showSettings = true,
  initialExpanded = false,
  isExpanded: externalExpanded,
  onToggleExpanded
}: CalendarItemProps) {
  const [internalExpanded, setInternalExpanded] = useState(initialExpanded);
  const isExpanded = externalExpanded !== undefined ? externalExpanded : internalExpanded;

  const handleCategoryChange = (category: 'work' | 'personal') => {
    if (onCategoryChange) {
      onCategoryChange(calendar.id, category);
    } else {
      onUpdate({ ...calendar, category });
    }
  };

  const handleDefaultToggle = () => {
    // Only allow selection if the calendar is not already default
    // This prevents deselection and ensures radio button behavior
    if (!calendar.isDefault) {
      if (onDefaultToggle) {
        onDefaultToggle(calendar.id);
      } else {
        onUpdate({ ...calendar, isDefault: true });
      }
    }
  };

  const handleTimeChange = (day: keyof SchedulableHours, slotIndex: number, field: 'start' | 'end', value: string) => {
    if (onTimeChange) {
      onTimeChange(calendar.id, day, slotIndex, field, value);
    } else {
      const updatedHours = { ...calendar.schedulableHours };
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
      onUpdate({ ...calendar, schedulableHours: updatedHours });
    }
  };

  const handleAddTimeSlot = (day: keyof SchedulableHours) => {
    if (onAddTimeSlot) {
      onAddTimeSlot(calendar.id, day);
    } else {
      const updatedHours = { ...calendar.schedulableHours };
      updatedHours[day] = [...updatedHours[day], { start: '09:00', end: '17:00' }];
      onUpdate({ ...calendar, schedulableHours: updatedHours });
    }
  };

  const handleRemoveTimeSlot = (day: keyof SchedulableHours, slotIndex: number) => {
    if (onRemoveTimeSlot) {
      onRemoveTimeSlot(calendar.id, day, slotIndex);
    } else {
      const updatedHours = { ...calendar.schedulableHours };
      updatedHours[day] = updatedHours[day].filter((_, index) => index !== slotIndex);
      onUpdate({ ...calendar, schedulableHours: updatedHours });
    }
  };

  const handleDisconnectCalendar = async () => {
    try {
      // Clean up Cal.com integrations and revoke OAuth tokens if available
      if (calendar.calcomIntegrationId && calendar.connectedProviders?.length) {
        for (const provider of calendar.connectedProviders) {
          try {
            // Note: We don't have the access token stored locally, so we'll only be able to
            // clean up what we can. The access token would need to be stored in the database
            // for complete cleanup.
            console.log(`Attempting to clean up ${provider} calendar integration...`);
            // For now, just log that we would clean up here
            // await completeCalendarCleanup(provider, calendar.calcomIntegrationId, accessToken);
          } catch (cleanupError) {
            console.error(`Failed to cleanup ${provider} integration:`, cleanupError);
            // Don't block the local deletion
          }
        }
      }

      // Delete from local database
      await deleteCalendar(calendar.id);
      onDelete(calendar.id);
      // Calendar disconnected successfully - no alert needed
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      alert('Failed to disconnect calendar. Please try again.');
    }
  };

  const getProviderLink = (provider: string) => {
    switch (provider) {
      case 'google':
        return 'https://calendar.google.com';
      case 'office365':
        return 'https://outlook.live.com/calendar';
      case 'icloud':
        return 'https://www.icloud.com/calendar';
      default:
        return 'https://app.cal.com/event-types';
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'google':
        return 'Google Calendar';
      case 'office365':
        return 'Outlook Calendar';
      case 'icloud':
        return 'iCloud Calendar';
      default:
        return 'Cal.com';
    }
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'google':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24">
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
        );
      case 'office365':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24">
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
        );
      case 'icloud':
        return (
          <svg className="w-8 h-8" viewBox="0 0 24 24">
            <path
              fill="#000000"
              d="M18.71 19.5C17.88 20.74 17 21.95 15.66 21.97C14.32 22 13.89 21.18 12.37 21.18C10.84 21.18 10.37 21.95 9.09997 22C7.78997 22.05 6.79997 20.68 5.95997 19.47C4.24997 17 2.93997 12.45 4.69997 9.39C5.56997 7.87 7.12997 6.91 8.81997 6.88C10.1 6.86 11.32 7.75 12.11 7.75C12.89 7.75 14.37 6.68 15.92 6.84C16.57 6.87 18.39 7.1 19.56 8.82C19.47 8.88 17.39 10.1 17.41 12.63C17.44 15.65 20.06 16.66 20.09 16.67C20.06 16.74 19.67 18.11 18.71 19.5ZM13 3.5C13.73 2.67 14.94 2.04 15.94 2C16.07 3.17 15.6 4.35 14.9 5.19C14.21 6.04 13.07 6.7 11.95 6.61C11.8 5.46 12.36 4.26 13 3.5Z"
            />
          </svg>
        );
      default:
        return (
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  // Get the primary provider for the icon (first connected provider, or fallback)
  // TEMPORARY: If no connectedProviders but has calcomIntegrationId, assume it's Google for now
  // This handles existing calendars that were created before connectedProviders tracking
  let primaryProvider = 'calcom';
  if (calendar.connectedProviders && calendar.connectedProviders.length > 0) {
    primaryProvider = calendar.connectedProviders[0];
  } else if (calendar.calcomIntegrationId && calendar.calcomIntegrationId !== 'undefined') {
    // Assume Google for existing connected calendars that don't have connectedProviders tracked
    primaryProvider = 'google';
  }


  return (
    <div className="bg-white rounded-xl shadow-sm">
      {/* Calendar Header */}
      <button
        onClick={() => {
          if (showSettings) {
            if (onToggleExpanded) {
              onToggleExpanded(calendar.id);
            } else {
              setInternalExpanded(!internalExpanded);
            }
          }
        }}
        className={`w-full p-4 flex items-center justify-between transition-colors ${showSettings ? 'hover:bg-gray-50' : ''}`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${primaryProvider === 'calcom' ? 'gradient-icon' : 'bg-white border border-gray-200'}`}>
            {getProviderIcon(primaryProvider)}
          </div>
          <div className="text-left flex-1">
            <a
              href={primaryProvider !== 'calcom' ? getProviderLink(primaryProvider) : 'https://app.cal.com/event-types'}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:gradient-text transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              <Text variant="base" as="span">{calendar.email}</Text>
            </a>
            {/* Compact Work/Personal Toggle */}
            <div className="mt-2">
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleCategoryChange(calendar.category === 'personal' ? 'work' : 'personal');
                }}
                className="inline-flex items-center bg-gray-100 rounded-full cursor-pointer hover:bg-gray-200 transition-colors"
              >
                <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium transition-all w-24 justify-center ${
                  calendar.category === 'personal'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:gradient-text'
                }`}>
                  Personal
                </div>
                <div className={`flex items-center px-2 py-1 rounded-full text-xs font-medium transition-all w-24 justify-center ${
                  calendar.category === 'work'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:gradient-text'
                }`}>
                  Work
                </div>
              </div>
            </div>
          </div>
        </div>
{showSettings ? (
          <svg
            className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        ) : (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleDefaultToggle();
            }}
            className="w-6 h-6 rounded-full border-2 transition-colors flex items-center justify-center hover:scale-105 cursor-pointer"
            style={{
              borderColor: calendar.isDefault ? 'transparent' : '#D1D5DB',
              background: calendar.isDefault ? 'linear-gradient(135deg, #FF6B6B, #FF8E8E)' : 'transparent'
            }}
          >
            {calendar.isDefault && (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            )}
          </div>
        )}
      </button>

      {/* Calendar Settings (Expanded) */}
      {showSettings && isExpanded && (
        <div className="px-4 pb-6 border-t border-gray-100">
          {/* Default Toggle */}
          <div className="mt-4 flex items-center justify-between p-3 bg-gray-50 rounded-lg">
            <div>
              <Text variant="base">Default</Text>
              <Text variant="subdued">This calendar will be used for new meetings</Text>
            </div>
            <button
              onClick={handleDefaultToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                calendar.isDefault ? 'gradient-primary' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  calendar.isDefault ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* Available Hours Per Day */}
          <div className="mt-6">
            <div className="space-y-4">
              {(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const).map(day => (
                <div key={day} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-3">
                    <div className="capitalize">
                      <Text variant="base">{day}</Text>
                    </div>
                    <button
                      onClick={() => handleAddTimeSlot(day)}
                      className="px-2 py-1 bg-gray-100 rounded hover:bg-gray-200 transition-colors"
                    >
                      <Text variant="small" as="span">+ Add</Text>
                    </button>
                  </div>
                  <div className="space-y-2">
                    {calendar.schedulableHours[day]?.length > 0 ? (
                      calendar.schedulableHours[day]?.map((slot, slotIndex) => (
                        <div key={slotIndex} className="flex gap-2 items-center">
                          <TimePicker
                            value={slot.start}
                            onChange={(time) => handleTimeChange(day, slotIndex, 'start', time)}
                          />
                          <Text variant="subdued" as="span">to</Text>
                          <TimePicker
                            value={slot.end}
                            onChange={(time) => handleTimeChange(day, slotIndex, 'end', time)}
                          />
                          <button
                            onClick={() => handleRemoveTimeSlot(day, slotIndex)}
                            className="hover:bg-red-50 rounded transition-colors ml-auto"
                          >
                            <Text variant="danger" as="span" className="text-xs">Remove</Text>
                          </button>
                        </div>
                      ))
                    ) : (
                      <Text variant="subdued" className="italic">No available hours</Text>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Disconnect Calendar */}
          <div className="mt-6">
            <button
              onClick={handleDisconnectCalendar}
              className="w-full py-3 px-4 bg-red-50 border-2 border-red-200 rounded-lg text-red-700 font-medium hover:bg-red-100 hover:border-red-300 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v3M4 7h16" />
              </svg>
              Disconnect Calendar
            </button>
            <Text variant="subdued" className="mt-2 text-center">
              This will permanently remove this calendar connection from your account.
            </Text>
          </div>
        </div>
      )}
    </div>
  );
}