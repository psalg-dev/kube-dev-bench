# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

KubeDevBench is a desktop Kubernetes client built with a Go backend (Wails framework) and React frontend (Vite). It provides features for managing Kubernetes clusters including pod management, deployments, cronjobs, and resource operations.

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

## Architecture

### Backend (Go)
- `main.go` - Wails application entry point, starts polling for K8s resources
- `pkg/app/` - Core application logic, K8s API integrations, and Wails-exposed methods
  - Resource handlers: `pods.go`, `deployments.go`, `cronjobs.go`, `statefulsets.go`, etc.
  - `kubeconfig.go` - Kubeconfig management
  - `resource_actions.go` - Scale, restart, delete operations
  - `types.go` - Shared type definitions

### Frontend (React)
- `frontend/src/state/ClusterStateContext.jsx` - Central cluster connection state management
- `frontend/src/layout/` - UI layout components
  - `connection/ConnectionWizard.jsx` - Kubeconfig selection and connection
  - `AppLayout.jsx` - Main app layout with stable DOM ids for testing
- `frontend/src/k8s/resources/` - K8s resource view components
- `frontend/wailsjs/go/main/App.js` - Auto-generated Wails bindings (frontend calls Go functions here)

### Frontend-Backend Communication
Frontend calls Go functions via Wails bindings at `frontend/wailsjs/go/main/App`. Key RPCs:
- `SavePrimaryKubeConfig`, `SetKubeConfigPath` - Kubeconfig management
- `GetConnectionStatus`, `GetKubeConfigs` - Connection state
- Resource operations exposed per resource type

When modifying Go method signatures in `pkg/app/`, rebuild Wails to regenerate bindings.

### Testing Infrastructure
- `kind/` - Docker-based KinD manager for deterministic test clusters
  - `kind/output/kubeconfig` - Generated kubeconfig file
  - `kind/manager.sh` - Cluster lifecycle management
- `e2e/` - Playwright E2E tests
  - `e2e/setup/` - Global setup/teardown (KinD provisioning)
- `frontend/src/__tests__/` - Vitest unit tests
  - `wailsMocks.js` - Centralized Wails mock utilities

## Conventions

### Stable DOM Selectors
UI elements use stable id-based selectors for tests:
- `#show-wizard-btn` - Opens connection wizard
- `#primaryConfigContent` - Kubeconfig paste textarea
- `#sidebar`, `#maincontent` - Layout sections

Preserve these ids; if changing, update all usages in tests and `main-content.js`.

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
- Unit tests mock Wails bindings via `wailsMocks.js`
