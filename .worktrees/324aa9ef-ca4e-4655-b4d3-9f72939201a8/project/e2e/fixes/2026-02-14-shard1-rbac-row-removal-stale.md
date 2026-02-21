# Shard-1 RBAC Row-Removal Failure (2026-02-14)

## Scope
- Workflow run: `22008958267`
- Failing job: `e2e (e2e-shard-1, 1, 34200, false, false, false)`
- Failing test: `e2e/tests/100-rbac-resources.spec.ts`

## Failure Signature
- Assertion timeout while waiting for deleted RBAC rows to disappear from the table.
- Error was consistently at `waitForTableRowRemoved` (`toHaveCount(0)`), with deleted row still rendered after 60s.

## Evidence
- Job log: `tmp/gh_job_63598971969_failed.log`
- Local reproduction command:
  - `cd e2e && npx playwright test tests/100-rbac-resources.spec.ts --workers=1`
- Reproduced locally multiple times before fix.

## Approaches Tried
1. **Scope row locator to the visible main table** (in `e2e/src/support/wait-helpers.ts`)
   - Result: **partially helpful but insufficient**.
   - Outcome: avoided global role-based row matching, but stale rows still persisted in main table.

2. **Single delete-step refresh bounce** (navigate away/back for role deletion only)
   - Result: **insufficient**.
   - Outcome: initial role deletion became more stable, but failure moved to later RBAC deletion step (`rolebinding`).

3. **Spec-local resilient removal helper with reload + section re-entry retries**
   - Implemented in `e2e/tests/100-rbac-resources.spec.ts`.
   - Used for all RBAC deletion checks in this spec.
   - Result: **successful**.

## Final Fix
- Added `waitForRbacRowRemovedWithRefresh(...)` in `e2e/tests/100-rbac-resources.spec.ts`.
- Behavior:
  - Try `waitForTableRowRemoved(..., timeout=20s)`.
  - On failure: `page.reload()` and `sidebar.goToRbacSection(section)`, retry up to 3 attempts.
- Replaced direct `waitForTableRowRemoved(...)` calls in RBAC delete steps with this resilient helper.

## Validation
- Local rerun after final patch:
  - `npx playwright test tests/100-rbac-resources.spec.ts --workers=1`
  - Result: **1 passed**.

## Notes
- The observed state showed sidebar counts reflecting deletion while table rows could remain stale.
- The chosen fix keeps changes scoped to this flaky RBAC spec and avoids altering global helper behavior for unrelated suites.

## Follow-Up After First Push
- New run after RBAC stabilization (`22017302698`) failed in shard-1 at `tests/40-create-secret-and-pvc.spec.ts`.
- Failure signature: PVC row did not become visible within 60s in the table (`toBeVisible` timeout).

### Additional Approaches
1. **Replace direct `getByRole('row')` assertions with table-scoped helper + retries**
   - File: `e2e/tests/40-create-secret-and-pvc.spec.ts`
   - Added `waitForRowWithRefresh(...)` that:
     - uses `waitForTableRow(...)` with section-scoped table matching,
     - reloads page + re-enters section on failure,
     - retries up to 3 attempts.
   - Applied to both Secret and PVC creation checks.

### Additional Validation
- Local run for the target spec:
  - `npx playwright test tests/40-create-secret-and-pvc.spec.ts --workers=1`
  - Result: one initial attempt failed due transient browser console IPC error, retry passed (`flaky`, test flow assertions succeeded).

## Follow-Up After Second Push
- New run after Secret/PVC stabilization (`22017637334`) failed in shard-1 at `tests/62-bottom-panels-storage.spec.ts`.
- Failure signature: PVC row did not appear in the main storage table within 60s after create (`waitForTableRow` -> `toBeVisible` timeout, element not found).

### Storage-Spec Approach
1. **Add spec-local retry helpers for storage row/status readiness**
   - File: `e2e/tests/62-bottom-panels-storage.spec.ts`
   - Added `waitForStorageRowWithRefresh(...)` for PV/PVC row appearance.
   - Added `waitForStorageStatusWithRefresh(...)` for PVC `Bound` status.
   - Both helpers:
     - call existing wait helper with a shorter per-attempt timeout (`20s`),
     - on failure run `page.reload()` and re-enter the relevant section,
     - retry up to 3 attempts.
   - Replaced direct waits for PV row, PVC row, and PVC `Bound` status with these helpers.

### Storage-Spec Validation Plan
- Run targeted spec locally:
  - `npx playwright test tests/62-bottom-panels-storage.spec.ts --workers=1`
- If passing, push and re-check shard-1 on the next workflow run.

## Follow-Up After Storage Push
- New run after storage stabilization (`22018724320`) still failed in shard-1, but `tests/62-bottom-panels-storage.spec.ts` now passed.
- New failure moved to `tests/70-create-and-delete-configmap-from-details.spec.ts`.
- Failure signature: deleted ConfigMap row persisted in table beyond 60s (`waitForTableRowRemoved` -> `toHaveCount(0)` timeout).

### ConfigMap-Spec Approach
1. **Add spec-local resilient row-removal helper for ConfigMaps**
   - File: `e2e/tests/70-create-and-delete-configmap-from-details.spec.ts`
   - Added `waitForConfigMapRowRemovedWithRefresh(...)` that:
     - runs `waitForTableRowRemoved(..., timeout=20s)`,
     - on failure reloads page and re-enters `configmaps` section,
     - retries up to 3 attempts.
   - Replaced direct `waitForTableRowRemoved(...)` with the new helper.

### ConfigMap-Spec Validation Plan
- Run targeted spec locally, then push and monitor next shard-1 run.

## Follow-Up After ConfigMap Push
- New run after ConfigMap stabilization (`22019193763`) showed:
  - `tests/70-create-and-delete-configmap-from-details.spec.ts` now passing.
  - New failure moved to `tests/holmes/10-context-analysis.spec.ts`.
- Failure signature: resource row did not appear in table (`waitForTableRow` -> `toBeVisible` timeout, element not found), repeated across all retries.

### Holmes-Spec Approach
1. **Add spec-local resilient row/status helpers for Holmes flow**
   - File: `e2e/tests/holmes/10-context-analysis.spec.ts`
   - Added `waitForHolmesRowWithRefresh(...)` for `deployments`, `pods`, and `services` rows.
   - Added `waitForHolmesStatusWithRefresh(...)` for pod `Running` state.
   - Both helpers:
     - use short per-attempt waits,
     - on failure reload page and re-enter section,
     - retry up to 3 attempts.
   - Replaced direct waits for deployment row, pod row/status, and service row with these helpers.
