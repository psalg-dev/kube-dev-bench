Status: done

# Slice 1: Sorting functions (duration/datetime/number/text)

The full spec lives in `project/todo/datatable-consolidation-plan.md` (repo-relative path).

Steps:
1. Read that plan's **Shared context** and **Invariants (all slices)** sections completely.
2. Implement EXACTLY the section titled `## Slice 1: Sorting functions (duration/datetime/number/text)` - its Files / Contract / Tests (write first) / Done / Don't touch lines are binding.
3. Verify with the slice's Done criteria (from frontend/: `npm run typecheck && npm run test`).

## Blocked by
- `00-fix-typecheck-baseline`

## Agent notes

- Sorting functions implemented in `frontend/src/components/DataTable/sortingFns.ts`
- Tests in `frontend/src/__tests__/dataTableSortingFns.test.ts` (28 tests)
- Both pass typecheck and tests
- Functions exported: `textSortingFn`, `numberSortingFn`, `durationSortingFn`, `datetimeSortingFn`, `sortTypeToFn`
- Type `ColumnSortType` owned and exported from this file (re-exported by Slice 5's types.ts)

(End of file - total 17 lines)