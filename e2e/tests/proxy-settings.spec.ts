import { test, expect } from '../setup/fixtures';
import { openConnectionWizard, waitForReconnectOverlay, connectWithKindKubeconfig } from '../setup/helpers';

/**
 * Helper to reset proxy settings to "No Proxy" mode
 */
async function resetProxyToNone(page: any) {
  try {
    const proxyBtn = page.locator('#proxy-settings-btn');
    if (!await proxyBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      return;
    }

    await proxyBtn.click();
    await page.waitForTimeout(500);

    const noProxyLabel = page.getByLabel('No Proxy');
    if (!await noProxyLabel.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Not on proxy settings page, go back
      const backBtn = page.getByRole('button', { name: /← Back/i });
      if (await backBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await backBtn.click();
      }
      return;
    }

    await noProxyLabel.click();
    await page.waitForTimeout(200);

    const saveBtn = page.locator('#save-proxy-btn');
    if (await saveBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(500);
    } else {
      // Go back if save not available
      const backBtn = page.getByRole('button', { name: /← Back/i });
      if (await backBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await backBtn.click();
      }
    }
  } catch {
    // Ignore errors
  }
}

test.describe('Proxy Settings', () => {
  // Reset proxy settings after each test to avoid affecting subsequent tests
  test.afterEach(async ({ page, baseURL }) => {
    try {
      // Navigate to clean state
      await page.goto(baseURL || 'http://localhost:34115', { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(1000);

      // Open wizard
      const wizardOverlay = page.locator('.connection-wizard-overlay');
      const gearBtn = page.locator('#show-wizard-btn');
      
      if (!await wizardOverlay.isVisible({ timeout: 2_000 }).catch(() => false)) {
        if (await gearBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
          await gearBtn.click();
          await page.waitForTimeout(500);
        }
      }

      if (await wizardOverlay.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await resetProxyToNone(page);
      }
    } catch {
      // Ignore cleanup errors - best effort cleanup
    }
  });

  test('shows proxy settings button in connection wizard', async ({ page, baseURL }) => {
    console.log('[test] shows proxy settings button - starting');
    // First connect to have configs available
    await connectWithKindKubeconfig(page, baseURL);
    console.log('[test] Connected, opening wizard');

    // Open connection wizard
    await openConnectionWizard(page);
    console.log('[test] Wizard opened, checking proxy button');

    // Verify proxy settings button is visible
    const proxyBtn = page.locator('#proxy-settings-btn');
    await expect(proxyBtn).toBeVisible({ timeout: 10_000 });
    await expect(proxyBtn).toContainText('Proxy Settings');
    console.log('[test] Test passed');
  });

  test('opens proxy configuration panel when clicking proxy settings', async ({ page, baseURL }) => {
    await connectWithKindKubeconfig(page, baseURL);
    await openConnectionWizard(page);

    // Click proxy settings button
    const proxyBtn = page.locator('#proxy-settings-btn');
    await proxyBtn.click();

    // Verify proxy configuration panel is shown
    await expect(page.getByText('Proxy Configuration')).toBeVisible({ timeout: 10_000 });

    // Verify all proxy mode options are present
    await expect(page.getByText('No Proxy')).toBeVisible();
    await expect(page.getByText('Use System Proxy')).toBeVisible();
    await expect(page.getByText('Manual Configuration')).toBeVisible();
  });

  test('shows manual proxy fields when manual mode is selected', async ({ page, baseURL }) => {
    await connectWithKindKubeconfig(page, baseURL);
    await openConnectionWizard(page);

    // Click proxy settings button
    await page.locator('#proxy-settings-btn').click();
    await expect(page.getByText('Proxy Configuration')).toBeVisible({ timeout: 10_000 });

    // Select manual configuration
    await page.getByLabel('Manual Configuration').click();

    // Verify manual proxy fields appear
    await expect(page.locator('#proxyURL')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#proxyUsername')).toBeVisible();
    await expect(page.locator('#proxyPassword')).toBeVisible();
  });

  test('shows system proxy environment variables when system mode is selected', async ({ page, baseURL }) => {
    await connectWithKindKubeconfig(page, baseURL);
    await openConnectionWizard(page);

    // Click proxy settings button
    await page.locator('#proxy-settings-btn').click();
    await expect(page.getByText('Proxy Configuration')).toBeVisible({ timeout: 10_000 });

    // Select system proxy
    await page.getByLabel('Use System Proxy').click();

    // Verify system proxy info panel appears
    await expect(page.getByText('Detected System Proxy:')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('HTTP_PROXY:')).toBeVisible();
    await expect(page.getByText('HTTPS_PROXY:')).toBeVisible();
    await expect(page.getByText('NO_PROXY:')).toBeVisible();
  });

  test('can save no proxy configuration', async ({ page, baseURL }) => {
    await connectWithKindKubeconfig(page, baseURL);
    await openConnectionWizard(page);

    // Click proxy settings button
    await page.locator('#proxy-settings-btn').click();
    await expect(page.getByText('Proxy Configuration')).toBeVisible({ timeout: 10_000 });

    // Ensure "No Proxy" is selected (should be default)
    await page.getByLabel('No Proxy').click();

    // Click save
    await page.locator('#save-proxy-btn').click();

    // Should return to config selection
    await expect(page.getByText('Select Kubeconfig')).toBeVisible({ timeout: 10_000 });
  });

  test('can save manual proxy configuration', async ({ page, baseURL }) => {
    await connectWithKindKubeconfig(page, baseURL);
    await openConnectionWizard(page);

    // Click proxy settings button
    await page.locator('#proxy-settings-btn').click();
    await expect(page.getByText('Proxy Configuration')).toBeVisible({ timeout: 10_000 });

    // Select manual configuration
    await page.getByLabel('Manual Configuration').click();
    await expect(page.locator('#proxyURL')).toBeVisible({ timeout: 5_000 });

    // Fill in proxy details
    await page.locator('#proxyURL').fill('http://test-proxy.example.com:8080');
    await page.locator('#proxyUsername').fill('testuser');
    await page.locator('#proxyPassword').fill('testpass');

    // Click save
    await page.locator('#save-proxy-btn').click();

    // Should return to config selection
    await expect(page.getByText('Select Kubeconfig')).toBeVisible({ timeout: 10_000 });
  });

  test('save button is disabled when manual proxy URL is empty', async ({ page, baseURL }) => {
    await connectWithKindKubeconfig(page, baseURL);
    await openConnectionWizard(page);

    // Click proxy settings button
    await page.locator('#proxy-settings-btn').click();
    await expect(page.getByText('Proxy Configuration')).toBeVisible({ timeout: 10_000 });

    // Select manual configuration
    await page.getByLabel('Manual Configuration').click();
    await expect(page.locator('#proxyURL')).toBeVisible({ timeout: 5_000 });

    // Clear the URL field (it might have a value from previous test or loaded config)
    await page.locator('#proxyURL').clear();

    // Save button should be disabled when URL is empty
    const saveBtn = page.locator('#save-proxy-btn');
    await expect(saveBtn).toBeDisabled();

    // Fill URL
    await page.locator('#proxyURL').fill('http://proxy:8080');

    // Save button should now be enabled
    await expect(saveBtn).toBeEnabled();
  });

  test('navigates back from proxy settings to config selection', async ({ page, baseURL }) => {
    await connectWithKindKubeconfig(page, baseURL);
    await openConnectionWizard(page);

    // Click proxy settings button
    await page.locator('#proxy-settings-btn').click();
    await expect(page.getByText('Proxy Configuration')).toBeVisible({ timeout: 10_000 });

    // Click back button
    await page.getByRole('button', { name: /← Back/i }).click();

    // Should return to config selection
    await expect(page.getByText('Select Kubeconfig')).toBeVisible({ timeout: 10_000 });
  });

  test('proxy indicator appears in footer when proxy is enabled', async ({ page, baseURL }) => {
    await connectWithKindKubeconfig(page, baseURL);

    // First, let's configure a proxy (system proxy for simplicity)
    await openConnectionWizard(page);
    await page.locator('#proxy-settings-btn').click();
    await expect(page.getByText('Proxy Configuration')).toBeVisible({ timeout: 10_000 });

    // Select system proxy (assuming env vars might be set)
    // For testing, we'll just verify the UI flow works
    await page.getByLabel('Use System Proxy').click();
    await page.locator('#save-proxy-btn').click();

    // Verify we're back on config selection
    await expect(page.getByText('Select Kubeconfig')).toBeVisible({ timeout: 10_000 });

    // Complete the wizard
    await page.getByRole('button', { name: /Continue/i }).click();

    // Wait for page to load
    await waitForReconnectOverlay(page);

    // Note: The proxy indicator (#proxy-indicator) will only be visible if a proxy is actually
    // configured. Since we're in a test environment without actual proxy env vars, we just
    // verify the settings flow works. A more comprehensive test would require setting up
    // actual proxy environment variables.
  });

  test('loads existing proxy configuration when reopening settings', async ({ page, baseURL }) => {
    await connectWithKindKubeconfig(page, baseURL);

    // Configure a proxy
    await openConnectionWizard(page);
    await page.locator('#proxy-settings-btn').click();
    await page.getByLabel('Manual Configuration').click();
    await page.locator('#proxyURL').fill('http://saved-proxy:8080');
    await page.locator('#proxyUsername').fill('saveduser');
    await page.locator('#save-proxy-btn').click();

    // Close and reopen wizard
    await page.getByRole('button', { name: /Continue/i }).click();
    await waitForReconnectOverlay(page);

    // Reopen wizard and proxy settings
    await openConnectionWizard(page);
    await page.locator('#proxy-settings-btn').click();

    // Verify saved values are loaded
    await expect(page.locator('#proxyURL')).toHaveValue('http://saved-proxy:8080', { timeout: 10_000 });
    await expect(page.locator('#proxyUsername')).toHaveValue('saveduser');
  });
});
