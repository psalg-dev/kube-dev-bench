import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { BottomPanel } from '../src/pages/BottomPanel.js';

test.describe.configure({ timeout: 180_000 });

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

async function expectAndClickTabs(panel: BottomPanel, labels: string[]) {
  await panel.expectTabs(labels);
  for (const label of labels) {
    await panel.clickTab(label);
    if (label === 'YAML' || label === 'Logs') {
      await panel.expectCodeMirrorVisible();
    } else if (label === 'Events') {
      // Most resources use <ResourceEventsTab className="resource-events-tab" />.
      // Pods have a custom Events tab with a header "Events for <pod>".
      const resourceEvents = panel.root.locator('.resource-events-tab');
      const podEventsHeader = panel.root.getByText(/^Events for /);
      await expect
        .poll(async () => (await resourceEvents.count()) > 0 || (await podEventsHeader.count()) > 0)
        .toBe(true);
      await panel.expectNoErrorText();
    } else {
      await panel.expectNoErrorText();
    }
  }
}

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
  await expectAndClickTabs(panel, ['Summary', 'Pods', 'Logs', 'Events', 'YAML']);

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
  await expectAndClickTabs(panel, ['Summary', 'Job History', 'Next Runs', 'Actions', 'Events', 'YAML']);

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
