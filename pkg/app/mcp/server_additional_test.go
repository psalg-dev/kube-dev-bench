package mcp

import (
	"bytes"
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

func mustMarshalJSON(t *testing.T, req jsonRPCRequest) []byte {
	t.Helper()
	data, err := json.Marshal(req)
	if err != nil {
		t.Fatalf("json.Marshal error: %v", err)
	}
	return data
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
	if got := GetSecurityLevel("k8s_list_pods", nil); got != SecuritySafe {
		t.Fatalf("GetSecurityLevel safe = %v, want %v", got, SecuritySafe)
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

	t.Run("mcp method not allowed", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/mcp", nil)
		server.handleMCP(recorder, req)
		if recorder.Code != http.StatusMethodNotAllowed {
			t.Fatalf("handleMCP status = %d, want %d", recorder.Code, http.StatusMethodNotAllowed)
		}
	})

	t.Run("mcp invalid json", func(t *testing.T) {
		recorder := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/mcp", bytes.NewBufferString("{"))
		server.handleMCP(recorder, req)
		var resp jsonRPCResponse
		if err := json.NewDecoder(recorder.Body).Decode(&resp); err != nil {
			t.Fatalf("decode error response: %v", err)
		}
		if resp.Error == nil || !strings.Contains(resp.Error.Message, "invalid JSON-RPC request") {
			t.Fatalf("unexpected error response: %+v", resp.Error)
		}
	})
}

func TestMCPServer_HandleMessage(t *testing.T) {
	server := newTestServer(t, &mockServerInterface{}, DefaultConfig())
	ctx := context.Background()

	_, err := server.handleMessage(ctx, []byte("{"))
	if err == nil {
		t.Fatal("expected invalid JSON error")
	}

	invalidVersion := jsonRPCRequest{JSONRPC: "1.0", ID: 1, Method: "ping"}
	_, err = server.handleMessage(ctx, mustMarshalJSON(t, invalidVersion))
	if err == nil {
		t.Fatal("expected invalid JSON-RPC version error")
	}

	pingReq := jsonRPCRequest{JSONRPC: "2.0", ID: 1, Method: "ping"}
	resp, err := server.handleMessage(ctx, mustMarshalJSON(t, pingReq))
	if err != nil {
		t.Fatalf("ping handleMessage error: %v", err)
	}
	result := resp.Result.(map[string]string)
	if result["status"] != "ok" {
		t.Fatalf("ping result = %v, want ok", result["status"])
	}

	unknownReq := jsonRPCRequest{JSONRPC: "2.0", ID: 2, Method: "unknown"}
	resp, err = server.handleMessage(ctx, mustMarshalJSON(t, unknownReq))
	if err != nil {
		t.Fatalf("unknown handleMessage error: %v", err)
	}
	if resp.Error == nil || resp.Error.Code != -32601 {
		t.Fatalf("unknown method error = %+v, want code -32601", resp.Error)
	}
}

func TestMCPServer_ToolsAndResources(t *testing.T) {
	server := newTestServer(t, &mockServerInterface{}, DefaultConfig())
	ctx := context.Background()

	toolsReq := jsonRPCRequest{JSONRPC: "2.0", ID: 1, Method: "tools/list"}
	resp, err := server.handleMessage(ctx, mustMarshalJSON(t, toolsReq))
	if err != nil {
		t.Fatalf("tools/list error: %v", err)
	}
	tools := resp.Result.(map[string]interface{})["tools"].([]map[string]interface{})
	if len(tools) == 0 {
		t.Fatal("tools/list returned empty tool list")
	}

	invalidToolCall := jsonRPCRequest{
		JSONRPC: "2.0",
		ID:      2,
		Method:  "tools/call",
		Params:  json.RawMessage("[]"),
	}
	resp, err = server.handleMessage(ctx, mustMarshalJSON(t, invalidToolCall))
	if err != nil {
		t.Fatalf("invalid tools/call error: %v", err)
	}
	if resp.Error == nil || resp.Error.Code != -32602 {
		t.Fatalf("invalid tools/call response = %+v, want code -32602", resp.Error)
	}

	server.tools["unit_test_tool"] = &ToolDefinition{
		Name:     "unit_test_tool",
		Security: SecuritySafe,
		Handler: func(ctx context.Context, input map[string]interface{}) (any, error) {
			return map[string]string{"status": "ok"}, nil
		},
	}
	toolCall := jsonRPCRequest{
		JSONRPC: "2.0",
		ID:      3,
		Method:  "tools/call",
		Params:  json.RawMessage(`{"name":"unit_test_tool","arguments":{"key":"value"}}`),
	}
	resp, err = server.handleMessage(ctx, mustMarshalJSON(t, toolCall))
	if err != nil {
		t.Fatalf("tools/call error: %v", err)
	}
	if resp.Error != nil {
		t.Fatalf("tools/call response error = %+v", resp.Error)
	}

	resourceListReq := jsonRPCRequest{JSONRPC: "2.0", ID: 4, Method: "resources/list"}
	resp, err = server.handleMessage(ctx, mustMarshalJSON(t, resourceListReq))
	if err != nil {
		t.Fatalf("resources/list error: %v", err)
	}
	resources := resp.Result.(map[string]interface{})["resources"].([]map[string]interface{})
	if len(resources) == 0 {
		t.Fatal("resources/list returned empty list")
	}

	resourceReadReq := jsonRPCRequest{
		JSONRPC: "2.0",
		ID:      5,
		Method:  "resources/read",
		Params:  json.RawMessage(`{"uri":"resource://cluster/connection"}`),
	}
	resp, err = server.handleMessage(ctx, mustMarshalJSON(t, resourceReadReq))
	if err != nil {
		t.Fatalf("resources/read error: %v", err)
	}
	if resp.Error != nil {
		t.Fatalf("resources/read response error = %+v", resp.Error)
	}
	contents := resp.Result.(map[string]interface{})["contents"].([]map[string]interface{})
	if len(contents) != 1 {
		t.Fatalf("resources/read contents length = %d, want 1", len(contents))
	}
	if contents[0]["uri"].(string) != "resource://cluster/connection" {
		t.Fatalf("resources/read uri = %v, want resource://cluster/connection", contents[0]["uri"])
	}
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
