# SESSION 6: Organize — Complete Rebuild

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Previous sessions built:** Map Module (values, life domains, activities, big outcomes), intake system, and database schema including hopper_items, schedule_items, time_blocks, task_suggestions, action_log, and day_reflection tables. The Map page renders an SVG mind map with values, activities, and outcomes.

**This session is a complete rebuild of the Organize function.** Do not read or reference the old OrganizeModal.jsx or OrganizeWeekModal.jsx files. Do not carry over UI patterns from SESSION-4-PROMPT.md or SESSION-5-PROMPT.md. Build from scratch based solely on this document.

**Read these project files before doing anything:**
- `SESSION-1-PROMPT.md` — original database schema
- `SESSION-2-PROMPT.md` — Map page, API routes, visual design rules (colors, fonts, styling)
- `wild-success-constitutional-reference.docx` — sections 2 (Value Architecture), 2.4 (Vigilance and Systems)
- `TASK-ORIENTED-DESIGN.md` — the user should see ONLY what is most relevant; the task of organizing must feel easy, intuitive, natural, and quick

---

## Core Philosophy

The Organize cycle is: **capture → suggest → organize → do → complete → reflect → adjust.**

Wild Success is not trying to replace email, texting, or the user's calendar. It is the **layer of intention and reflection** that sits on top of the chaos. WS is where the user decides what incoming items mean, what to do about them, and whether actual behavior matches stated priorities.

The Organize modal must feel **fluid, fast, and forgiving.** The user should be able to organize a full week in under 5 minutes. Every interaction saves incrementally. Nothing is lost on close. Remaining Hopper items persist for the next session.

---

## What This Session Builds

1. **Block Types** — a user-editable library of time block categories
2. **Organize Week modal** — a three-panel week view with block placement, Hopper item allocation, and Google Calendar integration
3. **Google Calendar integration** — OAuth connection, event import, event classification
4. **Hopper prioritization** — urgency/importance ranking informed by Values

---

## 1. Schema Changes

### Migration: `supabase/migrations/006_organize_rebuild.sql`

#### 1.1 New table: `block_types`

The user's library of reusable time block categories.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| name | text | not null |
| color | text | not null — hex color |
| default_duration_minutes | integer | not null, default 60 |
| energy_level | text | not null, default 'B', check in ('A', 'B', 'C') |
| icon | text | nullable — emoji or icon identifier |
| sort_order | integer | not null, default 0 |
| is_active | boolean | not null, default true |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, name).

#### 1.2 Seed default block types

Create a function `seed_default_block_types(p_user_id uuid)` that inserts:

| Name | Color | Default Duration | Energy | Icon |
|------|-------|-----------------|--------|------|
| Focus | #C4725A | 50 | A | 🎯 |
| Communicate | #4B82AF | 30 | B | 💬 |
| Social/Family | #7A6BAF | 60 | B | 👥 |
| Meeting/Appointment | #9E6A46 | 60 | B | 📅 |
| Outing | #7A9E82 | 120 | C | 🚶 |
| Admin | #8A857D | 45 | B | 📋 |
| Recharge | #5A9E6F | 30 | C | 🔋 |
| Ritual | #B8443E | 30 | B | 🕯️ |
| Planning | #C4725A | 45 | A | 🗺️ |
| Self-Care | #5A9E6F | 45 | C | 🌿 |

Call this function from the existing `handle_new_user` trigger, after `seed_default_map_data`.

#### 1.3 New table: `focus_settings`

Global focus duration preference, overridable per block instance.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null, unique |
| default_focus_minutes | integer | not null, default 50, check in (25, 50, 75) |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

#### 1.4 Modify `time_blocks`

Add columns to link blocks to their type and support resizing:

```sql
ALTER TABLE time_blocks ADD COLUMN block_type_id uuid
  REFERENCES block_types(id) ON DELETE SET NULL;

ALTER TABLE time_blocks ADD COLUMN duration_minutes integer;
-- Actual duration, which may differ from block_type default after user resizes

ALTER TABLE time_blocks ADD COLUMN focus_override_minutes integer
  CHECK (focus_override_minutes IN (25, 50, 75));
-- Only for Focus blocks. Null = use global default.
```

#### 1.5 New table: `calendar_connections`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| provider | text | not null, default 'google', check in ('google') |
| access_token | text | not null |
| refresh_token | text | not null |
| token_expires_at | timestamptz | not null |
| calendar_ids | text[] | not null — which calendars to import |
| is_active | boolean | not null, default true |
| last_synced_at | timestamptz | nullable |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, provider).

#### 1.6 New table: `calendar_events`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| external_event_id | text | not null |
| external_series_id | text | nullable — for recurring events |
| calendar_id | text | not null |
| title | text | not null |
| description | text | nullable |
| start_time | timestamptz | not null |
| end_time | timestamptz | not null |
| location | text | nullable |
| attendees | jsonb | nullable |
| is_all_day | boolean | not null, default false |
| recurrence_rule | text | nullable |
| raw_event | jsonb | nullable |
| last_synced_at | timestamptz | not null, default now() |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, external_event_id).

#### 1.7 New table: `calendar_event_classifications`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| match_key | text | not null — external_series_id (recurring) or external_event_id (one-off) |
| match_type | text | not null, check in ('series', 'event') |
| classification | text | not null, check in ('provisional', 'info', 'fixed_commitment', 'flexible_commitment') |
| display_label | text | nullable — user override of event title |
| energy_level | text | nullable, check in ('A', 'B', 'C') |
| life_domain_id | uuid | FK → life_domains, nullable, on delete set null |
| notes | text | nullable |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, match_key).

**Classification types:**
- **provisional** — default for new imports. Shown with "?" indicator. User must classify.
- **info** — visible context, not a commitment. Rendered as a translucent background band. Does not create a time_block. (e.g. "Juan x 3:30pm" means childcare is available, not that the user has a commitment.)
- **fixed_commitment** — user is doing this, at this time. Creates a hard time_block.
- **flexible_commitment** — user is doing this, timing negotiable. Goes to hopper.

**Classify once, apply forever.** Classification on a recurring series (match_type='series') applies to all instances. The user never re-classifies the same recurring event.

#### 1.8 Add `priority_score` to `hopper_items`

```sql
ALTER TABLE hopper_items ADD COLUMN priority_score numeric DEFAULT 0;
-- System-computed priority. Higher = more urgent/important.
-- Influenced by: deadline proximity, overdue status, value scores,
-- user behavior (dismissals lower score, placements raise it).

ALTER TABLE hopper_items ADD COLUMN priority_tier text DEFAULT 'normal'
  CHECK (priority_tier IN ('urgent', 'normal', 'suggested'));
-- urgent = overdue, deadline this week, calendar items needing classification
-- normal = ad-hoc captures, outside requests
-- suggested = recurring proposals, nice-to-do items

ALTER TABLE hopper_items ADD COLUMN block_type_hint uuid
  REFERENCES block_types(id) ON DELETE SET NULL;
-- System's guess at which block type this item belongs in.
-- Used for optional "sort by block type" view in hopper.
```

#### 1.9 RLS and Indexes

Standard RLS on all new tables. Select-only is not needed here — all tables are per-user CRUD.

Indexes:
- `block_types.user_id`
- `calendar_connections.user_id`
- `calendar_events.user_id`
- `calendar_events.external_event_id`
- `calendar_events.external_series_id`
- `calendar_events.start_time`
- `calendar_event_classifications.user_id`
- `calendar_event_classifications.match_key`
- `hopper_items.priority_score`
- `hopper_items.priority_tier`
- `hopper_items.block_type_hint`
- `time_blocks.block_type_id`

---

## 2. Google Calendar Integration

### OAuth Flow

1. User clicks "Connect Google Calendar" in the Organize modal header or settings
2. Redirect to Google OAuth consent screen requesting `calendar.readonly` scope
3. On callback, store tokens in calendar_connections
4. User selects which calendars to import
5. Initial sync: fetch events for the current week ± 2 weeks

### Sync Service

`sync_calendar_events(user_id)`:
- Fetches events from Google Calendar API for each selected calendar
- Upserts into calendar_events (match on external_event_id)
- For recurring events, stores external_series_id
- Runs on Organize open (if last_synced_at > 5 minutes ago) and on manual refresh
- Handles token refresh when access_token expires

### Rendering in the Week Grid

On loading a week:
1. Fetch calendar_events for the date range
2. Look up classifications for each event (match on series_id first, then event_id)
3. Render based on classification:
   - **Provisional:** Shown in the day column at correct time with "?" badge, dashed border. Click opens classification popover.
   - **Info:** Translucent background band behind the time grid at the event's time range. Subtle label showing display_label or title. Not a block. Not interactive beyond clicking to reclassify.
   - **Fixed commitment:** Rendered as a hard time_block in the grid. Locked position, brown styling (#9E6A46), cannot be moved or resized.
   - **Flexible commitment:** Creates a hopper_item. Appears in the Hopper, not in the grid.

### Classification Popover

When user clicks a provisional event:

- Event title displayed
- Radio options: Info / Fixed commitment / Flexible commitment
- Display label override field (e.g. "Juan x 3:30pm" → "Childcare available")
- Energy level selector (A/B/C) — only for commitments
- "Apply to all instances" checkbox — checked by default for recurring events
- Save button

After saving, the event immediately re-renders in its classified style.

---

## 3. Block Types

### Block Type Palette

A horizontal strip above the week grid. Shows all active block types as compact draggable chips: icon + name + default duration. The palette is collapsible — user can hide it when not placing blocks, to give more vertical space to the week grid.

Each chip is draggable onto the week grid.

### Block Type Editor

Accessible via a gear/edit icon on the palette strip. Inline editor (not a separate modal) that expands below the palette:
- List of current block types with name, color swatch, duration, energy level
- Edit any field inline
- Delete (with confirmation if blocks of this type exist)
- Add new type: name, color picker, default duration, energy level, icon
- Reorder via drag

### Focus Duration Setting

A global setting: 25, 50, or 75 minutes. Stored in focus_settings. When a Focus block is dropped, it uses this length. The user can override per-instance by resizing or via a quick popover on the block.

---

## 4. The Organize Week Modal

### Opening

The "Organize" button in the nav bar opens the modal. It is a full-screen overlay (97vw × 95vh, max-width 1600px) over the Map page, with the Map dimmed behind.

### Layout: Three Panels

```
┌─────────────────────────────────────────────────────────────────┐
│  Header: "Organize Week" | Mar 9–15 | ← Prev  Next → |  × Close│
├──────────┬──────────────────────────────────────────┬───────────┤
│          │  [Block Type Palette — collapsible]       │           │
│          ├──────────────────────────────────────────┤           │
│  Hopper  │  Mon  Tue  Wed  Thu  Fri  Sat  Sun      │  Summary  │
│  (left)  │                                          │  (right)  │
│          │  Time-proportional week grid              │           │
│ collapse │  1 hour = fixed pixel height             │           │
│  ible    │  Blocks placed by user                   │           │
│          │  Hard appointments pre-populated          │           │
│          │  Info events as background bands          │           │
│          │                                          │           │
├──────────┤                                          │           │
│ Capture  │                                          │           │
│ input    │                                          │           │
└──────────┴──────────────────────────────────────────┴───────────┘
```

**Left Panel: Hopper** (collapsible)

Always visible during both block placement and item allocation phases.

- **Header:** "Hopper" with item count, collapse/expand toggle
- **Filter buttons:** energy level filter (All / Focus / Routine / Easy) and a toggle for "Sort by block type" (groups items under likely block type headers vs default priority sort)
- **Three priority tiers** rendered as one continuous list with visual distinction:
  - **Urgent tier (top):** Overdue items, items with deadlines this week, provisional calendar events needing classification. Warm background tint, urgency indicator.
  - **Normal tier (middle):** Ad-hoc captures, outside requests. Neutral styling. Captures always land here.
  - **Suggested tier (bottom):** Recurring proposals, system suggestions, nice-to-do items. Lower visual weight, slightly muted.
- **Each item shows:** energy dot, name, emotional weight indicator (◆ for heavy), source badge, duration range, value tags
- **Items are draggable** onto blocks in the week grid
- **Dismiss button** (×) per item — removes from this session, logs event, silently lowers future priority for this type
- **Quick capture input** at bottom: text field, Enter to submit

**Center Panel: Week Grid**

- **Block type palette** above the grid as a horizontal strip of draggable chips. Collapsible. Shows icon + name + duration for each active block type.
- **Day headers:** Mon–Sun with date. Today highlighted.
- **Prev/Next week** buttons in the modal header.
- **Time grid:** Time-proportional rows. 1 hour = a fixed pixel height (suggest 60px per hour). Hours labeled on the left edge (6am through 10pm, or configurable). Each day is a column.
- **Pre-populated content:**
  - Fixed commitment calendar events rendered as hard blocks at their correct times. Brown (#9E6A46) styling, locked, cannot be moved or resized.
  - Info calendar events rendered as translucent background bands at their time range. Not blocks. Subtle label.
  - Provisional calendar events shown at their time with "?" badge and dashed border. Clickable to classify.

**Placing blocks:**

1. User drags a block type chip from the palette onto a day column at a desired time
2. The block **snaps to the nearest hour or half-hour** starting mark
3. The block renders at its default duration length (e.g. Focus = 50 min, Outing = 120 min)
4. The **bottom edge is draggable** — user grabs it and extends or shrinks the block to the desired duration. An Outing dropped at 8am and dragged to 2pm becomes a 6-hour block.
5. Duration updates in real time as the user drags. Snaps to 15-minute increments.
6. The block saves immediately on drop/resize.

**Placing items:**

1. User drags a Hopper item onto a block in the week grid
2. The item appears inside the block
3. The block shows **fill level** — a subtle progress indicator showing total item duration vs block duration. If items exceed block duration, show a warning tint (not a hard prevent).
4. **Mismatch warning:** If an item's likely block type doesn't match the block it's dropped on, show a subtle indicator (e.g. small ⚠️). Does not prevent placement.
5. Items inside blocks can be:
   - Dragged to a different block (same day or different day)
   - Returned to hopper via ← button
   - Marked complete via ✓ button (in case the user already did it)
6. Items saved immediately on placement.

**Right Panel: Summary** (collapsible)

Live-updating throughout both phases.

- **Values Coverage:** Which values are served by placed items this week, with counts. Sorted by frequency. Highlights values with zero coverage.
- **Energy Balance:** Bars showing A/B/C item distribution across the week.
- **Items Per Day:** Mini bar chart showing load per day.
- **Hopper Remaining:** Count of unplaced items. When zero, show a positive indicator.
- **Completed This Week:** Count with option to expand and see the list (the "happy place").

### Calendar Sync Indicator

In the modal header: a small indicator showing calendar connection status and last sync time. "Synced 2 min ago" or "Connect Calendar" button if not connected. Manual "Refresh" button to force re-sync.

### Incremental Saving

**Every user action saves to the database immediately:**

- Block placed → `time_blocks` INSERT with block_type_id, block_date, start_time, end_time, duration_minutes, sort_order
- Block resized → `time_blocks` UPDATE end_time and duration_minutes
- Block deleted → `time_blocks` DELETE
- Item placed on block → `schedule_items` INSERT or UPDATE with time_block_id, scheduled_date, scheduled_time. `hopper_items` status → 'activated'. `action_log` 'scheduled' event.
- Item returned to hopper → `schedule_items` DELETE. `hopper_items` status → 'pending'. `action_log` 'removed' event.
- Item dismissed → `hopper_items` status → 'dismissed'. `action_log` 'dismissed' event.
- Item marked complete → `schedule_items` status → 'completed'. `action_log` 'completed' event. Update `task_suggestions.last_completed_at` if linked.
- Calendar event classified → `calendar_event_classifications` INSERT or UPDATE. If fixed_commitment, create time_block. If flexible_commitment, create hopper_item.

**On modal close:** Nothing special needed. Everything is already saved. Reopening shows the current state.

**On modal reopen:** Load time_blocks and schedule_items for the displayed week. Load hopper_items with status 'pending'. Load calendar_events with classifications. Render current state.

---

## 5. Hopper Prioritization

### Priority Score Computation

Build a function `compute_hopper_priorities(user_id)` that runs when Organize opens and when hopper contents change. For each pending hopper_item, compute a priority_score:

**Factors (weighted):**

- **Deadline proximity:** Items with deadlines this week score higher. Items overdue score highest. Items with no deadline get a neutral score.
- **Overdue recurrence:** Task suggestions past their recurrence window score higher based on how overdue they are.
- **Value urgency:** Items linked to values with low scores (below sufficiency mark) get a boost. The further below sufficiency, the bigger the boost. This is how Values drive prioritization.
- **User behavior history:** Items repeatedly dismissed get a slight score reduction over time. Items the user frequently schedules promptly get a slight boost. This learning is silent — no UI for it.
- **Emotional weight:** Heavy items get a small boost (they need to be scheduled deliberately, not deferred indefinitely).
- **Source:** Outside requests get a small boost over system suggestions (someone is waiting).

**Tier assignment:**

- `urgent`: score above a threshold, OR has a deadline within 3 days, OR overdue
- `suggested`: source is 'template_proposal' AND score below a threshold AND no deadline pressure
- `normal`: everything else

### Block Type Hint

When computing priorities, also guess the best block type for each item based on its context tags, energy level, and activity type. Store as `block_type_hint` on the hopper_item. This enables the "sort by block type" view in the Hopper.

**Note:** The prioritization algorithm needs ongoing refinement. This initial implementation should be functional but is expected to evolve as usage data accumulates. The silent learning from user behavior is the most important long-term feature — every dismiss, defer, and placement shapes future suggestions.

---

## 6. API Routes

### Block Types — `/api/block-types`
- `GET` — all active block types for current user, ordered by sort_order
- `POST` — create (name, color, default_duration_minutes, energy_level, icon)
- `PATCH /api/block-types/[id]` — update fields
- `DELETE /api/block-types/[id]` — soft delete (is_active = false). Existing time_blocks keep their block_type_id.
- `POST /api/block-types/reorder` — batch update sort_order

### Focus Settings — `/api/focus-settings`
- `GET` — current user's focus duration setting
- `PATCH` — update default_focus_minutes (25, 50, or 75)

### Calendar — `/api/calendar/connect`
- `POST` — initiate OAuth flow, return redirect URL
- `GET /api/calendar/callback` — handle OAuth callback, store tokens
- `DELETE` — disconnect, remove tokens (preserve events and classifications)

### Calendar Sync — `/api/calendar/sync`
- `POST` — trigger sync. Accepts optional `{start_date, end_date}`. Returns event counts.
- `GET /api/calendar/events` — events for current user with classifications joined. Accepts `?start=&end=` filters.

### Calendar Classification — `/api/calendar/classify`
- `POST` — classify event or series. Accepts `{match_key, match_type, classification, display_label, energy_level, life_domain_id, notes}`.
- `GET /api/calendar/classifications` — all classifications for current user.
- `DELETE /api/calendar/classify/[id]` — remove (reverts to provisional).

### Calendar Settings — `/api/calendar/settings`
- `GET` — connection status, selected calendars, last sync.
- `PATCH` — update selected calendar_ids.

### Time Blocks — update `/api/time-blocks`
- Extend POST to accept `block_type_id`, `duration_minutes`, `focus_override_minutes`
- Extend PATCH to support resize (update end_time, duration_minutes)
- Existing reorder endpoint works as-is

### Hopper — update `/api/hopper`
- `POST /api/hopper/compute-priorities` — runs priority computation for current user. Updates priority_score, priority_tier, block_type_hint on all pending items.
- Extend GET to order by priority_tier (urgent first, suggested last) then priority_score descending within tier
- Extend GET to accept `?group_by=block_type` to return items grouped by block_type_hint

### Schedule Items — update `/api/schedule`
- Existing CRUD works. Ensure placement from hopper updates both schedule_items and hopper_items status in one transaction.
- Completion should update task_suggestions.last_completed_at and write action_log event.

---

## 7. Visual Design

All base rules from Session 2 apply (Source Sans 3, light background #FAFAF7, surfaces #FFFFFF, borders #E8E4DC).

### Modal
- 97vw × 95vh, max-width 1600px, border-radius 16px
- Backdrop: rgba(45,42,38,0.25) + blur(4px)

### Block Type Palette
- Horizontal strip, height ~48px when expanded, collapsible to a thin bar with expand icon
- Each chip: rounded pill, block type color as left border or background tint, icon + name + duration in compact layout
- Draggable — cursor changes to grab on hover

### Week Grid
- 1 hour = 60px height (adjustable via zoom if feasible, but 60px default)
- Hours labeled on left edge, 6am–10pm range
- Day columns separated by thin vertical lines (#F0EDE8)
- Today column: subtle warm tint (#C4725A at 3% opacity)
- Blocks: rounded corners (8px), colored by block type, show label + time range + item count
- Hard blocks: brown (#9E6A46), locked icon, no resize handle
- Info events: translucent band (block type color at 8% opacity) with small label
- Provisional events: dashed border, "?" badge
- Block resize: bottom edge shows a grab handle on hover, drag snaps to 15-min increments
- Block fill indicator: thin progress bar at bottom of block showing total item duration / block duration

### Hopper Panel
- Width: 300px expanded, ~40px collapsed (just a vertical label "Hopper" + expand icon)
- Priority tiers: urgent items have a subtle warm left border (#C4725A), suggested items have muted text and slightly reduced padding
- Items: compact cards matching energy color dots, source badges, value tags as in previous designs

### Summary Panel
- Width: 220px expanded, ~40px collapsed
- Values coverage: list with counts, values below sufficiency highlighted
- Energy bars: horizontal, colored by level
- Items per day: mini bar chart

### Drag and Drop Feedback
- Dragged items/blocks: 0.4 opacity at source
- Valid drop target: subtle highlight (energy color border + 5% background tint)
- Invalid/mismatch drop: ⚠️ indicator but still accepts the drop
- Block resize: live height update with duration tooltip

---

## What NOT to Build

- No Action/Day view for executing the plan (future session)
- No mobile-specific layout
- No AI enrichment of captures (future — captures land as raw text, enrich later)
- No writing to Google Calendar (read-only import only)
- No multi-provider calendar support (Google only)
- No background/cron calendar sync (on-open and manual only)
- No integrity score computation (stub the display)
- No Planning function input to hopper (future)
- No automatic outside_request detection from capture text
- No Time Template editor (blocks are placed manually per-week for now; template editor is a future optimization)
- No info events enabling scheduling suggestions ("you have childcare, schedule here")

---

## Verification

### Block Types
- New user gets 10 default block types seeded
- Block type palette shows all active types as draggable chips
- Block type editor: rename, change color/duration/energy, delete, create new, reorder
- Deleting a block type doesn't break existing time_blocks (they keep the reference but it's set null)
- Focus duration global setting works (25/50/75), new Focus blocks use it

### Week Grid
- 7-column time-proportional grid renders with hour labels
- Dragging a block type onto a day column places a block at the nearest hour/half-hour snap point
- Block renders at default duration, bottom edge is draggable to resize
- Resize snaps to 15-minute increments, duration updates live
- Block saves on drop and on resize
- Multiple blocks on the same day stack correctly without overlapping (warn if overlapping)
- Today column has subtle highlight

### Google Calendar
- "Connect Calendar" button initiates OAuth flow
- After connecting, user selects calendars to import
- Sync fetches events, stores locally
- Fixed commitment events render as hard blocks at correct times
- Info events render as background bands
- Provisional events show with "?" badge
- Clicking provisional opens classification popover
- Classifying saves immediately and re-renders
- Recurring event classification applies to all instances
- Manual refresh button re-syncs

### Hopper
- Items sorted by priority tier then score
- Urgent items visually distinct at top
- "Sort by block type" toggle groups items under block type headers
- Dragging item to a block in grid places it, updates hopper status, saves schedule_item, logs event
- Return-to-hopper button (←) on placed items works
- Dismiss removes and logs
- Quick capture creates new hopper item at normal tier
- Panel collapses and expands
- Remaining items persist after modal close
- Reopening shows current state

### Incremental Saving
- Place a block → close modal → reopen → block is there
- Place an item → close → reopen → item is in the block
- Dismiss an item → close → reopen → item is gone from hopper
- Complete an item → close → reopen → item shows completed
- No "save" button exists or is needed

### Summary Panel
- Values coverage updates as items are placed
- Energy balance bars update
- Items-per-day chart updates
- Hopper remaining count updates
- Completed count updates when items marked done
- Panel collapses and expands

### Full Flow
- Open Organize → calendar syncs → hard events populate grid → hopper loads with prioritized items
- User drags block types onto days, resizes as needed
- User drags hopper items into blocks
- Mismatch warnings show but don't prevent
- Block fill indicators show remaining capacity
- Summary panel reflects the plan taking shape
- User closes modal → everything saved
- User reopens → sees current state, can continue organizing or make changes
- Items completed during the week update the view
- Rescheduled items return to hopper

---

## Session 7 Preview (for context only — do not build)

Session 7 builds the Action view — the lightweight mobile-first day strip for executing the committed plan. Shows current time block, active task, what's next. Big "done" button. Quick capture. One-tap reschedule (item returns to hopper). Also begins AI enrichment of captures — raw text sent to Claude for field inference (context, energy, duration, value links, block type hint) with results applied as defaults on the hopper item.