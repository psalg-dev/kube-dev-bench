import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('creates a Secret and a PVC', async ({ page, contextName, namespace }) => {
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  const overlay = new CreateOverlay(page);
  const notifications = new Notifications(page);

  // Secret
  await sidebar.goToSection('secrets');
  const secretName = uniqueName('e2e-secret');
  const secretYaml = `apiVersion: v1\nkind: Secret\nmetadata:\n  name: ${secretName}\n  namespace: ${namespace}\ntype: Opaque\nstringData:\n  username: user\n  password: pass\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(secretYaml);
  await overlay.create();

  await notifications.expectSuccessContains('created successfully');
  await expect(page.getByRole('row', { name: new RegExp(secretName) })).toBeVisible({ timeout: 60_000 });

  // PVC
  await sidebar.goToSection('persistentvolumeclaims');
  const pvcName = uniqueName('e2e-pvc');
  const pvcYaml = `apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: ${pvcName}\n  namespace: ${namespace}\nspec:\n  accessModes:\n    - ReadWriteOnce\n  resources:\n    requests:\n      storage: 64Mi\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(pvcYaml);
  await overlay.create();

  await notifications.expectSuccessContains('created successfully');
  await expect(page.getByRole('row', { name: new RegExp(pvcName) })).toBeVisible({ timeout: 60_000 });
});
