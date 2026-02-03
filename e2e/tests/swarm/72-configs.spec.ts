import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { bootstrapSwarm, uniqueSwarmName } from '../../src/support/swarm-bootstrap.js';
import { exec } from '../../src/support/exec.js';

async function docker(args: string[], timeoutMs = 120_000) {
  return exec('docker', args, { timeoutMs });
}

async function createConfig(name: string, content: string) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kdb-e2e-config-'));
  const file = path.join(tmp, 'config.txt');
  await fs.writeFile(file, content, 'utf-8');
  const res = await docker(['config', 'create', name, file]);
  await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
}

async function cleanupConfigs(prefix: string) {
  const ls = await docker(['config', 'ls', '--format', '{{.Name}}'], 60_000);
  if (ls.code !== 0) return;
  const names = ls.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((n) => n.startsWith(prefix));
  if (names.length) await docker(['config', 'rm', ...names], 60_000).catch(() => undefined);
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

test.describe('Docker Swarm Configs', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
  });

  test('used-by + edit migrates service + download + clone', async ({ page }) => {
    const prefix = uniqueSwarmName('kdb-e2e-cfg-');
    const cfgName = `${prefix}base`;
    const svcName = `${prefix}svc`;

    const initial = 'hello config v1\n';
    const updated = 'hello config v2\n';

    try {
      await createConfig(cfgName, initial);
      const createSvc = await docker([
        'service',
        'create',
        '--name',
        svcName,
        '--config',
        `source=${cfgName},target=/etc/kdb/config.txt`,
        'alpine:3.19',
        'sh',
        '-c',
        'sleep 100000',
      ]);
      if (createSvc.code !== 0) throw new Error(createSvc.stderr || createSvc.stdout);

      const sidebar = new SwarmSidebarPage(page);
      const notifications = new Notifications(page);

      await sidebar.goToConfigs();

      const table = page.locator('[data-testid="swarm-configs-table"]');
      await expect(table).toBeVisible({ timeout: 60_000 });

      const row = table.locator('tbody tr').filter({ hasText: cfgName }).first();
      await expect(row).toBeVisible({ timeout: 60_000 });
      await row.click();

      const panelRoot = page.locator('.bottom-panel').filter({ hasText: cfgName }).first();
      await expect(panelRoot).toBeVisible({ timeout: 30_000 });
      await panelRoot.getByRole('button', { name: 'Summary', exact: true }).click();

      // Used By should list our service.
      await expect(panelRoot.getByText('Used By', { exact: true })).toBeVisible();
      await expect(panelRoot.getByText(svcName)).toBeVisible({ timeout: 60_000 });

      // Download should save a non-empty file.
      await page.locator('#swarm-config-download-btn').click();
      await notifications.expectSuccessContains(`Saved config ${cfgName}`);

      // Clone should prompt for name and create a new config.
      const cloneName = `${cfgName}-clone`;
      page.once('dialog', async (d) => {
        expect(d.type()).toBe('prompt');
        await d.accept(cloneName);
      });
      await page.locator('#swarm-config-clone-btn').click();
      await notifications.expectSuccessContains(`Cloned config to ${cloneName}`);

      const tableFilter = page.getByRole('searchbox', { name: 'Filter table' });
      const ensureCloneVisible = async () => {
        if (await table.getByText(cloneName).first().isVisible().catch(() => false)) return;

        if (await tableFilter.isVisible().catch(() => false)) {
          await tableFilter.fill(cloneName);
        }
        let cloneRow = table.locator('tbody tr').filter({ hasText: cloneName }).first();
        try {
          await expect(cloneRow).toBeVisible({ timeout: 15_000 });
          return;
        } catch {
          await sidebar.goToServices();
          await sidebar.goToConfigs();
        }

        if (await tableFilter.isVisible().catch(() => false)) {
          await tableFilter.fill(cloneName);
        }
        cloneRow = table.locator('tbody tr').filter({ hasText: cloneName }).first();
        try {
          await expect(cloneRow).toBeVisible({ timeout: 30_000 });
          return;
        } catch {
          await page.reload();
          await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
          const sidebar2 = new SwarmSidebarPage(page);
          await sidebar2.goToConfigs();
        }

        const table2 = page.locator('[data-testid="swarm-configs-table"]');
        await expect(table2).toBeVisible({ timeout: 60_000 });
        const tableFilter2 = page.getByRole('searchbox', { name: 'Filter table' });
        if (await tableFilter2.isVisible().catch(() => false)) {
          await tableFilter2.fill(cloneName);
        }
        await expect(table2.locator('tbody tr').filter({ hasText: cloneName }).first()).toBeVisible({ timeout: 60_000 });
      };

      await ensureCloneVisible();

      // Edit config: creates timestamp-suffixed new config, migrates service, deletes old.
      const openEditModal = async () => {
        const editBtn = panelRoot.getByRole('button', { name: 'Edit', exact: true });
        if (!(await editBtn.isVisible().catch(() => false))) {
          const actionsBtn = row.getByRole('button', { name: 'Row actions' }).first();
          if (await actionsBtn.isVisible().catch(() => false)) {
            await actionsBtn.click({ timeout: 5_000 });
            await page.getByText('Details').first().click();
          }
        }
        await panelRoot.getByRole('button', { name: 'Summary', exact: true }).click();
        await editBtn.click();
        const modal = page.locator('[data-testid="swarm-config-edit-modal"]').first();
        await expect(modal).toBeVisible({ timeout: 30_000 });
        return modal;
      };

      const modal = await openEditModal();

      const editor = page.locator('.cm-content').first();
      await expect(editor).toBeVisible({ timeout: 30_000 });
      await page.locator('[data-testid="swarm-config-edit-textarea"]').fill(updated);

      // Save button text is in modal.
      const saveBtn = page.locator('#swarm-config-edit-save-btn');
      if (!(await saveBtn.isVisible().catch(() => false))) {
        await openEditModal();
      }
      await expect(page.locator('#swarm-config-edit-save-btn')).toBeEnabled({ timeout: 10_000 });
      await page.locator('#swarm-config-edit-save-btn').click({ timeout: 10_000 });
      await notifications.expectSuccessContains(/Config updated/i);

      // New config should appear with _timestamp suffix.
      await expect.poll(async () => {
        const ls = await docker(['config', 'ls', '--format', '{{.Name}}'], 60_000);
        return ls.stdout;
      }, { timeout: 60_000 }).toContain(`${cfgName}_`);

      // Service spec should reference the new config (name contains cfgName_...).
      await expect.poll(async () => {
        const res = await docker(['service', 'inspect', svcName, '--format', '{{json .Spec.TaskTemplate.ContainerSpec.Configs}}'], 60_000);
        if (res.code !== 0) return '';
        return res.stdout;
      }, { timeout: 60_000 }).toContain(`${cfgName}_`);
    } finally {
      await cleanupServices(prefix);
      await cleanupConfigs(prefix);
    }
  });
});
