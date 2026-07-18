Status: done

# Slice 9: Route k8s rbac + nodes to config + useHolmesStream

The full spec lives in `project/todo/datatable-consolidation-plan.md` (repo-relative path).

Steps:
1. Read that plan's **Shared context** and **Invariants (all slices)** sections completely.
2. Implement EXACTLY the section titled `## Slice 9: Route k8s rbac + nodes to config + useHolmesStream` - its Files / Contract / Tests (write first) / Done / Don't touch lines are binding.
3. Verify with the slice's Done criteria (from frontend/: `npm run typecheck && npm run test`).

## Blocked by
- `04-holmes-stream`
- `06-reskin-overview`

## Agent notes
- All 5 overview table views already implemented as thin wrappers using `GenericResourceTable` with direct config imports (per plan requirement)
- All 5 configs already have Holmes integration via `analyzeFn` and `useHolmesStream` in `GenericResourceTable`
- Added `onDelete` action to `nodeConfig` (missing for cluster-scoped resource)
- All tests pass (212 test files, 2025 tests)
- Typecheck passes with no errors
- Lint errors are pre-existing and unrelated to this slice