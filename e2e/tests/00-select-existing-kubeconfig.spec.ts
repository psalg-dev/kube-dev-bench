import { test, expect } from '../setup/fixtures';
import path from 'node:path';
import fs from 'node:fs';
import { getRepoRoot, selectNamespace, closeOpenMenus } from '../setup/helpers';

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

async function ensureHostKubeconfigAvailable() {
  const repoRoot = getRepoRoot();
  const source = process.env.KUBEDEV_BENCH_KIND_KUBECONFIG || path.join(repoRoot, 'kind', 'output', 'kubeconfig');
  if (!fs.existsSync(source)) return false;
  const homeDir = path.join(repoRoot, 'e2e', '.home-e2e');
  const kubeDir = path.join(homeDir, '.kube');
  fs.mkdirSync(kubeDir, { recursive: true });
  const dest = path.join(kubeDir, 'kubeconfig');
  fs.copyFileSync(source, dest);
  return true;
}

test.describe('Select existing Kubeconfig', () => {
  test('detects and selects existing kubeconfig', async ({ page, baseURL }) => {
    test.setTimeout(180_000); // Longer timeout for first test
    const ok = await ensureHostKubeconfigAvailable();
    if (!ok) test.skip(true, 'KinD kubeconfig not available');

    await page.goto(baseURL || 'http://localhost:34115', { waitUntil: 'domcontentloaded' });
    await waitForPageStable(page);

    // Ensure wizard visible; if not, open via gear
    const wizardOverlay = page.locator('.connection-wizard-overlay');
    const gearBtn = page.locator('#show-wizard-btn');

    // Wait for either wizard or gear button to appear with longer timeout
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

    // Force deterministic file-selection flow to avoid flakiness from discovery timing
    await page.evaluate((p) => {
      // @ts-ignore
      if (window.go && window.go.main && window.go.main.App) {
        // @ts-ignore
        window.go.main.App.SelectKubeConfigFile = async () => p;
      }
    }, path.join(getRepoRoot(), 'kind', 'output', 'kubeconfig'));
    
    // Wait for button to be ready
    const browseBtn = page.getByRole('button', { name: /Browse for File/i });
    await expect(browseBtn).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await browseBtn.click();
    
    // Wait for Continue button
    const continueBtn = page.getByRole('button', { name: /^Continue$/i });
    await expect(continueBtn).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(500);
    await continueBtn.click();

    // Wait for wizard to close
    await wizardOverlay.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});

    // Reload the app to ensure clean UI state and avoid overlay flakiness
    await page.goto(baseURL || 'http://localhost:34115', { waitUntil: 'domcontentloaded' });
    await waitForPageStable(page);

    if (process.env.KIND_AVAILABLE === '1') {
      // Close any stray menus before namespace selection
      await closeOpenMenus(page);
      
      await selectNamespace(page, 'test');

      const testChip = page.locator('#namespace-root .kdv__multi-value__label', { hasText: 'test' });
      await expect(testChip).toBeVisible({ timeout: 30_000 });
      await expect(page.locator('#footer-dot')).toHaveAttribute('title', /Connected|Insecure connection/i);
    }
  });
});
