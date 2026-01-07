import { type Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { SwarmConnectionWizardPage } from '../pages/SwarmConnectionWizardPage.js';
import { SwarmSidebarPage } from '../pages/SwarmSidebarPage.js';
import { ConnectionWizardPage } from '../pages/ConnectionWizardPage.js';
import { CreateOverlay } from '../pages/CreateOverlay.js';
// Swarm fixtures are deployed once per run in `e2e/src/support/global-setup.ts`.
// Avoid redeploying/waiting per test; it is slow and can flake under tight per-test timeouts.

export interface SwarmBootstrapOptions {
  page: Page;
  /** Override the default Docker host (defaults to local socket) */
  dockerHost?: string;
  /** Skip connection wizard if already connected */
  skipIfConnected?: boolean;
  /** Ensure at least one test service exists (seed if empty). Default: true */
  ensureSeedService?: boolean;
}

export interface SwarmBootstrapResult {
  sidebar: SwarmSidebarPage;
  wizard: SwarmConnectionWizardPage;
}

/**
 * Bootstrap the Swarm section of the application.
 * Connects to Docker Swarm if not already connected and returns page objects.
 */
export async function bootstrapSwarm(opts: SwarmBootstrapOptions): Promise<SwarmBootstrapResult> {
  const { page, dockerHost, skipIfConnected = true, ensureSeedService = true } = opts;

  const wizard = new SwarmConnectionWizardPage(page);
  const sidebar = new SwarmSidebarPage(page);

  // Always ensure we're on the app root; baseURL routing handles host.
  if (!page.url() || page.url() === 'about:blank') {
    await page.goto('/');
  }

  // If the Swarm sidebar is already present, we're effectively "in Swarm mode".
  const isConnected = await sidebar.isSwarmConnected();

  if (isConnected && skipIfConnected) {
    return { sidebar, wizard };
  }

  // If we are not in Swarm mode yet, connect via the main Connections wizard.
  // This is the same flow used by the dedicated Swarm connection E2E.
  const connectionsWizard = new ConnectionWizardPage(page);
  const openWizardStatus = await connectionsWizard.openWizardIfHidden();
  console.log(`[swarm-bootstrap] openWizardIfHidden: ${openWizardStatus}`);

  // If the wizard was already open, ensure it's actually visible and ready.
  await connectionsWizard.ensureWizardVisible();

  // Ensure we are on the Docker Swarm section (not Kubernetes) and stay there long enough
  // to click Connect. When running with no Kubernetes contexts, the wizard is always shown,
  // and the Swarm connection is the only way to proceed to the main app view.
  const swarmSection = page.locator('#connection-section-docker-swarm');
  const swarmHeading = page.getByRole('heading', { name: /docker swarm connections/i });
  const addSwarmBtn = page.locator('#add-swarm-btn');
  const detectingText = page.getByText(/detecting docker connections\.{3}/i);
  const connectionItems = page.locator('.connection-item');
  const wizardLayout = page.locator('.connection-wizard-layout, .connection-wizard-overlay').first();

  await expect(swarmSection).toBeVisible({ timeout: 30_000 });

  for (let attempt = 0; attempt < 2; attempt++) {
    if (page.isClosed()) {
      throw new Error('bootstrapSwarm aborted: page was closed');
    }
    // 1) Force-select the Swarm section.
    await swarmSection.scrollIntoViewIfNeeded();
    await swarmSection.click({ timeout: 10_000, force: true });

    // 2) Prove we're actually on the Swarm view.
    try {
      await expect(swarmSection).toHaveClass(/\bselected\b/, { timeout: 5_000 });
      await expect(swarmHeading).toBeVisible({ timeout: 5_000 });
      await expect(addSwarmBtn).toBeVisible({ timeout: 10_000 });
    } catch (err) {
      if (attempt === 4) throw err;
      // Fallback: direct DOM click in case pointer events are intercepted.
      await page.evaluate(() => {
        document.getElementById('connection-section-docker-swarm')?.click();
      });
      await page.waitForTimeout(250);
      continue;
    }

    // 3) Wait for detection to settle (if it is running).
    // If the text isn't present, this is effectively a no-op.
    await expect(detectingText).toBeHidden({ timeout: 60_000 }).catch(() => undefined);

    // 4) Pick a connection row. Prefer the explicit "Local Docker" entry.
    await expect(connectionItems.first()).toBeVisible({ timeout: 60_000 });
    let targetItem = connectionItems.filter({ hasText: /local docker/i }).first();

    // If the test provides a dockerHost, prefer a row matching it.
    if (dockerHost) {
      const byHost = connectionItems.filter({ hasText: dockerHost }).first();
      if (await byHost.count()) targetItem = byHost;
    }

    if (!(await targetItem.count())) {
      targetItem = connectionItems.first();
    }

    // 5) Click Connect as quickly and directly as possible.
    await expect(targetItem).toBeVisible({ timeout: 30_000 });
    const connectBtn = targetItem.getByRole('button', { name: /^connect$/i });
    await expect(connectBtn).toBeVisible({ timeout: 30_000 });
    await connectBtn.click({ timeout: 30_000, force: true });

    // 6) Success condition: wizard closes and main app becomes visible.
    // The main app sidebar always has `#kubecontext-root` (even if empty/disabled).
    try {
      await expect(wizardLayout).toBeHidden({ timeout: 60_000 });
    } catch {
      // If wizard didn't close, determine whether connect failed and surface the reason.
      const statusText = (await targetItem.textContent().catch(() => '')) || '';
      // Look for the inline result box produced by DockerSwarmConnectionsList.
      const failureHint = /connection failed|timed out|failed|error/i.test(statusText)
        ? statusText.trim().slice(0, 300)
        : 'No explicit error text found in connection item.';
      if (attempt === 1) {
        throw new Error(`Docker Swarm connect did not close wizard. ${failureHint}`);
      }
      // Give React a moment and retry once.
      await page.waitForTimeout(300);
      continue;
    }

    // 7) Wait for Swarm sidebar to be available in the main app.
    await expect(page.locator('#swarm-show-wizard-btn')).toBeVisible({ timeout: 60_000 });
    // If connected, Swarm sidebar sections (e.g. Services) should be visible.
    await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 60_000 });
    break;
  }

  // Wait for Swarm sidebar to appear.
  await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 60_000 });

  // If a Swarm-specific gear wizard exists, ensure it can connect too (optional sanity).
  // Do not require it for initial connection.
  if (!skipIfConnected) {
    await wizard.connectToLocalDocker();
  }

  // Seed a service if the swarm starts empty.
  // Many Swarm UI tests expect at least one row to be present.
  if (ensureSeedService) {
    await sidebar.goToServices();
    const servicesTable = page.locator('[data-testid="swarm-services-table"]');
    await expect(servicesTable).toBeVisible({ timeout: 60_000 });

    // Give the table a short chance to populate.
    await page.waitForTimeout(500);

    // The UI renders a placeholder row when empty (e.g. "No rows match the filter.").
    // Count "real" data rows by looking for the per-row Details button.
    const detailsButtons = servicesTable.getByRole('button', { name: /^details$/i });
    const detailsCount = await detailsButtons.count().catch(() => 0);
    const hasEmptyPlaceholder = await servicesTable
      .locator('tbody tr td.main-panel-loading')
      .filter({ hasText: /no rows match/i })
      .first()
      .isVisible()
      .catch(() => false);

    if (detailsCount === 0 || hasEmptyPlaceholder) {
      const seedName = uniqueSwarmName('seed-svc');
      const overlay = new CreateOverlay(page);
      await overlay.openFromOverviewHeader();

      await expect(page.locator('#swarm-create-overlay')).toBeVisible({ timeout: 30_000 });
      await page.locator('#swarm-service-name').fill(seedName);
      await page.locator('#swarm-service-image').fill('nginx:alpine');
      await page.locator('#swarm-create-btn').click();

      await expect(page.locator('#swarm-create-overlay')).toBeHidden({ timeout: 60_000 });
      await expect(servicesTable.getByText(seedName).first()).toBeVisible({ timeout: 60_000 });
    }
  }

  return { sidebar, wizard };
}

/**
 * Helper to create a test service in Docker Swarm.
 * Returns the service name.
 */
export async function createTestService(opts: {
  name: string;
  image?: string;
  replicas?: number;
}): Promise<string> {
  const { name, image = 'nginx:alpine', replicas = 1 } = opts;
  
  // This would call the backend API directly or use docker CLI
  // For E2E tests, we typically use the UI to create resources
  // But for setup, direct API calls are faster
  
  // The actual implementation would depend on how Docker API is exposed
  // For now, return the name for UI-based creation
  return name;
}

/**
 * Generate a unique test resource name.
 */
export function uniqueSwarmName(prefix: string): string {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}
