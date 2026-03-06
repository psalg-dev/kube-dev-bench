import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { BottomPanel } from '../src/pages/BottomPanel.js';
import { kubectl } from '../src/support/kind.js';

test.describe.configure({ timeout: 180_000 });

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

async function openRowDetailsByName(page: any, name: string) {
  await expect(page.locator('#gh-notification-container .gh-notification')).toHaveCount(0, { timeout: 10_000 });
  const row = page.locator('table.gh-table tbody tr').filter({ hasText: name }).first();
  await expect(row).toBeVisible({ timeout: 60_000 });
  await row.click();
}

async function confirmAction(panel: BottomPanel, actionLabel: 'Delete') {
  await panel.root.getByRole('button', { name: actionLabel, exact: true }).click();
  await panel.root.getByRole('button', { name: 'Confirm', exact: true }).click();
}

async function expectAndClickTabs(panel: BottomPanel, labels: string[]) {
  await panel.expectTabs(labels);
  for (const label of labels) {
    await panel.clickTab(label);
    if (label === 'YAML') {
      await panel.expectCodeMirrorVisible();
    } else if (label === 'Events') {
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

test('bottom panels: config (ConfigMap/Secret)', async ({ page, contextName, namespace, kubeconfigPath }) => {
  test.setTimeout(180_000);

  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  const overlay = new CreateOverlay(page);
  const notifications = new Notifications(page);
  const panel = new BottomPanel(page);

  // --- ConfigMap
  await sidebar.goToSection('configmaps');

  const cmName = uniqueName('e2e-cm');
  const cmYaml = `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ${cmName}\n  namespace: ${namespace}\ndata:\n  hello: world\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(cmYaml);
  await overlay.create();
  await notifications.waitForClear();

  // Verify via kubectl before relying on the table
  await expect
    .poll(
      async () => {
        const res = await kubectl(
          ['get', 'configmap', cmName, '-n', namespace, '-o', 'name', '--ignore-not-found'],
          { kubeconfigPath, timeoutMs: 15_000 }
        );
        return (res.stdout || '').trim();
      },
      { timeout: 90_000, intervals: [500, 1000, 2000, 5000] }
    )
    .toBe(`configmap/${cmName}`);

  // Re-navigate to force fresh table data
  await sidebar.goToSection('pods');
  await sidebar.goToSection('configmaps');

  await openRowDetailsByName(page, cmName);
  await panel.expectVisible();
  await expectAndClickTabs(panel, ['Summary', 'Data', 'Consumers', 'Events', 'YAML']);

  await panel.clickTab('Summary');
  await confirmAction(panel, 'Delete');
  await notifications.waitForClear();

  // --- Secret
  await panel.closeByClickingOutside();
  await sidebar.goToSection('secrets');

  const secretName = uniqueName('e2e-secret');
  const secretYaml = `apiVersion: v1\nkind: Secret\nmetadata:\n  name: ${secretName}\n  namespace: ${namespace}\ntype: Opaque\nstringData:\n  token: abc123\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(secretYaml);
  await overlay.create();
  await notifications.waitForClear();

  // Verify via kubectl before relying on the table
  await expect
    .poll(
      async () => {
        const res = await kubectl(
          ['get', 'secret', secretName, '-n', namespace, '-o', 'name', '--ignore-not-found'],
          { kubeconfigPath, timeoutMs: 15_000 }
        );
        return (res.stdout || '').trim();
      },
      { timeout: 90_000, intervals: [500, 1000, 2000, 5000] }
    )
    .toBe(`secret/${secretName}`);

  // Re-navigate to force fresh table data
  await sidebar.goToSection('pods');
  await sidebar.goToSection('secrets');

  await openRowDetailsByName(page, secretName);
  await panel.expectVisible();
  await expectAndClickTabs(panel, ['Summary', 'Data', 'Consumers', 'Events', 'YAML']);

  await panel.clickTab('Summary');
  await confirmAction(panel, 'Delete');
  await notifications.waitForClear();
});
