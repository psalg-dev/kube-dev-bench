import { expect, type Page } from '@playwright/test';

export class Notifications {
  constructor(private readonly page: Page) {}

  private asTextMatcher(text: string | RegExp): string | RegExp {
    return text;
  }

  async waitForClear(opts: { timeoutMs?: number } = {}) {
    const timeoutMs = opts.timeoutMs ?? 20_000;
    // Wait for all notifications to disappear, accounting for their auto-dismiss time (3s) + animation
    try {
      await expect(this.page.locator('#gh-notification-container .gh-notification')).toHaveCount(0, { timeout: timeoutMs });
    } catch {
      const closeButtons = this.page.locator('#gh-notification-container .gh-notification__close');
      const closeCount = await closeButtons.count();
      for (let i = 0; i < closeCount; i++) {
        await closeButtons.nth(i).click({ timeout: 2000 }).catch(() => undefined);
      }
      await expect(this.page.locator('#gh-notification-container .gh-notification')).toHaveCount(0, { timeout: 10_000 });
    }
    // Add a small stabilization wait to ensure UI has settled
    await this.page.waitForTimeout(500);
  }

  async expectSuccessContains(text: string | RegExp, opts: { timeoutMs?: number } = {}) {
    const timeoutMs = opts.timeoutMs ?? 60_000;
    const msg = this.page
      .locator('.gh-notification--success .gh-notification__text')
      .filter({ hasText: this.asTextMatcher(text) })
      .first();
    await expect(msg).toBeVisible({ timeout: timeoutMs });
  }

  async expectErrorContains(text: string | RegExp, opts: { timeoutMs?: number } = {}) {
    const timeoutMs = opts.timeoutMs ?? 60_000;
    const msg = this.page
      .locator('.gh-notification--error .gh-notification__text')
      .filter({ hasText: this.asTextMatcher(text) })
      .first();
    await expect(msg).toBeVisible({ timeout: timeoutMs });
  }

  notificationText(text: string | RegExp) {
    return this.page.locator('.gh-notification__text').filter({ hasText: this.asTextMatcher(text) }).first();
  }
}
