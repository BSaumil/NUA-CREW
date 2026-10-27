import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const api = resolve(__dirname, '../../services/api');

// The app runs as the DML-only runtime role (RLS applies); Alembic runs as the schema owner.
// See db/roles/bootstrap.sql and ADR-008.
export const E2E_DB =
  process.env.NUA_E2E_DATABASE_URL ??
  'postgresql+asyncpg://nua_runtime:nua_runtime_dev@localhost:5432/nua_crew_e2e';
export const E2E_MIGRATION_DB =
  process.env.NUA_E2E_MIGRATION_DATABASE_URL ??
  'postgresql+asyncpg://nua_migrator:nua_migrator_dev@localhost:5432/nua_crew_e2e';

/** Rebuilds the e2e database from migrations and loads development-only fixture data. */
export default function globalSetup() {
  const env = {
    ...process.env,
    NUA_DATABASE_URL: E2E_DB,
    NUA_MIGRATION_DATABASE_URL: E2E_MIGRATION_DB,
    NUA_ENV: 'development',
  };
  const run = (...args: string[]) =>
    execFileSync('uv', ['run', ...args], { cwd: api, env, stdio: 'inherit' });
  run('alembic', 'downgrade', 'base');
  run('alembic', 'upgrade', 'head');
  run('python', '-m', 'app.devseed');
}
