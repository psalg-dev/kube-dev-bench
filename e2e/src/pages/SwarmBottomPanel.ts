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
    return this.root.getByRole('button', { name: label, exact: true });
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

  private get dialog() {
    return this.page.locator('.scale-dialog, [data-testid="scale-dialog"], [role="dialog"]');
  }

  async expectVisible() {
    await expect(this.dialog).toBeVisible({ timeout: 10_000 });
  }

  async expectHidden() {
    await expect(this.dialog).toBeHidden({ timeout: 10_000 });
  }

  async setReplicas(count: number) {
    const input = this.dialog.locator('input[type="number"]');
    await input.fill(String(count));
  }

  async confirm() {
    const confirmBtn = this.dialog.getByRole('button', { name: /confirm|scale|ok/i });
    await confirmBtn.click();
    await this.expectHidden();
  }

  async cancel() {
    const cancelBtn = this.dialog.getByRole('button', { name: /cancel/i });
    await cancelBtn.click();
    await this.expectHidden();
  }
}
