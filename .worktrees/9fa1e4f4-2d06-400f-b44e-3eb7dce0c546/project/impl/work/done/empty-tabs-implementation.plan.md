# Implementation Plan: Handling Empty Tabs in Bottom Panel

**Status:** Completed
**Created:** 2026-01-06
**Updated:** 2026-02-06

## Overview

This plan addresses the UX issue where users must click each tab to discover if it contains data. The solution adds count badges to tabs and visually mutes empty tabs without disabling them.

## Current Status (Verified 2026-02-06)

- Tab label + count rendering is implemented in [frontend/src/components/TabLabel.tsx](frontend/src/components/TabLabel.tsx) and integrated in [frontend/src/layout/overview/OverviewTableWithPanel.tsx](frontend/src/layout/overview/OverviewTableWithPanel.tsx).
- Empty tab content is standardized via [frontend/src/components/EmptyTabContent.tsx](frontend/src/components/EmptyTabContent.tsx) with configuration in [frontend/src/constants/emptyTabMessages.ts](frontend/src/constants/emptyTabMessages.ts).
- Backend count fetchers live in [pkg/app/tab_counts.go](pkg/app/tab_counts.go) with frontend aggregation in [frontend/src/api/tabCounts.ts](frontend/src/api/tabCounts.ts).
- Note: file extensions are .ts/.tsx in the current codebase; .js/.jsx references below are historical.

## Goals

1. Show count badges on applicable tabs (e.g., `Events (3)`, `Pods (0)`)
2. Visually mute tabs with zero items (reduced opacity, but still clickable)
3. Pre-fetch counts efficiently when a row is selected
4. Provide helpful empty state content inside tabs
5. Maintain consistency across all resource types

---

## Phase 1: Core Infrastructure

### 1.1 Create TabLabel Component

- [x] Create `frontend/src/components/TabLabel.jsx`
  - Props: `label`, `count`, `loading`
  - Renders label with optional count badge
  - Applies muted styling when count is 0
  - Shows loading indicator (`...`) when fetching

- [x] Create `frontend/src/components/TabLabel.css`
  - `.tab-count` - badge styling (blue background, rounded)
  - `.tab-count.empty` - muted badge styling (gray)
  - `.tab-label-muted` - reduced opacity for empty tabs
  - `.tab-loading` - pulse animation for loading state

### 1.2 Create EmptyTabContent Component

- [x] Create `frontend/src/components/EmptyTabContent.jsx`
  - Props: `icon`, `title`, `description`, `tip`, `action`
  - Renders centered empty state with icon, message, and optional action button
  - Consistent styling across all empty tab states

- [x] Create `frontend/src/components/EmptyTabContent.css`
  - Centered layout with icon, title, description
  - Muted colors, subtle styling
  - Action button styling if provided

### 1.3 Update Tab Data Structure

- [x] Define new tab configuration format supporting counts:
  ```jsx
  { 
    key: 'events', 
    label: 'Events', 
    countKey: 'eventsCount',  // optional - key in tabCounts object
    countable: true           // optional - whether to show count
  }
  ```

---

## Phase 2: Count Fetching APIs

### 2.1 Backend API Endpoints (Go)

- [x] Add `GetResourceEventsCount(namespace, kind, name)` in `pkg/app/tab_counts.go`
  - Returns integer count of events for a resource
  - Lightweight query (no full event data)

- [x] Add `GetPodsCountForResource(namespace, ownerKind, ownerName)` in `pkg/app/tab_counts.go`
  - Returns count of pods owned by the resource
  - Works for Deployment, StatefulSet, DaemonSet, Job, ReplicaSet

- [x] Add `GetConsumersCount(namespace, resourceKind, resourceName)` in `pkg/app/tab_counts.go`
  - Returns count of workloads using ConfigMap/Secret/PVC
  - Implemented as GetConfigMapConsumersCount, GetSecretConsumersCount, GetPVCConsumersCount

- [x] Add `GetEndpointsCount(namespace, serviceName)` in `pkg/app/tab_counts.go`
  - Returns count of endpoints for a Service
  - Implemented as GetServiceEndpointsCount

- [x] Add `GetJobHistoryCount(namespace, cronJobName)` in `pkg/app/tab_counts.go`
  - Returns count of Jobs created by a CronJob
  - Implemented as GetCronJobHistoryCount

### 2.2 Generate Wails Bindings

- [ ] Run `wails generate` after adding Go functions
- [ ] Verify new functions appear in `frontend/wailsjs/go/main/App.js`

### 2.3 Frontend API Wrapper

- [x] Create `frontend/src/api/tabCounts.js`
  - Export `fetchTabCounts(resourceKind, namespace, name)` function
  - Returns object with all relevant counts for the resource type
  - Handles parallel fetching with `Promise.all`
  - Includes error handling (return null/undefined on failure)

---

## Phase 3: Update OverviewTableWithPanel

### 3.1 Add Tab Counts State

- [x] Update `frontend/src/layout/overview/OverviewTableWithPanel.jsx`
  - Add `tabCounts` state: `const [tabCounts, setTabCounts] = useState({})`
  - Add `tabCountsLoading` state for loading indicators

### 3.2 Fetch Counts on Row Selection

- [x] Add `useEffect` that triggers when `selectedRow` changes
  - Call `fetchTabCounts` with row details
  - Update `tabCounts` state with results
  - Handle loading state during fetch

### 3.3 Render Tabs with TabLabel

- [x] Update tab rendering to use `TabLabel` component
  - Pass `count` from `tabCounts[tab.countKey]`
  - Pass `loading` from `tabCountsLoading`
  - Apply muted class when count is 0

---

## Phase 4: Resource-Specific Updates

### 4.1 ConfigMap

- [x] Update `frontend/src/k8s/resources/configmaps/ConfigMapsOverviewTable.jsx`
  - Add `countKey` to tabs: `events`, `consumers`, `data`
  - Implement count fetching for ConfigMap-specific counts
  - Update empty state in `ResourceEventsTab` and `ConfigMapConsumersTab`

### 4.2 Secret

- [x] Update `frontend/src/k8s/resources/secrets/SecretsOverviewTable.jsx`
  - Add `countKey` to tabs: `events`, `consumers`, `data`
  - Implement count fetching for Secret-specific counts

### 4.3 Deployment

- [x] Update `frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.jsx`
  - Add `countKey` to tabs: `pods`, `events`
  - Implement count fetching

### 4.4 StatefulSet

- [x] Update `frontend/src/k8s/resources/statefulsets/StatefulSetsOverviewTable.jsx`
  - Add `countKey` to tabs: `pods`, `pvcs`, `events`

### 4.5 DaemonSet

- [x] Update `frontend/src/k8s/resources/daemonsets/DaemonSetsOverviewTable.jsx`
  - Add `countKey` to tabs: `pods`, `events`

### 4.6 Job

- [x] Update `frontend/src/k8s/resources/jobs/JobsOverviewTable.jsx`
  - Add `countKey` to tabs: `pods`, `events`

### 4.7 CronJob

- [x] Update `frontend/src/k8s/resources/cronjobs/CronJobsOverviewTable.jsx`
  - Add `countKey` to tabs: `history`, `events`

### 4.8 ReplicaSet

- [x] Update `frontend/src/k8s/resources/replicasets/ReplicaSetsOverviewTable.jsx`
  - Add `countKey` to tabs: `pods`, `events`

### 4.9 PersistentVolumeClaim

- [x] Update `frontend/src/k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable.jsx`
  - Add `countKey` to tabs: `consumers`, `events`

### 4.10 PersistentVolume

- [x] Update `frontend/src/k8s/resources/persistentvolumes/PersistentVolumesOverviewTable.jsx`
  - Add `countKey` to tabs: `events`

### 4.11 Service

- [x] Update `frontend/src/k8s/resources/services/ServicesOverviewTable.jsx`
  - Add `countKey` to tabs: `endpoints`, `events`

### 4.12 Ingress

- [x] Update `frontend/src/k8s/resources/ingresses/IngressesOverviewTable.jsx`
  - Add `countKey` to tabs: `rules`, `events`

### 4.13 Pod

- [x] Update `frontend/src/k8s/resources/pods/PodsOverviewTable.jsx`
  - Add `countKey` to tabs: `events`
  - (Pods don't have sub-pods, so only events count applies)

---

## Phase 5: Empty State Messages

### 5.1 Define Empty State Content

- [x] Create `frontend/src/constants/emptyTabMessages.js`
  - Define icon, title, description, tip for each empty tab type:
    - `events` - "No events recorded for this resource"
    - `pods` - "No pods are currently running"
    - `consumers` - "This resource is not used by any workloads"
    - `endpoints` - "No endpoints available for this service"
    - `history` - "No job executions found"
    - `rules` - "No ingress rules configured"
    - `pvcs` - "No persistent volume claims associated"

### 5.2 Update Existing Tab Components

- [x] Update `ResourceEventsTab.jsx` to use `EmptyTabContent`
- [x] Update `ResourcePodsTab.jsx` to use `EmptyTabContent`
- [x] Update `ConfigMapConsumersTab.jsx` to use `EmptyTabContent`
- [x] Update `SecretConsumersTab.jsx` to use `EmptyTabContent`
- [x] Update `PVCConsumersTab.jsx` to use `EmptyTabContent`
- [ ] Update `ServiceEndpointsTab.jsx` (if exists) or create it
- [ ] Update `CronJobHistoryTab.jsx` to use `EmptyTabContent`
- [ ] Update `IngressRulesTab.jsx` (if exists) to use `EmptyTabContent`

---

## Phase 6: Testing

### 6.1 Unit Tests

- [x] Create `frontend/src/__tests__/TabLabel.test.jsx`
  - Test rendering with count
  - Test rendering with zero count (muted state)
  - Test loading state
  - Test without count (label only)

- [x] Create `frontend/src/__tests__/EmptyTabContent.test.jsx`
  - Test rendering with all props
  - Test action button click
  - Test without optional props

### 6.2 Integration Tests

- [x] Update existing overview table tests to verify tab counts render
- [x] Test count fetching when row is selected
- [x] Test muted styling for empty tabs

### 6.3 E2E Tests

- [x] Add Playwright test for tab count visibility
- [x] Verify empty state content displays correctly
- [x] Test tab interaction with zero items

---

## Phase 7: Performance Optimization

### 7.1 Count Caching

- [ ] Implement simple cache for tab counts
  - Cache key: `${namespace}/${kind}/${name}`
  - TTL: 30 seconds
  - Invalidate on resource update events

### 7.2 Lazy Count Fetching

- [ ] Consider fetching counts only for visible tabs initially
- [ ] Fetch remaining counts after initial render
- [ ] Use `IntersectionObserver` if panel is off-screen

### 7.3 Batch Requests

- [x] Combine multiple count queries into single API call where possible
- [x] Create `GetAllTabCounts(namespace, kind, name)` Go function
  - Returns all relevant counts in one response

---

## Implementation Order

1. **Week 1: Core Infrastructure**
   - TabLabel component
   - EmptyTabContent component
   - Basic CSS styling

2. **Week 2: Backend APIs**
   - Add count endpoints in Go
   - Generate Wails bindings
   - Create frontend API wrapper

3. **Week 3: OverviewTableWithPanel**
   - Add tab counts state and fetching
   - Update tab rendering
   - Test with one resource (ConfigMap)

4. **Week 4: Resource Updates (Part 1)**
   - ConfigMap, Secret, Deployment, StatefulSet

5. **Week 5: Resource Updates (Part 2)**
   - DaemonSet, Job, CronJob, ReplicaSet

6. **Week 6: Resource Updates (Part 3)**
   - PVC, PV, Service, Ingress, Pod

7. **Week 7: Empty States & Testing**
   - Define all empty state messages
   - Update tab components
   - Write tests

8. **Week 8: Optimization & Polish**
   - Implement caching
   - Performance tuning
   - Bug fixes

---

## Files to Create

```
frontend/src/components/
├── TabLabel.jsx
├── TabLabel.css
├── EmptyTabContent.jsx
├── EmptyTabContent.css

frontend/src/api/
├── tabCounts.js

frontend/src/constants/
├── emptyTabMessages.js

frontend/src/__tests__/
├── TabLabel.test.jsx
├── EmptyTabContent.test.jsx
```

## Files to Modify

```
frontend/src/layout/overview/OverviewTableWithPanel.jsx
frontend/src/layout/overview/OverviewTableWithPanel.css
frontend/src/components/ResourceEventsTab.jsx
frontend/src/components/ResourcePodsTab.jsx
frontend/src/k8s/resources/*/OverviewTable.jsx (all resource types)

pkg/app/events.go
pkg/app/pods.go
pkg/app/consumers.go (may need to create)
pkg/app/services.go
pkg/app/cronjobs.go
```

---

## Success Criteria

- [ ] All countable tabs display count badges
- [ ] Empty tabs (count = 0) are visually muted but clickable
- [ ] Counts load quickly (< 200ms) after row selection
- [ ] Empty state content is helpful and consistent
- [ ] No performance regression in panel opening time
- [ ] All existing tests pass
- [ ] New tests provide adequate coverage

---

## Related Tasks

- See also: `project/tabs/summary-tabs-3-column-layout.md` (3-column summary tab improvements)
- Depends on: Existing tab infrastructure in `OverviewTableWithPanel`
- Blocks: None

---

## Notes

- Count badges should not be shown for non-countable tabs (Summary, YAML, Holmes, Logs)
- Loading state should be brief; consider skeleton/shimmer if > 500ms
- Muted styling should be subtle (60% opacity) not disabled-looking
- Empty states should be encouraging, not discouraging ("No events yet" vs "No events found")

