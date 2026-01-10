/**
 * E2E tests for Docker Swarm Task exec (interactive shell).
 *
 * Validates that the Exec tab can start a TTY session and run commands.
 *
 * Prerequisites:
 * - Docker daemon running with Swarm mode enabled
 * - Swarm fixtures deployed by e2e global setup (or bootstrapSwarm seeding)
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmBottomPanel } from '../../src/pages/SwarmBottomPanel.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';

async function expectSwarmConnected(page: import('@playwright/test').Page) {
  const sidebar = new SwarmSidebarPage(page);
  await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 30_000 });
  return sidebar;
}

async function waitForAnyRow(table: import('@playwright/test').Locator, timeoutMs = 90_000) {
  const detailsButtons = table.getByRole('button', { name: /^details$/i });
  await expect(detailsButtons.first()).toBeVisible({ timeout: timeoutMs });
  return detailsButtons;
}

test.describe('Docker Swarm Task Exec', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(150_000);
    await page.goto('/');
    // Ensure at least one nginx:alpine service exists so tasks have /bin/sh.
    await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: true });
  });

  test('can open Exec tab and run a command', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToTasks();

    const tasksTable = page.locator('[data-testid="swarm-tasks-table"]');
    await expect(tasksTable).toBeVisible({ timeout: 30_000 });

    const detailsButtons = await waitForAnyRow(tasksTable, 120_000);
    await detailsButtons.first().click();

    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();

    await panel.clickTab('Exec');

    const terminal = panel.root.locator('.xterm').first();
    await expect(terminal).toBeVisible({ timeout: 30_000 });

    // Fail fast if backend reports exec failure (e.g. missing shell).
    await expect(panel.root).not.toContainText(/swarm exec error|oci runtime exec failed/i, { timeout: 10_000 });

    // Wait for a prompt before sending input (prevents racing the PTY startup).
    await expect(terminal).toContainText(/[#\$]\s/, { timeout: 30_000 });

    // Focus xterm's helper textarea (it may be visually hidden).
    const textarea = terminal.locator('textarea').first();
    await textarea.focus();

    // Run a simple command.
    await page.keyboard.type('echo READY', { delay: 20 });
    await page.keyboard.press('Enter');

    await expect(terminal).toContainText('READY', { timeout: 30_000 });
  });
});
