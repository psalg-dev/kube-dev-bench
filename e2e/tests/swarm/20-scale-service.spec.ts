/**
 * E2E tests for scaling Docker Swarm services.
 * 
 * Prerequisites:
 * - Docker daemon running with Swarm mode enabled
 * - At least one replicated service deployed
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmBottomPanel, SwarmScaleDialog } from '../../src/pages/SwarmBottomPanel.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';

const fixtureStackName = 'kdb-e2e-fixtures';
const replicatedServiceName = `${fixtureStackName}_a-replicated`;

async function expectReplicasInServicesTable(page: import('@playwright/test').Page, expected: string) {
  const servicesTable = page.locator('[data-testid="swarm-services-table"]');
  const row = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
  const replicasCell = row.locator('td').nth(3);

  await expect
    .poll(async () => (await replicasCell.textContent())?.trim(), { timeout: 30_000 })
    .toBe(expected);
}

async function expectSwarmConnected(page: import('@playwright/test').Page) {
  const sidebar = new SwarmSidebarPage(page);
  await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 60_000 });
  return sidebar;
}

test.describe('Docker Swarm Service Scaling', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('shows scale button for replicated services', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const replicatedRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    await expect(replicatedRow).toBeVisible({ timeout: 60_000 });
    await replicatedRow.click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    
    // Look for scale button in summary tab
    await panel.clickTab('Summary');
    
    // Scale button should be visible for replicated services
    // For global services, it may be disabled or hidden
    const scaleBtn = panel.root.getByRole('button', { name: /scale/i });
    await expect(scaleBtn).toBeVisible({ timeout: 10_000 });
  });

  test('can scale service up', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const replicatedRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    await expect(replicatedRow).toBeVisible({ timeout: 60_000 });
    await replicatedRow.click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Summary');
    
    const scaleBtn = panel.root.getByRole('button', { name: /scale/i });

    await expect(scaleBtn).toBeVisible({ timeout: 10_000 });
    await expect(scaleBtn).toBeEnabled({ timeout: 10_000 });

    // Scale up then back down to avoid impacting other tests.
    await scaleBtn.click();
    const scaleDialogUp = new SwarmScaleDialog(page);
    await scaleDialogUp.expectVisible();
    await scaleDialogUp.setReplicas(2);
    await scaleDialogUp.confirm();

    await expectReplicasInServicesTable(page, '2');

    const notifications = new Notifications(page);
    await notifications.waitForClear();

    await panel.clickTab('Summary');
    await expect(scaleBtn).toBeEnabled({ timeout: 10_000 });
    await scaleBtn.click();
    const scaleDialogDown = new SwarmScaleDialog(page);
    await scaleDialogDown.expectVisible();
    await scaleDialogDown.setReplicas(1);
    await scaleDialogDown.confirm();

    await expectReplicasInServicesTable(page, '1');

    await notifications.waitForClear();
  });

  test('can scale service down', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const replicatedRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    await expect(replicatedRow).toBeVisible({ timeout: 60_000 });
    await replicatedRow.click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Summary');
    
    const scaleBtn = panel.root.getByRole('button', { name: /scale/i });

    await expect(scaleBtn).toBeVisible({ timeout: 10_000 });
    await expect(scaleBtn).toBeEnabled({ timeout: 10_000 });

    // Ensure we have something to scale down from.
    await scaleBtn.click();
    const scaleDialogUp = new SwarmScaleDialog(page);
    await scaleDialogUp.expectVisible();
    await scaleDialogUp.setReplicas(2);
    await scaleDialogUp.confirm();

    await expectReplicasInServicesTable(page, '2');

    await panel.clickTab('Summary');
    await expect(scaleBtn).toBeEnabled({ timeout: 10_000 });
    await scaleBtn.click();
    const scaleDialogDown = new SwarmScaleDialog(page);
    await scaleDialogDown.expectVisible();
    await scaleDialogDown.setReplicas(1);
    await scaleDialogDown.confirm();

    await expectReplicasInServicesTable(page, '1');

    const notifications = new Notifications(page);
    await notifications.waitForClear();
  });

  test('can cancel scale dialog', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const replicatedRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    await expect(replicatedRow).toBeVisible({ timeout: 60_000 });
    await replicatedRow.click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Summary');
    
    const scaleBtn = panel.root.getByRole('button', { name: /scale/i });

    await expect(scaleBtn).toBeVisible({ timeout: 10_000 });
    await expect(scaleBtn).toBeEnabled({ timeout: 10_000 });

    await scaleBtn.click();
    const scaleDialog = new SwarmScaleDialog(page);
    await scaleDialog.expectVisible();

    // Change value but cancel
    await scaleDialog.setReplicas(10);
    await scaleDialog.cancel();

    // Dialog should close, no changes made
    await scaleDialog.expectHidden();
  });

  test('validates scale input', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const replicatedRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    await expect(replicatedRow).toBeVisible({ timeout: 60_000 });
    await replicatedRow.click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Summary');
    
    const scaleBtn = panel.root.getByRole('button', { name: /scale/i });

    await expect(scaleBtn).toBeVisible({ timeout: 10_000 });
    await expect(scaleBtn).toBeEnabled({ timeout: 10_000 });

    await scaleBtn.click();
    const scaleDialog = new SwarmScaleDialog(page);
    await scaleDialog.expectVisible();

    // Try invalid value (negative)
    await scaleDialog.fillReplicasRaw('-1');

    // Current UI behavior: click Scale shows a warning and keeps dialog open
    await scaleDialog.submit();
    await expect(page.getByText(/replicas cannot be negative/i)).toBeVisible({ timeout: 30_000 });
    await scaleDialog.cancel();
  });
});
