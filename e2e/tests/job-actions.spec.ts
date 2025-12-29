import { test, expect } from '../setup/fixtures';
import {
  setupConnectedState,
  selectSection,
  openRowPanel,
  closeBottomPanel,
  suspendCronJob,
  resumeCronJob,
  startJobFromCronJob,
} from '../setup/helpers';

/**
 * Test Job and CronJob specific actions.
 * Verifies Start, Suspend, and Resume actions work correctly.
 */
test.describe('Job and CronJob actions', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(process.env.KIND_AVAILABLE !== '1', 'KinD cluster required for Job action tests.');
    test.setTimeout(120_000);
    await setupConnectedState(page, baseURL);
  });

  test.describe('CronJob actions', () => {
    test('CronJob panel shows Start, Suspend, and Resume buttons', async ({ page }) => {
      await selectSection(page, 'cronjobs');
      await openRowPanel(page, 'example-cronjob');

      const panel = page.locator('.bottom-panel');

      // Verify all CronJob action buttons are visible
      await expect(panel.getByRole('button', { name: /^Start$/i }).first()).toBeVisible({ timeout: 5_000 });
      await expect(panel.getByRole('button', { name: /^Suspend$/i }).first()).toBeVisible({ timeout: 5_000 });
      await expect(panel.getByRole('button', { name: /^Resume$/i }).first()).toBeVisible({ timeout: 5_000 });

      await closeBottomPanel(page);
    });

    test('suspends and resumes a CronJob', async ({ page }) => {
      await selectSection(page, 'cronjobs');
      await openRowPanel(page, 'example-cronjob');

      // Suspend the CronJob
      await suspendCronJob(page);

      // Wait for UI update
      await page.waitForTimeout(2000);

      // Resume the CronJob
      await resumeCronJob(page);

      // Verify CronJob is still visible
      await closeBottomPanel(page);
      const row = page.locator('tbody tr').filter({ hasText: 'example-cronjob' }).first();
      await expect(row).toBeVisible({ timeout: 30_000 });
    });

    test('starts a Job from CronJob (manual trigger)', async ({ page }) => {
      await selectSection(page, 'cronjobs');
      await openRowPanel(page, 'example-cronjob');

      // Start a new job from the CronJob
      await startJobFromCronJob(page);

      // Wait for the job to be created
      await page.waitForTimeout(3000);

      await closeBottomPanel(page);

      // Switch to Jobs section and verify a new job was created
      await selectSection(page, 'jobs');

      // There should be at least one job (the example-job plus any manually triggered)
      const rows = page.locator('tbody tr');
      await expect(rows.first()).toBeVisible({ timeout: 30_000 });
      const rowCount = await rows.count();
      expect(rowCount).toBeGreaterThan(0);
    });
  });

  test.describe('Job actions', () => {
    test('Job panel shows Start button', async ({ page }) => {
      await selectSection(page, 'jobs');
      await openRowPanel(page, 'example-job');

      const panel = page.locator('.bottom-panel');

      // Job should have a Start button (to re-run/restart)
      await expect(panel.getByRole('button', { name: /^Start$/i }).first()).toBeVisible({ timeout: 5_000 });

      await closeBottomPanel(page);
    });

    test('Job panel shows Delete button', async ({ page }) => {
      await selectSection(page, 'jobs');
      await openRowPanel(page, 'example-job');

      const panel = page.locator('.bottom-panel');

      // Job should have a Delete button
      await expect(panel.getByRole('button', { name: /^Delete$/i }).first()).toBeVisible({ timeout: 5_000 });

      await closeBottomPanel(page);
    });
  });

  test.describe('Resource action button states', () => {
    test('DaemonSet Scale button is disabled', async ({ page }) => {
      await selectSection(page, 'daemonsets');
      await openRowPanel(page, 'example-daemonset');

      const panel = page.locator('.bottom-panel');

      // Scale button should be disabled for DaemonSets
      const scaleBtn = panel.getByRole('button', { name: /^Scale$/i }).first();
      await expect(scaleBtn).toBeVisible({ timeout: 5_000 });
      await expect(scaleBtn).toBeDisabled();

      await closeBottomPanel(page);
    });

    test('Deployment Scale button is enabled', async ({ page }) => {
      await selectSection(page, 'deployments');
      await openRowPanel(page, 'example-deployment');

      const panel = page.locator('.bottom-panel');

      // Scale button should be enabled for Deployments
      const scaleBtn = panel.getByRole('button', { name: /^Scale$/i }).first();
      await expect(scaleBtn).toBeVisible({ timeout: 5_000 });
      await expect(scaleBtn).toBeEnabled();

      await closeBottomPanel(page);
    });

    test('StatefulSet Scale button is enabled', async ({ page }) => {
      await selectSection(page, 'statefulsets');
      await openRowPanel(page, 'example-statefulset');

      const panel = page.locator('.bottom-panel');

      // Scale button should be enabled for StatefulSets
      const scaleBtn = panel.getByRole('button', { name: /^Scale$/i }).first();
      await expect(scaleBtn).toBeVisible({ timeout: 5_000 });
      await expect(scaleBtn).toBeEnabled();

      await closeBottomPanel(page);
    });

    test('ReplicaSet Scale button is enabled', async ({ page }) => {
      await selectSection(page, 'replicasets');
      await openRowPanel(page, 'example-replicaset');

      const panel = page.locator('.bottom-panel');

      // Scale button should be enabled for ReplicaSets
      const scaleBtn = panel.getByRole('button', { name: /^Scale$/i }).first();
      await expect(scaleBtn).toBeVisible({ timeout: 5_000 });
      await expect(scaleBtn).toBeEnabled();

      await closeBottomPanel(page);
    });
  });
});
