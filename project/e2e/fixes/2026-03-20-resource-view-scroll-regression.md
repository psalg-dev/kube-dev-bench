# E2E Fix: Resource View Scroll Regression

**Date**: 2026-03-20  
**Issue**: Resource overview pages clipped rows instead of exposing a usable scroll region, especially for Pods and other long resource lists.

## Root Cause

Two separate layout problems were involved.

1. **Shared resource overviews had no dedicated scroll body**
   - Most resource pages render through `OverviewTableWithPanel`.
   - The table was rendered directly in the panel layout without an internal flex-bounded scroll container.
   - When the page content exceeded the available height, rows could be clipped by parent containers instead of overflowing inside the resource table region.

2. **Pods used a bespoke table with broken height/scroll assumptions**
   - `PodOverviewTable` maintained its own scroll logic, spacer rows, and fixed-count row windowing.
   - That implementation depended on a dynamically sized scroll div and a correctly constrained mount container.
   - The extra mount node created in `main-content.ts` (`pod-overview-react`) was not height-constrained, so the pod table could expand the panel instead of overflowing inside it.

## Fixes Applied

### 1. Shared overview table scroll container
- Added a dedicated internal scroll wrapper in `frontend/src/layout/overview/OverviewTableWithPanel.tsx`.
- Added corresponding flex/overflow layout rules in `frontend/src/layout/overview/OverviewTableWithPanel.css`.
- Added a stable test id for the shared scroll region: `overview-table-scroll-container`.

### 2. Pod table scroll path simplified
- Removed the old pagination wiring from `frontend/src/k8s/resources/pods/PodOverviewTable.tsx`.
- Removed the spacer-row/windowing logic that only rendered a row slice and manually tracked `scrollTop`.
- Kept a real scroll body with `data-testid="pods-table-scroll-container"` and rendered the full filtered row model.

### 3. Pod mount container constrained
- Updated `frontend/src/main-content.ts` so `pod-overview-react` gets:
  - `height: 100%`
  - `minHeight: 0`
  - `display: flex`
  - `flexDirection: column`
  - `flex: 1`
- This gives the pod table a real height boundary and makes overflow happen inside the pod view instead of expanding the panel.

### 4. Regression coverage replaced with real high-volume data
- Rewrote `e2e/tests/101-resource-view-scrollable.spec.ts`.
- The new test:
  - creates 100 ConfigMaps and 100 Pods with `kubectl`,
  - verifies the UI reaches both Config Maps and Pods views,
  - asserts the relevant scroll container actually overflows (`scrollHeight > clientHeight`),
  - scrolls until row `099` is inside the container viewport.

## Validation

### Frontend unit test
- `cd frontend && npm test -- overviewTableWithPanel.test.tsx`
- Result: passed.

### Playwright regression
- `cd e2e && npm test -- tests/101-resource-view-scrollable.spec.ts`
- Result: passed.

### Browser inspection via Chrome DevTools MCP
- Opened the Playwright HTML report and trace over HTTP.
- Confirmed the passing run includes:
  - `Config Maps 102` in the sidebar,
  - `Pods 100` in the sidebar,
  - the dedicated pod snapshot showing the pod overview rendered with the generated rows,
  - the trace steps asserting both `overview-table-scroll-container` and `pods-table-scroll-container` overflow before scrolling to row `099`.

## Approaches Tried And What Changed

### Attempt 1: keep pod virtualization and only fix shared layout
- **Outcome**: insufficient.
- Shared resource views improved, but pods still reported a non-overflowing scroll container in E2E.

### Attempt 2: remove hidden pagination from pods
- **Outcome**: insufficient.
- Pagination was part of the problem, but the table still depended on the broken scroll/windowing path.

### Attempt 3: validate rows with plain visibility checks
- **Outcome**: misleading.
- Playwright considered off-scroll DOM rows “visible”, so this did not prove the row was inside the scroll viewport.
- Replaced with bounding-box checks against the scroll container.

### Attempt 4: use kubectl jsonpath count assertions
- **Outcome**: brittle.
- Switched to `kubectl get ... -o name` and counted resulting lines instead.

### Attempt 5: target pods before constraining the pod mount node
- **Outcome**: failed.
- Even after removing virtualization, `pods-table-scroll-container` could still report `scrollHeight === clientHeight` because the parent mount node was not constrained.
- Final fix was the `main-content.ts` height/flex update.

## Files Changed

- `frontend/src/layout/overview/OverviewTableWithPanel.tsx`
- `frontend/src/layout/overview/OverviewTableWithPanel.css`
- `frontend/src/k8s/resources/pods/PodOverviewTable.tsx`
- `frontend/src/main-content.ts`
- `frontend/src/__tests__/overviewTableWithPanel.test.tsx`
- `e2e/tests/101-resource-view-scrollable.spec.ts`

## Status

Verified with targeted unit and E2E coverage.