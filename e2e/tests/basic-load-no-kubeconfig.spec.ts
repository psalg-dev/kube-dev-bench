import { test, expect } from '../setup/fixtures';
import path from 'node:path';
import fs from 'node:fs';
import { getRepoRoot } from '../setup/helpers';

async function clickWithRetry(page: any, locator: any, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForTimeout(100);
      await locator.click({ timeout: 5000 });
      return;
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await page.waitForTimeout(500);
    }
  }
}

test.describe('Basic app load without kubeconfigs on host', () => {
  test('shows connection wizard with empty state', async ({ page, baseURL }) => {
    // Ensure no kubeconfigs exist in the isolated HOME used by wails dev
    const repoRoot = getRepoRoot();
    const kubeDir = path.join(repoRoot, 'e2e', '.home-e2e', '.kube');
    try { fs.rmSync(kubeDir, { recursive: true, force: true }); } catch {}

    // Open app
    await page.goto(baseURL || 'http://localhost:34115');
    // Wait for page to stabilize
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(300);

    // Ensure wizard is visible; if not, wait for either the overlay or the gear button and click if needed
    const wizardOverlay = page.locator('.connection-wizard-overlay');
    const gearBtn = page.locator('#show-wizard-btn');
    const appeared = await Promise.race<Promise<"overlay" | "gear" | null>[]>([
      wizardOverlay.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'overlay').catch(() => null),
      gearBtn.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'gear').catch(() => null),
    ]);
    if (appeared !== 'overlay') {
      if (await gearBtn.isVisible().catch(() => false)) {
        await clickWithRetry(page, gearBtn);
      }
      await expect(wizardOverlay).toBeVisible({ timeout: 10_000 });
    }
    await expect(wizardOverlay).toBeVisible();

    // In empty state, the primary paste textarea should be visible
    const primaryArea = page.locator('#primaryConfigContent');
    await expect(primaryArea).toBeVisible();

    // There should be no discovered config items yet
    const discoveredListItems = page.locator('.config-item');
    await expect(discoveredListItems).toHaveCount(0);
  });
});
