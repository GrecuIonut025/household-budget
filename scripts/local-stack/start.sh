#!/usr/bin/env bash
# Docker-free local backend: PostgreSQL + PostgREST + a mock GoTrue (see mock-auth.mjs).
# Requirements: running PostgreSQL 15+ (superuser URL in DATABASE_URL), the pgtap-free shim is used,
# and a PostgREST binary (https://github.com/PostgREST/postgrest/releases) at $POSTGREST_BIN.
# Prefer `supabase start` when Docker is available; this exists for sandboxes and CI without Docker.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/postgres}"
DB_NAME="${DEV_DB_NAME:-household_budget_dev}"
DEV_URL="${BASE_URL%/*}/${DB_NAME}"
POSTGREST_BIN="${POSTGREST_BIN:-postgrest}"
JWT_SECRET="${JWT_SECRET:-local-dev-only-jwt-secret-at-least-32-characters}"

psql "$BASE_URL" -q -c "drop database if exists ${DB_NAME} with (force)" -c "create database ${DB_NAME}"
psql "$DEV_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/tests/support/supabase-shim.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do psql "$DEV_URL" -v ON_ERROR_STOP=1 -q -f "$f"; done
psql "$DEV_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticator') then
    create role authenticator login password 'authenticator' noinherit;
  end if;
end $$;
grant anon, authenticated, service_role to authenticator;
SQL

AUTH_URL="${DEV_URL/postgres:\/\/postgres:postgres@/postgres://authenticator:authenticator@}"
PGRST_DB_URI="$AUTH_URL" PGRST_DB_SCHEMAS=public PGRST_DB_ANON_ROLE=anon PGRST_DB_EXTRA_SEARCH_PATH=public,extensions \
  PGRST_JWT_SECRET="$JWT_SECRET" PGRST_SERVER_PORT=54381 "$POSTGREST_BIN" &
PGRST_PID=$!
trap 'kill $PGRST_PID 2>/dev/null || true' EXIT
sleep 1
DB_URL="$DEV_URL" JWT_SECRET="$JWT_SECRET" node "$ROOT/scripts/local-stack/mock-auth.mjs"
