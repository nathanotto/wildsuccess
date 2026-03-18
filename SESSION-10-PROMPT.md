# SESSION 10: Capture Parser and Life Stream

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Previous sessions built:** Map Module, Organize Week modal, the /today page with focus view and four-state items, action_log, hopper_items, schedule_items, item_notes. The capture input exists on every major page (/today, Organize, Map) but currently saves raw text to the hopper with no parsing.

**This session adds intelligence to capture without using AI.** Every capture input in the app gets a deterministic parser that extracts dates, times, people, activities, durations, feeling words, and direction (forward/backward) from raw dictated or typed text. The parser produces structured WS data and routes it to the correct destination — hopper, schedule, or action_log.

**Read these project files before doing anything:**
- `SESSION-8-PROMPT.md` — schema with time_type, bounding_type, hopper logic
- `SESSION-9-PROMPT.md` — /today page, focus view, item states
- `wild-success-constitutional-reference.docx` — section 1 (Purpose), section 5 (Agency — Principle 5), section 6.5 (Task Contexts), section 6.8 (Commitments)

**Design philosophy:** The user dictates into the capture field on their phone. No special syntax. No slash commands. Just natural speech transcribed to text. WS parses what it can, confirms what it understood, and saves the raw text regardless. WS is subordinate to the user (Principle 5) — it never acts without showing what it understood, and it never blocks a capture on failed parsing.

---

## 1. Schema Changes

### Migration: `supabase/migrations/010_capture_parser.sql`

#### 1.1 Add 'logged' event type to action_log

```sql
ALTER TABLE action_log DROP CONSTRAINT IF EXISTS action_log_event_type_check;
ALTER TABLE action_log ADD CONSTRAINT action_log_event_type_check
  CHECK (event_type IN (
    'proposed', 'scheduled', 'committed', 'rescheduled', 'removed',
    'completed', 'skipped', 'captured', 'dismissed', 'reopened',
    'parked', 'in_progress', 'logged'
  ));
```

The 'logged' event type is for backward-looking life stream entries — things the user did that weren't on any schedule. "Had lunch with Erin" or "Three hours building Wild Success." These carry metadata but don't create hopper or schedule items.

#### 1.2 New table: `known_people`

```sql
CREATE TABLE known_people (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  normalized_name text NOT NULL,
  notes text,
  mention_count integer NOT NULL DEFAULT 0,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_mentioned_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT known_people_pkey PRIMARY KEY (id),
  CONSTRAINT known_people_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT known_people_unique_name UNIQUE (user_id, normalized_name)
);

ALTER TABLE known_people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "known_people_select_own" ON known_people FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "known_people_insert_own" ON known_people FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "known_people_update_own" ON known_people FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "known_people_delete_own" ON known_people FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_known_people_user_id ON known_people(user_id);
CREATE INDEX idx_known_people_normalized_name ON known_people(normalized_name);
```

The `normalized_name` field stores a lowercase, trimmed version of the name for matching. "John Lawrence" → "john lawrence". This handles case-insensitive matching from dictation.

#### 1.3 New table: `known_people_value_links`

```sql
CREATE TABLE known_people_value_links (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  person_id uuid NOT NULL,
  value_id uuid NOT NULL,
  contribution_strength text NOT NULL DEFAULT 'moderate'
    CHECK (contribution_strength IN ('weak', 'moderate', 'strong')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT known_people_value_links_pkey PRIMARY KEY (id),
  CONSTRAINT known_people_value_links_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  CONSTRAINT known_people_value_links_person_id_fkey FOREIGN KEY (person_id) REFERENCES known_people(id) ON DELETE CASCADE,
  CONSTRAINT known_people_value_links_value_id_fkey FOREIGN KEY (value_id) REFERENCES user_values(id) ON DELETE CASCADE,
  CONSTRAINT known_people_value_links_unique UNIQUE (person_id, value_id)
);

ALTER TABLE known_people_value_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kpvl_select_own" ON known_people_value_links FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "kpvl_insert_own" ON known_people_value_links FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "kpvl_update_own" ON known_people_value_links FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "kpvl_delete_own" ON known_people_value_links FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_kpvl_person_id ON known_people_value_links(person_id);
```

When the user links a person to values (e.g. Erin → Connection), every future capture mentioning that person inherits those value connections.

#### 1.4 Seed known people from user profile

After migration, seed known_people from existing data:
- Parse user_profiles.full_name for the user's own name (useful to exclude from matching)
- If Google Calendar is connected, extract unique attendee names from calendar_events and create known_people rows
- Family names from the constitutional reference (Erin, Winston) should be added manually by the user — the system does not presume to know the user's family

---

## 2. The Parser

### Overview

Build a single function: `parseCapture(rawText, userContext)`.

`userContext` is an object loaded once when the page loads (and refreshed when data changes):
```
{
  knownPeople: [{ id, name, normalizedName, valueLinks }],
  activities: [{ id, name, normalizedName, valueLinks, timeType }],
  taskSuggestions: [{ id, name, normalizedName }],
  values: [{ id, name, normalizedName }],
  userName: string  // to exclude from people matching
}
```

The function returns a parsed result:
```
{
  direction: "forward" | "backward",
  outcome: "captured" | "captured_dated" | "scheduled_soft" | "scheduled_hard" | "tickler" | "outside_request" | "commitment" | "logged",
  cleanedName: string,
  rawInput: string,
  date: string | null,          // ISO date
  time: string | null,          // HH:MM
  endTime: string | null,       // HH:MM
  duration: number | null,      // minutes
  person: { id, name } | null,
  activityMatch: { id, name, valueLinks, timeType } | null,
  valueLinks: [{ valueId, valueName, strength }],
  timeType: string | null,      // A/B/C/D/0
  feelings: string[],
  isOutsideRequest: boolean,
  confidence: number            // 0.0 to 1.0
}
```

### Parser Stages

The parser runs seven stages in sequence. Each stage examines the text, extracts what it can, and strips matched phrases from the working text so subsequent stages don't re-match.

**Stage 1: Date and time extraction.**

Use the `chrono-node` library (install: `npm install chrono-node`). It parses natural language dates and times from English text.

Input: "Call John Lawrence tomorrow at 3pm"
Output: date = tomorrow's ISO date, time = "15:00"
Remaining text: "Call John Lawrence"

Input: "Dentist March 25 at 9:15am"
Output: date = "2026-03-25", time = "09:15"
Remaining text: "Dentist"

Input: "Remind me to check results in two weeks"
Output: date = two weeks from now
Remaining text: "Remind me to check results"

Also extract durations: "for three hours", "for 30 minutes", "for an hour". Parse these manually — chrono-node handles dates but not durations reliably. Use regex patterns:
- `for (\d+) (hour|hr|minute|min)s?`
- `for (an|one) hour` → 60
- `for (a|one) half hour` → 30
- `(\d+) hours?` at end of string → duration

Strip matched date/time/duration phrases from the working text.

**Stage 2: Known people matching.**

Load known_people for the user. For each person, check if their name appears in the remaining text. Match strategy:

1. Sort known_people by name length descending (match "John Lawrence" before "John")
2. For each person, check if their normalized_name appears in the lowercased text
3. On match: record the person, strip the name from the text, inherit their value links
4. Also check for patterns: "with [name]", "from [name]", "[name] asked me to"

Handle the user's own name — exclude it from matching. "I had lunch" should not match a person named "I."

If a name appears in the text but doesn't match any known_people, flag it as an unrecognized name. The confirmation card can offer "Add [name] to contacts?"

**Stage 3: Activity matching.**

Load activities and task_suggestions. For each, check if the remaining text contains a fuzzy match against the activity/task name. Use a fuzzy string matching library (install: `npm install fuse.js`).

Configure Fuse.js with:
- threshold: 0.4 (fairly strict)
- keys: ['normalizedName']
- minMatchCharLength: 3

On match: record the activity, inherit its value links and time_type.

The match must be meaningful — a 3-character match on a 50-character input is noise. Require that the matched activity name is at least 40% of the remaining text length, or that the Fuse score is above 0.7.

**Stage 4: Tense and direction detection.**

Examine the first few words of the original raw text (before stripping) to determine direction:

Backward indicators (log entry):
- Starts with: "I just", "just", "had", "spent", "ate", "went", "took", "finished", "did", "was", "made", "gave", "got", "saw", "met", "talked"
- Contains past-tense markers in the first three words
- Contains "just" anywhere in the first half of the text

Forward indicators (to-do):
- Starts with imperative verbs: "call", "schedule", "review", "pick up", "send", "email", "buy", "write", "fix", "book", "plan", "set up", "look into", "follow up", "check", "ask", "remind"
- Contains a future date (tomorrow, next week, etc.)
- Contains "need to", "have to", "should", "want to"

If ambiguous, default to forward (to-do). It's easier to reclassify a to-do as a log entry than to lose a task.

**Stage 5: Feeling word detection.**

Match against a fixed dictionary:
```
fun, hard, meaningful, tedious, peaceful, stressful, satisfying,
draining, playful, frustrating, rewarding, boring, exhausting,
relaxing, productive, enjoyable, difficult, easy, intense, calm
```

Look for these words at the end of the input, or after a comma, dash, or "and". "Three hours on WS, fun and meaningful" → feelings: ["fun", "meaningful"]. "That was hard" → feelings: ["hard"].

Strip matched feeling phrases from the cleaned name.

**Stage 6: Outside request detection.**

Check for patterns:
- "[person] asked me to [remainder]" → outside request, person matched
- "[person] wants me to [remainder]" → outside request
- "[person] needs [remainder]" → outside request
- "for [person]" at the end → possible commitment to that person
- "I told [person] I would" → self-initiated commitment
- "I promised [person]" → commitment

If detected, set isOutsideRequest = true and record the person.

**Stage 7: Time type inference.**

If an activity matched, inherit its time_type. Otherwise, infer from the verb:
- "call", "email", "text", "message", "send" → B (comms/routine)
- "review", "write", "build", "design", "plan", "think about" → A (focus)
- "pick up", "buy", "go to", "drive", "drop off" → B (errand/routine)
- "exercise", "run", "yoga", "meditate", "therapy" → D (self-care)
- "nap", "rest", "relax", "walk", "read" → 0 (free time)
- "meeting", "appointment", "dentist", "court" → B or hard_scheduled

Default to B if nothing matches.

### Outcome Determination

After all seven stages, determine the outcome:

| Direction | Date | Time | Pattern | Outcome |
|-----------|------|------|---------|---------|
| backward | any | any | any | `logged` |
| forward | none | none | none | `captured` |
| forward | yes | none | none | `captured_dated` |
| forward | yes | yes | none | `scheduled_soft` |
| forward | yes | yes | appointment/meeting/court/dentist keyword | `scheduled_hard` |
| forward | future (>1 week) | none | "remind me" pattern | `tickler` |
| forward | any | any | outside request detected | `outside_request` |
| forward | any | any | commitment detected | `commitment` |

### Confidence Scoring

Count the fields the parser filled:
- Date or time found: +0.2
- Person matched: +0.2
- Activity matched: +0.2
- Direction clearly determined: +0.1
- Feeling words found: +0.1
- Time type inferred (not default): +0.1
- Outside request or commitment detected: +0.1

Maximum: 1.0. In practice, most captures score 0.3–0.7.

Thresholds:
- 0.6 and above: high confidence → act and show toast
- 0.3 to 0.6: medium confidence → act and show confirmation card
- Below 0.3: low confidence → save raw, no card

### Cleaned Name

The cleaned name is the original text with date phrases, time phrases, duration phrases, person names (when they appear in "with [name]" or "[name] asked me" patterns but NOT when they're the object of the verb), and feeling words stripped. Trim whitespace and clean up dangling prepositions.

"Call John Lawrence tomorrow at 3pm" → "Call John Lawrence"
"Had lunch with Erin for an hour, meaningful" → "Had lunch"
"Casey asked me to review the funding deck by Friday" → "Review the funding deck"
"Three hours building Wild Success, fun and playful" → "Building Wild Success"

---

## 3. Routing — What Happens After Parsing

### Outcome: logged

Create an action_log entry:
- event_type = 'logged'
- event_date = parsed date, or today if no date
- metadata = { duration, person (id + name), feelings, valueLinks, timeType, rawInput }

If a person was matched, increment known_people.mention_count and update last_mentioned_at.

Do NOT create a hopper_item or schedule_item. This is already done.

### Outcome: captured

Create a hopper_item:
- raw_input = original text
- source = 'quick_capture'
- status = 'pending'
- proposed_date = null
- time_type = parsed time_type or 'B'
- bounding_type = 'action'
- metadata = { person (id + name), activityMatch, valueLinks, feelings, confidence }

If a person was matched, increment mention_count.

### Outcome: captured_dated

Same as captured, but:
- proposed_date = parsed date

### Outcome: scheduled_soft

Create a schedule_item directly (skip the hopper):
- name = cleaned name
- scheduled_date = parsed date
- scheduled_time = parsed time
- scheduled_end_time = parsed time + default duration (60 min) or parsed duration
- flexibility = 'soft_scheduled'
- time_type = parsed time_type
- status = 'active'

Also write action_log event with event_type = 'scheduled'.

### Outcome: scheduled_hard

Same as scheduled_soft, but:
- flexibility = 'hard_scheduled'

Trigger on keywords: "appointment", "meeting", "dentist", "court", "flight", "doctor", "therapy session". These imply external commitments that cannot be casually moved.

### Outcome: tickler

Create a hopper_item:
- raw_input = original text
- source = 'quick_capture'
- proposed_date = parsed future date
- status = 'pending'
- metadata = { isTickler: true }

The item sits dormant. It surfaces when Organize opens for the week containing the proposed_date. Before that week, it's invisible.

### Outcome: outside_request

Create a hopper_item:
- raw_input = original text
- source = 'outside_request'
- proposed_date = parsed deadline date or null
- metadata = { requestedBy: person name, person_id, deadline, rawInput }

### Outcome: commitment

Same routing as outside_request, but:
- metadata includes { isCommitment: true, committedTo: person name, person_id }

This is a self-initiated commitment. "I told Karen I'd send her that article." The distinction from outside_request matters for reflection — the user chose to make this commitment, it wasn't imposed.

---

## 4. UI Responses

### Toast (high confidence, 0.6+)

A brief text confirmation that appears near the capture input for 3 seconds, then fades. Tappable — tapping opens the confirmation card for editing.

Format by outcome:
- logged: "Logged: [cleaned name]"
- captured: "Captured: [cleaned name]"
- captured_dated: "[Date label]: [cleaned name]" — e.g. "Tomorrow: Call John Lawrence"
- scheduled_soft: "Penciled in: [cleaned name], [day] [time]"
- scheduled_hard: "Booked: [cleaned name], [day] [time]"
- tickler: "Reminder set: [date label]"
- outside_request: "From [person]: [cleaned name]"
- commitment: "Committed to [person]: [cleaned name]"

Toast styling: 13px, muted color, no background, no border. Just text that appears and fades. Tapping it before it fades opens the card.

### Confirmation Card (medium confidence, 0.3–0.6)

A compact card that slides up from the capture input. Shows what the parser understood. Two actions: "Got it" and "Edit."

Card contents:
- Cleaned name (bold)
- Parsed fields on one line: date if found, time if found, person if found, duration if found
- Inferred values if any (small, muted)
- Direction indicator: "→ to-do" or "← logged"
- Outcome type: "scheduled", "captured for Thursday", "outside request from Casey"

"Got it" — accepts the parse as-is. Creates the item. Card dismisses.
"Edit" — expands the card to show editable fields: name, date, time, person (dropdown of known_people + "add new"), values (multi-select), time type (A/B/C/D/0), direction toggle (to-do / log entry). Save button writes the edited data.

The card auto-dismisses after 5 seconds if the user ignores it. The item is saved regardless — the card is for correction, not approval.

If the parser found a name that isn't in known_people, the card shows: "Who is [name]?" with an "Add to contacts" link.

### Silent Save (low confidence, below 0.3)

No toast, no card. The raw text is saved as a hopper_item with source='quick_capture' and no parsed metadata. The user handles it during Organize.

---

## 5. Known People Management

### Automatic Accumulation

Every time the parser matches a person, increment their mention_count and update last_mentioned_at. This data helps prioritize fuzzy matching — frequently mentioned people match before rarely mentioned ones.

When the parser encounters an unrecognized name (a capitalized word or phrase that looks like a name but doesn't match known_people), the confirmation card offers to add them.

### Manual Management

Build a simple known_people management view, accessible from Settings:
- List of known people, sorted by mention_count (most frequent first)
- Each shows: name, mention count, last mentioned, linked values
- Add new person: name field, optional value links
- Edit: change name, add/remove value links, add notes
- Delete: remove person (does not affect past captures or log entries)

### Value Links on People

When the user links a person to values (Erin → Connection, Casey → Money + Purpose), every future capture mentioning that person inherits those value connections. This is set once per person and applies automatically.

The value link is a suggestion, not a mandate. If "Call Casey" matches Casey → Money + Purpose, those values appear in the confirmation card. The user can remove them via "Edit" if this particular call isn't about money.

### Initial Population

On first run of the parser (or when the user first visits Settings > People):
- If Google Calendar is connected: extract unique attendee names from the past 30 days of calendar_events. Present them to the user as suggested contacts to add. Do not auto-add — the user confirms which ones to keep.
- Suggest family names from user_profiles if present (full_name field may contain partner/family names in notes or description).

---

## 6. API Routes

### Capture — `/api/capture`
- `POST` — accepts `{ rawInput, source }`. Source is 'today', 'organize', or 'map' (indicates which page the capture came from, for analytics). Runs the parser. Routes to the correct destination. Returns the parsed result and the created item (hopper_item, schedule_item, or action_log entry).

### Known People — `/api/known-people`
- `GET` — all known_people for current user, ordered by mention_count descending. Includes value links.
- `POST` — create (name, notes, value_link_ids). Normalizes the name automatically.
- `PATCH /api/known-people/[id]` — update name, notes.
- `DELETE /api/known-people/[id]` — remove.

### Known People Value Links — `/api/known-people/[id]/values`
- `POST` — add value link (value_id, contribution_strength).
- `DELETE /api/known-people/[id]/values/[linkId]` — remove value link.

### Capture Edit — `/api/capture/[id]/edit`
- `PATCH` — accepts edited fields from the confirmation card. Updates the created item (hopper_item or schedule_item or action_log entry) with the corrected data.

---

## 7. Integration

### Where the Parser Runs

Every capture input in the app calls the same `POST /api/capture` endpoint. The parser runs server-side so it has access to the user's context (known_people, activities, values) without loading it all into the client.

Capture inputs exist on:
- `/today` — the capture field at the bottom
- Organize Week modal — the hopper capture field
- Map page — the floating capture input (if it exists)

All three use the same UI pattern: text input → submit → toast or card or silent save.

### Client-Side Flow

1. User types or dictates into capture input, hits Enter
2. Client sends `POST /api/capture` with the raw text
3. Server runs parseCapture, creates the appropriate item, returns the parsed result
4. Client receives the result and displays the appropriate UI:
   - High confidence: show toast with the confirmation text
   - Medium confidence: show confirmation card
   - Low confidence: show nothing (maybe a brief "Saved" flash)
5. If the user taps the toast or taps "Edit" on the card, show the editable fields
6. On "Got it" or card auto-dismiss: done
7. On edit + save: client sends `PATCH /api/capture/[id]/edit` with corrected fields

### Dependencies

Install these npm packages:
- `chrono-node` — natural language date parsing
- `fuse.js` — fuzzy string matching

Both are lightweight, well-maintained, and run server-side.

---

## 8. Visual Design

### Toast

- Position: directly below the capture input, left-aligned
- Font: 13px Source Sans 3, muted color (var(--color-text-secondary))
- No background, no border, no shadow
- Appears instantly on capture submit, fades out over 0.5s after 3 seconds
- Tapping the toast before it fades opens the confirmation card
- Cursor: pointer while visible

### Confirmation Card

- Position: slides up from the capture input, overlapping the list slightly
- Max width: matches the capture input width
- Background: white, border: 1px solid var(--color-border-tertiary), border-radius: 4px (minimal, not rounded)
- Shadow: 0 2px 8px rgba(0,0,0,0.06)
- Padding: 10px 12px
- Cleaned name: 14px, font-weight 600
- Parsed fields: 12px, muted, one line
- "Got it" button: 12px, muted, tappable text — not a styled button
- "Edit" link: 12px, muted, tappable text
- "Add [name] to contacts?" link: 12px, #4B6A82
- Auto-dismiss: card fades out after 5 seconds
- Edit expansion: fields appear below the card content, same minimal styling as /today focus view inputs

### "Add to contacts" flow

When the card shows "Who is [name]?":
- Tapping "Add to contacts" creates the known_people row immediately with the detected name
- A brief inline confirmation: "[name] added"
- The user can later add value links from Settings > People

---

## What NOT to Build

- No AI calls — the parser is deterministic code only
- No slash commands — natural language and pattern matching only
- No feeling tap UI — feelings come from the capture text itself or from completion flows
- No automatic activity template creation from captures (that's the AI enrichment from Session 7, separate from this parser)
- No push notifications
- No mobile-native dictation integration (the phone's keyboard dictation fills the text field, the parser processes the text)
- No multi-language support — English only
- No voice recording or audio processing

---

## Verification

### Parser — Date/Time
- "Call John tomorrow" → date = tomorrow, outcome = captured_dated
- "Dentist March 25 at 9:15am" → date = March 25, time = 9:15, outcome = scheduled_hard (keyword: dentist)
- "Meeting with Erin 2pm Tuesday" → date = next Tuesday, time = 14:00, person = Erin, outcome = scheduled_soft
- "Remind me to check results in two weeks" → date = 2 weeks out, outcome = tickler
- "Pick up groceries" → no date, outcome = captured

### Parser — People
- "Call John Lawrence" with John Lawrence in known_people → person matched, mention_count incremented
- "Had lunch with Erin" with Erin in known_people → person matched, value links inherited
- "Talk to Dr. Martinez" with no match → unrecognized name flagged, card offers "Add Dr. Martinez?"

### Parser — Direction
- "I just had a great lunch" → backward, outcome = logged
- "Spent three hours building WS" → backward, outcome = logged, duration = 180
- "Call John tomorrow" → forward, outcome = captured_dated
- "Schedule dentist" → forward, outcome = captured

### Parser — Activities
- "Morning run" with "Running" or "Exercise" as an activity → activity matched, value links and time_type inherited
- "Building Wild Success" with "Build Wild Success" as an activity → fuzzy match, values inherited
- "Buy groceries" with no matching activity → no match, time_type inferred from verb ("buy" → B)

### Parser — Feelings
- "Three hours on WS, fun and meaningful" → feelings: ["fun", "meaningful"], stripped from cleaned name
- "That was hard" → feelings: ["hard"]
- "Call John tomorrow" → no feelings

### Parser — Outside Requests
- "Casey asked me to review the deck by Friday" → outside request, person = Casey, deadline = Friday, cleaned name = "Review the deck"
- "I told Karen I'd send her that article" → commitment, person = Karen, cleaned name = "Send Karen the article"

### Parser — Confidence and UI
- "Call John Lawrence tomorrow at 3pm" → confidence ~0.6 (date + time + person), toast shown
- "Had lunch with Erin for an hour, meaningful" → confidence ~0.7 (direction + person + duration + feelings), toast shown
- "Casey asked me to review the deck by Friday" → confidence ~0.6 (person + date + outside_request), card shown (medium — parser should confirm the routing)
- "Remember the thing about the basement" → confidence ~0.1, saved silently

### Routing
- Logged items appear in action_log with event_type='logged' and correct metadata
- Captured items appear in hopper_items with correct proposed_date and metadata
- Scheduled items appear in schedule_items with correct date, time, flexibility
- Ticklers appear in hopper_items with future proposed_date, invisible until that week
- Outside requests appear in hopper_items with source='outside_request'
- All items preserve raw_input regardless of parsing outcome

### Known People
- User can add people from Settings
- User can add people from the confirmation card when parser encounters unknown name
- Value links on people propagate to captures mentioning that person
- Mention count increments on each match
- Calendar attendees can be imported as suggested contacts

---

## Session 11 Preview (for context only — do not build)

Session 11 builds Week Completion — the end-of-week review and reflection. Most items are already captured from /today usage during the week. Week Completion summarizes what happened, resolves remaining items, runs the values check-in (sufficiency reassessment for values active this week), and closes the week. The closed week becomes a frozen snapshot feeding the Values Map.