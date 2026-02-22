# Phase 2: Context-Aware Analysis (Enhanced)

**Status:** DONE
**Created:** 2026-02-06
**Updated:** 2026-02-06

**Status**: Completed
**Duration**: 2 Sprints (4 weeks)
**Prerequisites**: Phase 1 complete
**Goal**: Add context-aware troubleshooting from resource views with markdown formatting and conversation history

## Current Status (Verified 2026-02-06)

- Context enrichment and analysis RPCs are implemented in [pkg/app/holmes_context.go](pkg/app/holmes_context.go) and [pkg/app/holmes_integration.go](pkg/app/holmes_integration.go).
- Holmes UI, conversation history, and markdown rendering are implemented in [frontend/src/holmes/HolmesPanel.tsx](frontend/src/holmes/HolmesPanel.tsx) and [frontend/src/holmes/HolmesResponseRenderer.tsx](frontend/src/holmes/HolmesResponseRenderer.tsx).
- Resource entry points use the Holmes bottom panel + action button pattern from [frontend/src/holmes/HolmesBottomPanel.tsx](frontend/src/holmes/HolmesBottomPanel.tsx) and [frontend/src/holmes/HolmesResourceButton.tsx](frontend/src/holmes/HolmesResourceButton.tsx).
- E2E coverage exists in [e2e/tests/holmes/10-context-analysis.spec.ts](e2e/tests/holmes/10-context-analysis.spec.ts) and [e2e/tests/holmes/11-conversation-history.spec.ts](e2e/tests/holmes/11-conversation-history.spec.ts).
- Note: legacy .jsx references below are historical; current implementation uses .ts/.tsx files.

---

## Overview

### Goals
- ✅ Add "Ask Holmes" buttons to resource detail views
- ✅ Pre-populate questions with resource context
- ✅ Render responses with Markdown and syntax highlighting
- ✅ Support multi-turn conversations with history
- ✅ Maintain 70%+ test coverage

### Prerequisites
- Phase 1 completed and merged
- Holmes basic integration working
- User can ask free-form questions

### Success Criteria
- [x] One-click troubleshooting from any K8s resource view
- [x] Holmes automatically receives resource context
- [x] Responses render Markdown with syntax highlighting
- [x] Conversation history displays all Q&A pairs
- [x] Users can export conversations
- [x] Unit tests for new components >= 70% coverage
- [x] E2E test for "Ask Holmes" flow

---

## Implementation Tasks

### Backend Tasks

#### Context-Aware Analysis Methods
- [x] Create `pkg/app/holmes_context.go`:
    - [x] `getPodContext(namespace, name string) (string, error)`
    - [x] `getDeploymentContext(namespace, name string) (string, error)`
    - [x] `getStatefulSetContext(namespace, name string) (string, error)`
    - [x] `getDaemonSetContext(namespace, name string) (string, error)`
    - [x] `getServiceContext(namespace, name string) (string, error)`

- [x] Enhance `pkg/app/holmes_integration.go` with context-aware methods:
    - [x] `AnalyzePod(namespace, name string) (*holmesgpt.HolmesResponse, error)`
    - [x] `AnalyzeDeployment(namespace, name string) (*holmesgpt.HolmesResponse, error)`
    - [x] `AnalyzeStatefulSet(namespace, name string) (*holmesgpt.HolmesResponse, error)`
    - [x] `AnalyzeDaemonSet(namespace, name string) (*holmesgpt.HolmesResponse, error)`
    - [x] `AnalyzeService(namespace, name string) (*holmesgpt.HolmesResponse, error)`
    - [x] `AnalyzeResource(kind, namespace, name string) (*holmesgpt.HolmesResponse, error)`

#### Testing
- [x] Add tests to `pkg/app/holmes_integration_test.go`:
    - [x] Test `AnalyzePod` with fake K8s client
    - [x] Test `AnalyzeDeployment` with fake K8s client
    - [x] Test context enrichment functions
    - [x] Test error handling for non-existent resources

### Frontend Tasks

#### Response Renderer with Markdown
- [x] **Install dependencies**:
  ```bash
  cd frontend
  npm install react-markdown remark-gfm react-syntax-highlighter
  ```

- [x] Create `frontend/src/holmes/HolmesResponseRenderer.jsx`:
    - [x] Markdown rendering with `react-markdown`
    - [x] Syntax highlighting with `react-syntax-highlighter`
    - [x] Code block copy functionality
    - [x] Link handling (open in new tab)
    - [x] Support for tables, lists, headers

#### Enhanced Holmes Panel with Conversation History
- [x] Update `frontend/src/holmes/HolmesPanel.jsx`:
    - [x] Add conversation history state (array of Q&A)
    - [x] Display Q&A pairs in sequence with timestamps
    - [x] Add "Clear Conversation" button
    - [x] Add "Export" button (save as .txt)
    - [x] Support Ctrl+Enter to submit
    - [x] Improve styling and layout

#### Resource View Integration
- [x] Update K8s resource components to add "Ask Holmes" buttons:
    - [x] `frontend/src/k8s/resources/pods/PodsOverviewTable.jsx`
    - [x] `frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.jsx`
    - [x] `frontend/src/k8s/resources/statefulsets/StatefulSetsOverviewTable.jsx`
    - [x] `frontend/src/k8s/resources/daemonsets/DaemonSetsOverviewTable.jsx`
    - [x] `frontend/src/k8s/resources/services/ServicesOverviewTable.jsx`

- [x] Create `frontend/src/holmes/HolmesBottomPanel.jsx`:
    - [x] Integrate with OverviewTableWithPanel pattern
    - [x] Show Holmes analysis in dedicated tab
    - [x] Display loading/error states
    - [x] Use HolmesResponseRenderer for display

- [x] Create `frontend/src/holmes/HolmesResourceButton.jsx`:
    - [x] Reusable button component
    - [x] Shows in resource action menus
    - [x] Triggers context-aware analysis

#### API Wrapper Updates
- [x] Update `frontend/src/holmes/holmesApi.js`:
    - [x] Add `AnalyzePod(namespace, name)`
    - [x] Add `AnalyzeDeployment(namespace, name)`
    - [x] Add `AnalyzeStatefulSet(namespace, name)`
    - [x] Add `AnalyzeDaemonSet(namespace, name)`
    - [x] Add `AnalyzeService(namespace, name)`
    - [x] Add `AnalyzeResource(kind, namespace, name)`

### Testing Tasks

#### Go Unit Tests
- [x] Test context enrichment for pods
- [x] Test context enrichment for deployments
- [x] Test context enrichment with missing resources
- [x] Test context enrichment with RBAC errors
- [x] Verify coverage >= 70%

#### Frontend Unit Tests
- [x] Create `frontend/src/__tests__/holmesResponseRenderer.test.jsx`
    - [x] Test Markdown rendering
    - [x] Test syntax highlighting
    - [x] Test code block copy functionality
- [x] Update `frontend/src/__tests__/holmesPanel.test.jsx`
    - [x] Test conversation history
    - [x] Test clear functionality
    - [x] Test export functionality
- [x] Create `frontend/src/__tests__/holmesBottomPanel.test.jsx`
    - [x] Test panel rendering
    - [x] Test tab integration
    - [x] Test loading states
- [x] Verify coverage >= 70%

#### E2E Tests
- [x] Create `e2e/tests/holmes/10-context-analysis.spec.ts`:
    - [x] Navigate to Pods view
    - [x] Click on a pod
    - [x] Click "Ask Holmes" button
    - [x] Verify Holmes tab appears in bottom panel
    - [x] Verify response displays with markdown
    - [x] Test with deployment, service
- [x] Create `e2e/tests/holmes/11-conversation-history.spec.ts`:
    - [x] Open Holmes panel
    - [x] Ask initial question
    - [x] Ask follow-up question
    - [x] Verify both Q&A pairs display
    - [x] Test clear conversation
    - [x] Test export conversation

### Documentation Tasks
- [x] Update `CLAUDE.md` with Phase 2 features
- [x] Document context-aware analysis patterns
- [x] Add examples of Holmes integration in resource views
- [x] Document conversation history usage

---

## Detailed Implementation

### 1. Backend: Context Enrichment

**File**: `pkg/app/holmes_context.go`

```go
package apppkg

import (
    "context"
    "fmt"
    "strings"

    corev1 "k8s.io/api/core/v1"
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

func (a *App) getPodContext(namespace, name string) (string, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return "", err
    }

    var sb strings.Builder

    // Get pod
    pod, err := clientset.CoreV1().Pods(namespace).Get(context.Background(), name, metav1.GetOptions{})
    if err != nil {
        return "", fmt.Errorf("failed to get pod: %w", err)
    }

    // Basic info
    sb.WriteString(fmt.Sprintf("Pod: %s/%s\n", namespace, name))
    sb.WriteString(fmt.Sprintf("Status: %s\n", pod.Status.Phase))
    sb.WriteString(fmt.Sprintf("Node: %s\n", pod.Spec.NodeName))

    // Container statuses
    sb.WriteString("\nContainers:\n")
    for _, cs := range pod.Status.ContainerStatuses {
        sb.WriteString(fmt.Sprintf("  %s: Ready=%v, RestartCount=%d\n", cs.Name, cs.Ready, cs.RestartCount))
        if cs.State.Waiting != nil {
            sb.WriteString(fmt.Sprintf("    Waiting: %s - %s\n", cs.State.Waiting.Reason, cs.State.Waiting.Message))
        }
        if cs.State.Terminated != nil {
            sb.WriteString(fmt.Sprintf("    Terminated: %s (exit code %d) - %s\n",
                cs.State.Terminated.Reason, cs.State.Terminated.ExitCode, cs.State.Terminated.Message))
        }
    }

    // Conditions
    sb.WriteString("\nConditions:\n")
    for _, cond := range pod.Status.Conditions {
        sb.WriteString(fmt.Sprintf("  %s: %s\n", cond.Type, cond.Status))
        if cond.Message != "" {
            sb.WriteString(fmt.Sprintf("    Message: %s\n", cond.Message))
        }
    }

    // Events (last 10)
    events, err := clientset.CoreV1().Events(namespace).List(context.Background(), metav1.ListOptions{
        FieldSelector: fmt.Sprintf("involvedObject.name=%s,involvedObject.kind=Pod", name),
    })
    if err == nil && len(events.Items) > 0 {
        sb.WriteString("\nRecent Events (last 10):\n")
        count := 0
        for i := len(events.Items) - 1; i >= 0 && count < 10; i-- {
            event := events.Items[i]
            sb.WriteString(fmt.Sprintf("  [%s] %s: %s\n",
                event.LastTimestamp.Format("15:04:05"), event.Reason, event.Message))
            count++
        }
    }

    // Recent logs (last 50 lines)
    logs := a.getRecentPodLogs(namespace, name, 50)
    if logs != "" {
        sb.WriteString("\nRecent Logs (last 50 lines):\n")
        sb.WriteString(logs)
    }

    return sb.String(), nil
}

func (a *App) getDeploymentContext(namespace, name string) (string, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return "", err
    }

    var sb strings.Builder

    // Get deployment
    deploy, err := clientset.AppsV1().Deployments(namespace).Get(context.Background(), name, metav1.GetOptions{})
    if err != nil {
        return "", fmt.Errorf("failed to get deployment: %w", err)
    }

    sb.WriteString(fmt.Sprintf("Deployment: %s/%s\n", namespace, name))
    sb.WriteString(fmt.Sprintf("Replicas: desired=%d, ready=%d, available=%d\n",
        *deploy.Spec.Replicas, deploy.Status.ReadyReplicas, deploy.Status.AvailableReplicas))
    sb.WriteString(fmt.Sprintf("Strategy: %s\n", deploy.Spec.Strategy.Type))

    // Conditions
    sb.WriteString("\nConditions:\n")
    for _, cond := range deploy.Status.Conditions {
        sb.WriteString(fmt.Sprintf("  %s: %s\n", cond.Type, cond.Status))
        if cond.Message != "" {
            sb.WriteString(fmt.Sprintf("    Message: %s\n", cond.Message))
        }
    }

    // Get pods for this deployment
    pods, err := clientset.CoreV1().Pods(namespace).List(context.Background(), metav1.ListOptions{
        LabelSelector: metav1.FormatLabelSelector(deploy.Spec.Selector),
    })
    if err == nil {
        sb.WriteString(fmt.Sprintf("\nPods (%d):\n", len(pods.Items)))
        for _, pod := range pods.Items {
            sb.WriteString(fmt.Sprintf("  %s: %s\n", pod.Name, pod.Status.Phase))
        }
    }

    return sb.String(), nil
}

func (a *App) getServiceContext(namespace, name string) (string, error) {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return "", err
    }

    var sb strings.Builder

    // Get service
    svc, err := clientset.CoreV1().Services(namespace).Get(context.Background(), name, metav1.GetOptions{})
    if err != nil {
        return "", fmt.Errorf("failed to get service: %w", err)
    }

    sb.WriteString(fmt.Sprintf("Service: %s/%s\n", namespace, name))
    sb.WriteString(fmt.Sprintf("Type: %s\n", svc.Spec.Type))
    sb.WriteString(fmt.Sprintf("ClusterIP: %s\n", svc.Spec.ClusterIP))

    if len(svc.Spec.Ports) > 0 {
        sb.WriteString("\nPorts:\n")
        for _, port := range svc.Spec.Ports {
            sb.WriteString(fmt.Sprintf("  %s: %d -> %d\n", port.Name, port.Port, port.TargetPort.IntVal))
        }
    }

    // Get endpoints
    endpoints, err := clientset.CoreV1().Endpoints(namespace).Get(context.Background(), name, metav1.GetOptions{})
    if err == nil {
        totalAddresses := 0
        for _, subset := range endpoints.Subsets {
            totalAddresses += len(subset.Addresses)
        }
        sb.WriteString(fmt.Sprintf("\nEndpoints: %d ready\n", totalAddresses))
    }

    return sb.String(), nil
}

func (a *App) getRecentPodLogs(namespace, name string, lines int) string {
    clientset, err := a.getKubernetesInterface()
    if err != nil {
        return ""
    }

    logOptions := &corev1.PodLogOptions{
        TailLines: int64Ptr(int64(lines)),
    }

    req := clientset.CoreV1().Pods(namespace).GetLogs(name, logOptions)
    logs, err := req.DoRaw(context.Background())
    if err != nil {
        return fmt.Sprintf("(Failed to fetch logs: %v)", err)
    }

    return string(logs)
}

func int64Ptr(i int64) *int64 {
    return &i
}
```

### 2. Backend: Analysis Methods

**File**: `pkg/app/holmes_integration.go` (additions)

```go
func (a *App) AnalyzePod(namespace, name string) (*holmesgpt.HolmesResponse, error) {
    // Get resource context
    ctx, err := a.getPodContext(namespace, name)
    if err != nil {
        return nil, fmt.Errorf("failed to get pod context: %w", err)
    }

    // Build question with context
    question := fmt.Sprintf(
        "Analyze this Kubernetes pod and explain any issues:\n\nPod: %s/%s\n\n%s",
        namespace, name, ctx,
    )

    // Ask Holmes
    return a.AskHolmes(question)
}

func (a *App) AnalyzeDeployment(namespace, name string) (*holmesgpt.HolmesResponse, error) {
    ctx, err := a.getDeploymentContext(namespace, name)
    if err != nil {
        return nil, fmt.Errorf("failed to get deployment context: %w", err)
    }

    question := fmt.Sprintf(
        "Analyze this Kubernetes deployment and explain any issues:\n\nDeployment: %s/%s\n\n%s",
        namespace, name, ctx,
    )

    return a.AskHolmes(question)
}

func (a *App) AnalyzeService(namespace, name string) (*holmesgpt.HolmesResponse, error) {
    ctx, err := a.getServiceContext(namespace, name)
    if err != nil {
        return nil, fmt.Errorf("failed to get service context: %w", err)
    }

    question := fmt.Sprintf(
        "Analyze this Kubernetes service and explain any issues:\n\nService: %s/%s\n\n%s",
        namespace, name, ctx,
    )

    return a.AskHolmes(question)
}

func (a *App) AnalyzeResource(kind, namespace, name string) (*holmesgpt.HolmesResponse, error) {
    switch kind {
    case "Pod":
        return a.AnalyzePod(namespace, name)
    case "Deployment":
        return a.AnalyzeDeployment(namespace, name)
    case "Service":
        return a.AnalyzeService(namespace, name)
    default:
        return nil, fmt.Errorf("unsupported resource kind: %s", kind)
    }
}
```

### 3. Frontend: Response Renderer

**File**: `frontend/src/holmes/HolmesResponseRenderer.jsx`

```javascript
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';

export function HolmesResponseRenderer({ response }) {
    if (!response) return null;

    const handleCopyCode = (code) => {
        navigator.clipboard.writeText(code);
    };

    return (
        <div style={{ padding: 16 }}>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                    code({ node, inline, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || '');
                        const codeString = String(children).replace(/\n$/, '');

                        return !inline && match ? (
                            <div style={{ position: 'relative' }}>
                                <button
                                    onClick={() => handleCopyCode(codeString)}
                                    style={{
                                        position: 'absolute',
                                        top: 8,
                                        right: 8,
                                        padding: '4px 8px',
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        backgroundColor: 'var(--gh-accent)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 4,
                                    }}
                                >
                                    Copy
                                </button>
                                <SyntaxHighlighter
                                    style={vscDarkPlus}
                                    language={match[1]}
                                    PreTag="div"
                                    {...props}
                                >
                                    {codeString}
                                </SyntaxHighlighter>
                            </div>
                        ) : (
                            <code className={className} {...props}>
                                {children}
                            </code>
                        );
                    },
                    a({ node, children, href, ...props }) {
                        return (
                            <a href={href} target="_blank" rel="noopener noreferrer" {...props}>
                                {children}
                            </a>
                        );
                    },
                }}
            >
                {response.response}
            </ReactMarkdown>

            {response.rich_output && (
                <div style={{ marginTop: 16 }}>
                    <h4>Additional Information</h4>
                    <pre>{JSON.stringify(response.rich_output, null, 2)}</pre>
                </div>
            )}

            <div style={{ marginTop: 16, fontSize: 12, color: 'var(--gh-text-secondary)' }}>
                Generated at {new Date(response.timestamp).toLocaleString()}
            </div>
        </div>
    );
}
```

### 4. Frontend: Enhanced Holmes Panel

**File**: `frontend/src/holmes/HolmesPanel.jsx` (updated)

```javascript
import React, { useState } from 'react';
import { useHolmes } from './HolmesContext';
import { HolmesResponseRenderer } from './HolmesResponseRenderer';

export function HolmesPanel({ visible, onClose }) {
    const { state, askHolmes, showConfigModal } = useHolmes();
    const [question, setQuestion] = useState('');
    const [conversation, setConversation] = useState([]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!question.trim()) return;

        const newQuestion = question;
        setQuestion('');

        // Add question to conversation
        setConversation((prev) => [...prev, { type: 'question', text: newQuestion, timestamp: new Date() }]);

        try {
            const response = await askHolmes(newQuestion);
            setConversation((prev) => [
                ...prev,
                { type: 'response', data: response, timestamp: new Date() },
            ]);
        } catch (err) {
            setConversation((prev) => [
                ...prev,
                { type: 'error', text: err.message, timestamp: new Date() },
            ]);
        }
    };

    const handleClear = () => {
        setConversation([]);
        setQuestion('');
    };

    const handleExport = () => {
        const text = conversation
            .map((item) => {
                if (item.type === 'question') {
                    return `[${item.timestamp.toLocaleTimeString()}] You: ${item.text}`;
                } else if (item.type === 'response') {
                    return `[${item.timestamp.toLocaleTimeString()}] Holmes: ${item.data.response}`;
                } else if (item.type === 'error') {
                    return `[${item.timestamp.toLocaleTimeString()}] Error: ${item.text}`;
                }
                return '';
            })
            .join('\n\n');

        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `holmes-conversation-${Date.now()}.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed',
            right: 0,
            top: 60,
            bottom: 0,
            width: 500,
            backgroundColor: 'var(--gh-bg)',
            borderLeft: '1px solid var(--gh-border)',
            display: 'flex',
            flexDirection: 'column',
            zIndex: 100,
        }}>
            {/* Header */}
            <div style={{
                padding: 16,
                borderBottom: '1px solid var(--gh-border)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
            }}>
                <h3 style={{ margin: 0 }}>Holmes AI</h3>
                <div style={{ display: 'flex', gap: 8 }}>
                    {conversation.length > 0 && (
                        <>
                            <button onClick={handleExport} title="Export conversation">
                                Export
                            </button>
                            <button onClick={handleClear} title="Clear conversation">
                                Clear
                            </button>
                        </>
                    )}
                    <button onClick={onClose}>✕</button>
                </div>
            </div>

            {/* Content */}
            {!state.configured ? (
                <div style={{ padding: 16 }}>
                    <p>Holmes is not configured.</p>
                    <button onClick={showConfigModal}>Configure Holmes</button>
                </div>
            ) : (
                <>
                    {/* Conversation */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: 16,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 16,
                    }}>
                        {conversation.length === 0 && (
                            <div style={{ color: 'var(--gh-text-secondary)' }}>
                                Ask Holmes a question about your cluster...
                            </div>
                        )}
                        {conversation.map((item, idx) => (
                            <div key={idx}>
                                {item.type === 'question' && (
                                    <div style={{
                                        padding: 12,
                                        backgroundColor: 'var(--gh-accent-subtle)',
                                        borderRadius: 8,
                                        marginBottom: 8,
                                    }}>
                                        <strong>You:</strong> {item.text}
                                    </div>
                                )}
                                {item.type === 'response' && (
                                    <div style={{
                                        padding: 12,
                                        backgroundColor: 'var(--gh-bg-secondary)',
                                        borderRadius: 8,
                                    }}>
                                        <strong>Holmes:</strong>
                                        <HolmesResponseRenderer response={item.data} />
                                    </div>
                                )}
                                {item.type === 'error' && (
                                    <div style={{
                                        padding: 12,
                                        backgroundColor: 'var(--gh-error-subtle)',
                                        borderRadius: 8,
                                        color: 'var(--gh-error)',
                                    }}>
                                        Error: {item.text}
                                    </div>
                                )}
                            </div>
                        ))}
                        {state.loading && (
                            <div style={{ color: 'var(--gh-text-secondary)' }}>
                                Holmes is thinking...
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <form onSubmit={handleSubmit} style={{
                        padding: 16,
                        borderTop: '1px solid var(--gh-border)',
                    }}>
                        <textarea
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            placeholder="Ask Holmes about your cluster..."
                            rows={3}
                            style={{
                                width: '100%',
                                marginBottom: 8,
                                resize: 'vertical',
                            }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                    handleSubmit(e);
                                }
                            }}
                        />
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: 12, color: 'var(--gh-text-secondary)' }}>
                                Ctrl+Enter to send
                            </span>
                            <button type="submit" disabled={state.loading || !question.trim()}>
                                Send
                            </button>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
}
```

### 5. Frontend: Resource View Integration

**Example for PodsOverviewTable.jsx**:

```javascript
import { AnalyzePod } from '../../holmes/holmesApi';
import { HolmesResponseRenderer } from '../../holmes/HolmesResponseRenderer';

// In component:
const [holmesResponse, setHolmesResponse] = useState(null);
const [holmesLoading, setHolmesLoading] = useState(false);

const handleAnalyzeWithHolmes = async (pod) => {
    setHolmesLoading(true);
    try {
        const response = await AnalyzePod(pod.namespace, pod.name);
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
    { key: 'logs', label: 'Logs' },
    { key: 'events', label: 'Events' },
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

---

## Success Criteria Checklist

- [ ] "Ask Holmes" button appears in all major resource views
- [ ] Clicking "Ask Holmes" triggers context-aware analysis
- [ ] Holmes receives full resource context (status, events, logs)
- [ ] Responses render with Markdown formatting
- [ ] Code blocks have syntax highlighting
- [ ] Copy-to-clipboard works for code blocks
- [ ] Conversation history works in Holmes panel
- [ ] Clear button resets conversation
- [ ] Export button saves conversation as .txt
- [ ] Ctrl+Enter submits questions
- [ ] All Go tests passing with >= 70% coverage
- [ ] All frontend tests passing with >= 70% coverage
- [ ] E2E test for context analysis passing
- [ ] E2E test for conversation history passing
- [ ] Documentation updated

---

## Next Phase Prerequisites

Before moving to Phase 3, ensure:

- [ ] All Phase 2 tasks completed
- [ ] Context-aware analysis working for all resource types
- [ ] Markdown rendering polished and user-friendly
- [ ] Conversation history reliable
- [ ] All tests passing with 70%+ coverage
- [ ] Code reviewed and merged
- [ ] User feedback collected on UX

---

**Phase 2 Complete When**: Users can one-click analyze any K8s resource from its detail view with well-formatted, context-aware responses, and have multi-turn conversations with full history.

