# SESSION 5: Week View, Google Calendar Integration, and Time Template

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Sessions 1–4 are complete.** The database has the full Map Module, intake system, hopper, schedule_items, time_blocks, task_suggestions, action_log, and day_reflection tables. The Map page renders the SVG mind map. The Organize modal (daily view) works: hopper → drag to time blocks → commit → capture → close day. The action_log captures the full event stream.

**Read these project files before doing anything:**
- `SESSION-1-PROMPT.md` through `SESSION-4-PROMPT.md` — cumulative schema and functionality
- `OrganizeModal.jsx` — daily Organize design reference
- `OrganizeWeekModal.jsx` — **the visual design reference for the week view.** This is a working React mockup with fake data. Your job is to reproduce this design powered by real Supabase data. Match the 7-column layout, hopper, right panel with summary/completed tabs, and overall feel.
- `wild-success-constitutional-reference.docx` — sections 2.4 (Vigilance and Systems), 8 (Onboarding)
- `TASK-ORIENTED-DESIGN.md`

---

## What This Session Builds

Three connected systems:

1. **Organize Week view** — 7-column calendar modal for planning an entire week
2. **Google Calendar integration** — import calendar events as provisional items, classify them, sync ongoing
3. **Time Template** — the ideal week pattern that generates default time_blocks for each day

---

## 1. Schema Changes

### Migration: `supabase/migrations/005_week_and_calendar.sql`

#### 1.1 New table: `calendar_connections`

Stores the user's Google Calendar OAuth connection.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| provider | text | not null, default 'google', check in ('google') — extensible for future providers |
| access_token | text | not null, encrypted at rest |
| refresh_token | text | not null, encrypted at rest |
| token_expires_at | timestamptz | not null |
| calendar_ids | text[] | not null — which calendars to import from (user selects during setup) |
| is_active | boolean | not null, default true |
| last_synced_at | timestamptz | nullable |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, provider).

#### 1.2 New table: `calendar_events`

Imported calendar events, stored locally for display and classification.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| external_event_id | text | not null — Google Calendar event ID |
| external_series_id | text | nullable — recurring event series ID from Google (used to apply classification to all instances) |
| calendar_id | text | not null — which Google Calendar this came from |
| title | text | not null |
| description | text | nullable |
| start_time | timestamptz | not null |
| end_time | timestamptz | not null |
| location | text | nullable |
| attendees | jsonb | nullable — array of {email, name, response_status} |
| is_all_day | boolean | not null, default false |
| recurrence_rule | text | nullable — RRULE string from Google |
| raw_event | jsonb | nullable — full Google event object for reference |
| last_synced_at | timestamptz | not null, default now() |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, external_event_id).

#### 1.3 New table: `calendar_event_classifications`

How the user has classified calendar events. Applied per series for recurring events, per event for one-offs.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| match_key | text | not null — either external_series_id (for recurring) or external_event_id (for one-offs). This is what we match against to apply the classification. |
| match_type | text | not null, check in ('series', 'event') |
| classification | text | not null, check in ('provisional', 'info', 'fixed_commitment', 'flexible_commitment') |
| display_label | text | nullable — user can override the display name (e.g. "Juan working" → "Childcare available") |
| energy_level | text | nullable, check in ('A', 'B', 'C') — user can set energy level for commitments |
| life_domain_id | uuid | FK → life_domains, nullable, on delete set null |
| notes | text | nullable — user's note about what this event means to them |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, match_key).

The key design: classify once, apply forever. When a recurring event series is classified, all past and future instances inherit that classification. The user never has to classify "Juan x 3:30pm" again.

**Classification types:**

- **provisional** — default for all new imports. WS doesn't know what this is yet. Displayed with a "?" indicator in Organize.
- **info** — visible on the calendar as context, but not a commitment. Does not consume the user's time. May enable other scheduling (e.g. "childcare available" means that time window is open for the user). Displayed with a subtle info style, does not create a time_block.
- **fixed_commitment** — the user is doing this, at this time, non-negotiable. Creates a hard time_block (`is_hard = true`).
- **flexible_commitment** — the user is doing this, but timing is negotiable. Goes to the hopper as a proposal, or creates a soft time_block.

#### 1.4 New table: `time_template_blocks`

The ideal week pattern. Each row is a recurring time block for a specific day of the week.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| day_of_week | integer | not null, 0=Monday through 6=Sunday |
| label | text | not null |
| start_time | time | not null |
| end_time | time | not null |
| context | text[] | DEFAULT '{}' |
| energy_level | text | not null, check in ('A', 'B', 'C') |
| sort_order | integer | not null, default 0 |
| is_active | boolean | not null, default true |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

When Organize opens for a day that has no time_blocks yet, it generates them from the time_template_blocks for that day_of_week. These are instances — the user can then modify them for the specific day without affecting the template.

#### 1.5 RLS and Indexes

Standard RLS on all new tables.

Indexes:
- `calendar_connections.user_id`
- `calendar_events.user_id`
- `calendar_events.external_event_id`
- `calendar_events.external_series_id`
- `calendar_events.start_time`
- `calendar_events.calendar_id`
- `calendar_event_classifications.user_id`
- `calendar_event_classifications.match_key`
- `time_template_blocks.user_id`
- `time_template_blocks.day_of_week`

---

## 2. Google Calendar Integration

### OAuth Flow

1. User clicks "Connect Google Calendar" in settings or when prompted in Organize
2. Redirect to Google OAuth consent screen requesting `calendar.readonly` scope (read-only — WS never writes to Google Calendar)
3. On callback, store tokens in calendar_connections
4. User selects which calendars to import from (Google accounts often have multiple calendars — personal, work, shared, holidays)
5. Initial sync: fetch events for the current week ± 2 weeks

### Sync Logic

Build a sync service: `sync_calendar_events(user_id)`.

- Fetches events from Google Calendar API for each selected calendar_id
- Upserts into calendar_events (match on external_event_id)
- For recurring events, stores the external_series_id (Google's `recurringEventId` field)
- Runs automatically:
  - On Organize open (if last_synced_at > 5 minutes ago)
  - On manual "Refresh" button click
  - Optionally on a background cron (future)
- Handles token refresh when access_token expires

### Displaying Imported Events in Organize

When Organize loads a day:

1. Fetch calendar_events for that date range
2. For each event, look up its classification:
   - Check calendar_event_classifications for a match on external_series_id (if recurring) or external_event_id (if one-off)
   - If no classification exists, the event is **provisional**
3. Render based on classification:
   - **Provisional:** Show in the calendar column with a "?" badge and subtle dashed border. Clicking opens a quick classification popover (see below).
   - **Info:** Show as a faded background band in the time column. Not a block. Subtle label. Optionally show the user's display_label override (e.g. "Childcare available" instead of "Juan x 3:30pm").
   - **Fixed commitment:** Create/update a time_block with `is_hard = true`, `source = 'calendar_import'`. Display as a hard block identical to the existing committed blocks.
   - **Flexible commitment:** Create a hopper_item with `source = 'template_proposal'` linked to the calendar event. Or create a soft time_block. User decides placement.

### Classification UI

When the user clicks a provisional calendar event, show a compact popover:

```
┌──────────────────────────────────┐
│  "Juan x 3:30pm - 6:30pm"       │
│                                  │
│  What is this?                   │
│                                  │
│  ○ Info (just context)           │
│  ○ Fixed commitment              │
│  ○ Flexible commitment           │
│                                  │
│  Display as: [______________]    │
│  Energy:  [A] [B] [C]           │
│                                  │
│  ☑ Apply to all instances        │
│                                  │
│  [Save]                          │
└──────────────────────────────────┘
```

- "Apply to all instances" is checked by default for recurring events. When checked, classification saves against the series_id with match_type='series'. When unchecked, saves against the event_id with match_type='event'.
- Display label field lets the user rename what they see (e.g. "Juan x 3:30pm" → "Childcare available")
- Energy level only relevant for commitments, hidden for info classification
- After saving, the event immediately re-renders in its new classification style

### Info Events as Enabling Context

Info events don't consume time — they provide context. In the Organize view:

- Info events render as a translucent background band behind the time blocks for their time range
- They can optionally show as small labels at the top of the time column: "☞ Childcare 3:30–6:30"
- Future enhancement: WS could use info events to suggest scheduling. "You have childcare from 3:30–6:30 — that's a good window for [heavy task]." This is NOT built in this session but the data model supports it.

---

## 3. Organize Week View

### Opening the Week View

Add a toggle in the Organize modal header: **Day | Week**. Switching to Week replaces the daily center panel with the 7-column calendar view.

The week view and daily view share the same modal shell (header, hopper panel, right panel) but the center content changes.

### Layout: Match `OrganizeWeekModal.jsx`

#### Center Panel: 7 Columns

- **Day headers:** Mon–Sun with date, item count. Today highlighted with warm tint (#C4725A at low opacity).
- **Prev/Next week** navigation buttons in the header.
- **Each column:** Vertically stacked time blocks for that day, compact. Each block shows:
  - Color bar (energy level or brown for hard)
  - Label + time range (truncated if needed)
  - Items within, compact: energy dot, name (truncated), return-to-hopper button
  - Drop zone for items from hopper
  - Info events as faded background bands
  - Provisional events with "?" badge
- Columns scroll vertically independently if content overflows
- Drag items from hopper to any block on any day
- Drag items between days/blocks

#### Right Panel: Two Tabs

**Week View tab:**
- Energy This Week — horizontal bars for A/B/C counts across all days
- Values This Week — all values served by scheduled + completed items, with counts
- Items Per Day — mini bar chart showing load distribution across the week
- Unscheduled — count of remaining hopper items

**Done ✓ tab** (the "happy place"):
- Big green count of completed items this week
- Completed items listed by day with checkmarks
- Values Expressed — values served by completed items
- Integrity Score — stubbed "coming soon"

### Week-Level Hopper

The hopper in week view shows items with `flexibility = 'anytime_this_week'` or items that are due sometime this week but not yet assigned to a specific day. Hopper items that have already been scheduled to a specific day disappear from the week hopper.

For recurring items with a weekly target (e.g. "run 3x this week"), the hopper shows the remaining count: "Run (2 more this week)".

---

## 4. Time Template

### What It Is

The Time Template is the user's ideal week — a pattern of time blocks that represents how they want their time to flow when there are no interruptions. Monday morning is focus time, Tuesday afternoon is errands, Thursday has therapy, etc.

When Organize opens for a day with no existing time_blocks, it generates them from the template. The user then modifies as needed for reality.

### Time Template Editor

Accessible from Organize (button in header area: "Edit Template") or from Settings.

UI: A simplified week grid (7 columns) showing template blocks. The user can:
- Add a block to any day (name, start, end, energy level)
- Edit existing blocks (click to open inline form)
- Delete blocks
- Drag blocks between days to copy patterns
- Reorder blocks within a day

This is a direct CRUD interface for the `time_template_blocks` table. No scheduling, no hopper — just defining the ideal pattern.

### Template → Instance Flow

When Organize loads a day:

1. Check if time_blocks exist for this date
2. If none exist:
   a. Look up time_template_blocks for this day_of_week
   b. Create time_block instances from the template, with `source = 'time_template'`
   c. Then overlay any calendar events (create hard blocks for fixed_commitments, etc.)
3. If time_blocks already exist (user has already organized this day): load them as-is

The template underlay (faded dashed border) shows even when blocks have been modified — it's the reference pattern. Toggle on/off with the "Show time template" checkbox.

### Default Template

For a new user who hasn't set up a template yet, provide a sensible default:

**Weekdays (Mon–Fri):**
- Morning Focus: 8:00–10:00, energy A
- Comms & Calls: 10:00–11:00, energy B
- Deep Work: 11:00–12:30, energy A
- Lunch: 12:30–1:30, energy C
- Computer Time: 1:30–4:00, energy B
- Buffer / Wind Down: 4:00–5:00, energy C

**Saturday:**
- Open Morning: 8:00–12:00, energy C
- Open Afternoon: 12:00–5:00, energy C

**Sunday:**
- Reflective Morning: 8:00–10:00, energy C
- Open Day: 10:00–5:00, energy C
- Week Review & Plan: 7:00–8:00, energy B

Seed these into time_template_blocks for new users. Users can modify or replace entirely.

---

## 5. API Routes

### Calendar Connection — `/api/calendar/connect`
- `POST` — initiate OAuth flow. Returns redirect URL for Google consent screen.
- `GET /api/calendar/callback` — OAuth callback handler. Stores tokens, creates calendar_connection.
- `DELETE /api/calendar/connect` — disconnect. Removes tokens and calendar_connection. Does NOT delete imported events or classifications (user might reconnect).

### Calendar Sync — `/api/calendar/sync`
- `POST` — triggers sync for current user. Fetches events from Google, upserts into calendar_events. Accepts optional `{start_date, end_date}` to limit sync window. Returns count of new/updated events.
- `GET /api/calendar/events` — imported events for current user. Accepts `?start=&end=` date filters. Returns events with their classifications joined.

### Calendar Classification — `/api/calendar/classify`
- `POST` — classify an event or series. Accepts `{match_key, match_type, classification, display_label, energy_level, life_domain_id, notes}`. Creates or updates calendar_event_classifications row.
- `GET /api/calendar/classifications` — all classifications for current user.
- `DELETE /api/calendar/classify/[id]` — remove classification (event reverts to provisional).

### Calendar Settings — `/api/calendar/settings`
- `GET` — current connection status, selected calendars, last sync time.
- `PATCH` — update selected calendar_ids.

### Time Template — `/api/time-template`
- `GET` — all template blocks for current user, ordered by day_of_week then sort_order.
- `POST` — create a template block.
- `PATCH /api/time-template/[id]` — update a template block.
- `DELETE /api/time-template/[id]` — remove a template block.
- `POST /api/time-template/reorder` — batch update sort_order.
- `POST /api/time-template/seed-defaults` — seed the default template for a new user.

### Time Block Generation — `/api/time-blocks/generate`
- `POST` — accepts `{target_date}`. Generates time_blocks for the target date from the time template, then overlays calendar events (creating hard blocks for fixed_commitments). Returns the generated blocks. Only generates if no blocks exist for that date yet (idempotent).

### Extend existing routes:

**`/api/time-blocks`**
- GET should now also return `source` field so the UI can distinguish template-derived vs manual vs calendar-imported blocks

**`/api/hopper/propose`**
- Should now also create hopper items from calendar events classified as flexible_commitment that don't yet have a corresponding schedule_item for the target date

---

## 6. UI Changes

### Organize Modal Updates

**Header additions:**
- Day | Week toggle (switches center panel between daily and 7-column view)
- "Edit Template" button → opens Time Template editor
- "Connect Calendar" button (if no calendar_connection exists) or calendar sync status indicator

**Daily view additions:**
- Calendar events rendered in their classified styles (provisional with "?", info as background bands, fixed as hard blocks, flexible in hopper or soft blocks)
- Classification popover on click of provisional events
- Info events as translucent background bands behind time blocks

**Week view:**
- Full 7-column layout per OrganizeWeekModal.jsx
- All the same drag-and-drop, hopper, and classification behavior as daily view
- Right panel with Week View / Done tabs

### Time Template Editor

Separate modal or slide-over panel. Simple week grid:
- 7 columns (Mon–Sun), each showing template blocks
- Add/edit/delete blocks
- Each block: label, start time, end time, energy level
- Changes save immediately to time_template_blocks

### Nav Bar Updates

- Organize button now shows tooltip or submenu hint: "Day · Week"
- Calendar connection status indicator (connected/disconnected) somewhere accessible

### Settings Page (minimal)

Add a settings section (or simple settings modal) for:
- Google Calendar: connect/disconnect, select calendars
- View/edit all calendar classifications (list of classified events/series with ability to reclassify)
- Time Template: link to template editor

---

## What NOT to Build

- No writing to Google Calendar (read-only sync only)
- No Right Now view (Session 6)
- No automatic classification of calendar events via AI (future — user classifies manually for now)
- No info events enabling scheduling suggestions ("you have childcare, schedule heavy tasks here") — data model supports it, logic is future
- No mobile layouts
- No multi-provider calendar support (Google only for now, but schema supports extensibility)
- No background/cron calendar sync (manual and on-open only for now)
- No integrity score computation (still stubbed)
- No Planning function

---

## Verification

### Calendar Integration
- User can connect Google Calendar via OAuth flow
- After connecting, user selects which calendars to import
- Sync fetches events and stores them in calendar_events
- Events appear in Organize as provisional items with "?" indicator
- Clicking a provisional event opens classification popover
- Classifying as "info" → event becomes a background band, not a block
- Classifying as "fixed_commitment" → event becomes a hard time_block
- Classifying as "flexible_commitment" → event enters hopper or becomes soft block
- Classification on a recurring series applies to all instances (past and future)
- User can override display label ("Juan x 3:30pm" → "Childcare available")
- Re-syncing updates event details but preserves classifications
- Disconnecting calendar preserves events and classifications

### Week View
- Day | Week toggle switches the center panel
- 7 columns render with correct time blocks and items per day
- Today column is visually highlighted
- Prev/Next week navigation works
- Drag items from hopper to any block on any day
- Drag items between blocks across different days
- Return-to-hopper works from any day's block
- Right panel Week View tab shows energy balance, values, items-per-day chart, unscheduled count
- Right panel Done tab shows completed items by day with green styling and values expressed
- Calendar events appear in correct columns based on their date
- Provisional events show in the day they occur with "?" badge
- Info events show as background bands in the correct time range

### Time Template
- Template editor opens from Organize header or settings
- 7-column grid shows current template blocks
- Add/edit/delete blocks works
- Default template is seeded for new users (weekday focus/comms/deep work pattern, relaxed weekends)
- Opening Organize for a day with no blocks generates them from template
- Template underlay (faded dashed border) toggles on/off
- Modifying a day's blocks does NOT change the template
- Template changes affect future days that haven't been organized yet

### Integration Between Systems
- Template generates blocks → calendar events overlay as hard/soft blocks → hopper fills with proposals → user organizes
- The complete flow: open Organize for next Tuesday → blocks generate from template → calendar sync adds fixed meetings and info events → hopper proposes due tasks → user drags items in, classifies provisional events, commits plan
- Action log captures all events correctly through the week view
- Heat computation works with the updated action_log data

---

## Session 6 Preview (for context only — do not build)

Session 6 builds the Right Now view — a focused execution interface showing the current time block, active task, what's next, and a minimal interface for marking items complete or capturing interruptions in real-time. Also explores the basic integrity score computation from action_log data, and potentially the first version of values-based suggestions ("your Belonging score is dropping — consider scheduling a social activity this week").