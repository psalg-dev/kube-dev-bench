import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { helm } from '../src/support/kind.js';
import { BottomPanel } from '../src/pages/BottomPanel.js';
import { Notifications } from '../src/pages/Notifications.js';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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
  test('installs, views, and uninstalls a Helm release', async ({ page, contextName, namespace, kubeconfigPath }) => {
    test.setTimeout(300_000); // 5 minutes for full Helm workflow

    // Helm operation tests require the helm CLI. Locally we skip if it's missing,
    // but in CI we fail fast so the environment gets fixed.
    const helmVersion = await helm(['version', '--short'], { kubeconfigPath, timeoutMs: 20_000 });
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

    // Add bitnami repo if not exists
    const repoAdd = await helm(['repo', 'add', 'bitnami', 'https://charts.bitnami.com/bitnami', '--force-update'], {
      kubeconfigPath,
      timeoutMs: 60_000,
    });
    if (repoAdd.code !== 0 && !repoAdd.stderr.includes('already exists')) {
      console.log('Helm repo add output:', repoAdd.stdout, repoAdd.stderr);
    }

    // Update repos
    await helm(['repo', 'update'], { kubeconfigPath, timeoutMs: 120_000 });

    // Install a minimal chart (nginx is relatively fast to install)
    const install = await helm([
      'install', releaseName, 'bitnami/nginx',
      '--namespace', namespace,
      '--set', 'service.type=ClusterIP',
      '--set', 'replicaCount=1',
      '--wait',
      '--timeout', '180s',
    ], { kubeconfigPath, timeoutMs: 240_000 });

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
          await expect(panel.root).toContainText('nginx');
        } else if (tab === 'Values') {
          // Values tab should have a checkbox for "Show all values"
          await expect(panel.root.getByText(/show all values/i)).toBeVisible({ timeout: 10_000 });
        } else if (tab === 'History') {
          // History tab should show revision 1
          await expect(panel.root.getByText('1')).toBeVisible({ timeout: 10_000 });
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
        timeoutMs: 60_000,
      }).catch(() => {});
    }
  });

  test('shows release history with rollback option', async ({ page, contextName, namespace, kubeconfigPath }) => {
    test.setTimeout(360_000); // 6 minutes for upgrade and rollback test

    // Helm operation tests require the helm CLI. Locally we skip if it's missing,
    // but in CI we fail fast so the environment gets fixed.
    const helmVersion = await helm(['version', '--short'], { kubeconfigPath, timeoutMs: 20_000 });
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

    // Add bitnami repo if not exists
    await helm(['repo', 'add', 'bitnami', 'https://charts.bitnami.com/bitnami', '--force-update'], {
      kubeconfigPath,
      timeoutMs: 60_000,
    });
    await helm(['repo', 'update'], { kubeconfigPath, timeoutMs: 120_000 });

    // Install chart
    const install = await helm([
      'install', releaseName, 'bitnami/nginx',
      '--namespace', namespace,
      '--set', 'service.type=ClusterIP',
      '--set', 'replicaCount=1',
      '--wait',
      '--timeout', '180s',
    ], { kubeconfigPath, timeoutMs: 240_000 });

    if (install.code !== 0) {
      test.skip(true, 'Helm install failed - skipping test');
      return;
    }

    try {
      // Upgrade the release to create revision 2
      const upgrade = await helm([
        'upgrade', releaseName, 'bitnami/nginx',
        '--namespace', namespace,
        '--set', 'service.type=ClusterIP',
        '--set', 'replicaCount=2',
        '--wait',
        '--timeout', '180s',
      ], { kubeconfigPath, timeoutMs: 240_000 });

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

      // Should show revision 2 (current) and revision 1 (previous)
      await expect(panel.root.getByText('2')).toBeVisible({ timeout: 10_000 });
      await expect(panel.root.getByText('(current)')).toBeVisible({ timeout: 10_000 });

      // Should have a rollback button for revision 1
      const rollbackBtn = panel.root.getByRole('button', { name: /rollback/i });
      await expect(rollbackBtn).toBeVisible({ timeout: 10_000 });

    } finally {
      // Cleanup
      await helm(['uninstall', releaseName, '--namespace', namespace, '--ignore-not-found'], {
        kubeconfigPath,
        timeoutMs: 60_000,
      }).catch(() => {});
    }
  });
});
