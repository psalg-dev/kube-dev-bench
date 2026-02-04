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

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(deployYaml);
  await overlay.create();
  await notifications.waitForClear();

  return deployName;
}

async function analyzeDeploymentByName(page: Page, deployName: string) {
  const panel = new BottomPanel(page);

  const row = page.locator('#main-panels > div:visible table.gh-table tbody tr').filter({ hasText: deployName }).first();
  await expect(row).toBeVisible({ timeout: 90_000 });

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

async function analyzeWithHolmesFromDeployment(page: Page, namespace: string) {
  const deployName = await createDeployment(page, namespace);
  return analyzeDeploymentByName(page, deployName);
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
        await analyzeWithHolmesFromDeployment(page, namespace);
      });

      await test.step('Verify error is displayed gracefully', async () => {
        const panel = new BottomPanel(page);
        const holmesPanel = panel.root;

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
      await analyzeWithHolmesFromDeployment(page, namespace);
    });

    await test.step('Verify connection error is handled', async () => {
      const panel = new BottomPanel(page);
      const holmesPanel = panel.root;

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

    try {
      await test.step('Start mock server with delay', async () => {
        // Use dynamic port to avoid conflicts across retries and workers
        const port = await findFreePort();
        slowMockServer = await startHolmesMockServer({
          repoRoot: withinRepo(),
          port,
          delayMs: 3000,
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
        const panel = await analyzeWithHolmesFromDeployment(page, namespace);
        const holmesPanel = panel.root;

        // Should show loading indicator during the delay
        await expect(
          holmesPanel.getByText(/loading|analyzing|thinking|processing/i).or(
            holmesPanel.locator('.loading-indicator, .spinner, [data-loading="true"]')
          )
        ).toBeVisible({ timeout: 5_000 });
      });

      await test.step('Verify response eventually arrives', async () => {
        const panel = new BottomPanel(page);
        const holmesPanel = panel.root;

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

    try {
      deployName = await createDeployment(page, namespace);

      await test.step('First: use failing endpoint', async () => {
        await configureHolmesMock({
          page,
          endpoint: 'http://127.0.0.1:19999', // Unreachable
        });

        const panel = await analyzeDeploymentByName(page, deployName);

        const holmesPanel = panel.root;
        await expect(
          holmesPanel.getByText(/failed to send request|error|connect/i).first()
        ).toBeVisible({ timeout: 60_000 });

        await panel.closeByClickingOutside();
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
        await analyzeDeploymentByName(page, deployName);

        const panel = new BottomPanel(page);
        const holmesPanel = panel.root;
        await expect(holmesPanel).toContainText('Deployment health check completed', {
          timeout: 30_000,
        });
      });
    } finally {
      await killMockServer(errorMockServer);
    }
  });
});
