# Glovo Brașov price catalog

Local-first supermarket catalog for **Comparare prețuri**, scoped to Brașov (`brv`) only:

| Key | Store slug | UI name |
| --- | --- | --- |
| `profi` | `profi-brv` | Profi |
| `carrefour` | `carrefour-supermarket-brv` | Carrefour |
| `kaufland` | `kaufland-brv-bo` | Kaufland |
| `mega_image` | `mega-image-brv` | Mega Image |

This source is **additive**. Lidl XLSB and Monitorul Prețurilor adapters are unchanged.

## Schema

Migration `20261110000000_glovo_brasov_catalog.sql`:

- `glovo_markets` — the four Brașov stores (seeded)
- `glovo_products` — catalog rows upserted by `(retailer_key, identity_key)`
- RLS: `authenticated` / `anon` **select**; writes via `service_role` (importer)

Sample products are seeded so the UI works before a live crawl.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run glovo:crawl` | Full Glovo API crawl → `glovo_data/*.json` + CSV (slow) |
| `npm run glovo:import` | Upsert JSON into Supabase |
| `npm run glovo:sync` | Import from `glovo_data/` or `fixtures/glovo/` (no crawl) |
| `GLOVO_CRAWL=1 npm run glovo:sync` | Crawl then import |
| `npm run predev` | Background import on `next dev` (never waits for a full crawl) |

Set `GLOVO_SYNC_ON_DEV=0` to skip the predev hook.

## Session headers

Glovo session IDs expire. If crawl requests fail (401/403/empty wall):

1. Open https://glovoapp.com in a browser, pick Brașov, open any supermarket.
2. DevTools → Network → an `api.glovoapp.com` request → Request Headers.
3. Copy into `.env.local`:

```
GLOVO_DEVICE_URN=glv:device:...
GLOVO_DYNAMIC_SESSION_ID=...
GLOVO_PERSEUS_CLIENT_ID=...
GLOVO_PERSEUS_SESSION_TIMESTAMP=...
GLOVO_DELIVERY_LOCATION_TIMESTAMP=...
COOKIE=...
SUPABASE_SERVICE_ROLE_KEY=...
```

Also set `NEXT_PUBLIC_SUPABASE_URL` + service role for the importer.

## Cloud / CI note

Live Glovo API calls are often blocked or unauthenticated from cloud VMs. Prefer:

1. Migration seed / `fixtures/glovo/all_products.json`
2. Importing a previously downloaded `glovo_data/all_products.json` from a developer machine

Do not expect `glovo:crawl` to succeed in sandboxed CI without fresh session headers and egress.
