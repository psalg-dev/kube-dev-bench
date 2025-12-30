import { test as base, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { getRepoRoot } from './helpers';

// Auto-fixture that clears per-test HOME state used by wails dev
export const test = base.extend<{ _isolate: void }>({
  _isolate: [async ({}, use) => {
    const repoRoot = getRepoRoot();
    const tempHome = path.join(repoRoot, 'e2e', '.home-e2e');
    // Clean app state and kube dir to avoid cross-test leakage
    try { await fs.promises.rm(path.join(tempHome, 'KubeDevBench'), { recursive: true, force: true }); } catch {}
    try { await fs.promises.rm(path.join(tempHome, '.kube'), { recursive: true, force: true }); } catch {}
    await use();
  }, { auto: true }],
});

export { expect };
