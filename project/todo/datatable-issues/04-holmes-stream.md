Status: done

# Slice 4: useHolmesStream hook (the big dedup)

The full spec lives in `project/todo/datatable-consolidation-plan.md` (repo-relative path).

Steps:
1. Read that plan's **Shared context** and **Invariants (all slices)** sections completely.
2. Implement EXACTLY the section titled `## Slice 4: useHolmesStream hook (the big dedup)` - its Files / Contract / Tests (write first) / Done / Don't touch lines are binding.
3. Verify with the slice's Done criteria (from frontend/: `npm run typecheck && npm run test`).

## Blocked by
- `00-fix-typecheck-baseline`

## Agent notes

`useHolmesStream.ts` already implemented with full test coverage. All 24 tests pass. Typecheck passes. Lint errors are pre-existing in the codebase (unrelated to this hook).