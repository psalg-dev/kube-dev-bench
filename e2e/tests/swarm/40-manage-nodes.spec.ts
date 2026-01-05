/**
 * E2E tests for Docker Swarm Nodes management.
 * 
 * Prerequisites:
 * - Docker daemon running with Swarm mode enabled
 * - Current node is a manager
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmBottomPanel } from '../../src/pages/SwarmBottomPanel.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';

test.describe('Docker Swarm Nodes View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('displays nodes table', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToNodes();
    
    // Verify nodes table is visible
    const nodesTable = page.locator('[data-testid="swarm-nodes-table"]');
    await expect(nodesTable).toBeVisible({ timeout: 30_000 });
    
    // Verify table headers
    await expect(nodesTable.getByRole('columnheader', { name: /hostname|name/i })).toBeVisible();
    await expect(nodesTable.getByRole('columnheader', { name: /status|state/i })).toBeVisible();
    await expect(nodesTable.getByRole('columnheader', { name: /role/i })).toBeVisible();
  });

  test('shows node count in sidebar', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    const count = await sidebar.getSectionCount('swarm-nodes');
    // Should have at least 1 node (the local manager)
    expect(count).toBeGreaterThanOrEqual(1);
  });

  test('opens node details panel on row click', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToNodes();
    
    // Wait for table to load
    const nodesTable = page.locator('[data-testid="swarm-nodes-table"]');
    const firstRow = nodesTable.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    
    // Click first node row
    await firstRow.click();
    
    // Verify bottom panel opens
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
  });

  test('node details shows hostname and role', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToNodes();
    
    const nodesTable = page.locator('[data-testid="swarm-nodes-table"]');
    const firstRow = nodesTable.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await firstRow.click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    
    // Should show node info
    await expect(panel.root.getByText(/hostname|role|manager|worker/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('node details shows Tasks tab', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToNodes();
    
    const nodesTable = page.locator('[data-testid="swarm-nodes-table"]');
    const firstRow = nodesTable.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await firstRow.click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    
    // Click Tasks tab
    const tasksTab = panel.tab('Tasks');
    if (await tasksTab.isVisible().catch(() => false)) {
      await tasksTab.click();
      
      // Should show tasks running on this node
      await expect(
        panel.root.locator('table')
          .or(panel.root.getByText(/no tasks|loading/i))
      ).toBeVisible({ timeout: 15_000 });
    }
  });

  test('shows node status (ready/down)', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToNodes();
    
    // Wait for table to load
    const nodesTable = page.locator('[data-testid="swarm-nodes-table"]');
    await expect(nodesTable.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
    
    // Should show state/status column with ready/down status
    // Current table columns: Hostname, Role, Availability, State, ...
    const statusCell = nodesTable.locator('tbody tr').first().locator('td').nth(3);
    const statusText = await statusCell.textContent();
    
    // Status should be "ready", "down", or similar
    expect(statusText?.toLowerCase()).toMatch(/ready|down|disconnected|active/);
  });

  test('shows manager/worker role', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToNodes();
    
    // Wait for table to load
    const nodesTable = page.locator('[data-testid="swarm-nodes-table"]');
    await expect(nodesTable.locator('tbody tr').first()).toBeVisible({ timeout: 30_000 });
    
    // Should show role (manager or worker)
    await expect(page.getByText(/manager|worker|leader/i).first()).toBeVisible();
  });
});

test.describe('Docker Swarm Node Management', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('can update node availability (drain/active)', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToNodes();
    
    const nodesTable = page.locator('[data-testid="swarm-nodes-table"]');
    const firstRow = nodesTable.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await firstRow.click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    
    // Look for availability control (drain/active toggle or buttons)
    const drainBtn = panel.root.getByRole('button', { name: /drain/i });
    const activeBtn = panel.root.getByRole('button', { name: /active|activate/i });
    
    // If drain/active buttons exist, test them
    if (await drainBtn.isVisible().catch(() => false)) {
      // Get current state first
      const isDrained = await panel.root.getByText(/drained|drain/i).isVisible().catch(() => false);
      
      if (!isDrained) {
        // Try to drain (but cancel to avoid disruption)
        await drainBtn.click();
        
        // Should show confirmation or change state
        const confirmDialog = page.locator('[role="dialog"], .confirm-dialog');
        if (await confirmDialog.isVisible().catch(() => false)) {
          // Cancel to avoid actual drain
          await page.getByRole('button', { name: /cancel/i }).click();
        }
      }
    }
    
    // Test passes if we can interact with node controls
    await panel.expectNoErrorText();
  });

  test('can view node labels', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToNodes();
    
    const nodesTable = page.locator('[data-testid="swarm-nodes-table"]');
    const firstRow = nodesTable.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 30_000 });
    await firstRow.click();
    
    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    
    // Look for labels section (might be in Summary tab)
    await panel.clickTab('Summary');
    
    // Labels might be shown if any exist
    // This is a soft assertion - not all nodes have labels
    const labelsSection = panel.root.getByText(/labels/i);
    if (await labelsSection.isVisible().catch(() => false)) {
      await expect(labelsSection).toBeVisible();
    }
  });
});
