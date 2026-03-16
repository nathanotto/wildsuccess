# Wild Success — Codebase Snapshot

> For Claude Opus: UI mockup and prompt context reference. Reflects state after Session 3.

---

## 1. File Structure

```
wildsuccess/
├── app/
│   ├── layout.tsx
│   ├── page.tsx                          (redirects to /map)
│   ├── login/page.tsx
│   ├── signup/page.tsx                   (full_name, preferred_name, email, password)
│   ├── setup/page.tsx                    (server component → SetupClient)
│   ├── map/page.tsx                      (server component, auth guard, → MapClient)
│   └── api/
│       ├── values/route.ts               (GET, POST)
│       ├── values/[id]/route.ts          (PATCH, DELETE)
│       ├── life-domains/route.ts         (GET, POST)
│       ├── life-domains/[id]/route.ts    (PATCH, DELETE)
│       ├── big-outcomes/route.ts         (GET, POST)
│       ├── big-outcomes/[id]/route.ts    (PATCH, DELETE)
│       ├── activities/route.ts           (GET, POST)
│       ├── activities/[id]/route.ts      (PATCH, DELETE)
│       ├── activity-log/route.ts         (GET, POST)
│       ├── activity-log/[id]/route.ts    (PATCH, DELETE)
│       ├── activity-value-links/...      (GET, POST, PATCH, DELETE)
│       ├── big-outcome-value-links/...   (GET, POST, PATCH, DELETE)
│       ├── intake/questions/route.ts     (GET)
│       ├── intake/responses/route.ts     (GET, POST)
│       ├── intake/responses/[id]/route.ts (PATCH, DELETE)
│       ├── intake/generate/route.ts      (POST — Claude API activity generation)
│       ├── hopper/route.ts               (GET ?status=, POST)
│       ├── hopper/[id]/route.ts          (PATCH, DELETE)
│       ├── hopper/propose/route.ts       (POST — generate daily proposals)
│       ├── schedule/route.ts             (GET ?date= or ?range_start=&range_end=, POST)
│       ├── schedule/[id]/route.ts        (PATCH, DELETE)
│       ├── map/heat/route.ts             (GET — value heat + overdue activity IDs)
│       ├── profile/route.ts              (GET, PATCH)
│       └── setup/route.ts               (POST — completes onboarding)
├── components/
│   ├── map/
│   │   ├── MapClient.tsx                 (root client component — state, modals, fetching)
│   │   ├── NavBar.tsx                    (top bar: title, action modes, user menu)
│   │   ├── WildSuccessMapSVG.tsx         (values-mode SVG mind map)
│   │   ├── LifeMapSVG.tsx                (life-domains SVG map)
│   │   ├── TakeActionBox.tsx             (action suggestions from value sufficiency)
│   │   ├── EditValueModal.tsx            (create/edit value)
│   │   ├── EditActivityModal.tsx         (create/edit activity — most complex modal)
│   │   ├── EditBigOutcomeModal.tsx       (create/edit big outcome)
│   │   ├── EditDomainModal.tsx           (create/edit life domain)
│   │   ├── SeedQuestionsModal.tsx        (welcome intake questions modal)
│   │   ├── ContextualNudge.tsx           (progressive intake nudge widget)
│   │   ├── QuickCapture.tsx              (floating hopper capture input)
│   │   ├── Toast.tsx                     (bottom-right notification)
│   │   └── ComingSoonModal.tsx           (placeholder for future action modes)
│   ├── setup/
│   │   └── SetupClient.tsx               (3-step onboarding: values → promotional → domains)
│   └── ui/
│       └── button.tsx
├── lib/
│   ├── types.ts                          (all TypeScript interfaces)
│   ├── activity-generation.ts            (Claude API + deterministic activity generation)
│   └── supabase/
│       ├── client.ts                     (browser client)
│       └── server.ts                     (server client with cookie handling)
└── supabase/migrations/
    ├── 001_map_module.sql
    ├── 002_add_value_scores.sql
    ├── 003_fix_trigger_search_path.sql
    ├── 004_activity_domain_links.sql
    ├── 005_intake_and_activities.sql
    └── 006_user_names.sql
```

---

## 2. Color Tokens

All styling is inline (`React.CSSProperties`). No CSS files or Tailwind.

### Brand
| Token | Hex | Use |
|---|---|---|
| Primary | `#C4725A` | Buttons, links, active states, accent |
| Danger | `#C4504A` | Errors, delete actions |
| Success | `#5A9E6F` | Success states, answered questions |

### Text
| Token | Hex | Use |
|---|---|---|
| Text primary | `#2D2A26` | All body text, headings |
| Text muted | `#8A8578` | Secondary text, placeholders, labels |

### Surfaces
| Token | Hex | Use |
|---|---|---|
| Page bg | `#FAFAF7` | App background |
| Card bg | `#FFFFFF` | Modals, cards |
| Surface 1 | `#F8F7F4` | Secondary surfaces, cancel buttons |
| Surface 2 | `#F0EDE6` | Chips, dividers, borders |
| Border | `#E8E4DC` | Input borders, separators |

### Semantic backgrounds
| Token | Hex | Use |
|---|---|---|
| Selected bg | `#FDF6F3` | Selected option in segmented controls |
| Error bg | `#FDF5F4` | Error context |
| Success bg | `#F4FDF7` | Success context |

### Overlays
- Modal backdrop: `rgba(45,42,38,0.25)` with `backdropFilter: blur(2px)`
- Box shadows: `0 8px 32px rgba(45,42,38,0.12)`

---

## 3. Typography

**Font:** `'Source Sans 3', sans-serif` — set on every component via inline `fontFamily`.

| Size | Use |
|---|---|
| 10–11px | Micro labels, badges, chip text |
| 12px | Field labels, secondary content, toast |
| 13px | Body text, buttons, most UI |
| 14px | Sub-headers |
| 15–16px | Modal headers |
| 20px | Page/brand titles |

**Weights:** 400 (body), 600 (labels, buttons), 700 (headings)

---

## 4. Component Patterns

### MapClient.tsx — Root State Manager

All data lives here. Passes down to children. No external state library.

**State:**
```typescript
values: UserValue[]
domains: LifeDomain[]
outcomes: BigOutcome[]
activities: Activity[]
profile: UserProfile | null
overdueActivityIds: string[]
modal: ModalState           // discriminated union, see below
toast: { message, type } | null
mapMode: 'values' | 'life'
// Intake
seedQuestions: IntakeQuestion[]
allQuestions: IntakeQuestion[]
answeredIds: Set<string>
showWelcomeModal: boolean
```

**Modal state union:**
```typescript
type ModalState =
  | { type: 'editValue'; value: UserValue }
  | { type: 'newValue' }
  | { type: 'editActivity'; activity: Activity }
  | { type: 'newActivity' }
  | { type: 'editOutcome'; outcome: BigOutcome }
  | { type: 'newOutcome' }
  | { type: 'editDomain'; domain: LifeDomain }
  | { type: 'newDomain' }
  | null
```

**Save pattern (every modal follows this):**
```typescript
onSave={async (data) => {
  const res = await fetch(`/api/values/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (res.ok) { await fetchAll(); setModal(null); showToast('Saved') }
  else { const e = await res.json(); showToast(e.error, 'error') }
}}
onClose={() => setModal(null)}
```

**Render order:**
1. NavBar
2. Map mode toggle (Values / Life)
3. WildSuccessMapSVG or LifeMapSVG
4. TakeActionBox (values mode only)
5. All modals (conditionally)
6. SeedQuestionsModal (first-visit intake)
7. QuickCapture (hidden when any modal open)
8. ContextualNudge (hidden when any modal open)
9. Toast

---

### NavBar.tsx

Sticky top bar.

**Props:** `displayName`, `userInitial`, `overdueCount`, `onNewValue`, `onNewActivity`, `onNewOutcome`, `onNewDomain`

**Renders:**
- "Wild Success" brand text (left)
- 6 action mode buttons: Today, Organize, Plan, Communicate, Review, Spending — all currently show `ComingSoonModal`
- Overdue badge (red pill with count, shown if `overdueCount > 0`)
- User avatar circle (`userInitial`) with dropdown → Logout

---

### EditActivityModal.tsx — Most Complex Modal

**All fields:**
- Name, Description
- Type (recurring / one_time) + Frequency or Target Date
- **Energy Level** (A / B / C) — segmented control
- **Emotional Weight** (light / normal / heavy) — segmented control
- **Flexibility** (hard_scheduled / soft_scheduled / anytime_today / anytime_this_week) — segmented control
- **Context Tags** — preset chips + free-type input
- Life Domains (multi-select pills, required)
- Big Outcome (select)
- Values served (checkboxes + contribution strength)
- Status + Is Preventive
- **More details** (collapsed):
  - Duration range min/max
  - Clusterable, Prep required + notes, Depends on others + notes
  - Legacy: default duration, preferred time/days, location, participants

---

### TakeActionBox.tsx

**Props:** `values`, `activities`, `overdueActivityIds`

Shows action suggestions for values below their sufficiency mark. Per value:
- Overdue activities linked to that value
- Prompt to add an activity if fewer than 2 serve the value

---

### QuickCapture.tsx

Floating bottom input (hidden when modals open). On submit: POST to `/api/hopper` with `source: 'quick_capture'`. Shows toast "Captured."

---

### ContextualNudge.tsx

Surfaces one unanswered progressive intake question domain at a time. Dismissable per domain (7-day localStorage cooldown). Opens modal with domain-filtered questions. On answer: calls intake response POST which triggers activity generation.

---

## 5. Database Schema

### user_profiles
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | → auth.users |
| full_name | text | Added Session 3 |
| preferred_name | text | Added Session 3, used in UI |
| display_name | text | Legacy |
| intake_status | enum | not_started / in_progress / complete |
| intake_progress | jsonb | `{ welcome_shown: boolean, ... }` |
| created_at, updated_at | timestamptz | |

Auto-created by trigger on auth.users insert. Trigger also seeds default values and domains.

---

### user_values
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | → auth.users |
| name | text | unique per user |
| description | text | nullable |
| value_type | enum | preventive / promotional |
| score | integer 1–10 | current sufficiency score |
| sufficiency_mark | integer 1–10 | target threshold |
| sufficiency_status | enum | unassessed / insufficient / partial / sufficient |
| sort_order | integer | |
| is_active | boolean | |

---

### life_domains
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | → auth.users |
| name | text | unique per user |
| description | text | nullable |
| color | text | nullable |
| sort_order | integer | |
| is_active | boolean | |

---

### big_outcomes
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | → auth.users |
| name | text | |
| description | text | nullable |
| status | enum | aspirational / in_progress / achieved / abandoned |
| target_date | date | nullable |
| life_domain_id | uuid | → life_domains, nullable |
| completed_at, completion_note | | nullable |
| abandonment_reason | text | nullable |
| sort_order | integer | |

---

### activities (Activity Templates)
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid | → auth.users |
| name | text | |
| description | text | nullable |
| activity_type | enum | recurring / one_time |
| frequency | enum | daily/weekly/biweekly/monthly/quarterly/annual, nullable |
| target_date | date | nullable (one_time only) |
| status | enum | active / aspirational / paused / completed |
| is_preventive | boolean | |
| big_outcome_id | uuid | → big_outcomes, nullable |
| default_duration_minutes | integer | nullable (legacy) |
| preferred_days | text[] | nullable |
| preferred_time | text | nullable |
| default_location | text | nullable |
| participants | text | nullable |
| sort_order | integer | |
| **context** | text[] | context tags e.g. 'computer-home', 'errand-out' |
| **energy_level** | enum | A / B / C |
| **emotional_weight** | enum | light / normal / heavy |
| **flexibility** | enum | hard_scheduled / soft_scheduled / anytime_today / anytime_this_week |
| **clusterable** | boolean | |
| **prep_required** | boolean | |
| **prep_notes** | text | nullable |
| **depends_on_others** | boolean | |
| **dependency_notes** | text | nullable |
| **duration_range_min** | integer | nullable (minutes) |
| **duration_range_max** | integer | nullable (minutes) |
| **source** | enum | template_derived / user_created / outside_request / planning_function |
| **archived_at** | timestamptz | nullable — non-null = retired |

Bold = added Session 3.

---

### activity_value_links
Many-to-many activities ↔ user_values.
- `activity_id`, `value_id`, `contribution_strength` (weak/moderate/strong)

### activity_domain_links
Many-to-many activities ↔ life_domains.
- `activity_id`, `domain_id`

### big_outcome_value_links
Many-to-many big_outcomes ↔ user_values.
- `big_outcome_id`, `value_id`, `contribution_strength`

---

### activity_log
Completion records.
- `activity_id`, `user_id`, `performed_at`, `note`, `duration_minutes`

### day_log
Daily journal entries.
- `user_id`, `log_date` (unique per user), `journal_note`, `gratitude_note`, `mood_energy` (1–5)

---

### intake_questions (system reference, not per-user)
| Column | Type |
|---|---|
| question_text | text |
| question_type | enum: boolean/single_choice/multi_choice/number/freetext |
| options | jsonb (nullable) |
| domain_tag | text: household/work/health/rhythm/finance/social/growth |
| payoff_description | text |
| is_seed_question | boolean |

31 questions seeded: 8 seed (asked at first Map visit), 23 progressive (surfaced by ContextualNudge).

---

### intake_responses
- `user_id`, `question_id` (unique together), `response` (jsonb)

---

### hopper_items
Inbox for everything that might become a scheduled action.
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| raw_input | text | original capture text |
| source | enum | quick_capture / template_proposal / outside_request / planning_function |
| activity_id | uuid | nullable, linked template |
| status | enum | pending / activated / dismissed / ignored / archived |
| proposed_date | date | nullable |
| metadata | jsonb | nullable (e.g. `{ requested_by, deadline }`) |
| resolved_at | timestamptz | nullable |

---

### schedule_items
The unified calendar/to-do table. Items land here after leaving the hopper.
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | |
| activity_id | uuid | nullable, source template |
| hopper_item_id | uuid | nullable, source hopper item |
| name | text | |
| scheduled_date | date | |
| scheduled_time | time | nullable = anytime |
| scheduled_end_time | time | nullable |
| flexibility | enum | hard_scheduled / soft_scheduled / anytime_today |
| context | text[] | |
| energy_level | enum | A / B / C |
| emotional_weight | enum | light / normal / heavy |
| status | enum | active / completed / skipped / rescheduled |
| completion_note, actual_duration_minutes, completed_at | | filled on completion |

Completing a schedule_item with an activity_id auto-creates an activity_log entry.

---

## 6. Current User

One real user: **Nathan Otto** (preferred: Nathan). Five test users: Test1–Test5 @ Test1@test.com–Test5@test.com / passwd.

---

## 7. Session Roadmap

| Session | Status | Built |
|---|---|---|
| 1 | ✅ Done | Schema, auth, seed data |
| 2 | ✅ Done | Map SVG, all edit modals, TakeActionBox |
| 3 | ✅ Done | Intake system, activity templates, hopper, schedule, setup flow, Claude activity generation |
| 4 | 🔜 Next | Organize modal — processes hopper into schedule_items |

### Session 4 scope (for reference):
Full-screen Organize modal over the Map. Left panel: hopper items. Main area: day/week calendar being assembled. Three modes: Setup (populate the day), Reorg (handle interruptions), Capture (close out the day). Time Template (ideal week underlay) and Google Calendar integration stubbed as "coming soon."

---

## 8. Not Yet Built

- Decay/archive for unused template-derived activities (5 consecutive non-engagements → prompt)
- Organize modal (Session 4)
- Time Template / ideal week
- Right Now view
- Google Calendar integration
- Planning function
- Mobile layouts
- AI parsing of quick captures
- Auto-detection of outside requests
