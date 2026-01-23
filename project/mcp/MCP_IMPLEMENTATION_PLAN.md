# MCP Server Integration for KubeDevBench

## Overview

Add Model Context Protocol (MCP) server functionality to KubeDevBench, enabling AI assistants (Claude, etc.) to interact with Kubernetes and Docker Swarm clusters for troubleshooting and diagnostics.

**Target Users**: DevOps engineers and software engineers who use AI assistants during development and troubleshooting.

**Approach**: Embedded mode - MCP server runs alongside the GUI, reusing existing cluster connections and operations.

## Implementation Strategy

### Phase 1: Core MCP Infrastructure (Week 1)

Create the foundational MCP server using the official Go SDK, following the Holmes integration pattern.

**Critical Files to Create:**

1. **pkg/app/mcp/server.go**
   - Core MCP server implementation using `github.com/modelcontextprotocol/go-sdk`
   - STDIO transport for local MCP client connections
   - Tool and resource registration
   - Request routing to handlers

2. **pkg/app/mcp/config.go**
   - `MCPConfig` struct with fields:
     - `Enabled bool` - Master on/off switch
     - `AllowDestructive bool` - Enable delete/scale-to-zero operations
     - `RequireConfirm bool` - Require confirmation for destructive ops (default: true)
     - `MaxLogLines int` - Limit log output (default: 1000)
   - `Validate()` method for configuration validation
   - `DefaultConfig()` returning safe defaults (enabled=false, allowDestructive=false, requireConfirm=true)

3. **pkg/app/mcp/types.go**
   - MCP-specific types: `MCPStatus`, tool definitions, response formats
   - Error types for MCP operations
   - Tool input/output schemas

4. **pkg/app/mcp/errors.go**
   - Package-level errors: `ErrNotConfigured`, `ErrDestructiveDisabled`, `ErrConfirmationRequired`

**Critical Files to Modify:**

5. **pkg/app/config.go**
   - Add `MCPConfig mcp.MCPConfig` field to `AppConfig` struct (line 26, after HolmesConfig)
   - Update `loadConfig()` to load MCP config from JSON (after line 55)
   - Update `saveConfig()` to persist MCP config (after line 74)

6. **pkg/app/app_lifecycle.go**
   - Add `initMCP()` call in `Startup()` method after `initHolmes()` (after line 140)
   - Add MCP server shutdown in `Shutdown()` method

7. **go.mod**
   - Add dependency: `github.com/modelcontextprotocol/go-sdk v0.x.x`
   - Run `go mod tidy`

**Tasks:**
- [ ] Add MCP SDK dependency to go.mod
- [ ] Create pkg/app/mcp/ package structure with config.go, types.go, errors.go
- [ ] Implement MCPConfig with validation
- [ ] Add MCPConfig to AppConfig struct
- [ ] Create basic server.go with STDIO transport
- [ ] Write unit tests for config validation
- [ ] Test configuration persistence (load/save)

### Phase 2: Kubernetes Diagnostic Tools (Week 2)

Implement read-only Kubernetes tools prioritized for troubleshooting. All tools delegate to existing `App` methods - no code duplication.

**File to Create:**

8. **pkg/app/mcp/tools.go**
   - Tool definitions with JSON schemas
   - Handler functions that delegate to existing `App` methods
   - Input validation and output formatting

**Priority 1 Tools (Read-Only Diagnostics):**

1. **k8s_list_pods** - List pods in namespace(s)
   - Delegates to: `App.GetPods(namespace)`
   - Input: namespace (optional, defaults to current)
   - Output: Pod list with status, restarts, uptime

2. **k8s_get_pod_logs** - Retrieve pod logs
   - Delegates to: `App.StreamPodLogs(podName)` or `App.StreamPodContainerLogs(podName, container)`
   - Input: namespace, pod name, container (optional), tail lines (default: 1000)
   - Output: Log content (limited by MaxLogLines config)

3. **k8s_get_events** - Get Kubernetes events
   - Delegates to: `App.GetResourceEvents(kind, name, namespace)`
   - Input: namespace (optional), resource type/name (optional)
   - Output: Event list with timestamps and messages

4. **k8s_describe_pod** - Get detailed pod information
   - Delegates to: `App.GetPodDetail(namespace, name)`
   - Input: namespace, pod name
   - Output: Full pod spec and status

5. **k8s_list_deployments** - List deployments
   - Delegates to: `App.GetDeployments(namespace)`
   - Input: namespace (optional)
   - Output: Deployment list with replicas and status

6. **k8s_describe_deployment** - Get detailed deployment info
   - Delegates to: `App.GetDeploymentDetail(namespace, name)`
   - Input: namespace, deployment name
   - Output: Deployment spec with rollout status

7. **k8s_get_resource_counts** - Get resource counts
   - Delegates to: `App.GetResourceCounts()`
   - Output: Aggregated counts of all resource types

**Tasks:**
- [ ] Implement tool schema definitions in tools.go
- [ ] Create handler functions delegating to existing App methods
- [ ] Add input validation for each tool
- [ ] Implement log line limiting (respect MaxLogLines config)
- [ ] Write unit tests for each tool handler
- [ ] Integration test with mock App instance

### Phase 3: Docker Swarm & Resources (Week 2)

Add Docker Swarm diagnostic tools and MCP resources for cluster context.

**Add to pkg/app/mcp/tools.go:**

**Docker Swarm Tools:**

8. **swarm_list_services** - List Swarm services
   - Delegates to: `App.GetSwarmServices()`
   - Output: Service list with replicas and status

9. **swarm_get_service_logs** - Retrieve service logs
   - Delegates to: `App.GetSwarmServiceLogs(serviceID, tail)`
   - Input: service name/ID, tail lines (default: 1000)
   - Output: Service logs (limited by MaxLogLines)

10. **swarm_list_tasks** - List Swarm tasks
    - Delegates to: `App.GetSwarmTasks()` or `App.GetSwarmTasksByService(serviceID)`
    - Input: service name (optional filter)
    - Output: Task list with status

11. **swarm_list_nodes** - List Swarm nodes
    - Delegates to: `App.GetSwarmNodes()`
    - Output: Node list with status and availability

**File to Create:**

12. **pkg/app/mcp/resources.go**
    - Resource providers exposing read-only cluster context
    - Resource handlers

**MCP Resources (Context Providers):**

1. **resource://cluster/connection**
   - Current cluster connection info (K8s or Swarm)
   - Kubeconfig path, context name, namespace
   - Connection type and status

2. **resource://k8s/namespaces**
   - List of available namespaces
   - Current selected namespace(s)

3. **resource://k8s/contexts**
   - Available kubeconfig contexts

4. **resource://swarm/connection**
   - Docker host URL
   - Swarm status

**Tasks:**
- [ ] Implement Docker Swarm tool handlers
- [ ] Create resources.go with context providers
- [ ] Implement resource handlers for connection info
- [ ] Add tests for Swarm tools
- [ ] Add tests for resource providers

### Phase 4: MCP Server Integration (Week 3)

Wire MCP server into the application lifecycle with proper initialization, shutdown, and thread safety.

**File to Create:**

13. **pkg/app/mcp_integration.go**
    - Wails RPC methods for GUI configuration
    - Global MCP server instance with mutex protection
    - Initialization and shutdown logic

**Global State (following Holmes pattern):**
```go
var mcpServer *mcp.MCPServer
var mcpMu sync.RWMutex
var mcpConfig = mcp.DefaultConfig()
```

**Wails RPC Methods:**
- `GetMCPConfig() (*mcp.MCPConfig, error)` - Read current config
- `SetMCPConfig(config mcp.MCPConfig) error` - Update and persist config
- `GetMCPServerStatus() (*mcp.MCPStatus, error)` - Check if server is running
- `StartMCPServer() error` - Manually start server (if not auto-started)
- `StopMCPServer() error` - Manually stop server

**Implementation in mcp_integration.go:**

```go
func (a *App) initMCP() {
    if !mcpConfig.Enabled {
        return // Silent no-op if disabled
    }

    mcpMu.Lock()
    defer mcpMu.Unlock()

    server, err := mcp.NewServer(a, mcpConfig)
    if err != nil {
        fmt.Printf("Failed to initialize MCP server: %v\n", err)
        return // Non-fatal
    }

    mcpServer = server
    go server.Start() // Run in background goroutine
}
```

**Update app_lifecycle.go:**
- Add `a.initMCP()` after `a.initHolmes()` in `Startup()`
- Add MCP server stop in `Shutdown()`:
  ```go
  mcpMu.Lock()
  if mcpServer != nil {
      mcpServer.Stop()
      mcpServer = nil
  }
  mcpMu.Unlock()
  ```

**Tasks:**
- [ ] Create mcp_integration.go with global state
- [ ] Implement Wails RPC methods
- [ ] Implement initMCP() with thread-safe initialization
- [ ] Update Startup() to call initMCP()
- [ ] Update Shutdown() to stop MCP server
- [ ] Write unit tests for RPC methods
- [ ] Test initialization/shutdown lifecycle

### Phase 5: Security & Confirmations (Week 3)

Implement security controls for destructive operations with confirmation system.

**File to Create:**

14. **pkg/app/mcp/security.go**
    - Security level definitions
    - Operation validation
    - Confirmation handling

**Security Implementation:**

```go
type OperationSecurity string

const (
    SecuritySafe        OperationSecurity = "safe"        // Read-only
    SecurityWrite       OperationSecurity = "write"       // Create/update
    SecurityDestructive OperationSecurity = "destructive" // Delete, scale-to-zero
)

type ToolDefinition struct {
    Name        string
    Description string
    Security    OperationSecurity
    Handler     func(context.Context, map[string]interface{}) (interface{}, error)
    InputSchema map[string]interface{}
}

func (s *MCPServer) CheckSecurity(toolName string, input map[string]interface{}) error {
    tool := s.tools[toolName]

    // Block destructive operations if disabled
    if tool.Security == SecurityDestructive && !s.config.AllowDestructive {
        return ErrDestructiveDisabled
    }

    // Check for scale-to-zero
    if toolName == "k8s_scale_deployment" {
        if replicas, ok := input["replicas"].(float64); ok && replicas == 0 {
            if s.config.RequireConfirm {
                return ErrConfirmationRequired
            }
        }
    }

    return nil
}
```

**Priority 2 Tools (Safe Mutations with Confirmation):**

**Add to tools.go:**

15. **k8s_scale_deployment** - Scale deployment replicas
    - Security: `SecurityDestructive` (for scale-to-zero), else `SecurityWrite`
    - Delegates to: `App.ScaleResource("Deployment", namespace, name, replicas)`
    - Input: namespace, deployment name, replicas (int)
    - Validation: Require confirmation if replicas == 0

16. **k8s_restart_deployment** - Restart deployment
    - Security: `SecurityWrite`
    - Delegates to: `App.RestartDeployment(namespace, name)`
    - Input: namespace, deployment name

17. **swarm_scale_service** - Scale Swarm service
    - Security: `SecurityDestructive` (for scale-to-zero), else `SecurityWrite`
    - Delegates to: `App.ScaleSwarmService(serviceID, replicas)`
    - Input: service name/ID, replicas (int)
    - Validation: Require confirmation if replicas == 0

**Tasks:**
- [ ] Create security.go with security level definitions
- [ ] Implement CheckSecurity() validation
- [ ] Add Security field to all tool definitions
- [ ] Implement scale and restart tools with security checks
- [ ] Write security validation tests
- [ ] Test confirmation flow for scale-to-zero

### Phase 6: GUI Configuration UI (Week 3)

Create React components for MCP configuration, following Holmes UI pattern.

**Files to Create:**

18. **frontend/src/mcp/MCPConfigModal.jsx**
    - Configuration modal dialog
    - Enable/disable MCP server toggle
    - Security settings (allow destructive, require confirmation)
    - Max log lines setting
    - Save/cancel buttons

19. **frontend/src/mcp/MCPContext.jsx**
    - React Context for MCP state management
    - State: enabled, configured, loading, error, serverStatus
    - Actions: loadConfig, saveConfig, updateConfig
    - Polling for server status

20. **frontend/src/mcp/mcpApi.js**
    - Wrapper for Wails MCP bindings
    - Type hints via JSDoc
    - Error handling

**UI Components:**

**MCPConfigModal.jsx:**
- Checkbox: "Enable MCP Server"
- Checkbox: "Allow Destructive Operations" (delete, scale-to-zero)
- Checkbox: "Require Confirmation for Destructive Operations" (default: checked)
- Number input: "Max Log Lines" (default: 1000, range: 100-10000)
- Status indicator: "Server Status: Running/Stopped/Error"
- Save/Cancel buttons

**Integration into existing UI:**
- Add "MCP Server" option to Settings menu (or main menu)
- Show MCP status indicator in status bar (optional)

**Tasks:**
- [ ] Create mcpApi.js wrapper for Wails bindings
- [ ] Create MCPContext.jsx with state management
- [ ] Create MCPConfigModal.jsx component
- [ ] Add settings menu entry for MCP configuration
- [ ] Add status polling in MCPContext
- [ ] Write component tests (Vitest)

### Phase 7: Testing & Documentation (Week 4)

Comprehensive testing and documentation for the MCP integration.

**Testing:**

**Unit Tests (Go):**
- `pkg/app/mcp/config_test.go` - Configuration validation
- `pkg/app/mcp/tools_test.go` - Tool handlers with mock App
- `pkg/app/mcp/security_test.go` - Security validation
- `pkg/app/mcp_integration_test.go` - RPC methods

**Integration Tests (Go):**
- Test MCP server startup/shutdown
- Test tool execution with real App instance
- Test security enforcement
- Test configuration persistence

**Frontend Tests (Vitest):**
- `frontend/src/__tests__/mcpConfigModal.test.jsx` - Modal component
- `frontend/src/__tests__/mcpContext.test.jsx` - State management
- Mock Wails bindings using existing `wailsMocks.js` pattern

**E2E Tests (Playwright):**
- `e2e/tests/mcp/01-configure-mcp.spec.ts` - Configuration flow
- `e2e/tests/mcp/02-enable-disable.spec.ts` - Enable/disable server

**Manual Testing:**
- Test with Claude Desktop (requires `claude_desktop_config.json` configuration)
- Verify tool execution from AI assistant
- Test security confirmations

**Documentation:**

21. **docs/MCP_INTEGRATION.md** (new file)
    - Overview of MCP functionality
    - How to enable MCP in KubeDevBench
    - Configuring Claude Desktop (or other MCP clients)
    - Available tools and usage examples
    - Security considerations
    - Troubleshooting

**Example Claude Desktop Configuration:**
```json
{
  "mcpServers": {
    "kubedevbench": {
      "command": "C:\\path\\to\\KubeDevBench.exe",
      "args": ["--mcp-server-embedded"],
      "env": {}
    }
  }
}
```

**Tasks:**
- [ ] Write unit tests (target: 70%+ coverage)
- [ ] Write integration tests
- [ ] Write frontend component tests
- [ ] Write E2E tests for configuration UI
- [ ] Create MCP_INTEGRATION.md documentation
- [ ] Add MCP section to README.md
- [ ] Test with Claude Desktop
- [ ] Verify all tests pass in CI

## Architecture Details

### Tool Handler Pattern

All MCP tools delegate to existing `App` methods - zero code duplication:

```go
// Example: k8s_list_pods handler in tools.go
func (h *ToolHandler) HandleListPods(ctx context.Context, input map[string]interface{}) (interface{}, error) {
    namespace := ""
    if ns, ok := input["namespace"].(string); ok {
        namespace = ns
    }
    if namespace == "" {
        namespace = h.app.GetCurrentNamespace()
    }

    // Delegate to existing method
    return h.app.GetPods(namespace)
}
```

### Thread Safety

Following Holmes pattern with mutex-protected global state:

```go
var mcpServer *mcp.MCPServer
var mcpMu sync.RWMutex

// Read lock for status checks
mcpMu.RLock()
server := mcpServer
mcpMu.RUnlock()

// Write lock for initialization/shutdown
mcpMu.Lock()
mcpServer = newServer
mcpMu.Unlock()
```

### Configuration Persistence

MCP config stored in `~/KubeDevBench/config.json` alongside Holmes config:

```json
{
  "currentContext": "prod-cluster",
  "holmesConfig": {...},
  "mcpConfig": {
    "enabled": true,
    "allowDestructive": false,
    "requireConfirm": true,
    "maxLogLines": 1000
  }
}
```

## Security Model

**Three-Tier Security:**

1. **Configuration Level**: `allowDestructive` flag blocks all destructive operations
2. **Tool Level**: Each tool tagged with security level (safe/write/destructive)
3. **Runtime Level**: Confirmation required for scale-to-zero and delete operations

**Default Settings (Safe by Default):**
- Enabled: false (user must explicitly enable)
- AllowDestructive: false (blocks delete/scale-to-zero)
- RequireConfirm: true (requires confirmation for destructive ops when enabled)

## MCP Protocol Details

**Transport**: STDIO (standard for local MCP integrations)

**SDK**: `github.com/modelcontextprotocol/go-sdk` (official Google-maintained SDK)

**Message Format**: JSON-RPC 2.0 over STDIO

**Tool Schema Example**:
```json
{
  "name": "k8s_list_pods",
  "description": "List pods in a Kubernetes namespace. Returns pod name, status, restarts, and uptime.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "namespace": {
        "type": "string",
        "description": "Namespace to list pods from. Omit for current namespace."
      }
    }
  }
}
```

## Verification Steps

After implementation, verify:

1. **Configuration**:
   - [ ] MCP config persists across app restarts
   - [ ] Config UI loads and saves correctly
   - [ ] Enable/disable toggle works

2. **Server Lifecycle**:
   - [ ] MCP server starts with app when enabled
   - [ ] Server stops cleanly on shutdown
   - [ ] No resource leaks or goroutine leaks

3. **Tools**:
   - [ ] All read-only tools return correct data
   - [ ] Tools respect current namespace context
   - [ ] Log tools respect MaxLogLines limit
   - [ ] Scale/restart tools work correctly

4. **Security**:
   - [ ] Destructive operations blocked when disabled
   - [ ] Confirmation required for scale-to-zero
   - [ ] Security checks enforced for all tools

5. **Integration**:
   - [ ] Claude Desktop can connect via STDIO
   - [ ] AI assistant can call tools successfully
   - [ ] Resources provide correct context
   - [ ] Error messages are clear and actionable

6. **Testing**:
   - [ ] Unit test coverage ≥70%
   - [ ] All E2E tests pass
   - [ ] CI pipeline passes

## Success Criteria

Implementation complete when:
- MCP server starts automatically with KubeDevBench GUI (when enabled)
- Claude Desktop can connect and call all Priority 1 & 2 tools
- Configuration persists and reloads correctly
- Security controls work as designed (confirmation for destructive ops)
- All tests pass with ≥70% coverage
- Documentation is complete and accurate

## Future Enhancements (Post-Phase 7)

Consider for future phases:
- Headless mode (CLI flag `--mcp-server`)
- Advanced tools (Helm, kubectl exec, manifest apply)
- Delete operations with strong safeguards
- Port-forward tool for interactive debugging
- Audit logging of all MCP operations
- Rate limiting for AI assistant calls
- Multiple simultaneous MCP clients
- HTTP/SSE transport for remote access

## Critical Files Summary

**New Files to Create** (14 files):
1. pkg/app/mcp/server.go
2. pkg/app/mcp/config.go
3. pkg/app/mcp/types.go
4. pkg/app/mcp/errors.go
5. pkg/app/mcp/tools.go
6. pkg/app/mcp/resources.go
7. pkg/app/mcp/security.go
8. pkg/app/mcp_integration.go
9. frontend/src/mcp/mcpApi.js
10. frontend/src/mcp/MCPContext.jsx
11. frontend/src/mcp/MCPConfigModal.jsx
12. docs/MCP_INTEGRATION.md
13. [Various test files]

**Files to Modify** (4 files):
1. pkg/app/config.go - Add MCPConfig field
2. pkg/app/app_lifecycle.go - Add initMCP() call
3. go.mod - Add MCP SDK dependency
4. README.md - Add MCP section

## Implementation Timeline

- **Week 1**: Core infrastructure (config, types, basic server)
- **Week 2**: Kubernetes & Swarm tools, resources
- **Week 3**: Integration, security, GUI configuration
- **Week 4**: Testing, documentation, polish

**Total Effort**: ~4 weeks for complete implementation
