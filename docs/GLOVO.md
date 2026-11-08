# Glovo Brașov price catalog

## Happy path (what you usually want)

1. Put Glovo session headers + `GLOVO_CRAWL=true` in **repo-root** `.env.local`:

```
GLOVO_DEVICE_URN=glv:device:...
GLOVO_DYNAMIC_SESSION_ID=...
GLOVO_PERSEUS_CLIENT_ID=...
GLOVO_PERSEUS_SESSION_TIMESTAMP=...
GLOVO_DELIVERY_LOCATION_TIMESTAMP=...
COOKIE=...
GLOVO_CRAWL=true
```

2. Run:

```bash
npm run glovo:sync
```

(or `npm run glovo:crawl` for crawl only)

3. Open **Comparare prețuri** — the UI reads `glovo_data/all_products.json` directly.
   You do **not** need `SUPABASE_SERVICE_ROLE_KEY` just to see products.

Session headers expire. Refresh them from DevTools → Network on a logged-in
[glovoapp.com](https://glovoapp.com) Brașov supermarket request when crawl fails.

---

## Stores

| Key | Store slug | UI name |
| --- | --- | --- |
| `profi` | `profi-brv` | Profi |
| `carrefour` | `carrefour-supermarket-brv` | Carrefour |
| `kaufland` | `kaufland-brv-bo` | Kaufland |
| `mega_image` | `mega-image-brv` | Mega Image |

Additive to Lidl XLSB / Monitorul Prețurilor.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run glovo:crawl` | Live crawl → `glovo_data/` |
| `npm run glovo:sync` | Crawl when `GLOVO_CRAWL=true\|1\|yes`; optional DB import if service role is set |
| `npm run glovo:import` | Upsert JSON into Supabase (needs service role) |
| `npm run predev` | Background sync on `next dev` (respects `GLOVO_CRAWL` from `.env.local`) |

Set `GLOVO_SYNC_ON_DEV=0` to skip the predev hook.

`glovo:sync` / `import` / `crawl` load `.env.local` then `.env` automatically.

## Optional Supabase import

Migration `20261110000000_glovo_brasov_catalog.sql` seeds sample rows and defines
`glovo_markets` / `glovo_products` (RLS: select for anon/auth; writes via service_role).

If `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are in `.env.local`,
`npm run glovo:sync` also upserts after crawl. Missing service role only skips import —
the crawl and local JSON UI still work.

```bash
npm run glovo:sync -- --debug-env
```

## Cloud / CI note

Live Glovo API calls are often blocked from cloud VMs. Prefer a developer-machine
`glovo_data/all_products.json`, or `fixtures/glovo/all_products.json` for demos.
