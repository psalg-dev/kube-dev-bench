/**
 * Holmes Mock Error Handling E2E Tests
 *
 * These tests verify that the Holmes integration handles various error
 * scenarios gracefully, including timeouts, server errors, and connection
 * failures.
 */

import { test, expect } from '../../src/fixtures.js';
import type { Page } from '@playwright/test';
import { bootstrapApp } from '../../src/support/bootstrap.js';
import {
  configureHolmesMock,
  disableHolmes,
} from '../../src/support/holmes-bootstrap.js';
import { startHolmesMockServer, type HolmesMockInstance } from '../../src/support/holmes-mock.js';
import { withinRepo } from '../../src/support/paths.js';
import { BottomPanel } from '../../src/pages/BottomPanel.js';
import { SidebarPage } from '../../src/pages/SidebarPage.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { waitForTableRow } from '../../src/support/wait-helpers.js';
import net from 'node:net';

/**
 * Find a free port by binding to port 0 and reading the assigned port.
 * Returns a port in the ephemeral range.
 */
async function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        const port = addr.port;
        server.close(() => resolve(port));
      } else {
        server.close(() => reject(new Error('Failed to get port')));
      }
    });
  });
}

/**
 * Robustly kill a Holmes mock server process.
 * Uses both SIGTERM and SIGKILL to ensure process termination.
 * Returns a promise that resolves when the process is dead.
 */
async function killMockServer(instance: HolmesMockInstance | null): Promise<void> {
  if (!instance?.process) return;
  
  const proc = instance.process;
  if (proc.killed) return;
  
  return new Promise((resolve) => {
    // Set up exit handler
    const onExit = () => {
      clearTimeout(forceKillTimer);
      resolve();
    };
    proc.once('exit', onExit);
    proc.once('close', onExit);
    
    // Try SIGTERM first
    try {
      proc.kill('SIGTERM');
    } catch {
      // Process may already be dead
      resolve();
      return;
    }
    
    // Force-kill after 1 second if still alive
    const forceKillTimer = setTimeout(() => {
      try {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      } catch {
        // ignore
      }
      // Resolve after SIGKILL regardless
      setTimeout(resolve, 200);
    }, 1000);
  });
}

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

async function createDeployment(page: Page, namespace: string) {
  const sidebar = new SidebarPage(page);
  const overlay = new CreateOverlay(page);
  const notifications = new Notifications(page);

  await sidebar.goToSection('deployments');

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const deployName = uniqueName('e2e-holmes-error');
    const deployYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${deployName}
  namespace: ${namespace}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${deployName}
  template:
    metadata:
      labels:
        app: ${deployName}
    spec:
      containers:
      - name: app
        image: nginx:latest
        ports:
        - containerPort: 80
`;

    try {
      await overlay.openFromOverviewHeader();
      await overlay.fillYaml(deployYaml);
      await overlay.create();
      await notifications.waitForClear();
      return deployName;
    } catch (err) {
      const row = page
        .locator('#maincontent table.gh-table tbody tr, #main-panels table.gh-table tbody tr')
        .filter({ hasText: deployName })
        .first();
      if (await row.isVisible().catch(() => false)) {
        await notifications.waitForClear();
        return deployName;
      }

      try {
        await waitForTableRow(page, new RegExp(deployName), { timeout: 15_000 });
        await notifications.waitForClear();
        return deployName;
      } catch {
        // Continue retry handling below
      }

      const overlayRoot = page.locator('[data-testid="create-manifest-overlay"]').first();
      if (await overlayRoot.isVisible().catch(() => false)) {
        const closeBtn = overlayRoot.getByRole('button', { name: /close|cancel/i }).first();
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click().catch(() => undefined);
        } else {
          await page.keyboard.press('Escape').catch(() => undefined);
        }
      }

      if (attempt === 3) throw err;
      await page.waitForTimeout(1000 * attempt);
    }
  }

  throw new Error('Failed to create deployment after retries');
}

async function analyzeDeploymentByName(page: Page, deployName: string) {
  const panel = new BottomPanel(page);

  let row = page
    .locator('#maincontent table.gh-table tbody tr, #main-panels table.gh-table tbody tr')
    .filter({ hasText: deployName })
    .first();

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await waitForTableRow(page, new RegExp(deployName), { timeout: 30_000 });
      await expect(row).toBeVisible({ timeout: 10_000 });
      break;
    } catch (err) {
      if (attempt === 3) throw err;
      const sidebar = new SidebarPage(page);
      await sidebar.goToSection('pods');
      await sidebar.goToSection('deployments');
      row = page
        .locator('#maincontent table.gh-table tbody tr, #main-panels table.gh-table tbody tr')
        .filter({ hasText: deployName })
        .first();
    }
  }

  // Trigger Holmes analysis via row actions menu (Ask Holmes) with retry pattern
  await expect(async () => {
    await page.keyboard.press('Escape');
    await row.locator('.row-actions-button').click();
    const askHolmes = page.locator('.menu-content .context-menu-item', { hasText: 'Ask Holmes' }).first();
    await expect(askHolmes).toBeVisible({ timeout: 5_000 });
    await askHolmes.click();
  }).toPass({ timeout: 30_000, intervals: [500, 1000, 2000] });

  await panel.expectVisible(30_000);
  await panel.clickTab('Holmes');

  return panel;
}

async function expectHolmesSuccessWithRetry(page: Page, deployName: string) {
  const expectedText = 'Deployment health check completed';

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const panel = await analyzeDeploymentByName(page, deployName);
    const holmesPanel = panel.root;
    try {
      await expect(holmesPanel).toContainText(expectedText, { timeout: 30_000 });
      return;
    } catch (err) {
      const content = (await holmesPanel.textContent()) || '';
      const transient = /connectex|proxyconnect|dial tcp|Only one usage of each socket address|timeout|timed out|deadline exceeded|i\/o timeout/i.test(content);
      if (!transient || attempt === 3) throw err;
      await panel.closeByClickingOutside();
      await page.waitForTimeout(1000 * attempt);
    }
  }
}

async function expectHolmesGlobalSuccessWithRetry(page: Page, question: string) {
  const expectedText = 'Deployment health check completed';

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const holmesPanel = await askHolmesFromGlobalPanel(page, question);
    try {
      await expect(holmesPanel).toContainText(expectedText, { timeout: 30_000 });
      return;
    } catch (err) {
      const content = (await holmesPanel.textContent()) || '';
      const transient = /connectex|proxyconnect|dial tcp|Only one usage of each socket address|timeout|timed out|deadline exceeded|i\/o timeout/i.test(content);
      if (!transient || attempt === 3) throw err;
      await page.keyboard.press('Escape').catch(() => undefined);
      await page.waitForTimeout(1000 * attempt);
    }
  }
}

async function analyzeWithHolmesFromDeployment(page: Page, namespace: string) {
  const deployName = await createDeployment(page, namespace);
  return analyzeDeploymentByName(page, deployName);
}

async function askHolmesFromGlobalPanel(page: Page, question: string) {
  const toggle = page.locator('#holmes-toggle-btn');
  await expect(toggle).toBeVisible({ timeout: 30_000 });

  const holmesPanel = page.locator('#holmes-panel');

  // If panel is already open, close and reopen to ensure fresh state
  if (await holmesPanel.isVisible().catch(() => false)) {
    await toggle.click();
    await expect(holmesPanel).not.toBeVisible({ timeout: 5_000 });
  }
  await toggle.click();
  await expect(holmesPanel).toBeVisible({ timeout: 30_000 });

  const input = page.getByPlaceholder('Ask about your cluster...');
  const hasInput = await input.isVisible({ timeout: 30_000 }).catch(() => false);
  if (!hasInput) {
    test.info().annotations.push({
      type: 'note',
      description: 'Holmes input was not visible; skipping prompt submit and continuing with panel error assertions.',
    });
    return holmesPanel;
  }
  await input.fill(question);
  await page.getByRole('button', { name: '→' }).click();

  return holmesPanel;
}

test.describe('Holmes Error Handling', () => {
  // Run tests serially to avoid port conflicts when starting multiple mock servers
  test.describe.configure({ mode: 'serial' });

  test.beforeEach(async ({ page, contextName, namespace }) => {
    test.setTimeout(180_000);
    await bootstrapApp({ page, contextName, namespace });
  });

  test('handles 500 server error gracefully', async ({ page, namespace }) => {
    let errorMockServer: HolmesMockInstance | null = null;
    let holmesPanel = page.locator('#holmes-panel');

    try {
      await test.step('Start mock server with 500 error mode', async () => {
        // Use dynamic port to avoid conflicts across retries and workers
        const port = await findFreePort();
        errorMockServer = await startHolmesMockServer({
          repoRoot: withinRepo(),
          port,
          errorMode: '500',
          readyTimeoutMs: 30_000,
        });
      });

      await test.step('Configure Holmes to use error mock', async () => {
        await configureHolmesMock({
          page,
          endpoint: errorMockServer!.baseURL,
        });
      });

      await test.step('Ask Holmes a question', async () => {
        await createDeployment(page, namespace);
        holmesPanel = await askHolmesFromGlobalPanel(page, 'Analyze deployment health');
      });

      await test.step('Verify error is displayed gracefully', async () => {
        // Should show the "Analysis failed" error container from HolmesBottomPanel
        // or the error text containing "holmes API error" or similar
        await expect(
          holmesPanel.getByText(/Analysis failed|holmes API error|Internal Server Error/i).first()
        ).toBeVisible({ timeout: 30_000 });
      });
    } finally {
      // Clean up the error mock server using robust kill (properly awaited)
      await killMockServer(errorMockServer);
    }
  });

  test('handles connection refused gracefully', async ({ page, namespace }) => {
    let holmesPanel = page.locator('#holmes-panel');

    await test.step('Configure Holmes with unreachable endpoint', async () => {
      // Use an unreachable private IP to avoid the auto-reconnection logic
      // that triggers when connection is refused on localhost endpoints.
      // The Go backend's tryReconnectHolmesOnRefused() rebuilds the proxy
      // endpoint for local addresses, so we use a non-routable IP instead.
      await configureHolmesMock({
        page,
        endpoint: 'http://10.255.255.1:19999',
      });
    });

    await test.step('Ask Holmes a question', async () => {
      await createDeployment(page, namespace);
      holmesPanel = await askHolmesFromGlobalPanel(page, 'Analyze deployment health');
    });

    await test.step('Verify connection error is handled', async () => {
      // Should show the "Analysis failed" error container or error text containing connection-related keywords
      // The Go error message may contain: "dial tcp", "connect", "refused", "connectex", "target machine",
      // "timeout", "context deadline exceeded", "i/o timeout", "no route to host", etc.
      await expect(
        holmesPanel.getByText(/Analysis failed|dial tcp|connect.*refused|connectex|target machine|connection.*error|failed.*request|unavailable|timeout|deadline exceeded|no route|timed out/i).first()
      ).toBeVisible({ timeout: 120_000 });
    });
  });

  test('shows appropriate UI when Holmes is disabled', async ({ page }) => {
    await test.step('Disable Holmes', async () => {
      await disableHolmes({ page });
    });

    await test.step('Open Holmes panel', async () => {
      // Try to open Holmes panel
      const toggleBtn = page.locator('#holmes-toggle-btn');

      // If toggle button exists, click it
      if (await toggleBtn.isVisible().catch(() => false)) {
        await toggleBtn.click();

        const holmesPanel = page.locator('#holmes-panel');
        await expect(holmesPanel).toBeVisible({ timeout: 10_000 });

        // Should show not configured or disabled message
        const message = holmesPanel.getByText(/not configured|disabled|enable holmes|holmes ai/i).first();
        await expect(message).toBeVisible({ timeout: 10_000 });
      }
    });
  });

  test('handles slow response with loading indicator', async ({ page, namespace }) => {
    let slowMockServer: HolmesMockInstance | null = null;
    let holmesPanel = page.locator('#holmes-panel');

    try {
      await test.step('Start mock server with delay', async () => {
        // Use dynamic port to avoid conflicts across retries and workers
        const port = await findFreePort();
        slowMockServer = await startHolmesMockServer({
          repoRoot: withinRepo(),
          port,
          delayMs: 8000,
          readyTimeoutMs: 30_000,
        });
      });

      await test.step('Configure Holmes to use slow mock', async () => {
        await configureHolmesMock({
          page,
          endpoint: slowMockServer!.baseURL,
        });
      });

      await test.step('Ask Holmes and verify loading state', async () => {
        await createDeployment(page, namespace);
        holmesPanel = await askHolmesFromGlobalPanel(page, 'Analyze deployment health');

        // Should show loading indicator during the delay.
        // The global Holmes panel (HolmesPanel.tsx) renders "Thinking..." initially
        // and "Streaming..." once chunks arrive, using .holmes-spinner / .holmes-loading
        // classes and data-testid="holmes-spinner".
        // Use .first() to avoid strict mode violation when the .or() combinator
        // matches multiple elements (text + class selector both satisfied).
        await expect(
          holmesPanel.getByText(/loading|analyzing|thinking|streaming|processing/i).or(
            holmesPanel.locator('.holmes-loading, .holmes-spinner, [data-testid="holmes-spinner"]')
          ).first()
        ).toBeVisible({ timeout: 15_000 });
      });

      await test.step('Verify response eventually arrives', async () => {
        // After delay, should show actual response
        await expect(holmesPanel).toContainText('Deployment health check completed', {
          timeout: 30_000,
        });
      });
    } finally {
      await killMockServer(slowMockServer);
    }
  });

  test('recovers after error and shows new responses', async ({ page, namespace }) => {
    let errorMockServer: HolmesMockInstance | null = null;
    let deployName = '';
    let holmesPanel = page.locator('#holmes-panel');

    try {
      deployName = await createDeployment(page, namespace);

      await test.step('First: use failing endpoint', async () => {
        await configureHolmesMock({
          page,
          endpoint: 'http://127.0.0.1:19999', // Unreachable
        });

        holmesPanel = await askHolmesFromGlobalPanel(page, `Analyze deployment health for ${deployName}`);
        await expect(
          holmesPanel.getByText(/failed to send request|error|connect/i).first()
        ).toBeVisible({ timeout: 60_000 });
      });

      await test.step('Start working mock server', async () => {
        // Use dynamic port to avoid conflicts across retries and workers
        const port = await findFreePort();
        errorMockServer = await startHolmesMockServer({
          repoRoot: withinRepo(),
          port,
          readyTimeoutMs: 30_000,
        });
      });

      await test.step('Reconfigure to working endpoint', async () => {
        await configureHolmesMock({
          page,
          endpoint: errorMockServer!.baseURL,
        });
      });

      await test.step('Ask again and verify success', async () => {
        await expectHolmesGlobalSuccessWithRetry(page, `Analyze deployment health for ${deployName}`);
      });
    } finally {
      await killMockServer(errorMockServer);
    }
  });
});
