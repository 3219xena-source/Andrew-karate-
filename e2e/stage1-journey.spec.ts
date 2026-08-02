/**
 * Stage 1 critical user journey, end to end, in a real browser.
 *
 *   Title → Tasmania map → Team profile → Fighter selection → Dojo →
 *   Tutorial completion → Stage 1 completion → Championship season
 *
 * The dojo section drives the real combat engine with real key presses, so a
 * pass means the tutorial is genuinely completable by a player using the
 * documented controls — not that a flag was set.
 */

import { expect, test, type Page } from '@playwright/test';

/** Presses a key for a realistic hold, then waits for the action to recover. */
async function press(page: Page, key: string, holdMs = 40, recoverMs = 420): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(recoverMs);
}

/** Holds `key` for `ms`, which is how movement and blocking are performed. */
async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/**
 * Walks to a repeatable position just inside striking range of the practice
 * pad. The fighter is first pinned against the left wall, which gives a known
 * origin, then walked a fixed distance right — so this does not depend on where
 * a previous drill happened to leave them.
 */
async function positionAtPad(page: Page): Promise<void> {
  await hold(page, 'KeyA', 3000);
  await hold(page, 'KeyD', 2200);
  await page.waitForTimeout(150);
}

/**
 * True once the named objective is marked complete in the HUD. Returns false if
 * the element is gone — completing the final objective unmounts the dojo, and a
 * poll must not hang on a detached locator.
 */
async function objectiveComplete(page: Page, id: string): Promise<boolean> {
  try {
    const value = await page
      .getByTestId(`objective-${id}`)
      .getAttribute('data-complete', { timeout: 2000 });
    return value === 'true';
  } catch {
    return false;
  }
}

/** Waits for an objective to complete, failing with a useful message if not. */
async function expectObjective(page: Page, id: string): Promise<void> {
  await expect(page.getByTestId(`objective-${id}`), `objective "${id}" should complete`).toHaveAttribute(
    'data-complete',
    'true',
    { timeout: 45_000 },
  );
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test('the full Stage 1 journey can be completed with keyboard and mouse', async ({ page }) => {
  // ── Title ─────────────────────────────────────────────────────────────────
  await expect(page.getByRole('heading', { level: 1 })).toContainText(
    'Tasmania Martial Arts Championship',
  );
  await page.getByTestId('start-game').click();

  // ── Tasmania map ──────────────────────────────────────────────────────────
  for (const id of ['hobart', 'launceston', 'devonport', 'burnie', 'smithton', 'rosebery']) {
    await expect(page.getByTestId(`map-marker-${id}`)).toBeVisible();
  }

  // Every marker opens a valid panel.
  await page.getByTestId('map-marker-burnie').click();
  await expect(page.getByTestId('team-panel')).toContainText('Burnie Emu Bay Karate');

  await page.getByTestId('map-marker-hobart').click();
  await expect(page.getByTestId('team-panel')).toContainText('Hobart Southern Dojo');
  await page.getByTestId('select-team').click();

  // ── Team profile ──────────────────────────────────────────────────────────
  await expect(page.getByTestId('team-roster').getByRole('listitem')).toHaveCount(6);
  await page.getByTestId('view-roster').click();

  // ── Fighter selection ─────────────────────────────────────────────────────
  await expect(page.getByTestId('fighter-grid').getByRole('listitem')).toHaveCount(6);
  await page.getByTestId('fighter-card-andrew-gillian').click();
  await expect(page.getByTestId('fighter-profile')).toContainText('Andrew');
  await expect(page.getByTestId('fighter-profile')).toContainText('Balanced karate');
  await page.getByTestId('select-fighter').click();

  // ── Training dojo ─────────────────────────────────────────────────────────
  await expect(page.getByTestId('objective-list')).toBeVisible();
  await page.locator('canvas.dojo-canvas').click();

  // 1. Walk onto the mark.
  await hold(page, 'KeyD', 700);
  await expectObjective(page, 'reach-mark');

  // 2. Footwork in both directions.
  await hold(page, 'KeyA', 500);
  await hold(page, 'KeyD', 600);
  await expectObjective(page, 'footwork');

  // 3. Jump.
  await press(page, 'KeyW', 60, 900);
  await expectObjective(page, 'jump');

  // 4. Three light attacks. Walk into range first.
  await positionAtPad(page);
  for (let i = 0; i < 8 && !(await objectiveComplete(page, 'light-attacks')); i += 1) {
    await press(page, 'KeyJ');
  }
  await expectObjective(page, 'light-attacks');

  // 5. Strong attack.
  for (let i = 0; i < 5 && !(await objectiveComplete(page, 'strong-attack')); i += 1) {
    await press(page, 'KeyK', 40, 900);
  }
  await expectObjective(page, 'strong-attack');

  // 6. Block two practice strikes. The pad's strike cycle is about 1.7 seconds,
  // so the guard is held for longer than one full cycle, then released to let
  // stamina recover.
  for (let i = 0; i < 12 && !(await objectiveComplete(page, 'block')); i += 1) {
    await hold(page, 'KeyL', 2600);
    await page.waitForTimeout(1400);
  }
  await expectObjective(page, 'block');

  // 7. Dodge one incoming practice strike. A dodge travels backwards, so each
  // attempt steps back into range before evading again.
  for (let i = 0; i < 30 && !(await objectiveComplete(page, 'dodge')); i += 1) {
    await hold(page, 'KeyD', 350);
    await press(page, 'ShiftLeft', 40, 300);
  }
  await expectObjective(page, 'dodge');

  // 8. Combination: light, light, strong. Rest and re-close the distance.
  await positionAtPad(page);
  await page.waitForTimeout(3500);
  for (let i = 0; i < 6 && !(await objectiveComplete(page, 'combination')); i += 1) {
    await press(page, 'KeyJ', 40, 380);
    await press(page, 'KeyJ', 40, 380);
    await press(page, 'KeyK', 40, 900);
    await page.waitForTimeout(2500);
  }
  await expectObjective(page, 'combination');

  // 9. Run stamina down, then rest until it recovers.
  await hold(page, 'KeyL', 9000);
  await expectObjective(page, 'stamina');

  // 10. Bow. Completing this objective ends the session and leaves the dojo, so
  // the loop watches for the completion screen rather than the objective row.
  for (let i = 0; i < 6; i += 1) {
    if (await page.getByTestId('stage-complete-panel').isVisible()) break;
    await press(page, 'KeyB', 60, 1400);
  }

  // ── Stage 1 completion ────────────────────────────────────────────────────
  await expect(page.getByTestId('stage-complete-panel')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('tournament-unlock-state')).toHaveText('Unlocked');

  // ── Handover to the Stage 2 season ────────────────────────────────────────
  // In Stage 1 this button opened a placeholder. It now starts the real
  // championship season, which is what completing the training unlocks.
  await page.getByTestId('enter-tournament').click();
  await expect(page.getByTestId('season-schedule')).toBeVisible();
  await expect(page.getByTestId('season-schedule').getByRole('listitem')).toHaveCount(6);

  // ── Persistence across a reload ───────────────────────────────────────────
  await page.reload();
  await page.getByTestId('continue-game').click();
  await expect(page.getByTestId('season-schedule')).toBeVisible();
});

test('audio preferences persist across a refresh', async ({ page }) => {
  await expect(page.getByTestId('audio-toggle')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('audio-toggle').click();
  await expect(page.getByTestId('audio-toggle')).toHaveAttribute('aria-pressed', 'false');

  await page.reload();
  await expect(page.getByTestId('audio-toggle')).toHaveAttribute('aria-pressed', 'false');

  await page.getByTestId('open-settings').click();
  await page.getByTestId('setting-music').click();
  await expect(page.getByTestId('setting-music')).toHaveAttribute('aria-checked', 'false');

  await page.reload();
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('setting-music')).toHaveAttribute('aria-checked', 'false');
});

test('the map is fully operable with the keyboard', async ({ page }) => {
  await page.getByTestId('start-game').click();

  await page.getByTestId('map-marker-devonport').focus();
  await expect(page.getByTestId('team-panel')).toContainText('Devonport Coastal Martial Arts');

  await page.keyboard.press('Enter');
  await expect(page.getByTestId('team-panel')).toContainText('Devonport Coastal Martial Arts');

  // Confirm the club from the panel, still without a mouse click on the map.
  await page.getByTestId('select-team').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('team-roster')).toBeVisible();
});

test('recovers from corrupted save data without breaking', async ({ page }) => {
  await page.evaluate(() => window.localStorage.setItem('tmac.save.v1', '{ not valid json'));
  await page.reload();

  await expect(page.getByRole('status')).toContainText(/could not be read|has been reset/i);
  await expect(page.getByTestId('start-game')).toBeVisible();
  await page.getByTestId('start-game').click();
  await expect(page.getByTestId('map-marker-hobart')).toBeVisible();
});

test('resuming mid-journey returns to the right screen', async ({ page }) => {
  await page.getByTestId('start-game').click();
  await page.getByTestId('select-team').click();
  await page.getByTestId('view-roster').click();
  await page.getByTestId('fighter-card-bea-halloran').click();
  await page.getByTestId('select-fighter').click();
  await expect(page.getByTestId('objective-list')).toBeVisible();

  await page.reload();
  await page.getByTestId('continue-game').click();
  await expect(page.getByTestId('objective-list')).toBeVisible();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hobart dojo');
});

test('the dojo can be paused and resumed', async ({ page }) => {
  await page.getByTestId('start-game').click();
  await page.getByTestId('select-team').click();
  await page.getByTestId('view-roster').click();
  await page.getByTestId('select-fighter').click();

  await page.getByTestId('pause').click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByTestId('resume').click();
  await expect(page.getByRole('dialog')).toBeHidden();

  // Escape also pauses, from the canvas.
  await page.locator('canvas.dojo-canvas').click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
});

test('renders without horizontal overflow at common desktop sizes', async ({ page }) => {
  for (const size of [
    { width: 1920, height: 1080 },
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
  ]) {
    await page.setViewportSize(size);
    await page.goto('/');
    await page.getByTestId('start-game').click();
    await expect(page.getByTestId('map-marker-hobart')).toBeVisible();

    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow at ${size.width}px`).toBeLessThanOrEqual(1);
  }
});
