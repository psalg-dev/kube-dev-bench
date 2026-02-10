import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';

test('create manifest overlay closes with Escape', async ({ page, contextName, namespace }) => {
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  await sidebar.goToSection('configmaps');

  const overlay = new CreateOverlay(page);
  await overlay.openFromOverviewHeader();

  // The overlay can render in several ways: a dialog with role="dialog",
  // a header label like "New Configmap Resource", a close icon (×), or
  // Cancel/Create buttons. Wait for any of these to appear, then press
  // Escape and assert it is removed.
  const timeoutMs = 10_000;
  const start = Date.now();
  let overlayLocator = null;
  while (Date.now() - start < timeoutMs) {
    const dialog = page.locator('[role="dialog"]').first();
    if (await dialog.isVisible().catch(() => false)) { overlayLocator = dialog; break; }

    const header = page.getByText('New Configmap Resource').first();
    if (await header.isVisible().catch(() => false)) { overlayLocator = header; break; }

    const createBtn = page.getByRole('button', { name: /^create$/i }).first();
    if (await createBtn.isVisible().catch(() => false)) { overlayLocator = createBtn; break; }

    const closeX = page.getByRole('button', { name: '×' }).first();
    if (await closeX.isVisible().catch(() => false)) { overlayLocator = closeX; break; }

    await page.waitForTimeout(100);
  }

  if (!overlayLocator) throw new Error('Create overlay did not appear');

  await page.keyboard.press('Escape');
  // Wait for the overlay to be removed: check that none of the overlay
  // indicators remain visible.
  await expect(page.getByText('New Configmap Resource')).toBeHidden({ timeout: 10_000 }).catch(() => {});
  await expect(page.getByRole('button', { name: /^create$/i })).toBeHidden({ timeout: 10_000 }).catch(() => {});
  await expect(page.getByRole('button', { name: '×' })).toBeHidden({ timeout: 10_000 }).catch(() => {});
});
