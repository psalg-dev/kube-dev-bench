# Phase 4: Log Analysis & Swarm Support (Streamlined)

**Status**: Implemented (Pending Validation)
**Duration**: 1.5 Sprints (3 weeks)
**Prerequisites**: Phase 1, 2, and 3 complete
**Goal**: Add log analysis and Docker Swarm support

---

## Overview

### Goals
- ✅ Integrate Holmes with log viewers for intelligent log analysis
- ✅ Extend Holmes to Docker Swarm resources
- ✅ Maintain 70%+ test coverage with comprehensive E2E tests

### Prerequisites
- Phase 1, 2, and 3 completed
- Holmes integration stable and well-tested
- User feedback from previous phases incorporated

### Success Criteria
- [x] Users can analyze logs with "Explain Logs" button
- [x] Docker Swarm resources can be analyzed via Holmes
- [x] All major resource types covered (K8s + Swarm)
- [ ] Full E2E test suite passing
- [ ] Test coverage >= 70%

---

## Implementation Tasks

### Backend Tasks

#### Log Analysis Integration
- [x] Create `pkg/app/holmes_logs.go`:
    - [x] `AnalyzeLogs(namespace, podName, containerName string, lines int) (*holmesgpt.HolmesResponse, error)`
    - [x] `DetectLogPatterns(logs string) ([]LogPattern, error)`
    - [x] `getPodLogs(namespace, podName, containerName string, lines int) (string, error)`

#### Docker Swarm Support
- [x] Create `pkg/app/holmes_swarm.go`:
    - [x] `AnalyzeSwarmService(serviceID string) (*holmesgpt.HolmesResponse, error)`
    - [x] `AnalyzeSwarmTask(taskID string) (*holmesgpt.HolmesResponse, error)`
    - [x] `getSwarmServiceContext(serviceID string) (string, error)`
    - [x] `getSwarmTaskContext(taskID string) (string, error)`

#### Wails RPC Methods
- [x] Add to `pkg/app/holmes_integration.go`:
    - [x] `AnalyzePodLogs(namespace, podName string, lines int) (*holmesgpt.HolmesResponse, error)`
    - [x] `AnalyzeSwarmService(serviceID string) (*holmesgpt.HolmesResponse, error)`
    - [x] `AnalyzeSwarmTask(taskID string) (*holmesgpt.HolmesResponse, error)`

### Frontend Tasks

#### Log Analysis UI
- [x] Update `frontend/src/k8s/resources/pods/LogViewerTab.jsx`:
    - [x] Add "Explain Logs" button
    - [x] Show Holmes analysis in expandable section or modal
    - [x] Use HolmesResponseRenderer for display

#### Docker Swarm Integration
- [x] Update Swarm resource views:
    - [x] `frontend/src/docker/resources/services/ServicesOverviewTable.jsx`
    - [x] `frontend/src/docker/resources/tasks/TasksOverviewTable.jsx`
    - [x] Add "Ask Holmes" buttons (same pattern as K8s)
    - [x] Add Holmes tab to bottom panel
    - [x] Use HolmesResponseRenderer for display

#### API Wrapper Updates
- [x] Update `frontend/src/holmes/holmesApi.js`:
    - [x] Add `AnalyzePodLogs(namespace, podName, lines)`
    - [x] Add `AnalyzeSwarmService(serviceID)`
    - [x] Add `AnalyzeSwarmTask(taskID)`

### Testing Tasks

#### Go Unit Tests
- [x] Test log analysis with sample logs
- [x] Test log pattern detection
- [x] Test Swarm service context enrichment
- [x] Test Swarm task context enrichment
- [ ] Verify coverage >= 70%

#### Frontend Unit Tests
- [x] Test log analysis UI button and display
- [x] Test Swarm integration components
- [ ] Verify coverage >= 70%

#### E2E Tests
- [x] Create `e2e/tests/holmes/40-log-analysis.spec.ts`:
    - [x] Open pod logs
    - [x] Click "Explain Logs"
    - [x] Verify analysis displays
- [x] Create `e2e/tests/holmes/50-swarm-integration.spec.ts`:
    - [x] Connect to Swarm
    - [x] Analyze Swarm service
    - [ ] Verify response with markdown
    - [x] Test Swarm task analysis

### Documentation Tasks
- [x] Update `CLAUDE.md` with Phase 4 features
- [x] Document log analysis patterns
- [x] Document Swarm integration
- [x] Create comprehensive user guide

---

## Detailed Implementation

### 1. Backend: Log Analysis

**File**: `pkg/app/holmes_logs.go`

```go
package apppkg

import (
    "context"
    "fmt"
    "strings"

    "github.com/yourusername/kube-dev-bench/pkg/app/holmesgpt"
    corev1 "k8s.io/api/core/v1"
)

type LogPattern struct {
    Type        string `json:"type"` // error, warning, panic, etc.
    Pattern     string `json:"pattern"`
    Occurrences int    `json:"occurrences"`
    FirstSeen   string `json:"firstSeen"`
    LastSeen    string `json:"lastSeen"`
}

func (a *App) AnalyzeLogs(namespace, podName, containerName string, lines int) (*holmesgpt.HolmesResponse, error) {
    // Get logs
    logs, err := a.getPodLogs(namespace, podName, containerName, lines)
    if err != nil {
        return nil, fmt.Errorf("failed to get logs: %w", err)
    }

    // Build question with context
    containerInfo := ""
    if containerName != "" {
        containerInfo = fmt.Sprintf(" (container: %s)", containerName)
    }

    question := fmt.Sprintf(
        "Analyze these logs from pod %s/%s%s and identify any issues:\n\n```\n%s\n```\n\nWhat problems do you see? What could be causing them? How can they be fixed?",
        namespace, podName, containerInfo, logs,
    )

    // Ask Holmes
    a.holmesMu.RLock()
    client := a.holmesClient
    a.holmesMu.RUnlock()

    if client == nil {
        return nil, fmt.Errorf("Holmes is not configured")
    }

    return client.Ask(question)
}

func (a *App) DetectLogPatterns(logs string) ([]LogPattern, error) {
    // Simple pattern detection
    patterns := make(map[string]*LogPattern)

    lines := strings.Split(logs, "\n")
    for _, line := range lines {
        lowerLine := strings.ToLower(line)

        // Detect errors
        if strings.Contains(lowerLine, "error") || strings.Contains(lowerLine, "err") {
            key := "error"
            if p, exists := patterns[key]; exists {
                p.Occurrences++
                p.LastSeen = line
            } else {
                patterns[key] = &LogPattern{
                    Type:        "error",
                    Pattern:     "error",
                    Occurrences: 1,
                    FirstSeen:   line,
                    LastSeen:    line,
                }
            }
        }

        // Detect panics
        if strings.Contains(lowerLine, "panic") {
            key := "panic"
            if p, exists := patterns[key]; exists {
                p.Occurrences++
                p.LastSeen = line
            } else {
                patterns[key] = &LogPattern{
                    Type:        "panic",
                    Pattern:     "panic",
                    Occurrences: 1,
                    FirstSeen:   line,
                    LastSeen:    line,
                }
            }
        }

        // Detect warnings
        if strings.Contains(lowerLine, "warning") || strings.Contains(lowerLine, "warn") {
            key := "warning"
            if p, exists := patterns[key]; exists {
                p.Occurrences++
                p.LastSeen = line
            } else {
                patterns[key] = &LogPattern{
                    Type:        "warning",
                    Pattern:     "warning",
                    Occurrences: 1,
                    FirstSeen:   line,
                    LastSeen:    line,
                }
            }
        }
    }

    // Convert map to slice
    result := make([]LogPattern, 0, len(patterns))
    for _, p := range patterns {
        result = append(result, *p)
    }

    return result, nil
}

func (a *App) getPodLogs(namespace, podName, containerName string, lines int) (string, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return "", err
    }

    logOptions := &corev1.PodLogOptions{
        TailLines: int64Ptr(int64(lines)),
    }

    if containerName != "" {
        logOptions.Container = containerName
    }

    req := clientset.CoreV1().Pods(namespace).GetLogs(podName, logOptions)
    logs, err := req.DoRaw(context.Background())
    if err != nil {
        return "", fmt.Errorf("failed to get logs: %w", err)
    }

    return string(logs), nil
}
```

### 2. Backend: Docker Swarm Support

**File**: `pkg/app/holmes_swarm.go`

```go
package apppkg

import (
    "context"
    "fmt"
    "io"
    "strings"

    "github.com/docker/docker/api/types"
    "github.com/docker/docker/api/types/filters"
    "github.com/yourusername/kube-dev-bench/pkg/app/holmesgpt"
)

func (a *App) AnalyzeSwarmService(serviceID string) (*holmesgpt.HolmesResponse, error) {
    ctx, err := a.getSwarmServiceContext(serviceID)
    if err != nil {
        return nil, fmt.Errorf("failed to get service context: %w", err)
    }

    question := fmt.Sprintf(
        "Analyze this Docker Swarm service and explain any issues:\n\nService ID: %s\n\n%s",
        serviceID, ctx,
    )

    a.holmesMu.RLock()
    client := a.holmesClient
    a.holmesMu.RUnlock()

    if client == nil {
        return nil, fmt.Errorf("Holmes is not configured")
    }

    return client.Ask(question)
}

func (a *App) AnalyzeSwarmTask(taskID string) (*holmesgpt.HolmesResponse, error) {
    ctx, err := a.getSwarmTaskContext(taskID)
    if err != nil {
        return nil, fmt.Errorf("failed to get task context: %w", err)
    }

    question := fmt.Sprintf(
        "Analyze this Docker Swarm task and explain any issues:\n\nTask ID: %s\n\n%s",
        taskID, ctx,
    )

    a.holmesMu.RLock()
    client := a.holmesClient
    a.holmesMu.RUnlock()

    if client == nil {
        return nil, fmt.Errorf("Holmes is not configured")
    }

    return client.Ask(question)
}

func (a *App) getSwarmServiceContext(serviceID string) (string, error) {
    // Get Docker client
    dockerClient, err := a.getDockerClient()
    if err != nil {
        return "", err
    }

    var sb strings.Builder

    // Get service details
    service, _, err := dockerClient.ServiceInspectWithRaw(context.Background(), serviceID, types.ServiceInspectOptions{})
    if err != nil {
        return "", fmt.Errorf("failed to inspect service: %w", err)
    }

    sb.WriteString(fmt.Sprintf("Service: %s\n", service.Spec.Name))
    if service.Spec.Mode.Replicated != nil {
        sb.WriteString(fmt.Sprintf("Replicas: %d\n", *service.Spec.Mode.Replicated.Replicas))
    }
    sb.WriteString(fmt.Sprintf("Image: %s\n", service.Spec.TaskTemplate.ContainerSpec.Image))

    // Get tasks for this service
    tasks, err := dockerClient.TaskList(context.Background(), types.TaskListOptions{
        Filters: filters.NewArgs(filters.Arg("service", serviceID)),
    })
    if err != nil {
        sb.WriteString(fmt.Sprintf("\nFailed to get tasks: %v\n", err))
    } else {
        sb.WriteString(fmt.Sprintf("\nTasks (%d):\n", len(tasks)))
        for _, task := range tasks {
            sb.WriteString(fmt.Sprintf("  - %s: %s\n", task.ID[:12], task.Status.State))
            if task.Status.Err != "" {
                sb.WriteString(fmt.Sprintf("    Error: %s\n", task.Status.Err))
            }
        }
    }

    // Get service logs (last 50 lines)
    logOptions := types.ContainerLogsOptions{
        ShowStdout: true,
        ShowStderr: true,
        Tail:       "50",
    }
    logs, err := dockerClient.ServiceLogs(context.Background(), serviceID, logOptions)
    if err == nil {
        defer logs.Close()
        logBytes, _ := io.ReadAll(logs)
        sb.WriteString("\nRecent Logs (last 50 lines):\n")
        sb.WriteString(string(logBytes))
    }

    return sb.String(), nil
}

func (a *App) getSwarmTaskContext(taskID string) (string, error) {
    dockerClient, err := a.getDockerClient()
    if err != nil {
        return "", err
    }

    var sb strings.Builder

    // Get task details
    task, _, err := dockerClient.TaskInspectWithRaw(context.Background(), taskID)
    if err != nil {
        return "", fmt.Errorf("failed to inspect task: %w", err)
    }

    sb.WriteString(fmt.Sprintf("Task: %s\n", task.ID[:12]))
    sb.WriteString(fmt.Sprintf("Service: %s\n", task.ServiceID[:12]))
    sb.WriteString(fmt.Sprintf("Node: %s\n", task.NodeID[:12]))
    sb.WriteString(fmt.Sprintf("State: %s\n", task.Status.State))

    if task.Status.Err != "" {
        sb.WriteString(fmt.Sprintf("Error: %s\n", task.Status.Err))
    }

    if task.Status.ContainerStatus != nil {
        sb.WriteString(fmt.Sprintf("Container ID: %s\n", task.Status.ContainerStatus.ContainerID[:12]))
        if task.Status.ContainerStatus.ExitCode != 0 {
            sb.WriteString(fmt.Sprintf("Exit Code: %d\n", task.Status.ContainerStatus.ExitCode))
        }
    }

    // Get task logs if container exists
    if task.Status.ContainerStatus != nil {
        logOptions := types.ContainerLogsOptions{
            ShowStdout: true,
            ShowStderr: true,
            Tail:       "50",
        }
        logs, err := dockerClient.ContainerLogs(context.Background(), task.Status.ContainerStatus.ContainerID, logOptions)
        if err == nil {
            defer logs.Close()
            logBytes, _ := io.ReadAll(logs)
            sb.WriteString("\nRecent Logs (last 50 lines):\n")
            sb.WriteString(string(logBytes))
        }
    }

    return sb.String(), nil
}
```

### 3. Frontend: Log Analysis UI

**File**: Update `frontend/src/k8s/resources/pods/LogViewerTab.jsx`

Add "Explain Logs" button:

```javascript
import { AnalyzePodLogs } from '../../../holmes/holmesApi';
import { HolmesResponseRenderer } from '../../../holmes/HolmesResponseRenderer';

// In component:
const [holmesAnalysis, setHolmesAnalysis] = useState(null);
const [analyzingLogs, setAnalyzingLogs] = useState(false);

const handleExplainLogs = async () => {
    setAnalyzingLogs(true);
    try {
        const analysis = await AnalyzePodLogs(namespace, podName, 100);
        setHolmesAnalysis(analysis);
    } catch (err) {
        showError('Failed to analyze logs: ' + err.message);
    } finally {
        setAnalyzingLogs(false);
    }
};

// Add button to UI:
<div style={{ marginBottom: 8 }}>
    <button onClick={handleExplainLogs} disabled={analyzingLogs}>
        {analyzingLogs ? 'Analyzing...' : '🔍 Explain Logs'}
    </button>
</div>

// Display analysis if available:
{holmesAnalysis && (
    <div style={{
        marginTop: 16,
        padding: 16,
        backgroundColor: 'var(--gh-bg-secondary)',
        borderRadius: 8
    }}>
        <h4>Holmes Analysis</h4>
        <HolmesResponseRenderer response={holmesAnalysis} />
    </div>
)}
```

### 4. Frontend: Swarm Integration

**File**: Update `frontend/src/docker/resources/services/ServicesOverviewTable.jsx`

Add "Ask Holmes" similar to K8s pods:

```javascript
import { AnalyzeSwarmService } from '../../../holmes/holmesApi';
import { HolmesResponseRenderer } from '../../../holmes/HolmesResponseRenderer';

const [holmesResponse, setHolmesResponse] = useState(null);
const [holmesLoading, setHolmesLoading] = useState(false);

const handleAnalyzeWithHolmes = async (service) => {
    setHolmesLoading(true);
    try {
        const response = await AnalyzeSwarmService(service.id);
        setHolmesResponse(response);
        // Open bottom panel with Holmes tab
        panelApi.openDetails('holmes');
    } catch (err) {
        showError('Holmes analysis failed: ' + err.message);
    } finally {
        setHolmesLoading(false);
    }
};

// Add to row actions:
getRowActions={(row, api) => [
    {
        label: holmesLoading ? 'Analyzing...' : 'Ask Holmes',
        onClick: () => handleAnalyzeWithHolmes(row),
        icon: '🔍',
    },
    // ... other actions
]}

// Add to tabs:
tabs={[
    { key: 'summary', label: 'Summary' },
    { key: 'tasks', label: 'Tasks' },
    { key: 'logs', label: 'Logs' },
    { key: 'holmes', label: 'Holmes Analysis' },
]}

// Add to renderPanelContent:
if (tabKey === 'holmes') {
    return holmesLoading ? (
        <div style={{ padding: 16 }}>Analyzing with Holmes...</div>
    ) : holmesResponse ? (
        <HolmesResponseRenderer response={holmesResponse} />
    ) : (
        <div style={{ padding: 16 }}>
            <p>No analysis yet.</p>
            <button onClick={() => handleAnalyzeWithHolmes(row)}>
                Analyze with Holmes
            </button>
        </div>
    );
}
```

### 5. API Wrapper Updates

**File**: `frontend/src/holmes/holmesApi.js` (additions)

```javascript
import {
    // ... existing imports
    AnalyzePodLogs as _AnalyzePodLogs,
    AnalyzeSwarmService as _AnalyzeSwarmService,
    AnalyzeSwarmTask as _AnalyzeSwarmTask,
} from '../../wailsjs/go/main/App';

export async function AnalyzePodLogs(namespace, podName, lines = 100) {
    return await _AnalyzePodLogs(namespace, podName, lines);
}

export async function AnalyzeSwarmService(serviceID) {
    return await _AnalyzeSwarmService(serviceID);
}

export async function AnalyzeSwarmTask(taskID) {
    return await _AnalyzeSwarmTask(taskID);
}
```

---

## Testing Requirements

### Go Unit Tests

```go
func TestAnalyzeLogs(t *testing.T) {
    // Create fake Holmes server
    holmesServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        resp := holmesgpt.HolmesResponse{
            Response:  "Found error in logs: connection refused",
            Timestamp: time.Now(),
        }
        json.NewEncoder(w).Encode(resp)
    }))
    defer holmesServer.Close()

    // Create fake K8s client with pod
    pod := &corev1.Pod{
        ObjectMeta: metav1.ObjectMeta{
            Name:      "test-pod",
            Namespace: "default",
        },
    }
    fakeClientset := fake.NewSimpleClientset(pod)

    app := &App{
        ctx:           context.Background(),
        testClientset: fakeClientset,
        holmesClient:  mustCreateHolmesClient(holmesServer.URL),
    }

    resp, err := app.AnalyzeLogs("default", "test-pod", "", 50)
    if err != nil {
        t.Fatalf("AnalyzeLogs failed: %v", err)
    }

    if !strings.Contains(resp.Response, "error") {
        t.Errorf("Expected error analysis in response")
    }
}

func TestAnalyzeSwarmService(t *testing.T) {
    // Similar pattern with fake Docker client
}
```

### E2E Tests

```typescript
// e2e/tests/holmes/40-log-analysis.spec.ts
import { test, expect } from '../../src/fixtures.js';

test.describe('Holmes Log Analysis', () => {
    test('analyzes pod logs', async ({ page }) => {
        test.setTimeout(120_000);

        await page.goto('/');

        // Navigate to pods
        const podsSection = page.locator('#section-pods');
        await podsSection.click();

        // Click first pod
        const firstPod = page.locator('[data-testid="pods-table"] tbody tr').first();
        await firstPod.click();

        // Switch to logs tab
        const logsTab = page.locator('[data-tab="logs"]');
        await logsTab.click();

        // Click "Explain Logs"
        const explainBtn = page.getByRole('button', { name: /explain logs/i });
        await expect(explainBtn).toBeVisible({ timeout: 10_000 });
        await explainBtn.click();

        // Wait for analysis
        const analysis = page.locator('[data-testid="holmes-log-analysis"]');
        await expect(analysis).toBeVisible({ timeout: 60_000 });
    });
});
```

---

## Success Criteria Checklist

- [ ] Log analysis works from log viewer
- [ ] "Explain Logs" button triggers analysis
- [ ] Log analysis includes error/warning detection
- [ ] Docker Swarm services can be analyzed
- [ ] Docker Swarm tasks can be analyzed
- [ ] Swarm integration mirrors K8s UX
- [ ] All Go tests passing with >= 70% coverage
- [ ] All frontend tests passing with >= 70% coverage
- [ ] E2E tests for log analysis passing
- [ ] E2E tests for Swarm integration passing

---

## Next Steps

After Phase 4 completion:

- [ ] Gather user feedback on all features
- [ ] Optimize based on real-world usage patterns
- [ ] Consider additional features:
  - Response caching (if performance issues arise)
  - More resource types (StatefulSets, DaemonSets)
  - Custom Holmes models/toolsets
  - Resource optimization (future phase)

---

**Phase 4 Complete When**: Log analysis and Docker Swarm integration working end-to-end with 70%+ test coverage and comprehensive documentation.
