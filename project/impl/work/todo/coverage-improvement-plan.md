# Coverage Improvement Plan — +10% Absolute

**Date:** 2026-02-19  
**Author:** Coverage analysis via `go tool cover` + `lcov` report

## Baseline (2026-02-19)

| Layer | Statements | Branches | Functions | Lines |
|-------|-----------|---------|-----------|-------|
| **Frontend** | 53.51% | 39.45% | 50.04% | 56.39% |
| **Go (pkg/...)** | 56.2% | — | — | — |

Per Go sub-package:

| Package | Current |
|---------|---------|
| `pkg/app` | 53.5% |
| `pkg/app/docker` | 57.5% |
| `pkg/app/holmesgpt` | 45.4% |
| `pkg/app/jobs` | 100.0% |
| `pkg/app/k8s_graph` | 63.8% |
| `pkg/app/mcp` | 84.0% |

## Targets

| Layer | Current | Target | Gap |
|-------|---------|--------|-----|
| **Frontend (statements)** | 53.51% | ≥ 63.5% | +10 pp |
| **Go (combined)** | 56.2% | ≥ 66.2% | +10 pp |

---

## Strategy Overview

Coverage is measured on **all files in `src/**/*.{ts,tsx}`** (frontend) and **`./pkg/...`** (Go).  
The biggest gains come from:

1. **Zero-coverage files with testable pure logic** — highest ROI, no mock complexity.
2. **Partially-covered context/state modules** — deeper test scenarios.
3. **Tab components** — render tests that exercise the JSX path.
4. **Go pure helper functions** — no k8s/docker client needed.

---

## Frontend Plan (+10 pp, ~965 lines to cover out of 13,751 tracked)

### Phase F1 — Swarm Resource Config Files (estimated +4 pp)

Seven config files under `src/config/resourceConfigs/swarm/` are at **0% coverage**.
They export `columns`, `tabs`, and `renderPanelContent`. Write one test file per config that:
- Imports the exported arrays and verifies structure (key names, labels, lengths).
- Renders `renderPanelContent` with a minimal mock resource object via RTL.

| File | Lines | Est. gain |
|------|-------|-----------|
| `src/config/resourceConfigs/swarm/serviceConfig.tsx` | 326 | high |
| `src/config/resourceConfigs/swarm/nodeConfig.tsx` | 106 | high |
| `src/config/resourceConfigs/swarm/volumeConfig.tsx` | 76 | medium |
| `src/config/resourceConfigs/swarm/configConfig.tsx` | 59 | medium |
| `src/config/resourceConfigs/swarm/networkConfig.tsx` | 54 | medium |
| `src/config/resourceConfigs/swarm/stackConfig.tsx` | 45 | medium |
| `src/config/resourceConfigs/swarm/taskConfig.tsx` | 45 | medium |
| `src/config/resourceConfigs/swarm/secretConfig.tsx` | 33 | low |

**Tasks:**
- [ ] Add `frontend/src/__tests__/swarmServiceConfig.test.tsx` — test column keys/labels, tab keys, render panel with mock service object; verify service name, image, scale shown
- [ ] Add `frontend/src/__tests__/swarmNodeConfig.test.tsx` — test column keys, render panel with mock node object; verify role/availability badges render
- [ ] Add `frontend/src/__tests__/swarmVolumeConfig.test.tsx` — test column keys, render panel with mock volume
- [ ] Add `frontend/src/__tests__/swarmConfigConfig.test.tsx` — test column keys, render panel with mock config object
- [ ] Add `frontend/src/__tests__/swarmNetworkConfig.test.tsx` — test column keys/labels, render panel overview
- [ ] Add `frontend/src/__tests__/swarmStackConfig.test.tsx` — test column keys, render panel with mock stack
- [ ] Add `frontend/src/__tests__/swarmTaskConfig.test.tsx` — test column keys, render panel with mock task
- [ ] Add `frontend/src/__tests__/swarmSecretConfig.test.tsx` — test column keys, render panel with mock secret

---

### Phase F2 — K8s Resource Config Files (estimated +2 pp)

Files under `src/config/resourceConfigs/*.tsx` at 15–32% coverage.  
Pattern: columns array and tabs array are covered partially; `renderPanelContent` is not.  
Write tests that render `renderPanelContent` with a minimal mock resource.

| File | Lines | Current |
|------|-------|---------|
| `src/config/resourceConfigs/pvConfig.tsx` | 216 | 23.1% |
| `src/config/resourceConfigs/ingressConfig.tsx` | ~200 | 17.5% |
| `src/config/resourceConfigs/statefulsetConfig.tsx` | ~180 | 21.2% |
| `src/config/resourceConfigs/daemonsetConfig.tsx` | ~170 | 21.9% |
| `src/config/resourceConfigs/podConfig.tsx` | ~200 | 15.8% |
| `src/config/resourceConfigs/deploymentConfig.tsx` | 250 | 31.6% |
| `src/config/resourceConfigs/jobConfig.tsx` | ~170 | 25.9% |
| `src/config/resourceConfigs/cronjobConfig.tsx` | ~175 | 25.0% |
| `src/config/resourceConfigs/replicasetConfig.tsx` | ~180 | 25.0% |
| `src/config/resourceConfigs/configmapConfig.tsx` | ~160 | 28.0% |
| `src/config/resourceConfigs/secretConfig.tsx` | ~160 | 28.0% |
| `src/config/resourceConfigs/pvcConfig.tsx` | ~165 | 28.0% |
| `src/config/resourceConfigs/serviceConfig.tsx` | ~140 | 31.8% |

**Tasks:**
- [ ] Add `frontend/src/__tests__/pvResourceConfig.test.tsx` — render `renderPanelContent` with mock PV (status=Bound, reclaimPolicy=Retain, storageClass=manual) and verify PVBoundPVCTab, PVAnnotationsTab, PVCapacityUsageTab render
- [ ] Add `frontend/src/__tests__/ingressResourceConfig.test.tsx` — render panel with mock ingress (1 rule, TLS entry) and verify IngressDetailTab, IngressTLSTab render
- [ ] Add `frontend/src/__tests__/statefulsetResourceConfig.test.tsx` — render panel with mock StatefulSet and verify pods/PVC tabs
- [ ] Add `frontend/src/__tests__/daemonsetResourceConfig.test.tsx` — render panel with mock DaemonSet, verify DaemonSetPodsTab, DaemonSetNodeCoverageTab
- [ ] Add `frontend/src/__tests__/podResourceConfig.test.tsx` — render panel with mock Pod, verify PortForwardDialog, PodEventsTab  
- [ ] Extend `frontend/src/__tests__/deploymentPodsTab.test.tsx` — add scenarios for empty namespace and annotations to exercise uncovered `renderPanelContent` branches
- [ ] Add `frontend/src/__tests__/jobResourceConfig.test.tsx` — render panel with mock Job, verify JobPodsTab
- [ ] Add `frontend/src/__tests__/cronjobResourceConfig.test.tsx` — render panel with CronJobActionsTab, CronJobHistoryTab
- [ ] Add `frontend/src/__tests__/secretResourceConfig.test.tsx` — render panel with mock Secret, verify SecretDataTab, SecretUsedBySection
- [ ] Add `frontend/src/__tests__/pvcResourceConfig.test.tsx` — render panel with mock PVC, verify PVCConsumersTab, PVCYamlTab

---

### Phase F3 — Zero-Coverage Tab Components (estimated +2 pp)

This section covers tab-level components that have no tests yet.

| File | Lines | Notes |
|------|-------|-------|
| `src/k8s/resources/helmreleases/HelmResourcesSummary.tsx` | 199 | Renders Helm resources list |
| `src/layout/bottompanel/FilesTab.tsx` | 147 | File browser for PVCs |
| `src/k8s/resources/daemonsets/DaemonSetPodsTab.tsx` | 56 | Pods per node table |
| `src/k8s/resources/ingresses/IngressBackendServicesTab.tsx` | 69 | Backend services list |
| `src/k8s/resources/ingresses/IngressTLSTab.tsx` | 51 | TLS cert details |
| `src/k8s/resources/ingresses/IngressDetailTab.tsx` | 43 | Ingress rules detail |
| `src/k8s/resources/secrets/SecretConsumersTab.tsx` | 45 | Who uses a secret |
| `src/k8s/resources/persistentvolumeclaims/PVCConsumersTab.tsx` | 45 | PVC mount consumers |
| `src/k8s/resources/statefulsets/StatefulSetDetailTab.tsx` | 45 | StatefulSet info |
| `src/k8s/resources/pods/PortForwardDialog.tsx` | 37 | Port-forward modal |
| `src/k8s/resources/pods/PortForwardOutput.tsx` | 48 | Port-forward output pane |
| `src/k8s/resources/pods/PodEventsTab.tsx` | 25 | Pod events list |
| `src/k8s/resources/configmaps/ConfigMapConsumersTab.tsx` | 33 | ConfigMap consumers |
| `src/docker/resources/stacks/StackServicesTab.tsx` | 62 | Stack service list |
| `src/docker/resources/networks/NetworkConnectedContainersTable.tsx` | 73 | Containers on network |

**Tasks:**
- [ ] Add `frontend/src/__tests__/helmResourcesSummary.test.tsx` — render with mock Helm release data including charts, resources list; verify resource types render
- [ ] Add `frontend/src/__tests__/filesTab.test.tsx` — render FilesTab with mock file listing (files, dirs, symlinks); verify breadcrumb, file rows, permission strings, sort
- [ ] Add `frontend/src/__tests__/daemonSetPodsTab.test.tsx` — render with mock pods array; verify node column, status badge
- [ ] Add `frontend/src/__tests__/ingressBackendServicesTab.test.tsx` — render with mock rules; verify service name and port shown
- [ ] Add `frontend/src/__tests__/ingressTLSTab.test.tsx` — render with mock TLS entry; verify secret name, hosts listed
- [ ] Add `frontend/src/__tests__/ingressDetailTab.test.tsx` — render with mock rules; verify host/path/backend columns
- [ ] Add `frontend/src/__tests__/secretConsumersTab.test.tsx` — render with mock consumer list; verify pod names shown
- [ ] Add `frontend/src/__tests__/pvcConsumersTab.test.tsx` — render with mock consumers (pods + statefulsets); verify names shown
- [ ] Add `frontend/src/__tests__/statefulSetDetailTab.test.tsx` — render with mock StatefulSet spec; verify volume claims, service name
- [ ] Add `frontend/src/__tests__/portForwardDialog.test.tsx` — render dialog; verify local/remote port inputs, submit calls mock PortForwardPod
- [ ] Add `frontend/src/__tests__/portForwardOutput.test.tsx` — render with active port-forward state; verify URL displayed
- [ ] Add `frontend/src/__tests__/podEventsTab.test.tsx` — render with mock events list; verify event reason, message columns
- [ ] Add `frontend/src/__tests__/configMapConsumersTab.test.tsx` — render with mock consumers; verify pod/namespace
- [ ] Add `frontend/src/__tests__/stackServicesTab.test.tsx` — render with mock services in stack; verify service names, replicas
- [ ] Add `frontend/src/__tests__/networkConnectedContainersTable.test.tsx` — render with mock containers; verify name, IP, state columns

---

### Phase F4 — Improve Partially-Covered Modules (estimated +2 pp)

These files are 35–50% covered with large uncovered branches.

| File | Lines | Current | Uncovered |
|------|-------|---------|-----------|
| `src/holmes/HolmesContext.tsx` | 221 | 35.3% | ~143 lines |
| `src/layout/bottompanel/LogViewerTab.tsx` | 426 | 38.0% | ~264 lines |
| `src/k8s/resources/helmreleases/HelmActions.tsx` | 112 | 15.2% | ~95 lines |
| `src/docker/SwarmStateContext.tsx` | 153 | 49.7% | ~77 lines |
| `src/layout/connection/KubernetesConnectionsList.tsx` | 109 | 49.5% | ~55 lines |
| `src/mcp/MCPContext.tsx` | 68 | 38.2% | ~42 lines |
| `src/mcp/MCPConfigModal.tsx` | 37 | 21.6% | ~29 lines |

**Tasks:**
- [ ] Extend `holmesContext.test.tsx` — add test for streaming path (mock `AskHolmesStream`), verify partial response accumulates, error state set on failure, abort on unmount
- [ ] Extend `logViewerHolmes.test.tsx` — add tests for (a) auto-scroll toggled off, (b) "Explain Logs" button with mock Holmes stream, (c) log filter by container, (d) ANSI stripping
- [ ] Add `frontend/src/__tests__/helmActions.test.tsx` — render HelmActions with mock release; test upgrade flow, rollback confirm dialog, uninstall confirm, history tab toggle
- [ ] Extend `swarmStateContext.test.tsx` — add tests for reconnect on error, task polling interval, clearAllResources on disconnect
- [ ] Extend `connectionWizard.test.tsx` — add scenarios for (a) edit existing kubeconfig, (b) pin/unpin connection, (c) proxy settings save
- [ ] Add `frontend/src/__tests__/mcpContext.test.tsx` — test Start/Stop MCP, error propagation, status polling
- [ ] Add `frontend/src/__tests__/mcpConfigModal.test.tsx` — render modal; test Save calls SetMCPConfig, invalid port rejected, modal close clears dirty state

---

## Go Backend Plan (+10 pp, ~600 statements to cover)

### Phase G1 — Pure Helper Functions with No External Dependencies (estimated +4 pp)

These functions need no k8s/docker client — testable as pure unit tests.

#### `pkg/app/pvc_files.go` (4.3% coverage, 556 lines)
Only `sanitizeName` is tested today. File contains rich parsers and transformers.

- [ ] Add `pkg/app/pvc_files_parsing_test.go` — table-driven tests for `parseLsLine`:
  - Regular file: `-rw-r--r-- 1 root root 1234 2024-01-15T10:00:00 file.txt`
  - Directory entry ending with `/`
  - Symlink: `lrwxrwxrwx ... config -> /etc/config`
  - Empty line, header line (should return `false`)
  - 10+ cases covering permissions, sizes, timestamps
- [ ] Add tests for `parseLsOutput` — multi-line ls output → slice of entries
- [ ] Add tests for `buildFileEntry` — ls entry → FileInfo struct (type detection, symlink target)
- [ ] Add tests for `sortFileEntries` — verify dirs before files, then alpha sort
- [ ] Add tests for `sanitizePath` / path-split helpers used to compose exec commands

#### `pkg/app/docker/stacks_compose.go` (0% coverage, 201 lines)
All functions are pure transformations: swarm service spec → compose YAML.

- [ ] Add `pkg/app/docker/stacks_compose_test.go` — test `GetSwarmStackComposeYAML` via fake client:
  - Stack with 2 services, both labeled `com.docker.stack.namespace=mystack`
  - Service with ports: verify `buildServicePorts` round-trips port format
  - Service with replicas: verify `buildComposeDeploy` sets `replicas`
  - Service with update config delay: verify `buildComposeUpdateConfig`
  - Service with restart policy: verify `buildComposeRestartPolicy`
  - Resulting YAML is valid and contains expected service names
- [ ] Add negative test: no services matching stack produces empty YAML

#### `pkg/app/docker/stacks_resources.go` (0% coverage)
Four filter functions: `filterNetworksByStack`, `filterConfigsByStack`, `filterSecretsByStack`, `filterVolumesByStack`.

- [ ] Add `pkg/app/docker/stacks_resources_filter_test.go` — test each filter function:
  - Mix of labeled/unlabeled items → only matching stack items returned
  - Empty input → empty output
  - All items match → all returned

#### `pkg/app/holmesgpt/logger.go` & `values.go` (holmesgpt at 45.4%)
Logger is 0% except for `Debug`, `Info`, `Error` wrappers on the noop path.

- [ ] Add `pkg/app/holmesgpt/logger_test.go`:
  - `TestInitLogger_CreatesLogFile` — call `InitLogger(t.TempDir())`, verify file created, logger not nil
  - `TestInitLogger_DefaultPath` — call with empty string, verify it picks `~/KubeDevBench/logs`
  - `TestFileLogger_WritesMethods` — call `Warn`, `Close` on initialized logger; verify written to file
  - `TestNoopLogger_AllMethods` — call all noop logger methods; verify no panic
  - `TestGetLogPath` — after init, verify `GetLogPath()` returns the expected file path
- [ ] Add `pkg/app/holmesgpt/values_test.go`:
  - `TestGetDefaultHelmValues_ReturnsMap` — verify result is non-nil map
  - `TestGetDefaultHelmValuesYAML_ValidYAML` — verify output is parseable YAML

#### `pkg/app/k8s_graph/builder.go` — unexpanded node types (63.8% coverage)
Multiple `expand*` functions at 0%: `expandStatefulSet`, `expandDaemonSet`, `expandJob`, `expandCronJob`, `expandClusterRoleBinding`, `expandRole`, `expandClusterRole`, `expandNode_k8s`, `expandServiceAccount`, `expandNetworkPolicy`, `expandHPA`.

- [ ] Add builder tests for `expandStatefulSet` — build a graph with a StatefulSet + matching PVC + matching Service; verify edges added  
- [ ] Add builder tests for `expandDaemonSet` — DaemonSet + node selector; verify node affinity edges  
- [ ] Add builder tests for `expandJob` — Job + owned pods; verify pod edges  
- [ ] Add builder tests for `expandCronJob` — CronJob + child Job; verify child edge  
- [ ] Add builder tests for `expandClusterRoleBinding` / `expandRoleBinding` — binding + subject; verify subject edge
- [ ] Add builder tests for `expandRole` / `expandClusterRole` — rule annotations on node
- [ ] Add builder tests for `expandNode_k8s` — k8s Node + pods scheduled on it; verify pod–node edges  
- [ ] Add builder tests for `expandHPA` — HPA targeting a Deployment; verify workload edge, `workloadKindForHPATarget` return values  
- [ ] Add builder tests for `expandNetworkPolicy` — policy with pod selector; verify policy–pod edges  
- [ ] Add test for `podSpecUsesPVC` — pod spec with volumeClaimTemplates and volume mounts

---

### Phase G2 — Docker Package Transformation Functions (estimated +3 pp)

#### `pkg/app/docker/tasks.go` (partial 0%)
`taskToInfo`, `taskStatusString`, `setCachedHealthStatus`, `fetchContainerHealthStatus` are partially or fully uncovered.

- [ ] Add `pkg/app/docker/tasks_transform_test.go` — test `taskToInfo` with a swarm.Task fixture covering all Status.State values (running, failed, rejected, complete, shutdown)
- [ ] Add tests for `taskStatusString` with all swarm task states
- [ ] Add tests for `setCachedHealthStatus` — set and retrieve cached value (no Docker client needed)
- [ ] Add tests for `GetSwarmTask` via fake client — fetch single task by ID

#### `pkg/app/docker/services.go` (partial: `extractResources` 18.2%, `extractPlacement` 14.3%)
- [ ] Add `pkg/app/docker/services_transform_test.go` — test `extractResources` with NanoCPU=1e9, MemoryBytes=512MB
- [ ] Add tests for `extractPlacement` with constraints and preferences
- [ ] Add tests for `extractUpdateConfig` with all update order values

#### `pkg/app/docker/metrics_live.go` (0% for `collectSwarmMetricsWithBreakdown`, `collectContainerStats`, `getContainerStats`)
- [ ] Add `pkg/app/docker/metrics_live_stats_test.go` — test `aggregateServiceMetrics` with pre-built stat slices (pure aggregation, no Docker client)
- [ ] Test `aggregateNodeMetrics` with multi-node stat input

#### `pkg/app/docker/image_updates.go` (mixed: `resolveRegistryConfigForImage` 0%)
- [ ] Extend `pkg/app/docker/image_updates_parsing_test.go` — test `parseImageReference` with all forms: `library/ubuntu`, `myregistry.io/org/image:tag`, `sha256:...`, implicit Docker Hub
- [ ] Add tests for `resolveLocalDigestForService` logic with fake client returning image inspect

---

### Phase G3 — pkg/app Mid-Coverage Files (estimated +3 pp)

#### `pkg/app/pod_details.go` (43.6%, 33 functions, 674 lines)
- [ ] Add `pkg/app/pod_details_containers_test.go` — test container state classification: `buildContainerStatus` for running/waiting/terminated states; table-driven with 10+ cases
- [ ] Add tests for `extractEnvVars` — env var list with plain values, valueFrom ConfigMap/Secret refs; verify redaction of secrets
- [ ] Add tests for `extractVolumeMounts` — pod with PVC, ConfigMap, Secret, emptyDir volumes; verify source type inferred correctly
- [ ] Add tests for `extractPorts` — containers with multiple TCP/UDP ports; verify protocol and name

#### `pkg/app/resource_yaml.go` (41.2%, 20 functions)
- [ ] Extend `pkg/app/resource_yaml_test.go` — test `cleanManagedFields` with a resource YAML that contains `managedFields` — verify stripped; verify idempotent
- [ ] Test `formatResourceYAML` with resources that have status, managed fields, last-applied annotation; verify all cleaned

#### `pkg/app/logs.go` (42.3%, 12 functions)
- [ ] Extend `pkg/app/logs_test.go` — test `parseLogLine` with ANSI escape codes (`\x1b[32mINFO\x1b[0m`) → verify stripped; test structured JSON log line → plain text fallback
- [ ] Test `buildLogOptions` with different `since` values and `follow=true`

#### `pkg/app/helm.go` (25.6%, 19 functions)  
Helm functions that require a real repo/k8s cannot be unit tested, but helpers can.

- [ ] Add `pkg/app/helm_helpers_test.go` — test `getHelmSettings` returns non-nil with default namespace injected
- [ ] Test `triggerCountsRefresh` with mock counts broker (already have this interface in tests)
- [ ] Add tests for `GetHelmReleases` mapping with a fake Helm list result: verify `HelmReleaseInfo` fields populated correctly (name, namespace, chart, version, status, updated)

---

## Measurement & Verification Checklist

After each phase is complete, re-run coverage and record results below:

| Phase | Expected Frontend | Expected Go | Actual Frontend | Actual Go |
|-------|------------------|-------------|-----------------|-----------|
| Baseline | 53.51% | 56.2% | 53.51% | 56.2% |
| After F1 | ~57% | — | | |
| After F1+F2 | ~59% | — | | |
| After F1+F2+F3 | ~61% | — | | |
| After F1+F2+F3+F4 | ~63.5% | — | | |
| After G1 | — | ~60% | | |
| After G1+G2 | — | ~63% | | |
| After G1+G2+G3 | — | ~66.2% | | |

### Commands

```powershell
# Frontend re-measurement
cd frontend; npm test -- --coverage

# Go re-measurement (full combined)
go test -coverprofile coverage.out -covermode atomic `
  gowails/pkg/app gowails/pkg/app/docker gowails/pkg/app/holmesgpt `
  gowails/pkg/app/jobs gowails/pkg/app/k8s_graph gowails/pkg/app/mcp
go tool cover -func coverage.out | Select-String "^total:"

# Go per-package detail
go test -coverprofile coverage.out -covermode atomic `
  gowails/pkg/app gowails/pkg/app/docker gowails/pkg/app/holmesgpt `
  gowails/pkg/app/jobs gowails/pkg/app/k8s_graph gowails/pkg/app/mcp
```

---

## Implementation Notes

### Frontend Test Patterns

All new tests follow the existing project pattern in `frontend/src/__tests__/`:

```tsx
// Example: swarm tab component test pattern
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { someSwarmTabColumns } from '../config/resourceConfigs/swarm/serviceConfig';

describe('swarmServiceConfig', () => {
  it('exports the expected column keys', () => {
    const keys = someSwarmTabColumns.map(c => c.key);
    expect(keys).toContain('name');
    expect(keys).toContain('image');
  });
});
```

For React component tests, use `wailsMocks.ts` which is auto-loaded via `test.setup.js`:

```tsx
import { render, screen } from '@testing-library/react';
import SomeSwarmTab from '../docker/resources/stacks/StackServicesTab';

it('renders service names', () => {
  render(<SomeSwarmTab services={[{ id: 's1', name: 'web', replicas: 2 }]} />);
  expect(screen.getByText('web')).toBeInTheDocument();
});
```

### Go Test Patterns

All Go tests are **table-driven** and placed alongside the file under test:

```go
func Test_parseLsLine_Table(t *testing.T) {
  tests := []struct {
    name     string
    line     string
    wantType string
    wantOk   bool
  }{
    {"regular file", "-rw-r--r-- 1 root root 1234 2024-01-15T10:00:00 file.txt", "file", true},
    {"directory",   "drwxr-xr-x 2 root root    0 2024-01-15T10:00:00 somedir/",  "dir",  true},
    {"empty line",  "",                                                           "",     false},
  }
  for _, tc := range tests {
    t.Run(tc.name, func(t *testing.T) {
      got, ok := parseLsLine(tc.line)
      if ok != tc.wantOk {
        t.Fatalf("parseLsLine(%q) ok = %v, want %v", tc.line, ok, tc.wantOk)
      }
      if ok && got.fileType != tc.wantType {
        t.Errorf("fileType = %q, want %q", got.fileType, tc.wantType)
      }
    })
  }
}
```

---

## Out of Scope (Intentionally Excluded)

The following are deliberately excluded from coverage measurement and do not need tests:

| Item | Reason |
|------|--------|
| `frontend/wailsjs/**` | Auto-generated Wails bindings |
| `frontend/src/types/wails.ts` | 2-line re-export shim |
| `frontend/src/main.ts` | Framework entry point (bootstrap only) |
| `frontend/src/**/*.d.ts` | TypeScript declarations, no runtime code |
| `frontend/src/k8s/resources/**/*OverviewTable.tsx` | Declarative table configs validated by E2E |
| `main.go` (root) | Thin Wails app wrapper, covered by E2E |
| `pkg/app/docker/metrics_live.go` — `collectContainerStats`/`getContainerStats` | Require live Docker daemon — E2E only |
| `pkg/app/helm.go` — Install/Upgrade/Rollback/Uninstall | Require live k8s cluster — E2E only |
| `pkg/app/holmes_deployment.go` — deploy functions | Require live k8s + Helm — E2E only |
| `pkg/app/swarm_volume_file_transfer.go` | Requires exec session + live volume — E2E only |
