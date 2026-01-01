import { FullConfig } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { spawn } from 'node:child_process';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const wait = (ms: number) => new Promise(res => setTimeout(res, ms));

// Check if wails dev server is already running
async function isDevServerRunning(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url.replace('localhost', '127.0.0.1'), (res) => {
      res.resume();
      resolve((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 500);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(2000, () => { req.destroy(); resolve(false); });
  });
}

// Check if kind manager is already running
async function isKindManagerRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const child = spawn('docker', ['ps', '--filter', 'name=kind-manager', '--format', '{{.Names}}'], { shell: false });
    let output = '';
    child.stdout.on('data', (d) => { output += d.toString(); });
    child.on('error', () => resolve(false));
    child.on('close', () => resolve(output.includes('kind-manager')));
  });
}

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
  const targetUrl = process.env.WAILS_URL || 'http://localhost:34115';

  // Check if infrastructure is already running (for faster local dev)
  const kindAlreadyRunning = await isKindManagerRunning();
  const devServerAlreadyRunning = await isDevServerRunning(targetUrl);
  
  // Track what we started so teardown knows what to stop
  const stateFile = path.join(repoRoot, 'e2e', '.e2e-state.json');
  const state = { startedKind: false, startedWails: false };

  // Handle KinD manager
  if (kindAlreadyRunning && await fileExists(kubeconfigPath)) {
    console.log('[e2e setup] KinD manager already running, reusing existing cluster.');
    process.env.KUBEDEV_BENCH_KIND_KUBECONFIG = kubeconfigPath;
    process.env.KIND_AVAILABLE = '1';
  } else {
    // Start KinD manager via docker compose
    try {
      console.log('[e2e setup] Checking Docker availability...');
      await run('docker', ['version']);
      console.log('[e2e setup] Starting KinD manager...');
      await run('docker', ['compose', '-f', composeFile, 'up', '-d'], { cwd: repoRoot });
      state.startedKind = true;
      console.log(`[e2e setup] Waiting for kubeconfig at ${kubeconfigPath} ...`);
      await waitForFile(kubeconfigPath, 180_000);
      // Fix permissions on kubeconfig file (Docker creates it with root ownership)
      // In CI, Docker volumes may create files with root ownership that the runner can't read.
      // Copy the file content to a new location we control (e2e temp home).
      if (process.env.CI) {
        try {
          const kubeconfigContent = await new Promise<string>((resolve, reject) => {
            const child = spawn('docker', ['exec', 'kind-manager', 'cat', '/kind/output/kubeconfig'], { shell: false });
            let stdout = '';
            child.stdout.on('data', (d) => { stdout += d.toString(); });
            child.on('error', reject);
            child.on('close', (code) => code === 0 ? resolve(stdout) : reject(new Error('docker exec cat failed')));
          });
          // Write to e2e temp home directory instead of Docker volume
          const tempHome = path.join(repoRoot, 'e2e', '.home-e2e');
          await fs.promises.mkdir(tempHome, { recursive: true });
          const accessibleKubeconfigPath = path.join(tempHome, 'kubeconfig');
          await fs.promises.writeFile(accessibleKubeconfigPath, kubeconfigContent, { mode: 0o644 });
          console.log('[e2e setup] Copied kubeconfig to:', accessibleKubeconfigPath);
          // Update the environment variable to point to the accessible copy
          process.env.KUBEDEV_BENCH_KIND_KUBECONFIG = accessibleKubeconfigPath;
        } catch (copyErr) {
          console.warn('[e2e setup] Could not copy kubeconfig from container:', copyErr);
        }
      } else {
        try {
          await run('docker', ['exec', 'kind-manager', 'chmod', '644', '/kind/output/kubeconfig']);
          console.log('[e2e setup] Fixed kubeconfig permissions inside container.');
        } catch (chmodErr) {
          console.warn('[e2e setup] Could not chmod kubeconfig via docker:', chmodErr);
        }
      }
      // Wait for KinD manager to finish namespace setup
      console.log('[e2e setup] Waiting for KinD manager to complete setup...');
      const setupCheckTimeout = 180_000;
      const setupCheckStart = Date.now();
      let setupComplete = false;
      while (Date.now() - setupCheckStart < setupCheckTimeout) {
        try {
          const logs = await new Promise<string>((resolve, reject) => {
            const child = spawn('docker', ['logs', '--tail', '20', 'kind-manager'], { shell: false });
            let output = '';
            child.stdout.on('data', (d) => { output += d.toString(); });
            child.stderr.on('data', (d) => { output += d.toString(); });
            child.on('error', reject);
            child.on('close', () => resolve(output));
          });
          if (logs.includes('Example resources applied successfully') || logs.includes('[kind-manager] Example resources applied')) {
            console.log('[e2e setup] KinD manager setup complete.');
            setupComplete = true;
            break;
          }
          const nsStatus = await new Promise<string>((resolve, reject) => {
            const child = spawn('docker', ['exec', 'kind-manager', 'sh', '-c', "kubectl --kubeconfig /kind/output/kubeconfig.internal get ns test -o jsonpath='{.status.phase}'"], { shell: false });
            let stdout = '';
            child.stdout.on('data', (d) => { stdout += d.toString(); });
            child.on('error', reject);
            child.on('close', (code) => code === 0 ? resolve(stdout.trim().replace(/['"]/g, '')) : reject(new Error('kubectl failed')));
          });
          console.log(`[e2e setup] Namespace status: ${nsStatus}, waiting for setup completion...`);
        } catch {
          // Container or namespace might not be ready yet
        }
        await wait(5_000);
      }
      if (!setupComplete) {
        console.warn('[e2e setup] Timeout waiting for KinD manager setup, proceeding anyway...');
      }
      await wait(5_000);

      // Verify cluster is ready by checking that example pods exist and are running
      console.log('[e2e setup] Verifying example resources are ready...');
      const clusterReadyTimeout = 120_000;
      const clusterReadyStart = Date.now();
      let clusterReady = false;
      while (Date.now() - clusterReadyStart < clusterReadyTimeout) {
        try {
          const podStatus = await new Promise<string>((resolve, reject) => {
            const child = spawn('docker', ['exec', 'kind-manager', 'sh', '-c',
              "kubectl --kubeconfig /kind/output/kubeconfig.internal get pods -n test -o jsonpath='{range .items[*]}{.metadata.name}:{.status.phase} {end}'"
            ], { shell: false });
            let stdout = '';
            child.stdout.on('data', (d) => { stdout += d.toString(); });
            child.on('error', reject);
            child.on('close', (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error('kubectl failed')));
          });
          // Check if example-pod exists and is Running
          if (podStatus.includes('example-pod:Running')) {
            console.log('[e2e setup] Example resources are ready.');
            clusterReady = true;
            break;
          }
          console.log(`[e2e setup] Waiting for pods to be ready: ${podStatus.substring(0, 100)}...`);
        } catch {
          // Might not be ready yet
        }
        await wait(5_000);
      }
      if (!clusterReady) {
        console.warn('[e2e setup] Could not verify example resources, proceeding anyway...');
      }

      process.env.KUBEDEV_BENCH_KIND_KUBECONFIG = kubeconfigPath;
      process.env.KIND_AVAILABLE = '1';
      console.log('[e2e setup] kubeconfig ready.');
    } catch (err) {
      console.warn('[e2e setup] Docker is not available or failed to start KinD.');
      if (await fileExists(kubeconfigPath)) {
        console.warn('[e2e setup] Using existing kubeconfig file on disk.');
        process.env.KUBEDEV_BENCH_KIND_KUBECONFIG = kubeconfigPath;
      }
      process.env.KIND_AVAILABLE = '0';
    }
  }

  // Handle Wails dev server
  if (devServerAlreadyRunning) {
    console.log('[e2e setup] Wails DevServer already running at ' + targetUrl + ', reusing it.');
  } else {
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
    state.startedWails = true;
    // Persist PID for teardown
    const pidFile = path.join(repoRoot, 'e2e', '.wails-dev.pid');
    try { await fs.promises.writeFile(pidFile, String(dev.pid ?? '')); } catch {}

    const pingUrl = targetUrl.replace('localhost', '127.0.0.1');
    console.log(`[e2e setup] Waiting for Wails DevServer at ${targetUrl} ...`);
    const devServerTimeout = process.env.CI ? 300_000 : 120_000;
    await new Promise<void>((resolve, reject) => {
      const started = Date.now();
      const tryOnce = () => {
        const req = http.get(pingUrl, (res) => {
          res.resume();
          if ((res.statusCode ?? 0) >= 200 && (res.statusCode ?? 0) < 500) resolve();
          else if (Date.now() - started > devServerTimeout) reject(new Error('Timeout'));
          else setTimeout(tryOnce, 1000);
        });
        req.on('error', () => {
          if (Date.now() - started > devServerTimeout) reject(new Error('Timeout'));
          else setTimeout(tryOnce, 1000);
        });
      };
      tryOnce();
    });
    console.log('[e2e setup] Wails DevServer is ready.');
  }

  // Save state for teardown
  try { await fs.promises.writeFile(stateFile, JSON.stringify(state)); } catch {}
  
  process.env.WAILS_URL = targetUrl;
}
