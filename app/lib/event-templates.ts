import type { EventTemplate } from '@/app/types';

// Predefined event templates for quick scheduling
export const eventTemplates: EventTemplate[] = [
  {
    id: 'video-30',
    title: 'Video Call',
    duration: 30,
    eventType: 'video',
    intent: 'first30m',
    description: 'Quick video sync',
    preferredTimeWindow: { start: '09:00', end: '17:00' }
  },
  {
    id: 'video-60',
    title: 'Video Call',
    duration: 60,
    eventType: 'video',
    intent: 'first1h',
    description: 'Extended video discussion',
    preferredTimeWindow: { start: '09:00', end: '17:00' }
  },
  {
    id: 'coffee-30',
    title: 'Coffee Chat',
    duration: 30,
    eventType: 'in-person',
    intent: 'coffee',
    description: 'Casual coffee meetup',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredTimeWindow: { start: '08:00', end: '10:00' }
  },
  {
    id: 'lunch-60',
    title: 'Lunch',
    duration: 60,
    eventType: 'in-person',
    intent: 'lunch',
    description: 'Lunch meeting',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredTimeWindow: { start: '11:00', end: '14:00' }
  },
  {
    id: 'dinner-60',
    title: 'Dinner',
    duration: 60,
    eventType: 'in-person',
    intent: 'dinner',
    description: 'Dinner meeting',
    travelBuffer: { beforeMinutes: 30, afterMinutes: 30 },
    preferredTimeWindow: { start: '17:00', end: '20:00' }
  }
];

// Helper functions for working with event templates
export const getEventTemplate = (templateId: string): EventTemplate | undefined => {
  return eventTemplates.find(t => t.id === templateId);
};

export const getEventTemplateByIntent = (intent: string): EventTemplate | undefined => {
  return eventTemplates.find(t => t.intent === intent);
};

// Get default travel buffer based on event type
export const getDefaultTravelBuffer = (eventType: 'video' | 'in-person') => {
  if (eventType === 'in-person') {
    return {
      beforeMinutes: 30,
      afterMinutes: 30
    };
  }
  return undefined;
};

// Calculate total duration including travel buffers
export const calculateTotalDuration = (
  baseDuration: number,
  travelBuffer?: { beforeMinutes: number; afterMinutes: number }
): number => {
  if (!travelBuffer) return baseDuration;
  return baseDuration + travelBuffer.beforeMinutes + travelBuffer.afterMinutes;
};

// Get the actual event time window from a slot that includes buffers
export const getEventTimeFromSlotWithBuffer = (
  slotStart: Date,
  duration: number,
  travelBuffer?: { beforeMinutes: number; afterMinutes: number }
): { start: Date; end: Date } => {
  const eventStart = travelBuffer
    ? new Date(slotStart.getTime() + travelBuffer.beforeMinutes * 60 * 1000)
    : slotStart;

  const eventEnd = new Date(eventStart.getTime() + duration * 60 * 1000);

  return { start: eventStart, end: eventEnd };
};