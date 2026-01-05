import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import { ensureKindCluster } from './kind.js';
import { writeRunState } from './run-state.js';
import { e2eRoot, withinRepo } from './paths.js';
import { startWailsDev } from './wails.js';
import { ensureProxyServer } from './proxy.js';
import { exec } from './exec.js';
import { startFrontendPreviewServer } from './frontend-preview.js';
import { cleanupLocalDockerSwarmResources } from './docker-swarm.js';

async function isHttpOk(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: 'GET' });
    return res.status >= 200 && res.status < 500;
  } catch {
    return false;
  }
}

async function killWindowsListenerOnPort(port: number) {
  // Best-effort cleanup for interrupted runs:
  // shared Wails dev uses a fixed port, and reusing a stale process means tests run against old code.
  const { stdout } = await exec('cmd.exe', ['/c', 'netstat -ano -p tcp'], { timeoutMs: 10_000 });
  const pids = new Set<string>();
  for (const line of stdout.split(/\r?\n/)) {
    if (!line.includes(`:${port}`)) continue;
    if (!/\bLISTENING\b/i.test(line)) continue;
    const parts = line.trim().split(/\s+/);
    const pid = parts.at(-1);
    if (pid && /^\d+$/.test(pid)) pids.add(pid);
  }

  for (const pid of pids) {
    try {
      await exec('taskkill', ['/PID', pid, '/F', '/T'], { timeoutMs: 10_000 });
    } catch {
      // ignore
    }
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

  // Docker Swarm E2Es assume Swarm is already initialized.
  // If Swarm is active, clean all Swarm resources so the test run starts from a known state.
  await cleanupLocalDockerSwarmResources({ log: (msg) => console.log(msg) });

  const kind = await ensureKindCluster(clusterName);

  // Start a local proxy suitable for real cluster connections.
  // Some E2Es validate proxy behavior and require a working CONNECT proxy.
  const proxy = await ensureProxyServer({ repoRoot: withinRepo(), readyTimeoutMs: process.env.CI ? 60_000 : 15_000 });

  // Serve the built frontend via a single vite preview server.
  // This avoids each Wails instance spawning its own frontend dev watcher.
  const frontendPort = Number(process.env.E2E_FRONTEND_PORT || 35173);
  const frontend = await startFrontendPreviewServer({
    repoRoot: withinRepo(),
    port: frontendPort,
    readyTimeoutMs: process.env.CI ? 60_000 : 20_000,
  });

  // Shared-server mode:
  // - Windows: multiple `wails dev` processes in the same repo can collide on temp resource files.
  // - CI/Linux: per-worker `wails dev` startup can exceed the 30s per-test timeout.
  // Start one shared server and let workers run parallel browser sessions.
  // IMPORTANT: A shared Wails server holds global backend/UI state (selected namespaces, etc.),
  // which causes cross-test interference when Playwright runs multiple workers.
  // Therefore shared-server mode must be an explicit opt-in.
  const sharedServerMode = process.env.E2E_SHARED_SERVER === '1';

  if (sharedServerMode) {
    const homeDir = path.join(e2eRoot, `.playwright-artifacts-${runId}`, 'home-shared');
    await fs.mkdir(homeDir, { recursive: true });

    // Use 127.0.0.1 (not localhost) to avoid IPv6 ::1 resolution issues on Windows.
    const sharedBaseURL = 'http://127.0.0.1:34115';
    if (isWin32) {
      // Always clear the port before starting. The listener may be stale and not
      // return HTTP (so isHttpOk() would be false) but still prevents binding.
      await killWindowsListenerOnPort(34115);
    }

    const instance = await startWailsDev({
      repoRoot: withinRepo(),
      port: 34115,
      homeDir,
      frontendDevServerURL: frontend.baseURL,
      // Allow more time in CI/global setup while keeping per-test timeouts strict.
      readyTimeoutMs: process.env.CI ? 240_000 : 180_000,
    });

    await writeRunState({
      runId,
      clusterName: kind.clusterName,
      contextName: kind.contextName,
      kubeconfigYaml: kind.kubeconfigYaml,
      proxyBaseURL: proxy.baseURL,
      proxyPid: proxy.pid,
      frontendBaseURL: frontend.baseURL,
      frontendPid: frontend.process?.pid ?? undefined,
      sharedBaseURL: instance.baseURL,
      sharedWailsPid: instance.process.pid ?? undefined,
    });
  } else {
    const defaultInstanceCount = process.env.PW_WORKERS
      ? Number(process.env.PW_WORKERS)
      : isWin32
        ? 1
        : 4;

    const instanceCountRaw = process.env.E2E_WAILS_INSTANCES
      ? Number(process.env.E2E_WAILS_INSTANCES)
      : defaultInstanceCount;

    const instanceCount = Number.isFinite(instanceCountRaw) ? Math.max(1, instanceCountRaw) : (isWin32 ? 1 : 4);
    const basePort = Number(process.env.E2E_WAILS_BASE_PORT || 34200);
    const wailsInstances: Array<{ baseURL: string; pid?: number; port?: number }> = [];

    for (let i = 0; i < instanceCount; i++) {
      const port = basePort + i;
      if (isWin32) {
        await killWindowsListenerOnPort(port);
      }

      const homeDir = path.join(e2eRoot, `.playwright-artifacts-${runId}`, `home-w${i}`);
      await fs.mkdir(homeDir, { recursive: true });

      const instance = await startWailsDev({
        repoRoot: withinRepo(),
        port,
        homeDir,
        frontendDevServerURL: frontend.baseURL,
        // Sequential startup in global setup; allow more time here.
        readyTimeoutMs: process.env.CI ? 300_000 : 240_000,
      });

      wailsInstances.push({ baseURL: instance.baseURL, pid: instance.process.pid ?? undefined, port });
    }

    await writeRunState({
      runId,
      clusterName: kind.clusterName,
      contextName: kind.contextName,
      kubeconfigYaml: kind.kubeconfigYaml,
      proxyBaseURL: proxy.baseURL,
      proxyPid: proxy.pid,
      frontendBaseURL: frontend.baseURL,
      frontendPid: frontend.process?.pid ?? undefined,
      wailsInstances,
    });
  }

  // Ensure artifacts folder exists
  await fs.mkdir(path.join(e2eRoot, 'test-results'), { recursive: true });
}
