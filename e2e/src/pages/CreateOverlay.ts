import { expect, type Page } from '@playwright/test';

export class CreateOverlay {
  constructor(private readonly page: Page) {}

  /**
   * Opens the create overlay from the overview header.
   * @param resourceType - Optional. If provided and a dropdown menu appears, clicks this resource type.
   *   For example: 'Pod', 'Deployment', 'Job', etc.
   */
  async openFromOverviewHeader(resourceType?: string) {
    // Different sections expose different create buttons:
    // - Most resources: "Create new"
    // - Pods: a "+" button with aria-label "Create" and class "overview-create-btn"
    //   which opens a dropdown menu where you select the resource type
    // Prefer a short, retrying strategy instead of relying on a single locator.
    const clickTimeoutMs = 10_000;
    const attempts: Array<() => Promise<void>> = [
      async () => {
        const btn = this.page.getByRole('button', { name: /create new/i }).first();
        await btn.waitFor({ state: 'visible', timeout: clickTimeoutMs });
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ timeout: clickTimeoutMs });
      },
      async () => {
        const btn = this.page.getByRole('button', { name: /^create$/i }).first();
        await btn.waitFor({ state: 'visible', timeout: clickTimeoutMs });
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ timeout: clickTimeoutMs });
      },
      async () => {
        const btn = this.page.locator('.overview-create-btn').first();
        await btn.waitFor({ state: 'visible', timeout: clickTimeoutMs });
        await btn.scrollIntoViewIfNeeded();
        await btn.click({ timeout: clickTimeoutMs });
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

    // Check if a dropdown menu appeared (Pods page has a menu with resource types)
    const menuContent = this.page.locator('.menu-content');
    const closeBtn = this.page.getByRole('button', { name: 'Close' });
    
    // Wait briefly to see if either the menu or the overlay appears
    const menuVisible = await menuContent.isVisible().catch(() => false);
    
    if (menuVisible && resourceType) {
      // Click the resource type in the dropdown menu
      await this.page.locator('.menu-content').getByText(resourceType, { exact: true }).click();
    }

    await expect(closeBtn).toBeVisible({ timeout: clickTimeoutMs });
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
    // There may be multiple Create buttons on page - target the one within the overlay
    // The overlay's create button has class 'overlay-create-btn' (from resource-overlay.js)
    // or is the button with name "Create" inside the overlay content container
    const overlayCreateBtn = this.page.locator('.overlay-create-btn');
    const reactOverlayCreateBtn = this.page.locator('.overlay-content, [style*="fixed"]').getByRole('button', { name: /^create$/i });
    
    if (await overlayCreateBtn.isVisible()) {
      await overlayCreateBtn.click();
    } else if (await reactOverlayCreateBtn.isVisible()) {
      await reactOverlayCreateBtn.click();
    } else {
      // Fallback: try clicking the last Create button (usually in overlay)
      await this.page.getByRole('button', { name: /^create$/i }).last().click();
    }

    // Overlay closes on success; on failure it shows an inline error.
    // Errors can be: YAML parse errors, REST mapping errors (connectivity), or other API errors.
    const closeBtn = this.page.getByRole('button', { name: 'Close' });
    const parseError = this.page.getByText(/YAML parse error/i).first();
    // API/connectivity errors often contain "could not find REST mapping" or "dial tcp" or "connectex"
    const apiError = this.page.getByText(/could not find REST mapping|dial tcp|connectex/i).first();

    await Promise.race([
      closeBtn.waitFor({ state: 'hidden', timeout: 60_000 }),
      parseError.waitFor({ state: 'visible', timeout: 60_000 }),
      apiError.waitFor({ state: 'visible', timeout: 60_000 }),
    ]);

    if (await closeBtn.isVisible()) {
      // Try to extract the error message from either error locator
      let msg = (await parseError.textContent())?.trim();
      if (!msg) {
        msg = (await apiError.textContent())?.trim();
      }
      throw new Error(`Create failed: ${msg || 'Unknown error'}`);
    }
  }
}
