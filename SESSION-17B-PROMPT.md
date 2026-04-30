# SESSION 17: Markers, Big Outcome Closure, and Nudge-to-Hopper

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

This session introduces the **markers** concept and solves the tactical problem of how a user completes (or otherwise closes) a Big Outcome, while also creating a lightweight path for Big Outcomes to feed the `/organize` hopper without crowding it.

**Read these project files before doing anything:**

- `wild-success-constitutional-reference.docx` — foundational principles
- `TASK-ORIENTED-DESIGN.md` — design methodology, especially "confirmation with consequence"
- `Wild_Success_Principles.md`
- The current `/organize` page implementation at `app/organize/` (or wherever `OrganizeWeekModal` lives) — understand how candidate action_items flow into the hopper before making changes

**Two principles that govern this session:**

1. *The tactical act should be near-frictionless; the reflection should be unhurried and batched.* Closing a Big Outcome is one click plus an optional one-line note. Considered reflection happens later (not this session).
2. *Commitment is scarce and real. Possibility is infinite and cheap.* The hopper is "on deck" — it should not fill up automatically with every Big Outcome. The user pushes a Big Outcome nudge into the hopper deliberately when an actionable nudge emerges.

---

## Architecture Note

This session touches three surfaces:

1. **Database** — new `markers` table; new columns on `big_outcomes`; minor status enum expansion.
2. **`/map` page** — Big Outcome cards get a `Close…` picker and a `Nudge this week` action.
3. **`/organize` page** — a collapsed "Active Outcomes" strip that expands to show BOs with the same `Nudge this week` action inline. **No changes to the hopper's internal structure.** Pushing a nudge from /organize just creates a candidate action_item the same way quick capture does, and the existing hopper loader picks it up.

Markers are a record layer. They outlive their subjects. They are not reflection UI (that comes later as part of `/review/month`). For now, we write markers, store them correctly, and display them minimally on `/map`.

---

## What to Build

### 1. New Migration

Create `supabase/migrations/0XX_markers_and_closure.sql` (use the next available number).

#### 1a. New `markers` table

```sql
CREATE TABLE public.markers (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  occurred_on date NOT NULL,
  subject_type text CHECK (subject_type = ANY (ARRAY['big_outcome'::text, 'mission'::text, 'coa'::text, 'life_event'::text])),
  subject_id uuid,
  subject_title_snapshot text NOT NULL,
  marker_type text NOT NULL CHECK (marker_type = ANY (ARRAY[
    'accomplished'::text,
    'declared_complete'::text,
    'closed_with_succession'::text,
    'abandoned'::text,
    'life_event'::text
  ])),
  title text NOT NULL,
  in_moment_note text,
  reflection text,
  reflection_status text NOT NULL DEFAULT 'pending'::text CHECK (reflection_status = ANY (ARRAY['pending'::text, 'reflected'::text, 'skipped'::text])),
  significance integer CHECK (significance >= 1 AND significance <= 3),
  succeeded_by_type text CHECK (succeeded_by_type IS NULL OR succeeded_by_type = ANY (ARRAY['big_outcome'::text, 'mission'::text, 'coa'::text])),
  succeeded_by_id uuid,
  linked_value_ids uuid[] DEFAULT '{}'::uuid[],
  linked_domain_ids uuid[] DEFAULT '{}'::uuid[],
  media_attachments jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT markers_pkey PRIMARY KEY (id),
  CONSTRAINT markers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE
);

CREATE INDEX markers_user_occurred_idx ON public.markers (user_id, occurred_on DESC);
CREATE INDEX markers_subject_idx ON public.markers (subject_type, subject_id) WHERE subject_id IS NOT NULL;
CREATE INDEX markers_reflection_status_idx ON public.markers (user_id, reflection_status);
```

RLS: user can only see and modify their own markers.

```sql
ALTER TABLE public.markers ENABLE ROW LEVEL SECURITY;

CREATE POLICY markers_select ON public.markers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY markers_insert ON public.markers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY markers_update ON public.markers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY markers_delete ON public.markers FOR DELETE USING (auth.uid() = user_id);
```

Updated_at trigger, same pattern as other tables.

#### 1b. New columns on `big_outcomes`

```sql
ALTER TABLE public.big_outcomes
  ADD COLUMN closure_type text CHECK (closure_type IS NULL OR closure_type = ANY (ARRAY[
    'accomplished'::text,
    'declared_complete'::text,
    'closed_with_succession'::text,
    'abandoned'::text
  ])),
  ADD COLUMN closed_on date,
  ADD COLUMN succeeds_big_outcome_id uuid REFERENCES public.big_outcomes(id) ON DELETE SET NULL,
  ADD COLUMN succeeded_by_big_outcome_id uuid REFERENCES public.big_outcomes(id) ON DELETE SET NULL;

CREATE INDEX big_outcomes_closure_idx ON public.big_outcomes (user_id, closure_type) WHERE closure_type IS NOT NULL;
```

#### 1c. Expand the big_outcomes status enum

The current check constraint allows `aspirational | in_progress | achieved | abandoned`. Replace it with:

```sql
ALTER TABLE public.big_outcomes DROP CONSTRAINT IF EXISTS big_outcomes_status_check;
ALTER TABLE public.big_outcomes ADD CONSTRAINT big_outcomes_status_check
  CHECK (status = ANY (ARRAY[
    'aspirational'::text,
    'in_progress'::text,
    'achieved'::text,           -- existing; maps to closure_type = 'accomplished'
    'declared_complete'::text,  -- new
    'closed_with_succession'::text, -- new
    'abandoned'::text           -- existing
  ]));
```

Note: `status = 'achieved'` and `closure_type = 'accomplished'` are the canonical pair for outcome achievement. The enum value `achieved` is kept for backward compatibility with existing rows; new closures use `closure_type` as the source of truth.

#### 1d. Run and verify migrations

- Apply the migration using the existing migration workflow.
- Verify the `markers` table exists, RLS is enabled, and the new `big_outcomes` columns are present.
- Confirm no existing rows in `big_outcomes` were broken by the constraint change.

**Do not proceed to code until migrations are applied and verified.**

---

### 2. API Routes

#### 2a. `POST /api/markers`

Creates a new marker. Body:

```ts
{
  occurred_on: string  // YYYY-MM-DD
  subject_type: 'big_outcome' | 'mission' | 'coa' | 'life_event'
  subject_id: string | null  // null for life_event
  subject_title_snapshot: string  // denormalized at creation
  marker_type: 'accomplished' | 'declared_complete' | 'closed_with_succession' | 'abandoned' | 'life_event'
  title: string
  in_moment_note?: string | null
  succeeded_by_type?: 'big_outcome' | 'mission' | 'coa' | null
  succeeded_by_id?: string | null
}
```

Returns the created marker.

#### 2b. `GET /api/markers`

Returns the user's markers ordered by `occurred_on DESC`. Query params (optional):
- `subject_type`, `subject_id` — filter to markers about a specific subject
- `since`, `until` — YYYY-MM-DD range on `occurred_on`
- `reflection_status` — filter

#### 2c. `GET /api/markers/:id`, `PATCH /api/markers/:id`, `DELETE /api/markers/:id`

Standard CRUD. PATCH is permissive on all nullable fields plus `reflection`, `reflection_status`, `significance`, `linked_value_ids`, `linked_domain_ids`, `media_attachments`. Do not allow changing `subject_type`, `subject_id`, or `marker_type` post-creation.

#### 2d. `POST /api/big-outcomes/:id/close`

Atomic closure action. Body:

```ts
{
  closure_type: 'accomplished' | 'declared_complete' | 'closed_with_succession' | 'abandoned'
  closed_on?: string  // YYYY-MM-DD, defaults to today
  in_moment_note?: string | null
  // only used when closure_type === 'closed_with_succession':
  successor?: {
    name: string
    description?: string
    target_date?: string | null
  }
}
```

This endpoint does the following in a single transaction:

1. Loads the Big Outcome, verifies ownership.
2. Sets `closure_type`, `closed_on`, and `status`:
   - `accomplished` → `status = 'achieved'`
   - `declared_complete` → `status = 'declared_complete'`
   - `closed_with_succession` → `status = 'closed_with_succession'`
   - `abandoned` → `status = 'abandoned'`
3. If `closure_type === 'closed_with_succession'` and a `successor` payload is provided:
   - Creates a new Big Outcome with `succeeds_big_outcome_id` set to the closing BO's id.
   - Updates the closing BO's `succeeded_by_big_outcome_id` to the new BO's id.
4. Creates a marker row:
   - `subject_type = 'big_outcome'`
   - `subject_id = <this BO id>`
   - `subject_title_snapshot = <this BO name>`
   - `marker_type = closure_type`
   - `title = <this BO name>`
   - `occurred_on = closed_on`
   - `in_moment_note` if provided
   - `succeeded_by_type = 'big_outcome'`, `succeeded_by_id = <new BO id>` if applicable
   - `linked_value_ids` populated from existing `big_outcome_value_links` for this BO
5. Returns `{ big_outcome, successor_big_outcome?, marker }`.

Cascade handling for linked COAs, missions, and action items is **deferred to a later session**. For now, closing a Big Outcome does not automatically touch linked COAs or action items — they remain as-is with the BO still referenced by id. Add a TODO comment in the handler noting this.

#### 2e. `POST /api/big-outcomes/:id/nudge`

Creates a candidate action_item linked to the BO. This is the "push to hopper" action. Body:

```ts
{
  name: string  // the nudge text, e.g. "Call the title company about Pine Creek"
  time_type?: 'A' | 'B' | 'C' | 'D' | '0'  // default 'B'
}
```

Creates a new row in `action_items` with:
- `name: <from body>`
- `source: 'planning_function'`
- `status: 'candidate'`
- `big_outcome_id: <BO id>`
- `time_type: <from body or 'B'>`
- `emotional_weight: 'normal'`

Returns the created action_item. The existing `/organize` hopper loader will pick it up on next refresh.

---

### 3. `/map` Page Changes

On the Big Outcome cards at the bottom of the `/map` page (see `WildSuccessMap5.jsx` and the current `/map` implementation for the card layout):

#### 3a. Add a `…` menu or tap-target to each BO card

Tapping opens a small inline menu with two actions:

- **Nudge this week** → opens a small inline capture (single-line text input, Enter to submit), calls `POST /api/big-outcomes/:id/nudge` with the entered text. Shows a brief toast: "Added to hopper." Does NOT navigate to /organize.
- **Close…** → opens a closure picker (see 3b).

#### 3b. Closure picker

A small modal or inline popover with four options, each briefly described:

- **Accomplished** — "The outcome was achieved as intended."
- **Declared complete** — "I'm calling it done, even if the original vision shifted."
- **Closed with a successor** — "This form is complete; a new Big Outcome continues the arc."
- **Abandoned** — "I'm letting this go without completing it."

Plus a fifth option separated visually:

- **Delete** — "Remove this outcome entirely. No marker will be recorded." (Confirmation required. This does NOT call the closure endpoint — it calls the existing DELETE endpoint for big_outcomes.)

After picking one of the four closure types, show an optional single-line field:

> "One line to capture this moment (optional)"

And, if `closed_with_succession` was selected, show an inline form for the successor BO:

- Name (required)
- Description (optional)
- Target date (optional)

Submit calls `POST /api/big-outcomes/:id/close` with the built payload. On success:

- Toast: a brief confirmation appropriate to the closure type (e.g., "Marked accomplished. It's on the Markers strip.")
- Refresh the BO list and the Markers strip (see 3c).
- If a successor was created, the new BO should appear in the active list.

#### 3c. Markers strip on /map

Add a new section, below the Big Outcomes row, titled **Recent Markers**.

- Shows the user's last ~8 markers (any subject_type), sorted by `occurred_on DESC`.
- Each marker is a small card: title, date (e.g., "Apr 9"), marker_type as a small label, and the `in_moment_note` if present.
- No reflection UI, no editing, no expansion beyond what fits on the card.
- If there are zero markers, show nothing (not even a placeholder — this strip should be invisible when empty to avoid clutter).

Visual weight: low. This is a quiet record, not a trophy case.

---

### 4. `/organize` Page Changes

**Do not touch the hopper's internal structure, the grid, the summary panel, the block palette, or any existing drag/drop logic.**

Add one new element: a collapsed "Active Outcomes" strip.

#### 4a. Placement

Insert the strip between the block type palette and the main body (Hopper + Grid + Summary). It should sit as a thin horizontal bar, collapsed by default.

Collapsed state (default):

```
▸ Active Outcomes · 4
```

Muted text color, small, clickable, full width, no heavy border.

Expanded state: a horizontal row of small cards, one per active BO (`status IN ('aspirational', 'in_progress')` and not closed). Each card shows:

- BO name (truncated if needed)
- A `Nudge this week` inline action (same behavior as on /map: opens a single-line input, submits, creates a candidate action_item via `POST /api/big-outcomes/:id/nudge`)

The expanded strip is visible but not tall. A user should be able to collapse it again with the same toggle. State does not need to persist across sessions for this build — default collapsed on every load is fine.

#### 4b. Loading

Fetch active BOs once per page load, the same way other data is fetched in the existing `loadData()` function in `OrganizeWeekModal`. The existing `outcomes` state already loads big outcomes; reuse that.

After a successful nudge, refresh the hopper (call `loadData()` or its hopper-fetching subset) so the new candidate action_item appears.

#### 4c. What this strip is NOT

- It is not a hopper section. It does not live inside the Hopper panel.
- It does not auto-commit BO-linked items. A nudge creates a candidate; the user still has to drag it to the calendar to commit, like any other hopper item.
- It does not show COAs, missions, activities, or anything else. Only active Big Outcomes. Other entities will get their own pathways in future sessions.
- It does not show closed BOs or markers.

---

### 5. Type updates

Update `lib/types.ts` (or wherever shared types live) to add:

```ts
export interface Marker {
  id: string
  user_id: string
  occurred_on: string
  subject_type: 'big_outcome' | 'mission' | 'coa' | 'life_event' | null
  subject_id: string | null
  subject_title_snapshot: string
  marker_type: 'accomplished' | 'declared_complete' | 'closed_with_succession' | 'abandoned' | 'life_event'
  title: string
  in_moment_note: string | null
  reflection: string | null
  reflection_status: 'pending' | 'reflected' | 'skipped'
  significance: 1 | 2 | 3 | null
  succeeded_by_type: 'big_outcome' | 'mission' | 'coa' | null
  succeeded_by_id: string | null
  linked_value_ids: string[]
  linked_domain_ids: string[]
  media_attachments: unknown | null
  created_at: string
  updated_at: string
}
```

Extend the `BigOutcome` type with the new columns: `closure_type`, `closed_on`, `succeeds_big_outcome_id`, `succeeded_by_big_outcome_id`.

---

### 6. Testing checklist

Before declaring the session complete, verify the following manually in the running app:

1. Migrations apply cleanly and the app still loads with existing data.
2. On `/map`, tapping a BO card reveals the new menu with Nudge and Close options.
3. Nudging a BO from `/map` adds a candidate action_item to the hopper; it appears in `/organize` on next load under the normal tier.
4. Closing a BO as **Accomplished** creates a marker, sets closure_type, and removes the BO from the active list. The marker appears in Recent Markers strip on /map with today's date.
5. Closing a BO as **Closed with succession** creates a marker, closes the original BO, creates the successor BO with `succeeds_big_outcome_id` set, and the successor appears in the active BO list.
6. Closing a BO as **Declared complete** and **Abandoned** both work and create markers with the correct `marker_type`.
7. Deleting a BO (from the same menu) does NOT create a marker and removes the BO entirely.
8. On `/organize`, the collapsed "Active Outcomes" strip is visible, expands on click, and shows active BOs.
9. Nudging a BO from `/organize` adds a candidate action_item to the hopper immediately (loadData refreshes).
10. The `/organize` hopper, grid, summary, block palette, and drag/drop flows still work exactly as before — no regressions.
11. Markers strip on /map shows the markers created during testing, sorted most-recent-first, and is invisible when there are no markers.
12. The in_moment_note, if provided at closure, is visible on the marker card in the strip.

---

## What is NOT in scope for this session

- Reflection UI for markers (significance assignment, reflection text, linked values/domains). This comes with `/review/month`.
- The `/review/month` page itself.
- Cascade handling for closed BOs (linked COAs, missions, action items). Add TODO comments where relevant.
- Closure flows for missions and COAs. The `markers` table schema supports them, but only Big Outcome closure is wired this session.
- Life event markers (manual entry with no subject). Schema supports them; UI comes later.
- Threshold-crossing or system-generated markers.
- Pending-reflection count indicators anywhere in the app.
- Organize sessions audit trail.
- Media attachments on markers.
- Any changes to the hopper's visual structure, the grid, block palette, or summary panel in `/organize`.

---

## Style and conventions

- Follow the existing patterns in the codebase: API routes, Supabase client usage with RLS, type definitions, React state management.
- UI: match the existing /map and /organize visual language. Warm earth palette, Source Sans 3, square corners, low graphoria. The Markers strip on /map and the Active Outcomes strip on /organize should both feel quiet and subordinate to the primary content.
- The closure picker copy is important. Use the wording above verbatim. It's the user's honest self-dialogue about what kind of ending this is.
- Toasts should be brief and not celebratory. "Marked accomplished." not "🎉 Congrats on Pine Creek!"

---

## Completion criteria

- All migrations applied and verified.
- All new API endpoints functional and tested manually against the running app.
- `/map` shows the new BO card menu, closure picker, and Recent Markers strip.
- `/organize` shows the new collapsed Active Outcomes strip with working Nudge action.
- The testing checklist above passes in full.
- No regressions to existing /organize functionality.
- A brief summary of what was built, what was skipped, and any TODOs left in the code.