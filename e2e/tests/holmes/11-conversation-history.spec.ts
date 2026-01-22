import { test, expect } from '../../src/fixtures.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';

async function configureHolmesIfNeeded(page: any) {
  const unconfigured = page.getByText('Holmes AI is not configured');
  if (await unconfigured.isVisible().catch(() => false)) {
    await page.getByRole('button', { name: /Manual Configuration/i }).click();
    await expect(page.locator('#holmes-config-modal')).toBeVisible({ timeout: 10_000 });

    await page.getByLabel('Enable Holmes AI').check();
    await page.locator('#holmes-endpoint').fill('http://localhost:65535');

    await page.getByRole('button', { name: /^save$/i }).click();
    await expect(page.locator('#holmes-config-modal')).toBeHidden({ timeout: 10_000 });
  }
}

test('Holmes panel conversation history with export/clear', async ({ page, contextName, namespace }) => {
  test.setTimeout(120_000);

  await bootstrapApp({ page, contextName, namespace });

  await page.locator('#holmes-toggle-btn').click();
  await expect(page.locator('#holmes-panel')).toBeVisible({ timeout: 10_000 });

  await configureHolmesIfNeeded(page);

  const input = page.getByPlaceholder('Ask about your cluster...');
  await expect(input).toBeVisible({ timeout: 10_000 });
  await input.fill('Why is my pod crashing?');
  await page.getByRole('button', { name: '→' }).click();

  const clearButton = page.getByTitle('Clear conversation');
  await expect(clearButton).toBeVisible({ timeout: 30_000 });

  const exportButton = page.getByTitle('Export conversation');
  await expect(exportButton).toBeVisible();
  await exportButton.click();

  await clearButton.click();
  await expect(page.getByText('Ask Holmes anything about your Kubernetes cluster:')).toBeVisible();
});
