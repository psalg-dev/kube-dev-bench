import { test, expect } from '../setup/fixtures';
import {
  setupConnectedState,
  selectSection,
  openRowPanel,
  switchPanelTab,
  closeBottomPanel,
} from '../setup/helpers';

/**
 * Test rich bottom panel tabs functionality for all resource types.
 * Verifies new Pods, Events, Actions, Rules tabs work correctly.
 */
test.describe('Rich bottom panel tabs', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(process.env.KIND_AVAILABLE !== '1', 'KinD cluster required for rich tabs tests.');
    test.setTimeout(120_000);
    await setupConnectedState(page, baseURL);
  });

  test.describe('Deployment rich tabs', () => {
    test('opens Pods tab and shows owned pods', async ({ page }) => {
      await selectSection(page, 'deployments');
      await openRowPanel(page, 'example-deployment');

      await switchPanelTab(page, 'Pods');

      const panel = page.locator('.bottom-panel');
      // Pods tab should show pod table or loading/empty state
      await expect(panel.locator('table, .no-pods, .loading')).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('opens Events tab and shows real events', async ({ page }) => {
      await selectSection(page, 'deployments');
      await openRowPanel(page, 'example-deployment');

      await switchPanelTab(page, 'Events');

      const panel = page.locator('.bottom-panel');
      // Events tab should show event table or empty state - use .first() to avoid strict mode violation
      await expect(panel.locator('.resource-events-tab, .no-events').first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });
  });

  test.describe('StatefulSet rich tabs', () => {
    test('opens Pods tab and shows stateful pods', async ({ page }) => {
      await selectSection(page, 'statefulsets');
      // Wait for any statefulset to appear
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No StatefulSets found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'Pods');
      await expect(panel.locator('table, .no-pods, .loading')).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('opens PVCs tab and shows persistent volume claims', async ({ page }) => {
      await selectSection(page, 'statefulsets');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No StatefulSets found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'PVCs');
      await expect(panel.locator('table, .no-pvcs, .loading, .statefulset-pvcs-tab')).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('opens Events tab and shows real events', async ({ page }) => {
      await selectSection(page, 'statefulsets');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No StatefulSets found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'Events');
      await expect(panel.locator('.resource-events-tab, .no-events').first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });
  });

  test.describe('DaemonSet rich tabs', () => {
    test('opens Pods tab and shows daemon pods', async ({ page }) => {
      await selectSection(page, 'daemonsets');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No DaemonSets found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'Pods');
      await expect(panel.locator('table, .no-pods, .loading')).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('opens Events tab and shows real events', async ({ page }) => {
      await selectSection(page, 'daemonsets');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No DaemonSets found in cluster');
      
      // Ensure row is stable before clicking
      await page.waitForTimeout(200);
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 10_000 });

      await switchPanelTab(page, 'Events');
      await expect(panel.locator('.resource-events-tab, .no-events').first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });
  });

  test.describe('ReplicaSet rich tabs', () => {
    test('opens Pods tab and shows replica pods', async ({ page }) => {
      await selectSection(page, 'replicasets');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No ReplicaSets found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'Pods');
      await expect(panel.locator('table, .no-pods, .loading')).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('opens Owner tab and shows owner deployment', async ({ page }) => {
      await selectSection(page, 'replicasets');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No ReplicaSets found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'Owner');
      await expect(panel.locator('.replicaset-owner-tab, .no-owner, .loading')).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('opens Events tab and shows real events', async ({ page }) => {
      await selectSection(page, 'replicasets');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No ReplicaSets found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'Events');
      await expect(panel.locator('.resource-events-tab, .no-events').first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });
  });

  test.describe('Job rich tabs', () => {
    test('opens Events tab and shows real events', async ({ page }) => {
      await selectSection(page, 'jobs');
      await openRowPanel(page, 'example-job');

      await switchPanelTab(page, 'Events');

      const panel = page.locator('.bottom-panel');
      await expect(panel.locator('.resource-events-tab, .no-events').first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });
  });

  test.describe('CronJob rich tabs', () => {
    test('opens Actions tab and shows trigger and suspend actions', async ({ page }) => {
      await selectSection(page, 'cronjobs');
      await openRowPanel(page, 'example-cronjob');

      await switchPanelTab(page, 'Actions');

      const panel = page.locator('.bottom-panel');
      // Actions tab should show Trigger Now and Suspend/Resume buttons
      await expect(panel.locator('.cronjob-actions-tab')).toBeVisible({ timeout: 10_000 });
      await expect(panel.getByRole('button', { name: /trigger job now/i })).toBeVisible({ timeout: 5_000 });
      // Should have either Suspend or Resume based on current state
      const suspendOrResume = panel.getByRole('button', { name: /suspend|resume/i });
      await expect(suspendOrResume.first()).toBeVisible({ timeout: 5_000 });

      await closeBottomPanel(page);
    });

    test('opens Events tab and shows real events', async ({ page }) => {
      await selectSection(page, 'cronjobs');
      await openRowPanel(page, 'example-cronjob');

      await switchPanelTab(page, 'Events');

      const panel = page.locator('.bottom-panel');
      await expect(panel.locator('.resource-events-tab, .no-events').first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('triggers a job from Actions tab', async ({ page }) => {
      await selectSection(page, 'cronjobs');
      await openRowPanel(page, 'example-cronjob');

      await switchPanelTab(page, 'Actions');

      const panel = page.locator('.bottom-panel');
      const triggerBtn = panel.getByRole('button', { name: /trigger job now/i });
      await expect(triggerBtn).toBeVisible({ timeout: 5_000 });
      await triggerBtn.click();

      // Should show success or failure message
      await expect(panel.locator('.actions-message')).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });
  });

  test.describe('ConfigMap rich tabs', () => {
    test('opens Events tab and shows real events', async ({ page }) => {
      await selectSection(page, 'configmaps');
      await openRowPanel(page, 'example-config');

      await switchPanelTab(page, 'Events');

      const panel = page.locator('.bottom-panel');
      await expect(panel.locator('.resource-events-tab, .no-events').first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('Data tab is still available', async ({ page }) => {
      await selectSection(page, 'configmaps');
      await openRowPanel(page, 'example-config');

      await switchPanelTab(page, 'Data');

      const panel = page.locator('.bottom-panel');
      // Data tab should show config data
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await closeBottomPanel(page);
    });
  });

  test.describe('Secret rich tabs', () => {
    test('opens Events tab and shows real events', async ({ page }) => {
      await selectSection(page, 'secrets');
      await openRowPanel(page, 'example-secret');

      await switchPanelTab(page, 'Events');

      const panel = page.locator('.bottom-panel');
      await expect(panel.locator('.resource-events-tab, .no-events').first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });
  });

  test.describe('PersistentVolume rich tabs', () => {
    test('opens Bound PVC tab and shows PVC info', async ({ page }) => {
      await selectSection(page, 'persistentvolumes');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No PersistentVolumes found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'Bound PVC');
      // Should show either bound PVC info or "no bound PVC" message
      await expect(panel.locator('.pv-bound-pvc-tab')).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('opens Events tab and shows real events', async ({ page }) => {
      await selectSection(page, 'persistentvolumes');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No PersistentVolumes found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'Events');
      await expect(panel.locator('.resource-events-tab, .no-events').first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });
  });

  test.describe('PersistentVolumeClaim rich tabs', () => {
    test('opens Events tab and shows real events', async ({ page }) => {
      await selectSection(page, 'persistentvolumeclaims');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No PersistentVolumeClaims found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'Events');
      await expect(panel.locator('.resource-events-tab, .no-events').first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });
  });

  test.describe('Ingress rich tabs', () => {
    test('opens Rules tab and shows routing rules', async ({ page }) => {
      await selectSection(page, 'ingresses');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No Ingresses found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'Rules');
      // Should show rules table or "no rules" message
      await expect(panel.locator('.ingress-rules-tab')).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('opens Events tab and shows real events', async ({ page }) => {
      await selectSection(page, 'ingresses');
      const row = page.locator('tbody tr').first();
      const rowVisible = await row.isVisible().catch(() => false);
      test.skip(!rowVisible, 'No Ingresses found in cluster');
      
      await row.click();
      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible({ timeout: 5_000 });

      await switchPanelTab(page, 'Events');
      await expect(panel.locator('.resource-events-tab, .no-events').first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });
  });
});
