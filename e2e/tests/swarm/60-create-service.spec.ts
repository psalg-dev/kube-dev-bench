/**
 * E2E tests for creating Docker Swarm services via the CreateManifestOverlay.
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmConnectionWizardPage } from '../../src/pages/SwarmConnectionWizardPage.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { uniqueSwarmName } from '../../src/support/swarm-bootstrap.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';

test.describe('Docker Swarm Create Service', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('creates service via form', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    const svcName = uniqueSwarmName('svc');

    await sidebar.goToServices();

    const overlay = new CreateOverlay(page);
    await overlay.openFromOverviewHeader();

    await expect(page.locator('#swarm-create-overlay')).toBeVisible();

    await page.locator('#swarm-service-name').fill(svcName);
    await page.locator('#swarm-service-image').fill('nginx:alpine');

    await page.locator('#swarm-create-btn').click();
    await expect(page.locator('#swarm-create-overlay')).toBeHidden({ timeout: 60_000 });

    const notifications = new Notifications(page);
    await notifications.expectSuccessContains(svcName);

    // Table should refresh after create
    await expect(page.locator('[data-testid="swarm-services-table"]').getByText(svcName).first()).toBeVisible({ timeout: 60_000 });
  });

  test('creates service via YAML toggle', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    const svcName = uniqueSwarmName('svc-yaml');

    await sidebar.goToServices();

    const overlay = new CreateOverlay(page);
    await overlay.openFromOverviewHeader();

    await expect(page.locator('#swarm-create-overlay')).toBeVisible();

    // Fill form first, then switch to YAML view.
    // This avoids flaky indentation issues when typing YAML into CodeMirror.
    await page.locator('#swarm-service-name').fill(svcName);
    await page.locator('#swarm-service-image').fill('nginx:alpine');

    await page.locator('#swarm-view-yaml-btn').click();
    await expect(page.locator('.cm-content')).toContainText(`name: ${svcName}`);
    await expect(page.locator('.cm-content')).toContainText('image: nginx:alpine');

    await page.locator('#swarm-create-btn').click();
    await expect(page.locator('#swarm-create-overlay')).toBeHidden({ timeout: 60_000 });

    const notifications = new Notifications(page);
    await notifications.expectSuccessContains(svcName);

    await expect(page.locator('[data-testid="swarm-services-table"]').getByText(svcName).first()).toBeVisible({ timeout: 60_000 });
  });
});
