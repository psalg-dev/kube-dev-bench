---
applyTo: '**'
description: 'Repository-specific guidance for AI code agents working on kube-dev-bench'
---

# KubeDevBench AI Agent Instructions

Desktop Kubernetes + Docker Swarm client: **Go/Wails backend** + **React/Vite frontend**.

## Architecture

```
Frontend (React)              Wails Bindings              Backend (Go)
frontend/src/          →    wailsjs/go/main/App.js   →   pkg/app/
├── state/*Context.jsx       (auto-generated)            ├── *.go (K8s handlers)
├── docker/*Context.jsx                                  ├── docker_integration.go
├── k8s/resources/                                       └── docker/ (Swarm client)
└── docker/resources/
```

**Data flow**: Frontend imports from `wailsjs/go/main/App` → calls Go functions → receives typed responses.

## Commands

| Task | Command |
|------|---------|
| Dev mode | `wails dev` |
| Build | `wails build` |
| Frontend Unit Tests | `cd frontend && npm test` |
| Backend Tests | `go test ./pkg/app/...` |
| E2E Tests | `cd e2e && npm test` |
| Start KinD | `cd kind && docker compose up -d` |

## Critical Conventions

### Stable DOM Selectors
Tests depend on these IDs—update all usages if changing:
- `#show-wizard-btn`, `#primaryConfigContent`, `#sidebar`, `#maincontent`
- `#connections-sidebar`, `#connections-main`, `#kubernetes-section`, `#docker-swarm-section`

### Frontend-Backend RPC
```jsx
import { GetPods, ScaleDeployment } from '../wailsjs/go/main/App';
const pods = await GetPods(namespace);
```
**After modifying Go signatures**: run `wails dev` to regenerate bindings.

### State Management
- K8s: `frontend/src/state/ClusterStateContext.jsx`
- Swarm: `frontend/src/docker/SwarmStateContext.jsx`
- Connections: `frontend/src/layout/connection/ConnectionsStateContext.jsx`

### Resource View Pattern
Sidebar → table (`@tanstack/react-table`) → bottom panel details. YAML editing uses `@codemirror/lang-yaml`.

## Testing

### Frontend Unit Tests
- **Location**: `frontend/src/__tests__/` directory
- **Framework**: Vitest + `@testing-library/react`
- **Mocks**: Located in `frontend/src/__tests__/wailsMocks.js`
- **Run**: `cd frontend && npm test`

### Backend Tests
- **Framework**: Go `testing` with table-driven tests
- **Target**: ≥70% coverage
- **Run**: `go test ./pkg/app/...`

### E2E Tests (Playwright)
```typescript
import { test, expect } from '../src/fixtures.js';
import { bootstrapApp } from '../src/support/bootstrap.js';

test('example', async ({ page, contextName, namespace }) => {
  await bootstrapApp({ page, contextName, namespace });
  await expect(page.locator('#maincontent')).toBeVisible();
});
```
- Tests in `e2e/tests/`, numbered by feature (`00-`, `10-`, etc.)
- Uses KinD cluster: `kind/output/kubeconfig`
- **Tests trigger RPCs via UI**, never call Go directly
- **Run**: `cd e2e && npm test`

### Swarm E2E Tests
```bash
docker swarm init --advertise-addr 127.0.0.1 2>/dev/null || true
cd e2e && npm test -- tests/swarm/
```

## Adding Features

### New K8s Resource
1. `pkg/app/{resource}.go` — Go handlers
2. Regenerate Wails bindings
3. `frontend/src/k8s/resources/` — React view
4. `frontend/src/layout/SidebarSections.jsx` — sidebar entry
5. Unit tests (Go + Vitest) + E2E test

### New Swarm Resource
1. `pkg/app/docker/{resource}.go` — handler
2. `pkg/app/docker_integration.go` — Wails exposure
3. `frontend/src/docker/resources/` — view
4. `frontend/src/docker/SwarmSidebarSections.jsx` — sidebar

## Holmes AI Integration

Holmes provides AI-powered diagnostics via [HolmesGPT](https://holmesgpt.dev/).

### Architecture
```
Frontend                         Backend                      External
HolmesBottomPanel.jsx    →    holmes_integration.go    →    HolmesGPT API
HolmesResponseRenderer.jsx    holmes_context.go             (streaming)
                              holmes_logs.go
```

### Analysis Flow
1. User clicks "Analyze with Holmes" on a resource bottom panel
2. Frontend calls `AnalyzePod`, `AnalyzeDeployment`, etc. via Wails
3. Backend enriches context (`holmes_context.go`) with K8s state (events, logs, related resources)
4. Sends to HolmesGPT endpoint with streaming response
5. Frontend renders markdown + tool events in `HolmesResponseRenderer`

### Key Holmes RPCs
- `AnalyzePod`, `AnalyzeDeployment`, `AnalyzeStatefulSet`, `AnalyzeService` — resource-specific
- `AnalyzeResource` — generic analysis
- `ExplainLogs` — log analysis with error detection
- `InvestigatePrometheusAlert` — alert investigation

### Holmes Files
| Purpose | Path |
|---------|------|
| Core client | `pkg/app/holmesgpt/` |
| Context enrichment | `pkg/app/holmes_context.go` |
| Log analysis | `pkg/app/holmes_logs.go` |
| Swarm analysis | `pkg/app/holmes_swarm.go` |
| Frontend panel | `frontend/src/holmes/HolmesBottomPanel.jsx` |
| Response renderer | `frontend/src/holmes/HolmesResponseRenderer.jsx` |

## E2E Test Patterns

### Resource Creation Flow
```typescript
import { test, expect } from '../src/fixtures.js';
import { CreateOverlay } from '../src/pages/CreateOverlay.js';
import { Notifications } from '../src/pages/Notifications.js';
import { bootstrapApp } from '../src/support/bootstrap.js';

function uniqueName(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`.toLowerCase();
}

test('creates resource via overlay', async ({ page, contextName, namespace }) => {
  const { sidebar } = await bootstrapApp({ page, contextName, namespace });
  await sidebar.goToSection('deployments');

  const name = uniqueName('e2e-deploy');
  const yaml = `apiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: ${name}\n  namespace: ${namespace}\n...`;

  const overlay = new CreateOverlay(page);
  await overlay.openFromOverviewHeader();
  await overlay.fillYaml(yaml);
  await overlay.create();

  const notifications = new Notifications(page);
  await notifications.waitForClear();
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeVisible();
});
```

### Resource Deletion Flow
```typescript
import { waitForTableRow, waitForTableRowRemoved } from '../src/support/wait-helpers.js';

// After creating resource...
await waitForTableRow(page, new RegExp(name));
await page.getByRole('row', { name: new RegExp(name) }).click();
await expect(page.locator('.bottom-panel')).toBeVisible();

await page.locator('.bottom-panel').getByRole('button', { name: /^delete$/i }).click();
await page.locator('.bottom-panel').getByRole('button', { name: /^confirm$/i }).click();

await notifications.expectSuccessContains('deleted');
await waitForTableRowRemoved(page, new RegExp(name));
```

### Page Objects
- `e2e/src/pages/CreateOverlay.js` — resource creation overlay
- `e2e/src/pages/Notifications.js` — toast notification handling
- `e2e/src/pages/Sidebar.js` — sidebar navigation
- `e2e/src/support/wait-helpers.js` — table row wait utilities

## CI/CD Pipeline

### Workflow: `.github/workflows/build.yml`
```
frontend → backend → e2e (3 shards + registry + holmes)
```

### Jobs
1. **frontend**: Install, test (coverage), build dist artifact
2. **backend**: Download frontend dist, Go test (coverage), build binary
3. **e2e**: Matrix of 5 parallel runs:
   - `e2e-shard-1/2/3`: Main test shards
   - `e2e-registry`: Docker registry tests
   - `e2e-holmes-deploy`: Holmes integration tests

### Coverage
- Frontend: uploaded to Codecov with `frontend` flag
- Backend: uploaded to Codecov with `backend` flag
- Artifacts retained 7 days

### Running CI Locally
```bash
# Frontend tests with coverage
cd frontend && npm test -- --coverage

# Backend tests with coverage
go test -coverprofile=coverage.out ./...
go tool cover -func=coverage.out

# E2E sharded run (mimics CI)
cd e2e && npx playwright test --shard=1/3
```

### Required Secrets
- `CODECOV_TOKEN` — for coverage uploads

## Key Files

| Purpose | Path |
|---------|------|
| K8s handlers | `pkg/app/*.go` |
| Docker client | `pkg/app/docker/` |
| Wails bindings | `frontend/wailsjs/go/main/App.js` |
| E2E fixtures | `e2e/src/fixtures.ts`, `e2e/src/support/` |
| E2E page objects | `e2e/src/pages/` |
| KinD cluster | `kind/docker-compose.yml` |
| CI workflow | `.github/workflows/build.yml` |

## Troubleshooting

- **Bindings out of sync**: Run `wails dev` to regenerate
- **E2E failures**: Ensure KinD running (`cd kind && docker compose up -d`)
- **Holmes errors**: Check `~/.KubeDevBench/holmes.log`, verify API key in settings
- **CI failures**: Check shard logs; use `npx playwright test --shard=N/3` locally to reproduce
