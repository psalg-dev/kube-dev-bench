/**
 * Holmes Mock Analysis E2E Tests
 *
 * These tests use the Holmes mock server for deterministic AI responses.
 * They verify that the Holmes integration works correctly with various
 * types of resources and response patterns.
 */

import { test, expect } from '../../src/fixtures.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { Notifications } from '../../src/pages/Notifications.js';
import {
  configureHolmesMock,
  openHolmesPanel,
  getHolmesMockURL,
  getHolmesInput,
} from '../../src/support/holmes-bootstrap.js';
import type { SidebarPage } from '../../src/pages/SidebarPage.js';
import { waitForTableRow, waitForResourceStatus } from '../../src/support/wait-helpers.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test.describe('Holmes Mock Analysis', () => {
  let sidebar: SidebarPage;

  test.beforeEach(async ({ page, contextName, namespace }) => {
    test.setTimeout(180_000);

    const boot = await bootstrapApp({ page, contextName, namespace });
    sidebar = boot.sidebar;

    // Configure Holmes to use mock server
    await test.step('Configure Holmes mock server', async () => {
      await configureHolmesMock({ page });
    });
  });

  test('Pod analysis returns mock crash response', async ({ page, namespace }) => {
    const overlay = new CreateOverlay(page);
    const notifications = new Notifications(page);

    await test.step('Create a test deployment', async () => {
      await sidebar.goToSection('deployments');

      const deployName = uniqueName('e2e-mock-pod');
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
      await waitForTableRow(page, new RegExp(deployName));
    });

    await test.step('Ask Holmes about pod crash', async () => {
      await openHolmesPanel({ page });

      const input = await getHolmesInput(page);
      await input.fill('Why is my pod crashing?');

      // Wait for input to be stable before clicking send
      const sendButton = page.getByRole('button', { name: '→' });
      await expect(sendButton).toBeEnabled({ timeout: 5_000 });
      await sendButton.click();
    });

    await test.step('Verify mock response content', async () => {
      // Wait for response - check for content from fixtures.json pod crash pattern
      const holmesPanel = page.locator('#holmes-panel');
      // Ensure the panel is visible before checking content
      await expect(holmesPanel).toBeVisible({ timeout: 10_000 });
      await expect(holmesPanel).toContainText(/Pod crash root cause analysis completed|Pod Crash Analysis|CrashLoopBackOff/i, { timeout: 30_000 });
    });
  });

  test('Deployment analysis returns mock deployment response', async ({ page, namespace }) => {
    const overlay = new CreateOverlay(page);
    const notifications = new Notifications(page);

    await test.step('Create a test deployment', async () => {
      await sidebar.goToSection('deployments');

      const deployName = uniqueName('e2e-mock-deploy');
      const deployYaml = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${deployName}
  namespace: ${namespace}
spec:
  replicas: 2
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
`;

      await overlay.openFromOverviewHeader();
      await overlay.fillYaml(deployYaml);
      await overlay.create();
      await notifications.waitForClear();
      await waitForTableRow(page, new RegExp(deployName));
    });

    await test.step('Ask Holmes about deployment', async () => {
      await openHolmesPanel({ page });

      const input = await getHolmesInput(page);
      await input.fill('Analyze my deployment replicas');
      
      // Wait for input to be stable before clicking send
      const sendButton = page.getByRole('button', { name: '→' });
      await expect(sendButton).toBeEnabled({ timeout: 5_000 });
      await sendButton.click();
    });

    await test.step('Verify mock deployment response', async () => {
      const holmesPanel = page.locator('#holmes-panel');
      // Ensure the panel is visible before checking content
      await expect(holmesPanel).toBeVisible({ timeout: 10_000 });
      await expect(holmesPanel).toContainText(
        /Deployment Analysis|deployment is healthy|Deployment health check completed/i,
        { timeout: 30_000 }
      );
    });
  });

  test('Log analysis returns mock log response', async ({ page }) => {
    await test.step('Ask Holmes about logs', async () => {
      await openHolmesPanel({ page });

      const input = await getHolmesInput(page);
      await input.fill('Explain the logs from my application');
      
      // Wait for input to be stable before clicking send
      const sendButton = page.getByRole('button', { name: '→' });
      await expect(sendButton).toBeEnabled({ timeout: 5_000 });
      await sendButton.click();
    });

    await test.step('Verify mock log analysis response', async () => {
      const holmesPanel = page.locator('#holmes-panel');
      await expect(holmesPanel).toBeVisible({ timeout: 10_000 });
      await expect(holmesPanel).toContainText(/Log Analysis|Analyzed the provided logs/i, { timeout: 30_000 });
    });
  });

  test('Secret/ConfigMap analysis returns configuration response', async ({ page }) => {
    await test.step('Ask Holmes about secrets', async () => {
      await openHolmesPanel({ page });

      const input = await getHolmesInput(page);
      await input.fill('Check my secret configuration');
      
      // Wait for input to be stable before clicking send
      const sendButton = page.getByRole('button', { name: '→' });
      await expect(sendButton).toBeEnabled({ timeout: 5_000 });
      await sendButton.click();
    });

    await test.step('Verify mock configuration response', async () => {
      const holmesPanel = page.locator('#holmes-panel');
      await expect(holmesPanel).toBeVisible({ timeout: 10_000 });
      await expect(holmesPanel).toContainText(
        /Configuration Resource Analysis|configuration resource has been analyzed|Configuration resource analysis completed/i,
        { timeout: 30_000 }
      );
    });
  });

  test('Generic question returns default response', async ({ page }) => {
    await test.step('Ask Holmes a generic question', async () => {
      await openHolmesPanel({ page });

      const input = await getHolmesInput(page);
      await input.fill('Tell me about something random');
      
      // Wait for input to be stable before clicking send
      const sendButton = page.getByRole('button', { name: '→' });
      await expect(sendButton).toBeEnabled({ timeout: 5_000 });
      await sendButton.click();
    });

    await test.step('Verify default response', async () => {
      const holmesPanel = page.locator('#holmes-panel');
      // The default mock response contains either the markdown body with "Resource Analysis" heading
      // or the analysis field "General resource analysis completed" - both contain these key phrases
      await expect(holmesPanel).toBeVisible({ timeout: 10_000 });
      await expect(holmesPanel).toContainText(/Resource Analysis|resource analysis/i, { timeout: 30_000 });
    });
  });

  test('Conversation history with export and clear', async ({ page }) => {
    await test.step('Clear any existing conversation first', async () => {
      await openHolmesPanel({ page });
      
      // Wait for Holmes panel to be fully visible and interactive
      const holmesPanel = page.locator('#holmes-panel');
      await expect(holmesPanel).toBeVisible({ timeout: 10_000 });
      
      // Try to clear any existing conversation from previous tests using retry pattern
      const clearButton = page.getByTitle('Clear conversation');
      const wasVisible = await clearButton.isVisible({ timeout: 2_000 }).catch(() => false);
      if (wasVisible) {
        await expect(async () => {
          if (await clearButton.isVisible()) {
            await clearButton.click();
            await page.waitForTimeout(200);
          }
          await expect(clearButton).toBeHidden({ timeout: 2_000 });
        }).toPass({ timeout: 10_000, intervals: [500, 1000, 2000] });
      }
    });

    await test.step('Have a conversation with Holmes', async () => {
      const holmesPanel = page.locator('#holmes-panel');

      // First question - get fresh input locator each time
      const input1 = await getHolmesInput(page);
      await input1.fill('Why is my pod crashing?');
      
      // Wait for input to be stable before clicking send
      const sendButton = page.getByRole('button', { name: '→' });
      await expect(sendButton).toBeEnabled({ timeout: 5_000 });
      await sendButton.click();

      await expect(holmesPanel).toContainText(/Pod crash root cause analysis completed|Pod Crash Analysis|CrashLoopBackOff/i, { timeout: 30_000 });

      // Wait for the UI to settle after first response before sending second question
      // This prevents race conditions where the input isn't ready yet
      await page.waitForTimeout(500);

      // Second question - get fresh input locator after first response
      const input2 = await getHolmesInput(page);
      await input2.fill('Check my deployment status');
      await expect(sendButton).toBeEnabled({ timeout: 5_000 });
      await sendButton.click();

      await expect(holmesPanel).toContainText(/Deployment health check completed|Deployment Analysis|deployment is healthy/i, { timeout: 30_000 });
    });

    await test.step('Verify conversation controls', async () => {
      const clearButton = page.getByTitle('Clear conversation');
      await expect(clearButton).toBeVisible({ timeout: 10_000 });

      const exportButton = page.getByTitle('Export conversation');
      await expect(exportButton).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Clear conversation', async () => {
      const clearButton = page.getByTitle('Clear conversation');
      
      // Use retry pattern for clearing conversation - sometimes React state updates need time
      await expect(async () => {
        // Click clear if visible
        if (await clearButton.isVisible()) {
          await clearButton.click();
          // Wait a moment for React state to update
          await page.waitForTimeout(200);
        }
        // Verify the button is now hidden
        await expect(clearButton).toBeHidden({ timeout: 2_000 });
      }).toPass({ timeout: 15_000, intervals: [500, 1000, 2000] });

      // After clearing, input should still be visible and ready
      const input = page.getByPlaceholder('Ask about your cluster...');
      await expect(input).toBeVisible({ timeout: 10_000 });

      // Conversation content should be cleared - check for the response text, not the question
      // (the question text "Why is my pod crashing?" appears in the placeholder examples)
      const holmesPanel = page.locator('#holmes-panel');
      await expect(holmesPanel).not.toContainText('Pod Crash Analysis', { timeout: 10_000 });
      await expect(holmesPanel).not.toContainText('Deployment Analysis', { timeout: 10_000 });
      
      // Clear button should be hidden when no conversation
      await expect(clearButton).toBeHidden({ timeout: 5_000 });
    });
  });

  test('Holmes mock server health check', async () => {
    await test.step('Verify mock server is accessible', async () => {
      const mockURL = await getHolmesMockURL();

      const response = await fetch(`${mockURL}/healthz`);
      expect(response.status).toBe(200);

      const text = await response.text();
      expect(text).toBe('ok');
    });
  });
});
