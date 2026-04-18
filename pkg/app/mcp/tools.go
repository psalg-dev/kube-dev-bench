package mcp

import (
	"context"
	"fmt"
	"reflect"
	"strings"
)

// ListResult wraps list responses with pagination metadata
type ListResult struct {
	Items     interface{} `json:"items"`
	Total     int         `json:"total"`
	Truncated bool        `json:"truncated,omitempty"`
	Namespace string      `json:"namespace,omitempty"`
	Kind      string      `json:"kind,omitempty"`
}

// k8s_list kind enum values
var k8sListKinds = []string{
	"pods", "deployments", "statefulsets", "daemonsets", "jobs", "cronjobs",
	"configmaps", "secrets", "services", "endpoints", "ingresses",
	"network_policies", "replicasets", "persistent_volumes",
	"persistent_volume_claims", "storage_classes", "nodes",
	"service_accounts", "roles", "role_bindings", "cluster_roles",
	"cluster_role_bindings", "crds",
}

// k8s_describe kind enum values
var k8sDescribeKinds = []string{
	"pod", "deployment", "service", "ingress", "node", "pvc", "pv",
	"statefulset", "daemonset", "replicaset", "job", "cronjob",
}

// registerTools registers the 14 consolidated MCP tools
func (s *MCPServer) registerTools() {
	// =====================
	// 1. k8s_list — List Kubernetes resources by kind
	// =====================
	s.tools["k8s_list"] = &ToolDefinition{
		Name:        "k8s_list",
		Description: "List Kubernetes resources by kind. Returns a summary of resources in the specified namespace. Supports filtering by label selector and limiting the number of results.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"kind": map[string]interface{}{
					"type":        "string",
					"description": "Resource kind to list.",
					"enum":        k8sListKinds,
				},
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace to list resources from. Omit to use current namespace. Ignored for cluster-scoped resources (nodes, persistent_volumes, storage_classes, cluster_roles, cluster_role_bindings, crds).",
				},
				"labelSelector": map[string]interface{}{
					"type":        "string",
					"description": "Label selector to filter resources (e.g. 'app=nginx'). Applied client-side.",
				},
				"limit": map[string]interface{}{
					"type":        "integer",
					"description": "Maximum number of items to return. When results exceed limit, response includes truncated=true and total count.",
				},
			},
			"required": []string{"kind"},
		},
		Handler: s.handleK8sList,
	}

	// =====================
	// 2. k8s_describe — Get detailed info about a specific resource
	// =====================
	s.tools["k8s_describe"] = &ToolDefinition{
		Name:        "k8s_describe",
		Description: "Get detailed information about a specific Kubernetes resource including spec, status, and related objects.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"kind": map[string]interface{}{
					"type":        "string",
					"description": "Resource kind to describe.",
					"enum":        k8sDescribeKinds,
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the resource.",
				},
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the resource. Omit to use current namespace. Ignored for cluster-scoped resources (node, pv).",
				},
			},
			"required": []string{"kind", "name"},
		},
		Handler: s.handleK8sDescribe,
	}

	// =====================
	// 3. k8s_get_resource_yaml — Get YAML manifest
	// =====================
	s.tools["k8s_get_resource_yaml"] = &ToolDefinition{
		Name:        "k8s_get_resource_yaml",
		Description: "Get the YAML manifest for any Kubernetes resource.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"kind": map[string]interface{}{
					"type":        "string",
					"description": "Resource kind (e.g., Pod, Deployment, Service, Node, PV, PVC, StatefulSet, DaemonSet, ReplicaSet, Job, CronJob, ConfigMap, Secret, Ingress).",
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the resource.",
				},
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the resource. Omit for cluster-scoped resources or to use current namespace.",
				},
			},
			"required": []string{"kind", "name"},
		},
		Handler: s.handleGetResourceYAML,
	}

	// =====================
	// 4. k8s_get_pod_logs — Retrieve pod logs (current or previous)
	// =====================
	s.tools["k8s_get_pod_logs"] = &ToolDefinition{
		Name:        "k8s_get_pod_logs",
		Description: "Retrieve logs from a pod. Supports current and previous container instances, optional container selection for multi-container pods, and line limits.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the pod.",
				},
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the pod. Omit to use current namespace.",
				},
				"container": map[string]interface{}{
					"type":        "string",
					"description": "Container name (optional, for multi-container pods).",
				},
				"lines": map[string]interface{}{
					"type":        "integer",
					"description": "Number of lines to retrieve from the end of the log. Default: 100.",
				},
				"previous": map[string]interface{}{
					"type":        "boolean",
					"description": "If true, retrieve logs from the previous container instance (after crash/restart). Default: false.",
				},
			},
			"required": []string{"name"},
		},
		Handler: s.handleGetPodLogs,
	}

	// =====================
	// 5. k8s_get_events — Get Kubernetes events
	// =====================
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

	// =====================
	// 6. k8s_get_resource_counts — Get aggregated resource counts
	// =====================
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
	// 7. k8s_top — Get CPU/memory metrics for pods or nodes
	// =====================
	s.tools["k8s_top"] = &ToolDefinition{
		Name:        "k8s_top",
		Description: "Get CPU and memory usage metrics for pods or nodes. Requires metrics-server to be installed in the cluster.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"kind": map[string]interface{}{
					"type":        "string",
					"description": "Resource kind to get metrics for.",
					"enum":        []string{"pods", "nodes"},
				},
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace for pod metrics. Omit to use current namespace. Ignored for nodes.",
				},
			},
			"required": []string{"kind"},
		},
		Handler: s.handleK8sTop,
	}

	// =====================
	// 8. k8s_rollout — Get rollout status or history
	// =====================
	s.tools["k8s_rollout"] = &ToolDefinition{
		Name:        "k8s_rollout",
		Description: "Get the rollout status or revision history of a Deployment, StatefulSet, or DaemonSet.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"action": map[string]interface{}{
					"type":        "string",
					"description": "Rollout action to perform.",
					"enum":        []string{"status", "history"},
				},
				"kind": map[string]interface{}{
					"type":        "string",
					"description": "Resource kind.",
					"enum":        []string{"Deployment", "StatefulSet", "DaemonSet"},
				},
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the resource.",
				},
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the resource. Omit to use current namespace.",
				},
			},
			"required": []string{"action", "kind", "name"},
		},
		Handler: s.handleK8sRollout,
	}

	// =====================
	// 9. k8s_scale_deployment — Scale deployment replicas
	// =====================
	s.tools["k8s_scale_deployment"] = &ToolDefinition{
		Name:        "k8s_scale_deployment",
		Description: "Scale a deployment to a specified number of replicas. Scaling to 0 requires confirmation.",
		Security:    SecurityWrite,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the deployment to scale.",
				},
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the deployment. Omit to use current namespace.",
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

	// =====================
	// 10. k8s_restart_deployment — Restart deployment
	// =====================
	s.tools["k8s_restart_deployment"] = &ToolDefinition{
		Name:        "k8s_restart_deployment",
		Description: "Trigger a rolling restart of a deployment by updating the pod template.",
		Security:    SecurityWrite,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the deployment to restart.",
				},
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the deployment. Omit to use current namespace.",
				},
			},
			"required": []string{"name"},
		},
		Handler: s.handleRestartDeployment,
	}

	// =====================
	// 10a. k8s_restart_statefulset — Restart statefulset
	// =====================
	s.tools["k8s_restart_statefulset"] = &ToolDefinition{
		Name:        "k8s_restart_statefulset",
		Description: "Trigger a rolling restart of a statefulset by updating the pod template. Only supported for StatefulSets with RollingUpdate update strategy.",
		Security:    SecurityWrite,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the statefulset to restart.",
				},
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the statefulset. Omit to use current namespace.",
				},
			},
			"required": []string{"name"},
		},
		Handler: s.handleRestartStatefulSet,
	}

	// =====================
	// 10b. k8s_restart_daemonset — Restart daemonset
	// =====================
	s.tools["k8s_restart_daemonset"] = &ToolDefinition{
		Name:        "k8s_restart_daemonset",
		Description: "Trigger a rolling restart of a daemonset by updating the pod template.",
		Security:    SecurityWrite,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"name": map[string]interface{}{
					"type":        "string",
					"description": "Name of the daemonset to restart.",
				},
				"namespace": map[string]interface{}{
					"type":        "string",
					"description": "Namespace of the daemonset. Omit to use current namespace.",
				},
			},
			"required": []string{"name"},
		},
		Handler: s.handleRestartDaemonSet,
	}

	// =====================
	// 11. swarm_list — List Docker Swarm resources by kind
	// =====================
	s.tools["swarm_list"] = &ToolDefinition{
		Name:        "swarm_list",
		Description: "List Docker Swarm resources by kind.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"kind": map[string]interface{}{
					"type":        "string",
					"description": "Swarm resource kind to list.",
					"enum":        []string{"services", "tasks", "nodes", "stacks", "networks", "volumes", "secrets", "configs"},
				},
			},
			"required": []string{"kind"},
		},
		Handler: s.handleSwarmList,
	}

	// =====================
	// 12. swarm_inspect — Inspect a specific Swarm resource
	// =====================
	s.tools["swarm_inspect"] = &ToolDefinition{
		Name:        "swarm_inspect",
		Description: "Get detailed information about a specific Docker Swarm resource.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"kind": map[string]interface{}{
					"type":        "string",
					"description": "Swarm resource kind to inspect.",
					"enum":        []string{"service", "task", "node"},
				},
				"id": map[string]interface{}{
					"type":        "string",
					"description": "Resource ID or name.",
				},
			},
			"required": []string{"kind", "id"},
		},
		Handler: s.handleSwarmInspect,
	}

	// =====================
	// 13. swarm_get_service_logs — Retrieve service logs
	// =====================
	s.tools["swarm_get_service_logs"] = &ToolDefinition{
		Name:        "swarm_get_service_logs",
		Description: "Retrieve logs from a Docker Swarm service.",
		Security:    SecuritySafe,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"serviceId": map[string]interface{}{
					"type":        "string",
					"description": "Service name or ID.",
				},
				"tail": map[string]interface{}{
					"type":        "integer",
					"description": "Number of lines to retrieve. Default: 100.",
				},
			},
			"required": []string{"serviceId"},
		},
		Handler: s.handleSwarmGetServiceLogs,
	}

	// =====================
	// 14. swarm_scale_service — Scale Swarm service
	// =====================
	s.tools["swarm_scale_service"] = &ToolDefinition{
		Name:        "swarm_scale_service",
		Description: "Scale a Docker Swarm service to a specified number of replicas.",
		Security:    SecurityWrite,
		InputSchema: map[string]interface{}{
			"type": "object",
			"properties": map[string]interface{}{
				"serviceId": map[string]interface{}{
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
			"required": []string{"serviceId", "replicas"},
		},
		Handler: s.handleSwarmScaleService,
	}
}

// =====================
// Consolidated K8s Handlers
// =====================

// handleK8sList dispatches to the appropriate list method based on kind
func (s *MCPServer) handleK8sList(ctx context.Context, input map[string]interface{}) (any, error) {
	kind := getStringParam(input, "kind")
	if kind == "" {
		return nil, fmt.Errorf("missing required parameter: kind")
	}

	namespace := s.getNamespaceParam(input)
	limitParam := getIntParam(input, "limit")

	var result interface{}
	var err error

	// Dispatch based on kind
	switch kind {
	// Namespaced resources
	case "pods":
		result, err = s.app.GetPods(namespace)
	case "deployments":
		result, err = s.app.GetDeployments(namespace)
	case "statefulsets":
		result, err = s.app.GetStatefulSets(namespace)
	case "daemonsets":
		result, err = s.app.GetDaemonSets(namespace)
	case "jobs":
		result, err = s.app.GetJobs(namespace)
	case "cronjobs":
		result, err = s.app.GetCronJobs(namespace)
	case "configmaps":
		result, err = s.app.GetConfigMaps(namespace)
	case "secrets":
		result, err = s.app.GetSecrets(namespace)
	case "services":
		result, err = s.app.GetServices(namespace)
	case "endpoints":
		result, err = s.app.GetEndpoints(namespace)
	case "ingresses":
		result, err = s.app.GetIngresses(namespace)
	case "network_policies":
		result, err = s.app.GetNetworkPolicies(namespace)
	case "replicasets":
		result, err = s.app.GetReplicaSets(namespace)
	case "persistent_volume_claims":
		result, err = s.app.GetPersistentVolumeClaims(namespace)
	case "service_accounts":
		result, err = s.app.GetServiceAccounts(namespace)
	case "roles":
		result, err = s.app.GetRoles(namespace)
	case "role_bindings":
		result, err = s.app.GetRoleBindings(namespace)
	// Cluster-scoped resources (namespace ignored)
	case "nodes":
		result, err = s.app.GetNodes()
	case "persistent_volumes":
		result, err = s.app.GetPersistentVolumes()
	case "storage_classes":
		result, err = s.app.GetStorageClasses()
	case "cluster_roles":
		result, err = s.app.GetClusterRoles()
	case "cluster_role_bindings":
		result, err = s.app.GetClusterRoleBindings()
	case "crds":
		result, err = s.app.GetCustomResourceDefinitions()
	default:
		return nil, fmt.Errorf("unknown resource kind: %s", kind)
	}

	if err != nil {
		return nil, err
	}

	// Strip heavy Raw fields from node responses to reduce MCP payload size
	result = stripRawFields(result)

	// Apply client-side label filtering if requested
	labelSelector := getStringParam(input, "labelSelector")
	if labelSelector != "" {
		result = filterByLabels(result, labelSelector)
	}

	// Wrap in ListResult with optional truncation
	return wrapListResult(result, kind, namespace, limitParam), nil
}

// handleK8sDescribe dispatches to the appropriate detail method based on kind
func (s *MCPServer) handleK8sDescribe(ctx context.Context, input map[string]interface{}) (any, error) {
	kind := getStringParam(input, "kind")
	if kind == "" {
		return nil, fmt.Errorf("missing required parameter: kind")
	}

	name := getStringParam(input, "name")
	if name == "" {
		return nil, fmt.Errorf("missing required parameter: name")
	}

	namespace := s.getNamespaceParam(input)

	switch kind {
	case "pod":
		return s.app.GetPodDetail(namespace, name)
	case "deployment":
		return s.app.GetDeploymentDetail(namespace, name)
	case "service":
		return s.app.GetServiceDetail(namespace, name)
	case "ingress":
		return s.app.GetIngressDetail(namespace, name)
	case "node":
		return s.app.GetNodeDetail(name)
	case "pvc":
		return s.app.GetPersistentVolumeClaimDetail(namespace, name)
	case "pv":
		return s.app.GetPersistentVolumeDetail(name)
	case "statefulset":
		return s.app.GetStatefulSetDetail(namespace, name)
	case "daemonset":
		return s.app.GetDaemonSetDetail(namespace, name)
	case "replicaset":
		return s.app.GetReplicaSetDetail(namespace, name)
	case "job":
		return s.app.GetJobDetail(namespace, name)
	case "cronjob":
		return s.app.GetCronJobDetail(namespace, name)
	default:
		return nil, fmt.Errorf("unknown resource kind: %s", kind)
	}
}

// handleGetPodLogs retrieves logs from current or previous container instance
func (s *MCPServer) handleGetPodLogs(ctx context.Context, input map[string]interface{}) (any, error) {
	name := getStringParam(input, "name")
	if name == "" {
		return nil, fmt.Errorf("pod name is required")
	}

	namespace := s.getNamespaceParam(input)
	container := getStringParam(input, "container")
	previous := getBoolParam(input, "previous")

	tailLines := 100
	if tl := getIntParam(input, "lines"); tl > 0 {
		tailLines = tl
	}
	// Also support legacy "tailLines" parameter
	if tl := getIntParam(input, "tailLines"); tl > 0 {
		tailLines = tl
	}

	// Respect MaxLogLines config
	if tailLines > s.config.MaxLogLines {
		tailLines = s.config.MaxLogLines
	}

	var logs string
	var err error

	if previous {
		logs, err = s.app.GetPodLogsPrevious(namespace, name, container, tailLines)
	} else {
		logs, err = s.app.GetPodLogs(namespace, name, container, tailLines)
	}

	if err != nil {
		return nil, err
	}

	// Apply truncation consistently for both current and previous logs
	logs = s.truncateLogs(logs)

	return map[string]interface{}{
		"pod":       name,
		"namespace": namespace,
		"container": container,
		"lines":     tailLines,
		"previous":  previous,
		"logs":      logs,
	}, nil
}

func (s *MCPServer) handleGetEvents(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	kind := getStringParam(input, "kind")
	name := getStringParam(input, "name")
	return s.app.GetResourceEvents(namespace, kind, name)
}

func (s *MCPServer) handleGetResourceCounts(ctx context.Context, input map[string]interface{}) (any, error) {
	return s.app.GetResourceCounts(), nil
}

// handleK8sTop dispatches to TopPods or TopNodes based on kind
func (s *MCPServer) handleK8sTop(ctx context.Context, input map[string]interface{}) (any, error) {
	kind := getStringParam(input, "kind")
	if kind == "" {
		return nil, fmt.Errorf("missing required parameter: kind")
	}

	switch kind {
	case "pods":
		namespace := s.getNamespaceParam(input)
		return s.app.TopPods(namespace)
	case "nodes":
		return s.app.TopNodes()
	default:
		return nil, fmt.Errorf("unknown kind for top: %s (expected 'pods' or 'nodes')", kind)
	}
}

// handleK8sRollout dispatches to status or history based on action
func (s *MCPServer) handleK8sRollout(ctx context.Context, input map[string]interface{}) (any, error) {
	action := getStringParam(input, "action")
	if action == "" {
		return nil, fmt.Errorf("missing required parameter: action")
	}

	kind := getStringParam(input, "kind")
	if kind == "" {
		return nil, fmt.Errorf("missing required parameter: kind")
	}

	name := getStringParam(input, "name")
	if name == "" {
		return nil, fmt.Errorf("missing required parameter: name")
	}

	namespace := s.getNamespaceParam(input)

	switch action {
	case "status":
		return s.app.GetRolloutStatus(kind, namespace, name)
	case "history":
		return s.app.GetRolloutHistory(kind, namespace, name)
	default:
		return nil, fmt.Errorf("unknown rollout action: %s (expected 'status' or 'history')", action)
	}
}

func (s *MCPServer) handleGetResourceYAML(ctx context.Context, input map[string]interface{}) (any, error) {
	kind := getStringParam(input, "kind")
	if kind == "" {
		return nil, fmt.Errorf("missing required parameter: kind")
	}

	name := getStringParam(input, "name")
	if name == "" {
		return nil, fmt.Errorf("missing required parameter: name")
	}

	namespace := s.getNamespaceParam(input)

	yaml, err := s.app.GetResourceYAML(kind, namespace, name)
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"kind":      kind,
		"name":      name,
		"namespace": namespace,
		"yaml":      yaml,
	}, nil
}

func (s *MCPServer) handleScaleDeployment(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	name := getStringParam(input, "name")
	if name == "" {
		return nil, fmt.Errorf("deployment name is required")
	}

	replicas := getIntParam(input, "replicas")

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
	name := getStringParam(input, "name")
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

func (s *MCPServer) handleRestartStatefulSet(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	name := getStringParam(input, "name")
	if name == "" {
		return nil, fmt.Errorf("statefulset name is required")
	}

	if err := s.app.RestartStatefulSet(namespace, name); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"success":   true,
		"message":   fmt.Sprintf("StatefulSet %s/%s restart initiated", namespace, name),
		"namespace": namespace,
		"name":      name,
	}, nil
}

func (s *MCPServer) handleRestartDaemonSet(ctx context.Context, input map[string]interface{}) (any, error) {
	namespace := s.getNamespaceParam(input)
	name := getStringParam(input, "name")
	if name == "" {
		return nil, fmt.Errorf("daemonset name is required")
	}

	if err := s.app.RestartDaemonSet(namespace, name); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"success":   true,
		"message":   fmt.Sprintf("DaemonSet %s/%s restart initiated", namespace, name),
		"namespace": namespace,
		"name":      name,
	}, nil
}

// =====================
// Consolidated Swarm Handlers
// =====================

func (s *MCPServer) handleSwarmList(ctx context.Context, input map[string]interface{}) (any, error) {
	if !s.app.IsSwarmConnected() {
		return nil, fmt.Errorf("Docker Swarm is not connected")
	}

	kind := getStringParam(input, "kind")
	if kind == "" {
		return nil, fmt.Errorf("missing required parameter: kind")
	}

	switch kind {
	case "services":
		return s.app.GetSwarmServices()
	case "tasks":
		return s.app.GetSwarmTasks()
	case "nodes":
		return s.app.GetSwarmNodes()
	case "stacks":
		return s.app.GetSwarmStacks()
	case "networks":
		return s.app.GetSwarmNetworks()
	case "volumes":
		return s.app.GetSwarmVolumes()
	case "secrets":
		return s.app.GetSwarmSecrets()
	case "configs":
		return s.app.GetSwarmConfigs()
	default:
		return nil, fmt.Errorf("unknown swarm resource kind: %s", kind)
	}
}

func (s *MCPServer) handleSwarmInspect(ctx context.Context, input map[string]interface{}) (any, error) {
	if !s.app.IsSwarmConnected() {
		return nil, fmt.Errorf("Docker Swarm is not connected")
	}

	kind := getStringParam(input, "kind")
	if kind == "" {
		return nil, fmt.Errorf("missing required parameter: kind")
	}

	id := getStringParam(input, "id")
	if id == "" {
		return nil, fmt.Errorf("missing required parameter: id")
	}

	switch kind {
	case "service":
		return s.app.GetSwarmService(id)
	case "task":
		return s.app.GetSwarmTask(id)
	case "node":
		return s.app.GetSwarmNode(id)
	default:
		return nil, fmt.Errorf("unknown swarm resource kind: %s (expected 'service', 'task', or 'node')", kind)
	}
}

func (s *MCPServer) handleSwarmGetServiceLogs(ctx context.Context, input map[string]interface{}) (any, error) {
	if !s.app.IsSwarmConnected() {
		return nil, fmt.Errorf("Docker Swarm is not connected")
	}

	serviceID := getStringParam(input, "serviceId")
	if serviceID == "" {
		return nil, fmt.Errorf("serviceId is required")
	}

	tailLines := 100
	if tl := getIntParam(input, "tail"); tl > 0 {
		tailLines = tl
	}

	if tailLines > s.config.MaxLogLines {
		tailLines = s.config.MaxLogLines
	}

	logs, err := s.app.GetSwarmServiceLogs(serviceID, tailLines)
	if err != nil {
		return nil, err
	}

	logs = s.truncateLogs(logs)

	return map[string]interface{}{
		"serviceId": serviceID,
		"lines":     tailLines,
		"logs":      logs,
	}, nil
}

func (s *MCPServer) handleSwarmScaleService(ctx context.Context, input map[string]interface{}) (any, error) {
	if !s.app.IsSwarmConnected() {
		return nil, fmt.Errorf("Docker Swarm is not connected")
	}

	serviceID := getStringParam(input, "serviceId")
	if serviceID == "" {
		return nil, fmt.Errorf("serviceId is required")
	}

	replicas := getIntParam(input, "replicas")

	if err := s.app.ScaleSwarmService(serviceID, replicas); err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"success":   true,
		"message":   fmt.Sprintf("Service %s scaled to %d replicas", serviceID, replicas),
		"serviceId": serviceID,
		"replicas":  replicas,
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

// getStringParam extracts a string parameter from input
func getStringParam(input map[string]interface{}, key string) string {
	if v, ok := input[key].(string); ok {
		return v
	}
	return ""
}

// getIntParam extracts an integer parameter from input (JSON numbers come as float64)
func getIntParam(input map[string]interface{}, key string) int {
	if v, ok := input[key].(float64); ok {
		return int(v)
	}
	return 0
}

// getBoolParam extracts a boolean parameter from input
func getBoolParam(input map[string]interface{}, key string) bool {
	if v, ok := input[key].(bool); ok {
		return v
	}
	return false
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

// wrapListResult wraps a list result with metadata and optional truncation
func wrapListResult(items interface{}, kind, namespace string, limit int) *ListResult {
	total := sliceLen(items)

	lr := &ListResult{
		Items:     items,
		Total:     total,
		Kind:      kind,
		Namespace: namespace,
	}

	if limit > 0 && total > limit {
		lr.Items = sliceTruncate(items, limit)
		lr.Truncated = true
	}

	return lr
}

// sliceLen returns the length of a slice via reflection, or 1 for non-slice values
func sliceLen(v interface{}) int {
	if v == nil {
		return 0
	}
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array {
		return rv.Len()
	}
	return 1
}

// sliceTruncate truncates a slice to the given limit via reflection
func sliceTruncate(v interface{}, limit int) interface{} {
	if v == nil {
		return v
	}
	rv := reflect.ValueOf(v)
	if rv.Kind() == reflect.Slice || rv.Kind() == reflect.Array {
		if rv.Len() > limit {
			return rv.Slice(0, limit).Interface()
		}
	}
	return v
}

// filterByLabels applies client-side label filtering to a list result.
// It attempts to match labels on items that have a Labels map field.
// For items without labels, they are excluded from filtered results.
func filterByLabels(items interface{}, selector string) interface{} {
	if items == nil || selector == "" {
		return items
	}

	// Parse label selector into key=value pairs
	selectorParts := parseLabelSelector(selector)
	if len(selectorParts) == 0 {
		return items
	}

	rv := reflect.ValueOf(items)
	if rv.Kind() != reflect.Slice {
		return items
	}

	// Create a new slice of the same type
	resultSlice := reflect.MakeSlice(rv.Type(), 0, rv.Len())

	for i := 0; i < rv.Len(); i++ {
		item := rv.Index(i)

		// Try to get labels from the item
		labels := extractLabels(item)
		if labels == nil {
			continue
		}

		if matchesSelector(labels, selectorParts) {
			resultSlice = reflect.Append(resultSlice, item)
		}
	}

	return resultSlice.Interface()
}

// parseLabelSelector parses "key1=value1,key2=value2" into key-value pairs
func parseLabelSelector(selector string) map[string]string {
	result := make(map[string]string)
	parts := strings.Split(selector, ",")
	for _, part := range parts {
		part = strings.TrimSpace(part)
		if eqIdx := strings.Index(part, "="); eqIdx > 0 {
			key := strings.TrimSpace(part[:eqIdx])
			value := strings.TrimSpace(part[eqIdx+1:])
			result[key] = value
		}
	}
	return result
}

// extractLabels tries to extract a labels map from a struct or map
func extractLabels(v reflect.Value) map[string]string {
	// Dereference pointers
	for v.Kind() == reflect.Ptr {
		if v.IsNil() {
			return nil
		}
		v = v.Elem()
	}

	// Try map type
	if v.Kind() == reflect.Map {
		labelsVal := v.MapIndex(reflect.ValueOf("Labels"))
		if !labelsVal.IsValid() {
			labelsVal = v.MapIndex(reflect.ValueOf("labels"))
		}
		if labelsVal.IsValid() {
			if labels, ok := labelsVal.Interface().(map[string]string); ok {
				return labels
			}
		}
		return nil
	}

	// Try struct type
	if v.Kind() == reflect.Struct {
		labelsField := v.FieldByName("Labels")
		if labelsField.IsValid() {
			if labels, ok := labelsField.Interface().(map[string]string); ok {
				return labels
			}
		}
	}

	return nil
}

// matchesSelector checks if labels match all selector requirements
func matchesSelector(labels, selector map[string]string) bool {
	for key, value := range selector {
		if labelVal, ok := labels[key]; !ok || labelVal != value {
			return false
		}
	}
	return true
}

// stripRawFields nils out "Raw" fields in slice items to reduce MCP payload size.
// This specifically targets structs with a Raw interface{} field (e.g., NodeInfo)
// without affecting the original data used by the frontend.
func stripRawFields(items interface{}) interface{} {
	if items == nil {
		return items
	}

	rv := reflect.ValueOf(items)
	if rv.Kind() != reflect.Slice {
		return items
	}

	for i := 0; i < rv.Len(); i++ {
		item := rv.Index(i)
		// Dereference pointers
		for item.Kind() == reflect.Ptr {
			if item.IsNil() {
				break
			}
			item = item.Elem()
		}
		if item.Kind() == reflect.Struct {
			rawField := item.FieldByName("Raw")
			if rawField.IsValid() && rawField.CanSet() {
				rawField.Set(reflect.Zero(rawField.Type()))
			}
		}
	}

	return items
}
