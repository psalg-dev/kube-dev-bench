import { test, expect } from '../setup/fixtures';
import {
  setupConnectedState,
  selectSection,
  verifyResourceRow,
  getTableRowCount,
} from '../setup/helpers';

/**
 * Test resource viewing across all resource types.
 * Verifies that tables display expected example resources from the test namespace.
 */
test.describe('Resource viewing', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(process.env.KIND_AVAILABLE !== '1', 'KinD cluster required for resource viewing tests.');
    test.setTimeout(120_000);
    await setupConnectedState(page, baseURL);
  });

  test('views Pods table and verifies example-pod exists', async ({ page }) => {
    await selectSection(page, 'pods');
    await verifyResourceRow(page, 'example-pod');

    // Verify table has at least one row
    const rowCount = await getTableRowCount(page);
    expect(rowCount).toBeGreaterThan(0);
  });

  test('views Deployments table and verifies example-deployment exists', async ({ page }) => {
    await selectSection(page, 'deployments');
    await verifyResourceRow(page, 'example-deployment');

    // Verify replicas column shows a number
    const row = page.locator('tbody tr').filter({ hasText: 'example-deployment' }).first();
    const replicasCell = row.locator('td').nth(2); // Replicas column (0-indexed)
    await expect(replicasCell).toBeVisible();
    const text = await replicasCell.innerText();
    expect(parseInt(text, 10)).toBeGreaterThanOrEqual(0);
  });

  test('views StatefulSets table and verifies example-statefulset exists', async ({ page }) => {
    await selectSection(page, 'statefulsets');
    await verifyResourceRow(page, 'example-statefulset');
  });

  test('views DaemonSets table and verifies example-daemonset exists', async ({ page }) => {
    await selectSection(page, 'daemonsets');
    await verifyResourceRow(page, 'example-daemonset');
  });

  test('views ReplicaSets table and verifies example-replicaset exists', async ({ page }) => {
    await selectSection(page, 'replicasets');
    await verifyResourceRow(page, 'example-replicaset');
  });

  test('views Jobs table and verifies example-job exists', async ({ page }) => {
    await selectSection(page, 'jobs');
    await verifyResourceRow(page, 'example-job');
  });

  test('views CronJobs table and verifies example-cronjob exists', async ({ page }) => {
    await selectSection(page, 'cronjobs');
    await verifyResourceRow(page, 'example-cronjob');
  });

  test('views ConfigMaps table and verifies example-config exists', async ({ page }) => {
    await selectSection(page, 'configmaps');
    await verifyResourceRow(page, 'example-config');
  });

  test('views Secrets table and verifies example-secret exists', async ({ page }) => {
    await selectSection(page, 'secrets');
    await verifyResourceRow(page, 'example-secret');
  });

  test('views PersistentVolumeClaims table and verifies example-pvc exists', async ({ page }) => {
    await selectSection(page, 'persistentvolumeclaims');
    await verifyResourceRow(page, 'example-pvc');
  });

  test('views PersistentVolumes table and verifies example-pv exists', async ({ page }) => {
    await selectSection(page, 'persistentvolumes');
    await verifyResourceRow(page, 'example-pv');
  });

  test('sidebar section counts update after namespace selection', async ({ page }) => {
    // Verify sidebar shows counts for resources
    const podsSection = page.locator('#section-pods');
    await expect(podsSection).toBeVisible();

    // Pods section should show pod counts (running/pending/failed format or just numbers)
    const podCountDisplay = podsSection.locator('.sidebar-pod-counts, span');
    await expect(podCountDisplay.first()).toBeVisible({ timeout: 30_000 });

    // Deployments section should show a count
    const deploymentsSection = page.locator('#section-deployments');
    await expect(deploymentsSection).toBeVisible();
    const deploymentCount = deploymentsSection.locator('span').last();
    await expect(deploymentCount).toBeVisible();
  });
});
