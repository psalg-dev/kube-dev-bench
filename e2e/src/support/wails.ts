import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

export type WailsDevInstance = {
  port: number;
  baseURL: string;
  process: ChildProcess;
};

async function waitForHttpOk(url: string, timeoutMs: number) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const ok = await new Promise<boolean>((resolve) => {
        const req = http.get(url, (res: http.IncomingMessage) => {
          res.resume();
          resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 500);
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

export async function startWailsDev(opts: {
  repoRoot: string;
  port: number;
  homeDir: string;
  frontendDevServerURL?: string;
  readyTimeoutMs?: number;
}) : Promise<WailsDevInstance> {
  const { repoRoot, port, homeDir } = opts;
  const readyTimeoutMs = opts.readyTimeoutMs ?? 30_000;
  // Use 127.0.0.1 (not localhost) to avoid IPv6 ::1 resolution issues on Windows.
  const baseURL = `http://127.0.0.1:${port}`;

  // Wails on Windows may remove a fixed resource syso file during `wails dev` startup.
  // When running multiple instances in the same repo, one instance can delete it and the
  // next one may fail fatally if it doesn't exist. Ensure the file exists before each start.
  const resSysoPath = path.join(repoRoot, 'KubeDevBench-res.syso');
  try {
    await fsp.stat(resSysoPath);
  } catch {
    try {
      await fsp.writeFile(resSysoPath, '', 'utf-8');
    } catch {
      // ignore; if Wails doesn't need it in this environment that's fine
    }
  }

  // Per-worker isolation: Wails/Go config dirs on Windows use APPDATA/LOCALAPPDATA, not HOME.
  // If these aren't isolated, settings (like proxy) can leak between parallel workers.
  const appDataDir = path.join(homeDir, 'AppData', 'Roaming');
  const localAppDataDir = path.join(homeDir, 'AppData', 'Local');
  const tmpDir = path.join(homeDir, 'tmp');
  await Promise.all([
    fsp.mkdir(appDataDir, { recursive: true }),
    fsp.mkdir(localAppDataDir, { recursive: true }),
    fsp.mkdir(tmpDir, { recursive: true }),
  ]);

  const logDir = path.join(repoRoot, 'e2e', 'test-results', 'wails-logs');
  await fsp.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `wails-${port}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  logStream.write(`\n=== worker (port=${port}) ${new Date().toISOString()} ===\n`);
  logStream.write(`cwd: ${repoRoot}\n`);

  const args = [
    'dev',
    // Use a shared external frontend server (vite preview) so multiple Wails instances
    // don't each start their own Vite dev watcher.
    ...(opts.frontendDevServerURL ? ['-frontenddevserverurl', opts.frontendDevServerURL] : []),
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

  const child = spawn('wails', args, {
    cwd: repoRoot,
    env: {
      ...process.env,
      VITE_HOST: '127.0.0.1',
      HOME: homeDir,
      USERPROFILE: homeDir,
      APPDATA: appDataDir,
      LOCALAPPDATA: localAppDataDir,
      TEMP: tmpDir,
      TMP: tmpDir,
      XDG_CONFIG_HOME: path.join(homeDir, '.config'),
      XDG_DATA_HOME: path.join(homeDir, '.local', 'share'),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Best-effort: surface logs for debugging when things fail
  logStream.write(`\nwails: wails ${args.join(' ')}\n`);

  child.stdout?.on('data', (d: Buffer) => logStream.write(d));
  child.stderr?.on('data', (d: Buffer) => logStream.write(d));
  child.once('close', () => {
    try { logStream.write(`\n=== wails dev exited (port=${port}) ===\n`); } catch {}
  });

  try {
    await waitForHttpOk(baseURL, readyTimeoutMs);
  } catch (err) {
    killProcessTreeBestEffort(child);
    try { logStream.end(`\n=== worker failed to become ready (port=${port}) ===\n`); } catch {}
    throw err;
  }

  return { port, baseURL, process: child };
}

export async function stopWailsDev(instance: WailsDevInstance) {
  const child = instance.process;

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
