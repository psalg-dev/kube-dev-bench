import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { helm } from '../src/support/kind.js';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

/**
 * Write a minimal local Helm chart for testing.
 * Creates a simple ConfigMap-only chart to avoid network/image-pull flakiness.
 */
async function writeLocalChart(opts: { chartRoot: string; chartName: string }) {
  const { chartRoot, chartName } = opts;
  const templatesDir = path.join(chartRoot, 'templates');
  await fs.mkdir(templatesDir, { recursive: true });

  const chartYaml = [
    'apiVersion: v2',
    `name: ${chartName}`,
    'description: Helm v4 E2E test chart',
    'type: application',
    'version: 0.1.0',
    'appVersion: "1.0.0"',
    '',
  ].join('\n');

  const valuesYaml = ['testValue: "initial"', 'timeout: 300', ''].join('\n');

  const cmYaml = [
    'apiVersion: v1',
    'kind: ConfigMap',
    'metadata:',
    '  name: {{ .Release.Name }}-v4test',
    'data:',
    '  testValue: {{ .Values.testValue | quote }}',
    '  timeout: {{ .Values.timeout | quote }}',
    '',
  ].join('\n');

  await Promise.all([
    fs.writeFile(path.join(chartRoot, 'Chart.yaml'), chartYaml, 'utf-8'),
    fs.writeFile(path.join(chartRoot, 'values.yaml'), valuesYaml, 'utf-8'),
    fs.writeFile(path.join(templatesDir, 'configmap.yaml'), cmYaml, 'utf-8'),
  ]);
}

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test.describe('Helm v4 Features', () => {
  test.describe('Helm v4 API Compatibility', () => {
    test('release list correctly shows chart metadata via v4 accessor', async ({ page, contextName, namespace, kubeconfigPath, homeDir }) => {
      test.setTimeout(300_000);

      const helmVersion = await helm(['version', '--short'], { kubeconfigPath, homeDir, timeoutMs: 20_000 });
      if (helmVersion.code === 127) {
        if (process.env.E2E_SKIP_HELM === '1') {
          test.skip(true, 'Helm CLI not found on PATH; skipping because E2E_SKIP_HELM=1');
          return;
        }
        throw new Error('Helm CLI not found on PATH. Install helm or set E2E_SKIP_HELM=1 to skip Helm E2Es.');
      }

      const releaseName = uniqueName('e2e-v4-accessor');
      const chartName = 'kdb-v4-accessor-chart';
      const chartDir = path.join(os.tmpdir(), `kdb-e2e-v4-accessor-${releaseName}`);
      await writeLocalChart({ chartRoot: chartDir, chartName });

      // Install the chart
      const install = await helm([
        'install', releaseName, chartDir,
        '--namespace', namespace,
      ], { kubeconfigPath, homeDir, timeoutMs: 120_000 });

      if (install.code !== 0) {
        const details = (install.stderr || install.stdout || '').trim();
        throw new Error(`Helm install failed: ${details}`);
      }

      try {
        const { sidebar } = await bootstrapApp({ page, contextName, namespace });
        await sidebar.goToSection('helmreleases');

        await expect(page.locator('h2.overview-title:visible')).toHaveText(/helm releases/i, { timeout: 60_000 });

        // Find the release row
        const releaseRow = page
          .locator('table.gh-table tbody tr')
          .filter({ has: page.getByRole('cell', { name: releaseName, exact: true }) });
        await expect(releaseRow).toBeVisible({ timeout: 60_000 });

        // Verify chart metadata is displayed correctly (via v4 accessor pattern)
        // The chart name should appear in the Chart column
        await expect(releaseRow.getByRole('cell', { name: chartName })).toBeVisible({ timeout: 10_000 });

        // Status should be deployed
        await expect(releaseRow).toContainText('deployed', { timeout: 10_000 });

        // Verify the release shows in the UI (v4 accessor pattern verification)
        // Click the row to open the bottom panel and verify details there
        await releaseRow.click();
        await expect(page.locator('.bottom-panel')).toBeVisible({ timeout: 30_000 });

        // The bottom panel summary should show chart version and app version details
        const panelDetails = page.locator('.bottom-panel');
        await expect(panelDetails).toContainText(chartName, { timeout: 10_000 });

      } finally {
        await helm(['uninstall', releaseName, '--namespace', namespace, '--ignore-not-found'], {
          kubeconfigPath,
          homeDir,
          timeoutMs: 60_000,
        }).catch(() => {});
        await fs.rm(chartDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    test('release history correctly shows revisions via v4 accessor', async ({ page, contextName, namespace, kubeconfigPath, homeDir }) => {
      test.setTimeout(360_000);

      const helmVersion = await helm(['version', '--short'], { kubeconfigPath, homeDir, timeoutMs: 20_000 });
      if (helmVersion.code === 127) {
        if (process.env.E2E_SKIP_HELM === '1') {
          test.skip(true, 'Helm CLI not found on PATH; skipping because E2E_SKIP_HELM=1');
          return;
        }
        throw new Error('Helm CLI not found on PATH. Install helm or set E2E_SKIP_HELM=1 to skip Helm E2Es.');
      }

      const releaseName = uniqueName('e2e-v4-history');
      const chartName = 'kdb-v4-history-chart';
      const chartDir = path.join(os.tmpdir(), `kdb-e2e-v4-history-${releaseName}`);
      await writeLocalChart({ chartRoot: chartDir, chartName });

      // Install
      const install = await helm([
        'install', releaseName, chartDir,
        '--namespace', namespace,
        '--set', 'testValue=v1',
      ], { kubeconfigPath, homeDir, timeoutMs: 120_000 });

      if (install.code !== 0) {
        throw new Error(`Helm install failed: ${install.stderr || install.stdout}`);
      }

      // Upgrade to create revision 2
      const upgrade = await helm([
        'upgrade', releaseName, chartDir,
        '--namespace', namespace,
        '--set', 'testValue=v2',
      ], { kubeconfigPath, homeDir, timeoutMs: 120_000 });

      if (upgrade.code !== 0) {
        console.log('Helm upgrade failed:', upgrade.stderr || upgrade.stdout);
      }

      try {
        const { sidebar } = await bootstrapApp({ page, contextName, namespace });
        await sidebar.goToSection('helmreleases');

        await expect(page.locator('h2.overview-title:visible')).toHaveText(/helm releases/i, { timeout: 60_000 });

        // Open release details
        const releaseRow = page
          .locator('table.gh-table tbody tr')
          .filter({ has: page.getByRole('cell', { name: releaseName, exact: true }) });
        await expect(releaseRow).toBeVisible({ timeout: 60_000 });
        await releaseRow.click();

        const panel = page.locator('.bottom-panel');
        await expect(panel).toBeVisible({ timeout: 30_000 });

        // Go to History tab
        const historyTab = panel.getByRole('button', { name: /history/i }).or(panel.locator('[data-tab="history"]'));
        await historyTab.click();

        // Wait for history to load
        await expect(panel.getByText(/loading history/i)).toBeHidden({ timeout: 30_000 });

        // Verify history table shows correctly (via v4 accessor)
        const historyTable = panel.locator('table');
        await expect(historyTable).toBeVisible({ timeout: 30_000 });

        const rows = historyTable.locator('tbody tr');
        await expect.poll(async () => await rows.count(), { timeout: 30_000 }).toBeGreaterThanOrEqual(2);

        // Revision 2 (current) should be first
        await expect(rows.first().locator('td').first()).toContainText('2', { timeout: 10_000 });

        // Revision 1 should be second
        await expect(rows.nth(1).locator('td').first()).toContainText('1', { timeout: 10_000 });

        // Both should show the chart name (the format may vary, so just check for chart name)
        await expect(rows.first()).toContainText(chartName, { timeout: 10_000 });

      } finally {
        await helm(['uninstall', releaseName, '--namespace', namespace, '--ignore-not-found'], {
          kubeconfigPath,
          homeDir,
          timeoutMs: 60_000,
        }).catch(() => {});
        await fs.rm(chartDir, { recursive: true, force: true }).catch(() => {});
      }
    });

    test('installs chart with wait options and verifies in UI', async ({ page, contextName, namespace, kubeconfigPath, homeDir }) => {
      test.setTimeout(300_000);

      const helmVersion = await helm(['version', '--short'], { kubeconfigPath, homeDir, timeoutMs: 20_000 });
      if (helmVersion.code === 127) {
        if (process.env.E2E_SKIP_HELM === '1') {
          test.skip(true, 'Helm CLI not found on PATH; skipping because E2E_SKIP_HELM=1');
          return;
        }
        throw new Error('Helm CLI not found on PATH. Install helm or set E2E_SKIP_HELM=1 to skip Helm E2Es.');
      }

      const releaseName = uniqueName('e2e-v4-watcher');
      const chartName = 'kdb-v4-watcher-chart';
      const chartDir = path.join(os.tmpdir(), `kdb-e2e-v4-watcher-${releaseName}`);
      await writeLocalChart({ chartRoot: chartDir, chartName });

      try {
        // Install using helm CLI with wait options
        const install = await helm([
          'install', releaseName, chartDir,
          '--namespace', namespace,
          '--set', 'testValue=watcher-test',
          '--wait',
          '--timeout', '2m',
        ], { kubeconfigPath, homeDir, timeoutMs: 180_000 });

        if (install.code !== 0) {
          const details = (install.stderr || install.stdout || '').trim();
          throw new Error(`Helm install failed: ${details}`);
        }

        // Verify in UI
        const { sidebar } = await bootstrapApp({ page, contextName, namespace });
        await sidebar.goToSection('helmreleases');

        await expect(page.locator('h2.overview-title:visible')).toHaveText(/helm releases/i, { timeout: 60_000 });

        // Verify release appears and is deployed
        const releaseRow = page
          .locator('table.gh-table tbody tr')
          .filter({ has: page.getByRole('cell', { name: releaseName, exact: true }) });
        await expect(releaseRow).toBeVisible({ timeout: 60_000 });
        await expect(releaseRow).toContainText('deployed', { timeout: 30_000 });

        // Click to open details
        await releaseRow.click();

        const panel = page.locator('.bottom-panel');
        await expect(panel).toBeVisible({ timeout: 30_000 });

        // Verify release shows in summary
        await expect(panel).toContainText(releaseName, { timeout: 10_000 });
        await expect(panel).toContainText(chartName, { timeout: 10_000 });

      } finally {
        await helm(['uninstall', releaseName, '--namespace', namespace, '--ignore-not-found'], {
          kubeconfigPath,
          homeDir,
          timeoutMs: 60_000,
        }).catch(() => {});
        await fs.rm(chartDir, { recursive: true, force: true }).catch(() => {});
      }
    });
  });
});
