---
name: wild-success-design
description: Use this skill to generate well-branded interfaces and assets for Wild Success, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, UI kit components, the 12 Wild Success Principles, and the Task-Oriented Design methodology.
user-invocable: true
---

## How to use this skill

**Read in this order, every time:**

1. `principles.md` — the 12 operating tenets. These dictate voice, microcopy, and what the product refuses to do.
2. `task-oriented-design.md` — Task-Oriented Design methodology. Every screen serves one task: prompt → context → action → confirmation → downstream. Also contains the canonical task flows for Meeting Cycle, Onboarding, Commitments, Chapter Formation, Funding, Special Considerations, and Chapter Split, plus entity state machines.
3. `README.md` — visual foundations: colors, type, components, iconography, copy patterns.

If `README.md` ever appears to conflict with the principles or TOD, the principles and TOD win.

If creating visual artifacts (slides, mocks, throwaway prototypes), copy assets out and create static HTML files. If working on production code in the wildsuccess repo, copy assets and apply the rules to write code in the system's voice and patterns.

If invoked without specific guidance, ask the user what they want to build. Then ask follow-up questions framed in TOD terms ("what's the trigger?", "what task is this?", "what's the downstream effect?").

## File map

- `principles.md` — 12 operating principles + design implications + voice consequences
- `task-oriented-design.md` — full TOD spec including 7 task flows, state machines, data model, screen patterns
- `README.md` — visual foundations and content fundamentals
- `colors_and_type.css` — drop-in CSS variables for colors, type, spacing, radii, shadows; semantic classes (.ws-h1, .ws-body, etc.)
- `assets/` — wordmark (apex lockup), avatar bubble, values mind-map placeholder
- `preview/` — small visual specimens (one concept per card)
- `ui_kits/web-app/` — pixel-faithful recreation of the app: Navbar, TodayPage, MapPage, QuickCapture, EditValueModal, Item

## Quick rules (visual)

- Single family: **Source Sans 3** (Google Fonts).
- Primary: burnt terracotta `#B8552E`. Secondary blue `#4B82AF`. Page bg warm-white `#FAFAF7`. Cards `#FFFFFF`.
- Sentence case everywhere. No exclamation points. No emoji-as-decoration.
- Quiet, paper-like density: 10px nav, 13px body, 16px modal title.
- 8px button/input radius, 12px toast, 16px modal, 28px capture pill.
- Lucide icons via CDN — no other icon set.
- No gradients on backgrounds. No full-bleed photography. No hero illustrations.

## Quick rules (voice & behavior — from principles + TOD)

- **Confirmations name the consequence.** Not "Success!" — "Meeting scheduled. RSVPs will go out to 7 members."
- **No silent system actions.** Every effect is attributable to a user action. Principle 5: agency like air.
- **Show primary data before summary.** Principle 3: don't aggregate before the user has seen the source.
- **No streaks, badges, levels, scores.** Principle 6: growth is consequence, not goal. Reputation reads from real interactions.
- **Surface defection fast.** Disputed commitments, missed RSVPs, ignored requests are visible — not buried. Principle 7.
- **One task per screen.** TOD Part I. If a screen does two things, split it.
- **Every task has a downstream.** What does completing this trigger? Tell the user. Create the PendingTask.
