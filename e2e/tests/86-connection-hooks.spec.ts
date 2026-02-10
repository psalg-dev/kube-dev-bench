import path from 'node:path';
import { test, expect } from '../src/fixtures.js';
import { repoRoot } from '../src/support/paths.js';
import { readRunState } from '../src/support/run-state.js';
import { ConnectionWizardPage } from '../src/pages/ConnectionWizardPage.js';
import { Notifications } from '../src/pages/Notifications.js';

function hookFailScriptPath(): string {
  if (process.platform === 'win32') {
    return path.join(repoRoot, 'e2e', 'scripts', 'hook-fail.ps1');
  }
  return path.join(repoRoot, 'e2e', 'scripts', 'hook-fail.sh');
}

test.describe.serial('connection hooks', () => {
  test('pre-connect hook can abort Kubernetes connection', async ({ page }) => {
    test.setTimeout(120_000);

    const state = await readRunState();
    if (!state.kubeconfigYaml) throw new Error('Missing kubeconfigYaml in run-state; KinD setup should provide it');

    await page.goto('/');

    const wizard = new ConnectionWizardPage(page);
    await wizard.openWizardIfHidden();

    // New wizard flow only (this repo’s E2Es primarily target the new wizard).
    await expect(page.locator('.connection-wizard-layout')).toBeVisible({ timeout: 30_000 });

    // Ensure we have at least one kubeconfig entry (add via overlay if needed).
    const configItems = page.locator('.connections-card');
    if ((await configItems.count()) === 0) {
      await page.locator('#add-kubeconfig-btn').click();
      await expect(page.locator('#primaryConfigContent')).toBeVisible({ timeout: 10_000 });
      await page.locator('#primaryConfigContent').fill(state.kubeconfigYaml);
      await page.getByRole('button', { name: /save & continue/i }).click();
      await expect(page.locator('.connections-card').first()).toBeVisible({ timeout: 30_000 });
    }

    // Open hooks overlay for the first config.
    await configItems.first().click();
    await page.locator('button[title="Hooks"]').first().click();

    // Add a failing pre-connect hook.
    await expect(page.locator('#add-hook-btn')).toBeVisible({ timeout: 10_000 });
    await page.locator('#add-hook-btn').click();

    const hookName = `e2e-abort-hook-${Date.now()}`;
    await page.locator('#hook-name-input').fill(hookName);
    await page.locator('#hook-scriptpath-input').fill(hookFailScriptPath());

    // Pre-connect only: abort-on-failure must be enabled.
    await page.locator('#hook-abort-checkbox').check();

    // Make it connection-scoped (safer than global) and tied to the current config.
    await page.locator('#hook-scope-connection').check();

    await page.locator('#hook-save-btn').click();

    // Close hooks overlay.
    await page.locator('#hooks-settings-close-btn').click();

    // Attempt to connect; it should be aborted by the hook.
    const firstConfig = page.locator('.connections-card').first();
    await firstConfig.getByRole('button', { name: /^connect$/i }).click();

    const notifications = new Notifications(page);
    await notifications.expectErrorContains(/aborted by hook/i, { timeoutMs: 60_000 });

    // Cleanup: delete the hook so it doesn't affect later tests in the same worker.
    await page.locator('button[title="Hooks"]').first().click();
    await expect(page.locator('#add-hook-btn')).toBeVisible({ timeout: 10_000 });

    const row = page.locator('[id^="hook-row-"]').filter({ hasText: hookName }).first();
    await expect(row).toBeVisible({ timeout: 10_000 });

    page.once('dialog', (d) => d.accept());
    await row.locator('button', { hasText: 'Delete' }).click();

    await page.locator('#hooks-settings-close-btn').click();

    // Ensure the wizard is still visible (we did not connect).
    await expect(page.locator('.connection-wizard-layout')).toBeVisible({ timeout: 10_000 });
  });
});
