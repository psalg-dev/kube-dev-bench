# Docker Swarm Bottom Panel Tabs - Detailed Analysis

This document provides a comprehensive analysis of all Docker Swarm bottom panel tabs, with special focus on summary tabs, empty states, and consistency with the Kubernetes implementation.

## Executive Summary

The Docker Swarm bottom panels have evolved significantly and now include rich functionality. However, there are several areas where improvements could enhance user experience:

1. **Summary Tab Information Density**: Some summary tabs are sparse while others are feature-rich
2. **Empty State Consistency**: Empty states are handled but could be more consistent and space-efficient
3. **K8s Consistency**: Several patterns from K8s could be applied to Swarm for better UX parity

---

## Resource-by-Resource Analysis

### 1. Services (`SwarmServicesOverviewTable.jsx`)

**Tabs Available:**
- Summary ✅
- Tasks ✅
- Placement ✅
- Logs ✅
- Holmes ✅

**Summary Tab Content:**

| Field | Present | Type | Notes |
|-------|---------|------|-------|
| Mode | ✅ | flex | Paired with Replicas |
| Running Tasks | ✅ | flex | Paired with Created date |
| Image | ✅ | break-word | Full image path |
| Ports | ✅ | list | Published:Target/Protocol (PublishMode) |
| Environment Variables | ✅ | list | Masked values (key=\<hidden\>) |
| Mounts | ✅ | list | type:source -> target (ro) |
| Update Config | ✅ | list | parallelism, delay, failureAction, monitor, maxFailureRatio, order |
| Resources | ✅ | list | limits.cpu, limits.mem, reservations.cpu, reservations.mem |
| Placement Constraints | ✅ | list | From placement spec |
| Placement Preferences | ✅ | list | From placement spec |
| Service ID | ✅ | break-word | Full ID |

**Assessment: ⭐⭐⭐⭐⭐ EXCELLENT**

The Services summary tab is the most comprehensive. It includes:
- Update Image modal with version selection
- Scale, Restart, Delete actions
- All critical service configuration displayed

**Empty States:**
- Environment Variables: Shows `[]` if empty (could be "No environment variables")
- Mounts: Shows `[]` if empty (could be "No mounts")
- Update Config: Shows `[]` if empty

**Recommendations:**
1. Consider showing "None" or "-" for empty list fields instead of `[]`
2. Add dedicated Network section showing attached networks

---

### 2. Tasks (`SwarmTasksOverviewTable.jsx`)

**Tabs Available:**
- Summary ✅
- Logs ✅
- Exec ✅
- Holmes ✅

**Summary Tab Content:**

| Field | Present | Type | Notes |
|-------|---------|------|-------|
| Task ID | ✅ | break-word | Full task ID |
| Service ID | ✅ | break-word | Reference to parent service |
| Service Name | ✅ | text | Human-readable |
| Node ID | ✅ | break-word | Full node ID |
| Node Name | ✅ | text | Human-readable |
| Slot | ✅ | text | Replica slot number |
| State | ✅ | flex | Paired with Desired State |
| Health | ✅ | text | "none" if not configured |
| Container ID | ✅ | break-word | Full container ID |
| Image | ✅ | break-word | Full image path |
| Networks | ✅ | list | Network ID + addresses |
| Mounts | ✅ | list | Mount definitions |
| Error | ✅ | break-word | Task error if any |
| Created | ✅ | date | Timestamp |
| Updated | ✅ | date | Timestamp |

**Additional Right Panel Content:**
- Timeline (derived) section with Created, Updated, Current State, Desired State
- Health Check section (if applicable) with health check logs

**Assessment: ⭐⭐⭐⭐⭐ EXCELLENT**

Very comprehensive task information with health check history.

**Empty States:**
- Logs tab: "No container associated with this task yet." ✅
- Exec tab: "No container associated with this task yet." ✅
- Networks: Shows empty list
- Mounts: Shows empty list
- Health Check section: "No health check configured" or hidden if not applicable

**Recommendations:**
1. Networks and Mounts could show "No networks attached" / "No mounts configured" for clarity

---

### 3. Nodes (`SwarmNodesOverviewTable.jsx`)

**Tabs Available:**
- Summary ✅
- Tasks ✅
- Logs ✅
- Labels ✅

**Summary Tab Content:**

| Field | Present | Type | Notes |
|-------|---------|------|-------|
| Node ID | ✅ | break-word | Full node ID |
| Hostname | ✅ | text | |
| Role | ✅ | flex | Paired with Leader (Yes/No) |
| Availability | ✅ | flex | Paired with State |
| Address | ✅ | text | |
| Docker Version | ✅ | text | Engine version |
| Platform | ✅ | text | OS / Architecture |
| Capacity | ✅ | flex | CPU cores paired with Memory |
| TLS Trust Root | ⚡ | break-word | Only for manager nodes |
| TLS Issuer Subject | ⚡ | break-word | Only for manager nodes |
| TLS Issuer Public Key | ⚡ | break-word | Only for manager nodes |

**Actions:**
- Promote (worker only)
- Demote (manager only, not leader)
- Drain / Activate
- Delete (workers only)

**Assessment: ⭐⭐⭐⭐⭐ EXCELLENT**

Comprehensive node information with role-specific actions and conditional TLS information.

**Empty States:**
- Tasks tab: Standard table with empty state handling
- Logs tab: "No tasks with containers were found for this node."
- Labels tab: Shows empty labels editor if no labels

**Recommendations:**
1. Consider showing node resource usage (if Docker stats API available)

---

### 4. Networks (`SwarmNetworksOverviewTable.jsx`)

**Tabs Available:**
- Summary ✅
- Connected Services ✅
- Containers ✅
- Inspect ✅

**Summary Tab Content:**

| Field | Present | Type | Notes |
|-------|---------|------|-------|
| Network ID | ✅ | break-word | Full ID |
| Name | ✅ | text | |
| Driver | ✅ | text | overlay, bridge, etc. |
| Scope | ✅ | text | swarm, local |
| Attachable | ✅ | text | Yes/No |
| Internal | ✅ | text | Yes/No |
| Labels | ✅ | labels | Label display |
| Created | ✅ | date | |

**Right Panel Sections:**
- Options section (driver options key=value)
- IPAM section (subnet, gateway, ipRange, aux addresses)

**Assessment: ⭐⭐⭐⭐⭐ EXCELLENT (Improved from original sparse state)**

The network summary is now comprehensive with:
- IPAM configuration details
- Driver options
- Connected services tab
- Containers tab
- Raw inspect view

**Empty States:**
- Options: "No options." ✅
- IPAM: "No IPAM configuration." ✅
- Connected Services: "No services are attached to this network." ✅
- Containers: "No tasks are attached to this network." ✅

**Recommendations:**
- All empty states are well-handled ✅

---

### 5. Configs (`SwarmConfigsOverviewTable.jsx`)

**Tabs Available:**
- Summary ✅
- Data ✅
- Inspect ✅

**Summary Tab Content:**

| Field | Present | Type | Notes |
|-------|---------|------|-------|
| Config ID | ✅ | break-word | Full ID |
| Name | ✅ | text | |
| Data Size | ✅ | text | Human-readable bytes |
| Created | ✅ | date | |
| Updated | ✅ | date | |

**Right Panel: "Used By" Section**
- Shows services referencing this config
- Displays service name and mount path

**Actions:**
- Edit (with modal)
- Compare (diff two configs)
- Clone
- Download
- Delete

**Assessment: ⭐⭐⭐⭐⭐ EXCELLENT**

Full CRUD functionality with:
- Edit modal for modifying config content
- Compare modal for diffing configs
- Clone functionality
- Download/Export capability
- Used By section for impact analysis

**Empty States:**
- Used By: "No services reference this config." ✅

**Recommendations:**
- Consider syntax highlighting in Data tab based on content type detection

---

### 6. Secrets (`SwarmSecretsOverviewTable.jsx`)

**Tabs Available:**
- Summary ✅
- Inspect ✅

**Summary Tab Content:**

| Field | Present | Type | Notes |
|-------|---------|------|-------|
| ID | ✅ | break-word | Full ID |
| Name | ✅ | text | |
| Created | ✅ | date | |
| Updated | ✅ | date | |
| Driver | ✅ | text | External driver if any |
| External | ✅ | text | Yes/No based on driver |

**Right Panel: "Used By" Section**
- Shows services referencing this secret
- Displays service name and mount path

**Actions:**
- Edit (modal with masked input option)
- Rotate (create new version)
- Clone
- Delete

**Assessment: ⭐⭐⭐⭐⭐ EXCELLENT**

Comprehensive for a secret resource:
- Edit/Rotate capabilities (handles Docker immutability)
- Clone functionality
- Used By section for impact analysis
- Properly handles external secrets

**Empty States:**
- Used By: "No services reference this secret." ✅

**Recommendations:**
- Consider adding a "Reveal" option with security warnings for debugging purposes

---

### 7. Stacks (`SwarmStacksOverviewTable.jsx`)

**Tabs Available:**
- Summary ✅
- Services ✅
- Networks ✅
- Volumes ✅
- Configs ✅
- Secrets ✅
- Compose File ✅

**Summary Tab Content:**

| Field | Present | Type | Notes |
|-------|---------|------|-------|
| Stack Name | ✅ | text | |
| Services | ✅ | text | Service count |
| Orchestrator | ✅ | text | swarm/compose |

**Right Panel: Health Summary**
- Services healthy count (green)
- Services unhealthy count (red)
- Total services count
- Refreshes every 5 seconds

**Actions:**
- Update (opens compose editor modal)
- Export (downloads compose file)
- Rollback (triggers rollback for all services)
- Delete

**Assessment: ⭐⭐⭐⭐⭐ EXCELLENT**

Very comprehensive stack management:
- All related resources accessible via tabs (Networks, Volumes, Configs, Secrets)
- Compose file view and edit
- Real-time health status
- Rollback capability

**Empty States in Resource Tabs:**
- Networks: "No networks found for this stack." ✅
- Volumes: "No volumes found for this stack." ✅
- Configs: "No configs found for this stack." ✅
- Secrets: "No secrets found for this stack." ✅
- Services: "No services in this stack" ✅

**Recommendations:**
- The Summary tab Quick Info section is minimal (only 3 fields)
- Consider adding: Version, Created date, Last Updated date

---

### 8. Volumes (`SwarmVolumesOverviewTable.jsx`)

**Tabs Available:**
- Summary ✅
- Files ✅
- Inspect ✅

**Summary Tab Content:**

| Field | Present | Type | Notes |
|-------|---------|------|-------|
| Name | ✅ | text | |
| Driver | ✅ | text | local, nfs, etc. |
| Scope | ✅ | text | local |
| Mountpoint | ✅ | break-word | Full host path |
| Created | ✅ | date | |

**Right Panel: "Used By" Section**
- Shows services mounting this volume

**Actions:**
- Backup (exports to local file)
- Restore (imports from backup)
- Clone (creates new volume with data copy)
- Delete

**Assessment: ⭐⭐⭐⭐⭐ EXCELLENT**

Full volume management:
- Files tab for browsing volume content
- Backup/Restore functionality
- Clone capability
- Usage information

**Empty States:**
- Used By: "No services reference this volume." ✅

**Recommendations:**
- Consider showing volume size if available from driver
- Add Labels display in Quick Info section

---

## Empty State Analysis

### K8s Empty State Pattern (Reference Implementation)

K8s uses a **centralized, component-based approach** for empty states:

**Components:**
- `EmptyTabContent.jsx` - Reusable component with icon, title, description, tip, and optional action button
- `emptyTabMessages.js` - Centralized message definitions for consistency

**Visual Design:**
```
┌─────────────────────────────────────────┐
│                                         │
│                  📋                     │  ← Large icon (42px, 0.5 opacity)
│                                         │
│         No events yet                   │  ← Title (15px, bold)
│                                         │
│   No events have been recorded          │  ← Description (13px)
│   for this resource.                    │
│                                         │
│   Events appear when Kubernetes         │  ← Tip (12px, muted)
│   performs actions like scheduling.     │
│                                         │
│         [ Refresh ]                     │  ← Optional action button
│                                         │
└─────────────────────────────────────────┘
```

**CSS Properties:**
- Centered layout with `min-height: 180px`
- `padding: 40px 20px`
- Max-width constraints on text (360px description, 300px tip)

### Swarm Current Empty State Pattern (Needs Improvement)

Swarm uses **inline text** with inconsistent formatting:

**Current Patterns:**
```jsx
// Pattern 1: Simple text (most common)
<div style={{ color: 'var(--gh-text-secondary)' }}>
  No services reference this config.
</div>

// Pattern 2: Centered with padding
<div style={{ padding: 32, textAlign: 'center', color: 'var(--gh-text-secondary)' }}>
  No container associated with this task yet.
</div>

// Pattern 3: Empty array display
getValue: (d) => Array.isArray(d.env) ? d.env : []
// Results in: "[]" displayed to user
```

**Problems:**
1. No visual icon to draw attention
2. No helpful tip explaining what would appear
3. Inconsistent padding (some 16px, some 32px)
4. Some show `[]` instead of descriptive text
5. No action button to help user resolve the empty state

### Current Empty State Patterns

| Resource | Section | Empty State Text | Space Usage |
|----------|---------|------------------|-------------|
| Services | Env Vars | `[]` | Minimal |
| Services | Mounts | `[]` | Minimal |
| Tasks | Logs | "No container associated with this task yet." | Centered, padded |
| Tasks | Exec | "No container associated with this task yet." | Centered, padded |
| Nodes | Logs | "No tasks with containers were found for this node." | Inline |
| Networks | Options | "No options." | Inline |
| Networks | IPAM | "No IPAM configuration." | Inline |
| Networks | Services | "No services are attached to this network." | Inline, padded |
| Networks | Containers | "No tasks are attached to this network." | Inline, padded |
| Configs | Used By | "No services reference this config." | Inline, padded |
| Secrets | Used By | "No services reference this secret." | Inline, padded |
| Volumes | Used By | "No services reference this volume." | Inline, padded |
| Stacks | Resources | "No {resource} found for this stack." | Centered, padded |
| Stack Services | Services | "No services in this stack" | Centered |

### Recommended Migration Path

**Phase 1: Extend emptyTabMessages.js**
Add Swarm-specific message definitions to the existing K8s messages file.

**Phase 2: Refactor High-Traffic Empty States**
Priority order:
1. Stack resource tabs (Networks, Volumes, Configs, Secrets)
2. Used By sections (Configs, Secrets, Volumes)
3. Task Logs/Exec unavailable states
4. Network Connected Services/Containers

**Phase 3: Fix Array Display Issues**
Replace `[]` with proper empty state handling in QuickInfoSection lists.

**Phase 4: Add Action Buttons Where Helpful**
- "Refresh" for data that might appear after loading
- "Create" for resources that can be added
- "View Docs" for complex concepts

### Empty State Issues

1. **Inconsistent Text Format**: Some use "No X." while others use "No X found for this Y"
2. **Array Display**: Services summary shows `[]` for empty lists instead of descriptive text
3. **Space Efficiency**: Some empty states use excessive padding (32px) which wastes space
4. **No EmptyTabContent Usage**: Swarm doesn't use the shared K8s component

### Recommendations for Empty States

1. **Adopt EmptyTabContent**: Use the K8s component for all Swarm empty states
2. **Extend emptyTabMessages**: Add Swarm-specific messages to centralized config
3. **Replace `[]` with Text**: Show "None" or hide empty list rows entirely
4. **Standardize Padding**: Use EmptyTabContent's consistent 40px padding
5. **Add Helpful Tips**: Explain what would appear and when

---

## Comparison with Kubernetes Bottom Panels

### Tab Structure Comparison

| Feature | K8s | Swarm | Notes |
|---------|-----|-------|-------|
| Summary Tab | ✅ | ✅ | Both have summary as first tab |
| Resource-specific tabs | ✅ | ✅ | Pods, Tasks, etc. |
| YAML/Inspect | ✅ | ✅ | K8s=YAML, Swarm=Inspect (JSON) |
| Events Tab | ✅ | ❌ | K8s has dedicated Events tab |
| Logs Tab | ✅ | ✅ | Both support logs |
| Console/Exec | ✅ | ✅ | Both support exec |
| Holmes AI | ✅ | ✅ (partial) | Services, Tasks have Holmes |
| Tab Counts | ✅ | ❌ | K8s shows item counts in tabs |

### Summary Tab Layout Comparison

**K8s Pattern (e.g., Secrets):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [SummaryTabHeader with name, labels, actions]                   │
├──────────────────┬──────────────────────┬───────────────────────┤
│ QuickInfoSection │ DataPreview          │ EventHistory          │
│ (left 280px)     │ (flex)               │ (right 420px)         │
└──────────────────┴──────────────────────┴───────────────────────┘
```

**Swarm Pattern (e.g., Configs):**
```
┌─────────────────────────────────────────────────────────────────┐
│ [SummaryTabHeader with name, labels, actions]                   │
├──────────────────┬──────────────────────────────────────────────┤
│ QuickInfoSection │ UsedBySection                                │
│ (left)           │ (flex)                                       │
└──────────────────┴──────────────────────────────────────────────┘
```

### Key Differences

1. **Events Integration**: K8s summary tabs often include an Events panel on the right side. Swarm resources don't have a native events concept.

2. **Data Preview in Summary**: K8s ConfigMaps/Secrets show data preview in summary. Swarm Configs have a separate Data tab.

3. **Tab Counts**: K8s uses `countKey` property to show item counts (e.g., "Pods (3)", "Events (5)"). Swarm doesn't implement this.

4. **Holmes Coverage**: K8s has Holmes for all resources. Swarm only has it for Services and Tasks.

### Recommendations for Consistency

1. **Add Tab Counts to Swarm**: Implement the `enableTabCounts` feature for Swarm resources
   - Services: Tasks count
   - Networks: Services count, Containers count
   - Stacks: Services count, Networks count, etc.

2. **Add Holmes to More Resources**: Consider adding Holmes AI analysis to:
   - Nodes (for cluster health analysis)
   - Stacks (for deployment analysis)

3. **Standardize Inspect vs YAML**: Currently K8s uses "YAML" tab while Swarm uses "Inspect" (JSON). Consider:
   - Renaming Swarm "Inspect" to "JSON" for clarity
   - Or adding YAML output option alongside JSON

4. **Events Equivalent**: Consider adding a Docker events integration for real-time resource events (similar to K8s events)

---

## Summary Tab Information Density Analysis

### Information Density Score (1-5)

| Resource | Fields | Actions | Right Panel | Score | Notes |
|----------|--------|---------|-------------|-------|-------|
| Services | 11 | 4+ | ❌ | ⭐⭐⭐⭐⭐ | Most comprehensive |
| Tasks | 15 | 1 | Timeline + Health | ⭐⭐⭐⭐⭐ | Very detailed |
| Nodes | 10+ | 4 | ❌ | ⭐⭐⭐⭐⭐ | Good with TLS info |
| Networks | 8 | 1 | Options + IPAM | ⭐⭐⭐⭐⭐ | Well structured |
| Configs | 5 | 5 | Used By | ⭐⭐⭐⭐ | Good actions |
| Secrets | 6 | 4 | Used By | ⭐⭐⭐⭐ | Appropriate for secrets |
| Stacks | 3 | 4 | Health Summary | ⭐⭐⭐ | Could add more fields |
| Volumes | 5 | 4 | Used By | ⭐⭐⭐⭐ | Good functionality |

### Low-Density Summary Tabs

**Stacks Summary** - Only 3 quick info fields:
- Stack Name
- Services (count)
- Orchestrator

**Recommendations:**
- Add: Version (if available from compose)
- Add: Created date (first service creation)
- Add: Networks count
- Add: Volumes count
- Add: Configs count
- Add: Secrets count

---

## Space Efficiency Analysis

### Wasted Space Scenarios

1. **Empty "Used By" Sections**: When no services reference a config/secret/volume, the "Used By" section still takes 50% of the panel width with just a single line of text.

   **Recommendation**: Consider making the right panel collapsible or resizable.

2. **Stack Resources Tabs with No Items**: The Networks/Volumes/Configs/Secrets tabs show a centered empty message with significant whitespace.

   **Recommendation**: 
   - Add inline empty state in parent view
   - Consider hiding tabs with 0 items or show count in tab label

3. **Task Logs/Exec for Non-Running Tasks**: Full tab panel with just empty state message.

   **Recommendation**: 
   - Show inline message in tab label: "Logs (unavailable)"
   - Disable tab selection with tooltip explaining why

### Efficient Space Usage Examples

✅ **Network Options/IPAM**: Inline empty states that don't waste vertical space

✅ **Service Quick Info Lists**: Compact list display for arrays

✅ **Node TLS Info**: Conditionally shown only for manager nodes

---

## Action Button Consistency

### Standard Actions by Resource Type

| Resource | Delete | Edit | Clone | Export | Restart | Scale | Drain |
|----------|--------|------|-------|--------|---------|-------|-------|
| Services | ✅ | ✅ (Update Image) | ❌ | ❌ | ✅ | ✅ | ❌ |
| Tasks | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Nodes | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Networks | ✅* | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Configs | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Secrets | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ |
| Stacks | ✅ | ✅ (Update) | ❌ | ✅ | ❌ | ❌ | ❌ |
| Volumes | ✅ | ❌ | ✅ | ✅ (Backup) | ❌ | ❌ | ❌ |

\* = Conditional (built-in networks can't be deleted, manager nodes can't be deleted)

### Node-Specific Actions

| Action | Worker | Manager | Leader |
|--------|--------|---------|--------|
| Promote | ✅ | ❌ | ❌ |
| Demote | ❌ | ✅ | ❌ |
| Delete | ✅ | ❌ | ❌ |
| Drain | ✅ | ✅ | ✅ |
| Activate | ✅ | ✅ | ✅ |

---

## Shared Component Analysis

### Common Components Used

| Component | Description | Used By |
|-----------|-------------|---------|
| `SummaryTabHeader` | Header with name, labels, actions | All resources |
| `QuickInfoSection` | Left panel with key-value fields | All resources |
| `SwarmResourceActions` | Delete button with confirmation | All resources |
| `OverviewTableWithPanel` | Table + bottom panel wrapper | All resources |
| `*UsedBySection` | Shows services using resource | Configs, Secrets, Volumes |
| `*InspectTab` | Raw JSON view | Networks, Configs, Secrets, Volumes |

### K8s Shared Components Not Used in Swarm

| Component | K8s Usage | Swarm Equivalent |
|-----------|-----------|------------------|
| `ResourceEventsTab` | Events for all resources | Not implemented |
| `AggregateLogsTab` | Combined logs | Used for Services, not others |
| `HolmesBottomPanel` | AI analysis | Only Services, Tasks |

---

## Priority Recommendations

### High Priority

#### 1. Adopt K8s EmptyTabContent Component for Swarm

**Current State**: Swarm uses inline text for empty states (e.g., `"No services reference this config."`). K8s uses a dedicated `EmptyTabContent` component with rich, helpful messaging.

**K8s Pattern** (from `EmptyTabContent.jsx` and `emptyTabMessages.js`):
```jsx
<EmptyTabContent
  icon="consumers"        // 🔗 visual indicator
  title="No consumers found"
  description="This resource is not currently used by any workloads."
  tip="Workloads that reference this resource will appear here."
/>
```

**Recommendation**: 
- Extend `emptyTabMessages.js` to include Swarm-specific messages
- Refactor all Swarm empty states to use `EmptyTabContent`
- This provides: icon, title, description, and actionable tip

**Swarm Empty Tab Messages to Add**:

| Tab Type | Icon | Title | Description | Tip |
|----------|------|-------|-------------|-----|
| `swarm-services` | 🐳 | No services found | No services are associated with this resource. | Services will appear when deployed to the swarm. |
| `swarm-tasks` | 📦 | No tasks running | No tasks are currently running for this service. | Tasks appear when the service scheduler creates replicas. |
| `swarm-containers` | 🐋 | No containers attached | No containers are connected to this network. | Containers appear when services use this network. |
| `swarm-configs` | ⚙️ | No configs found | No configs are associated with this stack. | Configs defined in compose files will appear here. |
| `swarm-secrets` | 🔐 | No secrets found | No secrets are associated with this stack. | Secrets defined in compose files will appear here. |
| `swarm-volumes` | 💾 | No volumes found | No volumes are associated with this stack. | Volumes defined in compose files will appear here. |
| `swarm-networks` | 🌐 | No networks found | No networks are associated with this stack. | Networks defined in compose files will appear here. |
| `swarm-usedby` | 🔗 | Not in use | This resource is not referenced by any services. | Services using this resource will be listed here. |
| `swarm-logs` | 📜 | No logs available | No container is associated with this task yet. | Logs appear once the task has a running container. |
| `swarm-options` | ⚙️ | No options | No driver options are configured for this resource. | Driver-specific options would appear here if set. |
| `swarm-ipam` | 🌐 | No IPAM configuration | Default IPAM settings are being used. | Custom subnet, gateway, or IP ranges would appear here. |

#### 2. Add Tab Counts to Swarm Resources

Show item counts in tab labels (e.g., "Tasks (3)", "Services (5)") for:
- **Services**: Tasks count
- **Networks**: Connected Services count, Containers count
- **Stacks**: Services, Networks, Volumes, Configs, Secrets counts
- **Nodes**: Tasks count

#### 3. Expand Holmes AI Coverage

Currently Holmes is only available for Services and Tasks. Extend to:
- **Nodes** - for cluster health analysis
- **Stacks** - for deployment/compose analysis

#### 4. Enrich Stack Summary Tab

The Stack summary only has 3 fields. Add:
- Version (from compose file if available)
- Created date (from first service creation)
- Resource counts inline: Networks, Volumes, Configs, Secrets

### Medium Priority

#### 5. Improve Empty State Space Efficiency

**Problem**: Empty "Used By" sections waste 50% of panel width with a single line of text.

**Solutions**:
| Scenario | Current | Recommended |
|----------|---------|-------------|
| Empty right panel | Shows full-width section with one line | Auto-collapse or hide when empty |
| Empty list in summary | Shows `[]` | Show "None" or hide row entirely |
| Unavailable tab content | Full panel with centered message | Show disabled tab with tooltip |

**Implementation Options**:
1. **Collapsible panels**: Add expand/collapse toggle for right sections
2. **Conditional rendering**: Only show "Used By" section if items exist
3. **Inline summary**: Show "Used by: None" in QuickInfo instead of separate panel

#### 6. Add Docker Events Integration

K8s has Events tabs for all resources. Consider adding:
- Docker events stream subscription
- Filter events by resource (service, container, network, etc.)
- Show in dedicated "Events" tab or inline in Summary

#### 7. Standardize Loading and Error States

Ensure consistent patterns across all Swarm resources:
```jsx
// Loading
<div className="tab-loading">Loading...</div>

// Error  
<div className="tab-error">Failed to load: {error}</div>

// Empty (use EmptyTabContent)
<EmptyTabContent icon="..." title="..." description="..." tip="..." />
```

### Low Priority

#### 8. Syntax Highlighting for Config Data

Add language detection (JSON, YAML, INI, plain text) for Config data display using CodeMirror modes.

#### 9. Secret Reveal Option

Add optional "Reveal" button for secrets with security confirmation dialog for debugging purposes.

#### 10. Unify Inspect/YAML Naming

K8s uses "YAML", Swarm uses "Inspect" (JSON). Options:
- Rename to "JSON" for clarity
- Offer both JSON and YAML output options
- Or rename to "Raw" to be format-agnostic

---

## Appendix: Swarm Empty Tab Messages Definition

The following messages should be added to `frontend/src/constants/emptyTabMessages.js` to support Swarm empty states:

```javascript
// Swarm-specific empty tab messages
export const swarmEmptyTabMessages = {
  // Services and Tasks
  'swarm-services': {
    icon: '🐳',
    title: 'No services found',
    description: 'No services are associated with this resource.',
    tip: 'Services will appear when deployed to the swarm.',
  },
  'swarm-tasks': {
    icon: '📦',
    title: 'No tasks running',
    description: 'No tasks are currently running for this service.',
    tip: 'Tasks appear when the service scheduler creates replicas.',
  },
  'swarm-stack-services': {
    icon: '🐳',
    title: 'No services in this stack',
    description: 'This stack has no services deployed.',
    tip: 'Services defined in your compose file will appear here after deployment.',
  },

  // Network-related
  'swarm-connected-services': {
    icon: '🌐',
    title: 'No services attached',
    description: 'No services are using this network.',
    tip: 'Services will appear here when they connect to this network.',
  },
  'swarm-containers': {
    icon: '🐋',
    title: 'No containers attached',
    description: 'No containers are connected to this network.',
    tip: 'Containers appear when services with running tasks use this network.',
  },
  'swarm-options': {
    icon: '⚙️',
    title: 'No driver options',
    description: 'No driver-specific options are configured.',
    tip: 'Custom driver options would appear here if specified during network creation.',
  },
  'swarm-ipam': {
    icon: '🌐',
    title: 'No IPAM configuration',
    description: 'Default IPAM settings are being used.',
    tip: 'Custom subnet, gateway, or IP ranges would appear here if configured.',
  },

  // Stack resources
  'swarm-stack-networks': {
    icon: '🌐',
    title: 'No networks found',
    description: 'No networks are associated with this stack.',
    tip: 'Networks defined in your compose file will appear here.',
  },
  'swarm-stack-volumes': {
    icon: '💾',
    title: 'No volumes found',
    description: 'No volumes are associated with this stack.',
    tip: 'Volumes defined in your compose file will appear here.',
  },
  'swarm-stack-configs': {
    icon: '⚙️',
    title: 'No configs found',
    description: 'No configs are associated with this stack.',
    tip: 'Configs defined in your compose file will appear here.',
  },
  'swarm-stack-secrets': {
    icon: '🔐',
    title: 'No secrets found',
    description: 'No secrets are associated with this stack.',
    tip: 'Secrets defined in your compose file will appear here.',
  },

  // Used By sections
  'swarm-config-usedby': {
    icon: '🔗',
    title: 'Not in use',
    description: 'No services are referencing this config.',
    tip: 'Services that mount this config will be listed here.',
  },
  'swarm-secret-usedby': {
    icon: '🔗',
    title: 'Not in use',
    description: 'No services are referencing this secret.',
    tip: 'Services that mount this secret will be listed here.',
  },
  'swarm-volume-usedby': {
    icon: '🔗',
    title: 'Not in use',
    description: 'No services are mounting this volume.',
    tip: 'Services that use this volume will be listed here.',
  },

  // Task-specific unavailable states
  'swarm-task-logs': {
    icon: '📜',
    title: 'Logs unavailable',
    description: 'No container is associated with this task yet.',
    tip: 'Logs will appear once the task has a running container.',
  },
  'swarm-task-exec': {
    icon: '💻',
    title: 'Exec unavailable',
    description: 'No container is associated with this task.',
    tip: 'Exec is available when the task has a running container.',
  },

  // Node-specific
  'swarm-node-logs': {
    icon: '📜',
    title: 'No logs available',
    description: 'No tasks with containers were found on this node.',
    tip: 'Logs from running containers on this node will appear here.',
  },
  'swarm-node-tasks': {
    icon: '📦',
    title: 'No tasks on this node',
    description: 'No tasks are currently scheduled on this node.',
    tip: 'Tasks will appear when services are scheduled to run here.',
  },

  // Generic empty lists in summary
  'swarm-no-env': {
    icon: '📝',
    title: 'No environment variables',
    description: 'No environment variables are configured.',
    tip: 'Environment variables set in the service spec will appear here.',
  },
  'swarm-no-mounts': {
    icon: '💾',
    title: 'No mounts configured',
    description: 'No volumes or bind mounts are attached.',
    tip: 'Volume and bind mounts from the service spec will appear here.',
  },
  'swarm-no-ports': {
    icon: '🔌',
    title: 'No ports published',
    description: 'No ports are exposed for this service.',
    tip: 'Published ports from the service spec will appear here.',
  },
  'swarm-no-constraints': {
    icon: '📐',
    title: 'No placement constraints',
    description: 'No placement constraints are configured.',
    tip: 'Placement constraints restrict which nodes can run this service.',
  },
};
```

---

## File References

### Swarm Resources
- [SwarmServicesOverviewTable.jsx](frontend/src/docker/resources/services/SwarmServicesOverviewTable.jsx)
- [SwarmTasksOverviewTable.jsx](frontend/src/docker/resources/tasks/SwarmTasksOverviewTable.jsx)
- [SwarmNodesOverviewTable.jsx](frontend/src/docker/resources/nodes/SwarmNodesOverviewTable.jsx)
- [SwarmNetworksOverviewTable.jsx](frontend/src/docker/resources/networks/SwarmNetworksOverviewTable.jsx)
- [SwarmConfigsOverviewTable.jsx](frontend/src/docker/resources/configs/SwarmConfigsOverviewTable.jsx)
- [SwarmSecretsOverviewTable.jsx](frontend/src/docker/resources/secrets/SwarmSecretsOverviewTable.jsx)
- [SwarmStacksOverviewTable.jsx](frontend/src/docker/resources/stacks/SwarmStacksOverviewTable.jsx)
- [SwarmVolumesOverviewTable.jsx](frontend/src/docker/resources/volumes/SwarmVolumesOverviewTable.jsx)

### K8s Resources (for comparison)
- [SecretsOverviewTable.jsx](frontend/src/k8s/resources/secrets/SecretsOverviewTable.jsx)
- [ConfigMapsOverviewTable.jsx](frontend/src/k8s/resources/configmaps/ConfigMapsOverviewTable.jsx)
- [DeploymentsOverviewTable.jsx](frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.jsx)
- [PodOverviewTable.jsx](frontend/src/k8s/resources/pods/PodOverviewTable.jsx)

### Shared Components
- [SummaryTabHeader.jsx](frontend/src/layout/bottompanel/SummaryTabHeader.jsx)
- [QuickInfoSection.jsx](frontend/src/QuickInfoSection.jsx)
- [OverviewTableWithPanel.jsx](frontend/src/layout/overview/OverviewTableWithPanel.jsx)
- [EmptyTabContent.jsx](frontend/src/components/EmptyTabContent.jsx) ← **Use this for Swarm**
- [emptyTabMessages.js](frontend/src/constants/emptyTabMessages.js) ← **Extend with Swarm messages**

---

*Last updated: January 27, 2026*
