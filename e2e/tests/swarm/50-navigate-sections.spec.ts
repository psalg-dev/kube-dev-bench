/**
 * E2E tests for Docker Swarm sidebar navigation.
 * Tests that all Swarm resource sections can be accessed and render correctly.
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmConnectionWizardPage } from '../../src/pages/SwarmConnectionWizardPage.js';
import { bootstrapApp } from '../../src/support/bootstrap.js';

const swarmSections = [
  { key: 'swarm-services', label: 'Services' },
  { key: 'swarm-tasks', label: 'Tasks' },
  { key: 'swarm-nodes', label: 'Nodes' },
  { key: 'swarm-stacks', label: 'Stacks' },
  { key: 'swarm-networks', label: 'Networks' },
  { key: 'swarm-configs', label: 'Configs' },
  { key: 'swarm-secrets', label: 'Secrets' },
  { key: 'swarm-volumes', label: 'Volumes' },
];

test.describe('Docker Swarm Sidebar Navigation', () => {
  test.beforeEach(async ({ page, contextName, namespace }) => {
    test.setTimeout(120_000);
    await bootstrapApp({ page, contextName, namespace });
    
    // Ensure connected to Swarm
    const sidebar = new SwarmSidebarPage(page);
    if (!(await sidebar.isSwarmConnected())) {
      const wizard = new SwarmConnectionWizardPage(page);
      const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
      if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await gearBtn.click();
        await wizard.connectToLocalDocker();
      }
    }
  });

  for (const section of swarmSections) {
    test(`navigates to ${section.label} section`, async ({ page }) => {
      const sidebar = new SwarmSidebarPage(page);
      
      if (!(await sidebar.isSwarmConnected())) {
        test.skip();
        return;
      }

      await sidebar.goToSection(section.key);
      
      // Verify the section is selected
      const sectionEl = page.locator(`#section-${section.key}`);
      await expect(sectionEl).toHaveClass(/\bselected\b/, { timeout: 10_000 });
      
      // Verify main content area shows the correct view (table or empty state)
      await expect(
        page.locator('table')
          .or(page.getByText(/no .* found|empty|loading/i))
      ).toBeVisible({ timeout: 30_000 });
    });
  }

  test('all sections show resource counts', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    // Check each section has a count displayed
    for (const section of swarmSections) {
      const sectionEl = page.locator(`#section-${section.key}`);
      await expect(sectionEl).toBeVisible();
      
      // Count should be visible (number or dash)
      const countSpan = sectionEl.locator('span').last();
      const text = await countSpan.textContent();
      expect(text === '-' || /^\d+$/.test(text?.trim() || '')).toBeTruthy();
    }
  });

  test('clicking sections updates main content', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    // Navigate to services first
    await sidebar.goToServices();
    await expect(page.locator('#section-swarm-services')).toHaveClass(/selected/);
    
    // Then navigate to nodes
    await sidebar.goToNodes();
    await expect(page.locator('#section-swarm-nodes')).toHaveClass(/selected/);
    await expect(page.locator('#section-swarm-services')).not.toHaveClass(/selected/);
    
    // Then navigate to networks
    await sidebar.goToNetworks();
    await expect(page.locator('#section-swarm-networks')).toHaveClass(/selected/);
    await expect(page.locator('#section-swarm-nodes')).not.toHaveClass(/selected/);
  });
});

test.describe('Docker Swarm Networks View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    
    const sidebar = new SwarmSidebarPage(page);
    if (!(await sidebar.isSwarmConnected())) {
      const wizard = new SwarmConnectionWizardPage(page);
      const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
      if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await gearBtn.click();
        await wizard.connectToLocalDocker();
      }
    }
  });

  test('displays networks table with expected columns', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToNetworks();
    
    await expect(page.locator('table')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('columnheader', { name: /name/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /driver/i })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /scope/i })).toBeVisible();
  });

  test('shows default networks (ingress, docker_gwbridge)', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToNetworks();
    
    // Swarm clusters typically have ingress network
    await expect(page.getByRole('row', { name: /ingress/i })).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Docker Swarm Volumes View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    
    const sidebar = new SwarmSidebarPage(page);
    if (!(await sidebar.isSwarmConnected())) {
      const wizard = new SwarmConnectionWizardPage(page);
      const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
      if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await gearBtn.click();
        await wizard.connectToLocalDocker();
      }
    }
  });

  test('displays volumes table', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToVolumes();
    
    // Should show table or empty state
    await expect(
      page.locator('table')
        .or(page.getByText(/no volumes|empty/i))
    ).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Docker Swarm Configs View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    
    const sidebar = new SwarmSidebarPage(page);
    if (!(await sidebar.isSwarmConnected())) {
      const wizard = new SwarmConnectionWizardPage(page);
      const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
      if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await gearBtn.click();
        await wizard.connectToLocalDocker();
      }
    }
  });

  test('displays configs table', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToConfigs();
    
    // Should show table or empty state
    await expect(
      page.locator('table')
        .or(page.getByText(/no configs|empty/i))
    ).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Docker Swarm Secrets View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    
    const sidebar = new SwarmSidebarPage(page);
    if (!(await sidebar.isSwarmConnected())) {
      const wizard = new SwarmConnectionWizardPage(page);
      const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
      if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await gearBtn.click();
        await wizard.connectToLocalDocker();
      }
    }
  });

  test('displays secrets table', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToSecrets();
    
    // Should show table or empty state
    await expect(
      page.locator('table')
        .or(page.getByText(/no secrets|empty/i))
    ).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Docker Swarm Stacks View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    await page.goto('/');
    
    const sidebar = new SwarmSidebarPage(page);
    if (!(await sidebar.isSwarmConnected())) {
      const wizard = new SwarmConnectionWizardPage(page);
      const gearBtn = page.locator('#swarm-show-wizard-btn, [data-testid="swarm-wizard-btn"]');
      if (await gearBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await gearBtn.click();
        await wizard.connectToLocalDocker();
      }
    }
  });

  test('displays stacks table', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    
    if (!(await sidebar.isSwarmConnected())) {
      test.skip();
      return;
    }

    await sidebar.goToStacks();
    
    // Should show table or empty state
    await expect(
      page.locator('table')
        .or(page.getByText(/no stacks|empty/i))
    ).toBeVisible({ timeout: 30_000 });
  });
});
