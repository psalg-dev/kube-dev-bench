Status: done

# Slice 2: Persisted table state

The full spec lives in `project/todo/datatable-consolidation-plan.md` (repo-relative path).

Steps:
1. Read that plan's **Shared context** and **Invariants (all slices)** sections completely.
2. Implement EXACTLY the section titled `## Slice 2: Persisted table state` - its Files / Contract / Tests (write first) / Done / Don't touch lines are binding.
3. Verify with the slice's Done criteria (from frontend/: `npm run typecheck && npm run test`).

## Blocked by
- `00-fix-typecheck-baseline`

## Agent notes
Implementation already present in `frontend/src/components/DataTable/usePersistedTableState.ts` and `frontend/src/__tests__/usePersistedTableState.test.ts`.
Tests pass (21 passed), typecheck passes. All done criteria met:
- ✅ hook returns `{ columnOrder, setColumnOrder, columnVisibility, setColumnVisibility, sorting, setSorting }`
- ✅ Persists to `localStorage` under `datatable:{persistKey}`
- ✅ Undefined key → pure in-memory useState, zero localStorage access
- ✅ JSON.parse guard with try/catch → defaults
- ✅ Tests cover: setter writes, read-back, corrupt JSON → defaults, undefined key behavior, default state
