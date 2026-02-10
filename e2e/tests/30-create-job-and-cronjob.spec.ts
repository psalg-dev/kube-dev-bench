import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('creates a Job and a CronJob', async ({ page, contextName, namespace }) => {
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });

  // Job
  await sidebar.goToSection('jobs');
  const jobName = uniqueName('e2e-job');
  const jobYaml = `apiVersion: batch/v1\nkind: Job\nmetadata:\n  name: ${jobName}\n  namespace: ${namespace}\nspec:\n  template:\n    spec:\n      restartPolicy: Never\n      containers:\n      - name: job\n        image: busybox\n        command: [\"sh\", \"-c\", \"echo hello; sleep 5\"]\n  backoffLimit: 0\n`;

  const overlay = new CreateOverlay(page);
  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(jobYaml);
  await overlay.create();

  const notifications = new Notifications(page);
  // The success notification auto-dismisses after 3s. If create() already observed
  // and closed the overlay during that window, the notification may be gone.
  try {
    await notifications.expectSuccessContains('created successfully', { timeoutMs: 10_000 });
  } catch {
    // Notification already dismissed — verify the row appeared instead.
    await expect(page.getByRole('row', { name: new RegExp(jobName) })).toBeVisible({ timeout: 60_000 });
  }
  await expect(page.getByRole('row', { name: new RegExp(jobName) })).toBeVisible({ timeout: 60_000 });

  // CronJob
  await sidebar.goToSection('cronjobs');
  const cronName = uniqueName('e2e-cron');
  const cronYaml = `apiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: ${cronName}\n  namespace: ${namespace}\nspec:\n  schedule: \"*/5 * * * *\"\n  jobTemplate:\n    spec:\n      template:\n        spec:\n          restartPolicy: OnFailure\n          containers:\n          - name: cron\n            image: busybox\n            command: [\"sh\", \"-c\", \"date; echo hello\"]\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(cronYaml);
  await overlay.create();

  // Same race-resilient check for CronJob notification.
  try {
    await notifications.expectSuccessContains('created successfully', { timeoutMs: 10_000 });
  } catch {
    await expect(page.getByRole('row', { name: new RegExp(cronName) })).toBeVisible({ timeout: 60_000 });
  }
  await expect(page.getByRole('row', { name: new RegExp(cronName) })).toBeVisible({ timeout: 60_000 });
});
