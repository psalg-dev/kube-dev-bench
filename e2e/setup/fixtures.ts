import { test as base, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { exec as execCb } from 'node:child_process';
import { promisify } from 'node:util';
import { getRepoRoot } from './helpers';

const execAsync = promisify(execCb);

type ExecFn = (command: string) => Promise<{ stdout: string; stderr: string }>;

// Auto-fixture that clears per-test HOME state used by wails dev
// Also provides exec fixture for running kubectl commands via docker compose
export const test = base.extend<{ _isolate: void; exec: ExecFn }>({
  _isolate: [async ({}, use) => {
    const repoRoot = getRepoRoot();
    const tempHome = path.join(repoRoot, 'e2e', '.home-e2e');
    // Clean app state and kube dir to avoid cross-test leakage
    try { await fs.promises.rm(path.join(tempHome, 'KubeDevBench'), { recursive: true, force: true }); } catch {}
    try { await fs.promises.rm(path.join(tempHome, '.kube'), { recursive: true, force: true }); } catch {}
    await use();
  }, { auto: true }],

  exec: async ({}, use) => {
    const repoRoot = getRepoRoot();
    const composeFile = path.join(repoRoot, 'kind', 'docker-compose.yml');

    const execFn: ExecFn = async (command: string) => {
      // Run command via docker compose exec in the kind container
      // Use sh -c to properly handle complex commands with heredocs
      const escapedCommand = command.replace(/'/g, "'\\''");
      const fullCommand = `docker compose -f "${composeFile}" exec -T kind sh -c '${escapedCommand}'`;
      return execAsync(fullCommand, { cwd: repoRoot });
    };

    await use(execFn);
  },
});

export { expect };
