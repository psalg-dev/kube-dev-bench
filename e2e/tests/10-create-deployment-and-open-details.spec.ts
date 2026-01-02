import { test, expect } from '../src/fixtures.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { bootstrapApp } from '../src/support/bootstrap.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('creates a Deployment via plus overlay and opens bottom panel', async ({ page, contextName, namespace }) => {
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  await sidebar.goToSection('deployments');

  const name = uniqueName('e2e-deploy');
  const yaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${name}\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${name}\n  template:\n    metadata:\n      labels:\n        app: ${name}\n    spec:\n      containers:\n      - name: app\n        image: nginx:latest\n        ports:\n        - containerPort: 80\n`;

  const overlay = new CreateOverlay(page);
  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(yaml);
  await overlay.create();

  const notifications = new Notifications(page);
  await notifications.expectSuccessContains('created successfully');

  // Wait for row to show up then open bottom panel
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible({ timeout: 60_000 });
  await page.getByRole('row', { name: new RegExp(name) }).click();
  await expect(page.locator('.bottom-panel')).toBeVisible();

  // Close bottom panel by clicking outside
  await page.locator('#maincontent').click({ position: { x: 5, y: 5 } });
  await expect(page.locator('.bottom-panel')).toBeHidden();
});
