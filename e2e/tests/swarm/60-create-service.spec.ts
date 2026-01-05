/**
 * E2E tests for creating Docker Swarm services via the CreateManifestOverlay.
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmConnectionWizardPage } from '../../src/pages/SwarmConnectionWizardPage.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { uniqueSwarmName } from '../../src/support/swarm-bootstrap.js';

test.describe('Docker Swarm Create Service', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');

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
    await expect(page.locator('table').getByText(svcName).first()).toBeVisible({ timeout: 60_000 });
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

    await page.locator('#swarm-view-yaml-btn').click();

    const yaml = [
      `name: ${svcName}`,
      'image: nginx:alpine',
      'mode: replicated',
      'replicas: 1',
      'ports:',
      '  - protocol: tcp',
      '    targetPort: 80',
      '    publishedPort: 8080',
      '    publishMode: ingress',
      'env: {}',
      'labels: {}',
      '',
    ].join('\n');

    await overlay.fillYaml(yaml);

    await page.locator('#swarm-create-btn').click();
    await expect(page.locator('#swarm-create-overlay')).toBeHidden({ timeout: 60_000 });

    const notifications = new Notifications(page);
    await notifications.expectSuccessContains(svcName);

    await expect(page.locator('table').getByText(svcName).first()).toBeVisible({ timeout: 60_000 });
  });
});
