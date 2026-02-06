# MCP Server Integration for KubeDevBench

**Status:** Backend COMPLETE, Frontend NOT STARTED
**Created:** 2026-02-05
**Updated:** 2026-02-06

## Overview

Model Context Protocol (MCP) server functionality for KubeDevBench, enabling AI assistants (Claude, etc.) to interact with Kubernetes and Docker Swarm clusters for troubleshooting and diagnostics.

**Target Users**: DevOps engineers and software engineers who use AI assistants during development and troubleshooting.

**Approach**: Embedded mode — MCP server runs alongside the GUI, reusing existing cluster connections and operations.

**Note:** Frontend was migrated to TypeScript in PR #104. All frontend file references use `.tsx`/`.ts` extensions.

---

## Current State (Verified)

### Backend: ✅ FULLY IMPLEMENTED

The MCP backend is complete and operational with 59 tools.

**Package structure** (`pkg/app/mcp/` — 8 files):
| File | Lines | Purpose | Status |
|------|-------|---------|--------|
| `server.go` | 612 | MCP server with ServerInterface | ✅ |
| `tools.go` | 1,769 | 59 tool handlers and registration | ✅ |
| `tools_test.go` | — | Tool tests | ✅ |
| `config.go` | — | MCPConfig with validation | ✅ |
| `types.go` | — | MCP-specific types | ✅ |
| `errors.go` | — | Package errors | ✅ |
| `resources.go` | — | Resource management | ✅ |
| `security.go` | — | Security definitions | ✅ |

**Integration file**: `pkg/app/mcp_integration.go` (421 lines) — Wails RPC methods, global MCP server instance with mutex protection, initialization and shutdown logic.

### All 59 MCP Tools Implemented

**Kubernetes Read-Only (17):**
- `k8s_list_pods`, `k8s_list_deployments`, `k8s_list_statefulsets`, `k8s_list_daemonsets`
- `k8s_list_jobs`, `k8s_list_cronjobs`, `k8s_list_configmaps`, `k8s_list_secrets`
- `k8s_list_services`, `k8s_list_endpoints`, `k8s_list_ingresses`, `k8s_list_network_policies`
- `k8s_list_replicasets`, `k8s_list_persistent_volumes`, `k8s_list_persistent_volume_claims`
- `k8s_list_storage_classes`, `k8s_list_nodes`

**RBAC Tools (4):**
- `k8s_list_roles`, `k8s_list_role_bindings`, `k8s_list_cluster_roles`, `k8s_list_cluster_role_bindings`

**Service Account & CRD Tools (2):**
- `k8s_list_service_accounts`, `k8s_list_crds`

**Describe/Detail Tools (12):**
- `k8s_describe_pod`, `k8s_describe_deployment`, `k8s_describe_service`, `k8s_describe_ingress`
- `k8s_describe_node`, `k8s_describe_pvc`, `k8s_describe_pv`, `k8s_describe_statefulset`
- `k8s_describe_daemonset`, `k8s_describe_replicaset`, `k8s_describe_job`, `k8s_describe_cronjob`

**Utility Tools (5):**
- `k8s_get_pod_logs`, `k8s_get_pod_logs_previous`, `k8s_get_events`
- `k8s_get_resource_yaml`, `k8s_get_resource_counts`

**Rollout & Diagnostics Tools (4):**
- `k8s_top_pods`, `k8s_top_nodes`, `k8s_get_rollout_status`, `k8s_get_rollout_history`

**Docker Swarm Tools (15):**
- `swarm_list_services`, `swarm_list_tasks`, `swarm_list_nodes`, `swarm_list_stacks`
- `swarm_list_networks`, `swarm_list_volumes`, `swarm_list_configs`, `swarm_list_secrets`
- `swarm_get_service_logs`, `swarm_scale_service`
- `swarm_inspect_service`, `swarm_inspect_task`, `swarm_inspect_node`
- Plus additional Swarm tools

### Frontend: ❌ NOT IMPLEMENTED

No MCP frontend components exist:
- `frontend/src/mcp/` directory — NOT FOUND
- `MCPConfigModal` — NOT FOUND
- `MCPContext` — NOT FOUND
- `mcpApi` — NOT FOUND

---

## Remaining Work

### Phase 6: GUI Configuration UI ❌ NOT STARTED

Create React components for MCP configuration, following Holmes UI pattern.

**Files to Create:**

1. **`frontend/src/mcp/mcpApi.ts`**
   - Wrapper for Wails MCP bindings
   - TypeScript types for MCP config and status
   - Error handling

2. **`frontend/src/mcp/MCPContext.tsx`**
   - React Context for MCP state management
   - State: enabled, configured, loading, error, serverStatus
   - Actions: loadConfig, saveConfig, updateConfig
   - Polling for server status

3. **`frontend/src/mcp/MCPConfigModal.tsx`**
   - Configuration modal dialog
   - Checkbox: "Enable MCP Server"
   - Checkbox: "Allow Destructive Operations" (delete, scale-to-zero)
   - Checkbox: "Require Confirmation for Destructive Operations" (default: checked)
   - Number input: "Max Log Lines" (default: 1000, range: 100-10000)
   - Status indicator: "Server Status: Running/Stopped/Error"
   - Save/Cancel buttons

**Integration into existing UI:**
- [ ] Add "MCP Server" option to Settings menu (or main menu)
- [ ] Show MCP status indicator in status bar (optional)

**Tasks:**
- [ ] Create `mcpApi.ts` wrapper for Wails bindings
- [ ] Create `MCPContext.tsx` with state management
- [ ] Create `MCPConfigModal.tsx` component
- [ ] Add settings menu entry for MCP configuration
- [ ] Add status polling in MCPContext
- [ ] Write component tests (Vitest)

### Phase 7: Testing & Documentation ❌ NOT STARTED

**Frontend Tests (Vitest):**
- [ ] `frontend/src/__tests__/mcpConfigModal.test.tsx` — Modal component
- [ ] `frontend/src/__tests__/mcpContext.test.tsx` — State management
- [ ] Mock Wails bindings using existing `wailsMocks.ts` pattern

**E2E Tests (Playwright):**
- [ ] `e2e/tests/mcp/01-configure-mcp.spec.ts` — Configuration flow
- [ ] `e2e/tests/mcp/02-enable-disable.spec.ts` — Enable/disable server

**Documentation:**
- [ ] Create `docs/MCP_INTEGRATION.md` or section in README
- [ ] Document Claude Desktop configuration
- [ ] Document available tools and usage examples
- [ ] Document security considerations

---

## Completed Phases Summary

### Phase 1: Core MCP Infrastructure ✅ COMPLETE
- [x] MCP SDK dependency in go.mod
- [x] `pkg/app/mcp/` package structure (config.go, types.go, errors.go)
- [x] MCPConfig with validation
- [x] Basic server.go with transport
- [x] Configuration persistence

### Phase 2: Kubernetes Diagnostic Tools ✅ COMPLETE
- [x] 17 K8s read-only list tools
- [x] 12 describe/detail tools
- [x] 5 utility tools (logs, events, YAML, counts)
- [x] 4 rollout & diagnostics tools
- [x] Input validation for each tool

### Phase 3: Docker Swarm & Resources ✅ COMPLETE
- [x] 15+ Docker Swarm tools
- [x] Resource providers for cluster context

### Phase 4: MCP Server Integration ✅ COMPLETE
- [x] `pkg/app/mcp_integration.go` (421 lines) with global state
- [x] Wails RPC methods for GUI configuration
- [x] Thread-safe initialization/shutdown
- [x] Server lifecycle management

### Phase 5: Security & Confirmations ✅ COMPLETE
- [x] `security.go` with security level definitions
- [x] Operation validation
- [x] Security field on all tool definitions
- [x] Destructive operation controls

---

## Architecture (Implemented)

### Thread Safety
Following Holmes pattern with mutex-protected global state in `mcp_integration.go`.

### Configuration Persistence
MCP config stored in `~/KubeDevBench/config.json` alongside Holmes config.

### Security Model (Three-Tier)
1. **Configuration Level**: `allowDestructive` flag blocks all destructive operations
2. **Tool Level**: Each tool tagged with security level (safe/write/destructive)
3. **Runtime Level**: Confirmation required for scale-to-zero and delete operations

---

## Files Summary

**Existing (implemented):**
- `pkg/app/mcp/server.go` (612 lines) ✅
- `pkg/app/mcp/tools.go` (1,769 lines) ✅
- `pkg/app/mcp/tools_test.go` ✅
- `pkg/app/mcp/config.go` ✅
- `pkg/app/mcp/types.go` ✅
- `pkg/app/mcp/errors.go` ✅
- `pkg/app/mcp/resources.go` ✅
- `pkg/app/mcp/security.go` ✅
- `pkg/app/mcp_integration.go` (421 lines) ✅

**Pending (frontend):**
- `frontend/src/mcp/mcpApi.ts` ❌
- `frontend/src/mcp/MCPContext.tsx` ❌
- `frontend/src/mcp/MCPConfigModal.tsx` ❌
- `frontend/src/__tests__/mcpConfigModal.test.tsx` ❌
- `frontend/src/__tests__/mcpContext.test.tsx` ❌
- `e2e/tests/mcp/01-configure-mcp.spec.ts` ❌
- `e2e/tests/mcp/02-enable-disable.spec.ts` ❌
- `docs/MCP_INTEGRATION.md` ❌

---

## Verification

**Backend (verified working):**
- [x] MCP server starts with app when enabled ✅
- [x] Server stops cleanly on shutdown ✅
- [x] All 59 tools registered and functional ✅
- [x] Security checks enforced ✅
- [x] Configuration persists ✅

**Frontend (pending):**
- [ ] Config UI loads and saves correctly
- [ ] Enable/disable toggle works
- [ ] Status indicator shows server state
- [ ] E2E tests pass

**Integration (pending verification):**
- [ ] Claude Desktop can connect via STDIO
- [ ] AI assistant can call tools successfully
- [ ] Documentation complete
