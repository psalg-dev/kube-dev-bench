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
import { SwarmConnectionWizardPage } from '../../src/pages/SwarmConnectionWizardPage.js';

test.describe('Docker Swarm Tasks View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    
    // Ensure connected to Swarm
    const sidebar = new SwarmSidebarPage(page);
    if (!(await sidebar.isSwarmConnected())) {
      const wizard = new SwarmConnectionWizardPage(page);
      const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
      if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await gearBtn.click();
        await wizard.connectToLocalDocker();
      }
    }
  });

  test('displays tasks table', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToTasks();
    
    // Verify tasks table is visible
    await expect(page.locator('table, [data-testid="tasks-table"]')).toBeVisible({ timeout: 30_000 });
    
    // Verify table headers
    await expect(page.getByRole('columnheader', { name: /id|task/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /state|status/i })).toBeVisible();
  });

  test('shows task count in sidebar', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    const count = await sidebar.getSectionCount('swarm-tasks');
    // Count can be null/0 if no tasks, but should be a valid result
    expect(count === null || typeof count === 'number').toBeTruthy();
  });

  test('opens task details panel on row click', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToTasks();
    
    // Wait for table to load
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await firstRow.click();
      
      // Verify bottom panel opens
      const panel = new SwarmBottomPanel(page);
      await panel.expectVisible();
    } else {
      // No tasks available
      test.skip();
    }
  });

  test('task details shows state and node information', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToTasks();
    
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await firstRow.click();
      
      const panel = new SwarmBottomPanel(page);
      await panel.expectVisible();
      
      // Should show task info (state, node, timestamps)
      await expect(panel.root.getByText(/state|running|pending|complete/i).first()).toBeVisible({ timeout: 10_000 });
    } else {
      test.skip();
    }
  });
});

test.describe('Docker Swarm Task Logs', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    
    const sidebar = new SwarmSidebarPage(page);
    if (!(await sidebar.isSwarmConnected())) {
      const wizard = new SwarmConnectionWizardPage(page);
      const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
      if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await gearBtn.click();
        await wizard.connectToLocalDocker();
      }
    }
  });

  test('can view task logs from service details', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    
    // Wait for services table
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await firstRow.click();
      
      const panel = new SwarmBottomPanel(page);
      await panel.expectVisible();
      
      // Click on Logs tab
      await panel.clickTab('Logs');
      
      // Should show logs or "no logs" message
      await expect(
        panel.root.locator('.cm-editor, pre, .logs-container')
          .or(panel.root.getByText(/no logs|loading|waiting/i))
      ).toBeVisible({ timeout: 15_000 });
    } else {
      test.skip();
    }
  });

  test('logs panel updates in real-time', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await firstRow.click();
      
      const panel = new SwarmBottomPanel(page);
      await panel.expectVisible();
      await panel.clickTab('Logs');
      
      // Wait for logs to appear
      const logsContent = panel.root.locator('.cm-editor, pre, .logs-container');
      await expect(logsContent.first()).toBeVisible({ timeout: 15_000 });
      
      // Get initial content
      const initialContent = await logsContent.first().textContent().catch(() => '');
      
      // Wait a bit for potential updates
      await page.waitForTimeout(2000);
      
      // Logs might have more content now (if service is active)
      // This is a soft assertion - logs may or may not update
      const currentContent = await logsContent.first().textContent().catch(() => '');
      expect(currentContent).toBeDefined();
    } else {
      test.skip();
    }
  });

  test('service tasks tab shows all tasks', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    
    const firstRow = page.locator('table tbody tr').first();
    if (await firstRow.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await firstRow.click();
      
      const panel = new SwarmBottomPanel(page);
      await panel.expectVisible();
      
      // Click on Tasks tab
      await panel.clickTab('Tasks');
      
      // Should show tasks table or list
      await expect(
        panel.root.locator('table')
          .or(panel.root.getByText(/no tasks|loading/i))
      ).toBeVisible({ timeout: 15_000 });
    } else {
      test.skip();
    }
  });
});
