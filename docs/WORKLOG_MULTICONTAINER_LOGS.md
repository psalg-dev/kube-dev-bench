# Worklog: Multi-Container Pod Log Aggregation

## Problem
When a pod runs with sidecar containers (or any multi-container setup), viewing logs would fail with a Kubernetes API error:
> "a container name must be specified for pod X, choose one of: [app sidecar]"

## Solution

Aggregate logs from **all** containers automatically when no specific container is selected. Each log line is prefixed with `[container-name]` so lines are differentiable by container.

### Backend Changes (`pkg/app/logs.go`)

- **`getPodContainerNames(ctx, namespace, podName)`** — queries the K8s API for the pod spec and returns all container names (regular + init + ephemeral).
- **`streamAllContainerLogs()` / `streamAllContainerLogsWith()`** — spawns a goroutine per container, each streaming logs with `[container-name] ` prefix. Uses `sync.WaitGroup` for clean shutdown.
- **`streamContainerWithPrefix()`** — streams a single container's logs, prepending the container name to each line.
- **`getAggregatedContainerLogs()`** — non-streaming variant that fetches logs from all containers and merges them with prefixes.
- **`StreamPodLogs()`** and **`GetPodLog()`** — updated to auto-detect multi-container pods when no container is specified.

### Frontend Changes (`frontend/src/layout/bottompanel/LogViewerTab.tsx`)

- **Container selector dropdown** — shown in the filter bar when the pod has multiple containers. Options: "All Containers" plus each individual container.
- **`containerPrefixPlugin`** — CodeMirror `ViewPlugin` that detects `[container-name] ` prefixes and applies color-coded `Decoration.mark` styles. 8 distinct colors cycle through containers.
- **Header text** — shows "(all containers)" when aggregating all containers for a multi-container pod.
- **`useEffect` for container list** — calls `GetPodContainers(podName)` to populate the dropdown.

### Log Line Format

```
[app] 2024-01-15T10:30:00Z Starting application...
[sidecar] 2024-01-15T10:30:01Z Proxy initialized
[app] 2024-01-15T10:30:02Z Listening on port 8080
```

## Tasks

- [x] Research current pod log implementation
- [x] Update Go backend for multi-container auto-detection and aggregation
- [x] Update frontend with container selector and color-coded prefixes
- [x] Write backend tests (`logs_multicontainer_test.go`) — all pass
- [x] Write frontend tests (`logViewerMultiContainer.test.tsx`) — 9/9 pass
- [x] Verify no regressions in existing log viewer tests — 19/19 pass

## Files Modified

| File | Change |
|------|--------|
| `pkg/app/logs.go` | Multi-container detection, aggregation, prefixed streaming |
| `pkg/app/logs_multicontainer_test.go` | New — 20+ test cases for multi-container features |
| `frontend/src/layout/bottompanel/LogViewerTab.tsx` | Container selector, CodeMirror color plugin, header updates |
| `frontend/src/__tests__/logViewerMultiContainer.test.tsx` | New — 9 test cases for multi-container UI |
| `frontend/src/__tests__/logViewerHolmes.test.tsx` | Updated mocks for new imports |
