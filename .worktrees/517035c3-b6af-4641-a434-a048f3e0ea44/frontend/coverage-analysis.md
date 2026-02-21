# Frontend Coverage Analysis (2026-02-08)

## Baseline Coverage Metrics

| Metric | Coverage | Target (5% increase) |
|--------|----------|---------------------|
| **Statements** | **41.88%** | **46.88%** |
| **Branches** | **32.09%** | **37.09%** |
| **Functions** | **39.77%** | **44.77%** |
| **Lines** | **44.11%** | **49.11%** |

**Test Status:** 142 test files passed, 1329 tests passed (1 test file excluded due to timeout)

**Generated:** 2026-02-08 via `npx vitest run --coverage --exclude='**/*main-content.test.ts'`

---

## Coverage Summary by Directory

| Directory | Statements | Branches | Functions | Lines | Status |
|-----------|-----------|----------|-----------|-------|--------|
| src/api | Low | Low | Low | Low | ⚠️ Critical gaps |
| src/components | High | High | High | High | ✅ Good |
| src/hooks | High | High | High | High | ✅ Good |
| src/utils | 89.75% | 72.96% | 84.74% | 92.36% | ✅ Excellent |
| src/state | 73.92% | 63.38% | 84.09% | 76.49% | ✅ Good |
| src/docker/resources | Medium | Medium | Medium | Medium | ⚠️ Needs improvement |
| src/k8s/resources | Low | Low | Low | Low | ⚠️ Critical gaps |
| src/layout | Medium | Low | Medium | Medium | ⚠️ Branch coverage weak |
| wailsjs/go | 10.33% | 3.65% | 4.65% | 11.44% | ⚠️ Generated code |

---

## Files with 0% Coverage (Untested)

### Critical Priority (High usage, complex logic)

1. **`src/api/bulkOperations.ts`**
   - **Usage:** 9+ components across K8s and Docker Swarm
   - **Complexity:** High - Handles bulk delete, restart, scale, suspend operations
   - **Risk:** High - Directly manipulates cluster resources
   - **Lines:** ~200 estimated

2. **`src/api/tabCounts.ts`**
   - **Usage:** 8+ components for tab badge counts
   - **Complexity:** Low - Simple API wrappers
   - **Risk:** Medium - Error handling affects UX
   - **Lines:** ~50 estimated

### High Priority (Infrastructure components)

3. **`src/layout/bottompanel/TerminalTab.tsx`**
   - Lines: 39-167 uncovered
   - Reason: Terminal/console integration (complex)

4. **`src/layout/bottompanel/YamlEditorTab.tsx`**
   - Lines: 26-167 uncovered
   - Reason: YAML editing with CodeMirror

5. **`src/layout/connection/DockerConfigOverlay.tsx`**
   - Lines: 18-230 uncovered
   - Reason: Docker connection configuration UI

---

## Files with Partial Coverage (< 50%)

### API Layer
- `src/api/bulkOperations.ts` - 0%
- `src/api/monitorApi.ts` - 100% statements, 50% branches
- `src/api/tabCounts.ts` - 0%

### Layout Components
- `src/layout/bottompanel/FilesTab.tsx` - 1.16% (36-463 uncovered)
- `src/layout/bottompanel/TerminalTab.tsx` - 0%
- `src/layout/bottompanel/YamlEditorTab.tsx` - 0%
- `src/layout/connection/DockerConfigOverlay.tsx` - 0%
- `src/layout/connection/ConnectionsSidebar.tsx` - 26.66% (73-109 uncovered)
- `src/layout/connection/SwarmConnectionsList.tsx` - 35.38% (46-168, 193-255 uncovered)

### K8s Resources (Low coverage across the board)
- Most `src/k8s/resources/*/` components have low branch coverage
- YAML tabs, detail panels, and action handlers need tests

### Docker/Swarm Resources
- `src/docker/resources/networks/` - Low coverage
- `src/docker/resources/nodes/` - Low coverage
- `src/docker/resources/stacks/` - Low coverage
- Various overview tables have medium coverage

---

## Top 10 Priority Files for Testing

| # | File | Current Coverage | Priority | Reason | Estimated Effort |
|---|------|------------------|----------|--------|------------------|
| 1 | **api/bulkOperations.ts** | 0% | ⭐⭐⭐ CRITICAL | Used by 9+ components, complex logic, high risk | Medium |
| 2 | **api/tabCounts.ts** | 0% | ⭐⭐⭐ CRITICAL | Used by 8+ components, simple wrappers | Low |
| 3 | **layout/overview/OverviewTableWithPanel.tsx** | 66.15% / 57.3% branches | ⭐⭐⭐ HIGH | Core UI pattern, used throughout app | High |
| 4 | **hooks/useResourceData.ts** | Existing tests, needs expansion | ⭐⭐⭐ HIGH | Data fetching backbone, complex normalization | Medium |
| 5 | **layout/bottompanel/FilesTab.tsx** | 1.16% | ⭐⭐ HIGH | File browser integration | High |
| 6 | **layout/bottompanel/TerminalTab.tsx** | 0% | ⭐⭐ HIGH | Terminal integration (xterm.js) | High |
| 7 | **layout/connection/DockerConfigOverlay.tsx** | 0% | ⭐⭐ MEDIUM | Docker connection setup | Medium |
| 8 | **utils/logger.ts** | 76% / 32% branches | ⭐⭐ MEDIUM | Dev/prod conditional logic not fully tested | Low |
| 9 | **layout/connection/ConnectionsSidebar.tsx** | 26.66% | ⭐⭐ MEDIUM | Connection switching UI | Medium |
| 10 | **docker/resources/SwarmXxxOverviewTable** (4 files) | Medium | ⭐ MEDIUM | Parallel structure, bulk actions | Medium each |

---

## Testing Strategy for 5% Coverage Increase

### Phase 1: Quick Wins (Target: +2% statements, +2% branches)

**Week 1-2:**
1. ✅ Add comprehensive tests for `api/tabCounts.ts` (~50 lines)
   - Mock backend API calls
   - Test error handling
   - Validate return types
   
2. ✅ Complete tests for `api/bulkOperations.ts` (~200 lines)
   - Test each bulk operation (delete, restart, scale, suspend)
   - Test K8s and Docker Swarm variants
   - Test error scenarios and user feedback

3. ✅ Expand `utils/logger.ts` tests (~30 lines)
   - Test dev vs prod logging behavior
   - Validate console output filtering

### Phase 2: Hook Completion (Target: +1.5% functions, +1% branches)

**Week 3:**
4. ✅ Expand `hooks/useResourceData.ts` tests
   - Test data normalization edge cases
   - Test filtering logic
   - Test error states

5. ✅ Complete `hooks/useSwarmServiceForm.ts` tests
   - Form validation rules
   - Form submission handling
   - Field dependencies

### Phase 3: Component Branch Coverage (Target: +1.5% branches, +0.5% lines)

**Week 4:**
6. ✅ Increase branch coverage in `layout/overview/OverviewTableWithPanel.tsx`
   - Test all tab switching scenarios
   - Test panel open/close logic
   - Test filter interactions

7. ✅ Add missing branches to `layout/connection/ConnectionsSidebar.tsx`
   - Test connection selection
   - Test context switching

---

## Metrics Calculation

**Current baseline:**
- Total statements: Estimated ~15,000 lines of source code
- Covered statements: 41.88% = ~6,282 lines
- Target statements: 46.88% = ~7,032 lines
- **Need to cover: ~750 additional statements**

**Priority targets (estimated lines to test):**
1. api/bulkOperations.ts: ~200 lines
2. api/tabCounts.ts: ~50 lines
3. layout/overview/OverviewTableWithPanel branches: ~100 additional assertions
4. hooks expansion: ~150 lines
5. utils/logger branches: ~30 lines
6. layout/connection components: ~250 lines

**Total estimated: ~780 lines of new test coverage**

This should achieve approximately **+5% statement coverage** and **+5% branch coverage**.

---

## Existing Test Coverage (Well-Tested Areas)

### ✅ Excellent Coverage (90-100%)
- `src/utils/dateUtils.ts` - 100%
- `src/utils/timeUtils.ts` - 100%
- `src/utils/resourceNavigation.ts` - 100%
- `src/utils/persistence.ts` - 100%
- `src/utils/codeMirrorLanguage.ts` - 100%
- `src/state/SettingsContext.tsx` - 100%
- `src/components/BaseModal/` - High coverage
- `src/components/ui/` - High coverage

### ✅ Good Coverage (70-89%)
- `src/utils/tableSorting.ts` - 93%
- `src/utils/swarmYamlUtils.ts` - 81%
- `src/state/ClusterStateContext.tsx` - 64%
- `src/state/ResourceCountsContext.tsx` - 82%
- Most form components in `src/components/forms/`

### ⚠️ Needs Improvement (< 70%)
- API layer (bulkOperations, tabCounts)
- Layout components (TerminalTab, FilesTab, YAML editor)
- Connection management UI
- K8s resource detail panels
- Docker Swarm resource tables (partial)

---

## Recommendations

1. **Immediate Action Items:**
   - Add tests for `api/bulkOperations.ts` and `api/tabCounts.ts` (critical, high usage)
   - Fix or skip the failing `main-content.test.ts` to enable full coverage runs
   - Add branch coverage to `layout/overview/OverviewTableWithPanel.tsx`

2. **Short-term (1-2 weeks):**
   - Complete hook test suites (useResourceData, useSwarmServiceForm)
   - Increase branch coverage in layout components
   - Test error handling paths

3. **Medium-term (1 month):**
   - Systematically add tests to K8s resource components
   - Add tests to Docker Swarm resource components
   - Increase integration test coverage (E2E scenarios)

4. **Long-term:**
   - Aim for 60%+ statement coverage
   - Aim for 50%+ branch coverage
   - Establish coverage thresholds in CI/CD pipeline

---

## Notes

- **Coverage excludes:** `__tests__/`, `node_modules/`, `dist/`, `coverage/`, config files
- **Generated code:** `wailsjs/go/models.ts` has low coverage (expected, auto-generated from Go backend)
- **Known issues:** 1 test file timeout (`main-content.test.ts`) excluded from coverage run
- **HTML Report:** Available at `frontend/coverage/index.html`
- **Baseline File:** `frontend/coverage-baseline.txt`
