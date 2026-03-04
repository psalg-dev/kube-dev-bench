# Enterprise Kubernetes Authentication — Gap Analysis

Research phase document. Covers how the app currently connects to Kubernetes clusters and identifies gaps for enterprise environments (Kerberos, SSO, TKGI, NTLM proxies, etc.).

**Codebase snapshot**: client-go v0.35.2, Wails v2, Windows-primary desktop app.

---

## How the App Connects Today

The app delegates all authentication to the kubeconfig and client-go's plugin system — the correct architectural approach. Connection flow on each resource fetch:

```
getRESTConfig()
  └─ clientcmd.LoadFromFile(kubeConfigPath)        ← single file, no env var merge
  └─ NewNonInteractiveClientConfig(cfg, context)
  └─ clientConfig.ClientConfig()                   ← client-go resolves exec/token/cert auth
  └─ applyCustomCA(restConfig)                     ← appends custom CA PEM
  └─ applyProxyConfig(restConfig)                  ← none / basic / system proxy
  └─ probeRESTConfig(restConfig)                   ← /version + namespace list probe
       ├─ cert error   → auto-degrade to Insecure=true (no user consent)
       ├─ 403 Forbidden → tolerated (RBAC restricted but reachable)
       ├─ auth-provider error → tolerated (isAuthDiscoveryRecoverableError)
       └─ other error  → hard fail
```

### Currently Working

| Capability | Notes |
|---|---|
| Bearer token (kubeconfig) | Native client-go |
| Client certificate auth | Native client-go |
| Basic auth (kubeconfig) | Native client-go |
| OIDC via exec credential provider | `k8s_auth_plugins.go` imports the OIDC plugin |
| Custom CA certificate | PEM merge into `TLSClientConfig.CAData` |
| HTTP proxy — none / basic / system | `proxy.go` |
| Pre/post-connect hooks | Scripts run before connection; good extensibility |
| Context switching | `kubeconfig.go` |

---

## Gap 1 — Missing Legacy Auth Plugins (Trivial fix, medium coverage)

**File**: `pkg/app/k8s_auth_plugins.go`

Only the OIDC plugin is imported. client-go ships two additional built-in auth providers still present in many enterprise kubeconfigs:

```
k8s.io/client-go/plugin/pkg/client/auth/azure   ← AKS with legacy auth-provider stanza
k8s.io/client-go/plugin/pkg/client/auth/gcp     ← GKE with legacy auth-provider stanza
```

These are deprecated in favour of `exec:` credential plugins, but large enterprises often run older control plane versions or have kubeconfigs with the old `auth-provider:` stanza. Without these imports, the app silently fails to authenticate — no actionable error.

**Fix**: Add blank imports for `azure` and `gcp` in `k8s_auth_plugins.go`. Two lines of code.

---

## Gap 2 — Silent Insecure TLS Fallback (Security policy risk)

**File**: `pkg/app/kube_rest.go:52–66`

When a certificate verification error occurs during `probeRESTConfig`, the app automatically degrades the connection to `InsecureSkipVerify=true` and clears all CA data — **without any user consent or warning in the UI**:

```go
restConfig.TLSClientConfig.Insecure = true
restConfig.TLSClientConfig.CAData = nil
restConfig.TLSClientConfig.CAFile = ""
a.isInsecureConnection = true
```

Enterprise concerns:
- Security scanning tools (Prisma Cloud, Wiz, Aqua) flag `InsecureSkipVerify=true` in outbound connections.
- Corporate TLS-inspection proxies use internal CAs — the correct response is to add that CA, not skip verification.
- TKGI management plane certificates and internal PKI CAs are the most common source of cert errors; the existing custom CA feature already solves this if users are guided to it.
- Zero-trust / mTLS policies in some environments require mutual TLS and will reject connections that skip server verification.

The `isInsecureConnection` flag is exposed to the frontend (shows a warning badge), but the degradation itself is silent and automatic.

**Fix**: Surface the TLS error to the user as a modal/dialog explaining the cert problem, with two options:
1. Add the server's CA certificate (links to the CA settings panel)
2. Explicitly opt-in to insecure mode (requires user action, not auto-degraded)

Do not auto-degrade. Keep the insecure fallback available but require explicit user consent.

---

## Gap 3 — TKGI / UAA / SSO Token Expiry UX (Partial fix in place, UX gap remains)

**Files**: `pkg/app/kube_rest.go` — `isPermissionError`, `isAuthDiscoveryRecoverableError`

### How TKGI Works

1. User runs `tkgi get-credentials <cluster>` → writes kubeconfig with a short-lived UAA bearer token (expires in 1–10 hours depending on UAA config).
2. Token expires → API returns `401 Unauthorized`.
3. User must re-run `tkgi get-credentials` to refresh.

### Current State

`isAuthDiscoveryRecoverableError` (recently added) catches auth-provider/OIDC errors during the connection probe and allows the app to proceed rather than hard-fail. This prevents the jarring "connection refused" behaviour when an OIDC exec provider returns a stale token.

However, the 401 vs 403 distinction in `isPermissionError` still groups both:

```go
if apierrors.IsForbidden(err) || apierrors.IsUnauthorized(err) {
    return true
}
```

- `403 Forbidden` = authenticated, not permitted (RBAC) — correct to tolerate
- `401 Unauthorized` = not authenticated (expired/invalid token) — should surface as actionable error

When a TKGI token expires mid-session, every resource fetch fails with 401. The user sees red error states on every panel but no indication that their session has expired and they need to re-run `tkgi get-credentials`.

### Fix

1. **Split `isPermissionError`**: Treat `401 Unauthorized` separately from `403 Forbidden`. Only tolerate 403 silently.
2. **Emit a frontend event on persistent 401**: When a resource fetch or the connection probe returns 401, emit a `ConnectionAuthExpired` event with a message like: "Authentication expired for context `<name>`. Re-run your credential provider (e.g. `tkgi get-credentials <cluster>`) and reconnect."
3. **Show a reconnect prompt** in the UI that re-runs pre-connect hooks and re-initialises the kubeconfig (covering automated refresh via hooks).

---

## Gap 4 — Single Kubeconfig File / No KUBECONFIG Env Var (Common enterprise pattern)

**File**: `pkg/app/kubeconfig.go`, `pkg/app/kube_rest.go`

The app stores and uses a single kubeconfig path. Enterprise workstations commonly aggregate multiple kubeconfig files:

```bash
export KUBECONFIG=~/.kube/config:~/.kube/tkgi-prod:~/.kube/eks-clusters:~/.kube/aks-dev
```

`clientcmd.LoadFromFile(path)` reads one file. The `KUBECONFIG` environment variable is not consulted. Users who manage multi-cluster access via merged kubeconfigs cannot see all their contexts.

client-go provides the right primitives:
```go
// Respects KUBECONFIG env var and merges multiple files
loadingRules := clientcmd.NewDefaultClientConfigLoadingRules()
```

**Fix**:
1. In settings, allow the user to specify multiple kubeconfig paths (as a list).
2. Use `clientcmd.LoadingRules` with `Precedence` set to the list, falling back to `NewDefaultClientConfigLoadingRules()` (which picks up `KUBECONFIG` env var) if no path is explicitly set.
3. On startup, if `KUBECONFIG` env var is set, pre-populate the list from it.

---

## Gap 5 — Exec Credential Provider Binary Discovery on Windows (High impact on Windows)

**File**: `pkg/app/kube_rest.go` — `clientConfig.ClientConfig()` → exec provider invocation

Modern enterprise auth relies on executables being in `PATH`:
- `kubelogin` — Azure AD / OIDC for AKS
- `tkgi` — TKGI UAA credentials
- `aws-iam-authenticator` / `aws eks get-token` — EKS
- `gke-gcloud-auth-plugin` — GKE post-deprecation
- Custom kubectl credential plugins

**The Windows problem**: When the app is launched from the Start menu, taskbar, or Windows Explorer, it inherits a different `PATH` than the terminal session where the user installed these tools. On Windows, installers often add to the user's `PATH` via registry entries that are picked up by new terminal sessions but not by already-running GUI processes.

Result: auth works when the user tests `kubectl` in a terminal, but the app fails with a generic `exec: <binary>: executable file not found in $PATH` error that gets wrapped into an opaque auth failure.

**Fix**:
1. When `clientConfig.ClientConfig()` returns an error referencing exec failure, parse the error to detect "executable not found" and surface the binary name with a diagnostic message.
2. On Windows, supplement the PATH search with common installation directories: `%ProgramFiles%`, `%ProgramFiles(x86)%`, `%LOCALAPPDATA%\Microsoft\WindowsApps`, `%USERPROFILE%\.local\bin`, common Chocolatey/Scoop paths.
3. Optionally: scan kubeconfig `exec:` stanzas on load and warn upfront if the referenced binary is not resolvable.

---

## Gap 6 — NTLM / Kerberos / Negotiate Proxy Authentication (Windows AD environments)

**File**: `pkg/app/proxy.go`

Proxy modes supported: `none`, `basic`, `system`.

`system` proxy mode uses Go's `http.ProxyFromEnvironment`, which reads `HTTPS_PROXY` / `HTTP_PROXY` environment variables or Windows system proxy settings. It does **not** handle NTLM authentication challenge-response.

In Windows Active Directory environments, corporate HTTP proxies (Zscaler, F5 Access Policy Manager, Bluecoat, McAfee Web Gateway) commonly require:
- **NTLM** authentication (challenge-response using Windows domain credentials)
- **Kerberos/Negotiate** authentication (Kerberos ticket exchange)

The connection stalls at `407 Proxy Authentication Required` with `Proxy-Authenticate: NTLM` and the app shows a generic proxy connection error.

**Options**:
1. **Recommend local authenticating proxy** (low effort, user-side): Document that users can run [Px](https://github.com/genotrance/px) or [Cntlm](http://cntlm.sourceforge.net/) locally — these handle NTLM authentication and expose a simple Basic-auth proxy that the app can use. This is the pragmatic approach.
2. **Integrate NTLM library** (high effort): Use `github.com/Azure/go-ntlmssp` or `golang.org/x/net/http/httpproxy` extensions for NTLM proxy auth. Requires maintaining the NTLM handshake within the HTTP transport layer.

**Fix (recommended)**: Document Option 1 in the connection settings UI. Add a fourth proxy mode `ntlm` that acts as a pointer to the local-proxy pattern with setup instructions.

---

## Gap 7 — No Credential Refresh / Re-auth Signal During Live Session

**Files**: `pkg/app/kube_rest.go`, `pkg/app/hooks.go`

Pre-connect hooks run once at connection time. There is no recurring or event-driven mechanism for:
- Detecting that an exec credential provider needs to be re-invoked (e.g. OIDC token TTL expired mid-session)
- Notifying the user that their credentials have expired while using the app
- Triggering re-authentication without a full disconnect/reconnect cycle

When credentials expire mid-session, every API call fails. The user sees per-resource error states with no overarching "your session has expired" indicator.

**Fix**:
1. Intercept `401 Unauthorized` responses from the Kubernetes API client at the transport level (or in resource-fetch error handling paths).
2. Debounce: if N 401 errors occur within a short window, emit a `SessionExpired` frontend event.
3. UI shows a sticky banner: "Session expired for `<context>`. Reconnect to refresh credentials." Reconnect button re-runs pre-connect hooks and re-initialises the client.
4. Consider a background token probe (lightweight `/version` call on a timer) for proactive expiry detection — though this needs to be configurable to avoid unnecessary traffic.

---

## What Already Works Well for Enterprise

These are strengths to preserve:

- **Custom CA certificate support** — covers TKGI management plane CAs, internal PKI, self-signed cluster certs. The PEM-merge approach is correct.
- **Pre-connect hooks** — power users can wrap `tkgi get-credentials`, `az aks get-credentials`, `aws eks update-kubeconfig` as pre-connect scripts for automated token refresh before the app connects.
- **OIDC exec provider (client-go)** — the foundation of modern SSO integration is in place. kubelogin, Dex, Keycloak all work via the kubeconfig `exec:` stanza.
- **isAuthDiscoveryRecoverableError** — recently added; prevents hard-fail when auth-provider/OIDC errors are detected during the connection probe, allowing namespace-scoped fallback.
- **Basic/system proxy** — covers many standard corporate proxy setups.
- **Context switching** — works correctly across multiple clusters.

---

## Priority Matrix

| Gap | Enterprise Scenario | Effort | Priority |
|---|---|---|---|
| **G2** Silent insecure TLS fallback | Security audit finding; TKGI internal CAs | Medium | **P0** |
| **G3** 401 vs 403 + session expiry UX | TKGI/SSO token expiry mid-session | Medium | **P0** |
| **G1** Missing azure/gcp plugins | Legacy AKS / GKE kubeconfigs | Trivial | **P1** |
| **G5** Exec binary PATH on Windows | TKGI, AKS, EKS on Windows desktops | Medium | **P1** |
| **G4** Multi-kubeconfig / KUBECONFIG env | Multi-cluster enterprise workstations | Medium | **P1** |
| **G7** Mid-session credential refresh signal | All SSO/exec-provider auth, long sessions | Medium | **P2** |
| **G6** NTLM proxy auth | Windows AD corporate proxy environments | High | **P2** |

---

## Out of Scope (Deliberate Non-Goals)

- **Kerberos/SPNEGO direct auth**: Kubernetes API server does not natively speak Kerberos. Enterprise Kerberos auth is implemented via exec credential providers or reverse proxies — not in the client. No app-level change needed beyond ensuring exec providers work (Gap 5).
- **LDAP direct auth**: LDAP is an identity source, not a Kubernetes auth protocol. Handled at the cluster level (via Dex, Keycloak, or static token/OIDC federation). No client-side change needed.
- **In-cluster service account mode**: Desktop app; not intended to run inside a pod.
- **MFA/2FA UI**: Handled by the exec credential provider (browser-based OIDC flow). The app already launches subprocesses which can open a browser.
