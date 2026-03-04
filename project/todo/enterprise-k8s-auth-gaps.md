# Enterprise Kubernetes Authentication — Implementation Plan

Gap analysis refined for development. Each gap maps directly to the code that needs changing, includes the exact change required, acceptance criteria, and test requirements.

**Codebase snapshot**: client-go v0.35.2, Wails v2, Windows-primary desktop app.

---

## Verified Connection Flow

```
getRESTConfig()                                    ← pkg/app/kube_rest.go
  └─ clientcmd.LoadFromFile(configPath)            ← single file only; no KUBECONFIG env merge (Gap 4)
  └─ NewNonInteractiveClientConfig(cfg, context)
  └─ clientConfig.ClientConfig()                   ← client-go resolves exec/token/cert auth
       └─ only OIDC exec plugin imported           ← k8s_auth_plugins.go (Gap 1)
  └─ applyCustomCA(restConfig)                     ← PEM-merge into TLSClientConfig.CAData ✓
  └─ applyProxyConfig(restConfig)                  ← none / basic / system; no NTLM (Gap 6)
  └─ probeRESTConfig(restConfig)                   ← /version then Namespaces().List(Limit:1)
       ├─ cert error   → AUTO-degrade Insecure=true, no user consent (Gap 2)
       ├─ 403 Forbidden → tolerated via isPermissionError ✓
       ├─ 401 Unauthorized → tolerated via isPermissionError (should NOT be — Gap 3)
       ├─ auth-provider / OIDC error → tolerated via isAuthDiscoveryRecoverableError ✓
       └─ other error  → hard fail
```

### What Already Works

| Capability | Code location |
|---|---|
| Bearer token / client cert / basic auth | Native client-go |
| OIDC exec credential provider | `pkg/app/k8s_auth_plugins.go` — blank import |
| Custom CA (PEM merge, appends to existing CA) | `pkg/app/kube_rest.go` — `applyCustomCA()` |
| HTTP proxy — none / basic / system | `pkg/app/proxy.go` — `applyProxyConfig()` |
| Pre/post-connect hooks | `pkg/app/hooks.go` — `hookTypePreConnect`, `hookTypePostConnect` |
| Auth-provider error tolerance at connect time | `pkg/app/kube_rest.go` — `isAuthDiscoveryRecoverableError()` |
| Multi-file kubeconfig *discovery* (scan `~/.kube/`) | `pkg/app/kubeconfig.go` — `GetKubeConfigs()` |
| Context switching | `pkg/app/kubeconfig.go` |

---

## Gap 1 — Missing Legacy Auth Plugins

**Priority**: P1 — Trivial fix, medium coverage gain  
**File**: [pkg/app/k8s_auth_plugins.go](pkg/app/k8s_auth_plugins.go)

### Problem

Only the OIDC exec plugin is imported. client-go ships two additional built-in auth providers that are present in many enterprise kubeconfigs generated before 2022:

```
k8s.io/client-go/plugin/pkg/client/auth/azure   ← AKS with legacy auth-provider stanza
k8s.io/client-go/plugin/pkg/client/auth/gcp     ← GKE with legacy auth-provider stanza
```

Without these imports, client-go silently skips the auth provider and produces a generic "no auth provider found" error that `isAuthDiscoveryRecoverableError()` currently swallows — meaning the user connects but every API call returns 401 with no explanation.

### Implementation

Add two blank imports to `k8s_auth_plugins.go`:

```go
import (
    _ "k8s.io/client-go/plugin/pkg/client/auth/azure"
    _ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
    _ "k8s.io/client-go/plugin/pkg/client/auth/oidc"
)
```

### Tests Required

- Unit test in `pkg/app/k8s_auth_plugins_test.go`: verify packages compile and register their providers (check `rest.RegisterAuthProviderPlugin` indirectly by asserting `ClientConfig()` does not error for a kubeconfig with `auth-provider: name: azure`).

### Acceptance Criteria

- [x] Both imports present and compiling.
- [x] A kubeconfig with `auth-provider: name: azure` or `name: gcp` does not produce a "no auth provider found" log during connection probe.

---

## Gap 2 — Silent Insecure TLS Fallback

**Priority**: P0 — Security policy risk  
**File**: [pkg/app/kube_rest.go](pkg/app/kube_rest.go) lines 52–66

### Problem

When `probeRESTConfig` returns a cert error, `getRESTConfig` auto-degrades without user consent:

```go
// kube_rest.go ~line 52 — current behaviour
if isCertError(err) && !restConfig.TLSClientConfig.Insecure {
    restConfig.TLSClientConfig.Insecure = true
    restConfig.TLSClientConfig.CAData = nil
    restConfig.TLSClientConfig.CAFile = ""
    a.isInsecureConnection = true
    // ... re-probes silently
}
```

Enterprise concerns:
- Security scanners (Prisma Cloud, Wiz, Aqua) flag `InsecureSkipVerify=true` on outbound connections.
- Corporate TLS-inspection proxies use internal CAs — the correct fix is to add that CA, not bypass it.
- TKGI management plane and internal PKI CAs are the most common source; `applyCustomCA()` already solves this if users are guided to it.

The `isInsecureConnection` flag surfaces a warning badge in the frontend, but the degradation is automatic before the user sees anything.

### Implementation

1. **Add a new Wails-emitted event** `TLSCertError` carrying the cert error string and the cluster hostname.
2. **Remove the auto-degrade block** from `getRESTConfig`. Return a new sentinel error type `ErrTLSCertVerification` instead.
3. **In `ConnectToCluster`** (or wherever `getRESTConfig` is called at connection time): catch `ErrTLSCertVerification`, emit `TLSCertError` to the frontend, and return without completing the connection.
4. **Add `ConnectInsecure(context string) error`** — a separate Wails RPC that explicitly sets `a.allowInsecure = true` for the given context before calling `getRESTConfig` again. Frontend calls this only after user confirms the insecure-opt-in dialog.
5. **Frontend**: Show a modal on `TLSCertError` with:
   - Error details and server hostname.
   - "Add CA Certificate" button → opens the existing CA settings panel with the cluster hostname pre-filled.
   - "Connect Anyway (Insecure)" button → calls `ConnectInsecure`.
   - "Cancel" button.

```go
// Proposed sentinel type (pkg/app/kube_rest.go)
type ErrTLSCertVerification struct {
    Host string
    Err  error
}
func (e *ErrTLSCertVerification) Error() string { ... }
func (e *ErrTLSCertVerification) Unwrap() error { return e.Err }
```

### Tests Required

- `TestGetRESTConfig_CertErrorReturnsErrTLSCertVerification` — mock `probeRESTConfig` returning a cert error; assert `getRESTConfig` returns `*ErrTLSCertVerification`, not nil config.
- `TestGetRESTConfig_InsecureAllowedWhenFlagSet` — set `allowInsecure=true`; assert insecure fallback proceeds.
- Frontend: Vitest test for cert-error modal rendering on `TLSCertError` event.

### Acceptance Criteria

- [x] `getRESTConfig` never sets `TLSClientConfig.Insecure=true` without `allowInsecure` being explicitly set by the user.
- [x] Frontend shows modal with CA and insecure options on cert error; "Cancel" leaves app disconnected.
- [x] Existing insecure badge still shows when user has opted in.

---

## Gap 3 — TKGI / UAA / SSO Token Expiry UX

**Priority**: P0 — Affects all SSO/exec-provider auth  
**Files**: [pkg/app/kube_rest.go](pkg/app/kube_rest.go) — `isPermissionError()`, `isAuthDiscoveryRecoverableError()`

### Problem

`isPermissionError` groups `401 Unauthorized` and `403 Forbidden` together:

```go
// kube_rest.go — current
func isPermissionError(err error) bool {
    if apierrors.IsForbidden(err) || apierrors.IsUnauthorized(err) {
        return true
    }
    ...
}
```

- **403 Forbidden** = authenticated but RBAC-restricted → correct to tolerate silently.
- **401 Unauthorized** = not authenticated (expired/invalid token) → must surface as actionable error.

When a TKGI UAA token or OIDC token expires mid-session, every resource fetch returns 401. The user sees red error states on every panel with no "re-authenticate" guidance.

### Implementation

1. **Split `isPermissionError` into two helpers**:
   ```go
   // isRBACForbidden returns true for 403 — cluster reachable, RBAC restricted.
   func isRBACForbidden(err error) bool { return apierrors.IsForbidden(err) || ... }

   // isUnauthenticated returns true for 401 — token absent, expired, or invalid.
   func isUnauthenticated(err error) bool { return apierrors.IsUnauthorized(err) || ... }
   ```

2. **In `probeRESTConfig`**: if `isUnauthenticated(err)`, return a new `ErrAuthExpired` sentinel rather than returning the raw 401.

3. **In `getRESTConfig`**: catch `ErrAuthExpired` — emit `ConnectionAuthExpired` Wails event with context name and a suggested command (parsed from kubeconfig `exec:` stanza command field if present).

4. **In resource-fetch handlers** (deployments, pods, etc.): when an API call returns 401, call a shared `a.handleUnauthenticated(contextName)` that debounces and emits `SessionAuthExpired` to avoid flooding the frontend.

5. **Frontend**: show a sticky banner on `ConnectionAuthExpired` / `SessionAuthExpired`:
   > "Session expired for `<context>`. Re-run `tkgi get-credentials <cluster>` (or your credential provider) and reconnect."
   - "Reconnect" button → re-runs pre-connect hooks and calls `ConnectContext`.
   - Banner dismissible but re-appears on next 401.

### Tests Required

- `TestIsRBACForbidden` / `TestIsUnauthenticated` — verify correct classification for both structured and string-wrapped API errors.
- `TestProbeRESTConfig_401ReturnsErrAuthExpired` — mock clientset returning 401; assert sentinel.
- `TestGetRESTConfig_AuthExpiredEmitsEvent` — assert Wails runtime event is emitted.
- Frontend Vitest: sticky banner renders on `SessionAuthExpired` event.

### Acceptance Criteria

- [x] 403 responses never trigger reconnect prompts.
- [x] 401 during connect probe emits `ConnectionAuthExpired` event within 1 second.
- [x] 401 during live resource fetch debounces to one `SessionAuthExpired` event per 30-second window.
- [x] Reconnect button re-runs pre-connect hooks before re-initialising the client.

---

## Gap 4 — Single Kubeconfig File / No KUBECONFIG Env Var

**Priority**: P1 — Common multi-cluster enterprise pattern  
**Files**: [pkg/app/kubeconfig.go](pkg/app/kubeconfig.go), [pkg/app/kube_rest.go](pkg/app/kube_rest.go)

### Problem

`GetKubeConfigs()` already scans `~/.kube/` and discovers multiple kubeconfig files, but `getRESTConfig` still calls `clientcmd.LoadFromFile(configPath)` — a single-file load that ignores the `KUBECONFIG` env var and cannot merge contexts across files:

```go
// kube_rest.go — current single-file load
cfg, err := clientcmd.LoadFromFile(configPath)
```

Enterprise workstations commonly set:
```
KUBECONFIG=~/.kube/config:~/.kube/tkgi-prod:~/.kube/eks-clusters
```

Users who manage contexts this way see only the single "primary" kubeconfig in the app.

### Implementation

1. **Add `kubeconfigPaths []string` field to `App`** alongside the existing `kubeConfigPath string`. Persist in saved config as `kubeconfig_paths`.

2. **Replace `LoadFromFile` in `getRESTConfig`** with a merged load:
   ```go
   loadingRules := &clientcmd.ClientConfigLoadingRules{}
   if len(a.kubeconfigPaths) > 0 {
       loadingRules.Precedence = a.kubeconfigPaths
   } else {
       // Fall back to NewDefaultClientConfigLoadingRules which reads KUBECONFIG env var
       loadingRules = clientcmd.NewDefaultClientConfigLoadingRules()
   }
   cfg, err := loadingRules.Load()
   ```

3. **On app startup**: if `a.kubeconfigPaths` is empty, read the `KUBECONFIG` env var and pre-populate from it, **without saving** (so it stays dynamic on the next launch).

4. **In `GetKubeContexts`**: switch to the same merged load so the contexts list reflects all configured paths.

5. **Settings panel**: show an ordered list of kubeconfig paths with add/remove/reorder controls. "Detect from KUBECONFIG env" button populates from `os.Getenv("KUBECONFIG")`.

### Tests Required

- `TestGetRESTConfig_MergesMultipleKubeconfigPaths` — set `kubeconfigPaths` to two temp files with different contexts; assert both contexts resolvable.
- `TestGetRESTConfig_FallsBackToKUBECONFIGEnvVar` — set `KUBECONFIG` env var to two temp files; assert merged load.
- `TestGetKubeContexts_ReflectsMergedPaths`.

### Acceptance Criteria

- [x] Setting two kubeconfig paths surfaces contexts from both in the context selector.
- [x] If `KUBECONFIG` env var is set and no explicit paths are configured, all contexts from env var paths appear.
- [x] Removing a path from the list removes its contexts from the selector (no reconnect required, triggers a context list refresh).

---

## Gap 5 — Exec Credential Provider Binary Discovery on Windows

**Priority**: P1 — High frequency on Windows desktops  
**File**: [pkg/app/kube_rest.go](pkg/app/kube_rest.go) — `clientConfig.ClientConfig()` call and surrounding error handling

### Problem

When the app is launched from the Start menu or taskbar, it inherits a stripped `PATH` that excludes tools installed via terminal sessions (Chocolatey, Scoop, direct installer MSI). Auth works in the terminal (`kubectl` succeeds) but the app fails with a raw `exec: "kubelogin": executable file not found in $PATH` error buried in a generic auth failure.

Common affected tools: `kubelogin` (AKS), `tkgi`, `aws-iam-authenticator`, `aws eks get-token`, `gke-gcloud-auth-plugin`.

### Implementation

1. **Augment the Windows PATH at startup** (`app.go` `startup()` or `OnDomReady`):
   ```go
   // Windows only (build tag: //go:build windows)
   func supplementWindowsPath() {
       extra := []string{
           os.ExpandEnv(`%ProgramFiles%\kubelogin`),
           os.ExpandEnv(`%ProgramFiles(x86)%\kubelogin`),
           os.ExpandEnv(`%LOCALAPPDATA%\Microsoft\WindowsApps`),
           os.ExpandEnv(`%USERPROFILE%\.local\bin`),
           os.ExpandEnv(`%USERPROFILE%\bin`),
           filepath.Join(os.ExpandEnv(`%ProgramData%`), "chocolatey", "bin"),
           filepath.Join(os.ExpandEnv(`%USERPROFILE%`), "scoop", "shims"),
       }
       // Merge into os PATH, deduplicating
   }
   ```
   Use a `_windows.go` build-tagged file to keep this platform-specific.

2. **Parse exec-not-found errors**: when `clientConfig.ClientConfig()` or `getRESTConfig` returns an error matching `executable file not found` or `exec: "<name>":`, wrap it:
   ```go
   type ErrExecBinaryNotFound struct {
       Binary string
       Err    error
   }
   ```
   Emit a `ExecProviderNotFound` frontend event with the binary name.

3. **Frontend**: show an actionable notification: "Credential provider `kubelogin` not found in PATH. Install it or ensure it is in a standard location." with a link to the tool's install page.

4. **Upfront scan**: in `GetKubeContexts` (or a new `ValidateKubeconfig(path string)` RPC), parse all `exec:` stanzas and return a list of missing binaries alongside the contexts list. Frontend can warn before the user attempts to connect.

### Tests Required

- `TestSupplementWindowsPath_AddsMissingDirs` (Windows build tag) — verify known dirs are appended when absent.
- `TestGetRESTConfig_ExecBinaryMissingReturnsErrExecBinaryNotFound` — inject an error string matching `executable file not found`; assert sentinel type and correct binary name extraction.
- `TestValidateKubeconfig_DetectsMissingExecBinary`.

### Acceptance Criteria

- [x] App launched from Start menu can invoke `kubelogin`, `tkgi`, `aws-iam-authenticator`, `gke-gcloud-auth-plugin` when installed via Chocolatey, Scoop, or standard MSI locations.
- [x] "Binary not found" produces a notification with the binary name and an install link, not a generic auth failure.
- [x] Validated on Windows 11; PATH supplement is a no-op on Linux/macOS.

---

## Gap 6 — NTLM / Kerberos / Negotiate Proxy Authentication

**Priority**: P2 — Affects Windows AD environments with Zscaler/F5/Bluecoat proxies  
**File**: [pkg/app/proxy.go](pkg/app/proxy.go) — `SetProxyConfig`, `ProxyConfig`, `applyProxyConfig`

### Problem

Current proxy `authType` values: `"none"`, `"basic"`, `"system"`. `"system"` mode delegates to `http.ProxyFromEnvironment` which cannot perform NTLM challenge-response. Connections stall at `407 Proxy Authentication Required` with `Proxy-Authenticate: NTLM` and display a generic proxy error.

### Recommended Approach: Document + Local Auth Proxy Pattern

Full NTLM integration requires maintaining a multi-round-trip authentication handshake in the HTTP transport and carries a library dependency (`github.com/Azure/go-ntlmssp`). The simpler and more maintainable approach is to add a fourth proxy mode `"ntlm-local"` that guides users to a local authenticating proxy ([Px](https://github.com/genotrance/px) or [Cntlm](http://cntlm.sourceforge.net/)) that handles NTLM and exposes a plain HTTP proxy to the app.

### Implementation

1. **Add `"ntlm-local"` proxy auth type** to `SetProxyConfig` validation (alongside `none`, `basic`, `system`).
2. **In `applyProxyConfig`**: treat `"ntlm-local"` identically to `"basic"` at the transport level — the user provides the local Px/Cntlm address (`127.0.0.1:3128`) and no credentials.
3. **Settings UI**: when `"ntlm-local"` is selected, show an informational panel:
   - "Your corporate proxy requires NTLM or Kerberos authentication."
   - "Install Px or Cntlm locally. Point it at your corporate proxy. Enter its local address below."
   - Link to Px and Cntlm documentation.
   - Local proxy address field (default: `http://127.0.0.1:3128`).
4. **Detect 407 at connect time**: if `probeRESTConfig` returns a `407` response, emit a `ProxyAuthRequired` event with the proxy address so the frontend can suggest switching to `ntlm-local` mode.

### Tests Required

- `TestSetProxyConfig_AcceptsNtlmLocal` — assert no error for `authType="ntlm-local"`.
- `TestApplyProxyConfig_NtlmLocalBehavesLikeBasic`.
- `TestProbeRESTConfig_407EmitsProxyAuthRequiredEvent`.

### Acceptance Criteria

- [x] `"ntlm-local"` mode selectable in proxy settings with setup guidance visible.
- [x] `407` response during probe triggers a notification suggesting `ntlm-local` mode.
- [x] `SetProxyConfig` returns a validation error for unknown `authType` values (regression: this already works, keep it).

---

## Gap 7 — No Credential Refresh Signal During Live Session

**Priority**: P2 — Affects long-lived sessions with OIDC/exec-provider auth  
**Files**: [pkg/app/kube_rest.go](pkg/app/kube_rest.go), [pkg/app/hooks.go](pkg/app/hooks.go)

### Problem

Pre-connect hooks run once at `ConnectContext` time. When an OIDC or exec-provider token expires mid-session (typically 1–8 hours), every resource fetch starts returning 401. Gap 3 addresses the immediate 401 detection; this gap covers the proactive side — detecting expiry before the user encounters errors.

There is no:
- Background keep-alive / token-probe mechanism.
- Token TTL parsing to warn ahead of expiry.
- Re-auth trigger that re-runs hooks without a full disconnect.

### Implementation

1. **Background liveness probe** (opt-in, off by default): after a connection is established, start a goroutine that calls `/version` every N minutes (configurable, default 10, minimum 5). On 401, call `a.handleUnauthenticated(contextName)` (defined in Gap 3). Stop probe on disconnect.
   ```go
   // pkg/app/session_probe.go
   func (a *App) startSessionProbe(ctx context.Context, interval time.Duration) { ... }
   func (a *App) stopSessionProbe() { ... }
   ```

2. **Re-auth without disconnect**: add `RefreshCredentials(context string) error` Wails RPC that:
   - Re-runs any `pre-connect` hooks for the given context.
   - Calls `getRESTConfig` again to rebuild the client (picks up refreshed token from kubeconfig written by the hook).
   - Does **not** change namespace or reset UI state.

3. **Settings**: expose "Connection keep-alive interval (minutes)" setting; `0` disables the probe.

### Tests Required

- `TestStartSessionProbe_Emits401EventOnUnauthorized` — inject a clientset that returns 401; assert `SessionAuthExpired` event emitted after one probe tick.
- `TestRefreshCredentials_ReRunsPreConnectHooks` — verify hook execution and client re-initialisation.
- `TestStopSessionProbe_StopsOnDisconnect`.

### Acceptance Criteria

- [x] Background probe is disabled by default; users must opt in via settings.
- [x] With probe enabled, session expiry produces `SessionAuthExpired` banner before the user encounters API errors on resource panels.
- [x] `RefreshCredentials` reconnects without clearing namespace or selected resource.
- [x] Probe goroutine does not leak on disconnect (verified with `goleak` in tests).

---

## What Already Works Well (Preserve These)

| Strength | Location | Notes |
|---|---|---|
| Custom CA (PEM merge) | `pkg/app/kube_rest.go` — `applyCustomCA()` | Covers TKGI/internal PKI; do not remove merge logic |
| Pre/post-connect hooks | `pkg/app/hooks.go` | Used for `tkgi get-credentials` automation |
| OIDC exec provider | `pkg/app/k8s_auth_plugins.go` | Foundation of SSO; kubelogin/Dex/Keycloak work |
| `isAuthDiscoveryRecoverableError` | `pkg/app/kube_rest.go` | Prevents hard-fail on stale OIDC token at connect time |
| Multi-file kubeconfig discovery | `pkg/app/kubeconfig.go` — `GetKubeConfigs()` | Scans `~/.kube/`; Gap 4 extends this to the *load* path |
| Basic/system proxy | `pkg/app/proxy.go` | Handles most corporate HTTP proxy setups |
| Context switching | `pkg/app/kubeconfig.go` | Correct across multiple clusters |

---

## Priority Matrix

| Gap | Enterprise Scenario | Effort | Priority | New files / changed files |
|---|---|---|---|---|
| **G2** Silent insecure TLS fallback | Security audit; TKGI internal CAs | Medium | **P0** | `kube_rest.go`, new `tls_error.go`, frontend modal |
| **G3** 401 vs 403 + session expiry UX | TKGI/SSO token expiry mid-session | Medium | **P0** | `kube_rest.go`, new `session_auth.go`, frontend banner |
| **G1** Missing azure/gcp plugins | Legacy AKS / GKE kubeconfigs | Trivial | **P1** | `k8s_auth_plugins.go` (2 lines) |
| **G5** Exec binary PATH on Windows | TKGI, AKS, EKS on Windows desktops | Medium | **P1** | New `path_windows.go`, `kube_rest.go` error handling |
| **G4** Multi-kubeconfig / KUBECONFIG env | Multi-cluster enterprise workstations | Medium | **P1** | `kube_rest.go`, `kubeconfig.go`, settings UI |
| **G7** Mid-session credential refresh | All SSO/exec-provider auth, long sessions | Medium | **P2** | New `session_probe.go`, `kube_rest.go`, settings UI |
| **G6** NTLM proxy auth | Windows AD corporate proxy environments | Low–Medium | **P2** | `proxy.go` (new mode + 407 detection), settings UI |

---

## Sequence of Implementation

Implement in priority order. G2 and G3 are independent and can be done in parallel. G1 is a prerequisite warm-up. G5 and G4 are independent. G7 depends on G3 (re-uses `handleUnauthenticated`).

```
Sprint 1:  G1 (2 lines)  →  G3 (split 401/403, emit event, frontend banner)
Sprint 2:  G2 (TLS modal, remove auto-degrade)
Sprint 3:  G5 (Windows PATH supplement + exec-not-found error surfacing)
           G4 (multi-kubeconfig merge)
Sprint 4:  G7 (session probe + RefreshCredentials)
           G6 (ntlm-local mode + 407 detection)
```

---

## Out of Scope (Deliberate Non-Goals)

- **Kerberos/SPNEGO direct auth**: Kubernetes does not natively speak Kerberos. Handled via exec credential providers — no client change needed beyond Gap 5.
- **LDAP direct auth**: Identity-source concern handled at the cluster level (Dex, Keycloak). No client change needed.
- **In-cluster service account mode**: Desktop app; not intended to run inside a pod.
- **MFA/2FA UI**: Delegated to the exec credential provider (browser-based OIDC flow). Works today via subprocess launching.
