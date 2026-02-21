# Run 609 Shard-1 Failure Analysis (2026-02-13)

## Scope
- Repository: psalg-dev/kube-dev-bench
- Workflow run: 21981998133 (Build #609)
- Job: e2e (e2e-shard-1, 1, 34200, false, false, false)
- Result: failed

## Evidence Collected
- Check-run annotations were available via GitHub API and contained Playwright failure summaries.
- Logs zip endpoint returned 403 without auth in this environment.
- Artifact ZIP download via `gh` could not be completed because CLI was installed but unauthenticated.
- Shard-1 artifact exists and `Extract shard-1 failure summary` step completed successfully.

## Failed Tests Identified
1. tests/50-bottom-panels-workloads.spec.ts:39:1
   - bottom panels: workloads (Deployment/ReplicaSet/Pod/StatefulSet/DaemonSet)
2. tests/60-bottom-panels-batch.spec.ts:62:1
   - bottom panels: batch (Job/CronJob)

## Key Error Signals
1. Fixture setup timeout:
   - `Fixture "namespace" timeout of 300000ms exceeded during setup`
   - Location: e2e/src/fixtures.ts (test fixture extension)
2. Backend/API endpoint unavailable during create flow:
   - `dial tcp 127.0.0.1:40441: connect: connection refused`
   - surfaced in CreateOverlay.create at e2e/src/pages/CreateOverlay.ts:226
3. Workload assertion timeout:
   - `expect(...).toBeGreaterThan(0)` timed out waiting for ReplicaSet presence
4. Early stop behavior:
   - `Testing stopped early after 1 maximum allowed failures.`

## Interpretation (Likely Root Causes)
1. Wails dev backend instability/restart during test execution
   - Connection refused to local API implies app backend process was unavailable when UI attempted create action.
2. Namespace fixture setup is too brittle under transient backend unavailability
   - Fixture timeout likely cascades once backend reconnect/setup path stalls.
3. Cross-resource propagation timing too tight for shard-1 workload test
   - ReplicaSet polling may start before deployment reconciliation is observable in UI/API.

## Deep Research: Isolation Findings
1. Run-state storage was globally shared by path
   - `e2e/src/support/run-state.ts` used a fixed file `e2e/.run/state.json` and teardown removed the entire `e2e/.run` directory.
   - In environments where multiple shard jobs/processes share a workspace, one shard finishing could delete another shard's run-state.
2. Worker-to-instance mapping used unstable worker identity
   - `e2e/src/fixtures.ts` mapped Wails/home/kubeconfig/namespace using `workerIndex` (or `%` mapping), which can change when Playwright replaces workers on retry/crash.
   - Replacement workers could be remapped in ways that increase overlap/race risk across active workers.
3. Namespace cleanup pattern was tied only to legacy suffix
   - Cleanup matched `-w<index>` namespaces only; new stable-slot naming needed compatibility.

## Isolation Improvements Implemented
1. Per-run run-state isolation
   - `run-state.ts` now stores state under `e2e/.run/<run-state-id>/state.json`.
   - Run-state id resolves from `E2E_RUN_STATE_ID` (fallbacks: `E2E_RUN_ID`, `E2E_REPORT_PREFIX`, `default`).
   - `clearRunState()` now removes only the current run-state directory instead of deleting all `.run` data.
2. Stable worker-slot mapping
   - `fixtures.ts` now uses `workerInfo.parallelIndex` (fallback `workerIndex`) as the canonical slot.
   - Home dir, kubeconfig file naming, namespace naming, page baseURL selection, and Playwright artifact folder now derive from stable slot id (`p<slot>`), reducing remap races under retries.
3. Backward-compatible stale namespace cleanup
   - `kind.ts` cleanup now matches both legacy `-w<index>` and new `-p<slot>` suffix patterns.
4. Global setup alignment
   - `global-setup.ts` now sets `process.env.E2E_RUN_STATE_ID = runId` so setup/workers/teardown use the same isolated run-state path.

## Expected Effect on Shard Reliability
1. One shard finishing no longer clears another shard's run-state in shared-workspace executions.
2. Worker restarts/retries are less likely to cross wires between Wails instance/home/namespace assignments.
3. Namespace lifecycle remains clean and compatible across old and new naming schemes.

## What Was Tried In This Investigation
1. Attempted direct run and job log retrieval through GitHub web fetch
   - Result: partial/inaccessible due sign-in constraints.
2. Added CI diagnostics (already merged on branch):
   - Per-matrix Playwright JSON/JUnit reports.
   - Shard-1 summary extraction script and step.
   - Artifact map documentation.
   - Result: successful; gives deterministic failure surfaces even when full logs are restricted.
3. Attempted artifact ZIP inspection via unauthenticated API and `gh`
   - Result: blocked by auth (401/unauthenticated CLI).
4. Fallback to check-run annotations API
   - Result: successful; extracted actionable failure details.

## Concrete Patch Plan (Next)
1. Harden fixture setup against transient backend downtime
   - File: e2e/src/fixtures.ts
   - Add short, bounded retry wrapper around namespace/bootstrap operations when transport errors indicate local backend restart/refusal.
   - Keep global timeout bounded; fail with explicit phase-oriented errors (setup/connect/create namespace).
2. Add readiness gate before create operations in bottom-panel suites
   - Files: e2e/tests/50-bottom-panels-workloads.spec.ts, e2e/tests/60-bottom-panels-batch.spec.ts (or shared helper)
   - Verify app/backend readiness (health ping or stable UI state) before issuing create YAML.
3. Improve create overlay failure diagnostics
   - File: e2e/src/pages/CreateOverlay.ts
   - Preserve raw API error + operation context in thrown error to distinguish transport outage vs validation failure.
4. Relax workload propagation assertion strategy
   - File: e2e/tests/50-bottom-panels-workloads.spec.ts
   - Keep polling but stage it: confirm deployment row exists and is stable before ReplicaSet cross-section assertion.
5. Keep failure visibility artifacts mandatory
   - Maintain current run-summary extraction and CI report uploads for all matrix variants.

## Success Criteria For Follow-Up Run
1. Shard-1 completes without fixture namespace timeout.
2. No `connection refused` from local Wails API during create overlay operations.
3. Workloads and batch bottom-panel tests pass on first attempt (or retry only for known transient UI waits).
4. If failure recurs, shard-1 summary artifact pinpoints failing phase without requiring private logs.

## Follow-Up Validation: Run 610 (Post-Isolation Patch)
- Workflow run: 21984813202 (Build #610)
- Commit: `63dc4897574a8af1d99eca1bdbdddbb055aae023`
- Overall result: failed
- Job focus: `e2e (e2e-shard-1, 1, 34200, false, false, false)`
- Shard-1 result: failed

### What Improved
1. Other E2E jobs completed successfully (`e2e-shard-2`, `e2e-mcp`, `e2e-registry`, `e2e-holmes-deploy`).
2. Shard-1 diagnostics remained available:
   - `Extract shard-1 failure summary` step succeeded.
   - `e2e-test-results-e2e-shard-1` artifact was uploaded.
3. This indicates the isolation patch did not regress multi-shard execution and diagnostics collection.

### Remaining Failure Signals (Shard-1)
1. Same fixture setup timeout still appears:
   - `Fixture "namespace" timeout of 300000ms exceeded during setup`
   - Referenced at `e2e/src/fixtures.ts:28` in retries.
2. Namespace selection/setup instability still appears in batch suite:
   - `Expected substring: "kdb-e2e-...-p0"`
   - `Received string: "Select namespaces…"`
   - Location: `e2e/src/pages/SidebarPage.ts:160`.
3. Workloads suite still shows bottom-panel transient error persistence:
   - `Expected: "ok"`
   - `Received: "transient"`
   - Location: `e2e/src/pages/BottomPanel.ts:102`.
4. Run still stopped early after max failures (`Testing stopped early after 1 maximum allowed failures`).

### Updated Conclusion
1. Isolation changes reduced cross-shard interference risk and preserved diagnostics, but did **not** eliminate shard-1 fixture/setup flakiness.
2. Next fix iteration should target readiness/namespace bootstrap robustness rather than additional shard partitioning.
