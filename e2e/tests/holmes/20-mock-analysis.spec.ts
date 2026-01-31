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
    });

    await test.step('Ask Holmes about pod crash', async () => {
      await openHolmesPanel({ page });

      const input = await getHolmesInput(page);
      await input.fill('Why is my pod crashing?');

      const sendButton = page.getByRole('button', { name: '→' });
      await sendButton.click();
    });

    await test.step('Verify mock response content', async () => {
      // Wait for response - check for content from fixtures.json pod crash pattern
      const holmesPanel = page.locator('#holmes-panel');
      await expect(holmesPanel).toContainText(/Pod Crash Analysis|CrashLoopBackOff/i, { timeout: 30_000 });
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
    });

    await test.step('Ask Holmes about deployment', async () => {
      await openHolmesPanel({ page });

      const input = await getHolmesInput(page);
      await input.fill('Analyze my deployment replicas');
      await page.getByRole('button', { name: '→' }).click();
    });

    await test.step('Verify mock deployment response', async () => {
      const holmesPanel = page.locator('#holmes-panel');
      await expect(holmesPanel).toContainText('Deployment health check completed', { timeout: 30_000 });
    });
  });

  test('Log analysis returns mock log response', async ({ page }) => {
    await test.step('Ask Holmes about logs', async () => {
      await openHolmesPanel({ page });

      const input = await getHolmesInput(page);
      await input.fill('Explain the logs from my application');
      await page.getByRole('button', { name: '→' }).click();
    });

    await test.step('Verify mock log analysis response', async () => {
      const holmesPanel = page.locator('#holmes-panel');
      await expect(holmesPanel).toContainText(/Log Analysis|Analyzed the provided logs/i, { timeout: 30_000 });
    });
  });

  test('Secret/ConfigMap analysis returns configuration response', async ({ page }) => {
    await test.step('Ask Holmes about secrets', async () => {
      await openHolmesPanel({ page });

      const input = await getHolmesInput(page);
      await input.fill('Check my secret configuration');
      await page.getByRole('button', { name: '→' }).click();
    });

    await test.step('Verify mock configuration response', async () => {
      const holmesPanel = page.locator('#holmes-panel');
      await expect(holmesPanel).toContainText('Configuration resource analysis completed', { timeout: 30_000 });
    });
  });

  test('Generic question returns default response', async ({ page }) => {
    await test.step('Ask Holmes a generic question', async () => {
      await openHolmesPanel({ page });

      const input = await getHolmesInput(page);
      await input.fill('Tell me about something random');
      await page.getByRole('button', { name: '→' }).click();
    });

    await test.step('Verify default response', async () => {
      const holmesPanel = page.locator('#holmes-panel');
      await expect(holmesPanel).toContainText('General resource analysis completed', { timeout: 30_000 });
    });
  });

  test('Conversation history with export and clear', async ({ page }) => {
    await test.step('Have a conversation with Holmes', async () => {
      await openHolmesPanel({ page });

      const holmesPanel = page.locator('#holmes-panel');

      // First question - get fresh input locator each time
      const input1 = await getHolmesInput(page);
      await input1.fill('Why is my pod crashing?');
      await page.getByRole('button', { name: '→' }).click();

      await expect(holmesPanel).toContainText('Pod Crash Analysis', { timeout: 30_000 });

      // Second question - get fresh input locator after first response
      const input2 = await getHolmesInput(page);
      await input2.fill('Check my deployment status');
      await page.getByRole('button', { name: '→' }).click();

      await expect(holmesPanel).toContainText('Deployment Analysis', { timeout: 30_000 });
    });

    await test.step('Verify conversation controls', async () => {
      const clearButton = page.getByTitle('Clear conversation');
      await expect(clearButton).toBeVisible({ timeout: 10_000 });

      const exportButton = page.getByTitle('Export conversation');
      await expect(exportButton).toBeVisible({ timeout: 10_000 });
    });

    await test.step('Clear conversation', async () => {
      const clearButton = page.getByTitle('Clear conversation');
      await expect(clearButton).toBeVisible({ timeout: 5_000 });
      await clearButton.click();

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
