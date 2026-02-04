import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { waitForTableRow, waitForTableRowRemoved } from '../src/support/wait-helpers.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('creates and deletes a ConfigMap from the bottom panel', async ({ page, contextName, namespace }) => {
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  await sidebar.goToSection('configmaps');

  const name = uniqueName('e2e-cm');
  const yaml = `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ${name}\n  namespace: ${namespace}\ndata:\n  hello: world\n`;

  const overlay = new CreateOverlay(page);
  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(yaml);
  await overlay.create();

  const notifications = new Notifications(page);
  await notifications.expectSuccessContains('created successfully');
  await notifications.waitForClear();

  await waitForTableRow(page, new RegExp(name));
  const row = page.getByRole('row', { name: new RegExp(name) });
  await row.click();
  await expect(page.locator('.bottom-panel')).toBeVisible();

  const panel = page.locator('.bottom-panel');
  await panel.getByRole('button', { name: /^delete$/i }).click();
  await expect(panel.getByRole('button', { name: /^confirm$/i })).toBeVisible();
  await panel.getByRole('button', { name: /^confirm$/i }).click();

  await notifications.expectSuccessContains(`configmap '${name}' deleted`);
  await notifications.waitForClear();

  // Table should eventually stop showing the deleted resource.
  await waitForTableRowRemoved(page, new RegExp(name));
});
