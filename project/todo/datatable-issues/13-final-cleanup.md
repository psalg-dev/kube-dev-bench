Status: done

# Slice 13: Final cleanup + LOC audit

The full spec lives in `project/todo/datatable-consolidation-plan.md` (repo-relative path).

Steps:
1. Read that plan's **Shared context** and **Invariants (all slices)** sections completely.
2. Implement EXACTLY the section titled `## Slice 13: Final cleanup + LOC audit` - its Files / Contract / Tests (write first) / Done / Don't touch lines are binding.
3. Verify with the slice's Done criteria (from frontend/: `npm run typecheck && npm run test`).

## Blocked by
- `06-reskin-overview`
- `07-route-workloads`
- `08-route-config-storage`
- `09-route-rbac-nodes`
- `10-route-swarm`
- `11-migrate-pods`
- `12-ux-declutter`

## Agent notes

**Changes made:**
- Fixed duplicate import in `frontend/src/components/DataTable/types.ts` (removed duplicate `import type { ColumnSortType }` and used proper re-export `export type { ColumnSortType } from './sortingFns'`)
- Removed ponytail compat layer comment and trailing explanation from `OverviewTableWithPanel.tsx` line 16-19

**Verification:**
- `npm run typecheck`: passed
- `npm run test`: 212 test files, 2033 tests passed
- `npm run lint`: Pre-existing errors (not from this slice)

**LOC impact:**
- Net reduction: ~15 lines removed (comments only, no functional code)

(End of file - total 25 lines)
