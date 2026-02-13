---
title: "Kubernetes Watch/Informer Migration Plan"
date: "2026-02-11"
owner: "team"
status: "draft"
---

# Goal
Replace polling-based Kubernetes data refresh with watch/informer-driven updates to reduce traffic while keeping UI behavior stable.

# Scope
- Kubernetes resources currently polled in the backend and surfaced in the frontend tables/bottom panel.
- Wails RPC and event wiring used to deliver updates to the frontend.
- No change to stable DOM selectors or UI layout.

# Non-Goals
- No new resource types.
- No UI redesign.
- No changes to authentication/cluster connection workflows.

# Current Architecture Analysis

## Backend Polling (pkg/app/)
- **Generic polling**: `startResourcePolling[T]()` in `polling.go` uses `time.Ticker` (1s default)
- **Resource counts**: `runResourceCountsAggregator()` in `counts.go` uses dual tickers:
  - Fast: 1s for pod status
  - Slow: 4s for full resource counts
- **Event emission**: `emitEvent(ctx, eventName, data)` via Wails event bus
- **Namespace filtering**: `getPollingNamespaces()` determines which namespaces to poll

## Frontend Patterns
- **Table components**: Use `setInterval` with fast (1s) and slow (60s) polling
  - Example: `PersistentVolumeClaimsOverviewTable.tsx` lines 178-200
- **Event subscription**: `EventsOn('resource-updated')` for backend events
- **State contexts**: Manual fetch + `useEffect` patterns
  - `ResourceCountsContext` subscribes to `resource-counts-updated`
  - `SwarmStateContext` uses `runRefresh()` pattern
- **Age display**: Client-side calculation from `creationTimestamp`, refreshed on data updates

## Baseline Metrics
- **Poll intervals**: 1s (fast), 4s (counts), 60s (slow stable resources)
- **API QPS estimate**: ~15-20 LIST calls per second (10 resource types × 2 ns @ 1s + counts @ 4s)
- **Bandwidth**: ~500KB-2MB per second depending on cluster size
- **UI refresh**: Immediate on data change via React state updates

# Plan

## 1) Inventory and baseline ✓ (Completed above)
- [x] Located polling loops: `polling.go`, `counts.go`, frontend table components
- [x] Identified resource entry points: Pods, Deployments, Services, Jobs, StatefulSets, DaemonSets, ConfigMaps, Secrets, PVCs, Events, RBAC resources
- [x] Mapped frontend dependencies: Tables subscribe to events, use `EventsOn()`
- [x] Captured baseline metrics: See "Baseline Metrics" above
- [x] Documented error behavior: Silent failures with console.error, no retry backoff

## 2) Informer architecture design

### Technical Stack
- **Library**: `k8s.io/client-go/tools/cache` (SharedInformerFactory)
- **Pattern**: One SharedInformerFactory per cluster context, multiple resource informers
- **Lifecycle**: Start on context switch, stop on disconnect/context change

### Namespace Scoping Strategy
- **Use current pattern**: Watch namespaces selected by user (from `getPollingNamespaces()`)
- **Rationale**: Matches existing behavior, reduces memory footprint
- **Implementation**: Create new informer factory when namespace selection changes
- **Cluster-scoped resources**: Use cluster-wide informers (Namespaces, Nodes, PVs, ClusterRoles, ClusterRoleBindings)

### Shared Informer Factory Design
```go
// pkg/app/informer_manager.go (new file)
type InformerManager struct {
    factory   informers.SharedInformerFactory
    stopCh    chan struct{}
    clientset *kubernetes.Clientset
    namespaces []string
    mu        sync.RWMutex
}
```

### Cache and Lister Strategy
- **Read path**: Informer cache → Lister → Wails RPC response
- **No direct API calls** for GET/LIST operations once informers are running
- **Initial sync**: Wait for `cache.WaitForCacheSync()` before serving requests
- **Memory**: Shared informer factory reuses watch connections and caches

### Event Types to Emit
```go
type ResourceEvent struct {
    Type      string      // "add", "update", "delete", "resync"
    Resource  string      // "pods", "deployments", etc.
    Namespace string      // empty for cluster-scoped
    Data      interface{} // Full resource list or single resource
}
```
- **Add**: New resource created (emit full resource)
- **Update**: Resource modified (emit full resource, frontend diffs)
- **Delete**: Resource removed (emit UID/name only)
- **Resync**: Full list sync (emit complete list, rare)

### Watch Failure Handling
- **On error**: Log, wait 5s with exponential backoff (max 60s), recreate informer
- **On disconnect**: Emit UI notification, show "Reconnecting..." indicator
- **On success**: Clear backoff, emit success notification
- **Safety**: Always do one full LIST after reconnect to catch missed events

### Resync Period
- **Default**: 10 minutes (`10 * time.Minute`)
- **Rationale**: Guards against missed events, low overhead
- **Trigger**: Informer re-lists all resources and emits updates for changed items

### Age Auto-Refresh Without Polling
- **Keep current approach**: Frontend calculates age from `metadata.creationTimestamp`
- **Trigger**: `setInterval(updateAges, 1000)` in frontend only (no API calls)
- **Update on events**: New data → recalculate ages → re-render

## 3) Backend implementation plan

### Phase 1: Core Infrastructure (pkg/app/informer_manager.go)

#### InformerManager Structure
```go
type InformerManager struct {
    clientset  *kubernetes.Clientset
    factory    informers.SharedInformerFactory
    stopCh     chan struct{}
    namespaces []string
    ctx        context.Context
    app        *App  // for emitting events
    mu         sync.RWMutex
    started    bool
}

func NewInformerManager(clientset *kubernetes.Clientset, namespaces []string, app *App) *InformerManager
func (im *InformerManager) Start() error
func (im *InformerManager) Stop()
func (im *InformerManager) Restart(namespaces []string) error
```

#### Lifecycle Integration Points
1. **On context switch** (`SetSelectedContext`):
   - Stop existing informer manager
   - Create new clientset for selected context
   - Start new informer manager with selected namespaces
2. **On namespace selection change** (`SetSelectedNamespaces`):
   - Call `Restart(newNamespaces)` on existing manager
3. **On disconnect** (`DisconnectCluster`):
   - Stop informer manager, clear caches

#### Event Naming Convention
- **Pattern**: `k8s:<resource>:<action>` (e.g., `k8s:pods:update`, `k8s:deployments:delete`)
- **Special events**:
  - `k8s:informer:error` - watch stream errors
  - `k8s:informer:reconnected` - successful reconnect
  - `k8s:cache:synced` - initial sync complete

#### Resource Informer Registration
Per resource type, add handler registration:
```go
// Example for Pods
podInformer := factory.Core().V1().Pods().Informer()
podInformer.AddEventHandler(cache.ResourceEventHandlerFuncs{
    AddFunc: func(obj interface{}) {
        pod := obj.(*corev1.Pod)
        if im.shouldEmit(pod.Namespace) {
            im.emitEvent("k8s:pods:add", pod)
        }
    },
    UpdateFunc: func(oldObj, newObj interface{}) {
        pod := newObj.(*corev1.Pod)
        if im.shouldEmit(pod.Namespace) {
            im.emitEvent("k8s:pods:update", pod)
        }
    },
    DeleteFunc: func(obj interface{}) {
        pod := obj.(*corev1.Pod)
        if im.shouldEmit(pod.Namespace) {
            im.emitEvent("k8s:pods:delete", map[string]string{
                "uid": string(pod.UID),
                "name": pod.Name,
                "namespace": pod.Namespace,
            })
        }
    },
})
```

#### Cache Access for Wails RPCs
Replace direct API calls with lister queries:
```go
// OLD: pods, err := clientset.CoreV1().Pods(namespace).List(ctx, opts)
// NEW:
podLister := im.factory.Core().V1().Pods().Lister()
pods, err := podLister.Pods(namespace).List(labels.Everything())
```

**Key RPCs to update**:
- `GetPods` → use pod lister
- `GetDeployments` → use deployment lister
- `GetServices` → use service lister
- `GetJobs` → use job lister
- `GetStatefulSets` → use statefulset lister
- `GetDaemonSets` → use daemonset lister
- `GetConfigMaps` → use configmap lister
- `GetSecrets` → use secret lister
- `GetPersistentVolumeClaims` → use pvc lister
- `GetEvents` → use event lister
- All RBAC resource getters

### Phase 2: Error Handling and Recovery

#### Informer Error Handler
```go
type ErrorHandler struct {
    backoff time.Duration
    maxBackoff time.Duration
    mu sync.Mutex
}

func (eh *ErrorHandler) OnError(err error) {
    eh.mu.Lock()
    defer eh.mu.Unlock()
    
    log.Printf("Informer error: %v", err)
    emitEvent(ctx, "k8s:informer:error", map[string]string{
        "error": err.Error(),
        "backoff": eh.backoff.String(),
    })
    
    time.Sleep(eh.backoff)
    eh.backoff = min(eh.backoff * 2, eh.maxBackoff)
}

func (eh *ErrorHandler) Reset() {
    eh.mu.Lock()
    defer eh.mu.Unlock()
    eh.backoff = 5 * time.Second
}
```

#### Reconnect Strategy
1. On error, wait with backoff (5s → 10s → 20s → 40s → max 60s)
2. Recreate informer factory with same namespaces
3. Wait for cache sync (`WaitForCacheSync`)
4. Emit `k8s:informer:reconnected` event
5. Do one full list operation to emit current state
6. Reset backoff counter

### Phase 3: Thread Safety and Cleanup

#### Thread-Safe Cache Access
- Use `sync.RWMutex` around factory/stopCh access
- Read lock for lister operations
- Write lock for Start/Stop/Restart

#### Clean Shutdown Sequence
```go
func (im *InformerManager) Stop() {
    im.mu.Lock()
    defer im.mu.Unlock()
    
    if !im.started {
        return
    }
    
    close(im.stopCh)  // Signal all goroutines to stop
    im.started = false
    im.factory = nil  // Clear cache references
}
```

### Phase 4: Wails Bindings Regeneration
After adding/modifying any Go methods exposed to frontend:
```bash
wails dev  # Automatically regenerates frontend/wailsjs/go/main/App.js
```

**Note**: All developers must run `wails dev` after pulling backend changes that modify RPC signatures.

## 4) Frontend data flow plan

### Phase 1: Event Subscription Hook

Create reusable hook for resource subscriptions:
```typescript
// frontend/src/hooks/useResourceWatch.ts (new file)
import { useEffect, useState } from 'react';
import { EventsOn } from '../../wailsjs/runtime/runtime';

export function useResourceWatch<T>(
  eventName: string,
  initialFetch: () => Promise<T[]>,
  options?: {
    mergeStrategy?: 'replace' | 'incremental';
    filter?: (item: T) => boolean;
  }
) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    // Initial fetch from cache
    initialFetch().then((items) => {
      if (mounted) {
        setData(items);
        setLoading(false);
      }
    });

    // Subscribe to updates
    const unsubscribe = EventsOn(eventName, (event: any) => {
      if (!mounted) return;

      switch (event.action) {
        case 'add':
          setData(prev => [...prev, event.data]);
          break;
        case 'update':
          setData(prev => prev.map(item => 
            item.metadata?.uid === event.data.metadata?.uid ? event.data : item
          ));
          break;
        case 'delete':
          setData(prev => prev.filter(item => 
            item.metadata?.uid !== event.uid
          ));
          break;
        case 'resync':
          setData(event.data);
          break;
      }
    });

    return () => {
      mounted = false;
      unsubscribe?.();
    };
  }, [eventName, initialFetch]);

  return { data, loading };
}
```

### Phase 2: Update Resource Table Components

#### Pattern: Replace Polling with Watch Subscription
**Before** (with polling):
```typescript
useEffect(() => {
  const timer = setInterval(async () => {
    const items = await GetPods(namespace);
    setPods(items);
  }, 1000);
  return () => clearInterval(timer);
}, [namespace]);
```

**After** (with watch):
```typescript
const { data: pods, loading } = useResourceWatch(
  'k8s:pods:update',
  () => GetPods(namespace),
  { mergeStrategy: 'incremental' }
);
```

#### Apply to All Resource Tables
- [x] Document pattern above
- [ ] `PodsOverviewTable` → use `useResourceWatch('k8s:pods:update')`
- [ ] `DeploymentsOverviewTable` → use `useResourceWatch('k8s:deployments:update')`
- [ ] `ServicesOverviewTable` → use `useResourceWatch('k8s:services:update')`
- [ ] `JobsOverviewTable` → use `useResourceWatch('k8s:jobs:update')`
- [ ] `StatefulSetsOverviewTable` → use `useResourceWatch('k8s:statefulsets:update')`
- [ ] `DaemonSetsOverviewTable` → use `useResourceWatch('k8s:daemonsets:update')`
- [ ] `ConfigMapsOverviewTable` → use `useResourceWatch('k8s:configmaps:update')`
- [ ] `SecretsOverviewTable` → use `useResourceWatch('k8s:secrets:update')`
- [ ] `PersistentVolumeClaimsOverviewTable` → use `useResourceWatch('k8s:pvcs:update')`
- [ ] `EventsOverviewTable` → use `useResourceWatch('k8s:events:update')`
- [ ] All RBAC resource tables

### Phase 3: State Management Updates

#### ResourceCountsContext Migration
**Current**: Subscribes to `resource-counts-updated` event (keep this)
**Change**: Backend will emit counts from informer cache instead of polling

#### ClusterStateContext (if exists)
- Keep existing structure
- Change: Initial fetch from informer cache instead of API
- Subscriptions work the same way

### Phase 4: UI Stability Guarantees

#### Prevent Flicker on Updates
```typescript
// Use stable keys for table rows
const tableData = useMemo(() => {
  return data.map(item => ({
    ...item,
    _key: item.metadata?.uid || `${item.metadata?.namespace}/${item.metadata?.name}`,
  }));
}, [data]);
```

#### Preserve Selection State
```typescript
// Keep selected row UID in ref
const selectedUidRef = useRef<string | null>(null);

// On update, re-select if UID still exists
useEffect(() => {
  if (selectedUidRef.current && data.find(d => d.metadata?.uid === selectedUidRef.current)) {
    setSelectedRow(data.find(d => d.metadata?.uid === selectedUidRef.current));
  }
}, [data]);
```

#### Bottom Panel Detail Stability
- Keep bottom panel open on updates
- Only close if selected resource is deleted
- Refresh detail view when selected resource updates

### Phase 5: CreateManifestOverlay Behavior

**No changes required**:
- Creation flow still calls Wails RPC (e.g., `CreatePod()`)
- Backend applies manifest via API
- Informer detects new resource automatically
- Frontend receives add event and updates table
- Notification triggers on success/failure (keep existing)

### Phase 6: Manual Refresh Button

**Keep manual refresh button**:
```typescript
const handleRefresh = useCallback(async () => {
  setLoading(true);
  const items = await GetPods(namespace);  // Force cache read or API call
  setData(items);
  setLoading(false);
}, [namespace]);
```

**Purpose**: 
- User confidence (visible action)
- Force cache sync if user suspects staleness
- Fallback if event subscription fails

### Phase 7: Preserve Stable DOM Selectors

**Critical**: Do NOT change these IDs (E2E tests depend on them):
- `#show-wizard-btn`
- `#primaryConfigContent`
- `#sidebar`
- `#maincontent`
- `#connections-sidebar`
- `#connections-main`
- `#kubernetes-section`
- `#docker-swarm-section`
- Resource table containers: `[data-testid="pods-table"]`, etc.

**Verify after changes**:
```bash
cd e2e
npm test  # Run all E2E tests to confirm selectors work
```

## 5) Error handling and reconnects

### UI Notification Strategy

#### Watch Stream Errors
```typescript
// Subscribe to informer errors in App.tsx or root component
EventsOn('k8s:informer:error', (event: { error: string, backoff: string }) => {
  showNotification({
    type: 'warning',
    title: 'Connection Issue',
    message: `Kubernetes watch disconnected. Reconnecting in ${event.backoff}...`,
    duration: 0,  // Keep visible until resolved
    id: 'k8s-watch-error',
  });
});

EventsOn('k8s:informer:reconnected', () => {
  dismissNotification('k8s-watch-error');
  showNotification({
    type: 'success',
    title: 'Reconnected',
    message: 'Kubernetes watch stream restored',
    duration: 3000,
  });
});
```

#### Visual Indicator
- Add connection status indicator in header/footer
- Show "Connecting..." spinner during initial cache sync
- Show "Reconnecting..." badge when watch stream drops

### Prevent Duplicate Rows

#### Use UID as Unique Key
```typescript
// In useResourceWatch hook
case 'add':
  setData(prev => {
    // Check if already exists
    if (prev.some(item => item.metadata?.uid === event.data.metadata?.uid)) {
      return prev;  // Skip duplicate
    }
    return [...prev, event.data];
  });
  break;
```

#### Deduplicate on Resync
```typescript
case 'resync':
  // Full replacement, no duplicates possible
  setData(event.data);
  break;
```

### Preserve Selection State on Reconnect

#### Store Selection by UID, Not Index
```typescript
const [selectedUid, setSelectedUid] = useState<string | null>(null);
const selectedRow = useMemo(() => 
  data.find(item => item.metadata?.uid === selectedUid),
  [data, selectedUid]
);

// Selection survives data updates/reconnects
```

### RBAC Permission Errors

#### Per-Resource Error Handling
- Backend: Catch 403 Forbidden errors in informer setup
- Emit specific event: `k8s:rbac:forbidden`
```go
if errors.IsForbidden(err) {
    emitEvent(ctx, "k8s:rbac:forbidden", map[string]string{
        "resource": "pods",
        "namespace": namespace,
    })
    return nil  // Don't crash, just skip this resource type
}
```

#### Frontend RBAC Handling
```typescript
EventsOn('k8s:rbac:forbidden', (event: { resource: string, namespace: string }) => {
  showNotification({
    type: 'warning',
    title: 'Insufficient Permissions',
    message: `Cannot watch ${event.resource} in ${event.namespace}. Check RBAC role bindings.`,
    duration: 10000,
  });
  
  // Optionally hide the resource section in sidebar
  setResourceAvailability(prev => ({
    ...prev,
    [event.resource]: false,
  }));
});
```

### Safety Fallback After Reconnect

#### Backend Behavior
After successful reconnect and cache sync:
1. Wait for `WaitForCacheSync()` to complete
2. For each resource type, read from lister and emit full list
3. Emit `resync` event to frontend

```go
func (im *InformerManager) emitFullState() {
    // After reconnect, send current cache state
    for _, resource := range []string{"pods", "deployments", ...} {
        items := im.getListerItems(resource)
        emitEvent(im.ctx, fmt.Sprintf("k8s:%s:resync", resource), items)
    }
}
```

#### Frontend Handling
- Replace entire dataset on `resync` event
- Preserve selection if UID still exists
- Show brief notification: "Resource list refreshed"

## 6) Testing strategy

### Backend Tests (pkg/app/)

#### Unit Tests for InformerManager
```go
// pkg/app/informer_manager_test.go
func TestInformerManager_Lifecycle(t *testing.T) {
    tests := []struct {
        name string
        namespaces []string
        wantStarted bool
    }{
        {"single namespace", []string{"default"}, true},
        {"multiple namespaces", []string{"default", "kube-system"}, true},
        {"empty namespaces", []string{}, true},  // Should still start for cluster-scoped
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            // Test start/stop lifecycle
        })
    }
}
```

#### Event Emission Tests
```go
func TestInformerManager_EmitsEvents(t *testing.T) {
    // Use fake clientset
    clientset := fake.NewSimpleClientset()
    
    // Create test pods
    pod := &corev1.Pod{ObjectMeta: metav1.ObjectMeta{Name: "test", Namespace: "default"}}
    clientset.CoreV1().Pods("default").Create(context.TODO(), pod, metav1.CreateOptions{})
    
    // Start informer, capture events
    // Assert correct event emitted
}
```

#### Cache Access Tests
```go
func TestInformerManager_ListerQueries(t *testing.T) {
    // Test that lister returns cached data
    // Test namespace filtering
    // Test label selector support
}
```

**Target**: ≥70% coverage for `informer_manager.go`

### Frontend Unit Tests (frontend/src/)

#### Hook Tests
```typescript
// frontend/src/hooks/__tests__/useResourceWatch.test.ts
import { renderHook, waitFor } from '@testing-library/react';
import { useResourceWatch } from '../useResourceWatch';

test('handles add event', async () => {
  const { result } = renderHook(() => 
    useResourceWatch('k8s:pods:update', async () => [])
  );
  
  // Simulate add event
  emitMockEvent('k8s:pods:update', {
    action: 'add',
    data: { metadata: { uid: '123', name: 'test-pod' } },
  });
  
  await waitFor(() => {
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data[0].metadata.name).toBe('test-pod');
  });
});

test('handles update event', async () => {
  // Test update replaces existing item by UID
});

test('handles delete event', async () => {
  // Test delete removes item by UID
});

test('prevents duplicate adds', async () => {
  // Test adding same UID twice doesn't duplicate
});
```

#### Component Integration Tests
```typescript
// frontend/src/k8s/resources/pods/__tests__/PodsOverviewTable.test.tsx
test('updates table on watch event', async () => {
  render(<PodsOverviewTable namespaces={['default']} />);
  
  // Wait for initial fetch
  await waitFor(() => expect(screen.getByRole('table')).toBeInTheDocument());
  
  // Emit add event
  emitMockEvent('k8s:pods:update', {
    action: 'add',
    data: mockPod({ name: 'new-pod' }),
  });
  
  // Verify new row appears
  await waitFor(() => {
    expect(screen.getByText('new-pod')).toBeInTheDocument();
  });
});
```

**Target**: Test all resource table components for watch event handling

### E2E Tests (e2e/tests/)

#### Test Live Updates Without Refresh
```typescript
// e2e/tests/11-pods-live-update.spec.ts
import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';

test('pods table updates automatically on create', async ({ page, contextName, namespace }) => {
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  await sidebar.goToSection('pods');
  
  // Note initial pod count
  const initialRows = await page.locator('[data-testid="pods-table"] tbody tr').count();
  
  // Create pod via kubectl (not via UI)
  await execInTerminal(`kubectl run test-pod-${Date.now()} --image=nginx --namespace=${namespace}`);
  
  // Wait for table to update automatically (no manual refresh!)
  await expect(async () => {
    const newCount = await page.locator('[data-testid="pods-table"] tbody tr').count();
    expect(newCount).toBe(initialRows + 1);
  }).toPass({ timeout: 10000 });
});

test('pods table updates automatically on delete', async ({ page, contextName, namespace }) => {
  // Similar test for delete event
});
```

#### Test Reconnection Handling
```typescript
test('handles watch stream reconnection', async ({ page }) => {
  // Simulate network interruption (kill proxy, restart)
  // Verify "Reconnecting..." message appears
  // Verify table data recovers after reconnect
});
```

#### Update Existing Tests
- [ ] Review all resource CRUD tests in `e2e/tests/10-*.spec.ts` through `e2e/tests/50-*.spec.ts`
- [ ] Remove explicit refresh button clicks if test expects automatic updates
- [ ] Add timeout assertions for automatic updates (max 5s)

### Test Failure Documentation

If E2E tests fail during implementation:
1. Create `project/e2e/fixes/watch-migration-failures.md`
2. Document:
   - Which test failed
   - Error message and screenshot
   - Approaches tried to fix
   - What worked / what didn't
3. Update plan with lessons learned

### Performance Testing

#### Measure Traffic Reduction
```bash
# Before: Run app for 60s, measure API calls
kubectl proxy &
tcpdump -i lo -w /tmp/before.pcap port 8001
# Run app...
# Count API calls: grep LIST /tmp/before.pcap | wc -l

# After: Same measurement
# Compare: Should see ~90% reduction in LIST calls
```

#### Memory Usage
```bash
# Monitor Go heap during watch
go tool pprof -http=:8080 http://localhost:6060/debug/pprof/heap
# Verify cache size is bounded (not growing indefinitely)
```

## 7) Rollout and validation

### Feature Flag Strategy

#### Add Config Toggle
```go
// pkg/app/config.go
type Config struct {
    UseInformers bool `json:"use_informers"`
    InformerResources map[string]bool `json:"informer_resources"`
}

// Default: start with informers disabled
var defaultConfig = Config{
    UseInformers: false,
    InformerResources: map[string]bool{
        "namespaces": false,
        "pods": false,
        "deployments": false,
        // ...
    },
}
```

#### Runtime Toggle
- Add Settings UI panel: "Advanced → Use Real-Time Watch (Beta)"
- Enable/disable per resource type for testing
- Restart informer manager on toggle

### Phased Rollout Plan

#### Phase 1: Cluster-Scoped Resources (Low Risk)
1. **Namespaces** (week 1)
   - Enable informer for namespaces only
   - Test namespace switching, creation, deletion
   - Verify sidebar namespace list updates automatically
   - **Success criteria**: Zero API calls for namespace polling, E2E tests pass

2. **Nodes** (week 1)
   - Enable informer for nodes
   - Test node status updates appear in UI
   - **Success criteria**: Node table updates without refresh

#### Phase 2: Stable Namespaced Resources (Medium Risk)
3. **ConfigMaps & Secrets** (week 2)
   - Enable informers for configmaps and secrets
   - Test creation, update, deletion
   - Verify bottom panel detail updates
   - **Success criteria**: 90% reduction in configmap/secret LIST calls

4. **Services** (week 2)
   - Enable informer for services
   - Test service creation, endpoint updates
   - **Success criteria**: Service table live updates confirmed

#### Phase 3: Workload Resources (Higher Risk)
5. **Deployments & StatefulSets** (week 3)
   - Enable informers for deployments and statefulsets
   - Test scale operations, rolling updates
   - Verify status conditions update in real-time
   - **Success criteria**: Zero flicker on status updates

6. **Pods** (week 3)
   - Enable informer for pods
   - Most frequent updates, highest traffic reduction
   - Test pod lifecycle: Pending → Running → Terminated
   - Test log streaming with pod updates
   - **Success criteria**: Fast polling eliminated (was 1s), E2E tests pass

#### Phase 4: Batch & RBAC Resources (Final)
7. **Jobs, CronJobs, DaemonSets** (week 4)
   - Enable informers for batch workloads
   - Test job completion status updates

8. **RBAC Resources** (week 4)
   - Roles, ClusterRoles, RoleBindings, ClusterRoleBindings, ServiceAccounts
   - Lower update frequency, verify permission changes propagate

### Validation Metrics Per Phase

#### Traffic Comparison
```bash
# Before enabling informer
kubectl proxy &
kubectl api-resources --verbs=list -o name | xargs -I {} sh -c 'kubectl get {} --all-namespaces 2>&1 | wc -l' | awk '{s+=$1} END {print s}'
# Record: API calls per minute

# After enabling informer
# Repeat measurement
# Calculate reduction %
```

**Target**: ≥80% reduction in LIST API calls

#### UI Latency Comparison
- **Polling baseline**: 1s average (up to 60s for slow poll)
- **Informer target**: <500ms from API event to UI update
- **Measure**: Add timestamp logging in event handlers

#### Memory Usage
- **Baseline**: <100MB for backend process
- **With informers**: <200MB (cache overhead acceptable)
- **Monitor**: `ps aux | grep kube-dev-bench` during testing

### Legacy Polling Removal

#### Deprecation Timeline
1. **Week 5-6**: All informers enabled by default
2. **Week 7**: Feature flag changes from opt-in to opt-out
3. **Week 8**: Remove polling code entirely:
   - Delete `pkg/app/polling.go`
   - Remove `startResourcePolling` calls
   - Remove frontend `setInterval` polling loops
   - Update `counts.go` to read from informer cache

#### Confirmation Checklist
- [ ] All E2E tests pass with informers only
- [ ] Performance metrics meet targets
- [ ] No user-reported regressions for 2 weeks
- [ ] Memory usage stable over 48-hour test
- [ ] Reconnection handling tested in production-like environment

### Documentation Updates

#### Update README.md
```markdown
### Real-Time Data Updates

KubeDevBench uses Kubernetes watch streams for real-time updates:
- Resources update automatically (no manual refresh needed)
- Low network traffic (watch instead of polling)
- Handles reconnections transparently

If you experience issues:
- Check RBAC permissions for watched resources
- Verify network allows long-lived HTTP/2 connections
- See logs at ~/.KubeDevBench/informer.log
```

#### Add Architecture Doc
Create `docs/informer-architecture.md`:
- Diagram of informer → cache → lister → Wails RPC flow
- Event naming conventions
- Troubleshooting guide for watch failures
- Performance characteristics

#### Update CLAUDE.md (AI Agent Instructions)
Add informer context:
- Explain watch-based architecture
- Note that data comes from cache, not direct API calls
- Mention event subscription pattern in frontend

# Deliverables

## Code Deliverables
- [ ] **`pkg/app/informer_manager.go`** - Core informer management (500-800 LOC)
- [ ] **`pkg/app/informer_manager_test.go`** - Unit tests (\u226570% coverage)
- [ ] **`frontend/src/hooks/useResourceWatch.ts`** - Reusable watch hook (100-150 LOC)
- [ ] **`frontend/src/hooks/__tests__/useResourceWatch.test.ts`** - Hook tests
- [ ] **Updated resource table components** (~15 files):
  - Remove `setInterval` polling loops
  - Add `useResourceWatch` hook usage
  - Preserve stable DOM selectors
- [ ] **Updated backend RPCs** - Replace direct API calls with lister queries
- [ ] **Updated `counts.go`** - Read from informer cache instead of polling
- [ ] **E2E tests** - Add/update tests for live updates (`e2e/tests/*-live-update.spec.ts`)

## Documentation Deliverables
- [ ] **`docs/informer-architecture.md`** - Architecture overview and diagrams
  - Informer lifecycle (diagram)
  - Event flow: API \u2192 Informer \u2192 Cache \u2192 Wails Event \u2192 Frontend
  - Troubleshooting guide
  - Performance characteristics
- [ ] **README.md updates** - User-facing documentation
  - \"Real-Time Updates\" section
  - RBAC requirements for watch permissions
  - Troubleshooting connection issues
- [ ] **CLAUDE.md updates** - AI agent context
  - Explain watch/informer architecture
  - Note cache-based data access patterns
  - Event subscription patterns
- [ ] **`project/e2e/fixes/watch-migration-*.md`** - E2E test fixes (if needed)

## Test Coverage Deliverables
- [ ] Backend unit tests: \u226570% coverage for informer manager
- [ ] Frontend unit tests: All watch hooks and event handlers covered
- [ ] E2E tests: Live update scenarios for all resource types
- [ ] Performance test results: Traffic reduction metrics

## Configuration Deliverables
- [ ] Feature flag in settings UI
- [ ] Per-resource toggle capability
- [ ] Default config (informers disabled initially for safe rollout)
- [ ] Migration plan checklist

# Risks and Mitigations

## Technical Risks

### \ud83d\udd34 HIGH: Watch Stream Instability
**Risk**: Network issues, API server restarts, or long-running connection limits cause watch streams to drop.

**Impact**: Users see stale data, UI stops updating.

**Mitigation**:
- Implement exponential backoff reconnection (5s \u2192 60s max)
- Emit clear UI notifications: \"Reconnecting...\" with countdown
- Always relist after reconnect to catch missed events
- Add connection health indicator in UI header
- Log all watch errors to `~/.KubeDevBench/informer.log` for debugging

**Implementation**: See section 5 \"Error handling and reconnects\"

### \ud83d\udfe1 MEDIUM: Cache Staleness
**Risk**: Informer resync period (10min) means temporary staleness is possible if events are missed.

**Impact**: UI may show outdated data for up to 10 minutes.

**Mitigation**:
- Keep 10min resync period (standard practice)
- Provide manual refresh button as fallback
- Log resync operations for monitoring
- Consider shorter resync (5min) for critical resources like pods

**Monitoring**: Add metrics for resync frequency and cache hit rates

### \ud83d\udfe1 MEDIUM: UI Flicker on Updates
**Risk**: Rapid update events (e.g., pod status changes) cause table rows to flicker or selection to break.

**Impact**: Poor user experience, difficulty selecting/inspecting resources.

**Mitigation**:
- Use stable UID-based keys for table rows (not index)
- Implement selection persistence by UID (not row index)
- Debounce rapid updates (100ms window)
- Only re-render changed rows, not entire table
- Test specifically with high-churn resources (pods, jobs)

**Implementation**: See section 4 \"UI Stability Guarantees\"

### \ud83d\udfe1 MEDIUM: Increased Backend Complexity
**Risk**: Informer manager adds significant code complexity vs simple polling loops.

**Impact**: Higher maintenance burden, more potential bugs, steeper learning curve for contributors.

**Mitigation**:
- Centralize all informer logic in `informer_manager.go` (single responsibility)
- Comprehensive unit tests (\u226570% coverage)
- Clear architectural documentation with diagrams
- Use client-go's established patterns (don't reinvent)
- Code review with senior Go developers

**Technical debt**: Budget time for refactoring if initial approach proves unwieldy

### \ud83d\udfe0 LOW: Memory Growth from Caching
**Risk**: Informer caches grow unbounded in large clusters.

**Impact**: Application memory usage spikes, potential OOM crashes.

**Mitigation**:
- Scope watches to selected namespaces only (not cluster-wide)
- Monitor memory in long-running tests (48hr stability test)
- Set memory limits in production deployment
- Consider cache size limits if needed (unlikely for typical use case)

**Acceptable**: 200MB total for informer caches in large clusters (acceptable tradeoff)

## Operational Risks

### \ud83d\udd34 HIGH: RBAC Permission Issues
**Risk**: Users' kubeconfig lacks watch/list permissions for some resource types.

**Impact**: Informers fail to start, no data shown, confusing error messages.

**Mitigation**:
- Gracefully handle 403 Forbidden errors per resource type
- Show clear UI message: \"Insufficient permissions to watch pods. Check RBAC.\"
- Hide unavailable resource sections in sidebar
- Provide documentation on required RBAC permissions
- Emit `k8s:rbac:forbidden` events with resource details

**Implementation**: See section 5 \"RBAC Permission Errors\"

### \ud83d\udfe1 MEDIUM: Backwards Compatibility
**Risk**: Users with old kubeconfig or API server versions may not support watch.

**Impact**: Application breaks for legacy cluster users.

**Mitigation**:
- Keep feature flag to disable informers and fall back to polling
- Test against multiple Kubernetes versions (1.24-1.31)
- Document minimum supported K8s version (1.20+)
- Detect watch support at runtime, fall back automatically if unsupported

### \ud83d\udfe0 LOW: Migration Coordination
**Risk**: Backend and frontend changes must deploy together, or event formats mismatch.

**Impact**: Application breaks if only half the changes are deployed.

**Mitigation**:
- This is a desktop app, not a distributed service (no coordination needed)
- Wails builds backend + frontend as single binary
- Feature flag ensures gradual opt-in, not forced migration

## Rollout Risks

### \ud83d\udfe1 MEDIUM: E2E Test Failures
**Risk**: E2E tests fail after removing polling, blocking release.

**Impact**: Extended development timeline, rollback required.

**Mitigation**:
- Update E2E tests incrementally per resource type
- Document all test failures in `project/e2e/fixes/`
- Keep polling code until all E2E tests pass with informers
- Phased rollout: test each resource type in isolation
- Budget 2-3 weeks for E2E test stabilization

### \ud83d\udfe0 LOW: User Confusion About \"Live Updates\"
**Risk**: Users don't understand that data updates automatically, try to refresh manually.

**Impact**: Minor UX confusion, no functional issue.

**Mitigation**:
- Keep manual refresh button visible (familiarity)
- Show subtle indicator for live updates (e.g., pulsing dot when event received)
- Add tooltip: \"Data updates automatically in real-time\"
- Update README with clear explanation

# Success Criteria

Migration is considered successful when:

\u2705 **Performance**:
- \u226580% reduction in Kubernetes API LIST calls
- <500ms latency from API event to UI update
- <200MB memory usage for informer caches

\u2705 **Stability**:
- All E2E tests pass with informers enabled
- Zero user-reported data staleness issues for 2 weeks
- Reconnection handling works in chaos testing (network interruptions)

\u2705 **User Experience**:
- No UI flicker or selection state loss
- Clear error messages for RBAC/connection issues
- Manual refresh button still works (user confidence)

\u2705 **Code Quality**:
- \u226570% test coverage for new code
- Comprehensive documentation (architecture + troubleshooting)
- Clean separation between informer and application logic

\u2705 **Rollout**:
- Phased deployment complete (8 weeks)
- Legacy polling code removed
- No blocking bugs in production use

# Timeline Estimate

- **Week 1-2**: Backend infrastructure (informer manager, tests)
- **Week 3-4**: Frontend integration (hook, component updates)
- **Week 5**: E2E test updates and stabilization
- **Week 6-13**: Phased rollout (8 phases, \u00b11 week each)
- **Week 14**: Legacy polling removal, documentation finalization

**Total**: ~3.5 months for complete migration

# Next Steps

1. \u2705 Review and approve this plan
2. \u25a2 Create feature branch: `feature/watch-informers`
3. \u25a2 Implement Phase 1 (Core Infrastructure)
4. \u25a2 Write backend unit tests
5. \u25a2 Implement Phase 2 (Frontend Hook)
6. \u25a2 Begin phased rollout starting with Namespaces

**Assigned to**: [Team member TBD]
**Due date**: [TBD based on capacity]
