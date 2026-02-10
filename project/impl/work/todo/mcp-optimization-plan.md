# MCP Server Optimization & Frontend UI Plan

**Created:** 2026-02-10  
**Status:** Not Started  
**Depends on:** Backend MCP implementation (complete)  
**Blocked by:** None  

---

## Problem Statement

The MCP server backend is fully implemented with 59 tools, but has three critical issues that limit real-world usefulness:

1. **Context churn from tool count** — 59 tools produce a massive `tools/list` payload (~8KB+ of JSON schema). Every MCP conversation starts by loading all tool definitions into the AI's context window, wasting thousands of tokens before any actual work begins.

2. **Unbounded response sizes** — All list tools are pass-through to App methods with no filtering, pagination, or summarization. A namespace with 200 pods returns every pod's full detail struct in pretty-printed JSON. A single `k8s_list_pods` call can consume 50KB+ of context.

3. **Non-standard transport** — The server uses a custom HTTP/JSON-RPC 2.0 implementation (no MCP SDK). No SSE, no stdio transport. Claude Desktop and most MCP clients require stdio or spec-compliant Streamable HTTP, making the server unusable with standard tooling.

4. **No frontend UI** — Users cannot enable, configure, or monitor the MCP server from the application. The only way to configure it is by editing `config.json` directly.

---

## Current State (Verified)

### Backend: Complete
- **Package:** `pkg/app/mcp/` — 8 source files, 2 test files (~5,000 lines total)
- **Integration:** `pkg/app/mcp_integration.go` (422 lines) — Wails RPC methods, adapter pattern
- **Transport:** Custom HTTP POST to `/mcp` on `localhost:3000`
- **Protocol:** Hand-rolled JSON-RPC 2.0 implementing MCP spec `2024-11-05`
- **SDK:** None — no `mark3labs/mcp-go` or other MCP library
- **Tests:** ~2,500 lines across `tools_test.go` and `server_additional_test.go`

### Frontend: Not Started
- `frontend/src/mcp/` — does not exist
- Wails bindings generated but never imported by any React component
- Available RPCs: `GetMCPConfig`, `SetMCPConfig`, `GetMCPStatus`, `StartMCPServer`, `StopMCPServer`

### Tool Inventory (59 tools)
| Category | Count | Tools |
|----------|-------|-------|
| K8s List | 24 | `k8s_list_pods`, `k8s_list_deployments`, `k8s_list_services`, ... (one per resource kind) |
| K8s Describe | 12 | `k8s_describe_pod`, `k8s_describe_deployment`, ... (one per resource kind) |
| K8s Logs | 2 | `k8s_get_pod_logs`, `k8s_get_pod_logs_previous` |
| K8s Utility | 3 | `k8s_get_events`, `k8s_get_resource_yaml`, `k8s_get_resource_counts` |
| K8s Diagnostics | 4 | `k8s_top_pods`, `k8s_top_nodes`, `k8s_get_rollout_status`, `k8s_get_rollout_history` |
| K8s Mutation | 2 | `k8s_scale_deployment`, `k8s_restart_deployment` |
| Swarm List | 8 | `swarm_list_services`, `swarm_list_tasks`, `swarm_list_nodes`, ... |
| Swarm Inspect | 3 | `swarm_inspect_service`, `swarm_inspect_task`, `swarm_inspect_node` |
| Swarm Other | 2 | `swarm_get_service_logs`, `swarm_scale_service` |

### Known Bugs
- `GetPodDetail` adapter in `mcp_integration.go` ignores namespace parameter — calls `app.GetPodSummary(name)` without passing namespace.
- `truncateLogs()` helper only applied to `handleGetPodLogsPrevious`, not `handleGetPodLogs`.

---

## Solution Design

### Target: 14 Consolidated Tools

| # | Tool Name | Replaces | Parameters |
|---|-----------|----------|------------|
| 1 | `k8s_list` | 24 list tools | `kind` (enum, required), `namespace`, `labelSelector`, `limit` |
| 2 | `k8s_describe` | 12 describe tools | `kind` (enum, required), `name` (required), `namespace` |
| 3 | `k8s_get_resource_yaml` | same | `kind`, `name`, `namespace` |
| 4 | `k8s_get_pod_logs` | 2 log tools | `name`, `namespace`, `container`, `lines`, `previous` (bool) |
| 5 | `k8s_get_events` | same | `namespace`, `kind`, `name` |
| 6 | `k8s_get_resource_counts` | same | (none) |
| 7 | `k8s_top` | 2 top tools | `kind` (enum: `pods`\|`nodes`), `namespace` |
| 8 | `k8s_rollout` | 2 rollout tools | `action` (enum: `status`\|`history`), `kind`, `name`, `namespace` |
| 9 | `k8s_scale_deployment` | same | `name`, `namespace`, `replicas`, `confirmed` |
| 10 | `k8s_restart_deployment` | same | `name`, `namespace` |
| 11 | `swarm_list` | 8 swarm list tools | `kind` (enum, required) |
| 12 | `swarm_inspect` | 3 swarm inspect tools | `kind` (enum, required), `id` (required) |
| 13 | `swarm_get_service_logs` | same | `serviceId`, `tail` |
| 14 | `swarm_scale_service` | same | `serviceId`, `replicas`, `confirmed` |

**Context savings estimate:**
- `tools/list` payload: ~8KB → ~2KB (75% reduction)
- Per-list-call responses: unbounded → capped via `limit` param + truncation metadata

### `k8s_list` Kind Enum Values
```
pods, deployments, statefulsets, daemonsets, jobs, cronjobs,
configmaps, secrets, services, endpoints, ingresses,
network_policies, replicasets, persistent_volumes,
persistent_volume_claims, storage_classes, nodes,
service_accounts, roles, role_bindings, cluster_roles,
cluster_role_bindings, crds
```

### `k8s_describe` Kind Enum Values
```
pod, deployment, service, ingress, node, pvc, pv,
statefulset, daemonset, replicaset, job, cronjob
```

### Response Optimization
- Switch `json.MarshalIndent` → `json.Marshal` (saves ~30% whitespace)
- Add `limit` parameter: when results exceed limit, return truncated slice + `"truncated": true, "total": N`
- Add `labelSelector` parameter: pass through to K8s `ListOptions` for server-side filtering
- Strip `NodeInfo.Raw` field from MCP responses (contains entire K8s Node API object)
- Apply `truncateLogs()` consistently to both current and previous log handlers

### Transport: mcp-go SDK
- Adopt `mark3labs/mcp-go` for spec-compliant transport
- Support **Streamable HTTP** (default for GUI mode) and **stdio** (for Claude Desktop subprocess)
- Replace custom JSON-RPC handler, HTTP mux, and message dispatch
- Use SDK tool registration (`mcp.NewTool()`, `mcp.WithDescription()`, etc.) instead of hand-built schemas
- Add `TransportMode` to `MCPConfigData` (`"http"` | `"stdio"`, default `"http"`)

### Frontend: Holmes Pattern
Follow the proven `HolmesConfigModal` / `HolmesContext` pattern:
- `MCPContext.tsx` — `useReducer` + `useContext`, status polling
- `MCPConfigModal.tsx` — self-rendering overlay modal
- Mount in `AppContainer.tsx`, trigger from sidebar header button
- Optional status indicator in `FooterBar.tsx`

---

## Implementation Phases

### Phase A: Tool Consolidation

**Files modified:**
- `pkg/app/mcp/tools.go` — replace 59 tool registrations with 14 consolidated tools
- `pkg/app/mcp/server.go` — update `ServerInterface` if needed for filtering support

**Tasks:**

- [ ] A1: Create kind-to-handler dispatch maps for `k8s_list` and `k8s_describe`
  - Map `kind` enum values to existing `ServerInterface` methods
  - Example: `"pods" → s.app.GetPods(ns)`, `"deployments" → s.app.GetDeployments(ns)`
  - Example: `"pod" → s.app.GetPodDetail(ns, name)`, `"deployment" → s.app.GetDeploymentDetail(ns, name)`

- [ ] A2: Implement consolidated `k8s_list` handler
  - Parse `kind`, `namespace`, `labelSelector`, `limit` from input
  - Dispatch to appropriate `ServerInterface` method via map
  - Apply client-side label filtering if App method doesn't support it natively
  - Apply `limit` truncation with `{items: [...], truncated: bool, total: int}` wrapper
  - Register with `k8s_list` tool definition and full kind enum in schema

- [ ] A3: Implement consolidated `k8s_describe` handler
  - Parse `kind`, `name`, `namespace` from input
  - Dispatch to appropriate `Get*Detail()` method via map
  - Fix namespace passthrough for pod detail (currently ignored)

- [ ] A4: Merge log tools into single `k8s_get_pod_logs` handler
  - Add `previous` boolean parameter (default: `false`)
  - Apply `truncateLogs()` consistently for both current and previous
  - Remove separate `k8s_get_pod_logs_previous` tool

- [ ] A5: Merge `k8s_top_pods`/`k8s_top_nodes` into `k8s_top`
  - Add `kind` enum parameter (`pods` | `nodes`)
  - Route to `TopPods(ns)` or `TopNodes()` based on kind

- [ ] A6: Merge rollout tools into `k8s_rollout`
  - Add `action` enum parameter (`status` | `history`)
  - Route to `GetRolloutStatus()` or `GetRolloutHistory()`

- [ ] A7: Consolidate Swarm list tools into `swarm_list`
  - Kind enum: `services`, `tasks`, `nodes`, `stacks`, `networks`, `volumes`, `secrets`, `configs`
  - Dispatch to existing `GetSwarm*()` methods
  - All check `IsSwarmConnected()` first

- [ ] A8: Consolidate Swarm inspect tools into `swarm_inspect`
  - Kind enum: `service`, `task`, `node`
  - Dispatch to `GetSwarmService()`, `GetSwarmTask()`, `GetSwarmNode()`

- [ ] A9: Remove all old individual tool registrations
  - Delete the 59 individual `s.tools[...]` blocks
  - Delete the 59 individual `handle*` methods that are now replaced by dispatch
  - Keep shared helpers (`getNamespaceParam`, `getStringParam`, `truncateLogs`)

**Estimated effort:** 2–3 days

---

### Phase B: Response Optimization

**Files modified:**
- `pkg/app/mcp/server.go` — JSON serialization change
- `pkg/app/mcp/tools.go` — filtering and truncation logic
- `pkg/app/mcp/types.go` — add `ListResult` wrapper type
- `pkg/app/mcp_integration.go` — fix pod detail namespace bug

**Tasks:**

- [ ] B1: Switch `json.MarshalIndent` to `json.Marshal` in `handleToolsCall`
  - In `server.go`, change `json.MarshalIndent(result, "", "  ")` to `json.Marshal(result)`
  - Saves ~30% payload size on large responses

- [ ] B2: Create `ListResult` wrapper type
  ```go
  type ListResult struct {
      Items     interface{} `json:"items"`
      Total     int         `json:"total"`
      Truncated bool        `json:"truncated,omitempty"`
      Namespace string      `json:"namespace,omitempty"`
  }
  ```
  - All list handlers return this instead of raw slices
  - When `limit` param is set and len(items) > limit, truncate and set `truncated: true`

- [ ] B3: Add `labelSelector` support to `k8s_list`
  - For resources where the underlying App method uses `client-go` `ListOptions`, pass `labelSelector` through
  - For resources where the App method doesn't support it, apply client-side filtering on the returned items using labels field
  - Document which resource types support server-side vs. client-side filtering

- [ ] B4: Strip `NodeInfo.Raw` from MCP responses
  - Add `json:"-"` tag on `Raw` field for MCP serialization, or
  - Create a `NodeInfoMCP` projection type without the `Raw` field
  - The `Raw` field contains the full Kubernetes Node API object and is only useful for the desktop UI

- [ ] B5: Fix `GetPodDetail` namespace handling in adapter
  - In `mcp_integration.go`, change `app.GetPodSummary(name)` to pass namespace
  - Or use namespace-aware pod lookup

- [ ] B6: Apply `truncateLogs()` to current logs handler
  - `handleGetPodLogs` currently only caps `tailLines`; add `truncateLogs()` post-fetch

**Estimated effort:** 1–2 days

---

### Phase C: SDK & Transport Migration

**Files modified:**
- `go.mod` — add `mark3labs/mcp-go` dependency
- `pkg/app/mcp/server.go` — rewrite using SDK
- `pkg/app/mcp/tools.go` — use SDK tool registration
- `pkg/app/mcp/config.go` — add `TransportMode` field
- `pkg/app/mcp_integration.go` — update lifecycle methods

**Tasks:**

- [ ] C1: Add `mark3labs/mcp-go` dependency
  - `go get github.com/mark3labs/mcp-go@latest`
  - Verify compatibility with Go 1.25

- [ ] C2: Add `TransportMode` to `MCPConfigData`
  - Field: `TransportMode string` with values `"http"` (default) and `"stdio"`
  - Update `NewDefaultMCPConfig()` to set default
  - Update `Validate()` to normalize

- [ ] C3: Rewrite tool registration using mcp-go SDK
  - Replace hand-built `map[string]interface{}` schemas with `mcp.NewTool()` builder
  - Example:
    ```go
    tool := mcp.NewTool("k8s_list",
        mcp.WithDescription("List Kubernetes resources by kind..."),
        mcp.WithString("kind", mcp.Required(), mcp.Enum("pods", "deployments", ...),
            mcp.Description("Resource kind to list")),
        mcp.WithString("namespace",
            mcp.Description("Namespace. Omit for current namespace")),
        mcp.WithString("labelSelector",
            mcp.Description("Label selector (e.g. app=nginx)")),
        mcp.WithNumber("limit",
            mcp.Description("Max items to return. Omit for all")),
    )
    s.AddTool(tool, s.handleK8sList)
    ```
  - Handler signature changes to: `func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error)`
  - Use `req.RequireString("kind")`, `req.GetString("namespace")` for arg access
  - Return `mcp.NewToolResultText(jsonString)` or `mcp.NewToolResultError(errMsg)`

- [ ] C4: Rewrite server lifecycle using mcp-go SDK
  - Replace custom `MCPServer` struct with `server.NewMCPServer("kubedevbench", "1.0.0", opts...)`
  - For HTTP mode: use `server.NewStreamableHTTPServer(mcpServer)` or `server.NewSSEServer(mcpServer)`
  - For stdio mode: use `server.ServeStdio(mcpServer)`
  - Remove custom JSON-RPC handler (`handleMessage`, `handleMCP`), custom HTTP mux, `handleRoot`, `handleHealth`
  - Preserve health endpoint if needed as a separate HTTP handler

- [ ] C5: Update `mcp_integration.go` lifecycle
  - `startMCPServer()` — branch on `TransportMode`: HTTP vs stdio
  - `shutdownMCP()` — use SDK shutdown
  - Keep `MCPServerAdapter` interface mapping unchanged
  - `GetMCPStatus()` — return transport mode in status

- [ ] C6: Remove custom MCP protocol code
  - Delete `jsonRPCRequest`, `jsonRPCResponse` structs
  - Delete `handleMessage()`, `handleMCP()`, `handleRoot()`
  - Delete custom `initialize`, `tools/list`, `tools/call` dispatch
  - Keep `handleHealth()` as standalone if desired

**Estimated effort:** 3–4 days

---

### Phase D: Frontend UI

**Files created:**
- `frontend/src/mcp/mcpApi.ts`
- `frontend/src/mcp/MCPContext.tsx`
- `frontend/src/mcp/MCPConfigModal.tsx`
- `frontend/src/mcp/MCPConfigModal.css`

**Files modified:**
- `frontend/src/layout/AppContainer.tsx` — mount `<MCPConfigModal />`
- `frontend/src/layout/AppLayout.tsx` — add MCP sidebar button
- `frontend/src/layout/FooterBar.tsx` — optional status indicator

**Tasks:**

- [ ] D1: Create `frontend/src/mcp/mcpApi.ts`
  - Import Wails bindings: `GetMCPConfig`, `SetMCPConfig`, `GetMCPStatus`, `StartMCPServer`, `StopMCPServer`
  - TypeScript interfaces:
    ```ts
    interface MCPConfig {
      enabled: boolean;
      host: string;
      port: number;
      transportMode: 'http' | 'stdio';
      allowDestructive: boolean;
      requireConfirm: boolean;
      maxLogLines: number;
    }
    interface MCPStatus {
      running: boolean;
      enabled: boolean;
      transport: string;
      address: string;
    }
    ```
  - Export wrapped async functions with error handling

- [ ] D2: Create `frontend/src/mcp/MCPContext.tsx`
  - `useReducer` with state:
    ```ts
    { config: MCPConfig | null, status: MCPStatus | null, loading: boolean, error: string | null, showConfig: boolean }
    ```
  - Actions: `LOAD_CONFIG`, `SAVE_CONFIG`, `SET_STATUS`, `SHOW_CONFIG`, `HIDE_CONFIG`, `SET_ERROR`, `SET_LOADING`
  - `useEffect` to load config on mount
  - `useEffect` with 10s interval to poll `GetMCPStatus()` when enabled
  - Expose `useMCP()` hook with: `state`, `loadConfig()`, `saveConfig()`, `startServer()`, `stopServer()`, `showConfigModal()`, `hideConfigModal()`

- [ ] D3: Create `frontend/src/mcp/MCPConfigModal.tsx`
  - Self-rendering overlay (return `null` when `!state.showConfig`)
  - Local state for form fields, synced from context config on open
  - Form layout:
    - **Section: Server** — Enable checkbox, Transport dropdown (HTTP/stdio), Host + Port inputs (visible when HTTP)
    - **Section: Security** — Allow Destructive checkbox, Require Confirmation checkbox
    - **Section: Limits** — Max Log Lines number input (100–10000)
    - **Section: Status** — Status badge (Running ● / Stopped ○ / Error ●), Start/Stop button
  - Footer: Save + Cancel buttons
  - Close on backdrop click + Escape key
  - Notifications on save success/failure (using existing notification system)

- [ ] D4: Create `frontend/src/mcp/MCPConfigModal.css`
  - Component-scoped styles following Holmes CSS pattern
  - Modal overlay, form layout, status badge colors

- [ ] D5: Mount `<MCPConfigModal />` in `AppContainer.tsx`
  - Wrap with `<MCPProvider>` context provider
  - Place alongside `<HolmesConfigModal />`

- [ ] D6: Add MCP button to sidebar header in `AppLayout.tsx`
  - Add button with 🔌 icon (or suitable icon) next to Holmes 🔍 and Connection ⚙️ buttons
  - `onClick` → `showConfigModal()` from `useMCP()` hook
  - `id="mcp-config-btn"` for test targeting
  - Tooltip: "MCP Server Configuration"

- [ ] D7: (Optional) Add MCP status indicator to `FooterBar.tsx`
  - Small colored dot: green (running), gray (stopped/disabled), red (error)
  - Clicking opens config modal
  - Only visible when MCP is enabled

**Estimated effort:** 2–3 days

---

### Phase E: Testing

**Files created:**
- `frontend/src/__tests__/mcpConfigModal.test.tsx`
- `frontend/src/__tests__/mcpContext.test.tsx`
- `e2e/tests/mcp/01-configure-mcp.spec.ts`

**Files modified:**
- `pkg/app/mcp/tools_test.go` — rewrite for consolidated tools
- `pkg/app/mcp/server_additional_test.go` — update for SDK lifecycle

**Tasks:**

- [ ] E1: Update `tools_test.go` for consolidated tool set
  - Test `k8s_list` with each `kind` enum value
  - Test `k8s_list` with `labelSelector` parameter
  - Test `k8s_list` with `limit` parameter and truncation
  - Test `k8s_describe` with each `kind` enum value
  - Test `k8s_get_pod_logs` with `previous: true` and `previous: false`
  - Test `k8s_top` with `kind: pods` and `kind: nodes`
  - Test `k8s_rollout` with `action: status` and `action: history`
  - Test `swarm_list` and `swarm_inspect` dispatch
  - Test that 14 tools are registered (no more, no less)
  - Test input validation: missing required `kind`, unknown kind value

- [ ] E2: Update `server_additional_test.go` for SDK-based server
  - Test server creation with mcp-go SDK
  - Test start/stop lifecycle
  - Test health endpoint (if retained)
  - Test config validation with `TransportMode`

- [ ] E3: Create `frontend/src/__tests__/mcpConfigModal.test.tsx`
  - Test: modal renders when `showConfig=true`
  - Test: modal hidden when `showConfig=false`
  - Test: form fields populate from config
  - Test: host/port inputs hidden when transport is `stdio`
  - Test: save button calls `SetMCPConfig` with form values
  - Test: cancel button calls `hideConfigModal`
  - Test: start/stop button toggles server
  - Mock Wails bindings via `wailsMocks.ts` pattern

- [ ] E4: Create `frontend/src/__tests__/mcpContext.test.tsx`
  - Test: initial state has `config: null, loading: true`
  - Test: `LOAD_CONFIG` action sets config
  - Test: `SHOW_CONFIG` / `HIDE_CONFIG` toggle `showConfig`
  - Test: status polling fires when enabled
  - Test: error handling on RPC failure

- [ ] E5: Create `e2e/tests/mcp/01-configure-mcp.spec.ts`
  - Test flow:
    1. Click MCP config button in sidebar header (`#mcp-config-btn`)
    2. Verify modal opens
    3. Toggle enable checkbox
    4. Change transport mode
    5. Click Save
    6. Verify notification
    7. Reopen modal, verify saved values persist
  - Follow existing E2E patterns: `bootstrapApp`, `Notifications` page object, `test.step()` grouping
  - Use role-based locators (`getByRole`, `getByLabel`)

**Estimated effort:** 2–3 days

---

### Phase F: Documentation

**Files created:**
- `docs/MCP_INTEGRATION.md`

**Files modified:**
- `project/impl/work/analyze/MCP_IMPLEMENTATION_PLAN.md` — update status

**Tasks:**

- [ ] F1: Create `docs/MCP_INTEGRATION.md`
  - **Overview** — What MCP is, why it's useful for DevOps
  - **Quick Start** — Enable via GUI, configure transport
  - **Available Tools** — Table of 14 tools with parameters, descriptions, examples
  - **Claude Desktop Configuration** — `claude_desktop_config.json` example for stdio mode:
    ```json
    {
      "mcpServers": {
        "kubedevbench": {
          "command": "/path/to/KubeDevBench",
          "args": ["--mcp-stdio"],
          "env": {}
        }
      }
    }
    ```
  - **HTTP Mode** — How to connect via Streamable HTTP (URL, port)
  - **Security Model** — Three tiers (config, tool-level, runtime confirmation)
  - **Tool Reference** — Detailed docs for each tool with example requests/responses
  - **Troubleshooting** — Common issues and solutions

- [ ] F2: Update `MCP_IMPLEMENTATION_PLAN.md`
  - Mark Phase 6 (Frontend UI) as complete
  - Mark Phase 7 (Testing & Documentation) as complete
  - Update tool count from 59 to 14
  - Document consolidation decisions and rationale
  - Update file references

**Estimated effort:** 1 day

---

## Execution Order

```
Phase A (Tool Consolidation)
    ↓
Phase B (Response Optimization)     ← can partially overlap with A
    ↓
Phase C (SDK & Transport Migration) ← depends on A+B for tool registration
    ↓
Phase D (Frontend UI)               ← depends on C for config model with TransportMode
    ↓
Phase E (Testing)                   ← depends on all above
    ↓
Phase F (Documentation)             ← depends on E (document final behavior)
```

Phases A and B can be developed together since they both modify `tools.go`.  
Phase D can begin once the `MCPConfigData` struct is finalized in Phase C2.  
Phase E should be done incrementally: update backend tests after A+B+C, create frontend tests after D.

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| mcp-go SDK breaking changes | Medium | Pin specific version in go.mod; SDK is actively maintained |
| Tool consolidation breaks existing tests | Low | Tests are isolated in `tools_test.go`; rewrite alongside |
| Large refactor in `tools.go` (1,770 lines) | Medium | Incremental: build new handlers → delete old ones → update registrations |
| Transport change affects HTTP clients | Low | No known external consumers of current HTTP transport |
| stdio mode requires CLI arg support | Low | Add `--mcp-stdio` flag to main.go; only used for Claude Desktop |

---

## Verification Checklist

### Backend
- [ ] `go test ./pkg/app/mcp/...` — all tests pass
- [ ] `go vet ./pkg/app/mcp/...` — no warnings
- [ ] 14 tools registered (verify in test)
- [ ] `k8s_list` with `limit: 5` returns exactly 5 items + `truncated: true`
- [ ] `k8s_list` with `labelSelector: app=nginx` filters correctly
- [ ] `k8s_describe` with each kind dispatches to correct detail method
- [ ] Pod detail includes namespace in lookup
- [ ] Log truncation applied to both current and previous logs
- [ ] Swarm tools check `IsSwarmConnected()` before dispatch
- [ ] Security checks enforced on consolidated tools

### Frontend
- [ ] `cd frontend && npm test` — all Vitest tests pass
- [ ] MCP config modal opens from sidebar button
- [ ] Form fields load from saved config
- [ ] Save persists config and triggers notification
- [ ] Start/Stop buttons control MCP server
- [ ] Status badge reflects server state
- [ ] Transport mode toggle shows/hides host+port fields

### Integration
- [ ] `wails dev` — bindings regenerate successfully
- [ ] Claude Desktop connects via stdio transport
- [ ] AI assistant can call `k8s_list` with `kind: pods` and receive results
- [ ] E2E test `01-configure-mcp.spec.ts` passes

---

## Estimated Total Effort

| Phase | Estimate |
|-------|----------|
| A: Tool Consolidation | 2–3 days |
| B: Response Optimization | 1–2 days |
| C: SDK & Transport Migration | 3–4 days |
| D: Frontend UI | 2–3 days |
| E: Testing | 2–3 days |
| F: Documentation | 1 day |
| **Total** | **11–16 days** |
