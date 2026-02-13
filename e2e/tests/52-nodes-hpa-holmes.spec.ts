import { test, expect } from '../src/fixtures.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { waitForTableRow } from '../src/support/wait-helpers.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test.describe('Phase5 Node/HPA Holmes', () => {
  test('nodes and hpa rows expose Holmes tab in bottom panel', async ({ page, contextName, namespace }) => {
    test.setTimeout(180_000);

    const { sidebar } = await bootstrapApp({ page, contextName, namespace });
    const overlay = new CreateOverlay(page);
    const notifications = new Notifications(page);

    await test.step('Open Nodes and verify Holmes tab is available', async () => {
      await sidebar.goToSection('nodes');
      const firstRow = page.locator('#main-panels > div:visible table.gh-table tbody tr').first();
      await expect(firstRow).toBeVisible({ timeout: 60_000 });
      await firstRow.click();
      const holmesTab = page.getByRole('button', { name: /^holmes$/i });
      await expect(holmesTab).toBeVisible({ timeout: 20_000 });
    });

    const deployName = uniqueName('e2e-hpa-target');
    const hpaName = uniqueName('e2e-hpa');

    await test.step('Create deployment target for HPA', async () => {
      await sidebar.goToSection('deployments');
      const deploymentYaml = `apiVersion: apps/v1
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
        resources:
          requests:
            cpu: 50m
          limits:
            cpu: 200m
`;

      await overlay.openFromOverviewHeader();
      await overlay.fillYaml(deploymentYaml);
      await overlay.create();
      await notifications.waitForClear();
      await waitForTableRow(page, new RegExp(deployName));
    });

    await test.step('Create HPA and verify Holmes tab availability', async () => {
      await sidebar.goToSection('hpa');
      const hpaYaml = `apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: ${hpaName}
  namespace: ${namespace}
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: ${deployName}
  minReplicas: 1
  maxReplicas: 3
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
`;

      await overlay.openFromOverviewHeader();
      await overlay.fillYaml(hpaYaml);
      await overlay.create();
      await notifications.waitForClear();
      await waitForTableRow(page, new RegExp(hpaName));

      const hpaRow = page.locator('#main-panels > div:visible table.gh-table tbody tr').filter({ hasText: hpaName }).first();
      await expect(hpaRow).toBeVisible({ timeout: 60_000 });
      await hpaRow.click();

      const holmesTab = page.getByRole('button', { name: /^holmes$/i });
      await expect(holmesTab).toBeVisible({ timeout: 20_000 });
    });
  });
});
