package app

import (
	"fmt"
	"sync"

	"gowails/pkg/app/mcp"
)

// MCP Server global state (following Holmes pattern)
var mcpServer *mcp.MCPServer
var mcpMu sync.RWMutex
var mcpConfig = mcp.DefaultConfig()

// MCPServerAdapter adapts the App to the mcp.ServerInterface
type MCPServerAdapter struct {
	app *App
}

// Implement mcp.ServerInterface methods

func (m *MCPServerAdapter) GetCurrentContext() string {
	return m.app.currentKubeContext
}

func (m *MCPServerAdapter) GetCurrentNamespace() string {
	return m.app.currentNamespace
}

func (m *MCPServerAdapter) GetPreferredNamespaces() []string {
	return append([]string(nil), m.app.preferredNamespaces...)
}

func (m *MCPServerAdapter) GetKubeConfigPath() string {
	return m.app.getKubeConfigPath()
}

func (m *MCPServerAdapter) GetNamespaces() ([]string, error) {
	return m.app.GetNamespaces()
}

func (m *MCPServerAdapter) GetConnectionStatus() map[string]interface{} {
	return m.app.GetConnectionStatus()
}

// Resource getters - wrap to return interface{}

func (m *MCPServerAdapter) GetPods(namespace string) (interface{}, error) {
	return m.app.GetRunningPods(namespace)
}

func (m *MCPServerAdapter) GetDeployments(namespace string) (interface{}, error) {
	return m.app.GetDeployments(namespace)
}

func (m *MCPServerAdapter) GetStatefulSets(namespace string) (interface{}, error) {
	return m.app.GetStatefulSets(namespace)
}

func (m *MCPServerAdapter) GetDaemonSets(namespace string) (interface{}, error) {
	return m.app.GetDaemonSets(namespace)
}

func (m *MCPServerAdapter) GetJobs(namespace string) (interface{}, error) {
	return m.app.GetJobs(namespace)
}

func (m *MCPServerAdapter) GetCronJobs(namespace string) (interface{}, error) {
	return m.app.GetCronJobs(namespace)
}

func (m *MCPServerAdapter) GetConfigMaps(namespace string) (interface{}, error) {
	return m.app.GetConfigMaps(namespace)
}

func (m *MCPServerAdapter) GetSecrets(namespace string) (interface{}, error) {
	return m.app.GetSecrets(namespace)
}

func (m *MCPServerAdapter) GetResourceEvents(namespace, kind, name string) (interface{}, error) {
	return m.app.GetResourceEvents(namespace, kind, name)
}

func (m *MCPServerAdapter) GetResourceCounts() interface{} {
	return m.app.GetResourceCounts()
}

// Detail methods

func (m *MCPServerAdapter) GetPodDetail(namespace, name string) (interface{}, error) {
	// GetPodSummary takes only podName - we need to set the namespace first
	// For MCP, just return the pod summary; the caller should ensure proper namespace context
	return m.app.GetPodSummary(name)
}

func (m *MCPServerAdapter) GetDeploymentDetail(namespace, name string) (interface{}, error) {
	return m.app.GetDeploymentDetail(namespace, name)
}

// Log methods

func (m *MCPServerAdapter) GetPodLogs(namespace, podName, container string, lines int) (string, error) {
	return m.app.getPodLogs(namespace, podName, container, lines)
}

// Mutation methods

func (m *MCPServerAdapter) ScaleResource(kind, namespace, name string, replicas int) error {
	return m.app.ScaleResource(kind, namespace, name, replicas)
}

func (m *MCPServerAdapter) RestartDeployment(namespace, name string) error {
	return m.app.RestartDeployment(namespace, name)
}

// Docker Swarm methods

func (m *MCPServerAdapter) GetSwarmServices() (interface{}, error) {
	return m.app.GetSwarmServices()
}

func (m *MCPServerAdapter) GetSwarmTasks() (interface{}, error) {
	return m.app.GetSwarmTasks()
}

func (m *MCPServerAdapter) GetSwarmNodes() (interface{}, error) {
	return m.app.GetSwarmNodes()
}

func (m *MCPServerAdapter) GetSwarmServiceLogs(serviceID string, tail int) (string, error) {
	return m.app.GetSwarmServiceLogs(serviceID, fmt.Sprintf("%d", tail))
}

func (m *MCPServerAdapter) ScaleSwarmService(serviceID string, replicas int) error {
	return m.app.ScaleSwarmService(serviceID, replicas)
}

func (m *MCPServerAdapter) IsSwarmConnected() bool {
	mcpMu.RLock()
	cli := dockerClient
	mcpMu.RUnlock()
	return cli != nil
}

// =====================
// MCP Server Lifecycle
// =====================

// initMCP initializes the MCP server if enabled in configuration
func (a *App) initMCP() {
	if !mcpConfig.Enabled {
		fmt.Println("MCP server: disabled in configuration")
		return
	}

	// Start the MCP server automatically if enabled
	if err := a.startMCPServer(); err != nil {
		fmt.Printf("Failed to start MCP server: %v\n", err)
	}
}

// startMCPServer starts the MCP server
func (a *App) startMCPServer() error {
	mcpMu.Lock()
	defer mcpMu.Unlock()

	if mcpServer != nil && mcpServer.IsRunning() {
		return nil // Already running
	}

	adapter := &MCPServerAdapter{app: a}
	server, err := mcp.NewServer(adapter, mcpConfig)
	if err != nil {
		return err
	}

	mcpServer = server

	// Start the HTTP server (non-blocking)
	if err := mcpServer.StartAsync(); err != nil {
		mcpServer = nil
		return err
	}

	return nil
}

// shutdownMCP stops the MCP server
func (a *App) shutdownMCP() {
	mcpMu.Lock()
	defer mcpMu.Unlock()

	if mcpServer != nil {
		mcpServer.Stop()
		mcpServer = nil
	}
}

// =====================
// Wails RPC Methods for GUI Configuration
// =====================

// GetMCPConfig returns the current MCP configuration
func (a *App) GetMCPConfig() mcp.MCPConfigData {
	mcpMu.RLock()
	defer mcpMu.RUnlock()
	return mcpConfig.Copy()
}

// SetMCPConfig updates and persists the MCP configuration
func (a *App) SetMCPConfig(config mcp.MCPConfigData) error {
	if err := config.Validate(); err != nil {
		return err
	}

	mcpMu.Lock()
	mcpConfig = config
	mcpMu.Unlock()

	// Persist to disk
	return a.saveConfig()
}

// GetMCPStatus returns the current MCP server status
func (a *App) GetMCPStatus() mcp.MCPStatus {
	mcpMu.RLock()
	defer mcpMu.RUnlock()

	if mcpServer != nil {
		return mcpServer.GetStatus()
	}

	return mcp.MCPStatus{
		Running:   false,
		Enabled:   mcpConfig.Enabled,
		Transport: fmt.Sprintf("http://%s (stopped)", mcpConfig.GetAddress()),
	}
}

// StartMCPServer manually starts the MCP server
func (a *App) StartMCPServer() error {
	return a.startMCPServer()
}

// StopMCPServer manually stops the MCP server
func (a *App) StopMCPServer() error {
	mcpMu.Lock()
	defer mcpMu.Unlock()

	if mcpServer == nil || !mcpServer.IsRunning() {
		return mcp.ErrServerNotRunning
	}

	mcpServer.Stop()
	mcpServer = nil
	return nil
}
