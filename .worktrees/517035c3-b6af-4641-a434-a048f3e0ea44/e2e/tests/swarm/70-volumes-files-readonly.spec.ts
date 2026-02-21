import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { bootstrapSwarm, uniqueSwarmName } from '../../src/support/swarm-bootstrap.js';
import { exec } from '../../src/support/exec.js';

async function docker(args: string[], timeoutMs = 60_000) {
  return exec('docker', args, { timeoutMs });
}

function toDockerDesktopHostPath(p: string) {
  // For Docker Desktop on Windows, the Linux VM mounts the host drive under:
  //   /run/desktop/mnt/host/<drive-letter-lower>/...
  // For Linux/macOS this is not needed.
  if (os.platform() !== 'win32') return p;
  const normalized = p.replace(/\\/g, '/');
  const m = normalized.match(/^([A-Za-z]):\/(.*)$/);
  if (!m) return normalized;
  const drive = m[1].toLowerCase();
  const rest = m[2];
  return `/run/desktop/mnt/host/${drive}/${rest}`;
}

test.describe('Docker Swarm Volumes Files (read-only)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
  });

  test('read-only volume disables all write controls', async ({ page }) => {
    const volumeName = uniqueSwarmName('kdb-e2e-ro-vol');

    // Create a directory we can mount read-only into the volume.
    const hostDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kdb-e2e-ro-vol-'));
    const hostFile = path.join(hostDir, 'hello.txt');
    await fs.writeFile(hostFile, 'hello from read-only volume\n', 'utf-8');

    const dockerDevice = toDockerDesktopHostPath(hostDir);

    // Create a Docker volume that is inherently read-only.
    // Use a bind mount with `ro` so the UI can still list files.
    const createRes = await docker([
      'volume',
      'create',
      '--label',
      'kdb.e2e=1',
      '--driver',
      'local',
      '--opt',
      'type=none',
      '--opt',
      `device=${dockerDevice}`,
      '--opt',
      'o=bind,ro',
      volumeName,
    ]);

    if (createRes.code !== 0) {
      await fs.rm(hostDir, { recursive: true, force: true }).catch(() => undefined);
      test.skip(true, `Could not create read-only bind volume on ${os.platform()}: ${createRes.stderr || createRes.stdout}`);
    }

    try {
      const sidebar = new SwarmSidebarPage(page);

      await sidebar.goToVolumes();

      const table = page.locator('[data-testid="swarm-volumes-table"]');
      await expect(table).toBeVisible({ timeout: 60_000 });

      // Wait for the new volume to appear.
      const row = table.locator('tbody tr').filter({ hasText: volumeName }).first();
      await expect(row).toBeVisible({ timeout: 60_000 });

      // Open details.
      await row.click();

      // There can be multiple bottom panels (e.g. monitor panel). Target the one
      // that contains our selected volume name.
      const panelRoot = page.locator('.bottom-panel').filter({ hasText: volumeName }).first();
      await expect(panelRoot).toBeVisible({ timeout: 30_000 });

      // Files tab should exist and reflect read-only state.
      await panelRoot.getByRole('button', { name: 'Files', exact: true }).click();

      const uploadBtn = panelRoot.getByRole('button', { name: 'Upload', exact: true });
      const newFileBtn = panelRoot.getByRole('button', { name: 'New File', exact: true });
      const newFolderBtn = panelRoot.getByRole('button', { name: 'New Folder', exact: true });

      // Wait until the RO probe completes (explicit indicator, not an error string).
      await expect(panelRoot.getByText('read-only', { exact: true })).toBeVisible({ timeout: 60_000 });

      await expect(uploadBtn).toBeDisabled();
      await expect(newFileBtn).toBeDisabled();
      await expect(newFolderBtn).toBeDisabled();

      // Write actions should not even be rendered in RO mode.
      await expect(panelRoot.getByRole('button', { name: 'Delete', exact: true })).toHaveCount(0);
      await expect(panelRoot.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0);
    } finally {
      await docker(['volume', 'rm', '-f', volumeName], 60_000).catch(() => undefined);
      await fs.rm(hostDir, { recursive: true, force: true }).catch(() => undefined);
    }
  });
});
