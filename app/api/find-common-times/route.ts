import { NextRequest, NextResponse } from 'next/server';
import { getUserCalendars } from '@/app/lib/firebase-db';
import { getCalcomBasedAvailability } from '@/app/lib/calcom-schedules';
import { Calendar } from '@/app/types';

export async function POST(request: NextRequest) {
  try {
    const {
      user1Id,
      user2Id,
      constraints = {}
    } = await request.json();

    // Validate inputs
    if (!user1Id || !user2Id) {
      return NextResponse.json(
        { error: 'Missing required parameters: user1Id, user2Id' },
        { status: 400 }
      );
    }

    console.log('Find common times called with:', {
      user1Id,
      user2Id,
      constraints
    });

    // Find mutual availability using constraints
    const slots = await findMutualAvailability(user1Id, user2Id, constraints);

    return NextResponse.json({
      slots,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
  } catch (error) {
    console.error('Error finding common times:', error);
    return NextResponse.json(
      { error: 'Failed to find common times', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

interface AvailabilityConstraints {
  startDate?: string;
  endDate?: string;
  duration: number; // minutes
  travelBuffer?: { before: number; after: number }; // minutes
  timeWindow?: { start: string; end: string }; // "HH:MM" format
  avoidDays?: string[];
  preferredTime?: 'morning' | 'afternoon' | 'evening';
  location?: string;
}

async function findMutualAvailability(
  user1Id: string,
  user2Id: string,
  constraints: AvailabilityConstraints
): Promise<Array<{ start: string; end: string }>> {
  const {
    duration = 60,
    travelBuffer,
    timeWindow,
    avoidDays = [],
    preferredTime,
    startDate,
    endDate
  } = constraints;

  // Try Cal.com integration first, fallback to local calendar system
  let slots: Array<{ start: string; end: string }> = [];

  try {
    // Get users with Cal.com managed user IDs
    const { getUserById } = await import('@/app/lib/firebase-db');
    const [user1, user2] = await Promise.all([
      getUserById(user1Id),
      getUserById(user2Id)
    ]);

    const user1CalcomId = user1?.calcomIntegrationId;
    const user2CalcomId = user2?.calcomIntegrationId;

    console.log('=== CAL.COM API DEBUG ===');
    console.log('User Cal.com IDs:', { user1CalcomId, user2CalcomId });

    if (user1CalcomId && user2CalcomId) {
      console.log('✅ Using Cal.com integration for availability');

      // Create a temporary event template for Cal.com API
      const eventTemplate = {
        id: 'custom',
        title: 'Custom Meeting',
        name: 'Custom Meeting',
        duration,
        eventType: travelBuffer ? 'in-person' : 'virtual',
        intent: 'custom',
        travelBuffer: travelBuffer || { before: 0, after: 0 },
        preferredTimeWindow: timeWindow
      };

      const customTimeWindow = timeWindow ? {
        start: timeWindow.start,
        end: timeWindow.end
      } : undefined;

      const slot = await getCalcomBasedAvailability(
        user1CalcomId,
        user2CalcomId,
        eventTemplate,
        customTimeWindow
      );

      if (slot) {
        console.log('✅ Cal.com returned slot:', slot);
        slots = [slot];
      } else {
        console.log('❌ Cal.com returned no available slots');
      }
    } else {
      console.log('❌ Cal.com IDs not found - User1:', !!user1CalcomId, 'User2:', !!user2CalcomId);
      console.log('Falling back to local calendar system');
    }
    console.log('========================');
  } catch (calcomError) {
    console.warn('Cal.com integration failed, falling back to local calendar system:', calcomError);
  }

  // Fallback to local calendar system if Cal.com integration fails or unavailable
  if (slots.length === 0) {
    console.log('Using local calendar system for availability');
    let user1Calendars: Calendar[] = [];
    let user2Calendars: Calendar[] = [];

    try {
      // Get calendars for both users
      [user1Calendars, user2Calendars] = await Promise.all([
        getUserCalendars(user1Id),
        getUserCalendars(user2Id),
      ]);
      console.log('Successfully retrieved local calendars:', {
        user1Count: user1Calendars.length,
        user2Count: user2Calendars.length
      });
    } catch (calendarError) {
      console.warn('Failed to get calendars, using mock data:', calendarError);
      // Continue with empty calendars for mock suggestions
    }

    // Find available slots using local calendar system
    const localSlots = await findLocalAvailabilitySlots({
      user1Calendars,
      user2Calendars,
      constraints: {
        duration,
        travelBuffer,
        timeWindow,
        avoidDays,
        preferredTime,
        startDate,
        endDate
      }
    });

    slots = localSlots;
  }

  return slots;
}

async function findLocalAvailabilitySlots(params: {
  user1Calendars: any[];
  user2Calendars: any[];
  constraints: AvailabilityConstraints;
}): Promise<Array<{ start: string; end: string }>> {
  const {
    user1Calendars,
    user2Calendars,
    constraints: {
      duration = 60,
      travelBuffer,
      timeWindow,
      avoidDays = [],
      preferredTime,
      startDate,
      endDate
    }
  } = params;

  const slots: Array<{ start: string; end: string }> = [];

  // Calculate total duration including travel buffers
  const totalDurationNeeded = travelBuffer
    ? duration + travelBuffer.before + travelBuffer.after
    : duration;

  const now = new Date();
  const searchStart = startDate ? new Date(startDate) : now;
  const searchEnd = endDate ? new Date(endDate) : new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Helper function to convert "HH:MM" to minutes since midnight
  const timeToMinutes = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes;
  };

  // Helper function to convert minutes since midnight back to "HH:MM"
  const minutesToTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  // Get mutual available time windows for both users
  const getMutualAvailability = (calendars1: any[], calendars2: any[], dayOfWeek: string) => {
    // If no calendars, use default hours
    if (!calendars1.length && !calendars2.length) {
      return [{ start: '09:00', end: '17:00' }];
    }

    // Get all time windows for this day from all calendars
    const getTimeWindows = (calendars: any[]) => {
      const windows: any[] = [];
      calendars.forEach(calendar => {
        if (calendar.schedulableHours && calendar.schedulableHours[dayOfWeek]) {
          windows.push(...calendar.schedulableHours[dayOfWeek]);
        }
      });
      return windows.length ? windows : [{ start: '09:00', end: '17:00' }];
    };

    const user1Windows = getTimeWindows(calendars1);
    const user2Windows = getTimeWindows(calendars2);

    // Find overlapping time windows
    const mutualWindows: any[] = [];
    user1Windows.forEach(w1 => {
      user2Windows.forEach(w2 => {
        const start1 = timeToMinutes(w1.start);
        const end1 = timeToMinutes(w1.end);
        const start2 = timeToMinutes(w2.start);
        const end2 = timeToMinutes(w2.end);

        const overlapStart = Math.max(start1, start2);
        const overlapEnd = Math.min(end1, end2);

        if (overlapStart < overlapEnd) {
          mutualWindows.push({
            start: minutesToTime(overlapStart),
            end: minutesToTime(overlapEnd)
          });
        }
      });
    });

    return mutualWindows;
  };

  // Get day names for date calculation
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  // Set up time preferences
  const getPreferredWindow = () => {
    if (timeWindow) {
      return {
        preferredStart: timeToMinutes(timeWindow.start),
        preferredEnd: timeToMinutes(timeWindow.end)
      };
    }

    switch (preferredTime) {
      case 'morning':
        return { preferredStart: 8 * 60, preferredEnd: 12 * 60 };
      case 'afternoon':
        return { preferredStart: 12 * 60, preferredEnd: 17 * 60 };
      case 'evening':
        return { preferredStart: 17 * 60, preferredEnd: 22 * 60 };
      default:
        return { preferredStart: 9 * 60, preferredEnd: 17 * 60 };
    }
  };

  const preferredWindow = getPreferredWindow();

  // Search for available slots
  const currentDate = new Date(searchStart);
  while (currentDate <= searchEnd && slots.length < 10) {
    const dayOfWeek = dayNames[currentDate.getDay()];

    // Skip avoided days
    if (avoidDays.includes(dayOfWeek)) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Skip weekends unless specifically allowed
    if ((currentDate.getDay() === 0 || currentDate.getDay() === 6) && !timeWindow) {
      // Check if either user has availability on weekends
      const hasWeekendAvailability =
        user1Calendars.some((cal: any) => cal.schedulableHours?.[dayOfWeek]?.length > 0) ||
        user2Calendars.some((cal: any) => cal.schedulableHours?.[dayOfWeek]?.length > 0);

      if (!hasWeekendAvailability) {
        currentDate.setDate(currentDate.getDate() + 1);
        continue;
      }
    }

    const mutualWindows = getMutualAvailability(user1Calendars, user2Calendars, dayOfWeek);

    for (const window of mutualWindows) {
      const windowStart = timeToMinutes(window.start);
      const windowEnd = timeToMinutes(window.end);

      // Apply preferred time window
      const searchWindowStart = Math.max(windowStart, preferredWindow.preferredStart);
      const searchWindowEnd = Math.min(windowEnd, preferredWindow.preferredEnd);

      // Check if there's enough time for the meeting (including buffers)
      if (searchWindowEnd - searchWindowStart >= totalDurationNeeded) {
        // If it's today or within 2 hours, make sure we're at least 2 hours in the future
        let finalStart = searchWindowStart;
        const isToday = currentDate.toDateString() === now.toDateString();
        if (isToday) {
          const nowMinutes = now.getHours() * 60 + now.getMinutes() + 120; // 2 hours from now
          finalStart = Math.max(searchWindowStart, nowMinutes);
        }

        if (finalStart + totalDurationNeeded <= searchWindowEnd) {
          // Round to 30-minute interval
          const roundedStart = Math.ceil(finalStart / 30) * 30;

          if (roundedStart + totalDurationNeeded <= searchWindowEnd) {
            // Create slot
            const slotStartDate = new Date(currentDate);
            slotStartDate.setHours(Math.floor(roundedStart / 60), roundedStart % 60, 0, 0);

            // Calculate actual event time (excluding travel buffers if any)
            const eventStart = travelBuffer
              ? new Date(slotStartDate.getTime() + travelBuffer.before * 60 * 1000)
              : slotStartDate;
            const eventEnd = new Date(eventStart.getTime() + duration * 60 * 1000);

            slots.push({
              start: eventStart.toISOString(),
              end: eventEnd.toISOString(),
            });

            if (slots.length >= 10) break;
          }
        }
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}