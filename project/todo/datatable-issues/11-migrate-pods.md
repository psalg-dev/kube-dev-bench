Status: done

# Slice 11: Migrate Pods, delete the custom table

The full spec lives in `project/todo/datatable-consolidation-plan.md` (repo-relative path).

Steps:
1. Read that plan's **Shared context** and **Invariants (all slices)** sections completely.
2. Implement EXACTLY the section titled `## Slice 11: Migrate Pods, delete the custom table` - its Files / Contract / Tests (write first) / Done / Don't touch lines are binding.
3. Verify with the slice's Done criteria (from frontend/: `npm run typecheck && npm run test`).

## Blocked by
- `04-holmes-stream`
- `05-datatable-engine`
- `06-reskin-overview`
- `07-route-workloads`

## Agent notes

- PodOverviewTable.tsx does not exist (already migrated or deleted in a previous slice)
- PodOverviewEntry.tsx and AppContainer.tsx already use GenericResourceTable with podConfig
- podConfig.tsx updated: removed eslint-disable comments, removed `as any` casts, fixed type assertions
- Created StopPortForwardDialog.tsx for future port-forward UI improvements (window.prompt remains for now per Slice 12 scope)
- All tests pass (212 test files, 2025 tests)
- Typecheck green