import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { readRunState } from '../src/support/run-state.js';

test.describe.serial('proxy settings', () => {
  test('proxy settings: manual proxy persists and can be disabled', async ({ page, contextName, namespace }) => {
    test.setTimeout(120_000);

    const state = await readRunState();
    if (!state.proxyBaseURL) throw new Error('Missing proxyBaseURL in run-state; global setup should start the e2e proxy');

    await bootstrapApp({ page, contextName, namespace });

    // Open Connection Wizard
    await page.locator('#show-wizard-btn').click();
    await expect(page.locator('.connection-wizard-overlay')).toBeVisible();

    // Go to proxy settings
    await page.locator('#proxy-settings-btn').click();
    await expect(page.getByRole('heading', { name: /proxy configuration/i })).toBeVisible();

    // Select manual configuration
    await page.locator('input[name="proxyAuthType"][value="basic"]').check();
    await expect(page.locator('#proxyURL')).toBeVisible();

    // Fill proxy data
    await page.locator('#proxyURL').fill(state.proxyBaseURL);
    await page.locator('#proxyUsername').fill('user1');
    await page.locator('#proxyPassword').fill('pass1');

    // Save
    await page.locator('#save-proxy-btn').click();
    await expect(page.getByRole('heading', { name: /select kubeconfig/i })).toBeVisible({ timeout: 60_000 });

    // Close wizard via Continue
    await page.getByRole('button', { name: /^continue$/i }).click();
    await expect(page.locator('.connection-wizard-overlay')).toBeHidden({ timeout: 60_000 });

    // Re-open and verify persisted values (password may not be returned by backend)
    await page.locator('#show-wizard-btn').click();
    await expect(page.locator('.connection-wizard-overlay')).toBeVisible();
    await page.locator('#proxy-settings-btn').click();
    await page.locator('input[name="proxyAuthType"][value="basic"]').waitFor({ state: 'visible' });

    await expect(page.locator('input[name="proxyAuthType"][value="basic"]')).toBeChecked();
    await expect(page.locator('#proxyURL')).toHaveValue(state.proxyBaseURL);
    await expect(page.locator('#proxyUsername')).toHaveValue('user1');

    // Switch to No Proxy, save, and verify persistence
    await page.locator('input[name="proxyAuthType"][value="none"]').check();
    await page.locator('#save-proxy-btn').click();
    await expect(page.getByRole('heading', { name: /select kubeconfig/i })).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: /^continue$/i }).click();
    await expect(page.locator('.connection-wizard-overlay')).toBeHidden({ timeout: 60_000 });

    await page.locator('#show-wizard-btn').click();
    await expect(page.locator('.connection-wizard-overlay')).toBeVisible();
    await page.locator('#proxy-settings-btn').click();
    await expect(page.locator('input[name="proxyAuthType"][value="none"]')).toBeChecked();
  });
});
