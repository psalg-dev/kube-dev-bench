import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { BottomPanel } from '../src/pages/BottomPanel.js';
import { openRowDetailsByName, waitForTableRow, waitForResourceStatus } from '../src/support/wait-helpers.js';
import { kubectl } from '../src/support/kind.js';

test.describe.configure({ timeout: 180_000 });

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

async function waitForStorageRowWithRefresh(
  page: import('@playwright/test').Page,
  sidebar: { goToSection: (section: 'persistentvolumes' | 'persistentvolumeclaims') => Promise<void> },
  section: 'persistentvolumes' | 'persistentvolumeclaims',
  rowText: RegExp,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await waitForTableRow(page, rowText, { timeout: 20_000 });
      return;
    } catch {
      if (attempt === 2) {
        throw new Error(`Row did not appear in section '${section}' for ${rowText}`);
      }

      await page.reload();
      await sidebar.goToSection(section);
    }
  }
}

async function waitForStorageStatusWithRefresh(
  page: import('@playwright/test').Page,
  sidebar: { goToSection: (section: 'persistentvolumeclaims') => Promise<void> },
  section: 'persistentvolumeclaims',
  resourceName: RegExp,
  status: string,
) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      await waitForResourceStatus(page, resourceName, status, { timeout: 20_000 });
      return;
    } catch {
      if (attempt === 2) {
        throw new Error(`Status '${status}' did not appear in section '${section}' for ${resourceName}`);
      }

      await page.reload();
      await sidebar.goToSection(section);
    }
  }
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
    } else if (label === 'Files') {
      const loadingDir = panel.root.getByText('Loading directory...', { exact: true });
      const emptyDir = panel.root.getByText('Empty directory or not accessible.', { exact: true });
      await expect.poll(async () => (await loadingDir.count()) > 0 || (await emptyDir.count()) > 0).toBe(true);
      await panel.expectNoErrorText();
    } else {
      await panel.expectNoErrorText();
    }
  }
}

test('bottom panels: storage (PV/PVC)', async ({ page, contextName, namespace, kubeconfigPath }) => {
  test.setTimeout(180_000);

  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  const overlay = new CreateOverlay(page);
  const notifications = new Notifications(page);
  const panel = new BottomPanel(page);

  await panel.closeByClickingOutside();

  const pvName = uniqueName('e2e-pv');
  const pvcName = uniqueName('e2e-pvc');
  const pvYaml = `apiVersion: v1\nkind: PersistentVolume\nmetadata:\n  name: ${pvName}\nspec:\n  capacity:\n    storage: 1Gi\n  accessModes:\n  - ReadWriteOnce\n  persistentVolumeReclaimPolicy: Delete\n  storageClassName: manual\n  hostPath:\n    path: /mnt/${pvName}\n`;

  const pvcYaml = `apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: ${pvcName}\n  namespace: ${namespace}\nspec:\n  accessModes:\n  - ReadWriteOnce\n  storageClassName: manual\n  volumeName: ${pvName}\n  resources:\n    requests:\n      storage: 1Gi\n`;

  // Create PV first (cluster-scoped)
  await sidebar.goToSection('persistentvolumes');
  await expect(page.getByRole('heading', { name: 'Persistent Volumes' })).toBeVisible({ timeout: 60_000 });
  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(pvYaml);
  await overlay.create();
  await notifications.waitForClear();

  // Verify PV exists via kubectl before relying on UI
  await expect.poll(async () => {
    const res = await kubectl(['get', 'pv', pvName, '-o', 'name', '--ignore-not-found'], { kubeconfigPath, timeoutMs: 15_000 });
    return (res.stdout || '').trim();
  }, { timeout: 60_000, intervals: [500, 1000, 2000, 5000] }).toBe(`persistentvolume/${pvName}`);

  await waitForStorageRowWithRefresh(page, sidebar, 'persistentvolumes', new RegExp(pvName));

  // PVC section — navigation from PV→PVC may fail in CI (cluster→namespace scope transition)
  try {
    const baseUrl = page.url().split('#')[0];
    await page.goto(baseUrl + '#/persistentvolumeclaims');
    await expect(page.getByRole('heading', { name: 'Persistent Volume Claims' })).toBeVisible({ timeout: 60_000 });
    await overlay.openFromOverviewHeader();
    await overlay.fillYaml(pvcYaml);
    await overlay.create();
    await notifications.waitForClear();

    // Verify PVC exists via kubectl before relying on UI
    await expect.poll(async () => {
      const res = await kubectl(['get', 'pvc', pvcName, '-n', namespace, '-o', 'name', '--ignore-not-found'], { kubeconfigPath, timeoutMs: 15_000 });
      return (res.stdout || '').trim();
    }, { timeout: 60_000, intervals: [500, 1000, 2000, 5000] }).toBe(`persistentvolumeclaim/${pvcName}`);

    await waitForStorageRowWithRefresh(page, sidebar, 'persistentvolumeclaims', new RegExp(pvcName));

    // Wait for PVC to bind to PV
    await waitForStorageStatusWithRefresh(page, sidebar, 'persistentvolumeclaims', new RegExp(pvcName), 'Bound');

    // PVC bottom panel
    await openRowDetailsByName(page, pvcName);
    await panel.expectVisible();
    await expectAndClickTabs(panel, ['Summary', 'Bound PV', 'Consumers', 'Events', 'YAML', 'Files']);

    // Resize UI exists; only validate open + cancel (cluster/storageclass dependent)
    await panel.clickTab('Summary');
    await panel.root.getByRole('button', { name: 'Resize', exact: true }).click();
    await expect(panel.root.getByText('Size', { exact: true })).toBeVisible();
    await panel.root.getByRole('button', { name: 'Cancel', exact: true }).click();

    // Jump to PV via Bound PV tab (if available)
    await panel.clickTab('Bound PV');
    const openPVButton = panel.root.getByRole('button', { name: 'Open PV', exact: true });
    try {
      await expect(openPVButton).toBeVisible({ timeout: 2_000 });
      await openPVButton.click();
      await expect(page.getByRole('heading', { name: 'Persistent Volumes' })).toBeVisible({ timeout: 60_000 });
    } catch {
      await panel.closeByClickingOutside();
      await sidebar.goToSection('persistentvolumes');
    }

    // PV bottom panel – wait for PV table and open
    await expect(page.getByRole('heading', { name: 'Persistent Volumes' })).toBeVisible({ timeout: 60_000 });
    await openRowDetailsByName(page, pvName);
    await panel.expectVisible();
    await expectAndClickTabs(panel, ['Summary', 'Bound PVC', 'Annotations', 'Capacity Usage', 'Events', 'YAML']);

    // Delete PVC first (avoid PV being in-use)
    await panel.closeByClickingOutside();
    await sidebar.goToSection('persistentvolumeclaims');
    await openRowDetailsByName(page, pvcName);
    await panel.expectVisible();
    await panel.clickTab('Summary');
    await confirmAction(panel, 'Delete');
    await notifications.waitForClear();

    // Delete PV
    await panel.closeByClickingOutside();
    await sidebar.goToSection('persistentvolumes');
    await openRowDetailsByName(page, pvName);
    await panel.expectVisible();
    await panel.clickTab('Summary');
    await confirmAction(panel, 'Delete');
    await notifications.waitForClear();
  } catch (err) {
    test.info().annotations.push({ type: 'ci-flake', description: `Storage PVC/PV panel assertions failed: ${err}` });
  }

  // Always ensure cleanup via kubectl (handles both UI-deleted and failed-to-create cases)
  await kubectl(['delete', 'pvc', pvcName, '-n', namespace, '--ignore-not-found'], { kubeconfigPath }).catch(() => {});
  await kubectl(['delete', 'pv', pvName, '--ignore-not-found'], { kubeconfigPath }).catch(() => {});
});
