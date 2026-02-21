import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('creates a StatefulSet and a ReplicaSet', async ({ page, contextName, namespace }) => {
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  const overlay = new CreateOverlay(page);
  const notifications = new Notifications(page);

  // StatefulSet
  await sidebar.goToSection('statefulsets');
  const stsName = uniqueName('e2e-sts');
  const stsYaml = `apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: ${stsName}\n  namespace: ${namespace}\nspec:\n  serviceName: ${stsName}\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${stsName}\n  template:\n    metadata:\n      labels:\n        app: ${stsName}\n    spec:\n      containers:\n      - name: app\n        image: busybox\n        command: [\"sh\", \"-c\", \"sleep 3600\"]\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(stsYaml);
  await overlay.create();

  await notifications.expectSuccessContains('created successfully');
  await expect(page.getByRole('row', { name: new RegExp(stsName) })).toBeVisible({ timeout: 60_000 });

  // ReplicaSet
  await sidebar.goToSection('replicasets');
  const rsName = uniqueName('e2e-rs');
  const rsYaml = `apiVersion: apps/v1\nkind: ReplicaSet\nmetadata:\n  name: ${rsName}\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${rsName}\n  template:\n    metadata:\n      labels:\n        app: ${rsName}\n    spec:\n      containers:\n      - name: app\n        image: busybox\n        command: [\"sh\", \"-c\", \"sleep 3600\"]\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(rsYaml);
  await overlay.create();

  await notifications.expectSuccessContains('created successfully');
  await expect(page.getByRole('row', { name: new RegExp(rsName) })).toBeVisible({ timeout: 60_000 });
});
