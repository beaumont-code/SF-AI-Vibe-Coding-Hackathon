'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getUserByUsername } from '@/app/lib/firebase-db';
import { useAuth } from '@/app/contexts/AuthContext';
import LoadingAnimation from '@/app/components/ui/LoadingAnimation';
import { getEventTemplate } from '@/app/lib/event-templates';
import type { User, SuggestionChip, EventTemplate } from '@/app/types';
import { Heading, Text } from '@/app/components/ui/Typography';
import TitleBar from '@/app/components/ui/TitleBar';

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  slots?: Array<{
    start: string;
    end: string;
    label?: string;
  }>;
}

const SUGGESTION_CHIPS: SuggestionChip[] = [
  { id: 'chip-1', eventTemplateId: 'video-30', icon: 'video' },
  { id: 'chip-2', eventTemplateId: 'video-60', icon: 'video' },
  { id: 'chip-3', eventTemplateId: 'coffee-30', icon: 'coffee' },
  { id: 'chip-4', eventTemplateId: 'lunch-60', icon: 'lunch' },
  { id: 'chip-5', eventTemplateId: 'dinner-60', icon: 'dinner' },
];

const SUGGESTED_PROMPTS = [
  'Next week afternoons',
  'Avoid Tue/Thu',
  'Between 11:30-1:30 near SOMA',
  'Earliest 60-min after 2pm',
];

export default function SchedulePage() {
  const params = useParams();
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const [targetUser, setTargetUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Suggestion chips state
  const [selectedChip, setSelectedChip] = useState<SuggestionChip | null>(null);
  const [scheduling, setScheduling] = useState(false);
  const [suggestedTimes, setSuggestedTimes] = useState<Record<string, { start: string; end: string } | null>>({});
  const [loadingTimes, setLoadingTimes] = useState(false);

  // Chat interface state
  const [showCustomChat, setShowCustomChat] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadTargetUser();
  }, [params.username]);

  useEffect(() => {
    if (currentUser && targetUser) {
      fetchSuggestedTimes();
    }
  }, [currentUser, targetUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadTargetUser = async () => {
    try {
      const username = params.username as string;
      const user = await getUserByUsername(username);

      if (!user) {
        router.push('/');
        return;
      }

      setTargetUser(user);
    } catch (error) {
      console.error('Error loading user:', error);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  const fetchSuggestedTimes = async () => {
    if (!currentUser || !targetUser) return;

    // Debug: Log Cal.com schedule information for both users
    console.log('=== CAL.COM SCHEDULE DEBUG ===');
    console.log('Current user:', {
      id: currentUser.id,
      email: currentUser.email,
      calcomIntegrationId: currentUser.calcomIntegrationId,
      calcomScheduleId: currentUser.calcomScheduleId,
      timezone: currentUser.timezone
    });
    console.log('Target user:', {
      id: targetUser.id,
      email: targetUser.email,
      calcomIntegrationId: targetUser.calcomIntegrationId,
      calcomScheduleId: targetUser.calcomScheduleId,
      timezone: targetUser.timezone
    });

    // Check if both users have Cal.com managed IDs (needed for mutual availability)
    const hasBothCalcomIds = currentUser.calcomIntegrationId && targetUser.calcomIntegrationId;
    console.log('Both users have Cal.com integration IDs:', hasBothCalcomIds);

    if (hasBothCalcomIds) {
      console.log('✅ Should use Cal.com API for availability');
    } else {
      console.log('❌ Will fallback to local calendar system');
    }
    console.log('===============================');

    setLoadingTimes(true);
    const times: Record<string, { start: string; end: string } | null> = {};

    try {
      // Fetch suggested times for each chip
      for (const chip of SUGGESTION_CHIPS) {
        const eventTemplate = getEventTemplate(chip.eventTemplateId);
        if (!eventTemplate) continue;

        try {
          const response = await fetch('/api/suggested-times', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              user1Id: currentUser.id,
              user2Id: targetUser.id,
              intent: eventTemplate.intent,
              eventTemplateId: chip.eventTemplateId,
            }),
          });

          const data = await response.json();
          times[chip.id] = data.slot || null;
        } catch (error) {
          console.error(`Error fetching time for ${eventTemplate.intent}:`, error);
          times[chip.id] = null;
        }
      }
    } finally {
      setSuggestedTimes(times);
      setLoadingTimes(false);
    }
  };

  const handleChipClick = async (chip: SuggestionChip) => {
    if (!currentUser || !targetUser) return;

    const eventTemplate = getEventTemplate(chip.eventTemplateId);
    if (!eventTemplate) return;

    setSelectedChip(chip);
    setScheduling(true);

    try {
      // Use pre-fetched time if available, otherwise fetch new one
      const existingTime = suggestedTimes[chip.id];
      let slot = existingTime;

      if (!slot) {
        const response = await fetch('/api/suggested-times', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user1Id: currentUser.id,
            user2Id: targetUser.id,
            intent: eventTemplate.intent,
            eventTemplateId: chip.eventTemplateId,
          }),
        });

        const data = await response.json();
        slot = data.slot;
      }

      if (slot) {
        openCalendarCompose(slot, eventTemplate, targetUser);
      } else {
        alert('No available time slots found in the next 14 days');
      }
    } catch (error) {
      console.error('Error getting suggestion:', error);
      alert('Failed to find available time');
    } finally {
      setScheduling(false);
      setSelectedChip(null);
    }
  };

  const openCalendarCompose = (slot: any, eventTemplate: EventTemplate, otherUser: User) => {
    const eventName = getEventName(eventTemplate.intent, otherUser.displayName);
    const eventDescription = getEventDescription(eventTemplate.intent, otherUser.displayName);

    const startDate = new Date(slot.start);
    const endDate = new Date(slot.end);

    const googleCalUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalUrl.searchParams.set('action', 'TEMPLATE');
    googleCalUrl.searchParams.set('text', eventName);
    googleCalUrl.searchParams.set('details', eventDescription);
    googleCalUrl.searchParams.set('dates', `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`);
    googleCalUrl.searchParams.set('add', otherUser.email);

    if (slot.location) {
      googleCalUrl.searchParams.set('location', slot.location);
    }

    window.open(googleCalUrl.toString(), '_blank');
  };

  const handleCustomChatToggle = () => {
    setShowCustomChat(!showCustomChat);
    if (!showCustomChat && messages.length === 0) {
      // Initialize chat with AI greeting
      setMessages([{
        id: '1',
        type: 'ai',
        content: `I'll help you find the perfect time to meet with ${targetUser?.displayName}. What kind of time works best for you?`,
      }]);
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isProcessing || !currentUser || !targetUser) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: input,
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsProcessing(true);

    try {
      const response = await fetch('/api/custom-ai-times', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user1Id: currentUser.id,
          user2Id: targetUser.id,
          prompt: input,
        }),
      });

      const data = await response.json();

      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: data.message || 'I found some available times for you:',
        slots: data.slots,
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (error) {
      console.error('Error processing request:', error);

      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'ai',
        content: 'Sorry, I had trouble finding available times. Please try again.',
      };

      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePromptChip = (prompt: string) => {
    setInput(prompt);
  };

  const handleScheduleSlot = (slot: { start: string; end: string }) => {
    if (!targetUser) return;

    const startDate = new Date(slot.start);
    const endDate = new Date(slot.end);

    const googleCalUrl = new URL('https://calendar.google.com/calendar/render');
    googleCalUrl.searchParams.set('action', 'TEMPLATE');
    googleCalUrl.searchParams.set('text', `Meeting with ${targetUser.displayName}`);
    googleCalUrl.searchParams.set('details', `Scheduled via Cal Connect`);
    googleCalUrl.searchParams.set('dates', `${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}`);
    googleCalUrl.searchParams.set('add', targetUser.email);

    window.open(googleCalUrl.toString(), '_blank');
  };

  const formatGoogleDate = (date: Date): string => {
    return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  };

  const formatSlotTime = (slot: { start: string; end: string }) => {
    const start = new Date(slot.start);
    const end = new Date(slot.end);

    const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };

    return `${start.toLocaleDateString('en-US', dateOptions)} ${start.toLocaleTimeString('en-US', timeOptions)} - ${end.toLocaleTimeString('en-US', timeOptions)}`;
  };

  const formatChipSubtitle = (chip: SuggestionChip) => {
    if (loadingTimes) {
      return 'Finding times...';
    }

    const eventTemplate = getEventTemplate(chip.eventTemplateId);
    if (!eventTemplate) return 'Next available time';

    const suggestedTime = suggestedTimes[chip.id];
    if (suggestedTime) {
      const start = new Date(suggestedTime.start);
      const end = new Date(suggestedTime.end);
      const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
      const timeRange = `${start.toLocaleTimeString('en-US', timeOptions)} - ${end.toLocaleTimeString('en-US', timeOptions)}`;

      // Add travel buffer notation for in-person events
      if (eventTemplate.travelBuffer) {
        const totalBuffer = eventTemplate.travelBuffer.beforeMinutes + eventTemplate.travelBuffer.afterMinutes;
        return `${timeRange} • ${totalBuffer} min travel buffer`;
      }

      return timeRange;
    }

    if (eventTemplate.preferredTimeWindow) {
      return `${eventTemplate.preferredTimeWindow.start} - ${eventTemplate.preferredTimeWindow.end}`;
    }

    return 'Next available time';
  };

  const getEventName = (intent: string, otherPersonName: string): string => {
    switch (intent) {
      case 'coffee':
        return `Coffee with ${otherPersonName}`;
      case 'lunch':
        return `Lunch with ${otherPersonName}`;
      case 'dinner':
        return `Dinner with ${otherPersonName}`;
      default:
        return `Meeting with ${otherPersonName}`;
    }
  };

  const getEventDescription = (intent: string, otherPersonName: string): string => {
    switch (intent) {
      case 'coffee':
        return `Coffee meeting with ${otherPersonName}. Travel buffers assumed ±30m.`;
      case 'lunch':
        return `Lunch meeting with ${otherPersonName}. Duration 50m. Travel buffers assumed ±30m.`;
      case 'dinner':
        return `Dinner with ${otherPersonName}. Travel buffers assumed ±30m.`;
      case 'first30m':
        return `30-minute conversation with ${otherPersonName}.`;
      case 'first1h':
        return `60-minute conversation with ${otherPersonName}.`;
      default:
        return `Meeting with ${otherPersonName}.`;
    }
  };

  const getChipIcon = (icon: string) => {
    switch (icon) {
      case 'video':
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
          </svg>
        );
      case 'coffee':
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18V7a1 1 0 011-1h8a1 1 0 011 1v11" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 10h2a2 2 0 012 2v2a2 2 0 01-2 2h-2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18h10M8 3v3M12 3v3M16 3v3" />
          </svg>
        );
      case 'lunch':
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 8c0-1.5 1.5-3 4-3h4c2.5 0 4 1.5 4 3v1H6V8z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 9h14v2a1 1 0 01-1 1H6a1 1 0 01-1-1V9z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 12h12v2a1 1 0 01-1 1H7a1 1 0 01-1-1v-2z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 15h10v2a2 2 0 01-2 2H9a2 2 0 01-2-2v-2z" />
          </svg>
        );
      case 'dinner':
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v2" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6h4" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 14c0-3.314 2.686-6 6-6s6 2.686 6 6" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 14h16" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18h12" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 14v4M16 14v4" />
          </svg>
        );
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
    }
  };

  if (loading || !targetUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-pulse">
          <LoadingAnimation />
        </div>
      </div>
    );
  }

  if (showCustomChat) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-md mx-auto flex items-center gap-3">
            <button
              onClick={handleCustomChatToggle}
              className="text-gray-600 hover:text-gray-900 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex-1">
              <Heading as="h1" className="font-semibold text-gray-900">Find a custom time</Heading>
              <Text variant="subdued" className="text-gray-500">with {targetUser.displayName}</Text>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="max-w-md mx-auto space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.type === 'user'
                      ? 'gradient-primary text-white'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <p className={message.type === 'user' ? 'text-white' : 'text-gray-900'}>
                    {message.content}
                  </p>

                  {message.slots && message.slots.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {message.slots.map((slot, index) => (
                        <button
                          key={index}
                          onClick={() => handleScheduleSlot(slot)}
                          className="w-full p-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-left transition-colors"
                        >
                          <Text variant="base">
                            {slot.label || formatSlotTime(slot)}
                          </Text>
                          <p className="text-sm gradient-link mt-1">Schedule →</p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Suggested prompts */}
        {messages.length === 1 && (
          <div className="px-4 pb-2">
            <div className="max-w-md mx-auto">
              <div className="flex gap-2 overflow-x-auto pb-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handlePromptChip(prompt)}
                    className="flex-shrink-0 px-3 py-2 bg-white border border-gray-200 rounded-full hover:bg-gray-50 transition-colors"
                  >
                    <Text variant="small">{prompt}</Text>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Input */}
        <div className="bg-white border-t border-gray-200 px-4 py-3">
          <div className="max-w-md mx-auto flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Describe when you'd like to meet..."
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:border-orange-500"
              disabled={isProcessing}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isProcessing}
              className="px-4 py-2 gradient-primary text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-md mx-auto">
        <TitleBar title="Schedule" onBack={() => router.back()} />


        {/* Suggestions */}
        <div className="space-y-3 mb-6">
          {SUGGESTION_CHIPS.map((chip) => (
            <button
              key={chip.id}
              onClick={() => handleChipClick(chip)}
              disabled={scheduling}
              className={`w-full p-4 rounded-lg bg-white border-2 transition-all duration-200 ${
                selectedChip?.id === chip.id
                  ? 'border-orange-500 bg-orange-50 shadow-lg ring-2 ring-red-100'
                  : 'border-gray-200 hover:border-transparent hover:bg-gradient-to-r hover:from-red-50 hover:to-amber-50 hover:shadow-lg hover:ring-2 hover:ring-red-100'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-gray-100">
                  {getChipIcon(chip.icon || 'default')}
                </div>
                <div className="flex-1 text-left">
                  <Text variant="base">
                    {(() => {
                      const eventTemplate = getEventTemplate(chip.eventTemplateId);
                      return eventTemplate ? `${eventTemplate.title} (${eventTemplate.duration} min)` : 'Unknown Event';
                    })()}
                  </Text>
                  <Text variant="subdued">
                    {formatChipSubtitle(chip)}
                  </Text>
                </div>
                {selectedChip?.id === chip.id && scheduling && (
                  <LoadingAnimation size="sm" />
                )}
              </div>
            </button>
          ))}
        </div>

        {/* Custom Time Button */}
        <button
          onClick={handleCustomChatToggle}
          className="w-full py-3 px-4 gradient-primary text-white font-medium rounded-lg transition-colors"
        >
          Find Custom Time
        </button>

      </div>
    </div>
  );
}