import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { kubectl } from '../src/support/kind.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('resource graph: deployment relationships and navigation', async ({ page, contextName, namespace, kubeconfigPath }) => {
  test.setTimeout(180_000);

  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  const notifications = new Notifications(page);
  const overlay = new CreateOverlay(page);

  await sidebar.goToSection('deployments');

  const deployName = uniqueName('e2e-graph');
  const deployYaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${deployName}\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${deployName}\n  template:\n    metadata:\n      labels:\n        app: ${deployName}\n    spec:\n      containers:\n      - name: app\n        image: nginx:latest\n        ports:\n        - containerPort: 80\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(deployYaml);
  await overlay.create();
  await notifications.waitForClear();

  await expect
    .poll(
      async () => {
        const res = await kubectl(
          ['get', 'deployment', deployName, '-n', namespace, '-o', 'name', '--ignore-not-found'],
          { kubeconfigPath, timeoutMs: 15_000 }
        );
        return (res.stdout || '').trim();
      },
      { timeout: 90_000, intervals: [500, 1000, 2000, 5000] }
    )
    .toBe(`deployment.apps/${deployName}`);

  await sidebar.goToSection('namespace-topology');

  const graphCanvas = page.locator('#graph-canvas');
  await expect(graphCanvas).toBeVisible({ timeout: 20_000 });
  const graphNodes = page.locator('#graph-canvas [class*="graph-node"]');
  await expect.poll(async () => graphNodes.count(), { timeout: 60_000 }).toBeGreaterThan(0);

  await page.evaluate(() => {
    (window as typeof window & { __lastNavigateToResource?: unknown }).__lastNavigateToResource = undefined;
    window.addEventListener(
      'navigate-to-resource',
      (event) => {
        (window as typeof window & { __lastNavigateToResource?: unknown }).__lastNavigateToResource =
          (event as CustomEvent).detail;
      },
      { once: true }
    );
  });

  const clickableNode = page.locator('.graph-node--pod, #graph-canvas [class*="graph-node"]').first();
  await clickableNode.click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const detail = (window as typeof window & { __lastNavigateToResource?: { kind?: string } }).__lastNavigateToResource;
        return detail?.kind ?? null;
      })
    )
    .not.toBeNull();
});
