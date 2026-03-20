# SESSION 11: Action Items Refactor

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**The problem:** Action items are currently split across two tables — `hopper_items` (candidates for scheduling) and `schedule_items` (committed/scheduled items). This split causes bugs, duplicates, and conceptual confusion. "Committed but not scheduled" has no clean home. Moving items between tables requires coordinated updates that break integrity.

**The fix:** Merge both tables into a single `action_items` table. One row per item for its entire lifecycle. Status and date fields determine which view shows it. Every reference in the codebase — API routes, React components, queries, the capture parser, the /today page, the Organize modal — gets updated.

**Read these project files before doing anything:**
- `SESSION-8-PROMPT.md` — schema with hopper logic, time types, value links
- `SESSION-9-PROMPT.md` — /today page, focus view, item states, item_notes
- `SESSION-10-PROMPT.md` — capture parser, routing outcomes, known_people
- `wild-success-constitutional-reference.docx` — section 7 (The Commitment Cycle)

**Important:** This is a full refactor. Before starting, read every file in the project. Identify every reference to `hopper_items` and `schedule_items` in the codebase — API routes, React components, utility functions, type definitions, Supabase queries. You will update all of them.

---

## The Core Concept

An action item is a single entity that comes into existence, takes up the user's attention, moves through stages, and resolves. It is born once and lives through one lifecycle:

```
candidate → committed → (optionally scheduled) → in_progress → completed / parked / skipped
```

The user's experience maps to this lifecycle:

- **Organize:** "Here are candidates. I'll commit to some for this week."
- **Today:** "Here's what I committed to today. Some are scheduled at specific times, some are floating."
- **Doing:** "I'm working on this. It's in progress. Notes and steps accumulate."
- **Completing:** "Done. Or parked. Or skipped. Or rescheduled for another day."

There is no "move from hopper to schedule." There is no "activate a hopper item." There is one row, and its fields change as the user's relationship to it evolves.

---

## 1. Schema Changes

### Migration: `supabase/migrations/011_action_items.sql`

#### 1.1 Create the `action_items` table

```sql
CREATE TABLE action_items (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,

  -- Identity
  name text NOT NULL,
  raw_input text,
  description text,

  -- Origin
  source text NOT NULL DEFAULT 'quick_capture'
    CHECK (source IN (
      'quick_capture', 'template_proposal', 'outside_request',
      'planning_function', 'calendar_import', 'follow_up'
    )),
  item_type text NOT NULL DEFAULT 'task'
    CHECK (item_type IN (
      'task', 'appointment', 'commitment', 'outside_request', 'tickler', 'log_entry'
    )),

  -- Lifecycle
  status text NOT NULL DEFAULT 'candidate'
    CHECK (status IN (
      'candidate', 'committed', 'in_progress', 'completed',
      'parked', 'skipped', 'rescheduled', 'dismissed', 'archived'
    )),

  -- When
  proposed_date date,
  committed_date date,
  scheduled_time time without time zone,
  scheduled_end_time time without time zone,
  parked_until date,

  -- Classification
  bounding_type text DEFAULT 'action'
    CHECK (bounding_type IN ('time', 'action', 'outcome', 'unbounded')),
  time_type text DEFAULT 'B'
    CHECK (time_type IN ('A', 'B', 'C', 'D', '0')),
  flexibility text DEFAULT 'anytime_this_week'
    CHECK (flexibility IN (
      'hard_scheduled', 'soft_scheduled', 'anytime_today', 'anytime_this_week'
    )),
  emotional_weight text DEFAULT 'normal'
    CHECK (emotional_weight IN ('light', 'normal', 'heavy')),
  context text[] DEFAULT '{}',

  -- Relationships
  activity_id uuid,
  task_suggestion_id uuid,
  big_outcome_id uuid,
  time_block_id uuid,
  parent_action_item_id uuid,
  person_id uuid,

  -- Priority (computed by hopper logic)
  priority_score numeric DEFAULT 0,
  priority_tier text DEFAULT 'normal'
    CHECK (priority_tier IN ('urgent', 'normal', 'suggested')),
  sort_order integer NOT NULL DEFAULT 0,

  -- Enrichment (from capture parser)
  enrichment_status text DEFAULT 'none'
    CHECK (enrichment_status IN ('none', 'pending', 'enriched', 'confirmed', 'declined')),
  enrichment_data jsonb,
  enriched_at timestamptz,
  confirmed_at timestamptz,

  -- Proposal tracking (for template-derived items)
  last_proposed_at timestamptz,
  consecutive_dismissals integer DEFAULT 0,

  -- Commitment tracking
  committed_at timestamptz,
  committed_to_person_id uuid,

  -- Completion
  completed_at timestamptz,
  completion_note text,
  actual_duration_minutes integer,
  feelings text[],

  -- Metadata
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- Constraints
  CONSTRAINT action_items_pkey PRIMARY KEY (id),
  CONSTRAINT action_items_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT action_items_activity_id_fkey FOREIGN KEY (activity_id) REFERENCES activities(id) ON DELETE SET NULL,
  CONSTRAINT action_items_task_suggestion_id_fkey FOREIGN KEY (task_suggestion_id) REFERENCES task_suggestions(id) ON DELETE SET NULL,
  CONSTRAINT action_items_big_outcome_id_fkey FOREIGN KEY (big_outcome_id) REFERENCES big_outcomes(id) ON DELETE SET NULL,
  CONSTRAINT action_items_time_block_id_fkey FOREIGN KEY (time_block_id) REFERENCES time_blocks(id) ON DELETE SET NULL,
  CONSTRAINT action_items_parent_fkey FOREIGN KEY (parent_action_item_id) REFERENCES action_items(id) ON DELETE SET NULL,
  CONSTRAINT action_items_person_id_fkey FOREIGN KEY (person_id) REFERENCES known_people(id) ON DELETE SET NULL,
  CONSTRAINT action_items_committed_to_fkey FOREIGN KEY (committed_to_person_id) REFERENCES known_people(id) ON DELETE SET NULL
);
```

#### 1.2 RLS policies

```sql
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "action_items_select_own" ON action_items FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "action_items_insert_own" ON action_items FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "action_items_update_own" ON action_items FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "action_items_delete_own" ON action_items FOR DELETE USING (auth.uid() = user_id);
```

#### 1.3 Indexes

```sql
CREATE INDEX idx_action_items_user_id ON action_items(user_id);
CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_committed_date ON action_items(committed_date);
CREATE INDEX idx_action_items_proposed_date ON action_items(proposed_date);
CREATE INDEX idx_action_items_scheduled_time ON action_items(scheduled_time);
CREATE INDEX idx_action_items_activity_id ON action_items(activity_id);
CREATE INDEX idx_action_items_task_suggestion_id ON action_items(task_suggestion_id);
CREATE INDEX idx_action_items_parent_action_item_id ON action_items(parent_action_item_id);
CREATE INDEX idx_action_items_time_block_id ON action_items(time_block_id);
CREATE INDEX idx_action_items_person_id ON action_items(person_id);
CREATE INDEX idx_action_items_priority_score ON action_items(priority_score);
CREATE INDEX idx_action_items_time_type ON action_items(time_type);
CREATE INDEX idx_action_items_item_type ON action_items(item_type);
```

#### 1.4 Migrate existing data

Migrate schedule_items first (richer data), then remaining hopper_items:

```sql
-- Migrate schedule_items → action_items
INSERT INTO action_items (
  id, user_id, name, description, raw_input,
  source, item_type, status,
  committed_date, scheduled_time, scheduled_end_time,
  parked_until, bounding_type, time_type, flexibility,
  emotional_weight, context,
  activity_id, task_suggestion_id, time_block_id,
  sort_order, committed_at, completed_at, completion_note,
  actual_duration_minutes, metadata, created_at, updated_at
)
SELECT
  id, user_id, name, description, NULL,
  'quick_capture',
  CASE
    WHEN flexibility = 'hard_scheduled' THEN 'appointment'
    ELSE 'task'
  END,
  CASE status
    WHEN 'active' THEN 'committed'
    WHEN 'in_progress' THEN 'in_progress'
    WHEN 'completed' THEN 'completed'
    WHEN 'skipped' THEN 'skipped'
    WHEN 'rescheduled' THEN 'rescheduled'
    WHEN 'parked' THEN 'parked'
    ELSE 'committed'
  END,
  scheduled_date, scheduled_time, scheduled_end_time,
  parked_until, bounding_type, time_type, flexibility,
  emotional_weight, context,
  activity_id, task_suggestion_id, time_block_id,
  sort_order, committed_at, completed_at, completion_note,
  actual_duration_minutes, NULL, created_at, updated_at
FROM schedule_items;

-- Migrate hopper_items that were NOT activated (no corresponding schedule_item)
-- Skip hopper_items with status='activated' — those already migrated via schedule_items
INSERT INTO action_items (
  id, user_id, name, raw_input,
  source, item_type, status,
  proposed_date, bounding_type, time_type,
  activity_id, priority_score, priority_tier,
  enrichment_status, enrichment_data, enriched_at, confirmed_at,
  metadata, created_at, updated_at
)
SELECT
  id, user_id, raw_input, raw_input,
  source,
  CASE source
    WHEN 'outside_request' THEN 'outside_request'
    ELSE 'task'
  END,
  CASE status
    WHEN 'pending' THEN 'candidate'
    WHEN 'dismissed' THEN 'dismissed'
    WHEN 'ignored' THEN 'dismissed'
    WHEN 'archived' THEN 'archived'
    ELSE 'candidate'
  END,
  proposed_date, bounding_type, time_type,
  activity_id, priority_score, priority_tier,
  enrichment_status, enrichment_data, enriched_at, confirmed_at,
  metadata, created_at, updated_at
FROM hopper_items
WHERE status != 'activated';
```

#### 1.5 Update item_notes to reference action_items

```sql
-- Add new column
ALTER TABLE item_notes ADD COLUMN action_item_id uuid;

-- Migrate existing references
UPDATE item_notes SET action_item_id = schedule_item_id;

-- Add foreign key
ALTER TABLE item_notes ADD CONSTRAINT item_notes_action_item_id_fkey
  FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE CASCADE;

-- Drop old column
ALTER TABLE item_notes DROP COLUMN schedule_item_id;

-- Add index
CREATE INDEX idx_item_notes_action_item_id ON item_notes(action_item_id);
```

#### 1.6 Update action_log to reference action_items

```sql
-- Add new column
ALTER TABLE action_log ADD COLUMN action_item_id uuid;

-- Migrate existing references: schedule_item_id takes priority
UPDATE action_log SET action_item_id = schedule_item_id WHERE schedule_item_id IS NOT NULL;
UPDATE action_log SET action_item_id = hopper_item_id WHERE action_item_id IS NULL AND hopper_item_id IS NOT NULL;

-- Add foreign key
ALTER TABLE action_log ADD CONSTRAINT action_log_action_item_id_fkey
  FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE SET NULL;

-- Drop old columns
ALTER TABLE action_log DROP COLUMN schedule_item_id;
ALTER TABLE action_log DROP COLUMN hopper_item_id;

-- Add index
CREATE INDEX idx_action_log_action_item_id ON action_log(action_item_id);
```

#### 1.7 Update time_blocks

The time_blocks table may have references to schedule_items. Check for any foreign key and update:

```sql
-- time_blocks doesn't directly reference schedule_items, but action_items references time_blocks.
-- No change needed on time_blocks itself.
```

#### 1.8 Drop old tables

```sql
DROP TABLE IF EXISTS schedule_items CASCADE;
DROP TABLE IF EXISTS hopper_items CASCADE;
```

#### 1.9 Add action_item value links

Action items need their own value links for items that don't inherit from an activity or task_suggestion:

```sql
CREATE TABLE action_item_value_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action_item_id uuid NOT NULL,
  value_id uuid NOT NULL,
  contribution_strength text NOT NULL DEFAULT 'moderate'
    CHECK (contribution_strength IN ('weak', 'moderate', 'strong')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT action_item_value_links_pkey PRIMARY KEY (id),
  CONSTRAINT action_item_value_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT action_item_value_links_action_item_id_fkey FOREIGN KEY (action_item_id) REFERENCES action_items(id) ON DELETE CASCADE,
  CONSTRAINT action_item_value_links_value_id_fkey FOREIGN KEY (value_id) REFERENCES user_values(id) ON DELETE CASCADE,
  CONSTRAINT action_item_value_links_unique UNIQUE (action_item_id, value_id)
);

ALTER TABLE action_item_value_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "aivl_select_own" ON action_item_value_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "aivl_insert_own" ON action_item_value_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "aivl_update_own" ON action_item_value_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "aivl_delete_own" ON action_item_value_links FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_aivl_action_item_id ON action_item_value_links(action_item_id);
CREATE INDEX idx_aivl_value_id ON action_item_value_links(value_id);
```

---

## 2. View Queries

Each view in the app becomes a filtered query on action_items:

### Hopper (Organize modal)
```
WHERE status = 'candidate'
  AND (proposed_date IS NULL OR proposed_date BETWEEN week_start AND week_end)
ORDER BY priority_tier, priority_score DESC
```

### /today — To-do section
```
WHERE committed_date = :today
  AND scheduled_time IS NULL
  AND status IN ('committed', 'in_progress', 'parked')
ORDER BY
  CASE status WHEN 'parked' THEN 1 ELSE 0 END,
  sort_order
```

Items with status='parked' sink below active items.

### /today — Schedule section
```
WHERE committed_date = :today
  AND scheduled_time IS NOT NULL
  AND status IN ('committed', 'in_progress', 'completed', 'skipped')
ORDER BY scheduled_time
```

### /today — Completed (struck through)
```
WHERE committed_date = :today
  AND scheduled_time IS NULL
  AND status = 'completed'
ORDER BY completed_at DESC
```

### Children of an action item (focus view)
```
WHERE parent_action_item_id = :parentId
ORDER BY sort_order
```

---

## 3. User Gestures

Every user action maps to a field update on one row:

| Gesture | What changes |
|---------|-------------|
| Capture from /today | Create action_item: status='committed', committed_date=today, source='quick_capture' |
| Capture from Organize | Create action_item: status='candidate', source='quick_capture' |
| Capture with date from parser | Create action_item: status='candidate', proposed_date=parsed_date (or status='committed', committed_date=parsed_date if /today) |
| Capture with date+time (scheduled) | Create action_item: status='committed', committed_date=parsed_date, scheduled_time=parsed_time, flexibility='soft_scheduled' |
| Capture with appointment keyword | Same as above but flexibility='hard_scheduled', item_type='appointment' |
| Capture as tickler | Create action_item: status='candidate', proposed_date=future_date, item_type='tickler' |
| Capture as outside request | Create action_item: status='candidate', item_type='outside_request', person_id=matched, source='outside_request' |
| Capture as commitment | Create action_item: status='committed', item_type='commitment', committed_to_person_id=matched |
| Capture as log entry | Create action_log entry with event_type='logged'. No action_item created. |
| Template proposal from hopper logic | Create action_item: status='candidate', source='template_proposal', proposed_date, task_suggestion_id, activity_id |
| "I want to do this" in Organize | Set status='committed', committed_date=target_day |
| Drag onto time block in Organize | Set scheduled_time, scheduled_end_time, time_block_id, committed_date (if not set), status='committed' |
| Unschedule but keep committed | Clear scheduled_time, scheduled_end_time, time_block_id. Keep committed_date, status stays 'committed' |
| Move to another day in Organize | Change committed_date (and clear scheduled_time if the time doesn't apply to the new day) |
| Return to hopper | Set status='candidate', clear committed_date, scheduled_time, time_block_id, committed_at |
| Dismiss from hopper | Set status='dismissed'. If template_proposal, increment task_suggestion.consecutive_dismissals |
| Checkbox: open → in_progress | Set status='in_progress'. Write action_log 'in_progress' event |
| Checkbox: in_progress → completed | Set status='completed', completed_at=now(). Write action_log 'completed' event. Update task_suggestion.last_completed_at |
| Checkbox: completed → open | Set status='committed', clear completed_at. Write action_log 'reopened' event. Clear task_suggestion.last_completed_at if most recent |
| "Done for today" in focus view | Set status='parked', parked_until=tomorrow. Write action_log 'parked' event |
| "Mark done" in focus view | Set status='completed', completed_at=now(). Write action_log 'completed' event |
| ↺ send back to hopper | Set status='candidate', clear committed_date, scheduled_time, time_block_id. Write action_log 'rescheduled' event |
| Edit title in focus view | Update name. If changed, create item_note (type='step', is_completed=true) with old name |
| Add note in focus view | Create item_note (type='note') linked to action_item_id |
| Add step in focus view | Create item_note (type='step') linked to action_item_id |
| Complete a step | Update item_note.is_completed=true |
| Add follow-up from meeting | Create new action_item: source='follow_up', parent_action_item_id=meeting_item_id, status='candidate' |
| Parked item wakes up | On /today load: items with parked_until <= today revert to status='in_progress' |

---

## 4. Item Types

The item_type field distinguishes what kind of action item this is:

| Type | Meaning | Special behavior |
|------|---------|-----------------|
| task | Default. Something to do. | Standard lifecycle |
| appointment | Time-locked external commitment. | Always has scheduled_time. Flexibility defaults to hard_scheduled. |
| commitment | Promise made to another person. | committed_to_person_id is set. Tracked in integrity/reputation data. |
| outside_request | Someone asked the user to do something. | person_id is set (who asked). Source='outside_request'. |
| tickler | Future reminder, not a to-do yet. | Stays candidate until proposed_date arrives. Invisible before then. |
| log_entry | NOT stored in action_items. | Backward-looking captures go to action_log, not here. Included in this list for completeness. |

---

## 5. API Route Refactor

### Delete these files:
- `/api/hopper/*` — all hopper API routes
- `/api/schedule/*` — all schedule API routes

### Create these files:

#### `/api/action-items`
- `GET` — query action_items with filters: status, committed_date, proposed_date range, item_type, parent_action_item_id. Returns items with their item_notes.
- `POST` — create an action_item. Accepts all fields. Returns the created item.

#### `/api/action-items/[id]`
- `GET` — single action_item with its item_notes and child items.
- `PATCH` — update any fields. Handles all state transitions. When status changes, writes the corresponding action_log event automatically.
- `DELETE` — remove. Cascades to item_notes.

#### `/api/action-items/[id]/status`
- `PATCH` — dedicated status transition endpoint. Accepts `{ status, ...extra }` where extra can include: parked_until (for parking), completion_note (for completing), committed_date (for committing). Handles all side effects:
  - Writes action_log event
  - Updates task_suggestion.last_completed_at on completion
  - Clears task_suggestion.last_completed_at on reopen (if most recent)
  - Increments task_suggestion.consecutive_dismissals on dismiss
  - Resets consecutive_dismissals on commit or complete

#### `/api/action-items/[id]/title`
- `PATCH` — accepts `{ name }`. If name changed, creates item_note (step, completed) with old name. Updates action_item.name.

#### `/api/action-items/propose`
- `POST` — accepts `{ target_date }` or `{ week_start_date }`. Runs the hopper proposal logic from Session 8, but creates action_items with status='candidate' instead of hopper_items.

#### `/api/action-items/compute-priorities`
- `POST` — runs the priority scoring algorithm on all candidate action_items. Updates priority_score and priority_tier.

### Update these files:

#### `/api/capture`
Session 10's capture parser currently creates hopper_items and schedule_items. Update all routing to create action_items instead:
- `captured` → action_item, status='candidate'
- `captured_dated` → action_item, status='candidate', proposed_date=date
- `scheduled_soft` → action_item, status='committed', committed_date=date, scheduled_time=time, flexibility='soft_scheduled'
- `scheduled_hard` → action_item, status='committed', committed_date=date, scheduled_time=time, flexibility='hard_scheduled', item_type='appointment'
- `tickler` → action_item, status='candidate', item_type='tickler', proposed_date=future_date
- `outside_request` → action_item, status='candidate', item_type='outside_request', person_id=matched, source='outside_request'
- `commitment` → action_item, status='committed', item_type='commitment', committed_to_person_id=matched
- `logged` → action_log entry (unchanged — log entries don't create action_items)

#### `/api/today`
Update to query action_items instead of schedule_items. The queries are defined in Section 2.

#### `/api/item-notes`
Update foreign key from schedule_item_id to action_item_id in all queries.

#### `/api/values/waterfall` (if it exists)
Update to join through action_item_value_links instead of schedule_item value links.

---

## 6. React Component Refactor

### Search the entire codebase for:
- `hopper_item` / `hopperItem` / `HopperItem`
- `schedule_item` / `scheduleItem` / `ScheduleItem`
- `hopper_items` / `hopperItems`
- `schedule_items` / `scheduleItems`
- `hopper_item_id` / `hopperItemId`
- `schedule_item_id` / `scheduleItemId`

Replace all references with `action_item` / `actionItem` / `ActionItem` / `action_items` / `actionItems` / `action_item_id` / `actionItemId`.

### Specific components to update:

**The /today page:**
- Data fetching: query action_items instead of schedule_items
- All item interactions (checkbox, ↺, focus view) operate on action_item.id
- Capture input calls updated `/api/capture`
- Focus view references action_item_id for item_notes

**The Organize Week modal:**
- Hopper panel: query action_items WHERE status='candidate'
- Week grid: query action_items WHERE committed_date BETWEEN week_start AND week_end AND scheduled_time IS NOT NULL
- Committed-but-unscheduled items: query action_items WHERE committed_date BETWEEN week_start AND week_end AND scheduled_time IS NULL AND status IN ('committed', 'in_progress')
- Drag from hopper to grid: PATCH action_item status + committed_date + scheduled_time
- Drag from grid back to hopper: PATCH action_item status='candidate', clear dates
- "Commit Plan" button: PATCH all committed action_items for that day with committed_at=now()
- All hopper enrichment UI references action_item instead of hopper_item

**The Map page:**
- If the map reads from schedule_items or hopper_items for any data (activity completions, values served), update to read from action_items
- Capture input on the map calls updated `/api/capture`

**Any TypeScript type definitions:**
- Replace HopperItem and ScheduleItem interfaces with a single ActionItem interface
- Update all component props, state types, and function signatures

---

## 7. Hopper Proposal Logic Update

Session 8 defined `generateDailyProposals` creating hopper_items. Update to create action_items:

- Every template proposal creates an action_item with:
  - status = 'candidate'
  - source = 'template_proposal'
  - proposed_date = target_date
  - task_suggestion_id = the specific task_suggestion
  - activity_id = parent activity if exists
  - time_type = inherited from task_suggestion
  - bounding_type = inherited from task_suggestion
  - name = task_suggestion.name

- Duplicate check: look for existing action_items with the same task_suggestion_id + proposed_date + status='candidate'. If found, skip.

- Suppress check: look for existing action_items with the same task_suggestion_id + committed_date within this week + status IN ('committed', 'in_progress', 'completed'). If found, skip — already scheduled or done.

- Cold start: on first Organize open, set last_completed_at=now() on all task_suggestions (unchanged from Session 8).

- Caps: 15 per day, 60 per week (unchanged).

- completion_mode='any' handling: propose ONE child, not all siblings (unchanged).

---

## 8. Action Log Cleanup

After the migration, the action_log table should have:
- `action_item_id` (new column, replacing both hopper_item_id and schedule_item_id)
- `activity_id` (kept — some log events reference activities directly)
- `task_suggestion_id` (kept — some log events reference task_suggestions directly)

Verify all existing action_log rows have valid action_item_id references after migration. Rows where both old columns were null (e.g., pure activity log entries) will have null action_item_id — that's fine.

---

## 9. Task Suggestions — No Change

The task_suggestions table stays as-is. It remains the template layer for recurring items. Action items link to task_suggestions via task_suggestion_id when they're born from a template proposal. One-off captures are action_items with no task_suggestion link.

The task_suggestion_value_links table stays as-is. Value inheritance from task_suggestions to action_items works the same way — the API route resolves value links by checking: action_item_value_links first, then task_suggestion_value_links (via task_suggestion_id), then activity_value_links (via activity_id).

---

## What NOT to Build

- No new UI features. This is a refactor session — the app should look and behave exactly the same after this work.
- No new API functionality. Just updated references.
- No Week Completion (future session).
- No Values Map rebuild (future session).
- No new types or states beyond what's defined here.

---

## Verification

### Migration
- action_items table exists with all columns, constraints, indexes, and RLS
- All schedule_items migrated to action_items with correct status mapping
- All non-activated hopper_items migrated to action_items with status='candidate'
- item_notes references action_item_id, not schedule_item_id
- action_log references action_item_id, not schedule_item_id or hopper_item_id
- action_item_value_links table exists
- hopper_items and schedule_items tables are dropped
- No orphaned foreign key references remain anywhere

### /today page
- To-do section shows action_items with committed_date=today, no scheduled_time
- Schedule section shows action_items with committed_date=today, scheduled_time set
- Three-state checkbox cycle works: committed → in_progress → completed → committed
- Parked items show with half-fill, sink below active items
- ↺ returns item to candidate status
- Focus view reads and writes item_notes via action_item_id
- Focus view title edit creates step with old name
- Capture creates action_item (committed to today if from /today)
- Parked items reappear next day as in_progress

### Organize modal
- Hopper shows action_items with status='candidate'
- Dragging to grid sets committed_date + scheduled_time + status='committed'
- Dragging back to hopper clears committed_date + scheduled_time, sets status='candidate'
- Moving between days updates committed_date
- Unscheduling clears scheduled_time but keeps committed_date
- "Commit Plan" sets committed_at on all items for that day
- Proposal logic creates action_items, not hopper_items
- No duplicate items appear
- Priority scoring works on action_items

### Capture parser
- All eight routing outcomes create action_items (or action_log for logged)
- Toast/card/silent responses work correctly
- Known people matching and value link inheritance work

### Action log
- All state transitions write correct event types
- action_item_id is set on all new events
- Historical events from before migration have valid action_item_id where applicable

### Data integrity
- No references to hopper_items or schedule_items exist in any code file
- No references to hopper_item_id or schedule_item_id exist in any code file (except in the migration file itself)
- All TypeScript types reference ActionItem, not HopperItem or ScheduleItem
- Build compiles with no errors
- All existing functionality works identically to before the refactor