# Reduce Codebase Size: Duplication Analysis & Abstraction Plan

**Date**: 2026-01-31
**Status**: Analysis Complete - Ready for Implementation

## Executive Summary

The codebase has **significant duplication** that could be reduced by **40-50%** through well-designed abstractions. The main pattern (sidebar -> overview table -> detail panel) repeats ~20 times with minimal variation, yet each implementation is largely independent.

**Estimated savings**: ~10,000 lines of code

---

## 1. Major Duplication Patterns

### 1.1 Holmes State Management (~2,500 lines duplicated)

Every `*OverviewTable.jsx` component contains **identical** Holmes streaming logic.

| Component | Lines of Holmes Code |
|-----------|---------------------|
| `frontend/src/k8s/resources/pods/PodOverviewTable.jsx` | ~150 lines |
| `frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.jsx` | ~125 lines |
| `frontend/src/k8s/resources/services/ServicesOverviewTable.jsx` | ~125 lines |
| `frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx` | ~130 lines |
| (+ ~15 more resource tables) | ~125 lines each |

**The identical code block** (repeated in every file):
```jsx
const [holmesState, setHolmesState] = useState({
  loading: false, response: null, error: null, key: null,
  streamId: null, streamingText: '', reasoningText: '',
  queryTimestamp: null, contextSteps: [], toolEvents: [],
});
const holmesStateRef = useRef(holmesState);

useEffect(() => {
  const unsubscribe = onHolmesChatStream((payload) => {
    // ~80 lines of identical event handling
  });
  return () => { try { unsubscribe?.(); } catch (_) {} };
}, []);

useEffect(() => {
  const unsubscribe = onHolmesContextProgress((event) => {
    // ~25 lines of identical progress handling
  });
  return () => { try { unsubscribe?.(); } catch (_) {} };
}, []);
```

**Solution**: Create `useHolmesAnalysis` hook

```jsx
// frontend/src/holmes/useHolmesAnalysis.js
export function useHolmesAnalysis({ kind, analyzeFn }) {
  const [state, setState] = useState(initialHolmesState);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload) => {
      // Consolidated stream handling
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event) => {
      // Consolidated progress handling
    });
    return unsubscribe;
  }, []);

  const analyze = async (namespace, name) => {
    const key = `${namespace}/${name}`;
    const streamId = `${kind.toLowerCase()}-${Date.now()}`;
    setState({ ...initialState, loading: true, key, streamId, queryTimestamp: new Date().toISOString() });
    try {
      await analyzeFn(namespace, name, streamId);
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: err?.message || String(err) }));
    }
  };

  const cancel = async () => {
    if (!state.streamId) return;
    setState(prev => ({ ...prev, loading: false, streamId: null }));
    await CancelHolmesStream(state.streamId);
  };

  return { state, analyze, cancel };
}
```

**Usage**:
```jsx
// In DeploymentsOverviewTable.jsx - reduces ~125 lines to ~3 lines
const { state: holmesState, analyze, cancel } = useHolmesAnalysis({
  kind: 'Deployment',
  analyzeFn: AnalyzeDeploymentStream,
});
```

---

### 1.2 PodOverviewTable is a Standalone Anomaly (~900 lines excess)

`frontend/src/k8s/resources/pods/PodOverviewTable.jsx` is **1,219 lines** and doesn't use `OverviewTableWithPanel`. It implements:

- Custom TanStack React Table setup (could use shared component)
- Custom virtualization (not needed - table handles pagination)
- Custom menu handling (duplicated from OverviewTableWithPanel)
- Custom bottom panel management (duplicated)
- Custom notification system (duplicated)

Meanwhile, `DeploymentsOverviewTable` is only **462 lines** using the shared component.

**Solution**: Migrate PodOverviewTable to use OverviewTableWithPanel

The Pods view has some unique features (port forwarding, shell access) but these can be handled via:
- Custom `getRowActions` prop
- Custom tabs in `renderPanelContent`

**Estimated reduction**: ~900 lines

---

### 1.3 Data Normalization Functions (~400 lines duplicated)

Each component has its own normalizer because Go backend returns **PascalCase** but frontend expects **camelCase**:

```jsx
// In DeploymentsOverviewTable.jsx
const normalize = (arr) => (arr || []).filter(Boolean).map(d => ({
  name: d.name ?? d.Name,
  namespace: d.namespace ?? d.Namespace,
  replicas: d.replicas ?? d.Replicas ?? 0,
  ready: d.ready ?? d.Ready ?? 0,
  available: d.available ?? d.Available ?? 0,
  age: d.age ?? d.Age ?? '-',
  image: d.image ?? d.Image ?? '',
  labels: d.labels ?? d.Labels ?? d.metadata?.labels ?? {}
}));

// Nearly identical in ServicesOverviewTable.jsx
// Nearly identical in StatefulSetsOverviewTable.jsx
// ... repeated ~20 times
```

**Solution A**: Fix Go backend to return consistent camelCase (preferred)

The Go structs already use camelCase JSON tags:
```go
type DeploymentInfo struct {
    Name      string `json:"name"`
    Namespace string `json:"namespace"`
}
```

So the backend should already return camelCase. The frontend normalization may be legacy code that's no longer needed.

**Solution B**: Create single normalizer utility

```jsx
// frontend/src/utils/normalizeResource.js
export function normalizeResource(obj, fields) {
  if (!obj) return null;
  const result = {};
  for (const [key, defaultValue] of Object.entries(fields)) {
    const pascalKey = key.charAt(0).toUpperCase() + key.slice(1);
    result[key] = obj[key] ?? obj[pascalKey] ?? defaultValue;
  }
  return result;
}

// Usage
const deploymentFields = { name: '', namespace: '', replicas: 0, ready: 0, available: 0, age: '-', image: '', labels: {} };
const normalized = data.map(d => normalizeResource(d, deploymentFields));
```

---

### 1.4 Go Backend Polling Functions (~400 lines duplicated)

Every resource type has a `StartXPolling` function with **identical structure**:

| File | Function |
|------|----------|
| `pkg/app/deployments.go` | `StartDeploymentPolling()` |
| `pkg/app/statefulsets.go` | `StartStatefulSetPolling()` |
| `pkg/app/daemonsets.go` | `StartDaemonSetPolling()` |
| `pkg/app/cronjobs.go` | `StartCronJobPolling()` |
| (+ ~10 more) | Similar pattern |

The pattern is always:
```go
func (a *App) StartXPolling() {
    go func() {
        for {
            time.Sleep(time.Second)
            if a.ctx == nil { continue }
            nsList := a.preferredNamespaces
            if len(nsList) == 0 && a.currentNamespace != "" {
                nsList = []string{a.currentNamespace}
            }
            if len(nsList) == 0 { continue }
            var all []XInfo
            for _, ns := range nsList {
                items, err := a.GetX(ns)
                if err != nil { continue }
                all = append(all, items...)
            }
            emitEvent(a.ctx, "x:update", all)
        }
    }()
}
```

**Solution**: Generic polling function

```go
// pkg/app/polling.go
func (a *App) startResourcePolling[T any](
    eventName string,
    fetchFn func(namespace string) ([]T, error),
) {
    go func() {
        for {
            time.Sleep(time.Second)
            if a.ctx == nil { continue }

            nsList := a.preferredNamespaces
            if len(nsList) == 0 && a.currentNamespace != "" {
                nsList = []string{a.currentNamespace}
            }
            if len(nsList) == 0 { continue }

            var all []T
            for _, ns := range nsList {
                items, err := fetchFn(ns)
                if err != nil { continue }
                all = append(all, items...)
            }
            emitEvent(a.ctx, eventName, all)
        }
    }()
}

// Usage
func (a *App) StartDeploymentPolling() {
    a.startResourcePolling("deployments:update", a.GetDeployments)
}
```

**Note**: Requires Go 1.18+ for generics. Currently the project uses Go generics in some places, so this should be compatible.

---

### 1.5 Go Get Resource Functions (~600 lines duplicated)

Each `GetX` function has identical boilerplate for getting the kubernetes client:

```go
// Repeated in ~15 files
func (a *App) GetDeployments(namespace string) ([]DeploymentInfo, error) {
    var clientset kubernetes.Interface
    var err error
    if a.testClientset != nil {
        clientset = a.testClientset.(kubernetes.Interface)
    } else {
        clientset, err = a.getKubernetesClient()
        if err != nil {
            return nil, err
        }
    }
    // ... resource-specific code
}
```

**Solution**: Extract client getter

```go
// pkg/app/client.go
func (a *App) getClient() (kubernetes.Interface, error) {
    if a.testClientset != nil {
        return a.testClientset.(kubernetes.Interface), nil
    }
    return a.getKubernetesClient()
}

// Usage - saves 8 lines per function
func (a *App) GetDeployments(namespace string) ([]DeploymentInfo, error) {
    clientset, err := a.getClient()
    if err != nil {
        return nil, err
    }
    // ... resource-specific code
}
```

---

## 2. Anti-patterns & Bad Practices Found

### 2.1 Potentially Unused Variables

- `frontend/src/AppContainer.jsx:149`: `_renderPodsMainContent` - underscore prefix suggests unused
- `frontend/src/AppContainer.jsx:156`: `_renderResourceMainContent` - underscore prefix suggests unused
- `frontend/src/k8s/resources/persistentvolumes/PersistentVolumesOverviewTable.jsx:66`: `_annotations` - computed but not used

**Action**: Verify and remove if unused.

### 2.2 Inconsistent Event Handling

- K8s tables use `EventsOn('deployments:update')` with `EventsOff()` cleanup
- Some components forget cleanup or use different patterns
- Some Swarm components use different event subscription patterns

**Action**: Standardize via `useResourceData` hook (see Section 3.3).

### 2.3 Duplicated Inline Styles

Context menus have ~30 lines of identical inline styles repeated in every table:

```jsx
style={{
  position: 'absolute', right: 0, top: '100%',
  background: 'var(--gh-table-header-bg, #2d323b)',
  border: '1px solid #353a42',
  boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
  zIndex: 1200, minWidth: 180, textAlign: 'left',
}}
```

**Action**: Extract to CSS classes or styled component.

---

## 3. Recommended Abstractions

### 3.1 Frontend: useHolmesAnalysis Hook (Priority: HIGH)

See Section 1.1 for implementation details.

**Files to modify**:
- Create: `frontend/src/holmes/useHolmesAnalysis.js`
- Update: All `*OverviewTable.jsx` files (~20 files)

**Estimated effort**: 1-2 days
**Estimated savings**: ~2,000 lines

### 3.2 Frontend: Migrate PodOverviewTable (Priority: HIGH)

Refactor `PodOverviewTable.jsx` to use `OverviewTableWithPanel`.

**Unique Pod features to preserve**:
- Port forward action and dialog
- Shell/Console tab
- Files tab
- Mounts tab

These can all be handled via the existing `getRowActions` and `renderPanelContent` props.

**Files to modify**:
- `frontend/src/k8s/resources/pods/PodOverviewTable.jsx`

**Estimated effort**: 1 day
**Estimated savings**: ~900 lines

### 3.3 Frontend: useResourceData Hook (Priority: MEDIUM)

```jsx
// frontend/src/hooks/useResourceData.js
export function useResourceData({ fetchFn, eventName, namespaces, namespace, normalize }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const nsArr = Array.isArray(namespaces) && namespaces.length > 0
      ? namespaces
      : (namespace ? [namespace] : []);
    if (nsArr.length === 0) return;

    try {
      setLoading(true);
      const lists = await Promise.all(nsArr.map(ns => fetchFn(ns).catch(() => [])));
      const flat = lists.flat();
      setData(normalize ? flat.map(normalize) : flat);
    } catch (_) {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [fetchFn, namespaces, namespace, normalize]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const handler = (list) => {
      const arr = Array.isArray(list) ? list : [];
      setData(normalize ? arr.map(normalize) : arr);
      setLoading(false);
    };
    EventsOn(eventName, handler);
    return () => { try { EventsOff(eventName); } catch (_) {} };
  }, [eventName, normalize]);

  return { data, loading, refresh };
}
```

**Estimated effort**: 0.5 days
**Estimated savings**: ~500 lines

### 3.4 Frontend: Resource Table Configuration Object (Priority: LOW)

For maximum consolidation, use a configuration-driven approach:

```jsx
// frontend/src/resources/config/deploymentConfig.js
export const deploymentConfig = {
  kind: 'Deployment',
  title: 'Deployments',
  eventName: 'deployments:update',
  columns: [
    { key: 'name', label: 'Name' },
    { key: 'namespace', label: 'Namespace' },
    { key: 'replicas', label: 'Replicas' },
    { key: 'ready', label: 'Ready' },
    { key: 'available', label: 'Available' },
    { key: 'age', label: 'Age' },
    { key: 'image', label: 'Image' },
  ],
  tabs: [
    { key: 'summary', label: 'Summary' },
    { key: 'pods', label: 'Pods', countKey: 'pods' },
    { key: 'rollout', label: 'Rollout' },
    { key: 'logs', label: 'Logs' },
    { key: 'events', label: 'Events', countKey: 'events' },
    { key: 'yaml', label: 'YAML' },
    { key: 'holmes', label: 'Holmes' },
  ],
  fetchFn: AppAPI.GetDeployments,
  holmesAnalyzeFn: AnalyzeDeploymentStream,
  actions: {
    restart: { fn: AppAPI.RestartDeployment, label: 'Restart', icon: '🔄' },
    delete: { fn: (ns, n) => AppAPI.DeleteResource('deployment', ns, n), label: 'Delete', icon: '🗑️', danger: true },
  },
};

// Then: <ConfigurableResourceTable config={deploymentConfig} namespace={namespace} />
```

This is a larger refactor but would allow defining new resource types with just a config file.

**Estimated effort**: 3-5 days
**Estimated savings**: ~4,000 lines (but high risk)

### 3.5 Backend: Generic Polling Function (Priority: MEDIUM)

See Section 1.4 for implementation.

**Files to modify**:
- Create: `pkg/app/polling.go`
- Update: All `Start*Polling` functions

**Estimated effort**: 0.5 days
**Estimated savings**: ~300 lines

### 3.6 Backend: Extract Client Getter (Priority: LOW)

See Section 1.5 for implementation.

**Files to modify**:
- All resource handler files in `pkg/app/`

**Estimated effort**: 0.5 days
**Estimated savings**: ~200 lines

---

## 4. Estimated Codebase Reduction Summary

| Category | Current Lines | After Refactor | Savings |
|----------|---------------|----------------|---------|
| Holmes duplication (hook) | ~2,500 | ~300 | ~2,200 |
| PodOverviewTable migration | ~1,200 | ~350 | ~850 |
| Data normalization | ~400 | ~50 | ~350 |
| useResourceData hook | ~600 | ~100 | ~500 |
| Go polling functions | ~500 | ~100 | ~400 |
| Go client getter | ~400 | ~200 | ~200 |
| **Total** | ~5,600 | ~1,100 | **~4,500** |

**Conservative estimate**: ~4,500 lines removed
**With config-driven tables**: ~8,000+ lines removed

---

## 5. Implementation Priority

### Phase 1: Quick Wins (1-2 days)
1. **Create `useHolmesAnalysis` hook** - Immediate ~2,000 line reduction, low risk
2. **Extract Go client getter** - Simple refactor, ~200 lines

### Phase 2: Medium Effort (2-3 days)
3. **Migrate `PodOverviewTable`** to use `OverviewTableWithPanel` - ~850 lines
4. **Create `useResourceData` hook** - ~500 lines
5. **Create generic Go polling function** - ~400 lines

### Phase 3: Large Refactor (3-5 days, optional)
6. **Config-driven resource tables** - Major consolidation but higher risk

---

## 6. Files Reference

### Frontend Files with Most Duplication
- `frontend/src/k8s/resources/pods/PodOverviewTable.jsx` (1,219 lines - standalone)
- `frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.jsx` (462 lines)
- `frontend/src/k8s/resources/services/ServicesOverviewTable.jsx` (418 lines)
- `frontend/src/k8s/resources/statefulsets/StatefulSetsOverviewTable.jsx`
- `frontend/src/k8s/resources/daemonsets/DaemonSetsOverviewTable.jsx`
- `frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx` (867 lines)
- `frontend/src/docker/resources/nodes/SwarmNodesOverviewTable.jsx`
- `frontend/src/docker/resources/tasks/SwarmTasksOverviewTable.jsx`

### Backend Files with Most Duplication
- `pkg/app/deployments.go`
- `pkg/app/statefulsets.go`
- `pkg/app/daemonsets.go`
- `pkg/app/cronjobs.go`
- `pkg/app/jobs.go`
- `pkg/app/services.go`
- `pkg/app/configmaps.go`
- `pkg/app/secrets.go`
- `pkg/app/docker/services.go`
- `pkg/app/docker/nodes.go`
- `pkg/app/docker/tasks.go`

---

## 7. Recent Improvements (Already Applied)

The following refactoring has already been applied to improve code organization:

### Backend Decomposition
- `pkg/app/deployments.go`: Extracted `getDeploymentImage`, `getDeploymentReplicas`, `mergeDeploymentLabels`, `buildDeploymentInfo`
- `pkg/app/statefulsets.go`: Extracted `getStatefulSetImage`, `getStatefulSetReplicas`, `mergeStatefulSetLabels`, `buildStatefulSetInfo`
- `pkg/app/docker/services.go`: Extracted `extractContainerInfo`, `extractUpdateConfig`, `extractResources`, `extractPlacement`, `extractModeAndReplicas`, `extractPorts`

These changes improve readability but don't reduce overall line count significantly. The major savings come from the abstractions proposed above.
