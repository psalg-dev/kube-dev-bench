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

async function openExecTerminalForAnyTask(opts: {
  page: import('@playwright/test').Page;
  tasksTable: import('@playwright/test').Locator;
  maxRowsToTry?: number;
}) {
  const { page, tasksTable, maxRowsToTry = 6 } = opts;

  const rows = tasksTable.locator('tbody tr');
  const rowCount = await rows.count();
  const tryCount = Math.min(rowCount, maxRowsToTry);

  for (let i = 0; i < tryCount; i++) {
    await rows.nth(i).getByRole('button', { name: /^details$/i }).click();

    const panel = new SwarmBottomPanel(page);
    await panel.expectVisible();
    await panel.clickTab('Exec');

    const terminal = panel.root.locator('.xterm').first();
    const noContainer = panel.root.getByText(/no container associated with this task yet\./i);

    const outcome = await Promise.race([
      terminal
        .waitFor({ state: 'visible', timeout: 45_000 })
        .then(() => 'terminal' as const)
        .catch(() => null),
      noContainer
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => 'no-container' as const)
        .catch(() => null),
    ]);

    if (outcome === 'terminal') {
      return { panel, terminal };
    }

    await panel.closeByClickingOutside();
  }

  throw new Error(
    `No Swarm task with an exec-capable container found (tried ${tryCount}/${rowCount} rows).`,
  );
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

    await waitForAnyRow(tasksTable, 120_000);
    const { panel, terminal } = await openExecTerminalForAnyTask({ page, tasksTable });

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
