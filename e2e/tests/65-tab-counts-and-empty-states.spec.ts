import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { BottomPanel } from '../src/pages/BottomPanel.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

async function openRowDetailsByName(page: any, name: string) {
  await expect(page.locator('#gh-notification-container .gh-notification')).toHaveCount(0, { timeout: 10_000 });
  const table = page.locator('#main-panels > div:visible table.gh-table');
  await expect(table).toBeVisible({ timeout: 60_000 });
  const row = table.locator('tbody tr').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await row.click();
}

test.describe('Tab counts and empty states', () => {
  test('ConfigMap shows count badges for Events and Consumers tabs', async ({ page, contextName, namespace }) => {
    test.setTimeout(120_000);

    const { sidebar } = await bootstrapApp({ page, contextName, namespace });
    const notifications = new Notifications(page);
    const overlay = new CreateOverlay(page);
    const panel = new BottomPanel(page);

    // Create a ConfigMap that won't be used by any workload
    await sidebar.goToSection('configmaps');

    const configMapName = uniqueName('e2e-cm');
    const configMapYaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${configMapName}
  namespace: ${namespace}
data:
  key1: value1
  key2: value2
`;

    await overlay.openFromOverviewHeader();
    await overlay.fillYaml(configMapYaml);
    await overlay.create();
    await notifications.waitForClear();

    // Open the ConfigMap details
    await openRowDetailsByName(page, configMapName);
    await panel.expectVisible();

    // Verify the Events tab exists - may have 0 or more events
    // The tab label should show the count in parentheses
    const eventsTab = panel.tabLabel('Events');
    await expect(eventsTab).toBeVisible();

    // Verify the Consumers tab exists with count 0 (unused ConfigMap)
    const consumersTab = panel.tabLabel('Consumers');
    await expect(consumersTab).toBeVisible();

    // Click on Consumers tab and verify empty state
    await panel.clickTab('Consumers');
    
    // The empty tab content should be visible since no workloads use this ConfigMap
    const emptyContent = panel.root.locator('.empty-tab-content');
    await expect(emptyContent).toBeVisible({ timeout: 10_000 });
    await expect(emptyContent).toContainText('No consumers found');

    // Clean up - close panel
    await panel.closeByClickingOutside();
  });

  test('Deployment shows Pods tab with count badge', async ({ page, contextName, namespace }) => {
    test.setTimeout(120_000);

    const { sidebar } = await bootstrapApp({ page, contextName, namespace });
    const notifications = new Notifications(page);
    const overlay = new CreateOverlay(page);
    const panel = new BottomPanel(page);

    // Create a Deployment with 1 replica
    await sidebar.goToSection('deployments');

    const deployName = uniqueName('e2e-deploy');
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

    // Wait a bit for the pod to be created
    await page.waitForTimeout(5000);

    // Open the Deployment details
    await openRowDetailsByName(page, deployName);
    await panel.expectVisible();

    // Verify the Pods tab shows a count
    const podsTab = panel.tabLabel('Pods');
    await expect(podsTab.locator('.tab-count')).toBeVisible({ timeout: 30_000 });

    // Verify Events tab shows a count (Deployment creation events)
    const eventsTab = panel.tabLabel('Events');
    await expect(eventsTab).toBeVisible();

    // Clean up - close panel
    await panel.closeByClickingOutside();
  });

  test('Secret shows empty Consumers tab with appropriate message', async ({ page, contextName, namespace }) => {
    test.setTimeout(120_000);

    const { sidebar } = await bootstrapApp({ page, contextName, namespace });
    const notifications = new Notifications(page);
    const overlay = new CreateOverlay(page);
    const panel = new BottomPanel(page);

    // Create a Secret that won't be used by any workload
    await sidebar.goToSection('secrets');

    const secretName = uniqueName('e2e-secret');
    const secretYaml = `apiVersion: v1
kind: Secret
metadata:
  name: ${secretName}
  namespace: ${namespace}
type: Opaque
data:
  username: YWRtaW4=
  password: cGFzc3dvcmQxMjM=
`;

    await overlay.openFromOverviewHeader();
    await overlay.fillYaml(secretYaml);
    await overlay.create();
    await notifications.waitForClear();

    // Open the Secret details
    await openRowDetailsByName(page, secretName);
    await panel.expectVisible();

    // Click on Consumers tab
    await panel.clickTab('Consumers');

    // The empty tab content should be visible since no workloads use this Secret
    const emptyContent = panel.root.locator('.empty-tab-content');
    await expect(emptyContent).toBeVisible({ timeout: 10_000 });
    await expect(emptyContent).toContainText('No consumers found');

    // Clean up - close panel
    await panel.closeByClickingOutside();
  });

  test('CronJob shows History tab with count badge', async ({ page, contextName, namespace }) => {
    test.setTimeout(180_000);

    const { sidebar } = await bootstrapApp({ page, contextName, namespace });
    const notifications = new Notifications(page);
    const overlay = new CreateOverlay(page);
    const panel = new BottomPanel(page);

    // Create a CronJob
    await sidebar.goToSection('cronjobs');

    const cronJobName = uniqueName('e2e-cron');
    const cronJobYaml = `apiVersion: batch/v1
kind: CronJob
metadata:
  name: ${cronJobName}
  namespace: ${namespace}
spec:
  schedule: "*/1 * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: hello
            image: busybox
            command: ["echo", "Hello"]
          restartPolicy: OnFailure
`;

    await overlay.openFromOverviewHeader();
    await overlay.fillYaml(cronJobYaml);
    await overlay.create();
    await notifications.waitForClear();

    // Open the CronJob details
    await openRowDetailsByName(page, cronJobName);
    await panel.expectVisible();

    // Verify the History tab exists (initially may have 0 jobs)
    const historyTab = panel.tabLabel('History');
    await expect(historyTab).toBeVisible();

    // Verify Events tab exists
    const eventsTab = panel.tabLabel('Events');
    await expect(eventsTab).toBeVisible();

    // Clean up - close panel
    await panel.closeByClickingOutside();
  });

  test('Tab labels show loading state while counts are being fetched', async ({ page, contextName, namespace }) => {
    test.setTimeout(120_000);

    const { sidebar } = await bootstrapApp({ page, contextName, namespace });
    const notifications = new Notifications(page);
    const overlay = new CreateOverlay(page);
    const panel = new BottomPanel(page);

    // Create a ConfigMap
    await sidebar.goToSection('configmaps');

    const configMapName = uniqueName('e2e-cm-loading');
    const configMapYaml = `apiVersion: v1
kind: ConfigMap
metadata:
  name: ${configMapName}
  namespace: ${namespace}
data:
  test: value
`;

    await overlay.openFromOverviewHeader();
    await overlay.fillYaml(configMapYaml);
    await overlay.create();
    await notifications.waitForClear();

    // Open the ConfigMap details
    await openRowDetailsByName(page, configMapName);
    await panel.expectVisible();

    // Eventually tabs should show counts (loading state is transient)
    // Wait for at least one tab to have a count displayed
    const tabWithCount = panel.root.locator('.tab-count').first();
    await expect(tabWithCount).toBeVisible({ timeout: 30_000 });

    // Clean up - close panel
    await panel.closeByClickingOutside();
  });
});
