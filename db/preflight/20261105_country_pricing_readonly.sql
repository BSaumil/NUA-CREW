-- NUA CREW: read-only preflight before country + pricing Alembic changes.
-- 2026-11-05. No BEGIN WRITE, DDL, migrations, data correction or secret disclosure.
-- Execute with psql -X -v ON_ERROR_STOP=1 -f db/preflight/20261105_country_pricing_readonly.sql
-- This report does NOT prove that backups are restorable or that future migration locks are safe.
\set ON_ERROR_STOP on
BEGIN TRANSACTION READ ONLY;
SET LOCAL statement_timeout = '20s';
SET LOCAL lock_timeout = '2s';

\echo '== Environment and existing migration revision =='
SELECT current_database() AS db, current_user AS connected_role,
       current_setting('server_version') AS pg_version,
       current_setting('transaction_read_only') AS read_only,
       now() AT TIME ZONE 'UTC' AS observed_at_utc;
SELECT version_num AS existing_revision FROM alembic_version;

\echo '== Locations: NULL, invalid uppercase ISO-2, total (CHECK allows NULL) =='
SELECT count(*) AS location_rows,
       count(*) FILTER (WHERE country IS NULL) AS null_country,
       count(*) FILTER (WHERE country IS NOT NULL AND country !~ '^[A-Z]{2}$') AS invalid_nonnull_country,
       count(*) FILTER (WHERE country = 'AU') AS explicitly_stored_au
FROM locations;
-- Stored AU may be a historical default, not verified origin evidence.
SELECT country AS invalid_country_code, count(*) AS rows
FROM locations
WHERE country IS NOT NULL AND country !~ '^[A-Z]{2}$'
GROUP BY country ORDER BY rows DESC, invalid_country_code LIMIT 20;

\echo '== Table footprint, approximate live rows and dead rows =='
SELECT c.relname AS table_name,
       pg_size_pretty(pg_relation_size(c.oid)) AS heap_size,
       pg_size_pretty(pg_indexes_size(c.oid)) AS indexes_size,
       pg_size_pretty(pg_total_relation_size(c.oid)) AS total_size,
       COALESCE(s.n_live_tup,0) AS estimated_live_rows,
       COALESCE(s.n_dead_tup,0) AS estimated_dead_rows
FROM pg_class c
LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
WHERE c.relkind = 'r' AND c.relnamespace = 'public'::regnamespace
  AND c.relname IN ('locations','employers','jobs','shifts','pay_assessments','billing_orders')
ORDER BY c.relname;

\echo '== Exact row counts for migration targets =='
SELECT 'locations' AS table_name, count(*) AS rows FROM locations
UNION ALL SELECT 'employers', count(*) FROM employers
UNION ALL SELECT 'jobs', count(*) FROM jobs
UNION ALL SELECT 'shifts', count(*) FROM shifts
UNION ALL SELECT 'pay_assessments', count(*) FROM pay_assessments
UNION ALL SELECT 'billing_orders', count(*) FROM billing_orders;

\echo '== Historical bill amounts (no order identifiers exposed) =='
SELECT amount_minor, count(*) AS orders
FROM billing_orders GROUP BY amount_minor ORDER BY amount_minor;

\echo '== Current country constraints and target index =='
SELECT conname, convalidated, pg_get_constraintdef(oid) AS definition
FROM pg_constraint WHERE conname LIKE 'ck_%country%' OR conname = 'ck_order_amount'
ORDER BY conname;
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes WHERE schemaname = 'public' AND indexname = 'ix_jobs_country_code';

\echo '== RLS table flags, runtime role privileges =='
SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS force_rls
FROM pg_class c
WHERE c.relnamespace = 'public'::regnamespace AND c.relkind='r'
  AND c.relname IN ('locations','employers','jobs','shifts','pay_assessments','billing_orders')
ORDER BY c.relname;
SELECT rolname, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
FROM pg_roles WHERE rolname IN ('nua_runtime','nua_migrator') ORDER BY rolname;

\echo '== Lock-contention snapshot and database connection counts =='
SELECT mode, granted, count(*) AS lock_count FROM pg_locks
WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
GROUP BY mode, granted ORDER BY mode, granted;
SELECT state, wait_event_type, count(*) AS connection_count
FROM pg_stat_activity WHERE datname = current_database()
GROUP BY state, wait_event_type ORDER BY state, wait_event_type;

\echo '== Extensions and WAL/replication indicators (NOT backup-restore proof) =='
SELECT extname, extversion FROM pg_extension
WHERE extname IN ('vector','pgcrypto','btree_gist') ORDER BY extname;
SELECT current_setting('wal_level') AS wal_level,
       current_setting('archive_mode') AS archive_mode;
COMMIT;

\echo 'READ-ONLY PREFLIGHT COMPLETE. Record output privately; do not publish customer data.'
