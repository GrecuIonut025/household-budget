# Glovo Brașov price catalog

## Happy path (what you usually want)

1. Copy into **repo-root** `.env.local` (same defaults are baked into the crawler if unset):

```
GLOVO_CRAWL=true
GLOVO_DEVICE_URN=glv:device:532b00e8-cabe-4f75-9e60-a3a308d051b7
GLOVO_DYNAMIC_SESSION_ID=27033905-1c94-43f3-9fe1-94f9d7aeea1d
GLOVO_PERSEUS_CLIENT_ID=6381b7ca-82c2-4a38-b6b4-cd0ebc007dd8
GLOVO_PERSEUS_SESSION_TIMESTAMP=1794101426023
GLOVO_DELIVERY_LOCATION_TIMESTAMP=1794101431447
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
