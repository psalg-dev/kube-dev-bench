import { test, expect } from '../../src/fixtures.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { BottomPanel } from '../../src/pages/BottomPanel.js';
import { configureHolmesMock } from '../../src/support/holmes-bootstrap.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('analyzes pod logs with Holmes', async ({ page, contextName, namespace }) => {
  test.setTimeout(180_000);

  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  await configureHolmesMock({ page });
  const overlay = new CreateOverlay(page);
  const notifications = new Notifications(page);
  const panel = new BottomPanel(page);

  await sidebar.goToSection('deployments');

  const deployName = uniqueName('e2e-holmes-logs');
  const deployYaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${deployName}\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${deployName}\n  template:\n    metadata:\n      labels:\n        app: ${deployName}\n    spec:\n      containers:\n      - name: app\n        image: busybox\n        command: [\"sh\", \"-c\", \"echo log-line; sleep 3600\"]\n`;

  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(deployYaml);
  await overlay.create();
  await notifications.expectSuccessContains('created successfully');

  await sidebar.goToSection('pods');

  const podRow = page.getByRole('row', { name: new RegExp(deployName) }).first();
  await expect(podRow).toBeVisible({ timeout: 90_000 });
  await podRow.click();

  await panel.expectVisible(30_000);
  await panel.clickTab('Logs');

  const explainBtn = panel.root.getByRole('button', { name: /explain logs/i });
  const hasExplain = await explainBtn.isVisible().catch(() => false);

  if (hasExplain) {
    await explainBtn.click();

    // Wait for analysis
    const analysis = panel.root.locator('[data-testid="holmes-log-analysis"]');
    await expect(analysis).toBeVisible({ timeout: 60_000 });
    await expect(analysis).toContainText(/Log analysis completed|Log Analysis/i);
  } else {
    // Fallback to Holmes panel if the logs button is not available
    await panel.clickTab('Holmes');
    const askBtn = panel.root.getByRole('button', { name: /analyze with holmes/i });
    await expect(askBtn).toBeVisible({ timeout: 10_000 });
    await askBtn.click();
    await expect(panel.root).toContainText(/Log analysis completed|Holmes Analysis|Analyzing/i);
  }
});
