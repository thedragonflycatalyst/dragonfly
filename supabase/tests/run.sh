#!/usr/bin/env bash
# Runs the row-level security tests against a throwaway database.
# Needs psql and a Postgres server; PGHOST/PGPORT/PGUSER pick which one (defaults work in CI).
set -euo pipefail
cd "$(dirname "$0")"
DB="coach_rls_$$"
createdb "$DB"
trap 'dropdb --if-exists "$DB" >/dev/null 2>&1 || true' EXIT
psql -q -X -v ON_ERROR_STOP=1 -d "$DB" -f shim.sql
for m in ../migrations/*.sql; do psql -q -X -v ON_ERROR_STOP=1 -d "$DB" -f "$m"; done
psql -q -X -tA -v ON_ERROR_STOP=1 -d "$DB" -f rls.test.sql 2>&1 | grep -v "^$" | sed 's/^psql:[^ ]* NOTICE:  /  /'
