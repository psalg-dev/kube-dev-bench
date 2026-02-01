package mcp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"sync"
	"time"
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

// MCPServer is the MCP server implementation using HTTP transport
type MCPServer struct {
	app       ServerInterface
	config    MCPConfigData
	tools     map[string]*ToolDefinition
	resources map[string]*ResourceDefinition

	// HTTP server
	httpServer *http.Server
	listener   net.Listener

	// Server state
	running    bool
	runningMu  sync.RWMutex
	cancelFunc context.CancelFunc
}

// NewServer creates a new MCP server instance
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

	// Register all tools and resources
	server.registerTools()
	server.registerResources()

	return server, nil
}

// Start starts the MCP server with HTTP transport
func (s *MCPServer) Start(ctx context.Context) error {
	s.runningMu.Lock()
	if s.running {
		s.runningMu.Unlock()
		return ErrServerAlreadyRunning
	}

	// Create HTTP server with routes
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleRoot)
	mux.HandleFunc("/mcp", s.handleMCP)
	mux.HandleFunc("/health", s.handleHealth)

	addr := s.config.GetAddress()
	s.httpServer = &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Create listener
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		s.runningMu.Unlock()
		return fmt.Errorf("failed to listen on %s: %w", addr, err)
	}
	s.listener = listener

	ctx, s.cancelFunc = context.WithCancel(ctx)
	s.running = true
	s.runningMu.Unlock()

	fmt.Printf("MCP server started on http://%s\n", addr)

	// Run server in goroutine
	go func() {
		if err := s.httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			fmt.Printf("MCP server error: %v\n", err)
		}
	}()

	// Wait for context cancellation
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

	// Create HTTP server with routes
	mux := http.NewServeMux()
	mux.HandleFunc("/", s.handleRoot)
	mux.HandleFunc("/mcp", s.handleMCP)
	mux.HandleFunc("/health", s.handleHealth)

	addr := s.config.GetAddress()
	s.httpServer = &http.Server{
		Addr:              addr,
		Handler:           mux,
		ReadHeaderTimeout: 10 * time.Second,
	}

	// Create listener
	listener, err := net.Listen("tcp", addr)
	if err != nil {
		s.runningMu.Unlock()
		return fmt.Errorf("failed to listen on %s: %w", addr, err)
	}
	s.listener = listener

	var ctx context.Context
	ctx, s.cancelFunc = context.WithCancel(context.Background())
	_ = ctx // suppress unused warning
	s.running = true
	s.runningMu.Unlock()

	fmt.Printf("MCP server started on http://%s\n", addr)

	// Run server in goroutine
	go func() {
		if err := s.httpServer.Serve(listener); err != nil && err != http.ErrServerClosed {
			fmt.Printf("MCP server error: %v\n", err)
		}
	}()

	return nil
}

func (s *MCPServer) shutdown() error {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	return s.httpServer.Shutdown(ctx)
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

	if s.httpServer != nil {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		s.httpServer.Shutdown(ctx)
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
		Transport: fmt.Sprintf("http://%s", s.config.GetAddress()),
	}
}

// HTTP Handlers

func (s *MCPServer) handleRoot(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"name":        "KubeDevBench MCP Server",
		"version":     "1.0.0",
		"description": "Model Context Protocol server for Kubernetes and Docker Swarm management",
		"endpoints": map[string]string{
			"mcp":    "/mcp",
			"health": "/health",
		},
	})
}

func (s *MCPServer) handleHealth(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":  "ok",
		"running": s.IsRunning(),
	})
}

func (s *MCPServer) handleMCP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Read request body
	body, err := io.ReadAll(r.Body)
	if err != nil {
		s.sendHTTPError(w, -1, fmt.Errorf("failed to read request body: %w", err))
		return
	}
	defer r.Body.Close()

	// Handle the MCP message
	response, err := s.handleMessage(r.Context(), body)
	if err != nil {
		s.sendHTTPError(w, -1, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *MCPServer) sendHTTPError(w http.ResponseWriter, id interface{}, err error) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(&jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      id,
		Error: &rpcError{
			Code:    -32603,
			Message: err.Error(),
		},
	})
}

// JSON-RPC structures
type jsonRPCRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      interface{}     `json:"id"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

type jsonRPCResponse struct {
	JSONRPC string      `json:"jsonrpc"`
	ID      interface{} `json:"id"`
	Result  interface{} `json:"result,omitempty"`
	Error   *rpcError   `json:"error,omitempty"`
}

type rpcError struct {
	Code    int         `json:"code"`
	Message string      `json:"message"`
	Data    interface{} `json:"data,omitempty"`
}

// handleMessage processes an incoming JSON-RPC message
func (s *MCPServer) handleMessage(ctx context.Context, data []byte) (*jsonRPCResponse, error) {
	var req jsonRPCRequest
	if err := json.Unmarshal(data, &req); err != nil {
		return nil, fmt.Errorf("invalid JSON-RPC request: %w", err)
	}

	if req.JSONRPC != "2.0" {
		return nil, fmt.Errorf("invalid JSON-RPC version: %s", req.JSONRPC)
	}

	switch req.Method {
	case "initialize":
		return s.handleInitialize(req)
	case "tools/list":
		return s.handleToolsList(req)
	case "tools/call":
		return s.handleToolsCall(ctx, req)
	case "resources/list":
		return s.handleResourcesList(req)
	case "resources/read":
		return s.handleResourcesRead(ctx, req)
	case "ping":
		return &jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result:  map[string]string{"status": "ok"},
		}, nil
	default:
		return &jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &rpcError{
				Code:    -32601,
				Message: fmt.Sprintf("method not found: %s", req.Method),
			},
		}, nil
	}
}

// handleInitialize handles the MCP initialize request
func (s *MCPServer) handleInitialize(req jsonRPCRequest) (*jsonRPCResponse, error) {
	result := map[string]interface{}{
		"protocolVersion": "2024-11-05",
		"serverInfo": map[string]string{
			"name":    "kubedevbench",
			"version": "1.0.0",
		},
		"capabilities": map[string]interface{}{
			"tools": map[string]interface{}{
				"listChanged": false,
			},
			"resources": map[string]interface{}{
				"subscribe":   false,
				"listChanged": false,
			},
		},
	}

	return &jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result:  result,
	}, nil
}

// handleToolsList returns the list of available tools
func (s *MCPServer) handleToolsList(req jsonRPCRequest) (*jsonRPCResponse, error) {
	tools := make([]map[string]interface{}, 0, len(s.tools))

	for _, tool := range s.tools {
		tools = append(tools, map[string]interface{}{
			"name":        tool.Name,
			"description": tool.Description,
			"inputSchema": tool.InputSchema,
		})
	}

	return &jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result: map[string]interface{}{
			"tools": tools,
		},
	}, nil
}

// handleToolsCall handles a tool invocation
func (s *MCPServer) handleToolsCall(ctx context.Context, req jsonRPCRequest) (*jsonRPCResponse, error) {
	var params struct {
		Name      string                 `json:"name"`
		Arguments map[string]interface{} `json:"arguments"`
	}

	if err := json.Unmarshal(req.Params, &params); err != nil {
		return &jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &rpcError{
				Code:    -32602,
				Message: "invalid params",
			},
		}, nil
	}

	tool, ok := s.tools[params.Name]
	if !ok {
		return &jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &rpcError{
				Code:    -32602,
				Message: fmt.Sprintf("tool not found: %s", params.Name),
			},
		}, nil
	}

	// Check security
	if err := s.checkSecurity(tool, params.Arguments); err != nil {
		return &jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &rpcError{
				Code:    -32000,
				Message: err.Error(),
			},
		}, nil
	}

	// Execute the tool
	result, err := tool.Handler(ctx, params.Arguments)
	if err != nil {
		return &jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Result: map[string]interface{}{
				"content": []map[string]interface{}{
					{
						"type": "text",
						"text": fmt.Sprintf("Error: %s", err.Error()),
					},
				},
				"isError": true,
			},
		}, nil
	}

	// Format result as text content
	resultText, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		resultText = []byte(fmt.Sprintf("%v", result))
	}

	return &jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result: map[string]interface{}{
			"content": []map[string]interface{}{
				{
					"type": "text",
					"text": string(resultText),
				},
			},
		},
	}, nil
}

// handleResourcesList returns the list of available resources
func (s *MCPServer) handleResourcesList(req jsonRPCRequest) (*jsonRPCResponse, error) {
	resources := make([]map[string]interface{}, 0, len(s.resources))

	for _, res := range s.resources {
		resources = append(resources, map[string]interface{}{
			"uri":         res.URI,
			"name":        res.Name,
			"description": res.Description,
			"mimeType":    res.MimeType,
		})
	}

	return &jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result: map[string]interface{}{
			"resources": resources,
		},
	}, nil
}

// handleResourcesRead reads a specific resource
func (s *MCPServer) handleResourcesRead(ctx context.Context, req jsonRPCRequest) (*jsonRPCResponse, error) {
	var params struct {
		URI string `json:"uri"`
	}

	if err := json.Unmarshal(req.Params, &params); err != nil {
		return &jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &rpcError{
				Code:    -32602,
				Message: "invalid params",
			},
		}, nil
	}

	res, ok := s.resources[params.URI]
	if !ok {
		return &jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &rpcError{
				Code:    -32602,
				Message: fmt.Sprintf("resource not found: %s", params.URI),
			},
		}, nil
	}

	result, err := res.Handler(ctx)
	if err != nil {
		return &jsonRPCResponse{
			JSONRPC: "2.0",
			ID:      req.ID,
			Error: &rpcError{
				Code:    -32000,
				Message: err.Error(),
			},
		}, nil
	}

	resultText, err := json.MarshalIndent(result, "", "  ")
	if err != nil {
		resultText = []byte(fmt.Sprintf("%v", result))
	}

	return &jsonRPCResponse{
		JSONRPC: "2.0",
		ID:      req.ID,
		Result: map[string]interface{}{
			"contents": []map[string]interface{}{
				{
					"uri":      res.URI,
					"mimeType": res.MimeType,
					"text":     string(resultText),
				},
			},
		},
	}, nil
}
