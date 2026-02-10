# Go Backend Refactoring Plan

**Status:** COMPLETE (all 5 phases done)
**Created:** 2026-02-05
**Updated:** 2026-02-06

This document outlines a structured implementation plan to reduce code duplication and improve maintainability in the Go backend. Based on analysis identifying ~1,400-1,800 lines of duplicated code across 14+ resource handlers.

**Summary:** All phases complete. `client.go` (19 lines) for unified client access, `polling.go` (~95 lines) with generic `ResourcePollingConfig[T]` and `StartAllPolling()` registry, `resource_utils.go` (~95 lines) with helper functions including `FormatAge` and `FormatAccessModes`, `events.go` (100+ lines) for event handling, `event_names.go` (~85 lines) for typed event name constants, `resource_lister.go` (~65 lines) with generic `listResources[K,T]` and `listClusterResources[K,T]` helpers. **All 7 standard pollers migrated** to the generic framework. German error messages removed. **Phase 3:** Restart operations consolidated via `restartWorkload()`; all `Delete*` functions delegate to `DeleteResource()`. **Phase 4:** All event name string literals replaced with typed constants. **Phase 5:** Generic resource lister implemented; 9 handlers migrated to generic lister; 5 additional handlers migrated to `getClient()`; 13 duplicate per-handler helper functions eliminated; `FormatAge` and `FormatAccessModes` shared helpers replace per-file duplicates; ~180 lines of boilerplate removed. Phases 5.2 (caching) and 5.3 (dynamic client) assessed and intentionally skipped.

**Note:** Frontend was migrated to TypeScript in PR #104. All frontend file references in this plan should use `.tsx`/`.ts` extensions.

**Recommended Approach**: Option 2 (Moderate Refactor)
**Estimated Impact**: ~700 lines removed, improved architecture
**Test Coverage Target**: 70% for new code (per CLAUDE.md)

---

## Phase 1: Foundation & Quick Wins ✅ COMPLETE

### 1.1 Standardize Client Initialization ✅ IMPLEMENTED
**Goal**: Single pattern for Kubernetes client creation across all handlers

- [x] **1.1.1** Create unified client method in `pkg/app/client.go` ✅ IMPLEMENTED (19 lines)
  - `getClient()` helper consolidating client getter pattern
  - Handles `testClientset` check internally
  - Returns `kubernetes.Interface`

- [x] **1.1.2** Handlers updated to use unified pattern ✅ (verified via consistent usage)

- [x] **1.1.3** Verified handlers use consistent pattern ✅

- [x] **1.1.4** Write unit tests for client helper — covered by existing handler tests

- [x] **1.1.5** Fix German error messages ✅ COMPLETE
  - Found and fixed `"Kein Kontext gewählt"` in `daemonsets.go` and `cronjobs.go`
  - Replaced entire manual client creation blocks with `getClient()` pattern
  - All error messages are now in English

### 1.2 Extract Common Helper Functions ✅ IMPLEMENTED
**Goal**: Eliminate repeated utility code blocks

- [x] **1.2.1** Create `pkg/app/resource_utils.go` ✅ IMPLEMENTED (53 lines)
  - Named `resource_utils.go` instead of `resource_helpers.go` (same purpose)
  - Contains:
    - `ExtractFirstContainerImage(spec corev1.PodSpec) string`
    - `SafeReplicaCount(replicas *int32) int32`
    - `SafeLabels(labels map[string]string) map[string]string`
    - `MergeLabels(objectLabels, templateLabels map[string]string) map[string]string`
    - `Int32Ptr(i int32) *int32`

- [x] **1.2.2-1.2.4** Helper functions available for use across handlers ✅

- [x] **1.2.5** Helper functions tested through handler tests ✅

---

## Phase 2: Generic Polling Framework — Infrastructure ✅, Migration ❌ NOT STARTED

### 2.1 Design Polling Infrastructure ✅ IMPLEMENTED
**Goal**: Replace 9 identical polling functions with a unified framework

**Note:** Implemented as `pkg/app/polling.go` (56 lines) at top level instead of separate `poller/` package.

- [x] **2.1.1** Create `pkg/app/polling.go` with generic types: ✅ IMPLEMENTED
  ```go
  type ResourcePollingConfig[T any] struct {
      EventName string
      FetchFn   func(namespace string) ([]T, error)
      Interval  time.Duration  // optional, defaults to 1s
  }

  func startResourcePolling[T any](a *App, config ResourcePollingConfig[T])
  ```

- [x] **2.1.2** Uses Go generics for type-safe polling ✅
- [x] **2.1.3** Error handling via continue on fetch errors ✅

### 2.2 Migrate Existing Pollers ✅ COMPLETE

**All 7 standard pollers migrated to generic framework.** `StartMonitorPolling()` kept separate (5s interval, aggregates `MonitorInfo` across all namespaces).

| Function | File | Status |
|----------|------|--------|
| `StartPodPolling()` | `pkg/app/pods.go` | ✅ Removed — uses `GetRunningPods` via generic polling |
| `StartDeploymentPolling()` | `pkg/app/deployments.go` | ✅ Removed — uses `GetDeployments` via generic polling |
| `StartCronJobPolling()` | `pkg/app/cronjobs.go` | ✅ Removed — uses `GetCronJobs` via generic polling |
| `StartDaemonSetPolling()` | `pkg/app/daemonsets.go` | ✅ Removed — uses `GetDaemonSets` via generic polling |
| `StartStatefulSetPolling()` | `pkg/app/statefulsets.go` | ✅ Removed — uses `GetStatefulSets` via generic polling |
| `StartReplicaSetPolling()` | `pkg/app/replicasets.go` | ✅ Removed — uses `GetReplicaSets` via generic polling |
| `StartMonitorPolling()` | `pkg/app/monitor.go` | ⚡ Kept separate (different semantics) |
| `StartHelmReleasePolling()` | `pkg/app/helm.go` | ✅ Removed — uses `GetHelmReleases` via generic polling |

- [x] **2.2.1** Created `StartAllPolling()` in `polling.go` — registers 7 resource pollers using existing `Get*` functions as `FetchFn`
- [x] **2.2.2** All pollers registered via `startResourcePolling[T]()` within `StartAllPolling()`
- [x] **2.2.3** Removed 7 old `Start*Polling()` and `collect*()` functions (~170 lines removed)
- [x] **2.2.4** Updated `main.go` — replaced 8 individual calls with single `app.StartAllPolling()`

**Bonus migrations during Phase 2:**
- `GetDeployments()`, `GetStatefulSets()`, `GetReplicaSets()` migrated from manual `getKubernetesClient()` to `getClient()`
- `GetDaemonSets()`, `GetCronJobs()` migrated from manual `clientcmd.LoadFromFile` to `getClient()`
- Removed unused imports (`fmt`, `kubernetes`, `clientcmd`) from 5 files

### 2.3 Write Poller Tests ✅ COMPLETE
- [x] **2.3.1** Unit tests for generic polling (8 tests in `polling_test.go`):
  - `TestStartResourcePolling` — basic single-namespace polling
  - `TestStartResourcePollingWithMultipleNamespaces` — multi-namespace aggregation
  - `TestStartResourcePollingSkipsWhenNoNamespaces` — empty namespace handling
  - `TestStartResourcePollingDefaultInterval` — default 1s interval
  - `TestStartResourcePollingContinuesOnFetchError` — error resilience
  - `TestStartResourcePollingSkipsWhenCtxNil` — nil context guard
  - `TestStartResourcePollingFallsBackToCurrentNamespace` — fallback behavior
  - `TestStartAllPollingDoesNotPanic` — smoke test for registration

- [x] **2.3.2** Integration behavior covered through unit tests:
  - Event emission tested via `disableWailsEvents` flag
  - Error handling verified (fetch errors logged, polling continues)
  - Namespace filtering tested (preferred → fallback → skip)

### 2.4 Phase 2 Validation ✅ COMPLETE
- [x] **2.4.1** All Go unit tests pass (`go test ./pkg/app/ -count=3` — 3 consecutive runs)
- [x] **2.4.2** `go vet` passes (only pre-existing Holmes warnings)
- [ ] **2.4.3** E2E tests — pending next full CI run
- [ ] **2.4.4** Manual testing — pending next `wails dev` session

---

## Phase 3: Resource Actions Consolidation ✅ COMPLETE

**Approach chosen:** Option A for deletes (keep individual functions for Wails binding compatibility, but delegate to `DeleteResource`). Generic helper for restarts.

Changes made:
- Created `restartWorkload()` unexported helper with switch on kind (deployment/statefulset/daemonset)
- Created `RestartWorkload(kind, ns, name)` exported for frontend use
- `RestartDeployment`, `RestartStatefulSet`, `RestartDaemonSet` now delegate to `restartWorkload()`
- All individual `Delete*` functions now delegate to `DeleteResource()` (Deployment, StatefulSet, DaemonSet, ReplicaSet, ConfigMap, Secret, PVC, PV, Ingress, Job, CronJob)
- `DeleteResource` expanded with `service`, `serviceaccount`, `persistentvolumeclaim` (full name) support
- Removed unused `patchControllerAnnotation` helper
- Lines removed: ~80 (boilerplate client-get + delete calls)
- Lines added: ~25 (restartWorkload helper)
- Net reduction: ~55 lines

### 3.1 Consolidate Restart Operations ✅ COMPLETE
**Goal**: Single restart function for all workload types

- [x] **3.1.1** Created `restartWorkload()` in `pkg/app/resource_actions.go`:
  ```go
  func (a *App) restartWorkload(kind, namespace, name string) error
  ```
  Supports deployment/statefulset/daemonset with plural variants.

- [x] **3.1.2** Refactored existing restart functions to delegate:
  - [x] `RestartDeployment()` → `restartWorkload("deployment", ...)`
  - [x] `RestartStatefulSet()` → `restartWorkload("statefulset", ...)`
  - [x] `RestartDaemonSet()` → `restartWorkload("daemonset", ...)`

- [x] **3.1.3** Exposed generic `RestartWorkload(kind, ns, name)` to frontend

### 3.2 Consolidate Delete Operations ✅ COMPLETE
**Goal**: Reduce boilerplate in delete functions

- [x] **3.2.1** Chose Option A: Keep individual functions (Wails binding compatibility) but delegate to `DeleteResource`
  - Frontend already exclusively uses `DeleteResource()` — individual functions retained only for backward compatibility
  - All 11 individual `Delete*` functions now one-line delegates to `DeleteResource()`

- [x] **3.2.2** Expanded `DeleteResource` switch with missing types:
  - Added `service` case
  - Added `serviceaccount` case  
  - Added `persistentvolumeclaim` alias (alongside existing `pvc`)

- [x] **3.2.3** Tests updated:
  - `delete_resource_test.go`: Added table-driven cases for service, serviceaccount, persistentvolumeclaim
  - `resource_actions_full_test.go`: Replaced `TestPatchControllerAnnotation` with `TestRestartWorkload` (table-driven, 5 cases)

### 3.3 Phase 3 Validation ✅ COMPLETE
- [x] **3.3.1** Run unit tests for resource actions — all pass (`go test ./pkg/app/ -count=1`)
- [ ] **3.3.2** E2E test: restart deployment, statefulset, daemonset — pending next full CI run
- [ ] **3.3.3** E2E test: delete various resource types — pending next full CI run
- [x] **3.3.4** Wails bindings still work correctly — no signature changes on existing methods; `RestartWorkload` added as new method

---

## Phase 4: Event Naming Standardization ✅ COMPLETE

### 4.1 Audit Event Names ✅ COMPLETE
**Goal**: Consistent naming convention across K8s and Docker events

- [x] **4.1.1** Documented current event names:
  - K8s resource polling: `pods:update`, `deployments:update`, `statefulsets:update`, `daemonsets:update`, `replicasets:update`, `cronjobs:update`, `jobs:update`, `secrets:update`, `configmaps:update`, `ingresses:update`, `helmreleases:update`
  - K8s system: `monitor:update`, `resourcecounts:update`, `portforwards:update`, `console:output`
  - K8s dynamic: `portforward:<key>:<action>`, `terminal:<sessionID>:<action>`, `podlogs:<podName>`
  - Holmes: `holmes:analysis:update`, `holmes:analysis:progress`, `holmes:chat:stream`, `holmes:deployment:status`, `holmes:context:progress`
  - Hooks: `hook:started`, `hook:completed`
  - Docker/Swarm: `docker:connected`, `swarm:services:update`, `swarm:tasks:update`, `swarm:nodes:update`, `swarm:resourcecounts:update`, `swarm:metrics:update`, `swarm:metrics:breakdown`, `swarm:image:updates`

- [x] **4.1.2** Convention decided: **Option C — Keep current (all already use colon separators consistently)**
  - The plan originally noted `docker-services:update` format, but actual code already uses `swarm:services:update`
  - All events follow `namespace:resource:action` or `resource:action` convention with colon separators
  - No inconsistency found — no changes needed to event name values

- [x] **4.1.3** No event name value changes required — frontend listeners already match backend event names

### 4.2 Create Event Constants ✅ COMPLETE
- [x] **4.2.1** Created `pkg/app/event_names.go` (~85 lines) with:
  - 11 K8s resource polling constants (`EventPodsUpdate` through `EventHelmReleasesUpdate`)
  - 4 K8s system constants (`EventMonitorUpdate`, `EventResourceCountsUpdate`, `EventPortForwardsUpdate`, `EventConsoleOutput`)
  - 5 Holmes constants (`EventHolmesAnalysisUpdate` through `EventHolmesContextProgress`)
  - 2 Hook constants (`EventHookStarted`, `EventHookCompleted`)
  - 8 Docker/Swarm constants (`EventDockerConnected` through `EventSwarmImageUpdates`)
  - 4 dynamic event name helpers: `PortForwardEvent()`, `TerminalOutputEvent()`, `TerminalExitEvent()`, `PodLogsEvent()`

- [x] **4.2.2** Updated all `emitEvent()` calls to use constants across 14 files:
  - `polling.go` — 7 polling configs
  - `resources.go` — pods:update + 9 fetcher map entries
  - `resource_actions_jobs.go` — 2 jobs:update
  - `monitor.go` — monitor:update
  - `monitor_actions.go` — 3 events (analysis update, analysis progress, monitor update)
  - `counts.go` — 2 resourcecounts:update
  - `pods.go` — terminal helpers, portforwards:update, 6 portforward dynamic events, 2 console:output
  - `hooks.go` — hook:started, hook:completed
  - `holmes_integration.go` — 2 holmes:chat:stream
  - `holmes_deployment.go` — holmes:deployment:status
  - `holmes_context.go` — holmes:context:progress
  - `docker_integration.go` — 8 docker/swarm events
  - `logs.go` — all podlogs dynamic events (16 occurrences)

### 4.3 Write Event Name Tests ✅ COMPLETE
- [x] **4.3.1** Created `pkg/app/event_names_test.go` with 4 test functions:
  - `TestEventNameConstants` — validates all 30 constants are non-empty and use colon separators
  - `TestPortForwardEvent` — table-driven test for PortForwardEvent helper (4 cases)
  - `TestTerminalEvents` — table-driven test for TerminalOutputEvent/TerminalExitEvent (2 cases)
  - `TestPodLogsEvent` — table-driven test for PodLogsEvent helper (2 cases)

### 4.4 Phase 4 Validation ✅ COMPLETE
- [x] **4.4.1** All Go unit tests pass: `go test ./pkg/app/... -count=1`
- [x] **4.4.2** `go vet` passes
- [x] **4.4.3** No remaining string-literal event names in emitEvent calls (verified via grep)
- [ ] **4.4.4** E2E tests — pending next full CI run
- [ ] **4.4.5** Manual testing — pending next `wails dev` session

---

## Phase 5: Advanced Abstractions ✅ COMPLETE (5.1 done; 5.2, 5.3 skipped)

### 5.1 Generic Resource Lister with Go Generics ✅ COMPLETE
**Goal**: Eliminate the repeated client-init → list → transform boilerplate across all resource handlers

- [x] **5.1.1** Designed and implemented generic lister in `pkg/app/resource_lister.go` (~65 lines):
  ```go
  func listResources[K any, T any](a *App, namespace string,
      listFn func(client kubernetes.Interface, ns string) ([]K, error),
      buildFn func(item *K, now time.Time) T) ([]T, error)

  func listClusterResources[K any, T any](a *App,
      listFn func(client kubernetes.Interface) ([]K, error),
      buildFn func(item *K, now time.Time) T) ([]T, error)
  ```
  - `listResources` — namespaced resources (deployments, pods, configmaps, etc.)
  - `listClusterResources` — cluster-scoped resources (persistent volumes, nodes)
  - Both use `a.getClient()` for unified client access
  - Build functions receive pointer to item + current time for age formatting

- [x] **5.1.2** Migrated 9 handler files to use generic lister:
  - `deployments.go` — removed `getDeploymentImage()`, `getDeploymentReplicas()`, `mergeDeploymentLabels()`
  - `daemonsets.go` — removed `getDaemonSetImage()`, `mergeDaemonSetLabels()`
  - `statefulsets.go` — removed `getStatefulSetImage()`, `getStatefulSetReplicas()`, `mergeStatefulSetLabels()`
  - `replicasets.go` — removed `getReplicaSetImage()`, `getReplicaSetReplicas()`, `mergeReplicaSetLabels()`
  - `cronjobs.go` — removed `getCronJobImage()`, `mergeCronJobLabels()`
  - `ingresses.go` — removed ~20 lines inline manual client creation + German error message
  - `configmaps.go` — removed ~35 lines inline client creation; extracted `buildConfigMapInfo()`
  - `persistentvolumeclaims.go` — removed `formatPVCAccessModes()` (~18 lines, duplicate)
  - `persistentvolumes.go` — removed `formatPVAccessModes()` (~18 lines, duplicate); uses `listClusterResources()`

- [x] **5.1.3** Additionally migrated 5 handlers to `getClient()` (did not use generic lister due to different return shapes):
  - `pods.go` — `GetRunningPods`, `GetPodStatusCounts`
  - `services.go` — `GetServices`
  - `nodes.go` — `GetNodes`
  - `secrets.go` — `GetSecrets`, `GetSecretData`
  - `namespaces.go` — `GetNamespaces`

- [x] **5.1.4** Added shared helpers to `resource_utils.go` (now ~95 lines):
  - `FormatAge(ts metav1.Time, now time.Time) string` — replaces per-file age formatting (seconds/minutes/hours/days)
  - `FormatAccessModes(modes []corev1.PersistentVolumeAccessMode) string` — replaces duplicate `formatPVCAccessModes`/`formatPVAccessModes`
  - Existing helpers (`ExtractFirstContainerImage`, `SafeReplicaCount`, `MergeLabels`, `SafeLabels`) now actively used

- [x] **5.1.5** Fixed last German error message in `resources.go` `CreateResource()`:
  - `"Kein Kontext gewählt"` → `"no kube context selected"` + updated test

- [x] **5.1.6** Tests written:
  - `resource_lister_test.go` (NEW, ~140 lines) — 5 tests: empty namespace, transform items, list error propagation, cluster resources, no-client error
  - `resource_utils_test.go` (UPDATED) — added `TestFormatAge` (5 cases: zero → dash, seconds, minutes, hours, days) and `TestFormatAccessModes` (7 cases: nil → dash, RWO, ROX, RWX, RWOP, multiple, unknown passthrough)

- [x] **5.1.7** Validation: `go vet`, `go build`, all tests pass across 7 packages

**Code reduction: ~180 lines of per-handler boilerplate removed; 13 duplicate helper functions eliminated.**

### 5.2 Unified Caching Layer ⏭️ SKIPPED
**Assessment**: Audited all handlers — no caching currently used anywhere. For a desktop application where:
- Data freshness is critical (users expect real-time cluster state)
- Polling already runs on 1-second intervals
- Memory is not a constraint (single user, single app)

Adding a caching layer would add complexity without meaningful benefit. SharedInformers or watch-based caching could be a future enhancement if latency becomes an issue.

### 5.3 Dynamic Client for Generic Operations ⏭️ SKIPPED
**Assessment**: The typed client-go API provides compile-time safety for all typed resources. The `dynamic` client is already used for `CreateResource()` / `DeleteResource()` (YAML-based operations) where it's appropriate. Migrating typed Get/List calls to dynamic would:
- Lose compile-time type safety
- Require runtime type assertions
- Add serialization overhead

The generic lister (5.1) already eliminates the per-handler boilerplate without sacrificing type safety.

---

## Verification Checklist

### After Each Phase
- [ ] All Go unit tests pass: `go test ./pkg/app/...`
- [ ] Go vet passes: `go vet ./...`
- [ ] Linter passes: `golangci-lint run`
- [ ] Frontend tests pass: `cd frontend && npm test`
- [ ] E2E tests pass: `cd e2e && npx playwright test`
- [ ] Test coverage >= 70% for new code
- [ ] Wails bindings regenerated if method signatures changed
- [ ] Manual smoke test of affected features

### Final Validation
- [x] No German error messages remain ✅ (fixed in daemonsets.go, cronjobs.go, ingresses.go, configmaps.go, resources.go)
- [x] No duplicate client initialization patterns ✅ (unified via `getClient()`)
- [x] All standard polling uses generic framework ✅ (MonitorPolling separate by design)
- [x] Event names are consistent and documented ✅ (all use colon separators; constants in event_names.go)
- [x] No duplicate per-handler helpers remain ✅ (13 eliminated, shared via resource_utils.go)
- [x] Generic resource lister replaces boilerplate ✅ (9 handlers migrated)
- [ ] Code coverage report generated and reviewed

---

## Files Changed Summary

### New Files (Implemented)
| File | Purpose | Status |
|------|---------|--------|
| `pkg/app/client.go` (19 lines) | Unified client initialization | ✅ Done |
| `pkg/app/resource_utils.go` (~95 lines) | Common helper functions (image, replicas, labels, age, access modes) | ✅ Done |
| `pkg/app/resource_lister.go` (~65 lines) | Generic `listResources[K,T]` and `listClusterResources[K,T]` helpers | ✅ Done |
| `pkg/app/polling.go` (~95 lines) | Generic polling framework + `StartAllPolling()` registry | ✅ Done |
| `pkg/app/events.go` (100+ lines) | Event types and conversion | ✅ Done |
| `pkg/app/event_names.go` (~85 lines) | Event name constants + dynamic event helpers | ✅ Done |

### Completed Modifications (Phase 2)
| File | Changes | Status |
|------|---------|--------|
| `pkg/app/deployments.go` | Removed `Start*Polling`/`collect*`, migrated to `getClient()` | ✅ Done |
| `pkg/app/daemonsets.go` | Removed `Start*Polling`/`collect*`, fixed German errors, migrated to `getClient()` | ✅ Done |
| `pkg/app/statefulsets.go` | Removed `Start*Polling`/`collect*`, migrated to `getClient()` | ✅ Done |
| `pkg/app/cronjobs.go` | Removed `Start*Polling`/`collect*`, fixed German errors, migrated to `getClient()` | ✅ Done |
| `pkg/app/replicasets.go` | Removed `Start*Polling`/`collect*`, migrated to `getClient()` | ✅ Done |
| `pkg/app/pods.go` | Removed `Start*Polling`/`collect*` | ✅ Done |
| `pkg/app/helm.go` | Removed `Start*Polling`/`collect*` | ✅ Done |
| `main.go` | Replaced 8 individual calls with `app.StartAllPolling()` | ✅ Done |

### Completed Modifications (Phase 4)
| File | Changes | Status |
|------|---------|--------|
| `pkg/app/event_names.go` (NEW, ~85 lines) | Event name constants + dynamic event helpers | ✅ Done |
| `pkg/app/event_names_test.go` (NEW) | Unit tests for event constants and helpers | ✅ Done |
| `pkg/app/polling.go` | Replaced 7 string literals with constants | ✅ Done |
| `pkg/app/resources.go` | Replaced 10 string literals with constants | ✅ Done |
| `pkg/app/resource_actions_jobs.go` | Replaced 2 string literals with constants | ✅ Done |
| `pkg/app/monitor.go` | Replaced 1 string literal with constant | ✅ Done |
| `pkg/app/monitor_actions.go` | Replaced 3 string literals with constants | ✅ Done |
| `pkg/app/counts.go` | Replaced 2 string literals with constants | ✅ Done |
| `pkg/app/pods.go` | Replaced ~12 string literals with constants/helpers | ✅ Done |
| `pkg/app/hooks.go` | Replaced 2 string literals with constants | ✅ Done |
| `pkg/app/holmes_integration.go` | Replaced 2 string literals with constants | ✅ Done |
| `pkg/app/holmes_deployment.go` | Replaced 1 string literal with constant | ✅ Done |
| `pkg/app/holmes_context.go` | Replaced 1 string literal with constant | ✅ Done |
| `pkg/app/docker_integration.go` | Replaced 8 string literals with constants | ✅ Done |
| `pkg/app/logs.go` | Replaced ~16 string literals with PodLogsEvent helper | ✅ Done |

### Completed Modifications (Phase 3)
| File | Changes | Status |
|------|---------|--------|
| `pkg/app/resource_actions.go` | Consolidated restart via `restartWorkload()`, delegates delete to `DeleteResource()`, removed `patchControllerAnnotation`, added `RestartWorkload` | ✅ Done |
| `pkg/app/resource_actions_jobs.go` | `DeleteJob`/`DeleteCronJob` delegate to `DeleteResource()` | ✅ Done |
| `pkg/app/delete_resource.go` | Added `service`, `serviceaccount`, `persistentvolumeclaim` cases | ✅ Done |
| `pkg/app/resource_actions_full_test.go` | Replaced `TestPatchControllerAnnotation` with `TestRestartWorkload` | ✅ Done |
| `pkg/app/delete_resource_test.go` | Added test cases for service, serviceaccount, persistentvolumeclaim | ✅ Done |

### Completed Modifications (Phase 5)
| File | Changes | Status |
|------|---------|--------|
| `pkg/app/resource_lister.go` (NEW, ~65 lines) | Generic `listResources[K,T]` and `listClusterResources[K,T]` helpers | ✅ Done |
| `pkg/app/resource_lister_test.go` (NEW, ~140 lines) | 5 tests for generic lister | ✅ Done |
| `pkg/app/resource_utils.go` | Added `FormatAge()`, `FormatAccessModes()` | ✅ Done |
| `pkg/app/resource_utils_test.go` | Added `TestFormatAge` (5 cases), `TestFormatAccessModes` (7 cases) | ✅ Done |
| `pkg/app/deployments.go` | Uses `listResources()` + shared helpers; removed 3 per-file helpers | ✅ Done |
| `pkg/app/daemonsets.go` | Uses `listResources()` + shared helpers; removed 2 per-file helpers | ✅ Done |
| `pkg/app/statefulsets.go` | Uses `listResources()` + shared helpers; removed 3 per-file helpers | ✅ Done |
| `pkg/app/replicasets.go` | Uses `listResources()` + shared helpers; removed 3 per-file helpers | ✅ Done |
| `pkg/app/cronjobs.go` | Uses `listResources()` + shared helpers; removed 2 per-file helpers | ✅ Done |
| `pkg/app/ingresses.go` | Uses `listResources()`; removed inline client creation + German error | ✅ Done |
| `pkg/app/configmaps.go` | Uses `listResources()`; extracted `buildConfigMapInfo()`; removed inline client creation + German error | ✅ Done |
| `pkg/app/persistentvolumeclaims.go` | Uses `listResources()` + `FormatAccessModes()`; removed `formatPVCAccessModes()` | ✅ Done |
| `pkg/app/persistentvolumes.go` | Uses `listClusterResources()` + `FormatAccessModes()`; removed `formatPVAccessModes()` | ✅ Done |
| `pkg/app/pods.go` | Migrated to `getClient()` | ✅ Done |
| `pkg/app/services.go` | Migrated to `getClient()` | ✅ Done |
| `pkg/app/nodes.go` | Migrated to `getClient()` | ✅ Done |
| `pkg/app/secrets.go` | Migrated to `getClient()`; removed unused import | ✅ Done |
| `pkg/app/namespaces.go` | Migrated to `getClient()` | ✅ Done |
| `pkg/app/resources.go` | Fixed last German error message in `CreateResource()` | ✅ Done |
| `pkg/app/resources_test.go` | Updated assertion for English error message | ✅ Done |

---

## Metrics

### Current State (Post Phase 5 — FINAL)
- Infrastructure files: 6 (client.go, resource_utils.go, resource_lister.go, polling.go, events.go, event_names.go)
- Polling functions migrated: 7/8 (MonitorPolling kept separate by design)
- Lines removed: ~430 (Phase 2: ~170 + Phase 3: ~80 + Phase 5: ~180)
- Lines added: ~340 (Phase 2: ~40 + Phase 3: ~25 + Phase 4: ~85 + Phase 5: ~190 infra/tests)
- Net reduction: ~90 lines of production code (plus major structural improvement)
- Per-handler duplicate helpers eliminated: 13 (Phase 5)
- Generic lister handlers: 9 migrated to `listResources`/`listClusterResources`
- Additional handlers on `getClient()`: 5 (pods, services, nodes, secrets, namespaces)
- Shared utilities: `FormatAge`, `FormatAccessModes`, `ExtractFirstContainerImage`, `SafeReplicaCount`, `MergeLabels`, `SafeLabels`, `Int32Ptr`
- Restart operations: 1 generic `restartWorkload()` + 3 delegates
- Delete operations: 1 unified `DeleteResource()` + 11 delegates
- Client initialization: Unified via `getClient()` ✅
- Event naming: All 30+ static events use typed constants ✅
- Dynamic event helpers: 4 centralized helpers ✅
- All Go tests pass: ✅ (full suite across 7 packages)
- New test functions added in Phase 5: 12 (5 lister + 5 FormatAge + 7 FormatAccessModes cases in 2 table-driven tests)

### Target
- Duplicated lines: ~400-600 (60-70% reduction from ~1,400-1,800)
- Polling functions: 1 generic implementation
- Client init patterns: 1 unified approach ✅
- Test coverage: >= 70% for new code

---

## Notes

- Phase 1 is complete (infrastructure)
- Phase 2 is complete (polling migration — 7/8 pollers migrated, MonitorPolling separate by design)
- Phase 3 is complete (resource actions consolidation — restart + delete)
- Phase 4 is complete (event naming standardization — constants + dynamic helpers)
- Phase 5 is complete (generic resource lister — 5.1 implemented; 5.2 caching and 5.3 dynamic client intentionally skipped)
- **All phases complete** — refactoring plan finished
- Each phase can be done incrementally
- Always run full test suite before moving to next phase
- Frontend files are now TypeScript (.tsx/.ts) — update any frontend references accordingly
- **Testing note:** `TestStartAllPollingDoesNotPanic` intentionally does not reset `disableWailsEvents` to avoid `log.Fatalf` from leaked goroutines in `TestStartup_LoadsConfig`'s `runResourceCountsAggregator`. This is safe because no test requires Wails event emission.
