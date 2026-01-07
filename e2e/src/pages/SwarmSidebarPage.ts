import { expect, type Page } from '@playwright/test';

/**
 * Page object for the Docker Swarm sidebar navigation.
 */
export class SwarmSidebarPage {
  constructor(private readonly page: Page) {}

  private get sidebar() {
    return this.page.locator('#swarm-sidebar, [data-testid="swarm-sidebar"]');
  }

  async expectVisible() {
    await expect(this.sidebar).toBeVisible({ timeout: 30_000 });
  }

  /**
   * Navigate to a Swarm resource section.
   * @param sectionKey The section key (e.g., 'swarm-services', 'swarm-tasks', 'swarm-nodes')
   */
  async goToSection(sectionKey: string) {
    const section = this.page.locator(`#section-${sectionKey}`);
    await expect(section).toBeVisible({ timeout: 30_000 });

    // If we're already on the target section, don't click again.
    // Re-clicking can be flaky when transient overlays intercept pointer events.
    const currentClass = (await section.getAttribute('class').catch(() => '')) ?? '';
    if (/\bselected\b/.test(currentClass)) return;

    await section.scrollIntoViewIfNeeded();

    // CI can occasionally have transient overlays (notifications, resizer handles)
    // intercept pointer events. Prefer a normal click, but fall back to forced
    // click to ensure navigation remains deterministic.
    try {
      await section.click({ timeout: 15_000 });
    } catch {
      await section.click({ timeout: 30_000, force: true });
    }
    await expect(section).toHaveClass(/\bselected\b/, { timeout: 30_000 });
  }

  /**
   * Navigate to Services section.
   */
  async goToServices() {
    await this.goToSection('swarm-services');
  }

  /**
   * Navigate to Tasks section.
   */
  async goToTasks() {
    await this.goToSection('swarm-tasks');
  }

  /**
   * Navigate to Nodes section.
   */
  async goToNodes() {
    await this.goToSection('swarm-nodes');
  }

  /**
   * Navigate to Stacks section.
   */
  async goToStacks() {
    await this.goToSection('swarm-stacks');
  }

  /**
   * Navigate to Networks section.
   */
  async goToNetworks() {
    await this.goToSection('swarm-networks');
  }

  /**
   * Navigate to Configs section.
   */
  async goToConfigs() {
    await this.goToSection('swarm-configs');
  }

  /**
   * Navigate to Secrets section.
   */
  async goToSecrets() {
    await this.goToSection('swarm-secrets');
  }

  /**
   * Navigate to Volumes section.
   */
  async goToVolumes() {
    await this.goToSection('swarm-volumes');
  }

  /**
   * Get the resource count for a section.
   */
  async getSectionCount(sectionKey: string): Promise<number | null> {
    const section = this.page.locator(`#section-${sectionKey}`);
    const countSpan = section.locator('span').last();
    const text = await countSpan.textContent();
    if (!text || text === '-') return null;
    const num = parseInt(text.trim(), 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Check if Swarm is connected by looking at sidebar state.
   */
  async isSwarmConnected(): Promise<boolean> {
    // Swarm auto-connect runs on startup; give it a short window before deciding.
    const servicesSection = this.page.locator('#section-swarm-services');
    if (await servicesSection.isVisible().catch(() => false)) return true;

    try {
      await servicesSection.waitFor({ state: 'visible', timeout: 10_000 });
      return true;
    } catch {
      return false;
    }
  }
}
