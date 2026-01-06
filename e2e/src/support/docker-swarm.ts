import { exec } from './exec.js';
import os from 'node:os';
import fs from 'node:fs/promises';
import path from 'node:path';

function splitLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function docker(args: string[], timeoutMs = 60_000) {
  return exec('docker', args, { timeoutMs });
}

async function writeTempFile(prefix: string, content: string): Promise<string> {
  const dir = os.tmpdir();
  const file = path.join(dir, `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`);
  await fs.writeFile(file, content, 'utf-8');
  return file;
}

export async function ensureSwarmConfig(opts: { name: string; content: string }) {
  const { name, content } = opts;

  const list = await docker(['config', 'ls', '--format', '{{.Name}}'], 30_000);
  if (list.code === 0 && splitLines(list.stdout).includes(name)) return;

  const tmp = await writeTempFile('kdb-e2e-config', content);
  try {
    const res = await docker(['config', 'create', name, tmp], 60_000);
    // If it already exists (race between workers), ignore.
    if (res.code !== 0 && !/already exists/i.test(res.stderr + res.stdout)) {
      throw new Error(`docker config create failed: ${res.stderr || res.stdout}`);
    }
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
  }
}

export async function ensureSwarmSecret(opts: { name: string; content: string }) {
  const { name, content } = opts;

  const list = await docker(['secret', 'ls', '--format', '{{.Name}}'], 30_000);
  if (list.code === 0 && splitLines(list.stdout).includes(name)) return;

  const tmp = await writeTempFile('kdb-e2e-secret', content);
  try {
    const res = await docker(['secret', 'create', name, tmp], 60_000);
    if (res.code !== 0 && !/already exists/i.test(res.stderr + res.stdout)) {
      throw new Error(`docker secret create failed: ${res.stderr || res.stdout}`);
    }
  } finally {
    await fs.rm(tmp, { force: true }).catch(() => undefined);
  }
}

export async function ensureSwarmNetwork(opts: { name: string }) {
  const { name } = opts;

  const list = await docker(['network', 'ls', '--filter', `name=^${name}$`, '--format', '{{.Name}}'], 30_000);
  if (list.code === 0 && splitLines(list.stdout).includes(name)) return;

  const res = await docker(['network', 'create', '--driver', 'overlay', '--attachable', name], 60_000);
  // If it already exists (race between workers), ignore.
  if (res.code !== 0 && !/already exists/i.test(res.stderr + res.stdout)) {
    throw new Error(`docker network create failed: ${res.stderr || res.stdout}`);
  }

  // Swarm network creation can be eventually-consistent; ensure it is visible before continuing.
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const inspect = await docker(['network', 'inspect', name], 10_000).catch(() => ({ code: 1, stdout: '', stderr: '' }));
    if (inspect.code === 0) return;
    await new Promise((r) => setTimeout(r, 500));
  }

  throw new Error(`docker network create did not become available in time: ${name}`);
}

export async function deploySwarmStackFromFile(opts: { stackName: string; stackFilePath: string }) {
  const { stackName, stackFilePath } = opts;
  const res = await docker(['stack', 'deploy', '-c', stackFilePath, stackName], 120_000);
  if (res.code !== 0) {
    throw new Error(`docker stack deploy failed: ${res.stderr || res.stdout}`);
  }
}

export async function waitForStackServicesReady(opts: {
  stackName: string;
  expectedServiceSuffixes: string[];
  timeoutMs?: number;
}) {
  const { stackName, expectedServiceSuffixes, timeoutMs = 120_000 } = opts;
  const expectedNames = new Set(expectedServiceSuffixes.map((s) => `${stackName}_${s}`));

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await docker(['stack', 'services', stackName, '--format', '{{.Name}} {{.Replicas}}'], 20_000).catch(
      () => ({ code: 1, stdout: '', stderr: '' })
    );

    if (res.code === 0) {
      const lines = splitLines(res.stdout);
      const replicasByName = new Map<string, string>();
      for (const line of lines) {
        const [name, replicas] = line.split(/\s+/, 2);
        if (!name || !replicas) continue;
        replicasByName.set(name, replicas);
      }

      let allReady = true;
      for (const name of expectedNames) {
        const rep = replicasByName.get(name);
        if (!rep) {
          allReady = false;
          break;
        }
        // Typical format: "1/1" or "0/1".
        if (!/^\d+\/\d+$/.test(rep)) {
          allReady = false;
          break;
        }
        const [running, desired] = rep.split('/').map((x) => Number(x));
        if (!Number.isFinite(running) || !Number.isFinite(desired) || running < desired || desired === 0) {
          allReady = false;
          break;
        }
      }

      if (allReady) return;
    }

    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error(`Timed out waiting for stack services to be ready: ${stackName}`);
}

export async function isLocalSwarmActive(): Promise<boolean> {
  try {
    const res = await docker(['info', '--format', '{{.Swarm.LocalNodeState}}'], 15_000);
    if (res.code !== 0) return false;
    return res.stdout.trim().toLowerCase() === 'active';
  } catch {
    return false;
  }
}

async function removeStacks() {
  const list = await docker(['stack', 'ls', '--format', '{{.Name}}'], 30_000);
  if (list.code !== 0) return;
  const stacks = splitLines(list.stdout);
  for (const name of stacks) {
    // Stack removal is async; we will also remove remaining services later.
    await docker(['stack', 'rm', name], 120_000).catch(() => undefined);
  }
}

async function removeServices() {
  const list = await docker(['service', 'ls', '-q'], 30_000);
  if (list.code !== 0) return;
  const services = splitLines(list.stdout);
  if (services.length === 0) return;
  await docker(['service', 'rm', ...services], 120_000).catch(() => undefined);
}

async function removeConfigs() {
  const list = await docker(['config', 'ls', '-q'], 30_000);
  if (list.code !== 0) return;
  const ids = splitLines(list.stdout);
  if (ids.length === 0) return;
  await docker(['config', 'rm', ...ids], 60_000).catch(() => undefined);
}

async function removeSecrets() {
  const list = await docker(['secret', 'ls', '-q'], 30_000);
  if (list.code !== 0) return;
  const ids = splitLines(list.stdout);
  if (ids.length === 0) return;
  await docker(['secret', 'rm', ...ids], 60_000).catch(() => undefined);
}

async function removeSwarmNetworks() {
  // Avoid touching built-in networks like "ingress".
  const list = await docker(['network', 'ls', '--filter', 'scope=swarm', '--format', '{{.ID}} {{.Name}}'], 30_000);
  if (list.code !== 0) return;
  const lines = splitLines(list.stdout);
  const idsToRemove: string[] = [];
  for (const line of lines) {
    const [id, name] = line.split(/\s+/, 2);
    if (!id) continue;
    if ((name || '').toLowerCase() === 'ingress') continue;
    idsToRemove.push(id);
  }

  for (const id of idsToRemove) {
    await docker(['network', 'rm', id], 60_000).catch(() => undefined);
  }
}

async function removeStackVolumes() {
  // Limit to volumes created by stacks to avoid deleting user volumes.
  const list = await docker(['volume', 'ls', '-q', '--filter', 'label=com.docker.stack.namespace'], 30_000);
  if (list.code !== 0) return;
  const vols = splitLines(list.stdout);
  for (const v of vols) {
    await docker(['volume', 'rm', '-f', v], 60_000).catch(() => undefined);
  }
}

async function removeSwarmTaskContainers() {
  // Best-effort cleanup for any leftover task containers.
  const list = await docker(['ps', '-aq', '--filter', 'label=com.docker.swarm.service.name'], 30_000);
  if (list.code !== 0) return;
  const ids = splitLines(list.stdout);
  if (ids.length === 0) return;
  await docker(['rm', '-f', ...ids], 60_000).catch(() => undefined);
}

async function waitForNoServices(timeoutMs: number) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const res = await docker(['service', 'ls', '-q'], 15_000).catch(() => ({ code: 1, stdout: '', stderr: '' }));
    const services = res.code === 0 ? splitLines(res.stdout) : [];
    if (services.length === 0) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
}

export async function cleanupLocalDockerSwarmResources(opts: { log?: (msg: string) => void } = {}) {
  const log = opts.log ?? (() => undefined);

  const active = await isLocalSwarmActive();
  if (!active) {
    log('[swarm] Not active; skipping swarm cleanup');
    return;
  }

  log('[swarm] Swarm is active; cleaning existing resources');

  // Order matters: stacks -> services -> secrets/configs -> networks -> volumes.
  await removeStacks();
  await removeServices();
  await waitForNoServices(60_000).catch(() => undefined);

  await removeSwarmTaskContainers();
  await removeConfigs();
  await removeSecrets();
  await removeSwarmNetworks();
  await removeStackVolumes();

  log('[swarm] Cleanup complete');
}
