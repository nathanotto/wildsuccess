# SESSION 4: The Organize Function

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Sessions 1–3 are complete.** The database has Map Module tables (values, life domains, activities with enriched template fields, big outcomes, activity/value links), intake system (questions, responses), hopper_items, and schedule_items. The Map page renders an SVG mind map. The intake flow populates values, life domains, and Activity templates from user responses. The hopper captures quick entries and template-derived proposals.

**Read these project files before doing anything:**
- `SESSION-1-PROMPT.md` — original database schema
- `SESSION-2-PROMPT.md` — Map page, API routes, visual design rules
- `SESSION-3-PROMPT.md` — intake system, enriched Activity templates, hopper, schedule_items
- `OrganizeModal.jsx` — **the visual design reference for Organize.** This is a working React mockup with fake data. Your job is to reproduce this design powered by real Supabase data. Match the layout, interactions, and feel. This file is the source of truth for how Organize looks and behaves.
- `wild-success-constitutional-reference.docx` — sections 2.4 (Vigilance and Systems), 4 (Design Methodology), 8 (Onboarding)
- `TASK-ORIENTED-DESIGN.md` — the dashboard is a task menu, not a data display

---

## Core Concept

Everything in Wild Success is a **template until activated**. Activities are recurring practice templates. Task suggestions are specific action templates derived from Activities. The hopper collects all proposals. **Organize is where templates become commitments.**

The user reviews what Wild Success proposes, decides what's real for today, and takes ownership. At day's end, they confirm what actually happened. The gap between intention and reality — over time — is the most honest and valuable data Wild Success produces.

Organize is a full-screen modal over the Map page with three modes:
1. **Setup** — build the day's plan, commit to it
2. **Reorg** — handle mid-day interruptions, reshuffle
3. **Capture** — close out the day, confirm completions, reflect

---

## 1. Schema Changes

### Migration: `supabase/migrations/004_organize.sql`

#### 1.1 New table: `task_suggestions`

Specific actionable items, optionally parented to an Activity template. These are what actually get proposed in the hopper and scheduled.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| activity_id | uuid | FK → activities, nullable — parent Activity template. Null = freestanding task |
| name | text | not null |
| description | text | nullable |
| recurrence | text | nullable, check in ('daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'seasonal', 'annual', 'one_time') |
| context | text[] | DEFAULT '{}' — e.g. 'computer-home', 'phone-anywhere', 'errand-out', 'focused-quiet' |
| energy_level | text | DEFAULT 'B', check in ('A', 'B', 'C') |
| emotional_weight | text | DEFAULT 'normal', check in ('light', 'normal', 'heavy') |
| duration_range_min | integer | nullable, minutes |
| duration_range_max | integer | nullable, minutes |
| flexibility | text | DEFAULT 'anytime_this_week', check in ('hard_scheduled', 'soft_scheduled', 'anytime_today', 'anytime_this_week') |
| preferred_days | text[] | nullable |
| preferred_time | text | nullable — 'morning', 'afternoon', 'evening' |
| life_domain_id | uuid | FK → life_domains, nullable, on delete set null |
| source | text | DEFAULT 'user_created', check in ('template_derived', 'user_created', 'outside_request', 'planning_function') |
| sort_order | integer | not null, default 0 — ordering within parent Activity |
| last_completed_at | timestamptz | nullable — denormalized for fast recurrence checks |
| is_active | boolean | not null, default true |
| archived_at | timestamptz | nullable |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Task suggestions can exist independently (renew passport, oil change) or as children of an Activity (yoga under Exercise, oil change under Car Maintenance).

#### 1.2 Add `completion_mode` to `activities`

```sql
ALTER TABLE activities ADD COLUMN completion_mode text DEFAULT 'any'
  CHECK (completion_mode IN ('all', 'any', 'sequence'));
```

- **all** — must complete every child task_suggestion to satisfy one cycle (month-end accounting)
- **any** — complete one child to satisfy (exercise: walk OR lift OR yoga)
- **sequence** — all children, in order (tax filing steps)

#### 1.3 New table: `time_blocks`

Containers for schedule_items on a given day. Instanced from the time template or created manually.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| block_date | date | not null |
| label | text | not null |
| start_time | time | nullable — null for unstructured blocks |
| end_time | time | nullable |
| context | text[] | DEFAULT '{}' |
| energy_level | text | DEFAULT 'B', check in ('A', 'B', 'C') |
| is_hard | boolean | not null, default false — true = immovable commitment (meeting, appointment) |
| sort_order | integer | not null, default 0 — position in the day |
| source | text | DEFAULT 'manual', check in ('manual', 'time_template', 'calendar_import') |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Hard-scheduled items like meetings ARE time_blocks with `is_hard = true`. A Zoom call is a hard block containing a single item. This unifies the model — every scheduled thing is a block; some hold one item, some hold many.

#### 1.4 Modify `schedule_items`

Add columns to support the Organize workflow:

```sql
ALTER TABLE schedule_items ADD COLUMN time_block_id uuid
  REFERENCES time_blocks(id) ON DELETE SET NULL;

ALTER TABLE schedule_items ADD COLUMN task_suggestion_id uuid
  REFERENCES task_suggestions(id) ON DELETE SET NULL;

ALTER TABLE schedule_items ADD COLUMN sort_order integer NOT NULL DEFAULT 0;

ALTER TABLE schedule_items ADD COLUMN committed_at timestamptz;
-- Set when the user clicks "Commit Plan" — marks this as intentional
```

#### 1.5 New table: `action_log`

Append-only event log. Every meaningful user action during Organize writes a row. This replaces `activity_log` and the old `day_log` for tracking purposes.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| event_type | text | not null, check in ('proposed', 'scheduled', 'committed', 'rescheduled', 'removed', 'completed', 'skipped', 'captured', 'dismissed') |
| schedule_item_id | uuid | FK → schedule_items, nullable, on delete set null |
| hopper_item_id | uuid | FK → hopper_items, nullable, on delete set null |
| activity_id | uuid | FK → activities, nullable, on delete set null |
| task_suggestion_id | uuid | FK → task_suggestions, nullable, on delete set null |
| event_date | date | not null |
| note | text | nullable |
| metadata | jsonb | nullable — extra context (what block it was in, what it displaced, etc.) |
| created_at | timestamptz | not null, default now() |

This log is append-only. Never update or delete rows. From this table you can derive:
- The committed plan for any day (all items with a 'committed' event)
- What actually happened (completed + skipped events)
- The gap between plan and reality
- Chronic avoidance patterns (many 'proposed', few 'completed')
- Interruption patterns (removed + captured events)
- Integrity score (committed-to-completed ratio over time)

#### 1.6 New table: `day_reflection`

Separated from the old day_log. The subjective end-of-day check-in.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| reflection_date | date | not null |
| mood_energy | integer | nullable, check between 1 and 5 |
| journal_note | text | nullable |
| plan_status | text | not null, default 'open', check in ('open', 'committed', 'closed') |
| committed_at | timestamptz | nullable — when the user committed the day's plan |
| closed_at | timestamptz | nullable — when the user closed out the day |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, reflection_date).

#### 1.7 Drop old tables

```sql
DROP TABLE IF EXISTS activity_log;
DROP TABLE IF EXISTS day_log;
```

The action_log and day_reflection tables replace these entirely. Existing functionality that read from activity_log or day_log must be updated to use the new tables.

**Important:** The heat computation API route (`/api/map/heat`) from Session 2 reads from activity_log. Update it to read from action_log where `event_type = 'completed'` instead.

#### 1.8 RLS and Indexes

Standard RLS (select/insert/update/delete own) on: `task_suggestions`, `time_blocks`, `action_log`, `day_reflection`.

Indexes:
- `task_suggestions.user_id`
- `task_suggestions.activity_id`
- `task_suggestions.is_active`
- `task_suggestions.last_completed_at`
- `time_blocks.user_id`
- `time_blocks.block_date`
- `time_blocks.sort_order`
- `action_log.user_id`
- `action_log.event_date`
- `action_log.event_type`
- `action_log.schedule_item_id`
- `action_log.activity_id`
- `day_reflection.user_id`
- `day_reflection.reflection_date`
- `schedule_items.time_block_id`
- `schedule_items.task_suggestion_id`
- `schedule_items.committed_at`

---

## 2. Hopper Population Logic

### Daily Proposal Generation

Build a function (database function or application-layer service): `generate_daily_proposals(user_id, target_date)`.

This runs on Map page load and/or when Organize opens. It:

1. Finds all active, non-archived Activity templates and task_suggestions for the user
2. For each, checks recurrence against completion history:
   - Use `task_suggestions.last_completed_at` and `recurrence` to determine if due
   - For Activities without child task_suggestions, use the Activity's own `frequency` and `preferred_days`
   - "Weekly" + preferred_day = propose on that day. No preferred day = propose on the first day of the week it hasn't been done
   - "Daily" = always propose
   - "Monthly" / "quarterly" / "seasonal" / "annual" = propose when the period has elapsed since last completion
   - Overdue items (past their expected recurrence window) get proposed with emphasis
3. Creates `hopper_items` with `source = 'template_proposal'` and `proposed_date = target_date`
4. Skips duplicates — if a pending or ignored hopper_item already exists for this task_suggestion + date, do not create another
5. Dismissed items: if the user dismissed this item today, do not re-propose today. It can re-propose tomorrow.

### Hopper Sources Summary

| Source | How it enters | Metadata |
|--------|--------------|----------|
| `template_proposal` | System generates from recurrence rules | Links to activity_id and/or task_suggestion_id |
| `quick_capture` | User types in capture input | Raw text, timestamp |
| `outside_request` | User captures, optionally tags who-asked | requested_by, deadline in metadata |
| `planning_function` | From missions/outcomes (future) | Links to big_outcome_id |

### Decay and Archive

Track non-engagement per template-derived hopper item through the action_log. If a task_suggestion's proposals accumulate 5 consecutive dismissed/ignored events with zero completed events, OR 3 weeks pass with no activation, prompt the user:

"You haven't put **[name]** on your schedule. Want to archive it?"

- Yes → set `task_suggestions.archived_at = now()`, stop proposing
- No → reset counter, keep proposing
- Archived items are hidden from the hopper but remain queryable. User can restore from a settings/archive view.

---

## 3. Organize Modal UI

### Opening Organize

The "Organize" button in the nav bar (currently a "Coming Soon" stub from Session 2) opens the Organize modal. It is a full-screen overlay (95%+ viewport) over the Map page, with the Map dimmed but visible behind.

### Layout: Three Panels

**Match `OrganizeModal.jsx` exactly.** The key elements:

#### Left Panel: Hopper (340px wide)

The list of everything the system thinks the user should consider today.

- **Header:** "Hopper" with item count, energy filter buttons (All / Focus / Routine / Easy)
- **Items:** Draggable cards showing:
  - Energy level dot (color-coded: A=#C4725A, B=#4B82AF, C=#7A9E82)
  - Name with emotional weight indicator (◆ for heavy items)
  - Source badge (◈ Suggested, ↗ Request, ✎ Captured, ◎ From Plan)
  - Duration range (e.g. "30–45m")
  - Value tags
  - For outside requests: who asked and context in italic
  - Reorder grip (⠿) on left — drag to reorder within hopper
  - Dismiss button (×) on right — removes from today's hopper, logs 'dismissed' event
- **Drop zone:** When dragging an item FROM the schedule back to the hopper, show a highlighted "← Drop here to unschedule" indicator. Items can be returned from blocks or unscheduled area back to the hopper.
- **Quick capture input** at bottom: text field, Enter to submit, creates hopper_item with source='quick_capture'
- **Filtering:** Energy level filter buttons reduce the visible list. "All" shows everything.

#### Center Panel: Day Plan (flex, fills remaining space)

The day being assembled from time blocks and unscheduled tasks.

- **Day selector:** Mon–Sun tabs across top. Selecting a day loads that day's time_blocks and schedule_items.
- **Time template toggle:** Checkbox "Show time template" — when on, matching blocks show a faded dashed border with "TEMPLATE" label as an underlay. This is the ideal week pattern behind the actual plan. (Time Template editor is "coming soon" — for now use a hardcoded default template or let users build blocks manually.)
- **Time blocks:** Stacked vertically, each showing:
  - Reorder grip (⠿) — drag to reorder blocks within the day (hard blocks cannot be reordered)
  - Color bar indicating energy level
  - Label + time range (e.g. "Morning Focus  8:00 – 10:00")
  - Energy type badge ("FOCUS TIME", "ROUTINE TIME", "EASY TIME")
  - Hard blocks show "COMMITTED" badge in brown (#9E6A46) and cannot be reordered or removed
  - Drop zone for items dragged from hopper
  - Scheduled items within the block, each showing:
    - Energy dot, name, emotional weight indicator, duration range
    - Return-to-hopper button (←) — sends item back to hopper
    - Hard items (within hard blocks) show fixed times and cannot be moved
  - **Inline add input** at bottom of each non-hard block: "+ Add task..." — type and Enter to create a schedule_item directly in this block
  - Empty state: "Drop [energy level] tasks here"
- **Add time block button** between blocks: "+ Add time block" expands an inline form with fields for name, start time, end time, and energy level selector. Blocks can be inserted at any position.
- **Unscheduled tasks area** below blocks: dashed border, "To-dos (no specific time)". Items here have `flexibility = 'anytime_today'` and no time_block_id. Has its own inline add input: "+ Add to-do..."
- **Google Calendar stub:** "Google Calendar integration: coming soon"

#### Right Panel: Context (240px wide)

Live-updating summary of the day being assembled.

- **Day at a Glance:** List of all time blocks with item counts
- **Energy Balance:** Horizontal bars showing count of A/B/C items scheduled. Helps the user see if they're overloading focus time or have too many heavy items.
- **Values Served Today:** List of values touched by scheduled items, with counts. Sorted by frequency. Shows which values are getting attention and which aren't.
- **Heavy Items Warning:** If any scheduled items have `emotional_weight = 'heavy'`, show a callout: "◆ Heavy items today" with the list and a gentle note: "Consider scheduling these during your best energy"
- **Integrity Score:** Stubbed as "Coming soon — committed vs. completed over time"

### Three Modes

#### Setup Mode (default)

Full three-panel layout. User drags items from hopper into time blocks or unscheduled area. Creates new blocks and items inline. All changes write to the database in real time (optimistic UI with background saves).

**Commit Plan button** appears in the header when items are scheduled. Clicking it:
1. Sets `committed_at = now()` on all schedule_items for today
2. Sets `day_reflection.plan_status = 'committed'` and `day_reflection.committed_at = now()`
3. Writes a 'committed' event to action_log for each schedule_item
4. Shows "✓ Plan committed" confirmation

After committing, the user can still modify the plan (this is Reorg). But the committed snapshot exists in the action_log.

#### Reorg Mode

Same layout as Setup. The user can reshuffle items, add new ones, return items to hopper. Every change writes to action_log:
- Moving an item to a different block → 'rescheduled' event
- Removing an item → 'removed' event
- Adding a new item mid-day → 'captured' event

The header shows mode as "Reorg" to signal the user is reshuffling, not starting fresh.

#### Capture Mode

Center panel switches to a single-column checklist (max-width 640px, centered). Hopper panel hides — this is about closure, not new input.

- **Checklist:** All scheduled items (from blocks and unscheduled) listed with:
  - Checkbox for "done" (green border when checked, strikethrough on name)
  - "Didn't do" button (red-tinted when active, name dims)
  - Block name and time shown as context
  - Each check/uncheck writes to action_log ('completed' or 'skipped' event)
- **Reflection section** below the checklist:
  - Energy/Mood: 1–5 scale buttons
  - Freetext textarea: "How was today? (optional)"
  - "Custom reflection form: coming soon" note
- **Close Day button:** Sets `day_reflection.plan_status = 'closed'`, `day_reflection.closed_at = now()`. Updates `task_suggestions.last_completed_at` for completed items. Writes to action_log.

---

## 4. Data Flow: Template → Hopper → Schedule → Log

The complete lifecycle of an action in Wild Success:

```
Activity Template
  └── Task Suggestion (specific action, with recurrence)
        └── Hopper Item (proposed for a date)
              └── Schedule Item (committed to a time block or unscheduled)
                    └── Action Log Event (completed / skipped / rescheduled / removed)
```

1. **Proposal:** `generate_daily_proposals` creates hopper_items from due task_suggestions → logs 'proposed' event
2. **Scheduling:** User drags hopper item into a time block → creates schedule_item, links hopper_item_id, updates hopper status to 'activated' → logs 'scheduled' event
3. **Commitment:** User clicks "Commit Plan" → sets committed_at on schedule_items → logs 'committed' event per item
4. **Reorg:** User moves/removes items mid-day → logs 'rescheduled' or 'removed' events
5. **Capture:** User marks items done/skipped → logs 'completed' or 'skipped' events
6. **Close:** Day closes → day_reflection updated, task_suggestion.last_completed_at updated for completed items

Items created directly (inline add in blocks, quick capture that gets immediately scheduled) skip the hopper and go straight to schedule_items. They still get logged.

---

## 5. API Routes

### Task Suggestions — `/api/task-suggestions`
- `GET` — all active task_suggestions for current user. Accepts `?activity_id=` filter. Ordered by sort_order.
- `POST` — create (name, activity_id, recurrence, context, energy_level, etc.)
- `PATCH /api/task-suggestions/[id]` — update fields
- `DELETE /api/task-suggestions/[id]` — remove (cascade: hopper_items referencing this get nulled)

### Time Blocks — `/api/time-blocks`
- `GET` — blocks for current user. Accepts `?date=YYYY-MM-DD` filter. Ordered by sort_order.
- `POST` — create (label, block_date, start_time, end_time, energy_level, is_hard, sort_order)
- `PATCH /api/time-blocks/[id]` — update fields (label, times, energy_level, sort_order)
- `DELETE /api/time-blocks/[id]` — remove. Schedule_items in this block get time_block_id set to null.
- `POST /api/time-blocks/reorder` — accepts array of {id, sort_order} to batch-update positions

### Schedule Items — update existing `/api/schedule`
- Extend POST to accept `time_block_id` and `task_suggestion_id`
- Extend PATCH to support moving between blocks (update time_block_id), reordering (sort_order), and committing (committed_at)
- `POST /api/schedule/commit` — batch-commits all schedule_items for a given date. Sets committed_at on items, creates action_log 'committed' events, updates day_reflection.
- Completing a schedule_item (status → 'completed') should:
  - Create an action_log 'completed' event
  - Update task_suggestion.last_completed_at if task_suggestion_id is set
  - Update activity heat (previously done via activity_log, now via action_log)

### Hopper — update existing `/api/hopper`
- `POST /api/hopper/propose` — runs generate_daily_proposals for a given date
- When a hopper item is activated (dragged to schedule), update its status and create the schedule_item in one transaction
- `POST /api/hopper/reorder` — batch-update sort positions

### Action Log — `/api/action-log`
- `POST` — create event (event_type, schedule_item_id, event_date, note, metadata). Most events are created automatically by other operations, but this endpoint exists for direct logging.
- `GET` — events for current user. Accepts `?date=`, `?event_type=`, `?schedule_item_id=` filters. Ordered by created_at.
- No update or delete — append-only.

### Day Reflection — `/api/day-reflection`
- `GET` — accepts `?date=YYYY-MM-DD`. Returns the reflection for that date, or null.
- `POST` — create or update (upsert on user_id + reflection_date). Fields: mood_energy, journal_note, plan_status, committed_at, closed_at.

### Daily Proposals — update `/api/hopper/propose`
- Accepts `{target_date}`. Runs generate_daily_proposals. Returns created hopper items.

### Heat Computation — update `/api/map/heat`
- Change to read from `action_log` where `event_type = 'completed'` instead of the old `activity_log` table.
- Decay calculation remains the same but uses action_log.created_at as the completion timestamp.

---

## 6. Updating the Map Page

### Nav Bar Changes

- Replace the "Organize" Coming Soon stub with a real button that opens the Organize modal
- The Organize button should show a badge with the count of pending hopper items if > 0

### Heat Computation Update

Update the heat computation to read from action_log instead of activity_log. The logic is the same:
- For each activity-value link, find most recent action_log entry where event_type = 'completed' and activity_id matches
- Decay and weighting calculations unchanged

### Overdue Activities

Overdue detection should now also consider task_suggestions. A task_suggestion is overdue when:
- It is active and not archived
- Its recurrence period has elapsed since last_completed_at (or since created_at if never completed)
- It has no pending hopper_item for today

---

## 7. Visual Design Rules

All rules from Session 2 apply. Additionally:

- **Organize modal:** 96vw × 93vh, max-width 1500px, centered, border-radius 16px
- **Behind the modal:** Map dimmed with rgba(45,42,38,0.25) backdrop + blur(4px)
- **Font:** Source Sans 3, same as Map
- **Energy colors:** A = #C4725A (focus/warm), B = #4B82AF (routine/blue), C = #7A9E82 (easy/green)
- **Hard commitment color:** #9E6A46 (brown, from the Map's protect palette)
- **Borders:** #E8E4DC for default, energy color for active/hover states
- **Backgrounds:** white for panels and cards, #FAFAF7 for the modal body and subtle backgrounds, #F5F3EF for muted surfaces
- **Drag feedback:** dragged items fade to 0.4 opacity, drop targets highlight with energy color border and subtle tinted background
- **Time template underlay:** dashed border at 35% opacity of energy color, background at 5% opacity, tiny "TEMPLATE" label at top-right

---

## What NOT to Build

- No Time Template editor (future — for now hardcode a default day template or let users build blocks manually)
- No Google Calendar integration (future, stubbed as "coming soon")
- No Right Now view (future, "coming soon")
- No Planning function input (future)
- No mobile-specific layouts
- No AI parsing of quick captures into structured data (future)
- No automatic outside_request detection from capture text (future)
- No integrity score computation (future — stub the display)
- No drag-and-drop of items between days (only within a single day for now)

---

## Verification

After building:

### Schema
- Migration runs without errors
- activity_log and day_log tables are dropped
- task_suggestions table exists with correct columns and constraints
- time_blocks table exists
- schedule_items has new columns (time_block_id, task_suggestion_id, sort_order, committed_at)
- action_log is append-only (no update/delete policies)
- Heat computation still works using action_log instead of activity_log

### Hopper
- Opening Organize triggers generate_daily_proposals
- Proposals appear for due/overdue task_suggestions and Activities
- No duplicate proposals for same task+date
- Dismissed items don't re-propose same day, but do re-propose next day
- Quick capture creates hopper_item and shows in the list immediately
- Hopper items can be reordered by dragging the grip handle
- Energy filter buttons correctly filter the hopper list
- Dismissing an item removes it from the list and logs a 'dismissed' event

### Time Blocks
- Default blocks appear for a new day (from hardcoded template or user's custom blocks)
- Blocks can be reordered by dragging
- Hard blocks cannot be reordered
- New blocks can be created via the inline form at any position
- Blocks show the time template underlay when toggle is on

### Scheduling
- Drag item from hopper to block → creates schedule_item in that block, hopper status → 'activated', logs 'scheduled' event
- Drag item from hopper to unscheduled area → same but no time_block_id
- Drag item between blocks → updates time_block_id, logs 'rescheduled' event
- Return item to hopper (← button or drag back) → deletes schedule_item, hopper status → 'pending', logs 'removed' event
- Inline add in block → creates schedule_item directly, no hopper involvement
- Inline add in unscheduled → same, no time_block_id

### Commit
- "Commit Plan" button appears when items are scheduled
- Clicking sets committed_at on all items for today
- day_reflection.plan_status → 'committed'
- Action_log gets 'committed' events for each item
- "✓ Plan committed" confirmation shows

### Capture Mode
- Switching to Capture shows checklist of all scheduled items
- Checking "done" → action_log 'completed' event, green border
- Clicking "Didn't do" → action_log 'skipped' event, dimmed appearance
- Reflection: mood/energy selector and journal textarea save to day_reflection
- "Close Day" → day_reflection.plan_status → 'closed', closed_at set
- Completed items update task_suggestion.last_completed_at
- Map heat recalculates on next load

### Right Panel
- Day at a Glance shows correct item counts per block
- Energy Balance bars update as items are added/removed
- Values Served Today shows values from scheduled items
- Heavy items warning appears when emotionally heavy items are scheduled

### Action Log Integrity
- Every user action in Organize creates an appropriate action_log event
- Log events have correct references (schedule_item_id, hopper_item_id, activity_id, task_suggestion_id)
- Log is append-only — no events are updated or deleted
- Querying the log for a given date reconstructs the day's complete history

---

## Session 5 Preview (for context only — do not build)

Session 5 builds the Right Now view — the in-the-moment execution view showing the current time block, active task, next up, and a minimal interface for marking items complete or capturing interruptions. Also adds the Time Template editor for defining the ideal week pattern that feeds into Organize's block structure. May also add basic integrity score computation from the action_log.