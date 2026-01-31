import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmBottomPanel } from '../../src/pages/SwarmBottomPanel.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';
import { configureHolmesMock } from '../../src/support/holmes-bootstrap.js';

const fixtureStackName = 'kdb-e2e-fixtures';
const replicatedServiceName = `${fixtureStackName}_a-replicated`;

test.describe('Holmes Swarm Integration', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
    await configureHolmesMock({ page });
  });

  test('analyzes Swarm service and task', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    await sidebar.expectVisible();

    await sidebar.goToServices();

    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const serviceRow = servicesTable.locator('tbody tr').filter({ hasText: replicatedServiceName }).first();
    await expect(serviceRow).toBeVisible({ timeout: 60_000 });
    
    // Click Name cell to avoid Update badge popup intercepting clicks
    const nameCell = serviceRow.locator('td').first();
    const panel = new SwarmBottomPanel(page);
    await expect(async () => {
      await page.keyboard.press('Escape');
      await nameCell.click();
      await expect(panel.root).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
    
    const holmesTab = panel.root.getByRole('button', { name: 'Holmes', exact: true });
    await expect(holmesTab).toBeVisible({ timeout: 10_000 });
    await panel.clickTab('Holmes');

    const analyzeBtn = panel.root.getByRole('button', { name: /analyze with holmes/i });
    await expect(analyzeBtn).toBeVisible({ timeout: 10_000 });
    await analyzeBtn.click();

    await expect(panel.root).toContainText(/Swarm Service Analysis|Holmes Analysis|Analyzing/i);

    await panel.closeByClickingOutside();

    await sidebar.goToTasks();
    const tasksTable = page.locator('[data-testid="swarm-tasks-table"]');
    const taskRow = tasksTable.locator('tbody tr').first();
    await expect(taskRow).toBeVisible({ timeout: 60_000 });
    
    // Click first td to avoid popups intercepting clicks
    const taskNameCell = taskRow.locator('td').first();
    await expect(async () => {
      await page.keyboard.press('Escape');
      await taskNameCell.click();
      await expect(panel.root).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
    
    const taskHolmesTab = panel.root.getByRole('button', { name: 'Holmes', exact: true });
    await expect(taskHolmesTab).toBeVisible({ timeout: 10_000 });
    await panel.clickTab('Holmes');

    const taskAnalyzeBtn = panel.root.getByRole('button', { name: /analyze with holmes/i });
    await expect(taskAnalyzeBtn).toBeVisible({ timeout: 10_000 });
    await taskAnalyzeBtn.click();
    await expect(panel.root).toContainText(/Swarm Service Analysis|Holmes Analysis|Analyzing/i);
  });
});
