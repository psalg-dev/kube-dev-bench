# Quality Improvement Implementation Plan

> **Generated:** January 28, 2026  
> **Status:** Active  
> **Quality Gate Status:** FAILED

---

## Executive Summary

The quality pipeline identified **4 blocking issues** preventing the quality gate from passing:

| Issue | Current | Target | Gap |
|-------|---------|--------|-----|
| Go Test Coverage | 41.9% | ≥70% | -28.1% |
| JS Test Coverage | 55.01% | ≥70% | -14.99% |
| ESLint Errors | 50 | 0 | -50 |
| Secrets in Code | 25 | 0 | -25 |

Additionally, there are significant warnings that impact maintainability:
- 1,216 ESLint warnings (target: ≤50)
- 72 Go security issues (gosec)
- 58 high cyclomatic complexity functions
- 114 high cognitive complexity functions
- 18.85% JavaScript code duplication (target: ≤5%)

---

## Phase 1: Critical Security Issues (Priority: BLOCKING)

**Timeline:** Days 1-2  
**Owner:** Security/DevOps Lead  
**Estimated Effort:** 4-8 hours

### 1.1 Update .gitignore

Add the following entries to prevent future secret leaks:

```gitignore
# IDE files
.idea/

# Test artifacts with secrets
e2e/.playwright-artifacts-*/
kind/output/

# Build outputs
frontend/dist/

# Local config
.claude/
```

**Files to modify:**
- `.gitignore` (root)

### 1.2 Remove Committed Secrets from Git History

**WARNING:** This requires force-pushing and team coordination.

```bash
# Option 1: BFG Repo-Cleaner (recommended)
bfg --delete-folders .idea
bfg --delete-folders .playwright-artifacts-*
bfg --delete-files kubeconfig*
git reflog expire --expire=now --all && git gc --prune=now --aggressive

# Option 2: git filter-repo
git filter-repo --path .idea --invert-paths
git filter-repo --path-glob 'e2e/.playwright-artifacts-*' --invert-paths
```

### 1.3 Fix Hardcoded Test Secrets

**File:** `e2e/tests/65-tab-counts-and-empty-states.spec.ts`  
**Line:** 152

| Current | Fix |
|---------|-----|
| `password: cGFzc3dvcmQxMjM=` | Use test fixture or environment variable |

**Implementation:**

```typescript
// Before
password: cGFzc3dvcmQxMjM=

// After - use test fixtures
import { TEST_SECRET_PASSWORD } from '../fixtures/test-secrets';
password: TEST_SECRET_PASSWORD
```

Create fixture file `e2e/fixtures/test-secrets.ts`:
```typescript
// Base64 encoded test password - NOT a real secret
export const TEST_SECRET_PASSWORD = Buffer.from('testpassword123').toString('base64');
```

### 1.4 Create .gitleaksignore for False Positives

Create `.gitleaksignore` in project root:

```
# False positives in bundled/minified code
frontend/dist/**

# xterm.js library contains "KeyMap" which triggers false positive
**/xterm.js

# Test fixtures (not real secrets)
e2e/fixtures/test-secrets.ts
```

**Acceptance Criteria:**
- [ ] `.gitignore` updated with all exclusions
- [ ] Git history cleaned (coordinate with team)
- [ ] Hardcoded test secrets replaced with fixtures
- [ ] `.gitleaksignore` created for false positives
- [ ] Quality pipeline shows 0 secrets

---

## Phase 2: ESLint Errors and Warnings (Priority: BLOCKING)

**Timeline:** Days 2-4  
**Owner:** Frontend Lead  
**Estimated Effort:** 8-16 hours

### 2.1 Auto-fix ESLint Issues

```bash
cd frontend

# Auto-fix all fixable issues
npm run lint -- --fix

# Format with Prettier to remove trailing spaces
npx prettier --write "src/**/*.{js,jsx,ts,tsx}"
```

### 2.2 Manual ESLint Error Fixes

After auto-fix, manually address remaining errors:

| Error Type | Count (est.) | Fix Strategy |
|------------|--------------|--------------|
| `no-unused-vars` | ~30 | Remove or prefix with `_` |
| Hook dependency issues | ~15 | Add missing dependencies or use `// eslint-disable-next-line` with justification |
| Import errors | ~5 | Fix import paths |

### 2.3 ESLint Warning Categories

| Warning | Count | Auto-fixable | Action |
|---------|-------|--------------|--------|
| `no-trailing-spaces` | ~900 | Yes | Prettier will fix |
| `no-unused-vars` | ~50 | Partial | Remove unused imports/vars |
| Other | ~266 | Varies | Review individually |

### 2.4 Add Pre-commit Hook

Create `.husky/pre-commit`:

```bash
#!/bin/sh
cd frontend && npm run lint
```

**Acceptance Criteria:**
- [ ] ESLint errors reduced to 0
- [ ] ESLint warnings reduced to ≤50
- [ ] Pre-commit hook prevents new issues

---

## Phase 3: Test Coverage Improvement (Priority: BLOCKING)

**Timeline:** Weeks 1-3  
**Owner:** Development Team  
**Estimated Effort:** 40-60 hours

### 3.1 Go Coverage: 41.9% → 70% (+28.1%)

#### Priority 1: Zero Coverage Functions (0%)

| File | Function | Lines | Effort |
|------|----------|-------|--------|
| `pkg/app/cronjobs.go:128` | `StartCronJobPolling` | 30 | 2h |
| `pkg/app/daemonsets.go:88` | `StartDaemonSetPolling` | 25 | 2h |
| `pkg/app/deployments.go:99` | `StartDeploymentPolling` | 25 | 2h |
| `pkg/app/app_lifecycle.go:148` | `Shutdown` | 15 | 1h |
| `pkg/app/docker/client.go:163` | `IsSwarmActive` | 8 | 0.5h |
| `pkg/app/docker/configs.go:32` | `GetSwarmConfigs` | 20 | 1h |

**Test Strategy for Polling Functions:**

```go
func TestStartCronJobPolling(t *testing.T) {
    // Create mock K8s client
    fakeClient := fake.NewSimpleClientset()
    
    // Create test CronJob
    cronJob := &batchv1.CronJob{
        ObjectMeta: metav1.ObjectMeta{
            Name:      "test-cronjob",
            Namespace: "default",
        },
    }
    fakeClient.BatchV1().CronJobs("default").Create(context.TODO(), cronJob, metav1.CreateOptions{})
    
    // Test polling with short interval
    ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
    defer cancel()
    
    app := &App{clientset: fakeClient}
    go app.StartCronJobPolling(ctx, "default", 10*time.Millisecond)
    
    // Verify events emitted
    // ...
}
```

#### Priority 2: Low Coverage Functions (<50%)

| File | Function | Current | Target |
|------|----------|---------|--------|
| `pkg/app/counts.go:32` | `refreshPodStatusOnly` | 50% | 80% |
| `pkg/app/counts.go:74` | `refreshResourceCounts` | 50.9% | 80% |
| `pkg/app/configmaps_consumers.go:18` | `podSpecUsesConfigMap` | 61.1% | 85% |

#### Coverage Tracking

Create `pkg/app/coverage_targets.md`:

```markdown
# Go Coverage Targets by Package

| Package | Current | Week 1 | Week 2 | Week 3 |
|---------|---------|--------|--------|--------|
| pkg/app | 41.9% | 50% | 60% | 70% |
| pkg/app/docker | 45% | 55% | 65% | 75% |
| pkg/app/jobs | 60% | 70% | 75% | 80% |
| pkg/app/holmesgpt | 55% | 65% | 70% | 75% |
```

### 3.2 JavaScript Coverage: 55.01% → 70% (+14.99%)

#### Priority Components to Test

| Component | Current (est.) | Effort |
|-----------|----------------|--------|
| `src/k8s/resources/*/OverviewTable.jsx` | 40% | 4h each |
| `src/state/ClusterStateContext.jsx` | 50% | 3h |
| `src/layout/AppLayout.jsx` | 45% | 3h |
| `src/utils/*.js` | 60% | 2h |

#### Test Template for Resource Tables

```javascript
// src/k8s/resources/pods/__tests__/PodsOverviewTable.test.jsx
import { render, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import PodsOverviewTable from '../PodsOverviewTable';

// Mock Wails bindings
vi.mock('../../../../wailsjs/go/main/App', () => ({
  GetRunningPods: vi.fn().mockResolvedValue([
    { name: 'test-pod', namespace: 'default', status: 'Running' }
  ])
}));

describe('PodsOverviewTable', () => {
  it('renders pod data correctly', async () => {
    render(<PodsOverviewTable namespace="default" />);
    
    await waitFor(() => {
      expect(screen.getByText('test-pod')).toBeInTheDocument();
    });
  });
  
  it('handles empty state', async () => {
    GetRunningPods.mockResolvedValueOnce([]);
    render(<PodsOverviewTable namespace="default" />);
    
    await waitFor(() => {
      expect(screen.getByText(/no pods/i)).toBeInTheDocument();
    });
  });
});
```

**Acceptance Criteria:**
- [ ] Go coverage ≥70%
- [ ] JS coverage ≥70%
- [ ] All 0% coverage functions have at least one test
- [ ] Coverage reports generated on each CI run

---

## Phase 4: Go Security Issues (Priority: HIGH)

**Timeline:** Week 2  
**Owner:** Backend Lead  
**Estimated Effort:** 16-24 hours

### 4.1 Integer Overflow Issues (G115)

**Affected Files:**
- `pkg/app/docker/metrics_live.go` (6 issues)
- `pkg/app/docker/metrics.go` (1 issue)
- `pkg/app/docker/topology/builder.go` (1 issue)
- `pkg/app/docker_integration.go` (1 issue)

**Fix Pattern A: Bounds Checking**

```go
// Before
rx += int64(v.RxBytes)

// After
import "math"

func safeUint64ToInt64(v uint64) (int64, error) {
    if v > math.MaxInt64 {
        return 0, fmt.Errorf("value %d exceeds int64 max", v)
    }
    return int64(v), nil
}

// Usage
rxBytes, err := safeUint64ToInt64(v.RxBytes)
if err != nil {
    return fmt.Errorf("rx bytes overflow: %w", err)
}
rx += rxBytes
```

**Fix Pattern B: Suppress with Justification**

```go
// For cases where overflow is acceptable (e.g., metrics that wrap)
rx += int64(v.RxBytes) //nolint:gosec // G115: overflow acceptable for metrics display
```

### 4.2 Create Security Utility Package

Create `pkg/app/internal/safeconv/safeconv.go`:

```go
package safeconv

import (
    "fmt"
    "math"
)

// Uint64ToInt64 safely converts uint64 to int64, returning error on overflow
func Uint64ToInt64(v uint64) (int64, error) {
    if v > math.MaxInt64 {
        return 0, fmt.Errorf("value %d exceeds int64 max", v)
    }
    return int64(v), nil
}

// IntToUint64 safely converts int to uint64, returning error for negative values
func IntToUint64(v int) (uint64, error) {
    if v < 0 {
        return 0, fmt.Errorf("negative value %d cannot convert to uint64", v)
    }
    return uint64(v), nil
}
```

**Acceptance Criteria:**
- [ ] All G115 issues resolved with bounds checks or justified suppressions
- [ ] `safeconv` utility package created and tested
- [ ] gosec runs clean or with documented suppressions

---

## Phase 5: Code Complexity Reduction (Priority: MEDIUM)

**Timeline:** Weeks 2-4  
**Owner:** Development Team  
**Estimated Effort:** 40-60 hours

### 5.1 Top 10 Functions to Refactor

| Priority | Function | Cyclomatic | Cognitive | File |
|----------|----------|------------|-----------|------|
| 1 | `CreateResource` | 38 | 89 | `pkg/app/resources.go:68` |
| 2 | `GetPersistentVolumes` | 39 | 31 | `pkg/app/persistentvolumes.go:13` |
| 3 | `GetSwarmStackComposeYAML` | 39 | 68 | `pkg/app/docker/stacks_compose.go:66` |
| 4 | `GetStatefulSetDetail` | 23 | 69 | `pkg/app/resource_details.go:540` |
| 5 | `ScanClusterHealth` | 30 | 62 | `pkg/app/monitor_actions.go:162` |
| 6 | `collectSwarmMetricsWithBreakdown` | 33 | 55 | `pkg/app/docker/metrics_live.go:17` |
| 7 | `GetResourceEvents` | 31 | 52 | `pkg/app/events.go:126` |
| 8 | `checkPodIssues` | 26 | 49 | `pkg/app/monitor.go:94` |
| 9 | `GetPodEvents` | 28 | 49 | `pkg/app/events.go:14` |
| 10 | `GetPodMounts` | 24 | 47 | `pkg/app/pod_details.go:187` |

### 5.2 Refactoring Strategy: CreateResource

**Current Structure (Cyclomatic: 38, Cognitive: 89):**
- Large switch statement handling 15+ resource types
- Repeated validation and error handling

**Proposed Refactoring:**

```go
// Define resource creator interface
type ResourceCreator interface {
    Validate(yaml string) error
    Create(ctx context.Context, clientset kubernetes.Interface, namespace, yaml string) error
}

// Map of resource creators
var resourceCreators = map[string]ResourceCreator{
    "Deployment":     &DeploymentCreator{},
    "Service":        &ServiceCreator{},
    "ConfigMap":      &ConfigMapCreator{},
    "Secret":         &SecretCreator{},
    // ... other resources
}

// Simplified CreateResource
func (a *App) CreateResource(resourceType, namespace, yaml string) error {
    creator, ok := resourceCreators[resourceType]
    if !ok {
        return fmt.Errorf("unsupported resource type: %s", resourceType)
    }
    
    if err := creator.Validate(yaml); err != nil {
        return fmt.Errorf("validation failed: %w", err)
    }
    
    return creator.Create(a.ctx, a.clientset, namespace, yaml)
}
```

### 5.3 Refactoring Strategy: GetPersistentVolumes

**Current Issues:**
- Inline field mapping
- Repeated status calculation
- Complex conditional logic

**Proposed Changes:**
1. Extract `mapPVToInfo(pv) PVInfo` helper
2. Extract `calculatePVStatus(pv) string` helper
3. Extract `getPVCapacity(pv) string` helper

### 5.4 Complexity Tracking

Add to CI pipeline:

```yaml
- name: Check Complexity
  run: |
    # Cyclomatic complexity check
    gocyclo -over 15 ./... | tee complexity-report.txt
    if [ -s complexity-report.txt ]; then
      echo "::warning::Functions with high cyclomatic complexity found"
    fi
    
    # Cognitive complexity check
    gocognit -over 20 ./... | tee cognitive-report.txt
```

**Acceptance Criteria:**
- [ ] Top 5 functions refactored to complexity ≤15
- [ ] No new functions with complexity >20
- [ ] Complexity checks added to CI

---

## Phase 6: Code Duplication Reduction (Priority: MEDIUM)

**Timeline:** Weeks 3-4  
**Owner:** Frontend Lead  
**Estimated Effort:** 24-32 hours

### 6.1 JavaScript Duplication (18.85% → ≤5%)

#### Create Shared Table Component

```jsx
// src/components/shared/ResourceOverviewTable.jsx
import { useReactTable, getCoreRowModel } from '@tanstack/react-table';

export function ResourceOverviewTable({
  data,
  columns,
  onRowClick,
  emptyMessage = 'No resources found',
  loading = false
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  if (loading) return <TableSkeleton />;
  if (!data.length) return <EmptyState message={emptyMessage} />;

  return (
    <table className="resource-table">
      <thead>
        {table.getHeaderGroups().map(headerGroup => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map(header => (
              <th key={header.id}>
                {flexRender(header.column.columnDef.header, header.getContext())}
              </th>
            ))}
          </tr>
        ))}
      </thead>
      <tbody>
        {table.getRowModel().rows.map(row => (
          <tr key={row.id} onClick={() => onRowClick?.(row.original)}>
            {row.getVisibleCells().map(cell => (
              <td key={cell.id}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

#### Create Shared YAML Tab Component

```jsx
// src/components/shared/YamlTab.jsx
import { CodeMirror } from '@codemirror/view';
import { yaml } from '@codemirror/lang-yaml';

export function YamlTab({ content, readOnly = true, onChange }) {
  return (
    <div className="yaml-tab">
      <CodeMirror
        value={content}
        extensions={[yaml()]}
        readOnly={readOnly}
        onChange={onChange}
      />
    </div>
  );
}
```

#### Refactor Existing Tables

| Before | After | LOC Saved |
|--------|-------|-----------|
| `StatefulSetsOverviewTable.jsx` (410 lines) | Uses `ResourceOverviewTable` (~100 lines) | ~310 |
| `ServicesOverviewTable.jsx` (365 lines) | Uses `ResourceOverviewTable` (~90 lines) | ~275 |
| `SecretsOverviewTable.jsx` (335 lines) | Uses `ResourceOverviewTable` (~85 lines) | ~250 |

### 6.2 Go Duplication (46 clone groups)

#### Create Generic Handlers

```go
// pkg/app/internal/handlers/resource_yaml.go
package handlers

type YAMLGetter[T any] struct {
    GetFunc    func(ctx context.Context, name, namespace string) (*T, error)
    Serializer func(*T) ([]byte, error)
}

func (g *YAMLGetter[T]) GetYAML(ctx context.Context, name, namespace string) (string, error) {
    resource, err := g.GetFunc(ctx, name, namespace)
    if err != nil {
        return "", fmt.Errorf("get resource: %w", err)
    }
    
    data, err := g.Serializer(resource)
    if err != nil {
        return "", fmt.Errorf("serialize: %w", err)
    }
    
    return string(data), nil
}
```

#### Consolidate Holmes Integration Functions

The 11 similar blocks in `holmes_integration.go` (lines 747-1150) can be consolidated:

```go
// Before: 11 separate functions with similar structure
func (a *App) analyzeDeploymentContext(...) { ... }
func (a *App) analyzeServiceContext(...) { ... }
// ... 9 more

// After: Single generic function
func (a *App) analyzeResourceContext(resourceType string, name, namespace string) (*HolmesContext, error) {
    builder, ok := contextBuilders[resourceType]
    if !ok {
        return nil, fmt.Errorf("unsupported resource type: %s", resourceType)
    }
    return builder.Build(a.ctx, a.clientset, name, namespace)
}
```

**Acceptance Criteria:**
- [ ] JS duplication ≤5%
- [ ] Shared table component used by all resource views
- [ ] Go clone groups reduced by 50%

---

## Phase 7: CI/CD Integration (Priority: HIGH)

**Timeline:** Week 1 (parallel with other phases)  
**Owner:** DevOps Lead  
**Estimated Effort:** 8-12 hours

### 7.1 Quality Gate in CI

Add to `.github/workflows/quality.yml`:

```yaml
name: Quality Gate

on:
  pull_request:
    branches: [main, develop]
  push:
    branches: [main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Run Quality Pipeline
        run: |
          cd quality
          ./scripts/run-all.sh
        
      - name: Upload Reports
        uses: actions/upload-artifact@v4
        with:
          name: quality-reports
          path: quality/reports/
          
      - name: Comment on PR
        if: github.event_name == 'pull_request'
        uses: actions/github-script@v7
        with:
          script: |
            const fs = require('fs');
            const report = JSON.parse(fs.readFileSync('quality/reports/combined/quality-report.json'));
            
            const body = `## Quality Report
            
            | Metric | Value | Status |
            |--------|-------|--------|
            | Go Coverage | ${report.summary.goCoverage}% | ${report.summary.goCoverage >= 70 ? '✅' : '❌'} |
            | JS Coverage | ${report.summary.jsCoverage}% | ${report.summary.jsCoverage >= 70 ? '✅' : '❌'} |
            | ESLint Errors | ${report.summary.jsLintErrors} | ${report.summary.jsLintErrors === 0 ? '✅' : '❌'} |
            | Secrets | ${report.summary.secretsFound} | ${report.summary.secretsFound === 0 ? '✅' : '❌'} |
            `;
            
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: body
            });
```

### 7.2 Pre-commit Hooks

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Frontend linting
cd frontend && npm run lint || exit 1

# Go checks
cd .. && go vet ./... || exit 1
golangci-lint run --fast || exit 1
```

---

## Timeline Summary

```
Week 1:
├── Day 1-2: Phase 1 - Security Issues (BLOCKING)
├── Day 2-4: Phase 2 - ESLint Fixes (BLOCKING)
└── Day 3-5: Phase 7 - CI Integration

Week 2:
├── Phase 3: Test Coverage (ongoing)
├── Phase 4: Go Security Issues
└── Phase 5: Begin Complexity Reduction

Week 3:
├── Phase 3: Complete Coverage Goals
├── Phase 5: Continue Complexity Reduction
└── Phase 6: Begin Duplication Reduction

Week 4:
├── Phase 5: Complete Complexity Work
├── Phase 6: Complete Duplication Work
└── Final Quality Gate Validation
```

---

## Success Metrics

| Metric | Current | Week 1 | Week 2 | Week 3 | Week 4 |
|--------|---------|--------|--------|--------|--------|
| Go Coverage | 41.9% | 50% | 60% | 70% | 75% |
| JS Coverage | 55.01% | 60% | 65% | 70% | 75% |
| ESLint Errors | 50 | 0 | 0 | 0 | 0 |
| ESLint Warnings | 1,216 | 200 | 100 | 50 | 30 |
| Secrets | 25 | 0 | 0 | 0 | 0 |
| High Complexity Functions | 58 | 55 | 40 | 25 | 15 |
| JS Duplication | 18.85% | 15% | 10% | 7% | 5% |

---

## Ownership & Accountability

| Phase | Owner | Reviewer | Status |
|-------|-------|----------|--------|
| Phase 1: Security | DevOps Lead | Security Team | Not Started |
| Phase 2: ESLint | Frontend Lead | Code Owner | Not Started |
| Phase 3: Coverage | All Developers | Tech Lead | Not Started |
| Phase 4: Gosec | Backend Lead | Security Team | Not Started |
| Phase 5: Complexity | Backend Lead | Architect | Not Started |
| Phase 6: Duplication | Frontend Lead | Architect | Not Started |
| Phase 7: CI/CD | DevOps Lead | Tech Lead | Not Started |

---

## Appendix A: Commands Reference

```bash
# Run quality pipeline
cd quality && ./scripts/run-all.sh

# Run quick checks only
cd quality && ./scripts/run-quick.sh

# Frontend lint with auto-fix
cd frontend && npm run lint -- --fix

# Go test with coverage
go test -coverprofile=coverage.out ./...
go tool cover -html=coverage.out -o coverage.html

# Check cyclomatic complexity
gocyclo -over 15 ./pkg/...

# Check cognitive complexity
gocognit -over 20 ./pkg/...

# Run gosec
gosec -fmt=json ./...

# Check for secrets
gitleaks detect --source . --report-format json
```

---

## Appendix B: File Locations

| Report | Location |
|--------|----------|
| Combined Quality Report | `quality/reports/combined/quality-report.json` |
| Go Coverage | `quality/reports/go/coverage.html` |
| JS Coverage | `frontend/coverage/index.html` |
| ESLint Report | `quality/reports/js/eslint.txt` |
| Gosec Report | `quality/reports/go/gosec.json` |
| Secrets Report | `quality/reports/security/gitleaks-report.json` |
| Complexity (Cyclomatic) | `quality/reports/go/gocyclo.txt` |
| Complexity (Cognitive) | `quality/reports/go/gocognit.txt` |
| JS Duplication | `quality/reports/js/jscpd-report.json` |
