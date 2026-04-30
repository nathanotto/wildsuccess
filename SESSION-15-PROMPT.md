# SESSION 15: Plan Module — Arrange, COA Structure, Factor Lifecycle, and Mission Log

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Session 14 is complete.** The Plan module has missions, factors (five types), COAs, factor-COA linking, and the guided factor entry flow. The COA page shows factor linking with toggle interaction and % accounted metric. The Plan-to-Map bridge allows COAs to be sent to the hopper, promoted to Big Outcomes, or expanded into sub-missions.

**Read these files before doing anything:**
- `SESSION-14-PROMPT.md` — the Plan module foundation. This session extends it.
- `wild-success-constitutional-reference.docx` — sections 6.3 (Mission) and 6.8 (Commitments).
- `Wild_Success_Principles.md` — Principle 1 (fears as constraints), Principle 5 (agency), Principle 7 (commitment).

**What this session adds:**

Session 14 built the planning process through factor-COA linking. This session adds what happens *after* linking: arranging COAs into a shaped plan, tracking factor evolution, and recording mission history. The planning flow becomes:

**Mission → Factors → COAs → Link → Arrange → Commit → Do → Complete**

**Design philosophy reminder:** Wild Success Planning is a communication, inspiration, and visualization tool — not project management. The output of Plan is clarity about what commitments to make and how they connect to a larger goal. Plans live independently; they connect to a user's personal world through commitments. If a COA needs traditional project management, the person committing to that COA handles that outside Wild Success.

---

## What to Build

### 1. Schema Changes

#### Split COA structure

The COA "do X IOT Y" becomes two explicit fields. The action is the effort; the outcome is the result the effort aims to produce.

**Modify `coas` table:**

```sql
-- Rename existing 'name' column to 'action'
ALTER TABLE coas RENAME COLUMN name TO action;

-- Add outcome column
ALTER TABLE coas ADD COLUMN outcome text;
```

The `action` field holds the effort: "Research destinations." The `outcome` field holds the IOT result: "Choose a place the whole family will love." Display reads as one sentence: "[action] IOT [outcome]."

For backward compatibility with any existing COAs that have the full string in `action`, leave `outcome` nullable. The UI should encourage both fields but function with action alone.

#### Factor-COA link relationship type

**Modify `coa_factor_links` table:**

```sql
ALTER TABLE coa_factor_links ADD COLUMN relationship text NOT NULL DEFAULT 'accounts_for'
  CHECK (relationship IN ('accounts_for', 'aims_to_resolve'));
```

- `accounts_for` — this COA takes this factor into account (default, existing behavior)
- `aims_to_resolve` — this COA's outcome directly targets this factor (resolving a constraint, validating an assumption, achieving a success vision, leveraging a driver)

When a COA with `aims_to_resolve` links completes, the system surfaces the targeted factors for the user to review.

#### Factor lifecycle

**Modify `factors` table:**

```sql
ALTER TABLE factors ADD COLUMN status text NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'resolved'));
ALTER TABLE factors ADD COLUMN resolution_note text;
ALTER TABLE factors ADD COLUMN resolved_at timestamptz;
ALTER TABLE factors ADD COLUMN resolved_by_coa_id uuid REFERENCES coas(id) ON DELETE SET NULL;
```

- `status` — `active` (current, relevant) or `resolved` (addressed, overcome, validated, no longer relevant)
- `resolution_note` — user's description of what happened. Free text.
- `resolved_at` — when the factor was resolved
- `resolved_by_coa_id` — optional link to the COA whose completion resolved this factor

**Assumptions are special:** When an assumption is resolved, the resolution_note should capture whether it was confirmed (became a fact) or disproven (plan needs adjustment). The system does not auto-create a fact factor — the user decides. But the UI should prompt: "Was this assumption confirmed or disproven?" and offer to create a new fact factor if confirmed.

#### COA dependencies with reasons

**New table: `coa_dependencies`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| coa_id | uuid | FK → coas, not null, on delete cascade. The dependent COA. |
| depends_on_coa_id | uuid | FK → coas, not null, on delete cascade. The prerequisite COA. |
| reason | text | not null. Why this dependency exists — the assumption connecting them. |
| is_hard | boolean | not null, default false. Hard = true logical dependency. Soft = suggested sequence. |
| created_at | timestamptz | not null, default now() |

Unique constraint on (coa_id, depends_on_coa_id). Check constraint: coa_id != depends_on_coa_id. Both COAs must belong to the same mission (enforce in API, not constraint — sub-mission COAs may reference parent mission COAs in future).

The `reason` field is critical. It makes the dependency assumption explicit. "Raise money before hiring *because we need salary budget*." If circumstances change (a foundation donates a team), the user examines the reason and may dissolve the dependency.

`is_hard` distinguishes between "this truly cannot start until that finishes" (hard) and "it seems better to do this first" (soft). The UI shows both but visually distinguishes them.

#### COA time horizons

**Modify `coas` table:**

```sql
ALTER TABLE coas ADD COLUMN time_horizon text NOT NULL DEFAULT 'unset'
  CHECK (time_horizon IN ('unset', 'now', 'next', 'later'));
```

- `unset` — not yet placed in time (default for newly created COAs)
- `now` — current phase, actively being worked or committed to
- `next` — coming after the current phase
- `later` — far out, future phase

These are not dates. They are the user's sense of when this COA belongs in the mission's arc.

#### COA resource needs

**New table: `coa_resource_needs`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| coa_id | uuid | FK → coas, not null, on delete cascade |
| description | text | not null. Human-readable: "Block out a weekend", "$2,000 for flights" |
| kind | text | not null, default 'other', check in ('time', 'money', 'people', 'materials', 'access', 'other') |
| quantity | numeric | nullable. For quantifiable needs: 2000, 3, 20. |
| unit | text | nullable. "dollars", "hours", "people", "weekends". |
| status | text | not null, default 'needed', check in ('needed', 'partially_met', 'met') |
| status_note | text | nullable. How/when this need was met. |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

For solo use, most resource needs are descriptive text the user tracks. For future collaborative use, these become things others can commit to fill. The schema supports both.

#### Mission log

**New table: `mission_log`**

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| mission_id | uuid | FK → missions, not null, on delete cascade |
| user_id | uuid | FK → auth.users, not null, on delete cascade. Who took the action. |
| entry_type | text | not null, check in ('factor_added', 'factor_resolved', 'factor_invalidated', 'coa_created', 'coa_completed', 'coa_abandoned', 'coa_committed', 'dependency_added', 'dependency_removed', 'resource_added', 'resource_met', 'commitment_made', 'mission_status_changed', 'note') |
| subject_type | text | nullable. 'factor', 'coa', 'dependency', 'resource', 'mission'. What the entry is about. |
| subject_id | uuid | nullable. ID of the factor, COA, etc. |
| description | text | not null. Human-readable log entry. |
| created_at | timestamptz | not null, default now() |

The mission log is append-only. Nothing is deleted from it. It records everything that happens to a mission: factors added and resolved, COAs created and completed, dependencies added and removed, resources allocated, commitments made, status changes. It also accepts free-text notes from the user.

The log is written to by API routes whenever a relevant action occurs. The API routes from Session 14 need to be updated to write log entries on mutations.

#### RLS Policies

- `coa_dependencies`: select/insert/update/delete where coa_id belongs to a COA the user owns.
- `coa_resource_needs`: select/insert/update/delete where coa_id belongs to a COA the user owns.
- `mission_log`: select where mission_id belongs to a mission the user owns. Insert where user_id = auth.uid() and mission_id belongs to a mission the user owns. No update or delete.

Apply `updated_at` trigger to `coa_resource_needs`.

---

### 2. API Route Changes

#### Updated COA routes — `/api/missions/[missionId]/coas`

- `POST` — now accepts `action` (required) and `outcome` (optional) instead of `name`. Write mission_log entry: 'coa_created'.
- `PATCH` — can update `action`, `outcome`, `status`, `time_horizon`, `sort_order`. When status changes to 'completed': write mission_log entry 'coa_completed', then check for `aims_to_resolve` factor links and return them in the response so the UI can prompt for factor review. When status changes to 'committed': write mission_log entry 'coa_committed'.
- Display: when rendering a COA, concatenate as "[action] IOT [outcome]" if outcome is present, otherwise just "[action]".

#### Updated factor-COA link routes — `/api/missions/[missionId]/coas/[coaId]/factors`

- `POST` — now accepts `factor_id` and optional `relationship` (defaults to 'accounts_for'). Toggle behavior remains: if link exists with same relationship, delete it; if link exists with different relationship, update it; if no link, create it.
- `GET` — return factor IDs with their relationship type.

#### Updated factor routes — `/api/missions/[missionId]/factors`

- `PATCH` — can now update `status`, `resolution_note`. When status changes to 'resolved': set `resolved_at` to now(), write mission_log entry 'factor_resolved'. If the factor is an assumption, the UI should have already prompted for confirmation/disproval and included that in `resolution_note`.
- New optional action: when resolving a confirmed assumption, accept `create_fact: true` + `fact_text` to auto-create a new fact factor on the same mission. Write two log entries: 'factor_resolved' for the assumption and 'factor_added' for the new fact.

#### COA dependencies — `/api/missions/[missionId]/coa-dependencies`

- `GET` — all dependencies for this mission. Returns coa_id, depends_on_coa_id, reason, is_hard.
- `POST` — create dependency (coa_id, depends_on_coa_id, reason, is_hard). Validate both COAs belong to this mission. Prevent circular dependencies (A depends on B depends on A). Write mission_log entry 'dependency_added'.
- `DELETE /api/missions/[missionId]/coa-dependencies/[id]` — remove. Write mission_log entry 'dependency_removed'.

#### COA resource needs — `/api/missions/[missionId]/coas/[coaId]/resources`

- `GET` — all resource needs for this COA.
- `POST` — create resource need (description, kind, quantity, unit). Write mission_log entry 'resource_added'.
- `PATCH /api/missions/[missionId]/coas/[coaId]/resources/[id]` — update fields. When status changes to 'met': write mission_log entry 'resource_met'.
- `DELETE` — remove resource need.

#### Mission log — `/api/missions/[missionId]/log`

- `GET` — all log entries for this mission, ordered by created_at desc. Support optional `?subject_type=factor` or `?entry_type=coa_completed` filters.
- `POST` — create a free-text note entry (entry_type: 'note', description: user's text). For all other entry types, log entries are created by other API routes, not directly.

#### All existing Session 14 mutation routes

Update every POST, PATCH, DELETE on factors, COAs, missions to also write appropriate mission_log entries. Factor creation writes 'factor_added'. Mission status change writes 'mission_status_changed'. Etc.

---

### 3. UI: The Arrange Page

#### `/plan/[id]/arrange` — Arrange the Plan

This page is where COAs get shaped into a plan after factor-COA linking. It is accessible from the COA page ("Arrange plan" link, visible once at least one COA exists) and from the mission overview.

**Page structure:**

**Header:**
- "Arrange plan for: **[mission name]**"
- Link back to mission overview and COA page
- Factor accounting status: "X of Y factors accounted for" (link back to COA page if incomplete)

**COA cards, grouped by time horizon:**

Three sections: **Now**, **Next**, **Later** (plus an **Unplaced** section for COAs with time_horizon = 'unset').

Each section is a drop zone. The user drags COAs between sections to set their time horizon. Within each section, COAs can be reordered by drag.

Each COA card shows:
- Action text (bold) + "IOT" + outcome text (if present)
- Status indicator (proposed / committed / in_progress / completed)
- Factor link summary: "Accounts for X factors, aims to resolve Y"
- Resource needs summary: "Z resources needed, W met" (or "No resources defined")
- Dependency indicator: if this COA depends on others, show "After: [prerequisite COA action text]" with the reason visible on hover/tap
- If this COA has a sub-mission: "📋 Sub-mission" link
- If this COA is on the Map: "🗺️ On Map" link
- If this COA is in the hopper: "📥 In hopper" indicator

**Dependency creation:**
- User clicks a "Link dependency" button on a COA card
- Then clicks the prerequisite COA
- A small modal asks for the reason (required text field) and whether it's hard or soft (toggle, default soft)
- Dependency arrow appears between the two cards
- Dependencies are shown as connecting lines between COA cards within and across time horizon sections

**Resource needs entry:**
- User clicks "Add resource" on a COA card
- Inline form expands: description (text, required), kind (dropdown: time/money/people/materials/access/other), quantity (number, optional), unit (text, optional)
- Resources appear as a compact list on the COA card
- Each resource has a status toggle: needed → partially met → met

**Outcome editing:**
- If a COA was created without an outcome (just action text), the Arrange page should make it easy to add the outcome. Inline edit on the COA card — click the action text to expand and add/edit the outcome.

**Factor link refinement:**
- On each COA card, a small "Factor links" expandable section shows the linked factors
- Each factor link shows its relationship type: "accounts for" or "aims to resolve"
- The user can toggle the relationship type here (click to cycle: accounts_for → aims_to_resolve → accounts_for)
- This is where the user refines which factors each COA *targets* vs. merely *considers*

**Bottom of page:**
- "View plan summary" link → `/plan/[id]/summary`
- "Add a note" — text input to add a free-text mission_log entry

---

### 4. UI: Updated COA Page

#### `/plan/[id]/coas` — Changes

The COA creation form now has two fields:
- Action (text input, required): placeholder "What will you do?"
- Outcome (text input, optional): placeholder "In order to achieve what?"
- Display: if both fields present, show as "[action] IOT [outcome]"

After the factor linking table, add a link: "Arrange plan →" (navigates to `/plan/[id]/arrange`). Show this link once at least one COA exists and factor accounting is above 0%.

COA list items now show the split: action in regular weight, "IOT" as a connector word, outcome in slightly different style (italic or lighter weight) to visually distinguish effort from purpose.

---

### 5. UI: Plan Summary View

#### `/plan/[id]/summary` — The Living Plan

This replaces the static printout from Session 14. It is the reading view of the arranged plan. It should be shareable (public missions can show this page to non-authenticated viewers — gate on `missions.is_public`).

**Mission header:**
- Mission name (large)
- Description (collapsible if long)
- Status badge
- If linked to Big Outcome: show with link
- If sub-mission: "Part of: [parent mission name]" with link
- Values this mission connects to (from mission_value_links), showing contribution strength

**Plan health indicators:**
- Factor accounting: "X of Y factors accounted for" — with unaccounted factors listed by type, each clickable (links to COA page for that factor's kind)
- Unresolved assumptions: "Z assumptions untested" — listed, each clickable
- Resource status: "A of B resource needs met across all COAs"

**The plan flow:**

COAs displayed in three time horizon groups: Now, Next, Later. Within each group, COAs are ordered by the user's sort order from the Arrange page.

Each COA shows:
- Full text: "[action] IOT [outcome]"
- Status: proposed / committed / in_progress / completed / abandoned
- Dependencies: if this COA depends on others, show prerequisite COA names with reasons. Visual connectors between COAs where dependencies exist.
- Resource needs: compact list with status (needed / partially met / met). Show aggregate: "3 of 5 resources met."
- Targeted factors (aims_to_resolve links): listed with current factor status (active / resolved). This shows: "This COA aims to resolve: [constraint] Just Nathan working on it (active)" — and when that factor is resolved, it shows as struck through or muted.
- Sub-mission indicator: if this COA spawned a sub-mission, show the child mission's name, its own factor/COA stats, and progress summary. Drill-down link to the child mission's summary.
- Commitment indicator: who committed to this COA, when.

**Resolved factors section:**
- List of all factors that have been resolved during this mission's life
- Each shows: original text, type, resolution note, when resolved, which COA resolved it
- This is the "terrain that has changed" view — proof that planning is working

**Mission log (collapsible):**
- Chronological list of mission_log entries, newest first
- Filterable by entry_type
- Shows the full history of the mission: what was added, changed, committed, completed, resolved

**Child missions section (if any):**
- For each COA that spawned a sub-mission, show:
  - Child mission name with link
  - Child mission status
  - Child mission factor/COA progress: "X COAs, Y% factors accounted, Z COAs complete"
- This gives the parent mission a rolled-up view of child progress without requiring drill-down

---

### 6. UI: Factor Review Prompt

When a COA is marked as completed (status → 'completed') and that COA has `aims_to_resolve` factor links, the system should prompt the user to review those factors.

**Implementation:**

After the PATCH to update COA status to 'completed', the API returns the list of factors linked with `aims_to_resolve`. The UI shows a modal:

"**[COA action] IOT [COA outcome]** is complete."

"This COA targeted these factors. Have any of them changed?"

For each targeted factor:
- Factor text and type shown
- Three options:
  - "Still active" — no change
  - "Resolved" — opens a text field for resolution_note. If the factor is an assumption, show additional prompt: "Was this confirmed or disproven?" with option to create a new fact factor if confirmed.
  - "Skip for now"

The user can review some, all, or none. Each resolution writes to mission_log.

---

### 7. Navigation Updates

**Mission overview page (`/plan/[id]`):**
- Add "Arrange plan" link alongside existing "Step by step planning" and "Plan courses of action" links
- Show time horizon breakdown in stats: "X COAs now, Y next, Z later, W unplaced"
- Show resource summary: "A of B resource needs met"

**COA page (`/plan/[id]/coas`):**
- Add "Arrange plan →" link after factor linking section
- Show time horizon badge on each COA in the list

**Plan list page (`/plan`):**
- Add columns/indicators for: resource status summary, time horizon breakdown
- Show child mission count if any COAs have spawned sub-missions

---

### 8. Updated Guided Flow Sequence

The Retreat/Onward navigation from Session 14's guided factor flow now extends:

success → driver → constraint → fact → assumption → **COA page** → **Arrange page** → **Summary**

The "Onward!" link from the assumption page goes to the COA page. The COA page's "Arrange plan →" link goes to the Arrange page. The Arrange page's "View plan summary" link goes to the Summary.

"Retreat!" always goes back one step in this sequence.

---

### 9. Verification Checklist

When complete, verify these scenarios work:

- [ ] Create a COA with both action and outcome fields — displays as "[action] IOT [outcome]"
- [ ] Create a COA with action only — displays without IOT
- [ ] Edit a COA to add an outcome on the Arrange page
- [ ] Toggle factor link relationship between 'accounts_for' and 'aims_to_resolve'
- [ ] On the Arrange page, drag COAs between Now/Next/Later/Unplaced sections
- [ ] Reorder COAs within a time horizon section
- [ ] Create a dependency between two COAs with a reason — visual connector appears
- [ ] Create a hard vs. soft dependency — visual distinction visible
- [ ] Delete a dependency
- [ ] Prevent circular dependency creation (A→B→A)
- [ ] Add resource needs to a COA — kind, description, quantity, unit
- [ ] Toggle resource status: needed → partially met → met
- [ ] Mark a COA as completed that has 'aims_to_resolve' factor links — factor review modal appears
- [ ] Resolve a factor from the review modal — factor status updates, resolution_note saved, mission_log entry written
- [ ] Resolve an assumption as confirmed — option to create fact factor works
- [ ] View the plan summary — time horizon groups, dependencies, resource status, targeted factors all visible
- [ ] View resolved factors section in summary — shows what terrain has changed
- [ ] View mission log — all mutations recorded, filterable
- [ ] Add a free-text note to mission log
- [ ] Child mission progress rolls up to parent summary
- [ ] Navigate the full guided flow: factors → COAs → Arrange → Summary
- [ ] Public mission summary is viewable without authentication when is_public = true
- [ ] All RLS policies work for new tables
- [ ] All mutations write appropriate mission_log entries