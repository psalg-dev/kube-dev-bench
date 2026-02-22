---
agent: agent
---
## Abstract
Since this application is concerned with containers, we want to support
more container runtimes than just kubernetes. 
The application should also support managing Docker Swarm clusters.

## Agent Instructions
You are an expert software developer tasked with extending an existing application that manages Kubernetes clusters to also support Docker Swarm clusters.
Your goal is to implement the necessary features to allow users to connect to, view, and manage Docker Swarm clusters in a manner similar to how they currently manage Kubernetes clusters. 
You will need to:
1. Research the Docker Swarm API and its capabilities.
2. Design and implement a connection wizard for Docker Swarm clusters.
3. Create resource views for Docker Swarm resources such as services, nodes, tasks, and networks.
4. Ensure that the user interface is consistent with the existing Kubernetes management features. 
5. Implement notifications and feedback mechanisms for user actions related to Docker Swarm.
6. Test the new features thoroughly to ensure reliability and usability.

## Acceptance Criteria
- Users can connect to Docker Swarm clusters using a connection wizard.
- Resource views for Docker Swarm resources are implemented and follow the same interaction patterns as Kubernetes resources
- Resource views for Docker Swarm have a plus button which allows for ad-hoc resource creation where applicable.
- The user interface clearly distinguishes between Kubernetes and Docker Swarm resources.
- Notifications are displayed for user actions related to Docker Swarm.
- New Code is unit tested and the feature as a whole is end-to-end tested.
- Documentation is updated to reflect the new Docker Swarm support.

---

# Implementation Plan

## Architecture Decision: Dual Platform Coexistence

The application will display **both Kubernetes and Docker Swarm resources simultaneously** in the UI:
- The sidebar will have two sections: **Kubernetes** and **Docker Swarm**
- Each platform has independent connection state, wizard, and resource polling
- Users can manage both platforms from a single interface without mode switching

## Swarm Resources (Full Coverage)

| Swarm Resource | K8s Equivalent | Description |
|----------------|----------------|-------------|
| Services | Deployments | Long-running containerized workloads |
| Tasks | Pods | Individual container instances |
| Nodes | Nodes | Cluster member machines |
| Networks | - | Overlay and bridge networks |
| Configs | ConfigMaps | Non-sensitive configuration data |
| Secrets | Secrets | Sensitive configuration data |
| Stacks | - | Multi-service deployments (compose) |

## Implementation Phases

### Phase 1: Backend Foundation

**Goal**: Establish Docker client infrastructure

**Files to create:**
- `pkg/app/docker/client.go` - Docker client factory with socket/TCP/TLS support
- `pkg/app/docker/types.go` - Swarm resource info structs

**Files to modify:**
- `pkg/app/app_lifecycle.go` - Add `dockerClient *client.Client` field
- `pkg/app/config.go` - Add Docker connection config (host, TLS paths)
- `go.mod` - Add `github.com/docker/docker` dependency

**Key implementation:**
```go
// Docker connection supports multiple transports
type DockerConfig struct {
    Host     string // unix:///var/run/docker.sock or tcp://host:port
    TLSCert  string // Path to TLS certificate
    TLSKey   string // Path to TLS key
    TLSCA    string // Path to CA certificate
}
```

### Phase 2: Swarm Resource Handlers

**Goal**: Implement Go handlers for all Swarm resources

**Create in `pkg/app/docker/`:**

| File | Purpose |
|------|---------|
| `services.go` | `GetSwarmServices()`, service CRUD |
| `tasks.go` | `GetSwarmTasks()`, task inspection |
| `nodes.go` | `GetSwarmNodes()`, node management |
| `networks.go` | `GetSwarmNetworks()`, network CRUD |
| `configs.go` | `GetSwarmConfigs()`, config CRUD |
| `secrets.go` | `GetSwarmSecrets()`, secret CRUD |
| `stacks.go` | `GetSwarmStacks()`, stack listing |
| `polling.go` | `StartSwarm*Polling()` goroutines |
| `actions.go` | Scale, update, remove operations |

**Each file must have corresponding `*_test.go` with 70%+ coverage.**

### Phase 3: Frontend Connection

**Goal**: Enable Docker Swarm connection from UI

**Create:**
- `frontend/src/docker/SwarmConnectionWizard.jsx` - Multi-step connection wizard
  - Auto-detect local Docker socket
  - TCP host:port input with TLS toggle
  - Connection test feedback
- `frontend/src/state/SwarmStateContext.jsx` - Swarm connection state
- `frontend/src/state/SwarmResourceCountsContext.jsx` - Real-time Swarm counts
- `frontend/src/docker/swarmApi.js` - Wails bindings re-export layer

**Modify:**
- `frontend/src/layout/AppContainer.jsx` - Add Swarm state providers
- `frontend/src/layout/connection/ConnectionWizard.jsx` - Platform selection tabs

### Phase 4: Swarm Resource Views

**Goal**: Create UI components for viewing Swarm resources

**Create in `frontend/src/docker/resources/`:**

```
services/
  ServicesOverviewTable.jsx     # Service list with replicas, image, ports
  ServiceDetailTab.jsx          # Service summary
  ServiceTasksTab.jsx           # Tasks belonging to service
  ServiceScaleDialog.jsx        # Scale replicas dialog

tasks/
  TasksOverviewTable.jsx        # Task list with state, node, container
  TaskSummaryTab.jsx            # Task details
  TaskLogsTab.jsx               # Container log streaming

nodes/
  NodesOverviewTable.jsx        # Node list with role, availability, state
  NodeDetailTab.jsx             # Node resources and labels

networks/
  NetworksOverviewTable.jsx     # Network list with driver, scope
  NetworkDetailTab.jsx          # Network configuration

configs/
  ConfigsOverviewTable.jsx      # Config list
  ConfigDataTab.jsx             # Config content viewer

secrets/
  SecretsOverviewTable.jsx      # Secret list (metadata only)

stacks/
  StacksOverviewTable.jsx       # Stack list
  StackServicesTab.jsx          # Services in stack
```

**Modify:**
- `frontend/src/layout/SidebarSections.jsx` - Add Docker Swarm section
- `frontend/src/main-content.js` - Route Swarm resource views

### Phase 5: Actions & Operations

**Goal**: Enable user actions on Swarm resources

| Action | Applies To | Implementation |
|--------|------------|----------------|
| Scale | Services | `ScaleSwarmService(id, replicas)` |
| Update | Services | `UpdateSwarmService(id, spec)` |
| Remove | Services, Networks, Configs, Secrets | `RemoveSwarm*(id)` |
| Drain/Activate | Nodes | `UpdateSwarmNode(id, availability)` |
| View Logs | Tasks | `StreamTaskLogs(taskID)` |

**UI patterns:** Use existing `ResourceActions.jsx` component pattern with confirmation dialogs.

### Phase 6: Testing

**Goal**: Achieve 70%+ coverage and E2E tests

**Go unit tests:**
- Create mock Docker client implementing `client.APIClient` interface
- Table-driven tests following existing patterns in `pkg/app/*_test.go`

**Frontend unit tests:**
- Extend `frontend/src/__tests__/wailsMocks.js`:
```javascript
const swarmFunctionNames = [
  'GetSwarmServices', 'GetSwarmTasks', 'GetSwarmNodes',
  'GetSwarmNetworks', 'GetSwarmConfigs', 'GetSwarmSecrets',
  'ScaleSwarmService', 'GetDockerConnectionStatus',
  'ConnectToDocker', 'TestDockerConnection',
];
```

**E2E tests:**
Create `e2e/tests/swarm/`:
- `00-connect-to-swarm.spec.ts` - Connection wizard flow
- `10-view-services.spec.ts` - Services table and details
- `20-scale-service.spec.ts` - Scale operation
- `30-view-tasks-logs.spec.ts` - Tasks and log streaming
- `40-manage-nodes.spec.ts` - Node list and drain/activate

**Test infrastructure:**
- Use Docker-in-Docker with Swarm mode for E2E tests
- Create `e2e/src/support/dind-swarm.ts` for test cluster setup

### Phase 7: Documentation

**Goal**: Update documentation

- Update `README.md` with Docker Swarm features
- Update `CLAUDE.md` with Swarm architecture notes
- Add inline code documentation

---

## Type Definitions

### Go Types (`pkg/app/docker/types.go`)

```go
package docker

// SwarmServiceInfo describes a Swarm service
type SwarmServiceInfo struct {
    ID            string            `json:"id"`
    Name          string            `json:"name"`
    Image         string            `json:"image"`
    Replicas      uint64            `json:"replicas"`
    RunningTasks  uint64            `json:"runningTasks"`
    Mode          string            `json:"mode"` // "replicated" or "global"
    Ports         []SwarmPortInfo   `json:"ports"`
    Labels        map[string]string `json:"labels"`
    CreatedAt     string            `json:"createdAt"`
    UpdatedAt     string            `json:"updatedAt"`
}

// SwarmPortInfo describes a published port
type SwarmPortInfo struct {
    Protocol      string `json:"protocol"`
    TargetPort    uint32 `json:"targetPort"`
    PublishedPort uint32 `json:"publishedPort"`
    PublishMode   string `json:"publishMode"`
}

// SwarmTaskInfo describes a Swarm task (container instance)
type SwarmTaskInfo struct {
    ID           string `json:"id"`
    ServiceID    string `json:"serviceId"`
    ServiceName  string `json:"serviceName"`
    NodeID       string `json:"nodeId"`
    NodeName     string `json:"nodeName"`
    Slot         int    `json:"slot"`
    State        string `json:"state"`        // running, pending, failed, etc.
    DesiredState string `json:"desiredState"`
    ContainerID  string `json:"containerId"`
    Error        string `json:"error"`
    CreatedAt    string `json:"createdAt"`
    UpdatedAt    string `json:"updatedAt"`
}

// SwarmNodeInfo describes a Swarm node
type SwarmNodeInfo struct {
    ID            string            `json:"id"`
    Hostname      string            `json:"hostname"`
    Role          string            `json:"role"`         // "manager" or "worker"
    Availability  string            `json:"availability"` // "active", "pause", "drain"
    State         string            `json:"state"`        // "ready", "down", etc.
    Address       string            `json:"address"`
    EngineVersion string            `json:"engineVersion"`
    Labels        map[string]string `json:"labels"`
    Leader        bool              `json:"leader"`
}

// SwarmNetworkInfo describes a Swarm network
type SwarmNetworkInfo struct {
    ID         string            `json:"id"`
    Name       string            `json:"name"`
    Driver     string            `json:"driver"`
    Scope      string            `json:"scope"` // "swarm", "local"
    Attachable bool              `json:"attachable"`
    Internal   bool              `json:"internal"`
    Labels     map[string]string `json:"labels"`
    CreatedAt  string            `json:"createdAt"`
}

// SwarmConfigInfo describes a Swarm config
type SwarmConfigInfo struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    CreatedAt string `json:"createdAt"`
    UpdatedAt string `json:"updatedAt"`
    DataSize  int    `json:"dataSize"` // Size in bytes
}

// SwarmSecretInfo describes a Swarm secret
type SwarmSecretInfo struct {
    ID        string `json:"id"`
    Name      string `json:"name"`
    CreatedAt string `json:"createdAt"`
    UpdatedAt string `json:"updatedAt"`
}

// SwarmStackInfo describes a Docker Stack
type SwarmStackInfo struct {
    Name         string `json:"name"`
    Services     int    `json:"services"`
    Orchestrator string `json:"orchestrator"` // "Swarm"
}

// SwarmResourceCounts for sidebar display
type SwarmResourceCounts struct {
    Services int `json:"services"`
    Tasks    int `json:"tasks"`
    Nodes    int `json:"nodes"`
    Networks int `json:"networks"`
    Configs  int `json:"configs"`
    Secrets  int `json:"secrets"`
    Stacks   int `json:"stacks"`
}

// DockerConnectionStatus for connection state
type DockerConnectionStatus struct {
    Connected     bool   `json:"connected"`
    SwarmActive   bool   `json:"swarmActive"`
    NodeID        string `json:"nodeId"`
    IsManager     bool   `json:"isManager"`
    ServerVersion string `json:"serverVersion"`
    Error         string `json:"error"`
}
```

---

## Wails Event Pattern

Following existing patterns from `pkg/app/deployments.go`:

```go
// StartSwarmServicePolling emits swarm:services:update events
func (a *App) StartSwarmServicePolling() {
    go func() {
        for {
            time.Sleep(time.Second)
            if a.ctx == nil || a.dockerClient == nil {
                continue
            }
            services, err := a.GetSwarmServices()
            if err != nil {
                continue
            }
            wailsRuntime.EventsEmit(a.ctx, "swarm:services:update", services)
        }
    }()
}

// Similar polling functions for:
// - swarm:tasks:update
// - swarm:nodes:update
// - swarm:networks:update
// - swarm:configs:update
// - swarm:secrets:update
// - swarm:resourcecounts:update
```

---

## File Organization Summary

### New Backend Files

```
pkg/app/docker/
├── client.go           # Docker client factory
├── client_test.go
├── types.go            # All Swarm type definitions
├── services.go         # Service operations
├── services_test.go
├── tasks.go            # Task operations
├── tasks_test.go
├── nodes.go            # Node operations
├── nodes_test.go
├── networks.go         # Network operations
├── networks_test.go
├── configs.go          # Config operations
├── configs_test.go
├── secrets.go          # Secret operations
├── secrets_test.go
├── stacks.go           # Stack operations
├── stacks_test.go
├── polling.go          # Polling goroutines
├── polling_test.go
├── actions.go          # Scale, update, remove
└── actions_test.go
```

### Modified Backend Files

| File | Changes |
|------|---------|
| `pkg/app/app_lifecycle.go` | Add `dockerClient` field, Docker startup |
| `pkg/app/config.go` | Add Docker connection settings |
| `main.go` | Add Swarm polling starters |
| `go.mod` | Add Docker SDK dependency |

### New Frontend Files

```
frontend/src/docker/
├── SwarmConnectionWizard.jsx
├── swarmApi.js
└── resources/
    ├── services/
    │   ├── ServicesOverviewTable.jsx
    │   ├── ServiceDetailTab.jsx
    │   ├── ServiceTasksTab.jsx
    │   └── ServiceScaleDialog.jsx
    ├── tasks/
    │   ├── TasksOverviewTable.jsx
    │   ├── TaskSummaryTab.jsx
    │   └── TaskLogsTab.jsx
    ├── nodes/
    │   ├── NodesOverviewTable.jsx
    │   └── NodeDetailTab.jsx
    ├── networks/
    │   ├── NetworksOverviewTable.jsx
    │   └── NetworkDetailTab.jsx
    ├── configs/
    │   ├── ConfigsOverviewTable.jsx
    │   └── ConfigDataTab.jsx
    ├── secrets/
    │   └── SecretsOverviewTable.jsx
    └── stacks/
        ├── StacksOverviewTable.jsx
        └── StackServicesTab.jsx

frontend/src/state/
├── SwarmStateContext.jsx
└── SwarmResourceCountsContext.jsx
```

### Modified Frontend Files

| File | Changes |
|------|---------|
| `frontend/src/layout/SidebarSections.jsx` | Add Docker Swarm resource section |
| `frontend/src/layout/AppContainer.jsx` | Add Swarm state providers |
| `frontend/src/layout/connection/ConnectionWizard.jsx` | Platform selection |
| `frontend/src/main-content.js` | Route Swarm resource views |
| `frontend/src/__tests__/wailsMocks.js` | Add Swarm function mocks |

### New E2E Test Files

```
e2e/
├── src/
│   ├── support/
│   │   ├── dind-swarm.ts       # Docker-in-Docker Swarm setup
│   │   └── swarm-bootstrap.ts  # Swarm test helpers
│   └── pages/
│       ├── SwarmSidebar.ts
│       ├── SwarmServiceDetails.ts
│       └── SwarmConnectionWizard.ts
└── tests/
    └── swarm/
        ├── 00-connect-to-swarm.spec.ts
        ├── 10-view-services.spec.ts
        ├── 20-scale-service.spec.ts
        ├── 30-view-tasks-logs.spec.ts
        ├── 40-manage-nodes.spec.ts
        └── 50-manage-configs-secrets.spec.ts
```

---

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Docker SDK version compatibility | Pin to stable version, test against Docker 20.10+ |
| Windows named pipe handling | Use Docker SDK's built-in transport negotiation |
| Remote Docker TLS complexity | Provide clear UI guidance, support common cert paths |
| E2E test infrastructure | Use dind (Docker-in-Docker) with Swarm mode |
| UI complexity with dual platforms | Clear visual separation in sidebar, consistent patterns |

---

## Success Metrics

1. Users can connect to local and remote Docker Swarm clusters
2. All 7 Swarm resource types viewable with details
3. Service scaling and basic operations functional
4. Notifications display for all user actions
5. Unit test coverage >= 70% for new code
6. E2E tests cover connection and core resource views
7. Documentation updated with Swarm features