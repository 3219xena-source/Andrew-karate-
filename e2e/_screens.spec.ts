import { expect, test } from '@playwright/test';

/**
 * Visual capture helper. Not part of the acceptance suite — it exists so a
 * reviewer can look at each screen without playing through the game.
 * Run with: npx playwright test e2e/_screens.spec.ts
 */
test('capture every screen', async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await page.screenshot({ path: 'screenshots/01-title.png', fullPage: true });

  await page.getByTestId('open-settings').click();
  await page.screenshot({ path: 'screenshots/02-settings.png', fullPage: true });
  await page.getByTestId('settings-back').click();

  await page.getByTestId('start-game').click();
  await page.getByTestId('map-marker-rosebery').click();
  await page.screenshot({ path: 'screenshots/03-map.png', fullPage: true });

  await page.getByTestId('map-marker-hobart').click();
  await page.getByTestId('select-team').click();
  await page.screenshot({ path: 'screenshots/04-team.png', fullPage: true });

  await page.getByTestId('view-roster').click();
  await page.getByTestId('fighter-card-ales-gillian').click();
  await page.screenshot({ path: 'screenshots/05-fighter-select.png', fullPage: true });

  await page.getByTestId('select-fighter').click();
  await expect(page.getByTestId('objective-list')).toBeVisible();
  await page.locator('canvas.dojo-canvas').click();
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyD');
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(300);
  await page.screenshot({ path: 'screenshots/06-dojo.png', fullPage: true });
});
