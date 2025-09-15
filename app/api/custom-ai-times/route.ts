import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { user1Id, user2Id, prompt } = await request.json();

    // Validate inputs
    if (!user1Id || !user2Id || !prompt) {
      return NextResponse.json(
        { error: 'Missing required parameters: user1Id, user2Id, prompt' },
        { status: 400 }
      );
    }

    // Parse the prompt to extract constraints
    const constraints = parsePrompt(prompt);

    console.log('Custom AI times called with:', {
      user1Id,
      user2Id,
      prompt,
      parsedConstraints: constraints
    });

    // Call core API to find common times with parsed constraints
    const coreApiResponse = await fetch(`${getBaseUrl(request)}/api/find-common-times`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user1Id,
        user2Id,
        constraints
      }),
    });

    if (!coreApiResponse.ok) {
      throw new Error(`Core API failed: ${coreApiResponse.statusText}`);
    }

    const { slots: allSlots } = await coreApiResponse.json();

    // Take top 3 slots and add labels
    const slots = allSlots.slice(0, 3).map((slot: any) => ({
      ...slot,
      label: formatSlotLabel(new Date(slot.start), new Date(slot.end))
    }));

    // Generate response message
    const message = generateResponseMessage(slots, constraints);

    return NextResponse.json({
      message,
      slots,
    });
  } catch (error) {
    console.error('Error processing custom AI request:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

interface ParsedConstraints {
  timeWindow?: { start: string; end: string };
  avoidDays?: string[];
  duration?: number;
  location?: string;
  startDate?: string;
  endDate?: string;
  preferredTime?: 'morning' | 'afternoon' | 'evening';
  travelBuffer?: { before: number; after: number };
}

function parsePrompt(prompt: string): ParsedConstraints {
  const constraints: ParsedConstraints = {};
  const lowerPrompt = prompt.toLowerCase();

  // Time preferences
  if (lowerPrompt.includes('morning')) {
    constraints.preferredTime = 'morning';
  } else if (lowerPrompt.includes('afternoon')) {
    constraints.preferredTime = 'afternoon';
  } else if (lowerPrompt.includes('evening')) {
    constraints.preferredTime = 'evening';
  }

  // Avoid days
  if (lowerPrompt.includes('avoid')) {
    const avoidDays: string[] = [];
    if (lowerPrompt.includes('monday') || lowerPrompt.includes('mon')) avoidDays.push('monday');
    if (lowerPrompt.includes('tuesday') || lowerPrompt.includes('tue')) avoidDays.push('tuesday');
    if (lowerPrompt.includes('wednesday') || lowerPrompt.includes('wed')) avoidDays.push('wednesday');
    if (lowerPrompt.includes('thursday') || lowerPrompt.includes('thu')) avoidDays.push('thursday');
    if (lowerPrompt.includes('friday') || lowerPrompt.includes('fri')) avoidDays.push('friday');
    if (lowerPrompt.includes('saturday') || lowerPrompt.includes('sat')) avoidDays.push('saturday');
    if (lowerPrompt.includes('sunday') || lowerPrompt.includes('sun')) avoidDays.push('sunday');
    if (lowerPrompt.includes('weekend')) {
      avoidDays.push('saturday', 'sunday');
    }
    if (avoidDays.length > 0) {
      constraints.avoidDays = avoidDays;
    }
  }

  // Duration
  if (lowerPrompt.includes('30 min') || lowerPrompt.includes('30m')) {
    constraints.duration = 30;
  } else if (lowerPrompt.includes('60 min') || lowerPrompt.includes('1h') || lowerPrompt.includes('hour')) {
    constraints.duration = 60;
  } else if (lowerPrompt.includes('90 min') || lowerPrompt.includes('1.5h')) {
    constraints.duration = 90;
  } else if (lowerPrompt.includes('2h') || lowerPrompt.includes('2 hour')) {
    constraints.duration = 120;
  } else {
    constraints.duration = 60; // Default
  }

  // Time range
  const timeMatch = lowerPrompt.match(/between (\d{1,2}):?(\d{2})?\s*-\s*(\d{1,2}):?(\d{2})?/);
  if (timeMatch) {
    const startHour = parseInt(timeMatch[1]);
    const startMin = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const endHour = parseInt(timeMatch[3]);
    const endMin = timeMatch[4] ? parseInt(timeMatch[4]) : 0;

    constraints.timeWindow = {
      start: `${startHour.toString().padStart(2, '0')}:${startMin.toString().padStart(2, '0')}`,
      end: `${endHour.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`,
    };
  }

  // Next week
  if (lowerPrompt.includes('next week')) {
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    nextWeek.setHours(0, 0, 0, 0);
    constraints.startDate = nextWeek.toISOString();

    const weekEnd = new Date(nextWeek);
    weekEnd.setDate(weekEnd.getDate() + 7);
    constraints.endDate = weekEnd.toISOString();
  }

  // This week
  if (lowerPrompt.includes('this week')) {
    const now = new Date();
    constraints.startDate = now.toISOString();

    const thisWeekEnd = new Date();
    thisWeekEnd.setDate(thisWeekEnd.getDate() + (7 - thisWeekEnd.getDay()));
    thisWeekEnd.setHours(23, 59, 59, 999);
    constraints.endDate = thisWeekEnd.toISOString();
  }

  // Tomorrow
  if (lowerPrompt.includes('tomorrow')) {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    constraints.startDate = tomorrow.toISOString();

    const tomorrowEnd = new Date(tomorrow);
    tomorrowEnd.setHours(23, 59, 59, 999);
    constraints.endDate = tomorrowEnd.toISOString();
  }

  // Location (add travel buffer for in-person)
  if (lowerPrompt.includes('soma') || lowerPrompt.includes('mission') ||
      lowerPrompt.includes('financial district') || lowerPrompt.includes('fidi') ||
      lowerPrompt.includes('in person') || lowerPrompt.includes('meet up') ||
      lowerPrompt.includes('coffee') || lowerPrompt.includes('lunch') || lowerPrompt.includes('dinner')) {
    constraints.travelBuffer = { before: 30, after: 30 };

    if (lowerPrompt.includes('soma')) {
      constraints.location = 'SOMA';
    } else if (lowerPrompt.includes('mission')) {
      constraints.location = 'Mission';
    } else if (lowerPrompt.includes('financial district') || lowerPrompt.includes('fidi')) {
      constraints.location = 'Financial District';
    }
  }

  return constraints;
}

function formatSlotLabel(start: Date, end: Date): string {
  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
  const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

  return `${start.toLocaleDateString('en-US', dateOptions)} ${start.toLocaleTimeString('en-US', timeOptions)} - ${end.toLocaleTimeString('en-US', timeOptions)}`;
}

function generateResponseMessage(slots: any[], constraints: ParsedConstraints): string {
  if (slots.length === 0) {
    return "I couldn't find any available slots matching your criteria. Would you like to try different constraints?";
  }

  let message = "I found these available times";

  if (constraints.preferredTime) {
    message += ` in the ${constraints.preferredTime}`;
  }

  if (constraints.timeWindow) {
    message += ` between ${constraints.timeWindow.start} and ${constraints.timeWindow.end}`;
  }

  if (constraints.avoidDays && constraints.avoidDays.length > 0) {
    message += ` (avoiding ${constraints.avoidDays.join(', ')})`;
  }

  if (constraints.duration && constraints.duration !== 60) {
    message += ` for ${constraints.duration} minutes`;
  }

  if (constraints.location) {
    message += ` near ${constraints.location}`;
  }

  message += ':';

  return message;
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  return `${protocol}://${host}`;
}