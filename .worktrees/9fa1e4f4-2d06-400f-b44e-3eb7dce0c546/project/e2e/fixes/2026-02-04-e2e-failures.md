# E2E Fix Notes - 2026-02-04

## Summary
Addressed multiple CI E2E failures observed in GitHub shard results.

## Issues Observed
- **Create overlay race**: `CreateOverlay.create()` spawned concurrent waits for error states; the non-winning waits timed out and failed tests.
- **Pod delete notification mismatch**: Pod name was read from the checkbox cell, resulting in empty name and a mismatched success toast expectation.
- **Bulk selection in empty views**: Some views (notably Persistent Volumes) had no rows, causing bulk-selection assertions to fail.
- **Swarm detail panels not opening**: Swarm tables now include bulk-selection checkboxes; tests clicked the first `td` (checkbox), preventing row click handlers from opening bottom panels.

## Changes Applied
- **Create overlay**: Replaced `Promise.race` waits with a polling loop that exits on success or throws on visible error, preventing dangling timeouts.
- **Pod test**: Read pod name from the name column (`td:nth(1)`).
- **Bulk selection**: Added a short-circuit return when the table shows the empty-state row (`No rows match the filter.`).
- **Swarm tests**: Updated service/task/node row clicks to target the name cell (`td:nth(1)`) instead of the checkbox cell.

## Files Updated
- `e2e/src/pages/CreateOverlay.ts`
- `e2e/tests/80-create-pod-open-yaml-and-delete.spec.ts`
- `e2e/tests/97-bulk-selection.spec.ts`
- `e2e/tests/swarm/10-view-services.spec.ts`
- `e2e/tests/swarm/20-scale-service.spec.ts`
- `e2e/tests/swarm/30-view-tasks-logs.spec.ts`
- `e2e/tests/swarm/75-nodes-services-stacks.spec.ts`
- `e2e/tests/holmes/50-swarm-integration.spec.ts`

## Status
- **Not re-run locally** (CI artifacts only). Changes are expected to resolve the reported failures.

## Notes
If Swarm tests continue to report "Not connected to cluster" or missing services tables, consider adding a retry/reload step in `bootstrapSwarm()` or skipping Swarm suites when Docker Swarm is not active in the runner environment.
