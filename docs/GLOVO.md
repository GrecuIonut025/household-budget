# Glovo Brașov → Comparare prețuri

## One command (Windows / macOS / Linux)

```bash
npm run glovo:sync
```

Uses pure **Node** (`scripts/glovo/crawl.mjs`) — no Python, no Git Bash crawl script, no `.env.local` headers required (defaults baked in). Writes `glovo_data/all_products.json`; Comparare prețuri reads that file.

Session expired later? Paste fresh headers into `.env.local` (optional overrides) and re-run.

## Scripts

| Command | What |
| --- | --- |
| `npm run glovo:sync` | Crawl (default) → `glovo_data/`; optional Supabase import |
| `npm run glovo:crawl` | Crawl only |
| `npm run glovo:import` | Optional DB upsert (needs service role) |
| `GLOVO_CRAWL=false npm run glovo:sync` | Skip crawl |

Legacy bash+Python script remains at `scripts/glovo/crawl-brasov.sh` but is not used by npm scripts.

## Stores

Profi, Carrefour, Kaufland, Mega Image — Brașov (`brv`) only.
