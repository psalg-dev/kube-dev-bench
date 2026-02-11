import { expect, type Page } from '@playwright/test';

export class SidebarPage {
  constructor(private readonly page: Page) {}

  async selectContext(contextName: string) {
    const root = this.page.locator('#kubecontext-root');
    await expect(root).toBeVisible({ timeout: 60_000 });
    await root.scrollIntoViewIfNeeded();

    // If already selected, don't churn the menu (helps in parallel runs).
    if (await root.isVisible() && (await root.innerText()).includes(contextName)) {
      return;
    }

    const listbox = this.page.locator('#react-select-context-select-listbox');
    const combobox = root.getByRole('combobox');

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
    const root = this.page.locator('#namespace-root');
    await expect(root).toBeVisible({ timeout: 60_000 });
    await root.scrollIntoViewIfNeeded();

    if (await root.isVisible() && (await root.innerText()).includes(namespace)) {
      return;
    }

    const listbox = this.page.locator('#react-select-namespace-multi-listbox');
    const combobox = root.getByRole('combobox');

    // Keep trying until the namespace appears (namespaces list can lag a bit).
    const deadline = Date.now() + 20_000;
    while (Date.now() < deadline) {
      await root.click({ force: true });
      if (!(await listbox.isVisible())) {
        await combobox.press('ArrowDown').catch(() => {});
      }

      if (await listbox.isVisible()) {
        const option = listbox.getByRole('option', { name: namespace, exact: true });
        if (await option.isVisible().catch(() => false)) {
          await option.click();
          await expect(root).toContainText(namespace);
          break;
        }
      }

      // Close menu + backoff a bit before retry.
      await this.page.keyboard.press('Escape').catch(() => {});
      await this.page.waitForTimeout(500);
    }

    await expect(root).toContainText(namespace);

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

    const section = this.page.locator(`#section-${key}`);
    // Wait for the section to exist
    await expect(section).toBeVisible({ timeout: 30_000 });
    await section.scrollIntoViewIfNeeded();

    // Use Playwright's click so it will auto-retry if the element is briefly
    // detached/covered during React updates (common under parallel load).
    await section.click({ timeout: 30_000 });

    // Confirm the sidebar selection state changed before test assertions
    // check the main view title.
    await expect(section).toHaveClass(/\bselected\b/, { timeout: 30_000 });
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

    const section = this.page.locator(`#section-${key}`);
    await expect(section).toBeVisible({ timeout: 30_000 });
    await section.scrollIntoViewIfNeeded();
    await section.click({ timeout: 30_000 });
    await expect(section).toHaveClass(/\bselected\b/, { timeout: 30_000 });
  }
}
