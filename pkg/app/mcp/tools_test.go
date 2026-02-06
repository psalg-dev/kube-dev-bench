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
	lastGetPodsNamespace         string
	lastGetServicesNamespace     string
	lastGetNodesCall             bool
	lastGetPVsCall               bool
	lastGetStorageClassesCall    bool
	lastGetClusterRolesCall      bool
	lastGetClusterRoleBindingsCall bool
	lastGetCRDsCall              bool
	lastGetPodDetailNS           string
	lastGetPodDetailName         string
	lastScaleResourceKind        string
	lastScaleResourceNS          string
	lastScaleResourceName        string
	lastScaleResourceReplicas    int
	lastGetPodLogsNS             string
	lastGetPodLogsName           string
	lastGetPodLogsContainer      string
	lastGetPodLogsLines          int
	lastGetSwarmServiceID        string
	lastScaleSwarmServiceID      string
	lastScaleSwarmServiceReplicas int
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
	return []string{"pod1", "pod2"}, nil
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

// Phase 1 resources
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
	return "log line 1\nlog line 2", nil
}

func (m *mockServerInterface) GetPodLogsPrevious(namespace, podName, container string, lines int) (string, error) {
	return "previous log line 1", nil
}

// Phase 3: K8s Diagnostics methods
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

// Phase 4: Docker Swarm detail methods
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

// Test: Tool Registration
func TestToolRegistration(t *testing.T) {
	server := createTestServer()

	// Test that all expected tools are registered
	expectedTools := []string{
		// Phase 1 - Kubernetes List Tools (15)
		"k8s_list_pods",
		"k8s_list_deployments",
		"k8s_list_services",
		"k8s_list_endpoints",
		"k8s_list_ingresses",
		"k8s_list_network_policies",
		"k8s_list_replicasets",
		"k8s_list_persistent_volumes",
		"k8s_list_persistent_volume_claims",
		"k8s_list_storage_classes",
		"k8s_list_nodes",
		"k8s_list_service_accounts",
		"k8s_list_roles",
		"k8s_list_cluster_roles",
		"k8s_list_role_bindings",
		"k8s_list_cluster_role_bindings",
		"k8s_list_crds",
		"k8s_list_statefulsets",
		"k8s_list_daemonsets",
		"k8s_list_jobs",
		"k8s_list_cronjobs",
		"k8s_list_configmaps",
		"k8s_list_secrets",
		"k8s_get_resource_counts",
		// Phase 2 - Describe/Detail Tools (11)
		"k8s_describe_pod",
		"k8s_describe_deployment",
		"k8s_describe_service",
		"k8s_describe_ingress",
		"k8s_describe_node",
		"k8s_describe_pvc",
		"k8s_describe_pv",
		"k8s_describe_statefulset",
		"k8s_describe_daemonset",
		"k8s_describe_replicaset",
		"k8s_describe_job",
		"k8s_describe_cronjob",
		"k8s_get_resource_yaml",
		// Phase 3 - Diagnostics Tools (5)
		"k8s_get_pod_logs_previous",
		"k8s_top_pods",
		"k8s_top_nodes",
		"k8s_get_rollout_status",
		"k8s_get_rollout_history",
		// Phase 4 - Swarm Tools (8)
		"swarm_list_stacks",
		"swarm_list_networks",
		"swarm_list_volumes",
		"swarm_list_secrets",
		"swarm_list_configs",
		"swarm_inspect_service",
		"swarm_inspect_task",
		"swarm_inspect_node",
		// Existing tools
		"k8s_get_pod_logs",
		"k8s_get_events",
		"k8s_scale_deployment",
		"k8s_restart_deployment",
		"swarm_list_services",
		"swarm_list_tasks",
		"swarm_list_nodes",
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

// Test: Input Schema Validation
func TestInputSchemaValidation(t *testing.T) {
	server := createTestServer()

	tests := []struct {
		toolName         string
		requiredParams   []string
		optionalParams   []string
		hasNamespace     bool
		namespaceInProps bool
	}{
		{
			toolName:         "k8s_list_pods",
			requiredParams:   []string{},
			optionalParams:   []string{"namespace"},
			hasNamespace:     false,
			namespaceInProps: true,
		},
		{
			toolName:         "k8s_get_pod_logs",
			requiredParams:   []string{"name"},
			optionalParams:   []string{"namespace", "container", "tailLines"},
			hasNamespace:     false,
			namespaceInProps: true,
		},
		{
			toolName:         "k8s_describe_pod",
			requiredParams:   []string{"name"},
			optionalParams:   []string{"namespace"},
			hasNamespace:     false,
			namespaceInProps: true,
		},
		{
			toolName:         "k8s_list_nodes",
			requiredParams:   []string{},
			optionalParams:   []string{},
			hasNamespace:     false,
			namespaceInProps: false,
		},
		{
			toolName:         "k8s_get_rollout_status",
			requiredParams:   []string{"kind", "name"},
			optionalParams:   []string{"namespace"},
			hasNamespace:     false,
			namespaceInProps: true,
		},
		{
			toolName:         "swarm_inspect_service",
			requiredParams:   []string{"id"},
			optionalParams:   []string{},
			hasNamespace:     false,
			namespaceInProps: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.toolName+"_schema", func(t *testing.T) {
			tool, exists := server.tools[tt.toolName]
			if !exists {
				t.Fatalf("Tool %s not found", tt.toolName)
			}

			schema := tool.InputSchema
			if schema == nil {
				t.Fatal("InputSchema is nil")
			}

			// Check required parameters
			required, ok := schema["required"].([]string)
			if !ok && len(tt.requiredParams) > 0 {
				t.Errorf("Expected required params but found none")
			}

			if len(required) != len(tt.requiredParams) {
				t.Errorf("Expected %d required params, got %d", len(tt.requiredParams), len(required))
			}

			for _, param := range tt.requiredParams {
				found := false
				for _, r := range required {
					if r == param {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("Required parameter %s not found in schema", param)
				}
			}

			// Check properties
			props, ok := schema["properties"].(map[string]interface{})
			if !ok {
				t.Fatal("Properties not found in schema")
			}

			// Verify namespace property existence
			if tt.namespaceInProps {
				if _, exists := props["namespace"]; !exists {
					t.Error("Namespace property should exist but doesn't")
				}
			} else {
				if _, exists := props["namespace"]; exists {
					t.Error("Namespace property should not exist but does")
				}
			}
		})
	}
}

// Test: Namespace Defaulting
func TestNamespaceDefaulting(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)

	tests := []struct {
		name              string
		toolName          string
		input             map[string]interface{}
		expectedNamespace string
		checkField        string
	}{
		{
			name:              "namespace_provided",
			toolName:          "k8s_list_pods",
			input:             map[string]interface{}{"namespace": "kube-system"},
			expectedNamespace: "kube-system",
			checkField:        "lastGetPodsNamespace",
		},
		{
			name:              "namespace_omitted",
			toolName:          "k8s_list_pods",
			input:             map[string]interface{}{},
			expectedNamespace: "default",
			checkField:        "lastGetPodsNamespace",
		},
		{
			name:              "namespace_empty_string",
			toolName:          "k8s_list_pods",
			input:             map[string]interface{}{"namespace": ""},
			expectedNamespace: "default",
			checkField:        "lastGetPodsNamespace",
		},
		{
			name:              "service_namespace_provided",
			toolName:          "k8s_list_services",
			input:             map[string]interface{}{"namespace": "production"},
			expectedNamespace: "production",
			checkField:        "lastGetServicesNamespace",
		},
		{
			name:              "service_namespace_omitted",
			toolName:          "k8s_list_services",
			input:             map[string]interface{}{},
			expectedNamespace: "default",
			checkField:        "lastGetServicesNamespace",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tool := server.tools[tt.toolName]
			_, err := tool.Handler(ctx, tt.input)
			if err != nil {
				t.Fatalf("Handler error: %v", err)
			}

			// Check the namespace that was used
			switch tt.checkField {
			case "lastGetPodsNamespace":
				if mock.lastGetPodsNamespace != tt.expectedNamespace {
					t.Errorf("Expected namespace %s, got %s", tt.expectedNamespace, mock.lastGetPodsNamespace)
				}
			case "lastGetServicesNamespace":
				if mock.lastGetServicesNamespace != tt.expectedNamespace {
					t.Errorf("Expected namespace %s, got %s", tt.expectedNamespace, mock.lastGetServicesNamespace)
				}
			}
		})
	}
}

// Test: Cluster-scoped Resources
func TestClusterScopedResources(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)

	clusterScopedTools := []struct {
		toolName  string
		checkFlag string
	}{
		{"k8s_list_nodes", "lastGetNodesCall"},
		{"k8s_list_persistent_volumes", "lastGetPVsCall"},
		{"k8s_list_storage_classes", "lastGetStorageClassesCall"},
		{"k8s_list_cluster_roles", "lastGetClusterRolesCall"},
		{"k8s_list_cluster_role_bindings", "lastGetClusterRoleBindingsCall"},
		{"k8s_list_crds", "lastGetCRDsCall"},
		{"k8s_top_nodes", ""},
	}

	for _, tt := range clusterScopedTools {
		t.Run(tt.toolName+"_ignores_namespace", func(t *testing.T) {
			// Reset flags
			mock.lastGetNodesCall = false
			mock.lastGetPVsCall = false
			mock.lastGetStorageClassesCall = false
			mock.lastGetClusterRolesCall = false
			mock.lastGetClusterRoleBindingsCall = false
			mock.lastGetCRDsCall = false

			tool := server.tools[tt.toolName]
			if tool == nil {
				t.Fatalf("Tool %s not found", tt.toolName)
			}

			// Try with namespace parameter (should be ignored)
			input := map[string]interface{}{"namespace": "should-be-ignored"}
			_, err := tool.Handler(ctx, input)
			if err != nil {
				t.Fatalf("Handler error: %v", err)
			}

			// Verify the appropriate method was called
			switch tt.checkFlag {
			case "lastGetNodesCall":
				if !mock.lastGetNodesCall {
					t.Error("GetNodes was not called")
				}
			case "lastGetPVsCall":
				if !mock.lastGetPVsCall {
					t.Error("GetPersistentVolumes was not called")
				}
			case "lastGetStorageClassesCall":
				if !mock.lastGetStorageClassesCall {
					t.Error("GetStorageClasses was not called")
				}
			case "lastGetClusterRolesCall":
				if !mock.lastGetClusterRolesCall {
					t.Error("GetClusterRoles was not called")
				}
			case "lastGetClusterRoleBindingsCall":
				if !mock.lastGetClusterRoleBindingsCall {
					t.Error("GetClusterRoleBindings was not called")
				}
			case "lastGetCRDsCall":
				if !mock.lastGetCRDsCall {
					t.Error("GetCustomResourceDefinitions was not called")
				}
			}
		})
	}
}

// Test: Handler Delegation
func TestHandlerDelegation(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)

	t.Run("describe_pod_delegates_correctly", func(t *testing.T) {
		tool := server.tools["k8s_describe_pod"]
		input := map[string]interface{}{
			"namespace": "test-ns",
			"name":      "test-pod",
		}

		result, err := tool.Handler(ctx, input)
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}

		if mock.lastGetPodDetailNS != "test-ns" {
			t.Errorf("Expected namespace test-ns, got %s", mock.lastGetPodDetailNS)
		}
		if mock.lastGetPodDetailName != "test-pod" {
			t.Errorf("Expected name test-pod, got %s", mock.lastGetPodDetailName)
		}

		// Verify result structure
		resultMap, ok := result.(map[string]string)
		if !ok {
			t.Fatal("Result is not a map")
		}
		if resultMap["name"] != "test-pod" {
			t.Errorf("Result name mismatch: expected test-pod, got %s", resultMap["name"])
		}
	})

	t.Run("scale_deployment_delegates_correctly", func(t *testing.T) {
		tool := server.tools["k8s_scale_deployment"]
		input := map[string]interface{}{
			"namespace": "prod",
			"name":      "my-deployment",
			"replicas":  float64(5), // JSON numbers are float64
		}

		_, err := tool.Handler(ctx, input)
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
	})

	t.Run("get_pod_logs_delegates_with_defaults", func(t *testing.T) {
		tool := server.tools["k8s_get_pod_logs"]
		input := map[string]interface{}{
			"name": "my-pod",
		}

		result, err := tool.Handler(ctx, input)
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}

		if mock.lastGetPodLogsNS != "default" {
			t.Errorf("Expected namespace default, got %s", mock.lastGetPodLogsNS)
		}
		if mock.lastGetPodLogsName != "my-pod" {
			t.Errorf("Expected name my-pod, got %s", mock.lastGetPodLogsName)
		}
		if mock.lastGetPodLogsLines != 100 {
			t.Errorf("Expected default 100 lines, got %d", mock.lastGetPodLogsLines)
		}

		// Verify result contains expected fields
		resultMap, ok := result.(map[string]interface{})
		if !ok {
			t.Fatal("Result is not a map")
		}
		if resultMap["pod"] != "my-pod" {
			t.Errorf("Result pod mismatch")
		}
	})

	t.Run("swarm_inspect_service_delegates", func(t *testing.T) {
		tool := server.tools["swarm_inspect_service"]
		input := map[string]interface{}{
			"id": "service123",
		}

		result, err := tool.Handler(ctx, input)
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}

		resultMap, ok := result.(map[string]string)
		if !ok {
			t.Fatal("Result is not a map")
		}
		if resultMap["id"] != "service123" {
			t.Errorf("Expected id service123, got %s", resultMap["id"])
		}
	})
}

// Test: Error Handling
func TestErrorHandling(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	tests := []struct {
		name          string
		toolName      string
		input         map[string]interface{}
		expectedError string
	}{
		{
			name:          "describe_pod_missing_name",
			toolName:      "k8s_describe_pod",
			input:         map[string]interface{}{"namespace": "default"},
			expectedError: "pod name is required",
		},
		{
			name:          "get_pod_logs_missing_name",
			toolName:      "k8s_get_pod_logs",
			input:         map[string]interface{}{"namespace": "default"},
			expectedError: "pod name is required",
		},
		{
			name:          "scale_deployment_missing_name",
			toolName:      "k8s_scale_deployment",
			input:         map[string]interface{}{"replicas": float64(3)},
			expectedError: "deployment name is required",
		},
		{
			name:          "get_resource_yaml_missing_kind",
			toolName:      "k8s_get_resource_yaml",
			input:         map[string]interface{}{"name": "my-resource"},
			expectedError: "missing required parameter: kind",
		},
		{
			name:          "get_resource_yaml_missing_name",
			toolName:      "k8s_get_resource_yaml",
			input:         map[string]interface{}{"kind": "Pod"},
			expectedError: "missing required parameter: name",
		},
		{
			name:          "rollout_status_missing_kind",
			toolName:      "k8s_get_rollout_status",
			input:         map[string]interface{}{"name": "my-deployment"},
			expectedError: "missing required parameter: kind",
		},
		{
			name:          "rollout_status_missing_name",
			toolName:      "k8s_get_rollout_status",
			input:         map[string]interface{}{"kind": "Deployment"},
			expectedError: "missing required parameter: name",
		},
		{
			name:          "swarm_inspect_service_missing_id",
			toolName:      "swarm_inspect_service",
			input:         map[string]interface{}{},
			expectedError: "missing required parameter: id",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tool := server.tools[tt.toolName]
			if tool == nil {
				t.Fatalf("Tool %s not found", tt.toolName)
			}

			_, err := tool.Handler(ctx, tt.input)
			if err == nil {
				t.Fatal("Expected error but got none")
			}

			if err.Error() != tt.expectedError {
				t.Errorf("Expected error '%s', got '%s'", tt.expectedError, err.Error())
			}
		})
	}
}

// Test: Security Levels
func TestSecurityLevels(t *testing.T) {
	server := createTestServer()

	tests := []struct {
		toolName         string
		expectedSecurity OperationSecurity
	}{
		{"k8s_list_pods", SecuritySafe},
		{"k8s_get_pod_logs", SecuritySafe},
		{"k8s_describe_pod", SecuritySafe},
		{"k8s_top_nodes", SecuritySafe},
		{"swarm_list_services", SecuritySafe},
		{"k8s_scale_deployment", SecurityWrite},
		{"k8s_restart_deployment", SecurityWrite},
		{"swarm_scale_service", SecurityWrite},
	}

	for _, tt := range tests {
		t.Run(tt.toolName+"_security", func(t *testing.T) {
			tool := server.tools[tt.toolName]
			if tool == nil {
				t.Fatalf("Tool %s not found", tt.toolName)
			}

			if tool.Security != tt.expectedSecurity {
				t.Errorf("Expected security %s, got %s", tt.expectedSecurity, tool.Security)
			}
		})
	}
}

// Test: Phase 1 Tools Coverage
func TestPhase1ToolsCoverage(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	phase1Tools := []string{
		"k8s_list_services",
		"k8s_list_endpoints",
		"k8s_list_ingresses",
		"k8s_list_network_policies",
		"k8s_list_replicasets",
		"k8s_list_persistent_volumes",
		"k8s_list_persistent_volume_claims",
		"k8s_list_storage_classes",
		"k8s_list_nodes",
		"k8s_list_service_accounts",
		"k8s_list_roles",
		"k8s_list_cluster_roles",
		"k8s_list_role_bindings",
		"k8s_list_cluster_role_bindings",
		"k8s_list_crds",
	}

	for _, toolName := range phase1Tools {
		t.Run(toolName, func(t *testing.T) {
			tool := server.tools[toolName]
			if tool == nil {
				t.Fatalf("Tool %s not registered", toolName)
			}

			// Test execution
			input := map[string]interface{}{}
			_, err := tool.Handler(ctx, input)
			if err != nil {
				t.Fatalf("Handler failed: %v", err)
			}
		})
	}
}

// Test: Phase 2 Tools Coverage
func TestPhase2ToolsCoverage(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	phase2Tools := []struct {
		name  string
		input map[string]interface{}
	}{
		{"k8s_describe_service", map[string]interface{}{"name": "svc1"}},
		{"k8s_describe_node", map[string]interface{}{"name": "node1"}},
		{"k8s_describe_pvc", map[string]interface{}{"name": "pvc1"}},
		{"k8s_describe_pv", map[string]interface{}{"name": "pv1"}},
		{"k8s_describe_statefulset", map[string]interface{}{"name": "sts1"}},
		{"k8s_describe_daemonset", map[string]interface{}{"name": "ds1"}},
		{"k8s_describe_replicaset", map[string]interface{}{"name": "rs1"}},
		{"k8s_describe_job", map[string]interface{}{"name": "job1"}},
		{"k8s_describe_cronjob", map[string]interface{}{"name": "cj1"}},
		{"k8s_get_resource_yaml", map[string]interface{}{"kind": "Pod", "name": "pod1"}},
	}

	for _, tt := range phase2Tools {
		t.Run(tt.name, func(t *testing.T) {
			tool := server.tools[tt.name]
			if tool == nil {
				t.Fatalf("Tool %s not registered", tt.name)
			}

			_, err := tool.Handler(ctx, tt.input)
			if err != nil {
				t.Fatalf("Handler failed: %v", err)
			}
		})
	}
}

// Test: Phase 3 Tools Coverage
func TestPhase3ToolsCoverage(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	phase3Tools := []struct {
		name  string
		input map[string]interface{}
	}{
		{"k8s_get_pod_logs_previous", map[string]interface{}{"name": "pod1"}},
		{"k8s_top_pods", map[string]interface{}{}},
		{"k8s_top_nodes", map[string]interface{}{}},
		{"k8s_get_rollout_status", map[string]interface{}{"kind": "Deployment", "name": "deploy1"}},
		{"k8s_get_rollout_history", map[string]interface{}{"kind": "Deployment", "name": "deploy1"}},
	}

	for _, tt := range phase3Tools {
		t.Run(tt.name, func(t *testing.T) {
			tool := server.tools[tt.name]
			if tool == nil {
				t.Fatalf("Tool %s not registered", tt.name)
			}

			_, err := tool.Handler(ctx, tt.input)
			if err != nil {
				t.Fatalf("Handler failed: %v", err)
			}
		})
	}
}

// Test: Phase 4 Tools Coverage
func TestPhase4ToolsCoverage(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	phase4Tools := []struct {
		name  string
		input map[string]interface{}
	}{
		{"swarm_list_stacks", map[string]interface{}{}},
		{"swarm_list_networks", map[string]interface{}{}},
		{"swarm_list_volumes", map[string]interface{}{}},
		{"swarm_list_secrets", map[string]interface{}{}},
		{"swarm_list_configs", map[string]interface{}{}},
		{"swarm_inspect_service", map[string]interface{}{"id": "svc1"}},
		{"swarm_inspect_task", map[string]interface{}{"id": "task1"}},
		{"swarm_inspect_node", map[string]interface{}{"id": "node1"}},
	}

	for _, tt := range phase4Tools {
		t.Run(tt.name, func(t *testing.T) {
			tool := server.tools[tt.name]
			if tool == nil {
				t.Fatalf("Tool %s not registered", tt.name)
			}

			_, err := tool.Handler(ctx, tt.input)
			if err != nil {
				t.Fatalf("Handler failed: %v", err)
			}
		})
	}
}

// Test: Log Line Limiting
func TestLogLineLimiting(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)

	t.Run("respects_max_log_lines", func(t *testing.T) {
		tool := server.tools["k8s_get_pod_logs"]
		input := map[string]interface{}{
			"name":      "pod1",
			"tailLines": float64(5000), // Request more than max
		}

		_, err := tool.Handler(ctx, input)
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}

		// Should be capped at config.MaxLogLines (1000)
		if mock.lastGetPodLogsLines != 1000 {
			t.Errorf("Expected lines to be capped at 1000, got %d", mock.lastGetPodLogsLines)
		}
	})

	t.Run("allows_within_limit", func(t *testing.T) {
		tool := server.tools["k8s_get_pod_logs"]
		input := map[string]interface{}{
			"name":      "pod1",
			"tailLines": float64(500),
		}

		_, err := tool.Handler(ctx, input)
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}

		if mock.lastGetPodLogsLines != 500 {
			t.Errorf("Expected 500 lines, got %d", mock.lastGetPodLogsLines)
		}
	})
}

// Test: Additional Handler Coverage
func TestAdditionalHandlersCoverage(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	t.Run("k8s_list_deployments", func(t *testing.T) {
		tool := server.tools["k8s_list_deployments"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("k8s_list_statefulsets", func(t *testing.T) {
		tool := server.tools["k8s_list_statefulsets"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("k8s_list_daemonsets", func(t *testing.T) {
		tool := server.tools["k8s_list_daemonsets"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("k8s_list_jobs", func(t *testing.T) {
		tool := server.tools["k8s_list_jobs"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("k8s_list_cronjobs", func(t *testing.T) {
		tool := server.tools["k8s_list_cronjobs"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("k8s_list_configmaps", func(t *testing.T) {
		tool := server.tools["k8s_list_configmaps"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("k8s_list_secrets", func(t *testing.T) {
		tool := server.tools["k8s_list_secrets"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("k8s_get_resource_counts", func(t *testing.T) {
		tool := server.tools["k8s_get_resource_counts"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("k8s_get_events", func(t *testing.T) {
		tool := server.tools["k8s_get_events"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("k8s_restart_deployment", func(t *testing.T) {
		tool := server.tools["k8s_restart_deployment"]
		result, err := tool.Handler(ctx, map[string]interface{}{"name": "my-deploy"})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("swarm_list_services", func(t *testing.T) {
		tool := server.tools["swarm_list_services"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("swarm_list_tasks", func(t *testing.T) {
		tool := server.tools["swarm_list_tasks"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("swarm_list_nodes", func(t *testing.T) {
		tool := server.tools["swarm_list_nodes"]
		result, err := tool.Handler(ctx, map[string]interface{}{})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("swarm_get_service_logs", func(t *testing.T) {
		tool := server.tools["swarm_get_service_logs"]
		result, err := tool.Handler(ctx, map[string]interface{}{"service": "svc1"})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})

	t.Run("swarm_scale_service", func(t *testing.T) {
		tool := server.tools["swarm_scale_service"]
		result, err := tool.Handler(ctx, map[string]interface{}{
			"service":  "svc1",
			"replicas": float64(3),
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result, got nil")
		}
	})
}

// Test: Swarm Connection Check
func TestSwarmConnectionCheck(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)

	swarmTools := []string{
		"swarm_list_stacks",
		"swarm_list_networks",
		"swarm_list_volumes",
		"swarm_list_secrets",
		"swarm_list_configs",
	}

	for _, toolName := range swarmTools {
		t.Run(toolName+"_connected", func(t *testing.T) {
			mock.swarmConnected = true
			tool := server.tools[toolName]
			_, err := tool.Handler(ctx, map[string]interface{}{})
			if err != nil {
				t.Fatalf("Expected no error when swarm connected, got: %v", err)
			}
		})

		t.Run(toolName+"_not_connected", func(t *testing.T) {
			mock.swarmConnected = false
			tool := server.tools[toolName]
			_, err := tool.Handler(ctx, map[string]interface{}{})
			if err == nil {
				t.Error("Expected error when swarm not connected")
			}
			expectedError := "Docker Swarm is not connected"
			if err.Error() != expectedError {
				t.Errorf("Expected error '%s', got '%s'", expectedError, err.Error())
			}
		})
	}
}

// Test: Resource YAML Handler
func TestResourceYAMLHandler(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	tests := []struct {
		name  string
		input map[string]interface{}
	}{
		{
			name:  "with_namespace",
			input: map[string]interface{}{"kind": "Pod", "name": "my-pod", "namespace": "prod"},
		},
		{
			name:  "without_namespace",
			input: map[string]interface{}{"kind": "Deployment", "name": "my-deploy"},
		},
		{
			name:  "cluster_resource",
			input: map[string]interface{}{"kind": "Node", "name": "node1"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tool := server.tools["k8s_get_resource_yaml"]
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

// Test: Rollout Handlers
func TestRolloutHandlers(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	kinds := []string{"Deployment", "StatefulSet", "DaemonSet"}

	for _, kind := range kinds {
		t.Run("rollout_status_"+kind, func(t *testing.T) {
			tool := server.tools["k8s_get_rollout_status"]
			result, err := tool.Handler(ctx, map[string]interface{}{
				"kind": kind,
				"name": "test-resource",
			})
			if err != nil {
				t.Fatalf("Handler error: %v", err)
			}
			if result == nil {
				t.Error("Expected result")
			}
		})

		t.Run("rollout_history_"+kind, func(t *testing.T) {
			tool := server.tools["k8s_get_rollout_history"]
			result, err := tool.Handler(ctx, map[string]interface{}{
				"kind": kind,
				"name": "test-resource",
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

// Test: All Describe Handlers
func TestAllDescribeHandlers(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	tests := []struct {
		toolName string
		input    map[string]interface{}
	}{
		{"k8s_describe_deployment", map[string]interface{}{"name": "deploy1"}},
		{"k8s_describe_ingress", map[string]interface{}{"name": "ingress1"}},
	}

	for _, tt := range tests {
		t.Run(tt.toolName, func(t *testing.T) {
			tool := server.tools[tt.toolName]
			result, err := tool.Handler(ctx, tt.input)
			if err != nil {
				t.Fatalf("Handler error: %v", err)
			}
			if result == nil {
				t.Error("Expected result")
			}
		})
	}
}

// Test: Describe Handlers Error Cases
func TestDescribeHandlersErrors(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	tests := []struct {
		name          string
		toolName      string
		input         map[string]interface{}
		expectedError string
	}{
		{
			name:          "describe_deployment_missing_name",
			toolName:      "k8s_describe_deployment",
			input:         map[string]interface{}{},
			expectedError: "deployment name is required",
		},
		{
			name:          "describe_ingress_missing_name",
			toolName:      "k8s_describe_ingress",
			input:         map[string]interface{}{},
			expectedError: "missing required parameter: name",
		},
		{
			name:          "describe_service_missing_name",
			toolName:      "k8s_describe_service",
			input:         map[string]interface{}{},
			expectedError: "missing required parameter: name",
		},
		{
			name:          "describe_node_missing_name",
			toolName:      "k8s_describe_node",
			input:         map[string]interface{}{},
			expectedError: "missing required parameter: name",
		},
		{
			name:          "describe_pvc_missing_name",
			toolName:      "k8s_describe_pvc",
			input:         map[string]interface{}{},
			expectedError: "missing required parameter: name",
		},
		{
			name:          "describe_pv_missing_name",
			toolName:      "k8s_describe_pv",
			input:         map[string]interface{}{},
			expectedError: "missing required parameter: name",
		},
		{
			name:          "describe_statefulset_missing_name",
			toolName:      "k8s_describe_statefulset",
			input:         map[string]interface{}{},
			expectedError: "missing required parameter: name",
		},
		{
			name:          "describe_daemonset_missing_name",
			toolName:      "k8s_describe_daemonset",
			input:         map[string]interface{}{},
			expectedError: "missing required parameter: name",
		},
		{
			name:          "describe_replicaset_missing_name",
			toolName:      "k8s_describe_replicaset",
			input:         map[string]interface{}{},
			expectedError: "missing required parameter: name",
		},
		{
			name:          "describe_job_missing_name",
			toolName:      "k8s_describe_job",
			input:         map[string]interface{}{},
			expectedError: "missing required parameter: name",
		},
		{
			name:          "describe_cronjob_missing_name",
			toolName:      "k8s_describe_cronjob",
			input:         map[string]interface{}{},
			expectedError: "missing required parameter: name",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			tool := server.tools[tt.toolName]
			_, err := tool.Handler(ctx, tt.input)
			if err == nil {
				t.Fatal("Expected error but got none")
			}
			if err.Error() != tt.expectedError {
				t.Errorf("Expected error '%s', got '%s'", tt.expectedError, err.Error())
			}
		})
	}
}

// Test: Swarm Error Cases
func TestSwarmErrorCases(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	t.Run("swarm_get_service_logs_missing_service", func(t *testing.T) {
		tool := server.tools["swarm_get_service_logs"]
		_, err := tool.Handler(ctx, map[string]interface{}{})
		if err == nil {
			t.Fatal("Expected error")
		}
		if err.Error() != "service name/ID is required" {
			t.Errorf("Unexpected error: %v", err)
		}
	})

	t.Run("swarm_scale_service_missing_service", func(t *testing.T) {
		tool := server.tools["swarm_scale_service"]
		_, err := tool.Handler(ctx, map[string]interface{}{"replicas": float64(3)})
		if err == nil {
			t.Fatal("Expected error")
		}
		if err.Error() != "service name/ID is required" {
			t.Errorf("Unexpected error: %v", err)
		}
	})

	t.Run("restart_deployment_missing_name", func(t *testing.T) {
		tool := server.tools["k8s_restart_deployment"]
		_, err := tool.Handler(ctx, map[string]interface{}{})
		if err == nil {
			t.Fatal("Expected error")
		}
		if err.Error() != "deployment name is required" {
			t.Errorf("Unexpected error: %v", err)
		}
	})

	t.Run("swarm_inspect_service_missing_id", func(t *testing.T) {
		tool := server.tools["swarm_inspect_service"]
		_, err := tool.Handler(ctx, map[string]interface{}{})
		if err == nil {
			t.Fatal("Expected error")
		}
		if err.Error() != "missing required parameter: id" {
			t.Errorf("Unexpected error: %v", err)
		}
	})

	t.Run("swarm_inspect_task_missing_id", func(t *testing.T) {
		tool := server.tools["swarm_inspect_task"]
		_, err := tool.Handler(ctx, map[string]interface{}{})
		if err == nil {
			t.Fatal("Expected error")
		}
		if err.Error() != "missing required parameter: id" {
			t.Errorf("Unexpected error: %v", err)
		}
	})

	t.Run("swarm_inspect_node_missing_id", func(t *testing.T) {
		tool := server.tools["swarm_inspect_node"]
		_, err := tool.Handler(ctx, map[string]interface{}{})
		if err == nil {
			t.Fatal("Expected error")
		}
		if err.Error() != "missing required parameter: id" {
			t.Errorf("Unexpected error: %v", err)
		}
	})
}

// Test: Previous Logs Handler
func TestPreviousLogsHandler(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	t.Run("with_all_params", func(t *testing.T) {
		tool := server.tools["k8s_get_pod_logs_previous"]
		result, err := tool.Handler(ctx, map[string]interface{}{
			"name":      "pod1",
			"container": "app",
			"tailLines": float64(200),
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result")
		}
	})

	t.Run("missing_name", func(t *testing.T) {
		tool := server.tools["k8s_get_pod_logs_previous"]
		_, err := tool.Handler(ctx, map[string]interface{}{})
		if err == nil {
			t.Fatal("Expected error")
		}
		if err.Error() != "missing required parameter: name" {
			t.Errorf("Unexpected error: %v", err)
		}
	})
}

// Test: Tool Count
func TestToolCount(t *testing.T) {
	server := createTestServer()

	// Verify we have all expected tools
	expectedCount := 59 // Total number of tools registered
	if len(server.tools) != expectedCount {
		t.Errorf("Expected %d tools, got %d", expectedCount, len(server.tools))
	}
}

// Test: Scale Deployment Edge Cases
func TestScaleDeploymentEdgeCases(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	t.Run("scale_to_zero", func(t *testing.T) {
		tool := server.tools["k8s_scale_deployment"]
		result, err := tool.Handler(ctx, map[string]interface{}{
			"name":     "deploy1",
			"replicas": float64(0),
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result")
		}
	})

	t.Run("scale_large_number", func(t *testing.T) {
		tool := server.tools["k8s_scale_deployment"]
		result, err := tool.Handler(ctx, map[string]interface{}{
			"name":     "deploy1",
			"replicas": float64(100),
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if result == nil {
			t.Error("Expected result")
		}
	})
}

// Test: Swarm Not Connected Error Paths
func TestSwarmNotConnectedPaths(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)
	mock.swarmConnected = false

	swarmTools := []struct {
		name  string
		input map[string]interface{}
	}{
		{"swarm_list_services", map[string]interface{}{}},
		{"swarm_list_tasks", map[string]interface{}{}},
		{"swarm_list_nodes", map[string]interface{}{}},
		{"swarm_get_service_logs", map[string]interface{}{"service": "svc1"}},
		{"swarm_scale_service", map[string]interface{}{"service": "svc1", "replicas": float64(3)}},
		{"swarm_inspect_service", map[string]interface{}{"id": "svc1"}},
		{"swarm_inspect_task", map[string]interface{}{"id": "task1"}},
		{"swarm_inspect_node", map[string]interface{}{"id": "node1"}},
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

// Test: Log Truncation
func TestLogTruncation(t *testing.T) {
	config := MCPConfigData{
		Enabled:     true,
		Host:        "localhost",
		Port:        3000,
		MaxLogLines: 10, // Minimum allowed by Validate()
	}

	mock := &mockServerInterface{
		currentNamespace: "default",
	}

	server, _ := NewServer(mock, config)

	t.Run("logs_under_limit", func(t *testing.T) {
		logs := "line1\nline2\nline3"
		result := server.truncateLogs(logs)
		if result != logs {
			t.Error("Logs should not be truncated when under limit")
		}
	})

	t.Run("logs_over_limit", func(t *testing.T) {
		// Create more than 10 lines (11 lines total)
		logs := "line1\nline2\nline3\nline4\nline5\nline6\nline7\nline8\nline9\nline10\nline11"
		result := server.truncateLogs(logs)
		if !strings.Contains(result, "... (truncated to last 10 lines)") {
			t.Errorf("Expected truncation message, got: %s", result)
		}
		// Verify we have the last 10 lines
		if !strings.Contains(result, "line11") {
			t.Error("Expected to keep last line (line11)")
		}
		if !strings.Contains(result, "line2") {
			t.Error("Expected to keep line2 (part of last 10)")
		}
		if strings.Contains(result, "line1") && !strings.Contains(result, "line11") {
			t.Error("line1 should be truncated")
		}
	})
}

// Test: Rollout History Missing Name
func TestRolloutHistoryMissingName(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()

	tool := server.tools["k8s_get_rollout_history"]
	_, err := tool.Handler(ctx, map[string]interface{}{"kind": "Deployment"})
	if err == nil {
		t.Fatal("Expected error for missing name")
	}
	if err.Error() != "missing required parameter: name" {
		t.Errorf("Unexpected error: %v", err)
	}
}

// Test: Pod Logs Container Parameter
func TestPodLogsContainerParameter(t *testing.T) {
	server := createTestServer()
	ctx := context.Background()
	mock := server.app.(*mockServerInterface)

	t.Run("with_container", func(t *testing.T) {
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
	})

	t.Run("without_container", func(t *testing.T) {
		mock.lastGetPodLogsContainer = ""
		tool := server.tools["k8s_get_pod_logs"]
		_, err := tool.Handler(ctx, map[string]interface{}{
			"name": "pod1",
		})
		if err != nil {
			t.Fatalf("Handler error: %v", err)
		}
		if mock.lastGetPodLogsContainer != "" {
			t.Errorf("Expected empty container, got '%s'", mock.lastGetPodLogsContainer)
		}
	})
}



