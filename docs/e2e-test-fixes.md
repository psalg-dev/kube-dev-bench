# E2E Test Fixes Documentation

This document tracks fixes applied to resolve E2E test failures from GitHub Actions run #21648147466.

## Root Cause Analysis

The failing tests were caused by a major refactoring effort that migrated resource tables to use a new `GenericResourceTable` component. This refactoring:

1. Moved table/panel configuration from individual component files to centralized config files in `frontend/src/config/resourceConfigs/`
2. Introduced new hooks (`useResourceData`, `useHolmesAnalysis`) for data fetching and Holmes AI integration
3. Reduced duplicated code significantly but inadvertently removed some features

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

### 3. Swarm Secret Clone Button Timing (Test: `swarm/73-secrets.spec.ts`)

**Issue:** The test was clicking the clone button immediately after clicking a row, without waiting for the bottom panel to render.

**Fix:** Added explicit wait for the clone button to be visible before clicking:
```typescript
// Before
await cloneSourceRow.click();
await page.locator('#swarm-secret-clone-btn').click();

// After
await cloneSourceRow.click();
await expect(page.locator('#swarm-secret-clone-btn')).toBeVisible({ timeout: 30_000 });
await page.locator('#swarm-secret-clone-btn').click();
```

**File:** `e2e/tests/swarm/73-secrets.spec.ts`

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
| `holmes/10-context-analysis.spec.ts` | Panel visibility | ⚠️ May need more work |
