---
title: "Implementation Plan: Resource Relationship Visualization"
status: in_progress
priority: high
---
# Implementation Plan: Resource Relationship Visualization

**Status:** In Progress (~80% complete)
**Created:** 2026-02-11
**Updated:** 2026-02-12

Add interactive graph visualization showing "used by" / "uses" relationships between Kubernetes resources. Surfaces dependency chains, permission structures, network flows, and storage topology.

**Note:** Frontend was migrated to TypeScript in PR #104. All frontend file references use `.tsx`/`.ts` extensions.

---

## Context & Motivation

KubeDevBench surfaces 32+ Kubernetes resource types but all views are flat tables with detail tabs. Resources reference each other extensively — owner references, label selectors, volume mounts, RBAC bindings, network policy rules, ingress routing — but these relationships are invisible. Users must mentally trace chains like "which Deployments mount this ConfigMap?" or "what pods does this Service select?". A graph visualization makes these relationships immediately visible and navigable.

---

## Research Findings

### Resource Types Currently Handled (32+)

| Group | Resources | Backend Location |
|-------|-----------|------------------|
| Workloads | Pod, Deployment, StatefulSet, DaemonSet, ReplicaSet, Job, CronJob | `pods.go`, `deployments.go`, `statefulsets.go`, `daemonsets.go`, `replicasets.go`, `jobs/`, `cronjobs.go` |
| Networking | Service, Ingress, NetworkPolicy, Endpoints | `services.go`, `ingresses.go`, `networkpolicies.go`, `endpoints.go` |
| Config | ConfigMap, Secret, ServiceAccount | `configmaps.go`, `secrets.go`, `serviceaccounts.go` |
| Storage | PersistentVolumeClaim, PersistentVolume, StorageClass | `persistentvolumeclaims.go`, `persistentvolumes.go`, `storageclasses.go` |
| RBAC | Role, ClusterRole, RoleBinding, ClusterRoleBinding | `roles.go`, `rolebindings.go` |
| Other | Node, Namespace, CRD, HelmRelease | `nodes.go`, `namespaces.go`, `customresourcedefinitions.go`, `helm.go` |

### Relationship Types Identified (15+)

#### Owner Reference Relationships (already resolved via `resource_details.go`)
- Deployment → ReplicaSet → Pod (controller chain)
- StatefulSet → Pod + PVC (template-generated)
- DaemonSet → Pod
- Job → Pod
- CronJob → Job
- ReplicaSet owner → Deployment (OwnerKind/OwnerName in `ReplicaSetDetail`)

**Backend functions:** `isPodOwnedBy()`, `isOwnedBy()`, `collectOwnedPods()` in `resource_details.go`

#### Label Selector Relationships (partially resolved)
- Service → Pod via `svc.Spec.Selector` matching pod labels
- NetworkPolicy → Pod via `np.Spec.PodSelector.MatchLabels`
- Deployment/StatefulSet/DaemonSet → Pod via `spec.Selector.MatchLabels`

**Backend gap:** `ServiceInfo` does NOT expose `Selector` field. The graph builder must read it from `svc.Spec.Selector`. Label matching uses `labels.SelectorFromSet()` already imported in `resource_details.go`.

#### Configuration Mount Relationships (partially resolved)
- Pod/Deployment → ConfigMap via volumes, env, envFrom
- Pod/Deployment → Secret via volumes, env, envFrom, imagePullSecrets
- Pod → PVC via volume mounts

**Backend functions:** `GetConfigMapConsumers()` in `configmaps_consumers.go`, `GetSecretConsumers()` in `secrets_consumers.go`, `GetPVCConsumers()` in `pvc_consumers.go`

**Backend gap:** Consumer scanning only covers Pods + Deployments. StatefulSets, DaemonSets, Jobs, CronJobs are not scanned (all have PodSpec in their template).

#### Foreign Key Relationships (fully resolved)
- PVC → PV via `pvc.Spec.VolumeName`
- PV → PVC via `pv.Spec.ClaimRef`
- PVC/PV → StorageClass via `spec.StorageClassName`
- Ingress → Service via `ingressRule.Backend.ServiceName` (in `IngressRule` type)
- Ingress → Secret via TLS `secretName` (in `IngressTLSInfo` type)

#### RBAC Relationships (fully resolved)
- RoleBinding → Role via `roleRef` (Kind, Name, APIGroup)
- RoleBinding → Subject via `subjects[]` (User, Group, ServiceAccount)
- ClusterRoleBinding → ClusterRole (same pattern)

**Backend types:** `RoleRef`, `Subject` in `rolebindings.go`

#### Network Policy Relationships (partially resolved)
- NetworkPolicy → Pod via `podSelector.MatchLabels`
- NetworkPolicy ingress rules: `[]NetworkPolicyPeer` with `podSelector`, `namespaceSelector`
- NetworkPolicy egress rules: same structure

**Backend gap:** `NetworkPolicyPeer` missing `IPBlock` (CIDR/Except). Selectors are stored as label maps but not resolved to actual pods.

#### Infrastructure Relationships
- Pod → Node via `pod.Spec.NodeName` (exposed in `ResourcePodInfo.Node`)

### Existing Frontend Visualization
- **No visualization libraries** in `package.json` (no d3, react-flow, cytoscape, vis.js)
- **Docker Swarm** has a custom canvas-based `TopologyView.tsx` — simple bipartite graph (nodes vs services), hand-positioned. Not reusable for the complex K8s relationship model.
- **All K8s resource views** are table-based using `OverviewTableWithPanel` with detail tabs
- **`navigate-to-resource` CustomEvent** already exists in `AppContainer.tsx` — dispatching this event navigates to a resource and selects its row. This can be reused for graph node click navigation.

---

## Library Selection: `@xyflow/react` (React Flow v12)

| Criterion | @xyflow/react | cytoscape.js | d3-force | vis.js |
|-----------|--------------|--------------|----------|--------|
| React integration | Native components, hooks | Wrapper needed | Manual | Wrapper needed |
| TypeScript | Full built-in types | Community types | Good | Fair |
| Interactive (zoom/pan/click) | Built-in | Good (imperative) | Manual | Good (imperative) |
| Grouping/clustering | Sub-flows | Compound nodes | Manual | Plugin |
| Performance (50-200 nodes) | Excellent (virtualized) | Good | Good | Fair |
| Bundle size | ~85KB gzip | ~200KB | ~30KB | ~300KB |
| Ecosystem | 30k+ stars, very active | Active | Active | Less active |

**Decision:** `@xyflow/react` — native React, TypeScript-first, virtualized rendering, built-in sub-flows for grouping. Pair with `@dagrejs/dagre` for automatic hierarchical layout.

---

## Phases

### Phase 1: Backend — Graph API & Relationship Gap Fixes ❌ NOT STARTED

#### 1.1 Graph Types Package
- [ ] Create `pkg/app/k8s_graph/types.go` — `GraphNode` (ID, Kind, Name, Namespace, Status, Group, Metadata), `GraphEdge` (ID, Source, Target, Type, Label), `ResourceGraph` (Nodes, Edges)
- [ ] Edge type constants: `owns`, `selects`, `mounts`, `routes_to`, `binds`, `bound_to`, `provides`, `runs_on`, `network_policy`
- [ ] Group constants: `workload`, `networking`, `config`, `storage`, `rbac`, `infrastructure`
- [ ] Helper functions: `NodeID(kind, ns, name)`, `EdgeID(src, tgt, type)`, `KindToGroup(kind)`

#### 1.2 Graph Builder
- [ ] Create `pkg/app/k8s_graph/builder.go` — `Builder` struct with `BuildForResource(namespace, kind, name string, depth int) (*ResourceGraph, error)`
- [ ] BFS expansion with configurable depth (default 2, max 3): seed root node, expand frontier per level
- [ ] Expansion per resource kind:
  - [ ] **Deployment** — owned ReplicaSets (via OwnerReferences), pod template ConfigMap/Secret/PVC refs, selecting Services
  - [ ] **StatefulSet** — owned Pods, PodSpec refs, selecting Services
  - [ ] **DaemonSet** — owned Pods, PodSpec refs, selecting Services
  - [ ] **ReplicaSet** — owner Deployment (via OwnerReferences), owned Pods
  - [ ] **Pod** — owner workload, Node (spec.NodeName), PodSpec refs (volumes, env), selecting Services
  - [ ] **Job** — owner CronJob, owned Pods, PodSpec refs
  - [ ] **CronJob** — owned Jobs
  - [ ] **Service** — selected Pods (via label matching), routing Ingresses
  - [ ] **Ingress** — backend Services (via rules), TLS Secrets
  - [ ] **ConfigMap** — consumer workloads (Pods, Deployments, StatefulSets, DaemonSets, Jobs, CronJobs)
  - [ ] **Secret** — consumer workloads, TLS-referencing Ingresses
  - [ ] **PVC** — bound PV, StorageClass, mounting Pods
  - [ ] **PV** — bound PVC (ClaimRef), StorageClass
  - [ ] **RoleBinding/ClusterRoleBinding** — referenced Role/ClusterRole (roleRef), Subjects
  - [ ] **Role/ClusterRole** — referencing RoleBindings/ClusterRoleBindings
  - [ ] **Node** — Pods running on it (fieldSelector `spec.nodeName=`)

#### 1.3 Fix Relationship Gaps
- [ ] Add `Selector` field to `ServiceInfo` in `pkg/app/types.go`: `Selector map[string]string \`json:"selector,omitempty"\``
- [ ] Populate it in `pkg/app/services.go`: `Selector: svc.Spec.Selector`
- [ ] Extend `GetConfigMapConsumers()` in `configmaps_consumers.go` to scan StatefulSets, DaemonSets, Jobs, CronJobs (all have `.Spec.Template.Spec` or `.Spec.JobTemplate.Spec.Template.Spec` PodSpec)
- [ ] Extend `GetSecretConsumers()` in `secrets_consumers.go` — same extension
- [ ] Extend `GetPVCConsumers()` in `pvc_consumers.go` to scan Deployments, StatefulSets, DaemonSets (check `.Spec.Template.Spec.Volumes`)

#### 1.4 Wails RPC
- [ ] Create `pkg/app/graph.go` — `GetResourceGraph(namespace, kind, name string, depth int) (*k8s_graph.ResourceGraph, error)` exposed to frontend
- [ ] Obtain clientset via `a.getKubernetesInterface()`, construct `k8s_graph.NewBuilder(a.ctx, clientset)`

### Phase 2: Backend — Unit Tests ❌ NOT STARTED

- [ ] Create `pkg/app/k8s_graph/builder_test.go` using fake clientsets (`k8s.io/client-go/kubernetes/fake`)
- [ ] Test cases:
  - [ ] Deployment → ReplicaSet → Pod owner chain
  - [ ] Service → Pod label selector matching
  - [ ] ConfigMap consumer scanning across all workload types
  - [ ] Secret consumer scanning across all workload types
  - [ ] PVC → PV → StorageClass chain
  - [ ] Ingress → Service → Pod chain
  - [ ] RoleBinding → Role + Subjects
  - [ ] Pod → Node mapping
  - [ ] Depth limiting (depth=1 vs depth=2)
  - [ ] Unknown/missing resources handled gracefully
- [ ] Coverage target: ≥70% on `pkg/app/k8s_graph/`
- [ ] Run: `go test -cover ./pkg/app/k8s_graph/...`

### Phase 3: Frontend — Library Setup & Core Components ❌ NOT STARTED

#### 3.1 Dependencies
- [ ] `cd frontend && npm install @xyflow/react @dagrejs/dagre`
- [ ] `npm install -D @types/dagre` (if not bundled)

#### 3.2 Graph Utilities (`frontend/src/k8s/graph/utils/`)
- [ ] `graphApi.ts` — Wails RPC wrapper: `getResourceGraph(namespace, kind, name, depth)`
- [ ] `graphStyles.ts` — Color, shape, and group constants per resource kind:

  | Kind | Color | Shape |
  |------|-------|-------|
  | Pod | green/yellow/red (by status) | Circle |
  | Deployment, StatefulSet, DaemonSet | blue | Rounded rect |
  | ReplicaSet | light blue | Rect |
  | Job, CronJob | purple | Diamond |
  | Service | orange | Hexagon |
  | Ingress | orange-light | Pentagon |
  | ConfigMap | green | Square |
  | Secret | red | Square (lock) |
  | PVC | teal | Cylinder |
  | PV | dark teal | Cylinder (larger) |
  | StorageClass | gray | Rect |
  | Node (K8s) | gray | Large rect |
  | Role/ClusterRole | gold | Shield |
  | RoleBinding/ClusterRoleBinding | gold-light | Arrow |
  | NetworkPolicy | indigo | Octagon |

- [ ] `layoutEngine.ts` — Dagre layout config: converts `ResourceGraph` (nodes+edges) → React Flow positioned nodes and edges. Use `dagre.graphlib.Graph` with `rankdir: 'TB'`, `nodesep: 60`, `ranksep: 80`.

#### 3.3 React Hooks (`frontend/src/k8s/graph/hooks/`)
- [ ] `useResourceGraph.ts` — Fetches graph data via `getResourceGraph()`, manages `{graph, loading, error, refresh}` state
- [ ] `useGraphLayout.ts` — Runs dagre layout on graph data, memoized on graph timestamp
- [ ] `useGraphNavigation.ts` — On node click, dispatches `navigate-to-resource` CustomEvent (reuses existing handler in `AppContainer.tsx` lines 209-293)

#### 3.4 Custom Node & Edge Components (`frontend/src/k8s/graph/components/`)
- [ ] `nodes/ResourceNode.tsx` — Single custom React Flow node: colored rectangle/circle with icon, name truncated, status badge. Props from `GraphNode`.
- [ ] `edges/RelationshipEdge.tsx` — Custom edge with type label. Visual style by edge type: `owns`=solid, `selects`=dashed, `mounts`=dotted, `routes_to`=thick, `binds`=double.

#### 3.5 Graph Canvas Components
- [ ] `GraphCanvas.tsx` — Core React Flow wrapper: `<ReactFlow>` with custom node types, edge types, minimap, controls. Props: `{graph, loading, error, onNodeClick, onRefresh}`.
- [ ] `GraphCanvas.css` — Styles for canvas, nodes, edges, loading overlay
- [ ] `GraphToolbar.tsx` — Refresh button, depth selector (1/2/3), kind filter toggles (show/hide Pods, ConfigMaps, etc.)
- [ ] `GraphLegend.tsx` — Edge/node type legend overlay

### Phase 4: Frontend — ResourceGraphTab & Table Integration ❌ NOT STARTED

#### 4.1 Bottom Panel Tab Component
- [ ] Create `frontend/src/k8s/graph/ResourceGraphTab.tsx` — Props: `{namespace, kind, name}`. Calls `useResourceGraph`, passes to `GraphCanvas`. Includes depth selector and refresh.
- [ ] Create `frontend/src/k8s/graph/ResourceGraphTab.css`

#### 4.2 Integrate "Relationships" Tab into All Overview Tables

Add to `bottomTabs` array and `renderPanelContent` switch in each `*OverviewTable.tsx`:

```tsx
// bottomTabs array — add before Holmes:
{ key: 'relationships', label: 'Relationships', countable: false },

// renderPanelContent — add case:
if (tab === 'relationships') {
  return <ResourceGraphTab namespace={row.namespace} kind="<Kind>" name={row.name} />;
}
```

Files to modify (17 overview tables):
- [ ] `frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/services/ServicesOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/configmaps/ConfigMapsOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/secrets/SecretsOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/ingresses/IngressesOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/persistentvolumeclaims/PersistentVolumeClaimsOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/persistentvolumes/PersistentVolumesOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/statefulsets/StatefulSetsOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/daemonsets/DaemonSetsOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/replicasets/ReplicaSetsOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/jobs/JobsOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/cronjobs/CronJobsOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/roles/RolesOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/clusterroles/ClusterRolesOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/rolebindings/RoleBindingsOverviewTable.tsx`
- [ ] `frontend/src/k8s/resources/clusterrolebindings/ClusterRoleBindingsOverviewTable.tsx`
- [ ] Pod tables (via `PodOverviewEntry.tsx` or equivalent)

### Phase 5: Frontend — Unit Tests ❌ NOT STARTED

- [ ] Create `frontend/src/__tests__/resourceGraphTab.test.tsx` — Mock `GetResourceGraph`, verify React Flow renders nodes and edges
- [ ] Create `frontend/src/__tests__/graphCanvas.test.tsx` — Test node click dispatches `navigate-to-resource` event, filter toggles
- [ ] Create `frontend/src/__tests__/useGraphLayout.test.ts` — Test dagre layout produces valid positions
- [ ] Update `frontend/src/__tests__/wailsMocks.ts` — Add `GetResourceGraph` mock
- [ ] Run: `cd frontend && npm test`

### Phase 6: E2E Tests ❌ NOT STARTED

- [ ] Create `e2e/tests/110-resource-graph.spec.ts`:
  1. Navigate to Deployments, select a deployment
  2. Switch to "Relationships" tab
  3. Verify graph canvas renders (`#graph-canvas` visible)
  4. Verify expected nodes appear (Deployment, ReplicaSet, Pod nodes)
  5. Click a Pod node, verify navigation to Pods section
- [ ] Run: `cd e2e && npx playwright test tests/110-resource-graph.spec.ts`

### Phase 7: Global Topology Views ✅ COMPLETE (Phase 2 scope)

#### 7.1 Backend
- [x] Add `BuildForNamespace(namespace string)` to graph builder — lists all resources and builds full relationship graph
- [x] Add `BuildStorageGraph(namespace string)` — PVC → PV → StorageClass focused view
- [x] Add `GetNamespaceGraph(namespace)` and `GetStorageGraph(namespace)` Wails RPCs to `pkg/app/graph.go`
- [x] Unit tests for namespace and storage graph builders

#### 7.2 Frontend — Global Graph View
- [x] Create `frontend/src/k8s/graph/GraphView.tsx` — Full-page graph view with mode selector
- [x] Create `frontend/src/k8s/graph/GraphView.css`

#### 7.3 Sidebar Integration
- [x] Modify `frontend/src/layout/SidebarSections.tsx` — Add "Topology" group:
  ```tsx
  { key: 'topology', label: 'Topology', group: true, children: [
    { key: 'namespace-topology', label: 'Namespace Graph' },
    { key: 'storage-graph', label: 'Storage' },
  ]}
  ```
- [x] Modify `frontend/src/main-content.ts` — Add section entries for topology views
- [x] Modify routing via `frontend/src/router.tsx` (no `App.tsx` change required)

#### 7.4 Performance: Large Cluster Handling
- [x] Filter toggles in toolbar: show/hide node kinds (hide Pods to see workload-level only)
- [x] Auto-collapse: if namespace has >200 nodes, collapse Pods into count badges on owner (e.g., "nginx-deploy [12 pods]")
- [x] Depth limiting for namespace graphs (default 1 level of ownership)

#### 7.5 E2E
- [x] Create `e2e/tests/111-namespace-topology.spec.ts`

### Phase 8: Network Policy Visualization ✅ COMPLETE (Phase 3 scope)

#### 8.1 Backend
- [x] Extend `NetworkPolicyPeer` in `pkg/app/networkpolicies.go` — Add `IPBlock *IPBlockRule` (CIDR, Except)
- [x] Add `BuildNetworkPolicyGraph(namespace)` to builder — resolves podSelector to actual pods, creates directed edges for ingress/egress rules with port annotations, CIDR blocks as "external" nodes
- [x] Add `GetNetworkPolicyGraph(namespace)` Wails RPC
- [x] Unit tests

#### 8.2 Frontend
- [x] Add `network-graph` to sidebar Topology group children
- [x] Directed edge styling: ingress = green arrows, egress = red arrows
- [x] Port/protocol labels on edges
- [x] CIDR block nodes as external cloud icons
- [x] E2E test

### Phase 9: RBAC Permission Graph 🚧 IN PROGRESS (Phase 3 scope)

#### 9.1 Backend
- [x] Add `BuildRBACGraph(namespace)` to builder — resolves Subject → RoleBinding → Role → PolicyRules chain, cross-namespace ClusterRoleBindings
- [x] Add Pod → ServiceAccount link (expose `pod.Spec.ServiceAccountName`)
- [x] Add `GetRBACGraph(namespace)` Wails RPC
- [x] Unit tests

#### 9.2 Frontend
- [x] Add `rbac-graph` to sidebar Topology group children
- [x] Subject nodes (User, Group, ServiceAccount) on left, Roles on right, RoleBindings as connecting edges
- [x] Hover on Role shows permission rules in tooltip
- [x] Optional: "What can X do?" search — highlight subgraph for specific subject
- [x] E2E test

### Phase 10: Polish & Advanced Features 🚧 IN PROGRESS (Phase 4 scope)

- [x] Server-side TTL cache (5-10s) for expensive graph computations using `sync.Map`
- [x] Parallel resource fetching using `errgroup.Group` in builder
- [ ] SVG/PNG graph export button (explicitly deferred)
- [x] HPA support: add HPA types/getters to backend, HPA → target workload edges
- [x] Workload hierarchy: dedicated tree layout for CronJob → Job → Pod chains
- [x] Optional: migrate Swarm `TopologyView.tsx` to React Flow for unified codebase

---

## Relationship Types Summary

| Edge Type | Direction | Example | Data Source |
|-----------|-----------|---------|-------------|
| `owns` | Parent → Child | Deployment → ReplicaSet → Pod | OwnerReferences (`resource_details.go`) |
| `selects` | Service → Pod | Service → nginx-pod | `svc.Spec.Selector` + pod labels (new) |
| `mounts` | Workload → Config | Deployment → ConfigMap | Consumer scanning (extended) |
| `routes_to` | Ingress → Service | my-ingress → my-service | `IngressRule.Backend.ServiceName` |
| `bound_to` | PVC → PV | data-pvc → pv-0001 | `PVC.Spec.VolumeName` |
| `provides` | StorageClass → PV | standard → pv-0001 | `PV.Spec.StorageClassName` |
| `runs_on` | Pod → Node | nginx-pod → node-1 | `Pod.Spec.NodeName` |
| `binds` | RoleBinding → Role/Subject | admin-binding → admin-role | `RoleRef` + `Subjects` |
| `network_policy` | Policy → Pod | deny-all → selected-pods | `podSelector.MatchLabels` |

---

## DOM Selectors for Testing

```
#graph-canvas                     — React Flow container
#graph-toolbar                    — Toolbar
#graph-refresh-btn                — Refresh button
#graph-legend                     — Legend overlay
[data-testid="relationships-tab"] — Relationships tab in bottom panel
.graph-node                       — All graph nodes
.graph-node--pod                  — Pod-type nodes
.graph-node--deployment           — Deployment-type nodes
.graph-edge                       — All graph edges
.graph-edge--owns                 — Ownership edges
.graph-edge--selects              — Selector edges
```

---

## Implementation Order

```
Phase 1 (Go graph API + gap fixes)
  |
  v
Phase 2 (Go unit tests)
  |
  v
Phase 3 (Frontend library + core components)  ---+
  |                                               |
  v                                               |
Phase 4 (ResourceGraphTab + table integration)    |
  |                                               |
  v                                               |
Phase 5 (Frontend unit tests)                     |
  |                                               |
  v                                               |
Phase 6 (E2E tests)                               |
  |                                               |
  +----- delivery checkpoint: per-resource --------+
  |      relationship tab working end-to-end
  v
Phase 7 (Global topology + storage views)
  |
  v
Phase 8 (Network policy visualization)
  |
  v
Phase 9 (RBAC permission graph)
  |
  v
Phase 10 (Polish, caching, export, HPA)
```

Phases 1-6 form the core deliverable (per-resource Relationships tab). Phases 7-10 add global topology views and specialized visualizations. Each phase delivers working, tested functionality.

---

## Files Summary

### New Files (Phase 1-6 core)

**Backend (5):**
- `pkg/app/k8s_graph/types.go`
- `pkg/app/k8s_graph/builder.go`
- `pkg/app/k8s_graph/builder_test.go`
- `pkg/app/graph.go`

**Frontend (14):**
- `frontend/src/k8s/graph/utils/graphApi.ts`
- `frontend/src/k8s/graph/utils/graphStyles.ts`
- `frontend/src/k8s/graph/utils/layoutEngine.ts`
- `frontend/src/k8s/graph/hooks/useResourceGraph.ts`
- `frontend/src/k8s/graph/hooks/useGraphLayout.ts`
- `frontend/src/k8s/graph/hooks/useGraphNavigation.ts`
- `frontend/src/k8s/graph/components/GraphCanvas.tsx`
- `frontend/src/k8s/graph/components/GraphCanvas.css`
- `frontend/src/k8s/graph/components/GraphToolbar.tsx`
- `frontend/src/k8s/graph/components/GraphLegend.tsx`
- `frontend/src/k8s/graph/components/nodes/ResourceNode.tsx`
- `frontend/src/k8s/graph/components/edges/RelationshipEdge.tsx`
- `frontend/src/k8s/graph/ResourceGraphTab.tsx`
- `frontend/src/k8s/graph/ResourceGraphTab.css`

**Tests (4):**
- `frontend/src/__tests__/resourceGraphTab.test.tsx`
- `frontend/src/__tests__/graphCanvas.test.tsx`
- `frontend/src/__tests__/useGraphLayout.test.ts`
- `e2e/tests/110-resource-graph.spec.ts`

### New Files (Phase 7-10 extended)

- `frontend/src/k8s/graph/GraphView.tsx`
- `frontend/src/k8s/graph/GraphView.css`
- `e2e/tests/111-namespace-topology.spec.ts`

### Modified Files

**Backend (4):**
- `pkg/app/types.go` — Add `Selector` to `ServiceInfo`
- `pkg/app/services.go` — Populate `Selector: svc.Spec.Selector`
- `pkg/app/configmaps_consumers.go` — Extend to scan StatefulSets, DaemonSets, Jobs, CronJobs
- `pkg/app/secrets_consumers.go` — Same extension
- `pkg/app/pvc_consumers.go` — Extend to scan Deployments, StatefulSets, DaemonSets
- `pkg/app/networkpolicies.go` — Add IPBlock to NetworkPolicyPeer (Phase 8)

**Frontend (19):**
- `frontend/package.json` — Add `@xyflow/react`, `@dagrejs/dagre`
- `frontend/src/__tests__/wailsMocks.ts` — Add `GetResourceGraph` mock
- 17 `*OverviewTable.tsx` files — Add "Relationships" tab (see Phase 4 list)

**Frontend (Phase 7, additional):**
- `frontend/src/layout/SidebarSections.tsx` — Add "Topology" group
- `frontend/src/main-content.ts` — Add topology section entries

---

## Key Backend Patterns to Reuse

| Pattern | Location | Reuse For |
|---------|----------|-----------|
| `isPodOwnedBy(pod, kind, name)` | `resource_details.go:158` | Owner reference traversal in builder |
| `isOwnedBy(refs, kind, name)` | `resource_details.go:307` | Same |
| `collectOwnedPods(pods, kind, name)` | `resource_details.go:198` | Pod collection pattern |
| `labels.SelectorFromSet()` | `resource_details.go:14` (import) | Service selector → Pod matching |
| `podSpecUsesConfigMap(spec, name)` | `configmaps_consumers.go:58` | ConfigMap reference detection |
| `podSpecUsesSecret(spec, name)` | `secrets_consumers.go:59` | Secret reference detection |
| `buildIngressRulesFromSpec(ing)` | `resource_details.go:793` | Ingress → Service resolution |
| `getKubernetesInterface()` | `kube_rest.go:71` | Obtain clientset for builder |

---

## Verification

### Phase 1-6 (Core Deliverable)
1. `go test -cover ./pkg/app/k8s_graph/...` — all pass, ≥70% coverage
2. `cd frontend && npm test` — all pass including new graph tests
3. `wails dev` → Deployments → select deployment → "Relationships" tab → interactive graph with Deployment → ReplicaSet → Pods → Node, plus ConfigMap/Secret mounts
4. Click a Pod node in graph → navigates to Pods section and selects that pod
5. `cd e2e && npx playwright test tests/110-resource-graph.spec.ts` — passes

### Phase 7+ (Extended)
1. Sidebar shows "Topology" group with "Namespace Graph" and "Storage"
2. Click "Namespace Graph" → all resources in namespace with interconnections
3. Filter toggles work (hide Pods, show workloads only)
4. Network Policy graph shows directed ingress/egress edges with ports
5. RBAC graph shows Subject → RoleBinding → Role chains
6. All Go + frontend tests pass in CI pipeline
