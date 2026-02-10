import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface RegistryConfig {
  healthUrl: string;
  /** Docker Registry v2 base URL used by the app. */
  registryBaseUrl: string;
  /** Docker v2 catalog URL for verification. */
  registryV2Url: string;
  username: string;
  password: string;
  readyTimeoutMs: number;
}

function getEnv(name: string): string | undefined {
  const v = process.env[name];
  if (!v) return undefined;
  const trimmed = v.trim();
  return trimmed.length ? trimmed : undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fmtMs(ms: number) {
  if (ms < 1_000) return `${ms}ms`;
  return `${(ms / 1_000).toFixed(1)}s`;
}

function toBasicAuthHeader(username: string, password: string): string {
  const raw = `${username}:${password}`;
  const b64 = Buffer.from(raw, 'utf8').toString('base64');
  return `Basic ${b64}`;
}

async function waitForOk(
  label: string,
  fn: () => Promise<boolean>,
  opts: { timeoutMs: number; intervalMs: number }
): Promise<void> {
  const startedAt = Date.now();
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      if (await fn()) return;
    } catch {
      // ignore and retry
    }

    if (Date.now() - startedAt > opts.timeoutMs) {
      throw new Error(`[registry] Timed out waiting for ${label} after ${fmtMs(opts.timeoutMs)}.`);
    }

    await sleep(opts.intervalMs);
  }
}

function getRegistryDir(): string {
  // Find registry directory relative to this file
  // In ES modules, we need to use import.meta.url instead of __dirname
  const currentDir = dirname(fileURLToPath(import.meta.url));
  
  const possiblePaths = [
    join(process.cwd(), 'registry'),
    join(process.cwd(), '..', 'registry'),
    join(currentDir, '..', '..', '..', 'registry'),
  ];
  
  for (const path of possiblePaths) {
    if (existsSync(join(path, 'docker-compose.yml'))) {
      return path;
    }
  }
  
  throw new Error('[registry] Could not find registry directory with docker-compose.yml');
}

function startRegistryContainer(password: string): void {
  const registryDir = getRegistryDir();
  console.log('[registry] Starting Docker Registry container...');
  console.log(`[registry] Directory: ${registryDir}`);
  
  try {
    // Run the start script which creates htpasswd and starts container
    const script = process.platform === 'win32' 
      ? `powershell -File start-registry.ps1 -Password "${password}"`
      : `bash start-registry.sh "${password}"`;
    
    execSync(script, {
      cwd: registryDir,
      stdio: 'inherit',
      timeout: 60_000,
    });
  } catch (err) {
    throw new Error(`[registry] Failed to start registry container: ${err}`);
  }
}

export function getRegistryConfig(): RegistryConfig {
  const registryBaseUrl = getEnv('E2E_REGISTRY_URL') ?? 'http://localhost:5000';
  const registryV2Url = `${registryBaseUrl.replace(/\/+$/, '')}/v2/_catalog`;

  return {
    healthUrl: `${registryBaseUrl.replace(/\/+$/, '')}/v2/`,
    registryBaseUrl,
    registryV2Url,
    username: getEnv('E2E_REGISTRY_USERNAME') ?? 'admin',
    password: getEnv('E2E_REGISTRY_PASSWORD') ?? 'password',
    // Docker Registry v2 starts much faster than JFrog (seconds vs minutes)
    readyTimeoutMs: Number(getEnv('E2E_REGISTRY_READY_TIMEOUT_MS') ?? '') || 30_000,
  };
}

/**
 * Ensures Docker Registry v2 is reachable and ready.
 *
 * This will start the registry container if it's not already running.
 *
 * To skip registry checks for local runs: set `E2E_SKIP_REGISTRY=1`.
 */
export async function ensureRegistry(config: Partial<RegistryConfig> = {}): Promise<RegistryConfig> {
  const merged: RegistryConfig = { ...getRegistryConfig(), ...config };

  if (getEnv('E2E_SKIP_REGISTRY') === '1') {
    console.log('[registry] Skipping registry setup (E2E_SKIP_REGISTRY=1)');
    return merged;
  }

  const { healthUrl, registryV2Url, username, password, readyTimeoutMs } = merged;

  console.log('[registry] Ensuring Docker Registry v2 is ready...');

  // Try to connect - if it fails, start the container
  let needsStart = false;
  try {
    const res = await fetch(healthUrl, { method: 'GET' });
    if (!res.ok) {
      needsStart = true;
    }
  } catch {
    needsStart = true;
  }

  if (needsStart) {
    console.log('[registry] Registry not running, starting container...');
    startRegistryContainer(password);
  }

  // Wait for health check
  try {
    await waitForOk(
      'Docker Registry health',
      async () => {
        const res = await fetch(healthUrl, { method: 'GET' });
        return res.status === 200 || res.status === 401; // 401 means auth is required, which is good
      },
      { timeoutMs: readyTimeoutMs, intervalMs: 1_000 }
    );
  } catch (err: unknown) {
    throw new Error(
      `${String((err as { message?: string })?.message ?? err)}\n` +
        `Docker Registry is not running. Start it with:\n` +
        `  cd registry && ./start-registry.sh "${password}"\n` +
        `Or on Windows:\n` +
        `  cd registry; .\\start-registry.ps1 -Password "${password}"`
    );
  }

  // Verify v2 API with authentication
  const authHeader = toBasicAuthHeader(username, password);
  try {
    await waitForOk(
      'Docker Registry v2 API with auth',
      async () => {
        const res = await fetch(registryV2Url, {
          method: 'GET',
          headers: { Authorization: authHeader },
        });
        return res.status === 200;
      },
      { timeoutMs: readyTimeoutMs, intervalMs: 1_000 }
    );
  } catch (err) {
    throw new Error(
      `[registry] Docker Registry v2 API is not accessible at ${registryV2Url}.\n` +
        `Check credentials (user=${username}).\n` +
        `${String((err as { message?: string })?.message ?? err)}`
    );
  }

  console.log('[registry] Docker Registry is ready!');
  return merged;
}
