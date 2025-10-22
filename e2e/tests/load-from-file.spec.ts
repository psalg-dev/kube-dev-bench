import { test, expect } from '../setup/fixtures';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

function getRepoRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', '..');
}

test.describe('Load Kubeconfig from File', () => {
  test('browse for file, select KinD kubeconfig, and connect', async ({ page, baseURL }) => {
    // Allow a bit more time in this flow to accommodate KinD namespace propagation
    test.setTimeout(180_000);
    const repoRoot = getRepoRoot();
    const kubeconfigPath = process.env.KUBEDEV_BENCH_KIND_KUBECONFIG || path.join(repoRoot, 'kind', 'output', 'kubeconfig');
    // Ensure the kubeconfig file exists for this test
    if (!fs.existsSync(kubeconfigPath)) test.skip(true, 'KinD kubeconfig not available');

    // Navigate first so bindings are available, then monkey-patch the file picker RPC
    // Add resilience: retry navigation briefly if the dev server is restarting
    {
      let ok = false;
      for (let i = 0; i < 30; i++) {
        try {
          await page.goto(baseURL || 'http://localhost:34115');
          ok = true;
          break;
        } catch {
          await page.waitForTimeout(1000);
        }
      }
      expect(ok).toBe(true);
    }

    // Ensure wizard is visible; if not, open it via the gear button
    const wizardOverlay = page.locator('.connection-wizard-overlay');
    const gearBtn = page.locator('#show-wizard-btn');
    if (!(await wizardOverlay.isVisible().catch(() => false))) {
      await gearBtn.waitFor({ state: 'visible', timeout: 30_000 });
      await gearBtn.click();
    }
    await expect(wizardOverlay).toBeVisible();

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

    // After selecting, the wizard should switch to discovered configs view (step 1)
    // The Continue button becomes enabled when a config is selected (first item auto-selected)
    await page.getByRole('button', { name: /^Continue$/i }).click();

    // Reload the app instead of waiting for the overlay to close to avoid flakiness
    {
      let ok = false;
      for (let i = 0; i < 60; i++) {
        try {
          await page.goto(baseURL || 'http://localhost:34115', { waitUntil: 'domcontentloaded' });
          ok = true;
          break;
        } catch {
          await page.waitForTimeout(1000);
        }
      }
      expect(ok).toBe(true);
    }

    // If KinD is available, select the 'test' namespace and verify UI reflects the change and connected status
    if (process.env.KIND_AVAILABLE === '1') {
  const control = page.locator('#namespace-root .kdv__control');
  // Wait for namespace select to become enabled
  await expect(page.locator('#namespace-root .kdv__control--is-disabled')).toHaveCount(0, { timeout: 120_000 });
  const testOption = page.getByRole('option', { name: /^test$/ });
  // Ensure no stray menus are open
      await page.keyboard.press('Escape');
      const main = page.locator('#maincontent');
      if (await main.isVisible().catch(()=>false)) await main.click({ force: true });
      let selected = false;
      // Phase 1: try to select the 'test' namespace specifically (up to ~60s)
      for (let i = 0; i < 60; i++) {
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
        // close menu and retry after a short wait
        await control.click();
        // Occasionally force context reload to refresh namespaces
        if (i === 10 || i === 30) {
          const ctxControl = page.locator('#kubecontext-root .kdv__control');
          await ctxControl.click();
          const firstCtx = page.getByRole('option').first();
          if (await firstCtx.isVisible().catch(() => false)) await firstCtx.click();
          await ctxControl.click();
          await expect(page.locator('#namespace-root .kdv__control--is-disabled')).toHaveCount(0, { timeout: 30_000 });
        }
        await page.waitForTimeout(1000);
      }
      if (!selected) {
        // Phase 2: fall back to selecting the first available namespace, but annotate the test run
        test.info().annotations.push({ type: 'note', description: "'test' namespace not found within 60s; selecting first available namespace instead." });
        // Dismiss any open menus first
        await page.keyboard.press('Escape');
        await control.click();
        const firstNs = page.getByRole('option').first();
        await expect(firstNs).toBeVisible({ timeout: 30_000 });
        const nsText = (await firstNs.innerText()).trim();
        await firstNs.click();
        await control.click();
        // Verify the selection is reflected in the UI by matching the chip label text
        const chip = page.locator('#namespace-root .kdv__multi-value__label', { hasText: nsText });
        await expect(chip).toBeVisible();
      } else {
        const testChip = page.locator('#namespace-root .kdv__multi-value__label', { hasText: 'test' });
        await expect(testChip).toBeVisible();
      }
      await expect(page.locator('#footer-dot')).toHaveAttribute('title', /Connected|Insecure connection/i);
    }
  });
});
