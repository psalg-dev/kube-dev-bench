# TypeScript/TSX Migration - Implementation Checklist

## Overview

- **Scope**: ~238 source files, 142 test files
- **Total Estimated Effort**: 70-104 hours
- **Approach**: Incremental bottom-up migration
- **Key Advantage**: Wails already generates `App.d.ts` (754 lines) and `models.ts` (4003 lines)

---

## Phase 1: TypeScript Infrastructure (2-4 hours)

### Setup

- [x] Install dependencies
  ```bash
  cd frontend && npm install --save-dev typescript @types/react @types/react-dom @types/node typescript-eslint
  ```

- [x] Create `frontend/tsconfig.json`
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "module": "ESNext",
      "moduleResolution": "bundler",
      "jsx": "react-jsx",
      "strict": true,
      "noEmit": true,
      "skipLibCheck": true,
      "esModuleInterop": true,
      "allowSyntheticDefaultImports": true,
      "resolveJsonModule": true,
      "isolatedModules": true,
      "allowJs": true,
      "checkJs": false,
      "baseUrl": ".",
      "paths": {
        "@wails/*": ["./wailsjs/*"]
      }
    },
    "include": ["src/**/*", "wailsjs/**/*"],
    "exclude": ["node_modules", "dist"]
  }
  ```

- [x] Update `frontend/eslint.config.js` - Add TypeScript support
  - Add `typescript-eslint` plugin
  - Extend file patterns to `.ts`, `.tsx`

- [x] Add script to `frontend/package.json`
  ```json
  "typecheck": "tsc --noEmit"
  ```

### Verification

- [x] `npm run typecheck` completes (warnings OK initially)
- [ ] `npm run dev` works unchanged
- [ ] `npm test` passes

---

## Phase 2: Type Foundation Layer (4-6 hours)

### Type Definitions

- [x] Create `frontend/src/types/index.ts` - Central type exports
- [x] Create `frontend/src/types/wails.ts` - Re-export Wails types
- [x] Create `frontend/src/types/contexts.ts` - State/action types
  - [x] `ClusterState` interface
  - [x] `ClusterAction` discriminated union
  - [x] `SwarmState` interface
  - [x] `SwarmAction` discriminated union
  - [x] `ConnectionsState` interface
  - [x] `ConnectionsAction` discriminated union
- [x] Create `frontend/src/types/components.ts` - Common prop types
  - [x] `BaseTableColumn` interface
  - [x] `TabDefinition` interface
- [x] Create `frontend/src/types/resourceConfigs.ts` - Resource config types

### Service Layer Migration

- [x] `frontend/src/k8s/resources/kubeApi.js` → `kubeApi.ts` (ts added; .js removed)
- [x] `frontend/src/docker/swarmApi.js` → `swarmApi.ts` (ts added; .js removed)

### Verification

- [x] `npm run typecheck` passes
- [ ] Existing JS files can import from new TS files

---

## Phase 3: Utilities & Hooks (6-8 hours)

### Utilities (Low Risk)

- [x] `frontend/src/utils/timeUtils.js` → `timeUtils.ts` (ts added; .js removed)
- [x] `frontend/src/utils/dateUtils.js` → `dateUtils.ts` (ts added; .js removed)
- [x] `frontend/src/utils/resourceNavigation.js` → `resourceNavigation.ts` (ts added; .js removed)
- [ ] `frontend/src/utils/filterUtils.js` → `filterUtils.ts` (file not present)
- [x] `frontend/src/utils/persistence.js` → `persistence.ts` (ts added; .js removed)
- [x] `frontend/src/utils/logger.js` → `logger.ts` (ts added; .js removed)
- [x] `frontend/src/utils/codeMirrorLanguage.js` → `codeMirrorLanguage.ts` (ts added; .js removed)
- [x] `frontend/src/utils/swarmYamlUtils.js` → `swarmYamlUtils.ts` (ts added; .js removed)
- [x] `frontend/src/utils/tableSorting.js` → `tableSorting.ts` (ts added; .js removed)
- [x] `frontend/src/constants/emptyTabMessages.js` → `emptyTabMessages.ts` (ts added; .js removed)
- [x] `frontend/src/constants/bulkActions.js` → `bulkActions.ts` (ts added; .js removed)
- [x] `frontend/src/api/tabCounts.js` → `tabCounts.ts` (ts added; .js removed)
- [x] `frontend/src/api/bulkOperations.js` → `bulkOperations.ts` (ts added; .js removed)
- [x] `frontend/src/config/manifestTemplates.js` → `manifestTemplates.ts` (ts added; .js removed)
- [x] `frontend/src/notification.js` → `notification.ts` (ts added; .js removed)
- [x] `frontend/src/main.js` → `main.ts` (ts added; .js removed)
- [x] `frontend/src/main-content.js` → `main-content.ts` (ts added; .js removed)
- [x] `frontend/src/resource-overlay.js` → `resource-overlay.ts` (ts added; .js removed)
- [x] `frontend/src/layout/monitorApi.js` → `monitorApi.ts` (ts added; .js removed)
- [x] `frontend/src/config/resourceConfigs/index.js` → `index.ts` (ts added; .js removed)
- [x] `frontend/src/config/resourceConfigs/swarm/index.js` → `index.ts` (ts added; .js removed)

### Hooks (Order by Complexity)

- [x] `frontend/src/hooks/useAsyncData.js` → `useAsyncData.ts` (ts added; .js removed)
- [x] `frontend/src/hooks/useTableSelection.js` → `useTableSelection.ts` (ts added; .js removed)
- [x] `frontend/src/hooks/useEventSubscription.js` → `useEventSubscription.ts` (ts added; .js removed)
- [x] `frontend/src/hooks/useResourceData.js` → `useResourceData.ts` (202 lines, critical; .js removed)
- [x] `frontend/src/hooks/useHolmesAnalysis.js` → `useHolmesAnalysis.ts` (283 lines, complex; .js removed)
- [x] `frontend/src/hooks/useSwarmServiceForm.js` → `useSwarmServiceForm.ts` (ts added; .js removed)

### Verification

- [x] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] Hook consumers work unchanged

---

## Phase 4: State Contexts (8-12 hours)

### Context Files

- [x] `frontend/src/state/ClusterStateContext.jsx` → `ClusterStateContext.tsx` (256 lines; .jsx still present)
- [x] `frontend/src/docker/SwarmStateContext.jsx` → `SwarmStateContext.tsx` (432 lines; .jsx still present)
- [x] `frontend/src/layout/connection/ConnectionsStateContext.jsx` → `ConnectionsStateContext.tsx` (639 lines; .jsx still present)
- [x] `frontend/src/docker/SwarmResourceCountsContext.jsx` → `SwarmResourceCountsContext.tsx` (.jsx still present)
- [x] `frontend/src/holmes/HolmesContext.jsx` → `HolmesContext.tsx` (.jsx still present)

### Verification

- [x] `npm run typecheck` passes
- [ ] Context consumers work without changes
- [ ] `npm test` passes

---

## Phase 5: Component Factory & Configs (10-14 hours)

### Critical Component

- [x] `frontend/src/components/GenericResourceTable/index.jsx` → `index.tsx` (tsx added; .jsx still present)

### Resource Configs - Batch A (K8s Core)

- [x] `frontend/src/config/resourceConfigs/deploymentConfig.jsx` → `.tsx`
- [x] `frontend/src/config/resourceConfigs/podConfig.jsx` → `.tsx`
- [x] `frontend/src/config/resourceConfigs/serviceConfig.jsx` → `.tsx`
- [x] `frontend/src/config/resourceConfigs/configmapConfig.jsx` → `.tsx`
- [x] `frontend/src/config/resourceConfigs/secretConfig.jsx` → `.tsx`

### Resource Configs - Batch B (K8s Workloads)

- [x] `statefulsetConfig.jsx` → `.tsx`
- [x] `daemonsetConfig.jsx` → `.tsx`
- [x] `replicasetConfig.jsx` → `.tsx`
- [x] `cronjobConfig.jsx` → `.tsx`
- [x] `jobConfig.jsx` → `.tsx`

### Resource Configs - Batch C (K8s Storage/Network)

- [x] `pvConfig.jsx` → `.tsx`
- [x] `pvcConfig.jsx` → `.tsx`
- [x] `ingressConfig.jsx` → `.tsx`

### Resource Configs - Batch D (Docker Swarm)

- [x] All Swarm config files in `frontend/src/docker/resources/*/` (.tsx present; `resourceConfigs/index.js` and `resourceConfigs/swarm/index.js` still JS)

### Verification

- [x] `npm run typecheck` passes
- [ ] Resource tables render correctly
- [ ] `npm test` passes
- [x] Resource config typing fixes (QuickInfoField arrays + default imports)

---

## Phase 6: UI Components (16-24 hours)

### Shared Components (`frontend/src/components/`)

- [x] `StatusBadge.jsx` → `.tsx`
- [x] `EmptyState.jsx` → `.tsx`
- [x] `EmptyTabContent.jsx` → `.tsx`
- [x] `ResourceActions.jsx` → `.tsx`
- [x] `ResourceEventsTab.jsx` → `.tsx`
- [x] `ResourcePodsTab.jsx` → `.tsx`
- [x] `AggregateLogsTab.jsx` → `.tsx`
- [x] `GenericInspectTab.jsx` → `.tsx`
- [x] `BulkActionBar.jsx` → `.tsx`
- [x] `TabLabel.jsx` → `.tsx`
- [x] `BaseModal/index.jsx` → `index.tsx`

### Form Components (`frontend/src/components/forms/`)

- [x] `FormField.jsx` → `.tsx`
- [x] `TextField.jsx` → `.tsx`
- [x] `NumberField.jsx` → `.tsx`
- [x] `SelectField.jsx` → `.tsx`
- [x] `KeyValueEditor.jsx` → `.tsx`
- [x] `PortMappingEditor.jsx` → `.tsx`
- [x] `CollapsibleSection.jsx` → `.tsx`
- [x] `ViewToggle.jsx` → `.tsx`
- [x] `ServiceForm.jsx` → `.tsx`

### Layout Components (`frontend/src/layout/`)

- [x] `AppLayout.jsx` → `.tsx`
- [x] `AppContainer.jsx` → `.tsx`
- [x] `SidebarSections.jsx` → `.tsx`
- [x] `FooterBar.jsx` → `.tsx`
- [x] `overview/OverviewTableWithPanel.jsx` → `.tsx`
- [x] `CreateManifestOverlay.jsx` → `.tsx`
- [x] `MonitorPanel.jsx` → `.tsx`
- [x] `MonitorIssueCard.jsx` → `.tsx`
- [x] `MonitorModal.jsx` → `.tsx`
- [x] `PrometheusAlertsTab.jsx` → `.tsx`

### Bottom Panel (`frontend/src/layout/bottompanel/`)

- [x] `BottomPanel.jsx` → `.tsx`
- [x] `YamlTab.jsx` → `.tsx`
- [x] `LogViewerTab.jsx` → `.tsx`
- [x] `ConsoleTab.jsx` → `.tsx`
- [x] `TerminalTab.jsx` → `.tsx`
- [x] `FilesTab.jsx` → `.tsx`
- [x] `TextEditorTab.jsx` → `.tsx`
- [x] `TextViewerTab.jsx` → `.tsx`
- [x] `SummaryTabHeader.jsx` → `.tsx`

### Connection Components (`frontend/src/layout/connection/`)

- [x] `ConnectionWizard.jsx` → `.tsx`
- [x] `ConnectionsSidebar.jsx` → `.tsx`
- [x] `ConnectionsMainView.jsx` → `.tsx`
- [x] `KubernetesConnectionsList.jsx` → `.tsx`
- [x] `DockerSwarmConnectionsList.jsx` → `.tsx`
- [x] `AddKubeConfigOverlay.jsx` → `.tsx`
- [x] `AddSwarmConnectionOverlay.jsx` → `.tsx`
- [x] `ConnectionProxySettings.jsx` → `.tsx`
- [x] `ConnectionHooksSettings.jsx` → `.tsx`

### Verification

- [ ] `npm run typecheck` passes
- [ ] Visual testing (manual or automated)
- [ ] `npm test` passes

---

## Phase 7: Feature Domains (12-16 hours)

### Kubernetes (`frontend/src/k8s/`)

- [x] Resource-specific components and tabs
- [x] Overview tables

### Docker Swarm (`frontend/src/docker/`)

- [x] `SwarmConnectionWizard.jsx` → `.tsx`
- [x] `SwarmSidebarSections.jsx` → `.tsx`
- [x] `metrics/MetricsChart.jsx` → `.tsx`
- [x] `metrics/TimeRangeSelector.jsx` → `.tsx`
- [x] `metrics/MetricsStateContext.jsx` → `.tsx`
- [x] `metrics/SwarmMetricsDashboard.jsx` → `.tsx`
- [x] `registry/AddRegistryModal.jsx` → `.tsx`
- [x] `registry/RegistryBrowser.jsx` → `.tsx`
- [x] `registry/SwarmRegistriesOverview.jsx` → `.tsx`
- [x] `topology/TopologyView.jsx` → `.tsx`
- [x] Resource components in `resources/`
  - [x] `resources/SwarmEventsTab.jsx` → `.tsx`
  - [x] `resources/SwarmResourceActions.jsx` → `.tsx`
  - [x] `resources/tasks/HealthStatusBadge.jsx` → `.tsx`
  - [x] `resources/tasks/TaskSummaryPanel.jsx` → `.tsx`
  - [x] `resources/nodes/NodeLabelsTab.jsx` → `.tsx`
  - [x] `resources/nodes/NodeLogsTab.jsx` → `.tsx`
  - [x] `resources/nodes/NodeTasksTab.jsx` → `.tsx`
  - [x] `resources/nodes/NodeSummaryPanel.jsx` → `.tsx`
  - [x] `resources/networks/NetworkDetailsSections.jsx` → `.tsx`

### Holmes AI (`frontend/src/holmes/`)

- [x] `holmesApi.js` → `holmesApi.ts`
- [x] `HolmesPanel.jsx` → `.tsx`
- [x] `HolmesBottomPanel.jsx` → `.tsx`
- [x] `HolmesResponseRenderer.jsx` → `.tsx`
- [x] `HolmesConfigModal.jsx` → `.tsx`
- [x] `HolmesOnboardingWizard.jsx` → `.tsx`

### Verification

- [ ] `npm run typecheck` passes
- [ ] Feature-specific E2E tests pass
- [ ] Manual testing of complex workflows

---

## Phase 8: Test Migration (8-12 hours)

### Test Infrastructure

- [x] `frontend/src/__tests__/wailsMocks.js` → `wailsMocks.ts`
- [x] `frontend/vitest.config.js` → `vitest.config.ts` (optional)

### Test Files

- [x] `clusterStateReducer.test.js` → `.ts`
- [x] `swarmStateContext.test.jsx` → `.tsx`
- [x] Component tests (migrate alongside implementations)
  - [x] `addRegistryModal.test.jsx` → `.tsx`
  - [x] `aggregateLogsTab.test.jsx` → `.tsx`
  - [x] `appContainer.resourceSwitch.test.jsx` → `.tsx`
  - [x] `BaseModal.test.jsx` → `.tsx`
  - [x] `bottomPanel.test.jsx` → `.tsx`
  - [x] `clusterStateProvider.test.jsx` → `.tsx`
  - [x] `cronJobActionsTab.test.jsx` → `.tsx`
  - [x] `cronJobHistoryTab.test.jsx` → `.tsx`
  - [x] `cronJobNextRunsTab.test.jsx` → `.tsx`
  - [x] `createManifestOverlay.test.jsx` → `.tsx`
  - [x] `consoleTab.test.jsx` → `.tsx`
  - [x] `connectionWizard.test.jsx` → `.tsx`
  - [x] `configCompareModal.test.jsx` → `.tsx`
  - [x] `configDataSection.test.jsx` → `.tsx`
  - [x] `configEditModal.test.jsx` → `.tsx`
  - [x] `configMapDataTab.test.jsx` → `.tsx`
  - [x] `configMapYamlTab.test.jsx` → `.tsx`
  - [x] `configUsedBySection.test.jsx` → `.tsx`
  - [x] `emptyState.test.jsx` → `.tsx`
  - [x] `emptyTabContent.test.jsx` → `.tsx`
  - [x] `keyValueEditor.test.jsx` → `.tsx`
  - [x] `numberField.test.jsx` → `.tsx`
  - [x] `selectField.test.jsx` → `.tsx`
  - [x] `statusBadge.test.jsx` → `.tsx`
  - [x] `tabLabel.test.jsx` → `.tsx`
  - [x] `textField.test.jsx` → `.tsx`
  - [x] `viewToggle.test.jsx` → `.tsx`
  - [x] `collapsibleSection.test.jsx` → `.tsx`
  - [x] `dropdowns.test.jsx` → `.tsx`
  - [x] `healthStatusBadge.test.jsx` → `.tsx`
  - [x] `quickInfoSection.test.jsx` → `.tsx`
  - [x] `resourceEventsTab.test.jsx` → `.tsx`
  - [x] `resourcePodsTab.test.jsx` → `.tsx`
  - [x] `yamlTab.test.jsx` → `.tsx`
  - [x] `ingressRulesTab.test.jsx` → `.tsx`
  - [x] `jobPodsTab.test.jsx` → `.tsx`
  - [x] `podOverviewEntry.test.jsx` → `.tsx`
  - [x] `pods/PodSummaryTab.test.jsx` → `.tsx`
  - [x] `pods/PodFilesTab.test.jsx` → `.tsx`
  - [x] `replicaSetOwnerTab.test.jsx` → `.tsx`
  - [x] `resourceCountsContext.test.jsx` → `.tsx`
  - [x] `resourceActions.test.jsx` → `.tsx`
  - [x] `connectionHooksSettings.test.jsx` → `.tsx`
  - [x] `imageUpdateSettingsModal.test.jsx` → `.tsx`
  - [x] `settingsContext.test.jsx` → `.tsx`
  - [x] `monitorFeature.test.jsx` → `.tsx`
  - [x] `monitorModal.test.jsx` → `.tsx`
  - [x] `logViewerHolmes.test.jsx` → `.tsx`
  - [x] `nodeLogsTab.test.jsx` → `.tsx`
  - [x] `nodeLabelsTab.test.jsx` → `.tsx`
  - [x] `nodeTasksTab.test.jsx` → `.tsx`
  - [x] `networkDetailsSections.test.jsx` → `.tsx`
  - [x] `networkConnectedContainersSection.test.jsx` → `.tsx`
  - [x] `networkConnectedServicesSection.test.jsx` → `.tsx`
  - [x] `secretUsedBySection.test.jsx` → `.tsx`
  - [x] `secretEditModal.test.jsx` → `.tsx`
  - [x] `secretDataTab.test.jsx` → `.tsx`
  - [x] `secretDataSection.test.jsx` → `.tsx`
  - [x] `secretCloneModal.test.jsx` → `.tsx`
  - [x] `serviceTasksTab.test.jsx` → `.tsx`
  - [x] `serviceEndpointsTab.test.jsx` → `.tsx`
  - [x] `statefulSetPVCsTab.test.jsx` → `.tsx`
  - [x] `volumeUsedBySection.test.jsx` → `.tsx`
  - [x] `volumeInspectTab.test.jsx` → `.tsx`
  - [x] `volumeFilesTab.test.jsx` → `.tsx`
  - [x] `updateServiceImageModal.test.jsx` → `.tsx`
  - [x] `updateStackModal.test.jsx` → `.tsx`
  - [x] `stackComposeTab.test.jsx` → `.tsx`
  - [x] `GenericInspectTab.test.jsx` → `.tsx`
  - [x] `helmReleases.test.jsx` → `.tsx`
  - [x] `registryBrowser.test.jsx` → `.tsx`
  - [x] `router.test.jsx` → `.tsx`
  - [x] `topologyView.test.jsx` → `.tsx`
  - [x] `swarmResourceActions.test.jsx` → `.tsx`
  - [x] `swarmOverview.test.jsx` → `.tsx`
  - [x] `swarmRegistriesOverview.test.jsx` → `.tsx`
  - [x] `swarmNodesOverviewTable.test.jsx` → `.tsx`
  - [x] `swarmNetworksOverviewTable.test.jsx` → `.tsx`
  - [x] `swarmNetworkInspectTab.test.jsx` → `.tsx`
  - [x] `swarmMetricsStateContext.test.jsx` → `.tsx`
  - [x] `swarmMetricsDashboard.test.jsx` → `.tsx`
  - [x] `swarmEventsTab.test.jsx` → `.tsx`
  - [x] `swarmConnectionWizard.test.jsx` → `.tsx`
  - [x] `swarmConfigsOverviewTable.test.jsx` → `.tsx`
  - [x] `swarmConfigInspectTab.test.jsx` → `.tsx`
  - [x] `swarmConfigDataTab.test.jsx` → `.tsx`
  - [x] `swarmStacksOverviewTable.test.jsx` → `.tsx`
  - [x] `swarmSidebarSections.test.jsx` → `.tsx`
  - [x] `swarmVolumesOverviewTable.test.jsx` → `.tsx`
  - [x] `swarmTasksOverviewTable.test.jsx` → `.tsx`
  - [x] `swarmServicesOverviewTable.test.jsx` → `.tsx`
  - [x] `swarmSecretsOverviewTable.test.jsx` → `.tsx`
  - [x] `swarmSecretInspectTab.test.jsx` → `.tsx`
  - [x] `swarmResourceCountsContext.test.jsx` → `.tsx`
  - [x] `holmesPanel.test.jsx` → `.tsx`
  - [x] `holmesBottomPanel.test.jsx` → `.tsx`
  - [x] `holmesContext.test.jsx` → `.tsx`
  - [x] `holmesConfigModal.test.jsx` → `.tsx`
  - [x] `holmesOnboardingWizard.test.jsx` → `.tsx`
  - [x] `holmesResponseRenderer.test.jsx` → `.tsx`
  - [x] `imageUpdateBadge.test.jsx` → `.tsx`
  - [x] `imageUpdateModal.test.jsx` → `.tsx`
  - [x] `cronJobYamlTab.test.jsx` → `.tsx`
  - [x] `jobYamlTab.test.jsx` → `.tsx`
  - [x] `ingressYamlTab.test.jsx` → `.tsx`
  - [x] `podYamlTab.test.jsx` → `.tsx`
  - [x] `pvYamlTab.test.jsx` → `.tsx`
  - [x] `pvcYamlTab.test.jsx` → `.tsx`
  - [x] `serviceYamlTab.test.jsx` → `.tsx`
  - [x] `secretYamlTab.test.jsx` → `.tsx`
  - [x] `deploymentPodsTab.test.jsx` → `.tsx`
  - [x] `deploymentRolloutTab.test.jsx` → `.tsx`
  - [x] `daemonSetNodeCoverageTab.test.jsx` → `.tsx`
  - [x] `podMountsTab.test.jsx` → `.tsx`
  - [x] `pvcBoundPVTab.test.jsx` → `.tsx`
  - [x] `pvCapacityUsageTab.test.jsx` → `.tsx`
  - [x] `pvBoundPVCTab.test.jsx` → `.tsx`
  - [x] `pvAnnotationsTab.test.jsx` → `.tsx`

### Verification

- [x] All tests pass with TypeScript
- [ ] Coverage maintained at 70%+

---

## Phase 9: Strict Mode & Cleanup (4-8 hours)

### Enable Strict Checks

- [x] Update `tsconfig.json` (strict already enabled; noImplicitAny/strictNullChecks covered by `strict`)
  ```json
  {
    "compilerOptions": {
      "strict": true
    }
  }
  ```

### Cleanup

- [x] Fix remaining `any` types
- [x] Remove `@ts-ignore` comments
- [ ] Delete legacy `.js` files after confirming `.ts` works (currently shimmed via re-export stubs; remove once all imports are normalized)
  - [x] Normalized core entry/layout imports to TSX (`main-content`, connection wizard, overview table, log viewer, quick info)
  - [x] Normalized many test imports/mocks to TSX components (swarm tables, holmes, bottom panel)
  - [x] Normalized K8s/Swarm resource JSX files to prefer TSX component imports (tables, tabs, summary panels)
  - [x] Removed remaining `.js`/`.jsx` import suffixes from runtime/test imports
  - [x] Convert TSX shim re-exports to real TSX modules, then remove `.jsx` targets
    - [x] Swarm nodes: tables/tabs/panels
    - [x] Swarm volumes: tables/tabs/panels
    - [x] Swarm services: overview table + image update modals/badges + tasks/summary/placement
    - [x] Swarm secrets: overview table + panels + modals + sections
    - [x] Swarm configs: overview table + panels + tabs + modals + sections
    - [x] Swarm networks: overview table + tabs + tables + sections
    - [x] Swarm stacks: overview table + tabs + modals + panels
    - [x] Swarm tasks: overview table + panels + holmes/logs tabs
    - [x] K8s configmaps: overview table + data/yaml/consumers tabs
    - [x] K8s secrets: overview table + data/yaml/consumers tabs
    - [x] K8s ingresses: overview table + detail tabs
    - [x] K8s replicasets: overview table + detail tab
    - [x] K8s statefulsets: overview table + detail tab
    - [x] K8s services: overview table + endpoints/yaml tabs
    - [x] K8s persistent volume claims: overview table + tabs
    - [x] K8s persistent volumes: overview table + tabs
    - [x] K8s pods: overview table + bottom panel/port-forward
    - [x] K8s pods: summary/yaml/events/files/mounts tabs + port-forward output
    - [x] K8s deployments: overview table + tabs
    - [x] K8s jobs: overview table + tabs
    - [x] K8s cronjobs: overview table + tabs
    - [x] K8s daemonsets: overview table + pods tab
    - [x] K8s Helm releases: overview table + tabs/dialogs/actions
    - [x] Remaining K8s/Docker resource shims
  - [x] Remove core layout/connection/bottompanel `.jsx` duplicates (TSX now source of truth)
  - [x] Remove shared component/state/holmes/swarm `.jsx` duplicates (TSX now source of truth)
  - [x] Remove remaining app/resource `.jsx` duplicates (K8s/Docker views, Holmes, overlays)
  - [x] Remove `.jsx` test duplicates that have `.tsx` equivalents
- [x] Update CLAUDE.md with TypeScript conventions

### Final Verification

- [ ] `npm run typecheck` passes with zero errors
- [x] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] E2E tests pass (`cd e2e && npx playwright test`)

---

## Phase 10: Fix Remaining TypeScript Errors (Current Status)

**Total Errors: 899** (as of analysis)
- Source files: 347 errors across 25+ files
- Test files: 552 errors across 86+ files
- Unique files with errors: 111

### Error Category Breakdown

| Error Code | Count | Description | Fix Strategy |
|------------|-------|-------------|--------------|
| TS2339 | 376 | Property does not exist | Add missing properties to types, type assertions, or extend interfaces |
| TS2345 | 118 | Argument type mismatch | Add null checks, type assertions, or update function signatures |
| TS2322 | 87 | Type assignment issues | Correct type mismatches or widen types |
| TS7006 | 76 | Parameter implicitly has 'any' | Add explicit parameter types |
| TS7031 | 68 | Binding element implicitly has 'any' | Type destructured parameters |
| TS2614 | 36 | Module has no exported member | Fix named vs default import issues |
| TS2740 | 32 | Type missing properties | Add missing properties or use Partial<T> |
| TS7019 | 31 | Rest param implicitly has 'any[]' | Type rest parameters explicitly |
| TS2741 | 19 | Property missing but required | Complete required properties |
| TS2739 | 11 | Type missing properties from type | Same as TS2740 |

### Step 1: Fix Import/Export Issues (TS2614 - 36 errors)

Named import vs default export mismatches in resource configs:

- [ ] `src/config/resourceConfigs/cronjobConfig.tsx` - Fix CronJob tab imports
- [ ] `src/config/resourceConfigs/daemonsetConfig.tsx` - Fix DaemonSet tab imports
- [ ] `src/config/resourceConfigs/deploymentConfig.tsx` - Fix Deployment tab imports
- [ ] `src/config/resourceConfigs/ingressConfig.tsx` - Fix Ingress tab imports
- [ ] `src/config/resourceConfigs/jobConfig.tsx` - Fix Job tab imports
- [ ] `src/config/resourceConfigs/podConfig.tsx` - Fix Pod tab imports
- [ ] `src/config/resourceConfigs/pvConfig.tsx` - Fix PV tab imports
- [ ] `src/config/resourceConfigs/pvcConfig.tsx` - Fix PVC tab imports

**Fix pattern**: Change `import { ComponentName } from './path'` to `import ComponentName from './path'`

### Step 2: Fix Docker Swarm Resource Types (196 source errors)

High-priority files with missing type annotations:

- [ ] `src/docker/resources/volumes/VolumeFilesTab.tsx` (68 errors)
  - Add types for file/directory objects
  - Type callback parameters in map/filter functions
  - Add SwarmVolumeFile interface
- [ ] `src/docker/resources/nodes/SwarmNodesOverviewTable.tsx` (66 errors)
  - Add types for node objects and task lists
  - Type formatBytes, formatNanoCPUs parameters
  - Add SwarmNode interface extensions
- [ ] `src/docker/resources/stacks/SwarmStacksOverviewTable.tsx` (62 errors)
  - Type stack objects and service lists
  - Add SwarmStack interface
- [ ] `src/docker/resources/configs/SwarmConfigsOverviewTable.tsx` (19 errors)
  - Type config objects
- [ ] `src/docker/resources/volumes/VolumeUsedBySection.tsx` (12 errors)
- [ ] `src/docker/resources/volumes/SwarmVolumesOverviewTable.tsx` (11 errors)
- [ ] `src/docker/resources/configs/ConfigCompareModal.tsx` (11 errors)
- [ ] `src/docker/resources/stacks/UpdateStackModal.tsx` (7 errors)
- [ ] `src/docker/resources/configs/ConfigDataTab.tsx` (6 errors)

### Step 3: Fix API Layer Types (16 errors)

- [ ] `src/api/bulkOperations.ts` - Add missing Wails API type declarations
  - Add types for RestartDeployment, RestartStatefulSet, RestartDaemonSet, etc.
  - Update restartHandlers object with proper index signature

### Step 4: Fix Resource Config Types (35 errors)

- [ ] `src/config/resourceConfigs/swarm/volumeConfig.tsx` (4 errors)
- [ ] `src/config/resourceConfigs/swarm/serviceConfig.tsx` (3 errors)
- [ ] `src/config/resourceConfigs/serviceConfig.tsx` (3 errors)
- [ ] `src/config/resourceConfigs/statefulsetConfig.tsx` (2 errors)
- [ ] `src/config/resourceConfigs/replicasetConfig.tsx` (2 errors)

### Step 5: Fix Test Mock Types (552 errors)

Test files need proper mock typing. Key patterns to fix:

#### 5a. Create Mock Type Utilities

- [ ] Update `src/__tests__/wailsMocks.ts`:
  - Add MockedFunction<T> type export
  - Create typed mock getters: `getAppMock<T>(name: string): MockedFunction<T>`
  - Add type assertions for mock methods

#### 5b. Fix Test File Categories

**Holmes Tests (45+ errors)**:
- [ ] `holmesConfigModal.test.tsx` - Add complete HolmesState mock factory
- [ ] `holmesOnboardingWizard.test.tsx` - Add complete HolmesState mock factory
- [ ] `holmesPanel.test.tsx` - Fix mock types
- [ ] `holmesBottomPanel.test.tsx` - Fix mock types
- [ ] `holmesContext.test.tsx` - Fix mock types

**Connection Tests (32 errors)**:
- [ ] `connectionWizard.test.tsx` - Type mock returns and DOM queries
- [ ] `clusterStateProvider.test.tsx` - Type Wails mock methods

**Config Tests (47+ errors)**:
- [ ] `configCompareModal.test.tsx` - Type mock methods
- [ ] `configDataSection.test.tsx` - Type mock methods
- [ ] `configEditModal.test.tsx` - Type mock methods
- [ ] `configMapDataTab.test.tsx` - Type mock methods

**Monitor Tests (23 errors)**:
- [ ] `monitorModal.test.tsx` - Type mock methods

**Helm Tests (18 errors)**:
- [ ] `helmReleases.test.tsx` - Type mock methods

**Deployment Tests (27 errors)**:
- [ ] `deploymentPodsTab.test.tsx` - Type mock methods
- [ ] `deploymentRolloutTab.test.tsx` - Type mock methods

**CronJob Tests (39 errors)**:
- [ ] `cronJobActionsTab.test.tsx` - Type mock methods
- [ ] `cronJobHistoryTab.test.tsx` - Type mock methods
- [ ] `cronJobNextRunsTab.test.tsx` - Type mock methods

**Swarm Tests (100+ errors)**:
- [ ] `swarmEventsTab.test.tsx` - Type mock methods
- [ ] `swarmNodesOverviewTable.test.tsx` - Type mock methods
- [ ] Various other swarm tests

### Step 6: Create Missing Type Definitions

Add to `src/types/`:

- [ ] `swarm.ts` - Swarm-specific types:
  ```typescript
  export interface SwarmVolumeFile {
    name: string;
    path: string;
    isDir: boolean;
    size?: number;
    modTime?: string;
  }

  export interface SwarmNodeResources {
    memoryBytes: number;
    nanoCPUs: number;
  }
  ```

- [ ] `testing.ts` - Test utility types:
  ```typescript
  import { Mock } from 'vitest';
  export type MockedFunction<T extends (...args: any[]) => any> = Mock<Parameters<T>, ReturnType<T>>;
  export type DeepPartial<T> = { [P in keyof T]?: DeepPartial<T[P]> };
  ```

### Recommended Execution Order

1. **Import fixes (TS2614)** - Quick wins, ~30 min
2. **Create type definitions** - Foundation for other fixes, ~1 hour
3. **API layer types** - Small file, high impact, ~30 min
4. **Docker Swarm components** - Largest impact, ~4-6 hours
   - Start with VolumeFilesTab.tsx (68 errors)
   - Then SwarmNodesOverviewTable.tsx (66 errors)
   - Then SwarmStacksOverviewTable.tsx (62 errors)
5. **Resource configs** - ~1 hour
6. **Test mock utilities** - Create once, use everywhere, ~1 hour
7. **Individual test fixes** - ~3-4 hours

### Verification Checkpoints

After each step:
- [ ] `npm run typecheck` shows reduced error count
- [ ] `npm test` passes
- [ ] No runtime regressions

---

## Critical Files Reference

| File | Lines | Priority | Notes |
|------|-------|----------|-------|
| `wailsjs/go/main/App.d.ts` | 754 | - | Already typed (Wails generated) |
| `wailsjs/go/models.ts` | 4003 | - | Already typed (Wails generated) |
| `hooks/useResourceData.js` | 202 | High | Used by 22+ components |
| `hooks/useHolmesAnalysis.js` | 283 | High | Complex streaming state |
| `state/ClusterStateContext.jsx` | 256 | High | Primary K8s state |
| `docker/SwarmStateContext.jsx` | 432 | High | Primary Docker state |
| `connection/ConnectionsStateContext.jsx` | 639 | High | Most complex context |
| `GenericResourceTable/index.jsx` | ~250 | High | Factory for 22+ tables |

---

## Optimization Opportunities

After migration, TypeScript enables:

1. **Type-safe Wails bindings** - Autocomplete for 100+ API functions
2. **Discriminated union actions** - Prevent invalid state transitions
3. **Generic resource hooks** - `useResourceData<Pod>()` for row-level safety
4. **Compile-time prop validation** - Catch errors before runtime
5. **Config-driven components** - Type-safe column/tab definitions
6. **IDE autocomplete** - For all K8s and Docker resource shapes
