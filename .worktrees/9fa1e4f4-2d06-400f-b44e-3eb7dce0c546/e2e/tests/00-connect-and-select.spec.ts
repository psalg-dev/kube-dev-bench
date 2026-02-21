import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';

test('connects to KinD and selects worker namespace', async ({ page, contextName, namespace }) => {
  await bootstrapApp({ page, contextName, namespace });

  // Sanity: main content is rendered
  await expect(page.locator('#maincontent')).toBeVisible();
});
