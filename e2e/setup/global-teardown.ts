import path from 'node:path';
import fs from 'node:fs';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

function run(command: string, args: string[], options: { cwd?: string } = {}) {
  return new Promise<void>((resolve) => {
    const child = spawn(command, args, { cwd: options.cwd, stdio: 'inherit', shell: false });
    child.on('exit', () => resolve());
    child.on('error', () => resolve());
  });
}

export default async function globalTeardown() {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, '..', '..');
  const composeFile = path.join(repoRoot, 'kind', 'docker-compose.yml');
  const stateFile = path.join(repoRoot, 'e2e', '.e2e-state.json');
  
  // Skip all teardown if E2E_KEEP_ALIVE is set (for fast local dev iterations)
  if (process.env.E2E_KEEP_ALIVE === '1') {
    console.log('[e2e teardown] E2E_KEEP_ALIVE=1, skipping teardown. Run `npm run infra:stop` to clean up.');
    return;
  }
  
  // Read what we started
  let state = { startedKind: false, startedWails: false };
  try {
    const content = await fs.promises.readFile(stateFile, 'utf-8');
    state = JSON.parse(content);
  } catch {
    // If no state file, assume we need to clean up everything (CI mode)
    state = { startedKind: process.env.KIND_AVAILABLE === '1', startedWails: true };
  }
  
  // Only stop KinD if we started it
  if (state.startedKind) {
    console.log('[e2e teardown] Stopping KinD manager...');
    await run('docker', ['compose', '-f', composeFile, 'down'], { cwd: repoRoot });
  } else {
    console.log('[e2e teardown] KinD was already running; leaving it up for next test run.');
  }
  
  // Only stop wails if we started it
  if (state.startedWails) {
    try {
      const pidFile = path.join(repoRoot, 'e2e', '.wails-dev.pid');
      const pid = (await fs.promises.readFile(pidFile, 'utf-8')).trim();
      if (pid) {
        console.log('[e2e teardown] Killing wails dev (PID ' + pid + ')...');
        try { execSync(process.platform === 'win32' ? `taskkill /PID ${pid} /T /F` : `kill -9 ${pid}`); } catch {}
      }
    } catch {}
  } else {
    console.log('[e2e teardown] Wails dev was already running; leaving it up for next test run.');
  }
  
  // Clean up state file
  try { await fs.promises.unlink(stateFile); } catch {}
}
