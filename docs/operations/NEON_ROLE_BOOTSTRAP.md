# Neon role bootstrap (staging first, then live)

**Status:** procedure written and rehearsed on a local PostgreSQL 16 cluster with a **non-superuser
owner role standing in for `neondb_owner`**. It has **not** been run on Neon. The first Neon run
must be on a throwaway branch (step 0). Nothing here provisions, pays for or connects anything:
every step that touches the Neon account, a password or a Vercel setting is the owner's.

Decision record: [ADR-013](../ADR/013-vercel-hosting-for-staging-and-first-live.md). Role model:
[ADR-008](../ADR/008-database-roles.md). Script: [`db/roles/neon_bootstrap.sql`](../../db/roles/neon_bootstrap.sql).

## Why a separate script
`db/roles/bootstrap.sql` assumes a superuser and passes passwords on the command line. Neon is
managed Postgres:

- The project owner (`neondb_owner`) is **not** a superuser, but is a member of `neon_superuser`,
  which carries `BYPASSRLS`. **Roles created through the Neon console, CLI or API get that
  membership.** A runtime role made that way would silently skip every row-level-security policy.
  So both roles are created here with SQL `CREATE ROLE`, which does not inherit it.
- A non-superuser cannot run `ALTER ROLE ... NOSUPERUSER NOBYPASSRLS` (found by the rehearsal), so
  correctness is checked by a verification block that fails the run instead.
- The API refuses to start as a role that owns or can alter the schema (`assert_rls_safe_role`,
  #73). `neondb_owner` and `nua_migrator` are therefore **never** valid runtime credentials.

## What each role is for
| Role | Used by | Can | Cannot |
| --- | --- | --- | --- |
| `neondb_owner` | the owner, by hand, for this bootstrap only | create roles, own the database | be put in any environment variable |
| `nua_migrator` | one-off Alembic runs | own and change the schema | be given to the API function |
| `nua_runtime` | the API function | `SELECT/INSERT/UPDATE/DELETE`, use sequences, execute functions | DDL, own anything, disable RLS, `TRUNCATE` |

## Steps (owner)

### 0. Rehearse on a throwaway Neon branch
Create a branch of the staging database (or a scratch project), run steps 1 to 4 against it, then
delete it. This is what turns "rehearsed locally" into "works on Neon". If any statement fails,
**stop** and send the error text (not any connection string) back. Do not work around it by
running the API as a table-owning role.

### 1. Run the bootstrap as the project owner
Use the **direct (non-pooled)** owner connection string from the Neon console. Needs `psql` 16+.
Do not paste the string into chat, a file in the repository, or a CI log.

```bash
psql "$NEON_OWNER_DIRECT_URL" -v ON_ERROR_STOP=1 -f db/roles/neon_bootstrap.sql
```

Expected end of output: `least-privilege verification passed`. The script is idempotent, so
re-running it is safe.

It stops early, with a reason, if the server is older than 16, the connected role cannot create
roles, or it lacks `CREATEDB`.

### 2. Set the two passwords, interactively
The roles are created with no password. Generate two long random values in your password manager
and set each with the interactive `\password` command, which hashes on the client, so no password
appears in a file, command line, shell history or server statement log:

```bash
psql "$NEON_OWNER_DIRECT_URL"
```
```sql
\password nua_migrator
\password nua_runtime
\q
```

### 3. Run migrations once, as `nua_migrator`, from a protected context
Build the migration URL for the **direct** endpoint with the migrator's password and run Alembic
from a protected context (a CI environment with required reviewers, or an owner-controlled shell).
**This credential never goes on the Vercel project.**

```bash
cd services/api
NUA_MIGRATION_DATABASE_URL='postgresql+asyncpg://nua_migrator:<password>@<direct-host>/<db>?ssl=require' \
  uv run alembic upgrade head
```

Format notes, **not yet tested on Neon**: Neon shows `postgresql://...?sslmode=require` strings.
The API uses the asyncpg driver, which takes `ssl=require`, not `sslmode`, and should have
`channel_binding` removed. If the first connection fails on a URL parameter, fix the URL, not
the role.

### 4. Verify the migrated schema
```bash
psql "$NEON_OWNER_DIRECT_URL" -v ON_ERROR_STOP=1 -v post_migration=1 -f db/roles/neon_bootstrap.sql
```
Expected: `migrated-schema verification passed (61 RLS tables)`. It fails if any table is not owned
by `nua_migrator`, the runtime role lacks DML or has more than DML, or an RLS table is not `FORCE`d.

### 5. Give the API function only the runtime credential
On the `nua-crew-api` Vercel project, as **sensitive** variables, set only:
`NUA_DATABASE_URL` (the `nua_runtime` URL, same format notes as step 3), `NUA_JWT_SECRET` (new
random value) and `NUA_ENV=staging`. Registration stays closed unless you set
`NUA_CANDIDATE_REGISTRATION` / `NUA_EMPLOYER_REGISTRATION` (#74). Do not set the migration URL.

### 6. Prove the guard on the real database
Deploy and check the function log: startup must complete, then `/healthz` answers. A startup that
logs `owns or can alter the schema` or `BYPASSRLS` means the wrong credential was used. Fix the
variable, not the guard.

## Rehearsal evidence (local, 8 Nov 2026)
Fresh PostgreSQL 16 cluster. `neon_sim_owner` has `CREATEROLE CREATEDB`, is **not** a superuser and
is a member of a `BYPASSRLS` role named `neon_superuser`, imitating Neon.

| Check | Result |
| --- | --- |
| Bootstrap as the non-superuser owner | passed after removing a statement that needs superuser |
| Re-run | passed (idempotent) |
| Alembic `upgrade head` as `nua_migrator` | succeeded |
| `-v post_migration=1` | passed, 61 RLS tables |
| API startup guard, `NUA_ENV=staging`, as `nua_runtime` | **started** |
| Same guard as `nua_migrator` | **refused** (owns the schema) |
| Same guard as the owner role | **refused** |
| `nua_runtime`: `ALTER TABLE ... DISABLE / NO FORCE ROW LEVEL SECURITY` | `must be owner of table` |
| `nua_runtime`: `CREATE TABLE`, `TRUNCATE` | `permission denied` |

## Not verified
- Anything on actual Neon. Neon-specific permission details, the PostgreSQL version Neon will
  give the project, and whether `neondb_owner` may transfer database ownership are untested.
- The Neon connection-string parameters above.
- **Pooled endpoints.** The RLS identity uses transaction-local `set_config(..., true)`, which is
  compatible with transaction pooling, but the asyncpg prepared-statement cache has not been
  checked against Neon's pooler. Use the direct endpoint for staging until that is tested; with
  `NUA_DB_NULL_POOL=true` each request opens its own connection, so watch the compute's
  connection limit.
- pgvector: created only if the provider offers it; the app does not need it yet.

## Standing access to know about
The script grants `nua_migrator` to the owner role with `INHERIT` and `SET`, because ownership
transfer requires it. The owner role therefore keeps migrator-level reach (that is the break-glass
admin and is why it can never be the runtime credential). To remove it after a successful run:
`REVOKE nua_migrator FROM neondb_owner;` (the next bootstrap run re-grants it).

## Rotation and teardown
Rotate by repeating the interactive `\password` step, then updating the Vercel variable and
redeploying. To remove the roles: reassign or drop owned objects first
(`REASSIGN OWNED BY nua_migrator TO neondb_owner; DROP OWNED BY nua_migrator;`), then drop the roles.
