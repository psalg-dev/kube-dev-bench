# Plan: Consolidate all resource tables onto one generic TanStack DataTable, deleting ~8k lines of duplicated view code

## Shared context

**Repo**: `kube-dev-bench` (Wails: Go backend + React 19 frontend). Git repo present. Frontend root: `frontend/`.
**Run/test**: from `frontend/` → `npm run typecheck && npm run test && npm run lint`. Tests = vitest + @testing-library/react (jsdom). Test files live in `frontend/src/__tests__/`. Mock the wails runtime at the boundary via existing `frontend/src/__tests__/wailsMocks.ts`.

**What we're doing & why**: 27 `*OverviewTable.tsx` components (14,138 LOC) each hand-roll fetch + live-watch + selection + bulk + a ~150-line copy-pasted Holmes stream reducer (22 of 27 = ~3,300 duplicated lines). `PodOverviewTable.tsx` (1,357 LOC) is a custom TanStack outlier. 21 `config/resourceConfigs/*.tsx` already exist but most views ignore them. We build one generic `DataTable<TRow>` on TanStack v8 (already installed: `@tanstack/react-table ^8.21.3`), re-skin the existing engine on top of it (props unchanged), then collapse the 27 views into thin `GenericResourceTable {...config}` wrappers + one shared Holmes hook. Target: ~14k view LOC → ~4–6k, **≈8,000 net lines deleted**.

**Config imports**: import each resource config directly from its own file (e.g. `config/resourceConfigs/deploymentConfig`), NOT from the `config/resourceConfigs/index.ts` barrel — this keeps Wave-4 slices from all editing the same barrel file (collision). The 21 configs already exist; slices only edit their own config file.

**Where things live** (read these before touching — trace the real flow):
- Engine (raw `<table>`, NOT TanStack): `frontend/src/layout/overview/OverviewTableWithPanel.tsx`. Provides global filter, single-col sort, bulk-select, `···` row-action menu, click-row → bottom panel, create overlay, tab counts. Missing: column reorder + hide. Heavily `any`-typed.
- Factory: `frontend/src/components/GenericResourceTable/index.tsx` (engine + `hooks/useResourceData.ts` + `hooks/useHolmesAnalysis.ts`). Casts engine `as unknown as ComponentType` — a double-cast hiding a type mismatch.
- Configs: `frontend/src/config/resourceConfigs/*.tsx` (21) + `.../swarm/*.tsx`. `podConfig.tsx` exists (203 LOC) but is unused.
- Custom outlier: `frontend/src/k8s/resources/pods/PodOverviewTable.tsx`. **Bug to fix on migration**: rebuilds ALL column defs every second (`useMemo(...,[now])`) to tick uptime → churns whole table each tick.
- Reference Holmes reducer (identical in 22 files): `frontend/src/k8s/resources/deployments/DeploymentsOverviewTable.tsx` ~L317–453; also `PodOverviewTable.tsx` ~L126–267.

**Reuse — do NOT rewrite**: `layout/bottompanel/BottomPanel.tsx`, `components/BulkActionBar.tsx`, `components/StatusBadge.tsx`, `components/BaseModal/`, `hooks/useResourceWatch.ts`, `hooks/useResourceData.ts`, `hooks/useHolmesAnalysis.ts`, `constants/bulkActions.ts`, `utils/tableSorting.ts` (port its duration parser; don't duplicate the whole file), `notification` module (`showSuccess`/`showError`).

**Locked public API** — every slice codes against this; two slices must not disagree on it. Created by Slice 5 in `frontend/src/components/DataTable/types.ts`:
```ts
import type { ColumnDef, SortingState, SortingFn } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import type { BulkAction } from '../../constants/bulkActions';

export interface RowAction<TRow> {
  label: string; icon?: ReactNode; danger?: boolean; disabled?: boolean;
  onClick: (row: TRow) => void | Promise<void>;
}
export type ColumnAlign = 'left' | 'center' | 'right';
export type { ColumnSortType } from './sortingFns'; // owned by Slice 1, re-exported here (single source, no drift)
import type { ColumnSortType } from './sortingFns';
export interface DataTableColumn<TRow> {
  id: string;                               // stable, unique — persistence key for order/visibility
  header: string;
  accessorKey?: Extract<keyof TRow, string>;
  cell?: (row: TRow) => ReactNode;          // typed row, never `any`
  width?: number | string;
  align?: ColumnAlign;
  sortType?: ColumnSortType;                // default 'text'
  enableSorting?: boolean;                  // default true
  enableHiding?: boolean;                   // default true
}
export interface DataTableProps<TRow> {
  columns: DataTableColumn<TRow>[];
  data: TRow[];
  getRowId: (row: TRow) => string;          // stable id — anti-flicker keystone
  loading?: boolean;
  emptyMessage?: ReactNode;
  enableSelection?: boolean;
  bulkActions?: BulkAction[];
  onBulkAction?: (action: BulkAction, rows: TRow[]) => void | Promise<void>;
  rowActions?: (row: TRow) => RowAction<TRow>[];
  onRowClick?: (row: TRow) => void;         // single-select → open panel
  isRowActive?: (row: TRow) => boolean;     // highlight panel-open row
  title?: ReactNode;
  toolbarLeft?: ReactNode;
  toolbarRight?: ReactNode;
  globalFilterPlaceholder?: string;
  enableColumnReorder?: boolean;            // default true
  enableColumnVisibility?: boolean;         // default true
  initialSorting?: SortingState;
  persistKey?: string;                      // localStorage namespace; omit = no persistence
  testId?: string;
}
export function DataTable<TRow>(props: DataTableProps<TRow>): JSX.Element;
```

## Invariants (all slices)
- TDD red-green-refactor, one behavior at a time. Write tests first.
- Public interfaces only in tests; no mocking own classes/collaborators. Mock only wails runtime / time / randomness at the boundary.
- Coverage ≥ 80% on new code.
- **Typesafety rule**: no `any`, no new `eslint-disable`, no `as unknown as` double-casts. Generic over `<TRow>` throughout. `npm run typecheck` green.
- caveman + ponytail active. Reuse the listed helpers; do not reinvent. Mark deliberate shortcuts with `// ponytail:`.
- Stay strictly inside your slice's Files list — parallel slices must not touch each other's files.
- Slice done only when `npm run typecheck && npm run test` are green.

---

## Slice 1: Sorting functions (duration/datetime/number/text)
- **Files**: create `frontend/src/components/DataTable/sortingFns.ts`, create `frontend/src/__tests__/dataTableSortingFns.test.ts`.
- **Contract**: **own and export** `export type ColumnSortType = 'text' | 'number' | 'duration' | 'datetime'` from this file — it is the single source of truth (Slice 5's `types.ts` re-exports it; do NOT redeclare it there). Also export `const durationSortingFn: SortingFn<unknown>`, `datetimeSortingFn`, `numberSortingFn`, `textSortingFn` (TanStack `SortingFn` shape `(rowA,rowB,columnId)=>number`), and `sortTypeToFn(t: ColumnSortType): SortingFn<unknown>`. Port `parseDurationToSeconds`/`normalizeSortValue` from `utils/tableSorting.ts` (copy the parser, add `// ponytail: dedupe with tableSorting once raw engine is deleted`).
- **Tests** (write first): `5m` < `1h` < `2d`; ISO datetime ascending and descending; numeric strings compare numerically not lexically (`9` < `10`); null/`''`/undefined sort last in asc; text uses locale numeric compare (`item2` < `item10`); `sortTypeToFn('duration')` returns the duration fn.
- **Done**: typecheck + these tests green; ≥80% coverage of the file.
- **Don't touch**: `utils/tableSorting.ts`, any view, the engine.
- **Depends on**: none.

## Slice 2: Persisted table state
- **Files**: create `frontend/src/components/DataTable/usePersistedTableState.ts`, create `frontend/src/__tests__/usePersistedTableState.test.ts`.
- **Contract**: `usePersistedTableState(persistKey?: string)` → `{ columnOrder, setColumnOrder, columnVisibility, setColumnVisibility, sorting, setSorting }` typed as `string[]` / `Record<string,boolean>` / `SortingState` (import `SortingState` from `@tanstack/react-table`). Persist to `localStorage` under key `datatable:{persistKey}`. When `persistKey` is undefined → pure in-memory `useState`, zero localStorage access. Guard `JSON.parse` in try/catch → fall back to defaults.
- **Tests** (write first): setter writes persist to localStorage; a fresh hook with same key reads them back; corrupt JSON in localStorage → defaults, no throw; undefined key → no `localStorage.setItem`/`getItem` calls (spy asserts); default state is empty order/visibility and provided initial sorting.
- **Done**: typecheck + tests green; ≥80% coverage.
- **Don't touch**: engine, views.
- **Depends on**: none.

## Slice 3: Shift-range selection helper
- **Files**: create `frontend/src/components/DataTable/useRangeSelection.ts`, create `frontend/src/__tests__/useRangeSelection.test.ts`.
- **Contract**: export pure `computeRange(orderedIds: string[], anchorId: string | null, targetId: string): string[]` (inclusive ids between anchor and target in list order; if anchor null or absent → `[targetId]`) and hook `useRangeSelection()` → `{ anchorId, setAnchor, rangeTo(orderedIds, targetId): string[] }` tracking anchor in a ref.
- **Tests** (write first): forward range anchor→target; backward range target→anchor; anchor null → single; anchor not in list → single; single element list; `rangeTo` updates via anchor ref across calls.
- **Done**: typecheck + tests green; ≥80% coverage.
- **Don't touch**: engine, views.
- **Depends on**: none.

## Slice 4: useHolmesStream hook (the big dedup)
- **Files**: create `frontend/src/hooks/useHolmesStream.ts`, create `frontend/src/__tests__/useHolmesStream.test.ts`. May read (not edit) `hooks/useHolmesAnalysis.ts` — if its shape already fits, extend it instead and note that in the slice result; otherwise new file.
- **Contract**: extract the reducer duplicated in 22 views (handles `onHolmesChatStream` events `ai_message`/`start_tool_calling`/`tool_calling_result`/`ai_answer_end`/`stream_end` + `onHolmesContextProgress`). Reuse the existing `HolmesState` type shape. Expose:
  ```ts
  interface UseHolmesStream {
    state: HolmesState;
    analyze: (key: string, run: (streamId: string) => Promise<void>) => Promise<void>;
    cancel: () => Promise<void>;
  }
  function useHolmesStream(): UseHolmesStream;
  ```
  `analyze` resets state with a generated `streamId`, sets `key`, invokes `run(streamId)`, catches → error+loading false. Subscribe/unsubscribe internally. Type all payloads (parse `payload.data` into a typed shape) — no `any`.
- **Tests** (write first): `ai_message.content` chunks append to `streamingText`; `reasoning` accumulates into `reasoningText`; `start_tool_calling` adds a tool event, `tool_calling_result` updates it by id; `ai_answer_end` sets `response` + `loading=false`; `stream_end` finalizes from streamingText; error event sets `error` + `loading=false`; `cancel` invokes cancel API + sets loading false; events for a non-matching `streamId`/`key` are ignored. Mock stream emitters at the boundary.
- **Done**: typecheck + tests green; ≥80% coverage. **Do not edit the 22 views yet** (Slices 7–10 do that).
- **Don't touch**: any `*OverviewTable.tsx`, engine, configs.
- **Depends on**: none.

## Slice 5: DataTable engine + subcomponents
- **Files**: create `frontend/src/components/DataTable/types.ts`, `DataTable.tsx`, `ColumnHeader.tsx`, `ColumnVisibilityMenu.tsx`, `RowActionsMenu.tsx`, `UptimeCell.tsx`, `DataTable.css`, `index.ts`; create `frontend/src/__tests__/dataTable.test.tsx`.
- **Contract**: implement the locked API from Shared context. `types.ts` must `import type { ColumnSortType } from './sortingFns'` and re-export it — do NOT redeclare the union (Slice 1 owns it). `useReactTable` with core+sorted+filtered row models; pass `getRowId`. Selection via TanStack built-in `rowSelection` state keyed by `getRowId` (replaces `useTableSelection`). Shift-range via Slice 3. Order/visibility/sorting via Slice 2. Column sort fns via Slice 1 (map `sortType`). Column reorder = **native HTML5 `draggable` on `<th>`** (no dnd-kit). Global filter = case-insensitive substring over stringifiable visible cells. `RowActionsMenu` = the `···` menu ported from `OverviewTableWithPanel` L558–608 (close on outside-click/Escape/blur). `UptimeCell` self-ticks each second via its own `setInterval` (so data/columns stay stable). `// ponytail: render all rows, no virtualization; add @tanstack/react-virtual only past ~500 visible rows`.
- **Tests** (write first) — cover EVERY required feature: (1) renders rows/cells from typed columns; (2) header click toggles sort asc→desc→off, a `duration` column sorts by real duration; (3) global filter narrows rows, empty result → `emptyMessage`; (4) select-all / select-one / **shift-range**; (5) bulk action calls `onBulkAction(action, selectedRows)` with typed rows then clears; (6) row click calls `onRowClick`, `isRowActive` adds active class; (7) `···` action calls `onClick(row)`, menu closes on outside click; (8) drag-reorder updates order and **persists** (persistKey + localStorage spy); (9) toggle column visibility hides column and **persists**; (10) **swapping `data` to a new array ref with identical ids preserves selection + sort** (anti-flicker keystone); (11) `loading` renders without crash.
- **Done**: typecheck + all 11 tests green; ≥80% coverage on `components/DataTable/`.
- **Don't touch**: `OverviewTableWithPanel.tsx`, views, configs, `useTableSelection.ts`.
- **Depends on**: 1, 2, 3.

## Slice 6: Re-skin OverviewTableWithPanel on DataTable
- **Files**: edit `frontend/src/layout/overview/OverviewTableWithPanel.tsx`; may create `frontend/src/layout/overview/columnAdapter.ts` (+ `frontend/src/__tests__/overviewColumnAdapter.test.ts` if created). Do not rename the component or change its public props.
- **Contract**: keep the exact current props; internally translate its loose `ColumnDef`/`data`/`getRowActions`/`renderPanelContent` into `DataTable` props + `BottomPanel`. Preserve: `STATUS_BADGE_KEYS` auto-badge (map to a `cell` in the adapter), create overlay, tab counts, bulk dispatch via `constants/bulkActions`, Escape/click-outside panel close. Tighten types: remove `any[] data` / the top `eslint-disable no-explicit-any` where feasible; if 27 call sites would break, keep a `// ponytail: temporary loose compat layer, delete after Slice 13`-marked shim.
- **Tests** (write first / regression): `frontend/src/__tests__/overviewTableWithPanel.test.tsx` **and every `*OverviewTable.test.tsx`** stay green unchanged. Add a test asserting a reorder handle renders when `enableColumnReorder`. Only edit existing tests for genuinely new DOM, never to mask a regression.
- **Done**: full `npm run test` + typecheck green.
- **Don't touch**: `components/DataTable/*` (frozen after Slice 5), individual view files, configs.
- **Depends on**: 5.

## Slice 7: Route k8s workloads to config + useHolmesStream
- **Files**: edit `frontend/src/k8s/resources/{deployments/DeploymentsOverviewTable,statefulsets/StatefulSetsOverviewTable,daemonsets/DaemonSetsOverviewTable,replicasets/ReplicaSetsOverviewTable,cronjobs/CronJobsOverviewTable,jobs/JobsOverviewTable}.tsx`; edit their matching `config/resourceConfigs/{deployment,statefulset,daemonset,replicaset,cronjob,job}Config.tsx` only if a needed field is missing.
- **Contract**: replace each hand-rolled body with `GenericResourceTable {...config}`. Delete the inlined Holmes reducer; use `useHolmesStream` (Slice 4) where Holmes is needed. Move any real per-resource UI (custom summary panels/tabs) into the config's `renderPanelContent`. Columns render via typed `cell`.
- **Tests** (write first / regression): each resource's existing tests (`deploymentResourceConfig.test.tsx`, `statefulsetResourceConfig.test.tsx`, `daemonsetResourceConfig.test.tsx`, `replicasetResourceConfig.test.tsx`, `cronjobResourceConfig.test.tsx`, `jobResourceConfig.test.tsx`, and any `*OverviewTable` tests for these) stay green. Add an assertion that the view file is a thin wrapper.
- **Done**: those tests + typecheck green; each edited view < ~40 LOC; record before/after LOC in the slice result.
- **Don't touch**: engine, `DataTable/*`, other resource groups (Slices 8–10), pod files.
- **Depends on**: 6, 4.

## Slice 8: Route k8s config/storage/network to config + useHolmesStream
- **Files**: edit `frontend/src/k8s/resources/{configmaps/ConfigMapsOverviewTable,secrets/SecretsOverviewTable,persistentvolumeclaims/PersistentVolumeClaimsOverviewTable,persistentvolumes/PersistentVolumesOverviewTable,ingresses/IngressesOverviewTable,services/ServicesOverviewTable,hpa/HPAOverviewTable,helmreleases/HelmReleasesOverviewTable}.tsx`; edit their matching `config/resourceConfigs/*Config.tsx` only if a needed field is missing.
- **Contract**: same as Slice 7 (route to `GenericResourceTable {...config}`, drop inlined Holmes, use `useHolmesStream`, real per-resource UI into config).
- **Tests** (write first / regression): existing tests for these resources (`configmapResourceConfig.test.tsx`, `secretResourceConfig.test.tsx`, `pvcResourceConfig.test.tsx`, `pvResourceConfig.test.tsx`, `ingressResourceConfig.test.tsx`, `serviceResourceConfig.test.tsx`, helm/hpa tests) stay green.
- **Done**: those tests + typecheck green; each view < ~40 LOC; record LOC delta.
- **Don't touch**: engine, `DataTable/*`, other groups, pod files.
- **Depends on**: 6, 4.

## Slice 9: Route k8s rbac + nodes to config + useHolmesStream
- **Files**: edit `frontend/src/k8s/resources/{roles/RolesOverviewTable,rolebindings/RoleBindingsOverviewTable,clusterroles/ClusterRolesOverviewTable,clusterrolebindings/ClusterRoleBindingsOverviewTable,nodes/NodesOverviewTable}.tsx`; matching configs only if a field is missing.
- **Contract**: same routing pattern as Slice 7.
- **Tests** (write first / regression): `rolesOverviewTable.test.tsx`, `roleBindingsOverviewTable.test.tsx`, `clusterRolesOverviewTable.test.tsx`, `clusterRoleBindingsOverviewTable.test.tsx`, and node tests stay green.
- **Done**: those tests + typecheck green; views < ~40 LOC; record LOC delta.
- **Don't touch**: engine, `DataTable/*`, other groups, pod files.
- **Depends on**: 6, 4.

## Slice 10: Route swarm resources to config + useHolmesStream
- **Files**: edit `frontend/src/docker/resources/{services/SwarmServicesOverviewTable,tasks/SwarmTasksOverviewTable,nodes/SwarmNodesOverviewTable,networks/SwarmNetworksOverviewTable,secrets/SwarmSecretsOverviewTable,configs/SwarmConfigsOverviewTable,volumes/SwarmVolumesOverviewTable,stacks/SwarmStacksOverviewTable}.tsx`; matching `config/resourceConfigs/swarm/*Config.tsx` only if a field is missing.
- **Contract**: same routing pattern; use `createPlatform="swarm"`. Swarm summary panels (e.g. `SwarmServicesOverviewTable`'s ServiceSummaryPanel) move into the config's `renderPanelContent`.
- **Tests** (write first / regression): `swarm*OverviewTable.test.tsx` + `swarm*Config.test.tsx` stay green.
- **Done**: those tests + typecheck green; views < ~60 LOC (swarm carries more per-resource UI); record LOC delta.
- **Don't touch**: engine, `DataTable/*`, k8s groups, pod files.
- **Depends on**: 6, 4.

## Slice 11: Migrate Pods, delete the custom table
- **Files**: edit `frontend/src/config/resourceConfigs/podConfig.tsx` (extend for logs/console/port-forward/files/mounts tabs + port-forward state + per-pod Holmes via `useHolmesStream`); edit the two consumers of `PodOverviewTable` — `frontend/src/k8s/resources/pods/PodOverviewEntry.tsx` and `frontend/src/AppContainer.tsx` — to render `GenericResourceTable {...podConfig}` (grep `PodOverviewTable` first to confirm no other importer); **delete `frontend/src/k8s/resources/pods/PodOverviewTable.tsx`**. Use `UptimeCell` for the uptime column. Remove pod's private notification toast → `notification` module.
- **Contract**: pods run through the shared path with all existing tabs and actions (details panel, logs, console, port-forward, shell, files, mounts, Holmes) and bulk delete/restart. No per-second column rebuild.
- **Tests** (write first / regression): `podResourceConfig.test.tsx` + `__tests__/pods/*` + `podOverviewEntry.test.tsx` green; add/adjust tests proving the config renders each tab. Drive the live list + panel manually via `/run` to confirm port-forward/shell.
- **Done**: those tests + typecheck green; `PodOverviewTable.tsx` gone; grep shows no importers of it.
- **Don't touch**: engine, `DataTable/*`, non-pod views.
- **Depends on**: 4 (consumes `useHolmesStream`), 5 (consumes `UptimeCell`), 6 (consumes re-skinned engine); and at least one of 7–10 merged (routing pattern proven).

## Slice 12: UX de-clutter
- **Files**: edit table-related files that still use `window.prompt`/`window.confirm` or a local toast (grep first); wire `components/BaseModal/` dialogs for scale/delete; surface `ColumnVisibilityMenu` button in the engine toolbar (`OverviewTableWithPanel.tsx` toolbar region only).
- **Contract**: (a) one notification system — remove local toast state, use `notification` module; (b) no native `prompt`/`confirm` in table code — replace with `BaseModal`; (c) single create affordance (standardize on `CreateManifestOverlay`); (d) column-picker reachable from the toolbar.
- **Tests** (write first): a scale flow opens the modal (not `window.prompt`) and calls the scale API with the entered value; grep-based assertion in a test that table dirs contain no `window.prompt(`/`window.confirm(`. Existing tests stay green.
- **Done**: tests + typecheck green; grep for `window.prompt(`/`window.confirm(` in `k8s/resources`, `docker/resources`, `layout/overview` returns nothing.
- **Don't touch**: `components/DataTable/*` internals (only consume them), unrelated views.
- **Depends on**: 5 (consumes `ColumnVisibilityMenu`), 6 (edits engine toolbar), 11.

## Slice 13: Final cleanup + LOC audit
- **Files**: delete `frontend/src/hooks/useTableSelection.ts` + `frontend/src/__tests__/useTableSelection.test.ts`/`.test.js` once no importer remains; remove the Slice-6 compat shim and any dead engine branches; remove unused inline `HolmesState` blocks left in views.
- **Contract**: no dangling imports; the `// ponytail: temporary loose compat layer` shim gone.
- **Tests**: full `npm run test` green after deletions (grep confirms zero importers before deleting each file).
- **Done**: `npm run typecheck && npm run test && npm run lint` all green; record actual net LOC reduction (baseline §Shared context vs final) in this slice's result — target ≥6,000, stretch ≈8,000.
- **Don't touch**: nothing off-limits, but do not delete a file with live importers.
- **Depends on**: 6 (removes its compat shim), 7, 8, 9, 10, 11, 12 (final audit runs last).

---

## Execution order for parallel-build
- **Wave 1 (parallel, no deps)**: Slices 1, 2, 3, 4.
- **Wave 2**: Slice 5. **Wave 3**: Slice 6.
- **Wave 4 (parallel)**: Slices 7, 8, 9, 10.
- **Wave 5**: Slice 11, then Slice 12.
- **Wave 6**: Slice 13.

Run `/parallel-build project/todo/datatable-consolidation-plan.md` to execute.
