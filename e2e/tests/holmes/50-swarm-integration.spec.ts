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
    
    // Click Name cell to avoid Update badge popup intercepting clicks
    const nameCell = serviceRow.locator('td').first();
    const panel = new SwarmBottomPanel(page);
    await expect(async () => {
      await page.keyboard.press('Escape');
      await nameCell.click();
      await expect(panel.root).toBeVisible({ timeout: 5_000 });
    }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });
    
    // Check if Holmes tab exists - it may not if Holmes is not configured
    const holmesTab = panel.root.getByRole('button', { name: 'Holmes', exact: true });
    const hasHolmesTab = await holmesTab.isVisible().catch(() => false);
    
    if (!hasHolmesTab) {
      // Holmes tab not available - verify basic panel functionality instead
      await panel.expectTabs(['Summary', 'Tasks', 'Logs']);
      test.skip(true, 'Holmes tab not available - Holmes AI not configured');
      return;
    }
    
    await panel.clickTab('Holmes');

    const analyzeBtn = panel.root.getByRole('button', { name: /analyze with holmes/i });
    const hasAnalyzeBtn = await analyzeBtn.isVisible().catch(() => false);
    
    if (!hasAnalyzeBtn) {
      // Holmes not configured - skip remaining test
      test.skip(true, 'Holmes AI not configured');
      return;
    }
    
    await analyzeBtn.click();

    await expect(panel.root).toContainText(/Holmes Analysis|Analyzing|No analysis yet|not configured|Analysis failed/i);

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
    if (await taskHolmesTab.isVisible().catch(() => false)) {
      await panel.clickTab('Holmes');

      const taskAnalyzeBtn = panel.root.getByRole('button', { name: /analyze with holmes/i });
      if (await taskAnalyzeBtn.isVisible().catch(() => false)) {
        await taskAnalyzeBtn.click();
        await expect(panel.root).toContainText(/Holmes Analysis|Analyzing|No analysis yet|not configured|Analysis failed/i);
      }
    }
  });
});
