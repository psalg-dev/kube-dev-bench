# Codebase Reduction - Remaining Work Implementation Plan

**Date Created**: 2026-02-03  
**Status**: In Progress  
**Parent Plan**: [codebase-reduction-implementation-plan.md](codebase-reduction-implementation-plan.md)

---

## Executive Summary

This document tracks remaining implementation work from the codebase reduction plan. Significant foundational work has been completed, with ~70% of infrastructure in place. The remaining work focuses on **migration tasks** (applying the new patterns to existing components) and **CSS consolidation**.

### Progress Overview

| Category | Status | Remaining Work |
|----------|--------|----------------|
| React Hooks (Foundation) | ✅ Complete | N/A |
| GenericResourceTable | ✅ Foundation Complete | Migrate 21 OverviewTable components |
| GenericInspectTab | ✅ Complete | N/A (all 4 migrated) |
| BaseModal Component | ✅ Foundation Complete | Migrate 9 more modal components |
| Go Polling & Utilities | ✅ Complete | N/A |
| Vite Bundle Optimization | ✅ Complete | N/A |
| CSS Consolidation | ❌ Not Started | Create shared CSS modules |
| State Context Refactoring | ❌ Not Started | Create context factory |
| CodeMirror Lazy Wrapper | ❌ Not Started | Create lazy loading wrapper |

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

### BaseModal Migrations (8 Complete)

- [x] `ConfigCompareModal.jsx` → Uses BaseModal
- [x] `ConfigEditModal.jsx` → Uses BaseModal
- [x] `SecretEditModal.jsx` → Uses BaseModal
- [x] `SecretCloneModal.jsx` → Uses BaseModal
- [x] `UpdateStackModal.jsx` → Uses BaseModal
- [x] `UpdateServiceImageModal.jsx` → Uses BaseModal
- [x] `ImageUpdateModal.jsx` → Uses BaseModal
- [x] `ImageUpdateSettingsModal.jsx` → Uses BaseModal

### Resource Configs (2 Complete)

- [x] `deploymentConfig.js` - Deployment table configuration
- [x] `statefulsetConfig.js` - StatefulSet table configuration

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
**Effort**: 3-4 days

Create resource configs and migrate OverviewTable components to use GenericResourceTable.

#### 1.1 Create Resource Configurations

Each config file follows the pattern in `deploymentConfig.js` and `statefulsetConfig.js`.

- [ ] **1.1.1** Create `frontend/src/config/resourceConfigs/podConfig.js`
  - Description: Pod resource configuration
  - Dependencies: GetPods, AnalyzePodStream, Pod-specific panel content renderer
  - Complexity: High (port forwarding, shell, files tabs)
  
- [ ] **1.1.2** Create `frontend/src/config/resourceConfigs/daemonsetConfig.js`
  - Description: DaemonSet resource configuration
  - Dependencies: GetDaemonSets, AnalyzeDaemonSetStream
  
- [ ] **1.1.3** Create `frontend/src/config/resourceConfigs/replicasetConfig.js`
  - Description: ReplicaSet resource configuration
  - Dependencies: GetReplicaSets
  
- [ ] **1.1.4** Create `frontend/src/config/resourceConfigs/jobConfig.js`
  - Description: Job resource configuration  
  - Dependencies: GetJobs, AnalyzeJobStream
  
- [ ] **1.1.5** Create `frontend/src/config/resourceConfigs/cronjobConfig.js`
  - Description: CronJob resource configuration
  - Dependencies: GetCronJobs, AnalyzeCronJobStream
  
- [ ] **1.1.6** Create `frontend/src/config/resourceConfigs/serviceConfig.js`
  - Description: K8s Service resource configuration
  - Dependencies: GetServices, AnalyzeServiceStream
  
- [ ] **1.1.7** Create `frontend/src/config/resourceConfigs/configmapConfig.js`
  - Description: ConfigMap resource configuration
  - Dependencies: GetConfigMaps
  
- [ ] **1.1.8** Create `frontend/src/config/resourceConfigs/secretConfig.js`
  - Description: Secret resource configuration
  - Dependencies: GetSecrets
  
- [ ] **1.1.9** Create `frontend/src/config/resourceConfigs/ingressConfig.js`
  - Description: Ingress resource configuration
  - Dependencies: GetIngresses
  
- [ ] **1.1.10** Create `frontend/src/config/resourceConfigs/pvConfig.js`
  - Description: PersistentVolume resource configuration
  - Dependencies: GetPersistentVolumes
  - Note: Cluster-scoped resource
  
- [ ] **1.1.11** Create `frontend/src/config/resourceConfigs/pvcConfig.js`
  - Description: PersistentVolumeClaim resource configuration
  - Dependencies: GetPersistentVolumeClaims

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

- [ ] **1.2.4** Create `frontend/src/config/resourceConfigs/swarm/networkConfig.js`
  - Description: Swarm Network resource configuration
  - Dependencies: GetSwarmNetworks

- [ ] **1.2.5** Create `frontend/src/config/resourceConfigs/swarm/configConfig.js`
  - Description: Swarm Config resource configuration
  - Dependencies: GetSwarmConfigs

- [ ] **1.2.6** Create `frontend/src/config/resourceConfigs/swarm/secretConfig.js`
  - Description: Swarm Secret resource configuration
  - Dependencies: GetSwarmSecrets

- [ ] **1.2.7** Create `frontend/src/config/resourceConfigs/swarm/volumeConfig.js`
  - Description: Swarm Volume resource configuration
  - Dependencies: GetSwarmVolumes

- [ ] **1.2.8** Create `frontend/src/config/resourceConfigs/swarm/stackConfig.js`
  - Description: Swarm Stack resource configuration
  - Dependencies: GetSwarmStacks

- [ ] **1.2.9** Update `frontend/src/config/resourceConfigs/index.js`
  - Description: Add barrel exports for all new configs

#### 1.3 Migrate K8s OverviewTable Components

Migrate each component to use GenericResourceTable with corresponding config.
Each migration reduces ~400-500 lines to ~20-50 lines.

- [ ] **1.3.1** Migrate `PodOverviewTable.jsx` (1,218 lines → ~100 lines)
  - Location: `frontend/src/k8s/resources/pods/`
  - Complexity: HIGH - port forwarding, shell access, files tab
  - Create: `PodPanelContent.jsx`, `PodRowActions.jsx`

- [ ] **1.3.2** Migrate `ServicesOverviewTable.jsx` (418 lines → ~50 lines)
  - Location: `frontend/src/k8s/resources/services/`
  - Complexity: MEDIUM - endpoints, external access

- [ ] **1.3.3** Migrate `DaemonSetsOverviewTable.jsx` (~400 lines → ~30 lines)
  - Location: `frontend/src/k8s/resources/daemonsets/`
  - Complexity: LOW

- [ ] **1.3.4** Migrate `ReplicaSetsOverviewTable.jsx` (~350 lines → ~30 lines)
  - Location: `frontend/src/k8s/resources/replicasets/`
  - Complexity: LOW

- [ ] **1.3.5** Migrate `JobsOverviewTable.jsx` (~400 lines → ~30 lines)
  - Location: `frontend/src/k8s/resources/jobs/`
  - Complexity: LOW

- [ ] **1.3.6** Migrate `CronJobsOverviewTable.jsx` (~450 lines → ~40 lines)
  - Location: `frontend/src/k8s/resources/cronjobs/`
  - Complexity: MEDIUM - create job action

- [ ] **1.3.7** Migrate `ConfigMapsOverviewTable.jsx` (~300 lines → ~25 lines)
  - Location: `frontend/src/k8s/resources/configmaps/`
  - Complexity: LOW

- [ ] **1.3.8** Migrate `SecretsOverviewTable.jsx` (~300 lines → ~25 lines)
  - Location: `frontend/src/k8s/resources/secrets/`
  - Complexity: LOW

- [ ] **1.3.9** Migrate `IngressesOverviewTable.jsx` (~300 lines → ~25 lines)
  - Location: `frontend/src/k8s/resources/ingresses/`
  - Complexity: LOW

- [ ] **1.3.10** Migrate `PersistentVolumesOverviewTable.jsx` (~300 lines → ~25 lines)
  - Location: `frontend/src/k8s/resources/persistentvolumes/`
  - Complexity: LOW - cluster-scoped

- [ ] **1.3.11** Migrate `PersistentVolumeClaimsOverviewTable.jsx` (~300 lines → ~25 lines)
  - Location: `frontend/src/k8s/resources/persistentvolumeclaims/`
  - Complexity: LOW

- [ ] **1.3.12** Replace `DeploymentsOverviewTable.jsx` with `DeploymentsOverviewTableGeneric.jsx`
  - Location: `frontend/src/k8s/resources/deployments/`
  - Note: Generic version already exists, just rename and remove old version

- [ ] **1.3.13** Migrate `StatefulSetsOverviewTable.jsx`
  - Location: `frontend/src/k8s/resources/statefulsets/`
  - Note: Config exists, need to create generic version

#### 1.4 Migrate Swarm OverviewTable Components

- [ ] **1.4.1** Migrate `SwarmServicesOverviewTable.jsx` (866 lines → ~60 lines)
  - Location: `frontend/src/docker/resources/services/`
  - Complexity: HIGH - image updates, scaling

- [ ] **1.4.2** Migrate `SwarmTasksOverviewTable.jsx` (817 lines → ~40 lines)
  - Location: `frontend/src/docker/resources/tasks/`
  - Complexity: MEDIUM

- [ ] **1.4.3** Migrate `SwarmNodesOverviewTable.jsx` (855 lines → ~40 lines)
  - Location: `frontend/src/docker/resources/nodes/`
  - Complexity: MEDIUM

- [ ] **1.4.4** Migrate `SwarmStacksOverviewTable.jsx` (764 lines → ~50 lines)
  - Location: `frontend/src/docker/resources/stacks/`
  - Complexity: HIGH - update stack, compose files

- [ ] **1.4.5** Migrate `SwarmNetworksOverviewTable.jsx` (~400 lines → ~30 lines)
  - Location: `frontend/src/docker/resources/networks/`
  - Complexity: LOW

- [ ] **1.4.6** Migrate `SwarmConfigsOverviewTable.jsx` (~400 lines → ~30 lines)
  - Location: `frontend/src/docker/resources/configs/`
  - Complexity: LOW

- [ ] **1.4.7** Migrate `SwarmSecretsOverviewTable.jsx` (~400 lines → ~30 lines)
  - Location: `frontend/src/docker/resources/secrets/`
  - Complexity: LOW

- [ ] **1.4.8** Migrate `SwarmVolumesOverviewTable.jsx` (~400 lines → ~30 lines)
  - Location: `frontend/src/docker/resources/volumes/`
  - Complexity: LOW

---

### PHASE 2: Modal Migration (Medium Impact)

**Priority**: HIGH  
**Estimated Savings**: 250-350 lines  
**Effort**: 0.5 days

Migrate remaining modals to use BaseModal component.

- [ ] **2.1** Migrate `CreateManifestOverlay.jsx`
  - Location: `frontend/src/CreateManifestOverlay.jsx`
  - Current: Uses inline styles for overlay
  - Target: Use BaseModal with custom width

- [ ] **2.2** Migrate `AddKubeConfigOverlay.jsx`
  - Location: `frontend/src/layout/connection/AddKubeConfigOverlay.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal

- [ ] **2.3** Migrate `AddSwarmConnectionOverlay.jsx`
  - Location: `frontend/src/layout/connection/AddSwarmConnectionOverlay.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal

- [ ] **2.4** Migrate `ConnectionProxySettings.jsx`
  - Location: `frontend/src/layout/connection/ConnectionProxySettings.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal

- [ ] **2.5** Migrate `HolmesConfigModal.jsx`
  - Location: `frontend/src/holmes/HolmesConfigModal.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal

- [ ] **2.6** Migrate `CreateJobModal.jsx`
  - Location: `frontend/src/k8s/resources/cronjobs/CreateJobModal.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal

- [ ] **2.7** Migrate `PortForwardModal.jsx`
  - Location: `frontend/src/k8s/resources/pods/PortForwardModal.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal

- [ ] **2.8** Migrate K8s `DeleteConfirmModal.jsx`
  - Location: `frontend/src/k8s/DeleteConfirmModal.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal with danger variant

- [ ] **2.9** Migrate Docker `DeleteConfirmModal.jsx`
  - Location: `frontend/src/docker/DeleteConfirmModal.jsx`
  - Current: Uses inline styles
  - Target: Use BaseModal with danger variant

---

### PHASE 3: CSS Consolidation (Low-Medium Impact)

**Priority**: MEDIUM  
**Estimated Savings**: 500-800 lines  
**Effort**: 1 day

Create shared CSS modules to eliminate duplicated styles.

- [ ] **3.1** Create shared CSS directory structure
  - Create: `frontend/src/styles/shared/`
  
- [ ] **3.2** Create `frontend/src/styles/shared/buttons.css`
  - Description: Consolidate `.create-button`, `.action-button`, `.danger-button` variants
  - Extract from: Multiple component CSS files

- [ ] **3.3** Create `frontend/src/styles/shared/panels.css`
  - Description: Consolidate `.bottom-panel`, `.panel-header`, `.panel-content` styles
  - Extract from: OverviewTable CSS files

- [ ] **3.4** Create `frontend/src/styles/shared/menus.css`
  - Description: Consolidate context menu styles (~30 lines repeated in 20+ components)
  - Extract from: OverviewTable components with inline context menu styles

- [ ] **3.5** Create `frontend/src/styles/shared/messages.css`
  - Description: Consolidate `.error-message`, `.warning-message`, `.info-message` styles
  - Extract from: Multiple CSS files with duplicated message styles

- [ ] **3.6** Create `frontend/src/styles/shared/tables.css`
  - Description: Consolidate `.panel-table`, `.table-header`, `.table-row` styles
  - Extract from: Panel and table CSS files

- [ ] **3.7** Create `frontend/src/styles/shared/index.css`
  - Description: Barrel import for all shared modules
  - Import in: `frontend/src/App.css` or `frontend/src/index.css`

- [ ] **3.8** Update component CSS files to import shared modules
  - Description: Replace duplicated styles with imports
  - Files: All component CSS files using the consolidated patterns

---

### PHASE 4: State Context Refactoring (Medium Impact)

**Priority**: MEDIUM  
**Estimated Savings**: 200-300 lines  
**Effort**: 1 day

Create context factory to reduce duplication between ClusterStateContext and SwarmStateContext.

- [ ] **4.1** Create `frontend/src/state/createResourceContext.js`
  - Description: Factory function for creating resource contexts
  - Features:
    - Shared reducer pattern (`SET_LOADING`, `SET_CONNECTION_STATUS`, etc.)
    - Dynamic `SET_*` handling
    - Configurable refresh functions
    - Error handling patterns

- [ ] **4.2** Refactor `ClusterStateContext.jsx`
  - Location: `frontend/src/state/ClusterStateContext.jsx`
  - Current: 464 lines
  - Target: ~150-200 lines using context factory

- [ ] **4.3** Refactor `SwarmStateContext.jsx`
  - Location: `frontend/src/state/SwarmStateContext.jsx`
  - Current: 638 lines
  - Target: ~200-250 lines using context factory

- [ ] **4.4** Add tests for context factory
  - Create: `frontend/src/__tests__/createResourceContext.test.js`

---

### PHASE 5: CodeMirror Lazy Loading (Bundle Optimization)

**Priority**: MEDIUM  
**Estimated Savings**: 50-80 KB gzipped on initial load  
**Effort**: 0.5 days

Create lazy loading wrapper for CodeMirror to reduce initial bundle size.

- [ ] **5.1** Create `frontend/src/components/CodeMirrorEditor/index.jsx`
  - Description: Lazy wrapper using React.lazy and Suspense
  - Features:
    - Loading fallback component
    - Dynamic import of CodeMirror core

- [ ] **5.2** Create `frontend/src/components/CodeMirrorEditor/CodeMirrorCore.jsx`
  - Description: Actual CodeMirror implementation
  - Contains: All @codemirror/* imports
  - Note: This file only loads when editor is needed

- [ ] **5.3** Create `frontend/src/components/CodeMirrorEditor/EditorLoading.jsx`
  - Description: Loading placeholder component
  - Features: Skeleton or spinner matching editor dimensions

- [ ] **5.4** Update components to use lazy CodeMirror wrapper
  - Files to modify:
    - `frontend/src/layout/bottompanel/LogViewerTab.jsx`
    - `frontend/src/layout/bottompanel/TextEditorTab.jsx`
    - `frontend/src/layout/bottompanel/TextViewerTab.jsx`
    - `frontend/src/layout/bottompanel/YamlTab.jsx`
    - `frontend/src/layout/bottompanel/FilesTab.jsx`
    - `frontend/src/k8s/resources/pods/PodFilesTab.jsx`
    - `frontend/src/CreateManifestOverlay.jsx`

- [ ] **5.5** Add tests for lazy CodeMirror wrapper
  - Create: `frontend/src/__tests__/CodeMirrorEditor.test.jsx`

---

### PHASE 6: Additional Go Backend Work (Optional)

**Priority**: LOW  
**Estimated Savings**: 400-550 lines  
**Effort**: 1.5 days

These items provide additional consolidation but are lower priority.

- [ ] **6.1** Create Docker handler factory
  - Create: `pkg/app/docker/resource_handler.go`
  - Description: Generic `ListAndConvert[T, InfoT]` function
  - Apply to: configs.go, secrets.go, volumes.go, services.go, tasks.go, nodes.go, networks.go

- [ ] **6.2** Consolidate Holmes context builders
  - Create: `pkg/app/holmes_context_builder.go`
  - Description: Generic context builder with resource-specific adapters
  - Apply to: `pkg/app/holmes_context.go` functions

- [ ] **6.3** Migrate remaining Go files to use polling.go
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
- **BaseModal** pattern proven with 8 successful migrations
- **GenericInspectTab** 100% complete (all 4 InspectTabs migrated)
- Consider creating E2E tests for each migrated component before migration
- Use feature flags if needed for gradual rollout of migrated components
