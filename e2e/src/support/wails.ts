import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

export type WailsDevInstance = {
  port: number;
  baseURL: string;
  process: ChildProcess;
  vitePort: number;
  viteProcess: ChildProcess;
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
  readyTimeoutMs?: number;
}) : Promise<WailsDevInstance> {
  const { repoRoot, port, homeDir } = opts;
  const readyTimeoutMs = opts.readyTimeoutMs ?? 30_000;
  const baseURL = `http://localhost:${port}`;

  // Use a per-worker Vite dev server to avoid Wails trying to spawn/detect Vite on shared ports.
  const workerOffset = port - 34115;
  const vitePort = 5173 + workerOffset;
  const viteURL = `http://127.0.0.1:${vitePort}`;

  const logDir = path.join(repoRoot, 'e2e', 'test-results', 'wails-logs');
  await fsp.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `wails-${port}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });

  logStream.write(`\n=== worker (port=${port}) ${new Date().toISOString()} ===\n`);
  logStream.write(`cwd: ${repoRoot}\n`);

  // Start Vite explicitly
  const npmArgs = ['run', 'dev', '--', '--host', '127.0.0.1', '--port', String(vitePort), '--strictPort'];
  const viteCmd = process.platform === 'win32' ? 'cmd.exe' : 'npm';
  const viteArgs = process.platform === 'win32' ? ['/c', 'npm', ...npmArgs] : npmArgs;
  logStream.write(`vite: ${viteCmd} ${viteArgs.join(' ')} (cwd=frontend)\n`);

  const vite = spawn(viteCmd, viteArgs, {
    cwd: path.join(repoRoot, 'frontend'),
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  vite.stdout?.on('data', (d: Buffer) => logStream.write(d));
  vite.stderr?.on('data', (d: Buffer) => logStream.write(d));

  const args = [
    'dev',
    '-s',
    '-devserver',
    `127.0.0.1:${port}`,
    '-frontenddevserverurl',
    viteURL,
    '-noreload',
    '-nogorebuild',
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
      HOME: homeDir,
      USERPROFILE: homeDir,
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
    await waitForHttpOk(viteURL, readyTimeoutMs);
    await waitForHttpOk(baseURL, readyTimeoutMs);
  } catch (err) {
    killProcessTreeBestEffort(child);
    killProcessTreeBestEffort(vite);
    try { logStream.end(`\n=== worker failed to become ready (port=${port}) ===\n`); } catch {}
    throw err;
  }

  return { port, baseURL, process: child, vitePort, viteProcess: vite };
}

export async function stopWailsDev(instance: WailsDevInstance) {
  const child = instance.process;
  const vite = instance.viteProcess;

  await new Promise<void>((resolve) => {
    let closed = 0;
    const maybeResolve = () => {
      closed += 1;
      if (closed >= 2) resolve();
    };

    if (child && !child.killed) child.once('close', () => maybeResolve());
    else maybeResolve();

    if (vite && !vite.killed) vite.once('close', () => maybeResolve());
    else maybeResolve();

    try {
      if (child && !child.killed) child.kill('SIGTERM');
    } catch {
      // ignore
    }

    try {
      if (vite && !vite.killed) vite.kill('SIGTERM');
    } catch {
      // ignore
    }

    setTimeout(() => {
      killProcessTreeBestEffort(child);
      killProcessTreeBestEffort(vite);
      resolve();
    }, 5_000);
  });
}
