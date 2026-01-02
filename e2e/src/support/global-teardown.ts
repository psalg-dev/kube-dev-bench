import { clearRunState, readRunState } from './run-state.js';
import { exec } from './exec.js';

export default async function globalTeardown() {
  // Namespaces are deleted per-worker fixture; global teardown just clears state.
  try {
    const state = await readRunState();

    if (process.platform === 'win32') {
      // Best-effort: kill shared servers if they were started.
      const pids = [state.sharedWailsPid, state.sharedVitePid].filter((p): p is number => typeof p === 'number');
      for (const pid of pids) {
        await exec('taskkill', ['/PID', String(pid), '/T', '/F'], { timeoutMs: 30_000 });
      }
    }
  } catch {
    // ignore
  }
  await clearRunState();
}
