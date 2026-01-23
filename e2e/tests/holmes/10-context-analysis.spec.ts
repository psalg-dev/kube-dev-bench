import { test, expect } from '../../src/fixtures.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { BottomPanel } from '../../src/pages/BottomPanel.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

async function openRowActionsAndAskHolmes(page: any, rowText: string) {
  const row = page.locator('#main-panels > div:visible table.gh-table tbody tr').filter({ hasText: rowText }).first();
  await expect(row).toBeVisible({ timeout: 60_000 });

  await row.locator('.row-actions-button').click();
  const askHolmes = page.locator('.menu-content .context-menu-item', { hasText: 'Ask Holmes' }).first();
  await expect(askHolmes).toBeVisible({ timeout: 10_000 });
  await askHolmes.click();
}

test('Ask Holmes from resource details opens Holmes tab', async ({ page, contextName, namespace }) => {
  test.setTimeout(180_000);

  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  const overlay = new CreateOverlay(page);
  const notifications = new Notifications(page);
  const panel = new BottomPanel(page);

  // Create a deployment to ensure a stable target.
  await sidebar.goToSection('deployments');

  const deployName = uniqueName('e2e-holmes-deploy');
  const deployYaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${deployName}\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${deployName}\n  template:\n    metadata:\n      labels:\n        app: ${deployName}\n    spec:\n      containers:\n      - name: app\n        image: nginx:latest\n        ports:\n        - containerPort: 80\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(deployYaml);
  await overlay.create();
  await notifications.waitForClear();

  // Ask Holmes from Deployment row
  await openRowActionsAndAskHolmes(page, deployName);
  await panel.expectVisible();
  await panel.expectTabs(['Holmes']);

  // Switch to Pods and ask Holmes from a pod row
  await panel.closeByClickingOutside();
  await sidebar.goToSection('pods');

  const podRow = page.locator('#main-panels > div:visible table.gh-table tbody tr').filter({ hasText: deployName }).first();
  await expect(podRow).toBeVisible({ timeout: 90_000 });

  await openRowActionsAndAskHolmes(page, deployName);
  await panel.expectVisible();
  await panel.expectTabs(['Holmes']);

  // Create a service and ask Holmes from Services view
  await panel.closeByClickingOutside();
  await sidebar.goToSection('services');

  const serviceName = uniqueName('e2e-holmes-svc');
  const serviceYaml = `apiVersion: v1\nkind: Service\nmetadata:\n  name: ${serviceName}\n  namespace: ${namespace}\nspec:\n  selector:\n    app: ${deployName}\n  ports:\n  - name: http\n    port: 80\n    targetPort: 80\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(serviceYaml);
  await overlay.create();
  await notifications.waitForClear();

  await openRowActionsAndAskHolmes(page, serviceName);
  await panel.expectVisible();
  await panel.expectTabs(['Holmes']);

  // Expect some Holmes panel content (either placeholder or error depending on configuration)
  await expect(panel.root).toContainText(/Holmes analysis|Analyze with Holmes|Analysis failed/i);
});
