package docker

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/client"
)

// GetSwarmNetworks returns all Docker networks (including Swarm overlay networks)
func GetSwarmNetworks(ctx context.Context, cli *client.Client) ([]SwarmNetworkInfo, error) {
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
	createOpts := types.NetworkCreate{
		Driver:     driver,
		Scope:      opts.Scope,
		Attachable: opts.Attachable,
		Internal:   opts.Internal,
		Labels:     opts.Labels,
	}

	// For overlay networks, set appropriate options
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
	return cli.NetworkRemove(ctx, networkID)
}

// PruneSwarmNetworks removes all unused networks
func PruneSwarmNetworks(ctx context.Context, cli *client.Client) ([]string, error) {
	report, err := cli.NetworksPrune(ctx, filters.Args{})
	if err != nil {
		return nil, err
	}
	return report.NetworksDeleted, nil
}
