# E2E Fix: Wails IPC Binding Readiness Gate

**Date**: 2026-06-25  
**Issue**: ALL E2E tests fail in CI waiting for `#kubecontext-root` after clicking "Connect"  
**Affected shards**: `e2e-shard-1`, `e2e-shard-2`, `e2e-holmes-deploy`

## Root Cause

In Wails dev mode, the Go-bound functions are exposed to the frontend via
`window.go.main.App.*`. These bindings are injected asynchronously by the
Wails runtime after the WebSocket connection between the browser and the
devserver is established and the Go backend registers its IPC handlers.

The E2E tests navigate to `/` and immediately interact with the connection
wizard. When the test clicks "Connect", the frontend calls Go functions like
`SetKubeConfigPath`, `GetKubeContexts`, `SetCurrentKubeContext`, etc.

**On CI (Linux/xvfb)**, the timing gap between:
1. HTTP readiness (checked by `wails.ts` → `waitForHttpOk`)
2. Wails IPC binding registration (`window.go.main.App.*` populated)

...is long enough that the test clicks "Connect" before bindings are ready.
The Go function calls fail silently (errors are caught by the
`ignoredPatterns` filter in `fixtures.ts`), and the page never transitions
from the connection wizard to the main app (`#kubecontext-root`).

The test then times out waiting 60 seconds for `#kubecontext-root`.

### Evidence
- ALL 5 tests across ALL 3 CI shards fail identically at the same location:
  `ConnectionWizardPage.ts:216` → `bootstrap.ts:45`
- Error: `expect(locator('#kubecontext-root')).toBeVisible() - Timeout: 60000ms`
- Page snapshots show the connection wizard rendered correctly with
  kubeconfig and "Connect" button visible
- Wails logs show `runtime:ready` error (benign devserver limitation)
- `fixtures.ts` already filters `Cannot read properties of undefined (reading 'main')` — confirming this is a known transient issue

### Prior Art
- **Run 10** (2026-02-06): Same class of issue — `GetResourceCounts` called
  before Wails bindings were ready. Fixed by adding a polling guard in
  `ResourceCountsContext.tsx` (`hasWailsBinding()` / `waitForWailsBinding()`).

## Fix

### 1. `e2e/src/support/bootstrap.ts` — Gate on IPC readiness after navigation

Added `waitForWailsBindings()` function that polls for
`window.go.main.App.SetKubeConfigPath` and `GetKubeContexts` to be defined
(200ms interval, 30s timeout). Called immediately after `page.goto('/')` and
before any wizard interaction.

### 2. `e2e/src/pages/ConnectionWizardPage.ts` — Safety check before Connect click

Added `ensureWailsReady()` private method with the same polling pattern.
Called before each "Connect" button click (two locations in
`pastePrimaryKubeconfigAndContinue`) as a defense-in-depth measure.

### 3. `e2e/src/support/swarm-bootstrap.ts` — Same guard for Swarm flow

Added inline `page.waitForFunction()` to check for `ConnectDockerHost`
binding before the swarm connection wizard interactions.

## Why This Works

- **Deterministic gate**: Instead of relying on wall-clock delays or hoping
  the IPC bridge initializes fast enough, we explicitly poll for the binding
  functions to exist on `window.go.main.App`.
- **Matches existing pattern**: This is the same approach used in
  `ResourceCountsContext.tsx` (polling `hasWailsBinding()` in the frontend).
- **Low overhead**: 200ms polling interval means at most ~200ms of extra wait
  time once bindings are ready. On local dev (Windows) where bindings are
  ready instantly, the wait resolves on the first poll.
- **Defense in depth**: Both `bootstrap.ts` (before wizard opens) AND
  `ConnectionWizardPage.ts` (before Connect click) check for readiness,
  covering any code path that triggers Go function calls.

## Files Changed

| File | Change |
|------|--------|
| `e2e/src/support/bootstrap.ts` | Added `waitForWailsBindings()` + call after nav |
| `e2e/src/pages/ConnectionWizardPage.ts` | Added `ensureWailsReady()` + calls before Connect |
| `e2e/src/support/swarm-bootstrap.ts` | Added inline binding readiness wait |

## Approaches NOT Tried (for future reference)

- **Frontend-side global guard**: Could add a Wails readiness gate at the app
  root level (wrap all Go calls with a `waitForWailsReady()` utility). This
  would be more comprehensive but requires changes across many frontend files.
- **Extending `wails.ts` HTTP check**: Could add a custom endpoint or
  WebSocket probe in `startWailsDev()`. This is more complex and requires
  changes to the Wails dev server setup.
- **Delaying test start**: Crude `page.waitForTimeout()` could mask the issue
  but is fragile and adds unnecessary latency.
