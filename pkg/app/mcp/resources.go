package mcp

import (
	"context"
)

// registerResources registers all available MCP resources
func (s *MCPServer) registerResources() {
	// cluster/connection - Current cluster connection info
	s.resources["resource://cluster/connection"] = &ResourceDefinition{
		URI:         "resource://cluster/connection",
		Name:        "Cluster Connection",
		Description: "Current cluster connection information including Kubernetes context, namespace, and Docker Swarm status.",
		MimeType:    "application/json",
		Handler:     s.handleClusterConnection,
	}

	// k8s/namespaces - Available namespaces
	s.resources["resource://k8s/namespaces"] = &ResourceDefinition{
		URI:         "resource://k8s/namespaces",
		Name:        "Kubernetes Namespaces",
		Description: "List of available Kubernetes namespaces and currently selected namespace(s).",
		MimeType:    "application/json",
		Handler:     s.handleK8sNamespaces,
	}

	// k8s/contexts - Available kubeconfig contexts
	s.resources["resource://k8s/contexts"] = &ResourceDefinition{
		URI:         "resource://k8s/contexts",
		Name:        "Kubernetes Contexts",
		Description: "Available kubeconfig contexts and the currently active context.",
		MimeType:    "application/json",
		Handler:     s.handleK8sContexts,
	}

	// swarm/connection - Docker Swarm connection info
	s.resources["resource://swarm/connection"] = &ResourceDefinition{
		URI:         "resource://swarm/connection",
		Name:        "Swarm Connection",
		Description: "Docker Swarm connection status and information.",
		MimeType:    "application/json",
		Handler:     s.handleSwarmConnection,
	}

	// mcp/config - MCP server configuration (read-only summary)
	s.resources["resource://mcp/config"] = &ResourceDefinition{
		URI:         "resource://mcp/config",
		Name:        "MCP Configuration",
		Description: "Current MCP server configuration (security settings and limits).",
		MimeType:    "application/json",
		Handler:     s.handleMCPConfig,
	}
}

// =====================
// Resource Handlers
// =====================

func (s *MCPServer) handleClusterConnection(ctx context.Context) (any, error) {
	info := ClusterConnectionInfo{
		Type:           "kubernetes",
		Connected:      true,
		Context:        s.app.GetCurrentContext(),
		Namespace:      s.app.GetCurrentNamespace(),
		Namespaces:     s.app.GetPreferredNamespaces(),
		KubeConfigPath: s.app.GetKubeConfigPath(),
		SwarmActive:    s.app.IsSwarmConnected(),
	}

	return info, nil
}

func (s *MCPServer) handleK8sNamespaces(ctx context.Context) (any, error) {
	namespaces, err := s.app.GetNamespaces()
	if err != nil {
		return nil, err
	}

	return map[string]interface{}{
		"current":   s.app.GetCurrentNamespace(),
		"preferred": s.app.GetPreferredNamespaces(),
		"available": namespaces,
	}, nil
}

func (s *MCPServer) handleK8sContexts(ctx context.Context) (any, error) {
	status := s.app.GetConnectionStatus()

	return map[string]interface{}{
		"current":        s.app.GetCurrentContext(),
		"kubeConfigPath": s.app.GetKubeConfigPath(),
		"connectionInfo": status,
	}, nil
}

func (s *MCPServer) handleSwarmConnection(ctx context.Context) (any, error) {
	if !s.app.IsSwarmConnected() {
		return map[string]interface{}{
			"connected": false,
			"message":   "Docker Swarm is not connected",
		}, nil
	}

	return map[string]interface{}{
		"connected":   true,
		"swarmActive": true,
	}, nil
}

func (s *MCPServer) handleMCPConfig(ctx context.Context) (any, error) {
	return map[string]interface{}{
		"enabled":          s.config.Enabled,
		"host":             s.config.Host,
		"port":             s.config.Port,
		"transportMode":    s.config.TransportMode,
		"allowDestructive": s.config.AllowDestructive,
		"requireConfirm":   s.config.RequireConfirm,
		"maxLogLines":      s.config.MaxLogLines,
	}, nil
}
