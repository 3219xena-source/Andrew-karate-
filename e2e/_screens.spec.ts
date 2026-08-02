import { expect, test, type Page } from '@playwright/test';

/**
 * Visual capture helper. Not part of the acceptance suite — it exists so a
 * reviewer can inspect every screen without playing through the game.
 *
 * Run with:
 *   npx playwright test --config=playwright.dev.config.ts e2e/_screens.spec.ts
 */

test.setTimeout(300_000);

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `screenshots/${name}.png`, fullPage: true });
}

/** Walks from a clean slate to the season hub for `club`. */
async function toSeason(page: Page, club = 'hobart'): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByTestId('start-game').click();
  await page.getByTestId(`map-marker-${club}`).click();
  await page.getByTestId('select-team').click();
  await page.getByTestId('view-roster').click();
  await page.getByTestId('select-fighter').click();
  await expect(page.getByTestId('objective-list')).toBeVisible();
  await page.evaluate(() => window.__tmac?.startSeason());
  await expect(page.getByTestId('season-schedule')).toBeVisible();
}

test('capture every screen', async ({ page }) => {
  // ── Menus ─────────────────────────────────────────────────────────────────
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await shot(page, '01-title');

  await page.getByTestId('open-settings').click();
  await shot(page, '02-settings');
  await page.getByTestId('settings-back').click();

  await page.getByTestId('start-game').click();
  await page.getByTestId('map-marker-rosebery').click();
  await shot(page, '03-map');

  await page.getByTestId('map-marker-hobart').click();
  await page.getByTestId('select-team').click();
  await shot(page, '04-team-roster');

  await page.getByTestId('view-roster').click();
  await page.getByTestId('fighter-card-ales-gillian').click();
  await shot(page, '05-fighter-selection');

  await page.getByTestId('select-fighter').click();
  await expect(page.getByTestId('objective-list')).toBeVisible();
  await page.locator('canvas.dojo-canvas').click();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(900);
  await page.keyboard.up('KeyD');
  await shot(page, '06-dojo');

  // ── Season ────────────────────────────────────────────────────────────────
  await page.evaluate(() => window.__tmac?.startSeason());
  await expect(page.getByTestId('season-schedule')).toBeVisible();
  await shot(page, '07-season-schedule');

  await page.getByTestId('enter-event-1').click();
  await shot(page, '08-event-preview');

  await page.getByTestId('start-event').click();
  await expect(page.getByTestId('versus-panel')).toBeVisible();
  await shot(page, '09-versus');

  // ── A live bout ───────────────────────────────────────────────────────────
  await page.getByTestId('begin-bout').click();
  await expect(page.getByTestId('fight-hud')).toBeVisible();
  await page.locator('canvas.fight-canvas').click();

  // Let the opening announcement clear, then close the distance and strike.
  await page.waitForTimeout(2200);
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyU');
  await page.waitForTimeout(90);
  await shot(page, '10-active-fight');
  await page.keyboard.up('KeyU');

  // Build a full power meter through real hits, then capture the power attack.
  const deadline = Date.now() + 90_000;
  let ready = false;
  while (Date.now() < deadline && !ready) {
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(160);
    await page.keyboard.up('KeyD');
    for (const key of ['KeyJ', 'KeyU', 'KeyJ']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(230);
    }
    if (await page.getByTestId('bout-result-panel').isVisible()) break;
    // The HUD disappears the instant the bout resolves, so a read can race it.
    const power = await page
      .getByTestId('hud-player-power')
      .getAttribute('aria-valuenow', { timeout: 2000 })
      .catch(() => null);
    if (power === null) break;
    ready = Number(power) >= 100;
  }
  if (ready && !(await page.getByTestId('bout-result-panel').isVisible())) {
    await page.keyboard.down('Space');
    await page.waitForTimeout(300);
    await shot(page, '11-power-attack');
    await page.keyboard.up('Space');
  } else {
    console.warn('[screens] power meter did not fill in time; 11-power-attack skipped');
  }

  // Play the bout out to a decision and capture the knockout / result moment.
  const boutDeadline = Date.now() + 150_000;
  while (Date.now() < boutDeadline) {
    if (await page.getByTestId('bout-result-panel').isVisible()) break;
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(200);
    await page.keyboard.up('KeyD');
    for (const key of ['KeyJ', 'KeyI', 'KeyU']) {
      await page.keyboard.press(key);
      await page.waitForTimeout(210);
      if (await page.getByTestId('bout-result-panel').isVisible()) break;
    }
  }
  await expect(page.getByTestId('bout-result-panel')).toBeVisible({ timeout: 60_000 });
  await shot(page, '12-bout-result');

  // ── Next fighter, then the rest of the tie ────────────────────────────────
  await page.getByTestId('continue-after-bout').click();
  if (await page.getByTestId('versus-panel').isVisible()) {
    await shot(page, '13-next-fighter');
  }

  await page.evaluate(async () => {
    await window.__tmac?.simulateEvent();
  });
  await expect(page.getByTestId('event-result-panel')).toBeVisible({ timeout: 60_000 });
  await shot(page, '14-team-result');

  await page.getByTestId('continue-after-event').click();
  await page.getByTestId('view-standings').click();
  await shot(page, '15-standings');

  // ── The championship and the season summary ───────────────────────────────
  await page.getByTestId('back-to-season').click();
  for (let round = 2; round <= 5; round += 1) {
    await page.getByTestId(`enter-event-${round}`).click();
    await page.getByTestId('start-event').click();
    await page.evaluate(async () => {
      await window.__tmac?.simulateEvent();
    });
    await expect(page.getByTestId('event-result-panel')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('continue-after-event').click();
  }

  await expect(page.getByTestId('qualification-panel')).toBeVisible();
  await shot(page, '16-championship-qualification');

  await page.getByTestId('enter-championship').click();
  await page.getByTestId('start-event').click();
  await page.evaluate(async () => {
    await window.__tmac?.simulateEvent();
  });
  await expect(page.getByTestId('event-result-panel')).toBeVisible({ timeout: 60_000 });
  await shot(page, '17-championship-result');

  await page.getByTestId('continue-after-event').click();
  await expect(page.getByTestId('season-complete-panel')).toBeVisible();
  await shot(page, '18-season-complete');
});

test('capture the 1366x768 layout', async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  await toSeason(page);
  await shot(page, '19-1366x768-season');

  await page.getByTestId('enter-event-1').click();
  await page.getByTestId('start-event').click();
  await page.getByTestId('begin-bout').click();
  await expect(page.getByTestId('fight-hud')).toBeVisible();
  await page.locator('canvas.fight-canvas').click();
  await page.waitForTimeout(2200);
  await shot(page, '20-1366x768-fight');
});
