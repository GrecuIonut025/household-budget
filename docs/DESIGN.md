# Design system

Product UI for the household budget app. Visual references for quality (not templates): Linear, Revolut, Monzo, Notion.

## Principles

- **Money first.** Available balance and spending pace sit above secondary panels.
- **Planned ≠ spent.** Reservations and shopping estimates never look like real expenses.
- **Restrained chrome.** Subtle borders, limited radius, no glassmorphism, no decorative icons, no nested cards.
- **Colour for meaning.** Brand teal for identity; green / amber / red only for financial status.
- **Empty, not fake.** Missing budgets, goals, or lists get short empty states — never demo money.

## Tokens

Defined as CSS variables in `src/app/globals.css`, exposed to Tailwind via `@theme inline`.

| Token | Role |
| --- | --- |
| `--bg` | Page background |
| `--surface` | Panels, sheets, lists |
| `--surface-2` | Hover / selected wash, progress track |
| `--border` | Hairline dividers and panel edges |
| `--fg` / `--muted` | Primary and secondary text |
| `--brand*` | Identity and primary actions |
| `--ok*` / `--warn*` / `--danger*` | Financial status only |
| `--radius-sm/md/lg` | 6 / 10 / 14 px |

Light is the default on `:root`. Dark overrides live under `html.dark`.

## Theme

`ThemeProvider` (`src/components/theme-provider.tsx`) stores `light | dark | system` in `localStorage` (`hb-theme`). Default is **system** (`prefers-color-scheme`). An inline boot script in the root layout applies the class before paint to avoid a flash. Toggle: header (compact) and Household → Appearance.

## Typography & spacing

- Font: Geist (existing). Tabular nums on money (`.tabular`).
- Page title ~20–22 px; section labels ~13 px muted; body 14 px.
- Vertical rhythm: sections ~32 px apart; cards use 16–20 px padding.

## Components

Shared primitives live in `src/components/ui.tsx` and `sheet.tsx`:

- `Card`, `Section`, `PageHeader`, `Stat`, `ProgressBar`, `EmptyState`, `Badge`, `Alert`, `Field`, `Button` / `buttonClass`, `ListSurface`
- Sheets for forms (mobile bottom sheet, desktop dialog)
- Navigation groups in `src/lib/nav.ts`: Overview · Finances · Shopping · Food · Household

## Copy

User-facing strings are Romanian-first (`ro` default) with matching `en` keys. Prefer short, concrete phrasing over marketing language.
