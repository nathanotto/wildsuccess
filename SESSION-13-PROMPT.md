# SESSION 13: Block Type Simplification and Day Spans

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Previous sessions built:** Values Map, Organize Week modal with twelve block types, /today page, capture parser, action_items table, /review page. The Organize modal currently has twelve block types (Focus, Communicate, Social/Family, Meeting/Appointment, Outing, Admin, Recharge, Ritual, Planning, Self-Care, Unwanted Obligation, Free Time) that the user drags onto a 7-column week grid.

**This session does three things:**
1. Replaces twelve block types with six
2. Adds day spans — multi-day context bars that sit above the week grid
3. Connects spans to values so they contribute to the Values Map

**Read these project files before doing anything:**
- `SESSION-11-PROMPT.md` — action_items refactor (current data model)
- `SESSION-8-PROMPT.md` — hopper logic, time types, block types
- `SESSION-6-PROMPT.md` — Organize Week modal structure (if it exists)
- The Organize modal code itself — you will be modifying it

---

## 1. Schema Changes

### Migration: `supabase/migrations/013_block_types_and_spans.sql`

#### 1.1 Replace block type seed data

The twelve default block types are replaced by six. Two groups: three context blocks (where/how you spend time) and three protection blocks (time defended from productivity).

| Name | Color | Default Duration | Time Type | Icon | Group |
|------|-------|-----------------|-----------|------|-------|
| Desk | #8A857D | 60 | B | 💻 | context |
| Out | #7A9E82 | 60 | B | 🚶 | context |
| With People | #7A6BAF | 60 | B | 👥 | context |
| Self-Care | #5A9E6F | 45 | D | 🌿 | protection |
| Recharge | #B8896E | 30 | 0 | 🔋 | protection |
| My Time | #4B6A82 | 60 | 0 | ☁️ | protection |

**Context blocks** describe where and how the user can spend time. Desk covers all computer/phone/focused work — whether it's deep focus or routine admin, the items inside determine that, not the block. Out covers errands, appointments, anything away from home/office. With People covers any time where someone else is present.

**Protection blocks** defend non-productive time from being filled with obligation. Self-Care is intentional restoration (exercise, therapy, meditation). Recharge is passive recovery (nap, downtime, reading). My Time is uncommitted and self-directed — the user doesn't have to say what it is in advance. This is the most important block type to protect because it looks like nothing from the outside.

**Migration approach:**

1. Delete all existing block_type rows for the user (there's minimal data in the database)
2. Update the `seed_default_block_types` function to create these six instead of twelve
3. Run the updated seed for existing users
4. Any time_blocks referencing deleted block_types will have their block_type_id set to null — this is acceptable since the old types no longer exist

```sql
-- Delete existing default block types for all users
DELETE FROM block_types;

-- The seed function will recreate them. Update the seed function to:
-- 1. Drop all references to the old twelve types
-- 2. Create the six new types listed above
-- 3. Set sort_order: Desk=0, Out=1, With People=2, Self-Care=3, Recharge=4, My Time=5
```

Update the `seed_default_block_types` function to create exactly these six types for new users. Then call it for existing users to populate the new types.

Also update any time_blocks that reference now-deleted block_type_ids:
```sql
UPDATE time_blocks SET block_type_id = NULL WHERE block_type_id NOT IN (SELECT id FROM block_types);
```

#### 1.2 New table: `day_spans`

Day spans are multi-day context markers. "Ski trip with Winston Mon-Wed." "Winston at his mom's Fri-Sun." "Trip to NYC Thu-Sat." They sit above the week grid in Organize and provide visual context for the days they cover.

```sql
CREATE TABLE day_spans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  person_id uuid,
  note text,
  color text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT day_spans_pkey PRIMARY KEY (id),
  CONSTRAINT day_spans_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT day_spans_person_id_fkey FOREIGN KEY (person_id) REFERENCES known_people(id) ON DELETE SET NULL,
  CONSTRAINT day_spans_date_order CHECK (end_date >= start_date)
);

ALTER TABLE day_spans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "day_spans_select_own" ON day_spans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "day_spans_insert_own" ON day_spans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "day_spans_update_own" ON day_spans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "day_spans_delete_own" ON day_spans FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_day_spans_user_id ON day_spans(user_id);
CREATE INDEX idx_day_spans_dates ON day_spans(start_date, end_date);
```

Key points:
- `start_date` and `end_date` are inclusive. A span from March 16 to March 19 covers Sunday through Wednesday — four days.
- Spans are not week-scoped. They are date-scoped. A span can cover any range of days, including across week boundaries.
- `person_id` is optional — links to known_people if someone is associated ("ski trip with Winston").
- `color` is optional — if null, use a default muted color (#E8E4DC). The user can pick a color when creating the span.
- Multiple spans can overlap on the same days.

#### 1.3 New table: `day_span_value_links`

```sql
CREATE TABLE day_span_value_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  day_span_id uuid NOT NULL,
  value_id uuid NOT NULL,
  contribution_strength text NOT NULL DEFAULT 'moderate'
    CHECK (contribution_strength IN ('weak', 'moderate', 'strong')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT day_span_value_links_pkey PRIMARY KEY (id),
  CONSTRAINT day_span_value_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT day_span_value_links_day_span_id_fkey FOREIGN KEY (day_span_id) REFERENCES day_spans(id) ON DELETE CASCADE,
  CONSTRAINT day_span_value_links_value_id_fkey FOREIGN KEY (value_id) REFERENCES user_values(id) ON DELETE CASCADE,
  CONSTRAINT day_span_value_links_unique UNIQUE (day_span_id, value_id)
);

ALTER TABLE day_span_value_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dsvl_select_own" ON day_span_value_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dsvl_insert_own" ON day_span_value_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dsvl_update_own" ON day_span_value_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dsvl_delete_own" ON day_span_value_links FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_dsvl_day_span_id ON day_span_value_links(day_span_id);
CREATE INDEX idx_dsvl_value_id ON day_span_value_links(value_id);
```

When a span links to values, each day under the span counts as one effort contribution per linked value. A three-day ski trip linked to Connection, Adventure, Health produces 3 effort units for each of those values — proportional to the actual time invested.

---

## 2. Organize Modal Updates

### 2.1 Block Type Palette

Replace the current twelve-type palette with the six new types. Render as a horizontal strip above the week grid (or in the hopper panel — wherever it currently lives).

Layout: six items in a row, each showing the icon and name. The three context blocks on the left, a subtle divider, then the three protection blocks on the right:

```
💻 Desk | 🚶 Out | 👥 With People  ·  🌿 Self-Care | 🔋 Recharge | ☁️ My Time
```

Each block type is draggable onto the week grid, same as before. The color fills the block on the grid. The behavior is unchanged — drag a block type onto a day column at a time, it creates a time_block with that block_type_id.

### 2.2 Day Spans — Above the Week Grid

Spans render as horizontal bars above the day columns in the week grid. They sit in a dedicated span area between the day headers and the block grid.

**Rendering:**

For the displayed week (Monday through Sunday), query day_spans where the span's date range overlaps with the week:
```sql
WHERE user_id = :userId
  AND start_date <= :weekEnd
  AND end_date >= :weekStart
```

Each span renders as a horizontal bar that stretches across the day columns it covers. If a span starts before this week, the bar begins at Monday's left edge. If it ends after this week, the bar extends to Sunday's right edge. The bar is clipped to the visible week.

Bar appearance:
- Height: 24px
- Background: span's color at 20% opacity, with a left border at full opacity (3px)
- Text: span name, 12px, left-aligned inside the bar, truncated with ellipsis if too long
- If the span has a person: show person name after the span name in muted text. "Ski trip · Winston"
- Multiple spans stack vertically. Second span renders below the first. Maximum three visible spans — if more exist, show "+N more" link.

**Interactions:**

- Click a span bar → open a span edit popover:
  - Name (text input)
  - Start date, End date (date pickers)
  - Person (dropdown of known_people, optional)
  - Values (multi-select of user_values with contribution strength)
  - Color (small color picker or preset swatches)
  - Note (text input)
  - Delete span
  - Save / Cancel

- "Add span" button in the span area (or a + icon). Opens the same popover with empty fields. Default start_date and end_date to the displayed week's Monday and Sunday.

### 2.3 No Other Organize Changes

The hopper panel, week grid, drag-and-drop interactions, commit flow, and summary panel remain unchanged from previous sessions — except that block types now reference the six new types instead of twelve. Any code that references specific block type names (e.g., checking for "Focus" or "Admin") needs to be updated to the new names.

---

## 3. API Routes

### Day Spans — `/api/day-spans`

- `GET ?week_start=YYYY-MM-DD&week_end=YYYY-MM-DD` — returns all spans overlapping the date range, with their value links and person data.
- `POST` — create a span. Accepts: name, start_date, end_date, person_id (optional), color (optional), note (optional), value_ids (array of {value_id, contribution_strength}).
- `PATCH /api/day-spans/[id]` — update any fields. If value_ids is provided, replace all value links (delete existing, insert new).
- `DELETE /api/day-spans/[id]` — remove span and its value links (cascade).

### Day Span Value Links — `/api/day-spans/[id]/values`

- `GET` — value links for a span
- `POST` — add value link (value_id, contribution_strength)
- `DELETE /api/day-spans/[id]/values/[linkId]` — remove value link

### Block Types — `/api/block-types`

No API changes needed. The seed function update handles the data. The GET endpoint returns whatever block types exist for the user.

---

## 4. Values Map — Span Contributions

The Values Map effort indicator currently reads from action_log (completed events linked to values through action items, activities, and task suggestions). Add a second source: day spans.

### Updated Effort Query

For each value, the effort indicator for a given time window (e.g., past 3 weeks) is computed from:

**Source 1: Action item completions** (existing)
- Query action_log for event_type='completed' within the window
- Join to action_item_value_links, task_suggestion_value_links, or activity_value_links
- Weight by contribution_strength (strong=1.0, moderate=0.6, weak=0.3)
- Count: one unit per completed item

**Source 2: Day span coverage** (new)
- Query day_spans that overlap with the time window
- For each span, count the number of days within the window that the span covers
- Join to day_span_value_links
- Weight by contribution_strength (same scale)
- Count: one unit per day per linked value

The total effort for a value = Source 1 count + Source 2 count.

Example: A three-day ski trip linked to Health with strength 'strong' contributes 3.0 effort units to Health (3 days × 1.0 weight). If the user also completed two Health-related action items that week (both moderate), that adds 1.2 (2 × 0.6). Total Health effort for the week: 4.2.

### Where to Implement

If a `/api/values/waterfall` or similar endpoint exists that computes effort indicators, add the span query there. If effort is computed client-side, add the span data to the API response and compute client-side.

If no effort computation exists yet (the Values Map visual rebuild hasn't happened), just ensure the API returns span data alongside action item data so the computation can be added when the Map is rebuilt. At minimum, the `/api/day-spans` GET endpoint returns the data needed.

---

## 5. Visual Design

### Block Type Palette

- Six items in a horizontal row
- Each: icon (16px) + name (12px) below or beside it
- Context group on left, protection group on right, subtle vertical divider between
- Background: each block type's color at 15% opacity
- Border: 1px solid at 30% opacity of the block type's color
- Draggable with the same drag behavior as the current palette
- Compact — the palette should not take up more vertical space than the current one

### Day Span Bars

- Position: above the day columns, below the day headers (Mon, Tue, etc.)
- Height: 24px per span
- Background: span color at 20% opacity (default color #E8E4DC if no color set)
- Left border: 3px solid, span color at full opacity
- Border-radius: 2px (minimal)
- Text: 12px, Source Sans 3, color derived from span color (darkened for readability). Left-aligned with 8px padding.
- Person name: 12px, muted, after a · separator
- Overflow: name truncated with ellipsis if wider than the bar
- Hover: background opacity increases to 30%
- Click: opens edit popover
- Stacking: multiple spans stack vertically with 2px gap. Third+ spans collapse to "+N more" link.

### Span Edit Popover

- Appears anchored to the clicked span bar, or centered if triggered by "+ Add span"
- Width: 320px
- Same visual style as existing edit modals in WS — minimal, flat, no rounded corners beyond 4px
- Fields stacked vertically: Name, Start date, End date, Person dropdown, Values multi-select with strength, Color swatches, Note
- Values multi-select: shows user's values as checkboxes with a strength dropdown (strong/moderate/weak) next to each checked value
- Color swatches: 6-8 preset muted colors in a row, clickable
- Buttons at bottom: Save (primary), Cancel (muted), Delete (brick red, right-aligned)

### Color Presets for Spans

```
#E8E4DC (warm gray — default)
#C4725A (warm rust)
#4B6A82 (slate blue)
#7A6BAF (muted purple)
#5A9E6F (forest green)
#B8896E (warm tan)
#8A857D (cool gray)
#BA7517 (amber)
```

---

## What NOT to Build

- No time templates (deferred — may add later)
- No automatic suppression of hopper items based on spans (spans are visual context only)
- No recurring spans (each span is a one-time date range)
- No span interaction with the /today page (spans are an Organize feature for now)
- No span rendering on the /review page (future enhancement)
- No block type customization UI (user can't create custom block types yet — just the six defaults)
- No changes to hopper proposal logic based on block types

---

## Verification

### Block Types
- Only six block types exist for the user: Desk, Out, With People, Self-Care, Recharge, My Time
- Old twelve block types are deleted
- Block type palette in Organize shows six types in two groups with a divider
- Dragging a block type onto the grid creates a time_block with the correct block_type_id
- Existing time_blocks with null block_type_id render gracefully (no crash, show as untyped)
- The sort order is: Desk, Out, With People, Self-Care, Recharge, My Time
- Colors are correct per the table above

### Day Spans
- User can create a span from the Organize modal
- Span renders as a horizontal bar above the day columns
- Span clips to the displayed week — a span starting last Sunday and ending this Wednesday shows Mon-Wed in this week's view
- Navigating to last week shows the same span covering Sunday
- Multiple spans stack vertically
- Click span → edit popover with all fields
- Edit span → changes save and re-render
- Delete span → bar disappears
- Span with person_id shows person name after span name
- Span without color uses default warm gray

### Span Value Links
- User can select values when creating/editing a span
- Values show contribution strength (strong/moderate/weak)
- Value links save correctly to day_span_value_links table
- API returns value links with span data

### Values Map Effort
- If effort computation exists: span contributions appear in the effort indicator (per-day-per-value)
- If effort computation doesn't exist yet: span data is available in the API response for future use
- A three-day span linked to Health (strong) contributes 3.0 effort units to Health

### Data Integrity
- No references to old block type names in code (Focus, Communicate, Admin, etc.)
- No orphaned time_blocks referencing deleted block_types
- Day spans survive week navigation without duplication
- Span date range validation enforced (end_date >= start_date)