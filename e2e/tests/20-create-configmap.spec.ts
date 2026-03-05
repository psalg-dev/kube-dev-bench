import { test, expect } from '../src/fixtures.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { waitForTableRow } from '../src/support/wait-helpers.js';
import { SidebarPage } from '../src/pages/SidebarPage.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('creates a ConfigMap via overlay and table refreshes', async ({ page, contextName, namespace }) => {
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

  // Verify manual dismissal removes the notification (newer feature).
  const successNote = page.locator('.gh-notification--success', { hasText: /created successfully/i }).first();
  await successNote.locator('.gh-notification__close').click();
  await expect(successNote).toHaveCount(0);

  // The newly created ConfigMap should appear in the table. On CI, the KinD
  // API server can be temporarily slow to return updated lists, so we apply
  // a multi-level fallback strategy:
  //   1. Wait for the row in the current table state (backend push event).
  //   2. Re-navigate to configmaps to force a fresh fetchConfigMaps().
  //   3. Full page reload to reset all app state and refetch everything.
  const rowPattern = new RegExp(name);
  let found = false;
  for (let attempt = 0; attempt < 3 && !found; attempt++) {
    try {
      if (attempt === 0) {
        await waitForTableRow(page, rowPattern, { timeout: 30_000 });
      } else if (attempt === 1) {
        await sidebar.goToSection('pods');
        await sidebar.goToSection('configmaps');
        await waitForTableRow(page, rowPattern, { timeout: 30_000 });
      } else {
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForTimeout(2_000);
        const freshSidebar = new SidebarPage(page);
        await freshSidebar.selectContext(contextName);
        await freshSidebar.selectNamespace(namespace);
        await freshSidebar.goToSection('configmaps');
        await waitForTableRow(page, rowPattern, { timeout: 30_000 });
      }
      found = true;
    } catch {
      if (attempt === 2) throw new Error(`ConfigMap row '${name}' not found after 3 attempts (create succeeded).`);
    }
  }
});
