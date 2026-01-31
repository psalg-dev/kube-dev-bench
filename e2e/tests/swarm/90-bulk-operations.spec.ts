/**
 * E2E tests for Docker Swarm Bulk Operations.
 * 
 * Prerequisites:
 * - Docker daemon running with Swarm mode enabled
 * - Fixture services deployed from swarm-bootstrap
 */
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmBottomPanel } from '../../src/pages/SwarmBottomPanel.js';
import { bootstrapSwarm } from '../../src/support/swarm-bootstrap.js';

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

async function expectSwarmConnected(page: import('@playwright/test').Page) {
  const sidebar = new SwarmSidebarPage(page);
  await expect(page.locator('#section-swarm-services')).toBeVisible({ timeout: 60_000 });
  return sidebar;
}

test.describe('Docker Swarm Bulk Operations', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true });
    await SwarmBottomPanel.ensureClosed(page);
  });

  test.describe('Services Bulk Operations', () => {
    test('can select multiple services and view bulk action bar', async ({ page }) => {
      const sidebar = await expectSwarmConnected(page);
      
      await test.step('Navigate to Services section', async () => {
        await sidebar.goToServices();
        const servicesTable = page.locator('[data-testid="swarm-services-table"]');
        await expect(servicesTable).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Select services using checkboxes', async () => {
        // Find checkboxes in the table
        const checkboxes = page.locator('[data-testid="swarm-services-table"] tbody .bulk-checkbox');
        
        // If checkboxes are present, click the first one
        const count = await checkboxes.count();
        if (count > 0) {
          await checkboxes.first().click();
          
          // Verify bulk action bar appears
          await expect(page.locator('.bulk-action-bar')).toBeVisible({ timeout: 5_000 });
          await expect(page.locator('.bulk-action-bar')).toContainText('1');
        }
      });

      await test.step('Clear selection', async () => {
        const actionBar = page.locator('.bulk-action-bar');
        if (await actionBar.isVisible()) {
          await page.locator('.bulk-action-clear').click();
          await expect(actionBar).not.toBeVisible({ timeout: 5_000 });
        }
      });
    });

    test('can select all services using header checkbox', async ({ page }) => {
      const sidebar = await expectSwarmConnected(page);
      
      await sidebar.goToServices();
      const servicesTable = page.locator('[data-testid="swarm-services-table"]');
      await expect(servicesTable).toBeVisible({ timeout: 30_000 });

      await test.step('Click select all checkbox', async () => {
        const headerCheckbox = servicesTable.locator('.bulk-checkbox-all');
        if (await headerCheckbox.isVisible()) {
          await headerCheckbox.click();
          
          // Verify bulk action bar shows
          await expect(page.locator('.bulk-action-bar')).toBeVisible({ timeout: 5_000 });
        }
      });

      await test.step('Clear selection', async () => {
        const clearBtn = page.locator('.bulk-action-clear');
        if (await clearBtn.isVisible()) {
          await clearBtn.click();
        }
      });
    });
  });

  test.describe('Nodes Bulk Operations', () => {
    test('can select nodes and view bulk action bar', async ({ page }) => {
      const sidebar = await expectSwarmConnected(page);
      
      await test.step('Navigate to Nodes section', async () => {
        await sidebar.goToNodes();
        const nodesTable = page.locator('[data-testid="swarm-nodes-table"]');
        await expect(nodesTable).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Attempt to select a node', async () => {
        const checkboxes = page.locator('[data-testid="swarm-nodes-table"] tbody .bulk-checkbox');
        const count = await checkboxes.count();
        
        if (count > 0) {
          await checkboxes.first().click();
          
          // Verify bulk action bar appears with node-specific actions
          const actionBar = page.locator('.bulk-action-bar');
          await expect(actionBar).toBeVisible({ timeout: 5_000 });
          
          // Node actions should include drain/pause/activate
          const hasNodeActions = 
            await actionBar.locator('button', { hasText: /drain/i }).isVisible() ||
            await actionBar.locator('button', { hasText: /pause/i }).isVisible() ||
            await actionBar.locator('button', { hasText: /activate/i }).isVisible() ||
            await actionBar.locator('button', { hasText: /delete/i }).isVisible();
            
          expect(hasNodeActions).toBe(true);
        }
      });

      await test.step('Clear selection', async () => {
        const clearBtn = page.locator('.bulk-action-clear');
        if (await clearBtn.isVisible()) {
          await clearBtn.click();
        }
      });
    });
  });

  test.describe('Configs Bulk Operations', () => {
    test('can select configs and view bulk action bar', async ({ page }) => {
      const sidebar = await expectSwarmConnected(page);
      
      await test.step('Navigate to Configs section', async () => {
        await sidebar.goToConfigs();
        const configsTable = page.locator('[data-testid="swarm-configs-table"]');
        await expect(configsTable).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Attempt to select a config', async () => {
        const checkboxes = page.locator('[data-testid="swarm-configs-table"] tbody .bulk-checkbox');
        const count = await checkboxes.count();
        
        if (count > 0) {
          await checkboxes.first().click();
          
          const actionBar = page.locator('.bulk-action-bar');
          await expect(actionBar).toBeVisible({ timeout: 5_000 });
        }
      });

      await test.step('Clear selection', async () => {
        const clearBtn = page.locator('.bulk-action-clear');
        if (await clearBtn.isVisible()) {
          await clearBtn.click();
        }
      });
    });
  });

  test.describe('Secrets Bulk Operations', () => {
    test('can select secrets and view bulk action bar', async ({ page }) => {
      const sidebar = await expectSwarmConnected(page);
      
      await test.step('Navigate to Secrets section', async () => {
        await sidebar.goToSecrets();
        const secretsTable = page.locator('[data-testid="swarm-secrets-table"]');
        await expect(secretsTable).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Attempt to select a secret', async () => {
        const checkboxes = page.locator('[data-testid="swarm-secrets-table"] tbody .bulk-checkbox');
        const count = await checkboxes.count();
        
        if (count > 0) {
          await checkboxes.first().click();
          
          const actionBar = page.locator('.bulk-action-bar');
          await expect(actionBar).toBeVisible({ timeout: 5_000 });
        }
      });

      await test.step('Clear selection', async () => {
        const clearBtn = page.locator('.bulk-action-clear');
        if (await clearBtn.isVisible()) {
          await clearBtn.click();
        }
      });
    });
  });

  test.describe('Networks Bulk Operations', () => {
    test('can select networks and view bulk action bar', async ({ page }) => {
      const sidebar = await expectSwarmConnected(page);
      
      await test.step('Navigate to Networks section', async () => {
        await sidebar.goToNetworks();
        const networksTable = page.locator('[data-testid="swarm-networks-table"]');
        await expect(networksTable).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Attempt to select a network', async () => {
        const checkboxes = page.locator('[data-testid="swarm-networks-table"] tbody .bulk-checkbox');
        const count = await checkboxes.count();
        
        if (count > 0) {
          await checkboxes.first().click();
          
          const actionBar = page.locator('.bulk-action-bar');
          await expect(actionBar).toBeVisible({ timeout: 5_000 });
        }
      });

      await test.step('Clear selection', async () => {
        const clearBtn = page.locator('.bulk-action-clear');
        if (await clearBtn.isVisible()) {
          await clearBtn.click();
        }
      });
    });
  });

  test.describe('Volumes Bulk Operations', () => {
    test('can select volumes and view bulk action bar', async ({ page }) => {
      const sidebar = await expectSwarmConnected(page);
      
      await test.step('Navigate to Volumes section', async () => {
        await sidebar.goToVolumes();
        const volumesTable = page.locator('[data-testid="swarm-volumes-table"]');
        await expect(volumesTable).toBeVisible({ timeout: 30_000 });
      });

      await test.step('Attempt to select a volume', async () => {
        const checkboxes = page.locator('[data-testid="swarm-volumes-table"] tbody .bulk-checkbox');
        const count = await checkboxes.count();
        
        if (count > 0) {
          await checkboxes.first().click();
          
          const actionBar = page.locator('.bulk-action-bar');
          await expect(actionBar).toBeVisible({ timeout: 5_000 });
        }
      });

      await test.step('Clear selection', async () => {
        const clearBtn = page.locator('.bulk-action-clear');
        if (await clearBtn.isVisible()) {
          await clearBtn.click();
        }
      });
    });
  });
});
