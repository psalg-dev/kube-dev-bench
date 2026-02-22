# Docker Swarm Feature Gap Implementation Plan

**Status:** DONE
**Created:** 2026-02-06
**Updated:** 2026-02-06 (verified)

This document outlines the implementation plan for closing feature gaps between KubeDevBench and competing Docker Swarm management tools (Portainer, Swarmpit).

## Current Implementation Status (Verified 2026-02-06)

- Registry integration now targets Docker Registry v2 with fast local bootstrap in [registry](registry) and docs in [docs/replace-jfrog-with-docker-registry.md](docs/replace-jfrog-with-docker-registry.md). E2E coverage is in [e2e/tests/registry/10-docker-registry.spec.ts](e2e/tests/registry/10-docker-registry.spec.ts).
- Swarm image update detection is implemented end-to-end; UI indicators live in [frontend/src/docker/resources/services/SwarmServicesOverviewTable.tsx](frontend/src/docker/resources/services/SwarmServicesOverviewTable.tsx).
- Swarm metrics dashboard is implemented in [frontend/src/docker/metrics/SwarmMetricsDashboard.tsx](frontend/src/docker/metrics/SwarmMetricsDashboard.tsx) with backend collection in [pkg/app/docker/metrics.go](pkg/app/docker/metrics.go).
- Cluster topology visualization is implemented in [frontend/src/docker/topology/TopologyView.tsx](frontend/src/docker/topology/TopologyView.tsx) with backend graph building in [pkg/app/docker/topology](pkg/app/docker/topology) and Wails RPC in [pkg/app/docker_integration.go](pkg/app/docker_integration.go).
- Remaining multi-cloud registry clients (ECR/ACR/GitLab) are not present in [pkg/app/docker/registry](pkg/app/docker/registry) and remain future work.

## Overview

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| Registry Integration | High | Large | None |
| Image Update Detection | High | Medium | Registry Integration |
| Metrics Dashboard | High | Large | None |
| Task Exec/Shell | Medium | Medium | None |
| Health Check Display | Medium | Small | None |
| Cluster Topology Visualizer | Low | Large | None |

## Current Implementation Status (as of 2026-01-11)

This is a quick snapshot so we can resume implementation later without re-discovering what already exists.

**Completed (end-to-end)**

- **Registry Integration (partial scope)**: Docker Hub + generic v2 (incl. Artifactory), encrypted persistence, Wails bindings, UI and E2Es.
  - Backend: `pkg/app/docker/registry/*`, Wails bindings in `pkg/app/docker_integration.go`, tests in `pkg/app/docker_integration_registry_test.go`.
  - Frontend: `frontend/src/docker/registry/*`, sidebar entry in `frontend/src/docker/SwarmSidebarSections.jsx`.
  - E2E: `e2e/tests/swarm/60-registry-config.spec.ts`, `e2e/tests/swarm/61-artifactory-registry.spec.ts`.

- **Task Exec/Shell**: interactive terminal exec into Swarm task containers (xterm.js UI + Wails event streaming).
  - Backend: `pkg/app/swarm_exec.go` (Swarm exec), shared session plumbing in `pkg/app/pods.go`.
  - E2E: `e2e/tests/swarm/75-task-exec.spec.ts`.

- **Health Check Display (task-level)**: Health column + details section, plus backend stability fix.
  - Backend health fields/types: `pkg/app/docker/types.go`; health population in `pkg/app/docker/tasks.go`.
  - Frontend: `frontend/src/docker/resources/tasks/HealthStatusBadge.jsx` and task panel section in `frontend/src/docker/resources/tasks/SwarmTasksOverviewTable.jsx`.
  - E2E: `e2e/tests/swarm/80-health-check-display.spec.ts`.
  - Stability fix: guarded Swarm health TTL cache to prevent `fatal error: concurrent map writes` during polling.

**Completed (end-to-end)**

- Image Update Detection: digest checking (local+remote), cache + background polling, UI column + details modal + settings, events.

**In progress**

- Metrics Dashboard (backend collector + history/events + UI + unit tests + E2E smoke)
- Cluster Topology Visualizer (backend builder + basic SVG UI + smoke E2E)

---

## 1. Registry Integration

**Goal**: Allow users to configure and browse Docker registries (Docker Hub, ECR, ACR, GitLab) for image selection and update detection.

### 1.1 Backend - Registry Types & Configuration

- [x] **1.1.1** Create `pkg/app/docker/registry/types.go`
  - [x] Define `RegistryConfig` struct (name, url, type, auth credentials)
  - [x] Define `RegistryType` enum (dockerhub, ecr, acr, gitlab, generic_v2)
  - [x] Define `RegistryImage` struct (name, tags[], digest, lastUpdated)
  - [x] Define `RegistryCredentials` struct (username, password/token, region for ECR)

- [x] **1.1.2** Create `pkg/app/docker/registry/client.go`
  - [x] Implement `RegistryClient` interface with `ListRepositories()`, `ListTags()`, `GetManifest()`
  - [x] Implement Docker Hub client (using registry.hub.docker.com API)
  - [x] Implement generic Docker Registry v2 client
  - [x] Add HTTP client with configurable timeout and TLS settings

- [ ] **1.1.3** Create `pkg/app/docker/registry/ecr.go`
  - [ ] Implement AWS ECR client using AWS SDK
  - [ ] Handle ECR authentication token refresh
  - [ ] Support cross-region ECR access

- [ ] **1.1.4** Create `pkg/app/docker/registry/acr.go`
  - [ ] Implement Azure ACR client
  - [ ] Handle Azure AD authentication flow
  - [ ] Support ACR token-based auth

- [ ] **1.1.5** Create `pkg/app/docker/registry/gitlab.go`
  - [ ] Implement GitLab Container Registry client
  - [ ] Support personal access token authentication
  - [ ] Handle GitLab-specific API endpoints

- [x] **1.1.6** Add unit tests for registry clients
  - [x] Test Docker Hub client with mock server
  - [x] Test v2 registry client with mock server
  - [ ] Test credential validation
  - [ ] Aim for 70%+ coverage

### 1.2 Backend - Registry Persistence & Wails Bindings

- [x] **1.2.1** Create `pkg/app/docker/registry/storage.go`
  - [x] Implement encrypted file credential storage (AES-GCM; secret key persisted locally)
  - [x] Add `SaveRegistry()`, `GetRegistries()`, `DeleteRegistry()` functions
  - [x] Store registries in `~/KubeDevBench/registries.json` (credentials encrypted)

- [x] **1.2.2** Add Wails bindings in `pkg/app/docker_integration.go`
  - [x] `GetRegistries() []RegistryConfig`
  - [x] `AddRegistry(config RegistryConfig) error`
  - [x] `RemoveRegistry(name string) error`
  - [x] `TestRegistryConnection(config RegistryConfig) error`
  - [x] `ListRegistryRepositories(registryName string) []string`
  - [x] `ListRegistryTags(registryName, repository string) []string`
  - [x] `GetImageDigest(registryName, repository, tag string) string`

- [x] **1.2.3** Add unit tests for Wails bindings
  - [x] Test registry CRUD operations
  - [x] Test error handling for invalid configs

### 1.3 Frontend - Registry Configuration UI

- [ ] **1.3.1** Create `frontend/src/docker/registry/RegistryStateContext.jsx`
  - [ ] Create context for registry list state
  - [ ] Add loading/error states
  - [ ] Implement `useRegistries()` hook

- [ ] **1.3.2** Create `frontend/src/docker/registry/RegistryList.jsx`
  - [ ] Display configured registries in a list
  - [ ] Show connection status indicator per registry
  - [ ] Add delete button with confirmation

- [x] **1.3.3** Create `frontend/src/docker/registry/AddRegistryModal.jsx`
  - [x] Form with registry type selector (Docker Hub, ECR, ACR, GitLab, Custom)
  - [x] Dynamic form fields based on registry type
  - [x] Test connection button before saving
  - [x] Validation for required fields

- [x] **1.3.4** Create `frontend/src/docker/registry/RegistryBrowser.jsx`
  - [x] Tree view of repositories within a registry
  - [x] Tag list for selected repository
  - [x] Search/filter functionality
  - [ ] "Use this image" action to populate service create/update forms

- [x] **1.3.5** Add sidebar entry for Registries
  - [x] Add "Registries" section to `SwarmSidebarSections.jsx`
  - [x] Show count of configured registries

- [ ] **1.3.6** Add unit tests for registry components
  - [ ] Test RegistryList rendering
  - [ ] Test AddRegistryModal form validation
  - [ ] Test RegistryBrowser navigation

### 1.4 E2E Tests - Registry Integration

- [x] **1.4.1** Create `e2e/tests/swarm/60-registry-config.spec.ts`
  - [x] Test adding a registry configuration
  - [x] Test registry connection validation
  - [x] Test removing a registry

- [x] **1.4.2** Create `e2e/tests/swarm/61-artifactory-registry.spec.ts`
  - [x] Test browsing/searching an Artifactory Docker registry (generic v2)

**Notes / deviations from the original plan**

- The registry “list” UX is implemented as `frontend/src/docker/registry/SwarmRegistriesOverview.jsx` (table + bottom panel), rather than a separate `RegistryList.jsx` + `RegistryStateContext.jsx`.

---

## 2. Image Update Detection

**Goal**: Detect when service images have newer versions available in the registry and provide visual indicators.

### 2.1 Backend - Image Version Checking

- [x] **2.1.1** Implement image update checker (deviation: implemented in `pkg/app/docker/image_updates.go`)
  - [x] Implement `CheckImageUpdate(ctx, image string) (ImageUpdateInfo, error)`
  - [x] Parse image reference (registry/repo:tag or repo@digest)
  - [x] Compare local digest vs remote digest (now also derives local digest for tag-based services via task container image inspect)
  - [ ] Handle rate limiting for registry API calls

- [x] **2.1.2** Extend `SwarmServiceInfo` in `pkg/app/docker/types.go`
  - [x] Add `ImageUpdateAvailable bool` field
  - [x] Add `ImageLocalDigest string` field
  - [x] Add `ImageRemoteDigest string` field
  - [x] Add `ImageCheckedAt string` field

- [x] **2.1.3** Add update checking to service polling
  - [x] Create background goroutine for periodic image update checks
  - [x] Configurable check interval (default: 5 minutes)
  - [x] Cache results to avoid excessive API calls
  - [x] Emit `swarm:image:updates` event when checks run

- [x] **2.1.4** Add Wails bindings
  - [x] `CheckServiceImageUpdates(serviceIDs []string) map[string]ImageUpdateInfo`
  - [x] `GetImageUpdateSettings() ImageUpdateSettings`
  - [x] `SetImageUpdateSettings(settings ImageUpdateSettings) error`

- [ ] **2.1.5** Add unit tests
  - [ ] Test digest comparison logic
  - [ ] Test image reference parsing
  - [ ] Test cache behavior

### 2.2 Frontend - Update Indicators

- [x] **2.2.1** Update `SwarmServicesOverviewTable.jsx`
  - [x] Add "Update" column with icon indicator
  - [x] Green checkmark = up to date
  - [x] Orange warning = update available
  - [x] Gray dash = unable to check
  - [x] Tooltip with digest info on hover

- [x] **2.2.2** Create `frontend/src/docker/resources/services/ImageUpdateBadge.jsx`
  - [x] Reusable component for update indicator
  - [ ] Click action to show update details modal
  - [ ] "Update Now" quick action button

- [ ] **2.2.3** Create `frontend/src/docker/resources/services/ImageUpdateModal.jsx`
  - [x] Show current vs available image info
  - [ ] Display changelog/release notes if available
  - [x] Confirm/trigger update action
  - [ ] Option to update all services using this image

- [ ] **2.2.4** Add settings for image update checking
  - [x] Add toggle to enable/disable auto-check (backend settings + binding)
  - [x] Add interval configuration (backend settings + binding)
  - [x] Add UI for settings (modal)
  - [ ] Add per-registry enable/disable

- [ ] **2.2.5** Add unit tests
  - [ ] Test ImageUpdateBadge states
  - [ ] Test ImageUpdateModal actions

### 2.3 E2E Tests - Image Update Detection

- [x] **2.3.1** Create `e2e/tests/swarm/65-image-updates.spec.ts`
  - [x] Smoke: Update column exists
  - [x] Smoke: Settings button exists
  - [ ] Test update indicator display (deterministic)
  - [ ] Test manual refresh of update status
  - [ ] Test update action flow

---

## 3. Metrics Dashboard

**Goal**: Display real-time CPU, memory, and network metrics for nodes, services, and tasks.

### 3.1 Backend - Metrics Collection

- [ ] **3.1.1** Create `pkg/app/docker/metrics/types.go`
  - [ ] Define `NodeMetrics` struct (cpuPercent, memoryUsed, memoryTotal, networkRx, networkTx)
  - [ ] Define `ContainerMetrics` struct (similar fields per container)
  - [ ] Define `MetricsSnapshot` struct with timestamp
  - [ ] Define `MetricsHistory` struct for time-series data

- [x] **3.1.2** Create `pkg/app/docker/metrics/collector.go`
  - [x] Implement container stats collection using Docker API `ContainerStats()` (deviation: `pkg/app/docker/metrics_live.go`)
  - [x] Implement node-level aggregation (best-effort)
  - [x] Calculate CPU percentage from stats delta
  - [x] Handle per-service aggregation

- [ ] **3.1.3** Create `pkg/app/docker/metrics/history.go`
  - [ ] Implement in-memory metrics history buffer (ring buffer)
  - [ ] Configurable retention period (default: 1 hour)
  - [ ] Downsample old data points for longer history

- [ ] **3.1.4** Add Wails bindings in `pkg/app/docker_integration.go`
  - [ ] `GetNodeMetrics(nodeID string) NodeMetrics`
  - [ ] `GetServiceMetrics(serviceID string) []ContainerMetrics`
  - [ ] `GetClusterMetrics() ClusterMetrics`
  - [ ] `GetMetricsHistory(resourceType, resourceID string, duration time.Duration) MetricsHistory`

- [x] **3.1.5** Add metrics polling
  - [x] Polling runs every 5s (deviation: `StartSwarmMetricsPolling()` in `pkg/app/docker_integration.go`)
  - [x] Emit `swarm:metrics:update` event with current metrics
  - [x] Emit `swarm:metrics:breakdown` event with per-service/per-node rollups (deviation)

- [x] **3.1.6** Add unit tests
  - [x] Test CPU calculation from stats (deviation: `pkg/app/docker/metrics_live_test.go`)
  - [x] Test memory usage calculation (incl. cache subtraction)
  - [x] Test history buffer behavior (deviation: `pkg/app/docker/metrics_test.go`)

### 3.2 Frontend - Metrics Dashboard UI

- [x] **3.2.1** Create `frontend/src/docker/metrics/MetricsStateContext.jsx`
  - [x] Context for real-time metrics data
  - [x] Subscribe to `swarm:metrics:update` events
  - [x] Provide hook: `useClusterMetrics()`
  - [ ] Provide hooks: `useNodeMetrics()`, `useServiceMetrics()` (pending backend support)

- [x] **3.2.2** Create `frontend/src/docker/metrics/MetricsDashboard.jsx`
  - [x] Main dashboard view with cluster overview (implemented as `SwarmMetricsDashboard.jsx`)
  - [x] Grid layout with key metrics cards
  - [x] Time range selector for historical data (client-side filter)

- [x] **3.2.3** Create `frontend/src/docker/metrics/MetricsChart.jsx`
  - [x] Reusable lightweight SVG line chart (no external lib yet)
  - [x] Support line charts for time-series data
  - [ ] Bar charts / comparison views (not implemented)
  - [ ] Responsive sizing (basic; configurable width/height)

- [ ] **3.2.4** Create `frontend/src/docker/metrics/NodeMetricsCard.jsx`
  - [ ] Display CPU, memory, disk usage gauges
  - [ ] Mini sparkline charts for recent history
  - [ ] Link to node details

- [ ] **3.2.5** Create `frontend/src/docker/metrics/ServiceMetricsCard.jsx`
  - [ ] Aggregate metrics across service tasks
  - [ ] Per-task breakdown option
  - [ ] Memory/CPU limits vs usage visualization

- [ ] **3.2.6** Add metrics to existing views
  - [ ] Add metrics mini-view to node detail panel
  - [ ] Add metrics mini-view to service detail panel
  - [ ] Add metrics sparklines to overview tables (optional column)

- [ ] **3.2.7** Add sidebar entry for Metrics Dashboard
  - [ ] Add "Metrics" section to `SwarmSidebarSections.jsx`

- [x] **3.2.8** Add unit tests
  - [x] Test MetricsDashboard time-range filtering
  - [x] Test context history load + event append
  - [ ] Add more chart/data transformation tests (optional)

### 3.3 E2E Tests - Metrics Dashboard

- [x] **3.3.1** Create `e2e/tests/swarm/70-metrics-dashboard.spec.ts`
  - [x] Smoke: metrics dashboard loads (deviation: implemented as `e2e/tests/swarm/66-metrics-dashboard.spec.ts`)
  - [x] Smoke: time range selector exists
  - [ ] Node/service metrics display (pending backend metrics)

---

## 4. Task Exec/Shell

**Goal**: Allow users to execute commands or open interactive shells in running task containers.

### 4.1 Backend - Container Exec

- [x] **4.1.1** Interactive Swarm task exec implemented (note: in `pkg/app/swarm_exec.go`, not `pkg/app/docker/exec.go`)
  - [x] Create/start exec with TTY and attach streaming
  - [x] Resize support via shared `ResizeShellSession()` plumbing
  - [x] Robust shell selection (defaults to `/bin/sh`, retries/fallbacks when needed)

- [ ] **4.1.2** Add Wails bindings for exec
  - [ ] `CreateContainerExec(containerID string, cmd string) (string, error)`
  - [ ] `ExecContainerCommand(containerID, command string) (string, error)` - for one-shot commands
  - [ ] Note: Interactive shell requires WebSocket, may need PTY handling

- [ ] **4.1.3** Implement exec output streaming
  - [ ] Use Wails events for streaming output: `container:exec:output`
  - [ ] Handle stdin input via `SendExecInput(execID, input string)`
  - [ ] Implement `CloseExec(execID string)`

- [ ] **4.1.4** Handle task-to-container resolution
  - [ ] `GetTaskContainerID(taskID string) (containerID, nodeID string, error)`
  - [ ] Handle remote node exec via Docker API (requires manager connectivity)

- [ ] **4.1.5** Add unit tests
  - [ ] Test exec creation
  - [ ] Test output streaming mock
  - [ ] Test error handling for stopped containers

### 4.2 Frontend - Exec UI

- [ ] **4.2.1** Create `frontend/src/docker/exec/ExecTerminal.jsx`
  - [ ] Integrate xterm.js for terminal emulation
  - [ ] Handle resize events
  - [ ] Support copy/paste
  - [ ] Theme matching app dark mode

- [ ] **4.2.2** Create `frontend/src/docker/exec/ExecModal.jsx`
  - [ ] Modal wrapper for terminal
  - [ ] Command preset selector (sh, bash, /bin/sh)
  - [ ] Full-screen toggle
  - [ ] Close/disconnect button

- [ ] **4.2.3** Create `frontend/src/docker/exec/QuickExecDropdown.jsx`
  - [ ] Quick command execution without full terminal
  - [ ] Common commands: `ps aux`, `env`, `cat /etc/hosts`
  - [ ] Custom command input
  - [ ] Output display in modal

- [ ] **4.2.4** Add exec button to task views
  - [ ] Add "Exec" button to task detail panel
  - [ ] Add "Exec" action to task context menu
  - [ ] Disable for non-running tasks with tooltip explanation

- [ ] **4.2.5** Add exec button to service views
  - [ ] Add "Exec into task" dropdown on service detail
  - [ ] List running tasks for selection

- [ ] **4.2.6** Add unit tests
  - [ ] Test ExecTerminal rendering
  - [ ] Test ExecModal open/close behavior

### 4.3 E2E Tests - Task Exec

- [x] **4.3.1** Create `e2e/tests/swarm/75-task-exec.spec.ts`
  - [x] Test opening exec from task view
  - [x] Test running a simple command
  - [x] Test closing exec session

**Notes / deviations from the original plan**

- The UI uses the existing bottom panel terminal UX (xterm.js) rather than a separate `frontend/src/docker/exec/*` feature folder.
- “Quick exec” / one-shot commands and service-level “exec into task” dropdown are not implemented yet.

---

## 5. Health Check Status Display

**Goal**: Display container health check status prominently in task lists and details.

### 5.1 Backend - Health Check Data

- [x] **5.1.1** Extend `SwarmTaskInfo` in `pkg/app/docker/types.go`
  - [x] Add `HealthStatus string` field (starting, healthy, unhealthy, none)
  - [x] Add `HealthCheckConfig *HealthCheckConfig` field
  - [x] Add `HealthLogs []HealthLogEntry` field (last N health check results)

- [x] **5.1.2** Define health check types
  - [x] Create `HealthCheckConfig` struct (test, interval, timeout, retries, startPeriod)
  - [x] Create `HealthLogEntry` struct (start, end, exitCode, output)

- [x] **5.1.3** Update `taskToInfo()` in `pkg/app/docker/tasks.go`
  - [x] Extract health status from container status
  - [x] Include health check configuration from service spec
  - [x] Fetch recent health check logs

- [x] **5.1.4** Add Wails binding
  - [x] `GetSwarmTaskHealthLogs(taskID string) []HealthLogEntry`

- [ ] **5.1.5** Add unit tests
  - [ ] Test health status extraction
  - [ ] Test health log parsing

### 5.2 Frontend - Health Status UI

- [x] **5.2.1** Create `frontend/src/docker/resources/tasks/HealthStatusBadge.jsx`
  - [x] Color-coded badge (green=healthy, yellow=starting, red=unhealthy, gray=none)
  - [x] Icon indicator
  - [x] Tooltip with last check time

- [x] **5.2.2** Update `SwarmTasksOverviewTable.jsx`
  - [x] Add "Health" column after "State"
  - [x] Use HealthStatusBadge component
  - [ ] Sortable/filterable by health status

- [x] **5.2.3** Display task health check details (note: implemented inline in `SwarmTasksOverviewTable.jsx`)
  - [x] Display health check configuration
  - [x] Show recent health check log entries
  - [x] Display failing output for unhealthy checks

- [x] **5.2.4** Add health details to task summary panel
  - [x] Add "Health Check" section to task detail view
  - [x] Show config and recent results

- [ ] **5.2.5** Add health overview to service view
  - [ ] Show aggregate health status for service
  - [ ] Count of healthy/unhealthy/starting tasks

- [ ] **5.2.6** Add unit tests
  - [ ] Test HealthStatusBadge states
  - [ ] Test HealthCheckDetails rendering

### 5.3 E2E Tests - Health Check Display

- [x] **5.3.1** Create `e2e/tests/swarm/80-health-check-display.spec.ts`
  - [x] Test health status column in tasks table
  - [x] Test health details in task panel
  - [ ] Test service aggregate health display

---

## 6. Cluster Topology Visualizer

**Goal**: Provide a visual graph showing nodes, services, and task distribution across the cluster.

### 6.1 Backend - Topology Data

- [ ] **6.1.1** Create `pkg/app/docker/topology/types.go`
  - [ ] Define `TopologyNode` struct (id, hostname, role, status, taskCount)
  - [ ] Define `TopologyService` struct (id, name, replicas, nodeDistribution)
  - [ ] Define `TopologyLink` struct (from, to, type, weight)
  - [ ] Define `ClusterTopology` struct (nodes, services, links)

- [ ] **6.1.2** Create `pkg/app/docker/topology/builder.go`
  - [ ] Implement `BuildClusterTopology() ClusterTopology`
  - [ ] Aggregate tasks per node per service
  - [ ] Calculate network connections between services
  - [ ] Include node resource utilization for sizing

- [ ] **6.1.3** Add Wails bindings
  - [ ] `GetClusterTopology() ClusterTopology`
  - [ ] `GetServiceTopology(serviceID string) ServiceTopology` (focused view)

- [ ] **6.1.4** Add unit tests
  - [ ] Test topology building with mock data
  - [ ] Test link calculation

### 6.2 Frontend - Topology Visualization

- [ ] **6.2.1** Evaluate and choose visualization library
  - [ ] Option A: D3.js force-directed graph
  - [ ] Option B: React Flow for interactive diagrams
  - [ ] Option C: vis-network for network visualization
  - [ ] Document choice rationale

- [ ] **6.2.2** Create `frontend/src/docker/topology/TopologyView.jsx`
  - [ ] Main container component
  - [ ] Canvas/SVG rendering area
  - [ ] Zoom/pan controls
  - [ ] Legend

- [ ] **6.2.3** Create `frontend/src/docker/topology/NodeCircle.jsx`
  - [ ] Render node as circle with hostname label
  - [ ] Size based on resource capacity
  - [ ] Color based on status/role
  - [ ] Hover for details tooltip

- [ ] **6.2.4** Create `frontend/src/docker/topology/ServiceBox.jsx`
  - [ ] Render service as rectangle
  - [ ] Show replica count
  - [ ] Lines to nodes where tasks run
  - [ ] Click to navigate to service details

- [ ] **6.2.5** Create `frontend/src/docker/topology/TopologyControls.jsx`
  - [ ] View mode toggle (cluster view, service focus)
  - [ ] Filter by service/node
  - [ ] Layout algorithm selector
  - [ ] Refresh button

- [ ] **6.2.6** Create `frontend/src/docker/topology/TopologyLegend.jsx`
  - [ ] Node role icons (manager, worker)
  - [ ] Node status colors
  - [ ] Service/task representation

- [ ] **6.2.7** Add sidebar entry
  - [ ] Add "Topology" section to `SwarmSidebarSections.jsx`

- [ ] **6.2.8** Add real-time updates
  - [ ] Subscribe to node/service/task events
  - [ ] Animate topology changes
  - [ ] Highlight recent changes

- [ ] **6.2.9** Add unit tests
  - [ ] Test TopologyView rendering
  - [ ] Test node/service component rendering
  - [ ] Test control interactions

### 6.3 E2E Tests - Topology Visualizer

- [ ] **6.3.1** Create `e2e/tests/swarm/85-topology-visualizer.spec.ts`
  - [ ] Test topology view loads
  - [ ] Test nodes are displayed
  - [ ] Test zoom/pan controls
  - [ ] Test navigation to node/service details

---

## Implementation Order Recommendation

Based on dependencies and value delivery:

1. **Phase 1 - Foundation** (Weeks 1-2)
   - Health Check Display (quick win, no dependencies)
   - Task Exec/Shell (high user value, self-contained)

2. **Phase 2 - Registry** (Weeks 3-5)
   - Registry Integration (foundation for image updates)
   - Image Update Detection (requires registry)

3. **Phase 3 - Observability** (Weeks 6-8)
   - Metrics Dashboard (high value, complex)
   - Cluster Topology Visualizer (optional, complex)

---

## Testing Requirements

All features must meet these criteria before merging:

- [ ] Go unit tests: 70%+ coverage for new code
- [ ] Frontend unit tests: 70%+ coverage for new components
- [ ] E2E tests: At least one happy-path test per feature
- [ ] All tests pass in GitHub CI pipeline
- [ ] Manual testing on Windows (primary platform)
- [ ] Manual testing on macOS (if available)

---

## References

- [Portainer Documentation - Services](https://docs.portainer.io/user/docker/services)
- [Swarmpit GitHub](https://github.com/swarmpit/swarmpit)
- [Docker Engine API - Container Stats](https://docs.docker.com/engine/api/v1.41/#tag/Container/operation/ContainerStats)
- [Docker Registry HTTP API V2](https://docs.docker.com/registry/spec/api/)
- [AWS ECR API Reference](https://docs.aws.amazon.com/AmazonECR/latest/APIReference/Welcome.html)

