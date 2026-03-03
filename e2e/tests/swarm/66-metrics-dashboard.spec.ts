/**
 * E2E smoke test for the Swarm Metrics Dashboard.
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';
import { isLocalSwarmActive } from '../../src/support/docker-swarm.js';

test.describe('Docker Swarm Metrics Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    if (!(await isLocalSwarmActive())) {
      test.skip(true, 'Docker Swarm is not active');
    }
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('can open Metrics dashboard', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 60_000 });

    await sidebar.goToSection('swarm-overview');
    await expect(page.locator('[data-testid="swarm-overview"]')).toBeVisible({ timeout: 30_000 });

    await page.locator('#swarm-overview-tab-metrics').click();
    await expect(page.locator('[data-testid="swarm-metrics-dashboard"]')).toBeVisible({ timeout: 30_000 });

    await expect(page.locator('#swarm-metrics-range')).toBeVisible({ timeout: 30_000 });
    await page.locator('#swarm-metrics-range').selectOption('300');
  });
});
