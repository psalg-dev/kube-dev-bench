# KubeDevBench — Enterprise Readiness Review

**Date:** March 5, 2026  
**Reviewer:** AI Code Review (Claude Sonnet 4.6)  
**Scope:** Full codebase audit — security, concurrency, resource management, K8s compatibility, enterprise gaps

---

## Executive Summary

KubeDevBench has made substantial progress on enterprise concerns through a series of targeted "gap" fixes (TLS cert consent, 401/403 distinction, TKGI PATH augmentation, multi-kubeconfig merge, exec-binary detection). The foundation is solid and the code is generally idiomatic. However, **several critical issues remain that would block regulated or large-enterprise deployment**, primarily around credential storage at rest, cluster resource hygiene, and API rate governance. The app is production-ready for personal and small-team use, but needs the issues below addressed before it can be confidently promoted in locked-down or audited environments.

---

## Enterprise Readiness Scorecard

| Dimension | Score | Status |
|---|---|---|
| Authentication Coverage | 7/10 | Most common providers handled; gaps noted |
| Secret Hygiene | 4/10 | **Critical** – credentials stored in plaintext |
| API Resource Efficiency | 6/10 | QPS capped; polling gaps remain |
| Concurrency Safety | 7/10 | Good mutex discipline; two global races |
| Kubernetes Version Compatibility | 6/10 | Tested against 1.35; no explicit compat matrix |
| Observability / Audit Trail | 3/10 | **Gap** – no audit log, no structured event trail |
| Resilience & Graceful Degradation | 7/10 | Good error surfaces; context.Background() leaks |
| Network Environment Compatibility | 8/10 | Proxy, CA, exec-binary discovery all present |
| Cluster Resource Footprint | 5/10 | PVC helper pods not cleaned up on crash |
| Enterprise Security Controls | 5/10 | TLS consent is good; at-rest encryption absent |

**Overall: Not yet enterprise-grade.** 4–5 blocking issues need to be resolved.

---

## 🔴 CRITICAL Issues (Block enterprise deployment)

---

### CRIT-1 — Credentials stored in plaintext JSON on disk

**File:** [pkg/app/config.go](pkg/app/config.go)

`AppConfig` persists `ProxyPassword` and `HolmesConfig.APIKey` to `~/.KubeDevBench/config.json` as plain JSON text:

```go
ProxyPassword string `json:"proxyPassword"`
// ...
HolmesConfig: holmesConfig,  // contains APIKey field
```

**Impact:** Any OS process or user with read access to the home directory can exfiltrate proxy credentials and the Holmes AI API key. Windows filesystem ACLs on `%APPDATA%` are user-scoped, but the file is world-readable within that user's session and accessible to any process running as the same user (malware, IDE extensions, terminal history tools).

**Expected:** Either encrypt at rest using the OS keychain (Windows Credential Manager via `golang.org/x/sys/windows/registry` or `git-credential-manager` pattern), or at minimum store only the Holmes API key in the OS keychain and remove ProxyPassword from the JSON entirely.

---

### CRIT-2 — `holmesConfig` is an unprotected package-level global

**File:** [pkg/app/holmes_integration.go](pkg/app/holmes_integration.go)

```go
var holmesConfig = holmesgpt.DefaultConfig()
```

Written in `loadConfig()` (called from the main goroutine at startup) and read in every Holmes analysis call. `loadConfig` is called without holding any mutex that would protect concurrent Holmes callers:

```go
// config.go – loadConfig writes
holmesConfig = config.HolmesConfig

// holmes_integration.go – concurrent reads
if !holmesConfig.IsConfigured() { ... }
```

**Impact:** Data race: concurrent read of `holmesConfig.APIKey` and write during `loadConfig` or `SaveHolmesConfig`. The Go race detector will fire during any load+analysis overlap. In a long-running session this is a real risk when the user saves Holmes settings while an analysis is still streaming.

**Expected:** Move `holmesConfig` into the `App` struct, protected by a dedicated RWMutex or the existing `kubeContextMu`.

---

### CRIT-3 — PVC browse helper pods are never cleaned up on crash

**File:** [pkg/app/pvc_files.go](pkg/app/pvc_files.go) (lines 354–400)

When no existing pod mounts a PVC, the app creates a helper pod (`ensurePVCBrowseHelper`) in the cluster. **There is no cleanup registration for these pods.** Swarm helper containers have `cleanupSwarmVolumeHelpers` called in `Shutdown()`, but the equivalent K8s side has no counterpart:

```go
// app_lifecycle.go – Shutdown
a.cleanupSwarmVolumeHelpers(...)  // Docker Swarm cleaned up ✔
// K8s PVC helper pods: no cleanup ✗
```

**Impact:** Every invocation of the PVC files browser that triggers helper-pod creation will leave a running pod in the customer's namespace after a crash or forced quit. Accumulation over time silently consumes cluster resources. In CIS-hardmarked clusters that enforce pod counts this will cause quota exhaustion.

**Expected:** Register created helper pods in `App` (like `swarmVolumeHelpers`) and call the equivalent K8s cleanup in `Shutdown()`.

---

### CRIT-4 — `allowInsecure` flag persists to disk and has no context scope

**File:** [pkg/app/config.go](pkg/app/config.go), [pkg/app/kube_rest.go](pkg/app/kube_rest.go)

Once the user clicks "Connect insecurely", `allowInsecure: true` is written to config and stays permanently until the next change. The field is not scoped to a specific context — it applies globally:

```go
AllowInsecure bool `json:"allowInsecure,omitempty"`
// ...
a.allowInsecure = config.AllowInsecure  // global, not per-context
```

**Impact:** A user might accept an insecure connection on a dev cluster (self-signed cert) and then accidentally connect to production with TLS disabled. Enterprise security teams explicitly prohibit any TLS bypass.

**Expected:** Make `allowInsecure` a `map[string]bool` keyed by context name. Only disable TLS verification for the specific context where the user opted in.

---

## 🟡 IMPORTANT Issues (Significant enterprise concerns)

---

### IMP-1 — `context.Background()` in production Helm operations ignores app shutdown

**File:** [pkg/app/helm.go](pkg/app/helm.go) (lines 413, 474)

```go
ctx := context.Background()  // ignores a.ctx
```

Used in Helm upgrade/install/uninstall operations. When the user closes the app mid-operation, the Helm action continues running in an orphaned goroutine attached to `context.Background()`. This can corrupt Helm release state or leave the cluster in an inconsistent state.

**Expected:** Replace `context.Background()` with `a.ctx` (or a child) so operations respect app shutdown signals.

---

### IMP-2 — `probeRESTConfig` and session probe create rate-unlimited clients

**Files:** [pkg/app/kube_rest.go](pkg/app/kube_rest.go), [pkg/app/session_probe.go](pkg/app/session_probe.go)

The main `getKubernetesClient()` applies QPS=50, Burst=100. However, `probeRESTConfig` and `probeSessionLiveness` each call `kubernetes.NewForConfig(rc)` directly on the raw unmodified config, bypassing rate limiting:

```go
// kube_rest.go – probeRESTConfig
cs, err := kubernetes.NewForConfig(rc)  // no QPS override ✗

// session_probe.go – probeSessionLiveness  
cs, err := kubernetes.NewForConfig(rc)  // no QPS override ✗
```

On slow or flaky clusters this matters less, but in environments with API server admission rate controllers (common in hardened GKE/AKS/EKS), unthrottled probes can trigger 429s and cause unexpected connection failures.

**Expected:** Apply the same QPS/Burst defaults before creating probe clients, or extract a shared helper `newRateLimitedClient(rc)`.

---

### IMP-3 — No pagination in list operations

**Files:** All resource getters (`pods.go`, `deployments.go`, `services.go`, etc.)

All `List()` calls use `metav1.ListOptions{}` with no `Limit` field. In namespaces with thousands of pods, secrets, or config maps:

- The API server must serialize the entire result set into one response
- The Go process allocates the full list in memory
- Informer snapshots serialize the entire namespace scope on every update

**Impact:** On large enterprise namespaces (1k+ pods, 500+ secrets for service mesh workloads), each poll can allocate tens of MB. This is especially acute for secrets and config maps, which can have large `.data` payloads.

**Expected:** Add `Limit: 500` (or similar configurable value) with continuation-token support for list operations. Informer snapshots are safe (pulled from local cache), but direct list calls in the polling fallback path should be paginated.

---

### IMP-4 — `GetSecretData` returns full secret values to the frontend with no size cap

**File:** [pkg/app/secrets.go](pkg/app/secrets.go)

```go
out[k] = base64.StdEncoding.EncodeToString(v)
```

Every byte in every secret key is en-base64'd and returned to the frontend. Enterprise secrets (TLS certificates, kubeconfig bundles, SSH keys) can be hundreds of kilobytes each. There is also no masking of well-known keys like `.dockerconfigjson` or JWT tokens.

**Expected:** Cap individual key value size at 64 KiB and surface a "truncated" indicator. Optionally mask values for keys named `password`, `token`, `api-key`, etc. unless the user explicitly requests reveal.

---

### IMP-5 — Hooks execute arbitrary scripts without path safety checks

**File:** [pkg/app/hooks.go](pkg/app/hooks.go)

```go
func executeHook(hook HookConfig, env map[string]string) (HookExecutionResult, error) {
    // ScriptPath from config is passed directly to exec.Command
```

The `ScriptPath` is loaded from the hooks config JSON file. There is no validation that the path:
- Is within an expected directory
- Has not been modified since it was saved
- Does not point to a symlink targeting a sensitive binary

In a shared Windows machine, since `~/.KubeDevBench/hooks-config.json` is readable, this becomes a local privilege escalation vector if malware writes a hook config update.

**Expected:** Validate that `ScriptPath` resolves to a real file under the user's home directory (or an explicit allow-list of dirs), check file permissions before execution, and optionally show a hash-based integrity warning if the script has changed since it was last approved.

---

### IMP-6 — Monitor polling runs `time.After()` instead of a ticker

**File:** [pkg/app/monitor.go](pkg/app/monitor.go)

```go
case <-time.After(5 * time.Second):
```

`time.After` allocates a new channel and timer object on every iteration. Over days of continuous use, this generates unnecessary GC pressure. The outer `select` also has no backpressure — if `collectMonitorInfo` takes longer than 5 seconds (likely in a large cluster with many namespaces), calls will queue up, potentially causing concurrent list operations.

**Expected:** Replace with `time.NewTicker(5 * time.Second)` and call `defer ticker.Stop()`. Add a guard to skip the iteration if a previous one is still in progress.

---

### IMP-7 — No explicit Kubernetes version compatibility matrix

The app uses `k8s.io/client-go v0.35.2` which corresponds to Kubernetes 1.35. Enterprise clusters vary widely. Specific concerns:

- **Batch/v1 CronJobs** — requires K8s 1.21+ (safe for most)
- **NetworkingV1 Ingresses** — requires K8s 1.19+ (safe for most)
- **metrics.k8s.io/v1beta1** (TopPods/TopNodes) — requires metrics-server addon; absent in many on-prem environments, causing silent `TopPods` failures
- **`apiextensions.k8s.io/v1`** CRD client — requires K8s 1.16+ (safe for most)
- **SPDY-based exec/portforward** — `k8s.io/client-go` has been migrating from SPDY to WebSocket; clusters running behind strict HTTP proxies may block SPDY upgrade

**Missing detection:** The app tries metrics and falls through to an error, but there is no proactive feature detection at connect time that warns users which features will be unavailable.

**Expected:** Add a version probe at connect time that detects K8s server version and conditionally disables metrics tabs (rather than showing errors). Document the supported version range (e.g., K8s 1.21–1.35).

---

### IMP-8 — Auth plugin registry is incomplete

**File:** [pkg/app/k8s_auth_plugins.go](pkg/app/k8s_auth_plugins.go)

```go
import (
    _ "k8s.io/client-go/plugin/pkg/client/auth/azure"
    _ "k8s.io/client-go/plugin/pkg/client/auth/gcp"
    _ "k8s.io/client-go/plugin/pkg/client/auth/oidc"
)
```

Notable absences:
- **`client-go/plugin/pkg/client/auth`** `openstack` — used in some on-prem OpenStack Kubernetes distributions
- **client certificate rotation** — `client-go` supports auto-rotation via the `CertificateAuthorityData` watch, but there's no logic to refresh the cached clientset when the cert is rotated
- **SPIRE/SPIFFE workload API auth** — increasingly common in zero-trust enterprise networks

The exec-credential path (kubelogin, aws-iam-authenticator, tkgi, etc.) handles most real cases, but the in-process auth plugins for Azure and GCP are the deprecated "auth-provider" stanzas, not the modern exec-plugin approach. A user with a kubeconfig that uses `exec:` mode for AKS will be fine, but one with the legacy `auth-provider: azure` stanza (from old `az aks get-credentials` outputs) may hit issues as those plugins are removed.

---

### IMP-9 — Swarm volume helper uses `debian:bookworm-slim` (not air-gap friendly)

**File:** [pkg/app/swarm_volume_helpers.go](pkg/app/swarm_volume_helpers.go)

```go
const swarmVolumeHelperImage = "debian:bookworm-slim"
```

Air-gapped enterprise environments that run a private Docker registry will fail image pulls. There is no `imagePullPolicy` configuration option and no ability to specify a private registry mirror.

**Expected:** Make the helper image configurable via settings (defaulting to `debian:bookworm-slim`), and surface a clear error message when the pull fails rather than a generic timeout.

---

## 🟢 SUGGESTIONS (Non-blocking improvements)

---

### SUG-1 — Missing audit log

There is no audit trail for destructive operations (delete, scale, restart, rollback, exec into pod). In SOC2/PCI-DSS environments, evidence of "who did what to which resource and when" is required.

**Expected:** Write append-only structured log entries to `~/.KubeDevBench/audit.jsonl` for all mutating operations including: timestamp, action, resource kind/namespace/name, outcome, user principal from kubeconfig.

---

### SUG-2 — No configurable namespace resource quotas for informers

With `useInformers = true`, the informer manager subscribes per-namespace factories for every namespace in `preferredNamespaces`. A user who selects 20+ namespaces will spin up 20 SharedInformerFactories, each maintaining watch connections and in-memory caches:

```go
for _, ns := range im.namespaces {
    im.nsFactories[ns] = informers.NewSharedInformerFactoryWithOptions(...)
}
```

**Impact:** 20 namespaces × 14 informer types = 280 active Watch connections. On large clusters this will visibly increase API server load.

**Expected:** Cap the number of informer-watched namespaces at 5 (configurable). Beyond that, gracefully fall back to polling. Surface a warning in the UI: "Informer mode is active for 5 namespaces; {N} are using polling."

---

### SUG-3 — `shellSessions` is unbounded

**File:** [pkg/app/pods.go](pkg/app/pods.go)

```go
var shellSessions sync.Map // sessionID -> *ShellSession
```

Shell sessions are stored globally and removed on explicit close or session exit. However, if the frontend disconnects without calling `StopShellSession` (e.g., browser tab closed, Wails crash), the goroutine and PTY remain open indefinitely.

**Expected:** Add a reaper goroutine that checks session activity timestamps and kills sessions inactive for >10 minutes. Also enforce a max-sessions limit (e.g., 10) to prevent resource exhaustion.

---

### SUG-4 — `GetHelmReleases` is not namespace-aware from informer cache

Helm releases are fetched via the Helm SDK (`action.NewList`) on every poll interval. Unlike K8s resources, there is no informer path. This means Helm polls always go to the API server, ignoring the `useInformers` setting.

**Expected:** Document this explicitly in the UI, or implement a lightweight Helm reconciler that watches the `Secrets` informer (Helm stores release metadata as `helm.sh/release.v1` secrets) to avoid redundant API calls.

---

### SUG-5 — `graphCache` has no eviction bounds

**File:** [pkg/app/graph.go](pkg/app/graph.go)

```go
a.graphCache.Store(key, graphCacheEntry{...})
```

The graph cache uses `sync.Map` with 8-second TTL entries. Stale entries are only evicted on the next `getCachedGraph` call for the same key. In long-running sessions with many different namespaces and resource kinds explored, the map grows without bound.

**Expected:** Add a periodic sweep goroutine (running every 60s) that calls `graphCache.Range` and deletes expired entries.

---

### SUG-6 — No support for ServiceMesh resources or Gateway API

Enterprise clusters running Istio, Linkerd, or Cilium will have significant operational resources (VirtualServices, DestinationRules, HTTPRoutes) that are invisible in the current UI. The `GetCustomResourceDefinitions` function lists all CRDs but there is no first-class support for viewing CR instances.

**Expected:** Add a "Custom Resources" browser that, given a selected CRD, can list and display instances via the dynamic client (`k8s.io/client-go/dynamic`). This would cover ServiceMesh, Gateway API, and any other CRD without requiring dedicated resource handlers.

---

### SUG-7 — No rate limit or size cap on log streaming buffers

**File:** [pkg/app/logs.go](pkg/app/logs.go)

Log lines are emitted one-by-one via Wails events to the frontend. For pods that generate thousands of lines per second (high-throughput services, crash-looping pods), the Wails event bus will be saturated. There is no back-pressure, line-rate cap, or ring-buffer.

**Expected:** Add a sliding-window rate limiter (e.g., max 200 lines/s per stream) and a frontend-side hard ring-buffer limit (e.g., last 10,000 lines).

---

### SUG-8 — Helm operations lack timeout configuration

**File:** [pkg/app/helm.go](pkg/app/helm.go)

Helm install/upgrade/rollback operations use default Helm timeouts (unlimited unless set). Long-running chart deployments with hooks can block the UI for many minutes with no way to cancel.

**Expected:** Expose a configurable timeout in settings (default: 5 minutes). Pass a `context.WithTimeout(a.ctx, installTimeout)` to all Helm action runners.

---

### SUG-9 — The `insecureWarnOnce` is not reset between context changes

**File:** [pkg/app/app_lifecycle.go](pkg/app/app_lifecycle.go)

```go
insecureWarnOnce sync.Once
```

`sync.Once` cannot be reset. If the user connects insecurely once, the warning log entry "using insecure mode" fires exactly once globally, even if they switch contexts multiple times. This means the log will silently omit the warning for subsequent insecure connections.

**Expected:** Replace `sync.Once` with a per-context flag or a simple boolean + mutex.

---

## Missing Enterprise Features (Roadmap items)

The following are absent and expected in regulated/large-enterprise environments. They are not bugs but represent feature gaps:

| Feature | Notes |
|---|---|
| **In-app role separation** | No concept of read-only vs read-write app-level roles for shared workstations |
| **Client certificate rotation** | No detection or prompt when a client cert in kubeconfig expires |
| **Private Helm repo authentication** | Cannot add Helm repos with Basic/Token auth from the UI |
| **NTLM full support** | Code emits a "proxy requires NTLM" error but cannot authenticate to NTLM proxies; only Basic auth is wired |
| **SSO/OIDC token refresh** | Token refresh is triggered by re-running the exec plugin, but there is no proactive pre-expiry refresh |
| **Namespace topology view for large tenants** | Topology graph is limited by `MaxDepth`; multi-tenant clusters with hundreds of namespaces have no aggregate view |
| **Compliance snapshot export** | No way to export current cluster state (namespaces, RBAC, workloads) as a compliance evidence artifact |
| **Secret reveal confirmation** | Viewing secret values doesn't require a confirmation step or re-auth |

---

## Positive Findings

The following enterprise concerns have been **correctly addressed** and deserve recognition:

- ✅ **TLS cert error → explicit user consent** rather than silent auto-downgrade (`kube_rest.go`)
- ✅ **401 vs 403 correctly distinguished** — RBAC 403 allows connection, 401 blocks it and notifies user
- ✅ **TKGI and AWS CLI paths** added to Windows PATH augmentation (`path_windows.go`)
- ✅ **Multi-kubeconfig merge** via KUBECONFIG env var and explicit path list (`kube_rest.go`)
- ✅ **Exec-binary detection** with friendly error event when kubelogin/tkgi not in PATH
- ✅ **QPS=50, Burst=100** applied to the cached Kubernetes clientset
- ✅ **Custom CA certificate injection** that merges with existing kubeconfig CAs
- ✅ **Auth expiry debounce** (30s) prevents event flood on token expiry
- ✅ **Session probe** background liveness check with opt-in configuration
- ✅ **Proxy configuration** with Basic, System, and NTLM-local modes
- ✅ **kubeContextMu RWMutex** protecting `currentKubeContext` reads/writes
- ✅ **Logger fsync-per-write** ensuring durability on Windows GUI subsystem
- ✅ **Swarm helper container cleanup** on app shutdown
- ✅ **Graph cache TTL** (8s) with per-key expiration
- ✅ **Informer error handler** emitting `k8s:informer:error` events to the frontend
- ✅ **Ingress TLS expiry** check surfaced in the UI

---

## Recommended Priority Order

1. **CRIT-2** — Fix `holmesConfig` race (highest risk: data corruption in active sessions)
2. **CRIT-3** — PVC helper pod cleanup (cluster resource leak, quota risk)
3. **CRIT-4** — Scope `allowInsecure` per-context (security regression risk)
4. **CRIT-1** — Credential encryption at rest (compliance blocker)
5. **IMP-1** — Fix `context.Background()` in Helm (state corruption risk)
6. **IMP-2** — Apply rate limiting to probe clients
7. **IMP-3** — Pagination for list operations
8. **IMP-7** — K8s version compat detection + documentation
9. **IMP-5** — Hook script path validation
10. **IMP-4** — Cap secret value size in `GetSecretData`

---

*This review was generated via deep static analysis of the codebase. It does not include dynamic runtime testing, penetration testing, or cluster load testing. Those should be conducted separately before enterprise GA.*
