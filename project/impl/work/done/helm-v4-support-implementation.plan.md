# Helm v4 Support Implementation Plan
**Created:** 2026-02-06
**Updated:** 2026-02-06

> **Status: ✅ COMPLETED**
> This document was originally a planning document. The implementation has been completed and this document now serves as reference documentation for the Helm v4 integration.

## Current Status (Verified 2026-02-06)

- Helm v4 SDK usage is confirmed in [go.mod](go.mod) and [pkg/app/helm.go](pkg/app/helm.go).

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

## Current Implementation (Completed)

### Helm SDK Version

The application uses **Helm v4.1.0** SDK:

```go
// go.mod
helm.sh/helm/v4 v4.1.0
```

### Current Helm Usage in `pkg/app/helm.go`

The application uses these Helm v4 SDK packages:

```go
import (
    "helm.sh/helm/v4/pkg/action"
    "helm.sh/helm/v4/pkg/chart"
    "helm.sh/helm/v4/pkg/chart/loader"
    "helm.sh/helm/v4/pkg/cli"
    "helm.sh/helm/v4/pkg/getter"
    "helm.sh/helm/v4/pkg/kube"
    "helm.sh/helm/v4/pkg/release"
    repo "helm.sh/helm/v4/pkg/repo/v1"
)
```

### Functions Using Helm SDK

| Function | Helm SDK Usage |
|----------|----------------|
| `getHelmSettings()` | `cli.New()`, `cli.EnvSettings` |
| `getHelmActionConfig()` | `action.Configuration`, `actionConfig.Init()` (v4 3-param signature) |
| `GetHelmReleases()` | `action.NewList()`, `release.NewAccessor()`, `chart.NewAccessor()` |
| `GetHelmRepositories()` | `repo.LoadFile()` |
| `AddHelmRepository()` | `repo.NewChartRepository()`, `getter.All()` |
| `RemoveHelmRepository()` | `repo.LoadFile()`, `repo.File.Remove()` |
| `UpdateHelmRepositories()` | `repo.NewChartRepository()` |
| `SearchHelmCharts()` | `repo.LoadIndexFile()` |
| `GetHelmChartVersions()` | `repo.LoadIndexFile()` |
| `InstallHelmChart()` | `action.NewInstall()`, `loader.Load()`, `kube.WaitStrategy`, `RunWithContext()` |
| `UpgradeHelmRelease()` | `action.NewUpgrade()`, `loader.Load()`, `kube.WaitStrategy`, `RunWithContext()` |
| `UninstallHelmRelease()` | `action.NewUninstall()`, `DeletionPropagation`, `kube.StatusWatcherStrategy` |
| `RollbackHelmRelease()` | `action.NewRollback()` |
| `GetHelmReleaseHistory()` | `action.NewHistory()`, `release.NewAccessor()`, `chart.NewAccessor()` |
| `GetHelmReleaseValues()` | `action.NewGetValues()` |
| `GetHelmReleaseManifest()` | `action.NewGet()`, `release.NewAccessor()` |
| `GetHelmReleaseNotes()` | `action.NewGet()`, `release.NewAccessor()` |

---

## Implementation Strategy

### Implemented Approach: **Upgrade to Helm v4 SDK Only**

After careful analysis, the approach taken was to **upgrade entirely to Helm v4 SDK** rather than maintaining dual SDK support.

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

## Implementation Details (Completed)

### Phase 1: SDK Migration (Backend) ✅ COMPLETE

#### 1.1 Updated Dependencies

`go.mod`:
```
helm.sh/helm/v4 v4.1.0
```

#### 1.2 Updated Import Paths

```go
import (
    "helm.sh/helm/v4/pkg/action"
    "helm.sh/helm/v4/pkg/chart"
    "helm.sh/helm/v4/pkg/chart/loader"
    "helm.sh/helm/v4/pkg/cli"
    "helm.sh/helm/v4/pkg/getter"
    "helm.sh/helm/v4/pkg/kube"
    "helm.sh/helm/v4/pkg/release"
    repo "helm.sh/helm/v4/pkg/repo/v1"
)
```

#### 1.3 API Changes Implemented

##### Action Configuration Init

The v4 SDK simplifies the log handler parameter (removed from `Init`):

```go
if err := actionConfig.Init(
    settings.RESTClientGetter(),
    namespace,
    os.Getenv("HELM_DRIVER"),
); err != nil {
    return nil, fmt.Errorf("failed to initialize helm action config: %w", err)
}
```

##### Release and Chart Accessor Pattern

Helm v4 uses accessor interfaces for type-safe field access:

```go
// Access release fields
accessor, err := release.NewAccessor(rel)
if err != nil {
    continue
}
name := accessor.Name()
namespace := accessor.Namespace()
status := accessor.Status()
deployedAt := accessor.DeployedAt()

// Access chart fields
if chrt := accessor.Chart(); chrt != nil {
    if chartAccessor, err := chart.NewAccessor(chrt); err == nil {
        chartName := chartAccessor.Name()
        if meta := chartAccessor.MetadataAsMap(); meta != nil {
            version := meta["version"].(string)
            appVersion := meta["appVersion"].(string)
        }
    }
}
```

##### WaitStrategy Configuration

Using `kube.WaitStrategy` type:

```go
switch req.WaitStrategy {
case "watcher":
    installAction.WaitStrategy = kube.StatusWatcherStrategy
case "hookOnly":
    installAction.WaitStrategy = kube.HookOnlyStrategy
default:
    installAction.WaitStrategy = kube.LegacyStrategy
}
```

##### Context-Based Execution

```go
ctx := context.Background()
if a.ctx != nil {
    ctx = a.ctx
}
_, err = installAction.RunWithContext(ctx, chart, req.Values)
```

##### Uninstall with Deletion Propagation

```go
uninstallAction := action.NewUninstall(actionConfig)
uninstallAction.DeletionPropagation = "foreground"
uninstallAction.WaitStrategy = kube.StatusWatcherStrategy
```

### Phase 2: Enhanced Features (Backend) ✅ COMPLETE

#### 2.1 Wait Strategy Options

Implemented in `HelmInstallRequest` and `HelmUpgradeRequest`:

```go
type HelmInstallRequest struct {
    ReleaseName  string                 `json:"releaseName"`
    Namespace    string                 `json:"namespace"`
    ChartRef     string                 `json:"chartRef"`
    Version      string                 `json:"version"`
    Values       map[string]interface{} `json:"values"`
    CreateNs     bool                   `json:"createNamespace"`
    // Helm v4 options
    WaitStrategy string `json:"waitStrategy"` // "none", "legacy", "watcher"
    Timeout      int    `json:"timeout"`      // Wait timeout in seconds
}
```

### Phase 3: Frontend Updates ✅ COMPLETE

#### 3.1 Install Dialog

Wait strategy and timeout options added to [HelmInstallDialog.jsx](frontend/src/k8s/resources/helmreleases/HelmInstallDialog.jsx):
- Wait Strategy selector: "No Wait", "Legacy (Poll-based)", "Watcher (Real-time)"
- Timeout input (disabled when wait strategy is "none")
- Advanced Options section labeled "Helm v4"

#### 3.2 Upgrade Dialog

Wait strategy and timeout options added to [HelmActions.jsx](frontend/src/k8s/resources/helmreleases/HelmActions.jsx) upgrade dialog.

### Phase 4: Testing & Documentation ✅ COMPLETE

#### 4.1 Unit Tests

[pkg/app/helm_test.go](pkg/app/helm_test.go) includes tests for:
- `TestGetHelmSettings`
- `TestGetHelmRepoFile`
- `TestGetHelmRepositories_NoFile`
- `TestSearchHelmCharts_NoRepoFile`
- `TestHelmReleaseInfo_Fields`

#### 4.2 E2E Tests

[e2e/tests/96-helm-v4-features.spec.ts](e2e/tests/96-helm-v4-features.spec.ts) covers:
- Release list correctly shows chart metadata via v4 accessor
- Release history correctly shows revisions via v4 accessor
- Install chart with wait options and verify in UI

#### 4.3 Documentation

- This plan document serves as implementation reference
- `[x] helm v4 support` marked complete in backlog.md

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `go.mod` | Modified | Updated Helm dependency to v4.1.0 |
| `pkg/app/helm.go` | Modified | Updated imports, API changes, accessor pattern |
| `pkg/app/helm_test.go` | Modified | Tests for v4 APIs |
| `pkg/app/types.go` | Modified | Added WaitStrategy and Timeout fields |
| `frontend/src/k8s/resources/helmreleases/HelmInstallDialog.jsx` | Modified | UI for wait strategy and timeout |
| `frontend/src/k8s/resources/helmreleases/HelmActions.jsx` | Modified | UI for upgrade wait strategy and timeout |
| `e2e/tests/96-helm-v4-features.spec.ts` | Added | E2E tests for v4 features |
| `project/backlog.md` | Modified | Marked task complete |

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

Features introduced:
1. **Phase 1**: Core migration (invisible to users) ✅
2. **Phase 2**: "Wait Strategy" option with sensible defaults ✅
3. **Future**: OCI digest support in advanced options
4. **Future**: Server-side apply as the new default when mature

### Defaults

| Setting | Default | Rationale |
|---------|---------|-----------|
| Wait Strategy | `legacy` | Backward compatible |
| Timeout | `300` seconds | 5 minute default for install/upgrade operations |
| Server-Side Apply | Not implemented | Planned for future release |
| OCI Digest | Not implemented | Planned for future release |

---

## Acceptance Criteria

- [x] All existing Helm functionality works with v4 SDK
- [x] Unit tests pass
- [x] E2E tests pass
- [x] No regressions in Helm release management
- [x] New wait strategy option available in UI
- [x] Documentation updated
- [x] `[x] helm v4 support` in backlog.md

---

## Future Enhancements

The following features from Helm v4 could be added in future releases:

1. **OCI Digest Support** - Install charts by digest for supply chain security
2. **Server-Side Apply** - Better conflict resolution with operators
3. **Enhanced Status Monitoring** - Leverage kstatus watcher for real-time deployment status

---

## References

- [Helm v4 Overview](https://helm.sh/docs/overview)
- [Helm v4 Full Changelog](https://helm.sh/docs/changelog)
- [Helm Go SDK Documentation](https://helm.sh/docs/sdk/gosdk)
- [Helm SDK Examples](https://helm.sh/docs/sdk/examples)
- [HIP-0023: Server-Side Apply](https://github.com/helm/community/blob/main/hips/hip-0023.md)
- [HIP-0026: Plugin System](https://github.com/helm/community/blob/main/hips/hip-0026.md)

