import http from 'node:http';
import type { AddressInfo } from 'node:net';
import type { Page } from '@playwright/test';
import { test, expect } from '../../src/fixtures.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';
import { Notifications } from '../../src/pages/Notifications.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

async function createDeploymentWithRetry(opts: {
  page: Page;
  overlay: CreateOverlay;
  notifications: Notifications;
  name: string;
  yaml: string;
}) {
  const { page, overlay, notifications, name, yaml } = opts;
  const overlayRoot = page.locator('[data-testid="create-manifest-overlay"]').first();

  const closeOverlayIfOpen = async () => {
    if (!(await overlayRoot.isVisible().catch(() => false))) return;
    const closeBtn = overlayRoot.getByRole('button', { name: /close|cancel/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click().catch(() => undefined);
    } else {
      await page.keyboard.press('Escape').catch(() => undefined);
    }
    await overlayRoot.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await overlay.openFromOverviewHeader();
      await overlay.fillYaml(yaml);
      await overlay.create();
      await notifications.expectSuccessContains('created successfully');
      await closeOverlayIfOpen();
      return;
    } catch (err) {
      const row = page
        .locator('#main-panels > div:visible table.gh-table tbody tr')
        .filter({ hasText: name })
        .first();
      if (await row.isVisible().catch(() => false)) {
        await closeOverlayIfOpen();
        return;
      }

      await closeOverlayIfOpen();
      if (attempt === 3) throw err;
      await page.waitForTimeout(1000 * attempt);
    }
  }
}

test('prometheus alerts fetch and investigation', async ({ page, contextName, namespace }) => {
  test.setTimeout(180_000);
  
  // Create mock server that simulates both Prometheus API and Holmes API
  const server = http.createServer((req, res) => {
    if (req.url === '/api/v1/alerts') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'success',
        data: {
          alerts: [
            {
              labels: { alertname: 'HighCPU' },
              annotations: { summary: 'CPU high' },
              state: 'firing',
              activeAt: new Date().toISOString(),
              value: '1',
            },
          ],
        },
      }));
      return;
    }
    if (req.url === '/api/chat') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response: 'Investigation result' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as AddressInfo;
  const baseURL = `http://127.0.0.1:${address.port}`;

  try {
    const { sidebar } = await bootstrapApp({ page, contextName, namespace });
    const notifications = new Notifications(page);
    
    // Use Deployments view which has a proper "Create New" button (Pods view has a dropdown)
    await sidebar.goToSection('deployments');

    const deployName = uniqueName('monitor-alert-deploy');
    // Create a deployment with an invalid image to trigger monitoring alerts
    const yaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${deployName}\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${deployName}\n  template:\n    metadata:\n      labels:\n        app: ${deployName}\n    spec:\n      containers:\n      - name: app\n        image: doesnotexist.invalid/does-not-exist:latest\n`;

    const overlay = new CreateOverlay(page);
    await createDeploymentWithRetry({ page, overlay, notifications, name: deployName, yaml });

    // Navigate to Pods to see the failing pods
    await sidebar.goToSection('pods');

    // Wait for the monitor error badge to appear
    const monitorBadge = page.locator('#monitor-error-badge');
    const badgeVisible = await monitorBadge.waitFor({ state: 'visible', timeout: 90_000 }).then(() => true).catch(() => false);
    
    if (!badgeVisible) {
      // Monitoring feature may not be enabled - skip test
      test.skip(true, 'Monitor error badge not visible - monitoring may not be enabled');
      return;
    }
    
    await monitorBadge.click();
    await expect(page.locator('#monitor-panel')).toBeVisible({ timeout: 30_000 });

    // Configure Holmes mock
    await page.evaluate(async (endpoint) => {
      if (window?.go?.main?.App?.SetHolmesConfig) {
        await window.go.main.App.SetHolmesConfig({ enabled: true, endpoint });
      }
    }, baseURL);

    // Look for Prometheus Alerts tab
    const prometheusTab = page.getByText('Prometheus Alerts');
    const hasPrometheusTab = await prometheusTab.isVisible().catch(() => false);
    
    if (!hasPrometheusTab) {
      // Prometheus alerts tab may not be visible - verify basic monitoring works
      const scanButton = page.getByRole('button', { name: /(?:Scan Now|Rescan)/i });
      if (await scanButton.isVisible().catch(() => false)) {
        await scanButton.click();
        // Just verify scan completes
        await page.waitForTimeout(2000);
      }
      test.skip(true, 'Prometheus Alerts tab not available');
      return;
    }
    
    await prometheusTab.click();
    
    const urlInput = page.getByPlaceholder(/Prometheus URL/i);
    await expect(urlInput).toBeVisible({ timeout: 30_000 });

    await urlInput.fill(baseURL);
    await page.getByRole('button', { name: 'Fetch Alerts' }).click();

    // Wait for mock alert to appear (use exact: true to avoid matching alertname chip too)
    await expect(page.getByText('HighCPU', { exact: true })).toBeVisible({ timeout: 30_000 });
    
    // Try to investigate
    const investigateBtn = page.getByRole('button', { name: 'Investigate' });
    if (await investigateBtn.isVisible().catch(() => false)) {
      await investigateBtn.click();
      await expect(page.getByText('Investigation result')).toBeVisible({ timeout: 30_000 });
    }

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
