/**
 * E2E tests for Docker Swarm Image Update Detection UI wiring.
 *
 * Note: this is intentionally a lightweight smoke test.
 * It verifies that the "Update" column exists in the services table.
 * More detailed tests (forcing a tag update and verifying warning state)
 * can be added once we have deterministic local-registry tag mutation.
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';

async function expectSwarmConnected(page: import('@playwright/test').Page) {
  const sidebar = new SwarmSidebarPage(page);
  await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 60_000 });
  return sidebar;
}

test.describe('Docker Swarm Image Update Detection', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('services table includes Update column', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToServices();

    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    await expect(servicesTable).toBeVisible({ timeout: 30_000 });

    await expect(servicesTable.getByRole('columnheader', { name: /^update$/i })).toBeVisible({ timeout: 10_000 });

    // Settings button is part of the finished feature wiring.
    await expect(page.locator('#swarm-image-update-settings-btn')).toBeVisible({ timeout: 10_000 });
  });
});
