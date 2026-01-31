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
  getHolmesMockURL,
} from '../../src/support/holmes-bootstrap.js';
import { startHolmesMockServer, type HolmesMockInstance } from '../../src/support/holmes-mock.js';
import { withinRepo } from '../../src/support/paths.js';
import { BottomPanel } from '../../src/pages/BottomPanel.js';
import { SidebarPage } from '../../src/pages/SidebarPage.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { Notifications } from '../../src/pages/Notifications.js';

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
  test.beforeEach(async ({ page, contextName, namespace }) => {
    test.setTimeout(180_000);
    await bootstrapApp({ page, contextName, namespace });
  });

  test('handles 500 server error gracefully', async ({ page, namespace }) => {
    let errorMockServer: HolmesMockInstance | null = null;

    try {
      await test.step('Start mock server with 500 error mode', async () => {
        // Start a separate mock server on a different port with error simulation
        errorMockServer = await startHolmesMockServer({
          repoRoot: withinRepo(),
          port: 34118,
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
      // Clean up the error mock server
      if (errorMockServer?.process) {
        errorMockServer.process.kill('SIGTERM');
      }
    }
  });

  test('handles connection refused gracefully', async ({ page, namespace }) => {
    await test.step('Configure Holmes with unreachable endpoint', async () => {
      // Use a port that nothing is listening on
      await configureHolmesMock({
        page,
        endpoint: 'http://127.0.0.1:19999',
      });
    });

    await test.step('Ask Holmes a question', async () => {
      await analyzeWithHolmesFromDeployment(page, namespace);
    });

    await test.step('Verify connection error is handled', async () => {
      const panel = new BottomPanel(page);
      const holmesPanel = panel.root;

      // Should show an error about connection, not crash
      await expect(
        holmesPanel.getByText(/failed to send request|connect|refused|unavailable/i).first()
      ).toBeVisible({ timeout: 60_000 });
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
        // Start a mock server with a 3-second delay
        slowMockServer = await startHolmesMockServer({
          repoRoot: withinRepo(),
          port: 34119,
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
      if (slowMockServer?.process) {
        slowMockServer.process.kill('SIGTERM');
      }
    }
  });

  test('recovers after error and shows new responses', async ({ page, namespace }) => {
    let deployName = '';

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

    await test.step('Reconfigure to working endpoint (global mock server)', async () => {
      // Use the global mock server that was started in global-setup
      const globalMockURL = await getHolmesMockURL();
      await configureHolmesMock({
        page,
        endpoint: globalMockURL,
      });
    });

    await test.step('Ask again and verify success', async () => {
      await analyzeDeploymentByName(page, deployName);

      const panel = new BottomPanel(page);
      const holmesPanel = panel.root;
      // Check for content from the streamed ai_message events in fixtures.json
      await expect(holmesPanel).toContainText(/Deployment Analysis|deployment is healthy/i, {
        timeout: 30_000,
      });
    });
  });
});
