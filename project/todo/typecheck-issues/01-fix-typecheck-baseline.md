Status: ready-for-agent

# Fix the frontend typecheck baseline (392 errors, 44 files) after dependency bumps

`cd frontend && npm run typecheck` currently fails with 392 errors across 44 files.
All 2026 tests pass - these are TYPE errors from dependency upgrades, not behavior bugs.

Error profile (fix the patterns, they repeat):
- 147x TS18046 (`'x' is of type 'unknown'`) - add proper type narrowing or typed parses
- 94x TS2339 (property does not exist) - mostly follows from the unknowns
- TS2556/TS7006/TS7019 in `frontend/src/__tests__/wailsMocks.ts` - fix this file FIRST;
  its mock signatures cascade into many test-file errors

Rules:
- Behavior must not change. All 2026 tests must still pass.
- Real types only: no `any`, no new `eslint-disable`, no `as unknown as` double-casts,
  no loosening tsconfig. Prefer typed payload interfaces and narrowing over casts.
- Work file by file; re-run `cd frontend && npm run typecheck 2>&1 | head -30` frequently
  to watch the error count drop.
- Done when: `cd frontend && npm run typecheck` exits 0 AND `npm run test` is green.

## Blocked by
None

## Agent notes
