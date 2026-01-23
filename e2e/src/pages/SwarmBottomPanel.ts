import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Page object for Swarm resource bottom panels (details, logs, tasks, etc.).
 */
export class SwarmBottomPanel {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    // Swarm bottom panel shares the same structure as k8s panels
    this.root = page.locator('.bottom-panel').filter({ 
      has: page.getByRole('button', { name: 'Summary', exact: true }) 
    });
  }

  tab(label: string): Locator {
    // BottomPanel renders a fixed structure:
    // 0: resize handle
    // 1: tabs header (contains tab buttons on the left, headerRight actions + close on the right)
    // 2: content
    // We must target the left tab strip to avoid matching headerRight buttons
    // that can share the same accessible name (e.g. an "Exec" action button).
    const header = this.root.locator('> div').nth(1);
    const tabStrip = header.locator('> div').first();
    return tabStrip.getByRole('button', { name: label, exact: true });
  }

  async expectVisible() {
    await expect(this.root).toBeVisible({ timeout: 30_000 });
  }

  async expectHidden() {
    await expect(this.root).toBeHidden({ timeout: 30_000 });
  }

  async expectTabs(labels: string[]) {
    for (const label of labels) {
      await expect(this.tab(label)).toBeVisible();
    }
  }

  async clickTab(label: string) {
    await this.tab(label).click();
  }

  async expectNoErrorText() {
    await expect(this.root).not.toContainText('Error:');
  }

  async expectCodeMirrorVisible() {
    await expect(this.root.locator('.cm-editor')).toBeVisible();
  }

  async closeByClickingOutside() {
    await this.page.locator('#maincontent').click({ position: { x: 5, y: 5 } });
    await this.expectHidden();
  }

  /**
   * Close the panel if it's currently visible. Does nothing if already closed.
   */
  async closeIfOpen() {
    const isVisible = await this.root.isVisible().catch(() => false);
    if (isVisible) {
      await this.page.locator('#maincontent').click({ position: { x: 5, y: 5 } });
      await this.expectHidden();
    }
  }

  /**
   * Ensure panel is closed before proceeding. Use in beforeEach to clean up state.
   */
  static async ensureClosed(page: Page) {
    // Close any visible bottom panels
    const anyPanel = page.locator('.bottom-panel');
    const isPanelVisible = await anyPanel.first().isVisible().catch(() => false);
    if (isPanelVisible) {
      await page.locator('#maincontent').click({ position: { x: 5, y: 5 } });
      await expect(anyPanel.first()).toBeHidden({ timeout: 10_000 }).catch(() => {});
    }

    // Close any popup overlays (like Image Updates popup)
    // Try pressing Escape to close any open modals/popups
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);
    
    // Look for common close buttons and click them
    const closeButtons = [
      page.getByRole('button', { name: 'Close' }),
      page.locator('[aria-label="Close"]'),
      page.locator('.modal-close, .popup-close'),
    ];
    
    for (const btn of closeButtons) {
      const isVisible = await btn.first().isVisible().catch(() => false);
      if (isVisible) {
        await btn.first().click().catch(() => {});
        await page.waitForTimeout(100);
      }
    }
    
    // Press Escape again to be sure
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(200);
  }

  /**
   * Get the resource name from the panel header.
   */
  async getResourceName(): Promise<string> {
    const header = this.root.locator('.summary-tab-header-name, [data-testid="resource-name"]').first();
    const text = await header.textContent();
    return text || '';
  }

  /**
   * Check if the panel has logs content.
   */
  async expectLogsVisible() {
    const logsContent = this.root.locator('.logs-container, .cm-editor, pre');
    await expect(logsContent.first()).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Wait for tasks tab content to load.
   */
  async expectTasksVisible() {
    const tasksContent = this.root.locator('table, [data-testid="tasks-list"]');
    await expect(tasksContent.first()).toBeVisible({ timeout: 10_000 });
  }

  /**
   * Click scale button (for services).
   */
  async clickScale() {
    const scaleBtn = this.root.getByRole('button', { name: /scale/i });
    await expect(scaleBtn).toBeVisible();
    await scaleBtn.click();
  }

  /**
   * Click restart button.
   */
  async clickRestart() {
    const restartBtn = this.root.getByRole('button', { name: /restart/i });
    await expect(restartBtn).toBeVisible();
    await restartBtn.click();
  }

  /**
   * Click delete button.
   */
  async clickDelete() {
    const deleteBtn = this.root.getByRole('button', { name: /delete|remove/i });
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();
  }
}

/**
 * Page object for the scale dialog that appears when scaling a service.
 */
export class SwarmScaleDialog {
  constructor(private readonly page: Page) {}

  private get heading() {
    // Swarm scale UI is a custom modal overlay without role="dialog".
    return this.page.getByRole('heading', { name: /^Scale\s+service:/i });
  }

  private get dialog() {
    // The h3 lives inside the modal content container.
    return this.heading.locator('..');
  }

  async expectVisible() {
    await expect(this.heading).toBeVisible({ timeout: 10_000 });
  }

  async expectHidden() {
    await expect(this.heading).toBeHidden({ timeout: 10_000 });
  }

  async fillReplicasRaw(value: string) {
    const input = this.dialog.locator('input[type="number"]');
    await input.fill(value);
  }

  async setReplicas(count: number) {
    const input = this.dialog.locator('input[type="number"]');
    await input.fill(String(count));
  }

  async submit() {
    const confirmBtn = this.dialog.getByRole('button', { name: /^scale/i });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();
  }

  async confirm() {
    await this.submit();
    await this.expectHidden();
  }

  async cancel() {
    const cancelBtn = this.dialog.getByRole('button', { name: /^cancel$/i });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    await this.expectHidden();
  }
}
