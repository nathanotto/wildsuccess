# Today Page Redesign — Handoff Notes

This folder hands off a redesign of `components/today/TodayPage.tsx`. The mocks in this folder render against the same data shape as the real page; treat them as the target.

**Files**
- `today-proposed.jsx` — target design
- `today-current.jsx` — current design as a mock, for diff reference
- `data.js` — shared data shape (matches real `Action_item` fields)
- `notes.md` — this file

---

## Design intent

The Today page's job is **to model today and stay in agreement with reality**. The user moves freely between three modes:
1. **Orient** — read the model, locate yourself in it.
2. **Update** — capture, schedule, defer, complete, note.
3. **Rest** — recognize all is well; do nothing.

Most productivity apps refuse to let users do nothing. This one has to.

## The eight changes (apply in this order, smallest first)

### 1. Remove the stats line
"4 done · 3 scheduled · 11 to-do" — delete it. Precise without being useful; the columns themselves are the count.

### 2. Promote "Next up"
Currently buried on line 4 of the header. Treatment:
- 2px terracotta left rule (`var(--ws-primary)`)
- Eyebrow label "NEXT UP" — 10px / 700 / tracked / uppercase / terracotta
- Time in muted grey, name in 15px / 600 ink
- Sits **above** the columns, not inline with the schedule

It earns the only real accent on the page because it reads from pure data (`scheduled_time` + `nowTime`) — no guessing.

### 3. Vision-board treatment for week intent
- **Full text, no truncation.** Never ellipsize.
- 2px terracotta left rule, 14px indent
- Regular weight (not italic — italic on long text is fatiguing)
- Color `#3D3933`, line-height 1.55, max-width ~820px
- Calm, present. The intent endures for one week and reads like a vision board.

### 4. Equal-weight columns
**Critical.** Scheduled (left) and to-do (right) are the **same pool**, stacked for column balance on desktop. They collapse to one column on mobile. Time-pinning is a property of an item, not a tier.

- Remove any visual divider between the columns
- Same row height, same type weight, same checkbox treatment
- Do **not** style scheduled items as more important than unscheduled

### 5. Bounded aging on to-do items
Aging is a feature for finding deferred items, but it must not become a guilt curve.

- `capturedAgo <= 1` day → full color (`#2D2A26`), full weight
- `capturedAgo >= 2` days → step down once to `#5C5750`
- **Floor at one step.** Items older than 7 days look identical to items 2 days old. No further fading, ever.

Verify: an item with `capturedAgo: 90` must render at the same weight/color as one with `capturedAgo: 2`.

### 6. In-progress glow
The user marks `[x] in_progress` to draw their eye to the current task. Lean into this:

- Background tint: `#FDF6F3` at ~60% opacity
- 2px terracotta left rule (inset, on the row itself)
- Title weight bumps from 400 → 500
- Apply to both columns equally

### 7. Hairline above THIS WEEK
Add a 1px `var(--ws-border-faint)` rule above the THIS WEEK section. Keep its faded type treatment — that's a feature, not a bug. THIS WEEK items are *system suggestions*, not commitments. They should feel available, not demanded.

### 8. "Close the day" affordance
Quiet bottom-of-page row, always available (not time-gated):
- 1px top border
- Small moon glyph + label "Close the day"
- Muted text color
- Cursor pointer

Tapping should route to a dedicated close-out flow (separate task screen, full TOD shape — design later). For now, stub the route.

---

## Hard guardrails

1. **Do not modify the FROM YESTERDAY function** (yesterday's-unfinished prompt). It already works. Leave behavior and design alone.

2. **Equal-weight columns means equal-weight.** This is the most-important constraint. Minimizing scheduling without deprioritizing is a core feature — preserves flow.

3. **Bounded aging has a floor.** Test with `capturedAgo: 90`. If it looks fainter than `capturedAgo: 2`, the implementation is wrong.

4. **No new colors.** Use existing tokens from `app/globals.css`. The terracotta is `var(--ws-primary)` (`#C4725A`); the warm tint is `var(--ws-selected-bg)` (`#FDF6F3`).

5. **No house-cat behavior.** Don't auto-prioritize, auto-rerank, or guess what the user wants. All contrast is typographic + spatial, derived from data the user already provided.

---

## Workflow

1. Read `today-current.jsx` and `today-proposed.jsx`. Diff them mentally — most changes are isolated.
2. Read `components/today/TodayPage.tsx` and summarize its structure to me. Don't change code yet.
3. Propose a diff plan ordered smallest-first. Stop and wait for approval.
4. Apply changes **one at a time**, in **separate commits**. After each, show diff + rationale + what to verify in the running app. Wait for "next" before moving on.
