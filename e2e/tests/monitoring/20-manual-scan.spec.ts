import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect } from '../../src/fixtures.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('manual scan shows issues and dismiss works', async ({ page, contextName, namespace }) => {
  const holmesServer = http.createServer((req, res) => {
    if (req.url === '/api/chat') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ response: 'Holmes analysis output' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  await new Promise<void>((resolve) => holmesServer.listen(0, '127.0.0.1', () => resolve()));
  const address = holmesServer.address() as AddressInfo;
  const holmesURL = `http://127.0.0.1:${address.port}`;

  try {
    const { sidebar } = await bootstrapApp({ page, contextName, namespace });
    await sidebar.goToSection('pods');

    const podName = uniqueName('monitor-pod');
    const yaml = `apiVersion: v1\nkind: Pod\nmetadata:\n  name: ${podName}\n  namespace: ${namespace}\nspec:\n  containers:\n  - name: app\n    image: doesnotexist.invalid/does-not-exist:latest\n`;

    const overlay = new CreateOverlay(page);
    await overlay.openFromOverviewHeader();
    await overlay.fillYaml(yaml);
    await overlay.create();

    await expect(page.locator('#monitor-error-badge')).toBeVisible({ timeout: 90_000 });
    await page.locator('#monitor-error-badge').click();

    await expect(page.locator('#monitor-panel')).toBeVisible();

    const scanButton = page.getByRole('button', { name: 'Scan Now' });
    await scanButton.click();

    await expect(page.locator('.monitor-issue-card', { hasText: podName })).toBeVisible({ timeout: 60_000 });

    await page.evaluate(async (endpoint) => {
      if (window?.go?.main?.App?.SetHolmesConfig) {
        await window.go.main.App.SetHolmesConfig({ enabled: true, endpoint });
      }
    }, holmesURL);

    const analyzeButton = page.getByRole('button', { name: 'Analyze' }).first();
    await analyzeButton.click();
    await expect(page.getByText('Show Analysis')).toBeVisible({ timeout: 60_000 });
    await page.getByText('Show Analysis').click();
    await expect(page.getByText('Holmes analysis output')).toBeVisible({ timeout: 60_000 });

    await page.getByRole('button', { name: 'Dismiss' }).first().click();
    await expect(page.locator('.monitor-issue-card', { hasText: podName })).toHaveCount(0);
  } finally {
    await new Promise<void>((resolve) => holmesServer.close(() => resolve()));
  }
});
