# Standalone Scheduler — Brief Overview & Screen Requirements

*Last edited: 13 Sep 2025*

## Overview (brief)

A standalone web app for effortless two‑person scheduling.

* **Auth:** Sign in with Google (profile/email only). After sign‑in, an onboarding screen asks you to **link your calendars via Cal.com**.
* **Connect:** Users share a **profile link or @username** to open a direct scheduling view.
* **Schedule:** Tap **Schedule** → see **AI suggestions** (5 chips: First 30m, First 1h, Morning coffee, Lunch, Dinner).
* **Create event:** On confirm, open the provider's **native compose** (Google/Outlook deep‑link).
* **Prefs:** Users manage multiple calendars (Personal/Work) with a default per category; each calendar has its own schedulable hours.

---

## Requirements by Screen (tabular)

### S‑00 — Homepage (Unauthenticated)

**Elements**

| ID | Element                 | Details                                               |
| -- | ----------------------- | ----------------------------------------------------- |
| E1 | **Title**               | "Cal Connect"                                         |
| E2 | **Tagline**             | One‑line value prop (e.g., "Pick a time in seconds.") |
| E3 | **Sign in with Google** | Primary CTA (button)                                  |

**Behaviour**

| Rule | Description   |                                                                                               |
| ---- | ------------- | --------------------------------------------------------------------------------------------- |
| B1   | Sign‑in CTA   | Launch Google OAuth (profile/email only); on success → **S‑02 Onboarding: Connect Calendars** |
| B2   | Auth redirect | If user already authenticated, skip to **S‑03 Home (authenticated)**                          |

### S‑01 — Sign‑in

**Behaviour**

| Rule | Description       |                                                                      |
| ---- | ----------------- | -------------------------------------------------------------------- |
| B1   | Google OAuth only | Request basic profile & email **only** (no Calendar scopes)          |
| B2   | Success route     | Create user record → route to **S‑02 Onboarding: Connect Calendars** |
| B3   | Failure           | Show error banner; user remains on S‑01                              |
| B4   | Handle seeding    | Generate default **@username** from Google profile (editable later)  |

---

### S‑02 — Onboarding: Connect Calendars (Cal.com)

**Elements**

| ID | Element                      | Details                                                                                                       |
| -- | ---------------------------- | ------------------------------------------------------------------------------------------------------------- |
| E1 | **Title**                    | "Connect your calendars"                                                                                      |
| E2 | **Description**              | Short explainer: "Link Google/Outlook/iCloud so we can find mutual free time. We never expose event details." |
| E3 | **Connect calendars** button | Opens **Cal.com Connect** widget (providers: Google, Outlook, iCloud, More…)                                  |

**Behaviour**

| Rule | Description    |                                                                                                  |
| ---- | -------------- | ------------------------------------------------------------------------------------------------ |
| B1   | Launch Connect | Open Cal.com widget in‑modal; user can add one or multiple calendars                             |
| B2   | Store pointer  | On success, store `{ calUserId, providerCategory, isDefault }` and invalidate availability cache |
| B3   | Continue       | Close modal → if first calendar connected, toast "Calendar connected" → proceed to S‑03          |

---

### S‑03 — Home (authenticated)

**Elements**

| ID | Element               | Details                                                                     |
| -- | --------------------- | --------------------------------------------------------------------------- |
| E1 | Profile card          | Avatar, display name, **@username** (editable), **Location** (city, region) |
| E2 | Copy link button      | Copies `https://app.example/@username`                                      |
| E4 | Manage calendars link | Secondary CTA (link); routes to S‑06                                        |

**Behaviour**

| Rule | Description            |                                                                                                                                                                             |
| ---- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1   | Copy link              | Visual confirmation toast                                                                                                                                                   |
| B2   | Open public link       | Unauthed visitors land on S‑04 for that user                                                                                                                                |
| B3   | Clipboard fallback     | If Clipboard API unavailable, show selectable URL field with tap‑to‑select                                                                                                  |
| B4   | First‑load geolocation | On first authenticated load, prompt for browser location permission; if granted, reverse‑geocode to **city, region** and save to profile; show Location on the profile card |
| B5   | Denied/unavailable     | If permission denied or unavailable, show one‑time inline prompt to manually enter **city, region**; save to profile and display on the profile card                        |

---

### S‑04 — Other Person's Profile

**Elements**

| ID | Element             | Details                                                                                                                   |
| -- | ------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| E1 | Profile card        | Avatar, display name, **@username** (same component as S‑03 E1; shows **Location** if available); optional mutual context |
| E2 | **Schedule** button | Primary CTA                                                                                                               |

**Behaviour**

| Rule | Description      |                                                           |
| ---- | ---------------- | --------------------------------------------------------- |
| B1   | Tap **Schedule** | Call `POST /mutual-availability` warm‑up; then route S‑05 |
| B2   | Perf target      | Warm‑cache transition to S‑05 in < 1 s                    |

---

### S‑05 — Suggestions (AI)

**Elements**

| ID | Element              | Details                                                                   |
| -- | -------------------- | ------------------------------------------------------------------------- |
| E1 | Title                | "Pick a suggested time" (H2)                                              |
| E2 | Suggestion chips ×5  | First 30m · First 1h · Morning coffee · Lunch · Dinner                    |
| E3 | **Find custom time** | Secondary CTA (link/button) → opens **S‑05a — AI Chat: Find Custom Time** |

**Behaviour**

| Rule | Description           |                                                                                                                                                       |
| ---- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1   | Chip press            | Call `POST /suggest` (participants, intent); disable chip if none in 14d                                                                              |
| B2   | Open provider compose | On success, **launch the initiator's calendar**: Google `render?action=TEMPLATE…`, Outlook `deeplink/compose`, or generate/download **.ics** for iCal |
| B3   | Find custom time      | Tap secondary CTA to open **S‑05a — AI Chat: Find Custom Time**                                                                                       |

---

### S‑05a — AI Chat: Find Custom Time

**Elements**

| ID | Element           | Details                                                                                                          |
| -- | ----------------- | ---------------------------------------------------------------------------------------------------------------- |
| E1 | Title             | "Find a custom time" (H2)                                                                                        |
| E2 | Chat transcript   | List of user/AI messages                                                                                         |
| E3 | Prompt input      | Text field + Send button                                                                                         |
| E4 | Suggested prompts | Chips like: "Next week afternoons", "Avoid Tue/Thu", "Between 11:30–1:30 near SOMA", "Earliest 60‑min after 2pm" |
| E5 | Result cards      | One card per candidate slot (date, start–end, intent label); each has **Schedule**                               |

**Behaviour**

| Rule | Description      |                                                                                                                                                                                                           |
| ---- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1   | Freeform suggest | Calls `/suggest/freeform` with parsed constraints (participants, duration, windows, buffers) and returns ranked slots honoring global rules (≥ now+2h start; Lunch 50m; Coffee/Lunch/Dinner ±30m buffers) |
| B2   | Open in calendar | For a chosen card, open provider compose exactly as in **S‑05 B2**                                                                                                                                        |
| B3   | Refine           | Follow‑up prompts update constraints and refresh results in place                                                                                                                                         |
| B4   | No results       | Ask for permission to widen range or relax constraints; provide a "Notify me if a slot opens" stub (future)                                                                                               |

---

### S‑06 — Manage Calendars & Preferences

**Elements**

| ID | Element                   | Details                                                                            |
| -- | ------------------------- | ---------------------------------------------------------------------------------- |
| E1 | **Calendar sections × N** | One expandable panel **per linked calendar** (see **S‑06a** for in‑panel controls) |
| E2 | **Add calendar** (global) | Button at page bottom; opens Cal.com Connect to add another calendar               |
| E3 | **Save changes** (global) | Button at page bottom; enabled when dirty                                          |

**Behaviour**

| Rule | Description           |                                                                                                                                                                                                                                |
| ---- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1   | Category choices      | Only **Work** or **Personal** are allowed; a calendar must belong to exactly one.                                                                                                                                              |
| B2   | Defaults              | First connected calendar defaults to **Personal** and becomes **default for Personal**. When a second calendar is added and marked **Work**, it becomes **default for Work** unless changed. Exactly one default per category. |
| B3   | Hours defaults        | **Work:** Mon–Fri 09:00–17:00; Sat–Sun Off. **Personal:** Weekdays: 08:00–09:00 **and** 17:00–22:00 (two windows); Weekends: 08:00–24:00. Users can set any day to Off by removing all windows.                                |
| B4   | Validation            | Windows must not overlap; **End > Start** within a day (or **End = 24:00**). Enforce 15‑min steps.                                                                                                                             |
| B5   | Save (global)         | Persist updates for all edited calendars; invalidate any availability caches.                                                                                                                                                  |
| B6   | Add calendar (global) | Launch Cal.com Connect; on success, append a new calendar section with defaults from **B3**.                                                                                                                                   |

### S‑06a — Per‑Calendar Panel (Elements & Requirements)

**Elements (inside each calendar panel)**

| ID | Element                 | Details                                                                                                                                                                                            |
| -- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H  | Header                  | Provider logo/name, account email, **Open in provider** link                                                                                                                                       |
| C1 | Category selector       | Radio: **Work** / **Personal** (exactly one)                                                                                                                                                       |
| C2 | Schedulable hours table | 7 rows (Mon–Sun); **1–2 windows per day**; each window has **Start**/**End** dropdowns (15‑min steps). Supports **End = 24:00**; includes "+ Add window" / "Remove" and an **Off** toggle per day. |
| C3 | Default marker          | Toggle "Make default for this category" (enforce **one** default per category across all calendars)                                                                                                |
| C4 | Disconnect              | Unlink this calendar                                                                                                                                                                               |

**Behaviour (inside each calendar panel)**

| Rule | Description          |                                                                                                                                                      |
| ---- | -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1   | Category enforcement | A calendar must be either **Work** or **Personal**; switching updates which default slot it can own.                                                 |
| R2   | Hours defaults       | On first connect: apply **Work** or **Personal** defaults from **S‑06 B3** based on selected category.                                               |
| R3   | Hours validation     | Prevent overlapping windows; require **End > Start** within a day (or **End = 24:00**); 15‑minute granularity.                                       |
| R4   | Default marker       | Enforce single default per category—toggling here will unset the current default in that category.                                                   |
| R5   | Disconnect           | If the disconnected calendar was the category default, clear that default; user must set another default before scheduling sends from that category. |

---

## Backend — AI Suggestions Logic

**Inputs & Defaults**

| Key            | Description                                                                                                                                                                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Participants   | Two user IDs: initiator (viewer) and target (other person)                                                                                                                                                                                                                                                            |
| Range          | Default **next 14 days**; extend when needed (e.g., when no result). **Earliest start** considered is **now + 2h**.                                                                                                                                                                                                   |
| Duration       | **Defaults by entry point:** S‑05 chips → **First 30m = 30m**, all other chips (**First 1h, Coffee, Lunch, Dinner**) = **60m**. S‑05a (AI chat) → **intent/constraint‑based** (LLM parses duration if stated; otherwise falls back to the same defaults).                                                             |
| Travel buffers | **Defaults by intent:** **First 30m/First 1h = 0** (assume virtual by default). **Coffee/Lunch/Dinner = ±30m**. **Chat** detects in‑person vs virtual; if in‑person and a travel window can be estimated (from participants' locations and likely transit), it uses that estimate; otherwise it defaults to **±30m**. |
| Sources        | Normalized availability via adapters (Cal.com `/availability`), **per‑calendar schedulable hours** (S‑06)                                                                                                                                                                                                             |
| Hours model    | Clip each calendar to its own windows (S‑06), then **union calendars → user‑level free**. Category affects heuristics and which calendar sends invites, not visibility of free time.                                                                                                                                  |
| Timezone       | Compute in **initiator's TZ**; ensure slot falls within both parties' relevant hours (category‑aware)                                                                                                                                                                                                                 |

**Intent Windows (the 5 chips in S‑05)**

| Intent         | Window / Rule                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| First 30m      | Earliest mutual slot ≥ **now + 2h**, **≥ 30m** (no travel buffer)                                                                                 |
| First 1h       | Earliest mutual slot ≥ **now + 2h**, **≥ 60m** (no travel buffer)                                                                                 |
| Morning coffee | First mutual slot **07:30–10:30** local where **(duration + bufferBefore + bufferAfter)** fits entirely; defaults: **duration 60m, buffers ±30m** |
| Lunch          | First mutual slot **11:00–14:00** local where **(duration + bufferBefore + bufferAfter)** fits entirely; defaults: **duration 60m, buffers ±30m** |
| Dinner         | First mutual slot **17:30–20:30** local where **(duration + bufferBefore + bufferAfter)** fits entirely; defaults: **duration 60m, buffers ±30m** |

**Algorithm (server‑side)**

1. Fetch or read from cache **free/busy** for each participant in the range.
2. Convert to canonical **Slot\[]** (UTC ISO start/end).
3. For each participant: **clip each calendar** to its own windows, then **union calendars → participant‑level free**. Category influences heuristics/outbound default only.
4. Compute **intersection** of free slots (O(n+m)).
5. For intents with buffers, expand candidate to **meeting + bufferBefore + bufferAfter** and re‑check fit.
6. Enforce **earliest start ≥ now + 2h**; pick the earliest slot per intent.
7. Return one candidate per intent to S‑05; disable chip if none exists.

## Backend — Event Compose Payload (Deep‑Links)

**Field Spec (what we send)**

| Field                       | Source                                                          | Required    | Notes                                                                                                                                                                                                          |
| --------------------------- | --------------------------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Event Name**              | Intent + other person name (e.g., "Coffee with {Name}")         | Yes         | Deterministic naming by intent; fallback "Meeting with {Name}"                                                                                                                                                 |
| **Event Description**       | AI‑generated summary incl. context + travel note (if in‑person) | Yes         | Include: purpose, any constraints, and travel guidance if buffers assumed                                                                                                                                      |
| **Participants (emails)**   | Initiator (organizer) + other person                            | Yes         | Organizer = initiator's default category calendar; invitee = other person's email                                                                                                                              |
| **Start / End**             | Picked slot from S‑05                                           | Yes         | **Duration excludes travel buffers** (buffers are separate holds or just guidance)                                                                                                                             |
| **Notification (reminder)** | Derived                                                         | Yes         | **In‑person:** X minutes **before** = chosen travel buffer (default 30). **Virtual:** 5 minutes before. If provider deep‑link can't set reminders, we rely on calendar defaults and add a line to description. |
| **Video link**              | Provider capability                                             | Conditional | If provider/deep‑link supports auto‑add, include; otherwise include "Video suggested: Google Meet" in description.                                                                                             |
| **Location**                | AI‑suggested venue (if in‑person)                               | Conditional | AI picks a venue type by intent (coffee/lunch/dinner) near midpoint of both users' locations; insert as plain text for deep‑link; later we can attach structured place IDs.                                    |

**Provider Mapping (Deep‑link path)**

| Provider                         | How we fill it                                                                                                                                                                                                                                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Google Calendar (web)**        | Build `https://calendar.google.com/calendar/render?action=TEMPLATE&text={NAME}&details={DESC}&dates={START_Z}/{END_Z}&location={LOCATION}&add={INVITEE_EMAIL}&ctz={TIMEZONE}`.  Reminders and Meet link are typically controlled by the user in compose; description includes our reminder/meet guidance. |
| **Outlook (Office/Outlook.com)** | Build `https://outlook.office.com/calendar/deeplink/compose?...&subject={NAME}&body={DESC}&startdt={START_ISO}&enddt={END_ISO}&location={LOCATION}` (guests added where supported; otherwise included in body). Reminders depend on user defaults; description includes guidance.                         |
| **Apple / iCal**                 | Generate **.ics** with `SUMMARY`, `DESCRIPTION`, `DTSTART`, `DTEND`, `LOCATION`, `ORGANIZER`, `ATTENDEE`, and a `VALARM` that matches our reminder rule. Offer as download/open.                                                                                                                          |

**Event Name & Description templates**

| Context   | Name                  | Description notes                                                               |
| --------- | --------------------- | ------------------------------------------------------------------------------- |
| Coffee    | `Coffee with {Name}`  | "Suggested location: {Venue}. Travel buffers assumed ±30m."                     |
| Lunch     | `Lunch with {Name}`   | "Suggested location: {Venue}. Lunch duration 50m. Travel buffers assumed ±30m." |
| Dinner    | `Dinner with {Name}`  | "Suggested location: {Venue}. Travel buffers assumed ±30m."                     |
| First 30m | `Meeting with {Name}` | "30‑minute conversation."                                                       |
| First 1h  | `Meeting with {Name}` | "60‑minute conversation."                                                       |
