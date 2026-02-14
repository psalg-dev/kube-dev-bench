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
