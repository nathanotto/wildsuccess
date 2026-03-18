# SESSION 9: The Today Page

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Previous sessions built:** Map Module (values, life domains, activities, big outcomes), Organize Week modal (block types, hopper, time-proportional week grid), schema with schedule_items, hopper_items, time_blocks, action_log, task_suggestions, task_suggestion_value_links.

**This session builds the /today page** — a flat, dense, phone-friendly to-do and schedule view for executing the day's plan. It is not a modal. It is a standalone page. It should feel like SimpleNote with a schedule attached — minimal, fast, no visual clutter.

**Read these project files before doing anything:**
- `SESSION-8-PROMPT.md` — the most recent schema (time_type, bounding_type, value layers, hopper logic)
- `SESSION-6-PROMPT.md` — Organize Week modal, block types, how schedule_items get created
- `wild-success-constitutional-reference.docx` — section 5 (Agency)
- `TASK-ORIENTED-DESIGN.md` — the user should see ONLY what is most relevant

**Design reference:** The V7 mockup developed in conversation. The Today page has two views: a flat list and a focus view. The focus view replaces the list when entered, with a back arrow to return. The design is intentionally plain — one font, one size, square checkboxes, no tags or badges on the list, no rounded anything.

---

## Core Principle

The Today page is where the user lives during the day. It must not demand attention. It passes ammunition to a busy person — here's what to do, check it off, capture new things, move on. The user should be able to glance at it in 2 seconds and know what's next.

The Organize session already decided what's on today's list and in what order. Today inherits that. The user does not re-plan here. They execute, capture, and handle the messy middle when tasks turn complicated.

---

## 1. Schema Changes

### Migration: `supabase/migrations/009_today_page.sql`

#### 1.1 Add item states to schedule_items

```sql
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_status_check;
ALTER TABLE schedule_items ADD CONSTRAINT schedule_items_status_check
  CHECK (status IN ('active', 'in_progress', 'completed', 'skipped', 'rescheduled', 'parked'));
```

New states:
- `in_progress` — user has started working on this. Checkbox shows a dot.
- `parked` — user chose "done for today" in the focus view. Item rests until tomorrow. Checkbox shows half-fill.

Existing states remain: `active` (not started), `completed` (done), `skipped` (didn't do), `rescheduled` (sent back to hopper).

#### 1.2 Add reopened event type to action_log

```sql
ALTER TABLE action_log DROP CONSTRAINT IF EXISTS action_log_event_type_check;
ALTER TABLE action_log ADD CONSTRAINT action_log_event_type_check
  CHECK (event_type IN ('proposed', 'scheduled', 'committed', 'rescheduled', 'removed', 'completed', 'skipped', 'captured', 'dismissed', 'reopened', 'parked', 'in_progress'));
```

New event types:
- `reopened` — user unchecked a completed item, reversing it to active.
- `parked` — user chose "done for today" in focus view.
- `in_progress` — user moved item from open to in-progress.

#### 1.3 New table: `item_notes`

Notes and steps captured in the focus view.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| schedule_item_id | uuid | FK → schedule_items, not null, on delete cascade |
| note_type | text | not null, check in ('note', 'step') |
| content | text | not null |
| is_completed | boolean | not null, default false — for steps only |
| sort_order | integer | not null, default 0 — for step ordering |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

RLS: standard select/insert/update/delete own.

Indexes:
- `item_notes.user_id`
- `item_notes.schedule_item_id`
- `item_notes.note_type`

Notes have `note_type = 'note'` and store timestamped log entries from the focus view. Steps have `note_type = 'step'` and are checkable sub-tasks. Both are simple rows — no nesting, no hierarchy.

#### 1.4 Add parked date tracking

```sql
ALTER TABLE schedule_items ADD COLUMN parked_until date;
```

When an item is parked ("done for today"), set `parked_until` to tomorrow's date. The daily query includes parked items only when `parked_until <= today`. This means parked items reappear the next day automatically.

---

## 2. The Today Page

### Route: `/today`

A standalone Next.js page. Not a modal. Accessible from the nav bar.

### Data Loading

On page load:
1. Fetch schedule_items for the selected date (default: today), ordered by:
   - Time-locked items sorted by scheduled_time
   - Non-time-locked items in their Organize-assigned sort_order
2. Fetch item_notes for all loaded schedule_items
3. Include parked items where `parked_until <= selected_date` (they wake up today)

### Layout

Three sections, top to bottom, in this order:

**Day tabs** at the top: Yesterday / Today / Tomorrow. Plain text, not buttons. Active day is bold. Yesterday is brick red (#B8443E). Tomorrow is slate blue (#4B6A82). Tapping switches the date and reloads data.

**To-do section** — items without a fixed time (scheduled_time is null). Priority order from Organize (sort_order). Four visual states based on schedule_item.status:

| Status | Checkbox | Text | Position |
|--------|----------|------|----------|
| active | empty square | normal | top of list |
| in_progress | square with dot | normal, with next-step preview in muted text | top of list |
| parked | half-filled square | muted but not struck through | below active items |
| completed | checked square | struck through, faded | bottom of list |

Each item shows:
- Checkbox (tap cycles: open → in_progress → completed → open)
- Item name
- If in_progress and has a current step: "— [next step text]" in muted 12px after the name
- ↺ icon on the right: send back to hopper
- Tap the row (not the checkbox, not ↺) to enter focus view

**Schedule section** — items with a fixed time (scheduled_time is not null). Chronological order. Each shows:
- Time on the left (12px, muted, right-aligned, 44px wide)
- Checkbox
- Item name
- ↺ icon and focus arrow same as to-do items

A "now" line appears between the last past item and the next future item:
- `— now [current time] —`
- Warm color (#C4725A), 12px
- Only visible on Today, not on Yesterday or Tomorrow

**"Next up" line** below the day tabs, above the to-do section:
- Shows the next time-locked item: "Next up: Call with Casey at 2:00p"
- If no upcoming time-locked item today: nothing shown
- 12px muted text

**Stats line** below the day tabs:
- "[N] done · [N] in progress · [N] to-do"
- 12px muted text
- Updates in real time as items change state

**Capture input** — always at the very bottom of the page.
- Plain text input, no border except a top hairline
- Placeholder: "capture..."
- Enter submits: creates a hopper_item with source='quick_capture', status='pending'
- The new capture appears in the to-do section after hopper scoring runs (or at the bottom of to-do if scoring is deferred)
- Input clears after submit

### Item Interactions

**Checkbox tap cycle:**
- Open (empty) → tap → in_progress (dot). Writes action_log 'in_progress' event.
- In_progress (dot) → tap → completed (check). Writes action_log 'completed' event. Updates schedule_item.status and task_suggestion.last_completed_at.
- Completed (check) → tap → open (empty). Writes action_log 'reopened' event. Reverts schedule_item.status to 'active'. Clears task_suggestion.last_completed_at if this was the most recent completion.

Three-state cycle. The fourth state (parked) is only reachable from the focus view.

**↺ button:**
- Sends the item back to the hopper.
- Deletes the schedule_item (or sets status to 'rescheduled').
- Creates a hopper_item with status='pending', preserving the original source and metadata.
- Writes action_log 'rescheduled' event.
- The item disappears from the Today list.

**Row tap → focus view:**
- Tapping anywhere on the row EXCEPT the checkbox and ↺ icon enters the focus view for that item.
- The tap target should be generous — the full row width minus the interactive elements on the edges.
- On mobile, this is the primary way to interact with an item beyond checking it off.

---

## 3. The Focus View

### What it is

A separate view that replaces the Today list. Back arrow at top returns to the list. The focus view shows everything about one item — the messy middle of getting it done.

### Layout — top to bottom

**Back button:** "← today" in muted text. Returns to the list.

**Title:** The item name, 16px bold. Editable — the user can tap and change it. If changed, the old title is preserved as the first completed step (auto-demoted). This handles the case where "Schedule SimonMed imaging" evolves into "Get imaging results to Grossman."

When the title is edited:
1. The old title text becomes a new item_note with note_type='step', is_completed=true, sort_order=0.
2. The schedule_item.name updates to the new title.
3. A brief muted italic line appears below the title: "was: [old title]" — visible for a few seconds or until the user scrolls.

**Context line:** Value tags and urgency, 11px muted. Example: "Health · must today". This is the only place value information appears — not on the list.

**Next section:**
- Header: "Next" in 11px uppercase muted
- The current step — highlighted row with a checkbox. 14px, same density as the list. This is the one thing to do right now.
- Below it: an input field "next step after this..."
- When the user checks the current step:
  - It moves to the Done section
  - The "next step after this" content (if typed) promotes to become the new current step
  - If nothing was typed in the input, the Next section shows an empty input: "what's next?"
  - Writes action_log 'completed' event for the step (store step reference in metadata)
- If there is no current step (item just opened, or all steps completed), show only the input: "what's next?"

**Done section:**
- Header: "Done" in 11px uppercase muted
- Completed steps listed in reverse chronological order (most recent at top)
- Each shows a small filled checkbox and struck-through text
- This section grows as the user works. It provides the satisfaction of seeing progress accumulate.
- Only visible when at least one step has been completed.

**Notes section:**
- Header: "Notes" in 11px uppercase muted
- Timestamped log entries, each on one line: `[time]  [text]`
- Time is 11px muted, left-aligned, 38px wide
- Text is 12px muted
- Input at bottom: "add note..." with left padding to align with note text
- Timestamp auto-generated on submit (current time in 12-hour format: 9:15a, 2:30p)
- Notes are stored as item_notes with note_type='note'

**Bottom actions:**
- "→ Mark done" — completes the parent item. All incomplete steps are abandoned (left as-is, not force-completed). Writes action_log 'completed' event.
- "→ Done for today" — parks the item. Sets status='parked', parked_until=tomorrow. Writes action_log 'parked' event. Returns to the list. The item shows the half-filled checkbox and sinks below active items.
- "↺ Send back to hopper" — same as the ↺ on the list. Returns to the list.

**"Next up" reminder:**
- At the very bottom, a line showing the next time-locked item: "Next up: Call with Casey at 2:00p"
- Keeps the user oriented while focused on the current task.

### Focus View for Time-Locked Items

Meetings and appointments get the same focus view but with an additional section:

**Meeting notes section** (replaces or supplements the Notes section for time-locked items):
- Same format: timestamped entries
- But with an additional input at the bottom: "+ add follow-up..."
- Follow-ups typed here create new hopper_items with source='quick_capture' and metadata linking back to this schedule_item. They appear in the Today to-do list (or in the hopper for future scheduling).

This handles the "I'm in a meeting and want to capture an action item" case.

---

## 4. Parked Items

### Behavior

When an item is parked ("done for today"):
1. `schedule_item.status = 'parked'`
2. `schedule_item.parked_until = tomorrow's date`
3. Action_log gets a 'parked' event
4. Item shows on Today's list with half-filled checkbox, muted text, positioned below active and in-progress items but above completed items
5. The user can tap it to re-enter the focus view and continue working, or tap the checkbox to change its state

### Next Day

When Tomorrow becomes Today:
- Parked items with `parked_until <= today` reappear as in_progress (their status before parking was in_progress, so they return to that state)
- Their notes and steps are intact
- They appear in the to-do section in their original sort_order

### Extended Parking

If an item stays parked for more than 3 days without being touched, the system could prompt: "This has been parked since [date]. Still working on it?" with options to continue, send to hopper, or mark done. This is a future enhancement — do not build in this session, just note it.

---

## 5. API Routes

### Today Data — `/api/today`
- `GET ?date=YYYY-MM-DD` — returns schedule_items for the date with their item_notes, ordered appropriately (to-do by sort_order, schedule by time). Includes parked items where parked_until <= date. Also returns the "next up" time-locked item.

### Item Status — `/api/schedule/[id]/status`
- `PATCH` — accepts `{ status }`. Handles all state transitions:
  - active → in_progress: writes action_log 'in_progress'
  - in_progress → completed: writes action_log 'completed', updates task_suggestion.last_completed_at
  - completed → active: writes action_log 'reopened', clears task_suggestion.last_completed_at if most recent
  - any → parked: writes action_log 'parked', sets parked_until
  - any → rescheduled: writes action_log 'rescheduled', creates hopper_item, removes schedule_item from today

### Item Title — `/api/schedule/[id]/title`
- `PATCH` — accepts `{ name }`. If the name changed, creates an item_note (step, completed) with the old name. Updates schedule_item.name.

### Item Notes — `/api/item-notes`
- `GET ?schedule_item_id=` — notes and steps for an item, ordered by created_at (notes) or sort_order (steps)
- `POST` — create (schedule_item_id, note_type, content). Auto-sets created_at for timestamp.
- `PATCH /api/item-notes/[id]` — update content or is_completed
- `DELETE /api/item-notes/[id]` — remove

### Step Completion — `/api/item-notes/[id]/complete`
- `PATCH` — marks a step as completed. Sets is_completed=true. Writes action_log 'completed' event with step reference in metadata.

### Capture — `/api/today/capture`
- `POST` — accepts `{ raw_input }`. Creates hopper_item with source='quick_capture'. Runs hopper scoring to determine position. Returns the item for display.

### Follow-ups — `/api/today/follow-up`
- `POST` — accepts `{ raw_input, source_schedule_item_id }`. Creates hopper_item with source='quick_capture' and metadata linking to the source meeting/item.

---

## 6. Nav Bar Update

Add "Today" to the nav bar. It should be prominent — this is where the user lives during the day.

- Position: next to "Organize" in the nav
- Clicking navigates to `/today`
- Show a badge with the count of active + in_progress items for today (not completed, not parked)
- If no items for today: no badge

---

## 7. Visual Design

### General

- Font: Source Sans 3, 14px for item names, 12px for secondary text (times, notes, stats), 11px for section headers
- Background: transparent / page default (#FAFAF7)
- Max-width: 480px, centered. This is a phone-first layout that also works on desktop.
- No rounded corners anywhere
- No tags, pills, or badges on the list view
- No color except: brick red (#B8443E) for yesterday tab, slate blue (#4B6A82) for tomorrow tab, warm (#C4725A) for the "now" line and in-progress dot

### Checkboxes

All checkboxes are 14px × 14px squares with 1.5px border, border-radius 2px.

| State | Appearance |
|-------|-----------|
| active | Empty square, border color: #B5B0A8 |
| in_progress | Empty square with 6px × 6px filled square centered inside, fill color: #C4725A, border color: #C4725A |
| completed | Filled square with "✓", fill color: #8A857D, border color: #8A857D |
| parked | Bottom half filled, fill color: #B5B0A8, border color: #B5B0A8 |

### Focus View

- Same font sizes and density as the list
- Title: 16px, font-weight 600
- Context line: 11px, muted
- Current step: highlighted with subtle background tint (#FAFAF7 or equivalent)
- Completed steps: 13px, struck through, 40% opacity
- Notes: 12px, timestamps 11px on left (38px wide), note text in muted color
- Inputs: no border except bottom hairline, same font, transparent background
- Back button: "← today" in 13px muted text
- Bottom actions: plain text with → prefix, 12px, muted, tappable

### ↺ Icon

The hopper-return icon. Render as a circular arrow — can be an SVG icon or a Unicode character (↺ U+21BA). Size: 16px. Color: muted (#8A857D). Tap target: at least 32px × 32px for phone use even though the icon is smaller.

---

## What NOT to Build

- No drag-and-drop reordering of items
- No block types or time type indicators on the list
- No value tags on the list (only in focus view context line)
- No summary panel, energy balance, or stats beyond the simple count line
- No week view — that's Organize
- No AI enrichment on this page
- No Planning function integration
- No extended parking prompts (future)
- No mobile-native features (push notifications, etc.)
- No dark mode

---

## Verification

### List View
- /today loads with schedule_items for today
- To-do section shows non-time-locked items in sort_order
- Schedule section shows time-locked items in chronological order
- "Now" line appears between past and future time-locked items
- Stats line shows correct counts, updates in real time
- "Next up" shows the next time-locked item
- Yesterday/Today/Tomorrow tabs switch dates and reload

### Checkbox Cycle
- Tap empty → dot (in_progress), action_log event written
- Tap dot → check (completed), action_log event written, task_suggestion updated
- Tap check → empty (reopened), action_log event written, task_suggestion reverted
- All state changes reflect immediately in the list (item repositions, text style changes)

### ↺ Hopper Return
- Tap ↺ → item disappears from list, hopper_item created, action_log 'rescheduled' event
- The item preserves its original source and metadata in the hopper

### Focus View
- Tap row → list replaced by focus view
- ← today → returns to list
- Title editable → old title becomes completed step
- Next section: current step visible, input for next step below
- Check current step → moves to Done, next input promotes
- Notes: add note → appears with timestamp, persists on reload
- "→ Mark done" → item completed, return to list
- "→ Done for today" → item parked, half-fill checkbox on list, returns to list
- "↺ Send back to hopper" → item removed, hopper_item created, return to list

### Parked Items
- Parked item shows half-filled checkbox on today's list
- Parked item positioned below active, above completed
- Next day: parked item reappears as in_progress
- Notes and steps survive parking

### Capture
- Type in capture input, hit Enter → hopper_item created
- New capture appears in to-do section
- Input clears after submit

### Follow-ups (focus view for meetings)
- Type a follow-up in meeting focus view → hopper_item created with link to source
- Follow-up appears in to-do or hopper

### Data Integrity
- All state changes write to action_log with correct event types
- Completed items update task_suggestion.last_completed_at
- Reopened items revert task_suggestion.last_completed_at
- Item notes persist across focus view open/close
- Schedule_items preserve sort_order from Organize

---

## Session 10 Preview (for context only — do not build)

Session 10 builds Week Completion — the end-of-week review and reflection flow. Most items are already marked done/not-done from Today usage during the week. Week Completion summarizes what happened, lets the user resolve any remaining items, runs the values check-in (sufficiency reassessment for active values), and closes the week. The closed week becomes a frozen snapshot that feeds the Values Map for that week.