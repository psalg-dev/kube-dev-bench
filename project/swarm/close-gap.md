# Docker Swarm Feature Gap Implementation Plan

This document outlines the implementation plan for closing feature gaps between KubeDevBench and competing Docker Swarm management tools (Portainer, Swarmpit).

## Overview

| Feature | Priority | Effort | Dependencies |
|---------|----------|--------|--------------|
| Registry Integration | High | Large | None |
| Image Update Detection | High | Medium | Registry Integration |
| Metrics Dashboard | High | Large | None |
| Task Exec/Shell | Medium | Medium | None |
| Health Check Display | Medium | Small | None |
| Cluster Topology Visualizer | Low | Large | None |

---

## 1. Registry Integration

**Goal**: Allow users to configure and browse Docker registries (Docker Hub, ECR, ACR, GitLab) for image selection and update detection.

### 1.1 Backend - Registry Types & Configuration

- [ ] **1.1.1** Create `pkg/app/docker/registry/types.go`
  - [ ] Define `RegistryConfig` struct (name, url, type, auth credentials)
  - [ ] Define `RegistryType` enum (dockerhub, ecr, acr, gitlab, generic_v2)
  - [ ] Define `RegistryImage` struct (name, tags[], digest, lastUpdated)
  - [ ] Define `RegistryCredentials` struct (username, password/token, region for ECR)

- [ ] **1.1.2** Create `pkg/app/docker/registry/client.go`
  - [ ] Implement `RegistryClient` interface with `ListRepositories()`, `ListTags()`, `GetManifest()`
  - [ ] Implement Docker Hub client (using registry.hub.docker.com API)
  - [ ] Implement generic Docker Registry v2 client
  - [ ] Add HTTP client with configurable timeout and TLS settings

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

- [ ] **1.1.6** Add unit tests for registry clients
  - [ ] Test Docker Hub client with mock server
  - [ ] Test v2 registry client with mock server
  - [ ] Test credential validation
  - [ ] Aim for 70%+ coverage

### 1.2 Backend - Registry Persistence & Wails Bindings

- [ ] **1.2.1** Create `pkg/app/docker/registry/storage.go`
  - [ ] Implement secure credential storage (OS keychain integration or encrypted file)
  - [ ] Add `SaveRegistry()`, `GetRegistries()`, `DeleteRegistry()` functions
  - [ ] Store registries in `~/KubeDevBench/registries.json` (credentials encrypted)

- [ ] **1.2.2** Add Wails bindings in `pkg/app/docker_integration.go`
  - [ ] `GetRegistries() []RegistryConfig`
  - [ ] `AddRegistry(config RegistryConfig) error`
  - [ ] `RemoveRegistry(name string) error`
  - [ ] `TestRegistryConnection(config RegistryConfig) error`
  - [ ] `ListRegistryRepositories(registryName string) []string`
  - [ ] `ListRegistryTags(registryName, repository string) []string`
  - [ ] `GetImageDigest(registryName, repository, tag string) string`

- [ ] **1.2.3** Add unit tests for Wails bindings
  - [ ] Test registry CRUD operations
  - [ ] Test error handling for invalid configs

### 1.3 Frontend - Registry Configuration UI

- [ ] **1.3.1** Create `frontend/src/docker/registry/RegistryStateContext.jsx`
  - [ ] Create context for registry list state
  - [ ] Add loading/error states
  - [ ] Implement `useRegistries()` hook

- [ ] **1.3.2** Create `frontend/src/docker/registry/RegistryList.jsx`
  - [ ] Display configured registries in a list
  - [ ] Show connection status indicator per registry
  - [ ] Add delete button with confirmation

- [ ] **1.3.3** Create `frontend/src/docker/registry/AddRegistryModal.jsx`
  - [ ] Form with registry type selector (Docker Hub, ECR, ACR, GitLab, Custom)
  - [ ] Dynamic form fields based on registry type
  - [ ] Test connection button before saving
  - [ ] Validation for required fields

- [ ] **1.3.4** Create `frontend/src/docker/registry/RegistryBrowser.jsx`
  - [ ] Tree view of repositories within a registry
  - [ ] Tag list for selected repository
  - [ ] Search/filter functionality
  - [ ] "Use this image" action to populate service create/update forms

- [ ] **1.3.5** Add sidebar entry for Registries
  - [ ] Add "Registries" section to `SwarmSidebarSections.jsx`
  - [ ] Show count of configured registries

- [ ] **1.3.6** Add unit tests for registry components
  - [ ] Test RegistryList rendering
  - [ ] Test AddRegistryModal form validation
  - [ ] Test RegistryBrowser navigation

### 1.4 E2E Tests - Registry Integration

- [ ] **1.4.1** Create `e2e/tests/swarm/60-registry-config.spec.ts`
  - [ ] Test adding a registry configuration
  - [ ] Test registry connection validation
  - [ ] Test removing a registry

---

## 2. Image Update Detection

**Goal**: Detect when service images have newer versions available in the registry and provide visual indicators.

### 2.1 Backend - Image Version Checking

- [ ] **2.1.1** Create `pkg/app/docker/registry/update_checker.go`
  - [ ] Implement `CheckImageUpdate(image string) (*ImageUpdateInfo, error)`
  - [ ] Parse image reference (registry/repo:tag or repo@digest)
  - [ ] Compare local digest vs remote digest
  - [ ] Handle rate limiting for registry API calls

- [ ] **2.1.2** Extend `SwarmServiceInfo` in `pkg/app/docker/types.go`
  - [ ] Add `ImageUpdateAvailable bool` field
  - [ ] Add `ImageLocalDigest string` field
  - [ ] Add `ImageRemoteDigest string` field
  - [ ] Add `ImageCheckedAt string` field

- [ ] **2.1.3** Add update checking to service polling
  - [ ] Create background goroutine for periodic image update checks
  - [ ] Configurable check interval (default: 5 minutes)
  - [ ] Cache results to avoid excessive API calls
  - [ ] Emit `swarm:image:updates` event when updates detected

- [ ] **2.1.4** Add Wails bindings
  - [ ] `CheckServiceImageUpdates(serviceIDs []string) map[string]ImageUpdateInfo`
  - [ ] `GetImageUpdateSettings() ImageUpdateSettings`
  - [ ] `SetImageUpdateSettings(settings ImageUpdateSettings) error`

- [ ] **2.1.5** Add unit tests
  - [ ] Test digest comparison logic
  - [ ] Test image reference parsing
  - [ ] Test cache behavior

### 2.2 Frontend - Update Indicators

- [ ] **2.2.1** Update `SwarmServicesOverviewTable.jsx`
  - [ ] Add "Update Available" column with icon indicator
  - [ ] Green checkmark = up to date
  - [ ] Orange warning = update available
  - [ ] Gray dash = unable to check
  - [ ] Tooltip with digest info on hover

- [ ] **2.2.2** Create `frontend/src/docker/resources/services/ImageUpdateBadge.jsx`
  - [ ] Reusable component for update indicator
  - [ ] Click action to show update details modal
  - [ ] "Update Now" quick action button

- [ ] **2.2.3** Create `frontend/src/docker/resources/services/ImageUpdateModal.jsx`
  - [ ] Show current vs available image info
  - [ ] Display changelog/release notes if available
  - [ ] Confirm update button
  - [ ] Option to update all services using this image

- [ ] **2.2.4** Add settings for image update checking
  - [ ] Add toggle to enable/disable auto-check
  - [ ] Add interval configuration
  - [ ] Add per-registry enable/disable

- [ ] **2.2.5** Add unit tests
  - [ ] Test ImageUpdateBadge states
  - [ ] Test ImageUpdateModal actions

### 2.3 E2E Tests - Image Update Detection

- [ ] **2.3.1** Create `e2e/tests/swarm/65-image-updates.spec.ts`
  - [ ] Test update indicator display
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

- [ ] **3.1.2** Create `pkg/app/docker/metrics/collector.go`
  - [ ] Implement container stats collection using Docker API `ContainerStats()`
  - [ ] Implement node-level aggregation
  - [ ] Calculate CPU percentage from stats delta
  - [ ] Handle per-service aggregation

- [ ] **3.1.3** Create `pkg/app/docker/metrics/history.go`
  - [ ] Implement in-memory metrics history buffer (ring buffer)
  - [ ] Configurable retention period (default: 1 hour)
  - [ ] Downsample old data points for longer history

- [ ] **3.1.4** Add Wails bindings in `pkg/app/docker_integration.go`
  - [ ] `GetNodeMetrics(nodeID string) NodeMetrics`
  - [ ] `GetServiceMetrics(serviceID string) []ContainerMetrics`
  - [ ] `GetClusterMetrics() ClusterMetrics`
  - [ ] `GetMetricsHistory(resourceType, resourceID string, duration time.Duration) MetricsHistory`

- [ ] **3.1.5** Add metrics polling
  - [ ] Create `StartMetricsPolling()` with configurable interval (default: 5s)
  - [ ] Emit `swarm:metrics:update` event with current metrics
  - [ ] Emit `swarm:metrics:history` event periodically with history data

- [ ] **3.1.6** Add unit tests
  - [ ] Test CPU calculation from stats
  - [ ] Test memory percentage calculation
  - [ ] Test history buffer behavior

### 3.2 Frontend - Metrics Dashboard UI

- [ ] **3.2.1** Create `frontend/src/docker/metrics/MetricsStateContext.jsx`
  - [ ] Context for real-time metrics data
  - [ ] Subscribe to `swarm:metrics:update` events
  - [ ] Provide hooks: `useNodeMetrics()`, `useServiceMetrics()`, `useClusterMetrics()`

- [ ] **3.2.2** Create `frontend/src/docker/metrics/MetricsDashboard.jsx`
  - [ ] Main dashboard view with cluster overview
  - [ ] Grid layout with key metrics cards
  - [ ] Time range selector for historical data

- [ ] **3.2.3** Create `frontend/src/docker/metrics/MetricsChart.jsx`
  - [ ] Reusable chart component using lightweight chart library (e.g., uPlot or Chart.js)
  - [ ] Support line charts for time-series data
  - [ ] Support bar charts for comparison views
  - [ ] Responsive sizing

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

- [ ] **3.2.8** Add unit tests
  - [ ] Test MetricsChart rendering
  - [ ] Test MetricsDashboard layout
  - [ ] Test data transformation for charts

### 3.3 E2E Tests - Metrics Dashboard

- [ ] **3.3.1** Create `e2e/tests/swarm/70-metrics-dashboard.spec.ts`
  - [ ] Test metrics dashboard loads
  - [ ] Test node metrics display
  - [ ] Test service metrics display
  - [ ] Test time range selection

---

## 4. Task Exec/Shell

**Goal**: Allow users to execute commands or open interactive shells in running task containers.

### 4.1 Backend - Container Exec

- [ ] **4.1.1** Create `pkg/app/docker/exec.go`
  - [ ] Implement `CreateExec(containerID string, cmd []string) (execID string, error)`
  - [ ] Implement `StartExec(execID string) (io.ReadWriteCloser, error)`
  - [ ] Implement `ResizeExec(execID string, height, width uint) error`
  - [ ] Handle TTY allocation

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

- [ ] **4.3.1** Create `e2e/tests/swarm/75-task-exec.spec.ts`
  - [ ] Test opening exec modal from task view
  - [ ] Test running a simple command
  - [ ] Test closing exec session

---

## 5. Health Check Status Display

**Goal**: Display container health check status prominently in task lists and details.

### 5.1 Backend - Health Check Data

- [ ] **5.1.1** Extend `SwarmTaskInfo` in `pkg/app/docker/types.go`
  - [ ] Add `HealthStatus string` field (starting, healthy, unhealthy, none)
  - [ ] Add `HealthCheckConfig *HealthCheckConfig` field
  - [ ] Add `HealthLogs []HealthLogEntry` field (last N health check results)

- [ ] **5.1.2** Define health check types
  - [ ] Create `HealthCheckConfig` struct (test, interval, timeout, retries, startPeriod)
  - [ ] Create `HealthLogEntry` struct (start, end, exitCode, output)

- [ ] **5.1.3** Update `taskToInfo()` in `pkg/app/docker/tasks.go`
  - [ ] Extract health status from container status
  - [ ] Include health check configuration from service spec
  - [ ] Fetch recent health check logs

- [ ] **5.1.4** Add Wails binding
  - [ ] `GetTaskHealthLogs(taskID string) []HealthLogEntry`

- [ ] **5.1.5** Add unit tests
  - [ ] Test health status extraction
  - [ ] Test health log parsing

### 5.2 Frontend - Health Status UI

- [ ] **5.2.1** Create `frontend/src/docker/resources/tasks/HealthStatusBadge.jsx`
  - [ ] Color-coded badge (green=healthy, yellow=starting, red=unhealthy, gray=none)
  - [ ] Icon indicator
  - [ ] Tooltip with last check time

- [ ] **5.2.2** Update `SwarmTasksOverviewTable.jsx`
  - [ ] Add "Health" column after "State"
  - [ ] Use HealthStatusBadge component
  - [ ] Sortable/filterable by health status

- [ ] **5.2.3** Create `frontend/src/docker/resources/tasks/HealthCheckDetails.jsx`
  - [ ] Display health check configuration
  - [ ] Show recent health check log entries
  - [ ] Display failing output for unhealthy checks

- [ ] **5.2.4** Add health details to task summary panel
  - [ ] Add "Health Check" section to task detail view
  - [ ] Show config and recent results

- [ ] **5.2.5** Add health overview to service view
  - [ ] Show aggregate health status for service
  - [ ] Count of healthy/unhealthy/starting tasks

- [ ] **5.2.6** Add unit tests
  - [ ] Test HealthStatusBadge states
  - [ ] Test HealthCheckDetails rendering

### 5.3 E2E Tests - Health Check Display

- [ ] **5.3.1** Create `e2e/tests/swarm/80-health-check-display.spec.ts`
  - [ ] Test health status column in tasks table
  - [ ] Test health details in task panel
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
