# Enterprise K8s Auth Gaps — Implementation Worklog

## Summary

Implemented all 7 enterprise Kubernetes authentication gaps identified in `project/todo/enterprise-k8s-auth-gaps.md`.
Branch: `feature/enterprise-auth-gaps` | CI: **PASSED** (run #194)

## Files Changed (31 files, +2634 / -191 lines)

### Backend (Go)

| File | Change | Gap |
|------|--------|-----|
| `pkg/app/k8s_auth_plugins.go` | Added azure + gcp blank imports | G1 |
| `pkg/app/tls_error.go` | NEW — `ErrTLSCertVerification` sentinel | G2 |
| `pkg/app/kube_rest.go` | Rewrote `getRESTConfig()` TLS/auth handling, `loadKubeconfig()`, `ConnectInsecure()`, `extractExecBinaryFromError()`, `isProxyAuthRequired()`, `extractHostFromRESTConfig()` | G2,G4,G5,G6 |
| `pkg/app/session_auth.go` | NEW — `ErrAuthExpired`, `ErrExecBinaryNotFound`, `isRBACForbidden()`, `isUnauthenticated()`, `handleUnauthenticated()` with 30s debounce | G3 |
| `pkg/app/session_probe.go` | NEW — Background liveness probe, `RefreshCredentials()`, `SetSessionProbeInterval()` | G7 |
| `pkg/app/path_windows.go` | NEW — Windows PATH augmentation for exec binaries | G5 |
| `pkg/app/path_other.go` | NEW — No-op stub for non-Windows | G5 |
| `pkg/app/event_names.go` | Added 5 new event constants | G2-G6 |
| `pkg/app/app_lifecycle.go` | Added fields + startup/shutdown hooks for probe + PATH | G5,G7 |
| `pkg/app/config.go` | Added `KubeconfigPaths`, `SessionProbeInterval`, `AllowInsecure` to `AppConfig` | G4,G7 |
| `pkg/app/kubeconfig.go` | `loadKubeconfig()` merged support, `Get/Set/DetectKubeconfigPaths` RPCs | G4 |
| `pkg/app/proxy.go` | Added `ntlm-local` auth type | G6 |

### Backend Tests (Go)

| File | Tests |
|------|-------|
| `pkg/app/k8s_auth_plugins_test.go` | Plugin compile verification |
| `pkg/app/tls_error_test.go` | Error/Unwrap/errors.As |
| `pkg/app/kube_rest_test.go` | Extended: extractExecBinary, isProxyAuth, extractHost, loadKubeconfig |
| `pkg/app/session_auth_test.go` | isRBACForbidden, isUnauthenticated, error types, debounce |
| `pkg/app/session_probe_test.go` | Start/stop probe, intervals, RefreshCredentials |
| `pkg/app/kubeconfig_paths_test.go` | SetKubeconfigPaths, GetKubeconfigPaths, Detect, ConnectInsecure |
| `pkg/app/proxy_test.go` | Extended: ntlm-local acceptance |

### Frontend

| File | Change | Gap |
|------|--------|-----|
| `frontend/src/hooks/useEnterpriseAuthEvents.ts` | NEW — Hook subscribing to 5 backend events | G2-G6 |
| `frontend/src/layout/connection/TLSCertErrorDialog.tsx` + `.css` | NEW — TLS cert error modal | G2 |
| `frontend/src/layout/connection/AuthExpiredBanner.tsx` + `.css` | NEW — Auth expired sticky banner | G3 |
| `frontend/src/layout/AppContainer.tsx` | Integrated hook + components | G2,G3 |
| `frontend/src/k8s/resources/kubeApi.ts` | Added 7 new Go function exports | G2-G7 |
| `frontend/src/__tests__/wailsMocks.ts` | Added 7 new mock entries | G2-G7 |

### Frontend Tests

| File | Tests |
|------|-------|
| `frontend/src/__tests__/useEnterpriseAuthEvents.test.ts` | 12 tests: event subscriptions, state, dedup, throttle |
| `frontend/src/__tests__/tlsCertErrorDialog.test.tsx` | 8 tests: render, actions, async, loading states |
| `frontend/src/__tests__/authExpiredBanner.test.tsx` | 6 tests: render, reconnect, dismiss, error states |

## Test Results

- **Backend**: All packages OK (13.6s)
- **Frontend**: 26 new tests + 1787 existing = 1813 passing. 10 pre-existing failures (missing `@xyflow/react` dep — unrelated).
- **CI**: Run #194 passed in 3m 22s.

## Bugs Fixed During Implementation

1. **`extractHostFromRESTConfig` schemeless hostname**: `url.Parse("api.example.com")` treats schemeless strings as paths → fallback to raw `rc.Host`.
2. **`TestSetKubeconfigPaths_InvalidPath` on Windows**: `os.Stat("/nonexistent/path")` returns nil because `C:\nonexistent\path` matched a real path → use temp dir.
3. **`TestHandleUnauthenticated_Debounce` goroutine leak**: `defer { disableWailsEvents = false }` overrode TestMain's global flag → removed.

## Date

2025-07-31
