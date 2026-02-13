package k8s_graph

import (
	"fmt"
	"strings"
)

// EdgeType represents the type of relationship between resources
type EdgeType string

const (
	EdgeTypeOwns          EdgeType = "owns"           // Parent owns child (OwnerReferences)
	EdgeTypeSelects       EdgeType = "selects"        // Service selects Pods via labels
	EdgeTypeMounts        EdgeType = "mounts"         // Workload mounts ConfigMap/Secret/PVC
	EdgeTypeRoutesTo      EdgeType = "routes_to"      // Ingress routes to Service
	EdgeTypeBoundTo       EdgeType = "bound_to"       // PVC bound to PV
	EdgeTypeProvides      EdgeType = "provides"       // StorageClass provides PV
	EdgeTypeRunsOn        EdgeType = "runs_on"        // Pod runs on Node
	EdgeTypeBinds         EdgeType = "binds"          // RoleBinding binds Role/Subject
	EdgeTypeScales        EdgeType = "scales"         // HPA scales a workload target
	EdgeTypeNetworkPolicy EdgeType = "network_policy" // NetworkPolicy targets Pod
	EdgeTypeNPIngress     EdgeType = "network_policy_ingress"
	EdgeTypeNPEgress      EdgeType = "network_policy_egress"
)

// ResourceGroup represents a logical grouping of resource kinds
type ResourceGroup string

const (
	GroupWorkload       ResourceGroup = "workload"
	GroupNetworking     ResourceGroup = "networking"
	GroupConfig         ResourceGroup = "config"
	GroupStorage        ResourceGroup = "storage"
	GroupRBAC           ResourceGroup = "rbac"
	GroupInfrastructure ResourceGroup = "infrastructure"
	GroupExternal       ResourceGroup = "external"
)

// GraphNode represents a single Kubernetes resource in the graph
type GraphNode struct {
	ID        string            `json:"id"`        // Unique identifier (kind:namespace:name or kind:name for cluster-scoped)
	Kind      string            `json:"kind"`      // Resource kind (Pod, Service, etc.)
	Name      string            `json:"name"`      // Resource name
	Namespace string            `json:"namespace"` // Resource namespace (empty for cluster-scoped)
	Status    string            `json:"status"`    // Resource status (Running, Pending, etc.)
	Group     ResourceGroup     `json:"group"`     // Logical group
	Metadata  map[string]string `json:"metadata"`  // Additional metadata (labels, age, etc.)
}

// GraphEdge represents a relationship between two resources
type GraphEdge struct {
	ID     string   `json:"id"`     // Unique identifier (source-target-type)
	Source string   `json:"source"` // Source node ID
	Target string   `json:"target"` // Target node ID
	Type   EdgeType `json:"type"`   // Relationship type
	Label  string   `json:"label"`  // Human-readable label
}

// ResourceGraph represents the complete graph of resources and their relationships
type ResourceGraph struct {
	Nodes []GraphNode `json:"nodes"`
	Edges []GraphEdge `json:"edges"`
}

// NodeID generates a unique node identifier
func NodeID(kind, namespace, name string) string {
	if namespace == "" {
		// Cluster-scoped resource
		return fmt.Sprintf("%s:%s", strings.ToLower(kind), name)
	}
	return fmt.Sprintf("%s:%s:%s", strings.ToLower(kind), namespace, name)
}

// EdgeID generates a unique edge identifier
func EdgeID(source, target string, edgeType EdgeType) string {
	return fmt.Sprintf("%s-%s-%s", source, target, edgeType)
}

// KindToGroup maps a resource kind to its logical group
func KindToGroup(kind string) ResourceGroup {
	kind = strings.ToLower(kind)
	switch kind {
	case "pod", "deployment", "statefulset", "daemonset", "replicaset", "job", "cronjob", "horizontalpodautoscaler", "hpa":
		return GroupWorkload
	case "service", "ingress", "networkpolicy", "endpoints":
		return GroupNetworking
	case "configmap", "secret", "serviceaccount":
		return GroupConfig
	case "persistentvolumeclaim", "persistentvolume", "storageclass":
		return GroupStorage
	case "role", "clusterrole", "rolebinding", "clusterrolebinding":
		return GroupRBAC
	case "user", "group":
		return GroupRBAC
	case "node":
		return GroupInfrastructure
	case "external", "cidr", "ipblock":
		return GroupExternal
	default:
		return GroupWorkload // Default to workload
	}
}

// AddNode adds a node to the graph if it doesn't already exist
func (g *ResourceGraph) AddNode(node GraphNode) {
	for _, n := range g.Nodes {
		if n.ID == node.ID {
			return // Already exists
		}
	}
	g.Nodes = append(g.Nodes, node)
}

// AddEdge adds an edge to the graph if it doesn't already exist
func (g *ResourceGraph) AddEdge(edge GraphEdge) {
	for _, e := range g.Edges {
		if e.ID == edge.ID {
			return // Already exists
		}
	}
	g.Edges = append(g.Edges, edge)
}

// HasNode checks if a node with the given ID exists in the graph
func (g *ResourceGraph) HasNode(id string) bool {
	for _, n := range g.Nodes {
		if n.ID == id {
			return true
		}
	}
	return false
}
