import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from './exec.js';

export type KindInfo = {
  clusterName: string;
  kubeconfigYaml: string;
  contextName: string;
};

export async function ensureKindCluster(clusterName: string): Promise<KindInfo> {
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
  if (kc.code !== 0) {
    throw new Error(`kind get kubeconfig failed: ${kc.stderr || kc.stdout}`);
  }

  const kubeconfigYaml = kc.stdout;
  // Convention: kind names the context like "kind-<clusterName>"
  const contextName = `kind-${clusterName}`;

  return { clusterName, kubeconfigYaml, contextName };
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

export async function ensureNamespace(kubeconfigPath: string, namespace: string) {
  const get = await kubectl(['get', 'ns', namespace], { kubeconfigPath, timeoutMs: 20_000 });
  if (get.code === 0) return;
  const create = await kubectl(['create', 'ns', namespace], { kubeconfigPath, timeoutMs: 20_000 });
  if (create.code !== 0) {
    throw new Error(`Failed creating namespace ${namespace}: ${create.stderr || create.stdout}`);
  }
}

export async function deleteNamespace(kubeconfigPath: string, namespace: string) {
  // Namespace termination can take a while (finalizers, PV/PVC cleanup). For E2E isolation we only
  // need to *request* deletion; waiting can exceed Playwright's fixture teardown timeout.
  await kubectl(['delete', 'ns', namespace, '--ignore-not-found=true', '--wait=false'], {
    kubeconfigPath,
    timeoutMs: 20_000,
  });
}
