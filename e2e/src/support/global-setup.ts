import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ensureKindCluster } from './kind.js';
import { writeRunState } from './run-state.js';
import { e2eRoot, withinRepo } from './paths.js';
import { startWailsDev } from './wails.js';
import { ensureProxyServer } from './proxy.js';

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

  // Some TS environments/types can narrow `process.platform` unexpectedly; treat it as a string.
  const platform = process.platform as unknown as string;
  const isWin32 = platform === 'win32';

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

  // Start a local proxy suitable for real cluster connections.
  // Some E2Es validate proxy behavior and require a working CONNECT proxy.
  const proxy = await ensureProxyServer({ repoRoot: withinRepo(), readyTimeoutMs: process.env.CI ? 60_000 : 15_000 });

  // Shared-server mode:
  // - Windows: multiple `wails dev` processes in the same repo can collide on temp resource files.
  // - CI/Linux: per-worker `wails dev` startup can exceed the 30s per-test timeout.
  // Start one shared server and let workers run parallel browser sessions.
  const sharedServerMode =
    isWin32 ||
    process.env.E2E_SHARED_SERVER === '1' ||
    (!!process.env.CI && !isWin32);

  if (sharedServerMode) {
    const homeDir = path.join(e2eRoot, `.playwright-artifacts-${runId}`, 'home-shared');
    await fs.mkdir(homeDir, { recursive: true });

    // If a previous run was interrupted (Ctrl+C), the shared server may still be running.
    // Reuse it instead of starting a new one and hanging on port conflicts.
    // Use 127.0.0.1 (not localhost) to avoid IPv6 ::1 resolution issues on Windows.
    const sharedBaseURL = 'http://127.0.0.1:34115';
    const alreadyRunning = await isHttpOk(sharedBaseURL);

    const instance = alreadyRunning
      ? null
      : await startWailsDev({
          repoRoot: withinRepo(),
          port: 34115,
          homeDir,
          // Allow more time in CI/global setup while keeping per-test timeouts strict.
          readyTimeoutMs: process.env.CI ? 120_000 : 90_000,
        });

    await writeRunState({
      runId,
      clusterName: kind.clusterName,
      contextName: kind.contextName,
      kubeconfigYaml: kind.kubeconfigYaml,
      proxyBaseURL: proxy.baseURL,
      proxyPid: proxy.pid,
      sharedBaseURL: alreadyRunning ? sharedBaseURL : instance!.baseURL,
      sharedWailsPid: alreadyRunning ? undefined : (instance!.process.pid ?? undefined),
    });
  } else {
    await writeRunState({
      runId,
      clusterName: kind.clusterName,
      contextName: kind.contextName,
      kubeconfigYaml: kind.kubeconfigYaml,
      proxyBaseURL: proxy.baseURL,
      proxyPid: proxy.pid,
    });
  }

  // Ensure artifacts folder exists
  await fs.mkdir(path.join(e2eRoot, 'test-results'), { recursive: true });
}
