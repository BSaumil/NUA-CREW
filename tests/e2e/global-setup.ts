import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

const api = resolve(__dirname, '../../services/api');
export const E2E_DB =
  process.env.NUA_E2E_DATABASE_URL ??
  'postgresql+asyncpg://nua:nua_dev_password@localhost:5432/nua_crew_e2e';

/** Rebuilds the e2e database from migrations and loads development-only fixture data. */
export default function globalSetup() {
  const env = { ...process.env, NUA_DATABASE_URL: E2E_DB, NUA_ENV: 'development' };
  const run = (...args: string[]) =>
    execFileSync('uv', ['run', ...args], { cwd: api, env, stdio: 'inherit' });
  run('alembic', 'downgrade', 'base');
  run('alembic', 'upgrade', 'head');
  run('python', '-m', 'app.devseed');
}
