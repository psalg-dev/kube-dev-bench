import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { test, expect } from '../../src/fixtures.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('prometheus alerts fetch and investigation', async ({ page, contextName, namespace }) => {
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
    await sidebar.goToSection('pods');

    const podName = uniqueName('monitor-alert-pod');
    const yaml = `apiVersion: v1\nkind: Pod\nmetadata:\n  name: ${podName}\n  namespace: ${namespace}\nspec:\n  containers:\n  - name: app\n    image: doesnotexist.invalid/does-not-exist:latest\n`;

    const overlay = new CreateOverlay(page);
    await overlay.openFromOverviewHeader();
    await overlay.fillYaml(yaml);
    await overlay.create();

    await expect(page.locator('#monitor-error-badge')).toBeVisible({ timeout: 90_000 });
    await page.locator('#monitor-error-badge').click();
    await expect(page.locator('#monitor-panel')).toBeVisible();

    await page.evaluate(async (endpoint) => {
      if (window?.go?.main?.App?.SetHolmesConfig) {
        await window.go.main.App.SetHolmesConfig({ enabled: true, endpoint });
      }
    }, baseURL);

    await page.getByText('Prometheus Alerts').click();
    await expect(page.getByPlaceholderText(/Prometheus URL/i)).toBeVisible();

    await page.getByPlaceholderText(/Prometheus URL/i).fill(baseURL);
    await page.getByRole('button', { name: 'Fetch Alerts' }).click();

    await expect(page.getByText('HighCPU')).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Investigate' }).click();
    await expect(page.getByText('Investigation result')).toBeVisible({ timeout: 30_000 });

  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
