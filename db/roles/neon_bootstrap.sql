-- Managed-Postgres (Neon) role bootstrap for NUA CREW (ADR-003 / ADR-008 / ADR-013).
-- Idempotent. Read docs/operations/NEON_ROLE_BOOTSTRAP.md first: it is the procedure.
--
-- Differences from db/roles/bootstrap.sql (the superuser, psql-only, local/CI script):
--   * runs as the provider's project owner (on Neon: neondb_owner), which is NOT a superuser;
--   * creates the roles with SQL CREATE ROLE and NO password, so the roles do not inherit the
--     provider's elevated membership (neon_superuser, which carries BYPASSRLS) and no password
--     appears in this file, a command line, shell history or server statement logs. Set each
--     password afterwards with the interactive `\password <role>` (see the runbook);
--   * sets ownership in an order that works without superuser;
--   * grants for sequences as well as tables and functions (there are no sequences today);
--   * ends with a verification block that RAISES if any least-privilege property is missing.
--
-- It never makes the runtime role the owner of anything. If a statement here fails, STOP: do
-- not work around it by running the API as a table-owning role (the startup guard refuses it).
--
--   psql "<direct (non-pooled) owner URL>" -v ON_ERROR_STOP=1 -f db/roles/neon_bootstrap.sql
--   (after Alembic has run, add -v post_migration=1 to also verify the tables)

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------------------------
-- 0. Preflight: refuse early, with a reason, instead of failing half way.
-- ---------------------------------------------------------------------------------------------
SELECT current_setting('server_version_num')::int >= 160000 AS pg16,
       (SELECT rolcreaterole OR rolsuper FROM pg_roles WHERE rolname = current_user) AS can_create_roles,
       (SELECT rolcreatedb OR rolsuper FROM pg_roles WHERE rolname = current_user) AS can_change_db_owner,
       current_user AS connected_as,
       current_database() AS target_db
\gset
\if :pg16
\else
  \echo 'STOP: PostgreSQL 16 or newer is required (role membership options).'
  \quit
\endif
\if :can_create_roles
\else
  \echo 'STOP: the connected role cannot create roles. Connect as the project owner role.'
  \quit
\endif
\if :can_change_db_owner
\else
  \echo 'STOP: the connected role lacks CREATEDB, which ALTER DATABASE ... OWNER requires.'
  \quit
\endif
\echo 'Bootstrapping' :target_db 'as' :connected_as

-- ---------------------------------------------------------------------------------------------
-- 1. Roles. LOGIN, no password yet, nothing elevated, no inherited membership.
-- ---------------------------------------------------------------------------------------------
SELECT 'CREATE ROLE nua_migrator LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOINHERIT'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nua_migrator') \gexec
SELECT 'CREATE ROLE nua_runtime LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEROLE NOCREATEDB NOINHERIT'
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'nua_runtime') \gexec
-- No ALTER ROLE ... NOSUPERUSER/NOBYPASSRLS here: a non-superuser owner cannot name those
-- attributes in ALTER ROLE, even to switch them off. If a role pre-existed with an elevated
-- attribute, the verification block below fails the run, and it must be dropped and recreated.

-- ---------------------------------------------------------------------------------------------
-- 2. Extensions, created here by the owner so the migrator never needs the right to.
--    (The first migration also runs CREATE EXTENSION IF NOT EXISTS vector: a no-op afterwards.)
-- ---------------------------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS btree_gist;
-- pgvector is optional until the embedding pipeline lands (the migration also tolerates its
-- absence), so create it only where the provider offers it.
SELECT 'CREATE EXTENSION IF NOT EXISTS vector'
WHERE EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'vector') \gexec

-- ---------------------------------------------------------------------------------------------
-- 3. Ownership. The owner role must be able to SET ROLE to the new owner to transfer to it.
--    Schema first: while the database is still ours, we are allowed to alter it.
-- ---------------------------------------------------------------------------------------------
GRANT nua_migrator TO CURRENT_USER WITH INHERIT TRUE, SET TRUE;

SELECT 'ALTER SCHEMA public OWNER TO nua_migrator'
FROM pg_namespace
WHERE nspname = 'public' AND nspowner::regrole::text NOT IN ('nua_migrator', 'pg_database_owner') \gexec
SELECT format('ALTER DATABASE %I OWNER TO nua_migrator', current_database())
WHERE (SELECT datdba::regrole::text FROM pg_database WHERE datname = current_database()) <> 'nua_migrator' \gexec

-- ---------------------------------------------------------------------------------------------
-- 4. Grants. Runtime: connect, use the schema, DML on tables, execute functions, use sequences.
-- ---------------------------------------------------------------------------------------------
SELECT format('GRANT CONNECT ON DATABASE %I TO nua_migrator, nua_runtime', current_database()) \gexec
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO nua_runtime;
GRANT ALL ON SCHEMA public TO nua_migrator;

ALTER DEFAULT PRIVILEGES FOR ROLE nua_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO nua_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE nua_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO nua_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE nua_migrator IN SCHEMA public
  GRANT EXECUTE ON FUNCTIONS TO nua_runtime;
-- Objects that already exist (re-running on a populated database). Owned by whoever owns them
-- now: a no-op for objects the owner role does not own, which the verification block reports.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO nua_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO nua_runtime;

-- ---------------------------------------------------------------------------------------------
-- 5. Verification. Fails the script (and so the run) if any property is missing.
-- ---------------------------------------------------------------------------------------------
\echo 'Verifying least privilege'
DO $verify$
DECLARE
  problems text[] := ARRAY[]::text[];
  r record;
  db_owner text;
  schema_owner text;
BEGIN
  FOR r IN SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb
           FROM pg_roles WHERE rolname IN ('nua_migrator', 'nua_runtime') LOOP
    IF r.rolsuper OR r.rolbypassrls OR r.rolcreaterole OR r.rolcreatedb THEN
      problems := problems || format('%s has an elevated attribute', r.rolname);
    END IF;
  END LOOP;
  IF (SELECT count(*) FROM pg_roles WHERE rolname IN ('nua_migrator', 'nua_runtime')) <> 2 THEN
    problems := problems || 'a role is missing';
  END IF;

  -- The runtime role must not be, or inherit from, anything privileged or owning.
  IF pg_has_role('nua_runtime', 'nua_migrator', 'MEMBER') THEN
    problems := problems || 'nua_runtime is a member of nua_migrator';
  END IF;
  IF to_regrole('neon_superuser') IS NOT NULL AND pg_has_role('nua_runtime', 'neon_superuser', 'MEMBER') THEN
    problems := problems || 'nua_runtime is a member of neon_superuser (BYPASSRLS)';
  END IF;
  FOR r IN SELECT rolname FROM pg_roles
           WHERE rolname <> 'nua_runtime' AND pg_has_role('nua_runtime', oid, 'MEMBER')
             AND rolname NOT LIKE 'pg\_%' LOOP
    problems := problems || format('nua_runtime is a member of %s', r.rolname);
  END LOOP;

  SELECT datdba::regrole::text INTO db_owner FROM pg_database WHERE datname = current_database();
  SELECT nspowner::regrole::text INTO schema_owner FROM pg_namespace WHERE nspname = 'public';
  IF db_owner <> 'nua_migrator' THEN
    problems := problems || format('database owner is %s, expected nua_migrator', db_owner);
  END IF;
  IF schema_owner NOT IN ('nua_migrator', 'pg_database_owner') THEN
    problems := problems || format('schema public owner is %s', schema_owner);
  END IF;

  IF has_schema_privilege('nua_runtime', 'public', 'CREATE') THEN
    problems := problems || 'nua_runtime can CREATE in schema public';
  END IF;
  IF NOT has_schema_privilege('nua_runtime', 'public', 'USAGE') THEN
    problems := problems || 'nua_runtime lacks USAGE on schema public';
  END IF;
  IF has_database_privilege('nua_runtime', current_database(), 'CREATE') THEN
    problems := problems || 'nua_runtime can CREATE in the database';
  END IF;
  IF NOT has_database_privilege('nua_runtime', current_database(), 'CONNECT') THEN
    problems := problems || 'nua_runtime cannot CONNECT';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'btree_gist') THEN
    problems := problems || 'extension btree_gist is missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') THEN
    RAISE NOTICE 'extension vector is not installed (optional until the embedding pipeline lands)';
  END IF;

  -- Nothing the runtime role owns, anywhere in this database.
  FOR r IN SELECT c.relname FROM pg_class c WHERE c.relowner = 'nua_runtime'::regrole LOOP
    problems := problems || format('nua_runtime owns %s', r.relname);
  END LOOP;

  IF cardinality(problems) > 0 THEN
    RAISE EXCEPTION E'least-privilege verification FAILED:\n  - %', array_to_string(problems, E'\n  - ');
  END IF;
  RAISE NOTICE 'least-privilege verification passed';
END
$verify$;

-- ---------------------------------------------------------------------------------------------
-- 6. After Alembic (opt in with -v post_migration=1): the schema is as the guard expects.
-- ---------------------------------------------------------------------------------------------
\if :{?post_migration}
\echo 'Verifying the migrated schema'
DO $post$
DECLARE
  problems text[] := ARRAY[]::text[];
  r record;
  n int;
BEGIN
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relowner <> 'nua_migrator'::regrole LOOP
    problems := problems || format('table %s is not owned by nua_migrator', r.relname);
  END LOOP;
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
             AND NOT (has_table_privilege('nua_runtime', c.oid, 'SELECT')
                      AND has_table_privilege('nua_runtime', c.oid, 'INSERT')
                      AND has_table_privilege('nua_runtime', c.oid, 'UPDATE')
                      AND has_table_privilege('nua_runtime', c.oid, 'DELETE')) LOOP
    problems := problems || format('nua_runtime lacks DML on %s', r.relname);
  END LOOP;
  FOR r IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p')
             AND (has_table_privilege('nua_runtime', c.oid, 'TRUNCATE')
                  OR has_table_privilege('nua_runtime', c.oid, 'REFERENCES')
                  OR has_table_privilege('nua_runtime', c.oid, 'TRIGGER')) LOOP
    problems := problems || format('nua_runtime has more than DML on %s', r.relname);
  END LOOP;
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity AND NOT c.relforcerowsecurity;
  IF n > 0 THEN
    problems := problems || format('%s RLS table(s) are not FORCEd', n);
  END IF;
  SELECT count(*) INTO n FROM pg_class c JOIN pg_namespace ns ON ns.oid = c.relnamespace
   WHERE ns.nspname = 'public' AND c.relkind IN ('r', 'p') AND c.relrowsecurity;
  IF n = 0 THEN
    problems := problems || 'no table has row-level security enabled: was Alembic run?';
  END IF;
  IF cardinality(problems) > 0 THEN
    RAISE EXCEPTION E'migrated-schema verification FAILED:\n  - %', array_to_string(problems, E'\n  - ');
  END IF;
  RAISE NOTICE 'migrated-schema verification passed (% RLS tables)', n;
END
$post$;
\endif
