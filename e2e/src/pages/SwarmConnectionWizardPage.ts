import { expect, type Page } from '@playwright/test';

/**
 * Page object for the Docker Swarm connection wizard.
 */
export class SwarmConnectionWizardPage {
  constructor(private readonly page: Page) {}

  private get wizard() {
    return this.page.locator('.swarm-connection-wizard-overlay');
  }

  async isVisible(): Promise<boolean> {
    return this.wizard.isVisible();
  }

  async ensureWizardVisible() {
    await expect(this.wizard).toBeVisible({ timeout: 30_000 });
  }

  async ensureWizardHidden() {
    await expect(this.wizard).toBeHidden({ timeout: 30_000 });
  }

  /**
   * Open the Swarm connection wizard from the sidebar gear button.
   */
  async openFromSidebarGear() {
    const gearBtn = this.page.locator('#swarm-show-wizard-btn');
    await expect(gearBtn).toBeVisible({ timeout: 10_000 });
    await gearBtn.click();
    await this.ensureWizardVisible();
  }

  /**
   * Select local socket connection type.
   */
  async selectLocalSocket() {
    await this.ensureWizardVisible();
    await this.wizard.getByText('Local Socket', { exact: true }).click();
  }

  /**
   * Select TCP connection type.
   */
  async selectTcp() {
    await this.ensureWizardVisible();
    await this.wizard.getByText('TCP (Unencrypted)', { exact: true }).click();
  }

  /**
   * Select TLS connection type.
   */
  async selectTls() {
    await this.ensureWizardVisible();
    await this.wizard.getByText('TCP with TLS', { exact: true }).click();
  }

  /**
   * Set the Docker host address.
   */
  async setHost(host: string) {
    await this.ensureWizardVisible();
    const input = this.wizard.locator('input[type="text"]').first();
    await input.fill(host);
  }

  /**
   * Test the connection and wait for result.
   */
  async testConnection() {
    await this.ensureWizardVisible();
    const testBtn = this.wizard.getByRole('button', { name: /test connection/i });
    await testBtn.click();
    // Wait for test to complete (either success or error message appears)
    await this.page.waitForFunction(
      () => {
        const success = document.querySelector('.connection-test-success, [data-testid="test-success"]');
        const error = document.querySelector('.connection-test-error, [data-testid="test-error"]');
        return success || error;
      },
      { timeout: 30_000 }
    ).catch(() => {
      // Some implementations show result inline
    });
  }

  /**
   * Click the Connect button to establish connection.
   */
  async clickConnect() {
    await this.ensureWizardVisible();
    const connectBtn = this.wizard.getByRole('button', { name: /^connect$/i });
    await expect(connectBtn).toBeEnabled({ timeout: 10_000 });
    await connectBtn.click();
  }

  /**
   * Connect to a local Docker socket (simplified flow).
   */
  async connectToLocalDocker() {
    if (!(await this.isVisible().catch(() => false))) {
      await this.openFromSidebarGear();
    } else {
      await this.ensureWizardVisible();
    }

    await this.selectLocalSocket();
    await this.clickConnect();
    await this.ensureWizardHidden();
  }

  /**
   * Skip the wizard without connecting.
   */
  async skip() {
    const skipBtn = this.page.getByRole('button', { name: /skip|cancel|close/i });
    if (await skipBtn.isVisible()) {
      await skipBtn.click();
    } else {
      // Press Escape as fallback
      await this.page.keyboard.press('Escape');
    }
    await this.ensureWizardHidden();
  }

  /**
   * Wait for connected state indicator.
   */
  async expectConnected() {
    // Look for connection status indicator in sidebar
    const indicator = this.page.locator('[data-swarm-connected="true"], .swarm-connected-indicator');
    await expect(indicator).toBeVisible({ timeout: 30_000 });
  }
}
