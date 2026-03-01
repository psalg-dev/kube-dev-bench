# Fix for PR #40 - Vitest v4 Compatibility

## Problem
Pull Request #40 (https://github.com/psalg-dev/kube-dev-bench/pull/40) updates Vitest from v1 to v4, which causes 3 tests to fail in `frontend/src/__tests__/clusterStateProvider.test.jsx` due to changes in how Vitest v4 handles mock resets and async operations.

## Root Cause
In Vitest v4, `vi.clearAllMocks()` no longer fully resets mock implementations the way it did in v1. This caused:
1. Mocks to retain state between tests
2. `mockResolvedValueOnce` calls to be consumed in the wrong order
3. Async state updates to not be properly awaited

## Solution
The fix has been implemented in the `copilot/fix-checks-for-pr-40` branch and can be cherry-picked or manually applied to the `renovate/major-vitest-monorepo` branch.

### Changes Required in `frontend/src/__tests__/clusterStateProvider.test.jsx`:

1. **Add `waitFor` import** (line 2):
```javascript
import { render, screen, act, waitFor } from '@testing-library/react';
```

2. **Update `renderAndWait` helper** (lines 52-61):
```javascript
async function renderAndWait() {
  await act(async () => { render(<ClusterStateProvider><Probe/></ClusterStateProvider>); });
  // Wait for the component to be initialized
  await waitFor(() => {
    const st = parseState();
    expect(st.initialized).toBe(true);
  }, { timeout: 3000 });
  // Give one more tick for any final state updates
  await act(async () => {});
}
```

3. **Add explicit mock resets in `beforeEach`** (lines 58-68):
```javascript
beforeEach(() => {
  vi.clearAllMocks();
  // Also reset mock implementations to ensure clean state
  kubeApi.GetKubeContexts.mockReset();
  kubeApi.GetNamespaces.mockReset();
  kubeApi.GetCurrentConfig.mockReset();
  kubeApi.SetCurrentKubeContext.mockReset();
  kubeApi.SetCurrentNamespace.mockReset();
  kubeApi.GetConnectionStatus.mockReset();
  kubeApi.SetPreferredNamespaces.mockReset();
});
```

4. **Update test: "auto-selects first context when currentContext invalid"** (lines 79-93):
```javascript
it('auto-selects first context when currentContext invalid', async () => {
  kubeApi.GetCurrentConfig.mockResolvedValueOnce({ currentContext: 'missing', PreferredNamespaces: ['ns2'] });
  kubeApi.GetKubeContexts.mockResolvedValueOnce(['ctxA','ctxB']);
  kubeApi.GetNamespaces.mockResolvedValueOnce(['ns1','ns2']);
  await renderAndWait();
  // Wait for the async initialization to complete and state to be set
  await waitFor(() => {
    const st = parseState();
    expect(st.selectedContext).toBe('ctxA');
    expect(st.selectedNamespaces).toEqual(['ns2']);
  }, { timeout: 3000 });
  const st = parseState();
  expect(showSuccess).toHaveBeenCalledWith(expect.stringContaining("Auto-selected context 'ctxA'"));
  expect(kubeApi.SetCurrentKubeContext).toHaveBeenCalledWith('ctxA');
  expect(kubeApi.SetCurrentNamespace).toHaveBeenCalledWith('ns2');
});
```

5. **Update test: "warns when namespaces list is empty"** (lines 104-116):
```javascript
it('warns when namespaces list is empty', async () => {
  kubeApi.GetCurrentConfig.mockResolvedValueOnce({ currentContext: 'ctx1' });
  kubeApi.GetKubeContexts.mockResolvedValueOnce(['ctx1']);
  kubeApi.GetNamespaces.mockResolvedValueOnce([]);
  await renderAndWait();
  // Wait for warning to be called
  await waitFor(() => {
    expect(showWarning).toHaveBeenCalledWith('No namespaces found for the selected context.');
  }, { timeout: 3000 });
  const st = parseState();
  expect(st.namespaces).toEqual([]);
  expect(st.selectedNamespaces).toEqual([]);
});
```

6. **Update test: "selectContext switches context & resets namespaces"** (lines 130-144):
```javascript
it('selectContext switches context & resets namespaces', async () => {
  await initStandard();
  // prepare GetNamespaces for second context switch
  kubeApi.GetNamespaces.mockResolvedValueOnce(['nsX','nsY']);
  await act(async () => {
    screen.getByTestId('selectCtxB').click();
  });
  // Wait for the context switch to complete and state to update
  await waitFor(() => {
    const st = parseState();
    expect(st.selectedContext).toBe('ctxB');
    expect(st.selectedNamespaces).toEqual(['nsX']);
  }, { timeout: 3000 });
  expect(showSuccess).toHaveBeenCalledWith("Context switched to 'ctxB'.");
});
```

## How to Apply

### Option 1: Cherry-pick the commit
```bash
git fetch origin copilot/fix-checks-for-pr-40
git checkout renovate/major-vitest-monorepo
git cherry-pick 06cbb96
git push origin renovate/major-vitest-monorepo
```

### Option 2: Manual application
1. Checkout the `renovate/major-vitest-monorepo` branch
2. Edit `frontend/src/__tests__/clusterStateProvider.test.jsx` with the changes listed above
3. Run `npm test` to verify all tests pass
4. Commit and push

## Verification
After applying the fix, run:
```bash
cd frontend && npm test
```

All 1256 tests should pass:
```
Test Files  135 passed (135)
     Tests  1256 passed (1256)
```

## Git Commands for Repository Maintainers
To apply this fix to PR #40:

```bash
# Fetch the fix branch
git fetch origin copilot/fix-checks-for-pr-40

# Checkout the Renovate PR branch
git fetch origin renovate/major-vitest-monorepo
git checkout renovate/major-vitest-monorepo

# Cherry-pick the fix commit
git cherry-pick 06cbb96

# Push to update the PR
git push origin renovate/major-vitest-monorepo
```

This will update PR #40 with the fix and the CI checks should pass.
