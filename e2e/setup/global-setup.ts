import { FullConfig } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

async function fileExists(p: string) {
  try { await fs.promises.access(p, fs.constants.F_OK); return true; } catch { return false; }
}

async function waitForFile(p: string, timeoutMs = 120_000) {
  const start = Date.now();
  while (!(await fileExists(p))) {
    if (Date.now() - start > timeoutMs) throw new Error(`Timed out waiting for file: ${p}`);
    await wait(1000);
  }
}

function run(command: string, args: string[], options: { cwd?: string } = {}) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, stdio: 'inherit', shell: false });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve(); else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

export default async function globalSetup(_config: FullConfig) {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, '..', '..');
  const composeFile = path.join(repoRoot, 'kind', 'docker-compose.yml');
  const kubeconfigPath = path.join(repoRoot, 'kind', 'output', 'kubeconfig');

  // Start KinD manager via docker compose
  try {
    console.log('[e2e setup] Checking Docker availability...');
    await run('docker', ['version']);
    console.log('[e2e setup] Starting KinD manager...');
    await run('docker', ['compose', '-f', composeFile, 'up', '-d'], { cwd: repoRoot });
    console.log(`[e2e setup] Waiting for kubeconfig at ${kubeconfigPath} ...`);
    await waitForFile(kubeconfigPath, 180_000);
    // Wait for KinD manager to apply test manifests (test namespace)
    await wait(20_000);
    process.env.KUBEDEV_BENCH_KIND_KUBECONFIG = kubeconfigPath;
    process.env.KIND_AVAILABLE = '1';
    console.log('[e2e setup] kubeconfig ready.');
  } catch (err) {
    console.warn('[e2e setup] Docker is not available or failed to start KinD.');
    // Fallback: if a kubeconfig already exists in repo, use it (best effort)
    if (await fileExists(kubeconfigPath)) {
      console.warn('[e2e setup] Using existing kubeconfig file on disk. Connection may fail if cluster is not running.');
      process.env.KUBEDEV_BENCH_KIND_KUBECONFIG = kubeconfigPath;
    }
    process.env.KIND_AVAILABLE = '0';
  }

  // Start wails dev and wait for DevServer to respond
  console.log('[e2e setup] Starting wails dev...');
  // Isolate HOME for deterministic ~/.kube paths
  const tempHome = path.join(repoRoot, 'e2e', '.home-e2e');
  try { await fs.promises.mkdir(tempHome, { recursive: true }); } catch {}
  // Clean any previous app state to ensure "no kubeconfig on host" scenario for basic test
  try { await fs.promises.rm(path.join(tempHome, '.kube'), { recursive: true, force: true }); } catch {}
  try { await fs.promises.rm(path.join(tempHome, 'KubeDevBench'), { recursive: true, force: true }); } catch {}
  
  // On Linux CI, use xvfb-run to provide a virtual display for GTK
  const isLinuxCI = process.env.CI && process.platform === 'linux';
  const command = isLinuxCI ? 'xvfb-run' : 'wails';
  const args = isLinuxCI ? ['-a', 'wails', 'dev'] : ['dev'];
  
  const dev = spawn(command, args, {
    cwd: repoRoot,
    shell: false,
    env: { ...process.env, HOME: tempHome, USERPROFILE: tempHome },
  });
  dev.stdout.on('data', (d) => process.stdout.write(d.toString()));
  dev.stderr.on('data', (d) => process.stderr.write(d.toString()));
  // Persist PID for teardown
  const pidFile = path.join(repoRoot, 'e2e', '.wails-dev.pid');
  try { await fs.promises.writeFile(pidFile, String(dev.pid ?? '')); } catch {}

  const targetUrl = process.env.WAILS_URL || 'http://localhost:34115';
  const pingUrl = targetUrl.replace('localhost', '127.0.0.1');
  console.log(`[e2e setup] Waiting for Wails DevServer at ${targetUrl} ...`);
  await new Promise<void>((resolve, reject) => {
    const started = Date.now();
    const tryOnce = () => {
  const req = http.get(pingUrl, (res) => {
        res.resume();
        if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 500) resolve();
        else if (Date.now() - started > 120_000) reject(new Error('Timeout'));
        else setTimeout(tryOnce, 1000);
      });
      req.on('error', () => {
        if (Date.now() - started > 120_000) reject(new Error('Timeout'));
        else setTimeout(tryOnce, 1000);
      });
    };
    tryOnce();
  });
  process.env.WAILS_URL = targetUrl;
  console.log('[e2e setup] Wails DevServer is ready.');
}
