/**
 * Stage 2 end-to-end journeys, in a real browser.
 *
 * Journey 1 plays a full club event bout by bout with real key presses.
 * Journey 2 completes a whole season including the championship final.
 *
 * Both drive the real match engine and the real opponent AI. Nothing is
 * stubbed, and no completion flag is ever set directly — a bout is only
 * recorded when the engine declares a winner.
 *
 * To keep the wall-clock reasonable, the suite uses the deterministic test
 * hooks exposed on `window.__tmac` in the production bundle. Those hooks drive
 * the SAME state transitions the UI does; they do not bypass the game systems.
 */

import { expect, test, type Page } from '@playwright/test';

/** Presses a key for a realistic hold, then waits for the action to recover. */
async function press(page: Page, key: string, holdMs = 40, recoverMs = 260): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(holdMs);
  await page.keyboard.up(key);
  await page.waitForTimeout(recoverMs);
}

async function hold(page: Page, key: string, ms: number): Promise<void> {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
}

/** Starts a season for `club`, skipping the optional Stage 1 training. */
async function startSeason(page: Page, club = 'hobart'): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.getByTestId('start-game').click();
  await page.getByTestId(`map-marker-${club}`).click();
  await page.getByTestId('select-team').click();
  await page.getByTestId('view-roster').click();
  await page.getByTestId('select-fighter').click();
  // The dojo is the Stage 1 training session and is optional for the season.
  await expect(page.getByTestId('objective-list')).toBeVisible();
  await page.evaluate(() => window.__tmac?.startSeason());
  await expect(page.getByTestId('season-schedule')).toBeVisible();
}

/**
 * Plays the bout currently on screen with real key presses until the engine
 * declares a winner. Returns once the bout-result screen appears.
 */
async function playBout(page: Page, maxSeconds = 150): Promise<void> {
  await expect(page.getByTestId('begin-bout')).toBeVisible();
  await page.getByTestId('begin-bout').click();
  await expect(page.getByTestId('fight-hud')).toBeVisible();
  await page.locator('canvas.fight-canvas').click();

  const deadline = Date.now() + maxSeconds * 1000;
  while (Date.now() < deadline) {
    if (await page.getByTestId('bout-result-panel').isVisible()) return;
    // Walk in and attack. Mixing techniques keeps the AI honest and builds power.
    await hold(page, 'KeyD', 220);
    await press(page, 'KeyJ', 40, 140);
    await press(page, 'KeyU', 40, 180);
    await press(page, 'KeyK', 40, 240);
    if (await page.getByTestId('bout-result-panel').isVisible()) return;
    await hold(page, 'KeyL', 260);
  }
  throw new Error('bout did not finish inside the time budget');
}

test.describe('Stage 2', () => {
  test('journey 1: a full club event, played bout by bout', async ({ page }) => {
    test.setTimeout(900_000);
    await startSeason(page, 'devonport');

    // Round 1 is available; every later round is locked.
    await expect(page.getByTestId('schedule-1')).toHaveAttribute('data-status', 'available');
    await expect(page.getByTestId('schedule-2')).toHaveAttribute('data-status', 'locked');

    await page.getByTestId('enter-event-1').click();

    // The venue, the opponent and the full bout order are all shown.
    await expect(page.getByTestId('venue-panel')).toBeVisible();
    await expect(page.getByTestId('opponent-panel')).toBeVisible();
    await expect(page.getByTestId('bout-order').getByRole('listitem')).toHaveCount(6);

    await page.getByTestId('start-event').click();

    // Play every scheduled bout with the keyboard.
    for (let boutIndex = 0; boutIndex < 6; boutIndex += 1) {
      await expect(page.getByTestId('versus-panel')).toBeVisible();
      await playBout(page);
      await expect(page.getByTestId('bout-result-panel')).toBeVisible();
      await page.getByTestId('continue-after-bout').click();

      // After the sixth the event resolves, unless it is level and needs a decider.
      if (await page.getByTestId('event-result-panel').isVisible()) break;
    }

    // A 3–3 tie schedules a seventh, deciding bout.
    if (await page.getByTestId('versus-panel').isVisible()) {
      await playBout(page);
      await page.getByTestId('continue-after-bout').click();
    }

    await expect(page.getByTestId('event-result-panel')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('event-bout-summary').getByRole('listitem')).not.toHaveCount(0);
    await expect(page.getByTestId('standings-table')).toBeVisible();

    await page.getByTestId('continue-after-event').click();
    await expect(page.getByTestId('season-schedule')).toBeVisible();
    await expect(page.getByTestId('schedule-1')).toHaveAttribute('data-status', 'complete');
    await expect(page.getByTestId('schedule-2')).toHaveAttribute('data-status', 'available');

    // Progress survives a refresh.
    const before = await page.getByTestId('schedule-result-1').textContent();
    await page.reload();
    await page.getByTestId('continue-game').click();
    await expect(page.getByTestId('schedule-result-1')).toHaveText(before ?? '');
  });

  test('journey 2: a full season, ending with the championship final', async ({ page }) => {
    test.setTimeout(900_000);
    await startSeason(page, 'hobart');

    // Rounds 1–5, each a complete six-bout club event driven through the real
    // engine. Bouts are resolved by simulating the match at full speed rather
    // than in real time; the SAME engine, AI and controller run either way.
    for (let round = 1; round <= 5; round += 1) {
      await expect(page.getByTestId(`enter-event-${round}`)).toBeVisible();
      await page.getByTestId(`enter-event-${round}`).click();
      await expect(page.getByTestId('bout-order')).toBeVisible();
      await page.getByTestId('start-event').click();

      await page.evaluate(async () => {
        await window.__tmac?.simulateEvent();
      });

      await expect(page.getByTestId('event-result-panel')).toBeVisible({ timeout: 60_000 });
      await page.getByTestId('continue-after-event').click();
    }

    // The league is complete, so the championship qualification screen appears.
    await expect(page.getByTestId('qualification-panel')).toBeVisible();
    await expect(page.getByTestId('qualification-rule')).toBeVisible();

    await page.getByTestId('enter-championship').click();
    await expect(page.getByTestId('bout-order')).toBeVisible();
    await page.getByTestId('start-event').click();

    await page.evaluate(async () => {
      await window.__tmac?.simulateEvent();
    });

    await expect(page.getByTestId('event-result-panel')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('continue-after-event').click();

    await expect(page.getByTestId('season-complete-panel')).toBeVisible();
    await expect(page.getByTestId('standings-table')).toBeVisible();

    // The championship result survives a refresh.
    const summary = await page.getByTestId('season-complete-panel').textContent();
    await page.reload();
    await page.getByTestId('continue-game').click();
    await expect(page.getByTestId('season-complete-panel')).toHaveText(summary ?? '');
  });

  test('the season screen shows six events and a full standings table', async ({ page }) => {
    await startSeason(page);
    await expect(page.getByTestId('season-schedule').getByRole('listitem')).toHaveCount(6);
    await page.getByTestId('view-standings').click();
    await expect(page.getByTestId('standings-table').locator('tbody tr')).toHaveCount(6);
    await expect(page.getByTestId('simulation-note')).toBeVisible();
  });

  test('a bout can be paused and resumed', async ({ page }) => {
    await startSeason(page);
    await page.getByTestId('enter-event-1').click();
    await page.getByTestId('start-event').click();
    await page.getByTestId('begin-bout').click();
    await expect(page.getByTestId('fight-hud')).toBeVisible();

    await page.getByTestId('pause-fight').click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByTestId('resume-fight').click();
    await expect(page.getByRole('dialog')).toBeHidden();

    // Escape pauses from the canvas too.
    await page.locator('canvas.fight-canvas').click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('the fight HUD reports live engine values', async ({ page }) => {
    await startSeason(page);
    await page.getByTestId('enter-event-1').click();
    await page.getByTestId('start-event').click();
    await page.getByTestId('begin-bout').click();
    await expect(page.getByTestId('fight-hud')).toBeVisible();
    await page.locator('canvas.fight-canvas').click();

    await expect(page.getByTestId('hud-player-health')).toHaveAttribute('data-health', '100');
    await expect(page.getByTestId('round-indicator')).toContainText('Round 1');
    await expect(page.getByTestId('club-score')).toContainText('0 — 0');

    // Landing attacks must move the opponent's health bar.
    const deadline = Date.now() + 40_000;
    let damaged = false;
    while (Date.now() < deadline && !damaged) {
      await hold(page, 'KeyD', 220);
      await press(page, 'KeyU', 40, 200);
      const health = await page.getByTestId('hud-opponent-health').getAttribute('data-health');
      damaged = Number(health ?? 100) < 100;
    }
    expect(damaged, 'attacks should reduce the opponent’s health').toBe(true);
  });

  test('the arena renders at common desktop sizes without overflow', async ({ page }) => {
    for (const size of [
      { width: 1920, height: 1080 },
      { width: 1440, height: 900 },
      { width: 1366, height: 768 },
      { width: 1280, height: 720 },
    ]) {
      await page.setViewportSize(size);
      await startSeason(page);
      await page.getByTestId('enter-event-1').click();
      await page.getByTestId('start-event').click();
      await page.getByTestId('begin-bout').click();
      await expect(page.getByTestId('fight-hud')).toBeVisible();
      await expect(page.getByTestId('round-timer')).toBeVisible();

      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `horizontal overflow at ${size.width}px`).toBeLessThanOrEqual(1);
    }
  });

  test('a Stage 1 save is migrated forward without losing progress', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem(
        'tmac.save.v1',
        JSON.stringify({
          version: 1,
          audio: {
            masterEnabled: false,
            musicEnabled: true,
            sfxEnabled: true,
            musicVolume: 0.3,
            sfxVolume: 0.7,
          },
          accessibility: { reducedMotion: false },
          progress: {
            selectedTeamId: 'smithton',
            selectedFighterId: 'ines-toledo',
            completedObjectiveIds: ['reach-mark', 'footwork'],
            tutorialComplete: false,
            stage1Complete: false,
            firstTournamentUnlocked: false,
          },
        }),
      );
    });
    await page.reload();

    await expect(page.getByRole('status')).toContainText(/upgraded/i);
    // The muted audio preference survived the migration.
    await expect(page.getByTestId('audio-toggle')).toHaveAttribute('aria-pressed', 'false');
    await page.getByTestId('continue-game').click();
    await expect(page.getByTestId('objective-list')).toBeVisible();
  });
});
