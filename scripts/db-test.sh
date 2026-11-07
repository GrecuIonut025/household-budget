#!/usr/bin/env bash
# Applies every migration to a throwaway PostgreSQL database and runs the pgTAP suite.
# Requires: a running PostgreSQL 15+ server with the pgtap extension, psql and pg_prove.
#   DATABASE_URL  superuser connection to the server (default: postgres://postgres:postgres@127.0.0.1:5432/postgres)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE_URL="${DATABASE_URL:-postgres://postgres:postgres@127.0.0.1:5432/postgres}"
DB_NAME="household_budget_test"
TEST_URL="${BASE_URL%/*}/${DB_NAME}"

psql "$BASE_URL" -v ON_ERROR_STOP=1 -q -c "drop database if exists ${DB_NAME} with (force)" -c "create database ${DB_NAME}"
trap 'psql "$BASE_URL" -q -c "drop database if exists ${DB_NAME} with (force)" >/dev/null' EXIT

psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$ROOT/supabase/tests/support/supabase-shim.sql" -c 'create extension if not exists pgtap with schema extensions'
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "migrate: $(basename "$f")"
  psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$f"
done

PGOPTIONS='--search_path=public,extensions' pg_prove --ext .sql -d "$TEST_URL" "$ROOT"/supabase/tests/database/*.sql
