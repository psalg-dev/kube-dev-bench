import { expect, type Page } from '@playwright/test';

export class Notifications {
  constructor(private readonly page: Page) {}

  private asTextMatcher(text: string | RegExp): string | RegExp {
    return text;
  }

  async waitForClear(opts: { timeoutMs?: number } = {}) {
    const timeoutMs = opts.timeoutMs ?? 10_000;
    await expect(this.page.locator('#gh-notification-container .gh-notification')).toHaveCount(0, { timeout: timeoutMs });
  }

  async expectSuccessContains(text: string | RegExp) {
    const msg = this.page
      .locator('.gh-notification--success .gh-notification__text')
      .filter({ hasText: this.asTextMatcher(text) })
      .first();
    await expect(msg).toBeVisible({ timeout: 60_000 });
  }

  async expectErrorContains(text: string | RegExp) {
    const msg = this.page
      .locator('.gh-notification--error .gh-notification__text')
      .filter({ hasText: this.asTextMatcher(text) })
      .first();
    await expect(msg).toBeVisible({ timeout: 60_000 });
  }

  notificationText(text: string | RegExp) {
    return this.page.locator('.gh-notification__text').filter({ hasText: this.asTextMatcher(text) }).first();
  }
}
