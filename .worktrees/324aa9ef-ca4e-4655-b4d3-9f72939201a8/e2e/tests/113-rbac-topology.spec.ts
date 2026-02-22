import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';

test('rbac graph view renders graph', async ({ page, contextName, namespace }) => {
  test.setTimeout(120_000);

  const { sidebar } = await bootstrapApp({ page, contextName, namespace });

  await sidebar.goToSection('rbac-graph');

  await expect(page.locator('#graph-toolbar')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator('#graph-canvas')).toBeVisible({ timeout: 30_000 });
});
