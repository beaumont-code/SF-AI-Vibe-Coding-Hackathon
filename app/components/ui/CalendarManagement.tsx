'use client';

import CalendarItem from './CalendarItem';
import CalendarProviderButtons from './CalendarProviderButtons';
import type { Calendar, SchedulableHours } from '@/app/types';

interface CalendarManagementProps {
  calendars: Calendar[];
  setCalendars: (calendars: Calendar[]) => void;
  user: {
    id: string;
    email: string;
    displayName: string;
  };
  onCalendarCreated: (calendarId: string, managedUserId: string, accessToken: string, refreshToken: string, defaultScheduleId?: string) => Promise<string>;
  isAddingCalendar?: boolean;

  // Variant: 'simple' for onboarding, 'detailed' for edit profile
  variant?: 'simple' | 'detailed';

  // Detailed variant props (only needed when variant='detailed')
  expandedCalendar?: string | null;
  onToggleExpanded?: (calendarId: string) => void;
  onCalendarUpdate?: (updatedCalendar: Calendar) => void;
  onCalendarDelete?: (calendarId: string) => void;
  onCategoryChange?: (calendarId: string, category: 'work' | 'personal') => void;
  onDefaultToggle?: (calendarId: string) => void;
  onTimeChange?: (calendarId: string, day: keyof SchedulableHours, slotIndex: number, field: 'start' | 'end', value: string) => void;
  onAddTimeSlot?: (calendarId: string, day: keyof SchedulableHours) => void;
  onRemoveTimeSlot?: (calendarId: string, day: keyof SchedulableHours, slotIndex: number) => void;
}

export default function CalendarManagement({
  calendars,
  setCalendars,
  user,
  onCalendarCreated,
  isAddingCalendar = false,
  variant = 'simple',
  expandedCalendar,
  onToggleExpanded,
  onCalendarUpdate,
  onCalendarDelete,
  onCategoryChange,
  onDefaultToggle,
  onTimeChange,
  onAddTimeSlot,
  onRemoveTimeSlot
}: CalendarManagementProps) {

  // Simple variant update handler (for onboarding)
  const handleCalendarUpdate = (updatedCalendar: Calendar) => {
    if (onCalendarUpdate) {
      onCalendarUpdate(updatedCalendar);
    } else {
      setCalendars(calendars.map(cal => {
        if (cal.id === updatedCalendar.id) {
          // Handle category change with auto-default logic
          if (updatedCalendar.category !== cal.category) {
            const hasOtherDefault = calendars.some(c =>
              c.id !== updatedCalendar.id &&
              c.category === updatedCalendar.category &&
              c.isDefault
            );
            if (!hasOtherDefault) {
              updatedCalendar.isDefault = true;
            }
          }
          return updatedCalendar;
        }
        // Radio button behavior: If this calendar is being set as default, unset all others
        if (updatedCalendar.isDefault && cal.category === updatedCalendar.category) {
          return { ...cal, isDefault: false };
        }
        return cal;
      }));
    }
  };

  const handleCalendarDelete = (calendarId: string) => {
    if (onCalendarDelete) {
      onCalendarDelete(calendarId);
    } else {
      setCalendars(calendars.filter(cal => cal.id !== calendarId));
    }
  };

  return (
    <div className="space-y-6">
      {/* Connected Calendars Section */}
      {calendars.length > 0 && (
        <div className={variant === 'detailed' ? 'space-y-4' : 'space-y-3'}>
          {calendars.map((calendar) => (
            <CalendarItem
              key={calendar.id}
              calendar={calendar}
              onUpdate={handleCalendarUpdate}
              onDelete={handleCalendarDelete}
              onCategoryChange={onCategoryChange}
              onDefaultToggle={onDefaultToggle}
              onTimeChange={onTimeChange}
              onAddTimeSlot={onAddTimeSlot}
              onRemoveTimeSlot={onRemoveTimeSlot}
              showSettings={variant === 'detailed'}
              isExpanded={variant === 'detailed' ? expandedCalendar === calendar.id : undefined}
              onToggleExpanded={onToggleExpanded}
            />
          ))}
        </div>
      )}

      {/* Add Calendar Section */}
      <div>
        <CalendarProviderButtons
          user={user}
          onCalendarCreated={onCalendarCreated}
          disabled={isAddingCalendar}
        />
      </div>
    </div>
  );
}