# SESSION 12: The Review Page

## Context

You are building Wild Success, a personal productivity and attention-management app. Stack: Next.js + Supabase + Vercel.

**Previous sessions built:** Values Map, Organize Week modal, /today page with focus view and four-state items, capture parser, action_items table (merged from hopper_items and schedule_items), item_notes, action_log, day_reflection with Wins/Friction/Journal fields.

**This session builds the /review page** — a read-only view of past days. The user swipes through closed days, seeing what happened, what didn't, what was logged, and what they reflected on. This is the perspective surface — Organize looks forward, Today looks at now, Review looks back.

**Read these project files before doing anything:**
- `SESSION-11-PROMPT.md` — action_items refactor (the data model Review reads from)
- `SESSION-9-PROMPT.md` — /today page (Review's day view mirrors the Yesterday tab)
- The /today page code itself — Review/Days reuses the same visual structure

**Design reference:** The day view in Review is identical to /today's Yesterday tab — same sections, same visual density, same typography. The difference: Review has date navigation (arrows + swipe) and is read-only. No checkboxes, no ↺ buttons, no capture input.

---

## 1. Route Structure

```
/review          → redirects to /review/days
/review/days     → swipeable day-by-day view (built this session)
/review/week     → coming soon
/review/month    → coming soon
/review/quarter  → coming soon
/review/year     → coming soon
```

All routes share a common layout with a sub-navigation bar at top: **Days** | Week | Month | Quarter | Year. The active period is bold and underlined. Inactive periods are muted and link to their coming-soon page.

---

## 2. Schema Changes

None. Review reads from existing tables:
- `action_items` — completed, skipped, rescheduled, and incomplete items for a given date
- `action_log` — logged events (event_type='logged') for a given date
- `day_reflection` — wins, friction, journal, mood, plan_status for a given date

No new tables, no new columns.

---

## 3. The Days View

### Route: `/review/days`

### Layout — top to bottom

**Sub-navigation bar:**
- Centered row: Days | Week | Month | Quarter | Year
- Days is active (bold, underlined, dark text). Others are muted, tappable, link to their respective routes.
- 13px Source Sans 3

**Date navigation:**
- Centered between left ‹ and right › arrow buttons
- Center shows: day name and date on one line (16px, bold). Example: "Saturday, March 15"
- Below: relative label (12px, muted). Example: "6 days ago", "Yesterday", "2 weeks ago"
- ‹ goes to the previous day. › goes to the next day.
- Navigation stops at today — the user cannot go forward past today (today's view is /today, not /review).
- Default: load yesterday when the page first opens.

**Day content:**
- Identical visual structure to the /today Yesterday tab

**Status row:**
- "Day closed" in bold, followed by mood label from day_reflection.mood_energy in color:
  - 5 = "Great" (green #5A9E6F)
  - 4 = "Good" (green #5A9E6F)
  - 3 = "Okay" (amber #BA7517)
  - 2 = "Tough" (brick red #B8443E)
  - 1 = "Hard" (brick red #B8443E)
  - null/unset = no mood shown
- Right side: "Reopen this day" link (muted, 12px). Tapping sets day_reflection.plan_status back to 'open' and redirects to /today with that date selected. This is an escape hatch, not a primary interaction.

If the day was never closed (plan_status != 'closed'), show "Day not closed" in muted text instead. The data still renders — the user can see what happened even if they didn't do the formal close.

**Done section:**
- Header: "DONE" in 11px uppercase muted
- Action items for this date with status='completed', ordered by completed_at time
- Each shows: green filled checkbox (not interactive), struck-through name, completion time on the right (12px, muted)
- If no completed items: section is hidden

**Incomplete section:**
- Header: "INCOMPLETE" in 11px uppercase muted
- Action items for this date with status IN ('committed', 'in_progress', 'skipped', 'rescheduled', 'parked') that were NOT completed
- Each shows: empty checkbox (not interactive), muted name (40% opacity)
- If no incomplete items: section is hidden

**Logged section:**
- Header: "LOGGED" in 11px uppercase muted
- Action log entries for this date with event_type='logged', ordered by created_at
- Each shows: timestamp on the left (12px, light muted, 44px wide), log text in muted color
- If no logged entries: section is hidden

**Divider:**
- A subtle warm line (#C4725A, 20% opacity) separating the data sections from the reflection sections

**Wins section:**
- Header: "WINS" in 11px uppercase muted
- Text from day_reflection.metadata->'wins' (or a dedicated column — see implementation note below)
- 14px, normal color, natural line height
- If empty/null: section is hidden

**Friction section:**
- Header: "FRICTION" in 11px uppercase muted
- Text from day_reflection.metadata->'friction'
- Same styling as Wins
- If empty/null: section is hidden

**Journal section:**
- Header: "JOURNAL" in 11px uppercase muted
- Text from day_reflection.journal_note
- Same styling as Wins
- If empty/null: section is hidden

### Implementation Note: Wins and Friction Storage

The day_reflection table currently has `journal_note` but not separate `wins` and `friction` fields. Two options:

**Option A:** Add two columns to day_reflection:
```sql
ALTER TABLE day_reflection ADD COLUMN wins text;
ALTER TABLE day_reflection ADD COLUMN friction text;
```

**Option B:** Store wins and friction in the existing `metadata` jsonb column on day_reflection (add the column if it doesn't exist):
```sql
ALTER TABLE day_reflection ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}';
```
Then store as `metadata.wins` and `metadata.friction`.

Use Option A. Dedicated columns are simpler to query and the data is important enough to deserve its own fields. Add this to the migration for this session.

### Day Navigation Behavior

**Arrow buttons (desktop):**
- ‹ loads the previous day. › loads the next day.
- Animate the transition: slide the current day out and the new day in (300ms ease). Same direction as the navigation — ‹ slides content right (previous day enters from left), › slides content left (next day enters from right).
- If at the most recent closed day, › is disabled (muted, no pointer).
- If at the earliest day with data, ‹ is disabled.

**Swipe gesture (mobile):**
- Touch swipe left = next day (same as ›)
- Touch swipe right = previous day (same as ‹)
- Minimum swipe distance: 50px
- Same slide animation as arrow buttons

**Data loading:**
- On initial page load: fetch yesterday's data
- On navigation: fetch the target day's data. Use client-side caching — keep the current day and one day on each side pre-fetched for smooth swiping. As the user navigates, prefetch the next day in the direction of travel.

---

## 4. Coming Soon Pages

### Routes: `/review/week`, `/review/month`, `/review/quarter`, `/review/year`

Each route renders:
- The same sub-navigation bar with the appropriate period active
- A centered message: "Week Review — coming soon" (or Month, Quarter, Year)
- Below: a brief description of what this view will show, in muted text

Descriptions:

**Week:** "Weekly summary with time balance, values check-in, and integrity gap across seven days."

**Month:** "Monthly trends showing how your attention and values shifted across four weeks."

**Quarter:** "Quarterly patterns and progress on Big Outcomes."

**Year:** "Annual animation of your values evolving and activities completing across 52 weeks."

---

## 5. API Route

### `/api/review/day`

- `GET ?date=YYYY-MM-DD` — returns all data needed to render one day in the Review view:
  - `action_items` for that date, partitioned into:
    - `completed`: status='completed', ordered by completed_at
    - `incomplete`: status IN ('committed', 'in_progress', 'skipped', 'rescheduled', 'parked'), ordered by sort_order
  - `logged`: action_log entries with event_type='logged' and event_date=date, ordered by created_at
  - `reflection`: day_reflection row for that date (mood_energy, journal_note, wins, friction, plan_status)
  - `metadata`: { date, dayOfWeek, daysAgo }

The query for action_items uses `committed_date = :date`. Items that were committed to this day show up regardless of their current status — this is the historical record of what was on the plate.

### `/api/review/day/reopen`

- `POST ?date=YYYY-MM-DD` — sets day_reflection.plan_status='open', clears closed_at. Returns success. The client redirects to /today with that date.

---

## 6. Nav Bar Update

Add "Review" to the nav bar alongside Today and Organize.
- Position: after Today
- Clicking navigates to `/review` (which redirects to `/review/days`)
- No badge needed on Review

---

## 7. Visual Design

### Matches /today exactly

Review uses the same typography, spacing, checkbox styles, and color palette as /today. The goal is visual continuity — the user recognizes the same list format whether they're looking at today or last Tuesday.

### Differences from /today

- **Read-only.** Checkboxes are rendered but not interactive. No hover states, no click handlers. They're visual indicators of status, not controls.
- **No capture input.** The bottom of the page is the last reflection section, not a text input.
- **No ↺ buttons.** Items cannot be rescheduled from Review.
- **No focus view.** Tapping an item does nothing. The focus view is for active items during the day, not for reviewing past items. (Future enhancement: tapping could expand to show item_notes from the focus view, but do not build this now.)
- **No "now" line.** The day is over. There is no "now."
- **Date navigation replaces Yesterday/Today/Tomorrow tabs.** The arrow + swipe navigation is the primary way to move between days.

### Typography and spacing

- Sub-nav: 13px, centered, 4px gap between items
- Day name: 16px, font-weight 600, centered
- Relative date: 12px, muted, centered
- Arrow buttons: 20px, muted color, 4px 12px padding, pointer cursor
- Section headers: 11px, uppercase, muted, letter-spacing 0.5px
- Item names: 14px (struck-through + 40% opacity for done, 40% opacity for incomplete)
- Times: 12px, muted, right-aligned
- Log timestamps: 12px, light muted (#B5B0A8), left-aligned, 44px wide
- Reflection text: 14px, normal color, line-height 1.5
- Divider: 1px, #C4725A at 20% opacity, 12px margin top and bottom
- Green checkbox fill: #5A9E6F
- Empty checkbox border: #D0CBC3
- Max width: 480px, centered

### Mood colors

| mood_energy | Label | Color |
|-------------|-------|-------|
| 5 | Great | #5A9E6F |
| 4 | Good | #5A9E6F |
| 3 | Okay | #BA7517 |
| 2 | Tough | #B8443E |
| 1 | Hard | #B8443E |

### Slide animation

- Duration: 300ms
- Easing: ease
- Direction: content slides opposite to navigation direction (tap › = content slides left, new day enters from right)
- No bounce, no overshoot. Clean slide.

---

## What NOT to Build

- No Week/Month/Quarter/Year review content (just coming-soon stubs)
- No interactive checkboxes or item editing in Review
- No focus view expansion on item tap
- No capture input on Review
- No comparison view (this week vs last week)
- No values check-in (that belongs in Week Review, future session)
- No charts, graphs, or visualizations
- No export or sharing

---

## Verification

### Navigation
- /review redirects to /review/days
- Page loads with yesterday's data by default
- ‹ arrow loads previous day, › loads next day
- › is disabled on the most recent closed day
- Swipe left = next day, swipe right = previous day on mobile
- Slide animation is smooth (300ms)
- Day label and relative date update on navigation
- Sub-nav shows Days as active, other periods link to their routes

### Day Content
- Done section shows completed action_items with green checkboxes, struck-through names, completion times
- Incomplete section shows non-completed action_items with empty checkboxes, muted names
- Logged section shows action_log entries with timestamps
- Sections are hidden when empty
- Divider appears between data and reflection sections
- Wins, Friction, Journal render from day_reflection data
- Reflection sections hidden when empty

### Read-Only
- Checkboxes are not interactive (no click handler, no cursor:pointer)
- No ↺ buttons on any items
- No capture input anywhere on the page
- No "now" line
- Tapping items does nothing

### Reopen
- "Reopen this day" link visible on closed days
- Tapping it sets plan_status='open' and redirects to /today for that date
- Days that were never closed show "Day not closed" instead

### Coming Soon Pages
- /review/week shows "Week Review — coming soon" with description
- /review/month shows "Month Review — coming soon" with description
- /review/quarter shows "Quarter Review — coming soon" with description
- /review/year shows "Year Review — coming soon" with description
- All show the sub-nav with the correct period active

### Schema
- day_reflection has wins and friction text columns
- Existing data is unaffected

### Nav
- "Review" appears in the nav bar
- Clicking navigates to /review/days