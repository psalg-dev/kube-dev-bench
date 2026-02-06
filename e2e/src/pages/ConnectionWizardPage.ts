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
      .locator('.connection-wizard-layout, .connection-wizard-overlay, .swarm-connection-wizard-overlay')
      .first();

    if (await this.isNewWizardVisible() || (await this.isLegacyWizardVisible())) {
      return OPEN_WIZARD_STATUS.AlreadyVisible;
    }

    const deadline = Date.now() + 90_000;

    await this.page.waitForLoadState('domcontentloaded', {
      timeout: Math.max(1_000, Math.min(30_000, deadline - Date.now())),
    });

    // The Vite dev server can briefly serve an HTML shell while modules are still loading.
    // Wait for React to mount something under #app, with a one-time reload recovery.
    const appRoot = this.page.locator('#app').first();
    await appRoot.waitFor({ state: 'attached', timeout: Math.max(1_000, deadline - Date.now()) });

    const waitForAppMount = async (timeoutMs: number) => {
      const readySelector =
        '#app > *, .connection-wizard-layout, .connection-wizard-overlay, .swarm-connection-wizard-overlay, #sidebar, #maincontent, #show-wizard-btn, #swarm-show-wizard-btn';
      await this.page
        .locator(readySelector)
        .first()
        .waitFor({ state: 'attached', timeout: Math.max(1_000, timeoutMs) });
    };

    try {
      await waitForAppMount(Math.min(20_000, deadline - Date.now()));
    } catch {
      // Seen in CI traces: transient `net::ERR_NETWORK_CHANGED` or slow Wails startup
      // can leave the page blank. Retry with multiple reloads and increasing backoff.
      const maxReloads = 3;
      let mounted = false;
      for (let i = 1; i <= maxReloads && Date.now() < deadline; i++) {
        console.warn(`[e2e] App did not mount under #app; reload attempt ${i}/${maxReloads}`);
        await this.page.waitForTimeout(1_000 * i); // backoff
        try {
          await this.page.reload({ waitUntil: 'domcontentloaded' });
        } catch {
          await this.page.goto('/', { waitUntil: 'domcontentloaded' }).catch(() => undefined);
        }
        try {
          await waitForAppMount(Math.min(20_000, deadline - Date.now()));
          mounted = true;
          break;
        } catch {
          if (i === maxReloads) throw new Error('App failed to mount after multiple reload attempts');
        }
      }
    }

    const openBtn = this.page.locator('#show-wizard-btn');
    const swarmOpenBtn = this.page.locator('#swarm-show-wizard-btn');
    const mainApp = this.page.locator('#kubecontext-root, #sidebar, #maincontent');

    while (Date.now() < deadline) {
      if (await this.isNewWizardVisible() || (await this.isLegacyWizardVisible())) {
        return OPEN_WIZARD_STATUS.AutoOpened;
      }

      if (await openBtn.isVisible().catch(() => false)) {
        await openBtn.click({ timeout: 10_000 });
        await expect(wizard).toBeVisible({ timeout: 30_000 });
        return OPEN_WIZARD_STATUS.ClickedButton;
      }

      if (await swarmOpenBtn.isVisible().catch(() => false)) {
        await swarmOpenBtn.click({ timeout: 10_000 });
        await expect(wizard).toBeVisible({ timeout: 30_000 });
        return OPEN_WIZARD_STATUS.ClickedButton;
      }

      if (await mainApp.isVisible().catch(() => false)) {
        const wizVisible = await wizard.isVisible().catch(() => false);
        if (wizVisible) return OPEN_WIZARD_STATUS.AlreadyVisible;
      }

      await this.page.waitForTimeout(250);
    }

    // Final attempt: if wizard is now visible, treat as auto-opened.
    if (await wizard.isVisible().catch(() => false)) {
      return OPEN_WIZARD_STATUS.AutoOpened;
    }

    // If the main app is already visible but the open buttons are missing,
    // assume we are already connected and allow the flow to continue.
    if (await mainApp.isVisible().catch(() => false)) {
      return OPEN_WIZARD_STATUS.AlreadyVisible;
    }

    // If we reach here, neither wizard nor open buttons appeared in time.
    const btnCounts = {
      showWizard: await openBtn.count().catch(() => 0),
      swarmShowWizard: await swarmOpenBtn.count().catch(() => 0),
    };
    throw new Error(
      `Connection wizard not available: buttons missing (showWizard=${btnCounts.showWizard}, swarmShowWizard=${btnCounts.swarmShowWizard}) and wizard not visible.`
    );
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
