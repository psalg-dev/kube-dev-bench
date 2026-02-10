import { expect, type Page } from '@playwright/test';

/**
 * Wait for a table row with specific text to be visible and stable
 */
export async function waitForTableRow(page: Page, rowText: string | RegExp, opts: { timeout?: number } = {}) {
  const timeout = opts.timeout ?? 60_000;
  const table = page
    .locator('#main-panels > div:visible table.gh-table')
    .filter({ has: page.locator('tbody tr') })
    .first();
  await expect(table).toBeVisible({ timeout: 30_000 });
  
  const row = page.getByRole('row', { name: rowText });
  await expect(row).toBeVisible({ timeout });
  
  // Wait for table to stabilize
  await page.waitForTimeout(500);
}

/**
 * Wait for a table row to disappear after deletion
 */
export async function waitForTableRowRemoved(page: Page, rowText: string | RegExp, opts: { timeout?: number } = {}) {
  const timeout = opts.timeout ?? 60_000;
  const row = page.getByRole('row', { name: rowText });
  await expect(row).toHaveCount(0, { timeout });
  
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
  
  const table = page
    .locator('#main-panels > div:visible table.gh-table')
    .filter({ has: page.locator('tbody tr') })
    .first();
  await expect(table).toBeVisible({ timeout: 30_000 });
  
  const row = table.locator('tbody tr').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout });
  await row.click();
  
  // Wait for bottom panel to appear
  await expect(page.locator('.bottom-panel')).toBeVisible({ timeout: 10_000 });
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
