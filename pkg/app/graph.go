package app

import (
	"fmt"
	"strings"

	"github.com/psalg-dev/kube-dev-bench/pkg/app/k8s_graph"
)

// GetResourceGraph builds and returns a relationship graph for a specific resource
func (a *App) GetResourceGraph(namespace, kind, name string, depth int) (*k8s_graph.ResourceGraph, error) {
	if kind == "" {
		return nil, fmt.Errorf("kind is required")
	}
	if name == "" {
		return nil, fmt.Errorf("name is required")
	}

	// Normalize kind to lowercase for consistency
	kind = strings.ToLower(kind)

	// Get Kubernetes clientset
	clientset, err := a.getKubernetesInterface()
	if err != nil {
		return nil, fmt.Errorf("failed to get Kubernetes client: %w", err)
	}

	// Build the graph
	builder := k8s_graph.NewBuilder(a.ctx, clientset)
	graph, err := builder.BuildForResource(namespace, kind, name, depth)
	if err != nil {
		return nil, fmt.Errorf("failed to build resource graph: %w", err)
	}

	return graph, nil
}
