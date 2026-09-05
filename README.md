# Cal Connect

**Pick a time in seconds.** Effortless two-person scheduling with AI-powered suggestions.

A mobile-focused standalone web app for seamless calendar scheduling between two people. Built according to the comprehensive spec for intuitive user experience and powerful AI suggestions.

## ✨ Features

### Core Functionality
- **🔐 Google OAuth Authentication** - Sign in with profile/email only
- **📅 Cal.com Calendar Integration** - Connect Google, Outlook, iCloud calendars
- **👤 Profile Sharing** - Share your `@username` link for easy scheduling
- **🤖 AI Suggestions** - 5 smart chips: First 30m, First 1h, Morning coffee, Lunch, Dinner
- **💬 Custom Time Finder** - Natural language chat for specific scheduling needs
- **🔗 Calendar Deep-Links** - Direct integration with Google Calendar, Outlook, iCal
- **📱 Mobile-First Design** - Optimized for mobile with responsive web support

### Smart Features
- **📍 Location Detection** - Automatic city/region detection for venue suggestions
- **⏰ Schedulable Hours** - Separate Work/Personal calendar management
- **🏢 Category-Based Defaults** - Work (Mon-Fri 9-5) vs Personal schedules
- **🌍 Timezone Handling** - Compute meetings in initiator's timezone
- **⚡ Sub-1s Performance** - Availability cache warming for instant transitions

## 🛠 Tech Stack

- **Frontend**: Next.js 15 + React 19 + TypeScript + TailwindCSS v4
- **Backend**: Next.js API routes
- **Database**: Firebase Firestore
- **Auth**: Google OAuth (Firebase Auth)
- **Calendar**: Cal.com Unified API
- **Styling**: Mobile-first responsive design

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- Firebase project
- Cal.com account (optional for full functionality)

### Setup

1. **Clone and install**
```bash
git clone https://github.com/b0mung51/SF-AI-Vibe-Coding-Hackathon.git
cd SF-AI-Vibe-Coding-Hackathon
npm install
```

2. **Environment Setup**
```bash
cp .env.example .env.local
```

Configure your `.env.local`:
```env
# Google OAuth Configuration
AUTH_GOOGLE_ID=your_google_oauth_client_id
AUTH_GOOGLE_SECRET=your_google_oauth_client_secret

# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Cal.com Configuration (Optional)
CALCOM_CLIENT_ID=your_calcom_client_id
CALCOM_CLIENT_SECRET=your_calcom_client_secret
```

3. **Run Development Server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 📱 User Flow

### S-00: Landing Page
- Clean "Cal Connect" branding
- Single "Sign in with Google" button
- Auto-redirect if already authenticated

### S-01/02: Authentication & Onboarding
- Google OAuth (profile/email only)
- Auto-generated @username from email
- Cal.com calendar connection walkthrough

### S-03: Home Dashboard
- Profile card with editable @username
- Location display (auto-detected or manual)
- "Copy link" button for sharing
- Quick access to calendar management

### S-04: Public Profile
- View other users via `/@username` links
- Profile display with location context
- "Schedule" button with availability warm-up

### S-05: AI Suggestions
- 5 suggestion chips with instant scheduling
- Direct calendar app deep-links
- "Find custom time" option

### S-05a: Custom Time Chat
- Natural language scheduling interface
- Constraint parsing (time windows, avoid days, etc.)
- Multiple slot suggestions with one-click scheduling

### S-06: Calendar Management
- Multiple calendar support
- Work/Personal categorization
- Schedulable hours configuration (15-min granularity)
- Default calendar per category

## 🔧 Core Architecture

### API Endpoints
```
/api/availability/mutual        # Calculate mutual free time
/api/availability/suggestions   # AI-powered slot recommendations
/api/availability/freeform     # Natural language time finder
```

### Data Models
- **User**: Profile, username, location, preferences
- **Calendar**: Provider, category, schedulable hours
- **Connection**: User relationships
- **Meeting**: Event details and status

### Key Features
- **Intent-Based Suggestions**: Each chip has duration, buffers, time windows
- **Travel Buffer Logic**: ±30m for Coffee/Lunch/Dinner, none for virtual
- **Location Intelligence**: Venue suggestions based on meeting type and user locations
- **Performance Optimized**: 15-minute availability caching, <1s transitions

## 🎯 Cal.com Integration

The app uses Cal.com's Unified Calendar API for:
- OAuth calendar connections
- Free/busy time retrieval
- Multi-provider support (Google, Outlook, iCloud, 100+ more)
- Secure calendar access without exposing event details

## 📋 Meeting Creation Flow

1. **Suggestion Selection** - User picks from AI chips or custom finder
2. **Slot Calculation** - Backend finds mutual availability
3. **Deep-Link Generation** - Create provider-specific compose URLs
4. **Calendar Launch** - Open native Google Calendar/Outlook/iCal
5. **Auto-Population** - Pre-filled event details, attendees, location

## 🔒 Privacy & Security

- **No Event Details**: Only free/busy times accessed
- **Email-Only OAuth**: Minimal Google permissions
- **No Calendar Writes**: Users create events in their own apps
- **Location Optional**: User controls location sharing
- **HTTPS Only**: All communications encrypted

## 🚀 Production Considerations

For production deployment:

1. **Firebase Setup**: Configure Firebase project with Google OAuth
2. **Cal.com Account**: Register for API access
3. **Environment Variables**: Secure credential management
4. **Domain Configuration**: OAuth redirect URLs
5. **Analytics**: Optional usage tracking
6. **Monitoring**: Error tracking and performance metrics

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

---

**Built for SF AI Vibe Coding Hackathon** - Demonstrating modern React patterns, AI integration, and seamless user experience in calendar scheduling.

![Cal Connect](https://github.com/b0mung51/SF-AI-Vibe-Coding-Hackathon/raw/main/screenshot.png)