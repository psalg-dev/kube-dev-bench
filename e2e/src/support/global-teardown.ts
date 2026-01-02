import { clearRunState, readRunState } from './run-state.js';
import { exec } from './exec.js';

export default async function globalTeardown() {
  // Namespaces are deleted per-worker fixture; global teardown just clears state.
  try {
    const state = await readRunState();

    // Best-effort: kill shared servers if they were started.
    const pids = [state.sharedWailsPid].filter((p): p is number => typeof p === 'number');
    for (const pid of pids) {
      if (process.platform === 'win32') {
        await exec('taskkill', ['/PID', String(pid), '/T', '/F'], { timeoutMs: 30_000 });
      } else {
        await exec('bash', ['-lc', `kill -TERM ${pid} 2>/dev/null || true; sleep 1; kill -KILL ${pid} 2>/dev/null || true`], { timeoutMs: 30_000 });
      }
    }
  } catch {
    // ignore
  }
  await clearRunState();
}
