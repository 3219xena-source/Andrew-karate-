/**
 * Configuration for the developer utilities in `e2e/_*.spec.ts` — the
 * screenshot capture helper and the standalone-bundle check.
 *
 * These are not acceptance tests, so the main config ignores them. Run them
 * explicitly:
 *
 *   npm run verify:standalone
 *   npx playwright test --config=playwright.dev.config.ts e2e/_screens.spec.ts
 */

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/_*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    viewport: { width: 1440, height: 900 },
    ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
      : {}),
  },
  projects: [{ name: 'desktop-chromium', use: { ...devices['Desktop Chrome'] } }],
  // The screenshot helper needs the app served; the standalone check serves its
  // own page through a route handler and ignores this.
  webServer: {
    command: 'npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
