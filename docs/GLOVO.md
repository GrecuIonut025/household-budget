# Glovo Brașov → Comparare prețuri

## One command

```bash
npm run glovo:sync
```

Pure **Node** crawler (`scripts/glovo/crawl.mjs`) — no Python. Writes `glovo_data/`.
Comparare prețuri: **market → categories → subcategories → products** (paginated).

## UI flow

1. Pick Profi / Carrefour / Kaufland / Mega Image
2. Browse categories (and subcategories from crawl hierarchy)
3. Open products with images + prices; search within the market
4. Empty state: run `npm run glovo:sync` once

## Scripts

| Command | What |
| --- | --- |
| `npm run glovo:sync` | Crawl (default) → `glovo_data/` |
| `npm run glovo:crawl` | Crawl only |
| `GLOVO_CRAWL=false npm run glovo:sync` | Skip crawl |

Session headers are baked into the crawler; override in `.env.local` only when expired.
