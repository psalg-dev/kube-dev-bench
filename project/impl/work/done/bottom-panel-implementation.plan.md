# Docker Swarm Bottom Panel Improvements - Implementation Plan

**Status:** DONE
**Created:** 2026-02-06
**Updated:** 2026-02-06 (verified)

This document provides a detailed implementation checklist for improving Docker Swarm bottom panels to achieve consistency with K8s.

## Current Status (Verified 2026-02-06)

- All checklist items below are implemented in the current codebase.
- Swarm empty-state messages and helpers live in [frontend/src/constants/emptyTabMessages.ts](frontend/src/constants/emptyTabMessages.ts).
- Empty content rendering uses [frontend/src/components/EmptyTabContent.tsx](frontend/src/components/EmptyTabContent.tsx) across Swarm tabs and sections.
- Swarm task/node empty states and summary list normalization are implemented in [frontend/src/docker/resources/tasks/SwarmTasksOverviewTable.tsx](frontend/src/docker/resources/tasks/SwarmTasksOverviewTable.tsx), [frontend/src/docker/resources/nodes/NodeLogsTab.tsx](frontend/src/docker/resources/nodes/NodeLogsTab.tsx), and [frontend/src/docker/resources/services/SwarmServicesOverviewTable.tsx](frontend/src/docker/resources/services/SwarmServicesOverviewTable.tsx).
- Note: file extensions are .ts/.tsx in the current codebase; .js/.jsx references below are historical.

---

## Phase 1: Empty State Infrastructure (Priority: High)

### 1.1 Extend emptyTabMessages.js

**File**: `frontend/src/constants/emptyTabMessages.js`

- [ ] Add Swarm services and tasks messages
  ```javascript
  'swarm-services': { icon: '🐳', title: 'No services found', ... }
  'swarm-tasks': { icon: '📦', title: 'No tasks running', ... }
  'swarm-stack-services': { icon: '🐳', title: 'No services in this stack', ... }
  ```

- [ ] Add Swarm network-related messages
  ```javascript
  'swarm-connected-services': { icon: '🌐', title: 'No services attached', ... }
  'swarm-containers': { icon: '🐋', title: 'No containers attached', ... }
  'swarm-options': { icon: '⚙️', title: 'No driver options', ... }
  'swarm-ipam': { icon: '🌐', title: 'No IPAM configuration', ... }
  ```

- [ ] Add Swarm stack resource messages
  ```javascript
  'swarm-stack-networks': { icon: '🌐', title: 'No networks found', ... }
  'swarm-stack-volumes': { icon: '💾', title: 'No volumes found', ... }
  'swarm-stack-configs': { icon: '⚙️', title: 'No configs found', ... }
  'swarm-stack-secrets': { icon: '🔐', title: 'No secrets found', ... }
  ```

- [ ] Add Swarm "Used By" messages
  ```javascript
  'swarm-config-usedby': { icon: '🔗', title: 'Not in use', ... }
  'swarm-secret-usedby': { icon: '🔗', title: 'Not in use', ... }
  'swarm-volume-usedby': { icon: '🔗', title: 'Not in use', ... }
  ```

- [ ] Add Swarm task unavailable messages
  ```javascript
  'swarm-task-logs': { icon: '📜', title: 'Logs unavailable', ... }
  'swarm-task-exec': { icon: '💻', title: 'Exec unavailable', ... }
  ```

- [ ] Add Swarm node messages
  ```javascript
  'swarm-node-logs': { icon: '📜', title: 'No logs available', ... }
  'swarm-node-tasks': { icon: '📦', title: 'No tasks on this node', ... }
  ```

- [ ] Add Swarm summary empty list messages
  ```javascript
  'swarm-no-env': { icon: '📝', title: 'No environment variables', ... }
  'swarm-no-mounts': { icon: '💾', title: 'No mounts configured', ... }
  'swarm-no-ports': { icon: '🔌', title: 'No ports published', ... }
  'swarm-no-constraints': { icon: '📐', title: 'No placement constraints', ... }
  ```

- [ ] Add helper function `getSwarmEmptyTabMessage(tabType)`

---

## Phase 2: Refactor "Used By" Sections (Priority: High)

### 2.1 ConfigUsedBySection.jsx

**File**: `frontend/src/docker/resources/configs/ConfigUsedBySection.jsx`

- [ ] Import EmptyTabContent and getEmptyTabMessage
  ```javascript
  import EmptyTabContent from '../../../components/EmptyTabContent';
  import { getEmptyTabMessage } from '../../../constants/emptyTabMessages';
  ```

- [ ] Replace inline empty state with EmptyTabContent
  ```jsx
  // Before:
  <div style={{ color: 'var(--gh-text-secondary)' }}>No services reference this config.</div>
  
  // After:
  const emptyMsg = getEmptyTabMessage('swarm-config-usedby');
  <EmptyTabContent icon={emptyMsg.icon} title={emptyMsg.title} description={emptyMsg.description} tip={emptyMsg.tip} />
  ```

### 2.2 SecretUsedBySection.jsx

**File**: `frontend/src/docker/resources/secrets/SecretUsedBySection.jsx`

- [ ] Import EmptyTabContent and getEmptyTabMessage
- [ ] Replace inline empty state with EmptyTabContent using `'swarm-secret-usedby'`

### 2.3 VolumeUsedBySection.jsx

**File**: `frontend/src/docker/resources/volumes/VolumeUsedBySection.jsx`

- [ ] Import EmptyTabContent and getEmptyTabMessage
- [ ] Replace inline empty state with EmptyTabContent using `'swarm-volume-usedby'`

---

## Phase 3: Refactor Stack Resource Tabs (Priority: High)

### 3.1 StackResourcesTab.jsx

**File**: `frontend/src/docker/resources/stacks/StackResourcesTab.jsx`

- [ ] Import EmptyTabContent and getEmptyTabMessage
- [ ] Create resource-to-message mapping
  ```javascript
  const resourceMessageMap = {
    networks: 'swarm-stack-networks',
    volumes: 'swarm-stack-volumes',
    configs: 'swarm-stack-configs',
    secrets: 'swarm-stack-secrets',
  };
  ```
- [ ] Replace `Empty` component with EmptyTabContent

### 3.2 StackServicesTab.jsx

**File**: `frontend/src/docker/resources/stacks/StackServicesTab.jsx`

- [ ] Import EmptyTabContent and getEmptyTabMessage
- [ ] Replace `.stack-services-empty` div with EmptyTabContent using `'swarm-stack-services'`

---

## Phase 4: Refactor Network Sections (Priority: Medium)

### 4.1 NetworkConnectedServicesSection.jsx

**File**: `frontend/src/docker/resources/networks/NetworkConnectedServicesSection.jsx`

- [ ] Import EmptyTabContent and getEmptyTabMessage
- [ ] Replace inline empty state with EmptyTabContent using `'swarm-connected-services'`

### 4.2 NetworkConnectedContainersSection.jsx

**File**: `frontend/src/docker/resources/networks/NetworkConnectedContainersSection.jsx`

- [ ] Import EmptyTabContent and getEmptyTabMessage
- [ ] Replace inline empty state with EmptyTabContent using `'swarm-containers'`

### 4.3 NetworkDetailsSections.jsx

**File**: `frontend/src/docker/resources/networks/NetworkDetailsSections.jsx`

- [ ] Import EmptyTabContent and getEmptyTabMessage
- [ ] Update `NetworkOptionsSection` empty state using `'swarm-options'`
- [ ] Update `NetworkIPAMSection` empty state using `'swarm-ipam'`

---

## Phase 5: Refactor Task/Node Unavailable States (Priority: Medium)

### 5.1 SwarmTasksOverviewTable.jsx

**File**: `frontend/src/docker/resources/tasks/SwarmTasksOverviewTable.jsx`

- [ ] Import EmptyTabContent and getEmptyTabMessage
- [ ] Update Logs tab empty state (line ~321) using `'swarm-task-logs'`
- [ ] Update Exec tab empty state (line ~338) using `'swarm-task-exec'`

### 5.2 NodeLogsTab.jsx

**File**: `frontend/src/docker/resources/nodes/NodeLogsTab.jsx`

- [ ] Import EmptyTabContent and getEmptyTabMessage
- [ ] Replace inline empty state using `'swarm-node-logs'`

---

## Phase 6: Fix Array Display in Summary (Priority: Medium)

### 6.1 SwarmServicesOverviewTable.jsx

**File**: `frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx`

- [ ] Update Environment Variables `getValue` to handle empty arrays
  ```javascript
  getValue: (d) => {
    const env = Array.isArray(d.env) ? d.env : [];
    if (!env.length) return null; // or ['None configured']
    return env.map(maskEnv);
  },
  ```

- [ ] Update Mounts `getValue` to handle empty arrays
- [ ] Update Ports `getValue` to handle empty arrays
- [ ] Update Placement Constraints `getValue` to handle empty arrays
- [ ] Update Placement Preferences `getValue` to handle empty arrays
- [ ] Update Update Config `getValue` to handle empty arrays
- [ ] Update Resources `getValue` to handle empty arrays

### 6.2 QuickInfoSection.jsx (Optional)

**File**: `frontend/src/QuickInfoSection.jsx`

- [ ] Consider adding prop to hide fields with null/empty values
- [ ] Consider adding `emptyText` prop for custom empty display

---

## Phase 7: Add Tab Counts (Priority: Medium)

### 7.1 SwarmStacksOverviewTable.jsx

**File**: `frontend/src/docker/resources/stacks/SwarmStacksOverviewTable.jsx`

- [ ] Update bottomTabs array with countKey properties
  ```javascript
  const bottomTabs = [
    { key: 'summary', label: 'Summary' },
    { key: 'services', label: 'Services', countKey: 'services' },
    { key: 'networks', label: 'Networks', countKey: 'networks' },
    { key: 'volumes', label: 'Volumes', countKey: 'volumes' },
    { key: 'configs', label: 'Configs', countKey: 'configs' },
    { key: 'secrets', label: 'Secrets', countKey: 'secrets' },
    { key: 'compose', label: 'Compose File' },
  ];
  ```

- [ ] Implement count fetching logic (may need backend support)
- [ ] Pass counts to OverviewTableWithPanel

### 7.2 SwarmServicesOverviewTable.jsx

**File**: `frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx`

- [ ] Add `countKey: 'tasks'` to Tasks tab
- [ ] Implement task count fetching

### 7.3 SwarmNetworksOverviewTable.jsx

**File**: `frontend/src/docker/resources/networks/SwarmNetworksOverviewTable.jsx`

- [ ] Add `countKey: 'services'` to Connected Services tab
- [ ] Add `countKey: 'containers'` to Containers tab
- [ ] Implement count fetching

### 7.4 SwarmNodesOverviewTable.jsx

**File**: `frontend/src/docker/resources/nodes/SwarmNodesOverviewTable.jsx`

- [ ] Add `countKey: 'tasks'` to Tasks tab
- [ ] Implement task count fetching

---

## Phase 8: Enrich Stack Summary (Priority: Medium)

### 8.1 SwarmStacksOverviewTable.jsx

**File**: `frontend/src/docker/resources/stacks/SwarmStacksOverviewTable.jsx`

- [ ] Add new quickInfoFields
  ```javascript
  const quickInfoFields = [
    { key: 'name', label: 'Stack Name' },
    { key: 'services', label: 'Services' },
    { key: 'networks', label: 'Networks', getValue: (d) => d.networkCount ?? '-' },
    { key: 'volumes', label: 'Volumes', getValue: (d) => d.volumeCount ?? '-' },
    { key: 'configs', label: 'Configs', getValue: (d) => d.configCount ?? '-' },
    { key: 'secrets', label: 'Secrets', getValue: (d) => d.secretCount ?? '-' },
    { key: 'orchestrator', label: 'Orchestrator' },
  ];
  ```

- [ ] Fetch resource counts in StackSummaryPanel useEffect
- [ ] Update backend if needed to return counts with stack data

---

## Phase 9: Expand Holmes AI (Priority: Low)

### 9.1 SwarmNodesOverviewTable.jsx

**File**: `frontend/src/docker/resources/nodes/SwarmNodesOverviewTable.jsx`

- [ ] Add Holmes tab to bottomTabs array
  ```javascript
  { key: 'holmes', label: 'Holmes' }
  ```

- [ ] Import Holmes components
  ```javascript
  import HolmesBottomPanel from '../../../holmes/HolmesBottomPanel.jsx';
  import { AnalyzeSwarmNodeStream, CancelHolmesStream, ... } from '../../../holmes/holmesApi';
  ```

- [ ] Add holmesState and handlers
- [ ] Implement renderPanelContent case for 'holmes' tab
- [ ] Create backend function `AnalyzeSwarmNodeStream` if not exists

### 9.2 SwarmStacksOverviewTable.jsx

**File**: `frontend/src/docker/resources/stacks/SwarmStacksOverviewTable.jsx`

- [ ] Add Holmes tab to bottomTabs array
- [ ] Import Holmes components
- [ ] Add holmesState and handlers
- [ ] Implement renderPanelContent case for 'holmes' tab
- [ ] Create backend function `AnalyzeSwarmStackStream` if not exists

---

## Phase 10: Additional Improvements (Priority: Low)

### 10.1 Rename Inspect to JSON

**Files to modify**:
- [ ] `SwarmNetworksOverviewTable.jsx` - Change tab label from "Inspect" to "JSON"
- [ ] `SwarmConfigsOverviewTable.jsx` - Change tab label from "Inspect" to "JSON"
- [ ] `SwarmSecretsOverviewTable.jsx` - Change tab label from "Inspect" to "JSON"
- [ ] `SwarmVolumesOverviewTable.jsx` - Change tab label from "Inspect" to "JSON"

### 10.2 Add Syntax Highlighting to Config Data

**File**: `frontend/src/docker/resources/configs/ConfigDataTab.jsx`

- [ ] Detect content type (JSON, YAML, INI, plain text)
- [ ] Apply appropriate CodeMirror mode
- [ ] Add content type indicator in UI

### 10.3 Secret Reveal Option

**File**: `frontend/src/docker/resources/secrets/SecretEditModal.jsx`

- [ ] Add "Reveal" toggle button
- [ ] Implement security confirmation dialog
- [ ] Toggle between masked/unmasked input

---

## Testing Checklist

### Empty States

- [ ] Test ConfigUsedBySection with no consumers
- [ ] Test SecretUsedBySection with no consumers
- [ ] Test VolumeUsedBySection with no consumers
- [ ] Test StackResourcesTab with empty networks/volumes/configs/secrets
- [ ] Test StackServicesTab with no services
- [ ] Test NetworkConnectedServicesSection with no services
- [ ] Test NetworkConnectedContainersSection with no containers
- [ ] Test NetworkOptionsSection with no options
- [ ] Test NetworkIPAMSection with no IPAM config
- [ ] Test Task Logs/Exec tabs when container unavailable
- [ ] Test Node Logs tab with no tasks

### Tab Counts

- [ ] Verify Stack tab counts update correctly
- [ ] Verify Service task count updates on scale
- [ ] Verify Network service/container counts
- [ ] Verify Node task count

### Summary Fields

- [ ] Verify Services summary shows "None" for empty lists
- [ ] Verify Stack summary shows resource counts

### Holmes

- [ ] Test Holmes analysis on Nodes
- [ ] Test Holmes analysis on Stacks

---

## Estimated Timeline

| Phase | Description | Effort | Dependencies |
|-------|-------------|--------|--------------|
| 1 | Empty State Infrastructure | 1-2 hours | None |
| 2 | Used By Sections | 1 hour | Phase 1 |
| 3 | Stack Resource Tabs | 1 hour | Phase 1 |
| 4 | Network Sections | 1 hour | Phase 1 |
| 5 | Task/Node States | 1 hour | Phase 1 |
| 6 | Array Display Fix | 1 hour | None |
| 7 | Tab Counts | 2-3 hours | May need backend |
| 8 | Stack Summary | 1 hour | May need backend |
| 9 | Holmes Expansion | 2-3 hours | Backend functions |
| 10 | Additional | 2-3 hours | None |

**Total Estimated Effort**: 13-17 hours

---

## Notes

- Phases 1-5 can be done together as they focus on EmptyTabContent adoption
- Phase 6 is independent and can be done in parallel
- Phases 7-8 may require backend changes for count data
- Phase 9 requires new Holmes analysis functions
- Phase 10 items are nice-to-haves and can be deferred

---

*Created: January 27, 2026*

