import { test, expect } from '../setup/fixtures';
import { resetAppStateOnDisk } from '../setup/helpers';

async function clickWithRetry(page: any, locator: any, maxRetries = 5) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      await locator.waitFor({ state: 'visible', timeout: 10000 });
      await page.waitForTimeout(200);
      await locator.click({ timeout: 5000 });
      return;
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      await page.waitForTimeout(1000);
    }
  }
}

async function waitForPageStable(page: any) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(500);
}

test.describe('Basic app load without kubeconfigs on host', () => {
  test('shows connection wizard on fresh load', async ({ page, baseURL }) => {
    test.setTimeout(120_000);

    // Ensure no kubeconfigs or cached app state exist in the isolated HOME used by wails dev
    await resetAppStateOnDisk();

    // Open app
    await page.goto(baseURL || 'http://localhost:34115');
    await waitForPageStable(page);

    // Ensure wizard is visible; if not, wait for either the overlay or the gear button and click if needed
    const wizardOverlay = page.locator('.connection-wizard-overlay');
    const gearBtn = page.locator('#show-wizard-btn');
    const appeared = await Promise.race<Promise<"overlay" | "gear" | null>[]>([
      wizardOverlay.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'overlay').catch(() => null),
      gearBtn.waitFor({ state: 'visible', timeout: 20_000 }).then(() => 'gear').catch(() => null),
    ]);
    if (appeared !== 'overlay') {
      if (await gearBtn.isVisible().catch(() => false)) {
        await clickWithRetry(page, gearBtn);
      }
      await expect(wizardOverlay).toBeVisible({ timeout: 15_000 });
    }
    await expect(wizardOverlay).toBeVisible();

    // The wizard should be visible - either in "paste primary config" or "select config" state
    // Depending on whether the server has cached configs from previous test runs
    const primaryArea = page.locator('#primaryConfigContent');
    const selectKubeconfig = page.getByText('Select Kubeconfig');
    
    // At least one of these should be visible - give more time for content to load
    const hasPrimaryArea = await primaryArea.isVisible({ timeout: 5_000 }).catch(() => false);
    const hasSelectKubeconfig = await selectKubeconfig.isVisible({ timeout: 5_000 }).catch(() => false);
    
    expect(hasPrimaryArea || hasSelectKubeconfig).toBe(true);
  });
});
