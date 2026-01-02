import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ensureKindCluster } from './kind.js';
import { writeRunState } from './run-state.js';
import { e2eRoot, withinRepo } from './paths.js';
import { startWailsDev } from './wails.js';

async function isHttpOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

export default async function globalSetup() {
  const runId = process.env.E2E_RUN_ID || crypto.randomBytes(6).toString('hex');
  const clusterName = process.env.KIND_CLUSTER_NAME || 'kdb-e2e';

  // Ensure frontend build exists (wails dev will serve from dist)
  const distIndex = withinRepo('frontend', 'dist', 'index.html');
  try {
    await fs.stat(distIndex);
  } catch {
    throw new Error(
      `Missing frontend build at ${distIndex}.\n` +
        `Run: cd frontend && npm install && npm run build`
    );
  }

  const kind = await ensureKindCluster(clusterName);

  // Windows note: running multiple `wails dev` processes concurrently in the same repo can collide
  // on temporary resource files (e.g. <outputfilename>-res.syso). To keep parallel Playwright workers
  // working locally on Windows, start one shared server and let workers run parallel browser sessions.
  if (process.platform === 'win32') {
    const homeDir = path.join(e2eRoot, `.playwright-artifacts-${runId}`, 'home-shared');
    await fs.mkdir(homeDir, { recursive: true });

    // If a previous run was interrupted (Ctrl+C), the shared server may still be running.
    // Reuse it instead of starting a new one and hanging on port conflicts.
    const sharedBaseURL = 'http://localhost:34115';
    const sharedViteURL = 'http://127.0.0.1:5173';
    const alreadyRunning = (await isHttpOk(sharedBaseURL)) && (await isHttpOk(sharedViteURL));

    const instance = alreadyRunning
      ? null
      : await startWailsDev({ repoRoot: withinRepo(), port: 34115, homeDir, readyTimeoutMs: 30_000 });

    await writeRunState({
      runId,
      clusterName: kind.clusterName,
      contextName: kind.contextName,
      kubeconfigYaml: kind.kubeconfigYaml,
      sharedBaseURL: alreadyRunning ? sharedBaseURL : instance!.baseURL,
      sharedWailsPid: alreadyRunning ? undefined : (instance!.process.pid ?? undefined),
      sharedVitePid: alreadyRunning ? undefined : (instance!.viteProcess.pid ?? undefined),
    });
  } else {
    await writeRunState({
      runId,
      clusterName: kind.clusterName,
      contextName: kind.contextName,
      kubeconfigYaml: kind.kubeconfigYaml,
    });
  }

  // Ensure artifacts folder exists
  await fs.mkdir(path.join(e2eRoot, 'test-results'), { recursive: true });
}
