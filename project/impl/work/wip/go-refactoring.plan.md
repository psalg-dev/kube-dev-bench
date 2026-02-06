# Go Backend Refactoring Plan

**Status:** WIP (40% — infrastructure done, migration not started)
**Created:** 2026-02-05
**Updated:** 2026-02-06

This document outlines a structured implementation plan to reduce code duplication and improve maintainability in the Go backend. Based on analysis identifying ~1,400-1,800 lines of duplicated code across 14+ resource handlers.

**Summary:** Core infrastructure implemented — `client.go` (19 lines) for unified client access, `polling.go` (56 lines) with generic `ResourcePollingConfig[T]`, `resource_utils.go` (53 lines) with helper functions, `events.go` (100+ lines) for event handling. German error messages have been removed. However, **no existing pollers have been migrated** to the generic framework — all 8 individual `Start*Polling()` functions still exist and are actively used. Resource actions (`resource_actions.go`, 253 lines) contains restart and delete functions but has not been consolidated into a generic pattern.

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
  - No German error messages found in codebase (verified via search)
  - All error messages are in English

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

### 2.2 Migrate Existing Pollers ❌ NOT STARTED

**Current state:** All 8 individual polling functions still exist and are actively called:

| Function | File | Status |
|----------|------|--------|
| `StartPodPolling()` | `pkg/app/pods.go` | ❌ Still in use |
| `StartDeploymentPolling()` | `pkg/app/deployments.go` | ❌ Still in use |
| `StartCronJobPolling()` | `pkg/app/cronjobs.go` | ❌ Still in use |
| `StartDaemonSetPolling()` | `pkg/app/daemonsets.go` | ❌ Still in use |
| `StartStatefulSetPolling()` | `pkg/app/statefulsets.go` | ❌ Still in use |
| `StartReplicaSetPolling()` | `pkg/app/replicasets.go` | ❌ Still in use |
| `StartMonitorPolling()` | `pkg/app/monitor.go` | ❌ Still in use |
| `StartHelmReleasePolling()` | `pkg/app/helm.go` | ❌ Still in use |

- [ ] **2.2.1** Create fetcher functions for each resource type
- [ ] **2.2.2** Register pollers using `startResourcePolling[T]()` in `main.go`
- [ ] **2.2.3** Remove old polling functions
- [ ] **2.2.4** Update `main.go` to use generic polling instead of manual calls

### 2.3 Write Poller Tests
- [ ] **2.3.1** Unit tests for generic polling:
  - Test registration
  - Test start/stop lifecycle
  - Test context cancellation
  - Test concurrent polling

- [ ] **2.3.2** Integration tests:
  - Test event emission
  - Test error handling
  - Test namespace filtering

### 2.4 Phase 2 Validation
- [ ] **2.4.1** Run all Go unit tests
- [ ] **2.4.2** Run E2E tests to verify frontend still receives events
- [ ] **2.4.3** Manual testing: verify all resource types update in UI
- [ ] **2.4.4** Verify graceful shutdown (no goroutine leaks)

---

## Phase 3: Resource Actions Consolidation ❌ NOT STARTED

**Current state:** `resource_actions.go` (253 lines) has individual restart and delete functions. They work but have not been consolidated into a generic pattern.

Existing functions:
- `RestartDeployment()`, `RestartStatefulSet()`, `RestartDaemonSet()` — separate implementations
- Delete functions for: Deployment, StatefulSet, DaemonSet, ReplicaSet, ConfigMap, Secret, PVC, PV, Ingress

### 3.1 Consolidate Restart Operations
**Goal**: Single restart function for all workload types

- [ ] **3.1.1** Create generic restart helper in `pkg/app/resource_actions.go`:
  ```go
  func (a *App) restartWorkload(
      resourceType string,  // "Deployment", "StatefulSet", "DaemonSet"
      namespace string,
      name string,
  ) error
  ```

- [ ] **3.1.2** Refactor existing restart functions to use helper:
  - [ ] `RestartDeployment()` - call `restartWorkload("Deployment", ...)`
  - [ ] `RestartStatefulSet()` - call `restartWorkload("StatefulSet", ...)`
  - [ ] `RestartDaemonSet()` - call `restartWorkload("DaemonSet", ...)`

- [ ] **3.1.3** Consider exposing generic `RestartWorkload(kind, ns, name)` to frontend

### 3.2 Consolidate Delete Operations
**Goal**: Reduce boilerplate in delete functions

- [ ] **3.2.1** Evaluate options:
  - Option A: Keep individual functions (type safety, clear API)
  - Option B: Table-driven approach with resource registry
  - Option C: Dynamic client with GVR lookup

- [ ] **3.2.2** If choosing Option B, create resource registry
- [ ] **3.2.3** Write tests for consolidated actions

### 3.3 Phase 3 Validation
- [ ] **3.3.1** Run unit tests for resource actions
- [ ] **3.3.2** E2E test: restart deployment, statefulset, daemonset
- [ ] **3.3.3** E2E test: delete various resource types
- [ ] **3.3.4** Verify Wails bindings still work correctly

---

## Phase 4: Event Naming Standardization ❌ NOT STARTED

### 4.1 Audit Event Names
**Goal**: Consistent naming convention across K8s and Docker events

**Note:** `events.go` exists (100+ lines) but contains event type definitions and conversion utilities, NOT event name constants.

- [ ] **4.1.1** Document current event names:
  - K8s: `"pods:update"`, `"deployments:update"`, etc.
  - Docker: `"docker-services:update"`, `"docker-tasks:update"`, etc.

- [ ] **4.1.2** Decide on convention:
  - Option A: All use colon separator (`docker:services:update`)
  - Option B: All use hyphen separator (`docker-services-update`)
  - Option C: Keep current (document the difference)

- [ ] **4.1.3** If changing, update:
  - [ ] Go event emissions
  - [ ] Frontend event listeners in `ClusterStateContext.tsx`
  - [ ] Frontend event listeners in `SwarmStateContext.tsx`

### 4.2 Create Event Constants
- [ ] **4.2.1** Add event name constants to `pkg/app/events.go`:
  ```go
  const (
      EventPodsUpdate        = "pods:update"
      EventDeploymentsUpdate = "deployments:update"
      // ...
  )
  ```

- [ ] **4.2.2** Update all `emitEvent()` calls to use constants

---

## Phase 5: Advanced Abstractions (Optional) ❌ NOT STARTED

### 5.1 Generic Resource Lister with Go Generics
- [ ] **5.1.1** Design generic lister interface
- [ ] **5.1.2** Implement for each resource type
- [ ] **5.1.3** Evaluate code reduction vs complexity tradeoff

### 5.2 Unified Caching Layer
- [ ] **5.2.1** Audit current caching approaches
- [ ] **5.2.2** Design unified cache interface
- [ ] **5.2.3** Implement if beneficial

### 5.3 Dynamic Client for Generic Operations
- [ ] **5.3.1** Evaluate `k8s.io/client-go/dynamic` client
- [ ] **5.3.2** Prototype generic CRUD operations
- [ ] **5.3.3** Assess tradeoff vs type safety

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
- [x] No German error messages remain ✅
- [x] No duplicate client initialization patterns ✅ (unified via `getClient()`)
- [ ] All polling uses generic framework (no manual goroutines)
- [ ] Event names are consistent or documented
- [ ] Code coverage report generated and reviewed

---

## Files Changed Summary

### New Files (Implemented)
| File | Purpose | Status |
|------|---------|--------|
| `pkg/app/client.go` (19 lines) | Unified client initialization | ✅ Done |
| `pkg/app/resource_utils.go` (53 lines) | Common helper functions | ✅ Done |
| `pkg/app/polling.go` (56 lines) | Generic polling framework | ✅ Done (infrastructure only) |
| `pkg/app/events.go` (100+ lines) | Event types and conversion | ✅ Done (no name constants yet) |

### Pending Modifications
| File | Changes | Status |
|------|---------|--------|
| `pkg/app/deployments.go` | Migrate to generic polling | ❌ Pending |
| `pkg/app/daemonsets.go` | Migrate to generic polling | ❌ Pending |
| `pkg/app/statefulsets.go` | Migrate to generic polling | ❌ Pending |
| `pkg/app/cronjobs.go` | Migrate to generic polling | ❌ Pending |
| `pkg/app/replicasets.go` | Migrate to generic polling | ❌ Pending |
| `pkg/app/pods.go` | Migrate to generic polling | ❌ Pending |
| `pkg/app/helm.go` | Migrate to generic polling | ❌ Pending |
| `pkg/app/resource_actions.go` (253 lines) | Consolidate restart/delete | ❌ Pending |
| `main.go` | Use generic polling registry | ❌ Pending |

---

## Metrics

### Current State
- Infrastructure files created: 4 (client.go, resource_utils.go, polling.go, events.go)
- Polling functions still in individual files: 8
- Resource actions: Individual functions, not consolidated
- Client initialization: Unified via `getClient()` ✅

### Target
- Duplicated lines: ~400-600 (60-70% reduction from ~1,400-1,800)
- Polling functions: 1 generic implementation
- Client init patterns: 1 unified approach ✅
- Test coverage: >= 70% for new code

---

## Notes

- Phase 1 is complete (infrastructure)
- Phases 2-3 are the main remaining work (migration + consolidation)
- Phases 4-5 are optional enhancements
- Each phase can be done incrementally
- Always run full test suite before moving to next phase
- Frontend files are now TypeScript (.tsx/.ts) — update any frontend references accordingly
