# Helm v4 Support Implementation Plan

## Executive Summary

This document outlines the implementation plan for supporting both Helm v3 and Helm v4 in kube-dev-bench. The goal is to provide a seamless, user-friendly experience that transparently handles both Helm versions without requiring users to manage SDK complexity.

---

## What's New in Helm v4

### Major Breaking Changes

| Change | Impact on kube-dev-bench |
|--------|--------------------------|
| **Package restructuring** | Import paths change from `helm.sh/helm/v3/pkg/*` to `helm.sh/helm/v4/pkg/*` |
| **Versioned packages** | `pkg/chart` → `pkg/chart/v2`, `pkg/release` → `pkg/release/v1`, `chartutil` → `chart/util` |
| **CLI flag renames** | `--atomic` → `--rollback-on-failure`, `--force` → `--force-replace` |
| **Plugin system overhaul** | Wasm-based plugins, post-renderers now plugins |
| **Registry login changes** | No longer accepts full URLs, domain-only |
| **DryRun strategy** | Changed from boolean to `DryRunStrategy` type |
| **WaitStrategy** | New `"watcher"` option with kstatus integration |

### New Features in Helm v4

| Feature | Benefit for Users |
|---------|-------------------|
| **kstatus watcher** | Better real-time resource status monitoring |
| **OCI digest support** | Install charts by digest for supply chain security |
| **Server-Side Apply** | Better conflict resolution with operators |
| **Multi-document values** | Split values across multiple YAML files |
| **Custom template functions** | Extend templating via plugins |
| **Content-based caching** | Faster dependency resolution |
| **Charts v3 support** | Future-proof for new chart features |

---

## Current Implementation Analysis

### Current Helm Usage in `pkg/app/helm.go`

The application currently uses these Helm v3 SDK packages:

```go
import (
    "helm.sh/helm/v3/pkg/action"
    "helm.sh/helm/v3/pkg/chart/loader"
    "helm.sh/helm/v3/pkg/cli"
    "helm.sh/helm/v3/pkg/getter"
    "helm.sh/helm/v3/pkg/repo"
)
```

### Functions Using Helm SDK

| Function | Helm SDK Usage |
|----------|----------------|
| `getHelmSettings()` | `cli.New()`, `cli.EnvSettings` |
| `getHelmActionConfig()` | `action.Configuration`, `actionConfig.Init()` |
| `GetHelmReleases()` | `action.NewList()` |
| `GetHelmRepositories()` | `repo.LoadFile()` |
| `AddHelmRepository()` | `repo.NewChartRepository()`, `getter.All()` |
| `RemoveHelmRepository()` | `repo.LoadFile()`, `repo.File.Remove()` |
| `UpdateHelmRepositories()` | `repo.NewChartRepository()` |
| `SearchHelmCharts()` | `repo.LoadIndexFile()` |
| `GetHelmChartVersions()` | `repo.LoadIndexFile()` |
| `InstallHelmChart()` | `action.NewInstall()`, `loader.Load()` |
| `UpgradeHelmRelease()` | `action.NewUpgrade()`, `loader.Load()` |
| `UninstallHelmRelease()` | `action.NewUninstall()` |
| `RollbackHelmRelease()` | `action.NewRollback()` |
| `GetHelmReleaseHistory()` | `action.NewHistory()` |
| `GetHelmReleaseValues()` | `action.NewGetValues()` |
| `GetHelmReleaseManifest()` | `action.NewGet()` |
| `GetHelmReleaseNotes()` | `action.NewGet()` |

---

## Implementation Strategy

### Recommended Approach: **Upgrade to Helm v4 SDK Only**

After careful analysis, the recommended approach is to **upgrade entirely to Helm v4 SDK** rather than maintaining dual SDK support. Here's why:

#### Rationale

1. **Helm v4 is backwards compatible with v3 charts** - All existing v2 charts continue to work unchanged
2. **Helm v4 can manage v3 releases** - Existing releases installed with Helm v3 can be managed with v4
3. **Simplified maintenance** - No need to maintain two codepaths
4. **Future-proof** - Ready for Charts v3 when it releases
5. **Better features** - Users benefit from improved error messages, caching, and kstatus

#### Migration Path for Users

- Users with Helm v3 CLI installed can still work with kube-dev-bench
- The application's internal SDK handles all Helm operations; CLI version is irrelevant
- Existing releases are fully compatible

---

## Detailed Implementation Plan

### Phase 1: SDK Migration (Backend) ⏱️ 2-3 days

#### 1.1 Update Dependencies

Update `go.mod`:

```diff
- helm.sh/helm/v3 v3.20.0
+ helm.sh/helm/v4 v4.0.0
```

#### 1.2 Update Import Paths

```diff
- "helm.sh/helm/v3/pkg/action"
- "helm.sh/helm/v3/pkg/chart/loader"
- "helm.sh/helm/v3/pkg/cli"
- "helm.sh/helm/v3/pkg/getter"
- "helm.sh/helm/v3/pkg/repo"
+ "helm.sh/helm/v4/pkg/action"
+ "helm.sh/helm/v4/pkg/chart/loader"
+ "helm.sh/helm/v4/pkg/cli"
+ "helm.sh/helm/v4/pkg/getter"
+ "helm.sh/helm/v4/pkg/repo"
```

#### 1.3 API Changes Required

##### Action Configuration Init

The v4 SDK simplifies the log handler parameter:

```diff
  if err := actionConfig.Init(
      settings.RESTClientGetter(),
      namespace,
      os.Getenv("HELM_DRIVER"),
-     func(format string, v ...interface{}) {
-         fmt.Printf("[Helm] "+format+"\n", v...)
-     },
+     os.Getenv("HELM_DRIVER"),  // v4 removes the log handler from Init
  ); err != nil {
```

##### Install Action Changes

```diff
  installAction := action.NewInstall(actionConfig)
  installAction.ReleaseName = req.ReleaseName
  installAction.Namespace = req.Namespace
  installAction.CreateNamespace = req.CreateNs
+ installAction.DryRunStrategy = "none"    // New in v4: "none", "client", "server"
+ installAction.WaitStrategy = "legacy"    // New in v4: "legacy", "watcher", "none"
```

##### Upgrade Action Changes

```diff
  upgradeAction := action.NewUpgrade(actionConfig)
  upgradeAction.Namespace = req.Namespace
  upgradeAction.ReuseValues = req.ReuseValues
+ upgradeAction.DryRunStrategy = "none"
+ upgradeAction.WaitStrategy = "legacy"
```

##### Uninstall Action Changes

```diff
  uninstallAction := action.NewUninstall(actionConfig)
+ uninstallAction.DeletionPropagation = "foreground"  // New in v4
+ uninstallAction.WaitStrategy = "watcher"            // New in v4
```

##### Context-Based Execution

For better control over long-running operations:

```diff
- _, err = installAction.Run(chart, req.Values)
+ _, err = installAction.RunWithContext(ctx, chart, req.Values)
```

### Phase 2: Enhanced Features (Backend) ⏱️ 2-3 days

#### 2.1 Add OCI Digest Support

New function for installing charts by digest:

```go
// InstallHelmChartByDigest installs a chart from OCI registry by digest
func (a *App) InstallHelmChartByDigest(req HelmInstallRequest) error {
    // Support for: oci://registry.example.com/charts/app@sha256:abc123...
    // This provides supply chain security
}
```

#### 2.2 Add Wait Strategy Options

Expose the new wait strategies to users:

```go
type HelmInstallRequest struct {
    ReleaseName     string
    ChartRef        string
    Namespace       string
    Version         string
    Values          map[string]interface{}
    CreateNs        bool
    WaitStrategy    string  // NEW: "none", "legacy", "watcher"
    Timeout         int     // NEW: Wait timeout in seconds
}
```

#### 2.3 Add Server-Side Apply Support

```go
type HelmInstallRequest struct {
    // ...existing fields...
    UseServerSideApply bool  // NEW: Use server-side apply for better conflict handling
}
```

### Phase 3: Frontend Updates ⏱️ 1-2 days

#### 3.1 Update Install Dialog

Add new options to the Helm install dialog:

```jsx
// New options in HelmInstallDialog.jsx
<FormControl>
  <InputLabel>Wait Strategy</InputLabel>
  <Select value={waitStrategy} onChange={handleWaitStrategyChange}>
    <MenuItem value="none">No Wait</MenuItem>
    <MenuItem value="legacy">Legacy (Poll-based)</MenuItem>
    <MenuItem value="watcher">Watcher (Real-time)</MenuItem>
  </Select>
  <FormHelperText>
    Watcher provides better real-time status updates
  </FormHelperText>
</FormControl>
```

#### 3.2 Show Helm Version Info

Display the Helm SDK version in the app footer or settings:

```jsx
// In Footer.jsx or Settings
<Typography variant="caption">
  Helm SDK: v4.0.0
</Typography>
```

#### 3.3 Enhanced Status Monitoring

Leverage kstatus watcher for better deployment status:

```jsx
// Real-time status updates using kstatus
const ReleaseStatus = ({ release }) => {
  // Show detailed status from kstatus watcher
  // - InProgress states
  // - Current states  
  // - Failed states with reasons
};
```

### Phase 4: Testing & Documentation ⏱️ 1-2 days

#### 4.1 Update Unit Tests

Update `pkg/app/helm_test.go` for v4 API changes.

#### 4.2 Update E2E Tests

Update `e2e/tests/95-helm-releases-view.spec.ts` to verify:
- Install with new wait strategies
- OCI digest installation
- Server-side apply behavior

#### 4.3 Documentation

- Update README with Helm v4 feature notes
- Add migration notes for users upgrading

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `go.mod` | Modify | Update Helm dependency to v4 |
| `pkg/app/helm.go` | Modify | Update imports, API changes |
| `pkg/app/helm_test.go` | Modify | Update tests for v4 APIs |
| `pkg/app/types.go` | Modify | Add new request fields |
| `frontend/src/k8s/resources/helmreleases/*` | Modify | UI updates for new features |
| `project/backlog.md` | Modify | Mark task complete |

---

## Compatibility Matrix

| Component | v3 Compatibility | v4 Support |
|-----------|------------------|------------|
| Helm CLI (user's machine) | ✅ Works | ✅ Works |
| Existing Helm releases | ✅ Fully compatible | ✅ Can manage v3 releases |
| Chart repositories | ✅ Works | ✅ Works |
| OCI registries | ✅ Works | ✅ Enhanced with digest support |
| Charts (v2 apiVersion) | ✅ Works | ✅ Full support |
| Charts (v3 apiVersion) | ❌ N/A | ✅ Coming soon |

---

## User Experience Considerations

### Transparent Migration

Users will not notice the SDK upgrade:
- No action required from users
- All existing workflows continue to work
- Settings and repositories are preserved

### New Features Discoverability

Introduce new features gradually:
1. **Phase 1**: Core migration (invisible to users)
2. **Phase 2**: Add "Wait Strategy" option with sensible defaults
3. **Phase 3**: Add OCI digest support in advanced options
4. **Future**: Server-side apply as the new default when mature

### Defaults

| Setting | Default | Rationale |
|---------|---------|-----------|
| Wait Strategy | `legacy` | Backward compatible, switch to `watcher` after validation |
| Server-Side Apply | `false` | New feature, opt-in initially |
| OCI Digest | Optional | Only for users who need supply chain security |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API incompatibilities | Low | Medium | Thorough testing, v4 docs are comprehensive |
| Chart compatibility issues | Very Low | Low | v4 maintains full v2 chart support |
| User confusion | Low | Low | No user-facing changes for core features |
| Build failures | Medium | Medium | CI/CD will catch issues early |

---

## Timeline Estimate

| Phase | Duration | Depends On |
|-------|----------|------------|
| Phase 1: SDK Migration | 2-3 days | — |
| Phase 2: Enhanced Features | 2-3 days | Phase 1 |
| Phase 3: Frontend Updates | 1-2 days | Phase 2 |
| Phase 4: Testing & Docs | 1-2 days | Phase 3 |
| **Total** | **6-10 days** | — |

---

## Acceptance Criteria

- [ ] All existing Helm functionality works with v4 SDK
- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] No regressions in Helm release management
- [ ] New wait strategy option available in UI
- [ ] Documentation updated
- [ ] `[x] helm v4 support` in backlog.md

---

## References

- [Helm v4 Overview](https://helm.sh/docs/overview)
- [Helm v4 Full Changelog](https://helm.sh/docs/changelog)
- [Helm Go SDK Documentation](https://helm.sh/docs/sdk/gosdk)
- [Helm SDK Examples](https://helm.sh/docs/sdk/examples)
- [HIP-0023: Server-Side Apply](https://github.com/helm/community/blob/main/hips/hip-0023.md)
- [HIP-0026: Plugin System](https://github.com/helm/community/blob/main/hips/hip-0026.md)
