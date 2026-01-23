/**
 * E2E smoke test for the Swarm Cluster Topology view.
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmBottomPanel } from '../../src/pages/SwarmBottomPanel.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';

test.describe('Docker Swarm Cluster Topology', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('can open Topology view', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 60_000 });

    await sidebar.goToSection('swarm-overview');
    await expect(page.locator('[data-testid="swarm-overview"]')).toBeVisible({ timeout: 30_000 });

    await page.locator('#swarm-overview-tab-topology').click();
    await expect(page.locator('[data-testid="swarm-topology-view"]')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('heading', { name: /cluster topology/i })).toBeVisible({ timeout: 30_000 });

    // Click a service from the list and verify bottom panel opens.
    const firstService = page.locator('[data-testid="topology-service-item"]').first();
    await expect(firstService).toBeVisible({ timeout: 30_000 });
    await firstService.click();

    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.expectTabs(['Summary', 'Tasks', 'Logs', 'Holmes']);
  });
});
