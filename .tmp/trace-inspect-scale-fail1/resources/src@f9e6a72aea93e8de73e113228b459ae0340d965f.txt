import path from 'node:path';
import fs from 'node:fs/promises';
import { test as base, chromium, type Browser, type Page, type WorkerInfo } from '@playwright/test';
import { repoRoot } from './support/paths.js';
import { readRunState } from './support/run-state.js';
import { ensureNamespace, deleteNamespace, writeNamedKubeconfigFile } from './support/kind.js';
import type { WailsDevInstance } from './support/wails.js';

type WorkerFixtures = {
  wails: WailsDevInstance | null;
  appBaseURL: string;
  homeDir: string;
  kubeconfigPath: string;
  namespace: string;
  contextName: string;
};

type TestFixtures = {
  page: Page;
  browser: Browser;
};

export const test = base.extend<TestFixtures, WorkerFixtures>({
  // Per-worker: isolated home dir + wails dev instance + k8s namespace
  homeDir: [async ({}, use: (value: string) => Promise<void>, workerInfo: WorkerInfo) => {
    const state = await readRunState();

    // When Wails instances are pre-started in global setup, they already have an
    // assigned per-instance home dir. Use that so tests can coordinate via FS.
    if (state.sharedBaseURL && state.sharedHomeDir) {
      await fs.mkdir(state.sharedHomeDir, { recursive: true });
      await use(state.sharedHomeDir);
      return;
    }

    if (Array.isArray(state.wailsInstances) && state.wailsInstances.length > 0) {
      const inst = state.wailsInstances[workerInfo.workerIndex % state.wailsInstances.length];
      if (inst?.homeDir) {
        await fs.mkdir(inst.homeDir, { recursive: true });
        await use(inst.homeDir);
        return;
      }
    }

    // Fallback: derive a per-worker home dir from runId.
    const dir = path.join(repoRoot, 'e2e', '.playwright-artifacts-' + state.runId, `home-w${workerInfo.workerIndex}`);
    await fs.mkdir(dir, { recursive: true });
    await use(dir);
  }, { scope: 'worker' }],

  kubeconfigPath: [async ({ homeDir }, use: (value: string) => Promise<void>, workerInfo: WorkerInfo) => {
    const state = await readRunState();
    const kubeDir = path.join(repoRoot, 'e2e', '.playwright-artifacts-' + state.runId, 'kube');
    if (!state.kubeconfigYaml) {
      throw new Error(
        'kubeconfigYaml missing from E2E run state. ' +
          'If you are running Swarm-only E2Es, do not request `kubeconfigPath`/`namespace`/`contextName` fixtures. ' +
          'Otherwise, ensure KinD setup ran successfully (and do not set `E2E_SKIP_KIND=1`).'
      );
    }

    const kubeconfigPath = await writeNamedKubeconfigFile(
      kubeDir,
      `kubeconfig-w${workerInfo.workerIndex}`,
      state.kubeconfigYaml
    );
    await use(kubeconfigPath);
  }, { scope: 'worker' }],

  contextName: [async ({}, use: (value: string) => Promise<void>) => {
    const state = await readRunState();
    if (!state.contextName) {
      throw new Error(
        'contextName missing from E2E run state. ' +
          'If you are running Swarm-only E2Es, do not request the `contextName` fixture. ' +
          'Otherwise, ensure KinD setup ran successfully (and do not set `E2E_SKIP_KIND=1`).'
      );
    }
    await use(state.contextName);
  }, { scope: 'worker' }],

  namespace: [async ({ kubeconfigPath }, use: (value: string) => Promise<void>, workerInfo: WorkerInfo) => {
    const state = await readRunState();
    const ns = `kdb-e2e-${state.runId}-w${workerInfo.workerIndex}`;
    await ensureNamespace(kubeconfigPath, ns);
    try {
      await use(ns);
    } finally {
      await deleteNamespace(kubeconfigPath, ns);
    }
  }, { scope: 'worker' }],

  wails: [async ({ homeDir }, use: (value: WailsDevInstance | null) => Promise<void>, workerInfo: WorkerInfo) => {
    const state = await readRunState();
    if (state.sharedBaseURL) {
      await use(null);
      return;
    }

    // Wails instances are pre-started in global setup to avoid expensive parallel builds.
    // Workers simply attach to their assigned instance.
    await use(null);
  }, { scope: 'worker' }],

  appBaseURL: [async ({ wails }, use: (value: string) => Promise<void>) => {
    const state = await readRunState();
    if (state.sharedBaseURL) {
      await use(state.sharedBaseURL);
      return;
    }

    if (!Array.isArray(state.wailsInstances) || state.wailsInstances.length === 0) {
      throw new Error('Expected pre-started Wails instances in run state.');
    }
    // The actual selection happens in the page fixture (it has workerInfo), so default to first.
    await use(state.wailsInstances[0].baseURL);
  }, { scope: 'worker' }],

  // Per-test: isolated browser context (but same backend per worker)
  browser: async ({}, use: (value: Browser) => Promise<void>) => {
    const browser = await chromium.launch({ headless: !!process.env.CI });
    await use(browser);
    await browser.close();
  },

  page: async ({ browser }, use: (value: Page) => Promise<void>, workerInfo: WorkerInfo) => {
    const state = await readRunState();
    const baseURL = state.sharedBaseURL
      ? state.sharedBaseURL
      : state.wailsInstances && state.wailsInstances.length > 0
        ? state.wailsInstances[workerInfo.workerIndex % state.wailsInstances.length].baseURL
        : undefined;

    if (!baseURL) {
      throw new Error('No app baseURL available (missing sharedBaseURL or wailsInstances).');
    }

    // Playwright stores intermediate trace artifacts under:
    //   <outputDir>/.playwright-artifacts-<workerIndex>/traces
    // On some Windows setups, these directories are not created automatically before trace writing,
    // resulting in ENOENT during context.close(). Create them proactively.
    const pwArtifactsRoot = path.join(repoRoot, 'e2e', 'test-results', `.playwright-artifacts-${workerInfo.workerIndex}`);
    await fs.mkdir(path.join(pwArtifactsRoot, 'traces'), { recursive: true });

    const context = await browser.newContext({ baseURL });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export const expect = test.expect;
