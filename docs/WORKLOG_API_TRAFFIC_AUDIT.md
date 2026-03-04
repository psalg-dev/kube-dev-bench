# API Traffic Audit – Excessive Kubernetes API Calls

**Date**: 2026-03-05  
**Issue**: 100mbit+ network traffic when selecting 3 namespaces with many workloads

---

## Executive Summary

The high network traffic is caused by **multiple overlapping polling loops** that each independently List resources from the Kubernetes API **every 1 second** across all selected namespaces, combined with a **counts aggregator** that also Lists all resource types every **1-4 seconds**. When `useInformers=false` (the default), 3 namespaces with many workloads triggers **~50+ full API List calls per second**.

---

## Findings

### 1. CRITICAL: Polling Mode is Default (`useInformers=false`)

**File**: `pkg/app/config.go:18`  
The informer-based mode is **opt-in and disabled by default**:
```go
UseInformers bool `json:"useInformers"`
```

When disabled, the app falls back to aggressive ticker-based polling.

### 2. CRITICAL: 11+ Resource Polling Goroutines at 1-second Intervals

**File**: `pkg/app/polling.go:23-66`  
`StartAllPolling()` launches **11 separate goroutines**, each doing a full API List every **1 second** (default interval):

| Goroutine | Resource | Interval | API Call per Namespace |
|-----------|----------|----------|----------------------|
| 1 | Pods | 1s | `CoreV1().Pods(ns).List()` |
| 2 | Deployments | 1s | `AppsV1().Deployments(ns).List()` |
| 3 | CronJobs | 1s | `BatchV1().CronJobs(ns).List()` |
| 4 | DaemonSets | 1s | `AppsV1().DaemonSets(ns).List()` |
| 5 | StatefulSets | 1s | `AppsV1().StatefulSets(ns).List()` |
| 6 | ReplicaSets | 1s | `AppsV1().ReplicaSets(ns).List()` |
| 7 | HelmReleases | 1s | (Helm SDK) |
| 8 | Roles | 1s | `RbacV1().Roles(ns).List()` |
| 9 | RoleBindings | 1s | `RbacV1().RoleBindings(ns).List()` |
| 10 | ClusterRoles | 1s | `RbacV1().ClusterRoles().List()` |
| 11 | ClusterRoleBindings | 1s | `RbacV1().ClusterRoleBindings().List()` |

Each goroutine iterates all selected namespaces. With 3 namespaces:
- **9 namespaced resources × 3 namespaces = 27 List calls/second**
- **2 cluster-scoped resources = 2 List calls/second**
- **Total from polling alone: ~29 List calls/second**

### 3. CRITICAL: Counts Aggregator Makes Redundant Full List Calls

**File**: `pkg/app/counts.go:9-35`  
A separate aggregator runs **two tickers**:
- `fullTicker` every **4 seconds** → calls `refreshResourceCounts()`
- `podsTicker` every **1 second** → calls `refreshPodStatusOnly()`

**File**: `pkg/app/counts.go:109-163`  
`refreshResourceCounts()` calls `aggregateResourceCounts()` which Lists **15 resource types** per namespace:
```go
func (a *App) aggregateResourceCounts(ns string, agg *ResourceCounts) {
    a.aggregatePodCounts(ns, agg)        // List Pods
    a.GetDeployments(ns)                  // List Deployments
    a.GetServices(ns)                     // List Services
    a.GetJobs(ns)                         // List Jobs  
    a.GetCronJobs(ns)                     // List CronJobs
    a.GetDaemonSets(ns)                   // List DaemonSets
    a.GetStatefulSets(ns)                 // List StatefulSets
    a.GetReplicaSets(ns)                  // List ReplicaSets
    a.GetConfigMaps(ns)                   // List ConfigMaps
    a.GetSecrets(ns)                      // List Secrets
    a.GetIngresses(ns)                    // List Ingresses
    a.GetPersistentVolumeClaims(ns)       // List PVCs
    a.GetHelmReleases(ns)                 // Helm list
    a.GetRoles(ns)                        // List Roles
    a.GetRoleBindings(ns)                 // List RoleBindings
}
```

Plus `aggregateClusterWideCounts()` Lists PVs, ClusterRoles, ClusterRoleBindings.

**Every 4 seconds with 3 namespaces**: 15 × 3 + 3 = **48 List calls**  
**Every 1 second**: `GetPodStatusCounts()` does a full Pod List per namespace = **3 List calls/second**

### 4. CRITICAL: Monitor Polling Makes Raw API Calls (No Informer Cache)

**File**: `pkg/app/monitor.go:28-50`  
`StartMonitorPolling()` runs every **5 seconds** and for each namespace:
1. `checkPodIssues(ns)` — **creates a NEW Kubernetes client** (`createKubernetesClient()`) and does `Pods(ns).List()`
2. `checkEventIssues(ns)` — **creates ANOTHER new client** and calls BOTH:
   - `CoreV1().Events(ns).List()`
   - `EventsV1().Events(ns).List()`

With 3 namespaces every 5 seconds:
- 3 Pod Lists + 6 Event Lists = **9 additional List calls every 5 seconds**
- Plus **6 new clientset constructions** (TCP connection overhead)

### 5. HIGH: No QPS/Burst Rate Limiting on REST Config

**File**: `pkg/app/kube_rest.go`  
The `getRESTConfig()` function does **not set** `QPS` or `Burst` on the rest.Config. Default client-go values are QPS=5, Burst=10, but each new client gets its own rate limiter, and multiple clients are created.

### 6. HIGH: Informer Snapshot Emitters Call Get* Functions (Double-Fetch)

**File**: `pkg/app/informer_manager.go:275-340`  
Even when informers ARE enabled, snapshot emissions call the same Get* functions:
```go
func (im *InformerManager) emitPodsSnapshot() error {
    return emitAcrossNamespaces(im, EventPodsUpdate, im.app.GetRunningPods)
}
```

These Get* functions **first check the informer cache** (which succeeds), but this is still an unnecessary extra pattern — they read from the informer's Lister, not the API. However, the `requestCountsRefresh()` triggered on every snapshot emission **does make additional API calls** for uncached resource types (Services, Ingresses, ConfigMaps, Secrets, etc.) that aren't in the polling loops.

### 7. MODERATE: `checkPodIssues` and `checkEventIssues` Create New Clients

**File**: `pkg/app/monitor.go:225-245, 314-334`  
Both functions call `a.createKubernetesClient()` which calls `a.getKubernetesClient()` → builds a fresh clientset from kubeconfig every time. This means new TLS handshakes and connection pooling overhead on every call.

### 8. Frontend Polling (Lower Impact)

| File | Interval | What it does |
|------|----------|-------------|
| `ResourcePodsTab.tsx` | 5s | Calls GetDeploymentDetail/GetStatefulSetDetail etc. for bottom panel |
| `PodOverviewTable.tsx` | 1s (timer) | Only updates `Date.now()` for age display (no API call) |
| `MCPContext.tsx` | 10s | Polls MCP status |
| `SwarmEventsTab.tsx` | 30s | Docker Swarm events (not K8s) |
| `StackServicesTab.tsx` | 5s | Docker Swarm stack services |
| `SwarmStacksOverviewTable.tsx` | 5s | Docker Swarm stack health |
| `SwarmResourceCountsContext.tsx` | variable | Docker Swarm counts |

The frontend `useResourceWatch` hook is **well-designed** — it subscribes to Wails events and only does an initial fetch, no polling. But the backend is pushing events to it via the polling goroutines.

---

## Total API Call Rate (Polling Mode, 3 Namespaces)

| Source | Calls/second | Note |
|--------|-------------|------|
| 9 polling goroutines × 3 ns | 27/s | Every 1s |
| 2 cluster RBAC goroutines | 2/s | Every 1s |
| Pod status counts ticker | 3/s | Every 1s |
| Full resource counts | ~12/s avg | 48 calls every 4s |
| Monitor polling | ~1.8/s avg | 9 calls every 5s |
| **TOTAL** | **~46 List calls/second** | |

Each List call returns the full resource list. With many workloads, Secrets (which include data), ConfigMaps, and Events can be substantial payloads.

---

## Root Causes of 100mbit+ Traffic

1. **Secrets.List** returns full Secret data (base64-encoded) — can be enormous with TLS certs, registry credentials, etc.
2. **Events.List** with no field selector returns ALL events in the namespace
3. **ConfigMaps.List** returns full ConfigMap data
4. **~46 List API calls/second** with 3 populated namespaces
5. **No response caching** or ETag-based conditional fetching
6. **No pagination** on List calls (all use `metav1.ListOptions{}`)
7. **Counts aggregator redundantly re-fetches** the same resources the polling goroutines already fetched

---

## Recommendations

### Implemented (2026-03-05)

- [x] **Enable informers by default** (`useInformers=true`) — changed in `app_lifecycle.go`
- [x] **Cache kubernetes clientset** — `getKubernetesClient()` now caches and reuses the client; invalidated on context/proxy/TLS changes
- [x] **Set QPS/Burst** on REST config (QPS=50, Burst=100) to prevent thundering herd
- [x] **Increase polling intervals** from 1s to 5s for all resource polling, RBAC cluster polling; counts 4s→10s full, 1s→5s pods
- [x] **Monitor uses shared client** — `checkPodIssues`/`checkEventIssues` now use `getClient()` instead of `createKubernetesClient()`
- [x] **Add field selectors** for events (`type=Warning`) with client-side safety net
- [x] **Client cache invalidation** on `SetCurrentKubeContext`, `ConnectInsecure`, `SetProxyConfig`

### Remaining

- [ ] **When informers are enabled, ensure counts aggregator reads from informer Listers** instead of making API calls.
- [ ] **Remove duplicate data paths**: counts aggregator should read from the same data the polling goroutines already fetched, not re-List.
- [ ] **Exclude Secret data** from list calls where only counts are needed (use `metav1.ListOptions{Limit: 0}` or metadata-only lists).
- [ ] **Reuse a single shared clientset** instead of creating new clients in monitor functions.
- [ ] **Frontend ResourcePodsTab** could subscribe to Wails events instead of 5s polling.
- [ ] Users with existing `config.json` containing `"useInformers": false` will continue using polling — consider a migration notification

---

## Key Files Reference

| File | Role |
|------|------|
| `pkg/app/polling.go` | Generic polling framework, StartAllPolling |
| `pkg/app/rbac_polling.go` | RBAC-specific polling loops |
| `pkg/app/counts.go` | Counts aggregator (1s + 4s tickers) |
| `pkg/app/monitor.go` | Monitor polling (5s, raw API calls) |
| `pkg/app/informer_manager.go` | Informer lifecycle, snapshot emission |
| `pkg/app/config.go` | `useInformers` flag |
| `pkg/app/wails_events.go` | `getPollingNamespaces()` |
| `pkg/app/app_lifecycle.go` | Startup/Shutdown orchestration |
| `pkg/app/kube_rest.go` | REST config (missing QPS/Burst) |
| `pkg/app/client.go` | `getClient()` helper |
| `frontend/src/hooks/useResourceWatch.ts` | Event-driven hook (good pattern) |
| `frontend/src/components/ResourcePodsTab.tsx` | 5s polling for pod details |
| `frontend/src/state/SettingsContext.tsx` | Polling interval settings |
| `docs/informer-architecture.md` | Informer design docs |
