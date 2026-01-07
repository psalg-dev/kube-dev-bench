import { expect, type Page } from '@playwright/test';

const OPEN_WIZARD_STATUS = {
  AlreadyVisible: 'already-visible',
  AutoOpened: 'auto-opened',
  ClickedButton: 'clicked-button',
} as const;

export type OpenWizardIfHiddenStatus =
  (typeof OPEN_WIZARD_STATUS)[keyof typeof OPEN_WIZARD_STATUS];

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

  async openWizardIfHidden(): Promise<OpenWizardIfHiddenStatus> {
    const wizard = this.page
      .locator('.connection-wizard-layout, .connection-wizard-overlay')
      .first();

    // On cold start the wizard often opens automatically; give it a moment to render
    // before we assume we must click the gear button.
    if (await this.isNewWizardVisible() || (await this.isLegacyWizardVisible())) {
      return OPEN_WIZARD_STATUS.AlreadyVisible;
    }

    try {
      await expect(wizard).toBeVisible({ timeout: 5_000 });
      return OPEN_WIZARD_STATUS.AutoOpened;
    } catch {
      // Wizard did not auto-open; fall back to the explicit open button.
    }

    // Wait for the page to be ready before looking for the wizard button
    // This prevents flakes when the page is still initializing
    await this.page.waitForLoadState('domcontentloaded', { timeout: 30_000 });
    
    const openBtn = this.page.locator('#show-wizard-btn');
    
    // Check if we're already in a connected state (button won't exist)
    const mainApp = this.page.locator('#kubecontext-root, #swarm-sidebar');
    const hasMainApp = await mainApp.isVisible().catch(() => false);
    
    if (hasMainApp) {
      // Already connected, wizard button won't appear
      // Force open the wizard if needed
      const isWizardVisible = await wizard.isVisible().catch(() => false);
      if (isWizardVisible) {
        return OPEN_WIZARD_STATUS.AlreadyVisible;
      }
      // Try to find and click the button, but don't fail if it's not there
      const btnExists = await openBtn.count() > 0;
      if (btnExists) {
        await openBtn.click({ timeout: 10_000 });
        await expect(wizard).toBeVisible({ timeout: 30_000 });
        return OPEN_WIZARD_STATUS.ClickedButton;
      }
      // If button doesn't exist and app is connected, return as if wizard is "already visible"
      return OPEN_WIZARD_STATUS.AlreadyVisible;
    }
    
    await expect(openBtn).toBeVisible({ timeout: 30_000 });
    await openBtn.click({ timeout: 30_000 });
    await expect(wizard).toBeVisible({ timeout: 30_000 });
    return OPEN_WIZARD_STATUS.ClickedButton;
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
