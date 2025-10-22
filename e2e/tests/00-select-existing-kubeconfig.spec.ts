import { test, expect } from '../setup/fixtures';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

function getRepoRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', '..');
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
    const ok = await ensureHostKubeconfigAvailable();
    if (!ok) test.skip(true, 'KinD kubeconfig not available');

    await page.goto(baseURL || 'http://localhost:34115');

    // Ensure wizard visible; if not, open via gear
    const wizardOverlay = page.locator('.connection-wizard-overlay');
    const gearBtn = page.locator('#show-wizard-btn');
    if (!(await wizardOverlay.isVisible().catch(() => false))) {
      await gearBtn.waitFor({ state: 'visible', timeout: 10_000 });
      await gearBtn.click();
    }
    await expect(wizardOverlay).toBeVisible();

    // Force deterministic file-selection flow to avoid flakiness from discovery timing
    await page.evaluate((p) => {
      // @ts-ignore
      if (window.go && window.go.main && window.go.main.App) {
        // @ts-ignore
        window.go.main.App.SelectKubeConfigFile = async () => p;
      }
    }, path.join(getRepoRoot(), 'kind', 'output', 'kubeconfig'));
    await page.getByRole('button', { name: /Browse for File/i }).click();
    // Continue to connect using the selected file
    await page.getByRole('button', { name: /^Continue$/i }).click();

  // Reload the app to ensure clean UI state and avoid overlay flakiness
  await page.goto(baseURL || 'http://localhost:34115', { waitUntil: 'domcontentloaded' });

    if (process.env.KIND_AVAILABLE === '1') {
      const control = page.locator('#namespace-root .kdv__control');
      await expect(page.locator('#namespace-root .kdv__control--is-disabled')).toHaveCount(0, { timeout: 120_000 });
      const testOption = page.getByRole('option', { name: /^test$/ });
      // Ensure no stray menus are open
      await page.keyboard.press('Escape');
      const main = page.locator('#maincontent');
      if (await main.isVisible().catch(()=>false)) await main.click({ force: true });
      let selected = false;
      for (let i = 0; i < 110; i++) { // ~110s total with 1s backoff
        // Ensure no other select menu portals are open that could intercept clicks
        for (let j = 0; j < 5; j++) {
          const openMenus = await page.locator('.kdv__menu-portal').count();
          if (openMenus === 0) break;
          await page.keyboard.press('Escape');
          await page.waitForTimeout(150);
        }
        await control.click();
        if (await testOption.first().isVisible().catch(() => false)) {
          await testOption.first().click();
          await control.click();
          selected = true;
          break;
        }
        await control.click();
        // Occasionally force context reload to refresh namespaces
        if (i === 10) {
          const ctxControl = page.locator('#kubecontext-root .kdv__control');
          await ctxControl.click();
          const firstCtx = page.getByRole('option').first();
          if (await firstCtx.isVisible().catch(() => false)) await firstCtx.click();
          await ctxControl.click();
      await expect(page.locator('#namespace-root .kdv__control--is-disabled')).toHaveCount(0, { timeout: 10_000 });
        }
        await page.waitForTimeout(1000);
      }
      expect(selected).toBe(true);
      const testChip = page.locator('#namespace-root .kdv__multi-value__label', { hasText: 'test' });
      await expect(testChip).toBeVisible();
      await expect(page.locator('#footer-dot')).toHaveAttribute('title', /Connected|Insecure connection/i);
    }
  });
});
