import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from './exec.js';

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

export async function ensureKindCluster(clusterName: string): Promise<KindInfo> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    // Check cluster exists
    const list = await exec('kind', ['get', 'clusters'], { timeoutMs: 60_000 });
    if (list.code !== 0) {
      throw new Error(`kind get clusters failed: ${list.stderr || list.stdout}`);
    }

    const clusters = list.stdout
      .split(/\r?\n/)
      .map((s) => s.trim())
      .filter(Boolean);

    if (!clusters.includes(clusterName)) {
      const created = await exec('kind', ['create', 'cluster', '--name', clusterName, '--wait', '120s'], {
        timeoutMs: 5 * 60_000,
      });
      if (created.code !== 0) {
        throw new Error(`kind create cluster failed: ${created.stderr || created.stdout}`);
      }
    }

    const kc = await exec('kind', ['get', 'kubeconfig', '--name', clusterName], { timeoutMs: 60_000 });
    if (kc.code === 0) {
      const kubeconfigYaml = kc.stdout;
      // Convention: kind names the context like "kind-<clusterName>"
      const contextName = `kind-${clusterName}`;
      return { clusterName, kubeconfigYaml, contextName };
    }

    const output = `${kc.stderr || ''}\n${kc.stdout || ''}`.trim();
    if (attempt === 1 && isRecoverableKubeconfigError(output)) {
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
  const get = await kubectl(['get', 'ns', namespace], { kubeconfigPath, timeoutMs: 60_000 });
  if (get.code === 0) return;
  const create = await kubectl(['create', 'ns', namespace], { kubeconfigPath, timeoutMs: 60_000 });
  if (create.code !== 0) {
    throw new Error(`Failed creating namespace ${namespace}: ${create.stderr || create.stdout}`);
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
