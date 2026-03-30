package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sync"
	"time"

	mcpsdk "github.com/mark3labs/mcp-go/mcp"
	mcpserver "github.com/mark3labs/mcp-go/server"
)

// ServerInterface defines the methods required from the App
// This allows for dependency injection and testing
type ServerInterface interface {
	// Kubernetes context methods
	GetCurrentContext() string
	GetCurrentNamespace() string
	GetPreferredNamespaces() []string
	GetKubeConfigPath() string
	GetNamespaces() ([]string, error)
	GetConnectionStatus() map[string]interface{}

	// Resource listing methods
	GetPods(namespace string) (interface{}, error)
	GetDeployments(namespace string) (interface{}, error)
	GetStatefulSets(namespace string) (interface{}, error)
	GetDaemonSets(namespace string) (interface{}, error)
	GetJobs(namespace string) (interface{}, error)
	GetCronJobs(namespace string) (interface{}, error)
	GetConfigMaps(namespace string) (interface{}, error)
	GetSecrets(namespace string) (interface{}, error)
	GetResourceEvents(namespace, kind, name string) (interface{}, error)
	GetResourceCounts() interface{}

	// Phase 1 resources
	GetServices(namespace string) (interface{}, error)
	GetIngresses(namespace string) (interface{}, error)
	GetReplicaSets(namespace string) (interface{}, error)
	GetNodes() (interface{}, error)
	GetPersistentVolumes() (interface{}, error)
	GetPersistentVolumeClaims(namespace string) (interface{}, error)
	GetStorageClasses() (interface{}, error)
	GetServiceAccounts(namespace string) (interface{}, error)
	GetRoles(namespace string) (interface{}, error)
	GetClusterRoles() (interface{}, error)
	GetRoleBindings(namespace string) (interface{}, error)
	GetClusterRoleBindings() (interface{}, error)
	GetNetworkPolicies(namespace string) (interface{}, error)
	GetCustomResourceDefinitions() (interface{}, error)
	GetEndpoints(namespace string) (interface{}, error)

	// Detail methods
	GetPodDetail(namespace, name string) (interface{}, error)
	GetDeploymentDetail(namespace, name string) (interface{}, error)
	GetServiceDetail(namespace, name string) (interface{}, error)
	GetIngressDetail(namespace, name string) (interface{}, error)
	GetNodeDetail(name string) (interface{}, error)
	GetPersistentVolumeClaimDetail(namespace, name string) (interface{}, error)
	GetPersistentVolumeDetail(name string) (interface{}, error)
	GetStatefulSetDetail(namespace, name string) (interface{}, error)
	GetDaemonSetDetail(namespace, name string) (interface{}, error)
	GetReplicaSetDetail(namespace, name string) (interface{}, error)
	GetJobDetail(namespace, name string) (interface{}, error)
	GetCronJobDetail(namespace, name string) (interface{}, error)

	// YAML methods
	GetResourceYAML(kind, namespace, name string) (string, error)

	// Log methods
	GetPodLogs(namespace, podName, container string, lines int) (string, error)
	GetPodLogsPrevious(namespace, podName, container string, lines int) (string, error)

	// Phase 3: K8s Diagnostics methods
	TopPods(namespace string) (interface{}, error)
	TopNodes() (interface{}, error)
	GetRolloutStatus(kind, namespace, name string) (interface{}, error)
	GetRolloutHistory(kind, namespace, name string) (interface{}, error)

	// Mutation methods
	ScaleResource(kind, namespace, name string, replicas int) error
	RestartDeployment(namespace, name string) error
	RestartStatefulSet(namespace, name string) error
	RestartDaemonSet(namespace, name string) error

	// Docker Swarm methods
	GetSwarmServices() (interface{}, error)
	GetSwarmTasks() (interface{}, error)
	GetSwarmNodes() (interface{}, error)
	GetSwarmServiceLogs(serviceID string, tail int) (string, error)
	ScaleSwarmService(serviceID string, replicas int) error
	IsSwarmConnected() bool

	// Phase 4: Docker Swarm detail methods
	GetSwarmService(serviceID string) (interface{}, error)
	GetSwarmTask(taskID string) (interface{}, error)
	GetSwarmNode(nodeID string) (interface{}, error)
	GetSwarmStacks() (interface{}, error)
	GetSwarmNetworks() (interface{}, error)
	GetSwarmVolumes() (interface{}, error)
	GetSwarmSecrets() (interface{}, error)
	GetSwarmConfigs() (interface{}, error)
}

// MCPServer is the MCP server wrapper that bridges the mcp-go SDK
// with our application backend.
type MCPServer struct {
	app    ServerInterface
	config MCPConfigData

	// Internal tool/resource registries (for security checks and tool metadata)
	tools     map[string]*ToolDefinition
	resources map[string]*ResourceDefinition

	// mcp-go SDK server
	sdkServer *mcpserver.MCPServer

	// HTTP transport (for HTTP mode)
	httpServer     *mcpserver.StreamableHTTPServer
	httpBaseServer *http.Server

	// Server state
	running    bool
	runningMu  sync.RWMutex
	cancelFunc context.CancelFunc
}

// NewServer creates a new MCP server instance using the mcp-go SDK
func NewServer(app ServerInterface, config MCPConfigData) (*MCPServer, error) {
	if err := config.Validate(); err != nil {
		return nil, fmt.Errorf("invalid MCP configuration: %w", err)
	}

	server := &MCPServer{
		app:       app,
		config:    config,
		tools:     make(map[string]*ToolDefinition),
		resources: make(map[string]*ResourceDefinition),
	}

	// Create the mcp-go SDK server
	server.sdkServer = mcpserver.NewMCPServer(
		"kubedevbench",
		"1.0.0",
		mcpserver.WithToolCapabilities(false),
		mcpserver.WithResourceCapabilities(true, false),
	)

	// Register tools with both our internal registry and the SDK
	server.registerTools()
	server.registerResources()

	// Register SDK tools from our internal registry
	server.registerSDKTools()
	server.registerSDKResources()

	return server, nil
}

// registerSDKTools registers all tools with the mcp-go SDK server
func (s *MCPServer) registerSDKTools() {
	for _, tool := range s.tools {
		sdkTool := mcpsdk.Tool{
			Name:        tool.Name,
			Description: tool.Description,
			InputSchema: buildSDKInputSchema(tool.InputSchema),
		}

		// Capture tool for closure
		t := tool
		handler := func(ctx context.Context, req mcpsdk.CallToolRequest) (*mcpsdk.CallToolResult, error) {
			args := req.GetArguments()

			// Check security before executing
			if err := s.checkSecurity(t, args); err != nil {
				return mcpsdk.NewToolResultError(err.Error()), nil
			}

			result, err := t.Handler(ctx, args)
			if err != nil {
				return mcpsdk.NewToolResultError(err.Error()), nil
			}

			resultText, marshalErr := json.Marshal(result)
			if marshalErr != nil {
				resultText = []byte(fmt.Sprintf("%v", result))
			}

			return mcpsdk.NewToolResultText(string(resultText)), nil
		}

		s.sdkServer.AddTool(sdkTool, handler)
	}
}

// buildSDKInputSchema converts our map-based schema to the SDK's ToolInputSchema
func buildSDKInputSchema(schema map[string]interface{}) mcpsdk.ToolInputSchema {
	result := mcpsdk.ToolInputSchema{
		Type: "object",
	}

	if props, ok := schema["properties"].(map[string]interface{}); ok {
		result.Properties = props
	}

	if required, ok := schema["required"].([]string); ok {
		result.Required = required
	}

	return result
}

// registerSDKResources registers all resources with the mcp-go SDK server
func (s *MCPServer) registerSDKResources() {
	for _, res := range s.resources {
		sdkResource := mcpsdk.Resource{
			URI:         res.URI,
			Name:        res.Name,
			Description: res.Description,
			MIMEType:    res.MimeType,
		}

		r := res
		handler := func(ctx context.Context, req mcpsdk.ReadResourceRequest) ([]mcpsdk.ResourceContents, error) {
			result, err := r.Handler(ctx)
			if err != nil {
				return nil, err
			}

			resultText, marshalErr := json.Marshal(result)
			if marshalErr != nil {
				resultText = []byte(fmt.Sprintf("%v", result))
			}

			return []mcpsdk.ResourceContents{
				mcpsdk.TextResourceContents{
					URI:      r.URI,
					MIMEType: r.MimeType,
					Text:     string(resultText),
				},
			}, nil
		}

		s.sdkServer.AddResource(sdkResource, handler)
	}
}

// Start starts the MCP server with HTTP transport (blocking)
func (s *MCPServer) Start(ctx context.Context) error {
	s.runningMu.Lock()
	if s.running {
		s.runningMu.Unlock()
		return ErrServerAlreadyRunning
	}

	ctx, s.cancelFunc = context.WithCancel(ctx)
	s.running = true
	s.runningMu.Unlock()

	addr := s.config.GetAddress()
	fmt.Printf("MCP server started on http://%s\n", addr)

	s.httpServer = mcpserver.NewStreamableHTTPServer(s.sdkServer,
		mcpserver.WithEndpointPath("/mcp"),
		mcpserver.WithStateLess(true),
	)

	// Wrap to add health endpoint
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/", s.handleRoot)
	mux.Handle("/mcp", s.httpServer)

	s.httpBaseServer = &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Run in goroutine
	go func() {
		if err := s.httpBaseServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("MCP server error: %v\n", err)
		}
	}()

	// Wait for cancellation
	<-ctx.Done()
	return s.shutdown()
}

// StartAsync starts the server without blocking
func (s *MCPServer) StartAsync() error {
	s.runningMu.Lock()
	if s.running {
		s.runningMu.Unlock()
		return ErrServerAlreadyRunning
	}

	s.httpServer = mcpserver.NewStreamableHTTPServer(s.sdkServer,
		mcpserver.WithEndpointPath("/mcp"),
		mcpserver.WithStateLess(true),
	)

	addr := s.config.GetAddress()

	// Wrap to add health endpoint
	mux := http.NewServeMux()
	mux.HandleFunc("/health", s.handleHealth)
	mux.HandleFunc("/", s.handleRoot)
	mux.Handle("/mcp", s.httpServer)

	s.httpBaseServer = &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	_, s.cancelFunc = context.WithCancel(context.Background())
	s.running = true
	s.runningMu.Unlock()

	fmt.Printf("MCP server started on http://%s\n", addr)

	go func() {
		if err := s.httpBaseServer.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			fmt.Printf("MCP server error: %v\n", err)
		}
	}()

	return nil
}

func (s *MCPServer) shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	if s.httpBaseServer != nil {
		return s.httpBaseServer.Shutdown(ctx)
	}
	return nil
}

// Stop stops the MCP server
func (s *MCPServer) Stop() {
	s.runningMu.Lock()
	defer s.runningMu.Unlock()

	if !s.running {
		return
	}

	if s.cancelFunc != nil {
		s.cancelFunc()
	}

	if s.httpBaseServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := s.httpBaseServer.Shutdown(ctx); err != nil {
			fmt.Printf("MCP server shutdown error: %v\n", err)
		}
	}

	s.running = false
	fmt.Println("MCP server stopped")
}

// IsRunning returns whether the server is currently running
func (s *MCPServer) IsRunning() bool {
	s.runningMu.RLock()
	defer s.runningMu.RUnlock()
	return s.running
}

// GetStatus returns the current server status
func (s *MCPServer) GetStatus() MCPStatus {
	s.runningMu.RLock()
	defer s.runningMu.RUnlock()

	return MCPStatus{
		Running:   s.running,
		Enabled:   s.config.Enabled,
		Transport: s.config.TransportMode,
		Address:   s.config.GetAddress(),
	}
}

// StartStdio starts the MCP server in stdio transport mode (blocking).
// This is used when the binary is launched as a subprocess by Claude Desktop or similar.
// It reads JSON-RPC messages from stdin and writes responses to stdout.
func (s *MCPServer) StartStdio() error {
	s.runningMu.Lock()
	if s.running {
		s.runningMu.Unlock()
		return ErrServerAlreadyRunning
	}
	s.running = true
	s.runningMu.Unlock()

	defer func() {
		s.runningMu.Lock()
		s.running = false
		s.runningMu.Unlock()
	}()

	fmt.Println("MCP server started in stdio mode")
	return mcpserver.ServeStdio(s.sdkServer)
}

// handleMessage processes an incoming JSON-RPC message via the SDK
// This is used by tests and internal callers.
func (s *MCPServer) handleMessage(ctx context.Context, data []byte) (interface{}, error) {
	response := s.sdkServer.HandleMessage(ctx, data)
	return response, nil
}

// HTTP Handlers (supplementary endpoints alongside SDK's /mcp)

func (s *MCPServer) handleRoot(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"name":        "KubeDevBench MCP Server",
		"version":     "1.0.0",
		"description": "Model Context Protocol server for Kubernetes and Docker Swarm management",
		"transport":   "streamable-http",
		"endpoint":    "/mcp",
		"protocol":    "mcp-go SDK v0.43",
		"endpoints": map[string]string{
			"mcp":    "/mcp",
			"health": "/health",
		},
	}); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}

func (s *MCPServer) handleHealth(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ok",
		"running": s.IsRunning(),
	}); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
	}
}
