package app

import (
	"fmt"
	"strings"
	"time"

	"gowails/pkg/app/k8s_graph"
)

const graphCacheTTL = 8 * time.Second

type graphCacheEntry struct {
	graph     *k8s_graph.ResourceGraph
	expiresAt time.Time
}

func (a *App) graphCacheKey(prefix string, parts ...string) string {
	all := make([]string, 0, len(parts)+2)
	all = append(all, prefix)
	all = append(all, a.currentKubeContext)
	all = append(all, parts...)
	return strings.Join(all, "|")
}

func (a *App) getCachedGraph(key string) (*k8s_graph.ResourceGraph, bool) {
	value, ok := a.graphCache.Load(key)
	if !ok {
		return nil, false
	}

	entry, ok := value.(graphCacheEntry)
	if !ok || entry.graph == nil || time.Now().After(entry.expiresAt) {
		a.graphCache.Delete(key)
		return nil, false
	}

	return cloneResourceGraph(entry.graph), true
}

func (a *App) setCachedGraph(key string, graph *k8s_graph.ResourceGraph) {
	if graph == nil {
		return
	}

	a.graphCache.Store(key, graphCacheEntry{
		graph:     cloneResourceGraph(graph),
		expiresAt: time.Now().Add(graphCacheTTL),
	})
}

func normalizeGraphDepth(depth int) int {
	if depth < 1 {
		return k8s_graph.DefaultDepth
	}
	if depth > k8s_graph.MaxDepth {
		return k8s_graph.MaxDepth
	}
	return depth
}

func cloneResourceGraph(graph *k8s_graph.ResourceGraph) *k8s_graph.ResourceGraph {
	if graph == nil {
		return nil
	}

	nodes := make([]k8s_graph.GraphNode, len(graph.Nodes))
	for i, node := range graph.Nodes {
		cloneNode := node
		if node.Metadata != nil {
			metadata := make(map[string]string, len(node.Metadata))
			for key, value := range node.Metadata {
				metadata[key] = value
			}
			cloneNode.Metadata = metadata
		}
		nodes[i] = cloneNode
	}

	edges := make([]k8s_graph.GraphEdge, len(graph.Edges))
	copy(edges, graph.Edges)

	return &k8s_graph.ResourceGraph{
		Nodes: nodes,
		Edges: edges,
	}
}

// GetResourceGraph builds and returns a relationship graph for a specific resource
func (a *App) GetResourceGraph(namespace, kind, name string, depth int) (*k8s_graph.ResourceGraph, error) {
	if kind == "" {
		return nil, fmt.Errorf("kind is required")
	}
	if name == "" {
		if strings.ToLower(kind) != "namespace" {
			return nil, fmt.Errorf("name is required")
		}
	}

	// Normalize kind to lowercase for consistency
	kind = strings.ToLower(kind)
	normalizedDepth := normalizeGraphDepth(depth)

	cacheKey := a.graphCacheKey("resource", namespace, kind, name, fmt.Sprintf("%d", normalizedDepth))
	if cached, ok := a.getCachedGraph(cacheKey); ok {
		return cached, nil
	}

	// Get Kubernetes clientset
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, fmt.Errorf("failed to get Kubernetes client: %w", err)
	}

	// Build the graph
	builder := k8s_graph.NewBuilder(a.ctx, clientset)
	if kind == "namespace" {
		targetNamespace := name
		if targetNamespace == "" {
			targetNamespace = namespace
		}
		if targetNamespace == "" {
			return nil, fmt.Errorf("namespace is required")
		}
		graph, err := builder.BuildForNamespace(targetNamespace, depth)
		if err != nil {
			return nil, fmt.Errorf("failed to build namespace graph: %w", err)
		}
		a.setCachedGraph(cacheKey, graph)
		return graph, nil
	}
	graph, err := builder.BuildForResource(namespace, kind, name, normalizedDepth)
	if err != nil {
		return nil, fmt.Errorf("failed to build resource graph: %w", err)
	}

	a.setCachedGraph(cacheKey, graph)

	return graph, nil
}

// GetNamespaceGraph builds and returns a namespace-wide relationship graph.
func (a *App) GetNamespaceGraph(namespace string, depth int) (*k8s_graph.ResourceGraph, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
	normalizedDepth := normalizeGraphDepth(depth)
	cacheKey := a.graphCacheKey("namespace", namespace, fmt.Sprintf("%d", normalizedDepth))
	if cached, ok := a.getCachedGraph(cacheKey); ok {
		return cached, nil
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, fmt.Errorf("failed to get Kubernetes client: %w", err)
	}

	builder := k8s_graph.NewBuilder(a.ctx, clientset)
	graph, err := builder.BuildForNamespace(namespace, normalizedDepth)
	if err != nil {
		return nil, fmt.Errorf("failed to build namespace graph: %w", err)
	}

	a.setCachedGraph(cacheKey, graph)

	return graph, nil
}

// GetStorageGraph builds and returns a storage-focused graph for a namespace.
func (a *App) GetStorageGraph(namespace string, depth int) (*k8s_graph.ResourceGraph, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}
	normalizedDepth := normalizeGraphDepth(depth)
	cacheKey := a.graphCacheKey("storage", namespace, fmt.Sprintf("%d", normalizedDepth))
	if cached, ok := a.getCachedGraph(cacheKey); ok {
		return cached, nil
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, fmt.Errorf("failed to get Kubernetes client: %w", err)
	}

	builder := k8s_graph.NewBuilder(a.ctx, clientset)
	graph, err := builder.BuildStorageGraph(namespace, normalizedDepth)
	if err != nil {
		return nil, fmt.Errorf("failed to build storage graph: %w", err)
	}

	a.setCachedGraph(cacheKey, graph)

	return graph, nil
}

// GetNetworkPolicyGraph builds and returns a network-policy-focused graph for a namespace.
func (a *App) GetNetworkPolicyGraph(namespace string, depth int) (*k8s_graph.ResourceGraph, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}

	cacheKey := a.graphCacheKey("network-policy", namespace)
	if cached, ok := a.getCachedGraph(cacheKey); ok {
		return cached, nil
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, fmt.Errorf("failed to get Kubernetes client: %w", err)
	}

	builder := k8s_graph.NewBuilder(a.ctx, clientset)
	graph, err := builder.BuildNetworkPolicyGraph(namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to build network policy graph: %w", err)
	}

	a.setCachedGraph(cacheKey, graph)

	return graph, nil
}

// GetRBACGraph builds and returns an RBAC-focused graph for a namespace.
func (a *App) GetRBACGraph(namespace string) (*k8s_graph.ResourceGraph, error) {
	if namespace == "" {
		return nil, fmt.Errorf("namespace is required")
	}

	cacheKey := a.graphCacheKey("rbac", namespace)
	if cached, ok := a.getCachedGraph(cacheKey); ok {
		return cached, nil
	}

	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, fmt.Errorf("failed to get Kubernetes client: %w", err)
	}

	builder := k8s_graph.NewBuilder(a.ctx, clientset)
	graph, err := builder.BuildRBACGraph(namespace)
	if err != nil {
		return nil, fmt.Errorf("failed to build RBAC graph: %w", err)
	}

	a.setCachedGraph(cacheKey, graph)

	return graph, nil
}
