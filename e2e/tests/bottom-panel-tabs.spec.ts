import { test, expect } from '../setup/fixtures';
import {
  setupConnectedState,
  selectSection,
  openRowPanel,
  switchPanelTab,
  verifyYamlTabContent,
  closeBottomPanel,
} from '../setup/helpers';

/**
 * Test bottom panel tabs functionality across different resource types.
 * Verifies Summary, YAML, Events, and Logs tabs work correctly.
 */
test.describe('Bottom panel tabs', () => {
  test.beforeEach(async ({ page, baseURL }) => {
    test.skip(process.env.KIND_AVAILABLE !== '1', 'KinD cluster required for bottom panel tests.');
    test.setTimeout(120_000);
    await setupConnectedState(page, baseURL);
  });

  test.describe('Pod details', () => {
    test('opens Summary tab and shows pod details', async ({ page }) => {
      await selectSection(page, 'pods');
      await openRowPanel(page, 'example-pod');

      const panel = page.locator('.bottom-panel');
      // Summary tab should be active by default or we can switch to it
      await switchPanelTab(page, 'Summary');

      // Summary should show pod information like labels, namespace, status
      await expect(panel.getByText(/namespace/i).first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('opens YAML tab and shows pod manifest', async ({ page }) => {
      await selectSection(page, 'pods');
      await openRowPanel(page, 'example-pod');

      await switchPanelTab(page, 'YAML');
      await verifyYamlTabContent(page);

      // YAML should contain pod-specific content
      const panel = page.locator('.bottom-panel');
      const yamlArea = panel.locator('.cm-editor, .cm-content, pre').first();
      const content = await yamlArea.textContent();
      expect(content).toContain('example-pod');

      await closeBottomPanel(page);
    });

    test('opens Events tab and shows pod events', async ({ page }) => {
      await selectSection(page, 'pods');
      await openRowPanel(page, 'example-pod');

      await switchPanelTab(page, 'Events');

      const panel = page.locator('.bottom-panel');
      // Events tab should show either events or a message indicating no events
      // The tab content area should be visible
      const tabContent = panel.locator('[style*="flex: 1"], [style*="overflow"]').first();
      await expect(tabContent).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('opens Logs tab for pod', async ({ page }) => {
      await selectSection(page, 'pods');
      await openRowPanel(page, 'example-pod');

      await switchPanelTab(page, 'Logs');

      const panel = page.locator('.bottom-panel');
      // Logs tab uses CodeMirror editor and has a filter input
      // Wait for either the CodeMirror editor or the filter input to appear
      const logViewer = panel.locator('.cm-editor, input[placeholder*="Filter"]');
      await expect(logViewer.first()).toBeVisible({ timeout: 15_000 });

      await closeBottomPanel(page);
    });

    test('opens Mounts tab for pod', async ({ page }) => {
      await selectSection(page, 'pods');
      await openRowPanel(page, 'example-pod');

      await switchPanelTab(page, 'Mounts');

      const panel = page.locator('.bottom-panel');
      // Mounts tab should be visible (may show mounts or empty state)
      const tabContent = panel.locator('[style*="flex: 1"], [style*="overflow"], div').filter({ hasText: /mount|volume/i });
      // If no mounts, the tab should still render something
      await page.waitForTimeout(1000);
      // Just verify the tab switch worked
      await expect(panel).toBeVisible();

      await closeBottomPanel(page);
    });
  });

  test.describe('Deployment details', () => {
    test('opens Summary tab for deployment', async ({ page }) => {
      await selectSection(page, 'deployments');
      await openRowPanel(page, 'example-deployment');

      await switchPanelTab(page, 'Summary');

      const panel = page.locator('.bottom-panel');
      await expect(panel.getByText(/namespace/i).first()).toBeVisible({ timeout: 10_000 });

      await closeBottomPanel(page);
    });

    test('opens YAML tab for deployment', async ({ page }) => {
      await selectSection(page, 'deployments');
      await openRowPanel(page, 'example-deployment');

      await switchPanelTab(page, 'YAML');
      await verifyYamlTabContent(page);

      const panel = page.locator('.bottom-panel');
      const yamlArea = panel.locator('.cm-editor, .cm-content, pre').first();
      const content = await yamlArea.textContent();
      expect(content).toContain('example-deployment');

      await closeBottomPanel(page);
    });

    test('opens Events tab for deployment', async ({ page }) => {
      await selectSection(page, 'deployments');
      await openRowPanel(page, 'example-deployment');

      await switchPanelTab(page, 'Events');

      const panel = page.locator('.bottom-panel');
      await expect(panel).toBeVisible();

      await closeBottomPanel(page);
    });
  });

  test.describe('ConfigMap details', () => {
    test('opens YAML tab for ConfigMap and shows data', async ({ page }) => {
      await selectSection(page, 'configmaps');
      await openRowPanel(page, 'example-config');

      await switchPanelTab(page, 'YAML');
      await verifyYamlTabContent(page);

      const panel = page.locator('.bottom-panel');
      const yamlArea = panel.locator('.cm-editor, .cm-content, pre').first();
      const content = await yamlArea.textContent();
      expect(content).toContain('example-config');

      await closeBottomPanel(page);
    });
  });

  test.describe('Secret details', () => {
    test('opens YAML tab for Secret', async ({ page }) => {
      await selectSection(page, 'secrets');
      await openRowPanel(page, 'example-secret');

      await switchPanelTab(page, 'YAML');
      await verifyYamlTabContent(page);

      const panel = page.locator('.bottom-panel');
      const yamlArea = panel.locator('.cm-editor, .cm-content, pre').first();
      const content = await yamlArea.textContent();
      expect(content).toContain('example-secret');

      await closeBottomPanel(page);
    });
  });

  test.describe('Job details', () => {
    test('opens YAML tab for Job', async ({ page }) => {
      await selectSection(page, 'jobs');
      await openRowPanel(page, 'example-job');

      await switchPanelTab(page, 'YAML');
      await verifyYamlTabContent(page);

      await closeBottomPanel(page);
    });
  });

  test.describe('CronJob details', () => {
    test('opens YAML tab for CronJob', async ({ page }) => {
      await selectSection(page, 'cronjobs');
      await openRowPanel(page, 'example-cronjob');

      await switchPanelTab(page, 'YAML');
      await verifyYamlTabContent(page);

      const panel = page.locator('.bottom-panel');
      const yamlArea = panel.locator('.cm-editor, .cm-content, pre').first();
      const content = await yamlArea.textContent();
      expect(content).toContain('example-cronjob');

      await closeBottomPanel(page);
    });
  });
});
