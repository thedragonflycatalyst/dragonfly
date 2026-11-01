#!/usr/bin/env bash
# Runs the row-level security tests against a throwaway database.
# Needs psql and a Postgres server; PGHOST/PGPORT/PGUSER pick which one (defaults work in CI).
set -euo pipefail
cd "$(dirname "$0")"
# Each test file gets a fresh database: Supabase stand-in, every migration, helpers, then the tests
for f in *.test.sql; do
  DB="coach_rls_$$"
  createdb "$DB"
  trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT
  psql -q -X -v ON_ERROR_STOP=1 -d "$DB" -f shim.sql
  for m in ../migrations/*.sql; do grep -q "^-- platform-only" "$m" && continue; psql -q -X -v ON_ERROR_STOP=1 -d "$DB" -f "$m"; done
  psql -q -X -v ON_ERROR_STOP=1 -d "$DB" -f helpers.sql
  echo "== $f"
  psql -q -X -tA -v ON_ERROR_STOP=1 -d "$DB" -f "$f" 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  /  /'
  [ "${PIPESTATUS[0]}" -eq 0 ] || exit 1
  dropdb "$DB"
done
