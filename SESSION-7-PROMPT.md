# SESSION 7: AI-Powered Capture Enrichment

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Previous sessions built:** Map Module (values, life domains, activities, big outcomes), intake system, the Organize Week modal with block types, hopper, time-proportional week grid, Google Calendar integration, and the action_log event stream. The hopper accepts quick captures as raw text.

**This session adds intelligence to capture.** Right now, a capture is raw text that sits in the hopper until the user enriches it manually during Organize. After this session, every capture gets AI enrichment within seconds — either matched to an existing Activity template or suggested as a new one — with a compact confirmation popup the user can accept in one tap.

**Read these project files before doing anything:**
- `SESSION-1-PROMPT.md` — database schema (values, life domains, activities, activity_value_links)
- `SESSION-6-PROMPT.md` — Organize Week modal, block types, hopper, schedule_items
- `wild-success-constitutional-reference.docx` — sections 2 (Value Architecture), 5 (Agency)
- `TASK-ORIENTED-DESIGN.md` — tasks should feel easy, context-rich, and confirmable

---

## Core Principle

Capture is always zero-friction. Type it, done. AI enrichment happens in the background and presents a suggestion the user can accept, adjust, or ignore. The capture is never blocked or delayed by enrichment. If the AI is slow, the raw capture still exists in the hopper. If the user ignores the suggestion, nothing is lost.

The AI has a major advantage: it knows the user's existing values (with scores and sufficiency status), life domains, Activity templates with all their metadata, Big Outcomes, block types, and recent hopper/schedule history. It's not guessing cold — it's matching against a known, personal structure.

---

## 1. Schema Changes

### Migration: `supabase/migrations/007_capture_enrichment.sql`

#### 1.1 Add enrichment fields to `hopper_items`

```sql
ALTER TABLE hopper_items ADD COLUMN enrichment_status text
  DEFAULT 'none' CHECK (enrichment_status IN ('none', 'pending', 'enriched', 'confirmed', 'declined'));
-- none = no enrichment attempted (legacy items or AI disabled)
-- pending = AI enrichment in flight
-- enriched = AI returned suggestions, awaiting user confirmation
-- confirmed = user accepted the enrichment
-- declined = user dismissed the enrichment popup

ALTER TABLE hopper_items ADD COLUMN enrichment_data jsonb;
-- Stores the full AI suggestion. Structure:
-- {
--   match_type: "existing_template" | "new_template",
--   matched_activity_id: uuid | null,
--   matched_activity_name: string | null,
--   suggested_name: string,
--   suggested_description: string | null,
--   suggested_life_domain_id: uuid | null,
--   suggested_life_domain_name: string | null,
--   suggested_value_links: [{value_id, value_name, contribution_strength}],
--   suggested_big_outcome_id: uuid | null,
--   suggested_big_outcome_name: string | null,
--   suggested_energy_level: "A" | "B" | "C",
--   suggested_emotional_weight: "light" | "normal" | "heavy",
--   suggested_context: string[],
--   suggested_block_type_id: uuid | null,
--   suggested_block_type_name: string | null,
--   suggested_recurrence: string | null,
--   suggested_preferred_days: string[] | null,
--   suggested_preferred_time: string | null,
--   suggested_duration_min: integer | null,
--   suggested_duration_max: integer | null,
--   suggested_flexibility: string | null,
--   suggested_is_preventive: boolean,
--   confidence: number (0-1),
--   reasoning: string
-- }

ALTER TABLE hopper_items ADD COLUMN enriched_at timestamptz;
-- When the AI enrichment was received

ALTER TABLE hopper_items ADD COLUMN confirmed_at timestamptz;
-- When the user confirmed the enrichment
```

#### 1.2 RLS and Indexes

Existing RLS on hopper_items covers the new columns.

Indexes:
- `hopper_items.enrichment_status`

---

## 2. AI Enrichment Service

### The Context Payload

When a capture comes in, build a context object containing the user's current WS data. This is what gives the AI its advantage over generic tagging.

```javascript
async function buildUserContext(userId) {
  // Fetch in parallel
  const [values, domains, activities, outcomes, blockTypes, recentHopper] = await Promise.all([
    // All user values with scores, sufficiency status, type
    supabase.from('user_values').select('*').eq('user_id', userId).eq('is_active', true),
    // All life domains
    supabase.from('life_domains').select('*').eq('user_id', userId).eq('is_active', true),
    // All active activities with their value links, domain, outcome
    supabase.from('activities').select('*, activity_value_links(value_id, contribution_strength), life_domains(name), big_outcomes(name)')
      .eq('user_id', userId).eq('status', 'active').is('archived_at', null),
    // Active big outcomes
    supabase.from('big_outcomes').select('*').eq('user_id', userId).in('status', ['aspirational', 'in_progress']),
    // Block types
    supabase.from('block_types').select('*').eq('user_id', userId).eq('is_active', true),
    // Recent hopper items (last 20) for pattern context
    supabase.from('hopper_items').select('raw_input, enrichment_data')
      .eq('user_id', userId).order('created_at', { ascending: false }).limit(20),
  ]);

  return { values, domains, activities, outcomes, blockTypes, recentHopper };
}
```

### The AI Call

Send the raw capture text plus the user context to the Anthropic API. The system prompt instructs Claude to return a JSON object.

**API endpoint:** `POST /api/capture/enrich`

**Request flow:**
1. Receive `{ hopper_item_id, raw_input }`
2. Build user context
3. Call Anthropic API
4. Parse response
5. Update hopper_item with enrichment_data and enrichment_status = 'enriched'
6. Return the enrichment to the client

**System prompt for the AI call:**

```
You are the enrichment engine for Wild Success, a personal productivity app.
The user has just captured a quick note. Your job is to analyze it and return
structured enrichment data.

You have access to the user's complete Wild Success context:
- Their values (preventive and promotional), with current scores
- Their life domains
- Their existing Activity templates (recurring practices)
- Their Big Outcomes (active goals)
- Their block types (categories of time)
- Their recent captures (for pattern context)

Your task:
1. Determine if this capture matches an existing Activity template.
   - If yes: return match_type "existing_template" with the matched activity's ID and name.
   - If no: return match_type "new_template" with suggested attributes for a new template.

2. For ALL captures, suggest:
   - A clean name (fix typos, clarify abbreviations)
   - Life domain
   - Value links (which values this serves, with contribution strength: weak/moderate/strong)
   - Big Outcome link (if this clearly serves an active goal)
   - Energy level (A = needs best attention/external-facing, B = routine/batchable, C = easy/recovery)
   - Emotional weight (light / normal / heavy — heavy = disproportionate felt burden relative to time)
   - Context tags (e.g. 'errand-out', 'computer-home', 'phone-anywhere', 'focused-quiet')
   - Block type (which type of time block this fits in)
   - Recurrence (if this looks like a recurring task: daily, weekdays, weekly, etc.)
   - Preferred days and time of day (if inferable)
   - Duration range in minutes
   - Flexibility (hard_scheduled, soft_scheduled, anytime_today, anytime_this_week)
   - Whether it's preventive (neglecting it causes harm) or promotional (pursuing growth)

3. Include a confidence score (0-1) and a brief reasoning string explaining your match/suggestion.

IMPORTANT: Use ONLY the IDs and names from the user's actual data. Do not invent
values, domains, activities, or outcomes that don't exist in the context provided.
If nothing matches, leave the field null rather than guessing an ID.

Return ONLY a valid JSON object. No preamble, no markdown, no explanation outside the JSON.
```

**The user message sent to the AI:**

```
Capture text: "{raw_input}"

User context:
Values: {JSON of values with ids, names, types, scores, sufficiency_status}
Life domains: {JSON of domains with ids, names}
Activity templates: {JSON of activities with ids, names, value links, domains, outcomes}
Big Outcomes: {JSON of outcomes with ids, names, status}
Block types: {JSON of block types with ids, names, energy levels}
Recent captures: {JSON of last 20 captures with raw_input and enrichment_data}
```

### Handling the AI Response

```javascript
async function enrichCapture(hopperItemId, rawInput, userId) {
  // Update status to pending
  await supabase.from('hopper_items')
    .update({ enrichment_status: 'pending' })
    .eq('id', hopperItemId);

  try {
    const context = await buildUserContext(userId);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        system: ENRICHMENT_SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: buildEnrichmentUserMessage(rawInput, context)
        }]
      })
    });

    const data = await response.json();
    const enrichment = JSON.parse(
      data.content[0].text.replace(/```json|```/g, '').trim()
    );

    // Validate matched IDs exist in user's data
    enrichment = validateEnrichmentIds(enrichment, context);

    await supabase.from('hopper_items')
      .update({
        enrichment_status: 'enriched',
        enrichment_data: enrichment,
        enriched_at: new Date().toISOString(),
        // Also update the hopper item's own fields from the enrichment
        block_type_hint: enrichment.suggested_block_type_id,
        priority_tier: enrichment.suggested_is_preventive ? 'urgent' : 'normal',
      })
      .eq('id', hopperItemId);

    return enrichment;
  } catch (error) {
    // On failure, revert to unenriched — the capture still exists
    await supabase.from('hopper_items')
      .update({ enrichment_status: 'none' })
      .eq('id', hopperItemId);
    console.error('Enrichment failed:', error);
    return null;
  }
}
```

### ID Validation

The AI might return an activity_id or value_id that doesn't exist (hallucination). Always validate:

```javascript
function validateEnrichmentIds(enrichment, context) {
  // Check matched_activity_id exists
  if (enrichment.matched_activity_id) {
    const exists = context.activities.data.some(a => a.id === enrichment.matched_activity_id);
    if (!exists) {
      enrichment.match_type = 'new_template';
      enrichment.matched_activity_id = null;
      enrichment.matched_activity_name = null;
    }
  }

  // Check value link IDs exist
  if (enrichment.suggested_value_links) {
    enrichment.suggested_value_links = enrichment.suggested_value_links.filter(
      vl => context.values.data.some(v => v.id === vl.value_id)
    );
  }

  // Check domain ID exists
  if (enrichment.suggested_life_domain_id) {
    const exists = context.domains.data.some(d => d.id === enrichment.suggested_life_domain_id);
    if (!exists) {
      enrichment.suggested_life_domain_id = null;
      enrichment.suggested_life_domain_name = null;
    }
  }

  // Check big outcome ID exists
  if (enrichment.suggested_big_outcome_id) {
    const exists = context.outcomes.data.some(o => o.id === enrichment.suggested_big_outcome_id);
    if (!exists) {
      enrichment.suggested_big_outcome_id = null;
      enrichment.suggested_big_outcome_name = null;
    }
  }

  // Check block type ID exists
  if (enrichment.suggested_block_type_id) {
    const exists = context.blockTypes.data.some(bt => bt.id === enrichment.suggested_block_type_id);
    if (!exists) {
      enrichment.suggested_block_type_id = null;
      enrichment.suggested_block_type_name = null;
    }
  }

  return enrichment;
}
```

---

## 3. Capture Enrichment UI

### The Flow

1. User types in the capture input (in Organize modal hopper, or the floating capture on the Map page) and hits Enter.
2. Raw text saves to hopper_items immediately. The item appears in the hopper list. Status: `enrichment_status = 'pending'`. Show a subtle loading indicator on the item (pulsing dot or shimmer).
3. The API call fires in the background (1-2 seconds typically).
4. When enrichment returns, a **compact confirmation card** pops up near the capture input or attached to the hopper item.
5. The user acts:
   - **Confirm** (one tap) → enrichment applied, template created or linked
   - **See details** → card expands to show all fields, user can edit any
   - **Dismiss** (× or click away) → enrichment_status = 'declined', raw capture stays in hopper as-is

### Compact Confirmation Card

A small card (max 320px wide) that appears inline or as a popover anchored to the hopper item.

**For Path 1 — matched to existing template:**

```
┌──────────────────────────────────────┐
│  ◈ Matches: School logistics         │
│                                      │
│  📁 Family  ·  🔋 C  ·  15 min      │
│  Values: Belonging, Safety           │
│  Weekdays, 8:00 AM                   │
│                                      │
│  [Confirm]     [See details]     ×   │
└──────────────────────────────────────┘
```

**For Path 2 — new template suggestion:**

```
┌──────────────────────────────────────┐
│  ✦ New: Take Winston to school       │
│                                      │
│  📁 Family  ·  🔋 C  ·  15 min      │
│  Values: Belonging, Safety           │
│  Weekdays, 8:00 AM · Preventive     │
│                                      │
│  [Confirm]     [See details]     ×   │
└──────────────────────────────────────┘
```

**Visual design:**
- Card background: white, border: 1.5px solid #E8E4DC, border-radius: 12px, subtle box shadow
- Matched template indicator: ◈ in purple (#7F77DD) with template name
- New template indicator: ✦ in amber (#BA7517) with suggested name
- Domain, energy dot (colored A/B/C), duration on one line
- Value names as tags
- Recurrence and time on one line, preventive flag if true
- Confirm button: solid, primary color (#C4725A)
- See details: text button, secondary
- Dismiss: × in top right corner

### Expanded Details View

When the user taps "See details," the card expands (or a slide-over panel opens) showing all enrichment fields, each editable:

- **Name** — text input, pre-filled with suggested_name
- **Matched template** — if Path 1, shows the match with option to unmatch ("This is something new")
- **Life Domain** — dropdown, pre-selected
- **Values** — multi-select with contribution strength (weak/moderate/strong per value)
- **Big Outcome** — dropdown, pre-selected if suggested
- **Energy level** — A/B/C selector
- **Emotional weight** — light/normal/heavy selector
- **Context** — tag input (errand-out, computer-home, etc.)
- **Block type** — dropdown, pre-selected
- **Recurrence** — dropdown (one-time, daily, weekdays, weekly, biweekly, monthly, etc.)
- **Preferred days** — multi-select day chips (Mon–Sun)
- **Preferred time** — morning/afternoon/evening selector
- **Duration** — two number inputs (min and max minutes)
- **Flexibility** — hard_scheduled / soft_scheduled / anytime_today / anytime_this_week
- **Preventive** — toggle

At the bottom: **Save** and **Cancel**. Save writes the edited enrichment.

### What Happens on Confirm

**Path 1 — Existing template match:**
1. Link the hopper_item to the matched Activity via `activity_id`
2. Copy relevant template fields to the hopper_item (energy, context, values, block_type_hint)
3. Set `enrichment_status = 'confirmed'`, `confirmed_at = now()`
4. If recurrence info differs from the template, optionally update the template (future — for now just link)

**Path 2 — New template:**
1. Create a new Activity template from the enrichment data:
   - `source = 'template_derived'`
   - All fields from the enrichment (name, description, recurrence, energy, etc.)
   - Create `activity_value_links` for each suggested value link
   - Set `life_domain_id`, `big_outcome_id` if suggested
2. Create a `task_suggestion` under the new Activity if appropriate
3. Link the hopper_item to the new Activity via `activity_id`
4. Set `enrichment_status = 'confirmed'`, `confirmed_at = now()`
5. Future captures matching this pattern will hit Path 1

---

## 4. API Routes

### Capture Enrichment — `/api/capture/enrich`

- `POST` — accepts `{ hopper_item_id }`. Reads the hopper_item's raw_input, builds user context, calls AI, stores enrichment. Returns the enrichment_data JSON.
- Called automatically after a hopper_item is created via quick capture.
- Idempotent — calling again on an already-enriched item re-enriches (useful if user wants a fresh suggestion).

### Capture Confirm — `/api/capture/confirm`

- `POST` — accepts `{ hopper_item_id, enrichment_data }`. The enrichment_data may be the original AI suggestion or user-edited version from the details view.
- Performs the confirm logic (Path 1: link to template, Path 2: create new template + link).
- Updates hopper_item enrichment_status to 'confirmed'.
- Returns the created/linked Activity and any new task_suggestions.

### Capture Decline — `/api/capture/decline`

- `POST` — accepts `{ hopper_item_id }`.
- Sets `enrichment_status = 'declined'`.
- The raw capture remains in the hopper as-is.

---

## 5. Integration Points

### Capture Input Locations

AI enrichment fires from every capture entry point in the app:

1. **Organize modal hopper capture input** — the text field at the bottom of the hopper panel. On Enter: create hopper_item → show in list with loading shimmer → fire enrichment → show confirmation card.

2. **Map page floating capture** — the persistent capture input on the Map page (from SESSION-3). Same flow.

3. **Future: mobile capture** — same API, different UI surface. The enrichment API is decoupled from the UI.

### Hopper Item Display

After enrichment, the hopper item's display updates:

- **Before enrichment (pending):** Shows raw text with a subtle pulsing dot
- **After enrichment (enriched, not yet confirmed):** Shows the suggested name (cleaned up), with a small "◈ matched" or "✦ new" badge. The compact confirmation card is visible nearby.
- **After confirmation:** Shows the enriched name, energy dot, value tags, domain — full metadata. Looks identical to template-proposed hopper items.
- **After decline:** Shows raw text, no enrichment indicators. Item is just a plain capture.

### Enrichment During Organize

When the user opens Organize and the hopper loads, any items with `enrichment_status = 'enriched'` (suggested but not yet confirmed) should show their confirmation cards. The user can batch-confirm enrichments during their Organize session.

Items with `enrichment_status = 'none'` (captured before this feature existed, or enrichment failed) can be manually enriched via a "✦ Enrich" button on the hopper item, which triggers the enrichment API.

---

## 6. Visual Design

### Compact Confirmation Card
- Max width: 320px
- Background: white (#FFFFFF)
- Border: 1.5px solid #E8E4DC
- Border-radius: 12px
- Box shadow: 0 4px 12px rgba(0,0,0,0.08)
- Padding: 12px 16px
- Match indicator: ◈ in #7F77DD (purple) for existing template match
- New indicator: ✦ in #BA7517 (amber) for new template suggestion
- Domain icon: 📁 in muted text
- Energy dot: colored circle (A=#C4725A, B=#4B82AF, C=#7A9E82)
- Value tags: small pills with value name, #9E6A46 text on #9E6A4610 background
- Recurrence text: muted, 12px
- Preventive badge: small "Preventive" tag in #C4725A if true
- Confirm button: #C4725A background, white text, 13px bold, 8px 20px padding, border-radius 8px
- See details: text only, #8A857D, 13px
- Dismiss ×: top right, 20×20px, muted

### Loading State
- Hopper item shows raw text
- Small pulsing dot (3-frame CSS animation) in #C4725A next to the text
- Duration: until enrichment returns or 10-second timeout (then revert to 'none')

### Expanded Details
- Slide-over panel or expanded card below the compact card
- Same form styling as the existing edit modals (from SESSION-2 patterns)
- Dropdowns for domain, values, outcome, block type
- Chip selectors for days, energy, weight
- Number inputs for duration range
- Toggle for preventive flag

---

## What NOT to Build

- No automatic template creation without user confirmation (the user always confirms)
- No enrichment of non-capture hopper items (template proposals are already enriched by definition)
- No batch enrichment of old captures (user can manually trigger via "Enrich" button per item)
- No AI enrichment of calendar events (calendar classification is a separate flow from SESSION 5/6)
- No communication suggestions or advice
- No mobile-specific UI
- No enrichment of items during Action view (future)
- No learning from user edits to improve future enrichments (future — the correction signal is valuable but requires a feedback loop to Claude, which is a later feature)

---

## Verification

### Basic Capture Flow
- Type "Take Winston to school" in capture input → hopper_item created instantly → appears in list
- Loading shimmer shows on the item for 1-2 seconds
- Compact confirmation card appears with AI suggestion
- Suggestion includes: name cleaned up, Family domain, Belonging + Safety values, weekdays recurrence, 8am, 15 min, energy C, preventive

### Path 1 — Existing Template Match
- Create an Activity template "School logistics" with Family domain and Belonging value
- Capture "take Winston to school tomorrow"
- AI returns match_type "existing_template" with the School logistics activity ID
- Compact card shows "◈ Matches: School logistics"
- Confirm → hopper_item linked to the activity, enrichment_status = 'confirmed'

### Path 2 — New Template
- Capture something with no matching template: "Start a garden journal"
- AI returns match_type "new_template" with suggested fields
- Compact card shows "✦ New: Garden journal"
- Confirm → new Activity template created with suggested fields, hopper_item linked

### See Details
- Tap "See details" on compact card → expanded form shows all AI-suggested fields
- Change the domain from "Family" to "Home" → tap Save
- The edited enrichment is what gets written, not the original AI suggestion

### Decline
- Tap × on compact card → enrichment_status = 'declined'
- Raw capture remains in hopper with no enrichment metadata
- No template created, no links

### Error Handling
- AI API timeout → enrichment_status reverts to 'none', item stays as raw capture
- AI returns invalid activity_id → validation catches it, switches to "new_template" path
- AI returns empty response → enrichment_status = 'none', no popup shown

### Integration
- Enriched items in hopper show full metadata (energy dot, value tags, domain)
- Enriched items can be dragged to blocks in Organize just like template-proposed items
- Confirmed enrichments with recurrence → future hopper proposals generate automatically from the new template
- Items with enrichment_status = 'none' show an "✦ Enrich" button to manually trigger

---

## Session 8 Preview (for context only — do not build)

Session 8 builds the Action view — the lightweight mobile-first day strip for executing the committed plan. Shows current time block, active task, what's next. Big "done" button. Quick capture with AI enrichment. One-tap reschedule (item returns to hopper). Also explores Life Domain reflection views that compute domain coverage from activity-value-domain linkages rather than requiring manual domain tagging.