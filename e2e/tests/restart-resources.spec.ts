import { test, expect } from '../setup/fixtures';
import {
  setupConnectedState,
  selectSection,
  openRowPanel,
  restartResource,
  closeBottomPanel,
} from '../setup/helpers';

/**
 * Test restart action for various resource types.
 * Verifies that the restart action works with double-click confirmation.
 */
test.describe('Restart resource actions', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(process.env.KIND_AVAILABLE !== '1', 'KinD cluster required for restart tests.');
    test.setTimeout(120_000);
    await setupConnectedState(page, baseURL);
  });

  test('restarts a Deployment via confirm action', async ({ page }) => {
    await selectSection(page, 'deployments');
    await openRowPanel(page, 'example-deployment');

    // Verify Restart button is visible
    const panel = page.locator('.bottom-panel');
    const restartBtn = panel.getByRole('button', { name: /^Restart$/i }).first();
    await expect(restartBtn).toBeVisible({ timeout: 5_000 });
    await expect(restartBtn).toBeEnabled();

    // Perform restart action (triggers rollout restart)
    await restartResource(page);

    // Verify the deployment is still visible after restart
    await closeBottomPanel(page);
    const row = page.locator('tbody tr').filter({ hasText: 'example-deployment' }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
  });

  test('restarts a StatefulSet via confirm action', async ({ page }) => {
    await selectSection(page, 'statefulsets');
    await openRowPanel(page, 'example-statefulset');

    const panel = page.locator('.bottom-panel');
    const restartBtn = panel.getByRole('button', { name: /^Restart$/i }).first();
    await expect(restartBtn).toBeVisible({ timeout: 5_000 });
    await expect(restartBtn).toBeEnabled();

    await restartResource(page);

    await closeBottomPanel(page);
    const row = page.locator('tbody tr').filter({ hasText: 'example-statefulset' }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
  });

  test('restarts a DaemonSet via confirm action', async ({ page }) => {
    await selectSection(page, 'daemonsets');
    await openRowPanel(page, 'example-daemonset');

    const panel = page.locator('.bottom-panel');
    const restartBtn = panel.getByRole('button', { name: /^Restart$/i }).first();
    await expect(restartBtn).toBeVisible({ timeout: 5_000 });
    await expect(restartBtn).toBeEnabled();

    await restartResource(page);

    await closeBottomPanel(page);
    const row = page.locator('tbody tr').filter({ hasText: 'example-daemonset' }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
  });

  test('restart confirm cancels after timeout without second click', async ({ page }) => {
    await selectSection(page, 'deployments');
    await openRowPanel(page, 'example-deployment');

    const panel = page.locator('.bottom-panel');
    const restartBtn = panel.getByRole('button', { name: /^Restart$/i }).first();
    await expect(restartBtn).toBeVisible({ timeout: 5_000 });

    // First click enters confirm mode
    await restartBtn.click();

    // Wait for confirm button
    const confirmBtn = panel.getByRole('button', { name: /^Confirm$/i }).first();
    await expect(confirmBtn).toBeVisible({ timeout: 5_000 });

    // Wait for confirm window to expire (3.5s + buffer)
    await page.waitForTimeout(4_000);

    // Button should revert back to Restart
    await expect(panel.getByRole('button', { name: /^Restart$/i }).first()).toBeVisible({ timeout: 5_000 });

    await closeBottomPanel(page);
  });
});
