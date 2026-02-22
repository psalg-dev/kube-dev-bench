# E2E Fix Notes - 2026-02-06

## Context
Full-suite run stopped early after failures in Holmes mock tests and Swarm tests.

## Findings
- Create overlay waits were timing out because the test helper relied on a global "Close" button, which could be present elsewhere in the UI even when the overlay had already closed.
- Inline errors from CreateManifestOverlay were not detectable by the test helper, so failures surfaced as generic timeouts.
- Swarm scale tests intermittently stalled waiting for notifications to clear; toasts sometimes persisted longer than expected.
- Connection wizard recovery reload occasionally failed with HTTP 502, causing the Swarm connection test to fail during recovery.

## Fixes Applied
- Added stable data attributes to the Create overlay container and inline error message.
- Scoped CreateOverlay interactions and success/error detection to the overlay container, including inline error and error toast detection.
- Hardened notification cleanup by dismissing lingering toasts if they did not auto-dismiss within the initial timeout.
- Added a reload fallback in ConnectionWizardPage to re-navigate to `/` if `page.reload()` fails.

## Files Touched
- frontend/src/CreateManifestOverlay.tsx
- e2e/src/pages/CreateOverlay.ts
- e2e/src/pages/Notifications.ts
- e2e/src/pages/ConnectionWizardPage.ts

## Status
Pending verification. Re-run `npm test -- --workers=2` from `e2e/` to confirm.

## Follow-up (Run 9)
- A new failure appeared in `tests/60-bottom-panels-batch.spec.ts` when re-running a Job from the bottom panel.
- Root cause: the backend `StartJob` path re-used the original job spec, including `spec.selector` and controller labels, which Kubernetes rejects for new jobs.
- Fix applied: clear `spec.selector` and controller labels before creating the re-run job.
- Tests updated to validate selector/label cleanup in `StartJob`.

## Follow-up (Run 10)
- Holmes tests failed during bootstrap with `Unexpected Application Error` caused by `GetResourceCounts` being called before Wails bindings were ready (`window.go.main` undefined).
- Another Holmes test failed with `page.goto` returning HTTP 502 during app bootstrap.

## Fixes Applied (Run 10)
- Guarded `ResourceCountsContext` to wait for Wails bindings before calling `GetResourceCounts`, preventing the runtime error screen.
- Added retry logic to `bootstrapApp` so initial `page.goto('/')` tolerates transient HTTP 502/response errors.

## Follow-up (Run 11)
- `tests/monitoring/21-prometheus-alerts.spec.ts` failed when `CreateOverlay.create()` timed out even though the deployment row was present; overlay remained open.
- `tests/holmes/40-log-analysis.spec.ts` failed because the lingering create overlay intercepted sidebar clicks.

## Fixes Applied (Run 11)
- Treat success notifications as a valid create completion and close the create overlay in `CreateOverlay.create()`.
- Close any visible create overlay before `SidebarPage.goToSection()` clicks.
- Add retrying deployment creation helper in the Prometheus alerts test to accept an existing row and close the overlay.
- Ensure the Holmes log analysis helper closes the overlay when a row is detected or after a failed create attempt.

## Status
- Verified: `cd e2e && npm test -- --workers=2`
- Result: 117 passed, 4 skipped, 0 failed.
