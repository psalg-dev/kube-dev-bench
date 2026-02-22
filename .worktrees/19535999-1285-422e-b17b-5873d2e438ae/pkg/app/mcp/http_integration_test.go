package mcp

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	mcpclient "github.com/mark3labs/mcp-go/client"
	mcpsdk "github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

// TestMCPHTTP_HealthEndpoint tests the /health endpoint over HTTP.
func TestMCPHTTP_HealthEndpoint(t *testing.T) {
	ts := newMCPTestHTTPServer(t)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/health")
	if err != nil {
		t.Fatalf("GET /health failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode /health response: %v", err)
	}

	if body["status"] != "ok" {
		t.Errorf("expected status 'ok', got %q", body["status"])
	}
}

// TestMCPHTTP_RootEndpoint tests the / server info endpoint.
func TestMCPHTTP_RootEndpoint(t *testing.T) {
	ts := newMCPTestHTTPServer(t)
	defer ts.Close()

	resp, err := http.Get(ts.URL + "/")
	if err != nil {
		t.Fatalf("GET / failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		t.Errorf("expected 200, got %d", resp.StatusCode)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode / response: %v", err)
	}

	if body["name"] != "KubeDevBench MCP Server" {
		t.Errorf("expected name 'KubeDevBench MCP Server', got %q", body["name"])
	}
}

// TestMCPHTTP_Initialize tests MCP protocol initialization over HTTP.
func TestMCPHTTP_Initialize(t *testing.T) {
	ts := newMCPTestHTTPServer(t)
	defer ts.Close()

	client := newMCPHTTPClient(t, ts.URL)
	defer client.Close()

	ctx := context.Background()
	if err := client.Start(ctx); err != nil {
		t.Fatalf("client.Start failed: %v", err)
	}

	initReq := mcpsdk.InitializeRequest{}
	initReq.Params.ProtocolVersion = mcpsdk.LATEST_PROTOCOL_VERSION
	initReq.Params.ClientInfo = mcpsdk.Implementation{
		Name:    "http-integration-test",
		Version: "1.0.0",
	}

	result, err := client.Initialize(ctx, initReq)
	if err != nil {
		t.Fatalf("Initialize failed: %v", err)
	}

	if result.ServerInfo.Name != "kubedevbench" {
		t.Errorf("expected server name 'kubedevbench', got %q", result.ServerInfo.Name)
	}
}

// TestMCPHTTP_ListTools verifies tools are discoverable over HTTP.
func TestMCPHTTP_ListTools(t *testing.T) {
	client := newMCPInitializedHTTPClient(t)
	defer client.Close()

	result, err := client.ListTools(context.Background(), mcpsdk.ListToolsRequest{})
	if err != nil {
		t.Fatalf("ListTools failed: %v", err)
	}

	if len(result.Tools) != 14 {
		t.Errorf("expected 14 tools, got %d", len(result.Tools))
	}

	for _, tool := range result.Tools {
		if tool.Name == "" {
			t.Error("tool has empty name")
		}
		if tool.Description == "" {
			t.Errorf("tool %q has empty description", tool.Name)
		}
	}
}

// TestMCPHTTP_ListResources verifies resources are discoverable over HTTP.
func TestMCPHTTP_ListResources(t *testing.T) {
	client := newMCPInitializedHTTPClient(t)
	defer client.Close()

	result, err := client.ListResources(context.Background(), mcpsdk.ListResourcesRequest{})
	if err != nil {
		t.Fatalf("ListResources failed: %v", err)
	}

	if len(result.Resources) != 5 {
		t.Errorf("expected 5 resources, got %d", len(result.Resources))
	}
}

// TestMCPHTTP_CallTool_K8sList exercises k8s_list over HTTP.
func TestMCPHTTP_CallTool_K8sList(t *testing.T) {
	client := newMCPInitializedHTTPClient(t)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_list"
	req.Params.Arguments = map[string]interface{}{
		"kind": "pods",
	}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool k8s_list failed: %v", err)
	}

	if result.IsError {
		t.Error("expected successful result for k8s_list")
	}

	if len(result.Content) == 0 {
		t.Error("expected non-empty content")
	}
}

// TestMCPHTTP_CallTool_K8sDescribe exercises k8s_describe over HTTP.
func TestMCPHTTP_CallTool_K8sDescribe(t *testing.T) {
	client := newMCPInitializedHTTPClient(t)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_describe"
	req.Params.Arguments = map[string]interface{}{
		"kind":      "deployment",
		"name":      "test-deploy",
		"namespace": "default",
	}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool k8s_describe failed: %v", err)
	}

	if result.IsError {
		t.Error("expected successful result for k8s_describe")
	}
}

// TestMCPHTTP_ReadResource tests resource reads over HTTP.
func TestMCPHTTP_ReadResource(t *testing.T) {
	client := newMCPInitializedHTTPClient(t)
	defer client.Close()

	resources := []string{
		"resource://cluster/connection",
		"resource://k8s/namespaces",
		"resource://k8s/contexts",
		"resource://swarm/connection",
		"resource://mcp/config",
	}

	for _, uri := range resources {
		t.Run(uri, func(t *testing.T) {
			req := mcpsdk.ReadResourceRequest{}
			req.Params.URI = uri

			result, err := client.ReadResource(context.Background(), req)
			if err != nil {
				t.Fatalf("ReadResource %s failed: %v", uri, err)
			}

			if len(result.Contents) == 0 {
				t.Errorf("expected non-empty content for %s", uri)
			}
		})
	}
}

// TestMCPHTTP_SecurityBlocking tests security enforcement over HTTP.
func TestMCPHTTP_SecurityBlocking(t *testing.T) {
	client := newMCPInitializedHTTPClient(t)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_scale_deployment"
	req.Params.Arguments = map[string]interface{}{
		"name":      "test-deploy",
		"namespace": "default",
		"replicas":  float64(0),
	}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool failed: %v", err)
	}

	if !result.IsError {
		t.Error("expected scale-to-zero to be blocked with default config")
	}
}

// TestMCPHTTP_RawJSONRPC tests sending a raw JSON-RPC request to /mcp.
func TestMCPHTTP_RawJSONRPC(t *testing.T) {
	ts := newMCPTestHTTPServer(t)
	defer ts.Close()

	payload := `{
		"jsonrpc": "2.0",
		"id": 1,
		"method": "initialize",
		"params": {
			"protocolVersion": "` + mcpsdk.LATEST_PROTOCOL_VERSION + `",
			"clientInfo": {"name": "raw-test", "version": "1.0"}
		}
	}`

	resp, err := http.Post(ts.URL+"/mcp", "application/json", strings.NewReader(payload))
	if err != nil {
		t.Fatalf("POST /mcp failed: %v", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		t.Fatalf("expected 200, got %d: %s", resp.StatusCode, body)
	}

	var result map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	resultMap, ok := result["result"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'result' object, got %T", result["result"])
	}

	serverInfo, ok := resultMap["serverInfo"].(map[string]interface{})
	if !ok {
		t.Fatalf("expected 'serverInfo' object, got %T", resultMap["serverInfo"])
	}

	if serverInfo["name"] != "kubedevbench" {
		t.Errorf("expected server name 'kubedevbench', got %q", serverInfo["name"])
	}
}

// ─── Helpers ────────────────────────────────────────────────────────────────

// newMCPTestHTTPServer creates an httptest.Server with the full MCP server stack.
func newMCPTestHTTPServer(t *testing.T) *httptest.Server {
	t.Helper()

	mock := &mockServerInterface{swarmConnected: true}
	server, err := NewServer(mock, DefaultConfig())
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}

	streamableHTTP := mcpserver.NewStreamableHTTPServer(server.sdkServer,
		mcpserver.WithEndpointPath("/mcp"),
		mcpserver.WithStateLess(true),
	)

	mux := http.NewServeMux()
	mux.HandleFunc("/health", server.handleHealth)
	mux.HandleFunc("/", server.handleRoot)
	mux.Handle("/mcp", streamableHTTP)

	return httptest.NewServer(mux)
}

// newMCPHTTPClient creates a StreamableHTTP MCP client pointed at the test server.
func newMCPHTTPClient(t *testing.T, baseURL string) *mcpclient.Client {
	t.Helper()

	client, err := mcpclient.NewStreamableHttpClient(baseURL + "/mcp")
	if err != nil {
		t.Fatalf("NewStreamableHttpClient failed: %v", err)
	}

	return client
}

// newMCPInitializedHTTPClient creates a fully initialized HTTP MCP client.
func newMCPInitializedHTTPClient(t *testing.T) *mcpclient.Client {
	t.Helper()

	ts := newMCPTestHTTPServer(t)
	t.Cleanup(ts.Close)

	client := newMCPHTTPClient(t, ts.URL)
	ctx := context.Background()

	if err := client.Start(ctx); err != nil {
		t.Fatalf("client.Start failed: %v", err)
	}

	initReq := mcpsdk.InitializeRequest{}
	initReq.Params.ProtocolVersion = mcpsdk.LATEST_PROTOCOL_VERSION
	initReq.Params.ClientInfo = mcpsdk.Implementation{
		Name:    "http-integration-test",
		Version: "1.0.0",
	}

	if _, err := client.Initialize(ctx, initReq); err != nil {
		t.Fatalf("Initialize failed: %v", err)
	}

	return client
}
