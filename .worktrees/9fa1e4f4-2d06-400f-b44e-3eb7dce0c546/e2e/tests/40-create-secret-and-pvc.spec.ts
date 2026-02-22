import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { waitForTableRow } from '../src/support/wait-helpers.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

async function waitForRowWithRefresh(
  page: import('@playwright/test').Page,
  sidebar: { goToSection: (section: string) => Promise<void> },
  section: 'secrets' | 'persistentvolumeclaims',
  rowText: RegExp,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await waitForTableRow(page, rowText, { timeout: 20_000 });
      return;
    } catch {
      if (attempt === 2) {
        throw new Error(`Row did not appear in section '${section}' for ${rowText}`);
      }

      await page.reload();
      await sidebar.goToSection(section);
    }
  }
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
  await waitForRowWithRefresh(page, sidebar, 'secrets', new RegExp(secretName));

  // PVC
  await sidebar.goToSection('persistentvolumeclaims');
  const pvcName = uniqueName('e2e-pvc');
  const pvcYaml = `apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: ${pvcName}\n  namespace: ${namespace}\nspec:\n  accessModes:\n    - ReadWriteOnce\n  resources:\n    requests:\n      storage: 64Mi\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(pvcYaml);
  await overlay.create();

  await notifications.expectSuccessContains('created successfully');
  await waitForRowWithRefresh(page, sidebar, 'persistentvolumeclaims', new RegExp(pvcName));
});
