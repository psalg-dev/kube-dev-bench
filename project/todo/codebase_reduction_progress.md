# Codebase Size Reduction: Progress Report & Further Opportunities

**Date**: 2026-01-31
**Status**: Phase 1-3 Complete

---

## Metrics Summary

| Metric | Baseline | Final | Reduction |
|--------|----------|-------|-----------|
| Frontend (JSX/JS) | 66,536 lines | 64,211 lines | **2,325 lines (3.5%)** |
| Backend (Go) | 45,870 lines | 45,722 lines | **148 lines (0.3%)** |
| **Total** | **112,406 lines** | **109,933 lines** | **2,473 lines (2.2%)** |

---

## Completed Optimizations

### Phase 1: useHolmesAnalysis Hook (~2,200 lines saved)
- **Created**: `frontend/src/hooks/useHolmesAnalysis.js` (252 lines)
- **Created**: `frontend/src/__tests__/useHolmesAnalysis.test.js` (12 tests)
- **Refactored**: 16 OverviewTable components to use the hook
  - K8s: Deployments, Services, StatefulSets, DaemonSets, Jobs, CronJobs, ConfigMaps, Secrets, Ingresses, PersistentVolumes, PersistentVolumeClaims, Pods
  - Swarm: Services, Tasks, Nodes, Stacks

### Phase 2: useResourceData Hook (~500 lines saved)
- **Created**: `frontend/src/hooks/useResourceData.js` (172 lines)
- **Created**: `frontend/src/__tests__/useResourceData.test.js` (15 tests)
- **Refactored**: 11 K8s OverviewTable components to use the hook
- **Also created**: `createNormalizer()` utility for PascalCase/camelCase handling

### Phase 3: Go Client Getter Helper (~148 lines saved)
- **Created**: `pkg/app/client.go` with `getClient()` helper
- **Created**: `pkg/app/client_test.go` (2 tests)
- **Refactored**: 16 Go resource handler files

---

## Further Optimization Opportunities

### High Priority (Recommended)

#### 1. Migrate PodOverviewTable to OverviewTableWithPanel
**Estimated savings**: ~700-900 lines

`PodOverviewTable.jsx` (1,053 lines after refactoring) is still a standalone implementation that doesn't use `OverviewTableWithPanel`. It has custom:
- TanStack React Table setup
- Virtualization (not needed with pagination)
- Menu handling
- Bottom panel management

The unique Pod features (port forwarding, shell access, files, mounts) can be handled via:
- Custom `getRowActions` prop
- Custom tabs in `renderPanelContent`

**Complexity**: Medium-High (requires careful testing of unique features)

#### 2. Apply useResourceData to Swarm Components
**Estimated savings**: ~200-400 lines

Docker Swarm OverviewTable components still have manual data fetching logic that could use the `useResourceData` hook:
- `SwarmServicesOverviewTable.jsx`
- `SwarmTasksOverviewTable.jsx`
- `SwarmNodesOverviewTable.jsx`
- `SwarmStacksOverviewTable.jsx`

Note: Swarm components don't use namespace-based fetching, so the hook would need modification or a separate Swarm-specific hook.

#### 3. Generic Go Polling Function
**Estimated savings**: ~300 lines

The plan proposed a generic polling function using Go generics:

```go
func (a *App) startResourcePolling[T any](
    eventName string,
    fetchFn func(namespace string) ([]T, error),
) {
    go func() {
        for {
            time.Sleep(time.Second)
            if a.ctx == nil { continue }
            if nsList := a.getPollingNamespaces(); len(nsList) > 0 {
                var all []T
                for _, ns := range nsList {
                    items, err := fetchFn(ns)
                    if err != nil { continue }
                    all = append(all, items...)
                }
                emitEvent(a.ctx, eventName, all)
            }
        }
    }()
}
```

This would consolidate ~14 polling functions into one generic implementation.

**Complexity**: Low (straightforward Go generics)

### Medium Priority

#### 4. Config-Driven Resource Tables
**Estimated savings**: ~4,000+ lines (but high risk)

The plan proposed a configuration-driven approach where each resource type is defined by a config object:

```jsx
const deploymentConfig = {
  kind: 'Deployment',
  title: 'Deployments',
  eventName: 'deployments:update',
  columns: [...],
  tabs: [...],
  fetchFn: AppAPI.GetDeployments,
  holmesAnalyzeFn: AnalyzeDeploymentStream,
  actions: {...},
};
```

This would allow defining new resource types with just configuration, eliminating most of the per-resource component files.

**Complexity**: High (significant refactor, needs extensive testing)

#### 5. Extract Inline Styles to CSS Classes
**Estimated savings**: ~200-300 lines

Context menus and summary panels have ~30 lines of identical inline styles repeated across components. These could be extracted to shared CSS classes.

**Complexity**: Low

### Low Priority

#### 6. Remove Unused Variables
The plan identified potentially unused variables:
- `frontend/src/AppContainer.jsx:149`: `_renderPodsMainContent`
- `frontend/src/AppContainer.jsx:156`: `_renderResourceMainContent`
- `frontend/src/k8s/resources/persistentvolumes/PersistentVolumesOverviewTable.jsx:66`: `_annotations`

**Action**: Verify and remove if unused (likely very small savings).

#### 7. Standardize Event Handling
Some components use different event subscription patterns. Standardizing via `useResourceData` or a dedicated event hook would improve consistency.

---

## Implementation Notes

### Test Coverage
- All 1,283 frontend tests pass
- All Go backend tests pass
- New hooks have dedicated test files with comprehensive coverage

### Breaking Changes
None. All refactoring maintains backward compatibility.

### Files Added
- `frontend/src/hooks/useHolmesAnalysis.js`
- `frontend/src/hooks/useResourceData.js`
- `frontend/src/__tests__/useHolmesAnalysis.test.js`
- `frontend/src/__tests__/useResourceData.test.js`
- `pkg/app/client.go`
- `pkg/app/client_test.go`

---

## Conclusion

The codebase size reduction effort achieved a **2.2% overall reduction** (2,473 lines). More importantly, the refactoring:

1. **Improved maintainability** by centralizing Holmes streaming logic and data fetching patterns
2. **Reduced duplication** across 16+ frontend components and 16+ backend files
3. **Added test coverage** for the new hooks and helpers
4. **Established patterns** that can be extended to remaining components

The remaining optimization opportunities (especially migrating PodOverviewTable and generic Go polling) could yield an additional **~1,500-2,000 lines** of reduction with medium effort.
