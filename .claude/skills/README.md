# Wild Success Design System

> A personal & collaborative app for planning, doing, and accomplishing — aligning values, needs, priorities, and actions.

Wild Success is a values-driven productivity app. It helps a person identify their values and life domains, set "big outcomes," then translate those into recurring activities, daily lists, and weekly plans. Capture is frictionless ("Capture something…" floats at the bottom of every page), the visual model is a hand-drawn-feeling **mind map** of values and life domains, and the operational model is a **hopper → schedule → log** pipeline. A separate **Plan** module supports collaborative mission planning across multiple users.

---

## Read these first

Before touching any visual decision, read in this order:

1. **`principles.md`** — the 12 operating tenets that shape voice, microcopy, and what the product refuses to do (no streaks, no badges, no silent system actions). Voice flows from these.
2. **`task-oriented-design.md`** — the design methodology. Every screen serves *one task* with: prompt → context → action → confirmation → downstream. Don't build a screen, build a task. The TOD spec also contains the canonical task flows (Meeting Cycle, Onboarding, Commitment Lifecycle, Chapter Formation, Funding, Special Consideration, Chapter Split) and the entity state machines.
3. **`README.md`** (this file) — the visual foundations: tokens, type, components, iconography. Implements the principles and TOD; doesn't override them.

If a visual choice in this README ever conflicts with `principles.md` or `task-oriented-design.md`, **the principles and TOD win**. Update this file to match.

---

## Source materials reviewed

| Source | Where | What we used |
| --- | --- | --- |
| `nathanotto/wildsuccess` (Next.js 16, React 19, TS) | `app/`, `components/`, `app/globals.css`, `app/layout.tsx` | Live color tokens, type scale, all component patterns, modal pattern, navbar, capture, today/map screens. Source of truth for this system. |
| `nathanotto/wildsuccess` `_docs/` | `Wild Success Principles.md`, `TASK-ORIENTED-DESIGN.md`, `MAP-MODULE-SCHEMA-non-technical.md` | Voice, content vocabulary, principles, domain model. |
| `nathanotto/wildsuccess` `CODEBASE-SNAPSHOT.md` | repo root | Authoritative token table; reproduced verbatim below. |
| `nathanotto/Wild-Success` (legacy Rails app, 2010) | repo root | Historical context only — current design supersedes. |

The reader is **not** assumed to have access to either repo. All values used in this system are captured directly in `colors_and_type.css`, `assets/`, and the UI kit components.

---

## Index

```
.
├── README.md                  ← this file (visual foundations)
├── principles.md              ← 12 operating tenets — read first
├── task-oriented-design.md    ← TOD methodology + canonical task flows
├── SKILL.md                   ← Agent SKILL invocation contract
├── colors_and_type.css        ← all CSS variables (color, type, radii, shadow, spacing)
├── fonts/                     ← Source Sans 3 (loaded via Google Fonts CDN; see notes)
├── assets/
│   ├── wordmark.svg           ← apex lockup — "wild" over ridge over "success", burnt orange
│   ├── avatar-bubble.svg      ← user-initial avatar bubble
│   ├── value-node.svg         ← values-map node placeholder
│   └── icons/                 ← lucide-react is the in-app set; SVGs copied for offline use
├── preview/                   ← Design System cards (registered via register_assets)
│   ├── colors-primary.html
│   ├── colors-text.html
│   ├── colors-surface.html
│   ├── colors-semantic.html
│   ├── type-family.html
│   ├── type-scale.html
│   ├── type-weights.html
│   ├── radii.html
│   ├── shadows.html
│   ├── spacing.html
│   ├── buttons.html
│   ├── inputs.html
│   ├── checkbox-states.html
│   ├── chips.html
│   ├── badges.html
│   ├── modal.html
│   ├── toast.html
│   ├── quick-capture.html
│   ├── nav-bar.html
│   ├── logo.html
│   └── principles.html
└── ui_kits/
    └── app/
        ├── README.md
        ├── index.html         ← clickable Today/Map/Capture prototype
        ├── NavBar.jsx
        ├── TodayList.jsx
        ├── ValueMap.jsx
        ├── EditValueModal.jsx
        ├── QuickCapture.jsx
        ├── ContextChips.jsx
        └── tokens.js
```

---

## Product surfaces

The codebase contains **one product** with several modes (tabs). All share one design system.

| Tab | Path | Purpose |
| --- | --- | --- |
| **Map** | `/map` | Mind map of values (or life domains) with sufficiency scores. Source of truth for what matters. |
| **Today** | `/today` | A small daily list. Capture, schedule, complete, reflect. Mood + wins/friction at end of day. |
| **Organize** | `/organize` | Hopper → week. Triages captured items into a scheduled week. |
| **Plan** | `/plan` | Collaborative mission planning. Multi-user. Factors, COAs (Courses of Action), commitments, arrange. |
| **Review** | `/review` | Reflect on day/week/month/quarter/year. |
| **Communicate / Spending** | — | Coming soon stubs in the navbar. |

The **Plan** module is multi-user (mission collaborators); everything else is personal.

---

## Designing in TOD

Wild Success uses **Task-Oriented Design** (full spec in `task-oriented-design.md`). Before designing or building any screen, answer:

1. **What task is this?** Name it as a verb — "Schedule next meeting", "Confirm commitment completion", "Validate meeting for donor reporting."
2. **Who's the actor?** One role per screen.
3. **What's the trigger?** A user action, a time-based event, or a downstream effect of another task.
4. **What context does the actor need?** List it — exactly enough to decide. No more.
5. **What's the action?** One primary; secondary actions visible but not competing.
6. **What's the confirmation?** Name the consequence and the downstream. "Scheduled. 7 members will be notified" — not "Success."
7. **What does this trigger?** The downstream tasks that get queued for other actors.

Every screen renders as: **prompt → context → action → confirmation/feedback**. If a screen does two tasks, split it.

State transitions are governed by the state machines in `task-oriented-design.md` Part III (Meeting, Commitment, User, Chapter). Don't invent new states; extend the spec.

---

## Content fundamentals

Wild Success copy is **plain, direct, practical, second-person**. It treats the user as an adult planning their life — not a customer being marketed to. Voice flows from `principles.md`.

**Tone**

- Quiet, grounded, slightly philosophical. The product believes in agency ("people need agency like they need air") and primary data over abstraction.
- Sentence-case for everything. Headings, buttons, menu items. **Never Title Case Like This.**
- No exclamation points. No hype. No emoji-as-decoration (one or two functional emoji only — see Iconography).
- Short labels. The navbar is six one-word verbs: Today, Organize, Plan, Communicate, Review, Spending.

**Voice & pronouns**

- Second person ("Capture something…", "Pick up later…", "what's next?").
- Lowercase microcopy is common ("cancel", "saving…", "add note…", "what's next?"). Lowercase is intentional — feels like a journal, not an interface.
- Prompts use ellipses to signal an open input ("Capture something…", "or type 2:30p").
- Button labels are first-person verbs from the user's POV when an action is final ("→ It is done", "→ Done, needs follow-up", "⌫ Delete like it never happened").

**Vocabulary** (use these exact words)

- **Capture** (not "add", "create"). The hopper accepts captures.
- **Hopper** — inbox of un-triaged captures.
- **Big outcome** — long-arc goal. Belongs to a life domain.
- **Activity** — a recurring or one-time template. Activities serve values.
- **Value** + **Sufficiency mark** + **Sufficiency score** — current vs. target on a 1–10 scale.
- **Life domain** — a category of life (Work, Health, Household, Rhythm, Finance, Social, Growth).
- **Promotional** vs **preventive** values — values you grow toward vs. values you protect.
- **Action item** — an item on Today's list. Has a `status` (committed / in_progress / completed / parked / skipped).
- **Schedule** (verb) — assign a time. **Park** — set aside until a specific date. **Skip** — "something changed."
- **Mission** — a collaborative plan in the Plan module. **COA** = Course of Action.
- **Commit** / **Re-commit** — soft scheduling language.

**Examples (verbatim from the codebase)**

- Capture placeholder: `Capture something…`
- Empty Today list: (no copy — the screen just shows the capture bar)
- Step input: `what's next?` / `add step…`
- Done button: `→ It is done`
- Park button: `→ Pick up later…`
- Done-with-followup: `→ Done, needs follow-up`
- Skip: `✕ Something changed`
- Delete: `⌫ Delete like it never happened`
- Day-closed: `Day closed` · `Drained / Tough / Okay / Good / Great`
- Mission collaborator banner: "You have mission access. Request full access to unlock your personal Map, daily view, and more."

---

## Visual foundations

Wild Success is **warm, paper-like, and low-contrast**. The vibe is a moleskine notebook on a wooden desk — not a SaaS dashboard. There is essentially no chrome.

**Background & surfaces**

- App background is `#FAFAF7` (warm bone-white). All cards and modals are pure `#FFFFFF`. Secondary surfaces shift slightly warmer (`#F8F7F4`, `#F0EDE6`).
- **No full-bleed photography. No hero illustrations. No gradients on backgrounds.** Pages are flat warm-white with content laid directly on top.
- The values map and life-domain map are SVGs with subtle hand-drawn-feeling curves connecting nodes. Nodes are solid-fill circles with thin warm-grey strokes.

**Color**

- A single accent — **burnt terracotta `#B8552E`** — used for the brand name, primary buttons, active tabs, focus borders, links, and the user-avatar bubble. (The earlier codebase used a lighter `#C4725A`; this system has been retuned darker per brand direction — update the app's `globals.css` to match.) No purple/blue gradients. No bright color chip systems.
- One muted-blue secondary `#4B82AF` used very sparingly for "Connect Calendar" and the schedule confirm button.
- Greens (`#5A9E6F`) and reds (`#C4504A`) only as semantic states; never decorative.
- Backgrounds for state surfaces are extremely tinted: `#FDF6F3` selected, `#FDF5F4` error, `#F4FDF7` success — almost imperceptible washes, not bold backgrounds.

**Typography**

- One family: **Source Sans 3** (300/400/500/600/700) loaded from Google Fonts. Set on `body` via inline `fontFamily`.
- The body has `zoom: 1.2` applied globally — design at the small sizes below and the browser scales.
- Tiny by default. The whole nav is `10px / fontWeight 600`. Body is `13px`. The biggest thing on most screens is a `16px / 700` modal header. There is no display type.
- Letter-spacing only on uppercase eyebrows: `letterSpacing: 0.5–1` with `textTransform: uppercase`, color `#8A8578`.

**Borders & dividers**

- `1px solid #F0EDE6` for navbar bottom, dividers, list separators.
- `1px solid #E8E4DC` for input borders, modal borders.
- `1.5px solid #B8552E` only when an input is focused or a checkbox is mid-state.
- Dividers in menus: `height: 1, background: #F0EDE6, margin: 2px 0`. Hairline.

**Corner radii**

- `4px` — small pills (time pills, schedule pills).
- `5px` — nav tab buttons.
- `6–8px` — inputs, dropdown menu items, secondary buttons.
- `8px` — primary buttons, list cards.
- `10–12px` — toast, quick-capture inner.
- `16px` — modals.
- `20–28px` — quick-capture pill (full pill shape).
- Avatars and progress dots are perfect circles (`borderRadius: '50%'`).

**Shadows**

- Modal: `0 8px 32px rgba(45,42,38,0.12)`. Soft, warm, never blue.
- Dropdown menu: `0 4px 16px rgba(45,42,38,0.10)`.
- Quick-capture default: `0 2px 12px rgba(45,42,38,0.10)`.
- Quick-capture focused: `0 4px 24px rgba(196,114,90,0.18)` — accent-tinted.
- "was: …" undo confirmation: `0 0 8px rgba(90,158,111,0.4)` — green glow.
- **No inner shadows. No multi-layered elevation. Every shadow is one warm umber drop.**

**Backdrops**

- Modals overlay: `rgba(45,42,38,0.25)` + `backdropFilter: blur(2px)`. The blur is light — content underneath remains legible.

**Spacing**

- Vertical rhythm is small: 4 / 6 / 8 / 10 / 12 / 16 / 20 / 24 / 28. The screen feels dense.
- Horizontal padding on the navbar is `8px 20px`. Modal interior is `32px 36px`. Section spacing inside modals is `marginBottom: 16` for fields, `20` for a section break.

**Animation**

- Almost none. The only animations in the codebase:
  - QuickCapture pill grows from 320 → 440px wide on focus: `transition: width 0.2s ease`.
  - Border + shadow on the same pill cross-fade: `transition: all 0.2s ease`.
- No bounces, no springs, no scale-on-hover, no parallax. Hover states are color/background swaps only.

**Hover states**

- Tabs: background goes `transparent → #F8F7F4`, border tints `#F0EDE6 → #B8552E40`. Color stays.
- Buttons: primary stays solid; secondary swaps background to `#F8F7F4`.
- List items in menus: background swap to `#F8F7F4`.
- Links: underline appears (text color stays terracotta).

**Press states**

- No translateY. No scale. Disabled state: `opacity: 0.5` + `cursor: default`. "Saving…" replaces button label inline.

**Transparency & blur**

- Used **once**, on the modal backdrop (above). Otherwise opaque everywhere.
- Tints for "selected" / "error" / "success" surfaces are not transparency — they're solid pale colors.

**Cards**

- Cards = `background: #FFFFFF`, `border: 1px solid #E8E4DC` (or `#F0EDE6`), `borderRadius: 8–16`, no shadow at rest. Padding `12px 16px` for compact, `32px 36px` for modals.
- Cards never have a colored left-border accent. They never have a colored gradient header.

**Layout**

- App has a **sticky 41px navbar** (`padding: 8px 20px`, `position: sticky, top: 0`). Content starts immediately under it.
- The Today screen is a **single narrow column** centered on the page. The Map screen is a centered SVG that fills available space. Neither uses sidebars.
- Quick-capture is a **fixed pill at `bottom: 24px, left: 50%`**, centered. It hides when modals are open.
- Modals are centered, `maxWidth: 400–520`, `width: 90%`, `maxHeight: 90vh`.

**Imagery**

- The product is essentially imageless. The only visual elements are SVG mind-map nodes, the wordmark in nav, user-initial avatar bubbles, and lucide icons. No stock photography, no illustrations, no patterns or textures.

---

## Iconography

**Primary system: [lucide-react](https://lucide.dev/) v0.577** (in `package.json`).

- Used inline as React components — `<Trash2 size={12} />`, `<X size={18} />`, etc.
- Stroke style: `1.5–2px`, `currentColor`, `linecap: round`, `linejoin: round`.
- Sizing: `12px` in lists, `14–18px` in buttons, `24px` max in modal headers.
- Color: inherits from text. Muted-grey `#8A8578` is the default; terracotta only when active.

**For this design system:** lucide is loaded via the `unpkg` CDN in the UI kit demos. Substituting an offline copy is trivial — the package ships a single ESM bundle.

**Inline SVG icons in the codebase**

A few one-off icons are written as inline SVG (e.g. the trash icon on a step row in TodayPage.tsx). These follow lucide's stroke style verbatim. We've copied the wordmark and a few decorative SVGs into `assets/`.

**Unicode glyphs**

Used as lightweight icons because they tone-match the text:

- `+` — capture / add (in QuickCapture, "+ Connect Google Calendar")
- `×` (multiplication sign) and `✕` — close, dismiss, skip
- `✓` — completed checkbox
- `✦` — "take action" suggestion bullet
- `→` — primary verb prefix on Today actions ("→ It is done", "→ Pick up later…")
- `⌫` — delete-permanent
- `↺` — un-commit / reschedule
- `⏱` — schedule
- `▼` / `▶` — collapse/expand sections
- `←` — back navigation ("← today")
- `☰` — mobile hamburger

**Emoji**

Two functional emoji appear in the codebase:

- `📅` in TakeActionBox to flag overdue activities.
- The mood-picker labels use names ("Drained / Tough / Okay / Good / Great"), not emoji.

That's it. Emoji are not used as decoration anywhere else.

**No icon font.** No SVG sprite. No custom Wild Success icon set. If you need an icon: reach for lucide, then a unicode glyph, then a one-line inline SVG matching lucide's stroke style — in that order. Never substitute an emoji for an icon, never use a heavier-stroke or filled icon set (Heroicons solid, FontAwesome, Material) — they break the paper-quiet mood.

**For prototypes in this system:** load lucide via CDN with `<script src="https://unpkg.com/lucide@latest"></script>` then `lucide.createIcons()`, OR use inline SVG matching lucide's specs (`stroke-width="2"`, `stroke-linecap="round"`, `stroke-linejoin="round"`, no fill).er.

---

## Caveats / open items for iteration

- **No font files were available** in the repo — Source Sans 3 is loaded from Google Fonts. If self-hosting matters, request the WOFF2 files for weights 300/400/500/600/700.
- **No real product imagery** exists in the codebase. The UI kit reflects this faithfully (no hero images, no illustrations) but the user may want to introduce a small set of illustrations/textures for marketing surfaces — this would be a deliberate addition, not a recreation.
- The **Plan** module has its own dense screens (ArrangePage, COAsPage, etc.) which I have **not** included in the UI kit — those would need a second pass.
- The codebase has **no Tailwind classes in actual use** despite Tailwind being installed; everything is inline `React.CSSProperties`. The UI kit follows this pattern.
