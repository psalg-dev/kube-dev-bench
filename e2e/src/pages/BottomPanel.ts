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
    return this.root.getByRole('button', { name: label, exact: true });
  }

  async expectVisible() {
    await expect(this.root).toBeVisible();
  }

  async expectHidden() {
    await expect(this.root).toBeHidden();
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
}
