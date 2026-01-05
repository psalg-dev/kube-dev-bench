import { expect, type Page } from '@playwright/test';

export class CreateOverlay {
  constructor(private readonly page: Page) {}

  async openFromOverviewHeader() {
    // Different sections expose different create buttons:
    // - Most resources: "Create new"
    // - Pods: a "+" button with aria-label "Create" and class "overview-create-btn"
    // Prefer a short, retrying strategy instead of relying on a single locator.
    const attempts: Array<() => Promise<void>> = [
      async () => {
        await this.page.getByRole('button', { name: /create new/i }).first().click({ timeout: 2_500 });
      },
      async () => {
        await this.page.getByRole('button', { name: /^create$/i }).first().click({ timeout: 2_500 });
      },
      async () => {
        await this.page.locator('.overview-create-btn').first().click({ timeout: 2_500 });
      },
    ];

    let lastErr: unknown;
    for (const fn of attempts) {
      try {
        await fn();
        lastErr = null;
        break;
      } catch (e) {
        lastErr = e;
      }
    }
    if (lastErr) {
      throw lastErr;
    }

    await expect(this.page.getByRole('button', { name: 'Close' })).toBeVisible();
  }

  async fillYaml(yaml: string) {
    const editor = this.page.locator('.cm-content').first();
    await expect(editor).toBeVisible();
    await editor.click();

    // Replace all content
    const isMac = process.platform === 'darwin';
    await this.page.keyboard.press(isMac ? 'Meta+A' : 'Control+A');

    // insertText is more reliable than typing key-by-key for multiline YAML
    await this.page.keyboard.insertText(yaml);
  }

  async create() {
    await this.page.getByRole('button', { name: /^create$/i }).click();

    // Overlay closes on success; on failure it shows an inline error (e.g. YAML parse error).
    const closeBtn = this.page.getByRole('button', { name: 'Close' });
    const parseError = this.page.getByText(/YAML parse error/i).first();

    await Promise.race([
      closeBtn.waitFor({ state: 'hidden', timeout: 60_000 }),
      parseError.waitFor({ state: 'visible', timeout: 60_000 }),
    ]);

    if (await closeBtn.isVisible()) {
      const msg = (await parseError.textContent())?.trim() || 'Unknown error';
      throw new Error(`Create failed: ${msg}`);
    }
  }
}
