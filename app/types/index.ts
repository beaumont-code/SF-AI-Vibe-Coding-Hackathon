export interface User {
  id: string;
  email: string;
  displayName: string;
  username: string;
  photoURL?: string;
  location?: {
    city: string;
    region: string;
    coordinates?: {
      lat: number;
      lng: number;
    };
  };
  defaultCalendars?: {
    work?: string;
    personal?: string;
  };
  timezone: string;
  calcomIntegrationId?: string;
  calcomAccessToken?: string;
  calcomRefreshToken?: string;
  calcomScheduleId?: string; // Cal.com schedule ID for availability sync
  onboardingCompleted?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Calendar {
  id: string;
  userId: string;
  provider: 'google' | 'office365' | 'icloud' | 'calcom' | 'other';
  email: string;
  category: 'work' | 'personal';
  isDefault: boolean;
  schedulableHours: SchedulableHours;
  calcomIntegrationId?: string;
  calcomAccessToken?: string;
  calcomRefreshToken?: string;
  calcomScheduleId?: string;
  connectedProviders?: ('google' | 'office365' | 'icloud')[];
  connectionStatus?: 'connecting' | 'connected' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface SchedulableHours {
  monday: TimeWindow[];
  tuesday: TimeWindow[];
  wednesday: TimeWindow[];
  thursday: TimeWindow[];
  friday: TimeWindow[];
  saturday: TimeWindow[];
  sunday: TimeWindow[];
}

export interface TimeWindow {
  start: string;
  end: string;
}

export interface Connection {
  id: string;
  user1Id: string;
  user2Id: string;
  status: 'connected';
  createdAt: Date;
  updatedAt: Date;
}

export interface Meeting {
  id: string;
  organizerId: string;
  attendeeId: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  intent: 'first30m' | 'first1h' | 'coffee' | 'lunch' | 'dinner' | 'custom';
  status: 'scheduled' | 'cancelled';
  meetingLink?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TimeSlot {
  start: string;
  end: string;
}

export interface TravelBuffer {
  beforeMinutes: number;
  afterMinutes: number;
}

export interface EventTemplate {
  id: string;
  title: string;
  duration: number; // in minutes
  eventType: 'video' | 'in-person';
  intent: 'first30m' | 'first1h' | 'coffee' | 'lunch' | 'dinner' | 'custom';
  description?: string;
  travelBuffer?: TravelBuffer;
  preferredTimeWindow?: TimeWindow; // e.g., coffee prefers 8-10 AM
  location?: string; // For in-person events
}

export interface SuggestionChip {
  id: string;
  eventTemplateId: string; // References EventTemplate
  icon?: string;
  suggestedSlot?: TimeSlot; // Populated after API call
  loading?: boolean;
}

export interface ScheduledEvent extends EventTemplate {
  organizerId: string;
  attendeeId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  actualLocation?: string; // Specific location chosen
  videoCallLink?: string;
  status: 'scheduled' | 'cancelled' | 'completed';
  createdAt: Date;
  updatedAt: Date;
}

export interface AvailabilityRequest {
  user1Id: string;
  user2Id: string;
  startDate: string;
  endDate: string;
  duration: number;
  intent?: string;
}

export interface AvailabilityResponse {
  slots: TimeSlot[];
  timezone: string;
}
