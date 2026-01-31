import { test, expect } from '../../src/fixtures.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';
import { configureHolmesMock, getHolmesInput } from '../../src/support/holmes-bootstrap.js';

test('Holmes panel conversation history with export/clear', async ({ page, contextName, namespace }) => {
  test.setTimeout(120_000);

  await bootstrapApp({ page, contextName, namespace });
  await configureHolmesMock({ page });

  // Use retry pattern for opening Holmes panel
  await expect(async () => {
    await page.keyboard.press('Escape');
    await page.locator('#holmes-toggle-btn').click();
    await expect(page.locator('#holmes-panel')).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 20_000, intervals: [500, 1000, 2000] });

  const input = await getHolmesInput(page);
  await input.fill('Why is my pod crashing?');
  await page.getByRole('button', { name: '→' }).click();

  const clearButton = page.getByTitle('Clear conversation');
  await expect(clearButton).toBeVisible({ timeout: 30_000 });

  const exportButton = page.getByTitle('Export conversation');
  await expect(exportButton).toBeVisible({ timeout: 10_000 });
  await exportButton.click();

  await clearButton.click();
  
  // After clearing, verify the input is still available (conversation cleared)
  await expect(page.getByPlaceholder('Ask about your cluster...')).toBeVisible({ timeout: 20_000 });
  
  // Clear button should be hidden when no conversation
  await expect(clearButton).toBeHidden({ timeout: 5_000 });
});
