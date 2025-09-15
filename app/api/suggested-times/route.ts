import { NextRequest, NextResponse } from 'next/server';
import { eventTemplates, getEventTemplateByIntent } from '@/app/lib/event-templates';
import type { EventTemplate } from '@/app/types';

export async function POST(request: NextRequest) {
  try {
    const {
      user1Id,
      user2Id,
      intent,
      eventTemplateId,
      customTimeWindow,
    } = await request.json();

    // Validate inputs
    if (!user1Id || !user2Id) {
      return NextResponse.json(
        { error: 'Missing required parameters: user1Id, user2Id' },
        { status: 400 }
      );
    }

    // Get event template either by ID or intent for backwards compatibility
    const eventTemplate = eventTemplateId
      ? eventTemplates.find(t => t.id === eventTemplateId)
      : getEventTemplateByIntent(intent);

    if (!eventTemplate) {
      return NextResponse.json(
        { error: 'Invalid event template or intent' },
        { status: 400 }
      );
    }

    console.log('Suggested times API called with:', {
      user1Id,
      user2Id,
      eventTemplate: eventTemplate.id,
      duration: eventTemplate.duration,
      travelBuffer: eventTemplate.travelBuffer
    });

    // Map event template to constraints for core API
    const constraints = mapEventTemplateToConstraints(eventTemplate, customTimeWindow);

    // Call core API to find common times
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

    const { slots } = await coreApiResponse.json();

    // Take the first available slot (earliest)
    const slot = slots.length > 0 ? slots[0] : null;

    if (!slot) {
      console.log('No slot found for event template:', eventTemplate.id);
      return NextResponse.json({ slot: null });
    }

    // Add location suggestion for in-person meetings
    let slotWithLocation: any = slot;
    if (eventTemplate.eventType === 'in-person' && slot) {
      slotWithLocation = { ...slot, location: getLocationSuggestion(eventTemplate.intent) };
    }

    console.log('Returning slot:', slotWithLocation);
    return NextResponse.json({ slot: slotWithLocation });
  } catch (error) {
    console.error('Error generating suggestion:', error);
    return NextResponse.json(
      { error: 'Failed to generate suggestion', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

function mapEventTemplateToConstraints(eventTemplate: EventTemplate, customTimeWindow?: { start: string; end: string }) {
  const constraints: any = {
    duration: eventTemplate.duration,
  };

  // Add travel buffers for in-person events
  if (eventTemplate.travelBuffer) {
    constraints.travelBuffer = eventTemplate.travelBuffer;
  }

  // Use custom time window or event template's preferred window
  const timeWindow = customTimeWindow || eventTemplate.preferredTimeWindow;
  if (timeWindow) {
    constraints.timeWindow = timeWindow;
  }

  // Map intent to preferred time if no specific window
  if (!timeWindow && eventTemplate.intent) {
    switch (eventTemplate.intent) {
      case 'coffee':
        constraints.timeWindow = { start: '07:30', end: '10:30' };
        break;
      case 'lunch':
        constraints.timeWindow = { start: '11:00', end: '14:00' };
        break;
      case 'dinner':
        constraints.timeWindow = { start: '17:30', end: '20:30' };
        break;
      case 'first30m':
      case 'first1h':
        // No specific time window - find earliest available
        constraints.preferredTime = 'morning';
        break;
    }
  }

  return constraints;
}

function getLocationSuggestion(intent: string): string {
  const locations: Record<string, string[]> = {
    coffee: [
      'Blue Bottle Coffee - Ferry Building',
      'Sightglass Coffee - SOMA',
      'Ritual Coffee Roasters - Mission',
      'Four Barrel Coffee - Mission',
    ],
    lunch: [
      'The Grove - Yerba Buena',
      'Souvla - Hayes Valley',
      'Chipotle - Financial District',
      'Sweetgreen - SOMA',
    ],
    dinner: [
      'State Bird Provisions - Fillmore',
      'Nopa - Western Addition',
      'Foreign Cinema - Mission',
      'Zuni Café - Hayes Valley',
    ],
  };

  const options = locations[intent] || ['TBD'];
  return options[Math.floor(Math.random() * options.length)];
}

function getBaseUrl(request: NextRequest): string {
  const host = request.headers.get('host');
  const protocol = request.headers.get('x-forwarded-proto') || 'http';
  return `${protocol}://${host}`;
}