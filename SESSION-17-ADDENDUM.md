# SESSION 17 — Addendum: Compact Active Outcomes bar

This addendum **replaces section 4 (`/organize` Page Changes)** in `SESSION-17-PROMPT.md`. Everything else in that prompt stands.

---

## 4. `/organize` Page Changes (revised)

**Do not touch the hopper's internal structure, the grid, the summary panel, the block palette, or any existing drag/drop logic.**

Add one new element: a **compact, single-row Active Outcomes bar**.

### 4a. Placement and structure

Insert the bar between the block type palette and the main body (Hopper + Grid + Summary). It is a single horizontal row, always visible (no expand/collapse toggle), the same vertical weight as a thin sub-header — about 28–32px tall.

Layout, left to right:

1. A small section label: `OUTCOMES` — 10px, uppercase, letter-spacing 0.5px, color `#8A857D`. Flex-shrink 0.
2. For each active Big Outcome, an inline item consisting of:
   - The BO name in regular weight, 12px, color `#2D2A26`.
   - Immediately followed (same line, with a small gap) by a `Nudge →` link, 12px, color `#4B6A82`, cursor pointer.

Items are separated by horizontal whitespace (gap ~14px). The row uses `flex-wrap: wrap` so it gracefully handles many BOs by wrapping to a second line if needed — but the default expectation is one line.

No cards, no borders around individual items, no status text, no nudge counts, no buttons with backgrounds. This is a quiet inline list, not a panel.

Background: `#FBFAF6` (very subtle warm tint to distinguish from the palette above and the body below). Border-bottom: `1px solid #E8E4DC`. Padding: `6px 18px`.

### 4b. Closed/recently-closed outcomes

If a Big Outcome was closed within the last 7 days (any closure type other than `delete`), show it in the bar with:

- Strikethrough on the name, color `#8A857D`.
- A small inline note immediately after the name in 10px, color `#5A9E6F` for accomplished/declared_complete, or `#8A857D` for abandoned: e.g., `accomplished Apr 9`.
- No `Nudge →` link.

After 7 days the closed BO drops off the bar entirely. (It still lives on the Markers strip on /map.) This gives the user a brief visible acknowledgment of recent closures in the very surface where they'd normally encounter the BO during weekly planning, without polluting the bar long-term.

### 4c. Nudge interaction

Clicking `Nudge →` on an outcome opens a small inline single-line text input (anchored to that outcome's position in the bar — a popover or expanding inline field, your choice; popover is simpler and probably better). The input:

- Auto-focuses.
- Placeholder: `Nudge: …`
- Enter submits, Escape cancels, blur cancels.
- On submit, calls `POST /api/big-outcomes/:id/nudge` with `{ name: <input value>, time_type: 'B' }`.
- On success: closes the input, refreshes the hopper data (call `loadData()` or its hopper subset), and shows a brief toast: `Added to hopper.`

No multi-field form, no time_type picker, no duration estimate. The nudge is meant to be a thought captured in 3 seconds. The user can refine the resulting hopper item later if needed.

### 4d. Loading

Fetch active BOs as part of the existing `loadData()` flow in `OrganizeWeekModal`. The component already fetches `outcomes` — extend that fetch (or its handling) to also include closed BOs from the last 7 days, so the strikethrough rendering works without a second query. Filter to `status IN ('aspirational', 'in_progress')` for active items, plus any BO with `closed_on >= today - 7 days` for the recent-closure tail.

### 4e. What this bar is NOT

- Not a card grid. Not a panel. Not a hopper section. Not collapsible.
- Does not show status, target dates, nudge counts, value links, or any metadata beyond the name and (for recently closed) the closure note.
- Does not include COAs, missions, activities, or anything else.
- Does not auto-commit BO-linked items. Nudge creates a candidate; the user drags it to the calendar to commit, like any other hopper item.
- Does not include `Close…` here. Closure lives only on /map. The bar is for active engagement during weekly planning, not for ending things.

### 4f. Hopper provenance line (unchanged from original prompt)

When a hopper item is linked to a Big Outcome (via `big_outcome_id`), show a small provenance line under the item name in the hopper card: `↳ <BO name>`, 9px, color `#8A857D`. This is the only change to the hopper itself, and it applies whether the linkage came from a nudge or from any other source that sets `big_outcome_id`.

---

## Completion criteria (revised for section 4)

In addition to the original session's criteria, verify:

- The Outcomes bar appears as a single thin row between the palette and the body.
- Active BOs are listed inline as `Name Nudge →` pairs, no cards, no borders.
- Clicking `Nudge →` opens a single-line input, submits with Enter, creates a candidate action_item with `big_outcome_id` set, refreshes the hopper, and shows the toast.
- A BO closed today appears struck-through with `accomplished <date>` (or the appropriate closure note) and no Nudge link.
- A BO closed 8+ days ago does not appear in the bar at all.
- Hopper items linked to a BO show the `↳ <BO name>` provenance line.
- All other /organize behavior is unchanged.