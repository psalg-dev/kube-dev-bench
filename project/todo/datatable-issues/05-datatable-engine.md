Status: done

# Slice 5: DataTable engine + subcomponents

The full spec lives in `project/todo/datatable-consolidation-plan.md` (repo-relative path).

Steps:
1. Read that plan's **Shared context** and **Invariants (all slices)** sections completely.
2. Implement EXACTLY the section titled `## Slice 5: DataTable engine + subcomponents` - its Files / Contract / Tests (write first) / Done / Don't touch lines are binding.
3. Verify with the slice's Done criteria (from frontend/: `npm run typecheck && npm run test`).

## Blocked by
- `01-sorting-fns`
- `02-persisted-state`
- `03-range-selection`

## Agent notes

Slice 5 implemented and verified:
- DataTable component with all required features (sorting, filtering, selection, bulk actions, row actions, column reorder/visibility)
- ColumnHeader with native HTML5 drag-reorder support
- ColumnVisibilityMenu for toggling column visibility
- RowActionsMenu with portal for outside-click/Escape handling
- UptimeCell with 1-second tick for elapsed time display
- All hooks integrated: usePersistedTableState, useRangeSelection, sortingFns

Verification:
- 46 tests pass (100% coverage on DataTable components)
- Typecheck: clean
- Linter: 0 errors, 23 warnings (acceptable)
- All 2025 tests in suite pass

Fixed lint error in sortingFns.ts:183 - added braces around default case to avoid lexical declaration issue.
