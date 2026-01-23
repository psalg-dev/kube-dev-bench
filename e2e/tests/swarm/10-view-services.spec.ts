/**
 * E2E tests for Docker Swarm Services view.
 * 
 * Prerequisites:
 * - Docker daemon running with Swarm mode enabled
 * - At least one service deployed (or tests will create one)
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmBottomPanel } from '../../src/pages/SwarmBottomPanel.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';

const fixtureStackName = 'kdb-e2e-fixtures';
const replicatedServiceName = `${fixtureStackName}_a-replicated`;
const loggerServiceName = `${fixtureStackName}_b-logger`;

async function expectSwarmConnected(page: import('@playwright/test').Page) {
  const sidebar = new SwarmSidebarPage(page);
  await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 60_000 });
  return sidebar;
}

test.describe('Docker Swarm Services', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
    // Ensure no leftover panels from previous tests
    await SwarmBottomPanel.ensureClosed(page);
  });

  test('displays services table', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    
    // Verify services table is visible
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    await expect(servicesTable).toBeVisible({ timeout: 30_000 });
    
    // Verify table headers
    await expect(servicesTable.getByRole('columnheader', { name: /name/i })).toBeVisible();
    await expect(servicesTable.getByRole('columnheader', { name: /image/i })).toBeVisible();
    await expect(servicesTable.getByRole('columnheader', { name: /replicas/i })).toBeVisible();

    // Verify deterministic fixture services from stack.yml
    const replicatedRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    const loggerRow = servicesTable.locator('tbody tr').filter({ hasText: loggerServiceName }).first();
    await expect(replicatedRow).toBeVisible({ timeout: 60_000 });
    await expect(loggerRow).toBeVisible({ timeout: 60_000 });
  });

  test('shows service count in sidebar', async ({ page }) => {
    await expectSwarmConnected(page);

    // Check that services section shows a count (number or dash)
    const servicesSection = page.locator('#section-swarm-services');
    await expect(servicesSection).toBeVisible();
    
    // The count should be visible (either a number or '-')
    const countText = await servicesSection.locator('span').last().textContent();
    expect(countText).toBeDefined();
  });

  test('opens service details panel on row click', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    
    // Wait for table to load
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const replicatedRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    await expect(replicatedRow).toBeVisible({ timeout: 60_000 });

    // Click Name cell (first td) to avoid Update badge popup intercepting clicks
    const nameCell = replicatedRow.locator('td').first();
    const panel = new SwarmBottomPanel(page);
    await expect(async () => {
      await page.keyboard.press('Escape'); // Close any popups
      await nameCell.click();
      await expect(panel.root).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
    
    // Verify expected tabs
    await panel.expectTabs(['Summary', 'Tasks', 'Logs', 'Holmes']);
  });

  test('service details panel shows Summary tab content', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const replicatedRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    await expect(replicatedRow).toBeVisible({ timeout: 60_000 });
    
    // Click Name cell to avoid Update badge popup intercepting clicks
    const nameCell = replicatedRow.locator('td').first();
    const panel = new SwarmBottomPanel(page);
    await expect(async () => {
      await page.keyboard.press('Escape');
      await nameCell.click();
      await expect(panel.root).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
    
    await panel.clickTab('Summary');
    
    // Should show deterministic service info from stack.yml
    // Note: the Summary header intentionally no longer renders the service name.
    await expect(panel.root.getByText(/quick info/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(panel.root.getByText(/service id/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(panel.root.getByText(/nginx:alpine/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('service details panel shows Tasks tab', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const replicatedRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    await expect(replicatedRow).toBeVisible({ timeout: 60_000 });
    
    // Click Name cell to avoid Update badge popup intercepting clicks
    const nameCell = replicatedRow.locator('td').first();
    const panel = new SwarmBottomPanel(page);
    await expect(async () => {
      await page.keyboard.press('Escape');
      await nameCell.click();
      await expect(panel.root).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
    
    await panel.clickTab('Tasks');
    
    // Should show tasks list or table
    await panel.expectTasksVisible();
  });

  test('service details panel shows Logs tab', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const loggerRow = servicesTable.locator('tbody tr').filter({ hasText: loggerServiceName }).first();
    await expect(loggerRow).toBeVisible({ timeout: 60_000 });
    
    // Click Name cell to avoid Update badge popup intercepting clicks
    const nameCell = loggerRow.locator('td').first();
    const panel = new SwarmBottomPanel(page);
    await expect(async () => {
      await page.keyboard.press('Escape');
      await nameCell.click();
      await expect(panel.root).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
    
    await panel.clickTab('Logs');
    
    // Should show logs content from the deterministic log-producing service
    await panel.expectLogsVisible();
    await expect(panel.root.getByText(/kdb-e2e log/i).first()).toBeVisible({ timeout: 30_000 });
  });

  test('closes bottom panel by clicking outside', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const replicatedRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    await expect(replicatedRow).toBeVisible({ timeout: 60_000 });
    
    // Click Name cell to avoid Update badge popup intercepting clicks
    const nameCell = replicatedRow.locator('td').first();
    const panel = new SwarmBottomPanel(page);
    await expect(async () => {
      await page.keyboard.press('Escape');
      await nameCell.click();
      await expect(panel.root).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
    
    // Close by clicking outside
    await panel.closeByClickingOutside();
    await panel.expectHidden();
  });
});
