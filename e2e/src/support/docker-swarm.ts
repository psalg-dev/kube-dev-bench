import { exec } from './exec.js';

function splitLines(s: string): string[] {
  return s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter(Boolean);
}

async function docker(args: string[], timeoutMs = 60_000) {
  return exec('docker', args, { timeoutMs });
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
