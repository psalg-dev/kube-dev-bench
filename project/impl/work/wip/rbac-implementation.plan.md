---
title: "Implementation Plan: K8s RBAC Resources"
status: wip
priority: medium
---
# Implementation Plan: K8s RBAC Resources

**Status:** WIP (30% — backend types + getters done, no frontend)
**Created:** 2026-02-05
**Updated:** 2026-02-06

Add support for Roles, ClusterRoles, RoleBindings, and ClusterRoleBindings with full CRUD and a collapsible sidebar group.

**Summary:** Backend has basic types and list getters implemented in dedicated files (`roles.go`, `rolebindings.go`). MCP tools for all 4 RBAC resources are live (via `pkg/app/mcp/tools.go`). Unit tests exist for list operations. However: no detail getters, no YAML getters, no delete support, no polling, no resource counts, and **zero frontend implementation** (no sidebar, no tables, no routing).

**Note:** Frontend was migrated to TypeScript in PR #104. All frontend file references use `.tsx`/`.ts` extensions.

---

## Phase 1: Go Backend ✅ PARTIALLY COMPLETE

### 1.1 Type Definitions ✅ IMPLEMENTED

Types are defined in separate files:
- `pkg/app/roles.go` — `RoleInfo` (Name, Namespace, Age, Rules, Labels, Annotations), `PolicyRule` (APIGroups, Resources, Verbs, ResourceNames)
- `pkg/app/rolebindings.go` — `RoleBindingInfo` (Name, Namespace, RoleRef, Subjects), `RoleRef`, `Subject`

**Note:** Types are in dedicated files rather than `types.go` (cleaner organization).

- [ ] Add to `ResourceCounts` — ❌ NOT YET ADDED to counts.go

### 1.2 Resource Getters ✅ PARTIALLY IMPLEMENTED

Implemented in `pkg/app/roles.go` and `pkg/app/rolebindings.go`:

| Method | Status | Location |
|--------|--------|----------|
| `GetRoles(namespace)` | ✅ | `roles.go` |
| `GetClusterRoles()` | ✅ | `roles.go` |
| `GetRoleBindings(namespace)` | ✅ | `rolebindings.go` |
| `GetClusterRoleBindings()` | ✅ | `rolebindings.go` |
| `GetRoleDetail(namespace, name)` | ❌ | Not implemented |
| `GetClusterRoleDetail(name)` | ❌ | Not implemented |
| `GetRoleBindingSubjects(namespace, name)` | ❌ | Not implemented |
| `GetClusterRoleBindingSubjects(name)` | ❌ | Not implemented |
| `StartRBACPolling()` | ❌ | Not implemented |

**MCP Tools Exposed (via `pkg/app/mcp/tools.go`):**
- `k8s_list_roles` ✅
- `k8s_list_cluster_roles` ✅
- `k8s_list_role_bindings` ✅
- `k8s_list_cluster_role_bindings` ✅

### 1.3 YAML Getters — append to `pkg/app/resource_yaml.go` ❌ NOT IMPLEMENTED

Follow existing pattern (`GetServiceYAML` etc.):
- [ ] `GetRoleYAML(namespace, name) (string, error)`
- [ ] `GetClusterRoleYAML(name) (string, error)`
- [ ] `GetRoleBindingYAML(namespace, name) (string, error)`
- [ ] `GetClusterRoleBindingYAML(name) (string, error)`

### 1.4 Delete Support — `pkg/app/delete_resource.go` ❌ NOT IMPLEMENTED

Add 4 cases to the switch:
```go
case "role":               clientset.RbacV1().Roles(namespace).Delete(...)
case "clusterrole":        clientset.RbacV1().ClusterRoles().Delete(...)
case "rolebinding":        clientset.RbacV1().RoleBindings(namespace).Delete(...)
case "clusterrolebinding": clientset.RbacV1().ClusterRoleBindings().Delete(...)
```

### 1.5 Counts — `pkg/app/counts.go` ❌ NOT IMPLEMENTED

- [ ] Add RBAC to `refreshResourceCounts()`: Roles/RoleBindings inside namespace loop; ClusterRoles/ClusterRoleBindings outside (like PersistentVolumes)
- [ ] Update `resourceCountsEqual()` to compare new fields

### 1.6 Register Polling — `main.go` ❌ NOT IMPLEMENTED

- [ ] Add `app.StartRBACPolling()` after existing polling registrations.

---

## Phase 2: Go Backend Tests ✅ PARTIALLY IMPLEMENTED

Tests exist in:
- `pkg/app/roles_test.go` — Tests for GetRoles, GetClusterRoles
- `pkg/app/rolebindings_test.go` — Tests for GetRoleBindings, GetClusterRoleBindings

| Test | Status |
|------|--------|
| `TestGetRoles` | ✅ |
| `TestGetClusterRoles` | ✅ |
| `TestGetRoleBindings` | ✅ |
| `TestGetClusterRoleBindings` | ✅ |
| `TestGetRoleDetail` | ❌ Not implemented (detail getter not implemented) |
| `TestGetClusterRoleDetail` | ❌ Not implemented |
| `TestGetRoleBindingSubjects` | ❌ Not implemented |
| `TestGetClusterRoleBindingSubjects` | ❌ Not implemented |
| YAML getter tests | ❌ Not implemented |
| Delete tests | ❌ Not implemented |

---

## Phase 3: Frontend — Collapsible Sidebar Group ❌ NOT STARTED

### Modify: `frontend/src/layout/SidebarSections.tsx`

**Status:** ❌ RBAC group not present in sidebar

Current sidebar sections (14):
pods, deployments, services, jobs, cronjobs, daemonsets, statefulsets, replicasets, configmaps, secrets, ingresses, persistentvolumeclaims, persistentvolumes, helmreleases

Add group entry to `resourceSections`:
```ts
{
  key: 'rbac',
  label: 'RBAC',
  group: true,
  children: [
    { key: 'roles', label: 'Roles' },
    { key: 'clusterroles', label: 'Cluster Roles' },
    { key: 'rolebindings', label: 'Role Bindings' },
    { key: 'clusterrolebindings', label: 'Cluster Role Bindings' },
  ]
}
```

Rendering changes:
- [ ] When `sec.group === true`, render a clickable header with collapse chevron + summed count badge
- [ ] `useState` for collapsed state (default: collapsed)
- [ ] When expanded, render indented children with individual counts
- [ ] Auto-expand when a child is the `selected` section
- [ ] Stable DOM ids: `#section-rbac` (group header), `#section-roles`, etc.

### Modify: `frontend/src/app.css`

- [ ] Add styles for `.sidebar-group-header`, `.sidebar-group-children`, `.sidebar-group-children.collapsed`.

### Modify: `frontend/src/state/ResourceCountsContext.tsx`

- [ ] Add `roles`, `clusterroles`, `rolebindings`, `clusterrolebindings` to signature computation.

---

## Phase 4: Frontend — RBAC Overview Tables ❌ NOT STARTED

**Status:** No RBAC frontend directories or components exist.

### New directories and files needed:

| File | Status | Columns | Key Tabs |
|------|--------|---------|----------|
| `frontend/src/k8s/resources/roles/RolesOverviewTable.tsx` | ❌ | Name, Namespace, Rules, Age | Summary, Rules, Events, YAML, Holmes |
| `frontend/src/k8s/resources/clusterroles/ClusterRolesOverviewTable.tsx` | ❌ | Name, Rules, Age | Summary, Rules, Events, YAML, Holmes |
| `frontend/src/k8s/resources/rolebindings/RoleBindingsOverviewTable.tsx` | ❌ | Name, Namespace, Role Ref, Subjects, Age | Summary, Subjects, Events, YAML, Holmes |
| `frontend/src/k8s/resources/clusterrolebindings/ClusterRoleBindingsOverviewTable.tsx` | ❌ | Name, Role Ref, Subjects, Age | Summary, Subjects, Events, YAML, Holmes |

### Shared components needed:

| File | Status | Purpose |
|------|--------|---------|
| `frontend/src/k8s/resources/rbac/PolicyRulesTable.tsx` | ❌ | Renders `[]PolicyRuleInfo` — columns: Verbs, API Groups, Resources, Resource Names |
| `frontend/src/k8s/resources/rbac/SubjectsTable.tsx` | ❌ | Renders `[]SubjectInfo` — columns: Kind, Name, Namespace |

All tables should follow `DeploymentsOverviewTable.tsx` pattern:
- Fetch via `AppAPI.Get{Resource}()`, listen to `{resource}:update` events
- Normalize data, use `<OverviewTableWithPanel>` wrapper
- Delete action via `AppAPI.DeleteResource(type, namespace, name)`
- Create via existing YAML overlay
- Holmes integration for AI analysis

**Cluster-scoped resources** (ClusterRoles, ClusterRoleBindings): no Namespace column, fetch once (not per-namespace), like `PersistentVolumesOverviewTable`.

---

## Phase 5: Frontend — Routing & Wiring ❌ NOT STARTED

### Modify: `frontend/src/main-content.ts`

Add imports and section entries for all 4 RBAC tables:
```ts
{ id: 'roles-overview-react', section: 'roles', table: RolesOverviewTable, props: {namespaces, namespace} },
{ id: 'clusterroles-overview-react', section: 'clusterroles', table: ClusterRolesOverviewTable, props: {namespace} },
{ id: 'rolebindings-overview-react', section: 'rolebindings', table: RoleBindingsOverviewTable, props: {namespaces, namespace} },
{ id: 'clusterrolebindings-overview-react', section: 'clusterrolebindings', table: ClusterRoleBindingsOverviewTable, props: {namespace} },
```

### Modify: `frontend/src/__tests__/wailsMocks.ts`

Add all new RBAC API function names to the mock registry.

### Rebuild Wails bindings

Run `wails dev` or `wails build` to regenerate `frontend/wailsjs/go/main/App.js` and `App.d.ts`.

---

## Phase 6: Frontend Unit Tests ❌ NOT STARTED

| Test File | What It Tests |
|-----------|---------------|
| `frontend/src/__tests__/rolesOverviewTable.test.tsx` | Loading, data display, empty state, delete action |
| `frontend/src/__tests__/clusterRolesOverviewTable.test.tsx` | Same pattern, no namespace column |
| `frontend/src/__tests__/roleBindingsOverviewTable.test.tsx` | RoleRef display, subjects count |
| `frontend/src/__tests__/clusterRoleBindingsOverviewTable.test.tsx` | Same pattern, cluster-scoped |
| `frontend/src/__tests__/sidebarRbacGroup.test.tsx` | Collapsible group behavior, auto-expand, count badges |

---

## Phase 7: E2E Tests ❌ NOT STARTED

### New: `e2e/tests/100-rbac-resources.spec.ts`

1. Navigate to RBAC > Roles via sidebar (expand group, click Roles)
2. Create a Role via YAML overlay
3. Verify it appears in table
4. Open bottom panel, verify Rules tab displays policy rules
5. Switch to YAML tab
6. Delete the role
7. Repeat for ClusterRole, RoleBinding, ClusterRoleBinding

### Modify: `e2e/src/pages/Sidebar.ts`

Add `goToRbacSection(section)` helper that expands the RBAC group then clicks the sub-section.

---

## Implementation Order

```
Phase 1 (Go backend — remaining)  ---+
                                      +---> Phase 2 (Go tests — remaining)
Phase 3 (Sidebar UI) ----------------+
                                      +---> Phase 4 (Overview tables)
                                      |         |
                                      |         v
                                      +---> Phase 5 (Routing + wiring)
                                      |         |
                                      |         v
                                      +---> Phase 6 (Frontend unit tests)
                                      |         |
                                      |         v
                                      +---> Phase 7 (E2E tests)
```

Phases 1 and 3 can run in parallel. Phase 4 depends on Phase 1 (API shape) and Phase 3 (sidebar navigation). Phases 5-7 are sequential.

---

## Files Summary

**New files (14):**
- `frontend/src/k8s/resources/roles/RolesOverviewTable.tsx`
- `frontend/src/k8s/resources/clusterroles/ClusterRolesOverviewTable.tsx`
- `frontend/src/k8s/resources/rolebindings/RoleBindingsOverviewTable.tsx`
- `frontend/src/k8s/resources/clusterrolebindings/ClusterRoleBindingsOverviewTable.tsx`
- `frontend/src/k8s/resources/rbac/PolicyRulesTable.tsx`
- `frontend/src/k8s/resources/rbac/SubjectsTable.tsx`
- `frontend/src/__tests__/rolesOverviewTable.test.tsx`
- `frontend/src/__tests__/clusterRolesOverviewTable.test.tsx`
- `frontend/src/__tests__/roleBindingsOverviewTable.test.tsx`
- `frontend/src/__tests__/clusterRoleBindingsOverviewTable.test.tsx`
- `frontend/src/__tests__/sidebarRbacGroup.test.tsx`
- `e2e/tests/100-rbac-resources.spec.ts`

**Existing files (already implemented):**
- `pkg/app/roles.go` — RoleInfo type + GetRoles/GetClusterRoles ✅
- `pkg/app/rolebindings.go` — RoleBindingInfo type + GetRoleBindings/GetClusterRoleBindings ✅
- `pkg/app/roles_test.go` — Unit tests ✅
- `pkg/app/rolebindings_test.go` — Unit tests ✅
- `pkg/app/mcp/tools.go` — 4 RBAC MCP tools ✅

**Modified files (9):**
- `pkg/app/resource_yaml.go` — 4 YAML getters
- `pkg/app/delete_resource.go` — 4 RBAC delete cases
- `pkg/app/counts.go` — RBAC in refresh + equals
- `main.go` — register `StartRBACPolling()`
- `frontend/src/layout/SidebarSections.tsx` — collapsible group
- `frontend/src/app.css` — group styles
- `frontend/src/main-content.ts` — 4 RBAC section entries
- `frontend/src/__tests__/wailsMocks.ts` — RBAC mock functions

---

## Verification

1. `go test -cover ./pkg/app/...` — all pass, >=70% on new code
2. `cd frontend && npm test` — all pass
3. `wails dev` — app starts, RBAC group visible in sidebar, expanding shows 4 sub-items with counts
4. Create/view/delete Role, ClusterRole, RoleBinding, ClusterRoleBinding via UI
5. `cd e2e && npx playwright test tests/100-rbac-resources.spec.ts` — passes
