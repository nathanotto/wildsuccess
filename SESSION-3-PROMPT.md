# SESSION 3: Intake System, Activity Templates, and Inbox Hopper

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Sessions 1 and 2 are complete.** The database has all Map Module tables, RLS, auth, and seed data. The Map page renders an SVG mind map with values, life domains, activities, big outcomes, edit modals, and a Take Action box. Users can create and edit all data objects.

**Read these project files before doing anything:**
- `SESSION-1-PROMPT.md` — the database schema (you will be modifying it)
- `SESSION-2-PROMPT.md` — the Map page and API routes (you will be extending them)
- `wild-success-constitutional-reference.docx` — sections 2 (Value Architecture), 8 (Onboarding), and 2.4 (Vigilance and Systems) are directly relevant
- `TASK-ORIENTED-DESIGN.md` — the dashboard is a task menu, not a data display

---

## What This Session Builds

Three connected systems:

1. **Intake system** — progressive questions that generate personalized Values, Life Domains, and Activity templates
2. **Activity template data model** — enriched schema that captures the messy nuance of real human time and energy
3. **Inbox hopper** — unified staging area for everything that might become an action

These replace the current empty-by-default experience. After this session, a new user walks through intake and arrives at a Map populated with meaningful, personalized data — and has a capture mechanism for new items going forward.

---

## 1. Schema Changes

### Migration: `supabase/migrations/003_intake_and_activities.sql`

#### 1.1 New table: `intake_questions`

Stores the master question bank. Questions are system-level, not per-user.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| question_text | text | not null |
| question_type | text | not null, check in ('boolean', 'single_choice', 'multi_choice', 'number', 'freetext') |
| options | jsonb | nullable, array of choice strings for choice types |
| domain_tag | text | not null — which area this question informs (e.g. 'household', 'work', 'health', 'finance', 'social', 'growth', 'rhythm') |
| sort_order | integer | not null, default 0 — ordering within domain |
| payoff_description | text | not null — concrete description of what answering this enables, e.g. "Answering generates meal planning and errand templates" |
| is_seed_question | boolean | not null, default false — true = asked during initial intake before first Map use |
| created_at | timestamptz | not null, default now() |

No user_id. These are system reference data.

#### 1.2 New table: `intake_responses`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| question_id | uuid | FK → intake_questions, not null |
| response | jsonb | not null — stores the answer in a type-appropriate structure |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Unique constraint on (user_id, question_id).

#### 1.3 Modify `activities` table

The existing `activities` table from Session 1 becomes the Activity Template table. Add these columns:

```sql
ALTER TABLE activities ADD COLUMN context text[] DEFAULT '{}';
-- Array of context tags. Compound concept merging time-type and location.
-- Examples: 'computer-home', 'phone-anywhere', 'errand-out', 'focused-quiet', 'comms-any', 'hands-free'
-- These are freeform but the system seeds common values.

ALTER TABLE activities ADD COLUMN energy_level text DEFAULT 'B'
  CHECK (energy_level IN ('A', 'B', 'C'));
-- A = high-consequence, external-facing, needs best attention
-- B = important but routine, can batch, filler-friendly
-- C = downtime, recovery, low-stakes

ALTER TABLE activities ADD COLUMN emotional_weight text DEFAULT 'normal'
  CHECK (emotional_weight IN ('light', 'normal', 'heavy'));
-- Felt burden disproportionate to clock time.
-- A 5-minute call that looms large = heavy.
-- Filing paperwork = light or normal.

ALTER TABLE activities ADD COLUMN flexibility text DEFAULT 'anytime_this_week'
  CHECK (flexibility IN ('hard_scheduled', 'soft_scheduled', 'anytime_today', 'anytime_this_week'));
-- Where this sits on the calendar-vs-checklist spectrum.

ALTER TABLE activities ADD COLUMN clusterable boolean DEFAULT false;
-- Can this be batched with similar-context tasks?

ALTER TABLE activities ADD COLUMN prep_required boolean DEFAULT false;

ALTER TABLE activities ADD COLUMN prep_notes text;

ALTER TABLE activities ADD COLUMN depends_on_others boolean DEFAULT false;

ALTER TABLE activities ADD COLUMN dependency_notes text;

ALTER TABLE activities ADD COLUMN duration_range_min integer;
-- Minimum typical duration in minutes

ALTER TABLE activities ADD COLUMN duration_range_max integer;
-- Maximum typical duration in minutes
-- These replace default_duration_minutes for more realistic estimates.

ALTER TABLE activities ADD COLUMN source text DEFAULT 'user_created'
  CHECK (source IN ('template_derived', 'user_created', 'outside_request', 'planning_function'));
-- template_derived = system generated from intake
-- user_created = user made it directly
-- outside_request = someone asked something of the user
-- planning_function = flows from missions/outcomes (future)

ALTER TABLE activities ADD COLUMN archived_at timestamptz;
-- Non-null means this template was retired (user confirmed archive of unused proposal)
```

Keep existing columns (name, description, activity_type, frequency, target_date, status, is_preventive, life_domain_id, big_outcome_id, default_duration_minutes, preferred_days, preferred_time, default_location, participants, sort_order). The new columns extend, not replace.

#### 1.4 New table: `hopper_items`

The inbox hopper — unified staging area for everything that might become a scheduled item or to-do.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| raw_input | text | not null — the user's original capture text, messy is fine |
| source | text | not null, check in ('quick_capture', 'template_proposal', 'outside_request', 'planning_function') |
| activity_id | uuid | FK → activities, nullable — linked template if this was system-proposed |
| status | text | not null, default 'pending', check in ('pending', 'activated', 'dismissed', 'ignored', 'archived') |
| proposed_date | date | nullable — what day the system thinks this should happen |
| metadata | jsonb | nullable — stores who-asked, any deadline, context from capture |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |
| resolved_at | timestamptz | nullable — when the user acted on this item |

#### 1.5 New table: `schedule_items`

The unified to-do/calendar table. Single table, flexibility spectrum. This is what items become after leaving the hopper.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null |
| activity_id | uuid | FK → activities, nullable — the template this was instantiated from |
| hopper_item_id | uuid | FK → hopper_items, nullable — the hopper entry that became this |
| name | text | not null |
| description | text | nullable |
| scheduled_date | date | not null — what day |
| scheduled_time | time | nullable — null means "anytime this day" (to-do behavior) |
| scheduled_end_time | time | nullable — null for open-ended items |
| flexibility | text | not null, default 'anytime_today', check in ('hard_scheduled', 'soft_scheduled', 'anytime_today') |
| context | text[] | DEFAULT '{}' — inherited from activity template or set manually |
| energy_level | text | DEFAULT 'B', check in ('A', 'B', 'C') |
| emotional_weight | text | DEFAULT 'normal', check in ('light', 'normal', 'heavy') |
| status | text | not null, default 'active', check in ('active', 'completed', 'skipped', 'rescheduled') |
| completion_note | text | nullable |
| actual_duration_minutes | integer | nullable — filled on completion for day_log |
| completed_at | timestamptz | nullable |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

This table replaces the sharp calendar/to-do distinction. A Zoom call has `flexibility='hard_scheduled'`, `scheduled_time='10:00'`, `scheduled_end_time='11:00'`. "Pay bills sometime today" has `flexibility='anytime_today'`, `scheduled_time=NULL`. "Batch admin tasks this afternoon" has `flexibility='soft_scheduled'`, `scheduled_time='14:00'`.

#### 1.6 RLS and Indexes

Apply the standard RLS pattern (select/insert/update/delete own) to: `intake_responses`, `hopper_items`, `schedule_items`. The `intake_questions` table needs select-only access for all authenticated users (system reference data).

Indexes:
- `intake_responses.user_id`
- `intake_responses.question_id`
- `hopper_items.user_id`
- `hopper_items.status`
- `hopper_items.proposed_date`
- `schedule_items.user_id`
- `schedule_items.scheduled_date`
- `schedule_items.status`
- `schedule_items.activity_id`
- `activities.source`
- `activities.energy_level`
- `activities.archived_at`

---

## 2. Intake Question Bank

Seed the `intake_questions` table with the following questions. Mark the first ~8 as `is_seed_question = true` — these are asked before first Map use to generate a usable baseline.

### Seed Questions (asked during initial setup)

These generate enough Activity templates that the Map is meaningfully populated on first view.

1. **"Do you live alone, with a partner, with family, or with roommates?"** — single_choice, domain: household, payoff: "Generates shared meal, household coordination, and personal space templates"
2. **"Do you have kids? If so, what ages?"** — freetext, domain: household, payoff: "Generates childcare, school, and family activity templates"
3. **"What's your work situation?"** — single_choice, options: [employed, self-employed, freelance, between jobs, retired, student], domain: work, payoff: "Generates work rhythm and professional maintenance templates"
4. **"Do you work from home, commute, or hybrid?"** — single_choice, options: [work from home, commute, hybrid, varies], domain: work, payoff: "Generates commute, workspace, and transition templates"
5. **"Is your workday mostly structured (meetings, shifts) or mostly self-directed?"** — single_choice, options: [mostly structured, mostly self-directed, mix], domain: work, payoff: "Determines how Organize proposes your time blocks"
6. **"Do you exercise? What kind, and how often ideally?"** — freetext, domain: health, payoff: "Generates exercise and movement templates at your preferred frequency"
7. **"Are you a morning person or a night person?"** — single_choice, options: [morning, night, neither/varies], domain: rhythm, payoff: "Helps match high-energy tasks to your best hours"
8. **"List five things you do every week at roughly the same time."** — freetext, domain: rhythm, payoff: "Seeds your recurring activity templates directly from your real routine"

### Progressive Questions (asked contextually, never interruptively)

These are available after setup, surfaced as passive nudges: "WS has 3 questions about your household — answering would generate meal and errand templates."

**Household & Care**
9. "Do you have pets?" — boolean, domain: household, payoff: "Generates pet care and vet appointment templates"
10. "Do you care for aging parents or other dependents?" — boolean, domain: household, payoff: "Generates caregiving coordination templates"
11. "Do you cook most meals, share cooking, or mostly eat out?" — single_choice, domain: household, payoff: "Generates meal planning and grocery templates"
12. "Do you eat meals with others on a regular schedule?" — boolean, domain: household, payoff: "Blocks shared mealtimes in your schedule"

**Work**
13. "Roughly how many hours per week do you work?" — number, domain: work, payoff: "Calibrates how much non-work time to propose activities for"
14. "Do you manage other people?" — boolean, domain: work, payoff: "Generates 1:1, delegation, and team check-in templates"
15. "Do you have regular recurring meetings?" — boolean, domain: work, payoff: "Helps Organize avoid proposing over your meeting blocks"

**Health**
16. "Do you have medical, therapy, or dental appointments to maintain?" — boolean, domain: health, payoff: "Generates recurring health maintenance templates"
17. "Do you take medications that structure your day?" — boolean, domain: health, payoff: "Adds medication reminders to your daily rhythm"
18. "Do you have a sleep schedule you're trying to protect?" — boolean, domain: health, payoff: "Protects wind-down time and morning routines"

**Finance & Admin**
19. "Do you handle your own finances and bills, or share that?" — single_choice, domain: finance, payoff: "Generates bill-pay, budget review, and financial admin templates"
20. "Do you own or rent your home?" — single_choice, domain: finance, payoff: "Generates property maintenance or lease renewal templates"
21. "Do you have a car to maintain?" — boolean, domain: finance, payoff: "Generates car maintenance and registration templates"

**Social & Relationships**
22. "Do you have regular social commitments (weekly dinner, group, church, club)?" — freetext, domain: social, payoff: "Seeds recurring social activity templates"
23. "Are there relationships you want to invest in more deliberately?" — boolean, domain: social, payoff: "Generates intentional connection templates (calls, visits, letters)"
24. "Do you have a partner whose schedule interacts with yours?" — boolean, domain: social, payoff: "Generates couple coordination and date templates"

**Personal Growth & Meaning**
25. "Are you learning anything right now, or want to be?" — freetext, domain: growth, payoff: "Generates study, practice, and learning session templates"
26. "Do you have a creative practice or hobby?" — freetext, domain: growth, payoff: "Generates dedicated creative time templates"
27. "Do you have a spiritual or reflective practice?" — freetext, domain: growth, payoff: "Generates meditation, prayer, or journaling templates"
28. "Is there a big personal project or goal on your mind?" — freetext, domain: growth, payoff: "Creates a Big Outcome and generates supporting activity templates"

**Rhythm & Preference**
29. "When's your best focus time?" — single_choice, options: [early morning, mid-morning, early afternoon, late afternoon, evening, late night], domain: rhythm, payoff: "Reserves your peak hours for A-level tasks"
30. "What's the thing you most wish you made more time for?" — freetext, domain: rhythm, payoff: "Creates a protected activity template for what matters most to you"
31. "What's the thing that always falls through the cracks?" — freetext, domain: rhythm, payoff: "Creates a recurring template with nudges so this stops slipping"

---

## 3. Values and Life Domains Setup Flow

This happens before the intake questions. Three steps.

### Step 1: Preventive Values

Display all preventive values. Three are required and cannot be deselected:
- **Safety** (physical safety & health maintenance)
- **Financial Sufficiency** (bills paid, basics covered)
- **Belonging** (key relationships maintained — don't let critical connections deteriorate through neglect)

Optional preventive values the user can select:
- Household Order
- Administrative Compliance (taxes, insurance, registrations)
- Professional Standing
- Digital / Data Security
- Caregiving Obligations

The user can also write in custom preventive values.

Present these as checkboxes. Required items are pre-checked and locked. Optional items are unchecked. Brief explanation for each. Framing: "These protect your foundation. Wild Success keeps required values always visible because neglecting them tends to create emergencies that wreck everything else."

### Step 2: Promotional Values

Display options. The user picks at least two. None are required.

Options:
- Career Advancement or Mastery
- Creative Expression
- Learning & Intellectual Growth
- Deepening Relationships
- Physical Fitness Beyond Maintenance
- Financial Growth Beyond Sufficiency
- Community Contribution
- Spiritual or Reflective Practice
- Adventure / Novelty / Play

The user can write in custom promotional values.

Framing: "These are what you're reaching toward. Pick at least two that call to you right now — you can change these anytime."

### Step 3: Life Domains

Display all options. Check all that apply, minimum four.

- Work / Livelihood
- Health / Body
- Finances
- Home / Household
- Family
- Partnership / Romance
- Friendships / Social
- Personal Growth / Learning
- Creative Life
- Spiritual Life
- Community / Civic
- Recreation / Fun

The user can write in custom domains.

Framing: "These are the areas of your life Wild Success will help you see clearly. Some may get more attention than others — that's normal and the data will show you the pattern over time."

### Implementation

After Steps 1-3 complete:
- Replace the default seed values and life domains with the user's selections
- Update `user_profiles.intake_status` to `'in_progress'`
- Update `user_profiles.intake_progress` to record which steps are done
- Redirect to the Map page, which now reflects their chosen values and domains
- Begin showing seed intake questions (the first ~8 from the question bank)

---

## 4. Activity Template Generation

When a user answers an intake question, the system generates Activity templates. This is the core of the "answer a question, watch an Activity appear" loop.

### Generation Rules

Build a database function or application-layer service: `generate_activities_from_response(user_id, question_id, response)`.

This function interprets the response and creates appropriate `activities` rows with `source = 'template_derived'`. Examples:

- User says they have kids ages 5 and 8 → generate: "School pickup" (recurring daily, context: errand-out, energy: B, flexibility: hard_scheduled), "Kids homework help" (recurring daily, context: focused-quiet, energy: B, flexibility: soft_scheduled), "Family dinner" (recurring daily, context: home, energy: B, flexibility: soft_scheduled)
- User says they exercise by running 3x/week → generate: "Running" (recurring weekly, frequency: 3x, context: errand-out, energy: A, flexibility: soft_scheduled, duration_range: 30-60 min)
- User says workday is mostly self-directed → flag in user profile for Organize to know this user has flexible time blocks to fill

**Use the Anthropic API (Claude) for freetext responses.** When the question type is freetext, send the response to Claude with a system prompt that instructs it to return a JSON array of Activity template objects. The system prompt should include the Activity template field definitions and the user's existing values and life domains for linking.

Example API call pattern:
```
System: You are generating Activity templates for Wild Success. Given the user's
response to an intake question, return a JSON array of activity objects.
Each object should have: name, description, activity_type, frequency,
context (array), energy_level (A/B/C), emotional_weight (light/normal/heavy),
flexibility, clusterable, duration_range_min, duration_range_max,
is_preventive, suggested_life_domain, suggested_value_links.
Return ONLY valid JSON, no preamble.

User: Question: "List five things you do every week at roughly the same time."
Response: "Monday team standup at 9am, Wednesday guitar lesson at 7pm,
Saturday morning farmers market, Sunday family dinner, Thursday therapy at 2pm"
```

For boolean and choice responses, use deterministic generation rules (no API call needed).

### Decay and Archive

Activity templates with `source = 'template_derived'` that are never activated through Organize accumulate non-engagement. Track this through hopper_items — if a template's proposals are repeatedly ignored or dismissed (threshold: 5 consecutive non-engagements, or 3 weeks with no activation), the system asks:

"You haven't put [Activity Name] on your schedule. Want to archive it?"

- If yes: set `activities.archived_at = now()`
- If no: reset the counter, keep proposing
- Archived templates are hidden from the hopper but remain in the database. The user can find and restore them.

---

## 5. Inbox Hopper

### Quick Capture UI

Add a persistent, minimal capture input to the Map page. Position: floating bottom-right or bottom-center. Design:

- Single text field, placeholder: "Capture something..."
- Dictation-friendly — the user speaks into this on mobile
- Submit on Enter or tap button
- Auto-timestamps
- Creates a `hopper_items` row with `source = 'quick_capture'`, `raw_input` = whatever they typed/said
- No categorization required at capture time. Enrichment happens later during Organize.
- Brief confirmation toast: "Captured" with the first few words

### Template Proposals

When Activity templates exist, the system periodically generates `hopper_items` with `source = 'template_proposal'` based on recurrence rules. This is the mechanism that proposes "you should probably do this today/this week."

Build a function: `generate_daily_proposals(user_id, target_date)`. It:
1. Finds all active, non-archived Activity templates for the user
2. Checks recurrence against the schedule_items history (when was this last done?)
3. Creates hopper_items for activities that are due or overdue
4. Sets `proposed_date` based on recurrence and the Activity's preferred_days/preferred_time
5. Does NOT create duplicates — if a pending hopper_item already exists for this activity+date, skip it

### Outside Requests

When the user captures something that came from someone else ("Karen asked me to review the proposal by Friday"), the hopper item gets `source = 'outside_request'`. The metadata field stores:
```json
{
  "requested_by": "Karen",
  "deadline": "2026-03-15",
  "original_text": "Karen asked me to review the proposal by Friday"
}
```

For now, the user manually sets source to outside_request during Organize enrichment. Future: AI parses the raw_input to detect and auto-tag outside requests.

---

## 6. Contextual Question Nudges

On the Map page, display passive nudges when unanswered questions are relevant to the current view.

### Logic

- Count unanswered progressive questions per domain_tag
- When the user is viewing a Life Domain that maps to a question domain (e.g. viewing "Health" domain → "health" questions), show a nudge
- Also show a general nudge on the Map page if total unanswered questions > 0

### UI

Small, non-intrusive badge near the relevant area of the Map or in a sidebar:

"WS has **3 questions about your health** — answering would generate exercise and appointment templates. [Answer now →]"

Clicking opens a lightweight modal with just the relevant questions (filtered by domain_tag). As the user answers each question, Activity templates generate and appear on the Map in real time (refetch Map data after each answer).

### Nudge Rules

- Never show nudges during action/reorg flows (Organize will have its own session — these nudges are for the Map/reflection context only)
- Maximum one nudge visible at a time
- Nudge dismissable (don't show this domain's nudge again for 7 days)
- After all questions are answered, show nothing

---

## 7. API Routes

### Intake Questions — `/api/intake/questions`
- `GET` — all questions, ordered by domain_tag then sort_order. Accepts `?seed_only=true` for initial setup.
- No create/update/delete — these are system data

### Intake Responses — `/api/intake/responses`
- `GET` — all responses for current user
- `POST` — submit a response (question_id, response). Triggers activity generation. Returns the generated activities.
- `PATCH /api/intake/responses/[id]` — update a response. Re-triggers activity generation (may create new activities, archive old ones).

### Hopper — `/api/hopper`
- `GET` — all pending hopper items for current user, ordered by proposed_date then created_at. Accepts `?status=pending` filter.
- `POST` — create (raw_input, source, metadata). For quick capture.
- `PATCH /api/hopper/[id]` — update status (activate, dismiss, archive), enrich metadata
- `DELETE /api/hopper/[id]` — remove

### Schedule Items — `/api/schedule`
- `GET` — items for current user. Accepts `?date=YYYY-MM-DD` or `?range_start=&range_end=` filters. Ordered by scheduled_date, scheduled_time (nulls last).
- `POST` — create (from hopper activation or direct creation). If created from a hopper item, link hopper_item_id and update hopper status to 'activated'.
- `PATCH /api/schedule/[id]` — update fields. Completing an item (status → 'completed') should also create an `activity_log` entry if activity_id is set.
- `DELETE /api/schedule/[id]` — remove

### Activity Generation — `/api/intake/generate`
- `POST` — accepts (question_id, response, user_id). Calls Claude API for freetext, uses deterministic rules for boolean/choice. Returns generated activity objects. Called internally by the intake response POST handler.

### Daily Proposals — `/api/hopper/propose`
- `POST` — accepts (target_date). Runs `generate_daily_proposals` for current user. Returns created hopper items. Called on Map page load or manually.

---

## 8. UI Changes to Map Page

### Values & Domains Setup (new user flow)

When `user_profiles.intake_status = 'not_started'`, redirect from `/map` to `/setup`:

- `/setup` — three-step flow (Preventive Values → Promotional Values → Life Domains)
- Clean, simple UI. Checkboxes with brief explanations. Write-in fields for custom items.
- Required items visually distinct (locked checkbox, subtle explanation of why)
- On completion: update intake_status to 'in_progress', redirect to `/map`
- The Map now shows the user's chosen values and domains instead of defaults

### Seed Questions (post-setup)

On first visit to `/map` after setup, show a welcome modal:

"Your Map is ready with your values and life domains. Let's add some activities. These 8 questions will get you started — answer as many as you like."

Display seed questions in the modal. As the user answers each one, show a brief animation or indicator that activities are being generated. The Map updates in real time behind the modal.

User can close the modal at any time. Unanswered seed questions join the progressive question pool.

### Quick Capture Input

Floating input, bottom of screen. Always visible on Map page. Minimal: text field + submit button. Expands slightly on focus. Collapses after capture with brief toast.

### Contextual Nudges

Positioned per the logic in Section 6. One at a time, dismissable, shows concrete payoff.

---

## What NOT to Build

- No Organize modal (Session 4 — the Organize function that processes the hopper into schedule_items)
- No Time Template / ideal week interface (future, referenced as "coming soon")
- No Right Now view (future, "coming soon")
- No Google Calendar integration (future)
- No Planning function (future)
- No mobile-specific layouts
- No AI parsing of quick captures into structured data (future — for now captures are raw text)
- No automatic outside_request detection (future — for now user tags manually)

---

## Verification

After building:

### Setup Flow
- New user → redirected to `/setup` → sees three steps
- Step 1: three preventive values locked, optional ones selectable, can write in custom
- Step 2: promotional values, must pick at least two, can write in custom
- Step 3: life domains, check all that apply, minimum four enforced
- Complete setup → redirected to `/map` → Map shows user's chosen values and domains (not the old defaults)

### Seed Questions
- First Map visit shows welcome modal with 8 seed questions
- Answer a question → activities appear on the Map within seconds
- Close modal early → unanswered questions available as progressive nudges later

### Activity Templates
- Generated activities have correct source ('template_derived'), context tags, energy level, emotional weight, flexibility
- Activities link to appropriate values and life domains
- Freetext responses generate sensible activities via Claude API
- Boolean/choice responses generate deterministic activities without API call

### Hopper
- Quick capture: type text, hit enter → hopper_item created, toast confirms
- Template proposals: run daily proposal generation → hopper populates with due activities
- Hopper items have correct status lifecycle: pending → activated/dismissed/ignored/archived

### Schedule Items
- Can create schedule_items from hopper activation
- Hard-scheduled items have time, soft-scheduled have date only, anytime items have date + null time
- Completing a schedule_item creates an activity_log entry
- Schedule items link back to both activity template and hopper source

### Contextual Nudges
- Unanswered questions show nudge count on relevant Map areas
- Clicking nudge opens domain-specific question modal
- Answering generates activities, Map updates
- Nudges dismissable, respect 7-day cooldown
- Maximum one nudge visible at a time

### Decay
- Template-derived activities with 5+ consecutive non-engagements trigger archive prompt
- User confirms → activity archived (archived_at set, hidden from hopper)
- User declines → counter resets

---

## Session 4 Preview (for context only — do not build)

Session 4 builds the Organize function — a full-screen modal over the Map page. Organize processes the inbox hopper into concrete schedule_items. Left panel: proposed items from the hopper (template proposals, quick captures, outside requests). Main area: the day/week calendar being assembled. Three modes: Setup (populate the day), Reorg (handle interruptions mid-day), and Capture (close out the day, log completions). The Time Template (ideal week underlay) is stubbed as "coming soon." Google Calendar integration is stubbed as "coming soon."