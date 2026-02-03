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

async function createSecret(name: string, content: string) {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'kdb-e2e-secret-'));
  const file = path.join(tmp, 'secret.txt');
  await fs.writeFile(file, content, 'utf-8');
  const res = await docker(['secret', 'create', name, file]);
  await fs.rm(tmp, { recursive: true, force: true }).catch(() => undefined);
  if (res.code !== 0) throw new Error(res.stderr || res.stdout);
}

async function cleanupSecrets(prefix: string) {
  const ls = await docker(['secret', 'ls', '--format', '{{.Name}}'], 60_000);
  if (ls.code !== 0) return;
  const names = ls.stdout
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((n) => n.startsWith(prefix));
  if (names.length) await docker(['secret', 'rm', ...names], 60_000).catch(() => undefined);
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

test.describe('Docker Swarm Secrets', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(300_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
  });

  test('used-by + edit gate + show/hide + save creates timestamp secret; rotate + clone', async ({ page }) => {
    const prefix = uniqueSwarmName('kdb-e2e-sec-');
    const secretName = `${prefix}base`;
    const svcName = `${prefix}svc`;

    try {
      await createSecret(secretName, 'secret-v1\n');
      const createSvc = await docker([
        'service',
        'create',
        '--name',
        svcName,
        '--secret',
        `source=${secretName},target=/run/secrets/kdb_secret.txt`,
        'alpine:3.19',
        'sh',
        '-c',
        'sleep 100000',
      ]);
      if (createSvc.code !== 0) throw new Error(createSvc.stderr || createSvc.stdout);

      const sidebar = new SwarmSidebarPage(page);
      const notifications = new Notifications(page);

      await sidebar.goToSecrets();
      
      // Wait for backend to stabilize after secret creation
      await page.waitForTimeout(2000);

      const table = page.locator('[data-testid="swarm-secrets-table"]');
      try {
        await expect(table).toBeVisible({ timeout: 60_000 });
      } catch {
        await page.reload();
        await page.waitForTimeout(2000);
        await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
        const sidebar2 = new SwarmSidebarPage(page);
        await sidebar2.goToSecrets();
        await page.waitForTimeout(1000);
        await expect(table).toBeVisible({ timeout: 90_000 });
      }

      const tableFilter = page.getByRole('searchbox', { name: 'Filter table' });

      const row = table.locator('tbody tr').filter({ hasText: secretName }).first();
      await expect(row).toBeVisible({ timeout: 60_000 });
      await row.click();

      const panelRoot = page.locator('.bottom-panel').filter({ hasText: secretName }).first();
      await expect(panelRoot).toBeVisible({ timeout: 30_000 });

      // Used By should list our service.
      await expect(panelRoot.getByText('Used By', { exact: true })).toBeVisible();
      await expect(panelRoot.getByText(svcName)).toBeVisible({ timeout: 60_000 });

      // Edit flow: textarea disabled until ack checked.
      const editBtn = panelRoot.locator('#swarm-secret-edit-btn');
      await expect(editBtn).toBeVisible({ timeout: 30_000 });
      await editBtn.click();

      const editTitle = page.getByRole('heading', { name: new RegExp(`Edit Swarm secret: ${secretName}`) });
      await expect(editTitle).toBeVisible({ timeout: 30_000 });
      const editModal = page.locator('.base-modal-container', { has: editTitle }).first();

      const textarea = editModal.locator('textarea').first();
      await expect(textarea).toBeDisabled();

      // Toggle reveal requires confirm the first time.
      page.once('dialog', async (d) => {
        expect(d.type()).toBe('confirm');
        await d.accept();
      });
      await editModal.getByRole('button', { name: 'Show', exact: true }).click();
      await expect(editModal.getByRole('button', { name: 'Hide', exact: true })).toBeVisible();

      // Ack and enter value.
      await editModal.getByRole('checkbox', { name: /I understand/i }).check();
      await expect(textarea).toBeEnabled();
      await textarea.fill('secret-v2\n');

      // Hide again.
      await editModal.getByRole('button', { name: 'Hide', exact: true }).click();
      await expect(editModal.getByRole('button', { name: 'Show', exact: true })).toBeVisible();

      await editModal.getByRole('button', { name: 'Save', exact: true }).click();
      await notifications.expectSuccessContains(/Secret updated: created/);

      // New timestamp secret should exist.
      await expect.poll(async () => {
        const ls = await docker(['secret', 'ls', '--format', '{{.Name}}'], 60_000);
        return ls.stdout;
      }, { timeout: 60_000 }).toContain(`${secretName}_`);

      // Rotate action also creates a new timestamp suffix secret.
      const rotatedNamePrefix = `${prefix}rotate`;
      await createSecret(rotatedNamePrefix, 'rotate-v1\n');

      // Force a UI refresh: secrets created via CLI won't necessarily appear unless the
      // section reloads. We intentionally avoid re-clicking an already-selected section
      // in `SwarmSidebarPage`, so bounce to another section and back.
      await sidebar.goToServices();
      await sidebar.goToSecrets();

      // Ensure the rotated secret row is actually rendered.
      // Some runs need a hard reload before the list reflects CLI-created secrets.
      await tableFilter.fill(rotatedNamePrefix);
      let rotateRow = table.locator('tbody tr').filter({ hasText: rotatedNamePrefix }).first();
      try {
        await expect(rotateRow).toBeVisible({ timeout: 10_000 });
      } catch {
        await page.reload();
        await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
        const sidebar2 = new SwarmSidebarPage(page);
        await sidebar2.goToSecrets();
        const table2 = page.locator('[data-testid="swarm-secrets-table"]');
        try {
          await expect(table2).toBeVisible({ timeout: 60_000 });
        } catch {
          await page.reload();
          await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
          const sidebar3 = new SwarmSidebarPage(page);
          await sidebar3.goToSecrets();
          await expect(table2).toBeVisible({ timeout: 90_000 });
        }
        const tableFilter2 = page.getByRole('searchbox', { name: 'Filter table' });
        await tableFilter2.fill(rotatedNamePrefix);
        rotateRow = table2.locator('tbody tr').filter({ hasText: rotatedNamePrefix }).first();
      }
      await expect(rotateRow).toBeVisible({ timeout: 60_000 });
      await rotateRow.click();
      await page.locator('#swarm-secret-rotate-btn').click();
      const rotateTitle = page.getByRole('heading', { name: new RegExp(`Rotate Swarm secret: ${rotatedNamePrefix}`) });
      await expect(rotateTitle).toBeVisible({ timeout: 30_000 });
      const rotateModal = page.locator('.base-modal-container', { has: rotateTitle }).first();

      await rotateModal.getByRole('checkbox', { name: /I understand/i }).check();
      await rotateModal.locator('textarea').first().fill('rotate-v2\n');
      await rotateModal.getByRole('button', { name: 'Save', exact: true }).click();
      await notifications.expectSuccessContains(/Secret updated: created/);
      await expect.poll(async () => {
        const ls = await docker(['secret', 'ls', '--format', '{{.Name}}'], 60_000);
        return ls.stdout;
      }, { timeout: 60_000 }).toContain(`${rotatedNamePrefix}_`);

      await tableFilter.fill('');

      // Clone action uses modal with explicit name/value inputs.
      const cloneSource = `${prefix}clone-src`;
      await createSecret(cloneSource, 'clone-src-v1\n');

      await sidebar.goToSecrets();
      await tableFilter.fill(cloneSource);
      let cloneSourceRow = table.locator('tbody tr').filter({ hasText: cloneSource }).first();
      try {
        await expect(cloneSourceRow).toBeVisible({ timeout: 10_000 });
      } catch {
        await page.reload();
        await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
        const sidebar2 = new SwarmSidebarPage(page);
        await sidebar2.goToSecrets();
        const table2 = page.locator('[data-testid="swarm-secrets-table"]');
        try {
          await expect(table2).toBeVisible({ timeout: 60_000 });
        } catch {
          await page.reload();
          await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
          const sidebar3 = new SwarmSidebarPage(page);
          await sidebar3.goToSecrets();
          await expect(table2).toBeVisible({ timeout: 90_000 });
        }
        const tableFilter2 = page.getByRole('searchbox', { name: 'Filter table' });
        await tableFilter2.fill(cloneSource);
        cloneSourceRow = table2.locator('tbody tr').filter({ hasText: cloneSource }).first();
      }
      await expect(cloneSourceRow).toBeVisible({ timeout: 60_000 });
      await cloneSourceRow.click();
      await page.locator('#swarm-secret-clone-btn').click();

      const cloneName = `${cloneSource}-clone`;
      const cloneTitle = page.getByRole('heading', { name: new RegExp(`Clone Swarm secret: ${cloneSource}`) });
      await expect(cloneTitle).toBeVisible({ timeout: 30_000 });
      const cloneModal = page.locator('.base-modal-container', { has: cloneTitle }).first();
      await cloneModal.locator('#swarm-secret-clone-name').fill(cloneName);
      await cloneModal.locator('#swarm-secret-clone-value').fill('cloned-value\n');
      await cloneModal.locator('#swarm-secret-clone-toggle-mask').click();
      await cloneModal.locator('#swarm-secret-clone-create-btn').click();
      await notifications.expectSuccessContains(`Secret cloned: created "${cloneName}"`);
      await tableFilter.fill(cloneName);
      await expect(table.locator('tbody tr').filter({ hasText: cloneName }).first()).toBeVisible({ timeout: 60_000 });
    } finally {
      await cleanupServices(prefix);
      await cleanupSecrets(prefix);
    }
  });
});
