/**
 * E2E tests for Docker Swarm sidebar navigation.
 * Tests that all Swarm resource sections can be accessed and render correctly.
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';
import { isLocalSwarmActive } from '../../src/support/docker-swarm.js';

const swarmSections = [
  { key: 'swarm-services', label: 'Services' },
  { key: 'swarm-tasks', label: 'Tasks' },
  { key: 'swarm-nodes', label: 'Nodes' },
  { key: 'swarm-stacks', label: 'Stacks' },
  { key: 'swarm-networks', label: 'Networks' },
  { key: 'swarm-configs', label: 'Configs' },
  { key: 'swarm-secrets', label: 'Secrets' },
  { key: 'swarm-volumes', label: 'Volumes' },
  { key: 'swarm-registries', label: 'Registries' },
];

const tableTestIdBySectionKey: Record<string, string> = {
  'swarm-services': 'swarm-services-table',
  'swarm-tasks': 'swarm-tasks-table',
  'swarm-nodes': 'swarm-nodes-table',
  'swarm-stacks': 'swarm-stacks-table',
  'swarm-networks': 'swarm-networks-table',
  'swarm-configs': 'swarm-configs-table',
  'swarm-secrets': 'swarm-secrets-table',
  'swarm-volumes': 'swarm-volumes-table',
  'swarm-registries': 'swarm-registries-table',
};

async function expectSwarmConnected(page: import('@playwright/test').Page) {
  const sidebar = new SwarmSidebarPage(page);
  await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 60_000 });
  return sidebar;
}

test.describe('Docker Swarm Sidebar Navigation', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    if (!(await isLocalSwarmActive())) {
      test.skip(true, 'Docker Swarm is not active');
    }
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  for (const section of swarmSections) {
    test(`navigates to ${section.label} section`, async ({ page }) => {
      const sidebar = await expectSwarmConnected(page);

      await sidebar.goToSection(section.key);
      
      // Verify the section is selected
      const sectionEl = page.locator(`#section-${section.key}`);
      await expect(sectionEl).toHaveClass(/\bselected\b/, { timeout: 10_000 });
      
      // Verify main content area shows the correct view (table or empty state)
      const tableTestId = tableTestIdBySectionKey[section.key];
      await expect(page.locator(`[data-testid="${tableTestId}"]`)).toBeVisible({ timeout: 30_000 });
    });
  }

  test('all sections show resource counts', async ({ page }) => {
    await expectSwarmConnected(page);

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
    const sidebar = await expectSwarmConnected(page);

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
    if (!(await isLocalSwarmActive())) {
      test.skip(true, 'Docker Swarm is not active');
    }
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('displays networks table with expected columns', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToNetworks();
    
    const networksTable = page.locator('[data-testid="swarm-networks-table"]');
    await expect(networksTable).toBeVisible({ timeout: 30_000 });
    await expect(networksTable.getByRole('columnheader', { name: /name/i })).toBeVisible();
    await expect(networksTable.getByRole('columnheader', { name: /driver/i })).toBeVisible();
    await expect(networksTable.getByRole('columnheader', { name: /scope/i })).toBeVisible();
  });

  test('shows default networks (ingress, docker_gwbridge)', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToNetworks();
    
    // Swarm clusters typically have ingress network
    const networksTable = page.locator('[data-testid="swarm-networks-table"]');
    await expect(networksTable.getByRole('row', { name: /ingress/i })).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Docker Swarm Volumes View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    if (!(await isLocalSwarmActive())) {
      test.skip(true, 'Docker Swarm is not active');
    }
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('displays volumes table', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToVolumes();
    
    await expect(page.locator('[data-testid="swarm-volumes-table"]')).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Docker Swarm Configs View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    if (!(await isLocalSwarmActive())) {
      test.skip(true, 'Docker Swarm is not active');
    }
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('displays configs table', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToConfigs();
    
    await expect(page.locator('[data-testid="swarm-configs-table"]')).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Docker Swarm Secrets View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    if (!(await isLocalSwarmActive())) {
      test.skip(true, 'Docker Swarm is not active');
    }
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('displays secrets table', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToSecrets();
    
    await expect(page.locator('[data-testid="swarm-secrets-table"]')).toBeVisible({ timeout: 30_000 });
  });
});

test.describe('Docker Swarm Stacks View', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(120_000);
    if (!(await isLocalSwarmActive())) {
      test.skip(true, 'Docker Swarm is not active');
    }
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
  });

  test('displays stacks table', async ({ page }) => {
    const sidebar = await expectSwarmConnected(page);

    await sidebar.goToStacks();
    
    await expect(page.locator('[data-testid="swarm-stacks-table"]')).toBeVisible({ timeout: 30_000 });
  });
});
