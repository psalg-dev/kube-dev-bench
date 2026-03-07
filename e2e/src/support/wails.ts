import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

export type WailsDevInstance = {
  port: number;
  baseURL: string;
  process: ChildProcess;
  /** Windows-only: interval used to keep KubeDevBench-res.syso present while Wails is running */
  resSysoInterval?: NodeJS.Timeout;
};

async function waitForHttpOk(url: string, timeoutMs: number) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const ok = await new Promise<boolean>((resolve) => {
        const req = http.get(url, (res: http.IncomingMessage) => {
          res.resume();
          const status = res.statusCode ?? 0;
          // For E2E, we need the server to serve real content.
          // During `wails dev` startup, the devserver port may accept connections
          // but still return 404/5xx while the backend/UI are booting.
          resolve(status >= 200 && status < 400);
        });
        req.on('error', () => resolve(false));
        req.setTimeout(2_000, () => {
          req.destroy();
          resolve(false);
        });
      });
      if (ok) return;
    } catch {}

    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for Wails dev server at ${url}`);
    }
    await new Promise((r) => setTimeout(r, 500));
  }
}

function killProcessTreeBestEffort(child: ChildProcess) {
  if (!child || child.killed) return;
  try { child.kill('SIGTERM'); } catch {}
  try { child.kill('SIGKILL'); } catch {}
}

function isoNow() {
  return new Date().toISOString();
}

function wireTimestampedStream(input: NodeJS.ReadableStream | null | undefined, write: (line: string) => void) {
  if (!input) return;
  let buffer = '';
  input.on('data', (d: Buffer) => {
    buffer += d.toString('utf-8');
    buffer = buffer.replace(/\r\n/g, '\n');
    const parts = buffer.split('\n');
    buffer = parts.pop() ?? '';
    for (const line of parts) write(`${isoNow()} ${line}\n`);
  });
  input.once('end', () => {
    if (buffer.length > 0) write(`${isoNow()} ${buffer}\n`);
  });
}

export async function startWailsDev(opts: {
  repoRoot: string;
  logRepoRoot?: string;
  port: number;
  homeDir: string;
  assetDir?: string;
  readyTimeoutMs?: number;
}) : Promise<WailsDevInstance> {
  const { repoRoot, port, homeDir } = opts;
  const logRepoRoot = opts.logRepoRoot ?? repoRoot;
  const readyTimeoutMs = opts.readyTimeoutMs ?? 30_000;
  // Use 127.0.0.1 (not localhost) to avoid IPv6 ::1 resolution issues on Windows.
  const baseURL = `http://127.0.0.1:${port}`;

  console.log(
    `[e2e][wails] ${new Date().toISOString()} starting wails dev port=${port} baseURL=${baseURL} ` +
      `assets=${opts.assetDir ?? 'embed'} repoRoot=${repoRoot}`
  );

  // Some TS environments/types can narrow `process.platform` unexpectedly; treat it as a string.
  const platform = process.platform as unknown as string;
  const isWin32 = platform === 'win32';

  // Wails on Windows may remove a fixed resource syso file during `wails dev` startup.
  // When running multiple instances in the same repo, one instance can delete it and the
  // next one may fail fatally if it doesn't exist. Ensure the file exists before each start.
  const resSysoPath = path.join(repoRoot, 'KubeDevBench-res.syso');
  const keepResSysoBestEffort = async () => {
    try {
      await fsp.writeFile(resSysoPath, '', { encoding: 'utf-8', flag: 'a' });
    } catch {
      // ignore; if Wails doesn't need it in this environment that's fine
    }
  };

  // For Windows, keep the file present throughout startup so overlapping `wails dev`
  // builds can't fail on a transient missing file.
  let resSysoInterval: NodeJS.Timeout | undefined;
  if (isWin32) {
    await keepResSysoBestEffort();
    resSysoInterval = setInterval(() => {
      void keepResSysoBestEffort();
    }, 50);
  }

  // Per-worker isolation: Wails/Go config dirs on Windows use APPDATA/LOCALAPPDATA, not HOME.
  // If these aren't isolated, settings (like proxy) can leak between parallel workers.
  const appDataDir = path.join(homeDir, 'AppData', 'Roaming');
  const localAppDataDir = path.join(homeDir, 'AppData', 'Local');
  const tmpDir = path.join(homeDir, 'tmp');
  const e2eDialogDir = path.join(tmpDir, 'kdb-e2e-dialogs');
  const kubeDir = path.join(homeDir, '.kube');
  const kubeConfigPath = path.join(kubeDir, 'config');
  const viteCacheDir = path.join(tmpDir, 'vite-cache');
  await Promise.all([
    fsp.mkdir(appDataDir, { recursive: true }),
    fsp.mkdir(localAppDataDir, { recursive: true }),
    fsp.mkdir(tmpDir, { recursive: true }),
    fsp.mkdir(viteCacheDir, { recursive: true }),
    fsp.mkdir(e2eDialogDir, { recursive: true }),
    fsp.mkdir(kubeDir, { recursive: true }),
  ]);

  // Marker file so the Go backend can auto-detect the E2E dialog dir via os.TempDir().
  // (Useful if KDB_E2E_DIALOG_DIR is not propagated by the runner on some platforms.)
  try {
    await fsp.writeFile(path.join(e2eDialogDir, 'enabled.txt'), `port=${port}\n`, 'utf-8');
  } catch {
    // ignore
  }

  // Repo-local mapping fallback (used when env vars are stripped):
  // write the resolved dialog dir to e2e/.run/dialog-dirs/<port>.txt.
  try {
    const mappingDir = path.join(repoRoot, 'e2e', '.run', 'dialog-dirs');
    await fsp.mkdir(mappingDir, { recursive: true });
    await fsp.writeFile(path.join(mappingDir, `${port}.txt`), e2eDialogDir, 'utf-8');
  } catch {
    // ignore
  }

  // Ensure a minimal kubeconfig exists. The app may attempt to read it during
  // initialization, and in E2E we isolate HOME/USERPROFILE so the default
  // ~/.kube/config path would otherwise be missing.
  try {
    await fsp.stat(kubeConfigPath);
  } catch {
    const minimalKubeconfig = [
      'apiVersion: v1',
      'kind: Config',
      'clusters: []',
      'contexts: []',
      'current-context: ""',
      'users: []',
      '',
    ].join('\n');
    await fsp.writeFile(kubeConfigPath, minimalKubeconfig, 'utf-8');
  }

  const logDir = path.join(logRepoRoot, 'e2e', 'test-results', 'wails-logs');
  await fsp.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `wails-${port}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  console.log(`[e2e][wails] ${new Date().toISOString()} logs -> ${logPath}`);

  logStream.write(`\n=== worker (port=${port}) ${new Date().toISOString()} ===\n`);
  logStream.write(`cwd: ${repoRoot}\n`);

  const args = [
    'dev',
    // Serve built assets directly. This avoids Wails spawning a per-instance Vite dev watcher
    // (which is extremely slow/flaky under parallel E2E on Windows).
    ...(opts.assetDir ? ['-assetdir', opts.assetDir] : []),
    // Skip frontend build.
    '-s',
    // Skip generating extra embed files during startup; we serve assets from dist.
    ...(opts.assetDir ? ['-skipembedcreate'] : []),
    '-devserver',
    `127.0.0.1:${port}`,
    '-noreload',
    '-skipbindings',
    '-nosyncgomod',
    '-m',
    '-loglevel',
    'Info',
    '-nocolour',
  ];

  // Optional override for Docker host during E2E.
  // If unset, the backend auto-detects the correct platform default (on Windows
  // this prefers Docker Desktop's dockerDesktopLinuxEngine pipe when present).
  const dockerHostOverride = process.env.E2E_DOCKER_HOST;
  const frontendDevServerURL = process.env.E2E_FRONTEND_DEVSERVER_URL || 'http://127.0.0.1:5173/';
  const useFrontendDevServer = !opts.assetDir && isWin32;
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  if (useFrontendDevServer) {
    childEnv.frontenddevserverurl = frontendDevServerURL;
  } else {
    delete childEnv.frontenddevserverurl;
    delete childEnv.FRONTENDDEVSERVERURL;
    delete childEnv.frontendDevServerURL;
  }

  const child = spawn('wails', args, {
    cwd: repoRoot,
    env: {
      ...childEnv,
      // Let the Go backend bypass native OS file dialogs during E2E.
      KDB_E2E_DIALOG_DIR: e2eDialogDir,
      ...(dockerHostOverride ? { DOCKER_HOST: dockerHostOverride } : {}),
      HOME: homeDir,
      USERPROFILE: homeDir,
      APPDATA: appDataDir,
      LOCALAPPDATA: localAppDataDir,
      TEMP: tmpDir,
      TMP: tmpDir,
      XDG_CONFIG_HOME: path.join(homeDir, '.config'),
      XDG_DATA_HOME: path.join(homeDir, '.local', 'share'),
      VITE_CACHE_DIR: viteCacheDir,
      ...(isWin32 ? { VITE_HOST: '127.0.0.1' } : {}),
      E2E_VITE_ALLOW_OUTSIDE_ROOT: '1',
      VITE_FS_STRICT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Best-effort: surface logs for debugging when things fail
  logStream.write(`\nwails: wails ${args.join(' ')}\n`);

  wireTimestampedStream(child.stdout, (line) => logStream.write(line));
  wireTimestampedStream(child.stderr, (line) => logStream.write(line));

  const exited = new Promise<never>((_, reject) => {
    child.once('close', (code, signal) => {
      try {
        logStream.write(`\n=== wails dev exited (port=${port}) code=${code ?? 'null'} signal=${signal ?? 'null'} ===\n`);
      } catch {
        // ignore
      }
      reject(new Error(`wails dev exited before becoming ready (port=${port}, code=${code ?? 'null'}, signal=${signal ?? 'null'}). See ${logPath}`));
    });
  });

  // CI-friendly: print periodic progress so logs don't look hung during long cold starts.
  const waitStart = Date.now();
  const heartbeatEveryMs = Number(process.env.E2E_WAILS_HEARTBEAT_MS || 15_000);
  const heartbeat = setInterval(() => {
    const elapsed = Date.now() - waitStart;
    console.log(
      `[e2e][wails] ${new Date().toISOString()} waiting for ready ${baseURL} ` +
        `(${Math.round(elapsed / 1000)}s elapsed, timeout=${Math.round(readyTimeoutMs / 1000)}s)`
    );
  }, heartbeatEveryMs);

  try {
    await Promise.race([waitForHttpOk(`${baseURL}/`, readyTimeoutMs), exited]);
    // `waitForHttpOk('/')` can pass while Wails is still booting/building and before the
    // runtime endpoints are actually ready. Ensure the runtime script is available too.
    await Promise.race([waitForHttpOk(`${baseURL}/wails/runtime.js`, readyTimeoutMs), exited]);
  } catch (err) {
    clearInterval(heartbeat);
    if (resSysoInterval) clearInterval(resSysoInterval);
    killProcessTreeBestEffort(child);
    try { logStream.end(`\n=== worker failed to become ready (port=${port}) ===\n`); } catch {}
    throw err;
  }

  clearInterval(heartbeat);

  console.log(`[e2e][wails] ${new Date().toISOString()} ready ${baseURL}`);

  // Keep the interval running for the lifetime of the process. On Windows, Wails can
  // delete this file during various dev-mode steps; keeping it present avoids flake
  // when multiple instances overlap.
  return { port, baseURL, process: child, resSysoInterval };
}

/**
 * Start a pre-built Wails dev binary directly, bypassing the Wails CLI.
 *
 * The Wails dev binary reads its configuration from environment variables
 * (`assetdir`, `devserver`, `loglevel`, `frontenddevserverurl`) instead of
 * CLI flags. By spawning the binary directly we avoid the 90+ second Go
 * recompilation that `wails dev` performs on every invocation.
 *
 * This is used in CI where the binary is built once and reused across all
 * E2E shards, but can also be used locally by setting E2E_PREBUILT_BINARY.
 */
export async function startPrebuiltApp(opts: {
  binaryPath: string;
  repoRoot: string;
  logRepoRoot?: string;
  port: number;
  homeDir: string;
  assetDir: string;
  readyTimeoutMs?: number;
}): Promise<WailsDevInstance> {
  const { binaryPath, repoRoot, port, homeDir, assetDir } = opts;
  const logRepoRoot = opts.logRepoRoot ?? repoRoot;
  const readyTimeoutMs = opts.readyTimeoutMs ?? 30_000;
  const baseURL = `http://127.0.0.1:${port}`;

  console.log(
    `[e2e][prebuilt] ${isoNow()} starting prebuilt binary port=${port} baseURL=${baseURL} ` +
      `binary=${binaryPath} assets=${assetDir}`
  );

  const platform = process.platform as unknown as string;
  const isWin32 = platform === 'win32';

  // Per-worker isolation (same as startWailsDev)
  const appDataDir = path.join(homeDir, 'AppData', 'Roaming');
  const localAppDataDir = path.join(homeDir, 'AppData', 'Local');
  const tmpDir = path.join(homeDir, 'tmp');
  const e2eDialogDir = path.join(tmpDir, 'kdb-e2e-dialogs');
  const kubeDir = path.join(homeDir, '.kube');
  const kubeConfigPath = path.join(kubeDir, 'config');
  const viteCacheDir = path.join(tmpDir, 'vite-cache');
  await Promise.all([
    fsp.mkdir(appDataDir, { recursive: true }),
    fsp.mkdir(localAppDataDir, { recursive: true }),
    fsp.mkdir(tmpDir, { recursive: true }),
    fsp.mkdir(viteCacheDir, { recursive: true }),
    fsp.mkdir(e2eDialogDir, { recursive: true }),
    fsp.mkdir(kubeDir, { recursive: true }),
  ]);

  try {
    await fsp.writeFile(path.join(e2eDialogDir, 'enabled.txt'), `port=${port}\n`, 'utf-8');
  } catch { /* ignore */ }

  try {
    const mappingDir = path.join(repoRoot, 'e2e', '.run', 'dialog-dirs');
    await fsp.mkdir(mappingDir, { recursive: true });
    await fsp.writeFile(path.join(mappingDir, `${port}.txt`), e2eDialogDir, 'utf-8');
  } catch { /* ignore */ }

  // Ensure minimal kubeconfig
  try {
    await fsp.stat(kubeConfigPath);
  } catch {
    const minimalKubeconfig = [
      'apiVersion: v1', 'kind: Config', 'clusters: []', 'contexts: []',
      'current-context: ""', 'users: []', '',
    ].join('\n');
    await fsp.writeFile(kubeConfigPath, minimalKubeconfig, 'utf-8');
  }

  const logDir = path.join(logRepoRoot, 'e2e', 'test-results', 'wails-logs');
  await fsp.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `prebuilt-${port}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  console.log(`[e2e][prebuilt] ${isoNow()} logs -> ${logPath}`);
  logStream.write(`\n=== prebuilt (port=${port}) ${isoNow()} ===\n`);
  logStream.write(`binary: ${binaryPath}\ncwd: ${repoRoot}\n`);

  const dockerHostOverride = process.env.E2E_DOCKER_HOST;
  const frontendDevServerURL = process.env.E2E_FRONTEND_DEVSERVER_URL || 'http://127.0.0.1:5173/';

  // The Wails dev binary reads configuration from these env vars
  // (see wailsapp/wails v2/internal/app/app_dev.go).
  const child = spawn(binaryPath, [], {
    cwd: repoRoot,
    env: {
      ...process.env,
      // Wails dev-mode env var contract
      assetdir: assetDir,
      devserver: `127.0.0.1:${port}`,
      loglevel: 'Info',
      frontenddevserverurl: isWin32 ? frontendDevServerURL : '',
      // Per-worker isolation
      KDB_E2E_DIALOG_DIR: e2eDialogDir,
      ...(dockerHostOverride ? { DOCKER_HOST: dockerHostOverride } : {}),
      HOME: homeDir,
      USERPROFILE: homeDir,
      APPDATA: appDataDir,
      LOCALAPPDATA: localAppDataDir,
      TEMP: tmpDir,
      TMP: tmpDir,
      XDG_CONFIG_HOME: path.join(homeDir, '.config'),
      XDG_DATA_HOME: path.join(homeDir, '.local', 'share'),
      VITE_CACHE_DIR: viteCacheDir,
      ...(isWin32 ? { VITE_HOST: '127.0.0.1' } : {}),
      E2E_VITE_ALLOW_OUTSIDE_ROOT: '1',
      VITE_FS_STRICT: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  logStream.write(`\nspawned binary pid=${child.pid ?? 'unknown'}\n`);

  wireTimestampedStream(child.stdout, (line) => logStream.write(line));
  wireTimestampedStream(child.stderr, (line) => logStream.write(line));

  const exited = new Promise<never>((_, reject) => {
    child.once('close', (code, signal) => {
      try {
        logStream.write(`\n=== prebuilt exited (port=${port}) code=${code ?? 'null'} signal=${signal ?? 'null'} ===\n`);
      } catch { /* ignore */ }
      reject(new Error(
        `Prebuilt binary exited before becoming ready (port=${port}, code=${code ?? 'null'}, signal=${signal ?? 'null'}). See ${logPath}`
      ));
    });
  });

  const waitStart = Date.now();
  const heartbeatEveryMs = Number(process.env.E2E_WAILS_HEARTBEAT_MS || 15_000);
  const heartbeat = setInterval(() => {
    const elapsed = Date.now() - waitStart;
    console.log(
      `[e2e][prebuilt] ${isoNow()} waiting for ready ${baseURL} ` +
        `(${Math.round(elapsed / 1000)}s elapsed, timeout=${Math.round(readyTimeoutMs / 1000)}s)`
    );
  }, heartbeatEveryMs);

  try {
    await Promise.race([waitForHttpOk(`${baseURL}/`, readyTimeoutMs), exited]);
    await Promise.race([waitForHttpOk(`${baseURL}/wails/runtime.js`, readyTimeoutMs), exited]);
  } catch (err) {
    clearInterval(heartbeat);
    killProcessTreeBestEffort(child);
    try { logStream.end(`\n=== prebuilt failed to become ready (port=${port}) ===\n`); } catch { /* ignore */ }
    throw err;
  }

  clearInterval(heartbeat);
  console.log(`[e2e][prebuilt] ${isoNow()} ready ${baseURL}`);

  return { port, baseURL, process: child };
}

export async function stopWailsDev(instance: WailsDevInstance) {
  const child = instance.process;

  if (instance.resSysoInterval) {
    clearInterval(instance.resSysoInterval);
    instance.resSysoInterval = undefined;
  }

  await new Promise<void>((resolve) => {
    if (child && !child.killed) child.once('close', () => resolve());
    else resolve();

    try {
      if (child && !child.killed) child.kill('SIGTERM');
    } catch {
      // ignore
    }

    setTimeout(() => {
      killProcessTreeBestEffort(child);
      resolve();
    }, 5_000);
  });
}
