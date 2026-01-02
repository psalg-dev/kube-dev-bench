import { expect, type Page } from '@playwright/test';

export class CreateOverlay {
  constructor(private readonly page: Page) {}

  async openFromOverviewHeader() {
    await this.page.getByRole('button', { name: /create new/i }).click();
    await expect(this.page.getByRole('button', { name: 'Close' })).toBeVisible();
  }

  async fillYaml(yaml: string) {
    const editor = this.page.locator('.cm-content').first();
    await expect(editor).toBeVisible();
    await editor.click();

    // Replace all content
    const isMac = process.platform === 'darwin';
    await this.page.keyboard.press(isMac ? 'Meta+A' : 'Control+A');
    await this.page.keyboard.type(yaml, { delay: 0 });
  }

  async create() {
    await this.page.getByRole('button', { name: /^create$/i }).click();
    // Overlay closes on success; error toast otherwise
    await expect(this.page.getByRole('button', { name: 'Close' })).toBeHidden({ timeout: 60_000 });
  }
}
