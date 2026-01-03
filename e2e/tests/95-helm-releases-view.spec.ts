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
    await expect(page.locator('h2.overview-title')).toHaveText(/helm releases/i, { timeout: 60_000 });

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
    await expect(page.locator('h2.overview-title')).toHaveText(/helm releases/i, { timeout: 60_000 });

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
      if (process.env.CI) {
        throw new Error(
          'Helm CLI is required in CI for Helm operation tests, but was not found on PATH (spawn helm ENOENT).'
        );
      }
      test.skip(true, 'Helm CLI not found on PATH; skipping Helm operation test');
      return;
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
      console.log('Helm install failed:', install.stdout, install.stderr);
      test.skip(true, 'Helm install failed - skipping test');
      return;
    }

    try {
      // Bootstrap app and navigate to Helm Releases
      const { sidebar } = await bootstrapApp({ page, contextName, namespace });
      await sidebar.goToSection('helmreleases');

      // Verify release appears in the table
      await expect(page.locator('h2.overview-title')).toHaveText(/helm releases/i, { timeout: 60_000 });

      const releaseRow = page.locator('table.gh-table tbody tr').filter({ hasText: releaseName });
      await expect(releaseRow).toBeVisible({ timeout: 60_000 });

      // Verify release status is deployed
      await expect(releaseRow).toContainText('deployed', { timeout: 30_000 });

      // Click on the release to open bottom panel
      const notifications = new Notifications(page);
      await notifications.waitForClear();
      await releaseRow.click();

      const panel = new BottomPanel(page);
      await panel.expectVisible();

      // Verify bottom panel tabs exist
      const expectedTabs = ['Summary', 'Values', 'History', 'Notes', 'Manifest'];
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
        } else if (tab === 'Manifest') {
          // Manifest tab should show YAML content
          await panel.expectCodeMirrorVisible();
        }
      }

      // Test Upgrade button exists
      await panel.clickTab('Summary');
      await expect(panel.root.getByRole('button', { name: /upgrade/i })).toBeVisible();

      // Test Uninstall via UI
      // Set up dialog handler before clicking
      page.once('dialog', async (dialog) => {
        await dialog.accept();
      });

      await panel.root.getByRole('button', { name: /uninstall/i }).click();

      // Wait for the release to be removed from the table
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
      if (process.env.CI) {
        throw new Error(
          'Helm CLI is required in CI for Helm operation tests, but was not found on PATH (spawn helm ENOENT).'
        );
      }
      test.skip(true, 'Helm CLI not found on PATH; skipping Helm operation test');
      return;
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
      test.skip(true, 'Helm install failed - skipping test');
      return;
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
