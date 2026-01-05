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

test.describe('Docker Swarm Service Scaling', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('shows scale button for replicated services', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToServices();
    
    // Wait for table to load
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const firstRow = servicesTable.locator('tbody tr').first();
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
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const serviceRows = servicesTable.locator('tbody tr');
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
    
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const serviceRows = servicesTable.locator('tbody tr');
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
    
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const serviceRows = servicesTable.locator('tbody tr');
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
    
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    const serviceRows = servicesTable.locator('tbody tr');
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
      await scaleDialog.fillReplicasRaw('-1');

      // Current UI behavior: click Scale shows a warning and keeps dialog open
      await scaleDialog.submit();
      await expect(page.getByText(/replicas cannot be negative/i)).toBeVisible({ timeout: 10_000 });
      
      await scaleDialog.cancel();
    } else {
      test.skip();
    }
  });
});
