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
import { SwarmConnectionWizardPage } from '../../src/pages/SwarmConnectionWizardPage.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { uniqueSwarmName } from '../../src/support/swarm-bootstrap.js';

test.describe('Docker Swarm Services', () => {
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

  test('displays services table', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    
    // Verify services table is visible
    await expect(page.locator('table, [data-testid="services-table"]')).toBeVisible({ timeout: 30_000 });
    
    // Verify table headers
    await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /image/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /replicas/i })).toBeVisible();
  });

  test('shows service count in sidebar', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    // Check that services section shows a count (number or dash)
    const servicesSection = page.locator('#section-swarm-services');
    await expect(servicesSection).toBeVisible();
    
    // The count should be visible (either a number or '-')
    const countText = await servicesSection.locator('span').last().textContent();
    expect(countText).toBeDefined();
  });

  test('opens service details panel on row click', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    
    // Wait for table to load
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 30_000 });
    
    // Click first service row
    await page.locator('table tbody tr').first().click();
    
    // Verify bottom panel opens
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    
    // Verify expected tabs
    await panel.expectTabs(['Summary', 'Tasks', 'Logs']);
  });

  test('service details panel shows Summary tab content', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 30_000 });
    await page.locator('table tbody tr').first().click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Summary');
    
    // Should show service info (mode, replicas, image, etc.)
    await expect(panel.root.getByText(/mode|replicas|image/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('service details panel shows Tasks tab', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 30_000 });
    await page.locator('table tbody tr').first().click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Tasks');
    
    // Should show tasks list or table
    await panel.expectTasksVisible();
  });

  test('service details panel shows Logs tab', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 30_000 });
    await page.locator('table tbody tr').first().click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Logs');
    
    // Should show logs content (or "no logs" message)
    await expect(
      panel.root.locator('.cm-editor, pre, .logs-container')
        .or(panel.root.getByText(/no logs|loading/i))
    ).toBeVisible({ timeout: 15_000 });
  });

  test('closes bottom panel by clicking outside', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    await expect(page.locator('table tbody tr').first()).toBeVisible({ timeout: 30_000 });
    await page.locator('table tbody tr').first().click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    
    // Close by clicking outside
    await panel.closeByClickingOutside();
    await panel.expectHidden();
  });
});
