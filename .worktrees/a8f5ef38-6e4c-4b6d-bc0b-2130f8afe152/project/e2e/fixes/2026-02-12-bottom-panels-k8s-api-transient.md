# E2E Fix Notes — 2026-02-12 — Bottom panels vs transient K8s API outages

## Failure signature (CI run #603, shard 1)
- `tests/50-bottom-panels-workloads.spec.ts` failed waiting for Pod row by deployment name.
- `tests/60-bottom-panels-batch.spec.ts` failed on `BottomPanel.expectNoErrorText()` because panel contained:
  - `Error: Get "https://127.0.0.1:<port>/api/v1/namespaces?limit=1": dial tcp ... connect: connection refused`
- Error snapshots show temporary global K8s empty state (`Pods 0`, `Deployments 0`, etc.) while Swarm data remained present.

## Root cause
- During parallel CI, KinD API can transiently refuse connections.
- Existing assertions treated any immediate `Error:` text as hard failure and assumed resource tables remain continuously populated.

## Approaches tried
1. **Investigate job page directly**
   - Blocked by private logs when unauthenticated.
   - Used attached Playwright artifacts (`error-context.md`) and failure output to extract exact failing conditions.
2. **Test-only timeout increase (rejected)**
   - Would reduce flake probability but does not address transient error-text behavior and empty-table windows.
3. **Resilient assertions for transient API outage (implemented)**
   - `BottomPanel.expectNoErrorText()` now polls and tolerates known transient Kubernetes connectivity errors for a bounded period, still failing on non-transient errors.
   - Workloads pod lookup now polls with section re-navigation and handles temporary `No Pods deployed in this namespace` windows.

## Implemented changes
- Updated `e2e/src/pages/BottomPanel.ts`
  - `expectNoErrorText(timeoutMs = 45_000)` now:
    - passes when no `Error:` text exists,
    - retries while error text matches transient K8s connectivity patterns,
    - fails if non-transient error persists.
- Updated `e2e/tests/50-bottom-panels-workloads.spec.ts`
  - Pod row wait now uses `expect.poll()` with `sidebar.goToSection('pods')` recovery loop and empty-table handling before strict row visibility assertion.

## Expected impact
- Reduces flaky failures caused by short KinD API unavailability windows without masking genuine panel errors.
- Keeps failure behavior strict for persistent/non-transient errors.
