import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_BASE_URL = 'http://localhost:34115';

export function getRepoRoot() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.resolve(__dirname, '..', '..');
}

/**
 * Remove persisted app state in the e2e HOME to simulate a fresh install.
 */
export async function resetAppStateOnDisk() {
  const repoRoot = getRepoRoot();
  const tempHome = path.join(repoRoot, 'e2e', '.home-e2e');
  const targets = [path.join(tempHome, 'KubeDevBench'), path.join(tempHome, '.kube')];
  for (const target of targets) {
    try {
      await fs.promises.rm(target, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors so tests keep running
    }
  }
}

/**
 * Wait for the Wails reconnect overlay to disappear (if present)
 */
async function waitForReconnectOverlay(page: Page) {
  const reconnectOverlay = page.locator('.wails-reconnect-overlay');
  if (await reconnectOverlay.isVisible().catch(() => false)) {
    await reconnectOverlay.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => {});
  }
}

/**
 * Open the connection wizard overlay
 */
async function openConnectionWizard(page: Page) {
  console.log('[openConnectionWizard] Starting...');
  const wizardOverlay = page.locator('.connection-wizard-overlay');
  const gearBtn = page.locator('#show-wizard-btn');

  // Check if wizard is already visible
  if (await wizardOverlay.isVisible().catch(() => false)) {
    console.log('[openConnectionWizard] Wizard already visible');
    return;
  }

  // Wait for gear button and click it
  console.log('[openConnectionWizard] Waiting for gear button...');
  await gearBtn.waitFor({ state: 'visible', timeout: 10_000 });
  console.log('[openConnectionWizard] Clicking gear button');
  await gearBtn.click();
  await expect(wizardOverlay).toBeVisible({ timeout: 10_000 });
  console.log('[openConnectionWizard] Wizard is now visible');
}

/**
 * Close any open dropdown menus
 */
async function closeOpenMenus(page: Page) {
  for (let j = 0; j < 3; j++) {
    const openMenus = await page.locator('.kdv__menu-portal').count();
    if (openMenus === 0) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(100);
  }
}

/**
 * Wait for the page to be stable (no pending network requests, DOM settled)
 */
async function waitForPageStable(page: Page, timeout = 10000) {
  // Wait for network to be idle
  await page.waitForLoadState('networkidle', { timeout }).catch(() => {});
  // Wait for DOM to settle (no pending React updates)
  await page.waitForTimeout(500);
  // Extra stability check: wait for any loading spinners to disappear
  try {
    await page.locator('.loading-spinner, .loader, [data-loading="true"]').waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  } catch {
    // Ignore if no loading elements found
  }
}

/**
 * Click an element with retry logic for detached elements
 */
async function clickWithRetry(page: Page, locator: ReturnType<Page['locator']>, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Wait for element to be stable before clicking
      await locator.waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForTimeout(100); // Brief pause to let React settle
      await locator.click({ timeout: 5000 });
      return;
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      // Element was detached, wait and retry
      await page.waitForTimeout(500);
    }
  }
}

/**
 * Reset proxy settings to "No Proxy" mode
 * Call this when the connection wizard is already visible
 */
async function resetProxySettings(page: Page): Promise<boolean> {
  try {
    const proxyBtn = page.locator('#proxy-settings-btn');
    if (!await proxyBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      return false;
    }

    await proxyBtn.click();
    await page.waitForTimeout(300);

    const noProxyLabel = page.getByLabel('No Proxy');
    if (!await noProxyLabel.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Not on proxy settings page, go back
      const backBtn = page.getByRole('button', { name: /← Back/i });
      if (await backBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
        await backBtn.click();
      }
      return false;
    }

    await noProxyLabel.click();

    const saveBtn = page.locator('#save-proxy-btn');
    if (await saveBtn.isEnabled({ timeout: 2_000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(300);
      return true;
    }

    // If save not enabled, go back
    const backBtn = page.getByRole('button', { name: /← Back/i });
    if (await backBtn.isVisible({ timeout: 1_000 }).catch(() => false)) {
      await backBtn.click();
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Connect to a Kubernetes cluster using the KinD kubeconfig
 * Handles all wizard states: fresh start, discovered configs, already connected
 */
export async function connectWithKindKubeconfig(page: Page, baseURL?: string) {
  console.log('[connectWithKindKubeconfig] Starting...');
  const repoRoot = getRepoRoot();
  const kubeconfigPath = process.env.KUBEDEV_BENCH_KIND_KUBECONFIG || path.join(repoRoot, 'kind', 'output', 'kubeconfig');
  console.log('[connectWithKindKubeconfig] Kubeconfig path:', kubeconfigPath);
  const kubeconfig = fs.readFileSync(kubeconfigPath, 'utf-8');

  const targetUrl = baseURL || DEFAULT_BASE_URL;
  console.log('[connectWithKindKubeconfig] Navigating to:', targetUrl);
  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });
  console.log('[connectWithKindKubeconfig] Page loaded, current URL:', page.url());
  await waitForReconnectOverlay(page);
  await waitForPageStable(page);

  const wizardOverlay = page.locator('.connection-wizard-overlay');
  const gearBtn = page.locator('#show-wizard-btn');
  const sidebar = page.locator('#sidebar');

  // Check if we're already connected (sidebar visible, wizard not visible)
  const sidebarVisible = await sidebar.isVisible({ timeout: 3_000 }).catch(() => false);
  console.log('[connectWithKindKubeconfig] Sidebar visible:', sidebarVisible);
  if (sidebarVisible) {
    const wizardVisible = await wizardOverlay.isVisible().catch(() => false);
    console.log('[connectWithKindKubeconfig] Wizard visible:', wizardVisible);
    if (!wizardVisible) {
      // Already connected, just verify and return
      console.log('[connectWithKindKubeconfig] Already connected, returning');
      await waitForPageStable(page);
      return;
    }
  }

  // Wait for either overlay or gear button to appear
  console.log('[connectWithKindKubeconfig] Waiting for overlay or gear button...');
  const appeared = await Promise.race<Promise<"overlay" | "gear" | null>[]>([
    wizardOverlay.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'overlay').catch(() => null),
    gearBtn.waitFor({ state: 'visible', timeout: 15_000 }).then(() => 'gear').catch(() => null),
  ]);
  console.log('[connectWithKindKubeconfig] Appeared:', appeared);

  if (appeared !== 'overlay') {
    if (await gearBtn.isVisible().catch(() => false)) {
      console.log('[connectWithKindKubeconfig] Clicking gear button');
      await clickWithRetry(page, gearBtn);
    }
    await expect(wizardOverlay).toBeVisible({ timeout: 10_000 });
  }

  // Reset proxy settings to ensure clean connection
  console.log('[connectWithKindKubeconfig] Resetting proxy settings');
  await resetProxySettings(page);

  // Handle different wizard states
  const primaryArea = page.locator('#primaryConfigContent');
  const selectKubeconfigHeading = page.getByText('Select Kubeconfig');
  const continueBtn = page.getByRole('button', { name: /^Continue$/i });
  const pasteAdditionalBtn = page.getByRole('button', { name: /Paste Additional Config/i });

  // Wait a moment for wizard content to stabilize
  await page.waitForTimeout(500);

  // Log what we see
  const primaryVisible = await primaryArea.isVisible({ timeout: 1_000 }).catch(() => false);
  const selectVisible = await selectKubeconfigHeading.isVisible({ timeout: 1_000 }).catch(() => false);
  const continueVisible = await continueBtn.isVisible({ timeout: 1_000 }).catch(() => false);
  console.log('[connectWithKindKubeconfig] Wizard state - primaryArea:', primaryVisible, 'selectKubeconfig:', selectVisible, 'continue:', continueVisible);

  // Case 1: Fresh start - primary config textarea is visible
  if (await primaryArea.isVisible({ timeout: 3_000 }).catch(() => false)) {
    console.log('[connectWithKindKubeconfig] Case 1: Fresh start - filling primary config');
    await primaryArea.fill(kubeconfig);
    await page.waitForTimeout(200);
    await page.getByRole('button', { name: /Save \& Continue/i }).click();
  }
  // Case 2: Discovered configs - "Select Kubeconfig" heading visible
  else if (await selectKubeconfigHeading.isVisible({ timeout: 3_000 }).catch(() => false)) {
    console.log('[connectWithKindKubeconfig] Case 2: Discovered configs');
    // Check if there's a discovered config we can use
    const discoveredConfig = page.locator('.config-item').first();
    if (await discoveredConfig.isVisible({ timeout: 2_000 }).catch(() => false)) {
      console.log('[connectWithKindKubeconfig] Clicking discovered config');
      // Click on the discovered config to select it, then continue
      await discoveredConfig.click();
      await page.waitForTimeout(500);
    }

    // If Continue is available, just continue (existing config will be used)
    if (await continueBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      console.log('[connectWithKindKubeconfig] Clicking Continue');
      await continueBtn.click();
    }
    // Otherwise, paste additional config
    else if (await pasteAdditionalBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      console.log('[connectWithKindKubeconfig] Pasting additional config');
      await pasteAdditionalBtn.click();
      await page.waitForTimeout(300);
      await page.locator('#configName').fill('kind-e2e');
      await page.locator('#configContent').fill(kubeconfig);
      await page.getByRole('button', { name: /Save \& Use/i }).click();
      // After saving, Continue button should appear
      await expect(continueBtn).toBeVisible({ timeout: 5_000 });
      await continueBtn.click();
    }
  }
  // Case 3: Other state - try to navigate to a usable state
  else {
    console.log('[connectWithKindKubeconfig] Case 3: Other state');
    // Try paste additional config flow
    if (await pasteAdditionalBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      console.log('[connectWithKindKubeconfig] Pasting additional config (case 3)');
      await pasteAdditionalBtn.click();
      await page.waitForTimeout(300);
      await page.locator('#configName').fill('kind-e2e');
      await page.locator('#configContent').fill(kubeconfig);
      await page.getByRole('button', { name: /Save \& Use/i }).click();
      await expect(continueBtn).toBeVisible({ timeout: 5_000 });
      await continueBtn.click();
    } else if (await continueBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      console.log('[connectWithKindKubeconfig] Clicking Continue (case 3)');
      await continueBtn.click();
    } else {
      console.log('[connectWithKindKubeconfig] No actionable state found!');
    }
  }

  // Wait for wizard to close and page to stabilize
  console.log('[connectWithKindKubeconfig] Waiting for wizard to close...');
  await wizardOverlay.waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {});
  await waitForPageStable(page);

  // Verify we're in the main app (not stuck in wizard)
  console.log('[connectWithKindKubeconfig] Verifying sidebar is visible');
  await expect(sidebar).toBeVisible({ timeout: 15_000 });
  console.log('[connectWithKindKubeconfig] Done!');
}

/**
 * Select a namespace with optimized polling
 * Uses same logic as original tests but with improved stability
 */
export async function selectNamespace(page: Page, namespace: string) {
  const control = page.locator('#namespace-root .kdv__control');

  // Wait for page to stabilize before interacting with namespace dropdown
  await waitForPageStable(page);

  // Wait for namespace control to be enabled - increased timeout for slow clusters
  try {
    await expect(page.locator('#namespace-root .kdv__control--is-disabled')).toHaveCount(0, { timeout: 180_000 });
  } catch (err) {
    console.log('Namespace control still disabled after 180s, trying anyway...');
  }

  // Additional stabilization wait after control becomes enabled
  await page.waitForTimeout(2000);

  // Check if namespace is already selected
  const namespaceChip = page.locator('#namespace-root .kdv__multi-value__label', { hasText: namespace });
  if (await namespaceChip.isVisible().catch(() => false)) {
    // Namespace already selected, verify and return early
    await expect(namespaceChip).toBeVisible({ timeout: 5_000 });
    return;
  }

  const testOption = page.getByRole('option', { name: new RegExp(`^${namespace}$`, 'i') });

  // Ensure no stray menus are open
  await closeOpenMenus(page);
  
  // Click somewhere neutral to dismiss any popups
  const main = page.locator('#maincontent');
  if (await main.isVisible().catch(() => false)) {
    await main.click({ force: true, position: { x: 10, y: 10 } });
  }

  // Wait for page to be stable again after closing menus
  await waitForPageStable(page);
  await page.waitForTimeout(1000);

  let selected = false;
  const maxAttempts = 45; // Reasonable number of attempts
  const pollInterval = 4000; // Longer poll interval for stability

  for (let i = 0; i < maxAttempts; i++) {
    // Ensure no other select menu portals are open that could intercept clicks
    await closeOpenMenus(page);
    await page.waitForTimeout(500);

    // Re-check if already selected (might have happened during delay)
    if (await namespaceChip.isVisible().catch(() => false)) {
      selected = true;
      break;
    }

    // Open the namespace dropdown with retry logic
    try {
      await control.waitFor({ state: 'visible', timeout: 5000 });
      await page.waitForTimeout(300);
      await control.click({ timeout: 5000 });
    } catch {
      console.log(`Attempt ${i + 1}: Failed to click namespace control, retrying...`);
      await page.waitForTimeout(pollInterval);
      continue;
    }

    // Wait for the menu to render
    await page.waitForTimeout(1000);

    if (await testOption.first().isVisible().catch(() => false)) {
      try {
        await testOption.first().click({ timeout: 5000 });
        // Wait for selection to register
        await page.waitForTimeout(800);
        selected = true;
        break;
      } catch (clickErr) {
        // Click might fail if element was detached, retry
        console.log(`Attempt ${i + 1}: Failed to click namespace option, retrying...`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(pollInterval);
        continue;
      }
    }

    // Close the dropdown if option wasn't found
    await page.keyboard.press('Escape');
    await page.waitForTimeout(pollInterval);
  }

  if (!selected) {
    throw new Error(`Failed to select namespace '${namespace}' after ${maxAttempts} attempts`);
  }
  
  await expect(namespaceChip).toBeVisible({ timeout: 30_000 });
}

/**
 * Select a section in the sidebar
 */
export async function selectSection(page: Page, sectionKey: string) {
  await closeOpenMenus(page);

  const section = page.locator(`#section-${sectionKey}`);
  await expect(section).toBeVisible({ timeout: 10_000 });
  await section.click();
  await expect(section).toHaveClass(/selected/);
}

/**
 * Get replica count for a resource
 */
export async function getReplicaCount(page: Page, rowName: string, columnIndex: number) {
  const row = page.locator('tbody tr').filter({ hasText: rowName }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  const cell = row.locator('td').nth(columnIndex - 1);
  await expect(cell).toBeVisible({ timeout: 30_000 });
  const raw = (await cell.innerText()).trim();
  const parsed = parseInt(raw, 10);
  if (Number.isNaN(parsed)) {
    throw new Error(`Unable to parse replica count '${raw}' for ${rowName}`);
  }
  return parsed;
}

/**
 * Open the bottom panel for a resource row
 */
export async function openRowPanel(page: Page, rowName: string) {
  const row = page.locator('tbody tr').filter({ hasText: rowName }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  // Small delay to ensure row is fully rendered and clickable
  await page.waitForTimeout(100);
  await row.click();
  const panel = page.locator('.bottom-panel');
  await expect(panel).toBeVisible({ timeout: 10_000 });
  return panel;
}

/**
 * Apply scale change from the panel
 */
export async function applyScaleFromPanel(page: Page, target: number) {
  const panel = page.locator('.bottom-panel');
  await expect(panel).toBeVisible({ timeout: 5_000 });
  const scaleBtn = panel.getByRole('button', { name: /^Scale$/i }).first();
  await scaleBtn.click();
  const input = panel.getByLabel('Replicas');
  await expect(input).toBeVisible();
  await input.fill(String(target));
  await panel.getByRole('button', { name: /Apply/i }).click();
  await expect(panel.getByLabel('Replicas')).toHaveCount(0, { timeout: 5_000 });
}

/**
 * Wait for replica value to change
 */
export async function waitForReplicaValue(page: Page, rowName: string, columnIndex: number, expectedValue: number) {
  const row = page.locator('tbody tr').filter({ hasText: rowName }).first();
  const cell = row.locator('td').nth(columnIndex - 1);
  await expect(cell).toHaveText(String(expectedValue), { timeout: 60_000 });
}

/**
 * Close the bottom panel
 */
export async function closeBottomPanel(page: Page) {
  const panel = page.locator('.bottom-panel');
  if (!await panel.isVisible().catch(() => false)) return;
  await panel.getByTitle('Close').click();
  await expect(panel).toBeHidden({ timeout: 5_000 });
}

/**
 * Helper to scale a resource and revert it
 */
export async function scaleAndRevert(page: Page, options: { section: string; name: string; columnIndex: number }) {
  await selectSection(page, options.section);
  const current = await getReplicaCount(page, options.name, options.columnIndex);
  const next = current === 0 ? 1 : current + 1;
  await openRowPanel(page, options.name);
  await applyScaleFromPanel(page, next);
  await waitForReplicaValue(page, options.name, options.columnIndex, next);
  await applyScaleFromPanel(page, current);
  await waitForReplicaValue(page, options.name, options.columnIndex, current);
  await closeBottomPanel(page);
}

/**
 * Verify a resource row exists in the current table
 */
export async function verifyResourceRow(page: Page, resourceName: string) {
  const row = page.locator('tbody tr').filter({ hasText: resourceName }).first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  return row;
}

/**
 * Get all visible rows in the current resource table
 */
export async function getTableRowCount(page: Page) {
  const rows = page.locator('tbody tr');
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  return rows.count();
}

/**
 * Switch to a specific tab in the bottom panel
 */
export async function switchPanelTab(page: Page, tabLabel: string) {
  const panel = page.locator('.bottom-panel');
  await expect(panel).toBeVisible({ timeout: 5_000 });
  const tab = panel.getByRole('button', { name: new RegExp(`^${tabLabel}$`, 'i') });
  await expect(tab).toBeVisible({ timeout: 5_000 });
  await tab.click();
  // Wait for tab to be active (has accent border)
  await page.waitForTimeout(300);
}

/**
 * Verify YAML content is visible in the YAML tab
 */
export async function verifyYamlTabContent(page: Page) {
  const panel = page.locator('.bottom-panel');
  // YAML tab uses CodeMirror - look for the editor container
  const yamlContent = panel.locator('.cm-editor, .cm-content, pre');
  await expect(yamlContent.first()).toBeVisible({ timeout: 10_000 });
}

/**
 * Trigger restart action on the currently selected resource
 * Requires double-click confirmation
 */
export async function restartResource(page: Page) {
  const panel = page.locator('.bottom-panel');
  await expect(panel).toBeVisible({ timeout: 5_000 });

  const restartBtn = panel.getByRole('button', { name: /^Restart$/i }).first();
  await expect(restartBtn).toBeVisible({ timeout: 5_000 });

  // First click enters confirm mode
  await restartBtn.click();

  // Wait for confirm button to appear
  const confirmBtn = panel.getByRole('button', { name: /^Confirm$/i }).first();
  await expect(confirmBtn).toBeVisible({ timeout: 5_000 });

  // Second click confirms
  await confirmBtn.click();

  // Wait for action to complete (button should revert to Restart)
  await expect(panel.getByRole('button', { name: /^Restart$/i }).first()).toBeVisible({ timeout: 10_000 });
}

/**
 * Trigger start action on a Job
 */
export async function startJob(page: Page) {
  const panel = page.locator('.bottom-panel');
  await expect(panel).toBeVisible({ timeout: 5_000 });

  const startBtn = panel.getByRole('button', { name: /^Start$/i }).first();
  await expect(startBtn).toBeVisible({ timeout: 5_000 });
  await startBtn.click();

  // Wait briefly for action to complete
  await page.waitForTimeout(1000);
}

/**
 * Suspend a CronJob
 */
export async function suspendCronJob(page: Page) {
  const panel = page.locator('.bottom-panel');
  await expect(panel).toBeVisible({ timeout: 5_000 });

  const suspendBtn = panel.getByRole('button', { name: /^Suspend$/i }).first();
  await expect(suspendBtn).toBeVisible({ timeout: 5_000 });
  await suspendBtn.click();

  await page.waitForTimeout(1000);
}

/**
 * Resume a CronJob
 */
export async function resumeCronJob(page: Page) {
  const panel = page.locator('.bottom-panel');
  await expect(panel).toBeVisible({ timeout: 5_000 });

  const resumeBtn = panel.getByRole('button', { name: /^Resume$/i }).first();
  await expect(resumeBtn).toBeVisible({ timeout: 5_000 });
  await resumeBtn.click();

  await page.waitForTimeout(1000);
}

/**
 * Start a Job from a CronJob (manual trigger)
 */
export async function startJobFromCronJob(page: Page) {
  const panel = page.locator('.bottom-panel');
  await expect(panel).toBeVisible({ timeout: 5_000 });

  // For CronJobs, the Start button triggers a new job
  const startBtn = panel.getByRole('button', { name: /^Start$/i }).first();
  await expect(startBtn).toBeVisible({ timeout: 5_000 });
  await startBtn.click();

  await page.waitForTimeout(1000);
}

/**
 * Verify connection status indicator shows connected
 */
export async function verifyConnected(page: Page) {
  const footerDot = page.locator('#footer-dot');
  await expect(footerDot).toHaveAttribute('title', /Connected|Insecure connection/i, { timeout: 60_000 });
}

/**
 * Common setup: connect and select test namespace
 * Includes retry logic for robustness
 */
export async function setupConnectedState(page: Page, baseURL?: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await connectWithKindKubeconfig(page, baseURL);
      await selectNamespace(page, 'test');
      await verifyConnected(page);
      return; // Success
    } catch (err) {
      console.log(`setupConnectedState attempt ${attempt}/${maxRetries} failed:`, err);
      if (attempt === maxRetries) {
        throw err;
      }
      // Wait and retry
      await page.waitForTimeout(3000);
      // Reload page before retry
      await page.goto(baseURL || DEFAULT_BASE_URL, { waitUntil: 'domcontentloaded' });
      await waitForPageStable(page);
    }
  }
}

/**
 * Wait for a notification toast to appear with specific text
 */
export async function waitForNotification(page: Page, textPattern: RegExp | string, timeout = 10_000) {
  const notification = page.locator('.notification-toast, .toast, [class*="notification"]');
  if (typeof textPattern === 'string') {
    await expect(notification.filter({ hasText: textPattern })).toBeVisible({ timeout });
  } else {
    await expect(notification.filter({ hasText: textPattern })).toBeVisible({ timeout });
  }
}

/**
 * Open connection wizard - exported from internal function
 */
export { openConnectionWizard };

/**
 * Wait for reconnect overlay - exported from internal function
 */
export { waitForReconnectOverlay };

/**
 * Close open menus - exported from internal function
 */
export { closeOpenMenus };
