#!/usr/bin/env bash
# Runs once when the dev Postgres container is first created. Development-only passwords.
set -euo pipefail
for db in nua_crew nua_crew_test nua_crew_e2e; do
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d postgres -c "SELECT 'CREATE DATABASE $db' WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$db')" -tA | psql -U "$POSTGRES_USER" -d postgres
  extra=()
  [[ "$db" != "nua_crew" ]] && extra=(-v grant_truncate=1)
  psql -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$db" \
    -v migrator_password=nua_migrator_dev -v runtime_password=nua_runtime_dev "${extra[@]}" \
    -f /docker-entrypoint-initdb.d/bootstrap.sql
done
