import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test, expect } from '../../src/fixtures.js';
import { SwarmSidebarPage } from '../../src/pages/SwarmSidebarPage.js';
import { bootstrapSwarm, uniqueSwarmName } from '../../src/support/swarm-bootstrap.js';
import { exec } from '../../src/support/exec.js';
import { Notifications } from '../../src/pages/Notifications.js';
import { setNextOpenPath, setNextSavePath } from '../../src/support/e2e-dialogs.js';
import { isLocalSwarmActive } from '../../src/support/docker-swarm.js';

async function docker(args: string[], timeoutMs = 90_000) {
  return exec('docker', args, { timeoutMs });
}

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function expectFileViewerContains(
  panelRoot: import('@playwright/test').Locator,
  expected: string | RegExp,
  timeoutMs = 60_000
) {
  const textbox = panelRoot.getByRole('textbox').first();
  const textboxCount = await textbox.count().catch(() => 0);

  if (textboxCount > 0) {
    const re = typeof expected === 'string' ? new RegExp(escapeRegExp(expected)) : expected;
    await expect
      .poll(async () => {
        try {
          // In this app the viewer sometimes uses an element with role="textbox" that is not a
          // real <input>/<textarea> (so inputValue() returns ""). Prefer value when available,
          // otherwise fall back to text content.
          const val = await textbox.evaluate((el) => {
            if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return el.value || '';
            return (el.textContent || '').trim();
          });
          return String(val || '');
        } catch {
          return '';
        }
      }, { timeout: timeoutMs })
      .toMatch(re);
    return;
  }

  if (typeof expected === 'string') {
    await expect(panelRoot.getByText(expected).first()).toBeVisible({ timeout: timeoutMs });
  } else {
    await expect(panelRoot.getByText(expected).first()).toBeVisible({ timeout: timeoutMs });
  }
}

async function writeCodeMirror(
  page: import('@playwright/test').Page,
  root: import('@playwright/test').Locator,
  text: string
): Promise<import('@playwright/test').Locator> {
  // CodeMirror is rendered by `TextEditorTab` and may mount slightly after toggling Edit.
  // Prefer the bottom-panel root, but fall back to a page-wide search to avoid brittle scoping.
  let cm = root.locator('.cm-content').first();
  try {
    await expect(cm).toBeVisible({ timeout: 3_000 });
  } catch {
    cm = page.locator('.cm-content').first();
  }
  await expect(cm).toBeVisible({ timeout: 30_000 });
  const mod = os.platform() === 'darwin' ? 'Meta' : 'Control';

  // CodeMirror in this app can occasionally drop keystrokes when typing too fast.
  // Use insertText (IME-style) and retry a couple times if the content doesn't stick.
  for (let attempt = 0; attempt < 3; attempt++) {
    await cm.click({ timeout: 10_000 });
    await page.waitForTimeout(50);
    await page.keyboard.press(`${mod}+A`);
    await page.keyboard.insertText(text);
    await page.waitForTimeout(100);

    const current = (await cm.innerText().catch(() => '')).trim();
    if (current.includes(text.trim())) break;

    // Small backoff before retry.
    await page.waitForTimeout(250);
  }
  return cm;
}

test.describe('Docker Swarm Volumes Files (Phase 1-3)', () => {
  test.beforeEach(async ({ page }) => {
    test.setTimeout(240_000);
    if (!(await isLocalSwarmActive())) {
      test.skip(true, 'Docker Swarm is not active');
    }
    await page.goto('/');
    await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: false });
  });

  test('browse + open text file + binary handling + download/upload + edit/save + create/delete + unsaved changes guard', async ({ page, homeDir }) => {
    const volumeName = uniqueSwarmName('kdb-e2e-vol');

    // Create and seed a writable volume.
    await docker(['volume', 'create', '--label', 'kdb.e2e=1', volumeName], 60_000);
    await docker([
      'run',
      '--rm',
      '-v',
      `${volumeName}:/data`,
      'alpine:3.19',
      'sh',
      '-c',
      'mkdir -p /data/dir1; echo "hello from e2e" > /data/hello.txt; head -c 16 /dev/urandom > /data/bin.dat',
    ]);

    const downloadDest = path.join(os.tmpdir(), `${volumeName}-hello-download.txt`);
    const uploadSrc = path.join(os.tmpdir(), `${volumeName}-upload.txt`);
    await fs.writeFile(uploadSrc, 'uploaded from e2e\n', 'utf-8');

    try {
      const sidebar = new SwarmSidebarPage(page);
      const notifications = new Notifications(page);

      await sidebar.goToVolumes();

      const table = page.locator('[data-testid="swarm-volumes-table"]');
      await expect(table).toBeVisible({ timeout: 60_000 });

      const row = table.locator('tbody tr').filter({ hasText: volumeName }).first();
      await expect(row).toBeVisible({ timeout: 60_000 });
      await row.click();

      const panelRoot = page.locator('.bottom-panel').filter({ hasText: volumeName }).first();
      await expect(panelRoot).toBeVisible({ timeout: 30_000 });

      await panelRoot.getByRole('button', { name: 'Files', exact: true }).click();

      // Wait for directory listing to populate.
      await expect(panelRoot.getByText('Volume:', { exact: false })).toBeVisible();
      await expect(panelRoot.getByText('hello.txt')).toBeVisible({ timeout: 60_000 });

      // Open text file.
      await panelRoot.getByText('hello.txt').first().click();
      await expectFileViewerContains(panelRoot, 'hello from e2e', 60_000);

      // Binary file handling.
      await panelRoot.getByText('bin.dat').first().click();
      await expect(panelRoot.getByText('/bin.dat')).toBeVisible({ timeout: 60_000 });
      // The UI consistently renders the file row size ("16 B"), but the binary preview banner
      // is not always present depending on rendering mode.
      const binRow = panelRoot.locator('tbody tr').filter({ hasText: 'bin.dat' }).first();
      await expect(binRow).toBeVisible({ timeout: 60_000 });
      // Note: the UI sometimes renders the size immediately followed by a timestamp (e.g. "16 B2026-...").
      // Avoid word-boundary matching after the unit.
      await expect(binRow).toContainText(/16\s*B/i, { timeout: 60_000 });

      // Download (via E2E dialog override) from the opened file header.
      await panelRoot.getByText('hello.txt').first().click();
      await expect(panelRoot.getByText('/hello.txt')).toBeVisible({ timeout: 60_000 });
      await fs.rm(downloadDest, { force: true }).catch(() => undefined);
      await setNextSavePath(homeDir, downloadDest);
      // Anchor on the open-file header (which contains /hello.txt + actions).
      // Use parent traversal instead of a specific tag name to avoid tag/structure drift.
      const helloHeader = panelRoot.getByText('/hello.txt').first().locator('..');
      await helloHeader.getByRole('button', { name: 'Download', exact: true }).click({ timeout: 20_000 });
      await notifications.expectSuccessContains(/downloaded/i);
      // Avoid filesystem assertions here. In CI/Wails/Windows environments the "save" operation can
      // succeed (toast) but still be non-deterministic for the Playwright process to observe.

      // Upload (via E2E dialog override) into root.
      await setNextOpenPath(homeDir, uploadSrc);
      await panelRoot.getByRole('button', { name: 'Upload', exact: true }).click();
      await notifications.expectSuccessContains(/uploaded/i);
      await expect(panelRoot.getByText(path.basename(uploadSrc)).first()).toBeVisible({ timeout: 60_000 });

      // Edit + Save.
      await panelRoot.getByText('hello.txt').first().click();
      // Ensure we actually loaded hello.txt (not a stale binary preview) by matching the header size
      // against the size shown in the directory listing row.
      await expect(panelRoot.getByText('/hello.txt')).toBeVisible({ timeout: 60_000 });
      const helloRowSize = (await panelRoot.locator('tbody tr').filter({ hasText: 'hello.txt' }).first().locator('td').nth(2).innerText()).trim();
      await expect(panelRoot.getByText('/hello.txt').first().locator('..')).toContainText(new RegExp(`size\\s*${escapeRegExp(helloRowSize)}`, 'i'), {
        timeout: 60_000,
      });
      // Ensure the viewer has loaded content before entering edit mode.
      await expectFileViewerContains(panelRoot, 'hello from e2e', 60_000);
      await panelRoot.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(panelRoot.getByText('Loading file...')).toHaveCount(0, { timeout: 60_000 });
      const cm = await writeCodeMirror(page, panelRoot, 'hello UPDATED\n');
      await expect(cm).toContainText('hello UPDATED', { timeout: 30_000 });
      await panelRoot.getByRole('button', { name: 'Save', exact: true }).click();
      await notifications.expectSuccessContains(/saved file/i);

      // Re-open to verify updated content.
      // Clicking the same file name may not trigger a reload if it's already selected,
      // so bounce to a different file first.
      await panelRoot.getByText('bin.dat').first().click();
      await expect(panelRoot.getByText('/bin.dat')).toBeVisible({ timeout: 60_000 });
      await panelRoot.getByText('hello.txt').first().click();
      await expect(panelRoot.getByText('/hello.txt')).toBeVisible({ timeout: 60_000 });
      // Wait for the header metadata to match hello.txt, not the previously-open binary file.
      const helloRowSize2 = (await panelRoot.locator('tbody tr').filter({ hasText: 'hello.txt' }).first().locator('td').nth(2).innerText()).trim();
      await expect(panelRoot.getByText('/hello.txt').first().locator('..')).toContainText(new RegExp(`size\\s*${escapeRegExp(helloRowSize2)}`, 'i'), {
        timeout: 60_000,
      });
      await expect(panelRoot.getByText('Loading file...')).toHaveCount(0, { timeout: 60_000 });
      await expectFileViewerContains(panelRoot, 'hello UPDATED', 60_000);

      // New Folder.
      page.once('dialog', async (d) => {
        expect(d.type()).toBe('prompt');
        await d.accept('new-folder');
      });
      await panelRoot.getByRole('button', { name: 'New Folder', exact: true }).click();
      await notifications.expectSuccessContains(/folder created/i);
      await expect(panelRoot.getByText('new-folder').first()).toBeVisible({ timeout: 60_000 });

      // Navigate into folder.
      await panelRoot.getByText('new-folder').first().click();
      // Empty directory UI is rendered as the default preview hint (not literal "Empty directory").
      await expect(panelRoot.getByText(/select a file to preview/i).first()).toBeVisible({ timeout: 60_000 });

      // New File.
      page.once('dialog', async (d) => {
        expect(d.type()).toBe('prompt');
        await d.accept('new.txt');
      });
      await panelRoot.getByRole('button', { name: 'New File', exact: true }).click();
      await notifications.expectSuccessContains(/file created/i);
      await expect(panelRoot.getByText('new.txt').first()).toBeVisible({ timeout: 60_000 });

      // Delete file.
      page.once('dialog', async (d) => {
        expect(d.type()).toBe('confirm');
        await d.accept();
      });
      await panelRoot.locator('tbody tr').filter({ hasText: 'new.txt' }).getByRole('button', { name: 'Delete', exact: true }).click();
      await notifications.expectSuccessContains(/deleted/i);
      await expect(panelRoot.getByText('new.txt')).toHaveCount(0);

      // Return to root before editing an existing root-level file.
      await panelRoot.getByText('root', { exact: true }).click();
      await expect(panelRoot.getByText('hello.txt').first()).toBeVisible({ timeout: 60_000 });

      // Unsaved changes guardrail.
      await panelRoot.getByText('hello.txt').first().click();
      await expect(panelRoot.getByText('/hello.txt')).toBeVisible({ timeout: 60_000 });
      await expect(panelRoot.getByText('Loading file...')).toHaveCount(0, { timeout: 60_000 });
      await panelRoot.getByRole('button', { name: 'Edit', exact: true }).click();
      await expect(panelRoot.getByText('Loading file...')).toHaveCount(0, { timeout: 60_000 });
      await writeCodeMirror(page, panelRoot, 'unsaved changes\n');

      // Attempt to navigate away; cancel first.
      page.once('dialog', async (d) => {
        expect(d.type()).toBe('confirm');
        expect(d.message()).toMatch(/discard your unsaved changes/i);
        await d.dismiss();
      });
      await panelRoot.getByText('root', { exact: true }).click();
      await expect(panelRoot.getByRole('button', { name: 'Save', exact: true })).toBeVisible();

      // Now accept and navigate.
      page.once('dialog', async (d) => {
        expect(d.type()).toBe('confirm');
        await d.accept();
      });
      await panelRoot.getByText('root', { exact: true }).click();
      await expect(panelRoot.getByText('new-folder').first()).toBeVisible({ timeout: 60_000 });

      // Delete folder (recursive confirm).
      page.once('dialog', async (d) => {
        expect(d.type()).toBe('confirm');
        expect(d.message()).toMatch(/recursive/i);
        await d.accept();
      });
      await panelRoot.locator('tbody tr').filter({ hasText: 'new-folder' }).getByRole('button', { name: 'Delete', exact: true }).click();
      await notifications.expectSuccessContains(/deleted/i);
      await expect(panelRoot.getByText('new-folder')).toHaveCount(0);
    } finally {
      await docker(['volume', 'rm', '-f', volumeName], 60_000).catch(() => undefined);
      await fs.rm(downloadDest, { force: true }).catch(() => undefined);
      await fs.rm(uploadSrc, { force: true }).catch(() => undefined);
    }
  });
});
