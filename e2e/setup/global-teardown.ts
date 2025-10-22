import path from 'node:path';
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
  console.log('[e2e teardown] Stopping KinD manager...');
  if (process.env.KIND_AVAILABLE === '1') {
    await run('docker', ['compose', '-f', composeFile, 'down'], { cwd: repoRoot });
  } else {
    console.log('[e2e teardown] KinD was not started by tests; skipping docker compose down.');
  }
  // Stop wails dev if started
  try {
    const pidFile = path.join(repoRoot, 'e2e', '.wails-dev.pid');
    const pid = (await (await import('node:fs')).promises.readFile(pidFile, 'utf-8')).trim();
    if (pid) {
      console.log('[e2e teardown] Killing wails dev (PID ' + pid + ')...');
      try { execSync(process.platform === 'win32' ? `taskkill /PID ${pid} /T /F` : `kill -9 ${pid}`); } catch {}
    }
  } catch {}
}
