import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';

test('create manifest overlay closes with Escape', async ({ page, contextName, namespace }) => {
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  await sidebar.goToSection('configmaps');

  const overlay = new CreateOverlay(page);
  await overlay.openFromOverviewHeader();
  await expect(page.getByRole('button', { name: 'Close' })).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Close' })).toBeHidden({ timeout: 10_000 });
});
