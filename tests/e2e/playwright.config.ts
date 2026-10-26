import { defineConfig, devices } from '@playwright/test';
import { resolve } from 'node:path';
import { E2E_DB } from './global-setup';

const api = resolve(__dirname, '../../services/api');
const apiEnv = {
  NUA_DATABASE_URL: E2E_DB,
  NUA_ENV: 'development',
  NUA_AUTH_RATE_LIMIT_PER_MINUTE: '1000',
};

export default defineConfig({
  testDir: './specs',
  globalSetup: './global-setup.ts',
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { trace: 'retain-on-failure', ...devices['Desktop Chrome'] },
  webServer: [
    {
      // The mobile app's web build (react-native-web) talking to the real API.
      command:
        'pnpm --filter @nua-crew/mobile export:web && node apps/mobile/scripts/serve-web.mjs',
      cwd: resolve(__dirname, '../..'),
      env: { EXPO_PUBLIC_API_URL: 'http://localhost:8000', EXPO_NO_TELEMETRY: '1', CI: '1' },
      url: 'http://localhost:8081/',
      reuseExistingServer: !process.env.CI,
      timeout: 240_000,
    },
    {
      command: 'uv run uvicorn app.main:app --port 8000',
      cwd: api,
      env: apiEnv,
      url: 'http://localhost:8000/healthz',
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'pnpm --filter @nua-crew/web dev',
      env: { API_BASE_URL: 'http://localhost:8000' },
      url: 'http://localhost:3000/trust',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'pnpm --filter @nua-crew/employer dev',
      env: { API_BASE_URL: 'http://localhost:8000' },
      url: 'http://localhost:3001/login',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
