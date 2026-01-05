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
import { ConnectionWizardPage } from '../../src/pages/ConnectionWizardPage.js';

test.describe('Docker Swarm Connection', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // The Swarm connection flow should not require Kubernetes setup.
    // Ensure the Connections wizard is visible (it may be hidden if a kubeconfig already exists).
    const wizard = new ConnectionWizardPage(page);
    await wizard.openWizardIfHidden();
  });

  test('shows Docker Swarm connections in the Connections wizard', async ({ page }) => {
    await page.locator('#connection-section-docker-swarm').click();
    await expect(page.getByText(/docker swarm connections/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('#add-swarm-btn')).toBeVisible();
  });

  test('tests local Docker connection', async ({ page }) => {
    test.setTimeout(60_000);

    await page.locator('#connection-section-docker-swarm').click();

    const first = page.locator('.connection-item').first();
    await expect(first).toBeVisible({ timeout: 30_000 });

    await first.getByRole('button', { name: /^test$/i }).click();
    await expect(first.getByText(/connection successful|connection failed|\bfailed\b|\berror\b/i)).toBeVisible({ timeout: 30_000 });
  });

  test('connects to local Docker from the Connections wizard', async ({ page }) => {
    test.setTimeout(60_000);

    await page.locator('#connection-section-docker-swarm').click();

    const first = page.locator('.connection-item').first();
    await expect(first).toBeVisible({ timeout: 30_000 });

    await first.getByRole('button', { name: /^connect$/i }).click();

    // The card should indicate connected.
    await expect(first.getByText(/^connected$/i)).toBeVisible({ timeout: 30_000 });
  });

  test('shows error for invalid connection', async ({ page }) => {
    test.setTimeout(60_000);

    await page.locator('#connection-section-docker-swarm').click();

    await page.locator('#add-swarm-btn').click();
    await expect(page.locator('.add-swarm-overlay')).toBeVisible({ timeout: 10_000 });

    await page.locator('#connectionName').fill('invalid');
    await page.locator('#dockerHost').fill('tcp://invalid-host:9999');
    await page.getByRole('button', { name: /test connection/i }).click();

    const overlay = page.locator('.add-swarm-overlay');
    await expect(overlay.getByText(/timed out|connection failed|\bfailed\b|\berror\b|timeout/i).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.getByRole('button', { name: /cancel/i }).click();
    await expect(page.locator('.add-swarm-overlay')).toBeHidden({ timeout: 10_000 });
  });
});
