import path from 'node:path';
import fs from 'node:fs/promises';
import { test as base, chromium, type Browser, type Page, type WorkerInfo, expect as playwrightExpect } from '@playwright/test';
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
  consoleErrors: string[];
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

  page: async ({ browser, consoleErrors }, use: (value: Page) => Promise<void>, workerInfo: WorkerInfo) => {
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

    // Capture browser console errors and page errors globally
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[console.error] ${msg.text()}`);
      }
    });
    page.on('pageerror', (err) => {
      consoleErrors.push(`[pageerror] ${err.message}\n${err.stack || ''}`);
    });

    await use(page);
    await context.close();

    // Filter out expected/transient errors that occur in dev mode (Vite HMR, WebSocket, etc.)
    const ignoredPatterns = [
      /vite.*failed to connect to websocket/i,
      /websocket.*handshake.*502/i,
      /websocket.*handshake.*400/i,
      /websocket.*ERR_CONNECTION_REFUSED/i,
      /502.*bad gateway/i,
      /failed to load resource.*502/i,
      /failed to load resource.*net::ERR_/i,
      /ERR_ADDRESS_IN_USE/i,
      /EventsNotify/i,  // Wails IPC transient errors during WebSocket reconnection
      /EventsOnMultiple/i,  // Wails IPC not ready during app initialization
      /Cannot read properties of undefined \(reading 'main'\)/i,  // Wails IPC not ready
      /Cannot read properties of undefined \(reading 'EventsOnMultiple'\)/i,  // Wails IPC not ready
      /React Router caught the following error during render/i,  // React error boundary recovery
      /RenderErrorBoundary/i,  // React error boundary recovery messages
      /Failed to load Holmes config/i,  // Holmes init race condition (non-critical)
      /ScanClusterHealth failed/i,  // Transient K8s API connectivity during parallel testing
      /dial tcp.*connectex:/i,  // Windows socket connection errors during parallel testing
    ];
    const filteredErrors = consoleErrors.filter((err) => {
      return !ignoredPatterns.some((pattern) => pattern.test(err));
    });

    // Fail the test if any non-ignored console errors were captured
    if (filteredErrors.length > 0) {
      const errorSummary = filteredErrors.join('\n---\n');
      playwrightExpect.soft(filteredErrors, `Browser console errors detected:\n${errorSummary}`).toHaveLength(0);
    }
  },

  // Shared array to collect console errors during the test
  consoleErrors: async ({}, use: (value: string[]) => Promise<void>) => {
    const errors: string[] = [];
    await use(errors);
  },
});

export const expect = test.expect;
