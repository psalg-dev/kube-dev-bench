# Frontend Refactoring Implementation Plan

This document outlines a comprehensive plan to improve code reuse, abstractions, and componentization in the KubeDevBench frontend.

---

## Phase 1: Quick Wins (High Impact, Low Risk)

### 1.1 Extract Holmes Streaming Hook

**Problem:** ~130 lines of identical Holmes state management code duplicated in 4+ files.

**Files affected:**
- `frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.jsx`
- `frontend/src/k8s/resources/pods/PodOverviewTable.jsx`
- `frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx`
- `frontend/src/k8s/resources/statefulsets/StatefulSetsOverviewTable.jsx`
- `frontend/src/k8s/resources/daemonsets/DaemonSetsOverviewTable.jsx`

**Tasks:**
- [ ] Create `frontend/src/hooks/useHolmesStream.js`
  - [ ] Extract `holmesState` initial state object
  - [ ] Extract `holmesStateRef` pattern
  - [ ] Extract `onHolmesChatStream` subscription logic
  - [ ] Extract `onHolmesContextProgress` subscription logic
  - [ ] Return `{ holmesState, startAnalysis, cancelAnalysis, getPropsForKey }`
  - [ ] Add JSDoc documentation
- [ ] Create `frontend/src/hooks/useHolmesStream.test.js`
  - [ ] Test initial state
  - [ ] Test stream event handling
  - [ ] Test cancellation
  - [ ] Test error states
- [ ] Refactor `DeploymentsOverviewTable.jsx` to use hook
- [ ] Refactor `SwarmServicesOverviewTable.jsx` to use hook
- [ ] Refactor `StatefulSetsOverviewTable.jsx` to use hook
- [ ] Refactor `DaemonSetsOverviewTable.jsx` to use hook
- [ ] Refactor `PodOverviewTable.jsx` to use hook (partial - hook only)
- [ ] Verify all Holmes functionality works correctly
- [ ] Run existing tests to ensure no regressions

---

### 1.2 Extract Resource Data Fetching Hook

**Problem:** Every overview table has similar data fetching + event subscription patterns.

**Files affected:** All `*OverviewTable.jsx` files (~22 files)

**Tasks:**
- [ ] Create `frontend/src/hooks/useResourceData.js`
  - [ ] Accept params: `{ fetchFn, eventName, transformFn?, deps? }`
  - [ ] Handle loading state
  - [ ] Handle error state
  - [ ] Handle event subscription with cleanup
  - [ ] Handle refresh trigger
  - [ ] Return `{ data, loading, error, refresh }`
  - [ ] Add JSDoc documentation
- [ ] Create `frontend/src/hooks/useResourceData.test.js`
  - [ ] Test loading state
  - [ ] Test successful fetch
  - [ ] Test error handling
  - [ ] Test event subscription
  - [ ] Test refresh functionality
- [ ] Refactor `SwarmConfigsOverviewTable.jsx` as pilot (simplest case)
- [ ] Refactor `SwarmSecretsOverviewTable.jsx`
- [ ] Refactor `SwarmVolumesOverviewTable.jsx`
- [ ] Refactor `SwarmNodesOverviewTable.jsx`
- [ ] Refactor remaining Swarm overview tables
- [ ] Refactor K8s overview tables (excluding PodOverviewTable)
- [ ] Run tests after each refactor

---

### 1.3 Consolidate Button Styles

**Problem:** Same `buttonStyle` object defined inline in 8+ files.

**Files affected:**
- `frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx`
- `frontend/src/docker/resources/configs/SwarmConfigsOverviewTable.jsx`
- `frontend/src/docker/resources/secrets/SwarmSecretsOverviewTable.jsx`
- `frontend/src/k8s/resources/cronjobs/CronJobActionsTab.jsx`
- Multiple summary panel components

**Tasks:**
- [ ] Create `frontend/src/components/ui/Button.css`
  - [ ] Define `.btn-secondary` class (current buttonStyle)
  - [ ] Define `.btn-primary` class
  - [ ] Define `.btn-danger` class
  - [ ] Define size variants (`.btn-sm`, `.btn-md`)
- [ ] Create `frontend/src/components/ui/Button.jsx`
  - [ ] Props: `variant`, `size`, `disabled`, `onClick`, `children`
  - [ ] Apply appropriate CSS classes
  - [ ] Export as default and named export
- [ ] Create `frontend/src/components/ui/Button.test.jsx`
- [ ] Replace inline `buttonStyle` usage in all affected files
- [ ] Update imports in affected files
- [ ] Visual regression check

---

### 1.4 Create Confirm Delete Pattern

**Problem:** Same delete confirmation pattern copy-pasted in 15+ places.

**Tasks:**
- [ ] Create `frontend/src/components/ConfirmDialog.jsx`
  - [ ] Props: `open`, `title`, `message`, `confirmLabel`, `onConfirm`, `onCancel`, `danger`
  - [ ] Accessible modal with focus trap
  - [ ] Keyboard support (Escape to cancel, Enter to confirm)
- [ ] Create `frontend/src/components/ConfirmDialog.css`
- [ ] Create `frontend/src/components/ConfirmDialog.test.jsx`
- [ ] Create `frontend/src/hooks/useConfirmDialog.js`
  - [ ] Return `{ confirm, ConfirmDialogComponent }`
  - [ ] `confirm(options)` returns Promise<boolean>
- [ ] Refactor delete handlers in `SwarmSecretsOverviewTable.jsx`
- [ ] Refactor delete handlers in `SwarmConfigsOverviewTable.jsx`
- [ ] Refactor delete handlers in `SwarmServicesOverviewTable.jsx`
- [ ] Refactor delete handlers in remaining overview tables
- [ ] Remove `window.confirm` calls

---

### 1.5 Create Hooks Index

**Tasks:**
- [ ] Create `frontend/src/hooks/index.js`
  - [ ] Export `useHolmesStream`
  - [ ] Export `useResourceData`
  - [ ] Export `useConfirmDialog`
- [ ] Update imports across codebase to use index

---

## Phase 2: Moderate Refactoring

### 2.1 Refactor PodOverviewTable to Use OverviewTableWithPanel

**Problem:** `PodOverviewTable.jsx` is 1,200+ lines with custom implementation while all other tables use shared component.

**Tasks:**
- [ ] Analyze PodOverviewTable-specific features:
  - [ ] Document port forward UI requirements
  - [ ] Document shell/console integration
  - [ ] Document virtualization needs (if still required)
  - [ ] Document custom column renderers
- [ ] Extend `OverviewTableWithPanel` if needed:
  - [ ] Add virtualization support (optional prop)
  - [ ] Ensure custom cell renderers work for ports
- [ ] Create `frontend/src/k8s/resources/pods/PodOverviewTableV2.jsx`
  - [ ] Use `OverviewTableWithPanel`
  - [ ] Use `useHolmesStream` hook
  - [ ] Use `useResourceData` hook
  - [ ] Implement tabs: Summary, Logs, Events, Holmes, YAML, Console, Port Forward, Files, Mounts
  - [ ] Implement `getRowActions` for context menu
- [ ] Create comprehensive tests for new implementation
- [ ] A/B test both implementations (feature flag)
- [ ] Migrate to V2 after validation
- [ ] Remove old `PodOverviewTable.jsx`
- [ ] Rename V2 to PodOverviewTable

---

### 2.2 Create Generic ResourceSummaryPanel Component

**Problem:** ConfigSummaryPanel, SecretSummaryPanel, ServiceSummaryPanel share ~80% structure.

**Tasks:**
- [ ] Analyze common patterns in summary panels:
  - [ ] SummaryTabHeader usage
  - [ ] QuickInfoSection fields
  - [ ] Side sections (UsedBy, Data, Logs)
  - [ ] Action buttons
  - [ ] Modals
- [ ] Create `frontend/src/components/ResourceSummaryPanel.jsx`
  - [ ] Props: `name`, `labels`, `quickInfoFields`, `data`, `actions`, `sideSections`, `children`
  - [ ] Render standard layout with slots
  - [ ] Support flexible side section configuration
- [ ] Create `frontend/src/components/ResourceSummaryPanel.test.jsx`
- [ ] Refactor `ConfigSummaryPanel` to use new component
- [ ] Refactor `SecretSummaryPanel` to use new component
- [ ] Refactor `ServiceSummaryPanel` to use new component
- [ ] Refactor remaining summary panels

---

### 2.3 Create Generic UsedBySection Component

**Problem:** ConfigUsedBySection, SecretUsedBySection, VolumeUsedBySection are nearly identical.

**Tasks:**
- [ ] Analyze differences between existing UsedBy components
- [ ] Create `frontend/src/components/UsedBySection.jsx`
  - [ ] Props: `resourceId`, `resourceType`, `fetchFn`, `columns?`
  - [ ] Generic data fetching
  - [ ] Standard table display
  - [ ] Empty state handling
- [ ] Create `frontend/src/components/UsedBySection.test.jsx`
- [ ] Refactor `ConfigUsedBySection` to use generic component
- [ ] Refactor `SecretUsedBySection` to use generic component
- [ ] Refactor `VolumeUsedBySection` to use generic component
- [ ] Delete original specific components

---

### 2.4 Add Error Boundaries

**Problem:** No error boundaries per React best practices.

**Tasks:**
- [ ] Create `frontend/src/components/ErrorBoundary.jsx`
  - [ ] Catch rendering errors
  - [ ] Display fallback UI
  - [ ] Log errors appropriately
  - [ ] Provide retry mechanism
- [ ] Create `frontend/src/components/ErrorBoundary.css`
- [ ] Create `frontend/src/components/ResourceErrorBoundary.jsx`
  - [ ] Specialized for resource views
  - [ ] "Retry" and "Report Issue" actions
- [ ] Wrap `OverviewTableWithPanel` renders with ErrorBoundary
- [ ] Wrap bottom panel content with ErrorBoundary
- [ ] Add error boundary to `AppLayout.jsx`
- [ ] Test error recovery scenarios

---

### 2.5 Standardize Row Actions Pattern

**Problem:** Row actions defined inconsistently across tables.

**Tasks:**
- [ ] Create `frontend/src/utils/rowActions.js`
  - [ ] `createDeleteAction(name, deleteFn, options)`
  - [ ] `createRestartAction(name, restartFn)`
  - [ ] `createScaleAction(name, scaleFn, currentReplicas)`
  - [ ] `createHolmesAction(name, analyzeFn, isLoading)`
- [ ] Create `frontend/src/utils/rowActions.test.js`
- [ ] Refactor `SwarmServicesOverviewTable` getRowActions
- [ ] Refactor `DeploymentsOverviewTable` getRowActions
- [ ] Refactor remaining tables

---

## Phase 3: Architectural Improvements (Optional/Future)

### 3.1 TypeScript Migration

**Problem:** No type safety per React instructions.

**Tasks:**
- [ ] Add TypeScript configuration
  - [ ] Create `tsconfig.json`
  - [ ] Update Vite config
  - [ ] Add necessary @types packages
- [ ] Create type definitions:
  - [ ] `frontend/src/types/k8s.ts` - K8s resource types
  - [ ] `frontend/src/types/swarm.ts` - Docker Swarm resource types
  - [ ] `frontend/src/types/holmes.ts` - Holmes AI types
  - [ ] `frontend/src/types/components.ts` - Component prop types
- [ ] Migrate core components first:
  - [ ] `StatusBadge.tsx`
  - [ ] `QuickInfoSection.tsx`
  - [ ] `OverviewTableWithPanel.tsx`
- [ ] Migrate hooks:
  - [ ] `useHolmesStream.ts`
  - [ ] `useResourceData.ts`
- [ ] Migrate remaining components incrementally
- [ ] Enable strict mode after full migration

---

### 3.2 CSS Modules Migration

**Problem:** Pervasive inline styles violate best practices.

**Tasks:**
- [ ] Configure CSS Modules in Vite
- [ ] Create design tokens file:
  - [ ] `frontend/src/styles/tokens.css` - CSS custom properties
- [ ] Migrate high-impact components first:
  - [ ] `OverviewTableWithPanel.module.css`
  - [ ] `BottomPanel.module.css`
  - [ ] `SummaryTabHeader.module.css`
- [ ] Create utility classes:
  - [ ] `frontend/src/styles/utilities.css` - flex, spacing, etc.
- [ ] Remove inline styles systematically
- [ ] Update component imports

---

### 3.3 Data Fetching with React Query

**Problem:** Manual data fetching without proper caching.

**Tasks:**
- [ ] Install `@tanstack/react-query`
- [ ] Create `frontend/src/api/queryClient.js`
- [ ] Create query hooks:
  - [ ] `useSwarmServices`
  - [ ] `useSwarmConfigs`
  - [ ] `useDeployments`
  - [ ] `usePods`
  - [ ] etc.
- [ ] Migrate overview tables to use query hooks
- [ ] Remove manual caching logic
- [ ] Add optimistic updates for mutations

---

### 3.4 Component Library Extraction

**Tasks:**
- [ ] Create `frontend/src/components/ui/` directory
- [ ] Move and document:
  - [ ] `Button.jsx`
  - [ ] `StatusBadge.jsx`
  - [ ] `ConfirmDialog.jsx`
  - [ ] `EmptyState.jsx`
  - [ ] `LoadingSpinner.jsx`
- [ ] Create Storybook stories for each component
- [ ] Document props with JSDoc
- [ ] Create usage examples

---

## Testing Requirements

### Unit Test Coverage
- [ ] All new hooks must have >80% coverage
- [ ] All new components must have >70% coverage
- [ ] Use React Testing Library patterns

### E2E Test Updates
- [ ] Verify all existing E2E tests pass after each phase
- [ ] Add E2E tests for any new UI patterns
- [ ] Update page objects if selectors change

---

## Implementation Order

**Recommended sequence:**

1. **Phase 1.1** - Holmes hook (highest duplication)
2. **Phase 1.3** - Button styles (quick win)
3. **Phase 1.2** - Resource data hook
4. **Phase 1.4** - Confirm dialog
5. **Phase 2.4** - Error boundaries (safety net)
6. **Phase 2.1** - PodOverviewTable refactor (largest single file)
7. **Phase 2.2** - ResourceSummaryPanel
8. **Phase 2.3** - UsedBySection
9. **Phase 2.5** - Row actions

Phase 3 items can be tackled incrementally as time permits.

---

## Success Metrics

- [ ] Reduce total frontend LOC by ~15%
- [ ] No new ESLint warnings
- [ ] All existing tests pass
- [ ] All E2E tests pass
- [ ] No visual regressions
- [ ] Improved code review times for new features

---

## Notes

- Each task should be a separate commit
- Run `npm test` after each component refactor
- Run E2E tests after completing each phase
- Update CLAUDE.md if component locations change
