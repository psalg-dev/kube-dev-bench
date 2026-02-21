package docker

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"net/http"
	"os"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/api/types/system"
	"github.com/docker/docker/client"
)

var newDockerClientWithOpts = client.NewClientWithOpts

type dockerConnectionClient interface {
	Ping(context.Context) (types.Ping, error)
	ServerVersion(context.Context) (types.Version, error)
	SwarmInspect(context.Context) (swarm.Swarm, error)
	Info(context.Context) (system.Info, error)
	Close() error
}

var newDockerConnectionClient = func(config DockerConfig) (dockerConnectionClient, error) {
	return NewClient(config)
}

// DefaultDockerHost returns the platform-specific default Docker host
func DefaultDockerHost() string {
	// Allow explicit overrides (useful for CI/E2E and advanced users).
	// This matches Docker tooling expectations on all platforms.
	if envHost := os.Getenv("DOCKER_HOST"); envHost != "" {
		return envHost
	}

	return platformDefaultDockerHost()
}

// NewClient creates a new Docker client with the specified configuration
func NewClient(config DockerConfig) (*client.Client, error) {
	opts := []client.Opt{
		client.WithAPIVersionNegotiation(),
	}

	// Set the host
	host := config.Host
	if host == "" {
		host = DefaultDockerHost()
	}
	opts = append(opts, client.WithHost(host))

	// Configure TLS if enabled
	if config.TLSEnabled {
		httpClient, err := createTLSHTTPClient(config)
		if err != nil {
			return nil, fmt.Errorf("failed to create TLS client: %w", err)
		}
		opts = append(opts, client.WithHTTPClient(httpClient))
	}

	return newDockerClientWithOpts(opts...)
}

// createTLSHTTPClient creates an HTTP client with TLS configuration
func createTLSHTTPClient(config DockerConfig) (*http.Client, error) {
	tlsConfig := &tls.Config{MinVersion: tls.VersionTLS12}

	// Load client certificate if provided
	if config.TLSCert != "" && config.TLSKey != "" {
		cert, err := tls.LoadX509KeyPair(config.TLSCert, config.TLSKey)
		if err != nil {
			return nil, fmt.Errorf("failed to load client certificate: %w", err)
		}
		tlsConfig.Certificates = []tls.Certificate{cert}
	}

	// Load CA certificate if provided
	if config.TLSCA != "" {
		caCert, err := os.ReadFile(config.TLSCA)
		if err != nil {
			return nil, fmt.Errorf("failed to read CA certificate: %w", err)
		}
		caCertPool := x509.NewCertPool()
		if !caCertPool.AppendCertsFromPEM(caCert) {
			return nil, fmt.Errorf("failed to parse CA certificate")
		}
		tlsConfig.RootCAs = caCertPool
	}

	// Set TLS verification
	tlsConfig.InsecureSkipVerify = !config.TLSVerify

	return &http.Client{
		Transport: &http.Transport{
			TLSClientConfig: tlsConfig,
		},
	}, nil
}

// TestConnection tests the connection to a Docker daemon
func TestConnection(ctx context.Context, config DockerConfig) (*DockerConnectionStatus, error) {
	cli, err := newDockerConnectionClient(config)
	if err != nil {
		return &DockerConnectionStatus{
			Connected: false,
			Error:     err.Error(),
		}, nil
	}
	defer cli.Close()

	// Ping the Docker daemon
	_, err = cli.Ping(ctx)
	if err != nil {
		return &DockerConnectionStatus{
			Connected: false,
			Error:     err.Error(),
		}, nil
	}

	// Get server version
	version, err := cli.ServerVersion(ctx)
	if err != nil {
		return &DockerConnectionStatus{
			Connected:     true,
			ServerVersion: "unknown",
			Error:         fmt.Sprintf("connected but failed to get version: %v", err),
		}, nil
	}

	// Check if Swarm is active
	swarmInfo, err := cli.SwarmInspect(ctx)
	if err != nil {
		// Swarm not active or not a manager node
		return &DockerConnectionStatus{
			Connected:     true,
			SwarmActive:   false,
			ServerVersion: version.Version,
		}, nil
	}

	// Get node info to determine if this is a manager
	info, err := cli.Info(ctx)
	if err != nil {
		return &DockerConnectionStatus{
			Connected:     true,
			SwarmActive:   true,
			ServerVersion: version.Version,
		}, nil
	}

	return &DockerConnectionStatus{
		Connected:     true,
		SwarmActive:   true,
		NodeID:        swarmInfo.ID,
		IsManager:     info.Swarm.ControlAvailable,
		ServerVersion: version.Version,
	}, nil
}

// IsSwarmActive checks if Docker Swarm is active on the connected daemon
func IsSwarmActive(ctx context.Context, cli *client.Client) bool {
	return isSwarmActive(ctx, cli)
}

type dockerSwarmInspector interface {
	SwarmInspect(context.Context) (swarm.Swarm, error)
}

func isSwarmActive(ctx context.Context, cli dockerSwarmInspector) bool {
	_, err := cli.SwarmInspect(ctx)
	return err == nil
}
