import { test, expect } from '../setup/fixtures';
import path from 'node:path';
import fs from 'node:fs';
import { getRepoRoot, selectNamespace } from '../setup/helpers';

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

    await page.goto(baseURL || 'http://localhost:34115', { waitUntil: 'domcontentloaded' });

    // Ensure wizard visible; if not, open via gear
    const wizardOverlay = page.locator('.connection-wizard-overlay');
    const gearBtn = page.locator('#show-wizard-btn');

    // Wait for either wizard or gear button to appear
    const appeared = await Promise.race<Promise<"overlay" | "gear" | null>[]>([
      wizardOverlay.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'overlay').catch(() => null),
      gearBtn.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'gear').catch(() => null),
    ]);

    if (appeared !== 'overlay') {
      if (await gearBtn.isVisible().catch(() => false)) {
        await gearBtn.click();
      }
      await expect(wizardOverlay).toBeVisible({ timeout: 10_000 });
    }

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
      await selectNamespace(page, 'test');

      const testChip = page.locator('#namespace-root .kdv__multi-value__label', { hasText: 'test' });
      await expect(testChip).toBeVisible();
      await expect(page.locator('#footer-dot')).toHaveAttribute('title', /Connected|Insecure connection/i);
    }
  });
});
