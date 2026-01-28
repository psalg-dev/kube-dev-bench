import { expect, type Locator, type Page } from '@playwright/test';

export class BottomPanel {
  readonly page: Page;
  readonly root: Locator;

  constructor(page: Page) {
    this.page = page;
    // NOTE: There are multiple panels using `.bottom-panel` (e.g. the monitor panel).
    // The resource details panel always has a "Summary" tab button.
    this.root = page.locator('.bottom-panel').filter({ has: page.getByRole('button', { name: 'Summary', exact: true }) });
  }

  tab(label: string): Locator {
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const name = new RegExp(`^${escaped}(\\s*(\\(?\\d+\\)?|\\.\\.\\.)(\\s*items?)?)?$`, 'i');
    return this.root.getByRole('button', { name });
  }

  tabWithCount(label: string): Locator {
    // Match tabs with count badges like "Events 3" or "Pods 0"
    const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return this.root.locator('.tab-label').filter({ hasText: new RegExp(`^${escaped}`, 'i') }).locator('.tab-count');
  }

  tabLabel(label: string): Locator {
    // Get the TabLabel component for a specific tab
    return this.root.locator(`.tab-label`).filter({ hasText: new RegExp(`^${label}`) });
  }

  async expectVisible(timeoutMs: number = 10_000) {
    await expect(this.root).toBeVisible({ timeout: timeoutMs });
  }

  async expectHidden(timeoutMs: number = 10_000) {
    await expect(this.root).toBeHidden({ timeout: timeoutMs });
  }

  async expectTabs(labels: string[]) {
    for (const label of labels) {
      await expect(this.tab(label)).toBeVisible();
    }
  }

  async expectTabWithCount(label: string, count: number) {
    // Expects a tab with a specific count badge, e.g. "Events 3"
    const tabCount = this.tabWithCount(label);
    await expect(tabCount).toHaveText(new RegExp(`^${count}$`));
  }

  async expectTabMuted(label: string) {
    // Expects a tab to have muted styling (for empty tabs)
    const tabLabel = this.tabLabel(label);
    await expect(tabLabel).toHaveClass(/tab-label--muted/);
  }

  async expectTabNotMuted(label: string) {
    // Expects a tab to not have muted styling
    const tabLabel = this.tabLabel(label);
    await expect(tabLabel).not.toHaveClass(/tab-label--muted/);
  }

  async expectEmptyTabContent(tab: string) {
    // Click the tab and verify empty state is shown
    await this.clickTab(tab);
    const emptyContent = this.root.locator('.empty-tab-content');
    await expect(emptyContent).toBeVisible();
  }

  async expectEmptyTabContentWithMessage(tab: string, message: string) {
    // Click the tab and verify empty state with specific message
    await this.clickTab(tab);
    const emptyContent = this.root.locator('.empty-tab-content');
    await expect(emptyContent).toBeVisible();
    await expect(emptyContent).toContainText(message);
  }

  async clickTab(label: string) {
    const tab = this.tab(label);
    await expect(tab).toBeVisible({ timeout: 10_000 });
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await tab.click({ timeout: 5_000 });
        return;
      } catch (err) {
        if (attempt === 2) throw err;
        await this.page.waitForTimeout(250);
      }
    }
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
}
