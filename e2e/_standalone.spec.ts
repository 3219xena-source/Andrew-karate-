import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * Verifies the single-file bundle produced by `scripts/bundle-standalone.mjs`.
 *
 * The page is served through a route handler wrapped in the same minimal
 * document skeleton the publishing host applies, so this exercises the bundle
 * exactly as it will be served — not as a Vite dev page.
 *
 * Developer utility, excluded from the acceptance suite by the `_` prefix.
 */
test('the standalone bundle boots and plays without network access or console errors', async ({
  page,
}) => {
  const body = readFileSync('dist/tasmania-martial-arts-championship.html', 'utf8');

  const consoleErrors: string[] = [];
  const requests: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(`pageerror: ${error.message}`));
  page.on('request', (request) => {
    if (!request.url().startsWith('https://tmac.test/')) requests.push(request.url());
  });

  await page.route('https://tmac.test/', (route) =>
    route.fulfill({
      contentType: 'text/html; charset=utf-8',
      body: `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body>${body}</body></html>`,
    }),
  );

  await page.goto('https://tmac.test/');

  // Boots and replaces the fallback message.
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Tasmania Martial Arts Championship',
  );
  await expect(page.locator('.tmac-boot')).toHaveCount(0);

  // The journey is reachable through to a live dojo session.
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('map-marker-hobart')).toBeVisible();
  await page.getByTestId('select-team').click();
  await page.getByTestId('view-roster').click();
  await page.getByTestId('select-fighter').click();
  await expect(page.getByTestId('objective-list')).toBeVisible();

  // The canvas is being painted, not left blank.
  await page.locator('canvas.dojo-canvas').click();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyD');
  await expect(page.getByTestId('objective-reach-mark')).toHaveAttribute('data-complete', 'true');

  const painted = await page.evaluate(() => {
    const canvas = document.querySelector<HTMLCanvasElement>('canvas.dojo-canvas');
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return false;
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height);
    // A blank canvas is fully transparent; any opaque pixel means it drew.
    for (let i = 3; i < data.length; i += 4000) {
      if ((data[i] ?? 0) > 0) return true;
    }
    return false;
  });
  expect(painted, 'the dojo canvas should be painted').toBe(true);

  // Settings persist, which proves storage works inside the host frame.
  await page.reload();
  await page.getByTestId('audio-toggle').click();
  await page.reload();
  await expect(page.getByTestId('audio-toggle')).toHaveAttribute('aria-pressed', 'false');

  expect(requests, 'the bundle must make no external requests').toEqual([]);
  expect(consoleErrors).toEqual([]);
});
