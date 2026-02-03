# Codebase Reduction - Remaining Work Implementation Plan

**Date Created**: 2026-02-03  
**Last Updated**: 2026-02-03  
**Status**: ✅ Complete  
**Parent Plan**: [codebase-reduction-implementation-plan.md](codebase-reduction-implementation-plan.md)

---

## Executive Summary

This document tracks remaining implementation work from the codebase reduction plan. Significant progress has been made with **K8s OverviewTable migrations complete** (~5,450 lines removed), **Swarm simple + complex resources complete**, **Pods migration complete**, **CSS consolidation complete**, and **optional Go backend consolidation** complete. All items in this plan are now finished.

### Progress Overview

| Category | Status | Remaining Work |
|----------|--------|----------------|
| React Hooks (Foundation) | ✅ Complete | N/A |
| GenericResourceTable | ✅ Foundation Complete | N/A |
| K8s OverviewTable Migration | ✅ **COMPLETE** (~5,450 lines saved) | N/A |
| GenericInspectTab | ✅ Complete | N/A (all 4 migrated) |
| BaseModal Component | ✅ Complete | N/A |
| Go Polling & Utilities | ✅ Complete | N/A |
| Vite Bundle Optimization | ✅ Complete | N/A |
| Swarm Simple Resources | ✅ **COMPLETE** (~1,100 lines saved) | N/A |
| Swarm Complex Resources | ✅ Complete | N/A |
| CSS Consolidation | ✅ Complete | N/A |
| State Context Refactoring | ✅ Complete | N/A |
| CodeMirror Lazy Wrapper | ✅ Complete | N/A |

---

## ✅ Completed Work (No Action Required)

### Frontend Foundation

- [x] **useAsyncData hook** - `frontend/src/hooks/useAsyncData.js`
- [x] **useEventSubscription hook** - `frontend/src/hooks/useEventSubscription.js`
- [x] **useHolmesAnalysis hook** - `frontend/src/hooks/useHolmesAnalysis.js`
- [x] **useResourceData hook** - `frontend/src/hooks/useResourceData.js`
- [x] **GenericResourceTable component** - `frontend/src/components/GenericResourceTable/index.jsx`
- [x] **GenericInspectTab component** - `frontend/src/components/GenericInspectTab.jsx`
- [x] **BaseModal component** - `frontend/src/components/BaseModal/`
- [x] **MonitorModal CSS refactor** - `frontend/src/layout/MonitorModal.css`

### GenericInspectTab Migrations (All Complete)

- [x] `ConfigInspectTab.jsx` → Uses GenericInspectTab
- [x] `SecretInspectTab.jsx` → Uses GenericInspectTab  
- [x] `NetworkInspectTab.jsx` → Uses GenericInspectTab
- [x] `VolumeInspectTab.jsx` → Uses GenericInspectTab

### BaseModal Migrations (14 Complete)

- [x] `ConfigCompareModal.jsx` → Uses BaseModal
- [x] `ConfigEditModal.jsx` → Uses BaseModal
- [x] `SecretEditModal.jsx` → Uses BaseModal
- [x] `SecretCloneModal.jsx` → Uses BaseModal
- [x] `UpdateStackModal.jsx` → Uses BaseModal
- [x] `UpdateServiceImageModal.jsx` → Uses BaseModal
- [x] `ImageUpdateModal.jsx` → Uses BaseModal
- [x] `ImageUpdateSettingsModal.jsx` → Uses BaseModal
- [x] `AddKubeConfigOverlay.jsx` → Uses BaseModal
- [x] `AddSwarmConnectionOverlay.jsx` → Uses BaseModal
- [x] `ConnectionProxySettings.jsx` → Uses BaseModal
- [x] `HolmesConfigModal.jsx` → Uses BaseModal
- [x] `CreateManifestOverlay.jsx` → Uses BaseModal
- [x] `PortForwardDialog.jsx` → Uses BaseModal

### Resource Configs (All K8s Complete)

- [x] `deploymentConfig.jsx` - Deployment table configuration
- [x] `statefulsetConfig.jsx` - StatefulSet table configuration
- [x] `daemonsetConfig.jsx` - DaemonSet table configuration
- [x] `replicasetConfig.jsx` - ReplicaSet table configuration
- [x] `jobConfig.jsx` - Job table configuration
- [x] `cronjobConfig.jsx` - CronJob table configuration
- [x] `configmapConfig.jsx` - ConfigMap table configuration
- [x] `secretConfig.jsx` - Secret table configuration
- [x] `serviceConfig.jsx` - Service table configuration
- [x] `ingressConfig.jsx` - Ingress table configuration
- [x] `pvConfig.jsx` - PersistentVolume table configuration
- [x] `pvcConfig.jsx` - PersistentVolumeClaim table configuration
- [x] `podConfig.jsx` - Pod table configuration

### K8s OverviewTable Migration (All Migrated - 2026-02-03)

The following K8s OverviewTable components have been migrated to use GenericResourceTable:
- [x] DeploymentsOverviewTable (~600 lines → ~20 lines)
- [x] StatefulSetsOverviewTable (~475 lines → ~20 lines)
- [x] DaemonSetsOverviewTable (~500 lines → ~20 lines)
- [x] ReplicaSetsOverviewTable (~270 lines → ~20 lines)
- [x] JobsOverviewTable (~450 lines → ~20 lines)
- [x] CronJobsOverviewTable (~510 lines → ~20 lines)
- [x] ServicesOverviewTable (~420 lines → ~20 lines)
- [x] ConfigMapsOverviewTable (~455 lines → ~20 lines)
- [x] SecretsOverviewTable (~400 lines → ~20 lines)
- [x] IngressesOverviewTable (~468 lines → ~20 lines)
- [x] PersistentVolumesOverviewTable (~460 lines → ~20 lines)
- [x] PersistentVolumeClaimsOverviewTable (~488 lines → ~20 lines)

**Total K8s Migration: ~5,450 lines removed**

### Backend (Go)

- [x] **polling.go** - Generic `startResourcePolling[T any]` function
- [x] **resource_utils.go** - `ExtractFirstContainerImage`, `SafeReplicaCount`, `MergeLabels`, `SafeLabels`
- [x] `daemonsets.go` - Migrated to use resource_utils
- [x] `replicasets.go` - Migrated to use resource_utils  
- [x] `cronjobs.go` - Migrated to use resource_utils

### Build Configuration

- [x] **Vite manual chunks** - CodeMirror, markdown, terminal, react-vendor
- [x] **uuid package removed** - Using native `crypto.randomUUID()`

---

## 🔄 Remaining Work

---

### PHASE 1: OverviewTable Migration (High Impact)

**Priority**: CRITICAL  
**Estimated Savings**: 2,000-3,000 lines  
**Actual Savings**: ~5,450 lines (K8s complete)  
**Status**: ✅ K8s + Swarm + Pods complete

#### 1.1 Create Resource Configurations - ✅ COMPLETE

All K8s resource configs have been created. Files renamed from `.js` to `.jsx` to properly support JSX syntax.

- [x] **1.1.1** Pod config - Created (port forwarding, shell, files tabs supported)
- [x] **1.1.2** `daemonsetConfig.jsx` - DaemonSet resource configuration
- [x] **1.1.3** `replicasetConfig.jsx` - ReplicaSet resource configuration
- [x] **1.1.4** `jobConfig.jsx` - Job resource configuration
- [x] **1.1.5** `cronjobConfig.jsx` - CronJob resource configuration
- [x] **1.1.6** `serviceConfig.jsx` - K8s Service resource configuration
- [x] **1.1.7** `configmapConfig.jsx` - ConfigMap resource configuration
- [x] **1.1.8** `secretConfig.jsx` - Secret resource configuration
- [x] **1.1.9** `ingressConfig.jsx` - Ingress resource configuration
- [x] **1.1.10** `pvConfig.jsx` - PersistentVolume resource configuration
- [x] **1.1.11** `pvcConfig.jsx` - PersistentVolumeClaim resource configuration

#### 1.2 Create Swarm Resource Configurations

- [ ] **1.2.1** Create `frontend/src/config/resourceConfigs/swarm/serviceConfig.js`
  - Description: Swarm Service resource configuration
  - Dependencies: GetSwarmServices

- [ ] **1.2.2** Create `frontend/src/config/resourceConfigs/swarm/taskConfig.js`
  - Description: Swarm Task resource configuration
  - Dependencies: GetSwarmTasks

- [ ] **1.2.3** Create `frontend/src/config/resourceConfigs/swarm/nodeConfig.js`
  - Description: Swarm Node resource configuration
  - Dependencies: GetSwarmNodes

- [x] **1.2.4** Create `frontend/src/config/resourceConfigs/swarm/networkConfig.jsx` ✅
  - Description: Swarm Network resource configuration
  - Dependencies: GetSwarmNetworks

- [x] **1.2.5** Create `frontend/src/config/resourceConfigs/swarm/configConfig.jsx` ✅
  - Description: Swarm Config resource configuration
  - Dependencies: GetSwarmConfigs

- [x] **1.2.6** Create `frontend/src/config/resourceConfigs/swarm/secretConfig.jsx` ✅
  - Description: Swarm Secret resource configuration
  - Dependencies: GetSwarmSecrets

- [x] **1.2.7** Create `frontend/src/config/resourceConfigs/swarm/volumeConfig.jsx` ✅
  - Description: Swarm Volume resource configuration
  - Dependencies: GetSwarmVolumes

- [ ] **1.2.8** Create `frontend/src/config/resourceConfigs/swarm/stackConfig.js`
  - Description: Swarm Stack resource configuration
  - Dependencies: GetSwarmStacks

- [x] **1.2.9** Update `frontend/src/config/resourceConfigs/swarm/index.js` ✅
  - Description: Add barrel exports for all new configs

#### 1.3 Migrate K8s OverviewTable Components - ✅ COMPLETE

All K8s OverviewTable components (except Pods) have been migrated to use GenericResourceTable.
Old files deleted, Generic files renamed to standard names.

- [x] **1.3.1** Migrate `PodOverviewTable.jsx` (1,218 lines → ~100 lines)
  - Location: `frontend/src/k8s/resources/pods/`
  - Complexity: HIGH - port forwarding, shell access, files tab
  - Create: `podConfig.jsx`, `PodPanelContent.jsx`, `PodRowActions.jsx`
  - **Status**: Complete

- [x] **1.3.2** ServicesOverviewTable (~420 lines → ~20 lines) ✅
- [x] **1.3.3** DaemonSetsOverviewTable (~500 lines → ~20 lines) ✅
- [x] **1.3.4** ReplicaSetsOverviewTable (~270 lines → ~20 lines) ✅
- [x] **1.3.5** JobsOverviewTable (~450 lines → ~20 lines) ✅
- [x] **1.3.6** CronJobsOverviewTable (~510 lines → ~20 lines) ✅
- [x] **1.3.7** ConfigMapsOverviewTable (~455 lines → ~20 lines) ✅
- [x] **1.3.8** SecretsOverviewTable (~400 lines → ~20 lines) ✅
- [x] **1.3.9** IngressesOverviewTable (~468 lines → ~20 lines) ✅
- [x] **1.3.10** PersistentVolumesOverviewTable (~460 lines → ~20 lines) ✅
- [x] **1.3.11** PersistentVolumeClaimsOverviewTable (~488 lines → ~20 lines) ✅
- [x] **1.3.12** DeploymentsOverviewTable (~600 lines → ~20 lines) ✅
- [x] **1.3.13** StatefulSetsOverviewTable (~475 lines → ~20 lines) ✅

#### 1.4 Migrate Swarm OverviewTable Components

##### Simple Resources (Completed 2026-02-03)

- [x] **1.4.5** Migrate `SwarmNetworksOverviewTable.jsx` (~225 lines → ~20 lines) ✅
  - Location: `frontend/src/docker/resources/networks/`
  - Complexity: LOW

- [x] **1.4.6** Migrate `SwarmConfigsOverviewTable.jsx` (~337 lines → ~20 lines) ✅
  - Location: `frontend/src/docker/resources/configs/`
  - Complexity: LOW
  - Created: `ConfigSummaryPanel.jsx` for panel with Edit/Compare/Clone/Download/Delete actions

- [x] **1.4.7** Migrate `SwarmSecretsOverviewTable.jsx` (~271 lines → ~20 lines) ✅
  - Location: `frontend/src/docker/resources/secrets/`
  - Complexity: LOW
  - Created: `SecretSummaryPanel.jsx` for panel with Edit/Rotate/Clone/Delete actions

- [x] **1.4.8** Migrate `SwarmVolumesOverviewTable.jsx` (~353 lines → ~20 lines) ✅
  - Location: `frontend/src/docker/resources/volumes/`
  - Complexity: LOW

**Total Swarm Simple Resources: ~1,100 lines removed**

##### Complex Resources (Completed 2026-02-03)

- [x] **1.4.1** Migrate `SwarmServicesOverviewTable.jsx` (866 lines → ~60 lines)
  - Location: `frontend/src/docker/resources/services/`
  - Complexity: HIGH - image updates, scaling

- [x] **1.4.2** Migrate `SwarmTasksOverviewTable.jsx` (817 lines → ~40 lines)
  - Location: `frontend/src/docker/resources/tasks/`
  - Complexity: MEDIUM

- [x] **1.4.3** Migrate `SwarmNodesOverviewTable.jsx` (855 lines → ~40 lines)
  - Location: `frontend/src/docker/resources/nodes/`
  - Complexity: MEDIUM

- [x] **1.4.4** Migrate `SwarmStacksOverviewTable.jsx` (764 lines → ~50 lines)
  - Location: `frontend/src/docker/resources/stacks/`
  - Complexity: HIGH - update stack, compose files

---

### PHASE 2: Modal Migration (Medium Impact)

**Priority**: HIGH  
**Estimated Savings**: 250-350 lines  
**Effort**: 0.5 days

Migrate remaining modals to use BaseModal component.

- [x] **2.1** Migrate `CreateManifestOverlay.jsx`
  - Location: `frontend/src/CreateManifestOverlay.jsx`
  - Current: Uses inline styles for overlay
  - Target: Use BaseModal with custom width

- [x] **2.2** Migrate `AddKubeConfigOverlay.jsx`
  - Location: `frontend/src/layout/connection/AddKubeConfigOverlay.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal

- [x] **2.3** Migrate `AddSwarmConnectionOverlay.jsx`
  - Location: `frontend/src/layout/connection/AddSwarmConnectionOverlay.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal

- [x] **2.4** Migrate `ConnectionProxySettings.jsx`
  - Location: `frontend/src/layout/connection/ConnectionProxySettings.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal

- [x] **2.5** Migrate `HolmesConfigModal.jsx`
  - Location: `frontend/src/holmes/HolmesConfigModal.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal

- [x] **2.6** Migrate `CreateJobModal.jsx` (N/A)
  - Location: `frontend/src/k8s/resources/cronjobs/CreateJobModal.jsx` (file removed)
  - Current: Not present in codebase
  - Target: N/A

- [x] **2.7** Migrate `PortForwardDialog.jsx`
  - Location: `frontend/src/k8s/resources/pods/PortForwardDialog.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal

- [x] **2.8** Migrate K8s `DeleteConfirmModal.jsx` (N/A)
  - Location: `frontend/src/k8s/DeleteConfirmModal.jsx` (file removed)
  - Current: Not present in codebase
  - Target: N/A

- [x] **2.9** Migrate Docker `DeleteConfirmModal.jsx` (N/A)
  - Location: `frontend/src/docker/DeleteConfirmModal.jsx` (file removed)
  - Current: Not present in codebase
  - Target: N/A

---

### PHASE 3: CSS Consolidation (Low-Medium Impact)

**Priority**: MEDIUM  
**Estimated Savings**: 500-800 lines  
**Effort**: 1 day

Create shared CSS modules to eliminate duplicated styles.

- [x] **3.1** Create shared CSS directory structure
  - Create: `frontend/src/styles/shared/`
  
- [x] **3.2** Create `frontend/src/styles/shared/buttons.css`
  - Description: Consolidate `.create-button`, `.action-button`, `.danger-button` variants
  - Extract from: Multiple component CSS files

- [x] **3.3** Create `frontend/src/styles/shared/panels.css`
  - Description: Consolidate `.bottom-panel`, `.panel-header`, `.panel-content` styles
  - Extract from: OverviewTable CSS files

- [x] **3.4** Create `frontend/src/styles/shared/menus.css`
  - Description: Consolidate context menu styles (~30 lines repeated in 20+ components)
  - Extract from: OverviewTable components with inline context menu styles

- [x] **3.5** Create `frontend/src/styles/shared/messages.css`
  - Description: Consolidate `.error-message`, `.warning-message`, `.info-message` styles
  - Extract from: Multiple CSS files with duplicated message styles

- [x] **3.6** Create `frontend/src/styles/shared/tables.css`
  - Description: Consolidate `.panel-table`, `.table-header`, `.table-row` styles
  - Extract from: Panel and table CSS files

- [x] **3.7** Create `frontend/src/styles/shared/index.css`
  - Description: Barrel import for all shared modules
  - Import in: `frontend/src/App.css` or `frontend/src/index.css`

- [x] **3.8** Update component CSS files to import shared modules
  - Description: Replace duplicated styles with imports
  - Progress: Panel table styles centralized from `frontend/src/app.css`
  - Progress: Dropdown/context menus updated to shared styles in `OverviewTableWithPanel.jsx` and `PodOverviewTable.jsx`
  - Progress: Removed legacy message/button styles from `frontend/src/app.css` and `frontend/src/style.css`
  - Progress: Removed unused create/resource menu styles from `frontend/src/app.css`
  - Files: All component CSS files using the consolidated patterns

---

### PHASE 4: State Context Refactoring (Medium Impact)

**Priority**: MEDIUM  
**Estimated Savings**: 200-300 lines  
**Effort**: 1 day

Create context factory to reduce duplication between ClusterStateContext and SwarmStateContext.

- [x] **4.1** Create `frontend/src/state/createResourceContext.js`
  - Description: Factory function for creating resource contexts
  - Features:
    - Shared reducer pattern (`SET_LOADING`, `SET_CONNECTION_STATUS`, etc.)
    - Dynamic `SET_*` handling
    - Configurable refresh functions
    - Error handling patterns

- [x] **4.2** Refactor `ClusterStateContext.jsx`
  - Location: `frontend/src/state/ClusterStateContext.jsx`
  - Current: 464 lines
  - Target: ~150-200 lines using context factory

- [x] **4.3** Refactor `SwarmStateContext.jsx`
  - Location: `frontend/src/state/SwarmStateContext.jsx`
  - Current: 638 lines
  - Target: ~200-250 lines using context factory

- [x] **4.4** Add tests for context factory
  - Create: `frontend/src/__tests__/createResourceContext.test.js`

---

### PHASE 5: CodeMirror Lazy Loading (Bundle Optimization)

**Priority**: MEDIUM  
**Estimated Savings**: 50-80 KB gzipped on initial load  
**Effort**: 0.5 days

Create lazy loading wrapper for CodeMirror to reduce initial bundle size.

- [x] **5.1** Create `frontend/src/components/CodeMirrorEditor/index.jsx`
  - Description: Lazy wrapper using React.lazy and Suspense
  - Features:
    - Loading fallback component
    - Dynamic import of CodeMirror core

- [x] **5.2** Create `frontend/src/components/CodeMirrorEditor/CodeMirrorCore.jsx`
  - Description: Actual CodeMirror implementation
  - Contains: All @codemirror/* imports
  - Note: This file only loads when editor is needed

- [x] **5.3** Create `frontend/src/components/CodeMirrorEditor/EditorLoading.jsx`
  - Description: Loading placeholder component
  - Features: Skeleton or spinner matching editor dimensions

- [x] **5.4** Update components to use lazy CodeMirror wrapper
  - Files to modify:
    - `frontend/src/layout/bottompanel/LogViewerTab.jsx`
    - `frontend/src/layout/bottompanel/TextEditorTab.jsx`
    - `frontend/src/layout/bottompanel/TextViewerTab.jsx`
    - `frontend/src/layout/bottompanel/YamlTab.jsx`
    - `frontend/src/layout/bottompanel/FilesTab.jsx`
    - `frontend/src/k8s/resources/pods/PodFilesTab.jsx`
    - `frontend/src/CreateManifestOverlay.jsx`

- [x] **5.5** Add tests for lazy CodeMirror wrapper
  - Create: `frontend/src/__tests__/CodeMirrorEditor.test.jsx`

---

### PHASE 6: Additional Go Backend Work (Optional)

**Priority**: LOW  
**Estimated Savings**: 400-550 lines  
**Effort**: 1.5 days

These items provide additional consolidation but are lower priority.

- [x] **6.1** Create Docker handler factory
  - Create: `pkg/app/docker/resource_handler.go`
  - Description: Generic `ListAndConvert[T, InfoT]` function
  - Apply to: configs.go, secrets.go, volumes.go, services.go, tasks.go, nodes.go, networks.go

- [x] **6.2** Consolidate Holmes context builders
  - Create: `pkg/app/holmes_context_builder.go`
  - Description: Generic context builder with resource-specific adapters
  - Apply to: `pkg/app/holmes_context.go` functions

- [x] **6.3** Migrate remaining Go files to use polling.go
  - Files: deployments.go, statefulsets.go, pods.go, jobs.go, services.go, etc.
  - Note: Only if not already using startResourcePolling

---

## Testing Requirements

### After Each Phase

- [ ] Run frontend unit tests: `cd frontend && npm test`
- [ ] Run E2E tests: `cd e2e && npx playwright test`
- [ ] Verify no visual regressions

### Coverage Targets

| Component | Min Coverage |
|-----------|--------------|
| GenericResourceTable | 70% |
| Resource configs | 70% |
| BaseModal migrations | Existing coverage maintained |
| CSS consolidation | Manual visual verification |
| Context factory | 80% |
| CodeMirror lazy wrapper | 70% |

---

## Success Metrics

### Target Reductions

| Category | Target | Phase |
|----------|--------|-------|
| OverviewTable consolidation | -2,000 to -3,000 lines | Phase 1 |
| Modal migrations | -250 to -350 lines | Phase 2 |
| CSS consolidation | -500 to -800 lines | Phase 3 |
| State context refactoring | -200 to -300 lines | Phase 4 |
| **Total Target** | **-2,950 to -4,450 lines** | All |

### Bundle Size

| Optimization | Target Savings |
|--------------|----------------|
| CodeMirror lazy loading | 50-80 KB gzipped |
| Vite manual chunks (done) | 10-15 KB initial load |

---

## Implementation Order Recommendation

1. **Start with simple K8s OverviewTables** (Phase 1.3.7-1.3.11)
   - ConfigMaps, Secrets, Ingresses, PVs, PVCs
   - Low complexity, establishes pattern

2. **Migrate workload K8s tables** (Phase 1.3.3-1.3.6)
   - DaemonSets, ReplicaSets, Jobs, CronJobs
   - Medium complexity

3. **Migrate complex K8s tables** (Phase 1.3.1-1.3.2)
   - Pods, Services
   - Highest complexity, most lines saved

4. **Migrate Swarm tables** (Phase 1.4)
   - Similar pattern to K8s migrations

5. **Complete modal migrations** (Phase 2)
   - Quick wins, consistent styling

6. **CSS and optimization** (Phases 3-5)
   - Lower priority, nice-to-have improvements

---

## Notes

- **GenericResourceTable** pattern already proven with `DeploymentsOverviewTableGeneric.jsx`
- **BaseModal** pattern proven with 14 successful migrations
- **GenericInspectTab** 100% complete (all 4 InspectTabs migrated)
- Consider creating E2E tests for each migrated component before migration
- Use feature flags if needed for gradual rollout of migrated components
