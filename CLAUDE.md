# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KubeDevBench is a desktop Kubernetes and Docker Swarm client built with a Go backend (Wails framework) and React frontend (Vite). It provides features for managing Kubernetes clusters including pod management, deployments, cronjobs, and resource operations. It also supports Docker Swarm cluster management with services, tasks, nodes, and related resources.

## Commands

### Development
```bash
wails dev                          # Start dev mode (Go backend + Vite dev server)
cd frontend && npm run dev         # Frontend-only development
```

### Build
```bash
wails build                        # Build production app
```

### Testing
```bash
# Frontend unit tests (Vitest)
cd frontend && npm test

# Run a single test file
cd frontend && npm test -- path/to/test.test.jsx

# E2E tests (Playwright) - requires Docker for KinD cluster
cd e2e && npm install && npx playwright install && npx playwright test

# Go unit tests
go test ./pkg/app/...

# Go unit tests with coverage
go test -cover ./pkg/app/...                      # Show coverage percentage
go test -coverprofile=coverage.out ./pkg/app/...  # Generate coverage profile
go tool cover -html=coverage.out                  # Open HTML coverage report
go tool cover -func=coverage.out                  # Show per-function coverage
```

### KinD Cluster for Testing
```bash
cd kind && docker compose up -d    # Start KinD cluster
docker compose exec kind kubectl get nodes  # Verify cluster
```

### Docker Swarm E2E Tests
```bash
# Run all Swarm E2E tests (requires Docker with Swarm mode enabled)
cd e2e && npx playwright test tests/swarm/

# Run a specific Swarm test
cd e2e && npx playwright test tests/swarm/10-view-services.spec.ts

# Initialize Swarm mode if not already active
docker swarm init --advertise-addr 127.0.0.1 2>/dev/null || true
```

## Architecture

### Backend (Go)
- `main.go` - Wails application entry point, starts polling for K8s resources
- `pkg/app/` - Core application logic, K8s API integrations, and Wails-exposed methods
  - Resource handlers: `pods.go`, `deployments.go`, `cronjobs.go`, `statefulsets.go`, etc.
  - Holmes AI: `holmes_context.go` for context enrichment, `holmes_integration.go` for analysis RPCs
  - Holmes AI (Phase 4): `holmes_logs.go` for log analysis helpers, `holmes_swarm.go` for Swarm context analysis
  - Monitoring: `monitor.go` for continuous issue polling, `monitor_actions.go` for scan/analysis/dismiss actions
  - Prometheus alerts: `holmes_alerts.go` for alert fetching + Holmes investigations
  - `kubeconfig.go` - Kubeconfig management
  - `resource_actions.go` - Scale, restart, delete operations
  - `types.go` - Shared type definitions
  - `docker_integration.go` - Docker Swarm integration with Wails bindings
- `pkg/app/docker/` - Docker Swarm client and handlers
  - `client.go` - Docker client factory with socket/TCP/TLS support
  - `types.go` - Docker Swarm type definitions
  - Resource handlers: `services.go`, `tasks.go`, `nodes.go`, `networks.go`, `configs.go`, `secrets.go`, `stacks.go`, `volumes.go`, `logs.go`

### Frontend (React)
- `frontend/src/state/ClusterStateContext.tsx` - Central cluster connection state management
- `frontend/src/layout/` - UI layout components
  - `AppLayout.tsx` - Main app layout with stable DOM ids for testing
  - `MonitorPanel.tsx` - Bottom monitoring panel (errors, warnings, Prometheus alerts)
  - `MonitorIssueCard.tsx` - Issue card with Holmes analysis + dismissal
  - `PrometheusAlertsTab.tsx` - Prometheus alert investigation UI
  - `connection/` - Unified connection management UI (refactored)
    - `ConnectionWizard.tsx` - Main connection wizard container using shared layout
    - `ConnectionsStateContext.tsx` - Centralized state for Kubernetes and Docker connections, pinned connections, and proxy settings
    - `ConnectionsSidebar.tsx` - Sidebar with "Kubernetes", "Docker Swarm", and pinned sections with counts
    - `ConnectionsMainView.tsx` - Main content area showing connection lists per section
    - `KubernetesConnectionsList.tsx` - Lists discovered kubeconfig files with connect/pin actions
    - `DockerSwarmConnectionsList.tsx` - Lists detected Docker Swarm connections
    - `AddKubeConfigOverlay.tsx` - Overlay for adding new kubeconfig (paste or browse)
    - `AddSwarmConnectionOverlay.tsx` - Overlay for manually adding Docker Swarm connections
    - `ConnectionProxySettings.tsx` - Per-connection proxy configuration
- `frontend/src/k8s/resources/` - K8s resource view components
- `frontend/src/holmes/` - Holmes AI UI (panel, config modal, response renderer, resource analysis tabs)
- `frontend/src/layout/bottompanel/LogViewerTab.tsx` - Pod log viewer with Holmes “Explain Logs” analysis
- `frontend/src/docker/` - Docker Swarm frontend components
  - `SwarmStateContext.tsx` - Docker connection and resource state management
  - `SwarmResourceCountsContext.tsx` - Resource counts context
  - `SwarmConnectionWizard.tsx` - Docker connection wizard (legacy, being replaced)
  - `SwarmSidebarSections.tsx` - Sidebar navigation for Swarm resources
  - `swarmApi.ts` - API wrapper for Docker Swarm Wails bindings
  - `resources/` - Swarm resource view components (services, tasks, nodes, networks, configs, secrets, stacks, volumes)
- `frontend/wailsjs/go/main/App.js` - Auto-generated Wails bindings (frontend calls Go functions here)

### Frontend Utilities
- `frontend/src/utils/timeUtils.ts` - Time formatting utilities (relative time, durations, etc.)

### Frontend-Backend Communication
Frontend calls Go functions via Wails bindings at `frontend/wailsjs/go/main/App`. Key RPCs:

Kubernetes:
- `SavePrimaryKubeConfig`, `SetKubeConfigPath` - Kubeconfig management
- `GetConnectionStatus`, `GetKubeConfigs` - Connection state
- `GetProxyConfig`, `SetProxyConfig`, `DetectSystemProxy` - Proxy configuration
- Resource operations exposed per resource type

Docker Swarm (via `docker_integration.go`):
- `GetDockerConnectionStatus`, `TestDockerConnection`, `ConnectToDocker` - Connection management
- `GetDefaultDockerHost` - Platform-specific Docker socket detection
- `GetDockerServices`, `ScaleDockerService`, `RemoveDockerService` - Service operations
- `GetDockerTasks`, `GetDockerNodes`, `GetDockerNetworks` - Resource listing
- `GetDockerConfigs`, `GetDockerSecrets`, `GetDockerVolumes` - Config/secret/volume operations
- `GetDockerServiceLogs`, `GetDockerTaskLogs` - Log streaming

Holmes AI:
- `AnalyzePod`, `AnalyzeDeployment`, `AnalyzeStatefulSet`, `AnalyzeDaemonSet`, `AnalyzeService`, `AnalyzeResource` provide context-aware analysis.
- `HolmesBottomPanel` renders analysis in resource bottom-panel tabs; `HolmesResponseRenderer` handles markdown + syntax highlighting.

Monitoring + Alerts:
- `ScanClusterHealth`, `AnalyzeMonitorIssue`, `AnalyzeAllMonitorIssues`, `DismissMonitorIssue` enhance existing monitor issues.
- `GetPrometheusAlerts`, `InvestigatePrometheusAlert`, `GetAlertInvestigationHistory` power the Prometheus tab.
- Holmes analysis and dismissals persist for 24 hours in `~/.KubeDevBench/monitor_issues.json`.

When modifying Go method signatures in `pkg/app/`, rebuild Wails to regenerate bindings.

### Testing Infrastructure
- `kind/` - Docker-based KinD manager for deterministic test clusters
  - `kind/output/kubeconfig` - Generated kubeconfig file
  - `kind/manager.sh` - Cluster lifecycle management
- `e2e/` - Playwright E2E tests
  - `e2e/setup/` - Global setup/teardown (KinD provisioning)
  - `e2e/src/pages/` - Page objects for E2E tests
    - `SwarmConnectionWizardPage.ts` - Page object for Swarm connection wizard
    - `SwarmSidebarPage.ts` - Page object for Swarm sidebar navigation
    - `SwarmBottomPanel.ts` - Page object for Swarm bottom panel (logs, etc.)
  - `e2e/src/support/swarm-bootstrap.ts` - Swarm test bootstrap utilities (connect, create test resources)
  - `e2e/tests/swarm/` - Docker Swarm E2E test specs
    - `00-connect-to-swarm.spec.ts` - Connection flow tests
    - `10-view-services.spec.ts` - Service listing and details
    - `20-scale-service.spec.ts` - Service scaling operations
    - `30-view-tasks-logs.spec.ts` - Task and log viewing
    - `40-manage-nodes.spec.ts` - Node management tests
    - `50-navigate-sections.spec.ts` - Sidebar navigation tests
- `frontend/src/__tests__/` - Vitest unit tests
  - `wailsMocks.ts` - Centralized Wails mock utilities
  - `swarmStateContext.test.tsx` - Tests for Docker Swarm state context
  - `swarmResourceCountsContext.test.jsx` - Tests for Swarm resource counts context

## Conventions

### Stable DOM Selectors
UI elements use stable id-based selectors for tests:
- `#show-wizard-btn` - Opens connection wizard
- `#primaryConfigContent` - Kubeconfig paste textarea
- `#sidebar`, `#maincontent` - Layout sections

Connection wizard selectors:
- `#connections-sidebar` - Connection wizard sidebar
- `#connections-main` - Connection wizard main content area
- `#kubernetes-section`, `#docker-swarm-section` - Sidebar section items
- `.kubeconfig-list-item`, `.swarm-connection-item` - Connection list items
- `#add-kubeconfig-btn`, `#add-swarm-btn` - Add connection buttons

Preserve these ids; if changing, update all usages in tests and `main-content.js`.

### Connection Wizard Architecture
The connection wizard uses a unified layout matching the main app view:
- **Sidebar sections**: "Kubernetes", "Docker Swarm", and "Pinned" with connection counts
- **Main view**: Shows connections for the selected section
- **Pin support**: Connections can be pinned via localStorage persistence
- **Proxy settings**: Per-connection proxy configuration available
- **Auto-detection**: Docker Swarm connections are auto-detected (local Docker socket)

### Testing
Go Code and Frontend Code should be unit tested.
Test Coverage for new Code should always be at least 70%.
Features should be tested by end to end tests.
Unit tests and end to end tests must pass in Github Build Pipeline, use github mcp 
to inspect Github Builds.
All code introduced must pass through those quality gates.


### Test Patterns
- Tests trigger Go RPCs through the UI, not by calling Go functions directly
- E2E tests use KinD manager container for reproducible clusters
- Unit tests mock Wails bindings via `wailsMocks.ts`

### TypeScript Conventions
- Prefer TypeScript/TSX for frontend files; avoid adding new .js/.jsx files.
- Use `unknown` instead of `any` where possible and narrow types explicitly.
- Keep test files in `frontend/src/__tests__/` with `.test.ts`/`.test.tsx`.

## Monitoring Troubleshooting
- Holmes analysis fails: verify Holmes config (endpoint + API key) in the Holmes settings panel; check `~/.KubeDevBench/holmes.log` for errors.
- Dismissed issues reappear immediately: confirm issue `Reason` or resource name changed (issue ID changes), or check for expired TTL (24h).
- Prometheus alerts fail to load: ensure the Prometheus URL is reachable from the desktop app and includes the correct scheme (http/https).
