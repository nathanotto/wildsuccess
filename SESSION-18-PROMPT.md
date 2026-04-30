# SESSION 18: Week Complete and Create — Reflection and Intent Page

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

Many sessions are complete. The app has the Map Module, action items with lifecycle states, day completion ritual with morning triage, /organize page, weeks already exist in the schema, and a captures system.

This session adds a single new page and the schema to support it: **Complete and Create** (C&C). It is a weekly ritual surface where the user reflects on the past week and sets intent for the coming week. It is intentionally NOT a dashboard. It is a page for one human practice, repeated weekly.

**Read these project files before doing anything:**
- `Wild_Success_Principles.md` — the philosophical foundation
- `TASK-ORIENTED-DESIGN.md` — TOD methodology that governs WS interfaces
- The current `weeks` table schema (or equivalent week record) in the most recent migration
- The `/organize` page implementation (this session adds a small link to it; do not redesign /organize)

**Read the design conversation context:**
The C&C ritual emerged from a long design discussion. Key principles to honor:
- The page is a *mirror*, not a dashboard. Its job is to give the user something to react to, not to score them.
- Reflection is grounded in the user's own captured words from the past week, not in WS-generated metrics or AI summaries.
- Intent for the coming week is the user's own statement, not WS's suggestion.
- The ritual is optional. If skipped, life still works. The page must handle gracefully the case where last week was never created.
- Independence: completing one step does not gate another. The user handles the ambiguity of real life.

---

## What to Build

### 1. Migration: Week Create and Complete Statements

Create `supabase/migrations/0XX_week_create_complete.sql` (use the next available number).

The `weeks` table (or whatever the current week record table is called) gets these columns:

```sql
ALTER TABLE weeks ADD COLUMN create_statement text;
ALTER TABLE weeks ADD COLUMN complete_statement text;
ALTER TABLE weeks ADD COLUMN created_at_ritual timestamptz;  -- when the user wrote the create statement
ALTER TABLE weeks ADD COLUMN completed_at_ritual timestamptz;  -- when the user wrote the complete statement
ALTER TABLE weeks ADD COLUMN organized_at timestamptz;  -- when the user marked organized
ALTER TABLE weeks ADD COLUMN deconflicted_at timestamptz;  -- when the user marked deconflicted
```

Naming note: use `_at_ritual` suffix (or similar) to avoid colliding with any existing `created_at` row-creation timestamp on the table. If the existing column is named differently, adapt.

If the `weeks` table does not yet exist as a record (i.e. weeks are computed on the fly), create it now:

```sql
CREATE TABLE IF NOT EXISTS weeks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start date NOT NULL,  -- Monday
  create_statement text,
  complete_statement text,
  created_at_ritual timestamptz,
  completed_at_ritual timestamptz,
  organized_at timestamptz,
  deconflicted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);
```

Add an RLS policy: users can only see and modify their own week records.

A week record is created on demand when the user first visits the C&C page for that week, or when /organize first touches it. Lazy creation is fine.

**Run the migration and verify success before declaring this section complete.**

### 2. API Routes

#### `GET /api/weeks/[week_start]`
Returns the week record for the given Monday date (ISO format YYYY-MM-DD), creating it if it doesn't exist. Returns all fields.

#### `PATCH /api/weeks/[week_start]`
Update any of: `create_statement`, `complete_statement`, `created_at_ritual`, `completed_at_ritual`, `organized_at`, `deconflicted_at`. Setting a statement to non-null without an `_at_ritual` timestamp should auto-set the timestamp to now(). Setting any to null clears both the field and its timestamp.

#### `GET /api/weeks/[week_start]/captures`
Returns a chronological stream of all "capture-like" content the user produced during the week (Monday 00:00 local through Sunday 23:59 local). This is the heart of the page.

What counts as a capture for this stream:
- Action items created during the week (use `created_at`)
- Action items with notes added during the week
- Day log entries
- Any free-text captures from the capture system
- Reflection entries from day completion

Each item in the stream:
```json
{
  "timestamp": "2026-03-25T16:21:00-06:00",  // local time, ISO with offset
  "type": "action_item" | "note" | "day_log" | "reflection" | "capture",
  "text": "the user's actual words",
  "source_id": "uuid of the underlying record"
}
```

Order chronologically ascending. Use the user's local timezone (stored on user_profiles, or fall back to America/Denver).

If the user has no captures for the week, return an empty array — the page will show an honest empty state.

### 3. The Complete and Create Page — `/cc/[week_start]` (or similar)

A single Next.js page at a route like `/cc/2026-03-23`. The route param is the Monday date of the week being completed.

The page is centered, single column, max-width about 720px. Generous vertical rhythm. Source Sans 3. Light background (#FAFAF7). No dashboard chrome.

The page has these sections, top to bottom:

#### A. Header
- Page title: "Complete and Create"
- Subtitle: the week being worked on, e.g. "Week of March 23 → March 29"
- Four small checkboxes in a row, each with a label: **Completed** · **Created** · **Organized** · **De-conflicted**
  - Each is independent. Clicking toggles the corresponding `_at` timestamp on the week record.
  - Visual: simple square checkboxes. Source Sans 3, 13pt labels, muted color when unchecked, normal color when checked. No celebration animations.
  - These are status flags the user manages. Nothing on the page is gated by them.

#### B. Last Week's Create Statement
- Section heading: "Last week's intent"
- The text of the previous week's `create_statement`.
- If null: show the default text "Routine week." in italic muted style.
- This is read-only. Plain text, generous line height, font-serif if available for a slight editorial feel — otherwise sans is fine.

#### C. Report of Last Week — Captures Stream
- Section heading: "Last week, in your words"
- A chronological stream of the captures returned from `GET /api/weeks/[last_week_start]/captures`.
- Each entry: a small left-margin timestamp (light gray, ~11pt, format like "Mon 6:30a" or "Wed 4:14p" — short, scannable), then the text.
- Text in normal body weight, ~15pt, line-height 1.6.
- Entries separated by modest vertical spacing (~12px). No bullets, no cards, no boxes.
- Timestamps in the user's local timezone.
- Empty state: "No captures for last week." in italic muted style. Don't pad it out.

This section is the "report." It is intentionally not a metrics dashboard. The user reads back through their own week in their own voice.

#### D. Complete Last Week — Reflection Prompt
- Section heading: "Complete last week"
- A single textarea (multi-line, expanding) with this prompt above it:
  > "Was that what you expected? What did you feel and notice? What surprised you?"
- Placeholder in the textarea: empty, or very faint guidance.
- Saves to `complete_statement` on the previous week's record.
- Save behavior: debounced auto-save on blur or after pause in typing. No save button needed. A small "saved" indicator (light, brief) confirms.
- Next to the section heading: a small "?" circle that, on click, opens a brief popover explaining the purpose of the reflection. For now, the popover content can be: "Looking back at the week through your own words helps you notice patterns, surprises, and the gap between intent and reality. Reflection is the practice; this is the surface."

#### E. Preview of Next Week
- Section heading: "Next week, so far"
- Show whatever is already on the books for the coming week (Monday → Sunday):
  - Calendar events synced to that week (use existing calendar data if available; if calendar integration isn't built yet, skip this subsection silently)
  - Action items dated into next week
  - Anything with a due date in that range
- Format: same chronological stream style as section C, with timestamps. Plain text, no boxes.
- Empty state: "Nothing on the books yet." in italic muted style.
- This is also intentionally not a dashboard. It is a glance at what already exists, to inform the create statement below.

#### F. Create This Week — Intent Prompt
- Section heading: "Create this week"
- A single textarea with this prompt above it:
  > "What do you expect and intend for this coming week? What might be hard? What might be wonderful?"
- Saves to `create_statement` on the coming week's record.
- Same auto-save behavior as section D.
- Same "?" circle next to the heading. Popover content: "Setting intent for the week — not as a plan, but as a statement of expectation — gives next Sunday's reflection something to compare against. Intent isn't a commitment to control the week; it's a clear-eyed statement of what you expect and intend."

#### G. Footer Links
- A small link: "Organize this week →" linking to `/organize` for the coming week.
- A small link: "View all weeks" or similar (optional, future).
- That's it. No big CTA buttons.

### 4. Routing and Defaults

- Default route: `/cc` (no param) → redirects to `/cc/[current_or_most_recent_monday]`.
- The "current week to complete" logic: if today is Friday, Saturday, Sunday, or Monday, the page defaults to completing the Monday-just-passed (or today if Monday). On other days, it defaults to the most recent Monday. The user can navigate.
- Add prev/next week navigation arrows in the header (`←` `→`) so the user can move between weeks.

### 5. Link from /organize

On the `/organize` page, in the existing title bar (which currently looks like: `Organize ← Today → • Cal synced ↻ Sync This Week April`), add a small text link **only when** the C&C ritual for the current week is incomplete AND it is currently Friday, Saturday, Sunday, or Monday.

Placement: at the right end of the existing title bar row, after "April". Format:
```
· Complete this week →
```
- 12pt, muted color, hover underline.
- Links to `/cc/[current_week_monday]`.
- When the C&C is fully done for the week (all four checkboxes set), the link disappears, optionally replaced by a quiet `✓ Week created` indicator in the same spot (also muted, same size).
- Adds zero vertical space. Same row as existing title bar elements.

### 6. Create Statement on /organize Title Bar

Also on `/organize`, surface the current week's `create_statement` in the title bar area.

- Truncated to ~70 characters with ellipsis.
- On hover (or click on touch), show full text in a small popover.
- Placement: somewhere in or near the title bar that doesn't add vertical space. A reasonable spot is below "This Week April" as a small italicized line, or inline after it. Use judgment — match the existing layout's rhythm.
- Style: 12pt, italic, muted color. Should feel ambient, not loud.
- If the create statement is null, show nothing (do not show "Routine week." here — that default is only for the C&C reflection lookback).

---

## Visual Design Rules

- Match the existing WS aesthetic: Source Sans 3, light background (#FAFAF7), white surfaces, muted earth-tone palette, square checkboxes, no rounded pill shapes, no color tags, low graphoria.
- The C&C page should feel quiet and uncluttered. Generous whitespace. Single column. Reading-paced.
- No metrics, no charts, no counts anywhere on the page.
- No AI on this page. None. No generated summaries, no suggested intents, no auto-completion.
- Timestamps in the captures stream should be light gray, small, in the left margin, easy to ignore.
- The reflection and intent textareas should feel like writing surfaces, not form fields. Minimal borders, comfortable padding, line-height 1.6 or higher.

---

## What NOT to Build

- No scoring, kept/broken counts, or counterparty rollups
- No AI generation of any kind on this page
- No charts, sparklines, or footprints
- No notifications or recurring reminders (the user creates their own activity for this; do not auto-generate one)
- No gating between checkboxes
- No celebration animations or gamification
- No mobile layout (desktop-first, same as the rest of WS)
- No changes to /organize beyond the small link and the create statement display
- No changes to the action items table or capture system
- No real-time collaboration features
- No export

---

## Verification

Run the migration and verify success before continuing. Then:

- Visit `/cc` → redirects to the appropriate week's C&C page.
- The page renders all sections in order. Empty sections show honest empty states.
- Last week's create statement displays correctly. If last week has no create statement, it shows "Routine week." in italic.
- The captures stream pulls real data from the week's date range and orders it chronologically with local-time timestamps.
- Writing in the Complete textarea auto-saves to `complete_statement` on the previous week's record. Reload confirms persistence.
- Writing in the Create textarea auto-saves to `create_statement` on the coming week's record. Reload confirms persistence.
- Toggling each of the four checkboxes sets/clears the corresponding `_at` timestamp on the week record. Each is independent.
- The "?" popovers display the explanation text on click.
- Navigate between weeks with the arrows. Each week loads its own data correctly.
- On `/organize`, when today is Fri/Sat/Sun/Mon and the current week's C&C is incomplete, the "· Complete this week →" link appears in the title bar in the specified location, adds zero vertical space, and links correctly.
- When the four checkboxes are all set, the link disappears (optionally replaced by `✓ Week created`).
- The current week's `create_statement` (if any) appears in the /organize title bar area, truncated to ~70 chars, with full text on hover.
- A user who has never used C&C can visit the page, see honest empty states, write their first reflection and intent, and have it persist. No errors, no required fields.
- A week with no captures shows the empty state and does not crash.
- All four checkboxes can be toggled independently in any order.
- RLS confirmed: users cannot read or modify other users' week records.