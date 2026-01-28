import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { bootstrapSwarm, uniqueSwarmName } from '../../src/support/swarm-bootstrap.js';
import { ensureArtifactory, getArtifactoryConfig } from '../../src/support/artifactory-bootstrap.js';

test.describe('Artifactory Registry Integration', () => {
  test.beforeAll(async () => {
    // Fail fast with a clear message if JCR isn't running/configured.
    await ensureArtifactory();
  });

  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
  });

  test('adds artifactory registry with basic auth and tests connection', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    const notifications = new Notifications(page);
    const cfg = getArtifactoryConfig();

    await sidebar.goToSection('swarm-registries');

    const view = page.locator('[data-testid="swarm-registries-table"]');
    await expect(view).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('h2.overview-title:visible')).toHaveText(/registries/i);

    await page.locator('#swarm-registries-add-btn').click({ timeout: 30_000 });

    const name = uniqueSwarmName('kdb-e2e-artifactory-');

    await page.locator('#registry-type').selectOption({ value: 'artifactory' });
    await page.locator('#registry-name').fill(name);
    await page.locator('#registry-url').fill(cfg.registryBaseUrl);

    await page.locator('#registry-auth-method').selectOption({ value: 'basic' });
    await page.locator('#registry-username').fill(cfg.username);
    await page.locator('#registry-password').fill(cfg.password);

    await page.locator('#registry-allow-insecure-http').check();
    await page.locator('#registry-timeout-seconds').fill('30');

    // Primary objective: Test Connection should succeed.
    await page.getByRole('button', { name: /^Test Connection$/i }).click();
    await notifications.expectSuccessContains(/registry connection ok/i, { timeoutMs: 30_000 });

    await page.getByRole('button', { name: /^Save$/i }).click();
    await notifications.expectSuccessContains(new RegExp(`Saved registry\\s+${name}`, 'i'), { timeoutMs: 30_000 });

    // Registry list uses a table, find the row containing the registry name
    const row = page.locator('.registry-table tbody tr').filter({ hasText: name }).first();
    await expect(row).toBeVisible({ timeout: 30_000 });
    await expect(row.getByText(cfg.registryBaseUrl)).toBeVisible({ timeout: 30_000 });

    // Click the row to open the bottom panel which has the Remove button
    await row.click();
    await page.waitForSelector('.bottom-panel', { state: 'visible', timeout: 10_000 });

    // Cleanup: remove the registry so it doesn't bleed into other runs.
    page.once('dialog', async (d) => {
      expect(d.type()).toBe('confirm');
      await d.accept();
    });

    await page.locator('.bottom-panel button[title="Remove registry"]').click();
    await notifications.expectSuccessContains(new RegExp(`Removed registry\\s+${name}`, 'i'), { timeoutMs: 30_000 });
    await expect(row).toBeHidden({ timeout: 30_000 });
  });

  test('fails test connection with invalid credentials', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    const notifications = new Notifications(page);
    const cfg = getArtifactoryConfig();

    await sidebar.goToSection('swarm-registries');
    await page.locator('#swarm-registries-add-btn').click({ timeout: 30_000 });

    const name = uniqueSwarmName('kdb-e2e-artifactory-bad-auth-');

    await page.locator('#registry-type').selectOption({ value: 'artifactory' });
    await page.locator('#registry-name').fill(name);
    await page.locator('#registry-url').fill(cfg.registryBaseUrl);

    await page.locator('#registry-auth-method').selectOption({ value: 'basic' });
    await page.locator('#registry-username').fill(cfg.username);
    await page.locator('#registry-password').fill('WrongPassword123');

    await page.locator('#registry-allow-insecure-http').check();
    await page.locator('#registry-timeout-seconds').fill('30');

    await page.getByRole('button', { name: /^Test Connection$/i }).click();
    await notifications.expectErrorContains(/registry connection failed/i, { timeoutMs: 30_000 });

    // Some backends may return 401, others may wrap auth errors.
    const text = await notifications.notificationText(/registry connection failed/i).textContent();
    expect(text ?? '').toMatch(/401|unauthorized|authentication|forbidden|denied/i);
  });
});