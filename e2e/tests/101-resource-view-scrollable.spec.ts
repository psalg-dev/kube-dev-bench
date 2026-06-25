import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { kubectl } from '../src/support/kind.js';
import { waitForTableRow } from '../src/support/wait-helpers.js';

function resourceName(prefix: string, index: number) {
  return `${prefix}-${String(index).padStart(3, '0')}`;
}

function buildConfigMapsManifest(namespace: string, prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const name = resourceName(prefix, index);
    return [
      'apiVersion: v1',
      'kind: ConfigMap',
      'metadata:',
      `  name: ${name}`,
      `  namespace: ${namespace}`,
      '  labels:',
      `    e2e-suite: ${prefix}`,
      'data:',
      `  value: ${name}`,
    ].join('\n');
  }).join('\n---\n');
}

function buildPodsManifest(namespace: string, prefix: string, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const name = resourceName(prefix, index);
    return [
      'apiVersion: v1',
      'kind: Pod',
      'metadata:',
      `  name: ${name}`,
      `  namespace: ${namespace}`,
      '  labels:',
      `    app: ${prefix}`,
      `    e2e-suite: ${prefix}`,
      'spec:',
      '  terminationGracePeriodSeconds: 0',
      '  containers:',
      '  - name: pause',
      '    image: registry.k8s.io/pause:3.9',
    ].join('\n');
  }).join('\n---\n');
}

async function writeManifest(prefix: string, contents: string) {
  const filePath = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.yaml`);
  await fs.writeFile(filePath, contents, 'utf-8');
  return filePath;
}

async function applyManifest(kubeconfigPath: string, filePath: string) {
  const result = await kubectl(['apply', '-f', filePath], { kubeconfigPath, timeoutMs: 180_000 });
  expect(result.code, result.stderr || result.stdout).toBe(0);
}

async function waitForResourceCount(
  kubeconfigPath: string,
  namespace: string,
  kind: 'configmaps' | 'pods',
  labelSelector: string,
  expectedCount: number,
) {
  await expect.poll(async () => {
    const result = await kubectl(
      ['get', kind, '-n', namespace, '-l', labelSelector, '-o', 'name'],
      { kubeconfigPath, timeoutMs: 30_000 },
    );
    if (result.code !== 0) {
      return -1;
    }
    return (result.stdout || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean).length;
  }, {
    timeout: 180_000,
    intervals: [500, 1000, 2000, 5000],
  }).toBe(expectedCount);
}

async function ensureNameSortAscending(page: import('@playwright/test').Page) {
  const nameButton = page.getByRole('button', { name: /^Name$/ }).first();
  const nameHeader = nameButton.locator('xpath=ancestor::th[1]');

  await expect(nameButton).toBeVisible({ timeout: 30_000 });

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const ariaSort = await nameHeader.getAttribute('aria-sort');
    if (ariaSort === 'ascending') {
      return;
    }
    await nameButton.click();
    await page.waitForTimeout(150);
  }

  await expect(nameHeader).toHaveAttribute('aria-sort', 'ascending');
}

async function scrollUntilRowVisible(
  page: import('@playwright/test').Page,
  containerSelector: string,
  rowText: string,
) {
  const container = page.locator(containerSelector).first();
  const targetRow = page
    .locator('#maincontent table.gh-table tbody tr, #main-panels table.gh-table tbody tr')
    .filter({ hasText: rowText })
    .first();

  await expect(container).toBeVisible({ timeout: 30_000 });
  await container.evaluate((element) => {
    element.scrollTop = 0;
  });

  const overflowState = await container.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
  }));
  expect(overflowState.scrollHeight).toBeGreaterThan(overflowState.clientHeight);

  let observedScrollTop = 0;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const count = await targetRow.count();
    if (count > 0) {
      const [containerBox, rowBox] = await Promise.all([
        container.boundingBox(),
        targetRow.boundingBox(),
      ]);

      if (
        containerBox &&
        rowBox &&
        rowBox.y >= containerBox.y &&
        rowBox.y + rowBox.height <= containerBox.y + containerBox.height
      ) {
        expect(observedScrollTop).toBeGreaterThan(0);
        return;
      }
    }

    const nextState = await container.evaluate((element) => {
      const maxScrollTop = Math.max(0, element.scrollHeight - element.clientHeight);
      const nextScrollTop = Math.min(maxScrollTop, element.scrollTop + Math.max(120, Math.floor(element.clientHeight * 0.85)));
      element.scrollTop = nextScrollTop;
      return { scrollTop: element.scrollTop, maxScrollTop };
    });

    observedScrollTop = nextState.scrollTop;
    await page.waitForTimeout(120);

    if (nextState.scrollTop >= nextState.maxScrollTop && nextState.maxScrollTop > 0) {
      break;
    }
  }

  const [containerBox, rowBox] = await Promise.all([
    container.boundingBox(),
    targetRow.boundingBox(),
  ]);
  expect(containerBox).not.toBeNull();
  expect(rowBox).not.toBeNull();
  expect(observedScrollTop).toBeGreaterThan(0);
  if (containerBox && rowBox) {
    expect(rowBox.y).toBeGreaterThanOrEqual(containerBox.y);
    expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(containerBox.y + containerBox.height);
  }
}

test.describe('Resource view scrollability', () => {
  test('resource views remain scrollable with 100 items', async ({
    page,
    contextName,
    namespace,
    kubeconfigPath,
  }) => {
    test.setTimeout(420_000);

    const configMapPrefix = `scroll-cm-${Date.now()}`;
    const podPrefix = `scroll-pod-${Date.now()}`;
    const configMapManifest = await writeManifest(configMapPrefix, buildConfigMapsManifest(namespace, configMapPrefix, 100));
    const podManifest = await writeManifest(podPrefix, buildPodsManifest(namespace, podPrefix, 100));

    await applyManifest(kubeconfigPath, configMapManifest);
    await applyManifest(kubeconfigPath, podManifest);

    await waitForResourceCount(kubeconfigPath, namespace, 'configmaps', `e2e-suite=${configMapPrefix}`, 100);
    await waitForResourceCount(kubeconfigPath, namespace, 'pods', `e2e-suite=${podPrefix}`, 100);

    const { sidebar } = await bootstrapApp({ page, contextName, namespace });

    await sidebar.goToSection('configmaps');
    await expect(page.locator('h2.overview-title:visible')).toHaveText(/config\s*maps/i, {
      timeout: 30_000,
    });
    await waitForTableRow(page, resourceName(configMapPrefix, 0), { timeout: 120_000 });
    await ensureNameSortAscending(page);
    await scrollUntilRowVisible(page, '[data-testid="overview-table-scroll-container"]:visible', resourceName(configMapPrefix, 99));

    await sidebar.goToSection('pods');
    await expect(page.locator('h2.overview-title:visible')).toHaveText(/pods/i, {
      timeout: 30_000,
    });
    await waitForTableRow(page, new RegExp(podPrefix), { timeout: 180_000 });
    await ensureNameSortAscending(page);
    await scrollUntilRowVisible(page, '[data-testid="pods-table-scroll-container"]:visible', resourceName(podPrefix, 99));
  });
});
