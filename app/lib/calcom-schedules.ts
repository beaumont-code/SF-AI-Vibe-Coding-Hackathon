// Cal.com schedule management functions for availability hours sync

const CALCOM_API_BASE = process.env.CAL_API_URL || 'https://api.cal.com/v2';

interface CalcomScheduleAvailability {
  days: string[];
  startTime: string;
  endTime: string;
}

interface CalcomSchedule {
  id: number;
  name: string;
  timeZone: string;
  availability: CalcomScheduleAvailability[];
  isDefault: boolean;
}

// Convert our SchedulableHours format to Cal.com availability format
const convertToCalcomAvailability = (schedulableHours: any): CalcomScheduleAvailability[] => {
  const availability: CalcomScheduleAvailability[] = [];

  // Map our day names to Cal.com format
  const dayMapping: Record<string, string> = {
    'monday': 'Monday',
    'tuesday': 'Tuesday',
    'wednesday': 'Wednesday',
    'thursday': 'Thursday',
    'friday': 'Friday',
    'saturday': 'Saturday',
    'sunday': 'Sunday'
  };

  // Group time windows by start/end time to reduce redundancy
  const timeSlotMap: Record<string, string[]> = {};

  Object.entries(schedulableHours).forEach(([day, timeWindows]: [string, any]) => {
    if (!Array.isArray(timeWindows)) return;

    timeWindows.forEach((window: any) => {
      const timeKey = `${window.start}-${window.end}`;
      if (!timeSlotMap[timeKey]) {
        timeSlotMap[timeKey] = [];
      }
      timeSlotMap[timeKey].push(dayMapping[day]);
    });
  });

  // Convert grouped time slots to Cal.com format
  Object.entries(timeSlotMap).forEach(([timeKey, days]) => {
    const [startTime, endTime] = timeKey.split('-');
    availability.push({
      days: days.sort(), // Sort for consistency
      startTime,
      endTime
    });
  });

  return availability;
};

// Smart wrapper that decides whether to create or update
export const syncAvailableHoursToCalcom = async (
  userId: string,
  schedulableHours: any,
  timezone: string,
  managedUserId: string,
  accessToken: string,
  calendarScheduleId?: string
): Promise<string> => {
  console.log('Syncing available hours to Cal.com for user:', userId);

  // Use the calendar-specific schedule ID if provided, otherwise fall back to user's schedule ID
  let existingScheduleId = calendarScheduleId;

  if (!existingScheduleId) {
    // Import db functions dynamically to avoid circular imports
    const { getUserById } = await import('@/app/lib/firebase-db');
    const user = await getUserById(userId);
    existingScheduleId = user?.calcomScheduleId;
  }

  console.log('Using schedule ID:', existingScheduleId, '(from calendar:', !!calendarScheduleId, ')');

  if (existingScheduleId) {
    console.log('Updating existing Cal.com schedule:', existingScheduleId);
    console.log('Update schedule - managedUserId:', managedUserId);
    console.log('Update schedule - access token (first 50 chars):', accessToken.substring(0, 50) + '...');

    // First verify the schedule exists by trying to get it
    console.log('Verifying schedule exists before updating...');
    const existingSchedule = await getCalcomSchedule(existingScheduleId, accessToken);
    if (!existingSchedule) {
      console.log('Schedule verification failed - schedule does not exist, creating new one instead');
      const newScheduleId = await createCalcomAvailabilitySchedule(schedulableHours, timezone, managedUserId, accessToken);
      console.log('New schedule created:', newScheduleId, '- caller should update calendar record');
      return newScheduleId;
    }
    console.log('Schedule verification passed, proceeding with update');

    try {
      await updateCalcomAvailabilitySchedule(existingScheduleId, schedulableHours, timezone, managedUserId, accessToken);
      return existingScheduleId;
    } catch (error: any) {
      // If schedule doesn't exist (404), create a new one
      if (error.message.includes('404') || error.message.includes('Not Found')) {
        console.log('Schedule no longer exists, creating new schedule instead');
        const newScheduleId = await createCalcomAvailabilitySchedule(schedulableHours, timezone, managedUserId, accessToken);

        // Note: The caller should update the calendar record with the new schedule ID
        // We can't do it here because we don't have the calendar ID
        console.log('New schedule created:', newScheduleId, '- caller should update calendar record');

        return newScheduleId;
      }
      // Re-throw other errors
      throw error;
    }
  } else {
    console.log('Creating new Cal.com schedule for managed user');
    const scheduleId = await createCalcomAvailabilitySchedule(schedulableHours, timezone, managedUserId, accessToken);

    // Note: The caller should update the calendar record with the new schedule ID
    // We can't do it here because we don't have the calendar ID
    console.log('New schedule created:', scheduleId, '- caller should update calendar record');

    return scheduleId;
  }
};

// Create new availability schedule in Cal.com
export const createCalcomAvailabilitySchedule = async (
  schedulableHours: any,
  timezone: string,
  managedUserId: string,
  accessToken: string
): Promise<string> => {
  console.log('Creating Cal.com availability schedule');

  const availability = convertToCalcomAvailability(schedulableHours);
  console.log('Converted availability:', availability);
  console.log('Schedule payload:', {
    name: 'Cal-Connect Available Hours',
    timeZone: timezone,
    availability,
    isDefault: true
  });

  const response = await fetch(`${CALCOM_API_BASE}/schedules`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Cal-Connect Available Hours',
      timeZone: timezone,
      availability,
      isDefault: true // Make this the default schedule
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Cal.com create schedule error:', response.status, errorText);
    throw new Error(`Failed to create Cal.com schedule: ${errorText}`);
  }

  const data = await response.json();
  console.log('Cal.com schedule creation response:', data);
  const scheduleId = data.data?.id?.toString() || data.id?.toString();

  if (!scheduleId) {
    console.error('Failed to extract schedule ID from Cal.com response:', data);
    throw new Error('Cal.com API did not return a valid schedule ID');
  }

  console.log('Cal.com schedule created successfully:', scheduleId);
  return scheduleId;
};

// Update existing availability schedule in Cal.com
export const updateCalcomAvailabilitySchedule = async (
  scheduleId: string,
  schedulableHours: any,
  timezone: string,
  managedUserId: string,
  accessToken: string
): Promise<void> => {
  console.log('Updating Cal.com availability schedule:', scheduleId, '(using PATCH method)');

  const availability = convertToCalcomAvailability(schedulableHours);

  const response = await fetch(`${CALCOM_API_BASE}/schedules/${scheduleId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      name: 'Cal-Connect Available Hours',
      timeZone: timezone,
      availability,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Cal.com update schedule error (PATCH):', response.status, errorText);
    throw new Error(`Failed to update Cal.com schedule (PATCH): ${errorText}`);
  }

  console.log('Cal.com schedule updated successfully');
};

// Get mutual availability between two Cal.com managed users
export const getCalcomMutualAvailability = async (
  user1ManagedId: string,
  user2ManagedId: string,
  startDate: string, // ISO date string
  endDate: string,   // ISO date string
  duration: number,  // in minutes
  timezone: string = 'America/Los_Angeles'
): Promise<Array<{ start: string; end: string }>> => {
  console.log('Getting Cal.com mutual availability:', { user1ManagedId, user2ManagedId, duration });

  // Use Cal.com's mutual availability endpoint
  const params = new URLSearchParams({
    usernames: `${user1ManagedId},${user2ManagedId}`,
    start: startDate,
    end: endDate,
    duration: duration.toString(),
    timeZone: timezone,
    format: 'range' // Get start and end times
  });

  const response = await fetch(`${CALCOM_API_BASE}/slots?${params}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${process.env.NEXT_PUBLIC_CALCOM_JWT_TOKEN}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Cal.com mutual availability error:', response.status, errorText);
    throw new Error(`Failed to get Cal.com mutual availability: ${errorText}`);
  }

  const data = await response.json();
  console.log('Cal.com mutual availability response:', data);

  // Parse the response - it's typically a map of dates to slot arrays
  const slots: Array<{ start: string; end: string }> = [];

  if (data.data && typeof data.data === 'object') {
    Object.values(data.data).forEach((dateSlots: any) => {
      if (Array.isArray(dateSlots)) {
        dateSlots.forEach((slot: any) => {
          if (slot.start && slot.end) {
            slots.push({
              start: slot.start,
              end: slot.end
            });
          }
        });
      }
    });
  }

  console.log(`Found ${slots.length} mutual availability slots`);
  return slots;
};

// Get full schedule from Cal.com (for debugging/admin purposes)
export const getCalcomSchedule = async (
  scheduleId: string,
  accessToken: string
): Promise<CalcomSchedule | null> => {
  console.log('Getting Cal.com schedule for debugging:', scheduleId);

  const response = await fetch(`${CALCOM_API_BASE}/schedules/${scheduleId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Cal.com get schedule error:', response.status, errorText);
    return null;
  }

  const data = await response.json();
  console.log('Cal.com schedule retrieved:', data);

  return data.data || data;
};

// ============================================================================
// ENHANCED AVAILABILITY FUNCTIONS (moved from calcom-availability.ts)
// ============================================================================

// Get mutual availability with event template logic and business rules
export const getCalcomBasedAvailability = async (
  user1CalcomId: string,
  user2CalcomId: string,
  eventTemplate: any, // EventTemplate type
  customTimeWindow?: { start: string; end: string }
): Promise<{ start: string; end: string } | null> => {
  try {
    console.log('Getting Cal.com based availability:', {
      user1CalcomId,
      user2CalcomId,
      eventTemplate: eventTemplate.id,
      customTimeWindow
    });

    // Calculate the date range to search (next 14 days)
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 14);

    // Calculate total duration including travel buffers for Cal.com API call
    // Import dynamically to avoid circular imports
    const { calculateTotalDuration, getEventTimeFromSlotWithBuffer } = await import('./event-templates');
    const totalDurationNeeded = calculateTotalDuration(
      eventTemplate.duration,
      eventTemplate.travelBuffer
    );

    console.log(`Requesting ${totalDurationNeeded} min slots from Cal.com (${eventTemplate.duration} min event + buffers)`);

    // Get mutual availability from Cal.com
    const calcomSlots = await getCalcomMutualAvailability(
      user1CalcomId,
      user2CalcomId,
      startDate.toISOString(),
      endDate.toISOString(),
      totalDurationNeeded,
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );

    console.log(`Cal.com returned ${calcomSlots.length} mutual slots`);

    if (!calcomSlots.length) {
      console.log('No mutual availability found in Cal.com');
      return null;
    }

    // Apply our business logic on top of Cal.com results
    const filteredSlot = await applyEventTemplateLogic(calcomSlots, eventTemplate, customTimeWindow);

    if (!filteredSlot) {
      console.log('No slots match event template criteria after filtering');
      return null;
    }

    // Convert slot time to actual event time (excluding travel buffers)
    const eventTimes = getEventTimeFromSlotWithBuffer(
      new Date(filteredSlot.start),
      eventTemplate.duration,
      eventTemplate.travelBuffer
    );

    console.log('Final slot selected:', {
      originalSlot: filteredSlot,
      eventTime: { start: eventTimes.start, end: eventTimes.end }
    });

    return {
      start: eventTimes.start.toISOString(),
      end: eventTimes.end.toISOString()
    };

  } catch (error) {
    console.error('Error getting Cal.com based availability:', error);
    throw error;
  }
};

// Apply event template logic to filter Cal.com slots
const applyEventTemplateLogic = async (
  calcomSlots: Array<{ start: string; end: string }>,
  eventTemplate: any,
  customTimeWindow?: { start: string; end: string }
): Promise<{ start: string; end: string } | null> => {

  console.log(`Applying event template logic for ${eventTemplate.intent}`);

  // Helper to convert "HH:MM" to minutes since midnight
  const timeToMinutes = (timeStr: string): number => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Get time preferences from event template or custom override
  const timePreference = customTimeWindow || eventTemplate.preferredTimeWindow;

  let preferredStart = 0;
  let preferredEnd = 24 * 60; // Default: all day

  if (timePreference) {
    preferredStart = timeToMinutes(timePreference.start);
    preferredEnd = timeToMinutes(timePreference.end);
    console.log(`Filtering slots to preferred time window: ${timePreference.start} - ${timePreference.end}`);
  }

  // Filter slots by preferred time window and ensure they're at least 1 hour in the future
  const now = new Date();
  const minimumFutureTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now

  const filteredSlots = calcomSlots.filter(slot => {
    const slotStart = new Date(slot.start);

    // Must be at least 1 hour in the future
    if (slotStart < minimumFutureTime) {
      return false;
    }

    // Check if slot falls within preferred time window
    if (timePreference) {
      const slotStartMinutes = slotStart.getHours() * 60 + slotStart.getMinutes();
      if (slotStartMinutes < preferredStart || slotStartMinutes > preferredEnd) {
        return false;
      }
    }

    return true;
  });

  console.log(`${filteredSlots.length} slots remain after filtering`);

  if (!filteredSlots.length) {
    return null;
  }

  // Sort by earliest time and return first match
  filteredSlots.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  // Ensure slot is on 30-minute boundary
  const selectedSlot = filteredSlots[0];
  const slotStart = new Date(selectedSlot.start);

  // Round to next 30-minute interval if needed
  const minutes = slotStart.getMinutes();
  if (minutes % 30 !== 0) {
    const roundedMinutes = Math.ceil(minutes / 30) * 30;
    slotStart.setMinutes(roundedMinutes, 0, 0);

    // Recalculate end time
    const duration = new Date(selectedSlot.end).getTime() - new Date(selectedSlot.start).getTime();
    const slotEnd = new Date(slotStart.getTime() + duration);

    return {
      start: slotStart.toISOString(),
      end: slotEnd.toISOString()
    };
  }

  return selectedSlot;
};