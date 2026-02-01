// Package mcp provides Model Context Protocol server functionality for KubeDevBench.
// It enables AI assistants (Claude, etc.) to interact with Kubernetes and Docker Swarm clusters.
package mcp

import "context"

// MCPStatus represents the current status of the MCP server
type MCPStatus struct {
	Running   bool   `json:"running"`
	Enabled   bool   `json:"enabled"`
	Transport string `json:"transport"` // "stdio" or future transports
	Error     string `json:"error,omitempty"`
}

// OperationSecurity represents the security level of an operation
type OperationSecurity string

const (
	// SecuritySafe represents read-only operations
	SecuritySafe OperationSecurity = "safe"

	// SecurityWrite represents create/update operations
	SecurityWrite OperationSecurity = "write"

	// SecurityDestructive represents delete/scale-to-zero operations
	SecurityDestructive OperationSecurity = "destructive"
)

// ToolDefinition defines an MCP tool
type ToolDefinition struct {
	Name        string                                                               `json:"name"`
	Description string                                                               `json:"description"`
	Security    OperationSecurity                                                    `json:"security"`
	InputSchema map[string]interface{}                                               `json:"inputSchema"`
	Handler     func(ctx context.Context, input map[string]interface{}) (any, error) `json:"-"`
}

// ResourceDefinition defines an MCP resource
type ResourceDefinition struct {
	URI         string                                 `json:"uri"`
	Name        string                                 `json:"name"`
	Description string                                 `json:"description"`
	MimeType    string                                 `json:"mimeType"`
	Handler     func(ctx context.Context) (any, error) `json:"-"`
}

// ToolResult represents the result of a tool execution
type ToolResult struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

// ResourceContent represents the content of an MCP resource
type ResourceContent struct {
	URI      string `json:"uri"`
	MimeType string `json:"mimeType"`
	Text     string `json:"text,omitempty"`
	Blob     string `json:"blob,omitempty"` // base64 encoded binary data
}

// ClusterConnectionInfo represents current cluster connection information
type ClusterConnectionInfo struct {
	Type           string   `json:"type"` // "kubernetes" or "swarm"
	Connected      bool     `json:"connected"`
	Context        string   `json:"context,omitempty"`
	Namespace      string   `json:"namespace,omitempty"`
	Namespaces     []string `json:"namespaces,omitempty"`
	KubeConfigPath string   `json:"kubeConfigPath,omitempty"`
	DockerHost     string   `json:"dockerHost,omitempty"`
	SwarmActive    bool     `json:"swarmActive,omitempty"`
}

// LogOutputOptions represents options for log retrieval
type LogOutputOptions struct {
	Namespace    string `json:"namespace,omitempty"`
	Name         string `json:"name"`
	Container    string `json:"container,omitempty"`
	TailLines    int    `json:"tailLines,omitempty"`
	SinceSeconds int    `json:"sinceSeconds,omitempty"`
	Previous     bool   `json:"previous,omitempty"`
}

// ScaleOptions represents options for scaling operations
type ScaleOptions struct {
	Namespace string `json:"namespace"`
	Name      string `json:"name"`
	Replicas  int    `json:"replicas"`
	Confirmed bool   `json:"confirmed,omitempty"` // Required for scale-to-zero
}
