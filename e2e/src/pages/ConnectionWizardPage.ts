import { expect, type Page } from '@playwright/test';

export class ConnectionWizardPage {
  constructor(private readonly page: Page) {}

  /**
   * Check if the connection wizard layout is visible
   * The new wizard uses AppLayout-style structure with #layout.connection-wizard-layout
   */
  private async isNewWizardVisible(): Promise<boolean> {
    const newWizard = this.page.locator('.connection-wizard-layout').first();
    return await newWizard.isVisible().catch(() => false);
  }

  /**
   * Check if the legacy overlay wizard is visible
   */
  private async isLegacyWizardVisible(): Promise<boolean> {
    const legacyWizard = this.page.locator('.connection-wizard-overlay').first();
    return await legacyWizard.isVisible().catch(() => false);
  }

  async openWizardIfHidden() {
    // Check for new layout or legacy overlay
    if (await this.isNewWizardVisible() || await this.isLegacyWizardVisible()) {
      return;
    }
    const openBtn = this.page.locator('#show-wizard-btn');
    await expect(openBtn).toBeVisible({ timeout: 30_000 });
    await openBtn.click({ timeout: 30_000 });
    // Wait for either new or legacy wizard
    await expect(
      this.page.locator('.connection-wizard-layout, .connection-wizard-overlay').first()
    ).toBeVisible({ timeout: 30_000 });
  }

  async ensureWizardVisible() {
    await expect(
      this.page.locator('.connection-wizard-layout, .connection-wizard-overlay').first()
    ).toBeVisible({ timeout: 30_000 });
  }

  async pastePrimaryKubeconfigAndContinue(kubeconfigYaml: string) {
    // Wait for wizard to be ready
    await this.page.waitForTimeout(500);

    // Check which wizard type we have
    const isNewWizard = await this.isNewWizardVisible();

    if (isNewWizard) {
      // New wizard flow - check if there are existing configs
      const configItems = this.page.locator('.config-item');
      const hasConfigs = (await configItems.count()) > 0;

      if (hasConfigs) {
        // Click the first config item to select it
        await configItems.first().click();
        // Click the Connect button on that item
        const connectBtn = this.page.getByRole('button', { name: /connect/i }).first();
        await expect(connectBtn).toBeVisible({ timeout: 10_000 });
        await connectBtn.click();
        // Wait for the wizard to close (main app should now be visible)
        await expect(this.page.locator('#kubecontext-root')).toBeVisible({ timeout: 60_000 });
        return;
      }

      // No configs - need to add one
      // Click the "Add Config" button to open the overlay
      const addBtn = this.page.locator('#add-kubeconfig-btn');
      if (await addBtn.count()) {
        await addBtn.click();
        await this.page.waitForTimeout(300);
      }

      // Fill in the kubeconfig content
      const textareaSelector = '#primaryConfigContent';
      const textarea = this.page.locator(textareaSelector);

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

      // Click Save & Continue
      const saveBtn = this.page.getByRole('button', { name: /save & continue/i });
      await expect(saveBtn).toBeEnabled({ timeout: 60_000 });
      await saveBtn.click();

      // Wait for the overlay to close and configs to load
      await this.page.waitForTimeout(1000);

      // Now click Connect on the newly added config
      const newConfigItems = this.page.locator('.config-item');
      if ((await newConfigItems.count()) > 0) {
        await newConfigItems.first().click();
        const connectBtn = this.page.getByRole('button', { name: /connect/i }).first();
        await expect(connectBtn).toBeVisible({ timeout: 10_000 });
        await connectBtn.click();
      }

      // Wait for the main app to be visible
      await expect(this.page.locator('#kubecontext-root')).toBeVisible({ timeout: 60_000 });
      return;
    }

    // Legacy wizard flow
    await this.ensureWizardVisible();

    const textareaSelector = '#primaryConfigContent';
    const textarea = this.page.locator(textareaSelector);
    if (await textarea.count()) {
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
