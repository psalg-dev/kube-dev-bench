import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from './exec.js';
import { readRunState, writeRunState } from './run-state.js';

const defaultWindowsKindNodeImage = 'kindest/node:v1.29.4';

function resolveKindNodeImage(): string | null {
  const explicitImage = process.env.KIND_NODE_IMAGE?.trim();
  if (explicitImage) return explicitImage;

  if (process.platform === 'win32') {
    return defaultWindowsKindNodeImage;
  }

  return null;
}

export type KindInfo = {
  clusterName: string;
  kubeconfigYaml: string;
  contextName: string;
};

function isRecoverableKubeconfigError(output: string): boolean {
  return (
    /failed to get cluster internal kubeconfig/i.test(output) ||
    /container\s+[0-9a-f]+\s+is\s+not\s+running/i.test(output) ||
    /is not running/i.test(output)
  );
}

function isTransientConnectError(output: string): boolean {
  return (
    /unable to connect to the server/i.test(output) ||
    /the connection to the server .* was refused/i.test(output) ||
    /connectex/i.test(output) ||
    /only one usage of each socket address/i.test(output) ||
    /i\/o timeout/i.test(output) ||
    /tls handshake timeout/i.test(output) ||
    /unexpected eof/i.test(output)
  );
}

async function refreshRunStateKubeconfig(kindInfo: KindInfo) {
  try {
    const state = await readRunState();
    await writeRunState({
      ...state,
      clusterName: kindInfo.clusterName,
      contextName: kindInfo.contextName,
      kubeconfigYaml: kindInfo.kubeconfigYaml,
    });
  } catch {
    // Best-effort only. Local dev runs may not have run-state yet.
  }
}

async function recoverKubeconfigForApiAvailability(kubeconfigPath: string): Promise<boolean> {
  const clusterName = process.env.KIND_CLUSTER_NAME || 'kdb-e2e';
  console.log(`[e2e][kind] ${new Date().toISOString()} API unavailable; attempting KinD recovery for cluster '${clusterName}'`);

  try {
    const recovered = await ensureKindCluster(clusterName);
    await fs.writeFile(kubeconfigPath, recovered.kubeconfigYaml, 'utf-8');
    await refreshRunStateKubeconfig(recovered);
    console.log(`[e2e][kind] ${new Date().toISOString()} KinD recovery complete; kubeconfig refreshed`);
    return true;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.log(`[e2e][kind] ${new Date().toISOString()} KinD recovery failed: ${message}`);
    return false;
  }
}

export async function ensureKindCluster(clusterName: string): Promise<KindInfo> {
  const kindNodeImage = resolveKindNodeImage();

  for (let attempt = 1; attempt <= 2; attempt++) {
    console.log(`[e2e][kind] ${new Date().toISOString()} ensureKindCluster name=${clusterName} attempt=${attempt}`);
    // Check cluster exists
    const list = await exec('kind', ['get', 'clusters'], { timeoutMs: 120_000 });
    if (list.code !== 0) {
      throw new Error(`kind get clusters failed: ${list.stderr || list.stdout}`);
    }

    const clusters = list.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!clusters.includes(clusterName)) {
      console.log(
        `[e2e][kind] ${new Date().toISOString()} creating cluster '${clusterName}' (wait=120s` +
          `${kindNodeImage ? `, image=${kindNodeImage}` : ''})`
      );
      const createArgs = ['create', 'cluster', '--name', clusterName, '--wait', '120s'];
      if (kindNodeImage) {
        createArgs.push('--image', kindNodeImage);
      }
      const created = await exec('kind', createArgs, {
        timeoutMs: 5 * 60_000,
      });
      if (created.code !== 0) {
        throw new Error(`kind create cluster failed: ${created.stderr || created.stdout}`);
      }
    } else {
      console.log(`[e2e][kind] ${new Date().toISOString()} reusing existing cluster '${clusterName}'`);
    }

    const kc = await exec('kind', ['get', 'kubeconfig', '--name', clusterName], { timeoutMs: 120_000 });
    if (kc.code === 0) {
      const kubeconfigYaml = kc.stdout;
      // Convention: kind names the context like "kind-<clusterName>"
      const contextName = `kind-${clusterName}`;
      console.log(`[e2e][kind] ${new Date().toISOString()} kubeconfig retrieved; context=${contextName}`);
      return { clusterName, kubeconfigYaml, contextName };
    }

    const output = `${kc.stderr || ''}\n${kc.stdout || ''}`.trim();
    if (attempt === 1 && isRecoverableKubeconfigError(output)) {
      console.log(`[e2e][kind] ${new Date().toISOString()} kubeconfig error looks recoverable; recreating cluster '${clusterName}'`);
      // A previously-created cluster can become broken (e.g. control-plane container stopped).
      // Best-effort: delete and recreate once.
      await exec('kind', ['delete', 'cluster', '--name', clusterName], { timeoutMs: 120_000 });
      continue;
    }

    throw new Error(`kind get kubeconfig failed: ${output || kc.stderr || kc.stdout}`);
  }

  // Unreachable, but keeps TS happy.
  throw new Error('ensureKindCluster exhausted retries');
}

export async function kubectl(args: string[], opts: { kubeconfigPath: string; timeoutMs?: number } ) {
  return exec('kubectl', ['--kubeconfig', opts.kubeconfigPath, ...args], {
    timeoutMs: opts.timeoutMs ?? 60_000,
  });
}

export async function writeKubeconfigFile(dir: string, kubeconfigYaml: string) {
  await fs.mkdir(dir, { recursive: true });
  const kubeconfigPath = path.join(dir, 'kubeconfig');
  await fs.writeFile(kubeconfigPath, kubeconfigYaml, 'utf-8');
  return kubeconfigPath;
}

export async function writeNamedKubeconfigFile(dir: string, fileName: string, kubeconfigYaml: string) {
  await fs.mkdir(dir, { recursive: true });
  const kubeconfigPath = path.join(dir, fileName);
  await fs.writeFile(kubeconfigPath, kubeconfigYaml, 'utf-8');
  return kubeconfigPath;
}

export async function ensureNamespace(kubeconfigPath: string, namespace: string) {
  const allowClusterRecovery = process.env.E2E_RECOVER_KIND_DURING_NAMESPACE_SETUP === '1';

  const ensureNamespaceOnce = async () => {
    const waitForApiReady = async () => {
      let lastOutput = '';
      for (let attempt = 1; attempt <= 20; attempt++) {
        const probe = await kubectl(['get', 'ns', 'default'], {
          kubeconfigPath,
          timeoutMs: 15_000,
        });
        if (probe.code === 0) {
          return;
        }

        const output = `${probe.stderr || ''}\n${probe.stdout || ''}`.trim();
        lastOutput = output;
        if (!isTransientConnectError(output)) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.min(attempt, 5)));
      }

      throw new Error(`Kubernetes API not ready: ${lastOutput || 'probe failed'}`);
    };

    await waitForApiReady();

    const get = await kubectl(['get', 'ns', namespace], { kubeconfigPath, timeoutMs: 60_000 });
    if (get.code === 0) return;

    const initialMessage = `${get.stderr || ''}\n${get.stdout || ''}`.trim();

    for (let attempt = 1; attempt <= 5; attempt++) {
      const create = await kubectl(['create', 'ns', namespace], { kubeconfigPath, timeoutMs: 60_000 });
      if (create.code === 0) return;

      const message = `${create.stderr || ''}\n${create.stdout || ''}`.trim();
      if (/already exists/i.test(message)) {
        return;
      }

      const transient = isTransientConnectError(message) || (attempt === 1 && isTransientConnectError(initialMessage));
      if (attempt < 5 && transient) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
        continue;
      }

      throw new Error(`Failed creating namespace ${namespace}: ${message || create.stderr || create.stdout}`);
    }
  };

  for (let cycle = 1; cycle <= 4; cycle++) {
    try {
      await ensureNamespaceOnce();
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const isFinalCycle = cycle === 4;
      if (!isFinalCycle && isTransientConnectError(message)) {
        if (allowClusterRecovery) {
          const recovered = await recoverKubeconfigForApiAvailability(kubeconfigPath);
          if (recovered) continue;
        }

        await new Promise((resolve) => setTimeout(resolve, 1000 * cycle));
        continue;
      }
      throw err;
    }
  }
}

export async function deleteNamespace(kubeconfigPath: string, namespace: string) {
  // Namespace termination can take a while (finalizers, PV/PVC cleanup). For E2E isolation we only
  // need to *request* deletion; waiting can exceed Playwright's fixture teardown timeout.
  await kubectl(['delete', 'ns', namespace, '--ignore-not-found=true', '--wait=false'], {
    kubeconfigPath,
    timeoutMs: 60_000,
  });
}

export async function cleanupWorkerNamespaces(
  kubeconfigPath: string,
  currentRunId: string,
  log: (msg: string) => void = (msg) => console.log(msg)
) {
  const list = await kubectl(['get', 'ns', '-o', 'json'], { kubeconfigPath, timeoutMs: 60_000 });
  if (list.code !== 0) {
    const message = `${list.stderr || ''}\n${list.stdout || ''}`.trim();
    log(`[e2e][kind] namespace cleanup skipped: ${message || 'kubectl get ns failed'}`);
    return;
  }

  let data: { items?: Array<{ metadata?: { name?: string } }> } = {};
  try {
    data = JSON.parse(list.stdout) as { items?: Array<{ metadata?: { name?: string } }> };
  } catch (err) {
    log(`[e2e][kind] namespace cleanup skipped: failed to parse kubectl output (${String(err)})`);
    return;
  }

  const candidates = (data.items ?? [])
    .map((item) => item.metadata?.name)
    .filter((name): name is string => Boolean(name));

  const workerNsPattern = /^kdb-e2e-(.+)-(?:w|p)\d+$/;
  const stale = candidates.filter((name) => {
    const match = name.match(workerNsPattern);
    return match ? match[1] !== currentRunId : false;
  });

  if (stale.length === 0) {
    log('[e2e][kind] no stale worker namespaces found');
    return;
  }

  log(`[e2e][kind] deleting stale worker namespaces: ${stale.join(', ')}`);
  for (const ns of stale) {
    await deleteNamespace(kubeconfigPath, ns);
  }
}

export async function helm(
  args: string[],
  opts: { kubeconfigPath: string; timeoutMs?: number; homeDir?: string; env?: NodeJS.ProcessEnv }
) {
  try {
    const env: NodeJS.ProcessEnv = { ...opts.env };

    if (opts.homeDir) {
      const helmCacheHome = path.join(opts.homeDir, '.cache', 'helm');
      const helmConfigHome = path.join(opts.homeDir, '.config', 'helm');
      const helmDataHome = path.join(opts.homeDir, '.local', 'share', 'helm');

      await Promise.all([
        fs.mkdir(helmCacheHome, { recursive: true }),
        fs.mkdir(helmConfigHome, { recursive: true }),
        fs.mkdir(helmDataHome, { recursive: true }),
      ]);

      // Ensure helm does not share cache/config between parallel workers.
      env.HOME = opts.homeDir;
      env.USERPROFILE = opts.homeDir;
      env.HELM_CACHE_HOME = helmCacheHome;
      env.HELM_CONFIG_HOME = helmConfigHome;
      env.HELM_DATA_HOME = helmDataHome;
    }

    return await exec('helm', ['--kubeconfig', opts.kubeconfigPath, ...args], {
      timeoutMs: opts.timeoutMs ?? 120_000,
      env,
    });
  } catch (err: unknown) {
    // If helm isn't installed/available on PATH, Node will throw ENOENT.
    // For E2E, treat this as a normal non-zero exit so tests can `test.skip()`.
    const anyErr = err as { code?: string; message?: string };
    if (anyErr?.code === 'ENOENT') {
      return { code: 127, stdout: '', stderr: anyErr.message ?? 'spawn helm ENOENT' };
    }
    throw err;
  }
}
