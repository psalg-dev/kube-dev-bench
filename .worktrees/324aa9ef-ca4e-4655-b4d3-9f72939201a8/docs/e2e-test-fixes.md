# E2E Test Fixes Documentation

This document tracks fixes applied to resolve E2E test failures from GitHub Actions run #21648147466.

## Root Cause Analysis

The failing tests were caused by a major refactoring effort that migrated resource tables to use a new `GenericResourceTable` component. This refactoring:

1. Moved table/panel configuration from individual component files to centralized config files in `frontend/src/config/resourceConfigs/`
2. Introduced new hooks (`useResourceData`, `useHolmesAnalysis`) for data fetching and Holmes AI integration
3. Reduced duplicated code significantly but inadvertently removed some features

## CI Diagnostics Artifact Map (Shard-1)

To make shard-specific failures debuggable even when job logs are hard to access, CI now emits machine-readable Playwright reports and a shard-1 markdown summary.

- Workflow: `.github/workflows/build.yml`
- Playwright config: `e2e/playwright.config.ts`
- Extractor script: `e2e/scripts/extract-playwright-failures.mjs`

### Generated files (inside each e2e job workspace)

- `e2e/test-results/ci-reports/<matrix-name>.json` — Playwright JSON report
- `e2e/test-results/ci-reports/<matrix-name>.xml` — Playwright JUnit report
- `e2e/test-results/ci-reports/e2e-shard-1-summary.md` — extracted shard-1 failure summary (always generated on shard-1 job)

### Uploaded artifact

- Artifact name: `e2e-test-results-<matrix-name>`
- Contains:
  - `e2e/test-results/**`
  - `e2e/playwright-report/**`

### Triage flow for shard-1 regressions

1. Open artifact `e2e-test-results-e2e-shard-1`
2. Read `e2e/test-results/ci-reports/e2e-shard-1-summary.md` for failing test titles, statuses, retries, locations, and compact errors
3. If needed, inspect `e2e-shard-1.json` and `e2e-shard-1.xml` for full structured details

## Fixes Applied

### 1. ReplicaSet "Owner" Tab Missing (Test: `50-bottom-panels-workloads.spec.ts`)

**Issue:** The refactored `replicasetConfig.jsx` was missing the "Owner" tab that exists in the original `ReplicaSetsOverviewTable.jsx`.

**Fix:** Added the Owner tab to `replicasetConfig.jsx`:
- Added import for `ReplicaSetOwnerTab` component
- Added `{ key: 'owner', label: 'Owner', countable: false }` to tabs array
- Added render case for the 'owner' tab in `renderReplicaSetPanelContent`

**File:** `frontend/src/config/resourceConfigs/replicasetConfig.jsx`

### 2. Swarm Config Edit Modal Text Input (Test: `swarm/72-configs.spec.ts`)

**Issue:** The test was trying to fill a hidden textarea instead of the visible CodeMirror editor. The hidden textarea's `fill()` operation wasn't properly syncing with React state.

**Fix:** Changed the test to type directly into the CodeMirror editor:
```typescript
// Before
await page.locator('[data-testid="swarm-config-edit-textarea"]').fill(updated);

// After
await editor.click();
await page.keyboard.press('Control+A');
await page.keyboard.type(updated);
```

**File:** `e2e/tests/swarm/72-configs.spec.ts`

### 4. React Duplicate Key Warnings (Test: `monitoring/20-manual-scan.spec.ts`)

**Issue:** The test was failing due to React console warnings about duplicate keys in the pod list table. Multiple pods with the same name, namespace, and status were generating identical React keys, causing "Encountered two children with the same key" errors.

**Root Cause:** The `getRowKey` function in `PodOverviewTable.tsx` was using a composite key of `${name}-${namespace}-${status}`, but pods from failed deployments could have identical values for these fields.

**Fix:** 
1. Added `UID` field to the `PodInfo` struct in Go backend
2. Updated `buildPodInfoFromPod` to include the pod's UID
3. Modified `getRowKey` to prioritize the unique `uid` field, falling back to the composite key if UID is not available
4. Regenerated Wails bindings to update TypeScript interfaces

**Files Changed:**
- `pkg/app/types.go` - Added UID field to PodInfo struct
- `pkg/app/pods.go` - Updated buildPodInfoFromPod to include UID
- `frontend/src/k8s/resources/pods/PodOverviewTable.tsx` - Updated getRowKey to use UID
- `frontend/wailsjs/go/models.ts` - Auto-generated with UID field

**Before:**
```typescript
const getRowKey = useCallback((row: PodRow, idx: number) => {
  const ns = row?.namespace ?? row?.Namespace ?? namespace ?? '';
  const rowRecord = row as unknown as Record<string, unknown>;
  const name = row?.name ?? row?.Name ?? rowRecord.id ?? rowRecord.ID ?? idx;
  const status = row?.status ?? row?.Status ?? row?.phase ?? row?.Phase ?? '';
  const base = `${name}-${status}`;
  return ns ? `${ns}/${base}` : String(base);
}, [namespace]);
```

**After:**
```typescript
const getRowKey = useCallback((row: PodRow, idx: number) => {
  // Use UID for unique keys, fallback to namespace + name + status for stable, unique row keys.
  const uid = row?.uid ?? row?.UID ?? '';
  if (uid) {
    return uid;
  }
  const ns = row?.namespace ?? row?.Namespace ?? namespace ?? '';
  const rowRecord = row as unknown as Record<string, unknown>;
  const name = row?.name ?? row?.Name ?? rowRecord.id ?? rowRecord.ID ?? idx;
  const status = row?.status ?? row?.Status ?? row?.phase ?? row?.Phase ?? '';
  const base = `${name}-${status}`;
  return ns ? `${ns}/${base}` : String(base);
}, [namespace]);
```

## Files Changed

### New Files (from refactoring)
- `frontend/src/config/resourceConfigs/*.jsx` - Resource configuration files
- `frontend/src/components/GenericResourceTable/index.jsx` - Generic table component
- `e2e/src/support/wait-helpers.ts` - E2E test wait helper utilities
- `e2e/src/pages/Notifications.ts` - Notifications page object

### Modified Files
- `frontend/src/config/resourceConfigs/replicasetConfig.jsx` - Added Owner tab
- `e2e/tests/swarm/72-configs.spec.ts` - Fixed CodeMirror input
- `e2e/tests/swarm/73-secrets.spec.ts` - Added button visibility wait
- `pkg/app/types.go` - Added UID field to PodInfo struct
- `pkg/app/pods.go` - Updated buildPodInfoFromPod to include UID
- `frontend/src/k8s/resources/pods/PodOverviewTable.tsx` - Updated getRowKey to use UID

## Remaining Issues

Some tests may still need attention:

1. **Storage tests (`62-bottom-panels-storage.spec.ts`)** - May have timing issues with `waitForTableRow`
2. **Holmes tests (`holmes/10-context-analysis.spec.ts`, `holmes/20-mock-analysis.spec.ts`)** - May need adjustments for the refactored panel structure
3. **Navigation tests (`98-sidebar-navigation-renders-correct-view.spec.ts`, `99-navigate-sections.spec.ts`)** - May have column header text mismatches

## Best Practices for Future Refactoring

1. **Always run E2E tests** before merging major refactors
2. **Preserve all tabs/features** when migrating to new component patterns
3. **Use stable selectors** (data-testid, aria labels) instead of CSS classes
4. **Add explicit waits** for async UI operations
5. **Test with CodeMirror** by typing into `.cm-content` instead of hidden textareas

## Test Categories Affected

| Test File | Failure Type | Fix Applied |
|-----------|-------------|-------------|
| `50-bottom-panels-workloads.spec.ts` | Missing "Owner" tab | ✅ Added to config |
| `62-bottom-panels-storage.spec.ts` | Timing issues | ⚠️ May need more work |
| `70-create-and-delete-configmap-from-details.spec.ts` | Row not removed | ⚠️ May need more work |
| `swarm/72-configs.spec.ts` | CodeMirror input | ✅ Fixed |
| `swarm/73-secrets.spec.ts` | Button timing | ✅ Fixed |
| `monitoring/20-manual-scan.spec.ts` | React duplicate keys | ✅ Fixed with UID |
| `holmes/10-context-analysis.spec.ts` | Panel visibility | ⚠️ May need more work |
