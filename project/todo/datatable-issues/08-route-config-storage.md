Status: done

# Slice 8: Route k8s config/storage/network to config + useHolmesStream

The full spec lives in `project/todo/datatable-consolidation-plan.md` (repo-relative path).

Steps:
1. Read that plan's **Shared context** and **Invariants (all slices)** sections completely.
2. Implement EXACTLY the section titled `## Slice 8: Route k8s config/storage/network to config + useHolmesStream` - its Files / Contract / Tests (write first) / Done / Don't touch lines are binding.
3. Verify with the slice's Done criteria (from frontend/: `npm run typecheck && npm run test`).

## Blocked by
- `04-holmes-stream`
- `06-reskin-overview`

## Agent notes

- All 8 overview table files already used GenericResourceTable with their configs. No structural changes needed.
- Added Holmes integration to `helmReleasesConfig` (missing `analyzeFn`)
- Added `onDelete` action to `helmReleasesConfig` for uninstall functionality  
- Simplified `HelmReleasesOverviewTable` by removing inline row actions (17 → 16 LOC)
- Added `hpaConfig` and `helmReleasesConfig` to barrel export for consistency
- All 2025 tests pass
- All views < ~40 LOC (15-16 lines each)
