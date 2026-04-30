# Wild Success — Web App UI Kit

A pixel-faithful recreation of the Wild Success Next.js app: navbar, Today screen, Map screen, Quick-capture pill, and a representative modal. Built from `nathanotto/wildsuccess` (Next.js 16, React 19) — values, type, and component patterns lifted directly from `app/globals.css`, `app/layout.tsx`, `components/QuickCapture.tsx`, `components/TodayPage.tsx`, `components/MapPage.tsx`.

## Files

- `index.html` — interactive demo. Click tabs to switch between Today / Map. Use the Quick Capture pill to add an item. Click an item to open the edit modal.
- `Navbar.jsx` — sticky 41px nav with brand wordmark, six tabs (10px Source Sans 3 700), badges, "2 overdue" link, profile avatar.
- `TodayPage.jsx` — single narrow column. Sections: "Now / Next 2h / Today / Later". Item rows with checkbox states.
- `MapPage.jsx` — values mind-map (SVG) — center node + satellites with hand-drawn-feeling edges.
- `QuickCapture.jsx` — fixed pill at `bottom: 24px`, expands on focus. Inert when modal open.
- `EditValueModal.jsx` — representative modal: scrim, 16px radius card, label + input + radio + footer buttons.
- `Item.jsx`, `Checkbox.jsx`, `Chip.jsx`, `Button.jsx` — reused atoms.

## What this kit cuts corners on

- No real persistence. Items live in `useState`.
- No real auth. The avatar is decorative.
- Map is a static SVG with no dragging or layout engine.
- Plan / Communicate / Review / Spending tabs are stubs.

## Visual fidelity

All colors come from `colors_and_type.css` at the project root via `<link rel="stylesheet">`. Source Sans 3 is loaded from Google Fonts. Lucide icons via CDN (`unpkg.com/lucide@latest`).
