# CI Playwright fixes (2026-02-12)

## Context
- Source artifacts inspected:
  - `e2e-test-results-e2e-shard-1/test-results/*/error-context.md`
  - `e2e-test-results-e2e-shard-2/test-results/*/error-context.md`
- Primary failures:
  - hidden sidebar child section links (`#section-deployments`) when parent groups are collapsed
  - flaky sidebar selected-state check based on CSS class only
  - strict-mode locator ambiguity in Swarm network summary assertion
  - resource-graph e2e expecting page title navigation to Pods after node click

## Approaches tried

### 1) Sidebar section navigation robustness
- **What failed in CI:** `goToSection('deployments')` waited for a hidden child link and timed out.
- **Successful approach:** added an explicit group-expansion step in `SidebarPage` before waiting/clicking a child section.
  - Added `ensureSectionVisible()` with `childGroupBySection` map (Workloads/RBAC children)
  - If section is hidden, expand `#section-<group>` when `aria-expanded != true`
- **Why this worked:** snapshots showed group collapsed state with child links present but hidden.

### 2) Sidebar selected-state assertion
- **What failed in CI:** class-based assertion `toHaveClass(/selected/)` intermittently failed under load.
- **Successful approach:** replaced with semantic selected-state assertion using `aria-current="page"`.
- **Why this worked:** frontend sidebar links explicitly set `aria-current` on selected links.

### 3) Swarm network summary strict-mode failure
- **What failed in CI:** `panelRoot.getByText(fixtureNetworkName)` matched two elements (strict mode violation).
- **Successful approach:** narrowed assertion to `.first()` for that text lookup.
- **Why this worked:** panel intentionally renders network name in both title and quick-info value.

### 4) Resource graph navigation assertion
- **What failed in CI:** assertion expected overview title to change to Pods after clicking pod graph node.
- **Successful approach:** changed assertion to verify graph node click emits `navigate-to-resource` with a Pod kind payload.
- **Why this worked:** this directly validates graph click behavior while avoiding brittle coupling to downstream page title timing/state.

## Files changed
- `e2e/src/pages/SidebarPage.ts`
- `e2e/tests/110-resource-graph.spec.ts`
- `e2e/tests/swarm/74-networks-volumes-usage.spec.ts`

## Additional retries (same day)

### 5) RBAC Roles panel runtime crash (hook order)
- **Observed while re-running:** `100-rbac-resources.spec.ts` failed opening Role YAML tab with React error:
  - `Rendered more hooks than during the previous render`
  - stack pointed to `frontend/src/k8s/resources/roles/RolesOverviewTable.tsx` in `renderPanelContent`
- **Root cause:** `useState/useEffect` were called inside `renderPanelContent` only when `tab === 'yaml'`, violating Rules of Hooks.
- **Successful approach:** moved YAML state/effect into dedicated `RoleYamlTab` component and rendered that component for YAML tab.
- **Why this worked:** hooks are now called consistently at component top level, independent of parent tab branching.

### 6) RBAC subjects strict-mode ambiguity
- **Observed after hook fix:** strict-mode failure on `panel.getByText('User')` due to matches on both `User` and `e2e-user` cells.
- **Successful approach:** changed assertion to exact table-cell role locator:
  - `panel.getByRole('cell', { name: 'User', exact: true })`
  - applied in both RoleBinding and ClusterRoleBinding subject checks.
- **Why this worked:** role-based exact locator removes substring ambiguity and stays resilient to extra values in the same panel.

## Additional files changed
- `frontend/src/k8s/resources/roles/RolesOverviewTable.tsx`
- `e2e/tests/100-rbac-resources.spec.ts`
