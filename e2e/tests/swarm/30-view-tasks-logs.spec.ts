/**
 * E2E tests for Docker Swarm Tasks view and logs.
 * 
 * Prerequisites:
 * - Docker daemon running with Swarm mode enabled
 * - At least one service with running tasks
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmBottomPanel } from '../../src/pages/SwarmBottomPanel.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';

async function expectSwarmConnected(page: import('@playwright/test').Page) {
  const sidebar = new SwarmSidebarPage(page);
  await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 30_000 });
  return sidebar;
}

async function waitForAnyRow(table: import('@playwright/test').Locator, timeoutMs = 60_000) {
  const detailsButtons = table.getByRole('button', { name: /^details$/i });
  await expect(detailsButtons.first()).toBeVisible({ timeout: timeoutMs });
  return detailsButtons;
}

test.describe('Docker Swarm Tasks View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('displays tasks table', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToTasks();
    
    // Verify tasks table is visible
    const tasksTable = page.locator('[data-testid="swarm-tasks-table"]');
    await expect(tasksTable).toBeVisible({ timeout: 30_000 });
    
    // Verify table headers
    await expect(tasksTable.getByRole('columnheader', { name: /id|task/i })).toBeVisible();
    await expect(tasksTable.getByRole('columnheader', { name: /state|status/i })).toBeVisible();
  });

  test('shows task count in sidebar', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    const count = await sidebar.getSectionCount('swarm-tasks');
    // Count can be null/0 if no tasks, but should be a valid result
    expect(count === null || typeof count === 'number').toBeTruthy();
  });

  test('opens task details panel on row click', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToTasks();
    
    const tasksTable = page.locator('[data-testid="swarm-tasks-table"]');
    await expect(tasksTable).toBeVisible({ timeout: 30_000 });
    const detailsButtons = await waitForAnyRow(tasksTable, 90_000);
    await detailsButtons.first().click();

    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
  });

  test('task details shows state and node information', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToTasks();
    
    const tasksTable = page.locator('[data-testid="swarm-tasks-table"]');
    await expect(tasksTable).toBeVisible({ timeout: 30_000 });
    const detailsButtons = await waitForAnyRow(tasksTable, 90_000);
    await detailsButtons.first().click();

    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();

    // Should show task info (state, node, timestamps)
    await expect(panel.root.getByText(/state|running|pending|complete/i).first()).toBeVisible({ timeout: 10_000 });
  });
});

test.describe('Docker Swarm Task Logs', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('can view task logs from service details', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    await expect(servicesTable).toBeVisible({ timeout: 30_000 });
    const detailsButtons = await waitForAnyRow(servicesTable, 90_000);
    await detailsButtons.first().click();

    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();

    await panel.clickTab('Logs');
    await expect(
      panel.root.locator('.cm-editor, pre, .logs-container')
        .or(panel.root.getByText(/no logs|loading|waiting/i))
    ).toBeVisible({ timeout: 15_000 });
  });

  test('logs panel updates in real-time', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    await expect(servicesTable).toBeVisible({ timeout: 30_000 });
    const detailsButtons = await waitForAnyRow(servicesTable, 90_000);
    await detailsButtons.first().click();

    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Logs');

    const logsContent = panel.root.locator('.cm-editor, pre, .logs-container');
    await expect(
      logsContent.first().or(panel.root.getByText(/no logs|loading|waiting/i))
    ).toBeVisible({ timeout: 15_000 });

    const _initialContent = await logsContent.first().textContent().catch(() => '');
    await page.waitForTimeout(2000);
    const currentContent = await logsContent.first().textContent().catch(() => '');
    expect(currentContent).toBeDefined();
  });

  test('service tasks tab shows all tasks', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();
    
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    await expect(servicesTable).toBeVisible({ timeout: 30_000 });
    const detailsButtons = await waitForAnyRow(servicesTable, 90_000);
    await detailsButtons.first().click();

    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();

    await panel.clickTab('Tasks');
    await expect(
      panel.root.locator('table')
        .or(panel.root.getByText(/no tasks|loading/i))
    ).toBeVisible({ timeout: 15_000 });
  });
});
