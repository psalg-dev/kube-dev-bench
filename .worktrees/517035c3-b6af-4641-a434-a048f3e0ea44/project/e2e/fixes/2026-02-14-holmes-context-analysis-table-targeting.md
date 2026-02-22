# 2026-02-14 – Holmes context analysis flake (table targeting)

## Failing CI signal
- Workflow: `build.yml`
- Run: `22019193763`
- Job: `e2e-shard-1`
- Test: `tests/holmes/10-context-analysis.spec.ts` (`Ask Holmes from resource details opens Holmes tab`)
- Failure point: `e2e/src/support/wait-helpers.ts:20` (`waitForTableRow`)
- Symptom: timed out waiting for service row (`e2e-holmes-svc-*`) to become visible.

## Hypothesis
- `waitForTableRow` selected the **first** visible `table.gh-table` only.
- In this scenario, multiple visible `gh-table` instances can exist transiently, so the helper can bind to the wrong table and never find the expected row.

## Changes tried
1. Updated `waitForTableRow` to search rows across **all visible main tables**:
   - from first-table lookup to selector: `#main-panels > div:visible table.gh-table tbody tr`
   - waits with `expect.poll(() => rows.count()) > 0`
2. Updated `waitForTableRowRemoved` similarly to assert row count across all visible main tables.

## Validation
- Ran targeted test file locally:
  - `e2e/tests/holmes/10-context-analysis.spec.ts`
  - Result: **passed**.

## Outcome
- **Successful** on local targeted reproduction.
- Needs confirmation in next `build.yml` run to verify shard-level stability under CI load.
