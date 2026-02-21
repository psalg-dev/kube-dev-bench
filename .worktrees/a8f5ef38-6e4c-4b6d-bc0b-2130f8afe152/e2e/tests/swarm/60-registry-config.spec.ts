import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { bootstrapSwarm, uniqueSwarmName } from '../../src/support/swarm-bootstrap.js';

test.describe('Docker Swarm Registries', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
  });

  test('adds a registry, shows it, and removes it', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    const notifications = new Notifications(page);

    await sidebar.goToSection('swarm-registries');

    const view = page.locator('[data-testid="swarm-registries-table"]');
    await expect(view).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('h2.overview-title:visible')).toHaveText(/registries/i);

    await page.locator('#swarm-registries-add-btn').click({ timeout: 30_000 });

    // Configure a Generic v2 registry pointing at a closed local port so Test Connection fails fast.
    const name = uniqueSwarmName('kdb-e2e-registry-');

    await page.locator('#registry-type').selectOption({ value: 'generic_v2' });
    await page.locator('#registry-name').fill(name);
    await page.locator('#registry-url').fill('http://127.0.0.1:1');
    await page.locator('#registry-allow-insecure-http').check();
    await page.locator('#registry-timeout-seconds').fill('1');

    // Test Connection should fail quickly and show an error notification.
    await page.getByRole('button', { name: /^Test Connection$/i }).click();
    await notifications.expectErrorContains(/registry connection failed/i, { timeoutMs: 30_000 });

    // Dismiss the error notification so it doesn't intercept pointer events.
    const errorNote = page
      .locator('.gh-notification--error', { hasText: /registry connection failed/i })
      .first();
    await errorNote.locator('.gh-notification__close').click();
    await expect(errorNote).toHaveCount(0);

    // Save should succeed (config can be stored even if endpoint is unreachable).
    await page.getByRole('button', { name: /^Save$/i }).click();
    await notifications.expectSuccessContains(`Saved registry ${name}`, { timeoutMs: 30_000 });

    // Registry list uses a table, find the row containing the registry name
    const row = page.locator('.registry-table tbody tr').filter({ hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });

    // Click the row to open the bottom panel which has the Remove button
    await row.click();
    await page.waitForSelector('.bottom-panel', { state: 'visible', timeout: 10_000 });

    // Remove it.
    page.once('dialog', async (d) => {
      expect(d.type()).toBe('confirm');
      await d.accept();
    });

    await page.locator('.bottom-panel button[title="Remove registry"]').click();
    await notifications.expectSuccessContains(`Removed registry ${name}`, { timeoutMs: 30_000 });

    await expect(row).toBeHidden({ timeout: 30_000 });
  });
});
