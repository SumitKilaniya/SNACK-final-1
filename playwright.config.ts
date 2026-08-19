import { defineConfig } from '@playwright/test';

/**
 * Playwright e2e config for Snack-Pod.
 * Run against a local dev server: `bunx playwright test`
 * Or target staging: `BASE_URL=https://staging.snackpod.in bunx playwright test`
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: 1,
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'bun run dev',
        port: 3000,
        reuseExistingServer: true,
        timeout: 30_000,
      },
});
