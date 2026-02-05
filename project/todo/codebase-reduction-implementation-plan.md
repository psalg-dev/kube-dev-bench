# Codebase Reduction & Quality Improvement: Implementation Plan

**Date**: 2026-02-03
**Status**: Planning

---

## Executive Summary

This plan targets a reduction of **4,700-7,050 lines** of code and **40-70 KB** of bundle size through systematic consolidation, elimination of duplication, and optimization.

| Category | Target Reduction | Effort | Priority |
|----------|------------------|--------|----------|
| React OverviewTable Consolidation | 2,000-3,000 lines | High | 1 |
| **Async Data & Event Hooks** | 450-600 lines | Low | 2 |
| **Modal & InspectTab Consolidation** | 400-530 lines | Medium | 3 |
| Go Handler Generics & Utilities | 800-1,000 lines | Medium | 4 |
| Bundle Size Optimization | 40-70 KB gzipped | Medium | 5 |
| CSS Consolidation | 500-800 lines | Low | 6 |
| State Context Refactoring | 200-300 lines | Medium | 7 |
| **Inline Style Extraction** | 250-350 lines | Low | 8 |

---

## Part 1: Frontend - React Component Consolidation

### 1.1 Create Generic ResourceOverviewTable Component

**Priority**: CRITICAL
**Estimated Savings**: 2,000-3,000 lines
**Effort**: 4-6 days
**Risk**: Medium

#### Problem Statement

22 OverviewTable components follow identical patterns but each is implemented independently:

| Component | Lines | Location |
|-----------|-------|----------|
| PodOverviewTable.jsx | 1,218 | `frontend/src/k8s/resources/pods/` |
| SwarmServicesOverviewTable.jsx | 866 | `frontend/src/docker/resources/services/` |
| SwarmNodesOverviewTable.jsx | 855 | `frontend/src/docker/resources/nodes/` |
| SwarmTasksOverviewTable.jsx | 817 | `frontend/src/docker/resources/tasks/` |
| SwarmStacksOverviewTable.jsx | 764 | `frontend/src/docker/resources/stacks/` |
| DeploymentsOverviewTable.jsx | 462 | `frontend/src/k8s/resources/deployments/` |
| ServicesOverviewTable.jsx | 418 | `frontend/src/k8s/resources/services/` |
| StatefulSetsOverviewTable.jsx | 470 | `frontend/src/k8s/resources/statefulsets/` |
| + 14 more tables | ~300-500 each | Various |

Each contains:
1. Column definitions (repeated structure)
2. Bottom panel tab definitions (repeated pattern)
3. `renderPanelContent()` with massive if/else chains (50-100+ lines each)
4. Duplicated event listeners and state management
5. Duplicated search/filter logic

#### Implementation

**Phase 1: Create Generic Table Factory** (2 days)

Create `frontend/src/components/GenericResourceTable/`:

```
GenericResourceTable/
  index.jsx              # Main factory component
  useTableState.js       # Shared state management hook
  useTableData.js        # Data fetching/subscription hook
  TableColumns.jsx       # Column renderer
  BottomPanel.jsx        # Panel container
  SearchFilter.jsx       # Reusable search component
  ContextMenu.jsx        # Reusable context menu
```

**Core Component Structure**:

```jsx
// frontend/src/components/GenericResourceTable/index.jsx
export function GenericResourceTable({
  // Configuration
  resourceType,           // 'deployment', 'pod', 'swarm-service', etc.
  columns,               // Column definitions array
  tabs,                  // Bottom panel tab definitions

  // Data
  data,                  // Resource data array
  loading,               // Loading state

  // Handlers
  fetchFn,               // Function to fetch data
  eventName,             // Event name for live updates
  getRowActions,         // Function returning context menu actions
  renderPanelContent,    // Function to render panel tab content

  // Optional
  holmesAnalyzeFn,       // Holmes analysis function (optional)
  searchFields,          // Fields to search (default: ['name', 'namespace'])
}) {
  // Shared implementation
}
```

**Phase 2: Create Configuration Objects** (1 day)

```jsx
// frontend/src/config/resourceConfigs/deploymentConfig.js
export const deploymentConfig = {
  resourceType: 'deployment',
  eventName: 'deployments:update',

  columns: [
    { key: 'name', label: 'Name', sortable: true },
    { key: 'namespace', label: 'Namespace', sortable: true },
    { key: 'replicas', label: 'Replicas', align: 'center' },
    { key: 'ready', label: 'Ready', align: 'center' },
    { key: 'available', label: 'Available', align: 'center' },
    { key: 'age', label: 'Age', sortable: true },
    { key: 'image', label: 'Image' },
  ],

  tabs: [
    { key: 'summary', label: 'Summary' },
    { key: 'pods', label: 'Pods', countFn: (row) => row.pods?.length },
    { key: 'rollout', label: 'Rollout' },
    { key: 'logs', label: 'Logs' },
    { key: 'events', label: 'Events' },
    { key: 'yaml', label: 'YAML' },
    { key: 'holmes', label: 'Holmes' },
  ],

  fetchFn: GetDeployments,
  holmesAnalyzeFn: AnalyzeDeploymentStream,
  searchFields: ['name', 'namespace', 'image'],
};
```

**Phase 3: Migrate Existing Components** (2-3 days)

Migrate in order of complexity (simplest first):

1. **Tier 1 - Simple K8s Resources** (Day 1)
   - ConfigMapsOverviewTable
   - SecretsOverviewTable
   - IngressesOverviewTable
   - PersistentVolumesOverviewTable
   - PersistentVolumeClaimsOverviewTable

2. **Tier 2 - Workload Resources** (Day 2)
   - DeploymentsOverviewTable
   - StatefulSetsOverviewTable
   - DaemonSetsOverviewTable
   - ReplicaSetsOverviewTable
   - JobsOverviewTable
   - CronJobsOverviewTable

3. **Tier 3 - Swarm Resources** (Day 2-3)
   - SwarmServicesOverviewTable
   - SwarmTasksOverviewTable
   - SwarmNodesOverviewTable
   - SwarmNetworksOverviewTable
   - SwarmConfigsOverviewTable
   - SwarmSecretsOverviewTable
   - SwarmVolumesOverviewTable
   - SwarmStacksOverviewTable

4. **Tier 4 - Complex Resources** (Day 3)
   - ServicesOverviewTable (K8s services)
   - PodOverviewTable (most complex - port forwarding, shell, files)

#### Migration Example

**Before** (DeploymentsOverviewTable.jsx - 462 lines):
```jsx
export function DeploymentsOverviewTable({ namespace, namespaces }) {
  const [deployments, setDeployments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [holmesState, setHolmesState] = useState({...});
  // ... 400+ more lines of implementation
}
```

**After** (DeploymentsOverviewTable.jsx - ~50 lines):
```jsx
import { GenericResourceTable } from '@/components/GenericResourceTable';
import { deploymentConfig } from '@/config/resourceConfigs/deploymentConfig';
import { renderDeploymentPanelContent } from './DeploymentPanelContent';
import { getDeploymentRowActions } from './DeploymentRowActions';

export function DeploymentsOverviewTable({ namespace, namespaces }) {
  return (
    <GenericResourceTable
      {...deploymentConfig}
      namespace={namespace}
      namespaces={namespaces}
      renderPanelContent={renderDeploymentPanelContent}
      getRowActions={getDeploymentRowActions}
    />
  );
}
```

#### Files to Create
```
frontend/src/components/GenericResourceTable/
  index.jsx
  useTableState.js
  useTableData.js
  TableColumns.jsx
  BottomPanel.jsx
  SearchFilter.jsx
  ContextMenu.jsx
  __tests__/
    GenericResourceTable.test.jsx

frontend/src/config/resourceConfigs/
  deploymentConfig.js
  podConfig.js
  statefulsetConfig.js
  daemonsetConfig.js
  serviceConfig.js
  configmapConfig.js
  secretConfig.js
  ingressConfig.js
  jobConfig.js
  cronjobConfig.js
  replicasetConfig.js
  pvConfig.js
  pvcConfig.js
  swarmServiceConfig.js
  swarmTaskConfig.js
  swarmNodeConfig.js
  swarmNetworkConfig.js
  swarmConfigConfig.js
  swarmSecretConfig.js
  swarmVolumeConfig.js
  swarmStackConfig.js
  index.js  # barrel export
```

#### Success Criteria
- [ ] GenericResourceTable component created and tested
- [ ] All 22 OverviewTable components migrated
- [ ] Each migrated component reduced to <100 lines
- [ ] All E2E tests pass
- [ ] No visual regressions

---

### 1.2 Create useHolmesAnalysis Hook

**Priority**: HIGH
**Estimated Savings**: 500-800 lines
**Effort**: 1 day
**Risk**: Low

#### Problem Statement

Every OverviewTable contains ~80-150 lines of identical Holmes streaming logic:

```jsx
// Repeated in 16+ files
const [holmesState, setHolmesState] = useState({
  loading: false, response: null, error: null, key: null,
  streamId: null, streamingText: '', reasoningText: '',
  queryTimestamp: null, contextSteps: [], toolEvents: [],
});
const holmesStateRef = useRef(holmesState);

useEffect(() => {
  const unsubscribe = onHolmesChatStream((payload) => {
    // ~80 lines of identical event handling
  });
  return () => { try { unsubscribe?.(); } catch (_) {} };
}, []);

useEffect(() => {
  const unsubscribe = onHolmesContextProgress((event) => {
    // ~25 lines of identical progress handling
  });
  return () => { try { unsubscribe?.(); } catch (_) {} };
}, []);
```

#### Implementation

**Create hook**: `frontend/src/hooks/useHolmesAnalysis.js`

```jsx
import { useState, useRef, useEffect, useCallback } from 'react';
import { onHolmesChatStream, onHolmesContextProgress } from '../wailsjs/runtime';
import { CancelHolmesStream } from '../wailsjs/go/main/App';

const initialState = {
  loading: false,
  response: null,
  error: null,
  key: null,
  streamId: null,
  streamingText: '',
  reasoningText: '',
  queryTimestamp: null,
  contextSteps: [],
  toolEvents: [],
};

export function useHolmesAnalysis({ kind, analyzeFn }) {
  const [state, setState] = useState(initialState);
  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Stream event handler
  useEffect(() => {
    const unsubscribe = onHolmesChatStream((payload) => {
      const current = stateRef.current;
      if (!current.streamId || payload.streamId !== current.streamId) return;

      if (payload.type === 'chunk') {
        setState(prev => ({
          ...prev,
          streamingText: prev.streamingText + payload.text,
        }));
      } else if (payload.type === 'reasoning') {
        setState(prev => ({
          ...prev,
          reasoningText: prev.reasoningText + payload.text,
        }));
      } else if (payload.type === 'done') {
        setState(prev => ({
          ...prev,
          loading: false,
          response: prev.streamingText || payload.response,
        }));
      } else if (payload.type === 'error') {
        setState(prev => ({
          ...prev,
          loading: false,
          error: payload.error,
        }));
      }
    });

    return () => {
      try { unsubscribe?.(); } catch (_) {}
    };
  }, []);

  // Progress event handler
  useEffect(() => {
    const unsubscribe = onHolmesContextProgress((event) => {
      const current = stateRef.current;
      if (!current.streamId) return;

      setState(prev => ({
        ...prev,
        contextSteps: [...prev.contextSteps, event.step],
      }));
    });

    return () => {
      try { unsubscribe?.(); } catch (_) {}
    };
  }, []);

  const analyze = useCallback(async (namespace, name) => {
    const key = `${namespace}/${name}`;
    const streamId = `${kind.toLowerCase()}-${Date.now()}`;

    setState({
      ...initialState,
      loading: true,
      key,
      streamId,
      queryTimestamp: new Date().toISOString(),
    });

    try {
      await analyzeFn(namespace, name, streamId);
    } catch (err) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: err?.message || String(err),
      }));
    }
  }, [kind, analyzeFn]);

  const cancel = useCallback(async () => {
    if (!state.streamId) return;
    setState(prev => ({ ...prev, loading: false, streamId: null }));
    await CancelHolmesStream(state.streamId);
  }, [state.streamId]);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  return { state, analyze, cancel, reset };
}
```

**Usage**:
```jsx
// In DeploymentsOverviewTable.jsx - reduces ~125 lines to ~3 lines
const { state: holmesState, analyze, cancel } = useHolmesAnalysis({
  kind: 'Deployment',
  analyzeFn: AnalyzeDeploymentStream,
});
```

#### Files to Create
```
frontend/src/hooks/useHolmesAnalysis.js
frontend/src/__tests__/useHolmesAnalysis.test.js
```

---

### 1.3 Create useAsyncData Hook

**Priority**: HIGH
**Estimated Savings**: 300-400 lines
**Effort**: 0.5 days
**Risk**: Low

#### Problem Statement

20+ components repeat the identical "active flag" pattern for async data fetching with cleanup:

```jsx
// Repeated in 20+ files
useEffect(() => {
  let active = true;
  setLoading(true);
  setError(null);
  (async () => {
    try {
      const data = await fetchFn();
      if (!active) return;
      setData(data);
    } catch (e) {
      if (!active) return;
      setError(e?.message || String(e));
    } finally {
      if (active) setLoading(false);
    }
  })();
  return () => { active = false; };
}, [dependency]);
```

**Found in**:
- All 4 InspectTab components
- ConfigEditModal, SecretEditModal
- Multiple detail tabs (CronJob, Stack, etc.)
- ~20+ other components

#### Implementation

**Create hook**: `frontend/src/hooks/useAsyncData.js`

```jsx
import { useState, useEffect, useCallback } from 'react';

/**
 * Hook for async data fetching with automatic cleanup handling.
 * Prevents state updates after component unmount.
 */
export function useAsyncData(fetchFn, deps = []) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refetch = useCallback(async () => {
    let active = true;
    setLoading(true);
    setError(null);

    try {
      const result = await fetchFn();
      if (active) {
        setData(result);
      }
    } catch (e) {
      if (active) {
        setError(e?.message || String(e));
      }
    } finally {
      if (active) {
        setLoading(false);
      }
    }

    return () => { active = false; };
  }, [fetchFn]);

  useEffect(() => {
    let active = true;
    let cleanup;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchFn();
        if (active) setData(result);
      } catch (e) {
        if (active) setError(e?.message || String(e));
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => { active = false; };
  }, deps);

  return { data, loading, error, refetch };
}
```

**Usage**:
```jsx
// Before (~15 lines)
const [content, setContent] = useState('');
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  let active = true;
  setLoading(true);
  (async () => {
    try {
      const json = await GetSwarmConfigInspectJSON(id);
      if (!active) return;
      setContent(String(json || ''));
    } catch (e) {
      if (!active) return;
      setError(e?.message || String(e));
    } finally {
      if (active) setLoading(false);
    }
  })();
  return () => { active = false; };
}, [id]);

// After (~3 lines)
const { data: content, loading, error } = useAsyncData(
  () => GetSwarmConfigInspectJSON(id).then(json => String(json || '')),
  [id]
);
```

#### Files to Create
```
frontend/src/hooks/useAsyncData.js
frontend/src/__tests__/useAsyncData.test.js
```

---

### 1.4 Create useEventSubscription Hook

**Priority**: MEDIUM
**Estimated Savings**: 150-200 lines
**Effort**: 0.25 days
**Risk**: Low

#### Problem Statement

23+ components repeat the same event subscription cleanup pattern:

```jsx
// Repeated in 23+ files
useEffect(() => {
  const unsubscribe = onSomeEvent((payload) => {
    // handler logic
  });
  return () => {
    try { unsubscribe?.(); } catch (_) {}
  };
}, []);
```

#### Implementation

**Create hook**: `frontend/src/hooks/useEventSubscription.js`

```jsx
import { useEffect } from 'react';

/**
 * Hook for safely subscribing to Wails events with automatic cleanup.
 */
export function useEventSubscription(subscribeFn, handler, deps = []) {
  useEffect(() => {
    const unsubscribe = subscribeFn(handler);
    return () => {
      try { unsubscribe?.(); } catch (_) {}
    };
  }, deps);
}
```

**Usage**:
```jsx
// Before (~8 lines)
useEffect(() => {
  const unsubscribe = onHolmesChatStream((payload) => {
    handleStream(payload);
  });
  return () => {
    try { unsubscribe?.(); } catch (_) {}
  };
}, []);

// After (~3 lines)
useEventSubscription(onHolmesChatStream, handleStream, []);
```

#### Files to Create
```
frontend/src/hooks/useEventSubscription.js
frontend/src/__tests__/useEventSubscription.test.js
```

---

### 1.5 Create GenericInspectTab Component

**Priority**: MEDIUM
**Estimated Savings**: 150-180 lines
**Effort**: 0.5 days
**Risk**: Low

#### Problem Statement

4 InspectTab components are nearly identical:
- `frontend/src/docker/resources/configs/ConfigInspectTab.jsx` (46 lines)
- `frontend/src/docker/resources/secrets/SecretInspectTab.jsx` (46 lines)
- `frontend/src/docker/resources/networks/NetworkInspectTab.jsx` (~50 lines)
- `frontend/src/docker/resources/volumes/VolumeInspectTab.jsx` (~50 lines)

Each follows the same pattern: fetch JSON, display in TextViewerTab.

#### Implementation

**Create component**: `frontend/src/components/GenericInspectTab.jsx`

```jsx
import { useAsyncData } from '../hooks/useAsyncData';
import { TextViewerTab } from '../layout/bottompanel/TextViewerTab';

/**
 * Generic inspect tab for displaying JSON data from any resource.
 */
export function GenericInspectTab({ id, fetchFn, loadingLabel = 'Loading...' }) {
  const { data: content, loading, error } = useAsyncData(
    () => fetchFn(id).then(json => String(json || '')),
    [id]
  );

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TextViewerTab
        content={content || ''}
        loading={loading}
        error={error}
        loadingLabel={loadingLabel}
      />
    </div>
  );
}
```

**Usage**:
```jsx
// Before (ConfigInspectTab.jsx - 46 lines)
export function ConfigInspectTab({ id }) {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    // ... 25+ lines of fetch logic
  }, [id]);

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      <TextViewerTab ... />
    </div>
  );
}

// After (ConfigInspectTab.jsx - 8 lines)
import { GenericInspectTab } from '@/components/GenericInspectTab';
import { GetSwarmConfigInspectJSON } from '@/wailsjs/go/main/App';

export function ConfigInspectTab({ id }) {
  return (
    <GenericInspectTab
      id={id}
      fetchFn={GetSwarmConfigInspectJSON}
      loadingLabel="Loading config..."
    />
  );
}
```

#### Files to Create
```
frontend/src/components/GenericInspectTab.jsx
frontend/src/__tests__/GenericInspectTab.test.jsx
```

#### Files to Modify
```
frontend/src/docker/resources/configs/ConfigInspectTab.jsx
frontend/src/docker/resources/secrets/SecretInspectTab.jsx
frontend/src/docker/resources/networks/NetworkInspectTab.jsx
frontend/src/docker/resources/volumes/VolumeInspectTab.jsx
```

---

### 1.6 Create BaseModal Component

**Priority**: HIGH
**Estimated Savings**: 250-350 lines
**Effort**: 0.5 days
**Risk**: Low

#### Problem Statement

17+ modal components repeat identical inline style objects (~40 lines each):

```jsx
// Repeated in 17+ files
const overlay = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(0,0,0,0.6)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1200,
};

const modal = {
  backgroundColor: 'var(--gh-bg, #0d1117)',
  borderRadius: 8,
  padding: 20,
  width: 640,
  boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
  border: '1px solid var(--gh-border, #30363d)',
};

const button = {
  padding: '6px 12px',
  borderRadius: 4,
  border: '1px solid var(--gh-border, #30363d)',
  backgroundColor: 'var(--gh-button-bg, #21262d)',
  color: 'var(--gh-text, #c9d1d9)',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 500,
};
```

**Files with this pattern**:
- ImageUpdateModal.jsx
- ImageUpdateSettingsModal.jsx
- UpdateServiceImageModal.jsx
- ConfigEditModal.jsx
- ConfigCompareModal.jsx
- SecretEditModal.jsx
- SecretCloneModal.jsx
- UpdateStackModal.jsx
- CreateManifestOverlay.jsx
- AddKubeConfigOverlay.jsx
- AddSwarmConnectionOverlay.jsx
- + 6 more

#### Implementation

**Create component**: `frontend/src/components/BaseModal/index.jsx`

```jsx
import './BaseModal.css';

/**
 * Base modal wrapper with standard overlay, container, and button styling.
 */
export function BaseModal({
  isOpen,
  onClose,
  title,
  width = 640,
  children,
  footer,
}) {
  if (!isOpen) return null;

  return (
    <div className="base-modal-overlay" onClick={onClose}>
      <div
        className="base-modal-container"
        style={{ width }}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="base-modal-header">
            <h3>{title}</h3>
            <button className="base-modal-close" onClick={onClose}>×</button>
          </div>
        )}
        <div className="base-modal-content">
          {children}
        </div>
        {footer && (
          <div className="base-modal-footer">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// Re-export button components for consistent styling
export function ModalButton({ variant = 'default', ...props }) {
  return (
    <button
      className={`base-modal-btn base-modal-btn-${variant}`}
      {...props}
    />
  );
}

export function ModalPrimaryButton(props) {
  return <ModalButton variant="primary" {...props} />;
}

export function ModalDangerButton(props) {
  return <ModalButton variant="danger" {...props} />;
}
```

**Create CSS**: `frontend/src/components/BaseModal/BaseModal.css`

```css
.base-modal-overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1200;
}

.base-modal-container {
  background-color: var(--gh-bg, #0d1117);
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  border: 1px solid var(--gh-border, #30363d);
  max-height: 90vh;
  overflow-y: auto;
}

.base-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.base-modal-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: var(--gh-text, #c9d1d9);
}

.base-modal-close {
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: var(--gh-text-muted, #8b949e);
}

.base-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
}

.base-modal-btn {
  padding: 6px 12px;
  border-radius: 4px;
  border: 1px solid var(--gh-border, #30363d);
  background-color: var(--gh-button-bg, #21262d);
  color: var(--gh-text, #c9d1d9);
  cursor: pointer;
  font-size: 12px;
  font-weight: 500;
}

.base-modal-btn:hover {
  background-color: var(--gh-button-hover-bg, #30363d);
}

.base-modal-btn-primary {
  background-color: var(--gh-accent, #238636);
  border-color: var(--gh-accent, #238636);
  color: #fff;
}

.base-modal-btn-primary:hover {
  background-color: var(--gh-accent-hover, #2ea043);
}

.base-modal-btn-danger {
  background-color: #da3633;
  border-color: #da3633;
  color: #fff;
}

.base-modal-btn-danger:hover {
  background-color: #f85149;
}
```

**Usage**:
```jsx
// Before (~60 lines of styling + structure)
export function ConfigEditModal({ isOpen, onClose, config }) {
  const overlay = { /* 8 properties */ };
  const modal = { /* 7 properties */ };
  const button = { /* 8 properties */ };
  // ... more inline styles

  return (
    <div style={overlay}>
      <div style={modal}>
        {/* content */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={button}>Cancel</button>
          <button style={{ ...button, backgroundColor: '#238636' }}>Save</button>
        </div>
      </div>
    </div>
  );
}

// After (~20 lines)
import { BaseModal, ModalButton, ModalPrimaryButton } from '@/components/BaseModal';

export function ConfigEditModal({ isOpen, onClose, config }) {
  return (
    <BaseModal
      isOpen={isOpen}
      onClose={onClose}
      title="Edit Config"
      footer={
        <>
          <ModalButton onClick={onClose}>Cancel</ModalButton>
          <ModalPrimaryButton onClick={handleSave}>Save</ModalPrimaryButton>
        </>
      }
    >
      {/* content only */}
    </BaseModal>
  );
}
```

#### Files to Create
```
frontend/src/components/BaseModal/
  index.jsx
  BaseModal.css
frontend/src/__tests__/BaseModal.test.jsx
```

#### Files to Modify (17+)
```
frontend/src/docker/resources/services/ImageUpdateModal.jsx
frontend/src/docker/resources/services/ImageUpdateSettingsModal.jsx
frontend/src/docker/resources/services/UpdateServiceImageModal.jsx
frontend/src/docker/resources/configs/ConfigEditModal.jsx
frontend/src/docker/resources/configs/ConfigCompareModal.jsx
frontend/src/docker/resources/secrets/SecretEditModal.jsx
frontend/src/docker/resources/secrets/SecretCloneModal.jsx
frontend/src/docker/resources/stacks/UpdateStackModal.jsx
frontend/src/CreateManifestOverlay.jsx
frontend/src/layout/connection/AddKubeConfigOverlay.jsx
frontend/src/layout/connection/AddSwarmConnectionOverlay.jsx
+ 6 more modal files
```

---

### 1.7 Consolidate State Contexts

**Priority**: MEDIUM
**Estimated Savings**: 200-300 lines
**Effort**: 1 day
**Risk**: Medium

#### Problem Statement

`ClusterStateContext.jsx` (464 lines) and `SwarmStateContext.jsx` (638 lines) have:
- Identical reducer patterns (`SET_LOADING`, `SET_CONNECTION_STATUS`, etc.)
- Duplicate API wrapper calls
- Same refresh function patterns

#### Implementation

**Create shared context factory**: `frontend/src/state/createResourceContext.js`

```jsx
export function createResourceContext(config) {
  const {
    name,
    initialState,
    actions,
    refreshFunctions,
  } = config;

  const Context = createContext(null);

  function reducer(state, action) {
    switch (action.type) {
      case 'SET_LOADING':
        return { ...state, loading: action.loading };
      case 'SET_CONNECTION_STATUS':
        return { ...state, connectionStatus: action.status };
      default:
        // Dynamic SET_* handling
        if (action.type.startsWith('SET_')) {
          const key = action.type.replace('SET_', '').toLowerCase();
          return { ...state, [key]: action.data || [] };
        }
        return state;
    }
  }

  function Provider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    // Create refresh functions from config
    const refreshHandlers = useMemo(() => {
      return Object.entries(refreshFunctions).reduce((acc, [key, fn]) => {
        acc[key] = async () => {
          try {
            const data = await fn();
            dispatch({ type: `SET_${key.toUpperCase()}`, data });
          } catch (_) {
            dispatch({ type: `SET_${key.toUpperCase()}`, data: [] });
          }
        };
        return acc;
      }, {});
    }, []);

    return (
      <Context.Provider value={{ state, dispatch, ...refreshHandlers }}>
        {children}
      </Context.Provider>
    );
  }

  return { Context, Provider };
}
```

---

## Part 2: Frontend - Bundle Size Optimization

### 2.1 Dynamic Import CodeMirror

**Priority**: HIGH
**Estimated Savings**: 50-80 KB gzipped
**Effort**: 0.5 days
**Risk**: Low

#### Problem Statement

10 `@codemirror/*` packages are loaded in main bundle but only used in editor tabs.

#### Implementation

**Create lazy wrapper**: `frontend/src/components/CodeMirrorEditor/`

```jsx
// frontend/src/components/CodeMirrorEditor/index.jsx
import { lazy, Suspense } from 'react';

const CodeMirrorCore = lazy(() => import('./CodeMirrorCore'));

export function CodeMirrorEditor(props) {
  return (
    <Suspense fallback={<div className="editor-loading">Loading editor...</div>}>
      <CodeMirrorCore {...props} />
    </Suspense>
  );
}

// frontend/src/components/CodeMirrorEditor/CodeMirrorCore.jsx
import { EditorView } from '@codemirror/view';
import { EditorState } from '@codemirror/state';
// ... all CodeMirror imports

export default function CodeMirrorCore({ value, onChange, language, readOnly }) {
  // Actual CodeMirror implementation
}
```

#### Files to Modify
```
frontend/src/layout/bottompanel/LogViewerTab.jsx
frontend/src/layout/bottompanel/TextEditorTab.jsx
frontend/src/layout/bottompanel/TextViewerTab.jsx
frontend/src/layout/bottompanel/YamlTab.jsx
frontend/src/layout/bottompanel/FilesTab.jsx
frontend/src/k8s/resources/pods/PodFilesTab.jsx
frontend/src/CreateManifestOverlay.jsx
```

---

### 2.2 Configure Vite Manual Chunks

**Priority**: HIGH
**Estimated Savings**: 10-15 KB initial load, better caching
**Effort**: 2 hours
**Risk**: Low

#### Implementation

Update `frontend/vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // CodeMirror in separate chunks (loaded on demand)
          'codemirror-core': [
            '@codemirror/view',
            '@codemirror/state',
            '@codemirror/language',
          ],
          'codemirror-lang': [
            '@codemirror/lang-yaml',
            '@codemirror/autocomplete',
            '@codemirror/lint',
          ],
          'codemirror-extras': [
            '@codemirror/commands',
            '@codemirror/search',
            '@codemirror/theme-one-dark',
          ],

          // Holmes/markdown rendering
          'markdown': ['react-markdown', 'react-syntax-highlighter'],

          // Terminal
          'terminal': ['xterm', 'xterm-addon-fit'],

          // React core (vendor chunk)
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
    reportCompressedSize: true,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
      },
    },
  },
});
```

---

### 2.3 Replace uuid with crypto.randomUUID()

**Priority**: LOW
**Estimated Savings**: 2-3 KB
**Effort**: 30 minutes
**Risk**: None

#### Implementation

**File**: `frontend/src/layout/bottompanel/TerminalTab.jsx`

```jsx
// Before
import { v4 as uuidv4 } from 'uuid';
const id = uuidv4();

// After
const id = crypto.randomUUID();
```

Then remove `uuid` from `package.json` dependencies.

---

### 2.4 CSS Consolidation

**Priority**: MEDIUM
**Estimated Savings**: 500-800 lines
**Effort**: 1 day
**Risk**: Low

#### Problem Statement

5,607 lines across 27+ CSS files with duplicated patterns:
- `.error-message` defined multiple times
- `.create-button` and variants repeated
- Inline styles for context menus (~30 lines) repeated in 20+ components

#### Implementation

**Create shared CSS modules**: `frontend/src/styles/shared/`

```
frontend/src/styles/shared/
  buttons.css       # .create-button, .action-button, .danger-button
  panels.css        # .bottom-panel, .panel-header, .panel-content
  menus.css         # .context-menu, .menu-item, .menu-divider
  messages.css      # .error-message, .warning-message, .info-message
  tables.css        # .panel-table, .table-header, .table-row
  index.css         # @import all shared modules
```

**Example shared CSS**:
```css
/* frontend/src/styles/shared/menus.css */
.context-menu {
  position: absolute;
  right: 0;
  top: 100%;
  background: var(--gh-table-header-bg, #2d323b);
  border: 1px solid #353a42;
  border-radius: 6px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  z-index: 1200;
  min-width: 180px;
  text-align: left;
}

.context-menu-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  cursor: pointer;
  gap: 8px;
}

.context-menu-item:hover {
  background: var(--gh-table-hover-bg, #363b44);
}

.context-menu-item.danger {
  color: #f85149;
}
```

---

## Part 3: Backend - Go Code Consolidation

### 3.1 Generic Polling Function

**Priority**: HIGH
**Estimated Savings**: 300-400 lines
**Effort**: 0.5 days
**Risk**: Low

#### Problem Statement

14+ `Start*Polling()` functions with identical structure:

```go
// Repeated in deployments.go, statefulsets.go, daemonsets.go, etc.
func (a *App) StartDeploymentPolling() {
    go func() {
        for {
            time.Sleep(time.Second)
            if a.ctx == nil { continue }
            nsList := a.getPollingNamespaces()
            if len(nsList) == 0 { continue }
            var all []DeploymentInfo
            for _, ns := range nsList {
                items, err := a.GetDeployments(ns)
                if err != nil { continue }
                all = append(all, items...)
            }
            emitEvent(a.ctx, "deployments:update", all)
        }
    }()
}
```

#### Implementation

**Create**: `pkg/app/polling.go`

```go
package app

import (
    "time"
)

// ResourcePollingConfig configures a resource polling loop
type ResourcePollingConfig[T any] struct {
    EventName string
    FetchFn   func(namespace string) ([]T, error)
    Interval  time.Duration
}

// startResourcePolling starts a generic polling loop for any K8s resource type.
func startResourcePolling[T any](a *App, config ResourcePollingConfig[T]) {
    interval := config.Interval
    if interval == 0 {
        interval = time.Second
    }

    go func() {
        ticker := time.NewTicker(interval)
        defer ticker.Stop()

        for {
            <-ticker.C
            if a.ctx == nil {
                continue
            }

            nsList := a.getPollingNamespaces()
            if len(nsList) == 0 {
                continue
            }

            var all []T
            for _, ns := range nsList {
                items, err := config.FetchFn(ns)
                if err != nil {
                    continue
                }
                all = append(all, items...)
            }

            emitEvent(a.ctx, config.EventName, all)
        }
    }()
}
```

**Usage**:
```go
// deployments.go - AFTER (4 lines instead of 20+)
func (a *App) StartDeploymentPolling() {
    startResourcePolling(a, ResourcePollingConfig[DeploymentInfo]{
        EventName: "deployments:update",
        FetchFn:   a.GetDeployments,
    })
}
```

#### Files to Modify
```
pkg/app/deployments.go
pkg/app/statefulsets.go
pkg/app/daemonsets.go
pkg/app/cronjobs.go
pkg/app/jobs/jobs.go
pkg/app/services.go
pkg/app/configmaps.go
pkg/app/secrets.go
pkg/app/ingresses.go
pkg/app/replicasets.go
pkg/app/persistentvolumeclaims.go
pkg/app/persistentvolumes.go
pkg/app/pods.go
pkg/app/namespaces.go
```

---

### 3.2 Extract Resource Utilities

**Priority**: MEDIUM
**Estimated Savings**: 150-200 lines
**Effort**: 0.5 days
**Risk**: Low

#### Problem Statement

Identical helper functions in 6+ files:
- `get{Resource}Image()` - extracts first container image
- `merge{Resource}Labels()` - merges object and template labels
- `get{Resource}Replicas()` - safely extracts replica count

#### Implementation

**Create**: `pkg/app/resource_utils.go`

```go
package app

import (
    corev1 "k8s.io/api/core/v1"
)

// ExtractFirstContainerImage returns the image of the first container in a PodSpec.
func ExtractFirstContainerImage(spec corev1.PodSpec) string {
    if len(spec.Containers) > 0 {
        return spec.Containers[0].Image
    }
    return ""
}

// MergeLabels merges object labels with template labels.
// Template labels take precedence.
func MergeLabels(objectLabels, templateLabels map[string]string) map[string]string {
    result := make(map[string]string)
    for k, v := range objectLabels {
        result[k] = v
    }
    for k, v := range templateLabels {
        result[k] = v
    }
    return result
}

// SafeReplicaCount safely extracts replica count from a pointer.
func SafeReplicaCount(replicas *int32) int32 {
    if replicas != nil {
        return *replicas
    }
    return 0
}

// SafeLabels returns an empty map if labels is nil.
func SafeLabels(labels map[string]string) map[string]string {
    if labels == nil {
        return make(map[string]string)
    }
    return labels
}
```

**Usage**:
```go
// deployments.go - BEFORE
func getDeploymentImage(spec appsv1.DeploymentSpec) string {
    if len(spec.Template.Spec.Containers) > 0 {
        return spec.Template.Spec.Containers[0].Image
    }
    return ""
}

// deployments.go - AFTER
image := ExtractFirstContainerImage(deployment.Spec.Template.Spec)
```

---

### 3.3 Docker Handler Factory

**Priority**: MEDIUM
**Estimated Savings**: 300-400 lines
**Effort**: 1 day
**Risk**: Medium

#### Problem Statement

7 Docker resource handlers with identical List/Get patterns in `pkg/app/docker/`:
- services.go, tasks.go, nodes.go, networks.go, volumes.go, configs.go, secrets.go

Each follows:
```go
func GetSwarm{Resource}(ctx, cli) ([]Info, error) {
    return getSwarm{Resource}(ctx, cli)
}

func getSwarm{Resource}(ctx, cli) ([]Info, error) {
    items, err := cli.{Resource}List(ctx, options)
    if err != nil { return nil, err }
    result := make([]Info, 0, len(items))
    for _, item := range items {
        result = append(result, {resource}ToInfo(item))
    }
    return result, nil
}
```

#### Implementation

**Create**: `pkg/app/docker/resource_handler.go`

```go
package docker

import (
    "context"
)

// ListAndConvert is a generic function for listing Docker resources and converting to info types.
func ListAndConvert[T any, InfoT any](
    ctx context.Context,
    listFn func(context.Context) ([]T, error),
    convertFn func(T) InfoT,
) ([]InfoT, error) {
    items, err := listFn(ctx)
    if err != nil {
        return nil, err
    }

    result := make([]InfoT, 0, len(items))
    for _, item := range items {
        result = append(result, convertFn(item))
    }
    return result, nil
}
```

**Usage**:
```go
// configs.go - AFTER
func GetSwarmConfigs(ctx context.Context, cli *client.Client) ([]SwarmConfigInfo, error) {
    return ListAndConvert(
        ctx,
        func(ctx context.Context) ([]swarm.Config, error) {
            return cli.ConfigList(ctx, types.ConfigListOptions{})
        },
        configToInfo,
    )
}
```

---

### 3.4 Holmes Context Builder Consolidation

**Priority**: LOW
**Estimated Savings**: 100-150 lines
**Effort**: 0.5 days
**Risk**: Medium

#### Problem Statement

`holmes_context.go` has 5+ context builders sharing 70% code:
- `getPodContext()`, `getDeploymentContext()`, `getServiceContext()`, etc.

#### Implementation

Create generic context builder with resource-specific adapters:

```go
// pkg/app/holmes_context_builder.go

type ResourceContextAdapter interface {
    FetchResource(ctx context.Context, namespace, name string) (interface{}, error)
    GetPodSelector(resource interface{}) (string, string) // namespace, labelSelector
    FormatResourceInfo(resource interface{}) string
}

func buildResourceContext(
    ctx context.Context,
    a *App,
    adapter ResourceContextAdapter,
    namespace, name string,
    emitProgress func(step string),
) (string, error) {
    emitProgress("Fetching resource details...")
    resource, err := adapter.FetchResource(ctx, namespace, name)
    if err != nil {
        return "", err
    }

    var sb strings.Builder
    sb.WriteString(adapter.FormatResourceInfo(resource))

    // Get related pods
    emitProgress("Fetching related pods...")
    podNs, selector := adapter.GetPodSelector(resource)
    if selector != "" {
        pods, _ := a.GetPodsBySelector(podNs, selector)
        sb.WriteString(formatPodsSection(pods))
    }

    // Get events
    emitProgress("Fetching events...")
    events, _ := a.GetResourceEvents(namespace, name)
    sb.WriteString(formatEventsSection(events))

    return sb.String(), nil
}
```

---

## Part 4: Quality Metrics & Testing

### 4.1 Test Coverage Requirements

All new code must meet 70% coverage per CLAUDE.md:

| Component | Min Coverage |
|-----------|--------------|
| GenericResourceTable | 70% |
| useHolmesAnalysis | 80% |
| **useAsyncData** | 80% |
| **useEventSubscription** | 80% |
| useTableState | 70% |
| useTableData | 70% |
| **GenericInspectTab** | 70% |
| **BaseModal** | 70% |
| pkg/app/polling.go | 70% |
| pkg/app/resource_utils.go | 80% |
| pkg/app/docker/resource_handler.go | 70% |

### 4.2 E2E Test Verification

After each phase:
- [ ] All K8s E2E tests pass: `cd e2e && npx playwright test`
- [ ] All Swarm E2E tests pass: `cd e2e && npx playwright test tests/swarm/`

### 4.3 Bundle Size Tracking

Add to CI pipeline:
```yaml
- name: Build and Report Bundle Size
  run: |
    cd frontend && npm run build
    echo "## Bundle Size" >> $GITHUB_STEP_SUMMARY
    du -sh dist/assets/*.js | sort -rh >> $GITHUB_STEP_SUMMARY
```

---

## Implementation Schedule

### Phase 1: Foundation (Week 1)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Create GenericResourceTable core | Working table component |
| 3 | Create useHolmesAnalysis hook | Tested hook |
| 3 | **Create useAsyncData, useEventSubscription hooks** | Tested utility hooks |
| 4 | Create useTableState, useTableData hooks | Supporting hooks |
| 4 | **Create GenericInspectTab component** | Tested component |
| 5 | **Create BaseModal component** | Tested modal wrapper |
| 5 | Migrate first 5 simple tables | ConfigMaps, Secrets, Ingresses, PVs, PVCs |

### Phase 2: Migration (Week 2)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Migrate workload tables | Deployments, StatefulSets, DaemonSets |
| 1 | **Migrate 4 InspectTab components** | Using GenericInspectTab |
| 2 | Migrate job tables | Jobs, CronJobs, ReplicaSets |
| 2 | **Migrate 8 modal components to BaseModal** | First batch of modals |
| 3 | Migrate Swarm tables | All 8 Swarm resource tables |
| 3 | **Migrate remaining 9 modal components** | All modals using BaseModal |
| 4 | Migrate complex tables | Services, Pods |
| 5 | Testing and bug fixes | All E2E tests passing |

### Phase 3: Backend & Bundle (Week 3)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1 | Generic polling function | pkg/app/polling.go |
| 2 | Resource utilities | pkg/app/resource_utils.go |
| 3 | Docker handler factory | pkg/app/docker/resource_handler.go |
| 4 | Vite chunk config + CodeMirror lazy loading | Updated vite.config.js |
| 5 | CSS consolidation | Shared CSS modules |

### Phase 4: Polish (Week 4)

| Day | Task | Deliverable |
|-----|------|-------------|
| 1-2 | Holmes context consolidation | Refactored holmes_context.go |
| 3 | State context factory | createResourceContext.js |
| 4 | Merge time/date utils | dateTimeUtils.js |
| 5 | Final testing, documentation | Complete implementation |

---

## Success Metrics

### Code Size
- [ ] Frontend: -3,700+ lines (was -2,500+)
- [ ] Backend: -800+ lines
- [ ] CSS: -500+ lines
- [ ] **Total: -5,000+ lines** (was -3,800+)

### Detailed Breakdown
| Category | Target |
|----------|--------|
| OverviewTable consolidation | -2,000 to -3,000 lines |
| useAsyncData hook adoption | -300 to -400 lines |
| useEventSubscription adoption | -150 to -200 lines |
| GenericInspectTab migration | -150 to -180 lines |
| BaseModal migration | -250 to -350 lines |
| useHolmesAnalysis adoption | -500 to -800 lines |
| State context refactoring | -200 to -300 lines |
| Go polling generics | -300 to -400 lines |
| Go resource utilities | -150 to -200 lines |
| Docker handler factory | -300 to -400 lines |

### Bundle Size
- [ ] Initial load: -40 KB gzipped
- [ ] CodeMirror in lazy chunk
- [ ] Proper vendor chunking

### Quality
- [ ] All E2E tests pass
- [ ] Test coverage >= 70% for new code
- [ ] No visual regressions
- [ ] No performance regressions

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| GenericResourceTable doesn't handle all edge cases | Medium | High | Comprehensive test suite; gradual migration |
| Bundle splitting causes loading issues | Low | Medium | Test on slow networks; add loading states |
| Holmes hook migration breaks streaming | Low | High | Unit tests for all event types |
| CSS consolidation causes visual regressions | Medium | Low | Visual diff testing; manual QA |
| **useAsyncData hook doesn't cover all fetch patterns** | Low | Medium | Review all fetch patterns before implementation |
| **BaseModal doesn't match all existing modal designs** | Medium | Low | Start with most common pattern; extend as needed |
| **InspectTab migration misses resource-specific features** | Low | Low | Verify each InspectTab has no custom logic |

---

## Appendix: Complete File List

### Files to Create

**Frontend**:
```
frontend/src/components/GenericResourceTable/
  index.jsx
  useTableState.js
  useTableData.js
  TableColumns.jsx
  BottomPanel.jsx
  SearchFilter.jsx
  ContextMenu.jsx
  __tests__/GenericResourceTable.test.jsx

frontend/src/hooks/useHolmesAnalysis.js
frontend/src/__tests__/useHolmesAnalysis.test.js

# NEW: Utility hooks
frontend/src/hooks/useAsyncData.js
frontend/src/__tests__/useAsyncData.test.js
frontend/src/hooks/useEventSubscription.js
frontend/src/__tests__/useEventSubscription.test.js

# NEW: Generic components
frontend/src/components/GenericInspectTab.jsx
frontend/src/__tests__/GenericInspectTab.test.jsx
frontend/src/components/BaseModal/
  index.jsx
  BaseModal.css
frontend/src/__tests__/BaseModal.test.jsx

frontend/src/state/createResourceContext.js

frontend/src/components/CodeMirrorEditor/
  index.jsx
  CodeMirrorCore.jsx

frontend/src/config/resourceConfigs/
  (22 config files)
  index.js

frontend/src/styles/shared/
  buttons.css
  panels.css
  menus.css
  messages.css
  tables.css
  index.css

frontend/src/utils/dateTimeUtils.js
```

**Backend**:
```
pkg/app/polling.go
pkg/app/polling_test.go
pkg/app/resource_utils.go
pkg/app/resource_utils_test.go
pkg/app/docker/resource_handler.go
pkg/app/docker/resource_handler_test.go
pkg/app/holmes_context_builder.go
```

### Files to Significantly Modify

**Frontend** (22 OverviewTable files):
```
frontend/src/k8s/resources/pods/PodOverviewTable.jsx
frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.jsx
frontend/src/k8s/resources/services/ServicesOverviewTable.jsx
frontend/src/k8s/resources/statefulsets/StatefulSetsOverviewTable.jsx
frontend/src/k8s/resources/daemonsets/DaemonSetsOverviewTable.jsx
frontend/src/k8s/resources/jobs/JobsOverviewTable.jsx
frontend/src/k8s/resources/cronjobs/CronJobsOverviewTable.jsx
frontend/src/k8s/resources/configmaps/ConfigMapsOverviewTable.jsx
frontend/src/k8s/resources/secrets/SecretsOverviewTable.jsx
frontend/src/k8s/resources/ingresses/IngressesOverviewTable.jsx
frontend/src/k8s/resources/replicasets/ReplicaSetsOverviewTable.jsx
frontend/src/k8s/resources/persistentvolumes/PersistentVolumesOverviewTable.jsx
frontend/src/k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable.jsx
frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx
frontend/src/docker/resources/tasks/SwarmTasksOverviewTable.jsx
frontend/src/docker/resources/nodes/SwarmNodesOverviewTable.jsx
frontend/src/docker/resources/networks/SwarmNetworksOverviewTable.jsx
frontend/src/docker/resources/configs/SwarmConfigsOverviewTable.jsx
frontend/src/docker/resources/secrets/SwarmSecretsOverviewTable.jsx
frontend/src/docker/resources/volumes/SwarmVolumesOverviewTable.jsx
frontend/src/docker/resources/stacks/SwarmStacksOverviewTable.jsx
```

**Frontend** (4 InspectTab files → GenericInspectTab):
```
frontend/src/docker/resources/configs/ConfigInspectTab.jsx
frontend/src/docker/resources/secrets/SecretInspectTab.jsx
frontend/src/docker/resources/networks/NetworkInspectTab.jsx
frontend/src/docker/resources/volumes/VolumeInspectTab.jsx
```

**Frontend** (17 Modal files → BaseModal):
```
frontend/src/docker/resources/services/ImageUpdateModal.jsx
frontend/src/docker/resources/services/ImageUpdateSettingsModal.jsx
frontend/src/docker/resources/services/UpdateServiceImageModal.jsx
frontend/src/docker/resources/configs/ConfigEditModal.jsx
frontend/src/docker/resources/configs/ConfigCompareModal.jsx
frontend/src/docker/resources/secrets/SecretEditModal.jsx
frontend/src/docker/resources/secrets/SecretCloneModal.jsx
frontend/src/docker/resources/stacks/UpdateStackModal.jsx
frontend/src/CreateManifestOverlay.jsx
frontend/src/layout/connection/AddKubeConfigOverlay.jsx
frontend/src/layout/connection/AddSwarmConnectionOverlay.jsx
frontend/src/layout/connection/ConnectionProxySettings.jsx
frontend/src/holmes/HolmesConfigModal.jsx
frontend/src/k8s/resources/cronjobs/CreateJobModal.jsx
frontend/src/k8s/resources/pods/PortForwardModal.jsx
frontend/src/k8s/DeleteConfirmModal.jsx
frontend/src/docker/DeleteConfirmModal.jsx
```

**Backend** (14+ polling files):
```
pkg/app/deployments.go
pkg/app/statefulsets.go
pkg/app/daemonsets.go
pkg/app/cronjobs.go
pkg/app/jobs/jobs.go
pkg/app/services.go
pkg/app/configmaps.go
pkg/app/secrets.go
pkg/app/ingresses.go
pkg/app/replicasets.go
pkg/app/persistentvolumeclaims.go
pkg/app/persistentvolumes.go
pkg/app/pods.go
pkg/app/namespaces.go
pkg/app/docker/configs.go
pkg/app/docker/secrets.go
pkg/app/docker/volumes.go
pkg/app/docker/services.go
pkg/app/docker/tasks.go
pkg/app/docker/nodes.go
pkg/app/docker/networks.go
```

### Files to Delete (after migration)
```
frontend/src/utils/timeUtils.js       (merged into dateTimeUtils.js)
frontend/src/utils/dateUtils.js       (merged into dateTimeUtils.js)
```
