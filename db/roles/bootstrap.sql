-- Creates the two application roles and grants (ADR-003 / ADR-008). Idempotent.
--
--   nua_migrator  owns the schema and runs Alembic. Never used by the running API.
--   nua_runtime   what the API/worker connect as: DML only, no DDL, NOT the table owner,
--                 NOSUPERUSER and NOBYPASSRLS, so every row-level-security policy applies.
--
-- Run as a superuser against each database (dev/test/e2e/prod):
--   psql -d <db> -v ON_ERROR_STOP=1 -v migrator_password=... -v runtime_password=... \
--        [-v grant_truncate=1]   -- test databases only: lets the test suite TRUNCATE
--        -f db/roles/bootstrap.sql
-- Passwords for real environments come from the secret manager, never from this repo.

-- Required for database-enforced per-candidate commitment overlap protection.
CREATE EXTENSION IF NOT EXISTS btree_gist;

SELECT format('CREATE ROLE nua_migrator LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB', :'migrator_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nua_migrator') \gexec
SELECT format('CREATE ROLE nua_runtime LOGIN PASSWORD %L NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB', :'runtime_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nua_runtime') \gexec

-- Make sure existing roles are not accidentally privileged.
ALTER ROLE nua_migrator NOSUPERUSER NOBYPASSRLS;
ALTER ROLE nua_runtime NOSUPERUSER NOBYPASSRLS;

SELECT format('ALTER DATABASE %I OWNER TO nua_migrator', current_database()) \gexec
ALTER SCHEMA public OWNER TO nua_migrator;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO nua_runtime;
GRANT ALL ON SCHEMA public TO nua_migrator;

-- Objects the migrator creates from now on are usable (DML only) by the runtime role.
ALTER DEFAULT PRIVILEGES FOR ROLE nua_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nua_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE nua_migrator IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO nua_runtime;
-- ...and objects that already exist (re-running the script on a populated database).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nua_runtime;

\if :{?grant_truncate}
  ALTER DEFAULT PRIVILEGES FOR ROLE nua_migrator IN SCHEMA public GRANT TRUNCATE ON TABLES TO nua_runtime;
  GRANT TRUNCATE ON ALL TABLES IN SCHEMA public TO nua_runtime;
\endif
