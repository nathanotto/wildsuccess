# SESSION 14: Plan Module — Schema, Migrations, UI, and Plan-to-Map Bridge

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Sessions 1–13 are complete.** The Map module is live with values, activities, life domains, Big Outcomes, and value links. The /today page has a working daily view with three-state checkboxes and focus view. The capture parser routes input. The hopper and organize flows exist.

**Read these project files before doing anything:**
- `wild-success-constitutional-reference.docx` — philosophical foundation. Sections 6.3 (Mission) and 6.8 (Commitments) are directly relevant.
- `Wild_Success_Principles.md` — especially Principle 1 (fears of failure are planning constraints), Principle 5 (agency), Principle 6 (growth through value + cooperation + alignment).
- `Map_Module_Schema.md` — the existing data model. Plan extends this.
- Review the existing `big_outcomes` table schema — Plan connects to it.

**What Plan is:**

Plan is the module for big goals — bucket list items, long-term aspirations, complex projects. It serves the quarter-to-years time horizon. A user goes to /plan when they want to think about a big goal, break it down, and figure out what to do. Plan produces clarity and actionable pieces that flow into the user's Map (as Big Outcomes), hopper (as tasks), and schedule.

Plan is based on the US Army Mission Planning process, adapted for personal use. The core mechanic: the user creates a **mission**, brainstorms **factors** (five types), creates **courses of action** (COAs), and links factors to COAs until every factor is accounted for. The result is a plan grounded in reality — success criteria, resources, obstacles, known facts, and tested assumptions all connected to concrete actions.

**The planning structure:**

A **mission** is a plan with internal structure. It can be personal ("Family vacation this summer") or eventually shared ("End hunger in Denver"). A mission can optionally be linked to a Big Outcome on the user's Map.

**Factors** are the building blocks of planning. Five types:
- **Successes** — concrete visions of wild success. What does it look and feel like when this mission has succeeded beyond expectations?
- **Drivers** — anything that helps. Budget, skills, connections, motivation, time, tools, habits.
- **Constraints** — real obstacles and limitations. What would slow you down, stop you, or cause problems?
- **Facts** — things you know are true that matter to the mission. Obvious and non-obvious.
- **Assumptions** — things you believe but haven't verified. Your plan depends on these. Name them so you can test them.

**Courses of action (COAs)** are always in the form "do X IOT (in order to) Y." Example: "Research destinations IOT choose a place the whole family will love." Each COA connects to one or more factors. The planning metric is: what percentage of factors are accounted for by at least one COA?

**The recursion:** A COA can be actionable (send to hopper) or still too big (plan it as a sub-mission). A sub-mission has the same full structure — factors, COAs, factor-COA links. The user keeps chunking down until COAs are hopper-sized.

**The Plan-to-Map bridge:** A COA can be promoted to a Big Outcome on the user's Map. A Big Outcome can be expanded into a mission ("Plan this"). The user chooses what surfaces to their Map — Plan doesn't push.

**Time scales served by Wild Success:**
- /today — day
- /organize — week
- /map — month to quarter (personal action horizon)
- /plan — quarter to years (aspiration and structure horizon)

The Map should not exceed roughly quarterly goals. Plan is the source; Map is the sink.

---

## What to Build

This session covers the full Plan module: schema, API routes, and all UI pages.

### 1. Migration

Create `supabase/migrations/XXX_plan_module.sql` (use next available migration number).

All tables get `id uuid primary key default gen_random_uuid()` unless noted.

#### `missions`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| user_id | uuid | FK → auth.users, not null, on delete cascade. Mission creator/owner. |
| name | text | not null |
| description | text | nullable |
| parent_coa_id | uuid | nullable FK → coas, on delete set null. Set when this mission is a sub-mission spawned from a COA. |
| big_outcome_id | uuid | nullable FK → big_outcomes, unique, on delete set null. Set when this mission plans a Big Outcome. |
| status | text | not null, default 'planning', check in ('planning', 'active', 'completed', 'abandoned') |
| is_public | boolean | not null, default false |
| sort_order | integer | not null, default 0 |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

Note: `parent_coa_id` FK references `coas` which is defined below. Use deferred constraint or create tables in correct order.

#### `factors`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| mission_id | uuid | FK → missions, not null, on delete cascade |
| user_id | uuid | FK → auth.users, not null, on delete cascade. Who wrote this factor. |
| kind | text | not null, check in ('success', 'driver', 'constraint', 'fact', 'assumption') |
| name | text | not null |
| sort_order | integer | not null, default 0 |
| created_at | timestamptz | not null, default now() |

Index on (mission_id, kind, sort_order).

#### `coas`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| mission_id | uuid | FK → missions, not null, on delete cascade |
| user_id | uuid | FK → auth.users, not null, on delete cascade. Who created this COA. |
| name | text | not null. The "do X IOT Y" statement. |
| status | text | not null, default 'proposed', check in ('proposed', 'committed', 'in_progress', 'completed', 'abandoned') |
| big_outcome_id | uuid | nullable FK → big_outcomes, on delete set null. Set when this COA is promoted to the user's Map. |
| sort_order | integer | not null, default 0 |
| created_at | timestamptz | not null, default now() |
| updated_at | timestamptz | not null, default now() |

#### `coa_factor_links`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| coa_id | uuid | FK → coas, not null, on delete cascade |
| factor_id | uuid | FK → factors, not null, on delete cascade |
| created_at | timestamptz | not null, default now() |

Unique constraint on (coa_id, factor_id).

#### `mission_participants`

Stubbed for solo use. Build the table now; the UI uses it only for the creator row.

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| mission_id | uuid | FK → missions, not null, on delete cascade |
| user_id | uuid | FK → auth.users, not null, on delete cascade |
| role | text | not null, default 'creator', check in ('creator', 'collaborator', 'observer') |
| invited_at | timestamptz | not null, default now() |
| accepted_at | timestamptz | nullable |

Unique constraint on (mission_id, user_id).

When a mission is created, automatically insert a mission_participants row with role 'creator' and accepted_at = now(). Use a database trigger or handle in the API route.

#### `mission_value_links`

| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK |
| mission_id | uuid | FK → missions, not null, on delete cascade |
| value_id | uuid | FK → user_values, not null, on delete cascade |
| user_id | uuid | FK → auth.users, not null, on delete cascade |
| contribution_strength | text | not null, default 'moderate', check in ('strong', 'moderate', 'weak') |

Unique constraint on (mission_id, value_id, user_id).

#### RLS Policies

All tables: enable RLS.

- `missions`: users can select/insert/update/delete where user_id = auth.uid(). (Later, participants will get select access via mission_participants join — not now.)
- `factors`: users can select/insert/update/delete where user_id = auth.uid(). Also allow select where mission_id is in a mission the user owns.
- `coas`: same pattern as factors.
- `coa_factor_links`: users can select/insert/delete where coa_id belongs to a COA they own (join through coas.user_id).
- `mission_participants`: users can select where user_id = auth.uid() or where mission_id is in a mission they own.
- `mission_value_links`: users can select/insert/update/delete where user_id = auth.uid().

#### Updated `updated_at` trigger

Apply the same `updated_at` trigger pattern used on existing tables to `missions` and `coas`.

---

### 2. API Routes

Next.js API routes for all Plan data objects. Use Supabase client with user's auth token. Same patterns as existing Map module routes.

#### Missions — `/api/missions`
- `GET` — all missions for current user, ordered by sort_order. Include: factor count, accounted factor count (factors linked to at least one COA), COA count, linked Big Outcome name (if any).
- `POST` — create mission (name, description, is_public). Auto-create mission_participants row with role 'creator'. If `big_outcome_id` is provided, link to that Big Outcome.
- `PATCH /api/missions/[id]` — update fields.
- `DELETE /api/missions/[id]` — cascade deletes factors, COAs, links, participants.

#### Factors — `/api/missions/[missionId]/factors`
- `GET` — all factors for mission, ordered by kind then sort_order.
- `GET ?kind=success` — factors of one kind for mission, ordered by sort_order.
- `POST` — create factor (kind, name). Auto-assign sort_order.
- `PATCH /api/missions/[missionId]/factors/[id]` — update name, sort_order.
- `DELETE /api/missions/[missionId]/factors/[id]` — cascade removes coa_factor_links.

#### COAs — `/api/missions/[missionId]/coas`
- `GET` — all COAs for mission, ordered by sort_order. Include: count of linked factors, whether a sub-mission exists (join on missions.parent_coa_id), linked Big Outcome (if any).
- `POST` — create COA (name). Status defaults to 'proposed'.
- `PATCH /api/missions/[missionId]/coas/[id]` — update name, status, sort_order.
- `DELETE /api/missions/[missionId]/coas/[id]` — cascade removes factor links. If a sub-mission references this COA, set its parent_coa_id to null.

#### COA-Factor Links — `/api/missions/[missionId]/coas/[coaId]/factors`
- `POST` — link factor to COA (factor_id). Toggle behavior: if link exists, delete it; if not, create it.
- `GET` — all factor IDs linked to this COA.

#### Mission Value Links — `/api/missions/[missionId]/value-links`
- `GET` — all value links for mission.
- `POST` — create (value_id, contribution_strength).
- `PATCH /api/missions/[missionId]/value-links/[id]` — update contribution_strength.
- `DELETE /api/missions/[missionId]/value-links/[id]` — remove.

#### Plan-to-Map Bridge — `/api/missions/[missionId]/coas/[coaId]/promote`
- `POST { target: 'big_outcome' }` — create a Big Outcome from this COA. Set coa.big_outcome_id.
- `POST { target: 'hopper' }` — create a hopper item linked to this COA. (Use existing hopper/task creation pattern.)
- `POST { target: 'sub_mission' }` — create a new mission with parent_coa_id = this COA's id.

#### Big Outcome to Mission — `/api/big-outcomes/[id]/plan`
- `POST` — create a mission linked to this Big Outcome. Set missions.big_outcome_id. Return the new mission ID so the UI can redirect to /plan/[id].

---

### 3. UI Pages

All pages follow the existing WS design language: dense, flat, text-first, SimpleNote aesthetic. Minimal visual complexity. Same color palette and typography as /today and /map.

#### `/plan` — Mission List

Top: "Plan" heading. "New mission" button.

Table/list of missions. Each row shows:
- Mission name (link to /plan/[id])
- Status badge (planning / active / completed / abandoned)
- Factor count and % accounted (e.g., "12 factors, 75% accounted")
- COA count
- Linked Big Outcome name, if any
- Actions: Plan (guided flow) | Overview | Edit | Delete (with confirmation)

Sort by sort_order, then created_at desc.

#### `/plan/new` — New Mission

Simple form:
- Mission name (text input, required)
- Description (textarea)
- "Public can view" checkbox (default unchecked)
- Optional: link to existing Big Outcome (dropdown of user's Big Outcomes that don't already have a mission)
- Optional: link to values (multi-select from user's values with contribution strength)
- "Save and next" button → redirects to guided factor flow

#### `/plan/[id]` — Mission Overview

Layout: sidebar + 2×2 grid of factor types, matching the 2010 app's overview page.

**Sidebar (left column):**
- Mission name (editable inline or link to edit)
- Description (collapsible if long)
- Status
- If linked to Big Outcome: show name with link to /map
- If this is a sub-mission: show "Part of: [parent mission name]" with link
- Mission planning stats:
  - COA count
  - Factor count
  - Factors accounted for (green)
  - Unaccounted factors (red)
  - "Factors are X% matched to actions."
- Links: "Step by step planning" (guided flow) | "Plan courses of action" (/plan/[id]/coas) | "See plan summary" (/plan/[id]/summary)

**Grid (right side, 2×2 + top):**

Top-right cell: **Signs and visions of wild success**
- "Clump Successes" link (future feature, stub or omit)
- Input field + "Add to Successes" button
- List of success factors with del and reorder
- Info icon with popup: the success explanation text

Bottom-left cell: **Resources and drivers of success**
- Same pattern: input, add, list, info popup

Bottom-right cell (left): **Constraints and obstacles to success**
- Same pattern

Bottom-left cell: **Facts**
- Same pattern

Bottom-right cell: **Assumptions**
- Same pattern

Each factor in each list shows: `del | [Author name] | [Factor text]`

Below each list: "Reorder [type]" link (enables drag or arrow reordering).

#### `/plan/[id]/factors` — Guided Factor Entry (Step by Step)

One factor type per page. The user walks through each type in sequence.

URL pattern: `/plan/[id]/factors?kind=success` (or driver, constraint, fact, assumption)

**Page structure:**
- Header with human-language prompt:
  - success: "Envision wild success for: **[mission name]**"
  - driver: "List drivers and resources for **[mission name]**"
  - constraint: "List constraints and obstacles for **[mission name]**"
  - fact: "List relevant facts for **[mission name]**"
  - assumption: "List relevant assumptions for **[mission name]**"
- Navigation: "Mission overview | Plan courses of action | Clump [Type]"
- Info icon (?) next to the header — click shows popup with the factor type explanation:

  **Success popup:**
  > **What does wild success look like?**
  > Put yourself in the future where this mission has succeeded beyond expectations. What do you see? What's concrete and real — what metrics changed, what do people say, what's different in daily life? Be specific and vivid. This isn't a wish list — it's clarity about the future you're building toward. If you can't describe it, you're not ready to plan it.

  **Driver popup:**
  > **What helps this mission succeed?**
  > List anything that works in your favor — money, time, skills, connections, motivation, tools, habits, access, knowledge. If your brother-in-law knows a guy, that's a driver. If you have three free weekends, that's a driver. If you're stubborn and won't quit, that's a driver. Anything real that helps, put it here.

  **Constraint popup:**
  > **What's in the way?**
  > List real obstacles and limitations — not worst-case fantasies, but things that would actually slow you down, stop you, or cause problems. Limited budget, limited time, needing someone's permission, missing knowledge or skills, competing priorities. The point isn't to be discouraged — it's to plan around them. A constraint you've named is a constraint you can handle.

  **Fact popup:**
  > **What do you know for sure?**
  > Name things that are true and relevant to this mission — obvious or not. Market conditions, deadlines, who's involved, how things work, what's already been tried. Include uncomfortable truths too — "my boss won't support this" is a fact worth naming. Don't be exhaustive — be relevant. If it would change your plan to know it, it belongs here.

  **Assumption popup:**
  > **What are you betting on that you haven't proven?**
  > Assumptions are things you believe are true but haven't verified. "There's demand for this." "I can learn that skill in time." "She'll say yes." Your plan depends on these — if they're wrong, the plan breaks. Name them so you can test them. An assumption you've identified becomes a task: go find out. Turn assumptions into facts or discard them.

- Input field with placeholder "Enter [type] name"
- "Add to [Type]" button
- List of factors of this type with:
  - Reorder arrows (↑↓)
  - Del link (with confirmation)
  - Author name (colored, e.g., orange)
  - Factor text
- Bottom navigation: "Retreat!" ← (previous type or overview) | "Onward!" → (next type or COAs)
  - Sequence: success → driver → constraint → fact → assumption → redirect to /plan/[id]/coas

#### `/plan/[id]/coas` — Courses of Action

**Top section:**
- "Plan courses of action for: [mission name]"
- Progress bar showing % of factors accounted for (colored: red < 50%, yellow 50-80%, green > 80%)
- "See the finished plan" link

**COA input:**
- Text input with placeholder hint: "Describe: do [action] IOT [desired result]"
- "New course of action" button

**COA list:**
Each COA shows:
- Reorder arrows (↑↓)
- Heart count (number of linked factors): "♥ 5"
- Del link
- Author name (colored)
- COA text (clickable link — clicking selects this COA for factor linking)
- Action buttons (visible when COA has at least one linked factor):
  - "Send to hopper" — creates a task/hopper item from this COA
  - "Plan this" — creates a sub-mission from this COA
  - "Add to Map" — promotes this COA to a Big Outcome

**Factor linking section:**
When a COA is selected/clicked, show below it:
- ">>> Click factors for: ♥ **[COA name]** <<<"
- 5-column table with headers: Successes | Drivers | Constraints | Facts | Assumptions (gold/tan header row)
- Each cell lists the factors of that type for this mission
- Each factor shows: "[count] ♥ [factor text]" if linked to this COA, or "[count] | [factor text]" if not
- Factor text is a clickable link — clicking toggles the link (creates or deletes coa_factor_link)
- Count updates immediately on toggle
- The hearts and counts are per-COA: a factor can be linked to multiple COAs

#### `/plan/[id]/summary` — Finished Plan View

**Header:**
- "Back to mission planning" link
- "Back to courses of action" link
- Mission name (large)
- "Blurb:" + mission description

**Unaccounted factors (if any):**
- Red text: "There are [N] factors unaccounted for."
- Numbered list of unaccounted factors with type abbreviation: "1. succ | [text]", "2. driv | [text]", "3. cons | [text]", "4. fact | [text]", "5. assu | [text]"

**Courses of action summary:**
- Numbered list of COAs with author: "1. [Author]: [COA text]"

**Courses of action and their factors:**
- For each COA:
  - Italic: "[COA text] accounts for [N] factors:"
  - Numbered list of linked factors with type abbreviation: "1. assu | [text]", "2. cons | [text]", "3. driv | [text]", "4. fact | [text]", "5. succ | [text]"
  - Factors sorted alphabetically by type abbreviation, then by text

---

### 4. Plan-to-Map Bridge Interactions

These are the three actions available on COAs once they have linked factors:

**"Send to hopper":**
- Creates a hopper item (using existing task/hopper creation pattern)
- The hopper item's text is the COA name
- Store a reference back to the COA (add `coa_id` nullable FK to the tasks/hopper table if not present — create a small migration for this)
- Update COA status to 'committed'
- Show toast: "Added to hopper"

**"Plan this" (sub-mission):**
- Creates a new mission with:
  - name = COA name
  - parent_coa_id = this COA's id
  - user_id = current user
  - status = 'planning'
- Auto-creates mission_participants row
- Redirects to /plan/[new-mission-id]/factors?kind=success (start the guided flow for the sub-mission)
- On the parent COA, show indicator: "📋 Has sub-mission" with link to /plan/[sub-mission-id]

**"Add to Map" (promote to Big Outcome):**
- Creates a new Big Outcome (using existing big_outcomes creation pattern):
  - name = COA name
  - status = 'in_progress'
  - Copy any value links from the parent mission's mission_value_links
- Sets coa.big_outcome_id = new Big Outcome's id
- Update COA status to 'committed'
- Show toast: "Added to Map as Big Outcome"
- On the COA, show indicator: "🗺️ On Map" with link to /map

**"Plan this" on a Big Outcome (from the Map):**
- On the existing Big Outcome edit modal or detail view, add a "Plan this" button (visible only if the Big Outcome does not already have a linked mission)
- Creates a new mission with big_outcome_id = this Big Outcome's id
- Redirects to /plan/[new-mission-id] (overview or guided flow)

---

### 5. Navigation

Add "Plan" to the main app navigation, alongside Map, Today, and Organize.

On the Map page, Big Outcomes that have a linked mission should show a "Plan" link or icon that navigates to /plan/[mission-id].

On /plan, sub-missions should show breadcrumb navigation: "Mission: [parent mission] → [parent COA] → [this mission]" so the user can navigate up the tree.

---

### 6. Verification Checklist

When complete, verify these scenarios work:

- [ ] Create a new mission from /plan with name and description
- [ ] Walk through the guided factor flow: add successes, drivers, constraints, facts, assumptions using Retreat/Onward navigation
- [ ] View mission overview with all factors in the 2×2 grid
- [ ] Create a COA on the COA page
- [ ] Click a COA to expand the factor linking table
- [ ] Click factors to toggle links — count and heart indicators update immediately
- [ ] Progress bar updates as factors become accounted for
- [ ] View the plan summary — unaccounted factors in red, COAs with their linked factors
- [ ] "Send to hopper" on a COA — item appears in hopper
- [ ] "Plan this" on a COA — sub-mission created, redirects to guided flow
- [ ] "Add to Map" on a COA — Big Outcome created, visible on Map
- [ ] "Plan this" on a Big Outcome from the Map — mission created, linked to that outcome
- [ ] Navigate the mission tree via breadcrumbs
- [ ] Delete a mission — factors, COAs, and links cascade delete
- [ ] Mission planning stats (factor count, % accounted) are accurate across all views
- [ ] Info popups show the correct explanation text for each factor type
- [ ] All RLS policies work — user can only see their own missions and data