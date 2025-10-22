import { test, expect } from '../setup/fixtures';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function getRepoRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', '..');
}

test.describe('Connection Wizard with KinD kubeconfig', () => {
  test('pastes kubeconfig and connects', async ({ page, baseURL }) => {
    const repoRoot = getRepoRoot();
    const kubeconfigPath = process.env.KUBEDEV_BENCH_KIND_KUBECONFIG || path.join(repoRoot, 'kind', 'output', 'kubeconfig');
    const kubeconfig = fs.readFileSync(kubeconfigPath, 'utf-8');

    // Open app and wait for initial DOM
    await page.goto(baseURL || 'http://localhost:34115', { waitUntil: 'domcontentloaded' });

    // Always start at the connection wizard: if not visible, click the gear icon to open it
    const wizardOverlay = page.locator('.connection-wizard-overlay');
    const gearBtn = page.locator('#show-wizard-btn');
    // Wait for either overlay or gear button to appear, then ensure overlay is shown
    const appeared = await Promise.race<Promise<"overlay" | "gear" | null>[]>([
      wizardOverlay.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'overlay').catch(() => null),
      gearBtn.waitFor({ state: 'visible', timeout: 10_000 }).then(() => 'gear').catch(() => null),
    ]);
    if (appeared !== 'overlay') {
      // Gear became visible (or overlay wasn't yet visible); click to open wizard
      if (await gearBtn.isVisible().catch(() => false)) {
        await gearBtn.click();
      }
      await expect(wizardOverlay).toBeVisible({ timeout: 10_000 });
    }

    // Two possible flows depending on whether any kubeconfigs were discovered
    const primaryArea = page.locator('#primaryConfigContent');
    if (await primaryArea.isVisible().catch(() => false)) {
      await primaryArea.fill(kubeconfig);
      await page.getByRole('button', { name: /Save \& Continue/i }).click();
    } else {
      // No primary paste view: add custom config then continue
      await page.getByRole('button', { name: /Paste Additional Config/i }).click();
      await page.locator('#configName').fill('kind-e2e');
      await page.locator('#configContent').fill(kubeconfig);
      await page.getByRole('button', { name: /Save \& Use/i }).click();
      await page.getByRole('button', { name: /Continue/i }).click();
    }

  // Reload the app instead of waiting for the overlay to close to avoid flakiness
  await page.goto(baseURL || 'http://localhost:34115', { waitUntil: 'domcontentloaded' });

    // If KinD is available, open namespaces and pick the 'test' namespace, then verify UI reflects it
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
          await page.waitForTimeout(1000);
        }
        expect(selected).toBe(true);
        const testChip = page.locator('#namespace-root .kdv__multi-value__label', { hasText: 'test' });
        await expect(testChip).toBeVisible();
        // Footer should indicate connection
        const footerDot = page.locator('#footer-dot');
        await expect(footerDot).toHaveAttribute('title', /Connected|Insecure connection/i);
    } else {
      test.info().annotations.push({ type: 'note', description: 'KinD not available; skipped namespace selection & connection assertion.' });
    }
  });
});
