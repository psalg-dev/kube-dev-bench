import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { helm } from '../src/support/kind.js';
import { BottomPanel } from '../src/pages/BottomPanel.js';
import { Notifications } from '../src/pages/Notifications.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function writeLocalChart(opts: { chartRoot: string; chartName: string }) {
  const { chartRoot, chartName } = opts;
  const templatesDir = path.join(chartRoot, 'templates');
  await fs.mkdir(templatesDir, { recursive: true });

  // A minimal, network-free chart: ConfigMap only.
  const chartYaml = [
    'apiVersion: v2',
    `name: ${chartName}`,
    'description: KubeDevBench E2E local chart',
    'type: application',
    'version: 0.1.0',
    'appVersion: "1.0.0"',
    '',
  ].join('\n');

  const valuesYaml = ['testValue: "1"', ''].join('\n');

  const cmYaml = [
    'apiVersion: v1',
    'kind: ConfigMap',
    'metadata:',
    '  name: {{ .Release.Name }}-e2e',
    'data:',
    '  testValue: {{ .Values.testValue | quote }}',
    '',
  ].join('\n');

  // Notes file lets the UI exercise GetHelmReleaseNotes.
  const notesTxt = ['E2E Notes', 'Release: {{ .Release.Name }}', 'Value: {{ .Values.testValue }}', ''].join('\n');

  await Promise.all([
    fs.writeFile(path.join(chartRoot, 'Chart.yaml'), chartYaml, 'utf-8'),
    fs.writeFile(path.join(chartRoot, 'values.yaml'), valuesYaml, 'utf-8'),
    fs.writeFile(path.join(templatesDir, 'configmap.yaml'), cmYaml, 'utf-8'),
    fs.writeFile(path.join(chartRoot, 'NOTES.txt'), notesTxt, 'utf-8'),
  ]);
}

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test.describe('Helm Releases View', () => {
  test('renders Helm Releases table with correct columns', async ({ page, contextName, namespace }) => {
    test.setTimeout(120_000);
    const { sidebar } = await bootstrapApp({ page, contextName, namespace });
    await sidebar.goToSection('helmreleases');

    // Verify title
    await expect(page.locator('h2.overview-title:visible')).toHaveText(/helm releases/i, { timeout: 60_000 });

    // Verify table column headers
    const expectedColumns = ['Name', 'Namespace', 'Chart', 'Chart Version', 'App Version', 'Status', 'Revision', 'Age'];
    for (const col of expectedColumns) {
      const exactHeader = new RegExp(`^${escapeRegExp(col)}$`, 'i');
      await expect(page.getByRole('columnheader', { name: exactHeader })).toBeVisible({ timeout: 30_000 });
    }
  });

  test('sidebar shows Helm Releases entry', async ({ page, contextName, namespace }) => {
    test.setTimeout(120_000);
    const { sidebar } = await bootstrapApp({ page, contextName, namespace });

    // Verify sidebar has Helm Releases entry
    await expect(page.locator('#section-helmreleases')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('#section-helmreleases')).toHaveText(/helm releases/i);
  });

  test('Helm Releases table shows empty state or data rows', async ({ page, contextName, namespace }) => {
    test.setTimeout(120_000);
    const { sidebar } = await bootstrapApp({ page, contextName, namespace });
    await sidebar.goToSection('helmreleases');

    // Wait for loading to complete - either we see rows or the table is empty
    await expect(page.locator('h2.overview-title:visible')).toHaveText(/helm releases/i, { timeout: 60_000 });

    // The table should be visible (it shows either data or an empty state)
    const table = page.getByRole('table');
    await expect(table).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Helm Release Operations', () => {
  test('installs, views, and uninstalls a Helm release', async ({ page, contextName, namespace, kubeconfigPath, homeDir }) => {
    test.setTimeout(300_000); // 5 minutes for full Helm workflow

    // Helm operation tests require the helm CLI. Locally we skip if it's missing,
    // but in CI we fail fast so the environment gets fixed.
    const helmVersion = await helm(['version', '--short'], { kubeconfigPath, homeDir, timeoutMs: 20_000 });
    if (helmVersion.code === 127) {
      if (process.env.E2E_SKIP_HELM === '1') {
        test.skip(true, 'Helm CLI not found on PATH; skipping because E2E_SKIP_HELM=1');
        return;
      }
      throw new Error('Helm CLI not found on PATH. Install helm or set E2E_SKIP_HELM=1 to skip Helm E2Es.');
    }

    const releaseName = uniqueName('e2e-helm');

    const chartName = 'kdb-e2e-chart';
    const chartDir = path.join(os.tmpdir(), `kdb-e2e-helm-chart-${releaseName}`);
    await writeLocalChart({ chartRoot: chartDir, chartName });

    // Install a local, ConfigMap-only chart to avoid network/image-pull flakiness.
    const install = await helm([
      'install', releaseName, chartDir,
      '--namespace', namespace,
      '--set', 'testValue=1',
    ], { kubeconfigPath, homeDir, timeoutMs: 120_000 });

    if (install.code !== 0) {
      const details = (install.stderr || install.stdout || '').trim();
      throw new Error(`Helm install failed: ${details}`);
    }

    try {
      // Bootstrap app and navigate to Helm Releases
      const { sidebar } = await bootstrapApp({ page, contextName, namespace });
      await sidebar.goToSection('helmreleases');

      // Verify release appears in the table
      await expect(page.locator('h2.overview-title:visible')).toHaveText(/helm releases/i, { timeout: 60_000 });

      // Match the Helm release row by exact name to avoid colliding with the ConfigMap name (`${releaseName}-e2e`).
      const releaseRow = page
        .locator('table.gh-table tbody tr')
        .filter({ has: page.getByRole('cell', { name: releaseName, exact: true }) });
      await expect(releaseRow).toBeVisible({ timeout: 60_000 });

      // Verify release status is deployed
      await expect(releaseRow).toContainText('deployed', { timeout: 30_000 });

      // Click on the release to open bottom panel
      const notifications = new Notifications(page);
      await notifications.waitForClear();

      // Re-assert we're still on Helm Releases before opening details.
      // (A stray navigate event elsewhere in the app can switch sections under load.)
      await sidebar.goToSection('helmreleases');
      await expect(page.locator('h2.overview-title:visible')).toHaveText(/helm releases/i, { timeout: 60_000 });

      const releaseRowForOpen = page.locator('table.gh-table tbody tr').filter({ hasText: releaseName });
      
      // Clear any filter that might be hiding rows
      const filterInput = page.getByRole('searchbox', { name: /filter/i });
      if (await filterInput.isVisible().catch(() => false)) {
        await filterInput.fill('');
      }
      
      // Poll for the row to be visible with retries
      await expect(async () => {
        await expect(releaseRowForOpen).toBeVisible();
      }).toPass({ timeout: 60_000, intervals: [1000, 2000, 5000] });
      
      // Click the row to open details panel (Helm Releases table uses row click, not Details button)
      await releaseRowForOpen.click();

      const panel = new BottomPanel(page);
      await panel.expectVisible(30_000);

      // Verify bottom panel tabs exist
      const expectedTabs = ['Summary', 'Values', 'History', 'Notes', 'Resources', 'Manifest'];
      await panel.expectTabs(expectedTabs);

      // Click through each tab and verify no errors
      for (const tab of expectedTabs) {
        await panel.clickTab(tab);
        await panel.expectNoErrorText();

        // Verify specific content for each tab
        if (tab === 'Summary') {
          // Summary tab should show release name and chart info
          await expect(panel.root).toContainText(releaseName);
          await expect(panel.root).toContainText(chartName);
        } else if (tab === 'Values') {
          // Values tab should have a checkbox for "Show all values"
          await expect(panel.root.getByText(/show all values/i)).toBeVisible({ timeout: 10_000 });
        } else if (tab === 'History') {
          // History tab should show at least one revision (often rendered as "1(current)").
          // Use DOM locators instead of ARIA roles; in CI the accessibility tree can lag during rapid re-renders.
          await expect(panel.root.getByText(/loading history/i)).toBeHidden({ timeout: 30_000 });
          await panel.expectNoErrorText();

          const historyTable = panel.root.locator('table');
          await expect(historyTable).toBeVisible({ timeout: 30_000 });
          await expect(historyTable.locator('thead th', { hasText: /^Revision$/ })).toBeVisible({ timeout: 30_000 });

          const rows = historyTable.locator('tbody tr');
          await expect.poll(async () => await rows.count(), { timeout: 30_000 }).toBeGreaterThan(0);
          await expect(rows.first().locator('td').first()).toContainText(/^1/i, { timeout: 30_000 });
        } else if (tab === 'Resources') {
          // Resources tab should list the ConfigMap rendered by the local chart.
          const resourcesTable = panel.root.locator('table');
          await expect(resourcesTable).toBeVisible({ timeout: 30_000 });
          await expect(resourcesTable.locator('thead th', { hasText: /^Health$/ })).toBeVisible({ timeout: 30_000 });
          await expect(resourcesTable.locator('thead th', { hasText: /^Kind$/ })).toBeVisible({ timeout: 30_000 });
          await expect(resourcesTable.locator('thead th', { hasText: /^Name$/ })).toBeVisible({ timeout: 30_000 });

          const rows = resourcesTable.locator('tbody tr');
          await expect.poll(async () => await rows.count(), { timeout: 30_000 }).toBeGreaterThan(0);

          const expectedResourceName = `${releaseName}-e2e`;
          await expect(resourcesTable).toContainText('ConfigMap', { timeout: 30_000 });
          await expect(resourcesTable).toContainText(expectedResourceName, { timeout: 30_000 });
        } else if (tab === 'Manifest') {
          // Manifest tab should show YAML content
          await panel.expectCodeMirrorVisible();
        }
      }

      // Clicking a resource row should navigate to the matching resource view and open its bottom panel.
      // Do this after the Helm tab assertions, since it switches the current section/panel.
      await panel.clickTab('Resources');
      const expectedResourceName = `${releaseName}-e2e`;
      const resourcesTable = panel.root.locator('table');
      await expect(resourcesTable).toBeVisible({ timeout: 30_000 });
      await resourcesTable.locator('tbody tr').filter({ hasText: expectedResourceName }).first().click();

      await expect(page.locator('h2.overview-title:visible')).toHaveText(/config maps/i, { timeout: 60_000 });

      // The app may navigate but not always auto-open the row under load; open it explicitly.
      const cmRow = page.locator('table.gh-table tbody tr').filter({ hasText: expectedResourceName }).first();
      await expect(cmRow).toBeVisible({ timeout: 60_000 });
      await cmRow.click();

      const cmPanel = new BottomPanel(page);
      await cmPanel.expectVisible(30_000);
      await expect(cmPanel.root).toContainText(expectedResourceName, { timeout: 30_000 });

      // Close the resource panel before interacting with the sidebar; otherwise the
      // bottom panel/main content may intercept pointer events on the sidebar.
      await cmPanel.closeByClickingOutside();

      // Navigate back to Helm Releases and re-open the release so we can uninstall via the Helm panel.
      await sidebar.goToSection('helmreleases');
      await expect(page.locator('h2.overview-title:visible')).toHaveText(/helm releases/i, { timeout: 60_000 });

      // Use exact cell match to avoid colliding with the ConfigMap name (`${releaseName}-e2e`).
      const releaseRowAgain = page
        .locator('table.gh-table tbody tr')
        .filter({ has: page.getByRole('cell', { name: releaseName, exact: true }) });
      await expect(releaseRowAgain).toBeVisible({ timeout: 60_000 });
      await releaseRowAgain.click();

      const helmPanel = new BottomPanel(page);
      await helmPanel.expectVisible();
      await helmPanel.expectTabs(expectedTabs);

      // Test Upgrade button exists
      await helmPanel.clickTab('Summary');
      await expect(helmPanel.root.getByRole('button', { name: /upgrade/i })).toBeVisible();

      // Test Uninstall via UI
      // Set up dialog handler before clicking
      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      await helmPanel.root.getByRole('button', { name: /uninstall/i }).click();

      // Wait for the release to be removed from the table
      await sidebar.goToSection('helmreleases');
      await expect(page.locator('h2.overview-title:visible')).toHaveText(/helm releases/i, { timeout: 60_000 });
      await expect(releaseRow).toBeHidden({ timeout: 60_000 });

    } finally {
      // Cleanup: Ensure the release is uninstalled even if test fails
      await helm(['uninstall', releaseName, '--namespace', namespace, '--ignore-not-found'], {
        kubeconfigPath,
        homeDir,
        timeoutMs: 60_000,
      }).catch(() => {});

      // Best-effort cleanup of temp chart dir.
      await fs.rm(chartDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('shows release history with rollback option', async ({ page, contextName, namespace, kubeconfigPath, homeDir }) => {
    test.setTimeout(360_000); // 6 minutes for upgrade and rollback test

    // Helm operation tests require the helm CLI. Locally we skip if it's missing,
    // but in CI we fail fast so the environment gets fixed.
    const helmVersion = await helm(['version', '--short'], { kubeconfigPath, homeDir, timeoutMs: 20_000 });
    if (helmVersion.code === 127) {
      if (process.env.E2E_SKIP_HELM === '1') {
        test.skip(true, 'Helm CLI not found on PATH; skipping because E2E_SKIP_HELM=1');
        return;
      }
      throw new Error('Helm CLI not found on PATH. Install helm or set E2E_SKIP_HELM=1 to skip Helm E2Es.');
    }

    const releaseName = uniqueName('e2e-helm-hist');

    const chartName = 'kdb-e2e-chart';
    const chartDir = path.join(os.tmpdir(), `kdb-e2e-helm-chart-${releaseName}`);
    await writeLocalChart({ chartRoot: chartDir, chartName });

    // Install a local, ConfigMap-only chart to avoid network/image-pull flakiness.
    const install = await helm([
      'install', releaseName, chartDir,
      '--namespace', namespace,
      '--set', 'testValue=1',
    ], { kubeconfigPath, homeDir, timeoutMs: 120_000 });

    if (install.code !== 0) {
      const details = (install.stderr || install.stdout || '').trim();
      throw new Error(`Helm install failed: ${details}`);
    }

    try {
      // Upgrade the release to create revision 2
      const upgrade = await helm([
        'upgrade', releaseName, chartDir,
        '--namespace', namespace,
        '--set', 'testValue=2',
      ], { kubeconfigPath, homeDir, timeoutMs: 120_000 });

      if (upgrade.code !== 0) {
        console.log('Helm upgrade failed:', upgrade.stdout, upgrade.stderr);
      }

      // Bootstrap app and navigate to Helm Releases
      const { sidebar } = await bootstrapApp({ page, contextName, namespace });
      await sidebar.goToSection('helmreleases');

      // Click on the release to open bottom panel
      const notifications = new Notifications(page);
      await notifications.waitForClear();

      const releaseRow = page.locator('table.gh-table tbody tr').filter({ hasText: releaseName });
      await expect(releaseRow).toBeVisible({ timeout: 60_000 });
      await releaseRow.click();

      const panel = new BottomPanel(page);
      await panel.expectVisible();

      // Go to History tab
      await panel.clickTab('History');

      // Prefer DOM locators for stability under parallel runs.
      await expect(panel.root.getByText(/loading history/i)).toBeHidden({ timeout: 30_000 });
      await panel.expectNoErrorText();

      const historyDomTable = panel.root.locator('table');
      await expect(historyDomTable).toBeVisible({ timeout: 30_000 });
      await expect(historyDomTable.locator('thead th', { hasText: /^Revision$/ })).toBeVisible({ timeout: 30_000 });

      const rows = historyDomTable.locator('tbody tr');
      await expect.poll(async () => await rows.count(), { timeout: 30_000 }).toBeGreaterThan(1);

      // Should show revision 2 (current) and revision 1 (previous)
      await expect(rows.nth(0).locator('td').first()).toContainText(/^2/i, { timeout: 30_000 });
      await expect(rows.nth(1).locator('td').first()).toHaveText(/^1$/i, { timeout: 30_000 });

      // Should have a rollback button for revision 1
      const rollbackBtn = rows.nth(1).getByRole('button', { name: /rollback/i });
      await expect(rollbackBtn).toBeVisible({ timeout: 30_000 });

    } finally {
      // Cleanup
      await helm(['uninstall', releaseName, '--namespace', namespace, '--ignore-not-found'], {
        kubeconfigPath,
        homeDir,
        timeoutMs: 60_000,
      }).catch(() => {});

      // Best-effort cleanup of temp chart dir.
      await fs.rm(chartDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
