package mcp

import (
	"context"
	"testing"

	mcpclient "github.com/mark3labs/mcp-go/client"
	mcpsdk "github.com/mark3labs/mcp-go/mcp"
)

// TestMCPInProcess_Initialize verifies the full MCP handshake via an in-process client.
func TestMCPInProcess_Initialize(t *testing.T) {
	mock := &mockServerInterface{}
	server, err := NewServer(mock, DefaultConfig())
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}

	client, err := mcpclient.NewInProcessClient(server.sdkServer)
	if err != nil {
		t.Fatalf("NewInProcessClient failed: %v", err)
	}
	defer client.Close()

	ctx := context.Background()
	if err := client.Start(ctx); err != nil {
		t.Fatalf("client.Start failed: %v", err)
	}

	initReq := mcpsdk.InitializeRequest{}
	initReq.Params.ProtocolVersion = mcpsdk.LATEST_PROTOCOL_VERSION
	initReq.Params.ClientInfo = mcpsdk.Implementation{
		Name:    "integration-test",
		Version: "1.0.0",
	}

	result, err := client.Initialize(ctx, initReq)
	if err != nil {
		t.Fatalf("Initialize failed: %v", err)
	}

	if result.ServerInfo.Name != "kubedevbench" {
		t.Errorf("expected server name 'kubedevbench', got %q", result.ServerInfo.Name)
	}
	if result.ServerInfo.Version != "1.0.0" {
		t.Errorf("expected server version '1.0.0', got %q", result.ServerInfo.Version)
	}
}

// TestMCPInProcess_Ping tests the MCP ping mechanism.
func TestMCPInProcess_Ping(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	if err := client.Ping(context.Background()); err != nil {
		t.Errorf("Ping failed: %v", err)
	}
}

// TestMCPInProcess_ListTools verifies all 16 tools are discoverable.
func TestMCPInProcess_ListTools(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	result, err := client.ListTools(context.Background(), mcpsdk.ListToolsRequest{})
	if err != nil {
		t.Fatalf("ListTools failed: %v", err)
	}

	expectedTools := []string{
		"k8s_list", "k8s_describe", "k8s_get_resource_yaml", "k8s_get_pod_logs",
		"k8s_get_events", "k8s_get_resource_counts", "k8s_top", "k8s_rollout",
		"k8s_scale_deployment", "k8s_restart_deployment",
		"k8s_restart_statefulset", "k8s_restart_daemonset",
		"swarm_list", "swarm_inspect", "swarm_get_service_logs", "swarm_scale_service",
	}

	if len(result.Tools) != len(expectedTools) {
		t.Fatalf("expected %d tools, got %d", len(expectedTools), len(result.Tools))
	}

	toolNames := make(map[string]bool, len(result.Tools))
	for _, tool := range result.Tools {
		toolNames[tool.Name] = true
	}

	for _, name := range expectedTools {
		if !toolNames[name] {
			t.Errorf("expected tool %q not found in ListTools result", name)
		}
	}
}

// TestMCPInProcess_ListResources verifies all 5 resources are discoverable.
func TestMCPInProcess_ListResources(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	result, err := client.ListResources(context.Background(), mcpsdk.ListResourcesRequest{})
	if err != nil {
		t.Fatalf("ListResources failed: %v", err)
	}

	expectedResources := []string{
		"resource://cluster/connection",
		"resource://k8s/namespaces",
		"resource://k8s/contexts",
		"resource://swarm/connection",
		"resource://mcp/config",
	}

	if len(result.Resources) != len(expectedResources) {
		t.Fatalf("expected %d resources, got %d", len(expectedResources), len(result.Resources))
	}

	resourceURIs := make(map[string]bool, len(result.Resources))
	for _, res := range result.Resources {
		resourceURIs[res.URI] = true
	}

	for _, uri := range expectedResources {
		if !resourceURIs[uri] {
			t.Errorf("expected resource %q not found in ListResources result", uri)
		}
	}
}

// TestMCPInProcess_CallTool_K8sList exercises the k8s_list tool via MCP client.
func TestMCPInProcess_CallTool_K8sList(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	tests := []struct {
		name string
		kind string
	}{
		{"list pods", "pods"},
		{"list deployments", "deployments"},
		{"list services", "services"},
		{"list configmaps", "configmaps"},
		{"list secrets", "secrets"},
		{"list nodes", "nodes"},
		{"list statefulsets", "statefulsets"},
		{"list daemonsets", "daemonsets"},
		{"list jobs", "jobs"},
		{"list cronjobs", "cronjobs"},
		{"list ingresses", "ingresses"},
		{"list replicasets", "replicasets"},
		{"list persistent_volumes", "persistent_volumes"},
		{"list persistent_volume_claims", "persistent_volume_claims"},
		{"list storage_classes", "storage_classes"},
		{"list cluster_roles", "cluster_roles"},
		{"list cluster_role_bindings", "cluster_role_bindings"},
		{"list crds", "crds"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := mcpsdk.CallToolRequest{}
			req.Params.Name = "k8s_list"
			req.Params.Arguments = map[string]interface{}{
				"kind": tc.kind,
			}

			result, err := client.CallTool(context.Background(), req)
			if err != nil {
				t.Fatalf("CallTool k8s_list(%s) failed: %v", tc.kind, err)
			}

			if result.IsError {
				t.Errorf("CallTool k8s_list(%s) returned error result", tc.kind)
			}

			if len(result.Content) == 0 {
				t.Errorf("CallTool k8s_list(%s) returned empty content", tc.kind)
			}
		})
	}
}

// TestMCPInProcess_CallTool_K8sDescribe exercises the k8s_describe tool.
func TestMCPInProcess_CallTool_K8sDescribe(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_describe"
	req.Params.Arguments = map[string]interface{}{
		"kind":      "pod",
		"name":      "test-pod",
		"namespace": "default",
	}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool k8s_describe failed: %v", err)
	}

	if result.IsError {
		t.Errorf("CallTool k8s_describe returned error result")
	}
}

// TestMCPInProcess_CallTool_K8sGetResourceYAML exercises the YAML tool.
func TestMCPInProcess_CallTool_K8sGetResourceYAML(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_get_resource_yaml"
	req.Params.Arguments = map[string]interface{}{
		"kind":      "pod",
		"name":      "test-pod",
		"namespace": "default",
	}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool k8s_get_resource_yaml failed: %v", err)
	}

	if result.IsError {
		t.Errorf("CallTool k8s_get_resource_yaml returned error result")
	}
}

// TestMCPInProcess_CallTool_K8sGetPodLogs exercises the pod logs tool.
func TestMCPInProcess_CallTool_K8sGetPodLogs(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_get_pod_logs"
	req.Params.Arguments = map[string]interface{}{
		"name":      "test-pod",
		"namespace": "default",
		"lines":     float64(100),
	}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool k8s_get_pod_logs failed: %v", err)
	}

	if result.IsError {
		t.Errorf("CallTool k8s_get_pod_logs returned error result")
	}
}

// TestMCPInProcess_CallTool_K8sGetEvents exercises the events tool.
func TestMCPInProcess_CallTool_K8sGetEvents(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_get_events"
	req.Params.Arguments = map[string]interface{}{
		"namespace": "default",
	}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool k8s_get_events failed: %v", err)
	}

	if result.IsError {
		t.Errorf("CallTool k8s_get_events returned error result")
	}
}

// TestMCPInProcess_CallTool_K8sGetResourceCounts exercises the resource counts tool.
func TestMCPInProcess_CallTool_K8sGetResourceCounts(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_get_resource_counts"
	req.Params.Arguments = map[string]interface{}{}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool k8s_get_resource_counts failed: %v", err)
	}

	if result.IsError {
		t.Errorf("CallTool k8s_get_resource_counts returned error result")
	}
}

// TestMCPInProcess_CallTool_K8sTop exercises the top tool.
func TestMCPInProcess_CallTool_K8sTop(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	for _, kind := range []string{"pods", "nodes"} {
		t.Run(kind, func(t *testing.T) {
			req := mcpsdk.CallToolRequest{}
			req.Params.Name = "k8s_top"
			req.Params.Arguments = map[string]interface{}{
				"kind": kind,
			}

			result, err := client.CallTool(context.Background(), req)
			if err != nil {
				t.Fatalf("CallTool k8s_top(%s) failed: %v", kind, err)
			}

			if result.IsError {
				t.Errorf("CallTool k8s_top(%s) returned error result", kind)
			}
		})
	}
}

// TestMCPInProcess_CallTool_K8sRollout exercises the rollout tool.
func TestMCPInProcess_CallTool_K8sRollout(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	tests := []struct {
		name   string
		action string
		kind   string
	}{
		{"status Deployment", "status", "Deployment"},
		{"history Deployment", "history", "Deployment"},
		{"status StatefulSet", "status", "StatefulSet"},
		{"status DaemonSet", "status", "DaemonSet"},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			req := mcpsdk.CallToolRequest{}
			req.Params.Name = "k8s_rollout"
			req.Params.Arguments = map[string]interface{}{
				"action":    tc.action,
				"kind":      tc.kind,
				"name":      "test-deployment",
				"namespace": "default",
			}

			result, err := client.CallTool(context.Background(), req)
			if err != nil {
				t.Fatalf("CallTool k8s_rollout failed: %v", err)
			}

			if result.IsError {
				t.Errorf("CallTool k8s_rollout returned error result")
			}
		})
	}
}

// TestMCPInProcess_CallTool_ScaleDeployment exercises the scale tool.
func TestMCPInProcess_CallTool_ScaleDeployment(t *testing.T) {
	config := DefaultConfig()
	config.AllowDestructive = true
	config.RequireConfirm = false

	mock := &mockServerInterface{}
	server, err := NewServer(mock, config)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}

	client := initializeClient(t, server)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_scale_deployment"
	req.Params.Arguments = map[string]interface{}{
		"name":      "test-deployment",
		"namespace": "default",
		"replicas":  float64(3),
	}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool k8s_scale_deployment failed: %v", err)
	}

	if result.IsError {
		t.Errorf("CallTool k8s_scale_deployment returned error result")
	}
}

// TestMCPInProcess_CallTool_ScaleToZero_Blocked verifies destructive ops are blocked by default.
func TestMCPInProcess_CallTool_ScaleToZero_Blocked(t *testing.T) {
	config := DefaultConfig()
	config.AllowDestructive = false

	mock := &mockServerInterface{}
	server, err := NewServer(mock, config)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}

	client := initializeClient(t, server)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_scale_deployment"
	req.Params.Arguments = map[string]interface{}{
		"name":      "test-deployment",
		"namespace": "default",
		"replicas":  float64(0),
	}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool failed: %v", err)
	}

	// Should get error in result (not transport error) because destructive is disabled
	if !result.IsError {
		t.Error("expected scale-to-zero to be blocked with AllowDestructive=false")
	}
}

// TestMCPInProcess_CallTool_ScaleToZero_RequiresConfirmation tests the confirmation gate.
func TestMCPInProcess_CallTool_ScaleToZero_RequiresConfirmation(t *testing.T) {
	config := DefaultConfig()
	config.AllowDestructive = true
	config.RequireConfirm = true

	mock := &mockServerInterface{}
	server, err := NewServer(mock, config)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}

	client := initializeClient(t, server)
	defer client.Close()

	// Without confirmed=true, should be rejected
	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_scale_deployment"
	req.Params.Arguments = map[string]interface{}{
		"name":      "test-deployment",
		"namespace": "default",
		"replicas":  float64(0),
	}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool failed: %v", err)
	}
	if !result.IsError {
		t.Error("expected scale-to-zero without confirmed=true to be blocked")
	}

	// With confirmed=true, should succeed
	req2 := mcpsdk.CallToolRequest{}
	req2.Params.Name = "k8s_scale_deployment"
	req2.Params.Arguments = map[string]interface{}{
		"name":      "test-deploy",
		"namespace": "default",
		"replicas":  float64(0),
		"confirmed": true,
	}
	result, err = client.CallTool(context.Background(), req2)
	if err != nil {
		t.Fatalf("CallTool failed: %v", err)
	}
	if result.IsError {
		t.Error("expected scale-to-zero with confirmed=true to succeed")
	}
}

// TestMCPInProcess_CallTool_RestartDeployment exercises the restart tool.
func TestMCPInProcess_CallTool_RestartDeployment(t *testing.T) {
	config := DefaultConfig()
	config.AllowDestructive = true
	config.RequireConfirm = false

	mock := &mockServerInterface{}
	server, err := NewServer(mock, config)
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}

	client := initializeClient(t, server)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_restart_deployment"
	req.Params.Arguments = map[string]interface{}{
		"name":      "test-deployment",
		"namespace": "default",
	}

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool k8s_restart_deployment failed: %v", err)
	}

	if result.IsError {
		t.Errorf("CallTool k8s_restart_deployment returned error result")
	}
}

// TestMCPInProcess_CallTool_SwarmList exercises the swarm_list tool.
func TestMCPInProcess_CallTool_SwarmList(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	for _, kind := range []string{"services", "tasks", "nodes", "stacks", "networks", "volumes", "secrets", "configs"} {
		t.Run(kind, func(t *testing.T) {
			req := mcpsdk.CallToolRequest{}
			req.Params.Name = "swarm_list"
			req.Params.Arguments = map[string]interface{}{
				"kind": kind,
			}

			result, err := client.CallTool(context.Background(), req)
			if err != nil {
				t.Fatalf("CallTool swarm_list(%s) failed: %v", kind, err)
			}

			if len(result.Content) == 0 {
				t.Errorf("CallTool swarm_list(%s) returned empty content", kind)
			}
		})
	}
}

// TestMCPInProcess_CallTool_SwarmInspect exercises the swarm_inspect tool.
func TestMCPInProcess_CallTool_SwarmInspect(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	tests := []struct {
		kind string
		id   string
	}{
		{"service", "svc-1"},
		{"task", "task-1"},
		{"node", "node-1"},
	}

	for _, tc := range tests {
		t.Run(tc.kind, func(t *testing.T) {
			req := mcpsdk.CallToolRequest{}
			req.Params.Name = "swarm_inspect"
			req.Params.Arguments = map[string]interface{}{
				"kind": tc.kind,
				"id":   tc.id,
			}

			result, err := client.CallTool(context.Background(), req)
			if err != nil {
				t.Fatalf("CallTool swarm_inspect(%s) failed: %v", tc.kind, err)
			}

			if result.IsError {
				t.Errorf("CallTool swarm_inspect(%s) returned error result", tc.kind)
			}
		})
	}
}

// TestMCPInProcess_CallTool_InvalidTool tests calling a non-existent tool.
func TestMCPInProcess_CallTool_InvalidTool(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "does_not_exist"
	req.Params.Arguments = map[string]interface{}{}

	_, err := client.CallTool(context.Background(), req)
	if err == nil {
		t.Error("expected error when calling non-existent tool")
	}
}

// TestMCPInProcess_CallTool_MissingRequiredParam tests missing required parameters.
func TestMCPInProcess_CallTool_MissingRequiredParam(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	req := mcpsdk.CallToolRequest{}
	req.Params.Name = "k8s_list"
	req.Params.Arguments = map[string]interface{}{} // missing required "kind"

	result, err := client.CallTool(context.Background(), req)
	if err != nil {
		t.Fatalf("CallTool failed: %v", err)
	}

	if !result.IsError {
		t.Error("expected error result when 'kind' parameter is missing")
	}
}

// TestMCPInProcess_ReadResource_ClusterConnection tests the cluster connection resource.
func TestMCPInProcess_ReadResource_ClusterConnection(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	req := mcpsdk.ReadResourceRequest{}
	req.Params.URI = "resource://cluster/connection"

	result, err := client.ReadResource(context.Background(), req)
	if err != nil {
		t.Fatalf("ReadResource cluster/connection failed: %v", err)
	}

	if len(result.Contents) == 0 {
		t.Error("expected non-empty content for cluster/connection")
	}
}

// TestMCPInProcess_ReadResource_K8sNamespaces tests the namespaces resource.
func TestMCPInProcess_ReadResource_K8sNamespaces(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	req := mcpsdk.ReadResourceRequest{}
	req.Params.URI = "resource://k8s/namespaces"

	result, err := client.ReadResource(context.Background(), req)
	if err != nil {
		t.Fatalf("ReadResource k8s/namespaces failed: %v", err)
	}

	if len(result.Contents) == 0 {
		t.Error("expected non-empty content for k8s/namespaces")
	}
}

// TestMCPInProcess_ReadResource_MCPConfig tests the MCP config resource.
func TestMCPInProcess_ReadResource_MCPConfig(t *testing.T) {
	client := newInitializedInProcessClient(t)
	defer client.Close()

	req := mcpsdk.ReadResourceRequest{}
	req.Params.URI = "resource://mcp/config"

	result, err := client.ReadResource(context.Background(), req)
	if err != nil {
		t.Fatalf("ReadResource mcp/config failed: %v", err)
	}

	if len(result.Contents) == 0 {
		t.Error("expected non-empty content for mcp/config")
	}
}

// TestMCPInProcess_ReadResource_AllResources tests all 5 resources can be read.
func TestMCPInProcess_ReadResource_AllResources(t *testing.T) {
	client := newInitializedInProcessClient(t)
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

// ─── Helpers ────────────────────────────────────────────────────────────────

// newInitializedInProcessClient creates an in-process MCP client using the default
// mock and config, fully initialized and ready for tool calls.
func newInitializedInProcessClient(t *testing.T) *mcpclient.Client {
	t.Helper()

	mock := &mockServerInterface{swarmConnected: true}
	server, err := NewServer(mock, DefaultConfig())
	if err != nil {
		t.Fatalf("NewServer failed: %v", err)
	}

	return initializeClient(t, server)
}

// initializeClient creates an in-process MCP client from an existing MCPServer
// and initializes it.
func initializeClient(t *testing.T, server *MCPServer) *mcpclient.Client {
	t.Helper()

	client, err := mcpclient.NewInProcessClient(server.sdkServer)
	if err != nil {
		t.Fatalf("NewInProcessClient failed: %v", err)
	}

	ctx := context.Background()
	if err := client.Start(ctx); err != nil {
		t.Fatalf("client.Start failed: %v", err)
	}

	initReq := mcpsdk.InitializeRequest{}
	initReq.Params.ProtocolVersion = mcpsdk.LATEST_PROTOCOL_VERSION
	initReq.Params.ClientInfo = mcpsdk.Implementation{
		Name:    "integration-test",
		Version: "1.0.0",
	}

	if _, err := client.Initialize(ctx, initReq); err != nil {
		t.Fatalf("Initialize failed: %v", err)
	}

	return client
}
