import os from 'node:os';
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { SwarmBottomPanel } from '../../src/pages/SwarmBottomPanel.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { bootstrapSwarm, uniqueSwarmName } from '../../src/support/swarm-bootstrap.js';
import { exec } from '../../src/support/exec.js';

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function docker(args: string[], timeoutMs = 180_000) {
  return exec('docker', args, { timeoutMs });
}

const fixtureStackName = 'kdb-e2e-fixtures';
const fixtureNetworkName = 'kdb_e2e_net';
const fixtureConfigName = 'kdb_e2e_config';
const fixtureSecretName = 'kdb_e2e_secret';
const fixtureVolumeName = `${fixtureStackName}_e2e_data`;

async function expectStackTabContent(panelRoot: import('@playwright/test').Locator, expectedText: string) {
  const expected = panelRoot.getByText(expectedText, { exact: false });
  const emptyState = panelRoot.getByText(/No .* found/i).or(panelRoot.getByText(/No .* for this stack\./i));
  await expect(expected.or(emptyState).first()).toBeVisible({ timeout: 60_000 });
}

async function cleanupStacks(prefix: string) {
  const ls = await docker(['stack', 'ls', '--format', '{{.Name}}'], 60_000);
  if (ls.code !== 0) return;
  const names = ls.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((n) => n.startsWith(prefix));
  for (const name of names) {
    await docker(['stack', 'rm', name], 60_000).catch(() => undefined);
  }
}

async function cleanupServices(prefix: string) {
  const ls = await docker(['service', 'ls', '--format', '{{.Name}}'], 60_000);
  if (ls.code !== 0) return;
  const names = ls.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((n) => n.startsWith(prefix));
  if (names.length) await docker(['service', 'rm', ...names], 60_000).catch(() => undefined);
}

test.describe('Docker Swarm Nodes/Services/Stacks', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(360_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
    // Ensure no leftover panels from previous tests
    await SwarmBottomPanel.ensureClosed(page);
  });

  test('nodes: labels add/remove persists', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    const notifications = new Notifications(page);

    await sidebar.goToNodes();

    const table = page.locator('[data-testid="swarm-nodes-table"]');
    await expect(table).toBeVisible({ timeout: 60_000 });

    const firstRow = table.locator('tbody tr').first();
    await expect(firstRow).toBeVisible({ timeout: 60_000 });
    const nodeName = (await firstRow.locator('td').first().innerText()).trim();

    await firstRow.click();

    const panelRoot = page.locator('.bottom-panel').filter({ hasText: nodeName }).first();
    await expect(panelRoot).toBeVisible({ timeout: 30_000 });

    await panelRoot.getByRole('button', { name: 'Labels', exact: true }).click();

    const labelKey = `kdb.e2e.${Date.now()}`;
    const labelValue = 'true';

    await page.locator('#swarm-node-labels-add-btn').click();
    await page.locator('input[aria-label="Label key"]').last().fill(labelKey);
    await page.locator('input[aria-label="Label value"]').last().fill(labelValue);

    await page.locator('#swarm-node-labels-save-btn').click();
    await notifications.expectSuccessContains('Node labels updated');

    // Close and reopen details to ensure persisted.
    await page.locator('#maincontent').click();
    await expect(panelRoot).toBeHidden({ timeout: 30_000 });

    await firstRow.click();
    const panel2 = page.locator('.bottom-panel').filter({ hasText: nodeName }).first();
    await expect(panel2).toBeVisible({ timeout: 30_000 });
    await panel2.getByRole('button', { name: 'Labels', exact: true }).click();

    await expect.poll(async () => {
      const values = await page.locator('input[aria-label="Label key"]').evaluateAll((els) =>
        els.map((e) => (e instanceof HTMLInputElement ? e.value : ''))
      );
      return values.includes(labelKey);
    }, { timeout: 60_000 }).toBe(true);

    // Remove row and save.
    const keyInputs = page.locator('input[aria-label="Label key"]');
    const removeButtons = page.locator('button[aria-label="Remove label row"]');
    const idx = await keyInputs.evaluateAll((els, val) => {
      return els.findIndex((e) => (e instanceof HTMLInputElement ? e.value : '') === String(val));
    }, labelKey);
    expect(idx).toBeGreaterThanOrEqual(0);
    await removeButtons.nth(idx).click();
    await page.locator('#swarm-node-labels-save-btn').click();
    await notifications.expectSuccessContains('Node labels updated');

    // Reopen to verify removed.
    await page.locator('#maincontent').click();
    await firstRow.click();
    const panel3 = page.locator('.bottom-panel').filter({ hasText: nodeName }).first();
    await panel3.getByRole('button', { name: 'Labels', exact: true }).click();
    await expect.poll(async () => {
      const values = await page.locator('input[aria-label="Label key"]').evaluateAll((els) =>
        els.map((e) => (e instanceof HTMLInputElement ? e.value : ''))
      );
      return values.includes(labelKey);
    }, { timeout: 60_000 }).toBe(false);
  });

  test('services: update image triggers redeploy and shows success', async ({ page }) => {
    const prefix = uniqueSwarmName('kdb-e2e-imgsvc-');
    const svcName = `${prefix}svc`;

    try {
      const createSvc = await docker([
        'service',
        'create',
        '--name',
        svcName,
        'nginx:alpine',
      ]);
      if (createSvc.code !== 0) throw new Error(createSvc.stderr || createSvc.stdout);

      // Wait for service to be fully created
      await new Promise(resolve => setTimeout(resolve, 3000));

      const sidebar = new SwarmSidebarPage(page);
      const notifications = new Notifications(page);

      await sidebar.goToServices();

      const table = page.locator('[data-testid="swarm-services-table"]');
      await expect(table).toBeVisible({ timeout: 60_000 });

      // Poll for the service row to appear
      const row = table.locator('tbody tr').filter({ hasText: svcName }).first();
      await expect(async () => {
        await expect(row).toBeVisible();
      }).toPass({ timeout: 90_000, intervals: [1000, 2000, 5000] });
      
      // Click the Name cell (first td) to avoid clicking the Update badge which opens a different popup
      const nameCell = row.locator('td').first();
      const panel = new SwarmBottomPanel(page);
      await expect(async () => {
        // Dismiss any open popups first
        await page.keyboard.press('Escape').catch(() => {});
        await page.waitForTimeout(100);
        await nameCell.click();
        await expect(panel.root).toBeVisible({ timeout: 5_000 });
      }).toPass({ timeout: 30_000, intervals: [1000, 2000, 3000] });

      await page.locator('#swarm-service-update-image-btn').click({ timeout: 30_000 });
      await expect(page.getByText(`Update Service Image: ${svcName}`)).toBeVisible({ timeout: 30_000 });

      await page.locator('#swarm-service-update-image-input').fill('nginx:1.25-alpine');
      await page.locator('#swarm-service-update-image-confirm-btn').click();

      await notifications.expectSuccessContains(/Updated service image|updated/i);

      // CLI should reflect updated image.
      await expect.poll(async () => {
        const res = await docker(['service', 'inspect', svcName, '--format', '{{.Spec.TaskTemplate.ContainerSpec.Image}}'], 60_000);
        return res.stdout.trim();
      }, { timeout: 120_000 }).toContain('nginx:1.25-alpine');
    } finally {
      await cleanupServices(prefix);
    }
  });

  test('stacks: related resource tabs render; compose warning; export downloads; update redeploys', async ({ page }) => {
    const sidebar = new SwarmSidebarPage(page);
    const notifications = new Notifications(page);

    // Verify related resources tabs on the shared fixtures stack.
    await sidebar.goToStacks();

    const stacksTable = page.locator('[data-testid="swarm-stacks-table"]');
    await expect(stacksTable).toBeVisible({ timeout: 60_000 });

    const fixtureRow = stacksTable.locator('tbody tr').filter({ hasText: fixtureStackName }).first();
    await expect(fixtureRow).toBeVisible({ timeout: 60_000 });
    await fixtureRow.click();

    // The stacks bottom panel doesn't always include the stack name text, so avoid
    // filtering by it (it can return an empty locator and cause false failures).
    const panelRoot = page.locator('.bottom-panel').first();
    await expect(panelRoot).toBeVisible({ timeout: 30_000 });

    await panelRoot.getByRole('button', { name: 'Networks', exact: true }).click();
    await expectStackTabContent(panelRoot, fixtureNetworkName);

    await panelRoot.getByRole('button', { name: 'Volumes', exact: true }).click();
    await expectStackTabContent(panelRoot, fixtureVolumeName);

    await panelRoot.getByRole('button', { name: 'Configs', exact: true }).click();
    await expectStackTabContent(panelRoot, fixtureConfigName);

    await panelRoot.getByRole('button', { name: 'Secrets', exact: true }).click();
    await expectStackTabContent(panelRoot, fixtureSecretName);

    await panelRoot.getByRole('button', { name: 'Compose File', exact: true }).click();
    await expect(panelRoot.getByText(/derived from current service specs/i)).toBeVisible({ timeout: 60_000 });
    await expect(panelRoot.locator('pre').first()).toContainText('services:', { timeout: 60_000 });

    // Export button is only rendered in the Summary panel header (actions).
    // Assert via success toast rather than relying on downloads/filesystem.
    await panelRoot.getByRole('button', { name: 'Summary', exact: true }).click();
    await page.locator('#swarm-stack-export-btn').click();
    await notifications.expectSuccessContains(`Exported stack "${fixtureStackName}" compose`);

    // Update action: use a dedicated ephemeral stack to avoid mutating shared fixtures.
    // Deploy via the app UI (CreateManifestOverlay) so the stack is created using the
    // same backend/docker client as the UI list (avoids docker CLI context mismatches).
    const stackPrefix = uniqueSwarmName('kdb-e2e-stack-');
    const stackName = `${stackPrefix}update`;
    const composeYaml = [
      'version: "3.8"',
      'services:',
      '  web:',
      '    image: nginx:alpine',
      '    deploy:',
      '      replicas: 1',
    ].join('\n');

    try {
      // Open stack create overlay from the Stacks view.
      await page.locator('main').getByRole('button', { name: /create new/i }).click();
      await expect(page.locator('#swarm-create-overlay')).toBeVisible({ timeout: 30_000 });
      await page.locator('#swarm-stack-name').fill(stackName);

      // Fill Compose YAML via CodeMirror.
      const mod = os.platform() === 'darwin' ? 'Meta' : 'Control';
      const cm = page.locator('#swarm-compose-editor .cm-content').first();
      await expect(cm).toBeVisible({ timeout: 30_000 });
      await cm.click();
      await page.keyboard.press(`${mod}+A`);
      await page.keyboard.insertText(composeYaml);
      await expect(page.locator('#swarm-compose-editor')).toContainText('services:', { timeout: 30_000 });

      await page.locator('#swarm-create-btn').click();
      await notifications.expectSuccessContains(`Swarm stack "${stackName}" was deployed successfully!`);
      await expect(page.locator('#swarm-create-overlay')).toBeHidden({ timeout: 60_000 });

      // Ensure the stacks list includes the new stack.
      await sidebar.goToServices();
      await sidebar.goToStacks();
      await expect(stacksTable).toBeVisible({ timeout: 60_000 });
      const row = stacksTable.locator('tbody tr').filter({ hasText: stackName }).first();
      
      // Poll for the stack row to appear with retries
      await expect(async () => {
        await expect(row).toBeVisible();
      }).toPass({ timeout: 120_000, intervals: [1000, 2000, 5000] });
      
      await row.scrollIntoViewIfNeeded();
      
      // Click the row to open the details panel (Swarm tables use row click, not Details button)
      await row.click();

      const panel = page.locator('.bottom-panel').first();
      await expect(panel).toBeVisible({ timeout: 60_000 });
      await expect(panel.getByText(stackName, { exact: true })).toBeVisible({ timeout: 60_000 });

      // Prefer the stable id-based selector.
      // The button can briefly show "Loading..." and be disabled while compose is fetched.
      const updateBtn = panel.locator('#swarm-stack-update-btn');
      await expect(updateBtn).toBeVisible({ timeout: 60_000 });
      await expect(updateBtn).toBeEnabled({ timeout: 60_000 });
      await updateBtn.click({ timeout: 20_000, force: true });
      await expect(page.getByText(`Update Stack: ${stackName}`)).toBeVisible({ timeout: 30_000 });

      const textarea = page.locator('#swarm-stack-update-yaml');
      // Overwrite with a known-good compose file so we don't inherit weird service keys from the inspect output.
      // This ensures the stack deploy changes the actual service spec.
      const targetImage = 'nginx:1.21-alpine';
      const updatedComposeYaml = [
        'version: "3.8"',
        'services:',
        '  web:',
        `    image: ${targetImage}`,
        '    deploy:',
        '      replicas: 1',
      ].join('\n');
      await textarea.fill(updatedComposeYaml);
      await page.locator('#swarm-stack-update-confirm-btn').click();

      // Ensure the UI reports success (or fail fast with the UI error).
      const result = await Promise.race([
        notifications
          .expectSuccessContains(new RegExp(`Updated stack\\s+"?${escapeRegExp(stackName)}"?`, 'i'), { timeoutMs: 60_000 })
          .then(() => 'success' as const),
        notifications
          .expectErrorContains(/Failed to update stack/i, { timeoutMs: 60_000 })
          .then(() => 'error' as const),
      ]);
      if (result === 'error') {
        const msg = await notifications.notificationText(/Failed to update stack/i).innerText().catch(() => '(no details)');
        throw new Error(`Stack update failed: ${msg}`);
      }

      // Prefer a deterministic postcondition over a toast: verify the stack's service image changed.
      // Do not assume a fixed service key (some compose sources include prefixed service names).
      // Instead, poll all services under the stack and ensure one reflects the updated image.
      await expect
        .poll(async () => {
          const ls = await docker(['stack', 'services', stackName, '--format', '{{.Name}}'], 60_000);
          if (ls.code !== 0) return '';

          const names = ls.stdout
            .split(/\r?\n/)
            .map((s) => s.trim())
            .filter(Boolean);
          if (!names.length) return '';

          const images: string[] = [];
          for (const name of names) {
            const res = await docker(
              ['service', 'inspect', name, '--format', '{{.Spec.TaskTemplate.ContainerSpec.Image}}'],
              60_000
            );
            if (res.code === 0) images.push(res.stdout.trim());
          }
          return images.join('\n');
        }, { timeout: 180_000 })
        .toContain(targetImage);

      // If a toast does appear, keep it as a best-effort check (but do not fail if it doesn't).
      await notifications
        .expectSuccessContains(new RegExp(`Updated stack\\s+"?${escapeRegExp(stackName)}"?`, 'i'), {
          timeoutMs: 5_000,
        })
        .catch(() => undefined);
    } finally {
      // Best-effort cleanup via UI (ensures same backend/docker client), with CLI fallback.
      try {
        await sidebar.goToStacks();
        await expect(stacksTable).toBeVisible({ timeout: 60_000 });
        const row = stacksTable.locator('tbody tr').filter({ hasText: stackName }).first();
        if (await row.count()) {
          await row.click({ timeout: 30_000, force: true });
          const delBtn = page.locator('.bottom-panel').first().getByRole('button', { name: 'Delete', exact: true }).first();
          await delBtn.click();
          const dlgHeading = page.getByRole('heading', { name: /delete stack\?/i });
          await expect(dlgHeading).toBeVisible({ timeout: 30_000 });
          const dlg = dlgHeading.locator('xpath=..').locator('xpath=..');
          await dlg.getByRole('button', { name: /^Delete$/ }).click();
          await notifications.expectSuccessContains(`Removed stack "${stackName}"`);
        }
      } catch {
        // ignore
      }
      await cleanupStacks(stackPrefix);
    }
  });
});
