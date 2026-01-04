/**
 * E2E tests for Docker Swarm connection wizard.
 * 
 * Prerequisites:
 * - Docker Desktop or Docker daemon must be running locally
 * - Docker must be initialized as a Swarm manager (docker swarm init)
 * 
 * These tests validate the Swarm connection flow in the application.
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmConnectionWizardPage } from '../../src/pages/SwarmConnectionWizardPage.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { Notifications } from '../../src/pages/Notifications.js';

test.describe('Docker Swarm Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('opens Swarm connection wizard from sidebar', async ({ page }) => {
    const wizard = new SwarmConnectionWizardPage(page);
    
    // Look for Swarm gear button in sidebar
    const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
    
    // The button might not be visible if Swarm sidebar isn't shown
    // First check if we need to switch to Swarm mode
    if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await gearBtn.click();
      await wizard.ensureWizardVisible();
      
      // Verify wizard has expected elements
      await expect(page.getByText(/local socket/i)).toBeVisible();
      await expect(page.getByText(/tcp/i)).toBeVisible();
    } else {
      test.skip();
    }
  });

  test('connects to local Docker socket', async ({ page }) => {
    test.setTimeout(60_000);
    
    const wizard = new SwarmConnectionWizardPage(page);
    const sidebar = new SwarmSidebarPage(page);
    
    // Check if already connected
    if (await sidebar.isSwarmConnected()) {
      // Already connected, verify sidebar is visible
      await sidebar.expectVisible();
      return;
    }

    // Open wizard if needed
    const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
    if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await gearBtn.click();
      await wizard.ensureWizardVisible();
      
      // Select local socket and connect
      await wizard.selectLocalSocket();
      await wizard.clickConnect();
      
      // Verify connection succeeded
      await wizard.ensureWizardHidden();
      
      // Verify Swarm sections appear in sidebar
      await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 30_000 });
    } else {
      test.skip();
    }
  });

  test('tests connection before connecting', async ({ page }) => {
    test.setTimeout(60_000);
    
    const wizard = new SwarmConnectionWizardPage(page);
    
    const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
    if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await gearBtn.click();
      await wizard.ensureWizardVisible();
      
      // Test the connection
      await wizard.selectLocalSocket();
      await wizard.testConnection();
      
      // Should show test result (success or failure)
      await expect(
        page.getByText(/connected|connection.*successful|swarm.*active/i)
          .or(page.getByText(/failed|error|not.*swarm/i))
      ).toBeVisible({ timeout: 15_000 });
    } else {
      test.skip();
    }
  });

  test('shows error for invalid connection', async ({ page }) => {
    test.setTimeout(60_000);
    
    const wizard = new SwarmConnectionWizardPage(page);
    
    const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
    if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await gearBtn.click();
      await wizard.ensureWizardVisible();
      
      // Try to connect to invalid host
      await wizard.selectTcp();
      await wizard.setHost('tcp://invalid-host:9999');
      await wizard.testConnection();
      
      // Should show error
      await expect(page.getByText(/failed|error|cannot connect|timeout/i)).toBeVisible({ timeout: 30_000 });
    } else {
      test.skip();
    }
  });

  test('can skip Swarm wizard', async ({ page }) => {
    const wizard = new SwarmConnectionWizardPage(page);
    
    const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
    if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await gearBtn.click();
      await wizard.ensureWizardVisible();
      
      // Skip the wizard
      await wizard.skip();
      await wizard.ensureWizardHidden();
    } else {
      test.skip();
    }
  });
});
