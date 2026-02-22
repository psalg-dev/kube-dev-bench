# Bulk Operations Implementation Plan

**Status:** ✅ IMPLEMENTED (with minor limitations)
**Created:** 2026-02-05
**Updated:** 2026-02-06 (verified)

Add multi-select checkboxes and bulk action toolbars to **all 22+ overview tables** (Kubernetes + Docker Swarm) in a single rollout.

## Current Implementation (Verified 2026-02-06)

- Selection state and UI are implemented in [frontend/src/hooks/useTableSelection.ts](frontend/src/hooks/useTableSelection.ts), [frontend/src/components/BulkActionBar.tsx](frontend/src/components/BulkActionBar.tsx), and [frontend/src/layout/overview/OverviewTableWithPanel.tsx](frontend/src/layout/overview/OverviewTableWithPanel.tsx), with styles in [frontend/src/layout/overview/BulkSelection.css](frontend/src/layout/overview/BulkSelection.css).
- Action registry and execution live in [frontend/src/constants/bulkActions.ts](frontend/src/constants/bulkActions.ts) and [frontend/src/api/bulkOperations.ts](frontend/src/api/bulkOperations.ts).
- Unit coverage exists for selection logic in [frontend/src/__tests__/useTableSelection.test.ts](frontend/src/__tests__/useTableSelection.test.ts).
- Limitation: Swarm task bulk remove is intentionally disabled in `bulkActions` (UI shows disabled tooltip).

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

## Phase 1: Selection Infrastructure ✅ COMPLETE

- [x] **1A. Selection State Hook** — `frontend/src/hooks/useTableSelection.js` ✅ IMPLEMENTED (124 lines)
  - [x] `useTableSelection(data, getRowKey)` returning `selectedKeys`, `isSelected`, `isAllSelected`, `isIndeterminate`, `toggleRow`, `toggleAll`, `clearSelection`, `selectedCount`, `getSelectedRows`
  - [x] Shift+click range selection (track last clicked index)
  - [x] `toggleAll` only affects visible/filtered rows
  - [x] Auto-clear when data array identity changes

... (content preserved from original plan)

