# Codebase reduction audit

Date: 2026-10-18. Baseline: `dev` @ `71deb25`. Scope: identify removable or refactorable code;
no production behaviour changed. Reviewed together with Qwen (`qwen/qwen3.8-max-prime` via
OpenRouter): it received the measured metrics plus excerpts of the duplicated Go code and returned
an independent ranking and refactor designs, merged below.

**Status:** four commits, 101 files, 14,839 deletions. `4274c0e` zero-risk deletions,
`9760434` dead Wails bindings + helpers, `ee4a614` `.ts`/`.js` twins + CI guard, `3c1d4d6` this
document. Gates after each batch: `go build ./...`, `go vet ./pkg/...`, `go test ./pkg/...`,
`npm test` (214 files / 2,040 tests), `tsc --noEmit`, `vite build`, plus a Wails binding
regeneration (`wails build -s`). Rebased onto `8631778` (upstream Helm dependency bump) and pushed
to `dev`; Build run [39148602396](https://github.com/psalg-dev/kube-dev-bench/actions/runs/39148602396)
passed all 14 jobs — frontend, backend, 6 e2e shards, 5 release targets, publish-dev-snapshot.

## Where the lines are

All counts are non-blank tracked lines (cloc-style: blank lines excluded; test files and generated
bindings included unless stated). A file's total line count is typically 10–15% higher.

| Area | Files | Lines |
|---|---:|---:|
| Go production (`pkg/`, `main.go`) | 144 | 32,691 |
| Go tests | 205 | 54,574 |
| TS/TSX production (`frontend/src`) | 313 | 48,469 |
| TS/TSX tests | 215 | 30,882 |
| CSS | 58 | 8,031 |
| Markdown (`project/` alone: 25,334) | 129 | 25,398 |
| E2E (Playwright) | 108 | 13,846 |

Go tests are 1.67× the production code they cover. Test-ish code (Go + TS tests + e2e) is
99,302 lines, more than all production Go/TS combined (81,160).

## Ranked reduction candidates

| # | Action | Lines | Risk |
|---|---|---:|---|
| 1 | Archive/delete `project/done/` (41 completed plans) | 20,490 | docs only |
| 2 | Delete 9 Go test files excluded by `//go:build ignore` | 5,341 | none |
| 3 | Delete the 12 duplicate legacy test files (`.test.js`/`.test.jsx`) | 1,976 | none |
| 4 | Delete 13 components reachable only from tests (+ their tests) | 2,572 + ~2,000 | medium |
| 5 | Delete truly unreferenced modules (incl. both `manifestTemplates`) | 1,220 | low |
| 6 | Delete `quality/` (disabled pipeline) + `quality.yml.disabled` | 1,406 | low |
| 7 | Remove 30 dead Wails bindings (+ their tests) — done | 388 + ~500 | low |
| 8 | Collapse one side of the 12 `.ts`/`.js` module twins — done | ~2,000 | medium |
| 9 | Delete `frontend/vitest.config.js` (dead config) | 35 | none |
| 10 | Table-drive Holmes analyzers/context getters | ~1,000–1,200 | medium |
| 11 | Helper-consolidate `k8s_graph/builder.go` | ~500–700 | medium |
| 12 | Factory for the 21 resource configs | ~400–800 | medium |

Safe total without docs: **~15,000 lines**; with `project/done/`: **~35,000**.

## Evidence

### 1. `project/done/` — 41 files, 20,490 lines
Completed plans (`project/done/codebase-reduction-implementation-plan.md`,
`typescript-migration.md`, `helm-v4-support-implementation-plan.md`, …). `project/` is 25,334 of
the repo's 25,398 Markdown lines. Product decision to archive, not a code change.

### 2. Dead Go tests — 5,341 lines
Nine files start with `//go:build ignore`, so `go test` never compiles them:
`mid_coverage_test.go` (1,385), `mid_coverage3_test.go` (1,061), `coverage_batch12_test.go` (792),
`coverage_batch11_test.go` (780), `mid_coverage2_test.go` (579), `coverage_batch9_test.go` (255),
`coverage_batch8_test.go` (203), `coverage_batch13_test.go` (190),
`daemonsets_node_coverage_test.go` (96). Last touched 2026-02-22. `coverage_batch11_test.go`
contains no assertions at all — bodies are `_, _ = nilCtxApp().getPodContext(...)` (lines 56–80).
They were tagged out instead of deleted when the APIs changed.

### 3. Dead duplicate tests — 1,976 lines
`package.json` runs `vitest run -c vitest.config.ts`, and `frontend/vitest.config.ts:7` includes
only `src/**/*.test.ts(x)`. The 12 `.test.js`/`.test.jsx` twins (`useAsyncData.test.js`,
`useResourceData.test.js`, `tableSorting.test.js`, `updateStackModal.test.jsx`, …) never run.

### 4. Test-only React components — 2,572 lines
Imported by test files but by no production module (verified with a production-only import graph
built from `ts.preProcessFile`, then `git grep` for every symbol):
`layout/bottompanel/FilesTab.tsx` (564; superseded by `pods/PodFilesTab.tsx`),
`layout/AppContainer.tsx` (346, used only in `appContainer.resourceSwitch.test.tsx`),
`statefulsets/StatefulSetDetailTab.tsx` (274), `ingresses/IngressDetailTab.tsx` (243),
`daemonsets/DaemonSetPodsTab.tsx` (209), `layout/MonitorModal.tsx` (192),
`state/SettingsContext.tsx` (154), `docker/resources/SwarmEventsTab.tsx` (153),
`NetworkConnectedContainersSection.tsx` (143), `NetworkConnectedServicesSection.tsx` (127),
`PortForwardDialog.tsx` (92), `EmptyState.tsx` (64), `utils/persistence.ts` (22).
`FilesTab` has no `SettingsProvider`/`AppContainer` in the rendered tree either: `index.html`
loads `src/main.ts` and `App.tsx` mounts `layout/AppLayout`, not these components.

### 5. Unreferenced modules — 1,220 lines
- `config/manifestTemplates.ts` (369) **and** `.js` (361): zero importers anywhere; the only mention
  is `project/done/typescript-migration.md:113` claiming the `.js` was removed, which it was not.
- root `src/AppContainer.tsx` (234): no importer; `layout/AppContainer.tsx` is the newer copy.
- `k8s/resources/replicasets/ReplicaSetDetailTab.tsx` (214): only self-references; replicasets are
  rendered through `config/resourceConfigs/replicasetConfig.tsx`.
- `k8s/resources/roles/RoleYamlTab.tsx` (22): `roleConfig.tsx:70` defines its own local copy.
- barrels with no importer: `config/resourceConfigs/swarm/index.ts` (15), `types/index.ts` (5).
- **Not dead** (checked after the first import-graph pass flagged them): `components/BaseModal/index.tsx`
  is imported by `ModalProvider`, `ConfirmDialog` and the Swarm services/volumes tables;
  `components/DataTable/index.ts` and `config/resourceConfigs/index.ts` are live barrels. The first
  pass resolved only extensionless file specifiers and missed directory barrels; the deletion set
  above was re-verified with `git grep` on the exact import strings.

### 6. `quality/` — 1,406 lines
Docker-based analyzer (`aggregate-reports.js` alone is 26 KB) whose only consumer,
`.github/workflows/quality.yml.disabled`, was disabled on 2026-01-25 (`69f3dce`). Nothing else
references it except its own README and a completed plan. Either delete it or move it to
`scripts/` and re-enable the workflow; keeping a disabled pipeline in the tree costs 1,406 lines.

### 7. Dead Wails bindings — 388 Go lines
A binding is dead only if the frontend does not reference it **and** no Go production code calls
it. That selects 30 of the 401 generated bindings: all per-kind `Delete*` wrappers
(`resource_actions.go:67–198`, `resource_actions_jobs.go:14–19`; the UI uses generic
`DeleteResource`), RBAC/CRD/storage-class detail getters (`roles.go:186`, `rolebindings.go:181,204`,
`storageclasses.go:85`, `customresourcedefinitions.go:107`, …), `GetEndpointDetail`
(`endpoints.go:116`), `StreamPodLogsWith`/`StreamPodContainerLogsWith` (`logs.go:159,164`),
`DetectLogPatterns` (`holmes_logs.go:82`), `RestartWorkload` (`resource_actions.go:21`).
Nine Go test files reference them and would need trimming.

**Done in `9760434`** (3,203 deletions): the 30 bindings plus `AnalyzeMonitorIssueStream`; the
tests that existed only for them; the helper chains they stranded (`streamPodLogsInternal`,
`streamLogsToEvents`, the `*With` container-log variants, `registerLogCancel`,
`buildLogOptions`, `updatePattern`, `LogPattern`); three unused `collect*Sets` methods; three
unused `*ForTest` wrappers in `daemonsets_coverage.go`; and the tracked coverage dump
`pkg/app/cover19_funcs.txt` (935 lines). Bindings regenerated with `wails build -s`.

### 8. `.ts`/`.js` twins — 1,962 JS vs 2,000 TS lines
The TS migration (`398a984`) deleted the JS files; merge commit `1d267a8` (PR #150) re-added them.
Vite resolves `.js` before `.ts` (verified by resolving `/src/hooks/useResourceData` through a real
Vite server: it returns `useResourceData.js`), so the JS twins are the code that actually runs
while `tsc --noEmit` checks the TS twins. Both sides have been edited since: the July commit
`ed22b89` changed `useResourceData.js`, `useAsyncData.js`, `useHolmesAnalysis.js`,
`useEventSubscription.js` without touching their `.ts` twins. Twin list: `api/bulkOperations`,
`api/tabCounts`, `constants/bulkActions`, `constants/emptyTabMessages`, `hooks/useAsyncData`,
`hooks/useEventSubscription`, `hooks/useHolmesAnalysis`, `hooks/useResourceData`, `utils/logger`,
`utils/resourceNavigation`, `utils/tableSorting`, plus `config/manifestTemplates` (covered above).
Fix: port the JS behaviour into `.ts`, keep the named/default export shape, delete the `.js`, run
`npm test` + `tsc` + `vite build`. Delete JS first for anything not edited since February; port
first for the five hooks/utils edited in July. Add a CI check that fails when a basename exists as
both `.ts(x)` and `.js(x)`; do not flip `resolve.extensions` while both copies exist.

**Done in `ee4a614`** (1,603 deletions): diff review showed the July edits were whitespace-only and
every TS twin was the typed equivalent, so all 11 `.js` files were deleted and the full suite was
run against the TS implementations — 214 files / 2,040 tests still pass. A dependency-free guard
(`frontend/scripts/check-duplicate-modules.mjs`, `npm run check:twins`) now fails CI in
`.github/workflows/build.yml` if a TS/JS twin reappears.

### 9. `frontend/vitest.config.js` — 35 lines (done)
`package.json` passes `-c vitest.config.ts`, but `.github/workflows/coverage.yml` ran bare
`npx vitest`, which would have picked up `vitest.config.js` (no `include`, so it would try to run the
legacy `.test.js` files). The config was deleted and the CI step now passes
`-c vitest.config.ts` explicitly.

### 10. Holmes duplication — 800 + 756 lines
`pkg/app/holmes_integration.go` has 24 `Analyze*` methods (9 sync + 15 streaming, 800 lines) that
differ only in the context getter and the prompt noun (`AnalyzePod` at :505, `AnalyzePodStream` at
:861, dispatch at :832/:1335). `pkg/app/holmes_context.go` has 14 `get*Context` methods (756 lines)
that share fetch → header → conditions → events → logs; `writeDeploymentConditions`,
`writeStatefulSetConditions`, `writeDaemonSetConditions` at :344–381 are byte-identical apart from
the type. Replacement: a `holmesKind` table (`Canonical`, `Aliases`, `Title`, `Namespaced`,
`SyncSupported`, `StreamSupported`, `GetContext`, `Question`) plus `analyzeKind` /
`analyzeKindStream`, keeping only `AnalyzeResource` + `AnalyzeResourceStream` exported, and a
`contextBuilder` helper (`newContextBuilder`, `runTimeout`, `appendEvents`, `appendPodLogs`).
Generic `writeConditions[C any]` with a field extractor removes the three identical writers.
Expected: ~1,000–1,200 lines. Behaviour-sensitive (prompt text, error wrapping, kind aliases) — add
golden tests for the prompt strings and the alias/error cases first.

### 11. `k8s_graph/builder.go` — 2,856 lines
92 `GraphEdge{...}` literals (first at :989) always repeat `Source`, `Target`, `Type` and a label
derived from the type. `expandDeployment` (:972), `expandStatefulSet` (:1057) and
`expandDaemonSet` (:1142) are 249 lines of the same seven steps; `expandRole`/`expandClusterRole`
(26+26) and `expandRoleBinding`/`expandClusterRoleBinding` (41+41) are identical apart from scope.
Add `func newEdge(source, target string, t EdgeType) GraphEdge`, a `Builder.addNeighbor(node,
namespace, kind, name, edgeType, reverse, *neighbors, *edges)` helper, and an `expandWorkload`
helper driven by a `(corev1.PodSpec, *metav1.LabelSelector, error)` fetcher. Expected: 500–700
lines. `isOwnedBy` exists in both `builder.go:2473` and `resource_details.go:307` (different
packages, same body) — move it to `pkg/app/k8sutil` when touching the file.

### 12. Resource configs — 21 files, 4,135 lines
44% of their non-trivial lines (1,454 of 3,273) repeat more than twice across files; `roleConfig`
vs `clusterRoleConfig` differ by 80 lines and `roleBinding` vs `clusterRoleBinding` by 82. A
`defineResourceConfig()` factory (kind, plural, namespaced, columns, tabs, actions, fetchers) can
remove an estimated 400–800 lines, less than Qwen's 1,000–2,500 guess because the tables were
already consolidated into `GenericResourceTable`.

## Rejected ideas

- **PurgeCSS / blanket CSS purge.** 1,118 selectors, only 74 look unused by a class-name scan;
  dynamic class construction makes a purge unsafe for a few hundred lines. Not worth it.
- **Mass-deleting tests for line count.** Coverage is a gate (Codecov badges, 70% threshold in
  `quality/thresholds.json`). Only delete tests whose subject is deleted; consolidate duplicated
  fixtures instead (`generateTestCAPEM` appears in two files, `TestFormatDuration_*` in two).
- **Deleting `MCPServerAdapter`.** It reads as test-only from grep but is wired at
  `pkg/app/mcp_integration.go:290`; not dead.
- **Deleting generated `frontend/wailsjs`.** 4,204-line `models.ts`, 1,607-line `App.js`, 813-line
  `App.d.ts` are tracked generated code. They should be excluded from the LoC budget rather than
  deleted unless CI runs `wails generate` before build.
- **A generic dispatcher for the 100 `docker_integration.go` methods.** 71 of them are ≤11 lines
  (483 lines total); replacing them would touch ~90 frontend call sites for <400 lines saved.

## Suggested PR sequence

1. **Zero-risk deletions** — done in `4274c0e`: ignored Go tests (5,341), legacy duplicate tests
   (1,976), `vitest.config.js` (35), unreferenced modules (1,220), `quality/` (1,406).
2. **Dead bindings** — done in `9760434`: 31 bindings, their tests, stranded helpers, coverage dump.
3. **Test-only components** — delete the 13 modules and their test blocks.
4. **Twins** — done in `ee4a614`: TS implementations kept, 11 JS twins deleted, twin guard in CI.
5. **Holmes table refactor** after golden prompt tests.
6. **Builder helpers** after golden graph tests.
7. **Resource-config factory**.

Each step is independently green; nothing above requires a behaviour change except steps 4–7.
