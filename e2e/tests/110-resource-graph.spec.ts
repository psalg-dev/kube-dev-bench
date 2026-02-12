import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { BottomPanel } from '../src/pages/BottomPanel.js';
import { openRowDetailsByName } from '../src/support/wait-helpers.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('resource graph: deployment relationships and navigation', async ({ page, contextName, namespace }) => {
  test.setTimeout(180_000);

  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  const notifications = new Notifications(page);
  const overlay = new CreateOverlay(page);
  const panel = new BottomPanel(page);

  await sidebar.goToSection('deployments');

  const deployName = uniqueName('e2e-graph');
  const deployYaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${deployName}\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${deployName}\n  template:\n    metadata:\n      labels:\n        app: ${deployName}\n    spec:\n      containers:\n      - name: app\n        image: nginx:latest\n        ports:\n        - containerPort: 80\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(deployYaml);
  await overlay.create();
  await notifications.waitForClear();

  await openRowDetailsByName(page, deployName);
  await panel.expectVisible();

  await panel.clickTab('Relationships');

  const graphCanvas = page.locator('#graph-canvas');
  await expect(graphCanvas).toBeVisible({ timeout: 20_000 });

  await expect(page.locator('.graph-node--deployment')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('.graph-node--pod')).toBeVisible({ timeout: 60_000 });

  await page.locator('.graph-node--pod').first().click();
  await expect(page.locator('h2.overview-title:visible')).toHaveText(/pods/i, { timeout: 20_000 });
});
