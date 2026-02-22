import { test, expect } from '../../src/fixtures.js';
import type { Page } from '@playwright/test';
import { bootstrapApp } from '../../src/support/bootstrap.js';
import { CreateOverlay } from '../../src/pages/CreateOverlay.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { BottomPanel } from '../../src/pages/BottomPanel.js';
import { configureHolmesMock } from '../../src/support/holmes-bootstrap.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

async function createDeploymentWithRetry(opts: {
  page: Page;
  overlay: CreateOverlay;
  notifications: Notifications;
  name: string;
  yaml: string;
}) {
  const { page, overlay, notifications, name, yaml } = opts;
  const overlayRoot = page.locator('[data-testid="create-manifest-overlay"]').first();

  const closeOverlayIfOpen = async () => {
    if (!(await overlayRoot.isVisible().catch(() => false))) return;
    const closeBtn = overlayRoot.getByRole('button', { name: /close|cancel/i }).first();
    if (await closeBtn.isVisible().catch(() => false)) {
      await closeBtn.click().catch(() => undefined);
    } else {
      await page.keyboard.press('Escape').catch(() => undefined);
    }
    await overlayRoot.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
  };

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await overlay.openFromOverviewHeader();
      await overlay.fillYaml(yaml);
      await overlay.create();
      await notifications.expectSuccessContains('created successfully');
      return;
    } catch (err) {
      const row = page
        .locator('#main-panels > div:visible table.gh-table tbody tr')
        .filter({ hasText: name })
        .first();
      if (await row.isVisible().catch(() => false)) {
        await closeOverlayIfOpen();
        return;
      }

      await closeOverlayIfOpen();

      if (attempt === 3) throw err;
      await page.waitForTimeout(1000 * attempt);
    }
  }
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

  await createDeploymentWithRetry({ page, overlay, notifications, name: deployName, yaml: deployYaml });

  await sidebar.goToSection('pods');

  const filterBox = page.getByRole('searchbox', { name: 'Filter table' });
  if (await filterBox.isVisible().catch(() => false)) {
    await filterBox.fill(deployName);
  }

  const podRow = page.locator('#main-panels > div:visible table.gh-table tbody tr').filter({ hasText: deployName }).first();
  await expect.poll(async () => await podRow.count(), { timeout: 120_000 }).toBeGreaterThan(0);
  
  // Use retry pattern for clicking the pod row
  await expect(async () => {
    await page.keyboard.press('Escape');
    await podRow.click();
    await expect(panel.root).toBeVisible({ timeout: 5_000 });
  }).toPass({ timeout: 30_000, intervals: [500, 1000, 2000] });

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
    await expect(panel.root).toContainText(/Log analysis completed|Holmes Analysis|Analyzing/i, { timeout: 30_000 });
  }
});
