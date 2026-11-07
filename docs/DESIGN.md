# Design system — Bugetify

Visual source of truth: `docs/bugetify-design-reference.html` (exported mock). Screenshot composition: store `media/dashboard-reference.png`.

## Principles

- **Money first.** Available balance and spending pace sit above secondary panels.
- **Planned ≠ spent.** Reservations and shopping estimates never look like real expenses.
- **Bugetify chrome.** Dark navy sidebar, purple→indigo active nav, soft `dashboard-card` panels, 1.25rem radii.
- **Colour for meaning.** Brand purple for identity; cyan / emerald / amber / coral for accents and status.
- **Empty, not fake.** Missing budgets, goals, or lists get short empty states — never demo money from the HTML mock.

## Tokens

Defined as CSS variables in `src/app/globals.css`, exposed to Tailwind via `@theme inline`. No CDN Tailwind script.

| Token | Role | Dark (HTML) |
| --- | --- | --- |
| `--bg` | Page background | `#090b12` |
| `--sidebar` | Shell chrome | `#0d101b` |
| `--card` / `--surface` | Panels | `#121626` |
| `--border` | Edges | `#1f253d` |
| `--brand` | Purple identity | `#7c3aed` |
| `--brand-accent` | Lighter purple | `#8b5cf6` |
| `--radius-lg` | Card radius | `1.25rem` |

Light mode keeps the same brand hues on lifted surfaces. Theme toggle (system / light / dark) still works via `html.light` / `html.dark` + media query.

## Typography

- UI: Inter (`--font-inter`)
- Handwriting accents: Caveat (`--font-caveat` / `.font-handwriting`)
- Tabular nums on money (`.tabular`)

## Components

Shared primitives in `src/components/ui.tsx`:

- `Card` → `.dashboard-card`
- Primary buttons → `.btn-gradient` (purple→indigo)
- Active nav → `.nav-active`
- `PageHeader`, `EmptyState`, `Field`, `ListSurface`, sheets

Shell: `src/app/(app)/layout.tsx` + `src/components/nav.tsx` + sidebar theme pill.

## Copy

Romanian-first (`ro` default) with matching `en` keys. Prefer short, concrete phrasing; match HTML tone where natural (`Plan. Cumpără. Economisește.`).
