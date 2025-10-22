import { test, expect } from '../setup/fixtures';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

function getRepoRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', '..');
}

test.describe('Basic app load without kubeconfigs on host', () => {
  test('shows connection wizard with empty state', async ({ page, baseURL }) => {
    // Ensure no kubeconfigs exist in the isolated HOME used by wails dev
    const repoRoot = getRepoRoot();
    const kubeDir = path.join(repoRoot, 'e2e', '.home-e2e', '.kube');
    try { fs.rmSync(kubeDir, { recursive: true, force: true }); } catch {}

    // Open app
    await page.goto(baseURL || 'http://localhost:34115');

    // Ensure wizard is visible; if not, wait for either the overlay or the gear button and click if needed
    const wizardOverlay = page.locator('.connection-wizard-overlay');
    const gearBtn = page.locator('#show-wizard-btn');
    const appeared = await Promise.race<Promise<"overlay" | "gear" | null>[]>([
      wizardOverlay.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'overlay').catch(() => null),
      gearBtn.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'gear').catch(() => null),
    ]);
    if (appeared !== 'overlay') {
      if (await gearBtn.isVisible().catch(() => false)) await gearBtn.click();
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
