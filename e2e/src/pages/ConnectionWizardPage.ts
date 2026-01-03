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
    const textareaSelector = '#primaryConfigContent';
    const textarea = this.page.locator(textareaSelector);
    if (await textarea.count()) {
      // The wizard can re-render while the test is interacting with it (e.g. async
      // connection status updates), which may detach/replace the textarea. Add a
      // small retry loop to make this step resilient.
      let filled = false;
      for (let attempt = 0; attempt < 5; attempt++) {
        try {
          const ta = this.page.locator(textareaSelector);
          await expect(ta).toBeVisible({ timeout: 10_000 });
          await expect(ta).toBeEditable({ timeout: 10_000 });
          await ta.click({ timeout: 10_000 });
          await ta.fill(kubeconfigYaml, { timeout: 10_000 });
          filled = true;
          break;
        } catch (err) {
          if (attempt === 4) throw err;
          await this.page.waitForTimeout(250);
        }
      }

      if (!filled) {
        throw new Error('Failed to fill primary kubeconfig textarea after retries');
      }

      const saveBtn = this.page.getByRole('button', { name: /save & continue/i });
      await expect(saveBtn).toBeEnabled({ timeout: 60_000 });
      await saveBtn.click();
      await expect(this.page.locator('.connection-wizard-overlay')).toBeHidden({ timeout: 60_000 });
      return;
    }

    // If configs exist, just click complete
    await this.page.getByRole('button', { name: /continue|connect|complete/i }).first().click();
    await expect(this.page.locator('.connection-wizard-overlay')).toBeHidden({ timeout: 60_000 });
  }
}
