import { clearRunState, readRunState } from './run-state.js';
import { exec } from './exec.js';

function isoNow() {
  return new Date().toISOString();
}

export default async function globalTeardown() {
  // Namespaces are deleted per-worker fixture; global teardown just clears state.
  try {
    console.log(`[e2e][teardown] ${isoNow()} starting`);
    const state = await readRunState();

    // Best-effort: kill any servers we started.
    const poolPids = (state.wailsInstances ?? []).map((w) => w.pid).filter((p): p is number => typeof p === 'number');
    const pids = [state.frontendPid, state.sharedWailsPid, state.proxyPid, ...poolPids].filter(
      (p): p is number => typeof p === 'number'
    );

    if (pids.length === 0) {
      console.log(`[e2e][teardown] ${isoNow()} no tracked pids to kill`);
    } else {
      console.log(`[e2e][teardown] ${isoNow()} killing pids: ${pids.join(', ')}`);
    }

    for (const pid of pids) {
      if (process.platform === 'win32') {
        await exec('taskkill', ['/PID', String(pid), '/T', '/F'], { timeoutMs: 30_000 });
      } else {
        await exec('bash', ['-lc', `kill -TERM ${pid} 2>/dev/null || true; sleep 1; kill -KILL ${pid} 2>/dev/null || true`], { timeoutMs: 30_000 });
      }
    }

    console.log(`[e2e][teardown] ${isoNow()} finished`);
  } catch {
    // ignore
  }
  await clearRunState();
}
