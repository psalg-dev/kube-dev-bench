# Bulk Operations Implementation Plan

Add multi-select checkboxes and bulk action toolbars to **all 22+ overview tables** (Kubernetes + Docker Swarm) in a single rollout.

**In scope:** Bulk Delete/Remove, Bulk Restart, Bulk Scale, Bulk Suspend/Resume (CronJobs), Bulk Node Ops (Swarm: drain/pause/activate), Full per-item progress tracking with retry-on-failure

**Out of scope:** Bulk labeling/annotation, Cross-namespace bulk awareness

---

## Per-Resource Bulk Actions

| Resource | Delete | Restart | Scale | Suspend/Resume | Node Ops |
|----------|--------|---------|-------|----------------|----------|
| Deployments | x | x | x | | |
| StatefulSets | x | x | x | | |
| DaemonSets | x | x | | | |
| ReplicaSets | x | | x | | |
| Pods | x | x | | | |
| CronJobs | x | | | x | |
| Jobs | x | | | | |
| ConfigMaps | x | | | | |
| Secrets (K8s) | x | | | | |
| PVCs | x | | | | |
| PVs | x | | | | |
| Ingresses | x | | | | |
| Services (K8s) | x | | | | |
| Helm Releases | x | | | | |
| Swarm Services | x | x | x | | |
| Swarm Tasks | x | | | | |
| Swarm Nodes | x | | | | drain/pause/activate |
| Swarm Networks | x | | | | |
| Swarm Configs | x | | | | |
| Swarm Secrets | x | | | | |
| Swarm Volumes | x | | | | |
| Swarm Stacks | x | | | | |

---

## Phase 1: Selection Infrastructure

- [ ] **1A. Selection State Hook** — `frontend/src/hooks/useTableSelection.js` (new)
  - [ ] `useTableSelection(data, getRowKey)` returning `selectedKeys`, `isSelected`, `isAllSelected`, `isIndeterminate`, `toggleRow`, `toggleAll`, `clearSelection`, `selectedCount`, `getSelectedRows`
  - [ ] Shift+click range selection (track last clicked index)
  - [ ] `toggleAll` only affects visible/filtered rows
  - [ ] Auto-clear when data array identity changes
- [ ] **1B. Modify OverviewTableWithPanel** — `frontend/src/layout/overview/OverviewTableWithPanel.jsx`
  - [ ] New prop: `bulkActions` — when provided, checkbox column appears
  - [ ] Prepend 40px checkbox `<col>`, `<th>` (select-all), `<td>` (per-row)
  - [ ] `e.stopPropagation()` on checkboxes to avoid opening bottom panel
  - [ ] Render `<BulkActionBar>` between header and table when selection is non-empty
  - [ ] Selection persists when bottom panel opens (only "Clear" or Escape clears)
- [ ] **1C. Modify PodOverviewTable** — `frontend/src/k8s/resources/pods/PodOverviewTable.jsx`
  - [ ] Add checkbox column at position 0 in `@tanstack/react-table` column defs
  - [ ] Use same `useTableSelection` hook
  - [ ] Render `<BulkActionBar>` between header and scroll area
- [ ] **1D. Selection CSS** — `frontend/src/layout/overview/BulkSelection.css` (new)
  - [ ] `.bulk-checkbox-col` (40px width)
  - [ ] `.gh-table tbody tr.bulk-selected` (subtle blue highlight `rgba(14,99,156,0.15)`)
  - [ ] Keyboard support: Space toggles row, Shift+Click range, Ctrl/Cmd+A all visible, Escape clears

---

## Phase 2: Bulk Action UI Components

- [ ] **2A. BulkActionBar** — `frontend/src/components/BulkActionBar.jsx` + `BulkActionBar.css` (new)
  - [ ] Sticky bar: `"[N] selected"` | action buttons | `"Clear selection"` link
  - [ ] Danger actions (delete) in red styling
  - [ ] Slide-in/out CSS animation
- [ ] **2B. BulkConfirmDialog** — `frontend/src/components/BulkConfirmDialog.jsx` (new)
  - [ ] Modal with scrollable list of affected resource names (max 10 visible)
  - [ ] Typed count confirmation for destructive ops on 5+ items
  - [ ] Production/kube-system namespace warning
  - [ ] Cancel / Confirm buttons
- [ ] **2C. BulkProgressDialog** — `frontend/src/components/BulkProgressDialog.jsx` (new)
  - [ ] Per-item status: spinner (pending) / checkmark (success) / X (error)
  - [ ] Progress bar at top (completed / total)
  - [ ] Summary on completion: "N succeeded, M failed"
  - [ ] **Retry Failed** button re-executes only failed items
  - [ ] Error message shown inline per failed item
  - [ ] Close button enabled only on completion

---

## Phase 3: Backend Bulk Operations

- [ ] **3A. Kubernetes Bulk Ops** — `pkg/app/bulk_operations.go` (new)
  - [ ] Types: `BulkOperationItem`, `BulkOperationResult`, `BulkOperationResponse`
  - [ ] `BulkDeleteResources(items []BulkOperationItem) BulkOperationResponse`
  - [ ] `BulkRestartResources(items []BulkOperationItem) BulkOperationResponse`
  - [ ] `BulkScaleResources(items []BulkOperationItem, replicas int) BulkOperationResponse`
  - [ ] `BulkSuspendCronJobs(items []BulkOperationItem) BulkOperationResponse`
  - [ ] `BulkResumeCronJobs(items []BulkOperationItem) BulkOperationResponse`
  - [ ] Sequential iteration, per-item error aggregation, no top-level error
- [ ] **3B. Docker Swarm Bulk Ops** — `pkg/app/bulk_operations_swarm.go` (new)
  - [ ] Type: `SwarmBulkItem { ID, Name, Kind string }`
  - [ ] `BulkRemoveSwarmResources(items []SwarmBulkItem) BulkOperationResponse`
  - [ ] `BulkScaleSwarmServices(items []SwarmBulkItem, replicas int) BulkOperationResponse`
  - [ ] `BulkRestartSwarmServices(items []SwarmBulkItem) BulkOperationResponse`
  - [ ] `BulkUpdateSwarmNodeAvailability(items []SwarmBulkItem, availability string) BulkOperationResponse`
- [ ] **3C. Rebuild Wails Bindings** — run `wails build` to regenerate `frontend/wailsjs/go/main/App.js` and `.d.ts`

---

## Phase 4: Wiring

- [ ] **4A. Bulk Action Registry** — `frontend/src/constants/bulkActions.js` (new)
  - [ ] `K8S_BULK_ACTIONS` keyed by resource kind
  - [ ] `SWARM_BULK_ACTIONS` keyed by resource kind
  - [ ] Each entry: `{ key, label, icon, danger?, promptReplicas? }`
- [ ] **4B. Bulk Action Executor** — `frontend/src/api/bulkOperations.js` (new)
  - [ ] `executeBulkAction(platform, actionKey, selectedRows, options?) → Promise<BulkOperationResponse>`
  - [ ] Maps (platform + actionKey) to correct Wails binding
  - [ ] Transforms row objects into backend item format
- [ ] **4C. Wire All Tables** (22 files — each adds 2-3 lines: import + `bulkActions` prop)
  - [ ] **K8s tables (14)**:
    - [ ] `frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/statefulsets/StatefulSetsOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/daemonsets/DaemonSetsOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/replicasets/ReplicaSetsOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/jobs/JobsOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/cronjobs/CronJobsOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/configmaps/ConfigMapsOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/secrets/SecretsOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/persistentvolumes/PersistentVolumesOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/ingresses/IngressesOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/services/ServicesOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/helmreleases/HelmReleasesOverviewTable.jsx`
    - [ ] `frontend/src/k8s/resources/pods/PodOverviewTable.jsx` (separate impl)
  - [ ] **Swarm tables (8)**:
    - [ ] `frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx`
    - [ ] `frontend/src/docker/resources/tasks/SwarmTasksOverviewTable.jsx`
    - [ ] `frontend/src/docker/resources/nodes/SwarmNodesOverviewTable.jsx`
    - [ ] `frontend/src/docker/resources/networks/SwarmNetworksOverviewTable.jsx`
    - [ ] `frontend/src/docker/resources/configs/SwarmConfigsOverviewTable.jsx`
    - [ ] `frontend/src/docker/resources/secrets/SwarmSecretsOverviewTable.jsx`
    - [ ] `frontend/src/docker/resources/volumes/SwarmVolumesOverviewTable.jsx`
    - [ ] `frontend/src/docker/resources/stacks/SwarmStacksOverviewTable.jsx`

---

## Phase 5: Safety & UX

- [ ] Destructive ops: always show `BulkConfirmDialog`; typed count for 5+ items
- [ ] Production/kube-system namespace: extra warning text
- [ ] Keyboard: Space toggle, Shift+Click range, Ctrl/Cmd+A all visible, Escape clears
- [ ] Bottom panel coexistence: selection preserved when panel opens
- [ ] Auto-clear selection on data refresh to prevent stale references

---

## Testing

### Unit Tests (target >=70% coverage)
- [ ] `frontend/src/__tests__/useTableSelection.test.js` — toggle, toggleAll, shift-range, clear, data-change reset, indeterminate
- [ ] `frontend/src/__tests__/bulkActionBar.test.jsx` — renders actions, callbacks, count display
- [ ] `frontend/src/__tests__/bulkConfirmDialog.test.jsx` — item list, typed count, cancel/confirm
- [ ] `frontend/src/__tests__/bulkProgressDialog.test.jsx` — per-item status, retry, close behavior
- [ ] `frontend/src/__tests__/overviewTableWithPanel.test.jsx` — (extend) checkbox column, select all, bulk bar
- [ ] `frontend/src/__tests__/bulkOperations.test.js` — API call mapping
- [ ] `pkg/app/bulk_operations_test.go` — success, partial failure, empty list, unsupported types
- [ ] `pkg/app/bulk_operations_swarm_test.go` — Swarm equivalents

### E2E Tests
- [ ] `e2e/tests/70-bulk-operations.spec.ts` — checkbox select, bulk bar, bulk delete with confirm, bulk restart, partial failure, clear selection, filter-then-select-all
- [ ] `e2e/tests/swarm/60-bulk-operations.spec.ts` — bulk service restart, bulk scale, bulk node drain

---

## Implementation Order

```
Parallel (no dependencies):
  1A  useTableSelection hook
  1D  BulkSelection.css
  2A  BulkActionBar component
  2B  BulkConfirmDialog component
  2C  BulkProgressDialog component
  3A  Go K8s bulk operations
  3B  Go Swarm bulk operations
  4A  Bulk action registry

Sequential:
  1B  OverviewTableWithPanel mod    ← needs 1A, 1D, 2A
  1C  PodOverviewTable mod          ← needs 1A, 1D, 2A
  3C  Wails rebuild                 ← needs 3A, 3B
  4B  Bulk action executor          ← needs 3C
  4C  Wire all 22 tables            ← needs 1B, 4A, 4B
  5   Safety & UX polish            ← needs 1B, 2B, 2C
  Tests: incremental with each phase
```

## Verification

- [ ] `cd frontend && npm test` — all unit tests pass
- [ ] `go test ./pkg/app/...` — all Go tests pass
- [ ] `wails dev` — manual: checkboxes in all tables, bulk bar on selection, execute bulk delete/restart/scale/suspend-resume/node-ops, progress dialog tracks per-item
- [ ] `cd e2e && npx playwright test tests/70-bulk-operations.spec.ts` — E2E pass
- [ ] `cd e2e && npx playwright test tests/swarm/60-bulk-operations.spec.ts` — Swarm E2E pass
