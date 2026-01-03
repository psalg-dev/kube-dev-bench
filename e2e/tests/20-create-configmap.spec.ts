import { test, expect } from '../src/fixtures.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { bootstrapApp } from '../src/support/bootstrap.js';

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

  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible({ timeout: 60_000 });
});
