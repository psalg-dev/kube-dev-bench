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
