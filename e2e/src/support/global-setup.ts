import crypto from 'node:crypto';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import type { FullConfig } from '@playwright/test';
import { cleanupWorkerNamespaces, ensureKindCluster, writeKubeconfigFile } from './kind.js';
import type { KindInfo } from './kind.js';
import { writeRunState } from './run-state.js';
import { e2eRoot, withinRepo } from './paths.js';
import { startWailsDev, startPrebuiltApp } from './wails.js';
import { ensureProxyServer } from './proxy.js';
import { ensureHolmesMockServer } from './holmes-mock.js';
import { exec } from './exec.js';
import { ensureJFrogJcrBootstrapped } from './jfrog.js';
import { ensureArtifactory } from './artifactory-bootstrap.js';
import {
  cleanupLocalDockerSwarmResources,
  deploySwarmStackFromFile,
  ensureSwarmConfig,
  ensureSwarmNetwork,
  ensureSwarmSecret,
  ensureLocalSwarmActive,
  isLocalSwarmActive,
  waitForStackServicesReady,
} from './docker-swarm.js';

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

function isMissingBinaryError(err: unknown): boolean {
  const anyErr = err as { code?: string; message?: string };
  return anyErr?.code === 'ENOENT' || /ENOENT/i.test(anyErr?.message ?? '');
}

function isoNow() {
  return new Date().toISOString();
}

function fmtMs(ms: number) {
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
}

function shouldAutoSkipKindForSwarmOnly(): boolean {
  const cliArgs = process.argv.slice(2);
  const testTargets = cliArgs.filter((arg) => arg !== 'test' && !arg.startsWith('-'));
  if (testTargets.length === 0) return false;

  return testTargets.every((arg) => {
    const normalized = arg.replace(/\\/g, '/');
    return normalized.includes('tests/swarm/');
  });
}

async function timed<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now();
  console.log(`[e2e][setup] ${isoNow()} ▶ ${label}`);
  try {
    const res = await fn();
    console.log(`[e2e][setup] ${isoNow()} ✓ ${label} (${fmtMs(Date.now() - start)})`);
    return res;
  } catch (err) {
    console.log(`[e2e][setup] ${isoNow()} ✗ ${label} (${fmtMs(Date.now() - start)})`);
    throw err;
  }
}

export default async function globalSetup(config: FullConfig) {
  const setupStart = Date.now();
  const runId = process.env.E2E_RUN_ID || crypto.randomBytes(6).toString('hex');
  const clusterName = process.env.KIND_CLUSTER_NAME || 'kdb-e2e';
  const skipKindEnv = process.env.E2E_SKIP_KIND === '1';
  const skipKindAuto = shouldAutoSkipKindForSwarmOnly();
  const skipKind = skipKindEnv || skipKindAuto;
  const registrySuite = process.env.E2E_REGISTRY_SUITE === '1';
  const isCI = process.env.CI === 'true' || process.env.CI === '1';

  // Some TS environments/types can narrow `process.platform` unexpectedly; treat it as a string.
  const platform = process.platform as unknown as string;
  const isWin32 = platform === 'win32';

  // Prebuilt binary mode: skip `wails dev` recompilation by spawning a
  // pre-compiled dev binary directly.  Set E2E_PREBUILT_BINARY to the absolute
  // path of a binary built with `-tags dev -gcflags "all=-N -l"`.
  const prebuiltBinary = process.env.E2E_PREBUILT_BINARY || '';
  const usePrebuilt = prebuiltBinary.length > 0;
  if (usePrebuilt) {
    try {
      await fs.stat(prebuiltBinary);
    } catch {
      throw new Error(
        `E2E_PREBUILT_BINARY is set but the file does not exist: ${prebuiltBinary}\n` +
          `Build it with: go build -tags dev -gcflags "all=-N -l" -o ${prebuiltBinary} .`
      );
    }
  }

  console.log(
    `[e2e][setup] ${isoNow()} starting runId=${runId} platform=${platform} ` +
      `cluster=${clusterName} skipKind=${skipKind} sharedServer=${process.env.E2E_SHARED_SERVER === '1'}` +
      (usePrebuilt ? ` prebuilt=${prebuiltBinary}` : '')
  );

  if (skipKindAuto && !skipKindEnv) {
    console.log(`[e2e][setup] ${isoNow()} auto-skip KinD for Swarm-only run`);
  }
  if (!registrySuite) {
    console.log(`[e2e][setup] ${isoNow()} registry suite disabled; skipping JFrog bootstrap`);
  }

  if (isCI) {
    await timed('ensure Docker Swarm is active (CI)', async () =>
      ensureLocalSwarmActive({
        strict: true,
        advertiseAddr: process.env.E2E_SWARM_ADVERTISE_ADDR || '127.0.0.1',
        log: (msg) => console.log(msg),
      })
    );
  }

  // Ensure frontend build exists (wails dev will serve from dist)
  const distIndex = withinRepo('frontend', 'dist', 'index.html');
  await timed('verify frontend dist exists', async () => {
    try {
      await fs.stat(distIndex);
    } catch {
      throw new Error(
        `Missing frontend build at ${distIndex}.\n` +
          `Run: cd frontend && npm install && npm run build`
      );
    }
  });

  // Docker Swarm E2Es assume Swarm is already initialized.
  // If Swarm is active, clean all Swarm resources so the test run starts from a known state.
  await timed('cleanup local Docker Swarm resources (best-effort)', async () => {
    await cleanupLocalDockerSwarmResources({ log: (msg) => console.log(msg) });
  });

  // Deploy deterministic Swarm fixtures once per run.
  // This avoids slow per-test fixture setup that can exceed individual test timeouts.
  const swarmActive = await timed('detect Docker Swarm', async () => isLocalSwarmActive());
  if (swarmActive) {
    const fixtureStackName = 'kdb-e2e-fixtures';
    await timed('ensure Swarm fixtures (config/secret/network)', async () => {
      await ensureSwarmConfig({ name: 'kdb_e2e_config', content: 'kube-dev-bench e2e config\n' });
      await ensureSwarmSecret({ name: 'kdb_e2e_secret', content: 'kube-dev-bench e2e secret\n' });
      await ensureSwarmNetwork({ name: 'kdb_e2e_net' });
    });

    const stackFilePath = withinRepo('stack.yml');
    await timed(`deploy Swarm stack '${fixtureStackName}'`, async () => {
      try {
        await deploySwarmStackFromFile({ stackName: fixtureStackName, stackFilePath });
      } catch (err: unknown) {
        const msg = String((err as { message?: string })?.message ?? err);
        // Occasionally Docker reports the external overlay network as missing right after
        // cleanup/creation. Re-ensure the network and retry once to de-flake global setup.
        if (
          /network\s+kdb_e2e_net\s+not\s+found/i.test(msg) ||
          /network\s+"?kdb_e2e_net"?\s+is\s+declared\s+as\s+external,\s+but\s+could\s+not\s+be\s+found/i.test(msg)
        ) {
          await ensureSwarmNetwork({ name: 'kdb_e2e_net' });
          await deploySwarmStackFromFile({ stackName: fixtureStackName, stackFilePath });
        } else {
          throw err;
        }
      }
      await waitForStackServicesReady({
        stackName: fixtureStackName,
        expectedServiceSuffixes: ['a-replicated', 'b-logger'],
        timeoutMs: process.env.CI ? 300_000 : 240_000,
      });
    });
  } else {
    console.log(`[e2e][setup] ${isoNow()} Docker Swarm not active; skipping Swarm fixtures`);
  }

  let kind: KindInfo | null = null;
  if (!skipKind) {
    try {
      kind = await timed(`ensure KinD cluster '${clusterName}'`, async () => ensureKindCluster(clusterName));
    } catch (err: unknown) {
      // If someone wants to run Swarm-only E2Es without KinD installed, allow opting out.
      // Keep default behavior strict: without `E2E_SKIP_KIND=1`, bubble errors.
      if (isMissingBinaryError(err) && skipKind) {
        console.log('[e2e] kind not found; continuing without Kubernetes run state (E2E_SKIP_KIND=1)');
        kind = null;
      } else {
        throw err;
      }
    }
  }

  if (kind?.kubeconfigYaml) {
    await timed('cleanup stale worker namespaces', async () => {
      const kubeDir = path.join(e2eRoot, `.playwright-artifacts-${runId}`, 'kube');
      const kubeconfigPath = await writeKubeconfigFile(kubeDir, kind.kubeconfigYaml);
      await cleanupWorkerNamespaces(kubeconfigPath, runId, (msg) => console.log(msg));
    });
  }

  // JFrog Artifactory/JCR bootstrap (used by Swarm registry E2Es).
  // Run it once per test run so registry tests are reliable.
  // Always capture logs for debugging setup vs data issues.
  let jfrogLogPath: string | undefined;
  if (registrySuite) {
    try {
      const jfrog = await timed('ensure JFrog JCR is running + bootstrapped', async () =>
        ensureJFrogJcrBootstrapped({ runId })
      );
      jfrogLogPath = jfrog.logPath;

      try {
        await timed('verify Artifactory Docker /v2/ endpoint', async () => {
          await ensureArtifactory();
        });
      } catch (verifyErr: unknown) {
        // Stale local volumes can leave Artifactory in a state where the admin password
        // doesn't match what our bootstrap expects, or the docker-local repo is missing.
        // One deterministic recovery attempt: reset volume and re-bootstrap.
        console.log(`[e2e][setup] ${isoNow()} Artifactory verification failed; retrying with JFrog reset`);

        const jfrog2 = await timed('reset JFrog JCR volume and re-bootstrap', async () =>
          ensureJFrogJcrBootstrapped({ runId, reset: true })
        );
        jfrogLogPath = jfrog2.logPath;

        await timed('re-verify Artifactory Docker /v2/ endpoint', async () => {
          await ensureArtifactory();
        });
      }
    } catch (err: unknown) {
      const msg = String((err as { message?: string })?.message ?? err);
      throw new Error(`${msg}${jfrogLogPath ? `\nJFrog logs: ${jfrogLogPath}` : ''}`);
    }
  }

  // Start a local proxy suitable for real cluster connections.
  // Some E2Es validate proxy behavior and require a working CONNECT proxy.
  let proxy: Awaited<ReturnType<typeof ensureProxyServer>> | null = null;
  let holmesMock: Awaited<ReturnType<typeof ensureHolmesMockServer>> | null = null;
  const startedWailsPids: number[] = [];

  const killPidBestEffort = async (pid: number) => {
    try {
      if (process.platform === 'win32') {
        await exec('taskkill', ['/PID', String(pid), '/T', '/F'], { timeoutMs: 30_000 });
      } else {
        await exec('bash', ['-lc', `kill -TERM ${pid} 2>/dev/null || true; sleep 1; kill -KILL ${pid} 2>/dev/null || true`], {
          timeoutMs: 30_000,
        });
      }
    } catch {
      // ignore
    }
  };

  try {
    proxy = await timed('start local CONNECT proxy', async () =>
      ensureProxyServer({ repoRoot: withinRepo(), readyTimeoutMs: process.env.CI ? 60_000 : 15_000 })
    );
    console.log(`[e2e][setup] ${isoNow()} proxy ready at ${proxy.baseURL} pid=${proxy.pid ?? 'reused'}`);

    // Start Holmes mock server for deterministic AI E2E testing
    holmesMock = await timed('start Holmes mock server', async () =>
      ensureHolmesMockServer({ repoRoot: withinRepo(), readyTimeoutMs: process.env.CI ? 60_000 : 15_000 })
    );
    console.log(`[e2e][setup] ${isoNow()} Holmes mock ready at ${holmesMock.baseURL} pid=${holmesMock.pid ?? 'reused'}`);

    const assetDir = withinRepo('frontend', 'dist');

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
      await timed('clear Windows listener on port 34115', async () => killWindowsListenerOnPort(34115));
    }

    const instance = usePrebuilt
      ? await timed('start shared prebuilt binary (port=34115)', async () =>
          startPrebuiltApp({
            binaryPath: prebuiltBinary,
            repoRoot: withinRepo(),
            logRepoRoot: withinRepo(),
            port: 34115,
            homeDir,
            assetDir,
            // Prebuilt binaries start much faster; keep a reasonable timeout.
            readyTimeoutMs: process.env.CI ? 120_000 : 60_000,
          })
        )
      : await timed('start shared wails dev (port=34115)', async () =>
          startWailsDev({
            repoRoot: withinRepo(),
            logRepoRoot: withinRepo(),
            port: 34115,
            homeDir,
            assetDir,
            readyTimeoutMs: process.env.CI ? 240_000 : 180_000,
          })
        );
    if (typeof instance.process.pid === 'number') startedWailsPids.push(instance.process.pid);

    console.log(`[e2e][setup] ${isoNow()} shared wails ready at ${instance.baseURL} pid=${instance.process.pid ?? 'unknown'}`);

    await writeRunState({
      runId,
      clusterName: kind?.clusterName ?? clusterName,
      contextName: kind?.contextName,
      kubeconfigYaml: kind?.kubeconfigYaml,
      proxyBaseURL: proxy.baseURL,
      proxyPid: proxy.pid,
      jfrogLogPath,
      holmesMockBaseURL: holmesMock?.baseURL,
      holmesMockPid: holmesMock?.pid,
      sharedBaseURL: instance.baseURL,
      sharedWailsPid: instance.process.pid ?? undefined,
      sharedHomeDir: homeDir,
      sharedDialogDir: path.join(homeDir, 'tmp', 'kdb-e2e-dialogs'),
    });
  } else {
    // Prefer the actual worker count Playwright will use. This includes CLI overrides
    // like `npx playwright test --workers=4`, which are not reflected in env vars.
    const configuredWorkers = Number.isFinite(config?.workers) && (config?.workers ?? 0) > 0
      ? (config.workers as number)
      : undefined;

    const defaultInstanceCount = process.env.PW_WORKERS
      ? Number(process.env.PW_WORKERS)
      : (configuredWorkers ?? 4);

    const instanceCountRaw = process.env.E2E_WAILS_INSTANCES
      ? Number(process.env.E2E_WAILS_INSTANCES)
      : defaultInstanceCount;

    const instanceCount = Number.isFinite(instanceCountRaw) ? Math.max(1, instanceCountRaw) : 4;
    const basePort = Number(process.env.E2E_WAILS_BASE_PORT || 34200);
    const wailsInstances: Array<{ baseURL: string; pid?: number; port?: number; homeDir?: string; dialogDir?: string }> = [];

    console.log(
      `[e2e][setup] ${isoNow()} starting wails pool instances=${instanceCount} basePort=${basePort} ` +
        `workers=${String(config?.workers ?? 'unknown')} (configuredWorkers=${configuredWorkers ?? 'n/a'})`
    );

    const repoRootForWails = async (i: number): Promise<string> => {
      // Windows-only mitigation (opt-in): create a per-instance overlay repo.
      // NOTE: Go's embed can fail when embedding through Windows junctions.
      // Therefore this strategy is disabled by default; enable only if needed.
      const overlayEnv = process.env.E2E_WAILS_OVERLAY_REPO;
      const useOverlayRepo = overlayEnv === '1' || (overlayEnv !== '0' && isWin32 && instanceCount > 1);
      if (!isWin32 || instanceCount <= 1 || !useOverlayRepo) return withinRepo();

      const baseRepoRoot = withinRepo();
      // IMPORTANT: keep copies OUTSIDE the repo root to avoid recursive copying.
      const repoCopyRoot = path.join(os.tmpdir(), `kdb-e2e-wails-${runId}`, `wails-repo-w${i}`);
      const marker = path.join(repoCopyRoot, '.kdb-e2e-wails-overlay-ready');

      // If this overlay already exists from a previous run attempt, reuse it.
      try {
        await fs.stat(marker);
        return repoCopyRoot;
      } catch {
        // continue
      }

      await fs.rm(repoCopyRoot, { recursive: true, force: true }).catch(() => undefined);
      await fs.mkdir(repoCopyRoot, { recursive: true });

      const ensureDirJunction = async (dirName: string) => {
        const src = path.join(baseRepoRoot, dirName);
        const dst = path.join(repoCopyRoot, dirName);
        try {
          const st = await fs.stat(src);
          if (!st.isDirectory()) return;
        } catch {
          return;
        }
        await exec('cmd.exe', ['/c', 'mklink', '/J', dst, src], { timeoutMs: 30_000 });
      };

      const ensureJunction = async (src: string, dst: string) => {
        try {
          const st = await fs.stat(src);
          if (!st.isDirectory()) return;
        } catch {
          return;
        }
        await exec('cmd.exe', ['/c', 'mklink', '/J', dst, src], { timeoutMs: 30_000 });
      };

      // Junction large/mostly-static directories.
      // (Avoid `build/` here; each instance should have its own build output location.)
      await ensureDirJunction('pkg');
      await ensureDirJunction('kind');
      await ensureDirJunction('scripts');
      await ensureDirJunction('todos');
      await ensureDirJunction('.github');
      await ensureDirJunction('.claude');
      await ensureDirJunction('e2e');

      // Copy only the embedded frontend assets (main.go uses //go:embed all:frontend/dist).
      // This must be a real directory (not a junction), otherwise go:embed can fail.
      const frontendDistSrc = path.join(baseRepoRoot, 'frontend', 'dist');
      const frontendDistDst = path.join(repoCopyRoot, 'frontend', 'dist');
      const frontendRootDst = path.join(repoCopyRoot, 'frontend');
      await fs.mkdir(frontendRootDst, { recursive: true }).catch(() => undefined);

      // Wails dev expects a frontend project (package.json) even when skipping frontend build.
      // Copy lightweight config files and junction heavy folders.
      const frontendFilesToCopy = [
        'package.json',
        'package-lock.json',
        'package.json.md5',
        'vite.config.js',
        'vitest.config.js',
        'test.setup.js',
        'index.html',
      ];
      for (const name of frontendFilesToCopy) {
        const src = path.join(baseRepoRoot, 'frontend', name);
        const dst = path.join(frontendRootDst, name);
        await fs.copyFile(src, dst).catch(() => undefined);
      }

      // Junction large frontend folders to avoid copying gigabytes.
      await ensureJunction(path.join(baseRepoRoot, 'frontend', 'node_modules'), path.join(frontendRootDst, 'node_modules'));
      await ensureJunction(path.join(baseRepoRoot, 'frontend', 'src'), path.join(frontendRootDst, 'src'));
      await ensureJunction(path.join(baseRepoRoot, 'frontend', 'scripts'), path.join(frontendRootDst, 'scripts'));
      await ensureJunction(path.join(baseRepoRoot, 'frontend', 'wailsjs'), path.join(frontendRootDst, 'wailsjs'));

      try {
        const st = await fs.stat(frontendDistSrc);
        if (st.isDirectory()) {
          const rc = await exec(
            'cmd.exe',
            ['/c', 'robocopy', frontendDistSrc, frontendDistDst, '/E', '/XO', '/MT:16', '/R:0', '/W:0'],
            { timeoutMs: process.env.CI ? 300_000 : 120_000 }
          );
          if (rc.code > 7) {
            throw new Error(`robocopy frontend/dist failed (code=${rc.code}): ${rc.stderr || rc.stdout}`);
          }
        }
      } catch {
        // ignore
      }

      // Copy build/ (small but mutated by Wails) into the overlay.
      const buildSrc = path.join(baseRepoRoot, 'build');
      const buildDst = path.join(repoCopyRoot, 'build');
      try {
        const st = await fs.stat(buildSrc);
        if (st.isDirectory()) {
          const rc = await exec(
            'cmd.exe',
            ['/c', 'robocopy', buildSrc, buildDst, '/E', '/XO', '/MT:16', '/R:0', '/W:0', '/XD', 'node_modules'],
            { timeoutMs: process.env.CI ? 300_000 : 120_000 }
          );
          if (rc.code > 7) {
            throw new Error(`robocopy build/ failed (code=${rc.code}): ${rc.stderr || rc.stdout}`);
          }
        }
      } catch {
        // ignore
      }

      // Copy root-level files (including the per-instance .syso).
      const entries = await fs.readdir(baseRepoRoot, { withFileTypes: true });
      for (const ent of entries) {
        if (!ent.isFile()) continue;
        if (ent.name === '.gitignore') {
          // keep
        }
        const src = path.join(baseRepoRoot, ent.name);
        const dst = path.join(repoCopyRoot, ent.name);
        await fs.copyFile(src, dst).catch(() => undefined);
      }

      // Make sure the syso exists even if Wails deletes it during startup.
      await fs.writeFile(path.join(repoCopyRoot, 'KubeDevBench-res.syso'), '', { flag: 'a' }).catch(() => undefined);

      await fs.writeFile(marker, new Date().toISOString(), 'utf-8');

      return repoCopyRoot;
    };

    // Prepare all instances first (clear ports, create directories, resolve repo roots)
    const preparations: Array<{ index: number; port: number; homeDir: string; repoRoot: string }> = [];

    for (let i = 0; i < instanceCount; i++) {
      const port = basePort + i;
      if (isWin32) {
        await timed(`clear Windows listener on port ${port}`, async () => killWindowsListenerOnPort(port));
      }

      const homeDir = path.join(e2eRoot, `.playwright-artifacts-${runId}`, `home-w${i}`);
      await fs.mkdir(homeDir, { recursive: true });

      const repoRootResolved = await repoRootForWails(i);
      preparations.push({ index: i, port, homeDir, repoRoot: repoRootResolved });
    }

    // Start all wails dev instances in parallel
    console.log(`[e2e][setup] ${isoNow()} starting ${instanceCount} wails dev instances in parallel...`);

    const startPromises = preparations.map(async ({ index, port, homeDir, repoRoot: repoRootResolved }) => {
      const instanceAssetDir = path.join(repoRootResolved, 'frontend', 'dist');
      const instance = usePrebuilt
        ? await timed(`start prebuilt instance #${index} port=${port}`, async () =>
            startPrebuiltApp({
              binaryPath: prebuiltBinary,
              repoRoot: repoRootResolved,
              logRepoRoot: withinRepo(),
              port,
              homeDir,
              assetDir: instanceAssetDir,
              // Prebuilt binaries skip compilation; much faster startup.
              readyTimeoutMs: process.env.CI ? 120_000 : 60_000,
            })
          )
        : await timed(`start wails dev instance #${index} port=${port}`, async () =>
            startWailsDev({
              repoRoot: repoRootResolved,
              logRepoRoot: withinRepo(),
              port,
              homeDir,
              assetDir: instanceAssetDir,
              // Parallel startup; allow more time here. Increased to 600s (10min) for CI to handle
              // resource contention when multiple Wails instances start in parallel.
              readyTimeoutMs: process.env.CI ? 600_000 : 240_000,
            })
          );

      if (typeof instance.process.pid === 'number') startedWailsPids.push(instance.process.pid);

      console.log(`[e2e][setup] ${isoNow()} wails #${index} ready baseURL=${instance.baseURL} pid=${instance.process.pid ?? 'unknown'}`);

      return {
        baseURL: instance.baseURL,
        pid: instance.process.pid ?? undefined,
        port,
        homeDir,
        dialogDir: path.join(homeDir, 'tmp', 'kdb-e2e-dialogs'),
      };
    });

    const results = await Promise.all(startPromises);
    wailsInstances.push(...results);

    await writeRunState({
      runId,
      clusterName: kind?.clusterName ?? clusterName,
      contextName: kind?.contextName,
      kubeconfigYaml: kind?.kubeconfigYaml,
      proxyBaseURL: proxy.baseURL,
      proxyPid: proxy.pid,
      jfrogLogPath,
      holmesMockBaseURL: holmesMock?.baseURL,
      holmesMockPid: holmesMock?.pid,
      wailsInstances,
    });
  }

  // Ensure artifacts folder exists
  await fs.mkdir(path.join(e2eRoot, 'test-results'), { recursive: true });
  console.log(`[e2e][setup] ${isoNow()} finished in ${fmtMs(Date.now() - setupStart)}`);
  } catch (err) {
    // If global setup fails before run-state is written, global teardown won't know
    // what to kill. Clean up best-effort to avoid leaving stray Wails/Vite/proxy processes.
    for (const pid of startedWailsPids) {
      await killPidBestEffort(pid);
    }
    if (proxy?.pid) {
      await killPidBestEffort(proxy.pid);
    }
    if (holmesMock?.pid) {
      await killPidBestEffort(holmesMock.pid);
    }
    throw err;
  }
}
