package mcp

import (
	"context"
	"fmt"
	"strings"
	"testing"
)

// mockServerInterface is a mock implementation of ServerInterface for testing
type mockServerInterface struct {
	currentNamespace    string
	currentContext      string
	preferredNamespaces []string
	kubeConfigPath      string
	namespaces          []string
	swarmConnected      bool

	// Track method calls for verification
	lastGetPodsNamespace           string
	lastGetServicesNamespace       string
	lastGetNodesCall               bool
	lastGetPVsCall                 bool
	lastGetStorageClassesCall      bool
	lastGetClusterRolesCall        bool
	lastGetClusterRoleBindingsCall bool
	lastGetCRDsCall                bool
	lastGetPodDetailNS             string
	lastGetPodDetailName           string
	lastScaleResourceKind          string
	lastScaleResourceNS            string
	lastScaleResourceName          string
	lastScaleResourceReplicas      int
	lastGetPodLogsNS               string
	lastGetPodLogsName             string
	lastGetPodLogsContainer        string
	lastGetPodLogsLines            int
	lastGetPodLogsPrevious         bool
	lastGetSwarmServiceID          string
	lastScaleSwarmServiceID        string
	lastScaleSwarmServiceReplicas  int
}

// Kubernetes context methods
func (m *mockServerInterface) GetCurrentContext() string        { return m.currentContext }
func (m *mockServerInterface) GetCurrentNamespace() string      { return m.currentNamespace }
func (m *mockServerInterface) GetPreferredNamespaces() []string { return m.preferredNamespaces }
func (m *mockServerInterface) GetKubeConfigPath() string        { return m.kubeConfigPath }
func (m *mockServerInterface) GetNamespaces() ([]string, error) { return m.namespaces, nil }
func (m *mockServerInterface) GetConnectionStatus() map[string]interface{} {
	return map[string]interface{}{
		"connected": true,
		"context":   m.currentContext,
		"namespace": m.currentNamespace,
	}
}

// Resource listing methods
func (m *mockServerInterface) GetPods(namespace string) (interface{}, error) {
	m.lastGetPodsNamespace = namespace
	return []map[string]interface{}{
		{"name": "pod1", "Labels": map[string]string{"app": "web"}},
		{"name": "pod2", "Labels": map[string]string{"app": "api"}},
	}, nil
}

func (m *mockServerInterface) GetDeployments(namespace string) (interface{}, error) {
	return []string{"deployment1"}, nil
}

func (m *mockServerInterface) GetStatefulSets(namespace string) (interface{}, error) {
	return []string{"statefulset1"}, nil
}

func (m *mockServerInterface) GetDaemonSets(namespace string) (interface{}, error) {
	return []string{"daemonset1"}, nil
}

func (m *mockServerInterface) GetJobs(namespace string) (interface{}, error) {
	return []string{"job1"}, nil
}

func (m *mockServerInterface) GetCronJobs(namespace string) (interface{}, error) {
	return []string{"cronjob1"}, nil
}

func (m *mockServerInterface) GetConfigMaps(namespace string) (interface{}, error) {
	return []string{"configmap1"}, nil
}

func (m *mockServerInterface) GetSecrets(namespace string) (interface{}, error) {
	return []string{"secret1"}, nil
}

func (m *mockServerInterface) GetResourceEvents(namespace, kind, name string) (interface{}, error) {
	return []string{"event1"}, nil
}

func (m *mockServerInterface) GetResourceCounts() interface{} {
	return map[string]int{"pods": 10, "services": 5}
}

func (m *mockServerInterface) GetServices(namespace string) (interface{}, error) {
	m.lastGetServicesNamespace = namespace
	return []string{"service1"}, nil
}

func (m *mockServerInterface) GetIngresses(namespace string) (interface{}, error) {
	return []string{"ingress1"}, nil
}

func (m *mockServerInterface) GetReplicaSets(namespace string) (interface{}, error) {
	return []string{"replicaset1"}, nil
}

func (m *mockServerInterface) GetNodes() (interface{}, error) {
	m.lastGetNodesCall = true
	return []string{"node1", "node2"}, nil
}

func (m *mockServerInterface) GetPersistentVolumes() (interface{}, error) {
	m.lastGetPVsCall = true
	return []string{"pv1"}, nil
}

func (m *mockServerInterface) GetPersistentVolumeClaims(namespace string) (interface{}, error) {
	return []string{"pvc1"}, nil
}

func (m *mockServerInterface) GetStorageClasses() (interface{}, error) {
	m.lastGetStorageClassesCall = true
	return []string{"sc1"}, nil
}

func (m *mockServerInterface) GetServiceAccounts(namespace string) (interface{}, error) {
	return []string{"sa1"}, nil
}

func (m *mockServerInterface) GetRoles(namespace string) (interface{}, error) {
	return []string{"role1"}, nil
}

func (m *mockServerInterface) GetClusterRoles() (interface{}, error) {
	m.lastGetClusterRolesCall = true
	return []string{"clusterrole1"}, nil
}

func (m *mockServerInterface) GetRoleBindings(namespace string) (interface{}, error) {
	return []string{"rolebinding1"}, nil
}

func (m *mockServerInterface) GetClusterRoleBindings() (interface{}, error) {
	m.lastGetClusterRoleBindingsCall = true
	return []string{"clusterrolebinding1"}, nil
}

func (m *mockServerInterface) GetNetworkPolicies(namespace string) (interface{}, error) {
	return []string{"networkpolicy1"}, nil
}

func (m *mockServerInterface) GetCustomResourceDefinitions() (interface{}, error) {
	m.lastGetCRDsCall = true
	return []string{"crd1"}, nil
}

func (m *mockServerInterface) GetEndpoints(namespace string) (interface{}, error) {
	return []string{"endpoint1"}, nil
}

// Detail methods
func (m *mockServerInterface) GetPodDetail(namespace, name string) (interface{}, error) {
	m.lastGetPodDetailNS = namespace
	m.lastGetPodDetailName = name
	return map[string]string{"name": name, "namespace": namespace}, nil
}

func (m *mockServerInterface) GetDeploymentDetail(namespace, name string) (interface{}, error) {
	return map[string]string{"name": name, "namespace": namespace}, nil
}

func (m *mockServerInterface) GetServiceDetail(namespace, name string) (interface{}, error) {
	return map[string]string{"name": name, "namespace": namespace}, nil
}

func (m *mockServerInterface) GetIngressDetail(namespace, name string) (interface{}, error) {
	return map[string]string{"name": name, "namespace": namespace}, nil
}

func (m *mockServerInterface) GetNodeDetail(name string) (interface{}, error) {
	return map[string]string{"name": name}, nil
}

func (m *mockServerInterface) GetPersistentVolumeClaimDetail(namespace, name string) (interface{}, error) {
	return map[string]string{"name": name, "namespace": namespace}, nil
}

func (m *mockServerInterface) GetPersistentVolumeDetail(name string) (interface{}, error) {
	return map[string]string{"name": name}, nil
}

func (m *mockServerInterface) GetStatefulSetDetail(namespace, name string) (interface{}, error) {
	return map[string]string{"name": name, "namespace": namespace}, nil
}

func (m *mockServerInterface) GetDaemonSetDetail(namespace, name string) (interface{}, error) {
	return map[string]string{"name": name, "namespace": namespace}, nil
}

func (m *mockServerInterface) GetReplicaSetDetail(namespace, name string) (interface{}, error) {
	return map[string]string{"name": name, "namespace": namespace}, nil
}

func (m *mockServerInterface) GetJobDetail(namespace, name string) (interface{}, error) {
	return map[string]string{"name": name, "namespace": namespace}, nil
}

func (m *mockServerInterface) GetCronJobDetail(namespace, name string) (interface{}, error) {
	return map[string]string{"name": name, "namespace": namespace}, nil
}

// YAML methods
func (m *mockServerInterface) GetResourceYAML(kind, namespace, name string) (string, error) {
	return fmt.Sprintf("apiVersion: v1\nkind: %s\nmetadata:\n  name: %s\n  namespace: %s", kind, name, namespace), nil
}

// Log methods
func (m *mockServerInterface) GetPodLogs(namespace, podName, container string, lines int) (string, error) {
	m.lastGetPodLogsNS = namespace
	m.lastGetPodLogsName = podName
	m.lastGetPodLogsContainer = container
	m.lastGetPodLogsLines = lines
	m.lastGetPodLogsPrevious = false
	return "log line 1\nlog line 2", nil
}

func (m *mockServerInterface) GetPodLogsPrevious(namespace, podName, container string, lines int) (string, error) {
	m.lastGetPodLogsNS = namespace
	m.lastGetPodLogsName = podName
	m.lastGetPodLogsContainer = container
	m.lastGetPodLogsLines = lines
	m.lastGetPodLogsPrevious = true
	return "previous log line 1", nil
}

// Diagnostics methods
func (m *mockServerInterface) TopPods(namespace string) (interface{}, error) {
	return map[string]interface{}{"pods": []string{"pod1"}}, nil
}

func (m *mockServerInterface) TopNodes() (interface{}, error) {
	return map[string]interface{}{"nodes": []string{"node1"}}, nil
}

func (m *mockServerInterface) GetRolloutStatus(_, _, _ string) (interface{}, error) {
	return map[string]string{"status": "complete"}, nil
}

func (m *mockServerInterface) GetRolloutHistory(_, _, _ string) (interface{}, error) {
	return []string{"revision 1", "revision 2"}, nil
}

// Mutation methods
func (m *mockServerInterface) ScaleResource(kind, namespace, name string, replicas int) error {
	m.lastScaleResourceKind = kind
	m.lastScaleResourceNS = namespace
	m.lastScaleResourceName = name
	m.lastScaleResourceReplicas = replicas
	return nil
}

func (m *mockServerInterface) RestartDeployment(namespace, name string) error {
	return nil
}

// Docker Swarm methods
func (m *mockServerInterface) GetSwarmServices() (interface{}, error) {
	return []string{"service1"}, nil
}

func (m *mockServerInterface) GetSwarmTasks() (interface{}, error) {
	return []string{"task1"}, nil
}

func (m *mockServerInterface) GetSwarmNodes() (interface{}, error) {
	return []string{"node1"}, nil
}

func (m *mockServerInterface) GetSwarmServiceLogs(serviceID string, tail int) (string, error) {
	m.lastGetSwarmServiceID = serviceID
	return "swarm log line 1", nil
}

func (m *mockServerInterface) ScaleSwarmService(serviceID string, replicas int) error {
	m.lastScaleSwarmServiceID = serviceID
	m.lastScaleSwarmServiceReplicas = replicas
	return nil
}

func (m *mockServerInterface) IsSwarmConnected() bool {
	return m.swarmConnected
}

func (m *mockServerInterface) GetSwarmService(serviceID string) (interface{}, error) {
	return map[string]string{"id": serviceID, "name": "test-service"}, nil
}

func (m *mockServerInterface) GetSwarmTask(taskID string) (interface{}, error) {
	return map[string]string{"id": taskID, "name": "test-task"}, nil
}

func (m *mockServerInterface) GetSwarmNode(nodeID string) (interface{}, error) {
	return map[string]string{"id": nodeID, "hostname": "test-node"}, nil
}

func (m *mockServerInterface) GetSwarmStacks() (interface{}, error) {
	return []string{"stack1", "stack2"}, nil
}

func (m *mockServerInterface) GetSwarmNetworks() (interface{}, error) {
	return []string{"network1"}, nil
}

func (m *mockServerInterface) GetSwarmVolumes() (interface{}, error) {
	return []string{"volume1"}, nil
}

func (m *mockServerInterface) GetSwarmSecrets() (interface{}, error) {
	return []string{"secret1"}, nil
}

func (m *mockServerInterface) GetSwarmConfigs() (interface{}, error) {
	return []string{"config1"}, nil
}

// Helper to create a test server
func createTestServer() *MCPServer {
	mock := &mockServerInterface{
		currentNamespace: "default",
		currentContext:   "test-context",
		kubeConfigPath:   "/test/kubeconfig",
		namespaces:       []string{"default", "kube-system"},
		swarmConnected:   true,
	}

	config := MCPConfigData{
		Enabled:     true,
		Host:        "localhost",
		Port:        3000,
		MaxLogLines: 1000,
	}

	server, _ := NewServer(mock, config)
	return server
}

// =====================
// Tool Registration Tests
// =====================

func TestToolRegistration(t *testing.T) {
	server := createTestServer()

	expectedTools := []string{
		"k8s_list",
		"k8s_describe",
		"k8s_get_resource_yaml",
		"k8s_get_pod_logs",
		"k8s_get_events",
		"k8s_get_resource_counts",
		"k8s_top",
		"k8s_rollout",
		"k8s_scale_deployment",
		"k8s_restart_deployment",
		"swarm_list",
		"swarm_inspect",
		"swarm_get_service_logs",
		"swarm_scale_service",
	}

	for _, toolName := range expectedTools {
		t.Run(toolName, func(t *testing.T) {
			tool, exists := server.tools[toolName]
			if !exists {
				t.Errorf("Tool %s is not registered", toolName)
				return
			}
			if tool.Name != toolName {
				t.Errorf("Tool name mismatch: expected %s, got %s", toolName, tool.Name)
			}
			if tool.Handler == nil {
				t.Errorf("Tool %s has no handler", toolName)
			}
			if tool.Description == "" {
				t.Errorf("Tool %s has no description", toolName)
			}
		})
	}
}

func TestToolCount(t *testing.T) {
	server := createTestServer()
	expectedCount := 14
	if len(server.tools) != expectedCount {
		t.Errorf("Expected %d tools, got %d", expectedCount, len(server.tools))
		for name := range server.tools {
			t.Logf("  registered: %s", name)
		}
	}
}

// =====================
// k8s_list Tests
// =====================

func TestK8sList_AllKinds(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	namespacedKinds := []string{
		"pods", "deployments", "statefulsets", "daemonsets", "jobs", "cronjobs",
		"configmaps", "secrets", "services", "endpoints", "ingresses",
		"network_policies", "replicasets", "persistent_volume_claims",
		"service_accounts", "roles", "role_bindings",
	}

	for _, kind := range namespacedKinds {
		t.Run(kind, func(t *testing.T) {
			tool := server.tools["k8s_list"]
			result, err := tool.Handler(ctx, map[string]interface{}{"kind": kind})
			if err != nil {
				t.Fatalf("Handler error for kind %s: %v", kind, err)
			}
			lr, ok := result.(*ListResult)
			if !ok {
				t.Fatalf("Expected *ListResult, got %T", result)
			}
			if lr.Kind != kind {
				t.Errorf("Expected kind %s, got %s", kind, lr.Kind)
			}
		})
	}

	clusterKinds := []string{
		"nodes", "persistent_volumes", "storage_classes",
		"cluster_roles", "cluster_role_bindings", "crds",
	}

	for _, kind := range clusterKinds {
		t.Run(kind+"_cluster_scoped", func(t *testing.T) {
			tool := server.tools["k8s_list"]
			result, err := tool.Handler(ctx, map[string]interface{}{"kind": kind})
			if err != nil {
				t.Fatalf("Handler error for kind %s: %v", kind, err)
			}
			lr, ok := result.(*ListResult)
			if !ok {
				t.Fatalf("Expected *ListResult, got %T", result)
			}
			if lr.Total == 0 {
				t.Error("Expected non-zero total for cluster-scoped resource")
			}
		})
	}
}

func TestK8sList_MissingKind(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_list"]

	_, err := tool.Handler(ctx, map[string]interface{}{})
	if err == nil || err.Error() != "missing required parameter: kind" {
		t.Errorf("Expected 'missing required parameter: kind', got %v", err)
	}
}

func TestK8sList_UnknownKind(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_list"]

	_, err := tool.Handler(ctx, map[string]interface{}{"kind": "widgets"})
	if err == nil || !strings.Contains(err.Error(), "unknown resource kind") {
		t.Errorf("Expected unknown resource kind error, got %v", err)
	}
}

func TestK8sList_NamespaceDefaulting(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	tool := server.tools["k8s_list"]

	tests := []struct {
		name              string
		input             map[string]interface{}
		expectedNamespace string
	}{
		{"namespace_provided", map[string]interface{}{"kind": "pods", "namespace": "kube-system"}, "kube-system"},
		{"namespace_omitted", map[string]interface{}{"kind": "pods"}, "default"},
		{"namespace_empty", map[string]interface{}{"kind": "pods", "namespace": ""}, "default"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := tool.Handler(ctx, tt.input)
			if err != nil {
				t.Fatalf("Handler error: %v", err)
			}
			if mock.lastGetPodsNamespace != tt.expectedNamespace {
				t.Errorf("Expected namespace %s, got %s", tt.expectedNamespace, mock.lastGetPodsNamespace)
			}
		})
	}
}

func TestK8sList_WithLimit(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_list"]

	result, err := tool.Handler(ctx, map[string]interface{}{
		"kind":  "pods",
		"limit": float64(1),
	})
	if err != nil {
		t.Fatalf("Handler error: %v", err)
	}

	lr := result.(*ListResult)
	if lr.Total != 2 {
		t.Errorf("Expected total 2, got %d", lr.Total)
	}
	if !lr.Truncated {
		t.Error("Expected truncated=true when limit < total")
	}
}

func TestK8sList_ClusterScopedIgnoresNamespace(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	tool := server.tools["k8s_list"]

	clusterKinds := map[string]*bool{
		"nodes":                 &mock.lastGetNodesCall,
		"persistent_volumes":    &mock.lastGetPVsCall,
		"storage_classes":       &mock.lastGetStorageClassesCall,
		"cluster_roles":         &mock.lastGetClusterRolesCall,
		"cluster_role_bindings": &mock.lastGetClusterRoleBindingsCall,
		"crds":                  &mock.lastGetCRDsCall,
	}

	for kind, flag := range clusterKinds {
		t.Run(kind+"_ignores_namespace", func(t *testing.T) {
			*flag = false
			_, err := tool.Handler(ctx, map[string]interface{}{
				"kind":      kind,
				"namespace": "should-be-ignored",
			})
			if err != nil {
				t.Fatalf("Handler error: %v", err)
			}
			if !*flag {
				t.Errorf("Expected %s method to be called", kind)
			}
		})
	}
}

// =====================
// k8s_describe Tests
// =====================

func TestK8sDescribe_AllKinds(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_describe"]

	kinds := []string{
		"pod", "deployment", "service", "ingress", "node", "pvc", "pv",
		"statefulset", "daemonset", "replicaset", "job", "cronjob",
	}

	for _, kind := range kinds {
		t.Run(kind, func(t *testing.T) {
			result, err := tool.Handler(ctx, map[string]interface{}{
				"kind": kind,
				"name": "test-resource",
			})
			if err != nil {
				t.Fatalf("Handler error for kind %s: %v", kind, err)
			}
			if result == nil {
				t.Error("Expected result, got nil")
			}
		})
	}
}

func TestK8sDescribe_MissingParameters(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_describe"]

	tests := []struct {
		name        string
		input       map[string]interface{}
		errContains string
	}{
		{"missing_kind", map[string]interface{}{"name": "pod1"}, "missing required parameter: kind"},
		{"missing_name", map[string]interface{}{"kind": "pod"}, "missing required parameter: name"},
		{"unknown_kind", map[string]interface{}{"kind": "widget", "name": "w1"}, "unknown resource kind"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := tool.Handler(ctx, tt.input)
			if err == nil {
				t.Fatal("Expected error")
			}
			if !strings.Contains(err.Error(), tt.errContains) {
				t.Errorf("Expected error containing '%s', got '%s'", tt.errContains, err.Error())
			}
		})
	}
}

func TestK8sDescribe_DelegatesToCorrectDetail(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	tool := server.tools["k8s_describe"]

	_, err := tool.Handler(ctx, map[string]interface{}{
		"kind":      "pod",
		"name":      "test-pod",
		"namespace": "test-ns",
	})
	if err != nil {
		t.Fatalf("Handler error: %v", err)
	}
	if mock.lastGetPodDetailNS != "test-ns" {
		t.Errorf("Expected namespace test-ns, got %s", mock.lastGetPodDetailNS)
	}
	if mock.lastGetPodDetailName != "test-pod" {
		t.Errorf("Expected name test-pod, got %s", mock.lastGetPodDetailName)
	}
}

// =====================
// k8s_get_resource_yaml Tests
// =====================

func TestGetResourceYAML(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_get_resource_yaml"]

	tests := []struct {
		name  string
		input map[string]interface{}
	}{
		{"with_namespace", map[string]interface{}{"kind": "Pod", "name": "my-pod", "namespace": "prod"}},
		{"without_namespace", map[string]interface{}{"kind": "Deployment", "name": "my-deploy"}},
		{"cluster_resource", map[string]interface{}{"kind": "Node", "name": "node1"}},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := tool.Handler(ctx, tt.input)
			if err != nil {
				t.Fatalf("Handler error: %v", err)
			}
			resultMap, ok := result.(map[string]interface{})
			if !ok {
				t.Fatalf("Result is not a map, got type: %T", result)
			}
			if resultMap["yaml"] == nil || resultMap["yaml"] == "" {
				t.Error("Expected YAML content")
			}
		})
	}
}

func TestGetResourceYAML_MissingParams(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_get_resource_yaml"]

	tests := []struct {
		name        string
		input       map[string]interface{}
		errContains string
	}{
		{"missing_kind", map[string]interface{}{"name": "pod1"}, "missing required parameter: kind"},
		{"missing_name", map[string]interface{}{"kind": "Pod"}, "missing required parameter: name"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := tool.Handler(ctx, tt.input)
			if err == nil {
				t.Fatal("Expected error")
			}
			if !strings.Contains(err.Error(), tt.errContains) {
				t.Errorf("Expected error containing '%s', got '%s'", tt.errContains, err.Error())
			}
		})
	}
}

// =====================
// k8s_get_pod_logs Tests
// =====================

func TestGetPodLogs_Current(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	tool := server.tools["k8s_get_pod_logs"]

	result, err := tool.Handler(ctx, map[string]interface{}{
		"name": "my-pod",
	})
	if err != nil {
		t.Fatalf("Handler error: %v", err)
	}

	if mock.lastGetPodLogsNS != "default" {
		t.Errorf("Expected namespace default, got %s", mock.lastGetPodLogsNS)
	}
	if mock.lastGetPodLogsName != "my-pod" {
		t.Errorf("Expected pod my-pod, got %s", mock.lastGetPodLogsName)
	}
	if mock.lastGetPodLogsLines != 100 {
		t.Errorf("Expected default 100 lines, got %d", mock.lastGetPodLogsLines)
	}
	if mock.lastGetPodLogsPrevious {
		t.Error("Expected current logs, not previous")
	}

	resultMap := result.(map[string]interface{})
	if resultMap["pod"] != "my-pod" {
		t.Errorf("Result pod mismatch")
	}
}

func TestGetPodLogs_Previous(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	tool := server.tools["k8s_get_pod_logs"]

	_, err := tool.Handler(ctx, map[string]interface{}{
		"name":     "my-pod",
		"previous": true,
	})
	if err != nil {
		t.Fatalf("Handler error: %v", err)
	}

	if !mock.lastGetPodLogsPrevious {
		t.Error("Expected previous logs to be requested")
	}
}

func TestGetPodLogs_Container(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	tool := server.tools["k8s_get_pod_logs"]

	_, err := tool.Handler(ctx, map[string]interface{}{
		"name":      "pod1",
		"container": "sidecar",
	})
	if err != nil {
		t.Fatalf("Handler error: %v", err)
	}
	if mock.lastGetPodLogsContainer != "sidecar" {
		t.Errorf("Expected container 'sidecar', got '%s'", mock.lastGetPodLogsContainer)
	}
}

func TestGetPodLogs_CustomLines(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	tool := server.tools["k8s_get_pod_logs"]

	_, err := tool.Handler(ctx, map[string]interface{}{
		"name":  "pod1",
		"lines": float64(500),
	})
	if err != nil {
		t.Fatalf("Handler error: %v", err)
	}
	if mock.lastGetPodLogsLines != 500 {
		t.Errorf("Expected 500 lines, got %d", mock.lastGetPodLogsLines)
	}
}

func TestGetPodLogs_LegacyTailLines(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	tool := server.tools["k8s_get_pod_logs"]

	_, err := tool.Handler(ctx, map[string]interface{}{
		"name":      "pod1",
		"tailLines": float64(200),
	})
	if err != nil {
		t.Fatalf("Handler error: %v", err)
	}
	if mock.lastGetPodLogsLines != 200 {
		t.Errorf("Expected 200 lines via legacy tailLines, got %d", mock.lastGetPodLogsLines)
	}
}

func TestGetPodLogs_MaxLogLinesEnforced(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	tool := server.tools["k8s_get_pod_logs"]

	_, err := tool.Handler(ctx, map[string]interface{}{
		"name":  "pod1",
		"lines": float64(5000),
	})
	if err != nil {
		t.Fatalf("Handler error: %v", err)
	}
	if mock.lastGetPodLogsLines != 1000 {
		t.Errorf("Expected lines capped at 1000, got %d", mock.lastGetPodLogsLines)
	}
}

func TestGetPodLogs_MissingName(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_get_pod_logs"]

	_, err := tool.Handler(ctx, map[string]interface{}{})
	if err == nil || err.Error() != "pod name is required" {
		t.Errorf("Expected 'pod name is required', got %v", err)
	}
}

// =====================
// k8s_get_events Tests
// =====================

func TestGetEvents(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_get_events"]

	result, err := tool.Handler(ctx, map[string]interface{}{})
	if err != nil {
		t.Fatalf("Handler error: %v", err)
	}
	if result == nil {
		t.Error("Expected result")
	}
}

// =====================
// k8s_get_resource_counts Tests
// =====================

func TestGetResourceCounts(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_get_resource_counts"]

	result, err := tool.Handler(ctx, map[string]interface{}{})
	if err != nil {
		t.Fatalf("Handler error: %v", err)
	}
	if result == nil {
		t.Error("Expected result")
	}
}

// =====================
// k8s_top Tests
// =====================

func TestK8sTop(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_top"]

	t.Run("pods", func(t *testing.T) {
		result, err := tool.Handler(ctx, map[string]interface{}{"kind": "pods"})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result")
		}
	})

	t.Run("nodes", func(t *testing.T) {
		result, err := tool.Handler(ctx, map[string]interface{}{"kind": "nodes"})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result")
		}
	})

	t.Run("missing_kind", func(t *testing.T) {
		_, err := tool.Handler(ctx, map[string]interface{}{})
		if err == nil || !strings.Contains(err.Error(), "missing required parameter") {
			t.Errorf("Expected missing kind error, got %v", err)
		}
	})

	t.Run("unknown_kind", func(t *testing.T) {
		_, err := tool.Handler(ctx, map[string]interface{}{"kind": "widgets"})
		if err == nil || !strings.Contains(err.Error(), "unknown kind for top") {
			t.Errorf("Expected unknown kind error, got %v", err)
		}
	})
}

// =====================
// k8s_rollout Tests
// =====================

func TestK8sRollout(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_rollout"]

	t.Run("status", func(t *testing.T) {
		result, err := tool.Handler(ctx, map[string]interface{}{
			"action": "status",
			"kind":   "Deployment",
			"name":   "my-deploy",
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result")
		}
	})

	t.Run("history", func(t *testing.T) {
		result, err := tool.Handler(ctx, map[string]interface{}{
			"action": "history",
			"kind":   "Deployment",
			"name":   "my-deploy",
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result")
		}
	})

	t.Run("missing_action", func(t *testing.T) {
		_, err := tool.Handler(ctx, map[string]interface{}{
			"kind": "Deployment",
			"name": "my-deploy",
		})
		if err == nil || !strings.Contains(err.Error(), "missing required parameter: action") {
			t.Errorf("Expected missing action error, got %v", err)
		}
	})

	t.Run("missing_kind", func(t *testing.T) {
		_, err := tool.Handler(ctx, map[string]interface{}{
			"action": "status",
			"name":   "my-deploy",
		})
		if err == nil || !strings.Contains(err.Error(), "missing required parameter: kind") {
			t.Errorf("Expected missing kind error, got %v", err)
		}
	})

	t.Run("missing_name", func(t *testing.T) {
		_, err := tool.Handler(ctx, map[string]interface{}{
			"action": "status",
			"kind":   "Deployment",
		})
		if err == nil || !strings.Contains(err.Error(), "missing required parameter: name") {
			t.Errorf("Expected missing name error, got %v", err)
		}
	})

	t.Run("unknown_action", func(t *testing.T) {
		_, err := tool.Handler(ctx, map[string]interface{}{
			"action": "undo",
			"kind":   "Deployment",
			"name":   "my-deploy",
		})
		if err == nil || !strings.Contains(err.Error(), "unknown rollout action") {
			t.Errorf("Expected unknown action error, got %v", err)
		}
	})

	for _, kind := range []string{"Deployment", "StatefulSet", "DaemonSet"} {
		t.Run("status_"+kind, func(t *testing.T) {
			_, err := tool.Handler(ctx, map[string]interface{}{
				"action": "status",
				"kind":   kind,
				"name":   "my-resource",
			})
			if err != nil {
				t.Fatalf("Handler error: %v", err)
			}
		})
	}
}

// =====================
// k8s_scale_deployment Tests
// =====================

func TestScaleDeployment(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	tool := server.tools["k8s_scale_deployment"]

	t.Run("basic_scale", func(t *testing.T) {
		result, err := tool.Handler(ctx, map[string]interface{}{
			"namespace": "prod",
			"name":      "my-deployment",
			"replicas":  float64(5),
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}

		if mock.lastScaleResourceKind != "Deployment" {
			t.Errorf("Expected kind Deployment, got %s", mock.lastScaleResourceKind)
		}
		if mock.lastScaleResourceNS != "prod" {
			t.Errorf("Expected namespace prod, got %s", mock.lastScaleResourceNS)
		}
		if mock.lastScaleResourceName != "my-deployment" {
			t.Errorf("Expected name my-deployment, got %s", mock.lastScaleResourceName)
		}
		if mock.lastScaleResourceReplicas != 5 {
			t.Errorf("Expected replicas 5, got %d", mock.lastScaleResourceReplicas)
		}

		resultMap := result.(map[string]interface{})
		if resultMap["success"] != true {
			t.Error("Expected success: true")
		}
	})

	t.Run("scale_to_zero", func(t *testing.T) {
		_, err := tool.Handler(ctx, map[string]interface{}{
			"name":     "deploy1",
			"replicas": float64(0),
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
	})

	t.Run("missing_name", func(t *testing.T) {
		_, err := tool.Handler(ctx, map[string]interface{}{
			"replicas": float64(3),
		})
		if err == nil || err.Error() != "deployment name is required" {
			t.Errorf("Expected 'deployment name is required', got %v", err)
		}
	})
}

// =====================
// k8s_restart_deployment Tests
// =====================

func TestRestartDeployment(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["k8s_restart_deployment"]

	t.Run("basic_restart", func(t *testing.T) {
		result, err := tool.Handler(ctx, map[string]interface{}{
			"name": "my-deploy",
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result")
		}
	})

	t.Run("missing_name", func(t *testing.T) {
		_, err := tool.Handler(ctx, map[string]interface{}{})
		if err == nil || err.Error() != "deployment name is required" {
			t.Errorf("Expected 'deployment name is required', got %v", err)
		}
	})
}

// =====================
// swarm_list Tests
// =====================

func TestSwarmList_AllKinds(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["swarm_list"]

	kinds := []string{"services", "tasks", "nodes", "stacks", "networks", "volumes", "secrets", "configs"}

	for _, kind := range kinds {
		t.Run(kind, func(t *testing.T) {
			result, err := tool.Handler(ctx, map[string]interface{}{"kind": kind})
			if err != nil {
				t.Fatalf("Handler error for kind %s: %v", kind, err)
			}
			if result == nil {
				t.Error("Expected result")
			}
		})
	}
}

func TestSwarmList_MissingKind(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["swarm_list"]

	_, err := tool.Handler(ctx, map[string]interface{}{})
	if err == nil || !strings.Contains(err.Error(), "missing required parameter: kind") {
		t.Errorf("Expected missing kind error, got %v", err)
	}
}

func TestSwarmList_UnknownKind(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["swarm_list"]

	_, err := tool.Handler(ctx, map[string]interface{}{"kind": "widgets"})
	if err == nil || !strings.Contains(err.Error(), "unknown swarm resource kind") {
		t.Errorf("Expected unknown kind error, got %v", err)
	}
}

// =====================
// swarm_inspect Tests
// =====================

func TestSwarmInspect_AllKinds(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["swarm_inspect"]

	tests := []struct {
		kind string
		id   string
	}{
		{"service", "svc1"},
		{"task", "task1"},
		{"node", "node1"},
	}

	for _, tt := range tests {
		t.Run(tt.kind, func(t *testing.T) {
			result, err := tool.Handler(ctx, map[string]interface{}{
				"kind": tt.kind,
				"id":   tt.id,
			})
			if err != nil {
				t.Fatalf("Handler error: %v", err)
			}
			if result == nil {
				t.Error("Expected result")
			}
		})
	}
}

func TestSwarmInspect_MissingParams(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["swarm_inspect"]

	tests := []struct {
		name        string
		input       map[string]interface{}
		errContains string
	}{
		{"missing_kind", map[string]interface{}{"id": "svc1"}, "missing required parameter: kind"},
		{"missing_id", map[string]interface{}{"kind": "service"}, "missing required parameter: id"},
		{"unknown_kind", map[string]interface{}{"kind": "widget", "id": "w1"}, "unknown swarm resource kind"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := tool.Handler(ctx, tt.input)
			if err == nil {
				t.Fatal("Expected error")
			}
			if !strings.Contains(err.Error(), tt.errContains) {
				t.Errorf("Expected error containing '%s', got '%s'", tt.errContains, err.Error())
			}
		})
	}
}

// =====================
// swarm_get_service_logs Tests
// =====================

func TestSwarmGetServiceLogs(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	tool := server.tools["swarm_get_service_logs"]

	t.Run("basic", func(t *testing.T) {
		result, err := tool.Handler(ctx, map[string]interface{}{
			"serviceId": "my-service",
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		resultMap := result.(map[string]interface{})
		if resultMap["serviceId"] != "my-service" {
			t.Errorf("Expected serviceId my-service, got %v", resultMap["serviceId"])
		}
	})

	t.Run("missing_serviceId", func(t *testing.T) {
		_, err := tool.Handler(ctx, map[string]interface{}{})
		if err == nil || err.Error() != "serviceId is required" {
			t.Errorf("Expected 'serviceId is required', got %v", err)
		}
	})
}

// =====================
// swarm_scale_service Tests
// =====================

func TestSwarmScaleService(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	tool := server.tools["swarm_scale_service"]

	t.Run("basic_scale", func(t *testing.T) {
		result, err := tool.Handler(ctx, map[string]interface{}{
			"serviceId": "my-svc",
			"replicas":  float64(3),
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if mock.lastScaleSwarmServiceID != "my-svc" {
			t.Errorf("Expected serviceId my-svc, got %s", mock.lastScaleSwarmServiceID)
		}
		if mock.lastScaleSwarmServiceReplicas != 3 {
			t.Errorf("Expected replicas 3, got %d", mock.lastScaleSwarmServiceReplicas)
		}
		resultMap := result.(map[string]interface{})
		if resultMap["success"] != true {
			t.Error("Expected success: true")
		}
	})

	t.Run("missing_serviceId", func(t *testing.T) {
		_, err := tool.Handler(ctx, map[string]interface{}{
			"replicas": float64(3),
		})
		if err == nil || err.Error() != "serviceId is required" {
			t.Errorf("Expected 'serviceId is required', got %v", err)
		}
	})
}

// =====================
// Swarm Connection Checks
// =====================

func TestSwarmNotConnectedAllTools(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	mock.swarmConnected = false

	swarmTools := []struct {
		name  string
		input map[string]interface{}
	}{
		{"swarm_list", map[string]interface{}{"kind": "services"}},
		{"swarm_inspect", map[string]interface{}{"kind": "service", "id": "svc1"}},
		{"swarm_get_service_logs", map[string]interface{}{"serviceId": "svc1"}},
		{"swarm_scale_service", map[string]interface{}{"serviceId": "svc1", "replicas": float64(3)}},
	}

	for _, tt := range swarmTools {
		t.Run(tt.name+"_not_connected", func(t *testing.T) {
			tool := server.tools[tt.name]
			_, err := tool.Handler(ctx, tt.input)
			if err == nil {
				t.Fatal("Expected error when swarm not connected")
			}
			if err.Error() != "Docker Swarm is not connected" {
				t.Errorf("Expected 'Docker Swarm is not connected', got '%s'", err.Error())
			}
		})
	}
}

// =====================
// Security Level Tests
// =====================

func TestSecurityLevels(t *testing.T) {
	server := createTestServer()

	safeTools := []string{
		"k8s_list", "k8s_describe", "k8s_get_resource_yaml",
		"k8s_get_pod_logs", "k8s_get_events", "k8s_get_resource_counts",
		"k8s_top", "k8s_rollout",
		"swarm_list", "swarm_inspect", "swarm_get_service_logs",
	}

	for _, toolName := range safeTools {
		t.Run(toolName+"_is_safe", func(t *testing.T) {
			tool := server.tools[toolName]
			if tool.Security != SecuritySafe {
				t.Errorf("Expected %s to be SecuritySafe, got %s", toolName, tool.Security)
			}
		})
	}

	writeTools := []string{
		"k8s_scale_deployment", "k8s_restart_deployment", "swarm_scale_service",
	}

	for _, toolName := range writeTools {
		t.Run(toolName+"_is_write", func(t *testing.T) {
			tool := server.tools[toolName]
			if tool.Security != SecurityWrite {
				t.Errorf("Expected %s to be SecurityWrite, got %s", toolName, tool.Security)
			}
		})
	}
}

// =====================
// Log Truncation Tests
// =====================

func TestLogTruncation(t *testing.T) {
	config := MCPConfigData{
		Enabled:     true,
		Host:        "localhost",
		Port:        3000,
		MaxLogLines: 10,
	}

	mock := &mockServerInterface{
		currentNamespace: "default",
	}

	server, _ := NewServer(mock, config)

	t.Run("under_limit", func(t *testing.T) {
		logs := "line1\nline2\nline3"
		result := server.truncateLogs(logs)
		if result != logs {
			t.Error("Logs should not be truncated when under limit")
		}
	})

	t.Run("over_limit", func(t *testing.T) {
		logs := "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\nline11"
		result := server.truncateLogs(logs)
		if !strings.Contains(result, "... (truncated to last 10 lines)") {
			t.Errorf("Expected truncation message, got: %s", result)
		}
		if !strings.Contains(result, "line11") {
			t.Error("Expected to keep last line (line11)")
		}
	})
}

// =====================
// ListResult / wrapListResult Tests
// =====================

func TestWrapListResult(t *testing.T) {
	t.Run("no_limit", func(t *testing.T) {
		items := []string{"a", "b", "c"}
		lr := wrapListResult(items, "pods", "default", 0)
		if lr.Total != 3 {
			t.Errorf("Expected total 3, got %d", lr.Total)
		}
		if lr.Truncated {
			t.Error("Expected truncated=false with no limit")
		}
	})

	t.Run("with_limit_under_total", func(t *testing.T) {
		items := []string{"a", "b", "c"}
		lr := wrapListResult(items, "pods", "default", 2)
		if lr.Total != 3 {
			t.Errorf("Expected total 3, got %d", lr.Total)
		}
		if !lr.Truncated {
			t.Error("Expected truncated=true when limit < total")
		}
		truncated := lr.Items.([]string)
		if len(truncated) != 2 {
			t.Errorf("Expected 2 items after truncation, got %d", len(truncated))
		}
	})

	t.Run("with_limit_over_total", func(t *testing.T) {
		items := []string{"a", "b"}
		lr := wrapListResult(items, "pods", "default", 10)
		if lr.Truncated {
			t.Error("Expected truncated=false when limit >= total")
		}
	})

	t.Run("nil_items", func(t *testing.T) {
		lr := wrapListResult(nil, "pods", "default", 0)
		if lr.Total != 0 {
			t.Errorf("Expected total 0 for nil items, got %d", lr.Total)
		}
	})
}

// =====================
// Label Filtering Tests
// =====================

func TestLabelFiltering(t *testing.T) {
	type labeled struct {
		Name   string
		Labels map[string]string
	}

	items := []labeled{
		{Name: "a", Labels: map[string]string{"app": "web", "env": "prod"}},
		{Name: "b", Labels: map[string]string{"app": "api", "env": "prod"}},
		{Name: "c", Labels: map[string]string{"app": "web", "env": "staging"}},
	}

	t.Run("single_label", func(t *testing.T) {
		result := filterByLabels(items, "app=web")
		filtered := result.([]labeled)
		if len(filtered) != 2 {
			t.Errorf("Expected 2 matches for app=web, got %d", len(filtered))
		}
	})

	t.Run("multiple_labels", func(t *testing.T) {
		result := filterByLabels(items, "app=web,env=prod")
		filtered := result.([]labeled)
		if len(filtered) != 1 {
			t.Errorf("Expected 1 match for app=web,env=prod, got %d", len(filtered))
		}
		if filtered[0].Name != "a" {
			t.Errorf("Expected match 'a', got '%s'", filtered[0].Name)
		}
	})

	t.Run("no_match", func(t *testing.T) {
		result := filterByLabels(items, "app=missing")
		filtered := result.([]labeled)
		if len(filtered) != 0 {
			t.Errorf("Expected 0 matches, got %d", len(filtered))
		}
	})

	t.Run("empty_selector", func(t *testing.T) {
		result := filterByLabels(items, "")
		filtered := result.([]labeled)
		if len(filtered) != 3 {
			t.Errorf("Expected all 3 items with empty selector, got %d", len(filtered))
		}
	})

	t.Run("nil_input", func(t *testing.T) {
		result := filterByLabels(nil, "app=web")
		if result != nil {
			t.Error("Expected nil for nil input")
		}
	})
}

func TestParseLabelSelector(t *testing.T) {
	tests := []struct {
		selector string
		expected map[string]string
	}{
		{"app=web", map[string]string{"app": "web"}},
		{"app=web,env=prod", map[string]string{"app": "web", "env": "prod"}},
		{" app = web , env = prod ", map[string]string{"app": "web", "env": "prod"}},
		{"", map[string]string{}},
	}

	for _, tt := range tests {
		t.Run(tt.selector, func(t *testing.T) {
			result := parseLabelSelector(tt.selector)
			if len(result) != len(tt.expected) {
				t.Errorf("Expected %d entries, got %d", len(tt.expected), len(result))
			}
			for k, v := range tt.expected {
				if result[k] != v {
					t.Errorf("Expected %s=%s, got %s=%s", k, v, k, result[k])
				}
			}
		})
	}
}

// =====================
// Helper Function Tests
// =====================

func TestSliceLen(t *testing.T) {
	tests := []struct {
		name     string
		input    interface{}
		expected int
	}{
		{"nil", nil, 0},
		{"empty_slice", []string{}, 0},
		{"slice_with_items", []string{"a", "b"}, 2},
		{"non_slice", "hello", 1},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := sliceLen(tt.input); got != tt.expected {
				t.Errorf("sliceLen = %d, want %d", got, tt.expected)
			}
		})
	}
}

func TestSliceTruncate(t *testing.T) {
	t.Run("truncate", func(t *testing.T) {
		input := []string{"a", "b", "c", "d"}
		result := sliceTruncate(input, 2).([]string)
		if len(result) != 2 {
			t.Errorf("Expected 2 items, got %d", len(result))
		}
	})

	t.Run("under_limit", func(t *testing.T) {
		input := []string{"a", "b"}
		result := sliceTruncate(input, 5).([]string)
		if len(result) != 2 {
			t.Errorf("Expected 2 items, got %d", len(result))
		}
	})

	t.Run("nil", func(t *testing.T) {
		result := sliceTruncate(nil, 5)
		if result != nil {
			t.Error("Expected nil")
		}
	})
}

func TestGetStringParam(t *testing.T) {
	input := map[string]interface{}{
		"name":  "my-pod",
		"count": float64(5),
	}

	if got := getStringParam(input, "name"); got != "my-pod" {
		t.Errorf("Expected 'my-pod', got '%s'", got)
	}
	if got := getStringParam(input, "missing"); got != "" {
		t.Errorf("Expected empty string, got '%s'", got)
	}
	if got := getStringParam(input, "count"); got != "" {
		t.Errorf("Expected empty string for non-string type, got '%s'", got)
	}
}

func TestGetIntParam(t *testing.T) {
	input := map[string]interface{}{
		"count": float64(42),
		"name":  "text",
	}

	if got := getIntParam(input, "count"); got != 42 {
		t.Errorf("Expected 42, got %d", got)
	}
	if got := getIntParam(input, "missing"); got != 0 {
		t.Errorf("Expected 0, got %d", got)
	}
	if got := getIntParam(input, "name"); got != 0 {
		t.Errorf("Expected 0 for non-number, got %d", got)
	}
}

func TestGetBoolParam(t *testing.T) {
	input := map[string]interface{}{
		"confirmed": true,
		"name":      "text",
	}

	if got := getBoolParam(input, "confirmed"); !got {
		t.Error("Expected true")
	}
	if got := getBoolParam(input, "missing"); got {
		t.Error("Expected false for missing key")
	}
	if got := getBoolParam(input, "name"); got {
		t.Error("Expected false for non-bool type")
	}
}

// =====================
// stripRawFields Tests
// =====================

func TestStripRawFields(t *testing.T) {
	type WithRaw struct {
		Name string
		Raw  interface{}
	}

	t.Run("strips_raw_from_slice", func(t *testing.T) {
		items := []WithRaw{
			{Name: "a", Raw: "big-payload"},
			{Name: "b", Raw: map[string]string{"key": "val"}},
		}
		result := stripRawFields(items)
		stripped := result.([]WithRaw)
		for _, item := range stripped {
			if item.Raw != nil {
				t.Errorf("Expected Raw to be nil for %s, got %v", item.Name, item.Raw)
			}
		}
	})

	t.Run("no_raw_field", func(t *testing.T) {
		type NoRaw struct {
			Name string
		}
		items := []NoRaw{{Name: "a"}}
		result := stripRawFields(items)
		if result == nil {
			t.Error("Expected non-nil result")
		}
	})

	t.Run("non_slice", func(t *testing.T) {
		result := stripRawFields("hello")
		if result != "hello" {
			t.Error("Expected non-slice to pass through unchanged")
		}
	})

	t.Run("nil", func(t *testing.T) {
		result := stripRawFields(nil)
		if result != nil {
			t.Error("Expected nil")
		}
	})
}
