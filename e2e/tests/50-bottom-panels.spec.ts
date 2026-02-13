/**
 * Bottom-panel tests for workload and batch resources.
 *
 * These tests are heavy: they create Deployments, StatefulSets, DaemonSets,
 * Jobs and CronJobs, all of which schedule pods on the KinD cluster.
 * Running them simultaneously on separate workers overwhelms the single-node
 * KinD API server on CI runners (2 vCPU / 7 GB RAM), causing "connection
 * refused" errors that cascade into unrecoverable retry loops.
 *
 * Serial mode ensures they share one worker and run sequentially, keeping
 * peak cluster load manageable.
 *
 * Merged from:
 *   - tests/50-bottom-panels-workloads.spec.ts
 *   - tests/60-bottom-panels-batch.spec.ts
 */

import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { BottomPanel } from '../src/pages/BottomPanel.js';
import { openRowDetailsByName, waitForResourceStatus } from '../src/support/wait-helpers.js';

// Prevent parallel execution of these heavy resource-creation tests.
test.describe.configure({ mode: 'serial' });

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

/**
 * Click through every tab in a bottom panel and assert basic content.
 * The optional `reopenPanel` callback handles panels that may close
 * between tab interactions (commonly seen with batch resources).
 */
async function expectAndClickTabs(
  panel: BottomPanel,
  labels: string[],
  reopenPanel?: () => Promise<void>,
) {
  await panel.expectTabs(labels);
  for (const label of labels) {
    const ensurePanelAndTab = async () => {
      if (reopenPanel) {
        await reopenPanel();
        await panel.expectVisible(30_000);
      }
      await panel.clickTab(label);
    };

    if (reopenPanel) {
      await reopenPanel();
      await panel.expectVisible(30_000);
    }
    const tabVisible = await panel.tab(label).isVisible().catch(() => false);
    if (!tabVisible && reopenPanel) {
      await reopenPanel();
      await panel.expectVisible(30_000);
    }
    await panel.clickTab(label);
    if (label === 'YAML' || label === 'Logs') {
      if (!(await panel.root.isVisible().catch(() => false)) && reopenPanel) {
        await ensurePanelAndTab();
      }
      await panel.expectCodeMirrorVisible();
    } else if (label === 'Events') {
      // Most resources use <ResourceEventsTab className="resource-events-tab" />.
      // Pods have a custom Events tab with a header "Events for <pod>".
      const resourceEvents = panel.root.locator('.resource-events-tab');
      const podEventsHeader = panel.root.getByText(/^Events for /);
      await expect
        .poll(async () => (await resourceEvents.count()) > 0 || (await podEventsHeader.count()) > 0)
        .toBe(true);
      if (!(await panel.root.isVisible().catch(() => false)) && reopenPanel) {
        await ensurePanelAndTab();
      }
      await panel.expectNoErrorText();
    } else {
      if (!(await panel.root.isVisible().catch(() => false)) && reopenPanel) {
        await ensurePanelAndTab();
      }
      await panel.expectNoErrorText();
    }
  }
}

async function confirmAction(panel: BottomPanel, actionLabel: 'Restart' | 'Delete') {
  await panel.root.getByRole('button', { name: actionLabel, exact: true }).click();
  await panel.root.getByRole('button', { name: 'Confirm', exact: true }).click();
}

// ---------------------------------------------------------------------------
// Workloads: Deployment / ReplicaSet / Pod / StatefulSet / DaemonSet
// ---------------------------------------------------------------------------

test('bottom panels: workloads (Deployment/ReplicaSet/Pod/StatefulSet/DaemonSet)', async ({ page, contextName, namespace }) => {
  test.setTimeout(180_000);

  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  const notifications = new Notifications(page);
  const overlay = new CreateOverlay(page);
  const panel = new BottomPanel(page);

  // --- Deployment (also gives us Pods + ReplicaSet)
  await sidebar.goToSection('deployments');

  const deployName = uniqueName('e2e-deploy');
  const deployYaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${deployName}\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${deployName}\n  template:\n    metadata:\n      labels:\n        app: ${deployName}\n    spec:\n      containers:\n      - name: app\n        image: nginx:latest\n        ports:\n        - containerPort: 80\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(deployYaml);
  await overlay.create();
  await notifications.waitForClear();

  await openRowDetailsByName(page, deployName);
  await panel.expectVisible();

  await expectAndClickTabs(panel, ['Summary', 'Pods', 'Rollout', 'Logs', 'Events', 'YAML']);

  // Actions (Summary tab)
  await panel.clickTab('Summary');
  await panel.root.getByRole('button', { name: 'Scale', exact: true }).click();
  await panel.root.getByLabel('Replicas', { exact: true }).fill('2');
  await panel.root.getByRole('button', { name: 'Apply', exact: true }).click();
  await notifications.waitForClear();

  await confirmAction(panel, 'Restart');
  await notifications.waitForClear();

  // --- ReplicaSet (derived from Deployment)
  await panel.closeByClickingOutside();
  await sidebar.goToSection('replicasets');

  // Find a ReplicaSet row for this deployment by label/name match.
  // (ReplicaSet name is typically ${deployName}-<hash>)
  await expect
    .poll(
      async () => {
        await sidebar.goToSection('replicasets');
        return page
          .locator('#main-panels > div:visible table.gh-table tbody tr')
          .filter({ hasText: deployName })
          .count();
      },
      { timeout: 120_000, intervals: [1_000, 2_000, 3_000, 5_000] }
    )
    .toBeGreaterThan(0);

  const rsRow = page.locator('#main-panels > div:visible table.gh-table tbody tr').filter({ hasText: deployName }).first();
  await expect(rsRow).toBeVisible({ timeout: 60_000 });
  await rsRow.click();
  await panel.expectVisible();

  await expectAndClickTabs(panel, ['Summary', 'Pods', 'Owner', 'Events', 'YAML']);

  // ReplicaSet: exercise Scale UI but don't mutate cluster state (cancel)
  await panel.clickTab('Summary');
  await panel.root.getByRole('button', { name: 'Scale', exact: true }).click();
  await expect(panel.root.getByLabel('Replicas', { exact: true })).toBeVisible();
  await panel.root.getByRole('button', { name: 'Cancel', exact: true }).click();
  await notifications.waitForClear();

  // --- Pod (derived from Deployment)
  await panel.closeByClickingOutside();
  await sidebar.goToSection('pods');

  // Wait for at least one pod from the deployment to appear.
  // During KinD API reconnect windows the table can transiently show "No Pods...".
  await expect
    .poll(
      async () => {
        await sidebar.goToSection('pods');
        const table = page
          .locator('#main-panels > div:visible table.gh-table')
          .filter({ has: page.locator('tbody tr') })
          .first();
        if (!(await table.isVisible().catch(() => false))) {
          return 0;
        }
        const tableText = await table.innerText().catch(() => '');
        if (/No Pods deployed in this namespace/i.test(tableText)) {
          return 0;
        }
        return table.locator('tbody tr').filter({ hasText: deployName }).count();
      },
      { timeout: 210_000, intervals: [1_000, 2_000, 3_000, 5_000] }
    )
    .toBeGreaterThan(0);

  const podRow = page.locator('#main-panels > div:visible table.gh-table tbody tr').filter({ hasText: deployName }).first();
  await expect(podRow).toBeVisible({ timeout: 30_000 });
  await waitForResourceStatus(page, new RegExp(deployName), 'Running', { timeout: 120_000 });

  await podRow.click();
  await panel.expectVisible();

  await expectAndClickTabs(panel, ['Summary', 'Logs', 'Events', 'YAML', 'Console', 'Port Forward', 'Files', 'Mounts']);

  // Pod actions: restart (confirm)
  await panel.clickTab('Summary');
  await confirmAction(panel, 'Restart');
  await notifications.waitForClear();

  // --- StatefulSet (create)
  await panel.closeByClickingOutside();
  await sidebar.goToSection('statefulsets');

  const stsName = uniqueName('e2e-sts');
  const svcName = `${stsName}-headless`;
  const svcYaml = `apiVersion: v1\nkind: Service\nmetadata:\n  name: ${svcName}\n  namespace: ${namespace}\nspec:\n  clusterIP: None\n  selector:\n    app: ${stsName}\n  ports:\n  - port: 80\n    name: http\n`;

  const stsYaml = `apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: ${stsName}\n  namespace: ${namespace}\nspec:\n  serviceName: ${svcName}\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${stsName}\n  template:\n    metadata:\n      labels:\n        app: ${stsName}\n    spec:\n      containers:\n      - name: app\n        image: busybox:1.36\n        command: ['sh','-c','sleep 3600']\n`;

  // Create required headless Service first (single-doc YAML)
  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(svcYaml);
  await overlay.create();
  await notifications.waitForClear();

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(stsYaml);
  await overlay.create();
  await notifications.waitForClear();

  await openRowDetailsByName(page, stsName);
  await panel.expectVisible();

  await expectAndClickTabs(panel, ['Summary', 'Pods', 'PVCs', 'Logs', 'Events', 'YAML']);

  // StatefulSet actions: restart (confirm)
  await panel.clickTab('Summary');
  await confirmAction(panel, 'Restart');
  await notifications.waitForClear();

  // --- DaemonSet (create)
  await panel.closeByClickingOutside();
  await sidebar.goToSection('daemonsets');

  const dsName = uniqueName('e2e-ds');
  const dsYaml = `apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: ${dsName}\n  namespace: ${namespace}\nspec:\n  selector:\n    matchLabels:\n      app: ${dsName}\n  template:\n    metadata:\n      labels:\n        app: ${dsName}\n    spec:\n      containers:\n      - name: app\n        image: busybox:1.36\n        command: ['sh','-c','sleep 3600']\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(dsYaml);
  await overlay.create();
  await notifications.waitForClear();

  await openRowDetailsByName(page, dsName);
  await panel.expectVisible();

  await expectAndClickTabs(panel, ['Summary', 'Pods', 'Node Coverage', 'Logs', 'Events', 'YAML']);

  // DaemonSet: scale button should exist but be disabled
  await panel.clickTab('Summary');
  await expect(panel.root.getByRole('button', { name: 'Scale', exact: true })).toBeDisabled();

  // DaemonSet actions: restart then delete
  await confirmAction(panel, 'Restart');
  await notifications.waitForClear();

  await confirmAction(panel, 'Delete');
  await notifications.waitForClear();
});

// ---------------------------------------------------------------------------
// Batch: Job / CronJob
// ---------------------------------------------------------------------------

test('bottom panels: batch (Job/CronJob)', async ({ page, contextName, namespace }) => {
  test.setTimeout(180_000);

  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  const overlay = new CreateOverlay(page);
  const notifications = new Notifications(page);
  const panel = new BottomPanel(page);

  // --- Job
  await sidebar.goToSection('jobs');
  const jobName = uniqueName('e2e-job');
  const jobYaml = `apiVersion: batch/v1\nkind: Job\nmetadata:\n  name: ${jobName}\n  namespace: ${namespace}\nspec:\n  template:\n    metadata:\n      labels:\n        app: ${jobName}\n    spec:\n      restartPolicy: Never\n      containers:\n      - name: app\n        image: busybox:1.36\n        command: ['sh','-c','echo hello; sleep 2']\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(jobYaml);
  await overlay.create();
  await notifications.waitForClear();

  await openRowDetailsByName(page, jobName);
  await panel.expectVisible();
  await expectAndClickTabs(panel, ['Summary', 'Pods', 'Logs', 'Events', 'YAML'], async () => {
    await openRowDetailsByName(page, jobName);
  });

  // Job actions: Start (re-run)
  await panel.clickTab('Summary');
  await panel.root.getByRole('button', { name: 'Start', exact: true }).click();
  await notifications.waitForClear();

  // --- CronJob
  await panel.closeByClickingOutside();
  await sidebar.goToSection('cronjobs');

  const cronName = uniqueName('e2e-cron');
  const cronYaml = `apiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: ${cronName}\n  namespace: ${namespace}\nspec:\n  schedule: '*/5 * * * *'\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          restartPolicy: Never\n          containers:\n          - name: app\n            image: busybox:1.36\n            command: ['sh','-c','echo cron; sleep 1']\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(cronYaml);
  await overlay.create();
  await notifications.waitForClear();

  await openRowDetailsByName(page, cronName);
  await panel.expectVisible();
  await expectAndClickTabs(panel, ['Summary', 'Job History', 'Next Runs', 'Actions', 'Events', 'YAML'], async () => {
    await openRowDetailsByName(page, cronName);
  });

  // CronJob Actions tab has its own UI messages (not global toast)
  await panel.clickTab('Actions');
  const actionsTab = panel.root.locator('.cronjob-actions-tab');
  await expect(actionsTab.getByText('CronJob Actions')).toBeVisible();

  await actionsTab.getByRole('button', { name: 'Trigger Job Now', exact: true }).click();
  await expect(actionsTab).toContainText('Job triggered successfully', { timeout: 60_000 });

  // Toggle suspend/resume once
  const suspendOrResume = actionsTab.getByRole('button', { name: /^(Suspend|Resume)$/ }).first();
  await suspendOrResume.click();
  await expect(actionsTab).toContainText('successfully', { timeout: 60_000 });
});
