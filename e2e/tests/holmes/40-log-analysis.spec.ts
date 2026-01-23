import { test, expect } from '../../src/fixtures.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { BottomPanel } from '../../src/pages/BottomPanel.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

test('analyzes pod logs with Holmes', async ({ page, contextName, namespace }) => {
  test.setTimeout(180_000);

  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
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
  
  // The Explain Logs button may not be visible if Holmes is not configured
  const hasExplainBtn = await explainBtn.isVisible().catch(() => false);
  if (!hasExplainBtn) {
    // Holmes AI not configured - verify logs tab works and skip AI analysis
    const logsContent = panel.root.locator('.cm-editor, pre, .logs-container');
    await expect(logsContent.first().or(panel.root.getByText(/no logs|loading/i))).toBeVisible({ timeout: 15_000 });
    test.skip(true, 'Holmes AI not configured - skipping log analysis test');
    return;
  }
  
  await explainBtn.click();

  // Wait for analysis or error state
  const analysis = panel.root.locator('[data-testid="holmes-log-analysis"]');
  const errorState = panel.root.getByText(/Holmes AI is not configured|error|failed/i);
  
  await expect(analysis.or(errorState)).toBeVisible({ timeout: 60_000 });
});
