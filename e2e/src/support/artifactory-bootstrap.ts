import { captureJFrogLogs } from './jfrog.js';
import { ensureArtifactoryDockerRepoViaUi } from './artifactory-ui-bootstrap.js';

export interface ArtifactoryConfig {
  healthUrl: string;
  /** Artifactory Docker endpoint base used by the app (not the /v2/ probe). */
  registryBaseUrl: string;
  /** Docker v2 probe URL (prefer `${registryBaseUrl}/v2/_catalog` for Artifactory/JCR). */
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

async function safeReadBodySnippet(res: Response, maxLen = 600): Promise<string> {
  try {
    const txt = (await res.text()).trim();
    if (!txt) return '';
    return txt.length <= maxLen ? txt : `${txt.slice(0, maxLen)}…`;
  } catch {
    return '';
  }
}

async function tryAcceptEulaViaApi(baseUrl: string, username: string, password: string): Promise<boolean> {
  // JFrog Container Registry exposes EULA acceptance via this endpoint.
  // The correct endpoint for JCR 7.x is: POST /artifactory/ui/jcr/eula/accept
  // This is significantly more deterministic than attempting to find EULA UI controls.
  const endpoints = [
    `${baseUrl.replace(/\/+$/, '')}/artifactory/ui/jcr/eula/accept`,
    `${baseUrl.replace(/\/+$/, '')}/artifactory/ui/onboarding/eula`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: toBasicAuthHeader(username, password),
          'Content-Type': 'application/json',
        },
        body: '{}',
      });
      // 200, 201, 204 all indicate success; 404/405 means try next endpoint
      if (res.status >= 200 && res.status < 300) return true;
    } catch {
      // Network error; try next endpoint
    }
  }
  return false;
}

async function tryCreateDockerLocalViaApi(baseUrl: string, username: string, password: string): Promise<boolean> {
  const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/artifactory/api/repositories/docker-local`, {
    method: 'PUT',
    headers: {
      Authorization: toBasicAuthHeader(username, password),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      key: 'docker-local',
      rclass: 'local',
      packageType: 'docker',
      description: 'Local Docker registry for e2e testing',
      dockerApiVersion: 'V2',
      maxUniqueSnapshots: 0,
      handleReleases: true,
      handleSnapshots: true,
      checksumPolicyType: 'client-checksums',
      snapshotVersionBehavior: 'unique',
    }),
  });

  if (res.status === 200 || res.status === 201) return true;

  // If it already exists, Artifactory may return 400 with a message indicating that.
  // However, some builds return 400 for *gated* repository APIs (e.g. "Pro only"), so
  // we must inspect the body before treating it as success.
  if (res.status === 400) {
    const snippet = (await safeReadBodySnippet(res)).toLowerCase();
    if (snippet.includes('already exists') || snippet.includes('repository already exists')) return true;

    // JCR/OSS builds can gate this REST API behind Pro licensing. In that case, fall back to UI.
    if (snippet.includes('available only in artifactory pro') || snippet.includes('valid license')) return false;

    throw new Error(
      `[artifactory] Failed to create docker-local via REST (HTTP 400)${snippet ? `: ${snippet}` : ''}`
    );
  }

  // For gated editions/builds, this can be forbidden; caller may fall back to UI.
  if (res.status === 401 || res.status === 403 || res.status === 404) return false;

  // Unexpected response: include a small snippet for troubleshooting.
  const snippet = await safeReadBodySnippet(res);
  throw new Error(`[artifactory] Failed to create docker-local via REST (HTTP ${res.status})${snippet ? `: ${snippet}` : ''}`);
}

async function canAuthRepositories(baseUrl: string, username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/artifactory/api/repositories`, {
      method: 'GET',
      headers: { Authorization: toBasicAuthHeader(username, password) },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

async function dockerLocalExists(baseUrl: string, username: string, password: string): Promise<boolean> {
  try {
    const res = await fetch(`${baseUrl.replace(/\/+$/, '')}/artifactory/api/repositories/docker-local`, {
      method: 'GET',
      headers: { Authorization: toBasicAuthHeader(username, password) },
    });
    return res.status === 200;
  } catch {
    return false;
  }
}

/**
 * Try to create docker-local using internal JCR UI APIs.
 * These endpoints are undocumented but may work on JCR free edition
 * where the official REST API is gated behind Pro licensing.
 */
async function tryCreateDockerLocalViaInternalApi(baseUrl: string, username: string, password: string): Promise<boolean> {
  const dockerLocalConfig = {
    key: 'docker-local',
    rclass: 'local',
    packageType: 'docker',
    type: 'localRepoConfig',
    typeSpecific: {
      repoType: 'Docker',
      dockerApiVersion: 'V2',
      maxUniqueTags: 0,
      blockPushingSchema1: false,
    },
    basic: {
      layout: 'simple-default',
    },
    advanced: {
      cache: {},
    },
    description: 'Local Docker registry for e2e testing',
  };

  // Internal UI endpoints that JCR might expose for repository creation
  // These are based on patterns observed in JFrog's UI and similar to the EULA endpoint
  const endpoints = [
    // JCR-specific onboarding endpoint (similar pattern to EULA)
    { url: `${baseUrl}/artifactory/ui/jcr/onboarding/createrepo`, method: 'POST' },
    // Admin UI endpoint for repository CRUD
    { url: `${baseUrl}/artifactory/ui/admin/repositories/crud/local`, method: 'POST' },
    // Alternative admin endpoint
    { url: `${baseUrl}/artifactory/ui/admin/repositories/createlocal`, method: 'POST' },
    // Treebrowser endpoint
    { url: `${baseUrl}/artifactory/ui/treebrowser/repo/create`, method: 'POST' },
  ];

  for (const { url, method } of endpoints) {
    try {
      const res = await fetch(url, {
        method,
        headers: {
          Authorization: toBasicAuthHeader(username, password),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dockerLocalConfig),
      });

      // Success responses
      if (res.status >= 200 && res.status < 300) {
        return true;
      }

      // If 400 with "already exists", that's also success
      if (res.status === 400) {
        const snippet = (await safeReadBodySnippet(res)).toLowerCase();
        if (snippet.includes('already exists') || snippet.includes('repository already exists')) {
          return true;
        }
      }
      // 404/405 means endpoint doesn't exist, try next
      // Other errors, try next endpoint
    } catch {
      // Network error or endpoint doesn't exist, try next
    }
  }

  return false;
}

async function ensureArtifactoryBootstrapped(merged: ArtifactoryConfig): Promise<void> {
  if (getEnv('E2E_ARTIFACTORY_UI_BOOTSTRAP') === '0') return;

  const uiBaseUrl = 'http://localhost:8082/ui/';
  const { username, password } = merged;
  // Timeout for UI bootstrap - JCR 7.x can be slow on first load
  const uiTimeoutMs = Number(getEnv('E2E_ARTIFACTORY_UI_TIMEOUT_MS') ?? '') || 30_000;

  // JCR free edition doesn't have useful APIs for repository creation.
  // Use 100% UI-driven bootstrap via Playwright.
  const ui = await ensureArtifactoryDockerRepoViaUi({
    baseUiUrl: uiBaseUrl,
    username,
    password,
    fallbackPassword: 'password', // Default JCR password before setup
    repoKey: 'docker-local',
    timeoutMs: Math.min(merged.readyTimeoutMs, uiTimeoutMs),
    runId: process.env.E2E_RUN_ID,
  });

  if (!ui.ok) {
    throw new Error(`[artifactory] UI bootstrap could not create docker-local. Artifacts: ${ui.artifactDir}`);
  }
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
      throw new Error(`[artifactory] Timed out waiting for ${label} after ${fmtMs(opts.timeoutMs)}.`);
    }

    await sleep(opts.intervalMs);
  }
}

export function getArtifactoryConfig(): ArtifactoryConfig {
  const registryBaseUrl =
    getEnv('E2E_ARTIFACTORY_REGISTRY_BASE_URL') ??
    'http://localhost:8082/artifactory/api/docker/docker-local';

  const registryV2Url =
    getEnv('E2E_ARTIFACTORY_REGISTRY_V2_URL') ??
    `${registryBaseUrl.replace(/\/+$/, '')}/v2/_catalog`;

  return {
    healthUrl: getEnv('E2E_ARTIFACTORY_HEALTH_URL') ?? 'http://localhost:8082/artifactory/api/system/ping',
    registryBaseUrl,
    registryV2Url,
    username: getEnv('E2E_ARTIFACTORY_USERNAME') ?? 'admin',
    // Default admin password for the JCR compose setup.
    // Override via E2E_ARTIFACTORY_PASSWORD if you changed it.
    password: getEnv('E2E_ARTIFACTORY_PASSWORD') ?? 'password',
    // Increased from 60s to 240s to match docker-compose healthcheck start_period (180s) plus buffer
    readyTimeoutMs: Number(getEnv('E2E_ARTIFACTORY_READY_TIMEOUT_MS') ?? '') || 240_000,
  };
}

/**
 * Ensures Artifactory/JCR is reachable and that the Docker repo endpoint is accessible.
 *
 * This does NOT provision Artifactory; it only verifies readiness.
 *
 * To skip Artifactory checks for local runs: set `E2E_SKIP_ARTIFACTORY=1`.
 */
export async function ensureArtifactory(config: Partial<ArtifactoryConfig> = {}): Promise<ArtifactoryConfig> {
  const merged: ArtifactoryConfig = { ...getArtifactoryConfig(), ...config };

  if (getEnv('E2E_SKIP_ARTIFACTORY') === '1') {
    return merged;
  }

  const { healthUrl, registryV2Url, username, password, readyTimeoutMs } = merged;

  try {
    await waitForOk(
      'Artifactory health ping',
      async () => {
        const res = await fetch(healthUrl, { method: 'GET' });
        if (!res.ok) return false;
        const body = (await res.text()).trim();
        return /\bok\b/i.test(body) || body.length > 0;
      },
      { timeoutMs: readyTimeoutMs, intervalMs: 2_000 }
    );
  } catch (err: unknown) {
    const logPath = await captureJFrogLogs({ reason: 'health-failed' });
    throw new Error(
      `${String((err as { message?: string })?.message ?? err)}\n` +
        `Artifactory is not running. Start it with:\n` +
        `  cd jfrog && ./start-jcr.sh "${password}"\n` +
        `Or on Windows:\n` +
        `  .\\start-jcr.ps1 -Password "${password}"\n` +
        `JFrog logs: ${logPath}`
    );
  }

  // Make the JCR instance deterministic for E2Es (password + docker-local) using safe UI automation.
  // This avoids relying on Pro-only repository creation APIs.
  try {
    await ensureArtifactoryBootstrapped(merged);
  } catch (err: unknown) {
    const logPath = await captureJFrogLogs({ reason: 'ui-bootstrap-failed' });
    throw new Error(
      `${String((err as { message?: string })?.message ?? err)}\n` +
        `JFrog logs: ${logPath}`
    );
  }

  const authHeader = toBasicAuthHeader(username, password);
  const v2Start = Date.now();
  let lastStatus: number | null = null;
  let lastSnippet = '';
  while (Date.now() - v2Start < readyTimeoutMs) {
    try {
      const res = await fetch(registryV2Url, {
        method: 'GET',
        headers: { Authorization: authHeader },
      });
      lastStatus = res.status;
      lastSnippet = await safeReadBodySnippet(res);

      if (res.status === 200) return merged;

      if (res.status === 401 || res.status === 403) {
        throw new Error(
          `[artifactory] Docker /v2/ probe returned HTTP ${res.status}. ` +
            `Check credentials (user=${username}).`
        );
      }
      if (res.status === 404) {
        throw new Error(
          `[artifactory] Docker /v2/ probe returned HTTP 404. ` +
            `Repo key/path likely doesn't exist (expected docker-local).`
        );
      }

      // For transient startup responses (5xx), keep retrying.
      if (res.status >= 500) {
        await sleep(2_000);
        continue;
      }

      // Unexpected but potentially transient; wait a bit and retry.
      await sleep(2_000);
    } catch (err) {
      const msg = String((err as { message?: string })?.message ?? err);
      if (/\bDocker \/v2\/ probe returned HTTP\b/.test(msg)) {
        const logPath = await captureJFrogLogs({ reason: 'v2-probe-failed' });
        throw new Error(
          `${msg}\n` +
            `Docker repository is not accessible at ${registryV2Url}.\n` +
            `Ensure JCR setup wizard is completed and docker-local repo exists.\n` +
            `Try:\n` +
            `  cd jfrog && ./bootstrap-jcr.sh "${password}"\n` +
            `JFrog logs: ${logPath}`
        );
      }
      // Network/startup hiccup; retry until timeout.
      await sleep(2_000);
    }
  }

  const extra = lastStatus ? ` Last HTTP status: ${lastStatus}.` : '';
  const snippet = lastSnippet ? ` Response: ${lastSnippet}` : '';
  const logPath = await captureJFrogLogs({ reason: 'v2-timeout' });
  throw new Error(
    `[artifactory] Docker repository is not accessible at ${registryV2Url}.${extra}${snippet}\n` +
      `Ensure JCR setup wizard is completed and docker-local repo exists.\n` +
      `Try:\n` +
      `  cd jfrog && ./bootstrap-jcr.sh "${password}"\n` +
      `JFrog logs: ${logPath}`
  );
}
