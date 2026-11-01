import { defineConfig, devices } from '@playwright/test';

/** Runs against the dev servers (API :4000, web :3000). globalSetup reseeds the development database. */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  globalSetup: './e2e/global-setup.ts',
  use: { baseURL: 'http://localhost:3000', trace: 'retain-on-failure', locale: 'en-IN', timezoneId: 'Asia/Kolkata' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] }, testIgnore: /responsive.spec.ts/ },
    { name: 'mobile', use: { ...devices['Pixel 7'] }, testMatch: /responsive\.spec\.ts/ },
  ],
  webServer: [
    { command: 'pnpm --filter @acee/api dev', url: 'http://localhost:4000/health', reuseExistingServer: true, cwd: '../..', timeout: 120_000 },
    { command: 'pnpm --filter @acee/web dev', url: 'http://localhost:3000', reuseExistingServer: true, cwd: '../..', timeout: 180_000 },
  ],
});
