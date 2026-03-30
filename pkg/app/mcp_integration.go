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

// Phase 1 resource getters

func (m *MCPServerAdapter) GetServices(namespace string) (interface{}, error) {
	return m.app.GetServices(namespace)
}

func (m *MCPServerAdapter) GetIngresses(namespace string) (interface{}, error) {
	return m.app.GetIngresses(namespace)
}

func (m *MCPServerAdapter) GetReplicaSets(namespace string) (interface{}, error) {
	return m.app.GetReplicaSets(namespace)
}

func (m *MCPServerAdapter) GetNodes() (interface{}, error) {
	return m.app.GetNodes()
}

func (m *MCPServerAdapter) GetPersistentVolumes() (interface{}, error) {
	return m.app.GetPersistentVolumes()
}

func (m *MCPServerAdapter) GetPersistentVolumeClaims(namespace string) (interface{}, error) {
	return m.app.GetPersistentVolumeClaims(namespace)
}

func (m *MCPServerAdapter) GetStorageClasses() (interface{}, error) {
	return m.app.GetStorageClasses()
}

func (m *MCPServerAdapter) GetServiceAccounts(namespace string) (interface{}, error) {
	return m.app.GetServiceAccounts(namespace)
}

func (m *MCPServerAdapter) GetRoles(namespace string) (interface{}, error) {
	return m.app.GetRoles(namespace)
}

func (m *MCPServerAdapter) GetClusterRoles() (interface{}, error) {
	return m.app.GetClusterRoles()
}

func (m *MCPServerAdapter) GetRoleBindings(namespace string) (interface{}, error) {
	return m.app.GetRoleBindings(namespace)
}

func (m *MCPServerAdapter) GetClusterRoleBindings() (interface{}, error) {
	return m.app.GetClusterRoleBindings()
}

func (m *MCPServerAdapter) GetNetworkPolicies(namespace string) (interface{}, error) {
	return m.app.GetNetworkPolicies(namespace)
}

func (m *MCPServerAdapter) GetCustomResourceDefinitions() (interface{}, error) {
	return m.app.GetCustomResourceDefinitions()
}

func (m *MCPServerAdapter) GetEndpoints(namespace string) (interface{}, error) {
	return m.app.GetEndpoints(namespace)
}

// Detail methods

func (m *MCPServerAdapter) GetPodDetail(namespace, name string) (interface{}, error) {
	// Use the app's current namespace for pod lookup
	ns := m.app.currentNamespace
	if ns == "" {
		ns = namespace
	}
	return m.app.GetPodDetailInNamespace(ns, name)
}

func (m *MCPServerAdapter) GetDeploymentDetail(namespace, name string) (interface{}, error) {
	return m.app.GetDeploymentDetail(namespace, name)
}

func (m *MCPServerAdapter) GetServiceDetail(namespace, name string) (interface{}, error) {
	return m.app.GetServiceDetail(namespace, name)
}

func (m *MCPServerAdapter) GetIngressDetail(namespace, name string) (interface{}, error) {
	return m.app.GetIngressDetail(namespace, name)
}

func (m *MCPServerAdapter) GetNodeDetail(name string) (interface{}, error) {
	return m.app.GetNodeDetail(name)
}

func (m *MCPServerAdapter) GetPersistentVolumeClaimDetail(namespace, name string) (interface{}, error) {
	return m.app.GetPersistentVolumeClaimDetail(namespace, name)
}

func (m *MCPServerAdapter) GetPersistentVolumeDetail(name string) (interface{}, error) {
	return m.app.GetPersistentVolumeDetail(name)
}

func (m *MCPServerAdapter) GetStatefulSetDetail(namespace, name string) (interface{}, error) {
	return m.app.GetStatefulSetDetail(namespace, name)
}

func (m *MCPServerAdapter) GetDaemonSetDetail(namespace, name string) (interface{}, error) {
	return m.app.GetDaemonSetDetail(namespace, name)
}

func (m *MCPServerAdapter) GetReplicaSetDetail(namespace, name string) (interface{}, error) {
	return m.app.GetReplicaSetDetail(namespace, name)
}

func (m *MCPServerAdapter) GetJobDetail(namespace, name string) (interface{}, error) {
	return m.app.GetJobDetail(namespace, name)
}

func (m *MCPServerAdapter) GetCronJobDetail(namespace, name string) (interface{}, error) {
	return m.app.GetCronJobDetail(namespace, name)
}

// YAML method

func (m *MCPServerAdapter) GetResourceYAML(kind, namespace, name string) (string, error) {
	return m.app.GetResourceYAML(kind, namespace, name)
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

func (m *MCPServerAdapter) RestartStatefulSet(namespace, name string) error {
	return m.app.RestartStatefulSet(namespace, name)
}

func (m *MCPServerAdapter) RestartDaemonSet(namespace, name string) error {
	return m.app.RestartDaemonSet(namespace, name)
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

	switch mcpConfig.TransportMode {
	case "stdio":
		// Stdio mode: run in goroutine since ServeStdio blocks.
		// Used when launched as a subprocess by Claude Desktop.
		go func() {
			if err := mcpServer.StartStdio(); err != nil {
				fmt.Printf("MCP stdio server error: %v\n", err)
			}
		}()
	default: // "http" or empty
		if err := mcpServer.StartAsync(); err != nil {
			mcpServer = nil
			return err
		}
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
		Transport: mcpConfig.TransportMode,
		Address:   mcpConfig.GetAddress(),
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

// Phase 3: K8s Diagnostics methods

func (m *MCPServerAdapter) GetPodLogsPrevious(namespace, podName, container string, lines int) (string, error) {
	return m.app.GetPodLogsPrevious(namespace, podName, container, lines)
}

func (m *MCPServerAdapter) TopPods(namespace string) (interface{}, error) {
	return m.app.TopPods(namespace)
}

func (m *MCPServerAdapter) TopNodes() (interface{}, error) {
	return m.app.TopNodes()
}

func (m *MCPServerAdapter) GetRolloutStatus(kind, namespace, name string) (interface{}, error) {
	return m.app.GetRolloutStatus(kind, namespace, name)
}

func (m *MCPServerAdapter) GetRolloutHistory(kind, namespace, name string) (interface{}, error) {
	return m.app.GetRolloutHistory(kind, namespace, name)
}

// Phase 4: Docker Swarm detail methods

func (m *MCPServerAdapter) GetSwarmService(serviceID string) (interface{}, error) {
	return m.app.GetSwarmService(serviceID)
}

func (m *MCPServerAdapter) GetSwarmTask(taskID string) (interface{}, error) {
	return m.app.GetSwarmTask(taskID)
}

func (m *MCPServerAdapter) GetSwarmNode(nodeID string) (interface{}, error) {
	return m.app.GetSwarmNode(nodeID)
}

func (m *MCPServerAdapter) GetSwarmStacks() (interface{}, error) {
	return m.app.GetSwarmStacks()
}

func (m *MCPServerAdapter) GetSwarmNetworks() (interface{}, error) {
	return m.app.GetSwarmNetworks()
}

func (m *MCPServerAdapter) GetSwarmVolumes() (interface{}, error) {
	return m.app.GetSwarmVolumes()
}

func (m *MCPServerAdapter) GetSwarmSecrets() (interface{}, error) {
	return m.app.GetSwarmSecrets()
}

func (m *MCPServerAdapter) GetSwarmConfigs() (interface{}, error) {
	return m.app.GetSwarmConfigs()
}
