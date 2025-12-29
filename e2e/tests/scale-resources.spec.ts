import { test, expect } from '../setup/fixtures';
import {
  connectWithKindKubeconfig,
  selectNamespace,
  selectSection,
  scaleAndRevert,
  closeBottomPanel,
} from '../setup/helpers';

const resourcesToScale = [
  { section: 'deployments', name: 'example-deployment', columnIndex: 3 },
  { section: 'statefulsets', name: 'example-statefulset', columnIndex: 3 },
  { section: 'replicasets', name: 'example-replicaset', columnIndex: 3 },
];

test.describe('Scale controls', () => {
  test('scales replica controllers via bottom panel actions', async ({ page, baseURL }) => {
    test.setTimeout(180_000); // Increased timeout for scaling operations
    test.skip(process.env.KIND_AVAILABLE !== '1', 'KinD cluster required for scaling test.');
    await connectWithKindKubeconfig(page, baseURL);
    await selectNamespace(page, 'test');
    for (const resource of resourcesToScale) {
      await scaleAndRevert(page, resource);
    }
    // DaemonSets should show a disabled scale control since Kubernetes manages their pod count.
    await selectSection(page, 'daemonsets');
    const row = page.locator('tbody tr').filter({ hasText: 'example-daemonset' }).first();
    await expect(row).toBeVisible({ timeout: 60_000 });
    await row.click();
    const panel = page.locator('.bottom-panel');
    await expect(panel).toBeVisible({ timeout: 10_000 });
    await expect(panel.getByRole('button', { name: /^Scale$/i })).toBeDisabled();
    await closeBottomPanel(page);
  });
});
