import { expect, type Page } from '@playwright/test';

async function waitForReconnectOverlayToClear(page: Page, timeout: number) {
  const reconnectOverlay = page.locator('.wails-reconnect-overlay');
  await expect(reconnectOverlay).toHaveCount(0, { timeout });
}

/**
 * Wait for a table row with specific text to be visible and stable
 */
export async function waitForTableRow(page: Page, rowText: string | RegExp, opts: { timeout?: number } = {}) {
  const timeout = opts.timeout ?? 60_000;
  const tables = page.locator('#main-panels > div:visible table.gh-table');
  await expect(tables.first()).toBeVisible({ timeout: 30_000 });

  const rows = page.locator('#main-panels > div:visible table.gh-table tbody tr').filter({ hasText: rowText });
  await expect.poll(async () => rows.count(), { timeout }).toBeGreaterThan(0);
  await expect(rows.first()).toBeVisible({ timeout: 5_000 });

  // Wait for table to stabilize
  await page.waitForTimeout(500);
}

/**
 * Wait for a table row to disappear after deletion
 */
export async function waitForTableRowRemoved(page: Page, rowText: string | RegExp, opts: { timeout?: number } = {}) {
  const timeout = opts.timeout ?? 60_000;
  const tables = page.locator('#main-panels > div:visible table.gh-table');
  await expect(tables.first()).toBeVisible({ timeout: 30_000 });

  const rows = page.locator('#main-panels > div:visible table.gh-table tbody tr').filter({ hasText: rowText });
  await expect(rows).toHaveCount(0, { timeout });

  // Wait for table to stabilize
  await page.waitForTimeout(500);
}

/**
 * Open a row's detail panel by clicking on it
 */
export async function openRowDetailsByName(page: Page, name: string, opts: { timeout?: number } = {}) {
  const timeout = opts.timeout ?? 60_000;
  
  // Ensure no notifications are blocking
  await expect(page.locator('#gh-notification-container .gh-notification')).toHaveCount(0, { timeout: 10_000 });
  await waitForReconnectOverlayToClear(page, 10_000);
  
  const table = page
    .locator('#main-panels > div:visible table.gh-table')
    .filter({ has: page.locator('tbody tr') })
    .first();
  await expect(table).toBeVisible({ timeout: 30_000 });
  
  const row = table.locator('tbody tr').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout });

  const detailsPanel = page
    .locator('.bottom-panel')
    .filter({ has: page.getByRole('button', { name: 'Summary', exact: true }) });

  for (let attempt = 0; attempt < 3; attempt++) {
    const nameCell = row.locator('td').first();
    await nameCell.waitFor({ state: 'visible', timeout: 30_000 });
    await waitForReconnectOverlayToClear(page, 10_000);

    try {
      await nameCell.click({ timeout: 30_000 });
    } catch {
      await waitForReconnectOverlayToClear(page, 10_000);
      await nameCell.click({ timeout: 30_000 });
    }

    try {
      await expect(detailsPanel).toBeVisible({ timeout: 5_000 });
      await expect(detailsPanel.getByText(name).first()).toBeVisible({ timeout: 5_000 });
      return;
    } catch {
      // Continue to menu fallback below.
    }

    const actionsButton = row.getByRole('button', { name: 'Row actions' }).first();
    if (await actionsButton.isVisible().catch(() => false)) {
      await waitForReconnectOverlayToClear(page, 10_000);
      await actionsButton.click({ timeout: 5_000 });
      const menu = page.locator('.row-actions-menu').first();
      const detailsItem = menu.getByText('Details').first();
      if (await detailsItem.isVisible().catch(() => false)) {
        await detailsItem.click({ force: true });
        try {
          await expect(detailsPanel).toBeVisible({ timeout: 5_000 });
          await expect(detailsPanel.getByText(name).first()).toBeVisible({ timeout: 5_000 });
          return;
        } catch {
          // Continue retry loop.
        }
      }
    }

    await page.waitForTimeout(250);
  }

  throw new Error(`Failed to open bottom panel for row: ${name}`);
}

/**
 * Wait for a resource to reach a specific status
 */
export async function waitForResourceStatus(
  page: Page,
  resourceName: string | RegExp,
  status: string | RegExp,
  opts: { timeout?: number } = {}
) {
  const timeout = opts.timeout ?? 90_000;
  const table = page
    .locator('#main-panels > div:visible table.gh-table')
    .filter({ has: page.locator('tbody tr') })
    .first();
  await expect(table).toBeVisible({ timeout: 30_000 });

  const rows = table.locator('tbody tr').filter({ hasText: resourceName });
  await expect
    .poll(async () => rows.filter({ hasText: status }).count(), { timeout })
    .toBeGreaterThan(0);
}
