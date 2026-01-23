# Revised HolmesGPT Implementation Roadmap

**Scope**: Streamlined implementation focusing on core features only

---

## Phase 1: Foundation (Complete) ✅

**Duration**: 2 Sprints (4 weeks)

### All Phase 1 Features Included
- ✅ Holmes configuration UI (endpoint, API key, test connection)
- ✅ Holmes panel with free-form query input
- ✅ Basic HTTP client for Holmes API
- ✅ Wails RPC methods
- ✅ React state management (HolmesContext)
- ✅ Configuration persistence
- ✅ 70%+ test coverage

**Files to Create**: ~15 files (Go backend + React frontend)

See [phase1.md](phase1.md) for complete implementation details.

---

## Phase 2: Context-Aware Analysis (Enhanced)

**Duration**: 2 Sprints (4 weeks)

### Features to Implement

#### ✅ One-Click Analysis from Resource Views
- Add "Ask Holmes" button to resource row actions
- Trigger analysis directly from pod/deployment/service views
- Display results in bottom panel

#### ✅ Context-Aware "Ask Holmes" Buttons
- Pre-populate questions with resource context (namespace, name, status)
- Gather resource state: events, logs (last 50 lines), container statuses
- Send enriched context to Holmes automatically

#### ✅ Advanced Formatting (Markdown & Syntax Highlighting)
- Render Holmes responses with Markdown support
- Syntax highlighting for code blocks (YAML, JSON, shell)
- Copy-to-clipboard functionality for code snippets
- Support for tables, lists, headers in responses

#### ✅ Conversation History / Chat Interface
- Multi-turn conversation support in Holmes panel
- Display full conversation history (questions + responses)
- Clear conversation button
- Export conversation functionality

### Removed from Original Phase 2
- ❌ Follow-up question suggestions (manual follow-ups only)

### Implementation Tasks

#### Backend (Go)
- [ ] Create `pkg/app/holmes_context.go`
  - `getPodContext(namespace, name string) (string, error)`
  - `getDeploymentContext(namespace, name string) (string, error)`
  - `getServiceContext(namespace, name string) (string, error)`

- [ ] Add to `pkg/app/holmes_integration.go`
  - `AnalyzePod(namespace, name string) (*holmesgpt.HolmesResponse, error)`
  - `AnalyzeDeployment(namespace, name string) (*holmesgpt.HolmesResponse, error)`
  - `AnalyzeService(namespace, name string) (*holmesgpt.HolmesResponse, error)`

#### Frontend (React)
- [ ] **Install dependencies**:
  ```bash
  cd frontend
  npm install react-markdown remark-gfm react-syntax-highlighter
  ```

- [ ] Create `frontend/src/holmes/HolmesResponseRenderer.jsx`
  - Markdown rendering with `react-markdown`
  - Syntax highlighting with `react-syntax-highlighter`
  - Code block copy functionality
  - Link handling (open in new tab)

- [ ] Update `frontend/src/holmes/HolmesPanel.jsx`
  - Add conversation history state
  - Display Q&A pairs in sequence
  - Add "Clear Conversation" button
  - Add "Export" button (save as .txt)
  - Support Ctrl+Enter to submit

- [ ] Update resource view components:
  - `frontend/src/k8s/resources/pods/PodsOverviewTable.jsx`
  - `frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.jsx`
  - `frontend/src/k8s/resources/services/ServicesOverviewTable.jsx`
  - Add Holmes tab to bottom panel
  - Use HolmesResponseRenderer for display

- [ ] Create `frontend/src/holmes/HolmesBottomPanel.jsx`
  - Integration with OverviewTableWithPanel pattern
  - Holmes analysis tab in bottom panel
  - Loading/error states

- [ ] Update `frontend/src/holmes/holmesApi.js`
  - Add `AnalyzePod`, `AnalyzeDeployment`, `AnalyzeService` wrappers

#### Testing
- [ ] Go unit tests for context enrichment
- [ ] Frontend unit tests for HolmesResponseRenderer
- [ ] Frontend unit tests for conversation history
- [ ] Frontend unit tests for markdown rendering
- [ ] E2E test: Click "Ask Holmes" from pod view
- [ ] E2E test: Multi-turn conversation in panel

**Estimated Files**: ~10 files (3 Go, 7 React)

---

## Phase 3: Dashboard & Alerts (Streamlined)

**Duration**: 1.5 Sprints (3 weeks)

### Features to Implement

#### ✅ Dashboard Widget Showing Issues
- Display detected cluster issues in dashboard
- Show issue count with severity indicators (critical, warning, info)
- Click to view issue details
- Manual "Scan Now" button (no background scanning)

#### ✅ Alert Investigation
- Integrate with Prometheus alerts
- "Investigate" button for each alert
- Show Holmes analysis of alert root cause
- Alert investigation history

### Removed from Original Phase 3
- ❌ Background health scanning (manual only)
- ❌ Automatic periodic scanning
- ❌ Interactive chat interface
- ❌ Follow-up question suggestions
- ❌ Proactive notifications

### Implementation Tasks

#### Backend (Go)
- [ ] Create `pkg/app/holmes_issues.go`
  - `ScanClusterIssues() ([]HolmesIssue, error)` - manual scan only
  - `scanPods()`, `scanDeployments()`, `scanNodes()` - detect common issues
  - Issue type definitions (critical, warning, info)

- [ ] Create `pkg/app/holmes_alerts.go`
  - `GetPrometheusAlerts(prometheusURL string) ([]Alert, error)`
  - `InvestigateAlert(alert Alert) (*holmesgpt.HolmesResponse, error)`
  - `GetAlertInvestigationHistory() ([]AlertInvestigation, error)`

- [ ] Add to `pkg/app/holmes_integration.go`
  - `ScanForIssues() ([]HolmesIssue, error)` - manual scan RPC
  - `GetAlerts(prometheusURL string) ([]Alert, error)`
  - `InvestigateAlert(alertName string) (*holmesgpt.HolmesResponse, error)`

#### Frontend (React)
- [ ] Create `frontend/src/holmes/HolmesDashboard.jsx`
  - Display issue count badge
  - List issues with severity colors
  - "Scan Now" button for manual trigger
  - Click issue to view details

- [ ] Create `frontend/src/holmes/AlertsView.jsx`
  - List Prometheus alerts
  - "Investigate" button per alert
  - Show investigation results
  - Investigation history

- [ ] Update `frontend/src/holmes/holmesApi.js`
  - Add `ScanForIssues`, `GetAlerts`, `InvestigateAlert` wrappers

- [ ] Update `frontend/src/holmes/HolmesContext.jsx`
  - Add issues state
  - Add alerts state

#### Testing
- [ ] Go unit tests for issue detection
- [ ] Go unit tests for alert investigation
- [ ] Frontend unit tests for dashboard
- [ ] E2E test: Manual scan and view issues

**Estimated Files**: ~6 files (3 Go, 3 React)

---

## Phase 4: Log Analysis & Swarm (Streamlined)

**Duration**: 1.5 Sprints (3 weeks)

### Features to Implement

#### ✅ Log Analysis
- "Explain Logs" button in log viewers
- Analyze pod logs with Holmes
- Detect error patterns
- Suggest fixes based on log content

#### ✅ Docker Swarm Support
- Analyze Swarm services with Holmes
- Analyze Swarm tasks
- Add "Ask Holmes" to Swarm resource views
- Reuse K8s patterns for consistency

### Removed from Original Phase 4
- ❌ Resource optimization recommendations
- ❌ Cost savings calculations
- ❌ Response caching
- ❌ Streaming responses
- ❌ Advanced configuration UI (custom toolsets, models)
- ❌ Performance optimizations

### Implementation Tasks

#### Backend (Go)
- [ ] Create `pkg/app/holmes_logs.go`
  - `AnalyzeLogs(namespace, podName, containerName string, lines int) (*holmesgpt.HolmesResponse, error)`
  - `DetectLogPatterns(logs string) ([]LogPattern, error)`

- [ ] Create `pkg/app/holmes_swarm.go`
  - `AnalyzeSwarmService(serviceID string) (*holmesgpt.HolmesResponse, error)`
  - `AnalyzeSwarmTask(taskID string) (*holmesgpt.HolmesResponse, error)`
  - `getSwarmServiceContext(serviceID string) (string, error)`

- [ ] Add to `pkg/app/holmes_integration.go`
  - `AnalyzePodLogs(namespace, podName string, lines int) (*holmesgpt.HolmesResponse, error)`
  - `AnalyzeSwarmService(serviceID string) (*holmesgpt.HolmesResponse, error)`

#### Frontend (React)
- [ ] Update `frontend/src/k8s/resources/pods/LogViewerTab.jsx`
  - Add "Explain Logs" button
  - Show Holmes analysis in overlay or bottom section

- [ ] Update Swarm resource views:
  - `frontend/src/docker/resources/services/ServicesOverviewTable.jsx`
  - `frontend/src/docker/resources/tasks/TasksOverviewTable.jsx`
  - Add "Ask Holmes" buttons (same pattern as K8s)

- [ ] Update `frontend/src/holmes/holmesApi.js`
  - Add `AnalyzePodLogs`, `AnalyzeSwarmService`, `AnalyzeSwarmTask`

#### Testing
- [ ] Go unit tests for log analysis
- [ ] Go unit tests for Swarm integration
- [ ] Frontend unit tests for log analysis UI
- [ ] E2E test: Explain logs from pod viewer
- [ ] E2E test: Analyze Swarm service

**Estimated Files**: ~6 files (3 Go, 3 React)

---

## Summary of Revised Scope

### Total Implementation

| Phase | Duration | Files | Key Features |
|-------|----------|-------|--------------|
| **Phase 1** | 4 weeks | ~15 files | Foundation: Config, panel, basic queries |
| **Phase 2** | 4 weeks | ~10 files | Context-aware analysis, markdown, conversation history |
| **Phase 3** | 3 weeks | ~6 files | Dashboard widget, alert investigation |
| **Phase 4** | 3 weeks | ~6 files | Log analysis, Swarm support |
| **TOTAL** | **14 weeks** | **~37 files** | **Core Holmes integration** |

### Removed Features (Not Implementing)

- ❌ Background health scanning (only manual)
- ❌ Proactive notifications
- ❌ Follow-up question suggestions (automatic)
- ❌ Resource optimization / cost analysis
- ❌ Response caching / performance optimizations
- ❌ Streaming responses
- ❌ Advanced configuration (custom toolsets, models)
- ❌ Cross-pod log correlation

### What Users Get

✅ **Configure Holmes** (one-time setup)
✅ **Ask free-form questions** via panel with conversation history
✅ **Markdown-formatted responses** with syntax-highlighted code blocks
✅ **Multi-turn conversations** with full Q&A history
✅ **Export conversations** as text files
✅ **One-click analysis** from pods, deployments, services
✅ **Dashboard widget** showing cluster issues (manual scan)
✅ **Investigate Prometheus alerts** with Holmes
✅ **Explain pod logs** with intelligent analysis
✅ **Analyze Docker Swarm** services and tasks

### Technical Standards Maintained

- ✅ 70%+ test coverage (Go + React)
- ✅ E2E tests for all major features
- ✅ Follows existing codebase patterns
- ✅ Stable DOM IDs for testing
- ✅ Production-ready error handling

---

## Implementation Priority

1. **Phase 1** (Critical) - Foundation must be solid
2. **Phase 2** (High) - Core value proposition for users
3. **Phase 3** (Medium) - Adds proactive value
4. **Phase 4** (Medium) - Extends to logs and Swarm

Each phase builds on the previous, but scope is reduced to focus on high-value features only.

---

## Effort Reduction

**Original Scope**: 235+ tasks, 4 phases, ~60 files
**Revised Scope**: ~160 tasks, 4 phases, ~37 files

**Effort Saved**: ~32% reduction by removing:
- Background automation (automatic scanning, notifications)
- Automatic follow-up suggestions
- Performance optimizations (caching, streaming)
- Resource optimization / cost analysis
- Advanced configuration (custom models, toolsets)

**Features Kept**:
- ✅ Markdown rendering & syntax highlighting
- ✅ Conversation history & multi-turn chat
- ✅ All core troubleshooting capabilities

This focused approach delivers **production-ready Holmes integration** with excellent UX, while removing automation and optimization features that can be added later if needed.
