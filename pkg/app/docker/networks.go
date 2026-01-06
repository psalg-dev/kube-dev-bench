package docker

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
)

type swarmNetworksClient interface {
	NetworkList(context.Context, types.NetworkListOptions) ([]types.NetworkResource, error)
	NetworkInspect(context.Context, string, types.NetworkInspectOptions) (types.NetworkResource, error)
	NetworkCreate(context.Context, string, types.NetworkCreate) (types.NetworkCreateResponse, error)
	NetworkRemove(context.Context, string) error
	NetworksPrune(context.Context, filters.Args) (types.NetworksPruneReport, error)
}

func buildNetworkCreateOptions(driver string, opts CreateNetworkOptions) types.NetworkCreate {
	createOpts := types.NetworkCreate{
		Driver:     driver,
		Scope:      opts.Scope,
		Attachable: opts.Attachable,
		Internal:   opts.Internal,
		Labels:     opts.Labels,
	}

	// For overlay networks, default scope to swarm when not specified.
	if driver == "overlay" {
		if createOpts.Scope == "" {
			createOpts.Scope = "swarm"
		}
	}

	// Configure IPAM if provided
	if opts.Subnet != "" || opts.Gateway != "" {
		ipamConfig := []network.IPAMConfig{}
		if opts.Subnet != "" {
			config := network.IPAMConfig{
				Subnet: opts.Subnet,
			}
			if opts.Gateway != "" {
				config.Gateway = opts.Gateway
			}
			ipamConfig = append(ipamConfig, config)
		}
		createOpts.IPAM = &network.IPAM{
			Config: ipamConfig,
		}
	}

	return createOpts
}

// GetSwarmNetworks returns all Docker networks (including Swarm overlay networks)
func GetSwarmNetworks(ctx context.Context, cli *client.Client) ([]SwarmNetworkInfo, error) {
	return getSwarmNetworks(ctx, cli)
}

func getSwarmNetworks(ctx context.Context, cli swarmNetworksClient) ([]SwarmNetworkInfo, error) {
	networks, err := cli.NetworkList(ctx, types.NetworkListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]SwarmNetworkInfo, 0, len(networks))
	for _, net := range networks {
		info := networkToInfo(net)
		result = append(result, info)
	}

	return result, nil
}

// GetSwarmNetwork returns a specific network by ID or name
func GetSwarmNetwork(ctx context.Context, cli *client.Client, networkID string) (*SwarmNetworkInfo, error) {
	return getSwarmNetwork(ctx, cli, networkID)
}

func getSwarmNetwork(ctx context.Context, cli swarmNetworksClient, networkID string) (*SwarmNetworkInfo, error) {
	net, err := cli.NetworkInspect(ctx, networkID, types.NetworkInspectOptions{})
	if err != nil {
		return nil, err
	}

	info := networkResourceToInfo(net)
	return &info, nil
}

// networkToInfo converts a types.NetworkResource to SwarmNetworkInfo (from list)
func networkToInfo(net types.NetworkResource) SwarmNetworkInfo {
	return networkResourceToInfo(net)
}

// networkResourceToInfo converts a types.NetworkResource to SwarmNetworkInfo
func networkResourceToInfo(net types.NetworkResource) SwarmNetworkInfo {
	info := SwarmNetworkInfo{
		ID:         net.ID,
		Name:       net.Name,
		Driver:     net.Driver,
		Scope:      net.Scope,
		Attachable: net.Attachable,
		Internal:   net.Internal,
		Labels:     net.Labels,
		CreatedAt:  net.Created.Format("2006-01-02T15:04:05Z07:00"),
	}

	if info.Labels == nil {
		info.Labels = make(map[string]string)
	}

	return info
}

// CreateSwarmNetwork creates a new Docker network
func CreateSwarmNetwork(ctx context.Context, cli *client.Client, name string, driver string, opts CreateNetworkOptions) (string, error) {
	return createSwarmNetwork(ctx, cli, name, driver, opts)
}

func createSwarmNetwork(ctx context.Context, cli swarmNetworksClient, name string, driver string, opts CreateNetworkOptions) (string, error) {
	createOpts := buildNetworkCreateOptions(driver, opts)

	resp, err := cli.NetworkCreate(ctx, name, createOpts)
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}

// CreateNetworkOptions holds options for creating a network
type CreateNetworkOptions struct {
	Scope      string            // "swarm" or "local"
	Attachable bool              // Whether containers can attach to this network
	Internal   bool              // Restrict external access
	Labels     map[string]string // Network labels
	Subnet     string            // CIDR subnet (e.g., "10.0.0.0/24")
	Gateway    string            // Gateway IP address
}

// RemoveSwarmNetwork removes a Docker network
func RemoveSwarmNetwork(ctx context.Context, cli *client.Client, networkID string) error {
	return removeSwarmNetwork(ctx, cli, networkID)
}

func removeSwarmNetwork(ctx context.Context, cli swarmNetworksClient, networkID string) error {
	return cli.NetworkRemove(ctx, networkID)
}

// PruneSwarmNetworks removes all unused networks
func PruneSwarmNetworks(ctx context.Context, cli *client.Client) ([]string, error) {
	return pruneSwarmNetworks(ctx, cli)
}

func pruneSwarmNetworks(ctx context.Context, cli swarmNetworksClient) ([]string, error) {
	report, err := cli.NetworksPrune(ctx, filters.Args{})
	if err != nil {
		return nil, err
	}
	return report.NetworksDeleted, nil
}
