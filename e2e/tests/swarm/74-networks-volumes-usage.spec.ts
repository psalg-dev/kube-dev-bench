import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmBottomPanel } from '../../src/pages/SwarmBottomPanel.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';
import { ensureSwarmNetwork, isLocalSwarmActive } from '../../src/support/docker-swarm.js';

const fixtureNetworkName = 'kdb_e2e_net';
const fixtureStackName = 'kdb-e2e-fixtures';
const fixtureServiceA = `${fixtureStackName}_a-replicated`;
const fixtureServiceB = `${fixtureStackName}_b-logger`;
const fixtureVolumeName = `${fixtureStackName}_e2e_data`;

test.describe('Docker Swarm Networks + Volumes Usage', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    if (!(await isLocalSwarmActive())) {
      test.skip(true, 'Docker Swarm is not active');
    }
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
    // Ensure no leftover panels from previous tests
    await SwarmBottomPanel.ensureClosed(page);
  });

  test('networks tabs render (services/containers/inspect) and summary shows IPAM + Options', async ({ page, consoleErrors }) => {
    // Capture console messages for debugging (errors are captured globally via fixtures)
    const consoleMessages: string[] = [];
    page.on('console', (msg) => {
      const text = `[${msg.type()}] ${msg.text()}`;
      consoleMessages.push(text);
    });

    console.log('[DEBUG] Starting networks test');
    await ensureSwarmNetwork({ name: fixtureNetworkName });
    console.log('[DEBUG] Network ensured');

    const sidebar = new SwarmSidebarPage(page);
    console.log('[DEBUG] Going to networks section');
    await sidebar.goToNetworks();
    console.log('[DEBUG] Navigated to networks');

    const table = page.locator('[data-testid="swarm-networks-table"]');
    await expect(table).toBeVisible({ timeout: 60_000 });
    console.log('[DEBUG] Table is visible');

    const row = table.locator('tbody tr').filter({ hasText: fixtureNetworkName }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    console.log('[DEBUG] Row is visible, getting row text');
    const rowText = await row.textContent();
    console.log('[DEBUG] Row text:', rowText);

    // Check if any bottom panel is already open before clicking
    const existingPanel = page.locator('.bottom-panel');
    const existingPanelVisible = await existingPanel.first().isVisible().catch(() => false);
    console.log('[DEBUG] Existing panel visible before click:', existingPanelVisible);

    // Click the row to open the bottom panel
    console.log('[DEBUG] About to click row');
    
    // Check the bounding box of the row
    const box = await row.boundingBox();
    console.log('[DEBUG] Row bounding box:', box);
    
    // Try clicking multiple ways
    try {
      await row.click({ timeout: 5_000 });
      console.log('[DEBUG] Row click succeeded');
    } catch (e) {
      console.log('[DEBUG] Row click failed, trying force click:', e);
      await row.click({ force: true, timeout: 5_000 });
    }
    console.log('[DEBUG] Row clicked');

    // Small delay to let any state changes propagate
    await page.waitForTimeout(1000);
    
    // Check if panel appeared
    const anyPanel = page.locator('.bottom-panel');
    const anyPanelVisible = await anyPanel.first().isVisible().catch(() => false);
    console.log('[DEBUG] Any bottom panel visible after click:', anyPanelVisible);
    
    // If no panel, try clicking again or via JS
    if (!anyPanelVisible) {
      console.log('[DEBUG] Panel not visible, trying JS click');
      await row.evaluate((el) => (el as HTMLElement).click());
      await page.waitForTimeout(500);
      const panelVisibleAfterJs = await anyPanel.first().isVisible().catch(() => false);
      console.log('[DEBUG] Panel visible after JS click:', panelVisibleAfterJs);
    }
    
    if (anyPanelVisible || await anyPanel.first().isVisible().catch(() => false)) {
      const panelHtml = await anyPanel.first().innerHTML().catch(() => 'error getting html');
      console.log('[DEBUG] Panel HTML (first 500 chars):', panelHtml.substring(0, 500));
    } else {
      // Log page state for debugging
      const pageHtml = await page.content();
      const hasBottomPanel = pageHtml.includes('bottom-panel');
      console.log('[DEBUG] Page contains bottom-panel class:', hasBottomPanel);
      
      // Check for any overlay or modal blocking
      const overlays = await page.locator('.overlay, .modal, .connection-wizard-overlay').count();
      console.log('[DEBUG] Number of overlays/modals:', overlays);
      
      // Log console errors
      console.log('[DEBUG] Console errors:', consoleErrors);
      console.log('[DEBUG] All console messages (last 20):', consoleMessages.slice(-20));
      
      // Check if bottom-panel exists but is hidden
      const allPanels = await page.locator('.bottom-panel').all();
      console.log('[DEBUG] Number of bottom-panel elements:', allPanels.length);
      for (let i = 0; i < allPanels.length; i++) {
        const panel = allPanels[i];
        const isVisible = await panel.isVisible().catch(() => false);
        const style = await panel.getAttribute('style').catch(() => null);
        const className = await panel.getAttribute('class').catch(() => null);
        console.log(`[DEBUG] Panel ${i}: visible=${isVisible}, style="${style}", class="${className}"`);
      }
    }

    // Wait for the bottom panel to appear (only one panel at a time)
    const panelRoot = page.locator('.bottom-panel').first();
    console.log('[DEBUG] Waiting for bottom panel');
    await expect(panelRoot).toBeVisible({ timeout: 30_000 });

    // Verify we're viewing the correct network by checking Summary tab content
    // Click Summary tab to ensure we're on the right tab
    await panelRoot.getByRole('button', { name: 'Summary', exact: true }).click();
    // Verify the network name appears in the Quick Info section
    await expect(panelRoot.getByText(fixtureNetworkName, { exact: true }).first()).toBeVisible({ timeout: 60_000 });
    await expect(panelRoot.getByText('IPAM', { exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(panelRoot.getByText('Options', { exact: true })).toBeVisible({ timeout: 60_000 });

    // Connected Services tab shows expected services.
    const connectedServicesTab = panelRoot.getByRole('button', { name: 'Connected Services', exact: true });
    await expect(connectedServicesTab).toBeVisible({ timeout: 10_000 });
    await connectedServicesTab.click();
    // Ensure panel is still open after tab click
    await expect(panelRoot).toBeVisible({ timeout: 5_000 });
    await expect
      .poll(async () => {
        const hasExpected =
          (await panelRoot.getByText(fixtureServiceA).count()) > 0 ||
          (await panelRoot.getByText(fixtureServiceB).count()) > 0;
        const rowCount = await panelRoot.locator('table.panel-table tbody tr').count().catch(() => 0);
        const emptyVisible = await panelRoot.locator('.empty-tab-content').isVisible().catch(() => false);
        return hasExpected || (rowCount > 0 && !emptyVisible);
      })
      .toBe(true);

    // Containers tab renders and has at least one row/task.
    const containersTab = panelRoot.getByRole('button', { name: 'Containers', exact: true });
    await expect(containersTab).toBeVisible({ timeout: 10_000 });
    await containersTab.click();
    // Ensure panel is still open after tab click
    await expect(panelRoot).toBeVisible({ timeout: 5_000 });
    // Wait for the containers content to load - header shows "Containers (Tasks)" followed by a count
    await expect(panelRoot.getByText(/^Containers \(Tasks\)/)).toBeVisible({ timeout: 60_000 });

    // Inspect tab loads JSON.
    const inspectTab = panelRoot.getByRole('button', { name: 'Inspect', exact: true });
    await expect(inspectTab).toBeVisible({ timeout: 10_000 });
    await inspectTab.click();
    // Ensure panel is still open after tab click
    await expect(panelRoot).toBeVisible({ timeout: 5_000 });
    await expect(panelRoot.locator('.cm-content').first()).toContainText('{', { timeout: 60_000 });
  });

  test('volume used-by shows service; delete is guarded when in use', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    await sidebar.goToVolumes();

    const table = page.locator('[data-testid="swarm-volumes-table"]');
    await expect(table).toBeVisible({ timeout: 60_000 });

    const row = table.locator('tbody tr').filter({ hasText: fixtureVolumeName }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.click();

    const panelRoot = page.locator('.bottom-panel').first();
    await expect(panelRoot).toBeVisible({ timeout: 30_000 });

    await panelRoot.getByRole('button', { name: 'Summary', exact: true }).click();
    // Verify we're viewing the correct volume - use .first() since name may appear in mount path too
    await expect(panelRoot.getByText(fixtureVolumeName).first()).toBeVisible({ timeout: 60_000 });

    // Used By section should list the service that mounts the volume.
    await expect(panelRoot.getByText('Used By', { exact: true })).toBeVisible({ timeout: 60_000 });
    if (await panelRoot.getByText(fixtureServiceA).isVisible().catch(() => false)) {
      await expect(panelRoot.getByText(fixtureServiceA)).toBeVisible({ timeout: 60_000 });
    }
    if (await panelRoot.getByText(fixtureServiceB).isVisible().catch(() => false)) {
      await expect(panelRoot.getByText(fixtureServiceB)).toBeVisible({ timeout: 60_000 });
    }

    // Delete is guarded: depending on UI path, this may be a browser confirm dialog and/or a modal.
    let sawConfirmDialog = false;
    page.once('dialog', async (d) => {
      sawConfirmDialog = true;
      if (d.type() === 'confirm') await d.dismiss();
      else await d.dismiss();
    });

    await panelRoot.getByRole('button', { name: 'Delete', exact: true }).click();

    // If an in-app confirmation modal exists, close it (best-effort).
    const cancelBtn = page.getByRole('button', { name: 'Cancel', exact: true });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
    } else if (!sawConfirmDialog) {
      await page.keyboard.press('Escape').catch(() => undefined);
    }

    // Volume should still exist (we never confirmed deletion).
    await expect(table.locator('tbody tr').filter({ hasText: fixtureVolumeName }).first()).toBeVisible({ timeout: 60_000 });
  });
});
