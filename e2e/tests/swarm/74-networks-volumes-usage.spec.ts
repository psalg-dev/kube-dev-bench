import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';

const fixtureNetworkName = 'kdb_e2e_net';
const fixtureStackName = 'kdb-e2e-fixtures';
const fixtureServiceA = `${fixtureStackName}_a-replicated`;
const fixtureServiceB = `${fixtureStackName}_b-logger`;
const fixtureVolumeName = `${fixtureStackName}_e2e_data`;

test.describe('Docker Swarm Networks + Volumes Usage', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
  });

  test('networks tabs render (services/containers/inspect) and summary shows IPAM + Options', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    await sidebar.goToNetworks();

    const table = page.locator('[data-testid="swarm-networks-table"]');
    await expect(table).toBeVisible({ timeout: 60_000 });

    const row = table.locator('tbody tr').filter({ hasText: fixtureNetworkName }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.click();

    const panelRoot = page.locator('.bottom-panel').filter({ hasText: fixtureNetworkName }).first();
    await expect(panelRoot).toBeVisible({ timeout: 30_000 });

    // Summary should show IPAM and Options sections.
    await panelRoot.getByRole('button', { name: 'Summary', exact: true }).click();
    await expect(panelRoot.getByText('IPAM', { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(panelRoot.getByText('Options', { exact: true })).toBeVisible({ timeout: 60_000 });

    // Connected Services tab shows expected services.
    await panelRoot.getByRole('button', { name: 'Connected Services', exact: true }).click();
    await expect(panelRoot.getByText(fixtureServiceA)).toBeVisible({ timeout: 60_000 });
    await expect(panelRoot.getByText(fixtureServiceB)).toBeVisible({ timeout: 60_000 });

    // Containers tab renders and has at least one row/task.
    await panelRoot.getByRole('button', { name: 'Containers', exact: true }).click();
    await expect(panelRoot.getByText('Containers (Tasks)', { exact: true })).toBeVisible({ timeout: 60_000 });

    // Inspect tab loads JSON.
    await panelRoot.getByRole('button', { name: 'Inspect', exact: true }).click();
    await expect(panelRoot.locator('.cm-content').first()).toContainText('{', { timeout: 60_000 });
  });

  test('volume used-by shows service; delete is guarded when in use', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    await sidebar.goToVolumes();

    const table = page.locator('[data-testid="swarm-volumes-table"]');
    await expect(table).toBeVisible({ timeout: 60_000 });

    const row = table.locator('tbody tr').filter({ hasText: fixtureVolumeName }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.click();

    const panelRoot = page.locator('.bottom-panel').filter({ hasText: fixtureVolumeName }).first();
    await expect(panelRoot).toBeVisible({ timeout: 30_000 });

    await panelRoot.getByRole('button', { name: 'Summary', exact: true }).click();

    // Used By section should list the service that mounts the volume.
    await expect(panelRoot.getByText('Used By', { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(panelRoot.getByText(fixtureServiceB)).toBeVisible({ timeout: 60_000 });

    // Delete is guarded: depending on UI path, this may be a browser confirm dialog and/or a modal.
    let sawConfirmDialog = false;
    page.once('dialog', async (d) => {
      sawConfirmDialog = true;
      if (d.type() === 'confirm') await d.dismiss();
      else await d.dismiss();
    });

    await panelRoot.getByRole('button', { name: 'Delete', exact: true }).click();

    // If an in-app confirmation modal exists, close it (best-effort).
    const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
    } else if (!sawConfirmDialog) {
      await page.keyboard.press('Escape').catch(() => undefined);
    }

    // Volume should still exist (we never confirmed deletion).
    await expect(table.locator('tbody tr').filter({ hasText: fixtureVolumeName }).first()).toBeVisible({ timeout: 60_000 });
  });
});
