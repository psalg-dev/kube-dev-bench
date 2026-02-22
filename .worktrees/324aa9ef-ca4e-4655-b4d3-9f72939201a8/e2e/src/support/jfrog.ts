import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from './exec.js';
import { e2eRoot, withinRepo } from './paths.js';

export type JFrogBootstrapResult = {
  logPath: string;
};

function isoNowForFile() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function env(name: string): string | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const t = v.trim();
  return t.length ? t : undefined;
}

export function getJFrogAdminPassword(): string {
  // Prefer the Artifactory E2E password so tests and bootstrap stay in sync.
  return env('E2E_ARTIFACTORY_PASSWORD') ?? env('E2E_JFROG_ADMIN_PASSWORD') ?? 'password';
}

export async function captureJFrogLogs(opts: { runId?: string; reason: string }): Promise<string> {
  const runId = opts.runId ?? process.env.E2E_RUN_ID ?? 'local';
  const jfrogDir = withinRepo('jfrog');
  const logDir = path.join(e2eRoot, 'test-results', 'jfrog-logs');
  await fs.mkdir(logDir, { recursive: true });

  const logPath = path.join(logDir, `jfrog-${runId}-${isoNowForFile()}-${opts.reason}.log`);

  // Best-effort: even if docker compose logs fails, write whatever we can.
  try {
    const { stdout, stderr } = await exec('docker', ['compose', 'logs', '--no-color', '--timestamps'], {
      cwd: jfrogDir,
      timeoutMs: 120_000,
    });
    await fs.writeFile(logPath, `${stdout}\n\n--- stderr ---\n${stderr}\n`, 'utf-8');
  } catch (err: unknown) {
    await fs.writeFile(
      logPath,
      `Failed to capture docker compose logs. Error: ${String((err as { message?: string })?.message ?? err)}\n`,
      'utf-8'
    );
  }

  return logPath;
}

export async function ensureJFrogJcrBootstrapped(
  opts: { runId?: string; reset?: boolean } = {}
): Promise<JFrogBootstrapResult> {
  if (env('E2E_SKIP_JFROG') === '1') {
    const logPath = await captureJFrogLogs({ runId: opts.runId, reason: 'skipped' });
    return { logPath };
  }

  const runId = opts.runId ?? process.env.E2E_RUN_ID ?? 'local';
  const jfrogDir = withinRepo('jfrog');
  const password = getJFrogAdminPassword();

  const reset = opts.reset ?? env('E2E_JFROG_RESET') === '1';
  if (reset) {
    // Reset persistent data so the admin password + docker-local config are deterministic.
    await exec('docker', ['compose', 'down', '-v'], { cwd: jfrogDir, timeoutMs: 240_000 });
  }

  // Use the repo-provided scripts (they run docker compose up -d and bootstrap).
  if (process.platform === 'win32') {
    // Use Windows PowerShell 5.1 for compatibility with the script.
    const scriptPath = path.join(jfrogDir, 'start-jcr.ps1');
    const { code, stdout, stderr } = await exec(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath, '-Password', password],
      { cwd: jfrogDir, timeoutMs: 900_000 }
    );

    // Always snapshot logs so failures can be diagnosed from artifacts.
    const logPath = await captureJFrogLogs({ runId, reason: code === 0 ? 'ok' : 'failed' });

    if (code !== 0) {
      throw new Error(
        `[jfrog] start-jcr.ps1 failed (exit=${code}).\n` +
          `stdout:\n${stdout.slice(0, 4_000)}\n\n` +
          `stderr:\n${stderr.slice(0, 4_000)}\n\n` +
          `JFrog logs captured at: ${logPath}`
      );
    }

    return { logPath };
  }

  const scriptPath = path.join(jfrogDir, 'start-jcr.sh');
  const { code, stdout, stderr } = await exec('bash', ['-lc', `"${scriptPath}" "${password}"`], {
    cwd: jfrogDir,
    timeoutMs: 900_000,
  });

  const logPath = await captureJFrogLogs({ runId, reason: code === 0 ? 'ok' : 'failed' });

  if (code !== 0) {
    throw new Error(
      `[jfrog] start-jcr.sh failed (exit=${code}).\n` +
        `stdout:\n${stdout.slice(0, 4_000)}\n\n` +
        `stderr:\n${stderr.slice(0, 4_000)}\n\n` +
        `JFrog logs captured at: ${logPath}`
    );
  }

  return { logPath };
}
