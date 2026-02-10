# Phase 3: Dashboard & Alerts (Revised - Integrated with Existing Monitoring)

**Status:** DONE
**Created:** 2026-02-06
**Updated:** 2026-02-06

**Status**: Completed
**Duration**: 1.5 Sprints (3 weeks)
**Prerequisites**: Phase 1 and 2 complete
**Goal**: Enhance existing warning/error tracking with Holmes AI analysis and add Prometheus alert investigation

## Current Status (Verified 2026-02-06)

- Monitoring enhancements and persistence live in [pkg/app/monitor.go](pkg/app/monitor.go) and [pkg/app/monitor_actions.go](pkg/app/monitor_actions.go) with tests in [pkg/app/monitor_actions_test.go](pkg/app/monitor_actions_test.go).
- Prometheus alert investigations are implemented in [pkg/app/holmes_alerts.go](pkg/app/holmes_alerts.go) and validated in [pkg/app/holmes_alerts_test.go](pkg/app/holmes_alerts_test.go).
- Frontend monitoring UI is in [frontend/src/layout/MonitorPanel.tsx](frontend/src/layout/MonitorPanel.tsx), [frontend/src/layout/MonitorIssueCard.tsx](frontend/src/layout/MonitorIssueCard.tsx), and [frontend/src/layout/PrometheusAlertsTab.tsx](frontend/src/layout/PrometheusAlertsTab.tsx).
- E2E coverage exists in [e2e/tests/monitoring/20-manual-scan.spec.ts](e2e/tests/monitoring/20-manual-scan.spec.ts) and [e2e/tests/monitoring/21-prometheus-alerts.spec.ts](e2e/tests/monitoring/21-prometheus-alerts.spec.ts).
- Note: coverage percentages were not re-run in this verification pass.

---

## Overview

### Revision Summary

This revised Phase 3 plan **integrates Holmes AI capabilities with the existing monitoring infrastructure** rather than creating a parallel system. The app already has robust warning/error tracking via:

- **Backend**: `pkg/app/monitor.go` with continuous polling (every 5 seconds), `MonitorIssue` and `MonitorInfo` types
- **Frontend**: `FooterBar.jsx` (badges) and `MonitorPanel.jsx` (detailed issue display)

Phase 3 will **extend this system** with:
1. Holmes AI analysis capabilities for existing monitor issues
2. Manual deep cluster health scanning (on-demand)
3. Issue dismissal and persistence
4. Prometheus alert investigation (separate feature)

### Goals
- ✅ Enhance existing monitoring with Holmes analysis capabilities
- ✅ Add manual deep cluster health scanning
- ✅ Implement issue dismissal and persistence
- ✅ Integrate Prometheus alert investigation
- ✅ Maintain 70%+ test coverage with E2E tests

### Prerequisites
- Phase 1 and 2 completed
- Holmes context-aware analysis working
- User feedback from Phase 2 incorporated
- Existing monitoring system stable

### Success Criteria
- [x] Users can analyze existing monitor issues with Holmes AI
- [x] Manual deep scan detects additional cluster health issues
- [x] Users can dismiss issues (persist for 24 hours)
- [x] MonitorPanel enhanced with analysis/dismiss buttons
- [x] Prometheus alerts can be investigated via Holmes (separate tab)
- [x] All existing monitoring functionality preserved
- [x] E2E tests verify enhanced monitoring
- [x] Test coverage >= 70%

---

## Architectural Decisions

### 1. Extend Existing Types, Don't Replace Them

**Extend `MonitorIssue` in `pkg/app/types.go`** with Holmes and dismissal fields:

```go
type MonitorIssue struct {
    // EXISTING FIELDS (keep all)
    Type          string `json:"type"`          // "warning" or "error"
    Resource      string `json:"resource"`      // e.g., "Pod", "Deployment"
    Namespace     string `json:"namespace"`
    Name          string `json:"name"`
    Reason        string `json:"reason"`
    Message       string `json:"message"`
    ContainerName string `json:"containerName"`
    RestartCount  int32  `json:"restartCount"`
    Age           string `json:"age"`
    PodPhase      string `json:"podPhase"`
    OwnerKind     string `json:"ownerKind"`
    OwnerName     string `json:"ownerName"`
    NodeName      string `json:"nodeName"`

    // NEW: Holmes integration fields
    IssueID          string    `json:"issueID"`          // Stable ID for tracking
    HolmesAnalyzed   bool      `json:"holmesAnalyzed"`   // Has Holmes analyzed this?
    HolmesAnalysis   string    `json:"holmesAnalysis"`   // Analysis text (markdown)
    HolmesAnalyzedAt time.Time `json:"holmesAnalyzedAt"` // When analyzed
    Dismissed        bool      `json:"dismissed"`        // User dismissed this
    DismissedAt      time.Time `json:"dismissedAt"`      // When dismissed
}
```

### 2. Dual-Mode Operation: Continuous + Manual

**Continuous Monitoring (Existing - NO CHANGES):**
- `monitor.go`: Polls every 5 seconds, detects pod/container/event issues
- Emits `monitor:update` events to frontend
- Fast, lightweight, monitors current namespace(s)

**Manual Deep Scanning (NEW - Additive):**
- New RPC: `ScanClusterHealth()` - comprehensive scan all namespaces
- Checks pods, deployments, statefulsets, daemonsets, nodes, PVs
- Deeper health checks (resource quotas, node conditions)
- Slower, on-demand only, triggered by "Scan Now" button

### 3. UI Integration - Enhance Existing Components

**FooterBar.jsx (Minimal Changes):**
- Keep existing error/warning badges
- Add optional indicator when issues have Holmes analysis

**MonitorPanel.jsx (Major Enhancements):**
- Add "Scan Now" button in header (trigger manual deep scan)
- Add "Analyze All" button (batch analyze visible issues)
- Add "Analyze" button per issue (inline)
- Add "Dismiss" button per issue (inline)
- Show expandable Holmes analysis section when issue analyzed
- Add third tab: "Prometheus Alerts" (separate feature)

**MonitorIssueCard.jsx (NEW COMPONENT):**
- Extract individual issue card from MonitorPanel
- Collapsible Holmes analysis section
- Reuses existing `HolmesResponseRenderer.jsx`

### 4. Issue Persistence and Dismissal

**Storage:**
- JSON file: `~/.KubeDevBench/monitor_issues.json`
- Stores dismissed issues and Holmes analyses
- TTL: 24 hours (auto-cleanup expired dismissed issues)

**Dismissal Logic:**
- User clicks "Dismiss" → mark `Dismissed = true`, `DismissedAt = now()`
- Continuous monitoring continues detecting issue
- Filter dismissed issues in `collectMonitorInfo()` before emitting
- Dismissed issues reappear after 24 hours OR if underlying condition changes

**Issue ID Generation:**
```go
func generateIssueID(issue MonitorIssue) string {
    return fmt.Sprintf("%s-%s-%s-%s",
        issue.Resource, issue.Namespace, issue.Name, issue.Reason)
}
```

### 5. Prometheus Alerts - Separate Feature

Keep as separate tab in MonitorPanel to avoid mixing K8s-detected issues with Prometheus alerts.

**MonitorPanel Tabs:**
1. "Errors" (existing K8s issues)
2. "Warnings" (existing K8s issues)
3. "Prometheus Alerts" (NEW - separate data source)

---

## Implementation Tasks

### Backend Tasks

#### 1. Extend MonitorIssue Type

**File**: `pkg/app/types.go` (lines 291-306)

- [x] Add 6 new fields to `MonitorIssue` struct:
  - `IssueID string`
  - `HolmesAnalyzed bool`
  - `HolmesAnalysis string`
  - `HolmesAnalyzedAt time.Time`
  - `Dismissed bool`
  - `DismissedAt time.Time`

#### 2. Enhance Continuous Monitoring

**File**: `pkg/app/monitor.go` (modify existing `collectMonitorInfo()`)

- [x] Generate stable `IssueID` for each detected issue
- [x] Load persisted issues (dismissed + Holmes analyses) from JSON file
- [x] Filter out dismissed issues (not expired)
- [x] Merge Holmes analysis data into current issues
- [x] Return enriched `MonitorInfo` with Holmes data

#### 3. Manual Deep Scanning

**File**: `pkg/app/monitor_actions.go` (NEW FILE)

- [x] `ScanClusterHealth() (MonitorInfo, error)` - comprehensive manual scan
  - [x] Scan ALL namespaces (not just preferred)
  - [x] Check pods, deployments, statefulsets, daemonsets
  - [x] Check node health (conditions, pressure, readiness)
  - [x] Check persistent volumes
  - [x] Deeper health checks (resource quotas, limits)
- [x] Reuse detection logic from `monitor.go` where possible

#### 4. Holmes Integration

**File**: `pkg/app/monitor_actions.go` (continue)

- [x] `AnalyzeMonitorIssue(issueID string) (*MonitorIssue, error)`
  - [x] Look up current issue by ID
  - [x] Gather context using existing `holmes_context.go` methods
  - [x] Build issue-specific prompt with context
  - [x] Call Holmes API
  - [x] Update issue with analysis, save to persistent storage
  - [x] Emit `monitor:update` event with updated issue
- [x] `AnalyzeAllMonitorIssues() error` - batch analyze all current issues
  - [x] Iterate through current MonitorInfo
  - [x] Call `AnalyzeMonitorIssue()` for each
  - [x] Emit progress events during batch analysis

#### 5. Issue Management

**File**: `pkg/app/monitor_actions.go` (continue)

- [x] `DismissMonitorIssue(issueID string) error`
  - [x] Mark issue as dismissed with timestamp
  - [x] Save to persistent storage
  - [x] Emit `monitor:update` event
- [x] `GetDismissedIssues() ([]MonitorIssue, error)`
  - [x] Load from persistent storage
  - [x] Filter expired issues (>24 hours)

#### 6. Persistence Layer

**File**: `pkg/app/monitor_actions.go` (continue)

- [x] `loadPersistedIssues() (map[string]PersistedIssue, error)`
- [x] `savePersistedIssues(issues map[string]PersistedIssue) error`
- [x] `cleanupExpiredIssues()` - remove issues >24 hours old
- [x] Define `PersistedIssue` type:
  ```go
  type PersistedIssue struct {
      IssueID          string    `json:"issueID"`
      Dismissed        bool      `json:"dismissed"`
      DismissedAt      time.Time `json:"dismissedAt"`
      HolmesAnalysis   string    `json:"holmesAnalysis"`
      HolmesAnalyzedAt time.Time `json:"holmesAnalyzedAt"`
  }
  ```

#### 7. Prometheus Alerts Integration

**File**: `pkg/app/holmes_alerts.go` (NEW FILE)

- [x] Define types:
  - [x] `PrometheusAlert` struct (Name, State, Value, Labels, Annotations, ActiveAt)
  - [x] `AlertInvestigation` struct (AlertName, Timestamp, Analysis)
- [x] `GetPrometheusAlerts(prometheusURL string) ([]PrometheusAlert, error)`
  - [x] Fetch from Prometheus API endpoint `/api/v1/alerts`
  - [x] Parse response and convert to `PrometheusAlert` structs
- [x] `InvestigatePrometheusAlert(alert PrometheusAlert) (*holmesgpt.HolmesResponse, error)`
  - [x] Build investigation prompt with alert details
  - [x] Call Holmes API
  - [x] Save to investigation history
- [x] `GetAlertInvestigationHistory() ([]AlertInvestigation, error)`
  - [x] Return stored investigations (in-memory for now)

#### 8. Testing

- [x] **Extend** `pkg/app/monitor_test.go`:
  - [x] Test issue ID generation stability
  - [x] Test dismissal filtering
  - [x] Test persistence load/save
  - [x] Test expired issue cleanup
- [x] **Create** `pkg/app/monitor_actions_test.go`:
  - [x] Test `ScanClusterHealth()` with fake clientset
  - [x] Test node health scanning
  - [x] Test `AnalyzeMonitorIssue()` with mock Holmes
  - [x] Test batch analysis
  - [x] Test dismissal logic
  - [x] Verify coverage >= 70%
- [x] **Create** `pkg/app/holmes_alerts_test.go`:
  - [x] Test Prometheus alert parsing
  - [x] Test alert investigation with mock Holmes
  - [x] Test investigation history
  - [x] Verify coverage >= 70%

---

### Frontend Tasks

#### 1. Enhance MonitorPanel

**File**: `frontend/src/layout/MonitorPanel.jsx`

- [x] Add header buttons:
  - [x] "Scan Now" button (calls `ScanClusterHealth()`)
  - [x] "Analyze All" button (calls `AnalyzeAllMonitorIssues()`)
- [x] Add third tab: "Prometheus Alerts"
- [x] Modify issue rendering to use new `MonitorIssueCard` component
- [x] Listen to `holmes:analysis:update` events for real-time updates
- [x] Handle loading states during scan/analysis

#### 2. Create MonitorIssueCard Component

**File**: `frontend/src/layout/MonitorIssueCard.jsx` (NEW)

- [x] Extract issue card from `MonitorPanel.jsx`
- [x] Add "Analyze with Holmes" button (inline)
- [x] Add "Dismiss" button (inline)
- [x] Add expandable Holmes analysis section:
  - [x] Initially collapsed
  - [x] Reuses `HolmesResponseRenderer.jsx` for display
  - [x] Shows timestamp "Analyzed X minutes ago"
- [x] Handle loading state during analysis
- [x] Preserve existing issue metadata display

#### 3. Create PrometheusAlertsTab Component

**File**: `frontend/src/layout/PrometheusAlertsTab.jsx` (NEW)

- [x] Input field for Prometheus URL (saved to localStorage)
- [x] "Fetch Alerts" button
- [x] Alert list display:
  - [x] Alert name, state, value
  - [x] Labels and annotations
  - [x] Active duration
- [x] "Investigate" button per alert
- [x] Holmes analysis display (reuses `HolmesResponseRenderer`)
- [x] Investigation history section

#### 4. Create API Wrapper

**File**: `frontend/src/layout/monitorApi.js` (NEW)

- [x] `ScanClusterHealth()` - wrapper for Wails RPC
- [x] `AnalyzeMonitorIssue(issueID)` - wrapper for Wails RPC
- [x] `AnalyzeAllMonitorIssues()` - wrapper for Wails RPC
- [x] `DismissMonitorIssue(issueID)` - wrapper for Wails RPC
- [x] `GetPrometheusAlerts(url)` - wrapper for Wails RPC
- [x] `InvestigatePrometheusAlert(alert)` - wrapper for Wails RPC
- [x] `GetAlertInvestigationHistory()` - wrapper for Wails RPC

#### 5. Update FooterBar (Optional)

**File**: `frontend/src/layout/FooterBar.jsx`

- [x] Add small "brain" icon indicator when issues have Holmes analysis
- [x] Update tooltip text to mention analysis availability

#### 6. Testing

- [x] **Extend** `frontend/src/__tests__/monitorFeature.test.jsx`:
  - [x] Test "Scan Now" button
  - [x] Test "Analyze All" button
  - [x] Test tab switching (Errors/Warnings/Alerts)
  - [x] Test issue analysis flow
  - [x] Test issue dismissal
  - [x] Verify coverage >= 70%
- [x] **Create** `frontend/src/layout/__tests__/MonitorIssueCard.test.jsx`:
  - [x] Test expand/collapse Holmes analysis
  - [x] Test analyze button click
  - [x] Test dismiss button click
  - [x] Test loading states
  - [x] Verify coverage >= 70%
- [x] **Create** `frontend/src/layout/__tests__/PrometheusAlertsTab.test.jsx`:
  - [x] Test alert fetching
  - [x] Test alert investigation
  - [x] Test history display
  - [x] Verify coverage >= 70%

---

### E2E Testing Tasks

#### Create E2E Tests for Enhanced Monitoring

**File**: `e2e/tests/monitoring/20-manual-scan.spec.ts` (NEW)

- [x] Test manual cluster scan:
  - [x] Navigate to app, open MonitorPanel
  - [x] Click "Scan Now"
  - [x] Wait for scan to complete
  - [x] Verify issues appear

- [x] Test Holmes analysis:
  - [x] Click "Analyze" on first issue
  - [x] Wait for Holmes response
  - [x] Verify analysis section expands
  - [x] Verify markdown rendering

- [x] Test issue dismissal:
  - [x] Click "Dismiss" on issue
  - [x] Verify issue disappears
  - [x] Close and reopen MonitorPanel
  - [x] Verify issue still dismissed

**File**: `e2e/tests/monitoring/21-prometheus-alerts.spec.ts` (NEW)

- [x] Test Prometheus integration:
  - [x] Navigate to "Prometheus Alerts" tab
  - [x] Enter Prometheus URL
  - [x] Click "Fetch Alerts"
  - [x] Verify alerts appear

- [x] Test alert investigation:
  - [x] Click "Investigate" on alert
  - [x] Wait for Holmes analysis
  - [x] Verify analysis appears
  - [x] Check investigation history

---

### Documentation Tasks

- [x] Update `CLAUDE.md`:
  - [x] Document enhanced monitoring features
  - [x] Document manual scanning vs continuous monitoring
  - [x] Document issue dismissal behavior
  - [x] Document Prometheus integration setup
- [x] Add troubleshooting guide:
  - [x] What if Holmes analysis fails?
  - [x] What if dismissed issues keep reappearing?
  - [x] What if Prometheus alerts don't load?

---

## Implementation Sequencing

### Sprint 1 (Week 1-1.5) - Foundation

**Backend:**
1. Extend `MonitorIssue` type with 6 new fields
2. Implement persistence layer (load/save to JSON file)
3. Implement issue dismissal in `monitor.go` (filter logic)
4. Create `DismissMonitorIssue()` RPC method

**Frontend:**
1. Add "Dismiss" button to MonitorPanel
2. Create `monitorApi.js` with `DismissMonitorIssue()` wrapper
3. Update issue rendering to show dismiss button

**Testing:**
- Unit tests for dismissal + persistence
- E2E test for dismiss functionality

**Deliverable:** Users can dismiss monitoring issues

---

### Sprint 2 (Week 1.5-2.5) - Holmes Integration

**Backend:**
1. Create `monitor_actions.go` with `ScanClusterHealth()`
2. Implement `AnalyzeMonitorIssue()` with Holmes integration
3. Implement `AnalyzeAllMonitorIssues()` for batch analysis
4. Integrate persistence with Holmes analyses

**Frontend:**
1. Create `MonitorIssueCard.jsx` component
2. Add "Analyze" button to each issue
3. Add "Scan Now" and "Analyze All" buttons to MonitorPanel header
4. Implement expandable Holmes analysis section
5. Handle loading states

**Testing:**
- Unit tests for manual scan + Holmes analysis
- E2E tests for scan and analysis flows

**Deliverable:** Users can manually scan cluster and analyze issues with Holmes

---

### Sprint 3 (Week 2.5-3) - Prometheus & Polish

**Backend:**
1. Create `holmes_alerts.go` with Prometheus integration
2. Implement `GetPrometheusAlerts()`
3. Implement `InvestigatePrometheusAlert()`
4. Implement alert investigation history

**Frontend:**
1. Create `PrometheusAlertsTab.jsx` component
2. Add third tab to MonitorPanel
3. Implement alert fetching UI
4. Implement alert investigation UI
5. Polish and bug fixes

**Testing:**
- Unit tests for Prometheus integration
- E2E tests for alerts flow
- All coverage checks >= 70%

**Documentation:**
- Update all documentation
- Add troubleshooting guide

**Deliverable:** Complete Phase 3 with Prometheus integration

---

## Critical Files Summary

### Backend Files to Modify/Create

1. **`pkg/app/types.go`** (Modify, lines 291-306)
   - Extend `MonitorIssue` struct with 6 new fields

2. **`pkg/app/monitor.go`** (Modify, lines 50-83)
   - Enhance `collectMonitorInfo()` to integrate persistence
   - Add issue ID generation
   - Filter dismissed issues
   - Merge Holmes analyses

3. **`pkg/app/monitor_actions.go`** (NEW FILE, ~400 lines)
   - Manual cluster health scanning
   - Holmes integration methods
   - Issue management (dismiss, retrieve)
   - Persistence layer implementation

4. **`pkg/app/holmes_alerts.go`** (NEW FILE, ~300 lines)
   - Prometheus alert types
   - Alert fetching from Prometheus API
   - Alert investigation with Holmes
   - Investigation history management

### Frontend Files to Modify/Create

1. **`frontend/src/layout/MonitorPanel.jsx`** (Major refactor, ~500 lines)
   - Add header buttons (Scan Now, Analyze All)
   - Add Prometheus Alerts tab
   - Switch to using MonitorIssueCard component
   - Event handling for Holmes updates

2. **`frontend/src/layout/MonitorIssueCard.jsx`** (NEW, ~200 lines)
   - Individual issue card with buttons
   - Expandable Holmes analysis section
   - Loading states

3. **`frontend/src/layout/PrometheusAlertsTab.jsx`** (NEW, ~300 lines)
   - Alert listing UI
   - Investigation UI
   - History display

4. **`frontend/src/layout/monitorApi.js`** (NEW, ~100 lines)
   - Wails RPC wrappers for all new backend methods

5. **`frontend/src/layout/FooterBar.jsx`** (Minor changes)
   - Optional Holmes analysis indicator

---

## Success Criteria Checklist

### Core Functionality
- [ ] Existing continuous monitoring continues working (NO BREAKING CHANGES)
- [ ] Manual deep scan detects cluster health issues (pods, deployments, nodes, PVs)
- [ ] Users can analyze any issue with Holmes AI
- [ ] Users can batch analyze all visible issues
- [ ] Holmes analysis displays inline with markdown rendering
- [ ] Users can dismiss issues (persist for 24 hours)
- [ ] Dismissed issues filtered from view
- [ ] Dismissed issues reappear after TTL or if condition changes

### Prometheus Integration
- [ ] Users can fetch Prometheus alerts
- [ ] Users can investigate alerts with Holmes
- [ ] Investigation history persists and displays
- [ ] Prometheus alerts shown in separate tab

### Testing & Quality
- [ ] All Go tests passing with >= 70% coverage
- [ ] All frontend tests passing with >= 70% coverage
- [ ] E2E tests for manual scan passing
- [ ] E2E tests for Holmes analysis passing
- [ ] E2E tests for dismissal passing
- [ ] E2E tests for Prometheus alerts passing

### Documentation
- [ ] `CLAUDE.md` updated with Phase 3 features
- [ ] Troubleshooting guide added
- [ ] Code comments for complex logic

---

## Benefits of This Approach

1. **No Breaking Changes**: Existing monitoring fully preserved
2. **Progressive Enhancement**: Holmes analysis is optional, additive
3. **Code Reuse**: Leverages existing context gathering, Holmes integration
4. **Unified UX**: All cluster issues in one place (MonitorPanel)
5. **Clear Separation**: Continuous vs manual scanning clearly differentiated
6. **Flexible**: Works without Holmes configuration (graceful degradation)
7. **Testable**: Clear boundaries between features
8. **Performant**: Continuous monitoring stays fast, heavy analysis on-demand
9. **Persistent**: User actions (dismiss, analyze) survive app restart
10. **Scalable**: Batch operations for power users

---

## Next Phase Prerequisites

Before moving to Phase 4, ensure:

- [ ] All Phase 3 tasks completed
- [ ] Enhanced monitoring stable and reliable
- [ ] Holmes integration working smoothly
- [ ] Issue dismissal behavior intuitive
- [ ] Prometheus alerts working
- [ ] All tests passing with 70%+ coverage
- [ ] Documentation complete
- [ ] Code reviewed and merged
- [ ] User feedback incorporated

---

**Phase 3 Complete When**:
- Existing monitoring enhanced with Holmes AI analysis capabilities
- Manual deep cluster scanning available on-demand
- Issue dismissal working with 24-hour TTL
- Prometheus alerts can be investigated with Holmes
- All tests passing with >= 70% coverage
- Documentation updated

