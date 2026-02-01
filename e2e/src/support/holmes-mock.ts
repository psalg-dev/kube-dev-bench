/**
 * Holmes Mock Server - E2E Infrastructure Integration
 *
 * Provides startup and management helpers for the Holmes mock server,
 * following the same pattern as proxy.ts.
 */

import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';

export type HolmesMockInstance = {
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

/**
 * Check if a port is in use by attempting a TCP connection
 */
async function isPortInUse(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(1000);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

async function waitForReady(baseURL: string, timeoutMs: number) {
  const start = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (await isHttpOk(`${baseURL}/healthz`)) return;
    if (Date.now() - start > timeoutMs) {
      throw new Error(`Timed out waiting for Holmes mock server at ${baseURL}`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

function killProcessTreeBestEffort(child: ChildProcess) {
  if (!child || child.killed) return;
  try {
    child.kill('SIGTERM');
  } catch {}
  try {
    child.kill('SIGKILL');
  } catch {}
}

export async function startHolmesMockServer(opts: {
  repoRoot: string;
  port: number;
  readyTimeoutMs?: number;
  errorMode?: string;
  delayMs?: number;
}): Promise<HolmesMockInstance> {
  const { repoRoot, port } = opts;
  const readyTimeoutMs = opts.readyTimeoutMs ?? 30_000;
  const baseURL = `http://127.0.0.1:${port}`;

  // If already running, reuse it.
  if (await isHttpOk(`${baseURL}/healthz`)) {
    console.log(`[e2e][holmes-mock] ${new Date().toISOString()} reusing existing Holmes mock at ${baseURL}`);
    return { port, baseURL, process: null };
  }

  // Check if something else is using this port (but not our healthz endpoint)
  if (await isPortInUse('127.0.0.1', port)) {
    console.warn(`[e2e][holmes-mock] ${new Date().toISOString()} WARNING: port ${port} is in use but /healthz not responding`);
  }

  console.log(`[e2e][holmes-mock] ${new Date().toISOString()} starting Holmes mock on ${baseURL}` +
    (opts.errorMode ? ` errorMode=${opts.errorMode}` : '') +
    (opts.delayMs ? ` delayMs=${opts.delayMs}` : ''));

  const logDir = path.join(repoRoot, 'e2e', 'test-results', 'holmes-mock-logs');
  await fsp.mkdir(logDir, { recursive: true });
  const logPath = path.join(logDir, `holmes-mock-${port}.log`);
  const logStream = fs.createWriteStream(logPath, { flags: 'a' });
  logStream.write(`\n=== holmes-mock (port=${port}) ${new Date().toISOString()} ===\n`);

  const scriptPath = path.join(repoRoot, 'e2e', 'src', 'support', 'holmes-mock', 'holmes-mock-server.mjs');

  const env: Record<string, string> = {
    ...process.env as Record<string, string>,
    HOLMES_MOCK_HOST: '127.0.0.1',
    HOLMES_MOCK_PORT: String(port),
  };

  if (opts.errorMode) {
    env.HOLMES_MOCK_ERROR = opts.errorMode;
  }
  if (opts.delayMs && opts.delayMs > 0) {
    env.HOLMES_MOCK_DELAY_MS = String(opts.delayMs);
  }

  const child = spawn(process.execPath, [scriptPath], {
    cwd: repoRoot,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  // Collect stdout and stderr for diagnostic messages
  let stdoutOutput = '';
  let stderrOutput = '';
  child.stdout?.on('data', (d: Buffer) => {
    logStream.write(d);
    stdoutOutput += d.toString();
  });
  child.stderr?.on('data', (d: Buffer) => {
    logStream.write(d);
    stderrOutput += d.toString();
  });

  // Track early exit - if the process dies before becoming ready, we should fail fast
  let earlyExitCode: number | null = null;
  let earlyExitSignal: string | null = null;
  child.once('exit', (code, signal) => {
    earlyExitCode = code;
    earlyExitSignal = signal as string | null;
  });

  child.once('close', () => {
    try {
      logStream.write(`\n=== holmes-mock exited (port=${port}) ===\n`);
    } catch {}
  });

  // Give the process a moment to start before polling
  await new Promise((r) => setTimeout(r, 100));

  // Wait for ready with early exit detection
  const waitForReadyWithEarlyExit = async (): Promise<void> => {
    const start = Date.now();
    // eslint-disable-next-line no-constant-condition
    while (true) {
      // Check if process exited early
      if (earlyExitCode !== null || earlyExitSignal !== null) {
        const exitInfo = earlyExitSignal ? `signal=${earlyExitSignal}` : `code=${earlyExitCode}`;
        throw new Error(
          `Holmes mock server on port ${port} exited unexpectedly (${exitInfo}) before becoming ready.\n` +
          `stdout: ${stdoutOutput.slice(-300) || '(no output)'}\n` +
          `stderr: ${stderrOutput.slice(-300) || '(no output)'}`
        );
      }
      if (await isHttpOk(`${baseURL}/healthz`)) return;
      if (Date.now() - start > readyTimeoutMs) {
        const diagInfo = `pid=${child.pid ?? 'unknown'}, ` +
          `killed=${child.killed}, ` +
          `stdout: ${stdoutOutput.slice(-200) || '(empty)'}, ` +
          `stderr: ${stderrOutput.slice(-200) || '(empty)'}`;
        throw new Error(
          `Timed out waiting for Holmes mock server at ${baseURL} after ${readyTimeoutMs}ms.\n` +
          `Diagnostics: ${diagInfo}`
        );
      }
      await new Promise((r) => setTimeout(r, 250));
    }
  };

  try {
    await waitForReadyWithEarlyExit();
  } catch (err) {
    killProcessTreeBestEffort(child);
    try {
      logStream.end(`\n=== holmes-mock failed to become ready (port=${port}) ===\n`);
    } catch {}
    throw err;
  }

  console.log(
    `[e2e][holmes-mock] ${new Date().toISOString()} Holmes mock ready at ${baseURL} pid=${child.pid ?? 'unknown'}`
  );

  return { port, baseURL, process: child };
}

export async function ensureHolmesMockServer(opts: {
  repoRoot: string;
  port?: number;
  readyTimeoutMs?: number;
  errorMode?: string;
  delayMs?: number;
}): Promise<{ baseURL: string; pid?: number }> {
  const port = opts.port ?? 34117;
  const instance = await startHolmesMockServer({
    repoRoot: opts.repoRoot,
    port,
    readyTimeoutMs: opts.readyTimeoutMs,
    errorMode: opts.errorMode,
    delayMs: opts.delayMs,
  });
  return { baseURL: instance.baseURL, pid: instance.process?.pid ?? undefined };
}
