# MCP Lazy-Loading Implementation Plan: Tool Search Meta-Tool Architecture

**Date**: 2026-02-03
**Status**: Planning
**Target**: Reduce MCP context consumption by 95%+ through on-demand tool discovery

---

## Executive Summary

This plan implements a **Tool Search Meta-Tool Architecture** that replaces the current 59 directly-exposed MCP tools with 5 meta-tools that enable on-demand discovery and execution. This approach reduces initial context consumption from ~30,000 tokens to ~2,500 tokens while preserving full functionality.

| Metric | Current | After Implementation |
|--------|---------|---------------------|
| Tools exposed to agent | 59 | 5 |
| Initial context cost | ~30,000 tokens | ~2,500 tokens |
| Context reduction | - | **92%** |
| Agent workflow steps | 1 (direct call) | 2-3 (discover → schema → call) |
| Backward compatibility | N/A | Full (configurable mode) |

---

## Architecture Overview

### Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              tools/list Response                     │   │
│  │  [59 tools with full schemas = ~30,000 tokens]      │   │
│  │                                                      │   │
│  │  • k8s_list_pods (schema: 150 tokens)               │   │
│  │  • k8s_describe_pod (schema: 180 tokens)            │   │
│  │  • k8s_get_pod_logs (schema: 220 tokens)            │   │
│  │  • ... 56 more tools ...                            │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ▼
                    Agent Context Window
              [30k tokens consumed immediately]
```

### Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     MCP Server                              │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              tools/list Response                     │   │
│  │  [5 meta-tools with schemas = ~2,500 tokens]        │   │
│  │                                                      │   │
│  │  • mcp_search_tools                                 │   │
│  │  • mcp_get_tool_schema                              │   │
│  │  • mcp_call_tool                                    │   │
│  │  • mcp_list_categories                              │   │
│  │  • mcp_list_tools_in_category                       │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Internal Tool Registry                  │   │
│  │  [59 tools with full definitions - NOT exposed]     │   │
│  │                                                      │   │
│  │  Indexed by: name, category, keywords               │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                              ▼
                    Agent Context Window
              [2.5k tokens consumed initially]
              [Additional tokens on-demand only]
```

---

## Meta-Tool Specifications

### Tool 1: `mcp_search_tools`

**Purpose**: Find relevant tools by natural language query or keywords

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "query": {
      "type": "string",
      "description": "Search query - natural language or keywords (e.g., 'pod logs', 'scale deployment', 'list services')"
    },
    "limit": {
      "type": "integer",
      "description": "Maximum results to return (default: 10, max: 25)"
    }
  },
  "required": ["query"]
}
```

**Output Format**:
```json
{
  "results": [
    {
      "name": "k8s_get_pod_logs",
      "description": "Retrieve logs from a specific pod",
      "category": "k8s-diagnostics",
      "security": "safe",
      "relevance": 0.95
    },
    {
      "name": "k8s_get_pod_logs_previous",
      "description": "Retrieve logs from previous container instance",
      "category": "k8s-diagnostics",
      "security": "safe",
      "relevance": 0.82
    }
  ],
  "total_matches": 2,
  "tip": "Use mcp_get_tool_schema to get full parameter details for a tool"
}
```

**Search Algorithm**:
1. Tokenize query into keywords
2. Match against tool name (highest weight)
3. Match against description (medium weight)
4. Match against category tags (medium weight)
5. Match against keyword aliases (lower weight)
6. Score and rank by relevance
7. Return top N results

**Keyword Aliases** (examples):
- "logs" → `k8s_get_pod_logs`, `swarm_get_service_logs`
- "scale" → `k8s_scale_deployment`, `swarm_scale_service`
- "crash", "error", "failing" → `k8s_get_pod_logs`, `k8s_get_events`, `k8s_describe_pod`
- "restart" → `k8s_restart_deployment`

---

### Tool 2: `mcp_get_tool_schema`

**Purpose**: Retrieve full input schema for a specific tool before calling it

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "tool_name": {
      "type": "string",
      "description": "Exact name of the tool (e.g., 'k8s_get_pod_logs')"
    }
  },
  "required": ["tool_name"]
}
```

**Output Format**:
```json
{
  "name": "k8s_get_pod_logs",
  "description": "Retrieve logs from a specific pod. Optionally specify a container name for multi-container pods.",
  "category": "k8s-diagnostics",
  "security": "safe",
  "inputSchema": {
    "type": "object",
    "properties": {
      "namespace": {
        "type": "string",
        "description": "Namespace of the pod. Omit to use current namespace."
      },
      "name": {
        "type": "string",
        "description": "Name of the pod."
      },
      "container": {
        "type": "string",
        "description": "Container name (optional, for multi-container pods)."
      },
      "tailLines": {
        "type": "integer",
        "description": "Number of lines to retrieve from the end. Default: 100, Max: 1000."
      }
    },
    "required": ["name"]
  },
  "examples": [
    {
      "description": "Get last 50 lines from pod 'nginx-abc123'",
      "args": {"name": "nginx-abc123", "tailLines": 50}
    }
  ]
}
```

**Error Handling**:
- Unknown tool → `{"error": "Tool 'xyz' not found", "suggestions": ["similar_tool_1", "similar_tool_2"]}`

---

### Tool 3: `mcp_call_tool`

**Purpose**: Execute any registered tool by name with provided arguments

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "tool_name": {
      "type": "string",
      "description": "Name of the tool to execute"
    },
    "arguments": {
      "type": "object",
      "description": "Arguments to pass to the tool (must match tool's inputSchema)"
    }
  },
  "required": ["tool_name", "arguments"]
}
```

**Output Format**:
```json
{
  "success": true,
  "tool": "k8s_get_pod_logs",
  "result": "... actual tool output ..."
}
```

**Error Cases**:
```json
{
  "success": false,
  "tool": "k8s_get_pod_logs",
  "error": "Missing required parameter: name",
  "schema_hint": {
    "required": ["name"],
    "provided": []
  }
}
```

**Security Enforcement**:
- All existing security checks apply (SecuritySafe/Write/Destructive)
- `confirmed` parameter pass-through for destructive operations
- `AllowDestructive` config honored
- Error messages indicate security restrictions when blocked

---

### Tool 4: `mcp_list_categories`

**Purpose**: List available tool categories for browsing

**Input Schema**:
```json
{
  "type": "object",
  "properties": {}
}
```

**Output Format**:
```json
{
  "categories": [
    {
      "id": "k8s-workloads",
      "name": "Kubernetes Workloads",
      "description": "List and describe pods, deployments, statefulsets, daemonsets, jobs, cronjobs",
      "tool_count": 12
    },
    {
      "id": "k8s-diagnostics",
      "name": "Kubernetes Diagnostics",
      "description": "Logs, events, metrics, rollout status",
      "tool_count": 8
    },
    {
      "id": "k8s-network",
      "name": "Kubernetes Networking",
      "description": "Services, ingresses, endpoints, network policies",
      "tool_count": 8
    },
    {
      "id": "k8s-storage",
      "name": "Kubernetes Storage",
      "description": "PVs, PVCs, storage classes",
      "tool_count": 6
    },
    {
      "id": "k8s-config",
      "name": "Kubernetes Config",
      "description": "ConfigMaps, secrets",
      "tool_count": 4
    },
    {
      "id": "k8s-rbac",
      "name": "Kubernetes RBAC",
      "description": "Roles, rolebindings, service accounts",
      "tool_count": 8
    },
    {
      "id": "k8s-cluster",
      "name": "Kubernetes Cluster",
      "description": "Nodes, namespaces, CRDs",
      "tool_count": 6
    },
    {
      "id": "k8s-mutations",
      "name": "Kubernetes Mutations",
      "description": "Scale, restart operations",
      "tool_count": 2,
      "security": "write"
    },
    {
      "id": "swarm-resources",
      "name": "Docker Swarm Resources",
      "description": "Services, tasks, nodes, stacks, networks, volumes, secrets, configs",
      "tool_count": 16
    },
    {
      "id": "swarm-mutations",
      "name": "Docker Swarm Mutations",
      "description": "Scale service operations",
      "tool_count": 1,
      "security": "write"
    }
  ],
  "total_tools": 59
}
```

---

### Tool 5: `mcp_list_tools_in_category`

**Purpose**: List all tools in a specific category with brief descriptions

**Input Schema**:
```json
{
  "type": "object",
  "properties": {
    "category": {
      "type": "string",
      "description": "Category ID (e.g., 'k8s-workloads', 'k8s-diagnostics')"
    }
  },
  "required": ["category"]
}
```

**Output Format**:
```json
{
  "category": "k8s-diagnostics",
  "name": "Kubernetes Diagnostics",
  "tools": [
    {"name": "k8s_get_pod_logs", "description": "Retrieve logs from a pod", "security": "safe"},
    {"name": "k8s_get_pod_logs_previous", "description": "Retrieve logs from previous container", "security": "safe"},
    {"name": "k8s_get_events", "description": "Get Kubernetes events for debugging", "security": "safe"},
    {"name": "k8s_top_pods", "description": "Get CPU/memory metrics for pods", "security": "safe"},
    {"name": "k8s_top_nodes", "description": "Get CPU/memory metrics for nodes", "security": "safe"},
    {"name": "k8s_get_rollout_status", "description": "Get deployment rollout status", "security": "safe"},
    {"name": "k8s_get_rollout_history", "description": "Get deployment rollout history", "security": "safe"}
  ],
  "tip": "Use mcp_get_tool_schema('tool_name') to get full parameter details"
}
```

---

## Tool Category Definitions

### Category Mapping

| Category ID | Tools |
|-------------|-------|
| `k8s-workloads` | `k8s_list_pods`, `k8s_describe_pod`, `k8s_list_deployments`, `k8s_describe_deployment`, `k8s_list_statefulsets`, `k8s_describe_statefulset`, `k8s_list_daemonsets`, `k8s_describe_daemonset`, `k8s_list_replicasets`, `k8s_describe_replicaset`, `k8s_list_jobs`, `k8s_describe_job`, `k8s_list_cronjobs`, `k8s_describe_cronjob` |
| `k8s-diagnostics` | `k8s_get_pod_logs`, `k8s_get_pod_logs_previous`, `k8s_get_events`, `k8s_top_pods`, `k8s_top_nodes`, `k8s_get_rollout_status`, `k8s_get_rollout_history`, `k8s_get_resource_yaml` |
| `k8s-network` | `k8s_list_services`, `k8s_describe_service`, `k8s_list_ingresses`, `k8s_describe_ingress`, `k8s_list_endpoints`, `k8s_list_network_policies` |
| `k8s-storage` | `k8s_list_persistent_volumes`, `k8s_describe_pv`, `k8s_list_persistent_volume_claims`, `k8s_describe_pvc`, `k8s_list_storage_classes` |
| `k8s-config` | `k8s_list_configmaps`, `k8s_list_secrets`, `k8s_get_resource_counts` |
| `k8s-rbac` | `k8s_list_service_accounts`, `k8s_list_roles`, `k8s_list_role_bindings`, `k8s_list_cluster_roles`, `k8s_list_cluster_role_bindings` |
| `k8s-cluster` | `k8s_list_nodes`, `k8s_describe_node`, `k8s_list_namespaces`, `k8s_list_crds` |
| `k8s-mutations` | `k8s_scale_deployment`, `k8s_restart_deployment` |
| `swarm-resources` | `swarm_list_services`, `swarm_inspect_service`, `swarm_list_tasks`, `swarm_inspect_task`, `swarm_list_nodes`, `swarm_inspect_node`, `swarm_list_stacks`, `swarm_list_networks`, `swarm_list_volumes`, `swarm_list_secrets`, `swarm_list_configs`, `swarm_get_service_logs`, `swarm_get_task_logs` |
| `swarm-mutations` | `swarm_scale_service` |

### Search Keywords Index

```go
var keywordIndex = map[string][]string{
    // Intent-based keywords
    "debug":      {"k8s_get_pod_logs", "k8s_get_events", "k8s_describe_pod"},
    "crash":      {"k8s_get_pod_logs", "k8s_get_pod_logs_previous", "k8s_get_events"},
    "error":      {"k8s_get_pod_logs", "k8s_get_events", "k8s_describe_pod"},
    "failing":    {"k8s_get_pod_logs", "k8s_get_events", "k8s_describe_pod"},
    "restart":    {"k8s_restart_deployment", "k8s_get_events"},
    "scale":      {"k8s_scale_deployment", "swarm_scale_service"},
    "logs":       {"k8s_get_pod_logs", "k8s_get_pod_logs_previous", "swarm_get_service_logs"},
    "metrics":    {"k8s_top_pods", "k8s_top_nodes"},
    "memory":     {"k8s_top_pods", "k8s_top_nodes", "k8s_describe_pod"},
    "cpu":        {"k8s_top_pods", "k8s_top_nodes"},
    "rollout":    {"k8s_get_rollout_status", "k8s_get_rollout_history"},
    "deploy":     {"k8s_list_deployments", "k8s_describe_deployment", "k8s_scale_deployment"},
    "network":    {"k8s_list_services", "k8s_list_ingresses", "k8s_list_network_policies"},
    "storage":    {"k8s_list_persistent_volumes", "k8s_list_persistent_volume_claims"},
    "config":     {"k8s_list_configmaps", "swarm_list_configs"},
    "secret":     {"k8s_list_secrets", "swarm_list_secrets"},

    // Resource-based keywords
    "pod":        {"k8s_list_pods", "k8s_describe_pod", "k8s_get_pod_logs"},
    "deployment": {"k8s_list_deployments", "k8s_describe_deployment", "k8s_scale_deployment"},
    "service":    {"k8s_list_services", "k8s_describe_service", "swarm_list_services"},
    "node":       {"k8s_list_nodes", "k8s_describe_node", "swarm_list_nodes"},
    "ingress":    {"k8s_list_ingresses", "k8s_describe_ingress"},
    "job":        {"k8s_list_jobs", "k8s_describe_job", "k8s_list_cronjobs"},
    "swarm":      {"swarm_list_services", "swarm_list_tasks", "swarm_list_nodes"},
    "stack":      {"swarm_list_stacks"},
    "volume":     {"k8s_list_persistent_volumes", "swarm_list_volumes"},
}
```

---

## Configuration Changes

### Extended MCPConfigData

```go
type MCPConfigData struct {
    // Existing fields...
    Enabled          bool `json:"enabled"`
    Host             string `json:"host"`
    Port             int `json:"port"`
    AllowDestructive bool `json:"allowDestructive"`
    RequireConfirm   bool `json:"requireConfirm"`
    MaxLogLines      int `json:"maxLogLines"`

    // New fields for lazy loading
    ToolDiscoveryMode string `json:"toolDiscoveryMode"` // "lazy" (default) or "full"
}
```

### Mode Behavior

| Mode | `tools/list` Response | Context Cost | Use Case |
|------|----------------------|--------------|----------|
| `lazy` | 5 meta-tools only | ~2,500 tokens | Default - optimized for agents |
| `full` | All 59 tools | ~30,000 tokens | Backward compatibility, debugging |

---

## Internal Data Structures

### ToolRegistryEntry

```go
// ToolRegistryEntry extends ToolDefinition with discovery metadata
type ToolRegistryEntry struct {
    // Existing ToolDefinition fields
    Name        string
    Description string
    Security    OperationSecurity
    InputSchema map[string]interface{}
    Handler     func(ctx context.Context, input map[string]interface{}) (any, error)

    // New discovery metadata
    Category     string   // Category ID
    Keywords     []string // Additional search keywords
    ShortDesc    string   // One-line description for search results
    Examples     []ToolExample // Usage examples
}

type ToolExample struct {
    Description string                 `json:"description"`
    Args        map[string]interface{} `json:"args"`
}

// ToolRegistry manages all registered tools
type ToolRegistry struct {
    tools           map[string]*ToolRegistryEntry
    categoryIndex   map[string][]string      // category -> tool names
    keywordIndex    map[string][]string      // keyword -> tool names
}
```

---

## Agent Workflow Examples

### Example 1: Debug a Crashing Pod

**Task**: "The payment-service pod keeps crashing, help me debug"

```
Agent → mcp_search_tools(query: "pod crash debug logs")

Server → {
  "results": [
    {"name": "k8s_get_pod_logs", "description": "Retrieve logs from a pod", "relevance": 0.95},
    {"name": "k8s_get_pod_logs_previous", "description": "Retrieve logs from previous container", "relevance": 0.92},
    {"name": "k8s_get_events", "description": "Get Kubernetes events", "relevance": 0.85},
    {"name": "k8s_describe_pod", "description": "Get detailed pod information", "relevance": 0.80}
  ]
}

Agent → mcp_get_tool_schema(tool_name: "k8s_get_pod_logs_previous")

Server → {
  "name": "k8s_get_pod_logs_previous",
  "inputSchema": {...},
  "examples": [{"description": "Get crash logs", "args": {"name": "...", "tailLines": 200}}]
}

Agent → mcp_call_tool(tool_name: "k8s_get_pod_logs_previous", arguments: {
  "name": "payment-service-xyz",
  "tailLines": 200
})

Server → {"success": true, "result": "... crash logs ..."}
```

**Total extra tokens**: ~400 (search result + schema) vs ~30,000 upfront

### Example 2: Scale a Deployment

**Task**: "Scale the web-frontend deployment to 5 replicas"

```
Agent → mcp_search_tools(query: "scale deployment replicas")

Server → {
  "results": [
    {"name": "k8s_scale_deployment", "description": "Scale deployment replicas", "security": "write"}
  ]
}

Agent → mcp_get_tool_schema(tool_name: "k8s_scale_deployment")

Server → {
  "inputSchema": {
    "properties": {
      "namespace": {"type": "string"},
      "name": {"type": "string"},
      "replicas": {"type": "integer"}
    },
    "required": ["name", "replicas"]
  }
}

Agent → mcp_call_tool(tool_name: "k8s_scale_deployment", arguments: {
  "name": "web-frontend",
  "replicas": 5
})

Server → {"success": true, "result": {"scaled": true, "replicas": 5}}
```

### Example 3: Browse Available Capabilities

**Task**: "What can you do with Kubernetes?"

```
Agent → mcp_list_categories()

Server → {
  "categories": [
    {"id": "k8s-workloads", "name": "Kubernetes Workloads", "tool_count": 14},
    {"id": "k8s-diagnostics", "name": "Kubernetes Diagnostics", "tool_count": 8},
    ...
  ]
}

Agent → mcp_list_tools_in_category(category: "k8s-diagnostics")

Server → {
  "tools": [
    {"name": "k8s_get_pod_logs", "description": "Retrieve logs from a pod"},
    {"name": "k8s_get_events", "description": "Get Kubernetes events"},
    ...
  ]
}
```

---

## Implementation Phases

### Phase 1: Foundation (2-3 days)

**Objective**: Create core infrastructure without breaking existing functionality

| Task | Effort | Files |
|------|--------|-------|
| Create `ToolRegistry` struct with indexing | 0.5d | `pkg/app/mcp/registry.go` |
| Create `ToolRegistryEntry` with metadata | 0.25d | `pkg/app/mcp/types.go` |
| Add category and keyword definitions | 0.25d | `pkg/app/mcp/categories.go` |
| Migrate existing tools to registry format | 0.5d | `pkg/app/mcp/tools.go` |
| Add `ToolDiscoveryMode` config option | 0.25d | `pkg/app/mcp/config.go` |
| Unit tests for registry | 0.5d | `pkg/app/mcp/registry_test.go` |

**Deliverables**:
- `ToolRegistry` with search, category, and lookup capabilities
- All 59 tools registered with categories and keywords
- Config option to switch modes (default: `lazy`)

### Phase 2: Meta-Tool Implementation (2 days)

**Objective**: Implement the 5 meta-tools

| Task | Effort | Files |
|------|--------|-------|
| Implement `mcp_search_tools` | 0.5d | `pkg/app/mcp/meta_tools.go` |
| Implement `mcp_get_tool_schema` | 0.25d | `pkg/app/mcp/meta_tools.go` |
| Implement `mcp_call_tool` with security | 0.5d | `pkg/app/mcp/meta_tools.go` |
| Implement `mcp_list_categories` | 0.25d | `pkg/app/mcp/meta_tools.go` |
| Implement `mcp_list_tools_in_category` | 0.25d | `pkg/app/mcp/meta_tools.go` |
| Unit tests for all meta-tools | 0.5d | `pkg/app/mcp/meta_tools_test.go` |

**Deliverables**:
- All 5 meta-tools fully functional
- Security checks enforced through `mcp_call_tool`
- Comprehensive unit tests

### Phase 3: Server Integration (1 day)

**Objective**: Integrate mode switching into server

| Task | Effort | Files |
|------|--------|-------|
| Modify `tools/list` handler for mode | 0.25d | `pkg/app/mcp/server.go` |
| Add mode-aware tool registration | 0.25d | `pkg/app/mcp/server.go` |
| Update GUI config to expose mode option | 0.25d | Frontend changes |
| Integration tests | 0.25d | `pkg/app/mcp/server_test.go` |

**Deliverables**:
- `tools/list` returns appropriate tools based on mode
- GUI allows mode switching
- Integration tests verify both modes

### Phase 4: Search Optimization (1 day)

**Objective**: Improve search relevance and performance

| Task | Effort | Files |
|------|--------|-------|
| Implement TF-IDF or similar scoring | 0.25d | `pkg/app/mcp/search.go` |
| Add fuzzy matching for typos | 0.25d | `pkg/app/mcp/search.go` |
| Build inverted index for fast lookup | 0.25d | `pkg/app/mcp/registry.go` |
| Benchmark and optimize | 0.25d | `pkg/app/mcp/search_test.go` |

**Deliverables**:
- Improved search relevance
- Sub-millisecond search performance
- Typo tolerance

### Phase 5: Documentation & Polish (0.5 days)

| Task | Effort | Files |
|------|--------|-------|
| Update CLAUDE.md with new MCP docs | 0.25d | `CLAUDE.md` |
| Add examples to tool descriptions | 0.25d | `pkg/app/mcp/categories.go` |

---

## File Changes Summary

### New Files

| File | Purpose | Lines (est.) |
|------|---------|--------------|
| `pkg/app/mcp/registry.go` | Tool registry with indexing | 200 |
| `pkg/app/mcp/registry_test.go` | Registry unit tests | 300 |
| `pkg/app/mcp/categories.go` | Category and keyword definitions | 150 |
| `pkg/app/mcp/meta_tools.go` | 5 meta-tool implementations | 350 |
| `pkg/app/mcp/meta_tools_test.go` | Meta-tool unit tests | 400 |
| `pkg/app/mcp/search.go` | Search algorithm | 150 |
| `pkg/app/mcp/search_test.go` | Search tests | 200 |

**Total new code**: ~1,750 lines

### Modified Files

| File | Changes |
|------|---------|
| `pkg/app/mcp/types.go` | Add `ToolRegistryEntry`, `ToolExample` types |
| `pkg/app/mcp/config.go` | Add `ToolDiscoveryMode` field |
| `pkg/app/mcp/tools.go` | Migrate to registry-based registration |
| `pkg/app/mcp/server.go` | Mode-aware `tools/list` handler |
| `frontend/src/.../MCPConfigModal.jsx` | Add mode toggle in UI |

---

## Testing Strategy

### Unit Tests

| Test Suite | Coverage Target | Focus |
|------------|-----------------|-------|
| `registry_test.go` | 90% | Tool lookup, category listing, index building |
| `meta_tools_test.go` | 85% | Each meta-tool's happy path and error cases |
| `search_test.go` | 85% | Query parsing, relevance scoring, fuzzy matching |
| `security_test.go` | 90% | Security enforcement through `mcp_call_tool` |

### Integration Tests

| Scenario | Validation |
|----------|------------|
| Lazy mode `tools/list` | Returns only 5 meta-tools |
| Full mode `tools/list` | Returns all 59 tools |
| Search → Schema → Call workflow | End-to-end tool execution |
| Security blocked in lazy mode | Destructive ops require confirmation |
| Mode switching at runtime | Server responds to config changes |

### Performance Benchmarks

| Metric | Target |
|--------|--------|
| `mcp_search_tools` latency | < 5ms for any query |
| `mcp_get_tool_schema` latency | < 1ms |
| `mcp_call_tool` overhead | < 2ms vs direct call |
| Memory for registry | < 1MB |

---

## Rollout Plan

### Stage 1: Internal Testing (Week 1)

- Deploy with `ToolDiscoveryMode: "lazy"` as default
- Test with Claude Code locally
- Gather feedback on search relevance

### Stage 2: Opt-In Beta (Week 2)

- Document mode switching in CLAUDE.md
- Allow users to switch between modes
- Collect feedback on agent workflows

### Stage 3: Default Lazy Mode (Week 3+)

- Make `lazy` the permanent default
- Consider removing `full` mode in future version
- Monitor for issues

---

## Backward Compatibility

### MCP Protocol Compatibility

- No changes to MCP JSON-RPC protocol
- `tools/list` and `tools/call` work identically
- Existing MCP clients work without modification

### Configuration Migration

```go
func migrateConfig(old MCPConfigData) MCPConfigData {
    new := old
    if new.ToolDiscoveryMode == "" {
        new.ToolDiscoveryMode = "lazy" // New default
    }
    return new
}
```

### Full Mode Preservation

Users who prefer the original behavior can set:
```json
{
  "toolDiscoveryMode": "full"
}
```

This returns all 59 tools as before, ensuring no breaking changes for existing workflows.

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Context reduction | > 90% | Compare token counts: lazy vs full mode |
| Search accuracy | > 85% | Manual evaluation: top result relevance |
| Agent task completion | No regression | E2E tests with Claude Code |
| Latency overhead | < 10ms | Benchmark: search + schema + call |
| User adoption | > 80% on lazy mode | Telemetry (if implemented) |

---

## Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Agents struggle with meta-tool pattern | Medium | High | Clear descriptions, examples in schema, fallback to full mode |
| Search returns irrelevant results | Medium | Medium | Keyword aliases, fuzzy matching, relevance tuning |
| Security bypass via `mcp_call_tool` | Low | Critical | Reuse existing `checkSecurity()`, comprehensive tests |
| Performance degradation | Low | Medium | Inverted index, lazy initialization |
| Breaking existing integrations | Low | High | `full` mode preserves exact current behavior |

---

## Appendix: Token Cost Analysis

### Current State (59 tools)

Average tool definition: ~500 tokens
- Name + description: ~100 tokens
- Input schema with properties: ~300 tokens
- Metadata: ~100 tokens

**Total**: 59 × 500 = **~29,500 tokens**

### Target State (5 meta-tools)

| Meta-Tool | Estimated Tokens |
|-----------|-----------------|
| `mcp_search_tools` | 450 |
| `mcp_get_tool_schema` | 350 |
| `mcp_call_tool` | 400 |
| `mcp_list_categories` | 300 |
| `mcp_list_tools_in_category` | 350 |

**Total**: **~1,850 tokens**

### Per-Operation Overhead

When agent needs a tool:
1. Search result: ~50-100 tokens
2. Full schema: ~400 tokens
3. Call overhead: ~50 tokens

**Per-tool overhead**: ~500-550 tokens (loaded only when needed)

### Break-Even Analysis

With lazy loading, agent "pays" ~500 tokens per unique tool used.

- Using 1 tool: 1,850 + 500 = 2,350 tokens (92% savings)
- Using 5 tools: 1,850 + 2,500 = 4,350 tokens (85% savings)
- Using 10 tools: 1,850 + 5,000 = 6,850 tokens (77% savings)
- Using 55+ tools: Break-even with full mode

**Conclusion**: Lazy loading wins for any realistic agent workflow (typically 2-10 tools per task).
