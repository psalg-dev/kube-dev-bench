# Phase 3: Dashboard & Alerts (Streamlined)

**Status**: Not Started
**Duration**: 1.5 Sprints (3 weeks)
**Prerequisites**: Phase 1 and 2 complete
**Goal**: Add manual cluster health scanning dashboard and Prometheus alert investigation

---

## Overview

### Goals
- ✅ Implement manual cluster health scanning
- ✅ Create dashboard widget for detected issues
- ✅ Integrate Prometheus alert investigation
- ✅ Maintain 70%+ test coverage with E2E tests

### Prerequisites
- Phase 1 and 2 completed
- Holmes context-aware analysis working
- User feedback from Phase 2 incorporated

### Success Criteria
- [ ] Manual scan detects common cluster issues
- [ ] Dashboard shows issue count with quick navigation
- [ ] Prometheus alerts can be investigated via Holmes
- [ ] Users can view alert investigation history
- [ ] E2E tests verify dashboard and alerts
- [ ] Test coverage >= 70%

---

## Implementation Tasks

### Backend Tasks

#### Manual Health Scanning
- [ ] Create `pkg/app/holmes_issues.go`:
  - [ ] `ScanClusterIssues() ([]HolmesIssue, error)` - manual scan only
  - [ ] `scanPods()` - detect crash loops, image pull errors, etc.
  - [ ] `scanDeployments()` - detect unavailable replicas
  - [ ] `scanNodes()` - detect node pressure, not ready
  - [ ] Issue type definitions with severity (critical, warning, info)

#### Alert Integration
- [ ] Create `pkg/app/holmes_alerts.go`:
  - [ ] `GetPrometheusAlerts(prometheusURL string) ([]Alert, error)`
  - [ ] `InvestigateAlert(alert Alert) (*holmesgpt.HolmesResponse, error)`
  - [ ] `GetAlertInvestigationHistory() ([]AlertInvestigation, error)`
  - [ ] Alert persistence (JSON file in ~/.KubeDevBench/)

#### Wails RPC Methods
- [ ] Add to `pkg/app/holmes_integration.go`:
  - [ ] `ScanForIssues() ([]HolmesIssue, error)` - manual scan RPC
  - [ ] `DismissIssue(issueID string) error`
  - [ ] `GetPrometheusAlerts(prometheusURL string) ([]Alert, error)`
  - [ ] `InvestigateAlert(alertName, prometheusURL string) (*holmesgpt.HolmesResponse, error)`
  - [ ] `GetAlertHistory() ([]AlertInvestigation, error)`

#### Testing
- [ ] Test manual health scan with fake K8s resources
- [ ] Test issue detection logic
- [ ] Test alert fetching from fake Prometheus
- [ ] Test alert investigation
- [ ] Verify coverage >= 70%

### Frontend Tasks

#### Dashboard Widget
- [ ] Create `frontend/src/holmes/HolmesDashboard.jsx`:
  - [ ] Display issue count badge
  - [ ] List issues with severity indicators (red, yellow, blue)
  - [ ] "Scan Now" button for manual trigger
  - [ ] "Dismiss" action per issue
  - [ ] Click issue to view details in Holmes panel
  - [ ] Loading state during scan

#### Alert Investigation UI
- [ ] Create `frontend/src/holmes/AlertsView.jsx`:
  - [ ] List active Prometheus alerts
  - [ ] "Investigate" button per alert
  - [ ] Show investigation results with HolmesResponseRenderer
  - [ ] Investigation history with timestamps
  - [ ] Link to Prometheus dashboard

#### State Management Updates
- [ ] Update `frontend/src/holmes/HolmesContext.jsx`:
  - [ ] Add issues state
  - [ ] Add alerts state
  - [ ] Add `scanForIssues()` function
  - [ ] Add `investigateAlert(alert)` function
  - [ ] Add `dismissIssue(issueID)` function

#### API Wrapper Updates
- [ ] Update `frontend/src/holmes/holmesApi.js`:
  - [ ] Add `ScanForIssues()`
  - [ ] Add `DismissIssue(issueID)`
  - [ ] Add `GetPrometheusAlerts(prometheusURL)`
  - [ ] Add `InvestigateAlert(alertName, prometheusURL)`
  - [ ] Add `GetAlertHistory()`

### Testing Tasks

#### Go Unit Tests
- [ ] Test issue detection for pods (crash loops, image pull errors)
- [ ] Test issue detection for deployments (unavailable replicas)
- [ ] Test issue detection for nodes (pressure, not ready)
- [ ] Test Prometheus alert parsing
- [ ] Test alert investigation with mock Holmes
- [ ] Verify coverage >= 70%

#### Frontend Unit Tests
- [ ] Test HolmesDashboard rendering
- [ ] Test "Scan Now" button functionality
- [ ] Test issue dismissal
- [ ] Test AlertsView rendering
- [ ] Test alert investigation flow
- [ ] Verify coverage >= 70%

#### E2E Tests
- [ ] Create `e2e/tests/holmes/20-manual-scan.spec.ts`:
  - [ ] Navigate to dashboard
  - [ ] Click "Scan Now"
  - [ ] Wait for scan to complete
  - [ ] Verify issues appear
  - [ ] Click issue to view details
  - [ ] Dismiss issue
- [ ] Create `e2e/tests/holmes/21-alert-investigation.spec.ts`:
  - [ ] Navigate to alerts view
  - [ ] Click "Investigate" on alert
  - [ ] Verify Holmes analysis appears
  - [ ] Check investigation history

### Documentation Tasks
- [ ] Update `CLAUDE.md` with Phase 3 features
- [ ] Document manual scanning usage
- [ ] Document alert integration setup
- [ ] Add troubleshooting guide

---

## Detailed Implementation

### 1. Backend: Issue Detection

**File**: `pkg/app/holmes_issues.go`

```go
package apppkg

import (
    "context"
    "fmt"
    "time"

    corev1 "k8s.io/api/core/v1"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

type HolmesIssue struct {
    ID           string    `json:"id"`
    Severity     string    `json:"severity"` // critical, warning, info
    ResourceType string    `json:"resourceType"`
    Namespace    string    `json:"namespace"`
    Name         string    `json:"name"`
    Title        string    `json:"title"`
    Description  string    `json:"description"`
    DetectedAt   time.Time `json:"detectedAt"`
    Dismissed    bool      `json:"dismissed"`
}

func (a *App) ScanClusterIssues() ([]HolmesIssue, error) {
    var allIssues []HolmesIssue

    // Scan pods
    podIssues, err := a.scanPods()
    if err != nil {
        fmt.Printf("Pod scan failed: %v\n", err)
    } else {
        allIssues = append(allIssues, podIssues...)
    }

    // Scan deployments
    deployIssues, err := a.scanDeployments()
    if err != nil {
        fmt.Printf("Deployment scan failed: %v\n", err)
    } else {
        allIssues = append(allIssues, deployIssues...)
    }

    // Scan nodes
    nodeIssues, err := a.scanNodes()
    if err != nil {
        fmt.Printf("Node scan failed: %v\n", err)
    } else {
        allIssues = append(allIssues, nodeIssues...)
    }

    return allIssues, nil
}

func (a *App) scanPods() ([]HolmesIssue, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return nil, err
    }

    var issues []HolmesIssue

    pods, err := clientset.CoreV1().Pods("").List(context.Background(), metav1.ListOptions{})
    if err != nil {
        return nil, err
    }

    for _, pod := range pods.Items {
        // Check for crash loops
        for _, cs := range pod.Status.ContainerStatuses {
            if cs.RestartCount > 5 {
                issues = append(issues, HolmesIssue{
                    ID:           fmt.Sprintf("pod-%s-%s-crash-loop", pod.Namespace, pod.Name),
                    Severity:     "critical",
                    ResourceType: "Pod",
                    Namespace:    pod.Namespace,
                    Name:         pod.Name,
                    Title:        "Container in crash loop",
                    Description:  fmt.Sprintf("Container %s has restarted %d times", cs.Name, cs.RestartCount),
                    DetectedAt:   time.Now(),
                })
            }

            // Check for image pull errors
            if cs.State.Waiting != nil {
                severity := "warning"
                if cs.State.Waiting.Reason == "ImagePullBackOff" || cs.State.Waiting.Reason == "ErrImagePull" {
                    severity = "critical"
                }

                issues = append(issues, HolmesIssue{
                    ID:           fmt.Sprintf("pod-%s-%s-waiting", pod.Namespace, pod.Name),
                    Severity:     severity,
                    ResourceType: "Pod",
                    Namespace:    pod.Namespace,
                    Name:         pod.Name,
                    Title:        fmt.Sprintf("Container waiting: %s", cs.State.Waiting.Reason),
                    Description:  cs.State.Waiting.Message,
                    DetectedAt:   time.Now(),
                })
            }
        }

        // Check pod phase
        if pod.Status.Phase == corev1.PodFailed {
            issues = append(issues, HolmesIssue{
                ID:           fmt.Sprintf("pod-%s-%s-failed", pod.Namespace, pod.Name),
                Severity:     "critical",
                ResourceType: "Pod",
                Namespace:    pod.Namespace,
                Name:         pod.Name,
                Title:        "Pod in Failed state",
                Description:  pod.Status.Message,
                DetectedAt:   time.Now(),
            })
        }
    }

    return issues, nil
}

func (a *App) scanDeployments() ([]HolmesIssue, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return nil, err
    }

    var issues []HolmesIssue

    deployments, err := clientset.AppsV1().Deployments("").List(context.Background(), metav1.ListOptions{})
    if err != nil {
        return nil, err
    }

    for _, deploy := range deployments.Items {
        if deploy.Status.Replicas != deploy.Status.AvailableReplicas {
            issues = append(issues, HolmesIssue{
                ID:           fmt.Sprintf("deployment-%s-%s-unavailable", deploy.Namespace, deploy.Name),
                Severity:     "warning",
                ResourceType: "Deployment",
                Namespace:    deploy.Namespace,
                Name:         deploy.Name,
                Title:        "Deployment has unavailable replicas",
                Description:  fmt.Sprintf("%d/%d replicas available", deploy.Status.AvailableReplicas, deploy.Status.Replicas),
                DetectedAt:   time.Now(),
            })
        }
    }

    return issues, nil
}

func (a *App) scanNodes() ([]HolmesIssue, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return nil, err
    }

    var issues []HolmesIssue

    nodes, err := clientset.CoreV1().Nodes().List(context.Background(), metav1.ListOptions{})
    if err != nil {
        return nil, err
    }

    for _, node := range nodes.Items {
        for _, cond := range node.Status.Conditions {
            if cond.Type == corev1.NodeReady && cond.Status != corev1.ConditionTrue {
                issues = append(issues, HolmesIssue{
                    ID:           fmt.Sprintf("node-%s-not-ready", node.Name),
                    Severity:     "critical",
                    ResourceType: "Node",
                    Name:         node.Name,
                    Title:        "Node is not ready",
                    Description:  cond.Message,
                    DetectedAt:   time.Now(),
                })
            }

            if cond.Type == corev1.NodeDiskPressure && cond.Status == corev1.ConditionTrue {
                issues = append(issues, HolmesIssue{
                    ID:           fmt.Sprintf("node-%s-disk-pressure", node.Name),
                    Severity:     "warning",
                    ResourceType: "Node",
                    Name:         node.Name,
                    Title:        "Node disk pressure",
                    Description:  cond.Message,
                    DetectedAt:   time.Now(),
                })
            }

            if cond.Type == corev1.NodeMemoryPressure && cond.Status == corev1.ConditionTrue {
                issues = append(issues, HolmesIssue{
                    ID:           fmt.Sprintf("node-%s-memory-pressure", node.Name),
                    Severity:     "warning",
                    ResourceType: "Node",
                    Name:         node.Name,
                    Title:        "Node memory pressure",
                    Description:  cond.Message,
                    DetectedAt:   time.Now(),
                })
            }
        }
    }

    return issues, nil
}
```

### 2. Backend: Alert Integration

**File**: `pkg/app/holmes_alerts.go`

```go
package apppkg

import (
    "encoding/json"
    "fmt"
    "io"
    "net/http"
    "time"

    "github.com/yourusername/kube-dev-bench/pkg/app/holmesgpt"
)

type Alert struct {
    Name        string            `json:"name"`
    State       string            `json:"state"`
    Value       float64           `json:"value"`
    Labels      map[string]string `json:"labels"`
    Annotations map[string]string `json:"annotations"`
    ActiveAt    time.Time         `json:"activeAt"`
}

type AlertInvestigation struct {
    AlertName  string                   `json:"alertName"`
    Timestamp  time.Time                `json:"timestamp"`
    Analysis   *holmesgpt.HolmesResponse `json:"analysis"`
}

func (a *App) GetPrometheusAlerts(prometheusURL string) ([]Alert, error) {
    url := fmt.Sprintf("%s/api/v1/alerts", prometheusURL)

    resp, err := http.Get(url)
    if err != nil {
        return nil, fmt.Errorf("failed to fetch alerts: %w", err)
    }
    defer resp.Body.Close()

    body, err := io.ReadAll(resp.Body)
    if err != nil {
        return nil, fmt.Errorf("failed to read response: %w", err)
    }

    var promResp struct {
        Status string `json:"status"`
        Data   struct {
            Alerts []struct {
                Labels      map[string]string `json:"labels"`
                Annotations map[string]string `json:"annotations"`
                State       string            `json:"state"`
                Value       float64           `json:"value"`
                ActiveAt    time.Time         `json:"activeAt"`
            } `json:"alerts"`
        } `json:"data"`
    }

    if err := json.Unmarshal(body, &promResp); err != nil {
        return nil, fmt.Errorf("failed to parse response: %w", err)
    }

    var alerts []Alert
    for _, a := range promResp.Data.Alerts {
        alerts = append(alerts, Alert{
            Name:        a.Labels["alertname"],
            State:       a.State,
            Value:       a.Value,
            Labels:      a.Labels,
            Annotations: a.Annotations,
            ActiveAt:    a.ActiveAt,
        })
    }

    return alerts, nil
}

func (a *App) InvestigateAlert(alert Alert) (*holmesgpt.HolmesResponse, error) {
    // Build context from alert
    question := fmt.Sprintf(
        "Investigate this Prometheus alert:\n\nAlert: %s\nState: %s\nValue: %.2f\nDescription: %s\n\nWhat is the root cause and how can it be fixed?",
        alert.Name,
        alert.State,
        alert.Value,
        alert.Annotations["description"],
    )

    // Ask Holmes
    a.holmesMu.RLock()
    client := a.holmesClient
    a.holmesMu.RUnlock()

    if client == nil {
        return nil, fmt.Errorf("Holmes is not configured")
    }

    response, err := client.Ask(question)
    if err != nil {
        return nil, err
    }

    // Save investigation to history
    investigation := AlertInvestigation{
        AlertName: alert.Name,
        Timestamp: time.Now(),
        Analysis:  response,
    }

    // Append to history (stored in memory for now, could persist to file)
    a.alertHistoryMu.Lock()
    a.alertHistory = append(a.alertHistory, investigation)
    a.alertHistoryMu.Unlock()

    return response, nil
}

func (a *App) GetAlertInvestigationHistory() ([]AlertInvestigation, error) {
    a.alertHistoryMu.RLock()
    defer a.alertHistoryMu.RUnlock()

    return a.alertHistory, nil
}
```

### 3. Frontend: Dashboard Widget

**File**: `frontend/src/holmes/HolmesDashboard.jsx`

```javascript
import React, { useState, useEffect } from 'react';
import { ScanForIssues, DismissIssue } from './holmesApi';
import { showSuccess, showError } from '../notification';

export function HolmesDashboard() {
    const [issues, setIssues] = useState([]);
    const [loading, setLoading] = useState(false);

    const handleScan = async () => {
        setLoading(true);
        try {
            const detectedIssues = await ScanForIssues();
            setIssues(detectedIssues || []);
            showSuccess(`Scan complete. Found ${detectedIssues.length} issues.`);
        } catch (err) {
            showError('Scan failed: ' + err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDismiss = async (issueID) => {
        try {
            await DismissIssue(issueID);
            setIssues((prev) => prev.filter((i) => i.id !== issueID));
            showSuccess('Issue dismissed');
        } catch (err) {
            showError('Failed to dismiss issue: ' + err.message);
        }
    };

    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    const getSeverityColor = (severity) => {
        switch (severity) {
            case 'critical':
                return '#f85149';
            case 'warning':
                return '#d29922';
            case 'info':
                return '#58a6ff';
            default:
                return 'var(--gh-text)';
        }
    };

    return (
        <div
            style={{
                padding: 16,
                backgroundColor: 'var(--gh-bg-secondary)',
                borderRadius: 8,
                marginBottom: 16,
            }}
        >
            <div
                style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: 16,
                }}
            >
                <h3 style={{ margin: 0 }}>
                    🔍 Holmes Health Check
                    {issues.length > 0 && (
                        <span
                            style={{
                                marginLeft: 8,
                                padding: '2px 8px',
                                backgroundColor: criticalCount > 0 ? '#f85149' : '#d29922',
                                color: 'white',
                                borderRadius: 12,
                                fontSize: 12,
                            }}
                        >
                            {issues.length}
                        </span>
                    )}
                </h3>
                <button onClick={handleScan} disabled={loading}>
                    {loading ? 'Scanning...' : '🔄 Scan Now'}
                </button>
            </div>

            {issues.length === 0 ? (
                <div style={{ color: 'var(--gh-text-secondary)' }}>
                    {loading ? 'Scanning cluster...' : 'No issues detected. Click "Scan Now" to check your cluster health.'}
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {issues.map((issue) => (
                        <div
                            key={issue.id}
                            style={{
                                padding: 12,
                                backgroundColor: 'var(--gh-bg)',
                                borderLeft: `4px solid ${getSeverityColor(issue.severity)}`,
                                borderRadius: 4,
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                            }}
                        >
                            <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 'bold', marginBottom: 4 }}>
                                    {issue.title}
                                </div>
                                <div
                                    style={{
                                        fontSize: 12,
                                        color: 'var(--gh-text-secondary)',
                                        marginBottom: 4,
                                    }}
                                >
                                    {issue.resourceType} {issue.namespace && `• ${issue.namespace}`} • {issue.name}
                                </div>
                                {issue.description && (
                                    <div style={{ fontSize: 12 }}>{issue.description}</div>
                                )}
                            </div>
                            <button
                                onClick={() => handleDismiss(issue.id)}
                                style={{
                                    marginLeft: 8,
                                    padding: '4px 8px',
                                    fontSize: 12,
                                }}
                            >
                                Dismiss
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
```

---

## Success Criteria Checklist

- [ ] Manual scan detects common cluster issues (pods, deployments, nodes)
- [ ] Dashboard widget displays issues with severity colors
- [ ] "Scan Now" button triggers manual scan
- [ ] Users can dismiss issues
- [ ] Prometheus alerts can be fetched and listed
- [ ] "Investigate" button analyzes alerts with Holmes
- [ ] Alert investigation history displays past analyses
- [ ] All Go tests passing with >= 70% coverage
- [ ] All frontend tests passing with >= 70% coverage
- [ ] E2E tests for manual scan and alerts passing

---

## Next Phase Prerequisites

Before moving to Phase 4, ensure:

- [ ] All Phase 3 tasks completed
- [ ] Manual scanning stable and reliable
- [ ] Dashboard widget intuitive
- [ ] Alert investigation working
- [ ] All tests passing with 70%+ coverage
- [ ] Code reviewed and merged

---

**Phase 3 Complete When**: Manual health scanning detects cluster issues, displays them in dashboard, and users can investigate Prometheus alerts with Holmes.
