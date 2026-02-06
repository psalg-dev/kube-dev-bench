# Phase 5: Holmes Analysis for Additional Kubernetes Resources

**Status:** WIP (65% — CronJob/Job/Ingress/PVC complete, ConfigMap/Secret/PV bonus; Node/HPA pending)
**Created:** 2026-02-06
**Updated:** 2026-02-06

**Goal**: Extend Holmes analysis to CronJob, Job, Ingress, PVC, Node, and HPA resources

**Note:** Frontend was migrated to TypeScript in PR #104. All frontend file references use `.tsx`/`.ts` extensions.

---

## Overview

### Current Holmes Integration (Verified)

Resources WITH Holmes analysis:
- Kubernetes: Pod, Deployment, StatefulSet, DaemonSet, Service, **CronJob, Job, Ingress, PVC, ConfigMap, Secret, PV** (all streaming)
- Docker Swarm: Service, Task (via `holmes_swarm.go`, 659 lines)
- Pod Logs analysis (via `holmes_logs.go`, 163 lines)

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
| Medium | Node | ❌ | ❌ | ❌ (no K8s nodes frontend) | **NOT STARTED** |
| Medium | HorizontalPodAutoscaler | ❌ | ❌ | ❌ (no HPA frontend) | **NOT STARTED** |

### Backend Files (Verified Sizes)
- `pkg/app/holmes_context.go` — 792 lines (all context functions)
- `pkg/app/holmes_integration.go` — 1,538 lines (all stream/analyze functions)
- `pkg/app/holmes_logs.go` — 163 lines (log analysis)
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
- [x] `getCronJobContext()` in `holmes_context.go` (line 465)
- [x] `AnalyzeCronJobStream()` in `holmes_integration.go` (line 974)
- [x] Export `AnalyzeCronJobStream` in `holmesApi.ts` (line 268)
- [x] Holmes tab in `CronJobsOverviewTable.tsx`
- [x] `onHolmesChatStream` and `onHolmesContextProgress` event subscriptions

### 2. Job Integration ✅ COMPLETE
- [x] `getJobContext()` in `holmes_context.go` (line 404)
- [x] `AnalyzeJobStream()` in `holmes_integration.go` (line 940)
- [x] Export `AnalyzeJobStream` in `holmesApi.ts` (line 261)
- [x] Holmes tab in `JobsOverviewTable.tsx`

### 3. Ingress Integration ✅ COMPLETE
- [x] `getIngressContext()` in `holmes_context.go` (line 548)
- [x] `AnalyzeIngressStream()` in `holmes_integration.go` (line 1008)
- [x] Export `AnalyzeIngressStream` in `holmesApi.ts` (line 275)
- [x] Holmes tab in `IngressesOverviewTable.tsx`

### 4. PersistentVolumeClaim Integration ✅ COMPLETE
- [x] `getPersistentVolumeClaimContext()` in `holmes_context.go` (line 735)
- [x] `AnalyzePersistentVolumeClaimStream()` in `holmes_integration.go` (line 1143)
- [x] Export `AnalyzePersistentVolumeClaimStream` in `holmesApi.ts` (line 303)
- [x] Holmes tab in `PersistentVolumeClaimsOverviewTable.tsx`

### 5-7. Bonus: ConfigMap, Secret, PV ✅ COMPLETE
- [x] `AnalyzeConfigMapStream()` in `holmes_integration.go` (line 1042)
- [x] `AnalyzeSecretStream()` in `holmes_integration.go` (line 1076)
- [x] `AnalyzePersistentVolumeStream()` in `holmes_integration.go` (line 1110)

---

## Remaining Resources

### 5. Node Integration ❌ NOT STARTED

**Requires:** Full backend context + streaming + full frontend implementation

**Note:** `pkg/app/nodes.go` exists with basic K8s node handling, but does NOT have Holmes context or analysis functions. No K8s nodes frontend directory exists (only Docker Swarm nodes at `frontend/src/docker/resources/nodes/`).

**Backend work needed:**
- [ ] `getNodeContext()` in `holmes_context.go` (cluster-scoped, no namespace)
- [ ] `AnalyzeNode()` and `AnalyzeNodeStream()` in `holmes_integration.go`
- [ ] Update router in `holmes_integration.go`
- [ ] Export `AnalyzeNodeStream` in `holmesApi.ts`

**Frontend work needed:**
- [ ] Create `frontend/src/k8s/resources/nodes/` directory
- [ ] Create `NodesOverviewTable.tsx` with Holmes integration
- [ ] Create supporting tab components (conditions, pods on node, resources)
- [ ] Add "Nodes" to sidebar in `SidebarSections.tsx`
- [ ] Add routing in `main-content.ts`
- [ ] Unit tests
- [ ] E2E test

### 6. HorizontalPodAutoscaler Integration ❌ NOT STARTED

**Requires:** Full backend + frontend implementation from scratch

**Backend work needed:**
- [ ] Create `pkg/app/hpa.go` with `GetHPAs()`, `GetHPA()`, types
- [ ] Add `HPAInfo` type
- [ ] `getHPAContext()` in `holmes_context.go`
- [ ] `AnalyzeHPA()` and `AnalyzeHPAStream()` in `holmes_integration.go`
- [ ] Update router in `holmes_integration.go`
- [ ] Export `AnalyzeHPAStream` in `holmesApi.ts`
- [ ] MCP tools for HPA listing and describe

**Frontend work needed:**
- [ ] Create `frontend/src/k8s/resources/hpa/` directory
- [ ] Create `HPAOverviewTable.tsx` with Holmes integration
- [ ] Create supporting tab components (metrics, conditions, target)
- [ ] Add "HPA" to sidebar in `SidebarSections.tsx`
- [ ] Add routing in `main-content.ts`
- [ ] Unit tests
- [ ] E2E test

---

## Testing Status

### Go Unit Tests
- [ ] Tests for `getCronJobContext()` — verify test exists
- [ ] Tests for `getJobContext()` — verify test exists
- [ ] Tests for `getIngressContext()` — verify test exists
- [ ] Tests for `getPersistentVolumeClaimContext()` — verify test exists
- [ ] Tests for `getNodeContext()` — ❌ Not implemented
- [ ] Tests for `getHPAContext()` — ❌ Not implemented

### E2E Tests
- [ ] Holmes E2E tests at `e2e/tests/holmes/` — 7 test files exist
- [ ] Phase 5 specific E2E — not yet created

---

## Success Criteria

- [x] CronJob, Job, Ingress, PVC have "Ask Holmes" functionality ✅
- [x] Context gathering captures relevant troubleshooting data ✅
- [x] Streaming responses work correctly ✅
- [x] Holmes tab appears in bottom panels ✅
- [ ] Node analysis working (backend + frontend)
- [ ] HPA analysis working (backend + frontend)
- [ ] Unit tests with >= 70% coverage for all new code
- [ ] E2E tests for each resource type

---

## Documentation Updates

- [ ] Update `CLAUDE.md` with Phase 5 features (Holmes supports: CronJob, Job, Ingress, PVC, ConfigMap, Secret, PV)
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
