# Docker Swarm Feature - Analysis and TODO List

**Status:** DONE
**Created:** 2026-02-06
**Updated:** 2026-02-06

This document analyzes the Docker Swarm feature implementation against the specification in `.github/prompts/swarm.prompt.md` and identifies missing pieces, non-compliance issues, and UI/UX improvements needed.

## Current Status (Verified 2026-02-06)

- Missing Wails bindings listed below are now present in [pkg/app/docker_integration.go](pkg/app/docker_integration.go), including `CreateSwarmNetwork`, `CreateSwarmVolume`, `PruneSwarmNetworks`, `PruneSwarmVolumes`, `UpdateSwarmNodeRole`, and `UpdateSwarmNodeLabels`.
- Swarm creation overlay supports service/stack/network/volume/config/secret creation in [frontend/src/CreateManifestOverlay.tsx](frontend/src/CreateManifestOverlay.tsx).
- Backend Docker Swarm tests exist in [pkg/app/docker](pkg/app/docker), including metrics and registry tests.
- E2E coverage includes creation via [e2e/tests/swarm/60-create-service.spec.ts](e2e/tests/swarm/60-create-service.spec.ts).

---

## 1. Spec Compliance Analysis

### 1.1 Acceptance Criteria Review

| Criteria | Status | Notes |
|----------|--------|-------|
| Users can connect to Docker Swarm clusters using a connection wizard | **DONE** | Connection wizard implemented with auto-detection |
| Resource views follow same interaction patterns as K8s | **PARTIAL** | Inconsistent use of OverviewTableWithPanel - some use legacy patterns |
| Resource views have plus button for ad-hoc creation | **PARTIAL** | Button exists but creation only works for configs/secrets |
| UI clearly distinguishes K8s vs Swarm resources | **DONE** | Separate sidebar sections and state contexts |
| Notifications displayed for user actions | **DONE** | Uses showSuccess/showError notifications |
| New code is unit tested (70%+ coverage) | **FAIL** | No backend tests exist for pkg/app/docker/ |
| Feature is E2E tested | **PARTIAL** | E2E tests exist but no tests for resource creation |
| Documentation updated | **PARTIAL** | CLAUDE.md updated but README not updated |

### 1.2 Missing Backend Wails Bindings

The following backend functions exist in `pkg/app/docker/` but are **NOT exposed as Wails bindings** in `docker_integration.go`:

| Function | File | Purpose |
|----------|------|---------|
| `CreateSwarmNetwork` | networks.go | Creates overlay/bridge networks |
| `CreateSwarmVolume` | volumes.go | Creates Docker volumes |
| `PruneSwarmNetworks` | networks.go | Removes unused networks |
| `PruneSwarmVolumes` | volumes.go | Removes unused volumes |
| `UpdateSwarmNodeRole` | nodes.go | Changes node role (worker/manager) |
| `UpdateSwarmNodeLabels` | nodes.go | Updates node labels |

### 1.3 Missing Create Operations in Frontend

The `CreateManifestOverlay.jsx` only implements creation for:
- **Configs** - WORKING
- **Secrets** - WORKING

The following show "Create is not implemented" errors:
- **Services** - Shows YAML template but backend RPC not wired
- **Stacks** - Shows YAML template but backend RPC not wired
- **Networks** - Shows empty editor, backend has RPC but not exposed
- **Volumes** - Shows empty editor, backend has RPC but not exposed

### 1.4 Missing Backend Unit Tests

**CRITICAL: No unit tests exist for any Docker backend code.**

Required test files (per spec):
- `pkg/app/docker/client_test.go`
- `pkg/app/docker/services_test.go`
- `pkg/app/docker/tasks_test.go`
- `pkg/app/docker/nodes_test.go`
- `pkg/app/docker/networks_test.go`
- `pkg/app/docker/configs_test.go`
- `pkg/app/docker/secrets_test.go`
- `pkg/app/docker/stacks_test.go`
- `pkg/app/docker/volumes_test.go`
- `pkg/app/docker/logs_test.go`

### 1.5 Inconsistent Frontend Patterns

Some overview tables use different patterns:

**Modern Pattern** (used by Services, Configs, Networks, Nodes):
- Uses OverviewTableWithPanel with `renderPanelContent`
- Uses `{ key, label }` column format
- Local state with useEffect for data fetching

**Legacy Pattern** (used by Secrets, Volumes, Stacks):
- Uses OverviewTableWithPanel with `renderBottomPanel`
- Uses `{ id, header, accessorKey }` column format
- Uses SwarmStateContext for data

This inconsistency causes maintenance burden and potential bugs.

---

## 2. Resource Creation Overlay Layout Issues

### 2.1 Current Layout Problems

The `CreateManifestOverlay.jsx` has several layout/UX issues:

1. **Inconsistent Form Structure**
   - For Swarm resources: Shows Name + Labels side-by-side above editor
   - For K8s resources: Only shows the YAML editor
   - The side-by-side layout is cramped on smaller screens

2. **Poor Field Organization**
   - Name field and Labels textarea have equal width (50% each)
   - Labels textarea is too small (3 rows) for practical use
   - No visual grouping of related fields

3. **Missing Resource-Specific Fields**
   - **Networks**: Missing Driver dropdown, Scope selector, Attachable/Internal toggles, IPAM config
   - **Volumes**: Missing Driver dropdown, Driver options
   - **Services**: Using raw YAML instead of structured form fields
   - **Secrets**: No indication that content will be stored securely

4. **Editor Sizing Issues**
   - Fixed height `55vh` doesn't account for the form fields above
   - When Swarm form fields show, editor gets pushed down
   - No proper scrolling in the form area

5. **No Field Validation**
   - Name field accepts any characters (should validate DNS-compatible names)
   - No validation feedback before submission
   - Labels textarea parsing happens silently

6. **Missing Help/Documentation**
   - No tooltips or help text for fields
   - No examples for labels format
   - No guidance on what content is expected

7. **Accessibility Issues**
   - Hardcoded colors instead of CSS variables in some places
   - Missing ARIA labels on some interactive elements

### 2.2 Proposed Layout Improvements

#### Option A: Dedicated Creation Forms per Resource Type

Create separate overlay components for each Swarm resource type with tailored forms:

```
frontend/src/docker/overlays/
  CreateSwarmConfigOverlay.jsx    # Name, Labels, Content (text editor)
  CreateSwarmSecretOverlay.jsx    # Name, Labels, Content (masked)
  CreateSwarmNetworkOverlay.jsx   # Name, Driver, Scope, Options, Labels
  CreateSwarmVolumeOverlay.jsx    # Name, Driver, Driver Options, Labels
  CreateSwarmServiceOverlay.jsx   # Full service creation wizard
```

**Pros**: Best UX, full control, resource-specific validation
**Cons**: More code to maintain, duplication

#### Option B: Dynamic Form Builder

Enhance `CreateManifestOverlay.jsx` to render different form schemas based on resource type:

```javascript
const swarmSchemas = {
  config: {
    sections: [
      { title: 'Basic Info', fields: ['name', 'labels'] },
      { title: 'Content', fields: ['data'] }
    ],
    fields: {
      name: { type: 'text', label: 'Config Name', required: true },
      labels: { type: 'keyvalue', label: 'Labels' },
      data: { type: 'editor', label: 'Config Data', mode: 'text' }
    }
  },
  network: {
    sections: [
      { title: 'Basic Info', fields: ['name', 'driver', 'scope'] },
      { title: 'Options', fields: ['attachable', 'internal', 'labels'] },
      { title: 'IPAM', fields: ['subnet', 'gateway'] }
    ],
    fields: {
      name: { type: 'text', label: 'Network Name', required: true },
      driver: { type: 'select', label: 'Driver', options: ['overlay', 'bridge', 'macvlan'] },
      scope: { type: 'select', label: 'Scope', options: ['swarm', 'local'] },
      attachable: { type: 'checkbox', label: 'Attachable' },
      internal: { type: 'checkbox', label: 'Internal' },
      subnet: { type: 'text', label: 'Subnet', placeholder: '10.0.0.0/24' },
      gateway: { type: 'text', label: 'Gateway', placeholder: '10.0.0.1' },
      labels: { type: 'keyvalue', label: 'Labels' }
    }
  }
  // ... more schemas
};
```

**Pros**: Maintainable, consistent patterns, reusable
**Cons**: Complex to implement, may need custom renderers

#### Option C: Tabbed Form Layout (Recommended)

Keep single overlay but reorganize with tabs for different sections:

```
+----------------------------------------------+
| New Swarm Network                        [x] |
+----------------------------------------------+
| [Basic Info] [Options] [IPAM]                |
+----------------------------------------------+
| Name:     [________________________]         |
| Driver:   [overlay ▼]                        |
| Scope:    [swarm ▼]                          |
|                                              |
| Labels:                                      |
| +------------------------------------------+ |
| | com.example.team=platform               | |
| | com.example.env=dev                     | |
| +------------------------------------------+ |
+----------------------------------------------+
| Target: Docker Swarm              [Create]   |
+----------------------------------------------+
```

**Pros**: Clean organization, progressive disclosure, reasonable effort
**Cons**: Tab switching adds clicks

---

## 3. Implementation Plan

### Phase 1: Backend Test Coverage (Priority: HIGH)

**Goal**: Achieve 70%+ test coverage for pkg/app/docker/

1. Create mock Docker client interface
2. Write table-driven tests for each handler file
3. Test error cases and edge conditions

**Estimated effort**: 3-4 days

### Phase 2: Expose Missing Wails Bindings (Priority: HIGH)

Add to `docker_integration.go`:

```go
// Networks
func (a *App) CreateSwarmNetwork(name, driver string, opts CreateNetworkOptions) (string, error)
func (a *App) PruneSwarmNetworks() ([]string, error)

// Volumes
func (a *App) CreateSwarmVolume(name, driver string, labels, driverOpts map[string]string) (*SwarmVolumeInfo, error)
func (a *App) PruneSwarmVolumes() ([]string, uint64, error)

// Nodes
func (a *App) UpdateSwarmNodeRole(nodeID, role string) error
func (a *App) UpdateSwarmNodeLabels(nodeID string, labels map[string]string) error
```

**Estimated effort**: 0.5 day

### Phase 3: Normalize Frontend Overview Tables (Priority: MEDIUM)

Refactor Secrets, Volumes, and Stacks overview tables to use consistent pattern:
- Use local useState + useEffect for data fetching
- Use `{ key, label }` column format
- Use `renderPanelContent` instead of `renderBottomPanel`

**Estimated effort**: 1 day

### Phase 4: Implement Creation Forms (Priority: HIGH)

Create dedicated overlay components for each resource type:

#### 4.1 CreateSwarmNetworkOverlay.jsx

Fields:
- Name (text, required, DNS validation)
- Driver (select: overlay, bridge, macvlan, host)
- Scope (select: swarm, local)
- Attachable (checkbox)
- Internal (checkbox)
- Subnet (text, CIDR validation)
- Gateway (text, IP validation)
- Labels (key-value editor)

#### 4.2 CreateSwarmVolumeOverlay.jsx

Fields:
- Name (text, required)
- Driver (select: local, nfs, etc.)
- Driver Options (key-value editor)
- Labels (key-value editor)

#### 4.3 Improve CreateSwarmConfigOverlay

Current implementation works but needs:
- Better field layout (vertical stacking)
- Larger content editor
- Syntax highlighting toggle

#### 4.4 Improve CreateSwarmSecretOverlay

Current implementation works but needs:
- Security warning/info banner
- Password masking option in editor
- Better field layout

**Estimated effort**: 3-4 days

### Phase 5: Service Creation (Priority: LOW)

Service creation is complex and may require a multi-step wizard:
- Step 1: Basic info (name, image, replicas)
- Step 2: Networking (ports, networks)
- Step 3: Volumes & configs
- Step 4: Constraints & labels
- Step 5: Review & create

This is a larger effort that could be deferred.

**Estimated effort**: 5-7 days

### Phase 6: E2E Tests for Creation (Priority: HIGH)

Add E2E tests:
- `60-create-config.spec.ts`
- `70-create-secret.spec.ts`
- `80-create-network.spec.ts`
- `90-create-volume.spec.ts`

**Estimated effort**: 2 days

### Phase 7: Documentation (Priority: MEDIUM)

- Update README.md with Docker Swarm features
- Add inline JSDoc comments to overlay components
- Document resource creation flow

**Estimated effort**: 0.5 day

---

## 4. Detailed TODO Checklist

### Backend

- [ ] Add unit tests for `pkg/app/docker/client.go`
- [ ] Add unit tests for `pkg/app/docker/services.go`
- [ ] Add unit tests for `pkg/app/docker/tasks.go`
- [ ] Add unit tests for `pkg/app/docker/nodes.go`
- [ ] Add unit tests for `pkg/app/docker/networks.go`
- [ ] Add unit tests for `pkg/app/docker/configs.go`
- [ ] Add unit tests for `pkg/app/docker/secrets.go`
- [ ] Add unit tests for `pkg/app/docker/stacks.go`
- [ ] Add unit tests for `pkg/app/docker/volumes.go`
- [ ] Add unit tests for `pkg/app/docker/logs.go`
- [ ] Expose `CreateSwarmNetwork` Wails binding
- [ ] Expose `CreateSwarmVolume` Wails binding
- [ ] Expose `PruneSwarmNetworks` Wails binding
- [ ] Expose `PruneSwarmVolumes` Wails binding
- [ ] Expose `UpdateSwarmNodeRole` Wails binding
- [ ] Expose `UpdateSwarmNodeLabels` Wails binding

### Frontend

- [ ] Normalize `SwarmSecretsOverviewTable.jsx` to use modern pattern
- [ ] Normalize `SwarmVolumesOverviewTable.jsx` to use modern pattern
- [ ] Normalize `SwarmStacksOverviewTable.jsx` to use modern pattern
- [ ] Create `CreateSwarmNetworkOverlay.jsx` with structured form
- [ ] Create `CreateSwarmVolumeOverlay.jsx` with structured form
- [ ] Improve `CreateManifestOverlay.jsx` layout for configs
- [ ] Improve `CreateManifestOverlay.jsx` layout for secrets
- [ ] Add field validation (DNS names, CIDR, IP addresses)
- [ ] Add help text/tooltips to form fields
- [ ] Add unit tests for new overlay components

### E2E Tests

- [ ] Add `60-create-config.spec.ts`
- [ ] Add `70-create-secret.spec.ts`
- [ ] Add `80-create-network.spec.ts`
- [ ] Add `90-create-volume.spec.ts`

### Documentation

- [ ] Update README.md with Docker Swarm features
- [ ] Add JSDoc comments to overlay components

---

## 5. Priority Summary

| Priority | Tasks |
|----------|-------|
| **P0 - Critical** | Backend unit tests (blocks CI quality gates) |
| **P1 - High** | Expose missing Wails bindings, implement network/volume creation |
| **P2 - Medium** | Normalize overview tables, improve existing creation forms |
| **P3 - Low** | Service creation wizard, documentation polish |

---

## 6. Technical Debt Notes

1. **Swarm state management is fragmented**
   - Some components use `SwarmStateContext`
   - Some components manage their own state
   - Consider consolidating to a single pattern

2. **Event emission is inconsistent**
   - Some events emitted from backend: `swarm:services:update`
   - Some events emitted from frontend: `swarm:configs:update`
   - Need to document and standardize

3. **Debug logging in production**
   - `docker_integration.go:619` has debug printf
   - Should be removed or use proper logging

4. **Polling intervals are hardcoded**
   - Services/Tasks: 1s, Nodes: 5s, Counts: 2s
   - Should be configurable or adaptive

