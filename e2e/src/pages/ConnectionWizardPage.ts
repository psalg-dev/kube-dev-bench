import { expect, type Page } from '@playwright/test';

export class ConnectionWizardPage {
  constructor(private readonly page: Page) {}

  async openWizardIfHidden() {
    const wizard = this.page.locator('.connection-wizard-overlay');
    if (await wizard.count()) return;
    await this.page.locator('#show-wizard-btn').click();
    await expect(this.page.locator('.connection-wizard-overlay')).toBeVisible();
  }

  async ensureWizardVisible() {
    await expect(this.page.locator('.connection-wizard-overlay')).toBeVisible();
  }

  async pastePrimaryKubeconfigAndContinue(kubeconfigYaml: string) {
    await this.ensureWizardVisible();

    // First-time flow (no configs discovered)
    const textarea = this.page.locator('#primaryConfigContent');
    if (await textarea.count()) {
      await textarea.fill(kubeconfigYaml);
      await this.page.getByRole('button', { name: /save & continue/i }).click();
      await expect(this.page.locator('.connection-wizard-overlay')).toBeHidden({ timeout: 60_000 });
      return;
    }

    // If configs exist, just click complete
    await this.page.getByRole('button', { name: /continue|connect|complete/i }).first().click();
    await expect(this.page.locator('.connection-wizard-overlay')).toBeHidden({ timeout: 60_000 });
  }
}
