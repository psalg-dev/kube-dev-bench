import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

export type FrontendPreviewInstance = {
  port: number;
  baseURL: string;
  process: ChildProcess | null;
};

async function isHttpOk(url: string): Promise<boolean> {
  try {
    const ok = await new Promise<boolean>((resolve) => {
      const req = http.get(url, (res: http.IncomingMessage) => {
        res.resume();
        resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 500);
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
    if (await isHttpOk(`${baseURL}/`)) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for frontend preview at ${baseURL}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

function killProcessTreeBestEffort(child: ChildProcess) {
  if (!child || child.killed) return;
  try { child.kill('SIGTERM'); } catch {}
  try { child.kill('SIGKILL'); } catch {}
}

export async function startFrontendPreviewServer(opts: {
  repoRoot: string;
  port: number;
  readyTimeoutMs?: number;
}): Promise<FrontendPreviewInstance> {
  const { repoRoot, port } = opts;
  const readyTimeoutMs = opts.readyTimeoutMs ?? 30_000;
  const baseURL = `http://127.0.0.1:${port}`;

  // If already running, reuse it.
  if (await isHttpOk(`${baseURL}/`)) {
    console.log(`[e2e][frontend] ${new Date().toISOString()} reusing existing preview server at ${baseURL}`);
    return { port, baseURL, process: null };
  }

  console.log(`[e2e][frontend] ${new Date().toISOString()} starting Vite preview on ${baseURL}`);

  const logDir = path.join(repoRoot, 'e2e', 'test-results', 'frontend-logs');
  await fsp.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `frontend-preview-${port}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n=== frontend preview (port=${port}) ${new Date().toISOString()} ===\n`);

  const cwd = path.join(repoRoot, 'frontend');
  const args = ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(port), '--strictPort'];

  const child = process.platform === 'win32'
    ? spawn('cmd.exe', ['/c', 'npm', ...args], {
        cwd,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      })
    : spawn('npm', args, {
        cwd,
        env: { ...process.env },
        stdio: ['ignore', 'pipe', 'pipe'],
      });

  child.stdout?.on('data', (d: Buffer) => logStream.write(d));
  child.stderr?.on('data', (d: Buffer) => logStream.write(d));
  child.once('close', () => {
    try { logStream.write(`\n=== frontend preview exited (port=${port}) ===\n`); } catch {}
  });

  try {
    await waitForReady(baseURL, readyTimeoutMs);
  } catch (err) {
    killProcessTreeBestEffort(child);
    try { logStream.end(`\n=== frontend preview failed to become ready (port=${port}) ===\n`); } catch {}
    throw err;
  }

  console.log(`[e2e][frontend] ${new Date().toISOString()} preview ready at ${baseURL} pid=${child.pid ?? 'unknown'}`);

  return { port, baseURL, process: child };
}
