package app

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"gowails/pkg/app/docker"
	"gowails/pkg/app/docker/registry"
	"gowails/pkg/app/docker/topology"

	"github.com/docker/docker/api/types"
	registrytypes "github.com/docker/docker/api/types/registry"
	"github.com/docker/docker/client"
)

// ==================== Registry Integration (Swarm) ====================

// GetRegistries returns configured registries (with credentials redacted).
func (a *App) GetRegistries() ([]registry.RegistryConfig, error) {
	return registry.GetRegistries()
}

// AddRegistry creates or updates a registry configuration.
func (a *App) AddRegistry(config registry.RegistryConfig) error {
	return registry.SaveRegistry(config)
}

// RemoveRegistry deletes a registry configuration by name.
func (a *App) RemoveRegistry(name string) error {
	return registry.DeleteRegistry(name)
}

// TestRegistryConnection validates that the registry is reachable and auth works.
func (a *App) TestRegistryConnection(config registry.RegistryConfig) error {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return registry.TestConnection(ctx, config)
}

func (a *App) ListRegistryRepositories(registryName string) ([]string, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	cfg, err := registry.GetRegistryWithCredentials(registryName)
	if err != nil {
		return nil, err
	}
	c, err := registry.NewClient(cfg)
	if err != nil {
		return nil, err
	}
	return c.ListRepositories(ctx)
}

func (a *App) ListRegistryTags(registryName, repository string) ([]string, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	cfg, err := registry.GetRegistryWithCredentials(registryName)
	if err != nil {
		return nil, err
	}
	c, err := registry.NewClient(cfg)
	if err != nil {
		return nil, err
	}
	return c.ListTags(ctx, repository)
}

// ==================== Cluster Topology (Swarm) ====================

// GetClusterTopology returns a best-effort topology graph (nodes, services, links).
func (a *App) GetClusterTopology() (topology.ClusterTopology, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	cli, err := a.getDockerClient()
	if err != nil {
		return topology.ClusterTopology{}, err
	}
	return topology.BuildClusterTopology(ctx, cli)
}

func (a *App) GetImageDigest(registryName, repository, tag string) (string, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	cfg, err := registry.GetRegistryWithCredentials(registryName)
	if err != nil {
		return "", err
	}
	c, err := registry.NewClient(cfg)
	if err != nil {
		return "", err
	}
	return c.GetManifestDigest(ctx, repository, tag)
}

// SearchRegistryRepositories searches a non-DockerHub registry for repositories.
// Currently implemented for v2-compatible registries (e.g., Artifactory) via catalog listing.
func (a *App) SearchRegistryRepositories(registryName, query string) ([]registry.RegistryRepoSearchResult, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	cfg, err := registry.GetRegistryWithCredentials(registryName)
	if err != nil {
		return nil, err
	}
	if cfg.Type == registry.RegistryTypeDockerHub {
		return nil, fmt.Errorf("search not supported for registry type: %s", cfg.Type)
	}
	v2c, err := registry.NewV2Client(cfg)
	if err != nil {
		return nil, err
	}
	return registry.SearchV2Repositories(ctx, v2c, query, 100)
}

// GetRegistryRepositoryDetails inspects a non-DockerHub registry repository.
// SizeBytes is computed best-effort from the manifest for the preferred tag.
func (a *App) GetRegistryRepositoryDetails(registryName, fullName string) (registry.RegistryRepoDetails, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	cfg, err := registry.GetRegistryWithCredentials(registryName)
	if err != nil {
		return registry.RegistryRepoDetails{}, err
	}
	if cfg.Type == registry.RegistryTypeDockerHub {
		return registry.RegistryRepoDetails{}, fmt.Errorf("details not supported for registry type: %s", cfg.Type)
	}
	v2c, err := registry.NewV2Client(cfg)
	if err != nil {
		return registry.RegistryRepoDetails{}, err
	}
	return registry.GetV2RepoDetails(ctx, v2c, cfg.URL, fullName)
}

// SearchDockerHubRepositories searches Docker Hub for repositories by query.
func (a *App) SearchDockerHubRepositories(query string) ([]registry.DockerHubRepoSearchResult, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return registry.SearchDockerHubRepositories(ctx, query)
}

// GetDockerHubRepositoryDetails fetches detailed repository information for inspection.
// fullName is either "namespace/name" or "name" (for official images).
func (a *App) GetDockerHubRepositoryDetails(fullName string) (registry.DockerHubRepoDetails, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return registry.GetDockerHubRepositoryDetails(ctx, fullName)
}

// PullDockerImageLatest pulls "image:latest" into the currently connected Docker daemon.
// If registryName is provided, stored registry credentials will be used for registry auth.
func (a *App) PullDockerImageLatest(image string, registryName string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	image = strings.TrimSpace(image)
	if image == "" {
		return fmt.Errorf("image is required")
	}
	if !strings.Contains(image, ":") {
		image = image + ":latest"
	}

	registryAuth := ""
	if strings.TrimSpace(registryName) != "" {
		cfg, err := registry.GetRegistryWithCredentials(registryName)
		if err != nil {
			return err
		}

		// For non-DockerHub registries, ensure the image reference includes the registry host.
		if cfg.Type != registry.RegistryTypeDockerHub {
			image = ensureImageHasRegistryHost(image, cfg.URL)
		}

		if strings.TrimSpace(cfg.Credentials.Username) != "" || strings.TrimSpace(cfg.Credentials.Password) != "" {
			serverAddr := strings.TrimSpace(cfg.URL)
			if cfg.Type == registry.RegistryTypeDockerHub {
				// Docker Engine expects this special server address for Docker Hub auth.
				serverAddr = "https://index.docker.io/v1/"
			}
			authCfg := registrytypes.AuthConfig{
				Username:      strings.TrimSpace(cfg.Credentials.Username),
				Password:      strings.TrimSpace(cfg.Credentials.Password),
				ServerAddress: serverAddr,
			}
			b, _ := json.Marshal(authCfg)
			registryAuth = base64.URLEncoding.EncodeToString(b)
		}
	}

	pullCtx, cancel := context.WithTimeout(ctx, 5*time.Minute)
	defer cancel()
	r, err := cli.ImagePull(pullCtx, image, types.ImagePullOptions{RegistryAuth: registryAuth})
	if err != nil {
		return err
	}
	defer r.Close()
	_, _ = io.Copy(io.Discard, r)
	return nil
}

func ensureImageHasRegistryHost(image, registryURL string) string {
	img := strings.TrimSpace(image)
	if img == "" {
		return img
	}
	u, err := url.Parse(strings.TrimSpace(registryURL))
	if err != nil {
		return img
	}
	host := strings.TrimSpace(u.Host)
	if host == "" {
		return img
	}

	// If image already includes an explicit registry host, don't touch it.
	first := img
	if idx := strings.Index(img, "/"); idx >= 0 {
		first = img[:idx]
	}
	if strings.Contains(first, ".") || strings.Contains(first, ":") || first == "localhost" {
		return img
	}
	if strings.HasPrefix(img, host+"/") {
		return img
	}
	return host + "/" + img
}

// Docker-related fields are added to the App struct via this file

var (
	dockerClientMu sync.RWMutex
	dockerClient   *client.Client
	dockerConfig   *docker.DockerConfig
)

// GetDefaultDockerHost returns the platform-specific default Docker host URL
func (a *App) GetDefaultDockerHost() string {
	return docker.DefaultDockerHost()
}

// GetDockerConnectionStatus returns the current Docker connection status
func (a *App) GetDockerConnectionStatus() (*docker.DockerConnectionStatus, error) {
	dockerClientMu.RLock()
	cli := dockerClient
	dockerClientMu.RUnlock()

	if cli == nil {
		return &docker.DockerConnectionStatus{
			Connected: false,
			Error:     "Docker client not connected",
		}, nil
	}

	return docker.TestConnection(a.ctx, *dockerConfig)
}

// ConnectToDocker connects to a Docker daemon with the specified configuration
func (a *App) ConnectToDocker(config docker.DockerConfig) (*docker.DockerConnectionStatus, error) {
	// Run pre-connect hooks before attempting to resolve/test the Docker host.
	tlsVerify := "0"
	if config.TLSVerify {
		tlsVerify = "1"
	}
	tlsEnabled := "0"
	if config.TLSEnabled {
		tlsEnabled = "1"
	}

	preEnv := map[string]string{
		"KDB_CONNECTION_TYPE":    "swarm",
		"KDB_CONNECTION_ID":      config.Host,
		"DOCKER_HOST":            config.Host,
		"DOCKER_TLS_VERIFY":      tlsVerify,
		"KDB_DOCKER_TLS_ENABLED": tlsEnabled,
		"KDB_DOCKER_TLS_CERT":    config.TLSCert,
		"KDB_DOCKER_TLS_KEY":     config.TLSKey,
		"KDB_DOCKER_TLS_CA":      config.TLSCA,
	}
	if _, err := a.runPreConnectHooks("swarm", config.Host, preEnv); err != nil {
		return &docker.DockerConnectionStatus{Connected: false, Error: "pre-connect hook aborted connection: " + err.Error()}, nil
	}

	// Test connection first (with host fallbacks where appropriate)
	resolvedConfig, status := a.resolveWorkingDockerConfig(config)
	if !status.Connected {
		return status, nil
	}

	// Create the client
	cli, err := docker.NewClient(resolvedConfig)
	if err != nil {
		return &docker.DockerConnectionStatus{
			Connected: false,
			Error:     err.Error(),
		}, nil
	}

	// Store the client
	dockerClientMu.Lock()
	if dockerClient != nil {
		dockerClient.Close()
	}
	dockerClient = cli
	configCopy := resolvedConfig
	dockerConfig = &configCopy
	dockerClientMu.Unlock()

	// Save Docker configuration
	if err := a.saveDockerConfig(resolvedConfig); err != nil {
		fmt.Printf("Warning: failed to save Docker config: %v\n", err)
	}

	// Emit docker:connected event so frontend can refetch counts
	emitEvent(a.ctx, "docker:connected", status)

	// Fire post-connect hooks asynchronously after successful connection.
	a.runPostConnectHooksAsync("swarm", resolvedConfig.Host, preEnv)

	return status, nil
}

// resolveWorkingDockerConfig tries to find a Docker host that actually works.
// This is primarily to make the UI "Connect" button reliable on Windows where
// Docker Desktop may expose either docker_engine or dockerDesktopLinuxEngine.
func (a *App) resolveWorkingDockerConfig(config docker.DockerConfig) (docker.DockerConfig, *docker.DockerConnectionStatus) {
	seen := map[string]struct{}{}
	add := func(host string, out *[]string) {
		if host == "" {
			return
		}
		if _, ok := seen[host]; ok {
			return
		}
		seen[host] = struct{}{}
		*out = append(*out, host)
	}

	candidates := []string{}
	add(config.Host, &candidates)
	add(docker.DefaultDockerHost(), &candidates)

	if runtime.GOOS == "windows" {
		// Add common Docker Desktop pipes as fallbacks.
		add("npipe:////./pipe/dockerDesktopLinuxEngine", &candidates)
		add("npipe:////./pipe/docker_engine", &candidates)

		// If the user passed a Windows pipe in UNC form, normalize into npipe://.
		if strings.HasPrefix(config.Host, `\\.\pipe\`) {
			pipeName := strings.TrimPrefix(config.Host, `\\.\pipe\`)
			add("npipe:////./pipe/"+pipeName, &candidates)
		}
	}

	var lastStatus *docker.DockerConnectionStatus
	for _, host := range candidates {
		cfg := config
		cfg.Host = host
		status, _ := docker.TestConnection(a.ctx, cfg)
		lastStatus = status
		if status != nil && status.Connected {
			return cfg, status
		}
	}

	if lastStatus == nil {
		lastStatus = &docker.DockerConnectionStatus{Connected: false, Error: "No Docker hosts to try"}
	}
	return config, lastStatus
}

// TestDockerConnection tests a Docker connection without storing it
func (a *App) TestDockerConnection(config docker.DockerConfig) (*docker.DockerConnectionStatus, error) {
	return docker.TestConnection(a.ctx, config)
}

// DisconnectDocker disconnects from the Docker daemon
func (a *App) DisconnectDocker() error {
	dockerClientMu.Lock()
	defer dockerClientMu.Unlock()

	if dockerClient != nil {
		err := dockerClient.Close()
		dockerClient = nil
		dockerConfig = nil
		return err
	}
	return nil
}

// getDockerClient returns the current Docker client (internal use)
func (a *App) getDockerClient() (*client.Client, error) {
	dockerClientMu.RLock()
	defer dockerClientMu.RUnlock()

	if dockerClient == nil {
		return nil, docker.ErrNotConnected
	}
	return dockerClient, nil
}

// ==================== Swarm Services ====================

// GetSwarmServices returns all Swarm services
func (a *App) GetSwarmServices() ([]docker.SwarmServiceInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmServices(a.ctx, cli)
}

// GetSwarmService returns a specific Swarm service
func (a *App) GetSwarmService(serviceID string) (*docker.SwarmServiceInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmService(a.ctx, cli, serviceID)
}

// ScaleSwarmService scales a Swarm service
func (a *App) ScaleSwarmService(serviceID string, replicas int) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.ScaleSwarmService(a.ctx, cli, serviceID, uint64(replicas))
}

// RemoveSwarmService removes a Swarm service
func (a *App) RemoveSwarmService(serviceID string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.RemoveSwarmService(a.ctx, cli, serviceID)
}

// UpdateSwarmServiceImage updates the image of a Swarm service
func (a *App) UpdateSwarmServiceImage(serviceID string, image string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.UpdateSwarmServiceImage(a.ctx, cli, serviceID, image)
}

// CheckServiceImageUpdates checks whether the given services have newer image digests available in their registries.
// This is best-effort and requires the relevant registry to be configured in the app.
func (a *App) CheckServiceImageUpdates(serviceIDs []string) (map[string]docker.ImageUpdateInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.CheckSwarmServiceImageUpdates(a.ctx, cli, serviceIDs)
}

// RestartSwarmService restarts a Swarm service
func (a *App) RestartSwarmService(serviceID string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.RestartSwarmService(a.ctx, cli, serviceID)
}

// CreateSwarmService creates a new Swarm service.
func (a *App) CreateSwarmService(opts docker.CreateServiceOptions) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	return docker.CreateSwarmService(a.ctx, cli, opts)
}

// ==================== Swarm Tasks ====================

// GetSwarmTasks returns all Swarm tasks
func (a *App) GetSwarmTasks() ([]docker.SwarmTaskInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmTasks(a.ctx, cli)
}

// GetSwarmTasksByService returns all tasks for a specific service
func (a *App) GetSwarmTasksByService(serviceID string) ([]docker.SwarmTaskInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmTasksByService(a.ctx, cli, serviceID)
}

// GetSwarmTask returns a specific Swarm task
func (a *App) GetSwarmTask(taskID string) (*docker.SwarmTaskInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmTask(a.ctx, cli, taskID)
}

// GetSwarmTaskHealthLogs returns recent healthcheck results for a task (if available).
func (a *App) GetSwarmTaskHealthLogs(taskID string) ([]docker.SwarmHealthLogEntry, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmTaskHealthLogs(a.ctx, cli, taskID)
}

// ==================== Swarm Nodes ====================

// GetSwarmNodes returns all Swarm nodes
func (a *App) GetSwarmNodes() ([]docker.SwarmNodeInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmNodes(a.ctx, cli)
}

// GetSwarmNode returns a specific Swarm node
func (a *App) GetSwarmNode(nodeID string) (*docker.SwarmNodeInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmNode(a.ctx, cli, nodeID)
}

// UpdateSwarmNodeAvailability updates a node's availability (active, pause, drain)
func (a *App) UpdateSwarmNodeAvailability(nodeID string, availability string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.UpdateSwarmNodeAvailability(a.ctx, cli, nodeID, availability)
}

// UpdateSwarmNodeRole updates a node's role (worker, manager)
func (a *App) UpdateSwarmNodeRole(nodeID string, role string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.UpdateSwarmNodeRole(a.ctx, cli, nodeID, role)
}

// UpdateSwarmNodeLabels updates a node's labels
func (a *App) UpdateSwarmNodeLabels(nodeID string, labels map[string]string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.UpdateSwarmNodeLabels(a.ctx, cli, nodeID, labels)
}

// GetSwarmNodeTasks returns all tasks running on a specific node
func (a *App) GetSwarmNodeTasks(nodeID string) ([]docker.SwarmTaskInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmNodeTasks(a.ctx, cli, nodeID)
}

// RemoveSwarmNode removes a node from the swarm
func (a *App) RemoveSwarmNode(nodeID string, force bool) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.RemoveSwarmNode(a.ctx, cli, nodeID, force)
}

// GetSwarmJoinTokens returns the swarm join tokens and commands
func (a *App) GetSwarmJoinTokens() (*docker.SwarmJoinTokens, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmJoinTokens(a.ctx, cli)
}

// ==================== Swarm Networks ====================

// GetSwarmNetworks returns all Docker networks
func (a *App) GetSwarmNetworks() ([]docker.SwarmNetworkInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmNetworks(a.ctx, cli)
}

// GetSwarmNetwork returns a specific network
func (a *App) GetSwarmNetwork(networkID string) (*docker.SwarmNetworkInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmNetwork(a.ctx, cli, networkID)
}

// GetSwarmNetworkServices returns Swarm services connected to a network.
func (a *App) GetSwarmNetworkServices(networkID string) ([]docker.SwarmServiceRef, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmNetworkServices(a.ctx, cli, networkID)
}

// GetSwarmNetworkContainers returns Swarm tasks/containers connected to a network.
func (a *App) GetSwarmNetworkContainers(networkID string) ([]docker.SwarmTaskInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmNetworkContainers(a.ctx, cli, networkID)
}

// GetSwarmNetworkInspectJSON returns the raw Docker network inspect JSON (pretty-printed).
func (a *App) GetSwarmNetworkInspectJSON(networkID string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	return docker.GetSwarmNetworkInspectJSON(a.ctx, cli, networkID)
}

// RemoveSwarmNetwork removes a Docker network
func (a *App) RemoveSwarmNetwork(networkID string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.RemoveSwarmNetwork(a.ctx, cli, networkID)
}

// CreateSwarmNetwork creates a new Docker network
func (a *App) CreateSwarmNetwork(name string, driver string, opts docker.CreateNetworkOptions) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	return docker.CreateSwarmNetwork(a.ctx, cli, name, driver, opts)
}

// PruneSwarmNetworks removes all unused networks
func (a *App) PruneSwarmNetworks() ([]string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.PruneSwarmNetworks(a.ctx, cli)
}

// ==================== Swarm Configs ====================

// GetSwarmConfigs returns all Swarm configs
func (a *App) GetSwarmConfigs() ([]docker.SwarmConfigInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmConfigs(a.ctx, cli)
}

// GetSwarmConfig returns a specific Swarm config
func (a *App) GetSwarmConfig(configID string) (*docker.SwarmConfigInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmConfig(a.ctx, cli, configID)
}

// GetSwarmConfigData returns the data content of a Swarm config
func (a *App) GetSwarmConfigData(configID string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	data, err := docker.GetSwarmConfigData(a.ctx, cli, configID)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// GetSwarmConfigInspectJSON returns Docker's config inspect payload as indented JSON.
func (a *App) GetSwarmConfigInspectJSON(configID string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	return docker.GetSwarmConfigInspectJSON(a.ctx, cli, configID)
}

// CreateSwarmConfig creates a new Swarm config
func (a *App) CreateSwarmConfig(name string, data string, labels map[string]string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	return docker.CreateSwarmConfig(a.ctx, cli, name, []byte(data), labels)
}

// CloneSwarmConfig creates a new config with the same data/labels as an existing config.
func (a *App) CloneSwarmConfig(configID string, newName string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	info, err := docker.GetSwarmConfig(a.ctx, cli, configID)
	if err != nil {
		return "", err
	}
	data, err := docker.GetSwarmConfigData(a.ctx, cli, configID)
	if err != nil {
		return "", err
	}
	labels := info.Labels
	if labels == nil {
		labels = make(map[string]string)
	}
	return docker.CreateSwarmConfig(a.ctx, cli, newName, data, labels)
}

// GetSwarmConfigUsage returns services that reference the given Swarm config.
func (a *App) GetSwarmConfigUsage(configID string) ([]docker.SwarmServiceRef, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmConfigUsage(a.ctx, cli, configID)
}

// UpdateSwarmConfigData performs a config "edit" by creating a new timestamp-suffixed config,
// migrating all services that reference the old config, and then deleting the old config.
func (a *App) UpdateSwarmConfigData(configID string, newData string) (*docker.SwarmConfigUpdateResult, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.UpdateSwarmConfigDataImmutable(a.ctx, cli, configID, []byte(newData))
}

// RemoveSwarmConfig removes a Swarm config
func (a *App) RemoveSwarmConfig(configID string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.RemoveSwarmConfig(a.ctx, cli, configID)
}

// ==================== Swarm Secrets ====================

// GetSwarmSecrets returns all Swarm secrets (metadata only)
func (a *App) GetSwarmSecrets() ([]docker.SwarmSecretInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmSecrets(a.ctx, cli)
}

// GetSwarmSecret returns a specific Swarm secret (metadata only)
func (a *App) GetSwarmSecret(secretID string) (*docker.SwarmSecretInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmSecret(a.ctx, cli, secretID)
}

// GetSwarmSecretInspectJSON returns Docker's secret inspect payload as indented JSON.
func (a *App) GetSwarmSecretInspectJSON(secretID string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	return docker.GetSwarmSecretInspectJSON(a.ctx, cli, secretID)
}

// CreateSwarmSecret creates a new Swarm secret
func (a *App) CreateSwarmSecret(name string, data string, labels map[string]string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	// Decode base64 data if it looks like base64, otherwise use as-is
	decodedData, err := base64.StdEncoding.DecodeString(data)
	if err != nil {
		// Not base64, use as plain text
		decodedData = []byte(data)
	}
	return docker.CreateSwarmSecret(a.ctx, cli, name, decodedData, labels)
}

// CloneSwarmSecret creates a new secret with the same labels/driver metadata as the source secret.
// Note: Swarm secret values cannot be read back; caller must provide the new value.
func (a *App) CloneSwarmSecret(sourceSecretID string, newName string, newValue string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	info, err := docker.GetSwarmSecret(a.ctx, cli, sourceSecretID)
	if err != nil {
		return "", err
	}
	labels := info.Labels
	if labels == nil {
		labels = make(map[string]string)
	}
	decodedData, err := base64.StdEncoding.DecodeString(newValue)
	if err != nil {
		decodedData = []byte(newValue)
	}
	return docker.CreateSwarmSecret(a.ctx, cli, newName, decodedData, labels)
}

// GetSwarmSecretUsage returns services that reference the given Swarm secret.
func (a *App) GetSwarmSecretUsage(secretID string) ([]docker.SwarmServiceRef, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmSecretUsage(a.ctx, cli, secretID)
}

// UpdateSwarmSecretData performs a secret "edit" by creating a new timestamp-suffixed secret,
// migrating all services that reference the old secret, and then deleting the old secret.
func (a *App) UpdateSwarmSecretData(secretID string, newData string) (*docker.SwarmSecretUpdateResult, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	decodedData, err := base64.StdEncoding.DecodeString(newData)
	if err != nil {
		decodedData = []byte(newData)
	}
	return docker.UpdateSwarmSecretDataImmutable(a.ctx, cli, secretID, decodedData)
}

// RemoveSwarmSecret removes a Swarm secret
func (a *App) RemoveSwarmSecret(secretID string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.RemoveSwarmSecret(a.ctx, cli, secretID)
}

// ==================== Swarm Stacks ====================

// GetSwarmStacks returns all Docker Stacks
func (a *App) GetSwarmStacks() ([]docker.SwarmStackInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmStacks(a.ctx, cli)
}

// GetSwarmStackServices returns all services belonging to a specific stack
func (a *App) GetSwarmStackServices(stackName string) ([]docker.SwarmServiceInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmStackServices(a.ctx, cli, stackName)
}

// GetSwarmStackResources returns stack-related networks/volumes/configs/secrets.
func (a *App) GetSwarmStackResources(stackName string) (*docker.SwarmStackResources, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmStackResources(a.ctx, cli, stackName)
}

// GetSwarmStackComposeYAML returns a derived docker-compose YAML generated from current service specs.
func (a *App) GetSwarmStackComposeYAML(stackName string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	return docker.GetSwarmStackComposeYAML(a.ctx, cli, stackName)
}

// RollbackSwarmStack rolls back all services in a stack (best-effort).
func (a *App) RollbackSwarmStack(stackName string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.RollbackSwarmStack(a.ctx, cli, stackName)
}

// RemoveSwarmStack removes a Docker Stack
func (a *App) RemoveSwarmStack(stackName string) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.RemoveSwarmStack(a.ctx, cli, stackName)
}

// CreateSwarmStack deploys a stack from a docker-compose YAML.
func (a *App) CreateSwarmStack(stackName string, composeYAML string) (string, error) {
	// Stack deploy is CLI-based.
	if err := docker.DeploySwarmStack(a.ctx, stackName, composeYAML); err != nil {
		return "", err
	}
	return stackName, nil
}

// ==================== Swarm Volumes ====================

// GetSwarmVolumes returns all Docker volumes
func (a *App) GetSwarmVolumes() ([]docker.SwarmVolumeInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmVolumes(a.ctx, cli)
}

// GetSwarmVolume returns a specific volume
func (a *App) GetSwarmVolume(volumeName string) (*docker.SwarmVolumeInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmVolume(a.ctx, cli, volumeName)
}

// GetVolumeInfo returns volume information (alias of GetSwarmVolume).
func (a *App) GetVolumeInfo(volumeName string) (*docker.SwarmVolumeInfo, error) {
	return a.GetSwarmVolume(volumeName)
}

// GetSwarmVolumeInspectJSON returns Docker's volume inspect payload as indented JSON.
func (a *App) GetSwarmVolumeInspectJSON(volumeName string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	return docker.GetSwarmVolumeInspectJSON(a.ctx, cli, volumeName)
}

// GetSwarmVolumeUsage returns services that reference the given volume.
func (a *App) GetSwarmVolumeUsage(volumeName string) ([]docker.SwarmServiceRef, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.GetSwarmVolumeUsage(a.ctx, cli, volumeName)
}

// RemoveSwarmVolume removes a Docker volume
func (a *App) RemoveSwarmVolume(volumeName string, force bool) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}
	return docker.RemoveSwarmVolume(a.ctx, cli, volumeName, force)
}

// CreateSwarmVolume creates a new Docker volume
func (a *App) CreateSwarmVolume(name string, driver string, labels map[string]string, driverOpts map[string]string) (*docker.SwarmVolumeInfo, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	return docker.CreateSwarmVolume(a.ctx, cli, name, driver, labels, driverOpts)
}

// PruneSwarmVolumes removes all unused volumes
func (a *App) PruneSwarmVolumes() (*docker.PruneSwarmVolumesResult, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}
	deleted, reclaimed, err := docker.PruneSwarmVolumes(a.ctx, cli)
	if err != nil {
		return nil, err
	}
	return &docker.PruneSwarmVolumesResult{VolumesDeleted: deleted, SpaceReclaimed: reclaimed}, nil
}

// ==================== Swarm Logs ====================

// GetSwarmServiceLogs returns logs from a Swarm service
func (a *App) GetSwarmServiceLogs(serviceID string, tail string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	reader, err := docker.GetServiceLogs(a.ctx, cli, serviceID, tail, false)
	if err != nil {
		return "", err
	}
	defer reader.Close()

	logs, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	return string(logs), nil
}

// GetSwarmTaskLogs returns logs from a Swarm task
func (a *App) GetSwarmTaskLogs(taskID string, tail string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	reader, err := docker.GetTaskLogs(a.ctx, cli, taskID, tail, false)
	if err != nil {
		return "", err
	}
	defer reader.Close()

	logs, err := io.ReadAll(reader)
	if err != nil {
		return "", err
	}

	return string(logs), nil
}

// ==================== Swarm Resource Counts ====================

// GetSwarmResourceCounts returns counts of all Swarm resources
func (a *App) GetSwarmResourceCounts() (*docker.SwarmResourceCounts, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, err
	}

	counts := &docker.SwarmResourceCounts{}

	// Get services count
	services, err := docker.GetSwarmServices(a.ctx, cli)
	if err == nil {
		counts.Services = len(services)
	}

	// Get tasks count
	tasks, err := docker.GetSwarmTasks(a.ctx, cli)
	if err == nil {
		counts.Tasks = len(tasks)
	}

	// Get nodes count
	nodes, err := docker.GetSwarmNodes(a.ctx, cli)
	if err == nil {
		counts.Nodes = len(nodes)
	}

	// Get networks count
	networks, err := docker.GetSwarmNetworks(a.ctx, cli)
	if err == nil {
		counts.Networks = len(networks)
	}

	// Get configs count
	configs, err := docker.GetSwarmConfigs(a.ctx, cli)
	if err == nil {
		counts.Configs = len(configs)
	}

	// Get secrets count
	secrets, err := docker.GetSwarmSecrets(a.ctx, cli)
	if err == nil {
		counts.Secrets = len(secrets)
	}

	// Get stacks count
	stacks, err := docker.GetSwarmStacks(a.ctx, cli)
	if err == nil {
		counts.Stacks = len(stacks)
	}

	// Get volumes count
	volumes, err := docker.GetSwarmVolumes(a.ctx, cli)
	if err == nil {
		counts.Volumes = len(volumes)
	}

	return counts, nil
}

// ==================== Polling ====================

// StartSwarmServicePolling emits swarm:services:update events
func (a *App) StartSwarmServicePolling() {
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil {
				continue
			}
			cli, err := a.getDockerClient()
			if err != nil {
				continue
			}
			services, err := docker.GetSwarmServices(a.ctx, cli)
			if err != nil {
				continue
			}
			emitEvent(a.ctx, "swarm:services:update", services)
		}
	}()
}

// StartSwarmTaskPolling emits swarm:tasks:update events
func (a *App) StartSwarmTaskPolling() {
	go func() {
		for {
			time.Sleep(time.Second)
			if a.ctx == nil {
				continue
			}
			cli, err := a.getDockerClient()
			if err != nil {
				continue
			}
			tasks, err := docker.GetSwarmTasks(a.ctx, cli)
			if err != nil {
				continue
			}
			emitEvent(a.ctx, "swarm:tasks:update", tasks)
		}
	}()
}

// StartSwarmNodePolling emits swarm:nodes:update events
func (a *App) StartSwarmNodePolling() {
	go func() {
		for {
			time.Sleep(5 * time.Second) // Nodes change less frequently
			if a.ctx == nil {
				continue
			}
			cli, err := a.getDockerClient()
			if err != nil {
				continue
			}
			nodes, err := docker.GetSwarmNodes(a.ctx, cli)
			if err != nil {
				continue
			}
			emitEvent(a.ctx, "swarm:nodes:update", nodes)
		}
	}()
}

// StartSwarmResourceCountsPolling emits swarm:resourcecounts:update events
func (a *App) StartSwarmResourceCountsPolling() {
	go func() {
		for {
			time.Sleep(2 * time.Second)
			if a.ctx == nil {
				continue
			}
			counts, err := a.GetSwarmResourceCounts()
			if err != nil {
				// Only log on first failure to avoid spam
				continue
			}
			emitEvent(a.ctx, "swarm:resourcecounts:update", counts)
		}
	}()
}

// ==================== Docker Configuration Persistence ====================

// DockerAppConfig holds Docker-specific configuration
type DockerAppConfig struct {
	Host       string `json:"host"`
	TLSEnabled bool   `json:"tlsEnabled"`
	TLSCert    string `json:"tlsCert"`
	TLSKey     string `json:"tlsKey"`
	TLSCA      string `json:"tlsCA"`
	TLSVerify  bool   `json:"tlsVerify"`
}

// saveDockerConfig saves Docker configuration to disk
func (a *App) saveDockerConfig(config docker.DockerConfig) error {
	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}

	configPath := filepath.Join(home, "KubeDevBench", "docker-config.json")

	dockerCfg := DockerAppConfig{
		Host:       config.Host,
		TLSEnabled: config.TLSEnabled,
		TLSCert:    config.TLSCert,
		TLSKey:     config.TLSKey,
		TLSCA:      config.TLSCA,
		TLSVerify:  config.TLSVerify,
	}

	data, err := json.MarshalIndent(dockerCfg, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

// loadDockerConfig loads Docker configuration from disk
func (a *App) loadDockerConfig() (*docker.DockerConfig, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, err
	}

	configPath := filepath.Join(home, "KubeDevBench", "docker-config.json")

	data, err := os.ReadFile(configPath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil // No config file yet
		}
		return nil, err
	}

	var dockerCfg DockerAppConfig
	if err := json.Unmarshal(data, &dockerCfg); err != nil {
		return nil, err
	}

	return &docker.DockerConfig{
		Host:       dockerCfg.Host,
		TLSEnabled: dockerCfg.TLSEnabled,
		TLSCert:    dockerCfg.TLSCert,
		TLSKey:     dockerCfg.TLSKey,
		TLSCA:      dockerCfg.TLSCA,
		TLSVerify:  dockerCfg.TLSVerify,
	}, nil
}

// GetDockerConfig returns the saved Docker configuration
func (a *App) GetDockerConfig() (*docker.DockerConfig, error) {
	return a.loadDockerConfig()
}

// AutoConnectDocker attempts to connect to Docker using saved configuration
func (a *App) AutoConnectDocker() (*docker.DockerConnectionStatus, error) {
	config, err := a.loadDockerConfig()
	if err != nil {
		return nil, err
	}
	if config == nil {
		// Try default local socket
		config = &docker.DockerConfig{
			Host: docker.DefaultDockerHost(),
		}
	}
	return a.ConnectToDocker(*config)
}

// startupDocker is called during app startup to attempt Docker connection
func (a *App) startupDocker(ctx context.Context) {
	// Try to auto-connect to Docker (don't fail if it doesn't work)
	_, _ = a.AutoConnectDocker()

	// Start polling goroutines
	a.StartSwarmServicePolling()
	a.StartSwarmTaskPolling()
	a.StartSwarmNodePolling()
	a.StartSwarmResourceCountsPolling()
	a.StartSwarmImageUpdatePolling()
	a.StartSwarmMetricsPolling()
}

// GetSwarmMetricsHistory returns the in-memory Swarm metrics time series.
func (a *App) GetSwarmMetricsHistory() ([]docker.SwarmMetricsPoint, error) {
	return docker.GetSwarmMetricsHistory(), nil
}

// StartSwarmMetricsPolling emits swarm:metrics:update events.
func (a *App) StartSwarmMetricsPolling() {
	go func() {
		for {
			time.Sleep(5 * time.Second)
			if a.ctx == nil {
				continue
			}
			cli, err := a.getDockerClient()
			if err != nil {
				continue
			}
			p, breakdown, err := docker.CollectSwarmMetricsWithBreakdown(a.ctx, cli)
			if err != nil {
				continue
			}
			emitEvent(a.ctx, "swarm:metrics:update", p)
			if len(breakdown.Services) > 0 || len(breakdown.Nodes) > 0 {
				emitEvent(a.ctx, "swarm:metrics:breakdown", breakdown)
			}
		}
	}()
}

// GetImageUpdateSettings returns the saved image update checker settings.
func (a *App) GetImageUpdateSettings() (docker.ImageUpdateSettings, error) {
	return docker.LoadImageUpdateSettings()
}

// SetImageUpdateSettings persists image update checker settings.
func (a *App) SetImageUpdateSettings(settings docker.ImageUpdateSettings) error {
	return docker.SaveImageUpdateSettings(settings)
}

// GetSwarmEvents retrieves recent Docker Swarm events
func (a *App) GetSwarmEvents(sinceMinutes int) ([]docker.SwarmEvent, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, fmt.Errorf("failed to get docker client: %w", err)
	}
	duration := time.Duration(sinceMinutes) * time.Minute
	if duration <= 0 {
		duration = 30 * time.Minute // default to last 30 minutes
	}
	return docker.GetRecentEvents(ctx, cli, duration)
}

// GetSwarmServiceEvents retrieves events for a specific Swarm service
func (a *App) GetSwarmServiceEvents(serviceID string, sinceMinutes int) ([]docker.SwarmEvent, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	cli, err := a.getDockerClient()
	if err != nil {
		return nil, fmt.Errorf("failed to get docker client: %w", err)
	}
	duration := time.Duration(sinceMinutes) * time.Minute
	if duration <= 0 {
		duration = 60 * time.Minute // default to last hour
	}
	return docker.GetSwarmServiceEvents(ctx, cli, serviceID, duration)
}

// StartSwarmImageUpdatePolling periodically checks service images for updates and emits swarm:image:updates.
func (a *App) StartSwarmImageUpdatePolling() {
	go func() {
		for {
			time.Sleep(2 * time.Second)
			if a.ctx == nil {
				continue
			}

			settings, err := docker.LoadImageUpdateSettings()
			if err != nil {
				// If settings are corrupt/unreadable, don't spam.
				time.Sleep(30 * time.Second)
				continue
			}
			if !settings.Enabled {
				time.Sleep(30 * time.Second)
				continue
			}

			cli, err := a.getDockerClient()
			if err != nil {
				time.Sleep(settings.Interval())
				continue
			}

			services, err := cli.ServiceList(a.ctx, types.ServiceListOptions{})
			if err != nil {
				time.Sleep(settings.Interval())
				continue
			}
			ids := make([]string, 0, len(services))
			for _, s := range services {
				if s.ID == "" {
					continue
				}
				ids = append(ids, s.ID)
			}

			updates, _ := docker.CheckSwarmServiceImageUpdates(a.ctx, cli, ids)
			emitEvent(a.ctx, "swarm:image:updates", updates)

			time.Sleep(settings.Interval())
		}
	}()
}
