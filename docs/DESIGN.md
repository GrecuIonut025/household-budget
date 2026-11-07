# Design system

Product UI for Bugetify (household budget). Visual references for quality (not templates): Linear, Revolut, Monzo — plus the dark purple Bugetify dashboard reference.

## Principles

- **Money first.** Budget limit, spent, remaining, and pace sit above secondary panels.
- **Planned ≠ spent.** Reservations and shopping estimates never look like real expenses.
- **Dark chrome first.** Near-black canvas (`#0f0f1b`), slate cards (`#1b1b2f`), purple/indigo gradients for active nav and primary CTAs; green only for positive progress.
- **Empty, not fake.** Missing budgets, goals, recipes, or popular products get short empty states — never demo money or invented recipes.

## Tokens

Defined as CSS variables in `src/app/globals.css`, exposed to Tailwind via `@theme inline`.

| Token | Role |
| --- | --- |
| `--bg` | Page background (`#0f0f1b` in dark) |
| `--surface` | Panels, sheets, lists (`#1b1b2f` in dark) |
| `--surface-2` | Hover / selected wash, progress track |
| `--border` | Hairline dividers and panel edges |
| `--fg` / `--muted` | Primary and secondary text |
| `--brand*` / `--brand-grad-*` | Identity, active nav pill, primary actions |
| `--ok*` / `--warn*` / `--danger*` | Financial status only |
| `--sidebar*` | Left shell chrome |
| `--radius-sm/md/lg` | 10 / 14 / 18 px |

Default preference is **dark** (Bugetify reference). Light and system remain available via the theme toggle. Forced dark uses `html.dark`; forced light uses `html.light`. With neither class, `@media (prefers-color-scheme: dark)` applies dark tokens (system).

## Theme

`ThemeProvider` stores `light | dark | system` in `localStorage` and a matching `hb-theme` cookie. Missing preference resolves to `dark`. The root layout reads the cookie and sets `html.light` / `html.dark` on the server (no boot `<script>`). Sidebar uses a sun/moon pill; mobile header keeps the compact cycle control.

## Typography & spacing

- UI font: Geist. Hero quote: Caveat (`font-script`). Tabular nums on money (`.tabular`).
- Page title ~28–34 px; section labels ~13–14 px; body 14 px.
- Vertical rhythm: sections ~20–32 px apart; cards use 16–20 px padding.

## Components

Shared primitives live in `src/components/ui.tsx` and `sheet.tsx`:

- `Card`, `Section`, `PageHeader`, `Stat`, `ProgressBar`, `EmptyState`, `Badge`, `Alert`, `Field`, `Button` / `buttonClass`, `ListSurface`
- Dashboard widgets in `src/components/dashboard/*` (summary cards, progress ring, bar evolution chart, category donut, recipe promo)
- Flat sidebar nav in `src/lib/nav.ts` (Dashboard → … → Settings), plus meal planner retained

## Copy

User-facing strings are Romanian-first (`ro` default) with matching `en` keys. Brand name and tagline come from `app.name` / `app.tagline`.
