import { expect, type Page } from '@playwright/test';

export class SidebarPage {
  constructor(private readonly page: Page) {}

  private readonly routeBySection: Record<string, string> = {
    pods: '#/pods',
    nodes: '#/nodes',
    hpa: '#/hpa',
    deployments: '#/deployments',
    daemonsets: '#/daemonsets',
    statefulsets: '#/statefulsets',
    replicasets: '#/replicasets',
    jobs: '#/jobs',
    cronjobs: '#/cronjobs',
    services: '#/services',
    ingresses: '#/ingresses',
    configmaps: '#/configmaps',
    secrets: '#/secrets',
    persistentvolumeclaims: '#/persistentvolumeclaims',
    persistentvolumes: '#/persistentvolumes',
    roles: '#/roles',
    clusterroles: '#/clusterroles',
    rolebindings: '#/rolebindings',
    clusterrolebindings: '#/clusterrolebindings',
    'namespace-topology': '#/namespace-topology',
    'storage-graph': '#/storage-graph',
    'network-graph': '#/network-graph',
    'rbac-graph': '#/rbac-graph',
  };

  private readonly titleBySection: Record<string, string> = {
    pods: 'Pods',
    nodes: 'Nodes',
    hpa: 'Horizontal Pod Autoscalers',
    deployments: 'Deployments',
    daemonsets: 'Daemon Sets',
    statefulsets: 'Stateful Sets',
    replicasets: 'Replica Sets',
    jobs: 'Jobs',
    cronjobs: 'Cron Jobs',
    roles: 'Roles',
    clusterroles: 'Cluster Roles',
    rolebindings: 'Role Bindings',
    clusterrolebindings: 'Cluster Role Bindings',
  };

  private readonly childGroupBySection: Record<string, string> = {
    'namespace-topology': 'topology',
    'storage-graph': 'topology',
    'network-graph': 'topology',
    'rbac-graph': 'topology',
    pods: 'workloads',
    nodes: 'workloads',
    deployments: 'workloads',
    daemonsets: 'workloads',
    statefulsets: 'workloads',
    replicasets: 'workloads',
    hpa: 'workloads',
    jobs: 'workloads',
    cronjobs: 'workloads',
    services: 'networking',
    ingresses: 'networking',
    configmaps: 'config',
    secrets: 'config',
    persistentvolumeclaims: 'storage',
    persistentvolumes: 'storage',
    helmreleases: 'packaging',
    roles: 'rbac',
    clusterroles: 'rbac',
    rolebindings: 'rbac',
    clusterrolebindings: 'rbac',
  };

  private async ensureSectionVisible(key: string) {
    const section = this.page.locator(`#section-${key}`);
    if (await section.isVisible().catch(() => false)) {
      return;
    }

    const groupKey = this.childGroupBySection[key];
    if (!groupKey) {
      return;
    }

    const groupHeader = this.page.locator(`#section-${groupKey}`);
    await expect(groupHeader).toBeVisible({ timeout: 30_000 });
    const expanded = await groupHeader.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await groupHeader.click({ timeout: 30_000 });
    }

    await expect(section).toBeVisible({ timeout: 30_000 });
  }

  private async expectSectionMainTitle(key: string) {
    const expectedTitle = this.titleBySection[key];
    if (!expectedTitle) {
      return;
    }
    await expect(this.page.locator('#main-panels > div:visible h2.overview-title')).toHaveText(
      new RegExp(`^${expectedTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
      { timeout: 15_000 }
    );
  }

  private async clickSectionWithRetry(sectionSelector: string, key: string) {
    const section = this.page.locator(sectionSelector);
    await expect(section).toBeVisible({ timeout: 30_000 });
    await section.scrollIntoViewIfNeeded();
    const expectedRoute = this.routeBySection[key];

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await section.click({ timeout: 30_000, force: attempt > 0 });

      try {
        if (expectedRoute) {
          await expect(this.page).toHaveURL(new RegExp(`${expectedRoute.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), {
            timeout: 10_000,
          });
        }
        await this.expectSectionMainTitle(key);
        return;
      } catch {
        await this.page.waitForTimeout(250);
      }
    }

    await this.expectSectionMainTitle(key);
  }

  async selectContext(contextName: string) {
    const root = this.page.locator('#kubecontext-root, #sidebar').first();
    await expect(root).toBeVisible({ timeout: 60_000 });
    await root.scrollIntoViewIfNeeded();

    // If already selected, don't churn the menu (helps in parallel runs).
    if (await root.isVisible() && (await root.innerText()).includes(contextName)) {
      return;
    }

    const listbox = this.page.locator('#react-select-context-select-listbox');
    const contextInput = this.page.locator('#react-select-context-select-input').first();
    const rootCombo = this.page.locator('#kubecontext-root [role="combobox"]').first();
    const sidebarContextCombo = this.page.locator('#sidebar [role="combobox"]').first();

    let combobox = contextInput;
    if (!(await combobox.isVisible().catch(() => false))) {
      combobox = rootCombo;
    }
    if (!(await combobox.isVisible().catch(() => false))) {
      combobox = sidebarContextCombo;
    }

    // Open menu reliably: click wrapper first (better viewport behavior), then ArrowDown fallback.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      await root.click({ force: true });
      if (await listbox.isVisible()) break;
      await combobox.press('ArrowDown').catch(() => {});
      if (await listbox.isVisible()) break;
      await this.page.waitForTimeout(250);
    }
    await expect(listbox).toBeVisible({ timeout: 30_000 });

    const option = listbox.getByRole('option', { name: contextName, exact: true });
    await expect(option).toBeVisible({ timeout: 30_000 });
    await option.click();

    await expect(root).toContainText(contextName);
  }

  async selectNamespace(namespace: string) {
    const root = this.page.locator('#namespace-root, #sidebar').first();
    await expect(root).toBeVisible({ timeout: 60_000 });
    await root.scrollIntoViewIfNeeded();

    if (await root.isVisible() && (await root.innerText()).includes(namespace)) {
      return;
    }

    const listbox = this.page.locator('#react-select-namespace-multi-listbox');
    const namespaceInput = this.page.locator('#react-select-namespace-multi-input').first();
    const rootCombo = this.page.locator('#namespace-root [role="combobox"]').first();
    const sidebarNamespaceCombo = this.page.locator('#sidebar [role="combobox"]').nth(1);

    let combobox = namespaceInput;
    if (!(await combobox.isVisible().catch(() => false))) {
      combobox = rootCombo;
    }
    if (!(await combobox.isVisible().catch(() => false))) {
      combobox = sidebarNamespaceCombo;
    }

    // Keep trying until the namespace appears (namespaces list can lag in CI).
    const selectionTimeoutMs = process.env.CI ? 90_000 : 30_000;
    const deadline = Date.now() + selectionTimeoutMs;
    while (Date.now() < deadline) {
      await root.click({ force: true });
      if (!(await listbox.isVisible())) {
        await combobox.press('ArrowDown').catch(() => {});
      }

      if (await listbox.isVisible()) {
        // Type-ahead nudges react-select to refresh visible options in some race windows.
        await combobox.fill(namespace).catch(() => {});
        const option = listbox.getByRole('option', { name: namespace, exact: true });
        if (await option.isVisible().catch(() => false)) {
          await option.click();
          await expect(root).toContainText(namespace, { timeout: 30_000 });
          break;
        }
      }

      // Close menu + backoff a bit before retry.
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(500);
    }

    await expect(root).toContainText(namespace, { timeout: 30_000 });

    // Close menu by clicking outside
    await this.page.locator('#sidebar').click({ position: { x: 10, y: 10 } });
  }

  async goToSection(key: string) {
    const overlay = this.page.locator('[data-testid="create-manifest-overlay"]').first();
    if (await overlay.isVisible().catch(() => false)) {
      const closeBtn = overlay.getByRole('button', { name: /close|cancel/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => undefined);
      } else {
        await this.page.keyboard.press('Escape').catch(() => undefined);
      }
      await overlay.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
    }

    await this.ensureSectionVisible(key);

    await this.clickSectionWithRetry(`#section-${key}`, key);
  }

  async goToRbacSection(key: 'roles' | 'clusterroles' | 'rolebindings' | 'clusterrolebindings') {
    const overlay = this.page.locator('[data-testid="create-manifest-overlay"]').first();
    if (await overlay.isVisible().catch(() => false)) {
      const closeBtn = overlay.getByRole('button', { name: /close|cancel/i }).first();
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click().catch(() => undefined);
      } else {
        await this.page.keyboard.press('Escape').catch(() => undefined);
      }
      await overlay.waitFor({ state: 'hidden', timeout: 10_000 }).catch(() => undefined);
    }

    const group = this.page.locator('#section-rbac');
    await expect(group).toBeVisible({ timeout: 30_000 });
    await group.scrollIntoViewIfNeeded();

    const expanded = await group.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await group.click({ timeout: 30_000 });
    }

    await this.ensureSectionVisible(key);

    await this.clickSectionWithRetry(`#section-${key}`, key);
  }
}
