import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

export type ProxyInstance = {
  port: number;
  baseURL: string;
  process: ChildProcess | null;
};

async function isHttpOk(url: string): Promise<boolean> {
  try {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(url, (res: http.IncomingMessage) => {
        res.resume();
        resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 300);
      });
      req.on('error', () => resolve(false));
      req.setTimeout(1_500, () => {
        req.destroy();
        resolve(false);
      });
    });
    return ok;
  } catch {
    return false;
  }
}

async function waitForReady(baseURL: string, timeoutMs: number) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (await isHttpOk(`${baseURL}/health`)) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for proxy at ${baseURL}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

function killProcessTreeBestEffort(child: ChildProcess) {
  if (!child || child.killed) return;
  try { child.kill('SIGTERM'); } catch {}
  try { child.kill('SIGKILL'); } catch {}
}

export async function startProxyServer(opts: {
  repoRoot: string;
  port: number;
  readyTimeoutMs?: number;
}) : Promise<ProxyInstance> {
  const { repoRoot, port } = opts;
  const readyTimeoutMs = opts.readyTimeoutMs ?? 30_000;
  const baseURL = `http://127.0.0.1:${port}`;

  // If already running, reuse it.
  if (await isHttpOk(`${baseURL}/health`)) {
    return { port, baseURL, process: null };
  }

  const logDir = path.join(repoRoot, 'e2e', 'test-results', 'proxy-logs');
  await fsp.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `proxy-${port}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n=== proxy (port=${port}) ${new Date().toISOString()} ===\n`);

  const scriptPath = path.join(repoRoot, 'e2e', 'src', 'support', 'proxy-server.mjs');
  const child = spawn(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env: {
      ...process.env,
      PROXY_HOST: '127.0.0.1',
      PROXY_PORT: String(port),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  child.stdout?.on('data', (d: Buffer) => logStream.write(d));
  child.stderr?.on('data', (d: Buffer) => logStream.write(d));
  child.once('close', () => {
    try { logStream.write(`\n=== proxy exited (port=${port}) ===\n`); } catch {}
  });

  try {
    await waitForReady(baseURL, readyTimeoutMs);
  } catch (err) {
    killProcessTreeBestEffort(child);
    try { logStream.end(`\n=== proxy failed to become ready (port=${port}) ===\n`); } catch {}
    throw err;
  }

  return { port, baseURL, process: child };
}

export async function ensureProxyServer(opts: {
  repoRoot: string;
  port?: number;
  readyTimeoutMs?: number;
}) : Promise<{ baseURL: string; pid?: number }> {
  const port = opts.port ?? 34116;
  const instance = await startProxyServer({ repoRoot: opts.repoRoot, port, readyTimeoutMs: opts.readyTimeoutMs });
  return { baseURL: instance.baseURL, pid: instance.process?.pid ?? undefined };
}
