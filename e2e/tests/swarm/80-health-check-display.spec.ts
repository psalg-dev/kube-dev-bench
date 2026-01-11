/**
 * E2E tests for Docker Swarm health check status display.
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

test.describe('Docker Swarm Health Check Display', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('tasks table includes Health column', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToTasks();

    const tasksTable = page.locator('[data-testid="swarm-tasks-table"]');
    await expect(tasksTable).toBeVisible({ timeout: 30_000 });

    await expect(tasksTable.getByRole('columnheader', { name: /^health$/i })).toBeVisible({ timeout: 10_000 });
  });

  test('task details panel shows Health Check section', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToTasks();

    const tasksTable = page.locator('[data-testid="swarm-tasks-table"]');
    await expect(tasksTable).toBeVisible({ timeout: 30_000 });

    const detailsButtons = await waitForAnyRow(tasksTable, 90_000);
    await detailsButtons.first().click();

    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();

    await expect(panel.root.getByText(/health check/i).first()).toBeVisible({ timeout: 10_000 });
    await expect(panel.root.getByText(/recent results/i).first()).toBeVisible({ timeout: 10_000 });
  });
});
