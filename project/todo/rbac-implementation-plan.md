# Implementation Plan: K8s RBAC Resources

Add support for Roles, ClusterRoles, RoleBindings, and ClusterRoleBindings with full CRUD and a collapsible sidebar group.

---

## Phase 1: Go Backend

### 1.1 Type Definitions — `pkg/app/types.go`

Add after existing types:

```go
type PolicyRuleInfo struct {
    Verbs           []string `json:"verbs"`
    APIGroups       []string `json:"apiGroups"`
    Resources       []string `json:"resources"`
    ResourceNames   []string `json:"resourceNames,omitempty"`
    NonResourceURLs []string `json:"nonResourceURLs,omitempty"`
}

type RoleInfo struct {
    Name      string            `json:"name"`
    Namespace string            `json:"namespace"`
    Rules     int               `json:"rules"`
    Age       string            `json:"age"`
    Labels    map[string]string `json:"labels"`
}

type ClusterRoleInfo struct {
    Name   string            `json:"name"`
    Rules  int               `json:"rules"`
    Age    string            `json:"age"`
    Labels map[string]string `json:"labels"`
}

type SubjectInfo struct {
    Kind      string `json:"kind"`
    Name      string `json:"name"`
    Namespace string `json:"namespace,omitempty"`
    APIGroup  string `json:"apiGroup,omitempty"`
}

type RoleRefInfo struct {
    Kind     string `json:"kind"`
    Name     string `json:"name"`
    APIGroup string `json:"apiGroup"`
}

type RoleBindingInfo struct {
    Name      string            `json:"name"`
    Namespace string            `json:"namespace"`
    RoleRef   RoleRefInfo       `json:"roleRef"`
    Subjects  int               `json:"subjects"`
    Age       string            `json:"age"`
    Labels    map[string]string `json:"labels"`
}

type ClusterRoleBindingInfo struct {
    Name     string            `json:"name"`
    RoleRef  RoleRefInfo       `json:"roleRef"`
    Subjects int               `json:"subjects"`
    Age      string            `json:"age"`
    Labels   map[string]string `json:"labels"`
}
```

Add to `ResourceCounts`:
```go
Roles               int `json:"roles"`
ClusterRoles        int `json:"clusterroles"`
RoleBindings        int `json:"rolebindings"`
ClusterRoleBindings int `json:"clusterrolebindings"`
```

### 1.2 Resource Getters — new `pkg/app/rbac.go`

Methods (follow `deployments.go` pattern with `testClientset` injection):

| Method | Scope | K8s API |
|--------|-------|---------|
| `GetRoles(namespace)` | namespace | `RbacV1().Roles(ns).List()` |
| `GetClusterRoles()` | cluster | `RbacV1().ClusterRoles().List()` |
| `GetRoleBindings(namespace)` | namespace | `RbacV1().RoleBindings(ns).List()` |
| `GetClusterRoleBindings()` | cluster | `RbacV1().ClusterRoleBindings().List()` |
| `GetRoleDetail(namespace, name)` -> `[]PolicyRuleInfo` | namespace | `.Get()` then map Rules |
| `GetClusterRoleDetail(name)` -> `[]PolicyRuleInfo` | cluster | `.Get()` then map Rules |
| `GetRoleBindingSubjects(namespace, name)` -> `[]SubjectInfo` | namespace | `.Get()` then map Subjects |
| `GetClusterRoleBindingSubjects(name)` -> `[]SubjectInfo` | cluster | `.Get()` then map Subjects |
| `StartRBACPolling()` | -- | Single goroutine, 4s interval, emits `roles:update`, `clusterroles:update`, `rolebindings:update`, `clusterrolebindings:update` |

### 1.3 YAML Getters — append to `pkg/app/resource_yaml.go`

Follow existing pattern (`GetServiceYAML` etc.):
- `GetRoleYAML(namespace, name) (string, error)`
- `GetClusterRoleYAML(name) (string, error)`
- `GetRoleBindingYAML(namespace, name) (string, error)`
- `GetClusterRoleBindingYAML(name) (string, error)`

### 1.4 Delete Support — `pkg/app/delete_resource.go`

Add 4 cases to the switch:
```go
case "role":               clientset.RbacV1().Roles(namespace).Delete(...)
case "clusterrole":        clientset.RbacV1().ClusterRoles().Delete(...)
case "rolebinding":        clientset.RbacV1().RoleBindings(namespace).Delete(...)
case "clusterrolebinding": clientset.RbacV1().ClusterRoleBindings().Delete(...)
```

### 1.5 Counts — `pkg/app/counts.go`

- Add RBAC to `refreshResourceCounts()`: Roles/RoleBindings inside namespace loop; ClusterRoles/ClusterRoleBindings outside (like PersistentVolumes)
- Update `resourceCountsEqual()` to compare new fields

### 1.6 Register Polling — `main.go`

Add `app.StartRBACPolling()` after existing polling registrations.

---

## Phase 2: Go Backend Tests

### New: `pkg/app/rbac_test.go`

Table-driven tests with `fake.NewSimpleClientset()`:
- `TestGetRoles` — empty, single, multiple, namespace filtering
- `TestGetClusterRoles` — empty, single, multiple (no namespace param)
- `TestGetRoleBindings` — empty, single, multiple, RoleRef verification
- `TestGetClusterRoleBindings` — empty, single, multiple
- `TestGetRoleDetail` — returns full PolicyRuleInfo array
- `TestGetClusterRoleDetail` — returns full PolicyRuleInfo array
- `TestGetRoleBindingSubjects` — returns SubjectInfo array
- `TestGetClusterRoleBindingSubjects` — returns SubjectInfo array

### Modified: `pkg/app/delete_resource.go` tests

Add RBAC delete cases to existing test file.

Target: >=70% coverage on all new Go code.

---

## Phase 3: Frontend — Collapsible Sidebar Group

### Modify: `frontend/src/layout/SidebarSections.jsx`

Add group entry to `resourceSections`:
```js
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
- When `sec.group === true`, render a clickable header with collapse chevron + summed count badge
- `useState` for collapsed state (default: collapsed)
- When expanded, render indented children with individual counts
- Auto-expand when a child is the `selected` section
- Stable DOM ids: `#section-rbac` (group header), `#section-roles`, etc.

### Modify: `frontend/src/app.css`

Add styles for `.sidebar-group-header`, `.sidebar-group-children`, `.sidebar-group-children.collapsed`.

### Modify: `frontend/src/state/ResourceCountsContext.jsx`

Add `roles`, `clusterroles`, `rolebindings`, `clusterrolebindings` to signature computation.

---

## Phase 4: Frontend — RBAC Overview Tables

### New directories and files:

| File | Columns | Key Tabs |
|------|---------|----------|
| `frontend/src/k8s/resources/roles/RolesOverviewTable.jsx` | Name, Namespace, Rules, Age | Summary, Rules, Events, YAML, Holmes |
| `frontend/src/k8s/resources/clusterroles/ClusterRolesOverviewTable.jsx` | Name, Rules, Age | Summary, Rules, Events, YAML, Holmes |
| `frontend/src/k8s/resources/rolebindings/RoleBindingsOverviewTable.jsx` | Name, Namespace, Role Ref, Subjects, Age | Summary, Subjects, Events, YAML, Holmes |
| `frontend/src/k8s/resources/clusterrolebindings/ClusterRoleBindingsOverviewTable.jsx` | Name, Role Ref, Subjects, Age | Summary, Subjects, Events, YAML, Holmes |

### Shared components:

| File | Purpose |
|------|---------|
| `frontend/src/k8s/resources/rbac/PolicyRulesTable.jsx` | Renders `[]PolicyRuleInfo` — columns: Verbs, API Groups, Resources, Resource Names |
| `frontend/src/k8s/resources/rbac/SubjectsTable.jsx` | Renders `[]SubjectInfo` — columns: Kind, Name, Namespace |

All tables follow `DeploymentsOverviewTable.jsx` pattern:
- Fetch via `AppAPI.Get{Resource}()`, listen to `{resource}:update` events
- Normalize data, use `<OverviewTableWithPanel>` wrapper
- Delete action via `AppAPI.DeleteResource(type, namespace, name)`
- Create via existing YAML overlay
- Holmes integration for AI analysis

**Cluster-scoped resources** (ClusterRoles, ClusterRoleBindings): no Namespace column, fetch once (not per-namespace), like `PersistentVolumesOverviewTable`.

---

## Phase 5: Frontend — Routing & Wiring

### Modify: `frontend/src/main-content.js`

Add imports and section entries for all 4 RBAC tables:
```js
{ id: 'roles-overview-react', section: 'roles', table: RolesOverviewTable, props: {namespaces, namespace} },
{ id: 'clusterroles-overview-react', section: 'clusterroles', table: ClusterRolesOverviewTable, props: {namespace} },
{ id: 'rolebindings-overview-react', section: 'rolebindings', table: RoleBindingsOverviewTable, props: {namespaces, namespace} },
{ id: 'clusterrolebindings-overview-react', section: 'clusterrolebindings', table: ClusterRoleBindingsOverviewTable, props: {namespace} },
```

### Modify: `frontend/src/__tests__/wailsMocks.js`

Add all new RBAC API function names to the mock registry.

### Rebuild Wails bindings

Run `wails dev` or `wails build` to regenerate `frontend/wailsjs/go/main/App.js` and `App.d.ts`.

---

## Phase 6: Frontend Unit Tests

| Test File | What It Tests |
|-----------|---------------|
| `frontend/src/__tests__/rolesOverviewTable.test.jsx` | Loading, data display, empty state, delete action |
| `frontend/src/__tests__/clusterRolesOverviewTable.test.jsx` | Same pattern, no namespace column |
| `frontend/src/__tests__/roleBindingsOverviewTable.test.jsx` | RoleRef display, subjects count |
| `frontend/src/__tests__/clusterRoleBindingsOverviewTable.test.jsx` | Same pattern, cluster-scoped |
| `frontend/src/__tests__/sidebarRbacGroup.test.jsx` | Collapsible group behavior, auto-expand, count badges |

---

## Phase 7: E2E Tests

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
Phase 1 (Go backend)  ---+
                          +---> Phase 2 (Go tests)
Phase 3 (Sidebar UI) ----+
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

**New files (16):**
- `pkg/app/rbac.go`
- `pkg/app/rbac_test.go`
- `frontend/src/k8s/resources/roles/RolesOverviewTable.jsx`
- `frontend/src/k8s/resources/clusterroles/ClusterRolesOverviewTable.jsx`
- `frontend/src/k8s/resources/rolebindings/RoleBindingsOverviewTable.jsx`
- `frontend/src/k8s/resources/clusterrolebindings/ClusterRoleBindingsOverviewTable.jsx`
- `frontend/src/k8s/resources/rbac/PolicyRulesTable.jsx`
- `frontend/src/k8s/resources/rbac/SubjectsTable.jsx`
- `frontend/src/__tests__/rolesOverviewTable.test.jsx`
- `frontend/src/__tests__/clusterRolesOverviewTable.test.jsx`
- `frontend/src/__tests__/roleBindingsOverviewTable.test.jsx`
- `frontend/src/__tests__/clusterRoleBindingsOverviewTable.test.jsx`
- `frontend/src/__tests__/sidebarRbacGroup.test.jsx`
- `e2e/tests/100-rbac-resources.spec.ts`

**Modified files (9):**
- `pkg/app/types.go` — RBAC structs + ResourceCounts fields
- `pkg/app/resource_yaml.go` — 4 YAML getters
- `pkg/app/delete_resource.go` — 4 RBAC delete cases
- `pkg/app/counts.go` — RBAC in refresh + equals
- `main.go` — register `StartRBACPolling()`
- `frontend/src/layout/SidebarSections.jsx` — collapsible group
- `frontend/src/app.css` — group styles
- `frontend/src/main-content.js` — 4 RBAC section entries
- `frontend/src/__tests__/wailsMocks.js` — RBAC mock functions

---

## Verification

1. `go test -cover ./pkg/app/...` — all pass, >=70% on new code
2. `cd frontend && npm test` — all pass
3. `wails dev` — app starts, RBAC group visible in sidebar, expanding shows 4 sub-items with counts
4. Create/view/delete Role, ClusterRole, RoleBinding, ClusterRoleBinding via UI
5. `cd e2e && npx playwright test tests/100-rbac-resources.spec.ts` — passes
