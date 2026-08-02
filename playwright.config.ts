import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration for the Stage 1 critical user journey.
 * The suite runs against a production build served by `vite preview`, so it
 * exercises the same bundle that ships.
 */
export default defineConfig({
  testDir: './e2e',
  // Files prefixed with an underscore are developer utilities (for example the
  // screenshot capture helper), not acceptance tests.
  testIgnore: '**/_*.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  // The Stage 1 journey plays a real ten-objective training session at real
  // speed, which takes a little over a minute of wall clock.
  timeout: 180_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'retain-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    {
      name: 'desktop-chromium',
      use: {
        ...devices['Desktop Chrome'],
        // Prefer a Chromium that is already installed in the environment (for
        // example a CI image that pre-provisions browsers) over downloading a
        // second copy. Set PLAYWRIGHT_CHROMIUM_PATH to point at one; without
        // it, Playwright falls back to its own managed download.
        ...(process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
