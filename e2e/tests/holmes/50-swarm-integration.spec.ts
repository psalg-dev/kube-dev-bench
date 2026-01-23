import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmBottomPanel } from '../../src/pages/SwarmBottomPanel.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';

const fixtureStackName = 'kdb-e2e-fixtures';
const replicatedServiceName = `${fixtureStackName}_a-replicated`;

test.describe('Holmes Swarm Integration', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('analyzes Swarm service and task', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    await sidebar.expectVisible();

    await sidebar.goToServices();

    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const serviceRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    await expect(serviceRow).toBeVisible({ timeout: 60_000 });
    await serviceRow.click();

    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.expectTabs(['Holmes']);
    await panel.clickTab('Holmes');

    const analyzeBtn = panel.root.getByRole('button', { name: /analyze with holmes/i });
    await expect(analyzeBtn).toBeVisible({ timeout: 10_000 });
    await analyzeBtn.click();

    await expect(panel.root).toContainText(/Holmes Analysis|Analyzing|No analysis yet/i);

    await panel.closeByClickingOutside();

    await sidebar.goToTasks();
    const tasksTable = page.locator('[data-testid="swarm-tasks-table"]');
    const taskRow = tasksTable.locator('tbody tr').first();
    await expect(taskRow).toBeVisible({ timeout: 60_000 });
    await taskRow.click();

    await panel.expectVisible();
    await panel.clickTab('Holmes');

    const taskAnalyzeBtn = panel.root.getByRole('button', { name: /analyze with holmes/i });
    await expect(taskAnalyzeBtn).toBeVisible({ timeout: 10_000 });
    await taskAnalyzeBtn.click();

    await expect(panel.root).toContainText(/Holmes Analysis|Analyzing|No analysis yet/i);
  });
});
