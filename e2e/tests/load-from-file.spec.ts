import { test, expect } from '../setup/fixtures';
import path from 'node:path';
import fs from 'node:fs';
import { getRepoRoot, selectNamespace } from '../setup/helpers';

test.describe('Load Kubeconfig from File', () => {
  test('browse for file, select KinD kubeconfig, and connect', async ({ page, baseURL }) => {
    test.setTimeout(120_000); // Reduced from 180s
    const repoRoot = getRepoRoot();
    const kubeconfigPath = process.env.KUBEDEV_BENCH_KIND_KUBECONFIG || path.join(repoRoot, 'kind', 'output', 'kubeconfig');

    // Ensure the kubeconfig file exists for this test
    if (!fs.existsSync(kubeconfigPath)) {
      test.skip(true, 'KinD kubeconfig not available');
    }

    // Navigate and ensure bindings are available
    await page.goto(baseURL || 'http://localhost:34115', { waitUntil: 'domcontentloaded' });

    // Ensure wizard is visible; if not, open it via the gear button
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

    // Patch window.go.main.App.SelectKubeConfigFile to return our KinD kubeconfig path
    await page.evaluate((p) => {
      // @ts-ignore
      if (window.go && window.go.main && window.go.main.App) {
        // @ts-ignore
        window.go.main.App.SelectKubeConfigFile = async () => p;
      }
    }, kubeconfigPath);

    // Click the Browse button in the empty-state view
    await page.getByRole('button', { name: /Browse for File/i }).click();

    // After selecting, the wizard should switch to discovered configs view
    await page.getByRole('button', { name: /^Continue$/i }).click();

    // Reload the app to ensure clean UI state
    await page.goto(baseURL || 'http://localhost:34115', { waitUntil: 'domcontentloaded' });

    // If KinD is available, select the 'test' namespace
    if (process.env.KIND_AVAILABLE === '1') {
      await selectNamespace(page, 'test');

      // Verify connection
      await expect(page.locator('#footer-dot')).toHaveAttribute('title', /Connected|Insecure connection/i);
    }
  });
});
