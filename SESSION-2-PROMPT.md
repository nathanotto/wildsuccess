# SESSION 2: Map Module — SVG Map, API Routes, Auth, and Edit Modals

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Session 1 is complete.** The database has all Map Module tables, RLS policies, auth triggers, and seed data. A new user gets 8 default values and 10 default life domains.

**Read these project files before doing anything:**
- `WildSuccessMap5.jsx` — **the visual design reference.** This is a working React mockup with fake data. Your job is to reproduce this design powered by real Supabase data. Match the layout, colors, interactions, and feel. This file is the source of truth for how the Map looks and behaves.
- `Map_Module_Schema.md` — data object descriptions and relationships
- `Map_Module_Task_Flows.md` — Phase 2: Direct Map Interaction. Read the edit task flows for each data object.
- `SESSION-1-PROMPT.md` — the database schema for reference

---

## Architecture Note

The Map page has two rendering layers that coexist:

**SVG layer:** The mind map diagram — circles, lines, arcs, text labels, click targets. This is one `<svg>` element embedded in the React page. It renders from data in React state using computed positions (angles, radii, offsets). It does NOT talk to the database directly.

**HTML/React layer:** Everything else — nav bar, edit modals, Take Action box, Coming Soon popups, toasts. Normal React components with normal CSS.

Data flows: Supabase → API routes → React state → SVG renders from state. Mutations go through API routes, then state refetches, then SVG re-renders.

---

## What to Build

### 1. Authentication

Basic Supabase Auth. Minimal.

- `/login` — email + password, link to sign up
- `/signup` — email + password registration
- Auth guard on `/map` — redirect to `/login` if not authenticated
- On signup, the database trigger creates `user_profiles` and seeds default values and life domains (already in Session 1's migration)
- On login, redirect to `/map`

No OAuth, no magic links. Just email/password.

### 2. New Migration

Create `supabase/migrations/002_add_value_scores.sql`:

```sql
ALTER TABLE user_values ADD COLUMN score integer NOT NULL DEFAULT 5
  CHECK (score >= 1 AND score <= 10);
ALTER TABLE user_values ADD COLUMN sufficiency_mark integer NOT NULL DEFAULT 4
  CHECK (sufficiency_mark >= 1 AND sufficiency_mark <= 10);
```

Update the `seed_default_map_data` function to set initial scores to 5 for all default values, sufficiency_mark to 4 for all.

### 3. API Routes

Next.js API routes (or server actions) for all Map data objects. Use the Supabase client with the user's auth token so RLS enforces ownership.

#### Values — `/api/values`
- `GET` — all values for current user, ordered by sort_order
- `POST` — create (name, value_type, score, sufficiency_mark, sufficiency_threshold, description). Reject duplicate names.
- `PATCH /api/values/[id]` — update any fields
- `DELETE /api/values/[id]` — reject if it's the last value

#### Life Domains — `/api/life-domains`
- `GET` — all domains, ordered by sort_order
- `POST` — create (name, color, description). Reject duplicate names.
- `PATCH /api/life-domains/[id]` — update
- `DELETE /api/life-domains/[id]` — activities with this domain get life_domain_id set to null

#### Big Outcomes — `/api/big-outcomes`
- `GET` — all outcomes, ordered by sort_order. Include linked values (join through big_outcome_value_links) and count of linked activities.
- `POST` — create with optional value links (array of {value_id, contribution_strength})
- `PATCH /api/big-outcomes/[id]` — update fields and value links. When status → 'achieved', set completed_at. When 'abandoned', require abandonment_reason.
- `DELETE /api/big-outcomes/[id]` — cascade removes value links, activities get big_outcome_id set to null

#### Activities — `/api/activities`
- `GET` — all activities, ordered by sort_order. Include linked values (join through activity_value_links), life domain name, big outcome name.
- `POST` — create with optional value links, domain, outcome
- `PATCH /api/activities/[id]` — update fields and value links
- `DELETE /api/activities/[id]` — cascade removes value links and log entries

#### Activity-Value Links — `/api/activity-value-links`
- `POST` — create (activity_id, value_id, contribution_strength, user_id)
- `PATCH /api/activity-value-links/[id]` — update contribution_strength
- `DELETE /api/activity-value-links/[id]` — remove

#### Big Outcome-Value Links — `/api/big-outcome-value-links`
- Same pattern as activity-value links

#### Activity Log — `/api/activity-log`
- `POST` — log a completion (activity_id, performed_at, note, duration_minutes)
- `GET ?activity_id=[id]` — log entries for one activity
- `DELETE /api/activity-log/[id]` — remove entry

#### Activity-Outcome Links — `/api/activity-outcome-links`
These are derived from activities.big_outcome_id — no separate link table needed. When an activity has a big_outcome_id, that's the link. The GET on activities already includes this.

#### Heat Computation — `/api/map/heat`
- `GET` — for each value, compute heat:
  - For each activity-value link, find most recent activity_log entry
  - decay = max(0, 1 - days_since_last_log / cadence_days)
  - Weight: strong=1.0, moderate=0.6, weak=0.3
  - value_heat = sum(decay * weight) / sum(weight)
  - Aspirational/paused activities contribute 0
  - One-time activities: 90-day decay window
  - Also return: list of overdue preventive activities (recurring + preventive + past due)

#### Profile — `/api/profile`
- `GET` — current user profile
- `PATCH` — update display_name, intake_status, intake_progress

### 4. The Map Page — `/map`

A single Next.js page. On load, fetch all data in parallel, store in React state.

#### The SVG Map

One `<svg>` component. ViewBox approximately `960 × 780`. Width 100%, height auto. Renders from React state.

**Match WildSuccessMap5.jsx exactly.** The key elements:

**Center node** — user's display_name (or "Nathan" as fallback). r=85 white circle. Left arc = Protect average, colored #9E6A46, opacity = average/10. Right arc = Expand average, colored #4B82AF. Name in 32pt. Scores in 18pt. Highest leverage message in 12pt red below.

**Value circles** — orbit radius ~210 from center. Protect values arc left, Expand values arc right. Circle radius = 32 + (score/10) * 20. Colors by status:
- Below sufficiency_mark: red (#D4564E fill, #B8443E stroke, #D4564E18 background)
- Score >= 8: blue (#3A7CB8 fill, #2D6AA0 stroke)
- Otherwise: green (#5A9E6F fill, #4A8B5E stroke)

Score number centered. Name 15pt below. Status label 12pt below name: "Needs attention" / "Handled" / "Abundant". Activity count dots arrayed below.

**Curved lines** from center to each value. #C4A882 for protect, #82ABC4 for expand. 2.5px, 0.3 opacity. Thicker/brighter when highlighted.

**Activity dots** — branch outward from primary value. r=7 normal, r=10 overdue. Positioned along radial direction, spread perpendicular. Branch distance ~75, spread ~30.
- Normal: #C4BFB4 fill. Label on hover/highlight.
- Overdue: #C4504A fill, pulsing animation, label always visible.
- Lines from activity to each linked value. Thin/faint normally, solid when highlighted.
- Cross-value links (secondary values): dashed, very faint normally.

**"PROTECT"** label top-left, **"EXPAND"** top-right. 15pt, 0.5 opacity.

**Big Outcomes** — row below the map at ~y=660.
- "BIG OUTCOMES" centered label, 15pt, 0.4 opacity
- Rounded rectangles 160×55, rx=14, evenly spaced across ~760px width
- Inside each: name (13pt bold), status + activity count (10pt)
- Below each: completion % (12pt, **stubbed** — use placeholder values), "Plan & Review" link (11pt, #C4725A, underlined)
- Outcomes with ≤1 activity: "Needs more activities" in red below
- Dashed lines from activity dots down to their linked outcome box
- Click outcome → highlight its activity lines

**Interactions:**
- Click value → highlight its activities and lines. All other elements dim.
- Click activity → highlight its value connections and outcome connection.
- Click outcome box → highlight activity-to-outcome lines.
- Hover activity → show name label, brighten lines.
- Click SVG background → deselect all.
- Overdue labels always visible (never require hover).

### 5. Edit Modals (HTML/React)

Modal overlays. Map visible but dimmed behind (rgba(45,42,38,0.25), slight backdrop blur). Centered on screen.

**Edit Value:**
- Name, Type (protect/expand radio), Score (1-10 slider or input), Sufficiency Mark (1-10), Sufficiency Threshold (text), Description
- Read-only: linked activities list, linked outcomes list
- Save, Cancel, Delete (guard: can't delete last value)

**Edit Activity:**
- Name, Description, Type (recurring/one-time), Frequency (if recurring: daily/weekly/biweekly/monthly/quarterly/annual), Target Date (if one-time), Status (active/aspirational/paused/completed), Preventive (checkbox), Life Domain (dropdown), Big Outcome (dropdown), Value Links (multi-select, each with contribution strength: weak/moderate/strong)
- Expandable section: Default Duration, Preferred Days, Preferred Time, Location, Participants
- Save, Cancel, Delete

**Edit Big Outcome:**
- Name, Description, Status (aspirational/in_progress/achieved/abandoned), Target Date, Life Domain (dropdown), Value Links (multi-select with strength)
- If achieved: Completion Note
- If abandoned: Abandonment Reason (required)
- Read-only: linked activities list
- Save, Cancel, Delete

**Add New** (value/activity/outcome/domain): Same modals with empty fields. Triggered by "+" buttons on the map or in the nav area.

**Edit Life Domain:**
- Name, Color (hex input or swatches), Description, Active/Inactive toggle
- Read-only: activity count, values served
- Save, Cancel, Delete (warns activities become unassigned)

**Toast notifications** on successful save/delete. Brief, non-intrusive, auto-dismiss.

### 6. Take Action Box

Below the SVG. Bordered box (1.5px solid #E8E4DC, radius 16, white bg). "Take Action" in 14pt bold.

Computed from real data:
- For each value where score < sufficiency_mark:
  - Overdue activities serving it → "Schedule [names]" with 📅
  - ≤2 total activities serving it → "Add activities for [value]" with ✦
- Each suggestion shows "→ [value name] (score/mark needed)"
- Clicking suggestions does nothing yet (future sessions)

### 7. Nav Bar

Sticky top. White background. Thin.
- "Wild Success" (15pt bold #C4725A)
- Action mode buttons: Today, Organize, Plan, Communicate, Review, Spending — compact, 12pt, bordered, hover highlight. Each opens a "Coming Soon" modal with the descriptions from Map_Module_Task_Flows.md.
- Overdue badge: "[N] overdue" in red (only if N > 0)
- "AI Help" button → opens empty right sidebar "AI assistant coming soon"
- User initial circle → click for logout

---

## Visual Design Rules

- **Desktop-first.** Minimum 1280px. Below that: "Wild Success Map works best on a larger screen."
- **Light background.** Page #FAFAF7. Surfaces #FFFFFF.
- **Font:** Source Sans 3 from Google Fonts. Fallback sans-serif.
- **No dark mode.**
- **The SVG map dominates the page.** Nav bar is thin. Take Action box is compact. The map fills the space.
- **Modals dim but don't hide the map.**
- **Match the mockup's color palette exactly.** All hex values are in WildSuccessMap5.jsx.

---

## What NOT to Build

- No AI integration (Session 3)
- No intake conversation (Session 3)
- No Day Log UI (future)
- No action mode interfaces beyond stubs
- No mobile layout
- No drag-and-drop of map elements
- No real completion percentages for Big Outcomes (stub values)
- No dark mode

## Verification

After building:
- New user → login → map shows 8 default values (all score 5, all green "Handled", same size) and 10 life domains. No activities, no outcomes. Take Action box is empty or shows a positive message.
- Create an activity via modal → appears on map as a dot connected to its value(s)
- Edit a value's score to 2 → circle shrinks, turns red, "Needs attention". Take Action box shows suggestion.
- Edit a value's score to 9 → circle grows, turns blue, "Abundant"
- Create a Big Outcome with value links → appears in outcome row with lines to linked activities
- Click value → activities highlight. Click activity → values highlight. Click outcome → activity lines highlight.
- Mark an activity as recurring + preventive + active with no log entries → it appears overdue (red, pulsing, labeled)
- Log an activity completion via activity log API → heat updates on next load
- Edit modals save with toast. Map re-renders immediately.
- Delete a value when it's the only one → error message
- Delete a life domain → its activities become unassigned (null domain)
- Action mode buttons → "Coming Soon" modals
- Auth: can't reach /map without login. Logout works.