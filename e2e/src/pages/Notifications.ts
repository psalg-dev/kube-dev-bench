import { expect, type Page } from '@playwright/test';

export class Notifications {
  constructor(private readonly page: Page) {}

  async expectSuccessContains(text: string) {
    const msg = this.page
      .locator('.gh-notification--success .gh-notification__text')
      .filter({ hasText: text })
      .first();
    await expect(msg).toBeVisible({ timeout: 60_000 });
  }
}
