# SESSION 8: Schema Revision — Waterfall Values, Time Types, and Data Model Cleanup

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Previous sessions built:** Map Module, intake system, Organize Week modal with block types and hopper, AI capture enrichment, calendar integration tables, action_log, day_reflection. The schema has accumulated fields and concepts from multiple design iterations. This session consolidates.

**Read these project files before doing anything:**
- `SESSION-1-PROMPT.md` through `SESSION-7-PROMPT.md` — cumulative context
- `WildSuccessDevelopmentPlan.md` — the current development plan with principles
- `WaterfallDiagram.jsx` — the visual reference for the values architecture
- `wild-success-constitutional-reference.docx` — sections 2 (Value Architecture), 2.3 (Sufficiency)

**Important:** Before running the migration, dump the current schema and data state. If any existing data would be lost by a column drop or constraint change, migrate the data first.

---

## Why This Migration

The design has evolved in three ways since the original schema:

1. **Values live in a waterfall** — four pools (safety → security → freedom → opportunity) that fill in sequence. The old preventive/promotional binary is retained as a property of each value, but the pool assignment is new and governs priority logic.

2. **Time has five types, not three** — the old A/B/C energy levels mapped to focus/routine/easy. The new A/B/C/D/0 system captures productive focus, routine obligation, unwanted obligation, focused self-care, and unstructured free time. Free time is not leftover — it needs protection.

3. **Life domains are derived, not tagged** — items no longer carry life_domain_id directly. Domains are computed from value linkages for reflection views. This removes tagging friction from the capture and organize flows.

Additionally, freestanding task_suggestions (one-off captures, standalone recurring items without a parent Activity) need their own value links so completions can feed back to the Values Map.

---

## 1. Migration

### File: `supabase/migrations/008_schema_revision.sql`

### 1.1 Drop dead tables

If `activity_log` and `day_log` still exist from Session 1, drop them. They were replaced by `action_log` and `day_reflection` in Session 4.

```sql
DROP TABLE IF EXISTS activity_log;
DROP TABLE IF EXISTS day_log;
```

### 1.2 Add `layer` to `user_values`

```sql
ALTER TABLE user_values ADD COLUMN layer text NOT NULL DEFAULT 'security'
  CHECK (layer IN ('safety', 'security', 'freedom', 'opportunity'));
```

After adding the column, update existing rows based on the seed defaults:

```sql
-- Safety layer
UPDATE user_values SET layer = 'safety' WHERE name IN ('Safety', 'Health');

-- Security layer
UPDATE user_values SET layer = 'security' WHERE name IN ('Financial Sufficiency', 'Belonging');

-- Freedom layer
UPDATE user_values SET layer = 'freedom' WHERE name IN ('Freedom');

-- Opportunity layer
UPDATE user_values SET layer = 'opportunity' WHERE name IN ('Creative Expression', 'Purpose & Meaning', 'Adventure');
```

Adjust these UPDATE statements based on the actual default value names in the seed function. If the user has created custom values, they will default to 'security' and can be reassigned through the UI.

Also update the `seed_default_map_data` function to set `layer` on the default values it creates for new users.

### 1.3 Replace `energy_level` with `time_type` across all tables

The field name changes from `energy_level` to `time_type` and the constraint expands from ('A','B','C') to ('A','B','C','D','0').

**Activities:**
```sql
ALTER TABLE activities RENAME COLUMN energy_level TO time_type;
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_energy_level_check;
ALTER TABLE activities ADD CONSTRAINT activities_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));
```

**Block types:**
```sql
ALTER TABLE block_types RENAME COLUMN energy_level TO time_type;
ALTER TABLE block_types DROP CONSTRAINT IF EXISTS block_types_energy_level_check;
ALTER TABLE block_types ADD CONSTRAINT block_types_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));
```

**Schedule items:**
```sql
ALTER TABLE schedule_items RENAME COLUMN energy_level TO time_type;
ALTER TABLE schedule_items DROP CONSTRAINT IF EXISTS schedule_items_energy_level_check;
ALTER TABLE schedule_items ADD CONSTRAINT schedule_items_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));
```

**Task suggestions:**
```sql
ALTER TABLE task_suggestions RENAME COLUMN energy_level TO time_type;
ALTER TABLE task_suggestions DROP CONSTRAINT IF EXISTS task_suggestions_energy_level_check;
ALTER TABLE task_suggestions ADD CONSTRAINT task_suggestions_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));
```

**Time blocks:**
```sql
ALTER TABLE time_blocks RENAME COLUMN energy_level TO time_type;
ALTER TABLE time_blocks DROP CONSTRAINT IF EXISTS time_blocks_energy_level_check;
ALTER TABLE time_blocks ADD CONSTRAINT time_blocks_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));
```

**Time template blocks:**
```sql
ALTER TABLE time_template_blocks RENAME COLUMN energy_level TO time_type;
ALTER TABLE time_template_blocks DROP CONSTRAINT IF EXISTS time_template_blocks_energy_level_check;
ALTER TABLE time_template_blocks ADD CONSTRAINT time_template_blocks_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));
```

**Calendar event classifications:**
```sql
ALTER TABLE calendar_event_classifications RENAME COLUMN energy_level TO time_type;
ALTER TABLE calendar_event_classifications DROP CONSTRAINT IF EXISTS calendar_event_classifications_energy_level_check;
ALTER TABLE calendar_event_classifications ADD CONSTRAINT calendar_event_classifications_time_type_check
  CHECK (time_type IN ('A','B','C','D','0'));
```

**Note:** Find the actual constraint names before dropping. Run `\d tablename` in psql or check the Supabase dashboard. The constraint names above are guesses — the actual names may include the table OID or be auto-generated.

### 1.4 Update default block types

Update the `seed_default_block_types` function to use `time_type` instead of `energy_level` and include the new types:

| Name | Color | Duration | Time Type | Icon |
|------|-------|----------|-----------|------|
| Focus | #C4725A | 50 | A | 🎯 |
| Communicate | #4B82AF | 30 | B | 💬 |
| Social/Family | #7A6BAF | 60 | B | 👥 |
| Meeting/Appointment | #9E6A46 | 60 | B | 📅 |
| Outing | #7A9E82 | 120 | 0 | 🚶 |
| Admin | #8A857D | 45 | B | 📋 |
| Recharge | #5A9E6F | 30 | 0 | 🔋 |
| Ritual | #B8443E | 30 | D | 🕯️ |
| Planning | #C4725A | 45 | A | 🗺️ |
| Self-Care | #5A9E6F | 45 | D | 🌿 |
| Unwanted Obligation | #D4564E | 30 | C | ⚡ |
| Free Time | #E8E4DC | 60 | 0 | ☁️ |

Note the changes: Outing and Recharge are now 0-time (unstructured), Ritual and Self-Care are D-time (focused self-care), and two new types are added — Unwanted Obligation (C) and Free Time (0).

Update existing block_type rows for current users to match the new time_type values. Existing 'C' (old meaning: "easy") blocks should be reviewed — some may now be '0' (free time) or 'D' (self-care) rather than 'C' (unwanted obligation).

### 1.5 Add `bounding_type` to hopper_items and schedule_items

```sql
ALTER TABLE hopper_items ADD COLUMN bounding_type text DEFAULT 'action'
  CHECK (bounding_type IN ('time', 'action', 'outcome', 'unbounded'));

ALTER TABLE hopper_items ADD COLUMN time_type text DEFAULT 'B'
  CHECK (time_type IN ('A','B','C','D','0'));
```

```sql
ALTER TABLE schedule_items ADD COLUMN bounding_type text DEFAULT 'action'
  CHECK (bounding_type IN ('time', 'action', 'outcome', 'unbounded'));
```

Bounding types:
- **time** — scheduled at a specific time. A meeting, an appointment. Has scheduled_time and scheduled_end_time.
- **action** — defined by effort. "Clean the kitchen" takes as long as it takes. Has duration estimate but no fixed time.
- **outcome** — defined by a result. "Finish the proposal" is done when the deliverable exists. May span multiple sessions.
- **unbounded** — free time. Protected space. No task, no outcome. Default for unscheduled awake time.

### 1.6 New table: `task_suggestion_value_links`

```sql
CREATE TABLE task_suggestion_value_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  task_suggestion_id uuid NOT NULL,
  value_id uuid NOT NULL,
  contribution_strength text NOT NULL DEFAULT 'moderate'
    CHECK (contribution_strength IN ('weak', 'moderate', 'strong')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT task_suggestion_value_links_pkey PRIMARY KEY (id),
  CONSTRAINT task_suggestion_value_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT task_suggestion_value_links_task_suggestion_id_fkey FOREIGN KEY (task_suggestion_id) REFERENCES task_suggestions(id) ON DELETE CASCADE,
  CONSTRAINT task_suggestion_value_links_value_id_fkey FOREIGN KEY (value_id) REFERENCES user_values(id) ON DELETE CASCADE,
  CONSTRAINT task_suggestion_value_links_unique UNIQUE (task_suggestion_id, value_id)
);

ALTER TABLE task_suggestion_value_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "task_suggestion_value_links_select_own" ON task_suggestion_value_links
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "task_suggestion_value_links_insert_own" ON task_suggestion_value_links
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "task_suggestion_value_links_update_own" ON task_suggestion_value_links
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "task_suggestion_value_links_delete_own" ON task_suggestion_value_links
  FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_task_suggestion_value_links_user_id ON task_suggestion_value_links(user_id);
CREATE INDEX idx_task_suggestion_value_links_task_suggestion_id ON task_suggestion_value_links(task_suggestion_id);
CREATE INDEX idx_task_suggestion_value_links_value_id ON task_suggestion_value_links(value_id);
```

This enables freestanding task_suggestions (one-off captures, standalone recurring items) to link to values without a parent Activity. The AI enrichment flow writes to this table when confirming a capture.

### 1.7 Add proposal tracking to task_suggestions

```sql
ALTER TABLE task_suggestions ADD COLUMN last_proposed_at timestamptz;
ALTER TABLE task_suggestions ADD COLUMN consecutive_dismissals integer DEFAULT 0;
```

`last_proposed_at` prevents re-proposing the same item on the same day after dismissal. `consecutive_dismissals` triggers the archive prompt after a threshold (5 consecutive).

### 1.8 Drop life_domain_id from item-level tables

Life domains are now derived from value linkages, not tagged on items.

```sql
ALTER TABLE task_suggestions DROP COLUMN IF EXISTS life_domain_id;
ALTER TABLE big_outcomes DROP COLUMN IF EXISTS life_domain_id;
ALTER TABLE calendar_event_classifications DROP COLUMN IF EXISTS life_domain_id;
```

**Note:** Before dropping, check if any existing data uses these fields. If populated, the data is not lost — it's just no longer needed because domain association is computed from the value links on the activity or task_suggestion.

Keep `life_domains` table and `activity_domain_links` table — these support the Life Map reflection view. Activities can still associate with domains for the Map visualization. The change is that individual items (task_suggestions, schedule_items, hopper_items) no longer carry domain tags.

### 1.9 Restrict Activities to recurring only

```sql
-- Remove 'one_time' from the activity_type constraint
ALTER TABLE activities DROP CONSTRAINT IF EXISTS activities_activity_type_check;
ALTER TABLE activities ADD CONSTRAINT activities_activity_type_check
  CHECK (activity_type = 'recurring');
```

Before applying: migrate any existing one-time Activities to freestanding task_suggestions. For each one-time Activity:
1. Create a task_suggestion with the same name, description, and metadata
2. Copy activity_value_links to task_suggestion_value_links
3. Update any hopper_items or schedule_items referencing this activity_id
4. Delete the Activity

If no one-time Activities exist, the migration is safe to apply directly.

### 1.10 Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_user_values_layer ON user_values(layer);
CREATE INDEX IF NOT EXISTS idx_hopper_items_time_type ON hopper_items(time_type);
CREATE INDEX IF NOT EXISTS idx_hopper_items_bounding_type ON hopper_items(bounding_type);
CREATE INDEX IF NOT EXISTS idx_schedule_items_bounding_type ON schedule_items(bounding_type);
CREATE INDEX IF NOT EXISTS idx_task_suggestions_last_proposed_at ON task_suggestions(last_proposed_at);
CREATE INDEX IF NOT EXISTS idx_task_suggestions_consecutive_dismissals ON task_suggestions(consecutive_dismissals);
```

---

## 2. Hopper Proposal Logic

With the schema updated, here is how the hopper gets populated. Build this as an application-layer service: `generateDailyProposals(userId, targetDate)` and a week-level wrapper `generateWeekProposals(userId, weekStartDate)` that calls it for each of the seven days.

### When Proposals Generate

1. **When the user opens the Organize modal** — before rendering, call `generateWeekProposals` for the displayed week. This is the primary trigger. The hopper should be populated before the user sees the week grid.
2. **When the user opens the Map page** — call `generateDailyProposals` for today only, so the hopper item count badge on the Organize button is accurate.
3. **On `POST /api/hopper/propose`** — manual trigger, called by the above two UI events. Accepts `{target_date}` for a single day or `{week_start_date}` for a full week.

### Sources

The hopper receives items from five sources:

1. **Template proposals** — recurring Activities and their child task_suggestions, based on recurrence rules and completion history.
2. **Freestanding recurring task_suggestions** — standalone items with no parent Activity but with their own recurrence.
3. **Calendar events** — classified as flexible_commitment, imported from Google Calendar (coming soon).
4. **Planning function** — tasks derived from Big Outcomes (coming soon).
5. **Rescheduled items** — schedule_items the user marked "reschedule" during the Action view return to the hopper. These are not new proposals — they are recycled items with `source` preserved from their original entry. Do not treat them as duplicates of template proposals.

Quick captures enter the hopper directly from the user, bypassing this function.

### Cold Start

On the user's first Organize open (detect via `user_profiles.intake_status` just changed to 'complete', or no action_log events exist for this user), set `last_completed_at = now()` on ALL active task_suggestions. This pretends the user just did everything, so proposals start fresh from this moment forward. The weekly run proposes next week. Daily items propose tomorrow. Only items with preferred_day matching today propose today. This prevents a flood of overdue proposals on day one.

### Proposal Algorithm

For each active, non-archived task_suggestion with recurrence != 'one_time':

**Step 1 — Check if due.**
- daily: always due
- weekly: due if last_completed_at > 7 days ago, or if preferred_day matches target_date
- biweekly: due if last_completed_at > 14 days ago
- monthly/quarterly/seasonal/annual: due if the period has elapsed since last_completed_at
- If `last_completed_at` is null and the item was created more than one recurrence period ago, it's overdue.

**Step 2 — Check dismissal status.**
- If `last_proposed_at` matches today and the item was dismissed today (check action_log for a 'dismissed' event for this task_suggestion on target_date), do not re-propose today. It can re-propose tomorrow.

**Step 3 — Check for duplicates.**
- If a pending hopper_item already exists for this task_suggestion + target_date, skip.
- If an active schedule_item already exists for this task_suggestion this week, skip. (Already scheduled = no need to propose again.)

**Step 4 — Handle completion_mode='any' on parent Activities.**
- If this task_suggestion has a parent Activity with `completion_mode = 'any'`, check whether ANY sibling task_suggestion has been completed or scheduled this recurrence period.
- If yes, skip — the Activity is already satisfied for this period.
- If no, propose ONE item from the group, not all siblings. Choose the one the user has completed most frequently (from action_log history), or the first by sort_order if no history exists. Present it as "[Activity name] — [suggested option]" so the user sees the parent context.

**Step 5 — Create the hopper_item.**
- `source = 'template_proposal'`
- `activity_id` = parent Activity if exists
- `task_suggestion_id` = the specific task_suggestion
- `proposed_date = targetDate`
- `time_type` = inherited from the task_suggestion
- `bounding_type` = inherited from the task_suggestion (default 'action')
- `block_type_hint` = matched from time_type to the user's block_types
- `raw_input` = the task_suggestion's name

**Step 6 — Update tracking.**
- Set `task_suggestions.last_proposed_at = now()`.

For Activities without child task_suggestions, propose the Activity itself using its own recurrence and metadata.

### Overpopulation Controls

The hopper must not overwhelm the user. Apply these limits:

- **Maximum 15 template-derived proposals per day.** If more than 15 items are due for a single day, prioritize by value urgency (waterfall logic) and recurrence urgency (most overdue first). The remaining items stay latent — they are not proposed but will be proposed on a future day when space opens.
- **Maximum 60 template-derived proposals per week.** Same prioritization logic across the full week. This prevents a user with many recurring items from facing 100+ proposals on Monday morning.
- **Completion_mode='any' Activities count as one proposal, not N.** An Activity with 5 child options generates one hopper item, not five.
- **Suppress when already scheduled.** If a task_suggestion already has an active schedule_item anywhere this week, do not propose it again for any day this week.
- **Respect the user's sense of "done."** When the user closes the Organize modal, remaining pending hopper_items stay pending for the next session. They do not re-propose as new items — they persist in their current position and priority.

### Priority Scoring

After proposals are generated, compute priority for all pending hopper_items. `computeHopperPriorities(userId)`:

**Factors:**

- **Deadline proximity.** Items with deadlines this week score higher. Overdue items score highest.
- **Overdue recurrence.** Task_suggestions past their recurrence window get a boost proportional to how overdue they are.
- **Value urgency (the waterfall).** For each value linked to the item (via activity_value_links or task_suggestion_value_links):
  - Compute the value's sufficiency ratio: `score / sufficiency_mark`
  - If ratio < 1.0, boost the item. The further below 1.0, the bigger the boost.
  - Apply a layer multiplier: safety-layer values get the highest multiplier, then security, then freedom, then opportunity. This encodes the waterfall — an item serving an insufficient safety value outranks an item serving an insufficient opportunity value.
- **User behavior.** Items with high `consecutive_dismissals` get a slight score reduction. Items the user frequently schedules promptly get a slight boost. Read from action_log history.
- **Emotional weight.** Heavy items get a small boost — they need deliberate scheduling.
- **Source.** Outside requests get a small boost over template proposals.

**Tier assignment:**

- `urgent`: score above threshold, OR deadline within 3 days, OR overdue, OR linked to a safety/security value below 0.7 ratio
- `suggested`: source is 'template_proposal' AND score below threshold AND no deadline pressure AND linked values are all above 1.0
- `normal`: everything else

The prioritized sort order is what prevents the user from feeling overwhelmed. Urgent items at top, suggested items compressed at the bottom. The user processes top-down and stops when they feel done. Remaining items persist.

### Decay and Archive

When a hopper_item with source 'template_proposal' is dismissed:
1. Increment `task_suggestions.consecutive_dismissals` on the linked task_suggestion.
2. If `consecutive_dismissals >= 5`, on the next proposal, instead of creating a normal hopper_item, show a prompt: "You haven't scheduled [name] in a while. Archive it?"
   - Yes → set `task_suggestions.archived_at = now()`, `is_active = false`. Stop proposing.
   - No → reset `consecutive_dismissals = 0`. Continue proposing.

When a hopper_item is activated (scheduled), reset `consecutive_dismissals = 0` on the linked task_suggestion.

---

## 3. Completion → Values Feedback Loop

### On Completion

When a schedule_item is marked complete (status → 'completed'):

1. Write `action_log` event with `event_type = 'completed'`, linking schedule_item_id, activity_id, task_suggestion_id as applicable.

2. If `task_suggestion_id` is set, update `task_suggestions.last_completed_at = now()` and reset `consecutive_dismissals = 0`.

3. The completion is now in the action_log and linked to values through either:
   - `activity_id` → `activity_value_links` → `user_values`
   - `task_suggestion_id` → `task_suggestion_value_links` → `user_values`

### Values Map Reads

The Values Map computes three indicators per value from the action_log:

**Effort indicator:** Count of `completed` events in the past 3 weeks where the linked activity or task_suggestion serves this value. Weight by contribution_strength (strong=1.0, moderate=0.6, weak=0.3).

**Trend indicator:** Compare effort in the most recent week to effort in the two weeks before. Delta is the difference. Positive delta = improving, highlighted in green. Negative delta = declining, highlighted in amber/red.

**Sufficiency ratio:** `score / sufficiency_mark` — this is the user's self-assessment, not computed from completions. But the system can prompt reassessment when effort changes significantly: "Your Health effort has doubled in the past 3 weeks. Has your sense of Health sufficiency changed?"

### Reassessment Prompts

Track the last time each value was assessed (add a field or use updated_at on user_values). If more than 4 weeks since last assessment, or if effort on this value has changed by more than 50% in the past 3 weeks, show a gentle prompt on the Values Map: "It's been a while since you assessed [value name]. Still feel the same? [Update]"

Do not prompt more than one value at a time. Do not prompt during Organize or Action views — only on the Values Map.

---

## 4. Commitment Visibility

### Scheduled vs Committed

A schedule_item can be in two states relevant to commitment:

- **Scheduled** (`committed_at` is null) — the item is placed in a time block but the user hasn't committed the day's plan yet. Visible in Organize with a dashed left border.
- **Committed** (`committed_at` is set) — the user clicked "Commit Plan." Visible with a solid left border. This is the user's declared intention.

### Commit Flow

When the user clicks "Commit Plan" for a day:
1. Set `committed_at = now()` on all active schedule_items for that date.
2. Write `committed` events to action_log for each item.
3. Update `day_reflection.plan_status = 'committed'` and `day_reflection.committed_at = now()`.

### Visual Distinction in Organize

In the week grid:
- **Uncommitted items:** dashed left border, slightly muted text.
- **Committed items:** solid left border in the block's time_type color, full text weight.
- **Completed items:** green left border, strikethrough name, checkmark.
- **Skipped items:** red-muted left border, dimmed text.

In the day headers, show commitment status: "Mon ✓" for committed days, "Tue" for uncommitted.

### Integrity Data

The gap between committed and completed is the core integrity metric. Over time:
- `integrity_ratio = completed_count / committed_count` per day, per week, per month.
- This is computed from action_log by comparing `committed` events to `completed` events for the same schedule_items.
- Display is stubbed for now ("Integrity score: coming soon") but the data to compute it exists after this migration.

---

## 5. Time Type Logic in the UI

### Organize Week Summary Panel

Replace the old "Energy Balance" section with "Time Balance." Show five horizontal bars:

| Type | Label | Color | What it means |
|------|-------|-------|---------------|
| A | Focus | #C4725A | Productive deep work |
| B | Routine | #4B82AF | Obligations, admin, errands |
| C | Unwanted | #D4564E | Things you must do but don't want to |
| D | Self-care | #5A9E6F | Exercise, therapy, meditation |
| 0 | Free | #E8E4DC | Unstructured, protected |

Each bar shows count of items or total minutes scheduled for that type across the week.

### Warnings

The summary panel should flag:
- **No 0-time this week** — "Your week has no unstructured free time. Consider protecting some."
- **Heavy C-time day** — "Wednesday has 3 unwanted obligations clustered. Consider spreading them."
- **No D-time this week** — "No self-care scheduled. This creates a leak in your Safety pool."
- **A-time outside peak hours** — if focus_settings or user preference indicates peak hours, warn when A-items are outside that window.

These warnings are not blocking. They appear in the summary panel as gentle observations.

### Block Type ↔ Time Type

Each block_type has a default time_type. When the user drags a block type onto the grid, the resulting time_block inherits the time_type. Items dragged into that block inherit the time_type if they don't already have one set. Mismatch warnings fire when an item's time_type doesn't match its block's time_type — shown as a subtle indicator, not a prevention.

---

## 6. API Route Updates

### Values — `/api/values`
- Extend GET to return `layer` field.
- Extend POST/PATCH to accept `layer`.
- Add `GET /api/values/waterfall` — returns values grouped by layer with sufficiency ratios computed, effort indicators from action_log, and trend indicators.

### Task Suggestion Value Links — `/api/task-suggestion-value-links`
- `GET ?task_suggestion_id=` — links for a task_suggestion
- `POST` — create (task_suggestion_id, value_id, contribution_strength)
- `DELETE /api/task-suggestion-value-links/[id]` — remove

### Hopper — `/api/hopper`
- Extend POST to accept `bounding_type` and `time_type`.
- Extend `POST /api/hopper/propose` to use the new proposal algorithm.
- Extend `POST /api/hopper/compute-priorities` to use the waterfall-aware priority scoring.

### Schedule — `/api/schedule`
- Extend POST to accept `bounding_type`.
- Extend `POST /api/schedule/commit` to set committed_at and write action_log events.
- Completion handler: on status → 'completed', update task_suggestion.last_completed_at and reset consecutive_dismissals.

### Block Types — `/api/block-types`
- Rename `energy_level` to `time_type` in request/response payloads.
- Seed function uses new defaults including Unwanted Obligation and Free Time types.

---

## 7. Code Updates

### Rename `energy_level` → `time_type` in application code

Search the entire codebase for `energy_level` and rename to `time_type`. This includes:
- API route handlers
- React components (props, state, display logic)
- Supabase queries
- Type definitions
- The Organize modal (hopper items, block types, schedule items, summary panel)
- The Map page (if it references energy_level anywhere)
- AI enrichment prompts (the system prompt sent to Claude should use `time_type` and list all five options)

### Update AI enrichment system prompt

The enrichment system prompt (from Session 7) references `energy_level` with A/B/C options. Update to `time_type` with A/B/C/D/0 and the new definitions:
- A = productive focus for accomplishment
- B = routine obligation
- C = unwanted obligation
- D = focused self-care (exercise, therapy, meditation)
- 0 = unstructured free time (reading, walking, doing nothing)

### Update Values Map

The Map currently uses a left/right protect/expand layout. This session does NOT rebuild the Map layout (that's a future session). But the Map's data fetching should be updated to:
- Include the `layer` field on values
- Compute sufficiency ratio (score / sufficiency_mark) for display
- Use the new `/api/values/waterfall` endpoint if built

---

## What NOT to Build

- No Values Map visual rebuild (future session — the waterfall layout from WaterfallDiagram.jsx)
- No Action/Day view
- No Planning function
- No integrity score computation (data is captured, display is stubbed)
- No automatic reassessment of sufficiency scores from completion data (the user self-assesses)
- No mobile layouts

---

## Verification

### Migration
- Migration runs without errors
- activity_log and day_log tables are dropped (if they still existed)
- user_values has `layer` column, existing values have correct layer assignments
- All tables with old `energy_level` now have `time_type` with expanded check constraint
- hopper_items has `bounding_type` and `time_type` columns
- schedule_items has `bounding_type` column
- task_suggestion_value_links table exists with RLS and indexes
- task_suggestions has `last_proposed_at` and `consecutive_dismissals`
- life_domain_id removed from task_suggestions, big_outcomes, calendar_event_classifications
- No one-time Activities remain (migrated to task_suggestions)
- activities.activity_type constraint only allows 'recurring'

### Hopper Proposals
- `generateDailyProposals` creates hopper_items for due task_suggestions
- No duplicate proposals for same task + date
- Dismissed items don't re-propose same day
- Priority scoring boosts items linked to below-sufficiency values
- Safety-layer values get highest priority multiplier
- Items with high consecutive_dismissals score lower
- Archive prompt fires after 5 consecutive dismissals

### Completions
- Completing a schedule_item writes to action_log
- Completion updates task_suggestion.last_completed_at
- Completion resets consecutive_dismissals
- Values Map can query action_log to compute effort per value

### Commitment
- "Commit Plan" sets committed_at on schedule_items
- Committed items display differently from uncommitted
- action_log captures committed events
- day_reflection.plan_status updates

### Time Types
- Block types show correct time_type labels and colors
- Organize summary panel shows 5-bar time balance (A/B/C/D/0)
- Warnings appear for missing 0-time, missing D-time, clustered C-time
- AI enrichment suggests time_type with 5 options

### Data Integrity
- Existing data survives the migration
- Foreign key references remain valid after column drops
- No orphaned records from life_domain_id removal

---

## Session 9 Preview (for context only — do not build)

Session 9 rebuilds the Values Map visual layout using the waterfall architecture — four horizontal layers stacked bottom to top (safety → security → freedom → opportunity), sufficiency ratios as decimals, effort and trend indicators per value, crack propagation from lower layers, and the free attention headline metric. Uses WaterfallDiagram.jsx as the design reference.