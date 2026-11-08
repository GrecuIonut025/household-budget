# Household Budget

Mobile-first PWA for household budgeting, with a grocery ecosystem (products, Romanian supermarket price tracking,
recipes, meal planner, shopping lists) that shares one budget and savings engine.

Stack: Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, RLS, Storage).
Default currency RON, locales `ro` (default) and `en`.

**Status: foundation.** Working: auth, household management (members, roles, invites), budgets, transactions,
savings goals, dashboard with the budget engine. Placeholders: Products, Price Comparison, Recipes, Meal Planner,
Shopping Lists, Analytics (their database schema already exists). See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Requirements

- Node.js 22+
- A Supabase project: either the local stack (Supabase CLI + Docker) or a hosted project

## Local setup

```bash
npm install
cp .env.example .env.local     # then fill in the values below
```

### Option A: Supabase CLI (recommended)

```bash
npx supabase start             # prints the API URL and anon key
npx supabase db reset          # applies supabase/migrations
```

Put the printed `API URL` and `anon key` into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
```

For local sign-up without email confirmation, keep `enable_confirmations = false` (the CLI default) in
`supabase/config.toml`; otherwise confirm via the local Inbucket mailbox.

### Option B: hosted Supabase

```bash
npx supabase link --project-ref <ref>
npx supabase db push
```

Set the project URL and anon key in `.env.local`. In Auth settings add `http://localhost:3000/auth/callback` (and
your production URL) to the allowed redirect URLs.

### Run

```bash
npm run dev                    # http://localhost:3000
```

`npm run predev` starts a **background** Glovo Brașov import from cached/fixture JSON (never a full crawl).
Set `GLOVO_SYNC_ON_DEV=0` to skip it. See [docs/GLOVO.md](docs/GLOVO.md) for crawl session headers and
`npm run glovo:sync`.

Sign up, create a household (name, number of people, currency, optional monthly limits) and start recording
transactions. Invite others from **Household Settings → Invitations**; they open the link, sign up and accept.

### No Docker?

`scripts/local-stack/` starts PostgreSQL migrations + PostgREST + a small mock auth gateway on
`http://127.0.0.1:54321`, enough to run the app in sandboxes. It is a development harness only (see the header of
`scripts/local-stack/start.sh` for requirements).

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js (`predev` backgrounds Glovo fixture/cache import) |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests (budget engine, money, dates, i18n, helpers) |
| `npm run test:db` | pgTAP: applies all migrations to a scratch Postgres DB and runs RLS / trigger / engine tests |
| `npm run check` | typecheck + lint + unit tests |
| `npm run glovo:sync` / `glovo:import` / `glovo:crawl` | Brașov Glovo catalog → Supabase (see [docs/GLOVO.md](docs/GLOVO.md)) |

### Database tests

`npm run test:db` needs a PostgreSQL 15+ server with the `pgtap` extension and `pg_prove`
(Ubuntu: `apt install postgresql postgresql-16-pgtap libtap-parser-sourcehandler-pgtap-perl`). Point it at a
superuser connection with `DATABASE_URL` (default `postgres://postgres:postgres@127.0.0.1:5432/postgres`). With the
Supabase CLI running you can instead use `npx supabase test db`.

## Project layout

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the ERD, the RLS model and conventions.

```
supabase/migrations/   schema, triggers, views, RLS, storage, seed retailers
supabase/tests/        pgTAP suites
src/lib/budget-engine/ pure budget logic
src/app/               routes and server actions
```

## Security notes

- Row level security is enabled on every table; the app only uses the user-scoped client (no service-role key).
- Price adapters (a later worker) should write `product_prices` with the service role, from a trusted server only.
- Never expose the service-role key to the browser or commit `.env.local`.
