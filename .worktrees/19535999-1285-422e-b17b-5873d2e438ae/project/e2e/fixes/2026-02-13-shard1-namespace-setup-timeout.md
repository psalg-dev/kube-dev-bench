# 2026-02-13 — Shard-1 namespace fixture timeouts around parallel completion

## Symptom
- CI Build #607 failed on shard-1 with:
  - `Fixture "namespace" timeout of 300000ms exceeded during setup`
  - `#namespace-root` showing `Select namespaces…` instead of worker namespace
- Failure appeared later in the run and correlated with reconnect behavior, creating suspicion that another shard/worker teardown was killing the active app process.

## Investigation
- Reviewed process lifecycle in:
  - `e2e/src/support/global-setup.ts`
  - `e2e/src/support/global-teardown.ts`
  - `e2e/src/fixtures.ts`
  - `e2e/src/support/wails.ts`
- Verified teardown only kills PIDs tracked in this job's run-state (`.run/state.json`) and only at global teardown.
- Checked shard-1 Wails logs (`prebuilt-34200.log`, `prebuilt-34201.log`): no mid-run process kills; clean `Ctrl+C` exits at teardown.
- Found a higher-risk behavior in `ensureNamespace`:
  - on transient API errors it could call `recoverKubeconfigForApiAvailability()`
  - recovery may recreate KinD (delete/recreate cluster)
  - this is destructive during active parallel workers and can cause reconnects + namespace fixture failures.

## Root Cause (most likely)
- Not accidental cross-shard Wails PID kill.
- More likely: destructive KinD recovery during worker namespace setup causes cluster/API disruption for other active workers.

## Fix Implemented
- `e2e/src/support/kind.ts`
  - gated destructive cluster recovery behind opt-in env var:
    - `E2E_RECOVER_KIND_DURING_NAMESPACE_SETUP=1`
  - default behavior now retries/backoff on transient API errors without recreating the cluster during worker setup.

## Approaches Tried
- ✅ Successful: code-level process lifecycle audit + run artifact log inspection to rule out wrong-process termination.
- ✅ Successful: non-destructive namespace setup behavior by default.
- ⚠️ Not conclusive locally: full CI-like validation with prebuilt binary (local prebuilt binary not present in this environment).

## Follow-up
- Re-run CI and confirm shard-1 no longer exhibits namespace fixture setup timeouts.
- Keep destructive recovery only for explicit troubleshooting runs via env opt-in.
