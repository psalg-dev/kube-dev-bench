import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { waitForResourceStatus, waitForTableRowRemoved } from '../src/support/wait-helpers.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('creates a Pod via manifest overlay, opens YAML tab, then deletes the Pod', async ({ page, contextName, namespace }) => {
  test.setTimeout(120_000);
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  const overlay = new CreateOverlay(page);
  const notifications = new Notifications(page);

  // Create a Deployment first, then operate on one of its pods.
  // This avoids relying on Pods view to refresh from a mismatched resource-updated event.
  await sidebar.goToSection('deployments');

  const deployName = uniqueName('e2e-deploy-pod');
  const deployYaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${deployName}\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${deployName}\n  template:\n    metadata:\n      labels:\n        app: ${deployName}\n    spec:\n      containers:\n      - name: app\n        image: busybox\n        command: [\"sh\", \"-c\", \"sleep 3600\"]\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(deployYaml);
  await overlay.create();
  await notifications.expectSuccessContains('created successfully');
  await notifications.waitForClear();

  // Verify a pod appears in Pods and is Running
  await sidebar.goToSection('pods');
  const row = page.getByRole('row', { name: new RegExp(deployName) }).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await waitForResourceStatus(page, new RegExp(deployName), 'Running', { timeout: 120_000 });

  // Capture the exact pod name from the first column so we can assert it disappears after delete.
  const podName = (await row.locator('td').first().innerText()).trim();
  await row.click();
  await expect(page.locator('.bottom-panel')).toBeVisible();

  const panel = page.locator('.bottom-panel');
  await panel.getByRole('button', { name: /^yaml$/i }).click();
  await expect(panel.getByText(/YAML for/i)).toBeVisible({ timeout: 60_000 });

  // Delete via ResourceActions (two-step confirm)
  await panel.getByRole('button', { name: /^summary$/i }).click();
  await panel.getByRole('button', { name: /^delete$/i }).click();
  await expect(panel.getByRole('button', { name: /^confirm$/i })).toBeVisible();
  await panel.getByRole('button', { name: /^confirm$/i }).click();
  await notifications.expectSuccessContains(`pod '${podName}' deleted`);
  await notifications.waitForClear();

  // Pods list doesn't always refresh immediately after delete; force a refresh by navigating away and back.
  await sidebar.goToSection('deployments');
  await sidebar.goToSection('pods');

  // Eventually, the specific pod name should disappear.
  await waitForTableRowRemoved(page, new RegExp(podName));
});
