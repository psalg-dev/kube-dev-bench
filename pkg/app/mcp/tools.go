package mcp

import (
	"context"
	"fmt"
	"strings"
)

// registerTools registers all available MCP tools
func (s *MCPServer) registerTools() {
	// =====================
	// Kubernetes Read-Only Tools
	// =====================

	// k8s_list_pods - List pods in namespace(s)
	s.tools["k8s_list_pods"] = &ToolDefinition{
		Name:        "k8s_list_pods",
		Description: "List pods in a Kubernetes namespace. Returns pod name, status, restarts, and uptime. If namespace is omitted, uses the currently selected namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list pods from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListPods,
	}

	// k8s_get_pod_logs - Retrieve pod logs
	s.tools["k8s_get_pod_logs"] = &ToolDefinition{
		Name:        "k8s_get_pod_logs",
		Description: "Retrieve logs from a specific pod. Optionally specify a container name for multi-container pods.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the pod. Omit to use current namespace.",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the pod.",
				},
				"container": map[string]interface{}{
					"type":        "string",
					"description": "Container name (optional, for multi-container pods).",
				},
				"tailLines": map[string]interface{}{
					"type":        "integer",
					"description": "Number of lines to retrieve from the end of the log. Default: 100.",
				},
			},
			"required": []string{"name"},
		},
		Handler: s.handleGetPodLogs,
	}

	// k8s_get_events - Get Kubernetes events
	s.tools["k8s_get_events"] = &ToolDefinition{
		Name:        "k8s_get_events",
		Description: "Get Kubernetes events for a specific resource or namespace. Useful for debugging issues.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to get events from. Omit to use current namespace.",
				},
				"kind": map[string]interface{}{
					"type":        "string",
					"description": "Resource kind (e.g., Pod, Deployment). Optional filter.",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Resource name. Optional filter.",
				},
			},
		},
		Handler: s.handleGetEvents,
	}

	// k8s_describe_pod - Get detailed pod information
	s.tools["k8s_describe_pod"] = &ToolDefinition{
		Name:        "k8s_describe_pod",
		Description: "Get detailed information about a specific pod, including spec, status, and containers.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the pod. Omit to use current namespace.",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the pod.",
				},
			},
			"required": []string{"name"},
		},
		Handler: s.handleDescribePod,
	}

	// k8s_list_deployments - List deployments
	s.tools["k8s_list_deployments"] = &ToolDefinition{
		Name:        "k8s_list_deployments",
		Description: "List deployments in a namespace. Returns deployment name, replicas, and status.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list deployments from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListDeployments,
	}

	// k8s_describe_deployment - Get detailed deployment info
	s.tools["k8s_describe_deployment"] = &ToolDefinition{
		Name:        "k8s_describe_deployment",
		Description: "Get detailed information about a specific deployment, including spec and rollout status.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the deployment. Omit to use current namespace.",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the deployment.",
				},
			},
			"required": []string{"name"},
		},
		Handler: s.handleDescribeDeployment,
	}

	// k8s_list_statefulsets
	s.tools["k8s_list_statefulsets"] = &ToolDefinition{
		Name:        "k8s_list_statefulsets",
		Description: "List StatefulSets in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list StatefulSets from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListStatefulSets,
	}

	// k8s_list_daemonsets
	s.tools["k8s_list_daemonsets"] = &ToolDefinition{
		Name:        "k8s_list_daemonsets",
		Description: "List DaemonSets in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list DaemonSets from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListDaemonSets,
	}

	// k8s_list_jobs
	s.tools["k8s_list_jobs"] = &ToolDefinition{
		Name:        "k8s_list_jobs",
		Description: "List Jobs in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list Jobs from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListJobs,
	}

	// k8s_list_cronjobs
	s.tools["k8s_list_cronjobs"] = &ToolDefinition{
		Name:        "k8s_list_cronjobs",
		Description: "List CronJobs in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list CronJobs from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListCronJobs,
	}

	// k8s_list_configmaps
	s.tools["k8s_list_configmaps"] = &ToolDefinition{
		Name:        "k8s_list_configmaps",
		Description: "List ConfigMaps in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list ConfigMaps from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListConfigMaps,
	}

	// k8s_list_secrets
	s.tools["k8s_list_secrets"] = &ToolDefinition{
		Name:        "k8s_list_secrets",
		Description: "List Secrets in a namespace (metadata only, values are not exposed).",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list Secrets from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListSecrets,
	}

	// =====================
	// Phase 1 Networking Resources
	// =====================

	// k8s_list_services
	s.tools["k8s_list_services"] = &ToolDefinition{
		Name:        "k8s_list_services",
		Description: "List Services in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list Services from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListServices,
	}

	// k8s_list_endpoints
	s.tools["k8s_list_endpoints"] = &ToolDefinition{
		Name:        "k8s_list_endpoints",
		Description: "List Endpoints in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list Endpoints from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListEndpoints,
	}

	// k8s_list_ingresses
	s.tools["k8s_list_ingresses"] = &ToolDefinition{
		Name:        "k8s_list_ingresses",
		Description: "List Ingresses in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list Ingresses from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListIngresses,
	}

	// k8s_list_network_policies
	s.tools["k8s_list_network_policies"] = &ToolDefinition{
		Name:        "k8s_list_network_policies",
		Description: "List NetworkPolicies in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list NetworkPolicies from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListNetworkPolicies,
	}

	// =====================
	// Phase 1 Workload Resources
	// =====================

	// k8s_list_replicasets
	s.tools["k8s_list_replicasets"] = &ToolDefinition{
		Name:        "k8s_list_replicasets",
		Description: "List ReplicaSets in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list ReplicaSets from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListReplicaSets,
	}

	// =====================
	// Phase 1 Storage Resources
	// =====================

	// k8s_list_persistent_volumes
	s.tools["k8s_list_persistent_volumes"] = &ToolDefinition{
		Name:        "k8s_list_persistent_volumes",
		Description: "List PersistentVolumes (cluster-scoped resource).",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: s.handleListPersistentVolumes,
	}

	// k8s_list_persistent_volume_claims
	s.tools["k8s_list_persistent_volume_claims"] = &ToolDefinition{
		Name:        "k8s_list_persistent_volume_claims",
		Description: "List PersistentVolumeClaims in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list PersistentVolumeClaims from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListPersistentVolumeClaims,
	}

	// k8s_list_storage_classes
	s.tools["k8s_list_storage_classes"] = &ToolDefinition{
		Name:        "k8s_list_storage_classes",
		Description: "List StorageClasses (cluster-scoped resource).",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: s.handleListStorageClasses,
	}

	// =====================
	// Phase 1 Cluster Resources
	// =====================

	// k8s_list_nodes
	s.tools["k8s_list_nodes"] = &ToolDefinition{
		Name:        "k8s_list_nodes",
		Description: "List Nodes (cluster-scoped resource).",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: s.handleListNodes,
	}

	// =====================
	// Phase 1 RBAC Resources
	// =====================

	// k8s_list_service_accounts
	s.tools["k8s_list_service_accounts"] = &ToolDefinition{
		Name:        "k8s_list_service_accounts",
		Description: "List ServiceAccounts in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list ServiceAccounts from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListServiceAccounts,
	}

	// k8s_list_roles
	s.tools["k8s_list_roles"] = &ToolDefinition{
		Name:        "k8s_list_roles",
		Description: "List Roles in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list Roles from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListRoles,
	}

	// k8s_list_role_bindings
	s.tools["k8s_list_role_bindings"] = &ToolDefinition{
		Name:        "k8s_list_role_bindings",
		Description: "List RoleBindings in a namespace.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list RoleBindings from. Omit to use current namespace.",
				},
			},
		},
		Handler: s.handleListRoleBindings,
	}

	// k8s_list_cluster_roles
	s.tools["k8s_list_cluster_roles"] = &ToolDefinition{
		Name:        "k8s_list_cluster_roles",
		Description: "List ClusterRoles (cluster-scoped resource).",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: s.handleListClusterRoles,
	}

	// k8s_list_cluster_role_bindings
	s.tools["k8s_list_cluster_role_bindings"] = &ToolDefinition{
		Name:        "k8s_list_cluster_role_bindings",
		Description: "List ClusterRoleBindings (cluster-scoped resource).",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: s.handleListClusterRoleBindings,
	}

	// =====================
	// Phase 1 CRD Resources
	// =====================

	// k8s_list_crds
	s.tools["k8s_list_crds"] = &ToolDefinition{
		Name:        "k8s_list_crds",
		Description: "List CustomResourceDefinitions (cluster-scoped resource).",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: s.handleListCRDs,
	}

	// k8s_get_resource_counts - Get resource counts
	s.tools["k8s_get_resource_counts"] = &ToolDefinition{
		Name:        "k8s_get_resource_counts",
		Description: "Get aggregated counts of all Kubernetes resource types in the current namespace(s).",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: s.handleGetResourceCounts,
	}

	// =====================
	// Kubernetes Mutation Tools
	// =====================

	// k8s_scale_deployment - Scale deployment replicas
	s.tools["k8s_scale_deployment"] = &ToolDefinition{
		Name:        "k8s_scale_deployment",
		Description: "Scale a deployment to a specified number of replicas. Scaling to 0 requires confirmation.",
		Security:    SecurityWrite, // Changes to destructive for scale-to-zero
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the deployment. Omit to use current namespace.",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the deployment to scale.",
				},
				"replicas": map[string]interface{}{
					"type":        "integer",
					"description": "Target number of replicas.",
				},
				"confirmed": map[string]interface{}{
					"type":        "boolean",
					"description": "Set to true to confirm scale-to-zero operation.",
				},
			},
			"required": []string{"name", "replicas"},
		},
		Handler: s.handleScaleDeployment,
	}

	// k8s_restart_deployment - Restart deployment
	s.tools["k8s_restart_deployment"] = &ToolDefinition{
		Name:        "k8s_restart_deployment",
		Description: "Trigger a rolling restart of a deployment by updating the pod template.",
		Security:    SecurityWrite,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the deployment. Omit to use current namespace.",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the deployment to restart.",
				},
			},
			"required": []string{"name"},
		},
		Handler: s.handleRestartDeployment,
	}

	// =====================
	// Docker Swarm Read-Only Tools
	// =====================

	// swarm_list_services - List Swarm services
	s.tools["swarm_list_services"] = &ToolDefinition{
		Name:        "swarm_list_services",
		Description: "List Docker Swarm services with replicas and status.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: s.handleSwarmListServices,
	}

	// swarm_list_tasks - List Swarm tasks
	s.tools["swarm_list_tasks"] = &ToolDefinition{
		Name:        "swarm_list_tasks",
		Description: "List Docker Swarm tasks (containers) for all or a specific service.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"service": map[string]interface{}{
					"type":        "string",
					"description": "Service name or ID to filter tasks. Omit to list all tasks.",
				},
			},
		},
		Handler: s.handleSwarmListTasks,
	}

	// swarm_list_nodes - List Swarm nodes
	s.tools["swarm_list_nodes"] = &ToolDefinition{
		Name:        "swarm_list_nodes",
		Description: "List Docker Swarm nodes with status and availability.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type":       "object",
			"properties": map[string]interface{}{},
		},
		Handler: s.handleSwarmListNodes,
	}

	// swarm_get_service_logs - Retrieve service logs
	s.tools["swarm_get_service_logs"] = &ToolDefinition{
		Name:        "swarm_get_service_logs",
		Description: "Retrieve logs from a Docker Swarm service.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"service": map[string]interface{}{
					"type":        "string",
					"description": "Service name or ID.",
				},
				"tailLines": map[string]interface{}{
					"type":        "integer",
					"description": "Number of lines to retrieve. Default: 100.",
				},
			},
			"required": []string{"service"},
		},
		Handler: s.handleSwarmGetServiceLogs,
	}

	// =====================
	// Docker Swarm Mutation Tools
	// =====================

	// swarm_scale_service - Scale Swarm service
	s.tools["swarm_scale_service"] = &ToolDefinition{
		Name:        "swarm_scale_service",
		Description: "Scale a Docker Swarm service to a specified number of replicas.",
		Security:    SecurityWrite,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"service": map[string]interface{}{
					"type":        "string",
					"description": "Service name or ID to scale.",
				},
				"replicas": map[string]interface{}{
					"type":        "integer",
					"description": "Target number of replicas.",
				},
				"confirmed": map[string]interface{}{
					"type":        "boolean",
					"description": "Set to true to confirm scale-to-zero operation.",
				},
			},
			"required": []string{"service", "replicas"},
		},
		Handler: s.handleSwarmScaleService,
	}
}

// =====================
// Tool Handlers
// =====================

func (s *MCPServer) handleListPods(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetPods(namespace)
}

func (s *MCPServer) handleGetPodLogs(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	name, _ := input["name"].(string)
	if name == "" {
		return nil, fmt.Errorf("pod name is required")
	}

	container, _ := input["container"].(string)

	tailLines := 100
	if tl, ok := input["tailLines"].(float64); ok {
		tailLines = int(tl)
	}

	// Respect MaxLogLines config
	if tailLines > s.config.MaxLogLines {
		tailLines = s.config.MaxLogLines
	}

	logs, err := s.app.GetPodLogs(namespace, name, container, tailLines)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"pod":       name,
		"namespace": namespace,
		"container": container,
		"lines":     tailLines,
		"logs":      logs,
	}, nil
}

func (s *MCPServer) handleGetEvents(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	kind, _ := input["kind"].(string)
	name, _ := input["name"].(string)

	return s.app.GetResourceEvents(namespace, kind, name)
}

func (s *MCPServer) handleDescribePod(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	name, _ := input["name"].(string)
	if name == "" {
		return nil, fmt.Errorf("pod name is required")
	}

	return s.app.GetPodDetail(namespace, name)
}

func (s *MCPServer) handleListDeployments(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetDeployments(namespace)
}

func (s *MCPServer) handleDescribeDeployment(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	name, _ := input["name"].(string)
	if name == "" {
		return nil, fmt.Errorf("deployment name is required")
	}

	return s.app.GetDeploymentDetail(namespace, name)
}

func (s *MCPServer) handleListStatefulSets(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetStatefulSets(namespace)
}

func (s *MCPServer) handleListDaemonSets(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetDaemonSets(namespace)
}

func (s *MCPServer) handleListJobs(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetJobs(namespace)
}

func (s *MCPServer) handleListCronJobs(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetCronJobs(namespace)
}

func (s *MCPServer) handleListConfigMaps(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetConfigMaps(namespace)
}

func (s *MCPServer) handleListSecrets(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetSecrets(namespace)
}

func (s *MCPServer) handleGetResourceCounts(ctx context.Context, input map[string]interface{}) (any, error) {
	return s.app.GetResourceCounts(), nil
}

// =====================
// Phase 1 Resource Handlers - Networking
// =====================

func (s *MCPServer) handleListServices(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetServices(namespace)
}

func (s *MCPServer) handleListEndpoints(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetEndpoints(namespace)
}

func (s *MCPServer) handleListIngresses(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetIngresses(namespace)
}

func (s *MCPServer) handleListNetworkPolicies(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetNetworkPolicies(namespace)
}

// =====================
// Phase 1 Resource Handlers - Workload
// =====================

func (s *MCPServer) handleListReplicaSets(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetReplicaSets(namespace)
}

// =====================
// Phase 1 Resource Handlers - Storage
// =====================

func (s *MCPServer) handleListPersistentVolumes(ctx context.Context, input map[string]interface{}) (any, error) {
	return s.app.GetPersistentVolumes()
}

func (s *MCPServer) handleListPersistentVolumeClaims(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetPersistentVolumeClaims(namespace)
}

func (s *MCPServer) handleListStorageClasses(ctx context.Context, input map[string]interface{}) (any, error) {
	return s.app.GetStorageClasses()
}

// =====================
// Phase 1 Resource Handlers - Cluster
// =====================

func (s *MCPServer) handleListNodes(ctx context.Context, input map[string]interface{}) (any, error) {
	return s.app.GetNodes()
}

// =====================
// Phase 1 Resource Handlers - RBAC
// =====================

func (s *MCPServer) handleListServiceAccounts(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetServiceAccounts(namespace)
}

func (s *MCPServer) handleListRoles(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetRoles(namespace)
}

func (s *MCPServer) handleListRoleBindings(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	return s.app.GetRoleBindings(namespace)
}

func (s *MCPServer) handleListClusterRoles(ctx context.Context, input map[string]interface{}) (any, error) {
	return s.app.GetClusterRoles()
}

func (s *MCPServer) handleListClusterRoleBindings(ctx context.Context, input map[string]interface{}) (any, error) {
	return s.app.GetClusterRoleBindings()
}

// =====================
// Phase 1 Resource Handlers - CRDs
// =====================

func (s *MCPServer) handleListCRDs(ctx context.Context, input map[string]interface{}) (any, error) {
	return s.app.GetCustomResourceDefinitions()
}

func (s *MCPServer) handleScaleDeployment(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	name, _ := input["name"].(string)
	if name == "" {
		return nil, fmt.Errorf("deployment name is required")
	}

	replicas := 0
	if r, ok := input["replicas"].(float64); ok {
		replicas = int(r)
	}

	if err := s.app.ScaleResource("Deployment", namespace, name, replicas); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"success":   true,
		"message":   fmt.Sprintf("Deployment %s/%s scaled to %d replicas", namespace, name, replicas),
		"namespace": namespace,
		"name":      name,
		"replicas":  replicas,
	}, nil
}

func (s *MCPServer) handleRestartDeployment(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	name, _ := input["name"].(string)
	if name == "" {
		return nil, fmt.Errorf("deployment name is required")
	}

	if err := s.app.RestartDeployment(namespace, name); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"success":   true,
		"message":   fmt.Sprintf("Deployment %s/%s restart initiated", namespace, name),
		"namespace": namespace,
		"name":      name,
	}, nil
}

// =====================
// Swarm Tool Handlers
// =====================

func (s *MCPServer) handleSwarmListServices(ctx context.Context, input map[string]interface{}) (any, error) {
	if !s.app.IsSwarmConnected() {
		return nil, fmt.Errorf("Docker Swarm is not connected")
	}
	return s.app.GetSwarmServices()
}

func (s *MCPServer) handleSwarmListTasks(ctx context.Context, input map[string]interface{}) (any, error) {
	if !s.app.IsSwarmConnected() {
		return nil, fmt.Errorf("Docker Swarm is not connected")
	}
	return s.app.GetSwarmTasks()
}

func (s *MCPServer) handleSwarmListNodes(ctx context.Context, input map[string]interface{}) (any, error) {
	if !s.app.IsSwarmConnected() {
		return nil, fmt.Errorf("Docker Swarm is not connected")
	}
	return s.app.GetSwarmNodes()
}

func (s *MCPServer) handleSwarmGetServiceLogs(ctx context.Context, input map[string]interface{}) (any, error) {
	if !s.app.IsSwarmConnected() {
		return nil, fmt.Errorf("Docker Swarm is not connected")
	}

	service, _ := input["service"].(string)
	if service == "" {
		return nil, fmt.Errorf("service name/ID is required")
	}

	tailLines := 100
	if tl, ok := input["tailLines"].(float64); ok {
		tailLines = int(tl)
	}

	if tailLines > s.config.MaxLogLines {
		tailLines = s.config.MaxLogLines
	}

	logs, err := s.app.GetSwarmServiceLogs(service, tailLines)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"service": service,
		"lines":   tailLines,
		"logs":    logs,
	}, nil
}

func (s *MCPServer) handleSwarmScaleService(ctx context.Context, input map[string]interface{}) (any, error) {
	if !s.app.IsSwarmConnected() {
		return nil, fmt.Errorf("Docker Swarm is not connected")
	}

	service, _ := input["service"].(string)
	if service == "" {
		return nil, fmt.Errorf("service name/ID is required")
	}

	replicas := 0
	if r, ok := input["replicas"].(float64); ok {
		replicas = int(r)
	}

	if err := s.app.ScaleSwarmService(service, replicas); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"success":  true,
		"message":  fmt.Sprintf("Service %s scaled to %d replicas", service, replicas),
		"service":  service,
		"replicas": replicas,
	}, nil
}

// =====================
// Helpers
// =====================

func (s *MCPServer) getNamespaceParam(input map[string]interface{}) string {
	if ns, ok := input["namespace"].(string); ok && ns != "" {
		return ns
	}
	return s.app.GetCurrentNamespace()
}

// truncateLogs truncates log output to the configured maximum
func (s *MCPServer) truncateLogs(logs string) string {
	lines := strings.Split(logs, "\n")
	if len(lines) > s.config.MaxLogLines {
		lines = lines[len(lines)-s.config.MaxLogLines:]
		return fmt.Sprintf("... (truncated to last %d lines)\n%s", s.config.MaxLogLines, strings.Join(lines, "\n"))
	}
	return logs
}
