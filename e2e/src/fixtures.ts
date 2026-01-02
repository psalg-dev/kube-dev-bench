import path from 'node:path';
import fs from 'node:fs/promises';
import { test as base, chromium, type Browser, type Page, type WorkerInfo } from '@playwright/test';
import { repoRoot } from './support/paths.js';
import { readRunState } from './support/run-state.js';
import { ensureNamespace, deleteNamespace, writeKubeconfigFile } from './support/kind.js';
import { startWailsDev, stopWailsDev, type WailsDevInstance } from './support/wails.js';

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
    const dir = path.join(repoRoot, 'e2e', '.playwright-artifacts-' + state.runId, `home-w${workerInfo.workerIndex}`);
    await fs.mkdir(dir, { recursive: true });
    await use(dir);
  }, { scope: 'worker' }],

  kubeconfigPath: [async ({ homeDir }, use: (value: string) => Promise<void>) => {
    const state = await readRunState();
    const kubeDir = path.join(repoRoot, 'e2e', '.playwright-artifacts-' + state.runId, 'kube');
    const kubeconfigPath = await writeKubeconfigFile(kubeDir, state.kubeconfigYaml);
    await use(kubeconfigPath);
  }, { scope: 'worker' }],

  contextName: [async ({}, use: (value: string) => Promise<void>) => {
    const state = await readRunState();
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

    const port = 34115 + workerInfo.workerIndex;
    const instance = await startWailsDev({ repoRoot, port, homeDir });
    try {
      await use(instance);
    } finally {
      await stopWailsDev(instance);
    }
  }, { scope: 'worker' }],

  appBaseURL: [async ({ wails }, use: (value: string) => Promise<void>) => {
    const state = await readRunState();
    if (state.sharedBaseURL) {
      await use(state.sharedBaseURL);
      return;
    }

    if (!wails) {
      throw new Error('Expected a per-worker Wails instance on non-Windows platforms.');
    }
    await use(wails.baseURL);
  }, { scope: 'worker' }],

  // Per-test: isolated browser context (but same backend per worker)
  browser: async ({}, use: (value: Browser) => Promise<void>) => {
    const browser = await chromium.launch({ headless: !!process.env.CI });
    await use(browser);
    await browser.close();
  },

  page: async ({ browser, appBaseURL }, use: (value: Page) => Promise<void>) => {
    const context = await browser.newContext({ baseURL: appBaseURL });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});

export const expect = test.expect;
