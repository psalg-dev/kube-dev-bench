# TypeScript/TSX Migration - Implementation Checklist

## Overview

- **Scope**: ~238 source files, 142 test files
- **Total Estimated Effort**: 70-104 hours
- **Approach**: Incremental bottom-up migration
- **Key Advantage**: Wails already generates `App.d.ts` (754 lines) and `models.ts` (4003 lines)

---

## Phase 1: TypeScript Infrastructure (2-4 hours)

### Setup

- [ ] Install dependencies
  ```bash
  cd frontend && npm install --save-dev typescript @types/react @types/react-dom @types/node typescript-eslint
  ```

- [ ] Create `frontend/tsconfig.json`
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

- [ ] Update `frontend/eslint.config.js` - Add TypeScript support
  - Add `typescript-eslint` plugin
  - Extend file patterns to `.ts`, `.tsx`

- [ ] Add script to `frontend/package.json`
  ```json
  "typecheck": "tsc --noEmit"
  ```

### Verification

- [ ] `npm run typecheck` completes (warnings OK initially)
- [ ] `npm run dev` works unchanged
- [ ] `npm test` passes

---

## Phase 2: Type Foundation Layer (4-6 hours)

### Type Definitions

- [ ] Create `frontend/src/types/index.ts` - Central type exports
- [ ] Create `frontend/src/types/wails.ts` - Re-export Wails types
- [ ] Create `frontend/src/types/contexts.ts` - State/action types
  - [ ] `ClusterState` interface
  - [ ] `ClusterAction` discriminated union
  - [ ] `SwarmState` interface
  - [ ] `SwarmAction` discriminated union
  - [ ] `ConnectionsState` interface
  - [ ] `ConnectionsAction` discriminated union
- [ ] Create `frontend/src/types/components.ts` - Common prop types
  - [ ] `BaseTableColumn` interface
  - [ ] `TabDefinition` interface

### Service Layer Migration

- [ ] `frontend/src/k8s/resources/kubeApi.js` → `kubeApi.ts`
- [ ] `frontend/src/docker/swarmApi.js` → `swarmApi.ts`

### Verification

- [ ] `npm run typecheck` passes
- [ ] Existing JS files can import from new TS files

---

## Phase 3: Utilities & Hooks (6-8 hours)

### Utilities (Low Risk)

- [ ] `frontend/src/utils/timeUtils.js` → `timeUtils.ts`
- [ ] `frontend/src/utils/dateUtils.js` → `dateUtils.ts`
- [ ] `frontend/src/utils/resourceNavigation.js` → `resourceNavigation.ts`
- [ ] `frontend/src/utils/filterUtils.js` → `filterUtils.ts`
- [ ] `frontend/src/utils/persistence.js` → `persistence.ts`

### Hooks (Order by Complexity)

- [ ] `frontend/src/hooks/useAsyncData.js` → `useAsyncData.ts`
- [ ] `frontend/src/hooks/useTableSelection.js` → `useTableSelection.ts`
- [ ] `frontend/src/hooks/useEventSubscription.js` → `useEventSubscription.ts`
- [ ] `frontend/src/hooks/useResourceData.js` → `useResourceData.ts` (202 lines, critical)
- [ ] `frontend/src/hooks/useHolmesAnalysis.js` → `useHolmesAnalysis.ts` (283 lines, complex)
- [ ] `frontend/src/hooks/useSwarmServiceForm.js` → `useSwarmServiceForm.ts`

### Verification

- [ ] `npm run typecheck` passes
- [ ] `npm test` passes
- [ ] Hook consumers work unchanged

---

## Phase 4: State Contexts (8-12 hours)

### Context Files

- [ ] `frontend/src/state/ClusterStateContext.jsx` → `ClusterStateContext.tsx` (256 lines)
- [ ] `frontend/src/docker/SwarmStateContext.jsx` → `SwarmStateContext.tsx` (432 lines)
- [ ] `frontend/src/layout/connection/ConnectionsStateContext.jsx` → `ConnectionsStateContext.tsx` (639 lines)
- [ ] `frontend/src/docker/SwarmResourceCountsContext.jsx` → `SwarmResourceCountsContext.tsx`
- [ ] `frontend/src/holmes/HolmesContext.jsx` → `HolmesContext.tsx` (if exists)

### Verification

- [ ] `npm run typecheck` passes
- [ ] Context consumers work without changes
- [ ] `npm test` passes

---

## Phase 5: Component Factory & Configs (10-14 hours)

### Critical Component

- [ ] `frontend/src/components/GenericResourceTable/index.jsx` → `index.tsx`

### Resource Configs - Batch A (K8s Core)

- [ ] `frontend/src/config/resourceConfigs/deploymentConfig.jsx` → `.tsx`
- [ ] `frontend/src/config/resourceConfigs/podConfig.jsx` → `.tsx`
- [ ] `frontend/src/config/resourceConfigs/serviceConfig.jsx` → `.tsx`
- [ ] `frontend/src/config/resourceConfigs/configmapConfig.jsx` → `.tsx`
- [ ] `frontend/src/config/resourceConfigs/secretConfig.jsx` → `.tsx`

### Resource Configs - Batch B (K8s Workloads)

- [ ] `statefulsetConfig.jsx` → `.tsx`
- [ ] `daemonsetConfig.jsx` → `.tsx`
- [ ] `replicasetConfig.jsx` → `.tsx`
- [ ] `cronjobConfig.jsx` → `.tsx`
- [ ] `jobConfig.jsx` → `.tsx`

### Resource Configs - Batch C (K8s Storage/Network)

- [ ] `pvConfig.jsx` → `.tsx`
- [ ] `pvcConfig.jsx` → `.tsx`
- [ ] `ingressConfig.jsx` → `.tsx`

### Resource Configs - Batch D (Docker Swarm)

- [ ] All Swarm config files in `frontend/src/docker/resources/*/`

### Verification

- [ ] `npm run typecheck` passes
- [ ] Resource tables render correctly
- [ ] `npm test` passes

---

## Phase 6: UI Components (16-24 hours)

### Shared Components (`frontend/src/components/`)

- [ ] `StatusBadge.jsx` → `.tsx`
- [ ] `EmptyState.jsx` → `.tsx`
- [ ] `EmptyTabContent.jsx` → `.tsx`
- [ ] `ResourceActions.jsx` → `.tsx`
- [ ] `ResourceEventsTab.jsx` → `.tsx`
- [ ] `ResourcePodsTab.jsx` → `.tsx`
- [ ] `AggregateLogsTab.jsx` → `.tsx`
- [ ] `GenericInspectTab.jsx` → `.tsx`
- [ ] `BulkActionBar.jsx` → `.tsx`
- [ ] `TabLabel.jsx` → `.tsx`
- [ ] `BaseModal/index.jsx` → `index.tsx`

### Form Components (`frontend/src/components/forms/`)

- [ ] `FormField.jsx` → `.tsx`
- [ ] `TextField.jsx` → `.tsx`
- [ ] `NumberField.jsx` → `.tsx`
- [ ] `SelectField.jsx` → `.tsx`
- [ ] `KeyValueEditor.jsx` → `.tsx`
- [ ] `PortMappingEditor.jsx` → `.tsx`
- [ ] `CollapsibleSection.jsx` → `.tsx`
- [ ] `ViewToggle.jsx` → `.tsx`
- [ ] `ServiceForm.jsx` → `.tsx`

### Layout Components (`frontend/src/layout/`)

- [ ] `AppLayout.jsx` → `.tsx`
- [ ] `AppContainer.jsx` → `.tsx`
- [ ] `SidebarSections.jsx` → `.tsx`
- [ ] `FooterBar.jsx` → `.tsx`
- [ ] `MonitorPanel.jsx` → `.tsx`
- [ ] `MonitorIssueCard.jsx` → `.tsx`
- [ ] `MonitorModal.jsx` → `.tsx`
- [ ] `PrometheusAlertsTab.jsx` → `.tsx`

### Bottom Panel (`frontend/src/layout/bottompanel/`)

- [ ] `BottomPanel.jsx` → `.tsx`
- [ ] `YamlTab.jsx` → `.tsx`
- [ ] `LogViewerTab.jsx` → `.tsx`
- [ ] `ConsoleTab.jsx` → `.tsx`
- [ ] `TerminalTab.jsx` → `.tsx`
- [ ] `FilesTab.jsx` → `.tsx`
- [ ] `TextEditorTab.jsx` → `.tsx`
- [ ] `TextViewerTab.jsx` → `.tsx`
- [ ] `SummaryTabHeader.jsx` → `.tsx`

### Connection Components (`frontend/src/layout/connection/`)

- [ ] `ConnectionWizard.jsx` → `.tsx`
- [ ] `ConnectionsSidebar.jsx` → `.tsx`
- [ ] `ConnectionsMainView.jsx` → `.tsx`
- [ ] `KubernetesConnectionsList.jsx` → `.tsx`
- [ ] `DockerSwarmConnectionsList.jsx` → `.tsx`
- [ ] `AddKubeConfigOverlay.jsx` → `.tsx`
- [ ] `AddSwarmConnectionOverlay.jsx` → `.tsx`
- [ ] `ConnectionProxySettings.jsx` → `.tsx`
- [ ] `ConnectionHooksSettings.jsx` → `.tsx`

### Verification

- [ ] `npm run typecheck` passes
- [ ] Visual testing (manual or automated)
- [ ] `npm test` passes

---

## Phase 7: Feature Domains (12-16 hours)

### Kubernetes (`frontend/src/k8s/`)

- [ ] Resource-specific components and tabs
- [ ] Overview tables

### Docker Swarm (`frontend/src/docker/`)

- [ ] `SwarmConnectionWizard.jsx` → `.tsx`
- [ ] `SwarmSidebarSections.jsx` → `.tsx`
- [ ] Resource components in `resources/`

### Holmes AI (`frontend/src/holmes/`)

- [ ] `holmesApi.js` → `holmesApi.ts`
- [ ] `HolmesPanel.jsx` → `.tsx`
- [ ] `HolmesBottomPanel.jsx` → `.tsx`
- [ ] `HolmesResponseRenderer.jsx` → `.tsx`
- [ ] `HolmesConfigModal.jsx` → `.tsx`
- [ ] `HolmesOnboardingWizard.jsx` → `.tsx`

### Verification

- [ ] `npm run typecheck` passes
- [ ] Feature-specific E2E tests pass
- [ ] Manual testing of complex workflows

---

## Phase 8: Test Migration (8-12 hours)

### Test Infrastructure

- [ ] `frontend/src/__tests__/wailsMocks.js` → `wailsMocks.ts`
- [ ] `frontend/vitest.config.js` → `vitest.config.ts` (optional)

### Test Files

- [ ] `clusterStateReducer.test.js` → `.ts`
- [ ] `swarmStateContext.test.jsx` → `.tsx`
- [ ] Component tests (migrate alongside implementations)

### Verification

- [ ] All tests pass with TypeScript
- [ ] Coverage maintained at 70%+

---

## Phase 9: Strict Mode & Cleanup (4-8 hours)

### Enable Strict Checks

- [ ] Update `tsconfig.json`:
  ```json
  {
    "compilerOptions": {
      "noImplicitAny": true,
      "strictNullChecks": true,
      "noUnusedLocals": true,
      "noUnusedParameters": true
    }
  }
  ```

### Cleanup

- [ ] Fix remaining `any` types
- [ ] Remove `@ts-ignore` comments
- [ ] Delete legacy `.js` files after confirming `.ts` works
- [ ] Update CLAUDE.md with TypeScript conventions

### Final Verification

- [ ] `npm run typecheck` passes with zero errors
- [ ] `npm test` passes
- [ ] `npm run build` succeeds
- [ ] E2E tests pass (`cd e2e && npx playwright test`)

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
