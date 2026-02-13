---
title: "Phase 5: Holmes Analysis for Additional Kubernetes Resources"
status: wip
priority: medium
---
# Phase 5: Holmes Analysis for Additional Kubernetes Resources

**Status:** WIP (95% — Node + HPA Holmes implemented; validation/documentation wrap-up in progress)
**Created:** 2026-02-06
**Updated:** 2026-02-13

**Goal**: Extend Holmes analysis to CronJob, Job, Ingress, PVC, Node, and HPA resources

**Note:** Frontend was migrated to TypeScript in PR #104. All frontend file references use `.tsx`/`.ts` extensions.

---

## Overview

### Current Holmes Integration (Verified)

Resources WITH Holmes analysis:
- Kubernetes: Pod, Deployment, StatefulSet, DaemonSet, Service, **CronJob, Job, Ingress, PVC, ConfigMap, Secret, PV** (all streaming)
- Docker Swarm: Service, Task (via `holmes_swarm.go`, 659 lines)
- Pod Logs analysis (via `holmes_logs.go`, 164 lines)

### Phase 5 Scope

| Priority | Resource | Backend Context | Backend Stream | Frontend Holmes Tab | Status |
|----------|----------|-----------------|----------------|---------------------|--------|
| High | CronJob | ✅ `getCronJobContext()` | ✅ `AnalyzeCronJobStream()` | ✅ `CronJobsOverviewTable.tsx` | **DONE** |
| High | Job | ✅ `getJobContext()` | ✅ `AnalyzeJobStream()` | ✅ `JobsOverviewTable.tsx` | **DONE** |
| High | Ingress | ✅ `getIngressContext()` | ✅ `AnalyzeIngressStream()` | ✅ `IngressesOverviewTable.tsx` | **DONE** |
| High | PersistentVolumeClaim | ✅ `getPersistentVolumeClaimContext()` | ✅ `AnalyzePersistentVolumeClaimStream()` | ✅ `PersistentVolumeClaimsOverviewTable.tsx` | **DONE** |
| Bonus | ConfigMap | ✅ | ✅ `AnalyzeConfigMapStream()` | ✅ | **DONE** |
| Bonus | Secret | ✅ | ✅ `AnalyzeSecretStream()` | ✅ | **DONE** |
| Bonus | PersistentVolume | ✅ | ✅ `AnalyzePersistentVolumeStream()` | ✅ | **DONE** |
| Medium | Node | ✅ `getNodeContext()` | ✅ `AnalyzeNodeStream()` | ✅ `NodesOverviewTable.tsx` | **DONE** |
| Medium | HorizontalPodAutoscaler | ✅ `getHPAContext()` | ✅ `AnalyzeHPAStream()` | ✅ `HPAOverviewTable.tsx` | **DONE** |

### Backend Files (Verified Sizes)
- `pkg/app/holmes_context.go` — 805 lines (all context functions)
- `pkg/app/holmes_integration.go` — 1,540 lines (all stream/analyze functions)
- `pkg/app/holmes_logs.go` — 164 lines (log analysis)
- `pkg/app/holmes_swarm.go` — 659 lines (Swarm context analysis)

### Frontend Files (Verified)
- `frontend/src/holmes/holmesApi.ts` exports:
  - ✅ `AnalyzeCronJobStream` (line 268)
  - ✅ `AnalyzeJobStream` (line 261)
  - ✅ `AnalyzeIngressStream` (line 275)
  - ✅ `AnalyzePersistentVolumeClaimStream` (line 303)
  - ❌ `AnalyzeNodeStream` — NOT FOUND
  - ❌ `AnalyzeHPAStream` — NOT FOUND

---

## Completed Resources

### 1. CronJob Integration ✅ COMPLETE
- [x] `getCronJobContext()` in `holmes_context.go` (line 477)
- [x] `AnalyzeCronJobStream()` in `holmes_integration.go` (line 974)
- [x] Export `AnalyzeCronJobStream` in `holmesApi.ts` (line 268)
- [x] Holmes tab in `CronJobsOverviewTable.tsx`
- [x] `onHolmesChatStream` and `onHolmesContextProgress` event subscriptions

### 2. Job Integration ✅ COMPLETE
- [x] `getJobContext()` in `holmes_context.go` (line 413)
- [x] `AnalyzeJobStream()` in `holmes_integration.go` (line 940)
- [x] Export `AnalyzeJobStream` in `holmesApi.ts` (line 261)
- [x] Holmes tab in `JobsOverviewTable.tsx`

### 3. Ingress Integration ✅ COMPLETE
- [x] `getIngressContext()` in `holmes_context.go` (line 560)
- [x] `AnalyzeIngressStream()` in `holmes_integration.go` (line 1008)
- [x] Export `AnalyzeIngressStream` in `holmesApi.ts` (line 275)
- [x] Holmes tab in `IngressesOverviewTable.tsx`

### 4. PersistentVolumeClaim Integration ✅ COMPLETE
- [x] `getPersistentVolumeClaimContext()` in `holmes_context.go` (line 747)
- [x] `AnalyzePersistentVolumeClaimStream()` in `holmes_integration.go` (line 1143)
- [x] Export `AnalyzePersistentVolumeClaimStream` in `holmesApi.ts` (line 303)
- [x] Holmes tab in `PersistentVolumeClaimsOverviewTable.tsx`

### 5-7. Bonus: ConfigMap, Secret, PV ✅ COMPLETE
- [x] `AnalyzeConfigMapStream()` in `holmes_integration.go` (line 1042)
- [x] `AnalyzeSecretStream()` in `holmes_integration.go` (line 1076)
- [x] `AnalyzePersistentVolumeStream()` in `holmes_integration.go` (line 1110)

---

## Remaining Resources

### 5. Node Integration ✅ COMPLETE

**Requires:** Full backend context + streaming + full frontend implementation

**Note:** `pkg/app/nodes.go` exists with basic K8s node handling, but does NOT have Holmes context or analysis functions. No K8s nodes frontend directory exists (only Docker Swarm nodes at `frontend/src/docker/resources/nodes/`).

**Backend work completed:**
- [x] `getNodeContext()` in `holmes_context.go` (cluster-scoped, no namespace)
- [x] `AnalyzeNode()` and `AnalyzeNodeStream()` in `holmes_integration.go`
- [x] Update router in `holmes_integration.go`
- [x] Export `AnalyzeNodeStream` in `holmesApi.ts`

**Frontend work completed:**
- [x] Create `frontend/src/k8s/resources/nodes/` directory
- [x] Create `NodesOverviewTable.tsx` with Holmes integration
- [x] Create supporting tab components (conditions, pods on node, resources)
- [x] Add "Nodes" to sidebar in `SidebarSections.tsx`
- [x] Add routing in `main-content.ts`
- [x] E2E test (`e2e/tests/52-nodes-hpa-holmes.spec.ts`)

### 6. HorizontalPodAutoscaler Integration ✅ COMPLETE

**Requires:** Holmes backend/context + frontend implementation

**Note:** Base HPA resource backend already exists (`pkg/app/horizontalpodautoscalers.go`) with `GetHorizontalPodAutoscalers()` and `HorizontalPodAutoscalerInfo` in `pkg/app/types.go`. Holmes-specific integration is still missing.

**Backend work completed:**
- [x] Base HPA listing support exists (`GetHorizontalPodAutoscalers()`)
- [x] Shared HPA type exists (`HorizontalPodAutoscalerInfo`)
- [x] Add detail getter (`GetHorizontalPodAutoscalerDetail()`)
- [x] `getHPAContext()` in `holmes_context.go`
- [x] `AnalyzeHPA()` and `AnalyzeHPAStream()` in `holmes_integration.go`
- [x] Update router in `holmes_integration.go`
- [x] Export `AnalyzeHPAStream` in `holmesApi.ts`

**Frontend work completed:**
- [x] Create `frontend/src/k8s/resources/hpa/` directory
- [x] Create `HPAOverviewTable.tsx` with Holmes integration
- [x] Create supporting tab components (metrics, conditions, target)
- [x] Add "HPA" to sidebar in `SidebarSections.tsx`
- [x] Add routing in `main-content.ts`
- [x] E2E test (`e2e/tests/52-nodes-hpa-holmes.spec.ts`)

---

## Testing Status

### Go Unit Tests
- [x] Tests for `getCronJobContext()` exist (`holmes_context_test.go`)
- [x] Tests for `getJobContext()` exist (`holmes_context_test.go`)
- [x] Tests for `getIngressContext()` exist (`holmes_context_test.go`)
- [x] Tests for `getPersistentVolumeClaimContext()` exist (`holmes_context_test.go`)
- [x] Tests for `getNodeContext()` (`holmes_context_test.go`)
- [x] Tests for `getHPAContext()` (`holmes_context_test.go`)

### E2E Tests
- [x] Holmes E2E tests at `e2e/tests/holmes/` — 7 test files exist
- [x] Phase 5 resource-specific E2E for remaining Node/HPA panels (`e2e/tests/52-nodes-hpa-holmes.spec.ts`)

---

## Success Criteria

- [x] CronJob, Job, Ingress, PVC have "Ask Holmes" functionality ✅
- [x] Context gathering captures relevant troubleshooting data ✅
- [x] Streaming responses work correctly ✅
- [x] Holmes tab appears in bottom panels ✅
- [x] Node analysis working (backend + frontend)
- [x] HPA Holmes analysis working (backend + frontend)
- [ ] Unit tests with >= 70% coverage for all new code
- [ ] E2E tests for each resource type

---

## Documentation Updates

- [x] Update `CLAUDE.md` with Phase 5 features (Holmes supports: CronJob, Job, Ingress, PVC, ConfigMap, Secret, PV, Node, HPA)
- [ ] Document new resource analysis capabilities
- [ ] Add troubleshooting section for new resource types

---

**Phase 5 Complete When:**
- All resources (including Node and HPA) have working Holmes analysis
- Streaming responses work for all resources
- Context gathering provides relevant troubleshooting data
- Unit tests >= 70% coverage
- E2E tests passing
- Documentation updated
