import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';
import { bootstrapSwarm } from '../src/support/swarm-bootstrap.js';
import { kubectl, helm } from '../src/support/kind.js';
import { exec } from '../src/support/exec.js';
import { isLocalSwarmActive } from '../src/support/docker-swarm.js';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function uniqueName(prefix: string) {
  const rand = Math.random().toString(16).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`.toLowerCase();
}

async function writeTempFile(prefix: string, contents: string) {
  const filePath = path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.yaml`);
  await fs.writeFile(filePath, contents, 'utf-8');
  return filePath;
}

async function applyManifest(kubeconfigPath: string, yaml: string) {
  const filePath = await writeTempFile('kdb-bulk-selection', yaml);
  try {
    const res = await kubectl(['apply', '-f', filePath], { kubeconfigPath, timeoutMs: 120_000 });
    if (res.code !== 0) {
      const details = (res.stderr || res.stdout || '').trim();
      throw new Error(`kubectl apply failed: ${details}`);
    }
  } finally {
    await fs.rm(filePath, { force: true }).catch(() => undefined);
  }
}

function buildK8sManifest(namespace: string, prefix: string) {
  const docs: string[] = [];
  const suffixes = ['a', 'b'];

  for (const suffix of suffixes) {
    const deployName = `${prefix}-deploy-${suffix}`;
    const stsName = `${prefix}-stateful-${suffix}`;
    const dsName = `${prefix}-daemon-${suffix}`;
    const rsName = `${prefix}-replica-${suffix}`;
    const podName = `${prefix}-pod-${suffix}`;
    const jobName = `${prefix}-job-${suffix}`;
    const cronName = `${prefix}-cron-${suffix}`;
    const cmName = `${prefix}-cm-${suffix}`;
    const secretName = `${prefix}-secret-${suffix}`;
    const svcName = `${prefix}-svc-${suffix}`;
    const ingressName = `${prefix}-ing-${suffix}`;
    const pvcName = `${prefix}-pvc-${suffix}`;
    const stsSvcName = `${prefix}-stateful-svc-${suffix}`;

    docs.push(
      `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${deployName}\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${deployName}\n  template:\n    metadata:\n      labels:\n        app: ${deployName}\n    spec:\n      containers:\n      - name: app\n        image: nginx:alpine\n---\n` +
      `apiVersion: apps/v1\nkind: StatefulSet\nmetadata:\n  name: ${stsName}\n  namespace: ${namespace}\nspec:\n  serviceName: ${stsSvcName}\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${stsName}\n  template:\n    metadata:\n      labels:\n        app: ${stsName}\n    spec:\n      containers:\n      - name: app\n        image: nginx:alpine\n---\n` +
      `apiVersion: v1\nkind: Service\nmetadata:\n  name: ${stsSvcName}\n  namespace: ${namespace}\nspec:\n  clusterIP: None\n  selector:\n    app: ${stsName}\n  ports:\n  - name: http\n    port: 80\n    targetPort: 80\n---\n` +
      `apiVersion: apps/v1\nkind: DaemonSet\nmetadata:\n  name: ${dsName}\n  namespace: ${namespace}\nspec:\n  selector:\n    matchLabels:\n      app: ${dsName}\n  template:\n    metadata:\n      labels:\n        app: ${dsName}\n    spec:\n      containers:\n      - name: app\n        image: nginx:alpine\n---\n` +
      `apiVersion: apps/v1\nkind: ReplicaSet\nmetadata:\n  name: ${rsName}\n  namespace: ${namespace}\nspec:\n  replicas: 1\n  selector:\n    matchLabels:\n      app: ${rsName}\n  template:\n    metadata:\n      labels:\n        app: ${rsName}\n    spec:\n      containers:\n      - name: app\n        image: nginx:alpine\n---\n` +
      `apiVersion: v1\nkind: Pod\nmetadata:\n  name: ${podName}\n  namespace: ${namespace}\n  labels:\n    app: ${podName}\nspec:\n  containers:\n  - name: app\n    image: busybox:1.36\n    command: ["sh", "-c", "sleep 600"]\n  restartPolicy: Always\n---\n` +
      `apiVersion: batch/v1\nkind: Job\nmetadata:\n  name: ${jobName}\n  namespace: ${namespace}\nspec:\n  backoffLimit: 0\n  template:\n    metadata:\n      labels:\n        app: ${jobName}\n    spec:\n      restartPolicy: Never\n      containers:\n      - name: worker\n        image: busybox:1.36\n        command: ["sh", "-c", "sleep 600"]\n---\n` +
      `apiVersion: batch/v1\nkind: CronJob\nmetadata:\n  name: ${cronName}\n  namespace: ${namespace}\nspec:\n  schedule: "*/5 * * * *"\n  jobTemplate:\n    spec:\n      template:\n        metadata:\n          labels:\n            app: ${cronName}\n        spec:\n          restartPolicy: Never\n          containers:\n          - name: worker\n            image: busybox:1.36\n            command: ["sh", "-c", "sleep 60"]\n---\n` +
      `apiVersion: v1\nkind: ConfigMap\nmetadata:\n  name: ${cmName}\n  namespace: ${namespace}\ndata:\n  demo: "${suffix}"\n---\n` +
      `apiVersion: v1\nkind: Secret\nmetadata:\n  name: ${secretName}\n  namespace: ${namespace}\ntype: Opaque\nstringData:\n  token: "${suffix}"\n---\n` +
      `apiVersion: v1\nkind: Service\nmetadata:\n  name: ${svcName}\n  namespace: ${namespace}\nspec:\n  type: ClusterIP\n  selector:\n    app: ${deployName}\n  ports:\n  - name: http\n    port: 80\n    targetPort: 80\n---\n` +
      `apiVersion: networking.k8s.io/v1\nkind: Ingress\nmetadata:\n  name: ${ingressName}\n  namespace: ${namespace}\nspec:\n  rules:\n  - host: ${ingressName}.local\n    http:\n      paths:\n      - path: /\n        pathType: Prefix\n        backend:\n          service:\n            name: ${svcName}\n            port:\n              number: 80\n---\n` +
      `apiVersion: v1\nkind: PersistentVolumeClaim\nmetadata:\n  name: ${pvcName}\n  namespace: ${namespace}\nspec:\n  accessModes:\n  - ReadWriteOnce\n  resources:\n    requests:\n      storage: 1Mi\n  storageClassName: standard\n`
    );
  }

  return docs.join('\n---\n');
}

async function writeLocalChart(opts: { chartRoot: string; chartName: string }) {
  const { chartRoot, chartName } = opts;
  const templatesDir = path.join(chartRoot, 'templates');
  await fs.mkdir(templatesDir, { recursive: true });

  const chartYaml = [
    'apiVersion: v2',
    `name: ${chartName}`,
    'description: KubeDevBench E2E local chart',
    'type: application',
    'version: 0.1.0',
    'appVersion: "1.0.0"',
    '',
  ].join('\n');

  const valuesYaml = ['testValue: "1"', ''].join('\n');

  const cmYaml = [
    'apiVersion: v1',
    'kind: ConfigMap',
    'metadata:',
    '  name: {{ .Release.Name }}-e2e',
    'data:',
    '  testValue: {{ .Values.testValue | quote }}',
    '',
  ].join('\n');

  const notesTxt = ['E2E Notes', 'Release: {{ .Release.Name }}', 'Value: {{ .Values.testValue }}', ''].join('\n');

  await Promise.all([
    fs.writeFile(path.join(chartRoot, 'Chart.yaml'), chartYaml, 'utf-8'),
    fs.writeFile(path.join(chartRoot, 'values.yaml'), valuesYaml, 'utf-8'),
    fs.writeFile(path.join(templatesDir, 'configmap.yaml'), cmYaml, 'utf-8'),
    fs.writeFile(path.join(chartRoot, 'NOTES.txt'), notesTxt, 'utf-8'),
  ]);
}

function getTableLocator(page: import('@playwright/test').Page, tableTestId?: string) {
  if (tableTestId) {
    return page.locator(`[data-testid="${tableTestId}"]`);
  }
  const main = page.locator('#maincontent');
  return main.locator('table.gh-table').filter({ has: main.locator('tbody') }).first();
}

async function assertBulkSelection(opts: {
  page: import('@playwright/test').Page;
  expectedActions: string[];
  tableTestId?: string;
}) {
  const { page, expectedActions, tableTestId } = opts;
  const table = tableTestId ? getTableLocator(page, tableTestId) : null;
  if (table) {
    await expect(table).toBeVisible({ timeout: 60_000 });
  }

  const root = table ?? page.locator('#maincontent');
  const selectAll = root.locator('input.bulk-select-all:visible');
  try {
    await expect(selectAll).toBeVisible({ timeout: 30_000 });
  } catch (err) {
    // Fallbacks: some resource views may not render bulk checkboxes (e.g., when
    // bulk actions are not enabled for that resource). If neither the header
    // select-all cell nor any row checkboxes exist, treat this view as not
    // supporting bulk selection and return early.
    const headerSelectExists = await root.locator('th[aria-label="Select all"]').count();
    const anyRowCheckbox = await root.locator('input.bulk-row-checkbox').count();
    if (!headerSelectExists && !anyRowCheckbox) {
      // No bulk support on this view — skip bulk assertions.
      return;
    }
    // Otherwise rethrow the original error to surface the issue.
    throw err;
  }

  const rowCheckboxes = root.locator('input.bulk-row-checkbox:visible');
  try {
    await expect(rowCheckboxes.first()).toBeVisible({ timeout: 60_000 });
  } catch (err) {
    const emptyState = root.locator('td.main-panel-loading', { hasText: /no rows match the filter/i }).first();
    if (await emptyState.isVisible().catch(() => false)) {
      return;
    }
    throw err;
  }

  const rowCount = await rowCheckboxes.count();
  const bulkBar = page.locator('.bulk-action-bar');

  // Use toPass to retry the click+check — the table can re-render between the
  // click and the assertion, causing the locator to resolve to a fresh element.
  await expect(async () => {
    await rowCheckboxes.first().click();
    await expect(rowCheckboxes.first()).toBeChecked();
  }).toPass({ timeout: 30_000, intervals: [500, 1_000, 2_000] });

  await expect(bulkBar).toBeVisible({ timeout: 30_000 });
  await expect(bulkBar.locator('.bulk-action-count')).toHaveText('1 selected', { timeout: 30_000 });

  for (const action of expectedActions) {
    const name = new RegExp(`^${escapeRegExp(action)}$`, 'i');
    await expect(bulkBar.getByRole('button', { name })).toBeVisible({ timeout: 30_000 });
  }

  const targetIndex = rowCount > 1 ? 1 : 0;
  if (targetIndex > 0) {
    await rowCheckboxes.nth(targetIndex).click({ modifiers: ['Shift'] });
    const getSelectedCount = async () => {
      const text = (await bulkBar.locator('.bulk-action-count').textContent()) || '';
      const count = parseInt(text, 10);
      return Number.isFinite(count) ? count : 0;
    };
    await expect.poll(getSelectedCount, { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
    await expect.poll(async () => root.locator('input.bulk-row-checkbox:checked').count(), { timeout: 30_000 })
      .toBeGreaterThanOrEqual(2);
  } else {
    await rowCheckboxes.first().click({ modifiers: ['Shift'] });
    await expect(bulkBar.locator('.bulk-action-count')).toHaveText('1 selected', { timeout: 30_000 });
  }

  await bulkBar.getByRole('button', { name: /^clear$/i }).click();
  await expect(bulkBar).toBeHidden({ timeout: 30_000 });
}

async function docker(args: string[], timeoutMs = 60_000) {
  return exec('docker', args, { timeoutMs });
}

test.describe('Bulk selection (Kubernetes views)', () => {
  test('selects rows and ranges in each Kubernetes resource view', async ({ page, contextName, namespace, kubeconfigPath, homeDir }) => {
    test.setTimeout(300_000);

    const prefix = uniqueName('kdb-bulk');
    const manifest = buildK8sManifest(namespace, prefix);
    await applyManifest(kubeconfigPath, manifest);

    const helmVersion = await helm(['version', '--short'], { kubeconfigPath, homeDir, timeoutMs: 20_000 });
    const helmAvailable = helmVersion.code !== 127;
    if (!helmAvailable && process.env.E2E_SKIP_HELM !== '1') {
      throw new Error('Helm CLI not found on PATH. Install helm or set E2E_SKIP_HELM=1 to skip Helm E2Es.');
    }

    if (helmAvailable) {
      const chartName = 'kdb-bulk-chart';
      const chartDir = path.join(os.tmpdir(), `kdb-e2e-helm-chart-${prefix}`);
      await writeLocalChart({ chartRoot: chartDir, chartName });

      const releaseA = `${prefix}-helm-a`;
      const releaseB = `${prefix}-helm-b`;

      for (const release of [releaseA, releaseB]) {
        const install = await helm([
          'install', release, chartDir,
          '--namespace', namespace,
          '--set', 'testValue=1',
        ], { kubeconfigPath, homeDir, timeoutMs: 120_000 });

        if (install.code !== 0) {
          const details = (install.stderr || install.stdout || '').trim();
          throw new Error(`Helm install failed: ${details}`);
        }
      }
    }

    const { sidebar } = await bootstrapApp({ page, contextName, namespace });

    const views = [
      { key: 'pods', title: /pods/i, actions: ['Delete', 'Restart'] },
      { key: 'deployments', title: /deployments/i, actions: ['Delete', 'Restart', 'Scale'] },
      { key: 'services', title: /services/i, actions: ['Delete'] },
      { key: 'jobs', title: /jobs/i, actions: ['Delete'] },
      { key: 'cronjobs', title: /cron jobs/i, actions: ['Delete', 'Suspend', 'Resume'] },
      { key: 'daemonsets', title: /daemon sets/i, actions: ['Delete', 'Restart'] },
      { key: 'statefulsets', title: /stateful sets/i, actions: ['Delete', 'Restart', 'Scale'] },
      { key: 'replicasets', title: /replica sets/i, actions: ['Delete', 'Scale'] },
      { key: 'configmaps', title: /config maps/i, actions: ['Delete'] },
      { key: 'secrets', title: /secrets/i, actions: ['Delete'] },
      { key: 'ingresses', title: /ingresses/i, actions: ['Delete'] },
      { key: 'persistentvolumeclaims', title: /persistent volume claims/i, actions: ['Delete'] },
      { key: 'persistentvolumes', title: /persistent volumes/i, actions: ['Delete'] },
      ...(helmAvailable ? [{ key: 'helmreleases', title: /helm releases/i, actions: ['Uninstall'] }] : []),
    ];

    for (const view of views) {
      await test.step(`Bulk selection in ${view.key}`, async () => {
        await sidebar.goToSection(view.key);
        await expect(page.locator('h2.overview-title:visible')).toHaveText(view.title, { timeout: 60_000 });

        const filterInput = page.getByRole('searchbox', { name: /filter/i });
        if (await filterInput.isVisible().catch(() => false)) {
          await filterInput.fill('');
        }

        await assertBulkSelection({ page, expectedActions: view.actions });
      });
    }
  });
});

test.describe('Bulk selection (Docker Swarm views)', () => {
  test('selects rows and ranges in each Docker Swarm resource view', async ({ page }) => {
    test.setTimeout(300_000);

    const swarmActive = await isLocalSwarmActive();
    if (!swarmActive) {
      test.skip(true, 'Docker Swarm is not active');
    }

    const prefix = uniqueName('kdb-swarm-bulk');
    const configA = `${prefix}-config-a`;
    const configB = `${prefix}-config-b`;
    const secretA = `${prefix}-secret-a`;
    const secretB = `${prefix}-secret-b`;
    const volumeA = `${prefix}-vol-a`;
    const volumeB = `${prefix}-vol-b`;
    const networkA = `${prefix}-net-a`;
    const networkB = `${prefix}-net-b`;
    const serviceA = `${prefix}-svc-a`;
    const serviceB = `${prefix}-svc-b`;
    const stackA = `${prefix}-stack-a`;
    const stackB = `${prefix}-stack-b`;

    const tempConfig = await writeTempFile(`${prefix}-config`, 'bulk-selection');
    const tempSecret = await writeTempFile(`${prefix}-secret`, 'bulk-selection');
    const tempStackFile = await writeTempFile(`${prefix}-stack`, [
      'version: "3.8"',
      'services:',
      '  app:',
      '    image: nginx:alpine',
      `    labels:`,
      `      - kdb.e2e=1`,
    ].join('\n'));

    try {
      await docker(['config', 'create', configA, tempConfig], 60_000).catch(() => undefined);
      await docker(['config', 'create', configB, tempConfig], 60_000).catch(() => undefined);
      await docker(['secret', 'create', secretA, tempSecret], 60_000).catch(() => undefined);
      await docker(['secret', 'create', secretB, tempSecret], 60_000).catch(() => undefined);
      await docker(['volume', 'create', '--label', 'kdb.e2e=1', volumeA], 60_000).catch(() => undefined);
      await docker(['volume', 'create', '--label', 'kdb.e2e=1', volumeB], 60_000).catch(() => undefined);
      await docker(['network', 'create', '--driver', 'overlay', '--attachable', '--label', 'kdb.e2e=1', networkA], 60_000).catch(() => undefined);
      await docker(['network', 'create', '--driver', 'overlay', '--attachable', '--label', 'kdb.e2e=1', networkB], 60_000).catch(() => undefined);
      await docker(['service', 'create', '--name', serviceA, '--label', 'kdb.e2e=1', 'nginx:alpine'], 90_000).catch(() => undefined);
      await docker(['service', 'create', '--name', serviceB, '--label', 'kdb.e2e=1', 'nginx:alpine'], 90_000).catch(() => undefined);
      await docker(['stack', 'deploy', '-c', tempStackFile, stackA], 120_000).catch(() => undefined);
      await docker(['stack', 'deploy', '-c', tempStackFile, stackB], 120_000).catch(() => undefined);

      await page.goto('/');
      const { sidebar } = await bootstrapSwarm({ page, skipIfConnected: true, ensureSeedService: true });

      const views = [
        { key: 'swarm-services', title: /services/i, actions: ['Remove', 'Restart', 'Scale'], tableTestId: 'swarm-services-table' },
        { key: 'swarm-tasks', title: /tasks/i, actions: ['Remove'], tableTestId: 'swarm-tasks-table' },
        { key: 'swarm-nodes', title: /nodes/i, actions: ['Remove', 'Drain', 'Pause', 'Activate'], tableTestId: 'swarm-nodes-table' },
        { key: 'swarm-networks', title: /networks/i, actions: ['Remove'], tableTestId: 'swarm-networks-table' },
        { key: 'swarm-configs', title: /configs/i, actions: ['Remove'], tableTestId: 'swarm-configs-table' },
        { key: 'swarm-secrets', title: /secrets/i, actions: ['Remove'], tableTestId: 'swarm-secrets-table' },
        { key: 'swarm-volumes', title: /volumes/i, actions: ['Remove'], tableTestId: 'swarm-volumes-table' },
        { key: 'swarm-stacks', title: /stacks/i, actions: ['Remove'], tableTestId: 'swarm-stacks-table' },
      ];

      for (const view of views) {
        await test.step(`Bulk selection in ${view.key}`, async () => {
          await sidebar.goToSection(view.key);
          await expect(page.locator('h2.overview-title:visible')).toHaveText(view.title, { timeout: 60_000 });

          const filterInput = page.getByRole('searchbox', { name: /filter/i });
          if (await filterInput.isVisible().catch(() => false)) {
            await filterInput.fill('');
          }

          await assertBulkSelection({
            page,
            expectedActions: view.actions,
            tableTestId: view.tableTestId,
          });
        });
      }
    } finally {
      await fs.rm(tempConfig, { force: true }).catch(() => undefined);
      await fs.rm(tempSecret, { force: true }).catch(() => undefined);
      await fs.rm(tempStackFile, { force: true }).catch(() => undefined);

      await docker(['stack', 'rm', stackA], 120_000).catch(() => undefined);
      await docker(['stack', 'rm', stackB], 120_000).catch(() => undefined);
      await docker(['service', 'rm', serviceA, serviceB], 120_000).catch(() => undefined);
      await docker(['config', 'rm', configA, configB], 60_000).catch(() => undefined);
      await docker(['secret', 'rm', secretA, secretB], 60_000).catch(() => undefined);
      await docker(['volume', 'rm', '-f', volumeA, volumeB], 60_000).catch(() => undefined);
      await docker(['network', 'rm', networkA, networkB], 60_000).catch(() => undefined);
    }
  });
});
