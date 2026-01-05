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
import { SwarmConnectionWizardPage } from '../../src/pages/SwarmConnectionWizardPage.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';

test.describe('Docker Swarm Service Scaling', () => {
  test.beforeEach(async ({ page, contextName, namespace }) => {
    test.setTimeout(120_000);
    await bootstrapApp({ page, contextName, namespace });
    
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

  test('shows scale button for replicated services', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    
    // Wait for table to load
    const firstRow = page.locator('table tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    
    // Click to open details
    await firstRow.click();
    
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
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    
    // Find a replicated service (look for mode "replicated" in table)
    const serviceRows = page.locator('table tbody tr');
    await expect(serviceRows.first()).toBeVisible({ timeout: 30_000 });
    
    // Click first row to open details
    await serviceRows.first().click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Summary');
    
    const scaleBtn = panel.root.getByRole('button', { name: /scale/i });
    
    // If scale button exists and is enabled, test scaling
    if (await scaleBtn.isVisible().catch(() => false) && 
        await scaleBtn.isEnabled().catch(() => false)) {
      
      await scaleBtn.click();
      
      // Scale dialog should appear
      const scaleDialog = new SwarmScaleDialog(page);
      await scaleDialog.expectVisible();
      
      // Set replicas to 3
      await scaleDialog.setReplicas(3);
      await scaleDialog.confirm();
      
      // Should show success notification
      const notifications = new Notifications(page);
      await expect(page.getByText(/scaled|success/i)).toBeVisible({ timeout: 10_000 });
      await notifications.waitForClear();
    } else {
      // Service might be global mode, skip
      test.skip();
    }
  });

  test('can scale service down', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    
    const serviceRows = page.locator('table tbody tr');
    await expect(serviceRows.first()).toBeVisible({ timeout: 30_000 });
    await serviceRows.first().click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Summary');
    
    const scaleBtn = panel.root.getByRole('button', { name: /scale/i });
    
    if (await scaleBtn.isVisible().catch(() => false) && 
        await scaleBtn.isEnabled().catch(() => false)) {
      
      await scaleBtn.click();
      
      const scaleDialog = new SwarmScaleDialog(page);
      await scaleDialog.expectVisible();
      
      // Scale down to 1
      await scaleDialog.setReplicas(1);
      await scaleDialog.confirm();
      
      // Should show success notification
      const notifications = new Notifications(page);
      await expect(page.getByText(/scaled|success/i)).toBeVisible({ timeout: 10_000 });
      await notifications.waitForClear();
    } else {
      test.skip();
    }
  });

  test('can cancel scale dialog', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    
    const serviceRows = page.locator('table tbody tr');
    await expect(serviceRows.first()).toBeVisible({ timeout: 30_000 });
    await serviceRows.first().click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Summary');
    
    const scaleBtn = panel.root.getByRole('button', { name: /scale/i });
    
    if (await scaleBtn.isVisible().catch(() => false) && 
        await scaleBtn.isEnabled().catch(() => false)) {
      
      await scaleBtn.click();
      
      const scaleDialog = new SwarmScaleDialog(page);
      await scaleDialog.expectVisible();
      
      // Change value but cancel
      await scaleDialog.setReplicas(10);
      await scaleDialog.cancel();
      
      // Dialog should close, no changes made
      await scaleDialog.expectHidden();
    } else {
      test.skip();
    }
  });

  test('validates scale input', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    
    const serviceRows = page.locator('table tbody tr');
    await expect(serviceRows.first()).toBeVisible({ timeout: 30_000 });
    await serviceRows.first().click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Summary');
    
    const scaleBtn = panel.root.getByRole('button', { name: /scale/i });
    
    if (await scaleBtn.isVisible().catch(() => false) && 
        await scaleBtn.isEnabled().catch(() => false)) {
      
      await scaleBtn.click();
      
      const scaleDialog = new SwarmScaleDialog(page);
      await scaleDialog.expectVisible();
      
      // Try invalid value (negative)
      const input = page.locator('[role="dialog"] input[type="number"]');
      await input.fill('-1');
      
      // Confirm button should be disabled or show error
      const confirmBtn = page.locator('[role="dialog"]').getByRole('button', { name: /confirm|scale|ok/i });
      
      // Either the button is disabled or an error message is shown
      const isDisabled = await confirmBtn.isDisabled().catch(() => false);
      const hasError = await page.getByText(/invalid|error|positive/i).isVisible().catch(() => false);
      
      expect(isDisabled || hasError).toBeTruthy();
      
      await scaleDialog.cancel();
    } else {
      test.skip();
    }
  });
});
