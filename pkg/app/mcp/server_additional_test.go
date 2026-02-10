package mcp

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func newTestServer(t *testing.T, app ServerInterface, cfg MCPConfigData) *MCPServer {
	t.Helper()
	server, err := NewServer(app, cfg)
	if err != nil {
		t.Fatalf("NewServer error: %v", err)
	}
	return server
}

// buildJSONRPCRequest constructs a JSON-RPC 2.0 request as raw bytes.
// This replaces the old mustMarshalJSON helper that depended on the removed jsonRPCRequest type.
func buildJSONRPCRequest(t *testing.T, id interface{}, method string, params ...json.RawMessage) []byte {
	t.Helper()
	req := map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      id,
		"method":  method,
	}
	if len(params) > 0 && params[0] != nil {
		req["params"] = json.RawMessage(params[0])
	}
	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("json.Marshal error: %v", err)
	}
	return data
}

// parseSDKResponse marshals the SDK response interface{} back to JSON
// and unmarshals into a generic map for test assertions.
func parseSDKResponse(t *testing.T, resp interface{}) map[string]interface{} {
	t.Helper()
	if resp == nil {
		t.Fatal("response is nil")
	}
	data, err := json.Marshal(resp)
	if err != nil {
		t.Fatalf("marshal response error: %v", err)
	}
	var result map[string]interface{}
	if err := json.Unmarshal(data, &result); err != nil {
		t.Fatalf("unmarshal response error: %v", err)
	}
	return result
}

func containsString(list []string, value string) bool {
	for _, item := range list {
		if item == value {
			return true
		}
	}
	return false
}

func TestMCPConfig_DefaultsAndCopy(t *testing.T) {
	cfg := DefaultConfig()
	if cfg.Enabled {
		t.Fatal("DefaultConfig Enabled should be false")
	}
	if cfg.Host != "localhost" {
		t.Fatalf("DefaultConfig Host = %q, want %q", cfg.Host, "localhost")
	}
	if cfg.Port != 3000 {
		t.Fatalf("DefaultConfig Port = %d, want 3000", cfg.Port)
	}
	if cfg.AllowDestructive {
		t.Fatal("DefaultConfig AllowDestructive should be false")
	}
	if !cfg.RequireConfirm {
		t.Fatal("DefaultConfig RequireConfirm should be true")
	}
	if cfg.MaxLogLines != 1000 {
		t.Fatalf("DefaultConfig MaxLogLines = %d, want 1000", cfg.MaxLogLines)
	}
	if cfg.IsConfigured() {
		t.Fatal("IsConfigured should be false when Enabled is false")
	}

	cfg.Enabled = true
	if !cfg.IsConfigured() {
		t.Fatal("IsConfigured should be true when Enabled is true")
	}

	clone := cfg.Copy()
	if clone != cfg {
		t.Fatalf("Copy mismatch: got %+v want %+v", clone, cfg)
	}
	if addr := cfg.GetAddress(); addr != "localhost:3000" {
		t.Fatalf("GetAddress = %q, want %q", addr, "localhost:3000")
	}
}

func TestMCPConfig_Validate(t *testing.T) {
	cfg := MCPConfigData{MaxLogLines: 1, Host: "", Port: 0}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate error: %v", err)
	}
	if cfg.MaxLogLines != 10 {
		t.Fatalf("Validate MaxLogLines = %d, want 10", cfg.MaxLogLines)
	}
	if cfg.Host != "localhost" {
		t.Fatalf("Validate Host = %q, want %q", cfg.Host, "localhost")
	}
	if cfg.Port != 3000 {
		t.Fatalf("Validate Port = %d, want 3000", cfg.Port)
	}

	cfg = MCPConfigData{MaxLogLines: 99999, Host: "example.com", Port: 70000}
	if err := cfg.Validate(); err != nil {
		t.Fatalf("Validate error: %v", err)
	}
	if cfg.MaxLogLines != 50000 {
		t.Fatalf("Validate MaxLogLines = %d, want 50000", cfg.MaxLogLines)
	}
	if cfg.Port != 3000 {
		t.Fatalf("Validate Port = %d, want 3000", cfg.Port)
	}
}

func TestMCPSecurity_CheckSecurity(t *testing.T) {
	server := &MCPServer{config: MCPConfigData{AllowDestructive: false, RequireConfirm: true}}
	safeTool := &ToolDefinition{Name: "k8s_list_pods", Security: SecuritySafe}
	if err := server.checkSecurity(safeTool, nil); err != nil {
		t.Fatalf("checkSecurity safe tool error: %v", err)
	}

	scaleTool := &ToolDefinition{Name: "k8s_scale_deployment", Security: SecurityWrite}
	err := server.checkSecurity(scaleTool, map[string]interface{}{"replicas": float64(0)})
	if !errors.Is(err, ErrDestructiveDisabled) {
		t.Fatalf("expected destructive disabled error, got %v", err)
	}

	server.config.AllowDestructive = true
	err = server.checkSecurity(scaleTool, map[string]interface{}{"replicas": float64(0)})
	if !errors.Is(err, ErrConfirmationRequired) {
		t.Fatalf("expected confirmation required error, got %v", err)
	}

	err = server.checkSecurity(scaleTool, map[string]interface{}{
		"replicas":  float64(0),
		"confirmed": true,
	})
	if err != nil {
		t.Fatalf("expected confirmation success, got %v", err)
	}

	destructiveTool := &ToolDefinition{Name: "delete_resource", Security: SecurityDestructive}
	err = server.checkSecurity(destructiveTool, map[string]interface{}{})
	if !errors.Is(err, ErrConfirmationRequired) {
		t.Fatalf("expected confirmation required for destructive tool, got %v", err)
	}
}

func TestMCPSecurity_LevelsAndAllowances(t *testing.T) {
	if got := GetSecurityLevel("k8s_list", nil); got != SecuritySafe {
		t.Fatalf("GetSecurityLevel safe = %v, want %v", got, SecuritySafe)
	}
	if got := GetSecurityLevel("k8s_describe", nil); got != SecuritySafe {
		t.Fatalf("GetSecurityLevel describe = %v, want %v", got, SecuritySafe)
	}
	if got := GetSecurityLevel("k8s_scale_deployment", map[string]interface{}{"replicas": float64(0)}); got != SecurityDestructive {
		t.Fatalf("GetSecurityLevel scale-to-zero = %v, want %v", got, SecurityDestructive)
	}
	if got := GetSecurityLevel("unknown_tool", nil); got != SecurityWrite {
		t.Fatalf("GetSecurityLevel unknown = %v, want %v", got, SecurityWrite)
	}

	server := &MCPServer{config: MCPConfigData{AllowDestructive: false, RequireConfirm: true}}
	allowed := server.AllowedOperations()
	if !containsString(allowed, "read-only operations") {
		t.Fatalf("AllowedOperations missing read-only: %v", allowed)
	}
	if !containsString(allowed, "write operations (except scale-to-zero)") {
		t.Fatalf("AllowedOperations missing write ops: %v", allowed)
	}

	server.config.AllowDestructive = true
	server.config.RequireConfirm = true
	allowed = server.AllowedOperations()
	if !containsString(allowed, "destructive operations (with confirmation)") {
		t.Fatalf("AllowedOperations missing confirmation variant: %v", allowed)
	}
	if containsString(allowed, "destructive operations (without confirmation)") {
		t.Fatalf("AllowedOperations included no-confirm variant unexpectedly: %v", allowed)
	}

	server.config.RequireConfirm = false
	allowed = server.AllowedOperations()
	if !containsString(allowed, "destructive operations (without confirmation)") {
		t.Fatalf("AllowedOperations missing no-confirm variant: %v", allowed)
	}

	if !server.IsOperationAllowed(SecuritySafe, false) {
		t.Fatal("IsOperationAllowed safe should be true")
	}
	if !server.IsOperationAllowed(SecurityWrite, false) {
		t.Fatal("IsOperationAllowed write should be true")
	}
	if !server.IsOperationAllowed(SecurityDestructive, true) {
		t.Fatal("IsOperationAllowed destructive confirmed should be true")
	}
	if server.IsOperationAllowed(OperationSecurity("unknown"), true) {
		t.Fatal("IsOperationAllowed unknown should be false")
	}
}

func TestMCPResources_Handlers(t *testing.T) {
	mock := &mockServerInterface{
		currentContext:      "ctx-1",
		currentNamespace:    "ns-1",
		preferredNamespaces: []string{"ns-1", "ns-2"},
		kubeConfigPath:      "/tmp/kubeconfig",
		namespaces:          []string{"ns-1", "ns-2"},
		swarmConnected:      false,
	}
	cfg := DefaultConfig()
	cfg.Enabled = true
	cfg.AllowDestructive = true
	cfg.RequireConfirm = false
	cfg.MaxLogLines = 500
	server := newTestServer(t, mock, cfg)

	raw, err := server.handleClusterConnection(context.Background())
	if err != nil {
		t.Fatalf("handleClusterConnection error: %v", err)
	}
	info := raw.(ClusterConnectionInfo)
	if info.Context != "ctx-1" || info.Namespace != "ns-1" || info.KubeConfigPath != "/tmp/kubeconfig" {
		t.Fatalf("cluster connection info mismatch: %+v", info)
	}
	if info.SwarmActive {
		t.Fatalf("expected swarm inactive, got %+v", info)
	}

	raw, err = server.handleK8sNamespaces(context.Background())
	if err != nil {
		t.Fatalf("handleK8sNamespaces error: %v", err)
	}
	namespaces := raw.(map[string]interface{})
	if namespaces["current"].(string) != "ns-1" {
		t.Fatalf("current namespace = %v, want ns-1", namespaces["current"])
	}
	if len(namespaces["available"].([]string)) != 2 {
		t.Fatalf("available namespaces = %v, want 2 entries", namespaces["available"])
	}

	raw, err = server.handleK8sContexts(context.Background())
	if err != nil {
		t.Fatalf("handleK8sContexts error: %v", err)
	}
	contexts := raw.(map[string]interface{})
	if contexts["current"].(string) != "ctx-1" {
		t.Fatalf("current context = %v, want ctx-1", contexts["current"])
	}

	raw, err = server.handleSwarmConnection(context.Background())
	if err != nil {
		t.Fatalf("handleSwarmConnection error: %v", err)
	}
	swarm := raw.(map[string]interface{})
	if swarm["connected"].(bool) {
		t.Fatalf("expected swarm disconnected, got %v", swarm)
	}

	mock.swarmConnected = true
	raw, err = server.handleSwarmConnection(context.Background())
	if err != nil {
		t.Fatalf("handleSwarmConnection error: %v", err)
	}
	swarm = raw.(map[string]interface{})
	if !swarm["connected"].(bool) {
		t.Fatalf("expected swarm connected, got %v", swarm)
	}

	raw, err = server.handleMCPConfig(context.Background())
	if err != nil {
		t.Fatalf("handleMCPConfig error: %v", err)
	}
	config := raw.(map[string]interface{})
	if config["enabled"].(bool) != cfg.Enabled {
		t.Fatalf("handleMCPConfig enabled = %v, want %v", config["enabled"], cfg.Enabled)
	}
	if config["maxLogLines"].(int) != cfg.MaxLogLines {
		t.Fatalf("handleMCPConfig maxLogLines = %v, want %v", config["maxLogLines"], cfg.MaxLogLines)
	}
}

// TestMCPServer_HTTPHandlers tests the supplementary HTTP endpoints.
// The /mcp endpoint is handled by the mcp-go SDK's StreamableHTTPServer.
func TestMCPServer_HTTPHandlers(t *testing.T) {
	server := newTestServer(t, &mockServerInterface{}, DefaultConfig())
	server.running = true

	t.Run("root", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		server.handleRoot(recorder, req)
		if !strings.Contains(recorder.Body.String(), "KubeDevBench MCP Server") {
			t.Fatalf("root response missing server name: %s", recorder.Body.String())
		}
	})

	t.Run("health", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		server.handleHealth(recorder, req)
		if !strings.Contains(recorder.Body.String(), "\"running\":true") {
			t.Fatalf("health response missing running true: %s", recorder.Body.String())
		}
	})

	t.Run("health not running", func(t *testing.T) {
		server.running = false
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/health", nil)
		server.handleHealth(recorder, req)
		if !strings.Contains(recorder.Body.String(), "\"running\":false") {
			t.Fatalf("health response missing running false: %s", recorder.Body.String())
		}
		server.running = true
	})
}

// TestMCPServer_HandleMessage tests the handleMessage wrapper around the SDK.
func TestMCPServer_HandleMessage(t *testing.T) {
	server := newTestServer(t, &mockServerInterface{}, DefaultConfig())
	ctx := context.Background()

	t.Run("invalid JSON returns error response", func(t *testing.T) {
		resp, err := server.handleMessage(ctx, []byte("{"))
		if err != nil {
			t.Fatalf("handleMessage should not return Go error (SDK returns errors in response): %v", err)
		}
		parsed := parseSDKResponse(t, resp)
		if parsed["error"] == nil {
			t.Fatal("expected error in response for invalid JSON")
		}
		errObj := parsed["error"].(map[string]interface{})
		code := errObj["code"].(float64)
		if code != -32700 { // Parse error
			t.Fatalf("error code = %v, want -32700 (parse error)", code)
		}
	})

	t.Run("unknown method returns method not found", func(t *testing.T) {
		data := buildJSONRPCRequest(t, 2, "unknown_method")
		resp, err := server.handleMessage(ctx, data)
		if err != nil {
			t.Fatalf("handleMessage error: %v", err)
		}
		parsed := parseSDKResponse(t, resp)
		if parsed["error"] == nil {
			t.Fatal("expected error for unknown method")
		}
		errObj := parsed["error"].(map[string]interface{})
		code := errObj["code"].(float64)
		if code != -32601 { // Method not found
			t.Fatalf("error code = %v, want -32601 (method not found)", code)
		}
	})

	t.Run("initialize succeeds", func(t *testing.T) {
		params := json.RawMessage(`{"protocolVersion":"2025-03-26","capabilities":{},"clientInfo":{"name":"test","version":"1.0"}}`)
		data := buildJSONRPCRequest(t, 1, "initialize", params)
		resp, err := server.handleMessage(ctx, data)
		if err != nil {
			t.Fatalf("handleMessage error: %v", err)
		}
		parsed := parseSDKResponse(t, resp)
		if parsed["error"] != nil {
			t.Fatalf("initialize error: %v", parsed["error"])
		}
		result, ok := parsed["result"].(map[string]interface{})
		if !ok {
			t.Fatalf("initialize result is not a map: %T", parsed["result"])
		}
		serverInfo, ok := result["serverInfo"].(map[string]interface{})
		if !ok {
			t.Fatalf("missing serverInfo in initialize result: %v", result)
		}
		if serverInfo["name"] != "kubedevbench" {
			t.Fatalf("serverInfo name = %v, want kubedevbench", serverInfo["name"])
		}
	})
}

// TestMCPServer_ToolsAndResources tests tool listing, tool calling, resource listing,
// and resource reading through the SDK handleMessage wrapper.
func TestMCPServer_ToolsAndResources(t *testing.T) {
	server := newTestServer(t, &mockServerInterface{}, DefaultConfig())
	ctx := context.Background()

	t.Run("tools/list returns registered tools", func(t *testing.T) {
		data := buildJSONRPCRequest(t, 1, "tools/list")
		resp, err := server.handleMessage(ctx, data)
		if err != nil {
			t.Fatalf("handleMessage error: %v", err)
		}
		parsed := parseSDKResponse(t, resp)
		if parsed["error"] != nil {
			t.Fatalf("tools/list error: %v", parsed["error"])
		}
		result := parsed["result"].(map[string]interface{})
		tools := result["tools"].([]interface{})
		if len(tools) == 0 {
			t.Fatal("tools/list returned empty tool list")
		}
		// Verify tools have expected structure
		firstTool := tools[0].(map[string]interface{})
		if firstTool["name"] == nil {
			t.Fatal("tool missing name field")
		}
		if firstTool["description"] == nil {
			t.Fatal("tool missing description field")
		}
	})

	t.Run("tools/call with valid tool", func(t *testing.T) {
		// Use k8s_list which is registered by default; it calls GetPods on the mock
		params := json.RawMessage(`{"name":"k8s_list","arguments":{"kind":"pods"}}`)
		data := buildJSONRPCRequest(t, 2, "tools/call", params)
		resp, err := server.handleMessage(ctx, data)
		if err != nil {
			t.Fatalf("handleMessage error: %v", err)
		}
		parsed := parseSDKResponse(t, resp)
		if parsed["error"] != nil {
			t.Fatalf("tools/call error: %v", parsed["error"])
		}
		// SDK returns result with content array
		result := parsed["result"].(map[string]interface{})
		content := result["content"].([]interface{})
		if len(content) == 0 {
			t.Fatal("tools/call returned empty content")
		}
		firstContent := content[0].(map[string]interface{})
		if firstContent["type"] != "text" {
			t.Fatalf("content type = %v, want text", firstContent["type"])
		}
	})

	t.Run("tools/call with unknown tool", func(t *testing.T) {
		params := json.RawMessage(`{"name":"nonexistent_tool","arguments":{}}`)
		data := buildJSONRPCRequest(t, 3, "tools/call", params)
		resp, err := server.handleMessage(ctx, data)
		if err != nil {
			t.Fatalf("handleMessage error: %v", err)
		}
		parsed := parseSDKResponse(t, resp)
		if parsed["error"] == nil {
			t.Fatal("expected error for unknown tool")
		}
	})

	t.Run("resources/list returns registered resources", func(t *testing.T) {
		data := buildJSONRPCRequest(t, 4, "resources/list")
		resp, err := server.handleMessage(ctx, data)
		if err != nil {
			t.Fatalf("handleMessage error: %v", err)
		}
		parsed := parseSDKResponse(t, resp)
		if parsed["error"] != nil {
			t.Fatalf("resources/list error: %v", parsed["error"])
		}
		result := parsed["result"].(map[string]interface{})
		resources := result["resources"].([]interface{})
		if len(resources) == 0 {
			t.Fatal("resources/list returned empty list")
		}
		// Verify resources have expected structure
		firstResource := resources[0].(map[string]interface{})
		if firstResource["uri"] == nil {
			t.Fatal("resource missing uri field")
		}
		if firstResource["name"] == nil {
			t.Fatal("resource missing name field")
		}
	})

	t.Run("resources/read cluster connection", func(t *testing.T) {
		params := json.RawMessage(`{"uri":"resource://cluster/connection"}`)
		data := buildJSONRPCRequest(t, 5, "resources/read", params)
		resp, err := server.handleMessage(ctx, data)
		if err != nil {
			t.Fatalf("handleMessage error: %v", err)
		}
		parsed := parseSDKResponse(t, resp)
		if parsed["error"] != nil {
			t.Fatalf("resources/read error: %v", parsed["error"])
		}
		result := parsed["result"].(map[string]interface{})
		contents := result["contents"].([]interface{})
		if len(contents) == 0 {
			t.Fatal("resources/read returned empty contents")
		}
		firstContent := contents[0].(map[string]interface{})
		if firstContent["uri"].(string) != "resource://cluster/connection" {
			t.Fatalf("content uri = %v, want resource://cluster/connection", firstContent["uri"])
		}
	})
}

func TestMCPServer_StartAsyncAndStop(t *testing.T) {
	server := newTestServer(t, &mockServerInterface{}, DefaultConfig())
	server.config.Port = 0

	if err := server.StartAsync(); err != nil {
		t.Fatalf("StartAsync error: %v", err)
	}
	if !server.IsRunning() {
		t.Fatal("IsRunning should be true after StartAsync")
	}
	status := server.GetStatus()
	if !status.Running {
		t.Fatalf("GetStatus Running = false, want true")
	}

	server.Stop()
	if server.IsRunning() {
		t.Fatal("IsRunning should be false after Stop")
	}
}
