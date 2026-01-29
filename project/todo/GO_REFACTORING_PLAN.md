# Go Backend Refactoring Plan

This document outlines a structured implementation plan to reduce code duplication and improve maintainability in the Go backend. Based on analysis identifying ~1,400-1,800 lines of duplicated code across 14+ resource handlers.

**Recommended Approach**: Option 2 (Moderate Refactor)
**Estimated Impact**: ~700 lines removed, improved architecture
**Test Coverage Target**: 70% for new code (per CLAUDE.md)

---

## Phase 1: Foundation & Quick Wins

### 1.1 Standardize Client Initialization
**Goal**: Single pattern for Kubernetes client creation across all handlers

- [ ] **1.1.1** Create unified `getClientsetWithTestSupport()` method in `pkg/app/client.go`
  - Consolidates test client injection pattern
  - Handles `testClientset` check internally
  - Returns `kubernetes.Interface`

- [ ] **1.1.2** Update handlers using `clientcmd.LoadFromFile()` pattern:
  - [ ] `pkg/app/daemonsets.go` - replace lines 17-37
  - [ ] `pkg/app/cronjobs.go` - replace client init block
  - [ ] `pkg/app/configmaps.go` - replace client init block
  - [ ] `pkg/app/ingresses.go` - replace client init block
  - [ ] `pkg/app/persistentvolumeclaims.go` - verify and update if needed
  - [ ] `pkg/app/secrets.go` - verify and update if needed

- [ ] **1.1.3** Verify handlers already using `getKubernetesClient()`:
  - [ ] `pkg/app/deployments.go` - confirm pattern
  - [ ] `pkg/app/statefulsets.go` - confirm pattern
  - [ ] `pkg/app/replicasets.go` - confirm pattern

- [ ] **1.1.4** Write unit tests for `getClientsetWithTestSupport()`
  - Test with nil testClientset
  - Test with mock testClientset
  - Test error cases (missing context, invalid config)

- [ ] **1.1.5** Fix German error messages
  - [ ] `pkg/app/daemonsets.go:26` - change `"Kein Kontext gewählt"` to `"no context selected"`
  - [ ] `pkg/app/cronjobs.go` - find and fix German message
  - [ ] `pkg/app/ingresses.go` - find and fix German message
  - [ ] Search for other German strings: `grep -r "Kein\|gewählt\|nicht\|Fehler" pkg/`

### 1.2 Extract Common Helper Functions
**Goal**: Eliminate repeated utility code blocks

- [ ] **1.2.1** Create `pkg/app/resource_helpers.go` with:
  ```go
  // getResourceAge returns formatted age string from creation timestamp
  func getResourceAge(creationTime metav1.Time) string

  // getPrimaryContainerImage extracts first container image from pod spec
  func getPrimaryContainerImage(containers []corev1.Container) string

  // mergeLabels combines metadata labels with template labels (metadata takes precedence)
  func mergeLabels(metadataLabels, templateLabels map[string]string) map[string]string
  ```

- [ ] **1.2.2** Update all handlers to use `getResourceAge()`:
  - [ ] `pkg/app/deployments.go` - lines 31-34
  - [ ] `pkg/app/daemonsets.go` - lines 48-52
  - [ ] `pkg/app/statefulsets.go` - find and replace
  - [ ] `pkg/app/cronjobs.go` - find and replace
  - [ ] `pkg/app/replicasets.go` - find and replace
  - [ ] `pkg/app/pods.go` - find and replace
  - [ ] `pkg/app/services.go` - find and replace
  - [ ] `pkg/app/configmaps.go` - find and replace
  - [ ] `pkg/app/secrets.go` - find and replace
  - [ ] `pkg/app/ingresses.go` - find and replace
  - [ ] `pkg/app/persistentvolumeclaims.go` - find and replace
  - [ ] `pkg/app/jobs/jobs.go` - find and replace

- [ ] **1.2.3** Update handlers to use `getPrimaryContainerImage()`:
  - [ ] `pkg/app/deployments.go` - lines 37-40
  - [ ] `pkg/app/daemonsets.go` - lines 54-57
  - [ ] `pkg/app/statefulsets.go`
  - [ ] `pkg/app/cronjobs.go`
  - [ ] `pkg/app/replicasets.go`
  - [ ] `pkg/app/jobs/jobs.go`

- [ ] **1.2.4** Update handlers to use `mergeLabels()`:
  - [ ] `pkg/app/deployments.go` - lines 57-69
  - [ ] `pkg/app/daemonsets.go` - lines 62-72
  - [ ] `pkg/app/statefulsets.go`
  - [ ] `pkg/app/cronjobs.go`
  - [ ] `pkg/app/replicasets.go`

- [ ] **1.2.5** Write unit tests for helper functions
  - [ ] Test `getResourceAge()` with zero time, past time, future time (clock skew)
  - [ ] Test `getPrimaryContainerImage()` with 0, 1, multiple containers
  - [ ] Test `mergeLabels()` with nil maps, overlapping keys, empty maps

### 1.3 Phase 1 Validation
- [ ] **1.3.1** Run all Go unit tests: `go test ./pkg/app/...`
- [ ] **1.3.2** Run frontend unit tests: `cd frontend && npm test`
- [ ] **1.3.3** Run E2E tests: `cd e2e && npx playwright test`
- [ ] **1.3.4** Verify test coverage >= 70% for new code
- [ ] **1.3.5** Run `go vet ./...` and `golangci-lint run`

---

## Phase 2: Generic Polling Framework

### 2.1 Design Polling Infrastructure
**Goal**: Replace 9 identical polling functions with a unified framework

- [ ] **2.1.1** Create `pkg/app/poller/poller.go` with:
  ```go
  type ResourcePoller struct {
      Name      string
      EventName string
      Interval  time.Duration
      Fetcher   func(namespaces []string) (interface{}, error)
  }

  type PollerRegistry struct {
      pollers   []ResourcePoller
      ctx       context.Context
      cancel    context.CancelFunc
      wg        sync.WaitGroup
  }

  func (r *PollerRegistry) Register(p ResourcePoller)
  func (r *PollerRegistry) Start(ctx context.Context)
  func (r *PollerRegistry) Stop()
  ```

- [ ] **2.1.2** Implement proper lifecycle management:
  - Context cancellation support
  - WaitGroup for graceful shutdown
  - Error callback for reporting issues to frontend

- [ ] **2.1.3** Add error reporting mechanism:
  - Option A: Emit error events (`"polling:error"`)
  - Option B: Callback function for error handling
  - Option C: Structured logging with log levels

### 2.2 Migrate Existing Pollers
- [ ] **2.2.1** Create fetcher functions for each resource type:
  - [ ] `fetchDeployments(namespaces []string) ([]DeploymentInfo, error)`
  - [ ] `fetchStatefulSets(namespaces []string) ([]StatefulSetInfo, error)`
  - [ ] `fetchDaemonSets(namespaces []string) ([]DaemonSetInfo, error)`
  - [ ] `fetchCronJobs(namespaces []string) ([]CronJobInfo, error)`
  - [ ] `fetchReplicaSets(namespaces []string) ([]ReplicaSetInfo, error)`
  - [ ] `fetchPods(namespaces []string) ([]PodInfo, error)`
  - [ ] `fetchHelmReleases(namespaces []string) ([]HelmReleaseInfo, error)`

- [ ] **2.2.2** Register pollers in `main.go`:
  ```go
  registry := poller.NewRegistry()
  registry.Register(poller.ResourcePoller{
      Name:      "deployments",
      EventName: "deployments:update",
      Interval:  time.Second,
      Fetcher:   app.fetchDeployments,
  })
  // ... register others
  registry.Start(ctx)
  defer registry.Stop()
  ```

- [ ] **2.2.3** Remove old polling functions:
  - [ ] `StartPodPolling()` from `pkg/app/pods.go`
  - [ ] `StartDeploymentPolling()` from `pkg/app/deployments.go`
  - [ ] `StartCronJobPolling()` from `pkg/app/cronjobs.go`
  - [ ] `StartDaemonSetPolling()` from `pkg/app/daemonsets.go`
  - [ ] `StartStatefulSetPolling()` from `pkg/app/statefulsets.go`
  - [ ] `StartReplicaSetPolling()` from `pkg/app/replicasets.go`
  - [ ] `StartMonitorPolling()` from `pkg/app/monitor.go`
  - [ ] `StartHelmReleasePolling()` from `pkg/app/helm.go`

- [ ] **2.2.4** Update `main.go` to use registry instead of manual calls

### 2.3 Write Poller Tests
- [ ] **2.3.1** Unit tests for PollerRegistry:
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

## Phase 3: Resource Actions Consolidation

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

- [ ] **3.2.2** If choosing Option B, create resource registry:
  ```go
  var resourceDeleters = map[string]func(clientset kubernetes.Interface, ctx context.Context, ns, name string) error{
      "Deployment":  func(...) { return clientset.AppsV1().Deployments(ns).Delete(...) },
      "StatefulSet": func(...) { return clientset.AppsV1().StatefulSets(ns).Delete(...) },
      // ...
  }
  ```

- [ ] **3.2.3** Write tests for consolidated actions

### 3.3 Phase 3 Validation
- [ ] **3.3.1** Run unit tests for resource actions
- [ ] **3.3.2** E2E test: restart deployment, statefulset, daemonset
- [ ] **3.3.3** E2E test: delete various resource types
- [ ] **3.3.4** Verify Wails bindings still work correctly

---

## Phase 4: Event Naming Standardization

### 4.1 Audit Event Names
**Goal**: Consistent naming convention across K8s and Docker events

- [ ] **4.1.1** Document current event names:
  - K8s: `"pods:update"`, `"deployments:update"`, etc.
  - Docker: `"docker-services:update"`, `"docker-tasks:update"`, etc.

- [ ] **4.1.2** Decide on convention:
  - Option A: All use colon separator (`docker:services:update`)
  - Option B: All use hyphen separator (`docker-services-update`)
  - Option C: Keep current (document the difference)

- [ ] **4.1.3** If changing, update:
  - [ ] Go event emissions
  - [ ] Frontend event listeners in `ClusterStateContext.jsx`
  - [ ] Frontend event listeners in `SwarmStateContext.jsx`

### 4.2 Create Event Constants
- [ ] **4.2.1** Create `pkg/app/events.go` with event name constants:
  ```go
  const (
      EventPodsUpdate        = "pods:update"
      EventDeploymentsUpdate = "deployments:update"
      // ...
  )
  ```

- [ ] **4.2.2** Update all `emitEvent()` calls to use constants

---

## Phase 5: Advanced Abstractions (Optional)

### 5.1 Generic Resource Lister with Go Generics
**Goal**: Type-safe generic listing for all K8s resources

- [ ] **5.1.1** Design generic lister interface:
  ```go
  type ResourceLister[K any, R any] interface {
      List(ctx context.Context, ns string) ([]K, error)
      Transform(item K) R
  }
  ```

- [ ] **5.1.2** Implement for each resource type
- [ ] **5.1.3** Evaluate code reduction vs complexity tradeoff

### 5.2 Unified Caching Layer
**Goal**: Consistent caching strategy across resources

- [ ] **5.2.1** Audit current caching approaches:
  - `sync.Map` for shell sessions
  - TTL cache for Docker task health
  - No caching for most K8s resources

- [ ] **5.2.2** Design unified cache interface
- [ ] **5.2.3** Implement if beneficial

### 5.3 Dynamic Client for Generic Operations
**Goal**: Single implementation for common operations across resource types

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
- [ ] No German error messages remain
- [ ] No duplicate client initialization patterns
- [ ] All polling uses registry (no manual goroutines)
- [ ] Event names are consistent or documented
- [ ] Code coverage report generated and reviewed

---

## Files Changed Summary

### New Files
| File | Purpose |
|------|---------|
| `pkg/app/client.go` | Unified client initialization |
| `pkg/app/resource_helpers.go` | Common helper functions |
| `pkg/app/poller/poller.go` | Generic polling framework |
| `pkg/app/events.go` | Event name constants |

### Modified Files
| File | Changes |
|------|---------|
| `pkg/app/deployments.go` | Use helpers, remove polling |
| `pkg/app/daemonsets.go` | Use helpers, fix German, remove polling |
| `pkg/app/statefulsets.go` | Use helpers, remove polling |
| `pkg/app/cronjobs.go` | Use helpers, fix German, remove polling |
| `pkg/app/replicasets.go` | Use helpers, remove polling |
| `pkg/app/pods.go` | Use helpers, remove polling |
| `pkg/app/configmaps.go` | Use helpers |
| `pkg/app/secrets.go` | Use helpers |
| `pkg/app/ingresses.go` | Use helpers, fix German |
| `pkg/app/resource_actions.go` | Consolidate restart/delete |
| `main.go` | Use poller registry |

---

## Metrics

### Before Refactoring
- Duplicated lines: ~1,400-1,800
- Polling functions: 9 separate implementations
- Client init patterns: 2 different approaches
- Test coverage: TBD

### After Refactoring (Target)
- Duplicated lines: ~400-600 (60-70% reduction)
- Polling functions: 1 generic implementation
- Client init patterns: 1 unified approach
- Test coverage: >= 70% for new code

---

## Notes

- Phases 1-3 are recommended (Moderate Refactor)
- Phases 4-5 are optional enhancements
- Each phase can be done incrementally
- Always run full test suite before moving to next phase
- Update CLAUDE.md if architectural patterns change significantly
