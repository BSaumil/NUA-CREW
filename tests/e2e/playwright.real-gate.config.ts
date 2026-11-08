import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { E2E_DB } from './global-setup';

/**
 * The "real gate" run. The main config (playwright.config.ts) switches the verified-email and
 * role-on-publish gates OFF so its fixtures can register fresh users and publish plain jobs. This
 * config does NOT: the API runs on the shipped defaults, so a business must be verified by an
 * operator, emails must be verified, and a role-based ad needs a pay check. It also builds the
 * marketing site with the three launch flags open toward the local apps, so every journey starts
 * by clicking a marketing call to action rather than typing a deep link.
 *
 * It uses the same ports as the main config, so run it on its own (`pnpm e2e:real-gate`), not
 * alongside it. Production policy is never weakened to make a test pass here.
 */
const api = resolve(__dirname, '../../services/api');
const apiEnv = {
  NUA_DATABASE_URL: E2E_DB,
  NUA_ENV: 'development',
  NUA_AUTH_RATE_LIMIT_PER_MINUTE: '1000',
  // Mail goes to a local folder the spec reads. A provider other than "none" is what switches the
  // verified-email gate on, so this is deliberately not "none".
  NUA_EMAIL_PROVIDER: 'file',
  NUA_EMAIL_FILE_DIR: resolve(__dirname, '.mail'),
  // NUA_REQUIRE_VERIFIED_EMAIL and NUA_REQUIRE_ROLE_ON_PUBLISH are left unset on purpose.
};

export default defineConfig({
  testDir: './specs-real-gate',
  globalSetup: './global-setup.ts',
  timeout: 180_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI
    ? [['list'], ['json', { outputFile: 'test-results/real-gate-results.json' }]]
    : [['list']],
  use: {
    trace: 'retain-on-failure',
    // Fail fast on a wrong selector instead of waiting out the whole test timeout.
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    ...devices['Desktop Chrome'],
    channel: process.env.NUA_E2E_BROWSER_CHANNEL,
  },
  webServer: [
    {
      command: 'uv run uvicorn app.main:app --port 8000',
      cwd: api,
      env: apiEnv,
      url: 'http://localhost:8000/healthz',
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @nua-crew/web dev',
      env: { API_BASE_URL: 'http://localhost:8000' },
      url: 'http://localhost:3000/trust',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      // The marketing site with all three entry points open toward the local apps.
      command: 'pnpm --filter @nua-crew/site dev',
      env: {
        NUA_APP_URL: 'http://localhost:3000',
        NUA_HIRE_URL: 'http://localhost:3001',
        NUA_CANDIDATE_SIGNUP_OPEN: 'true',
        NUA_EMPLOYER_SIGNUP_OPEN: 'true',
        NUA_JOB_POSTING_OPEN: 'true',
      },
      url: 'http://localhost:3002/',
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @nua-crew/employer dev',
      env: { API_BASE_URL: 'http://localhost:8000' },
      url: 'http://localhost:3001/login',
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
