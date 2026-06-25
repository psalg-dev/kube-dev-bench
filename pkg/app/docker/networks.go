package docker

import (
	"context"
	"net/netip"

	"github.com/moby/moby/api/types/network"
	"github.com/moby/moby/client"
)

type swarmNetworksClient interface {
	NetworkList(context.Context, client.NetworkListOptions) (client.NetworkListResult, error)
	NetworkInspect(context.Context, string, client.NetworkInspectOptions) (client.NetworkInspectResult, error)
	NetworkCreate(context.Context, string, client.NetworkCreateOptions) (client.NetworkCreateResult, error)
	NetworkRemove(context.Context, string, client.NetworkRemoveOptions) (client.NetworkRemoveResult, error)
	NetworkPrune(context.Context, client.NetworkPruneOptions) (client.NetworkPruneResult, error)
}

func buildNetworkCreateOptions(driver string, opts CreateNetworkOptions) client.NetworkCreateOptions {
	createOpts := client.NetworkCreateOptions{
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
				Subnet: netip.MustParsePrefix(opts.Subnet),
			}
			if opts.Gateway != "" {
				config.Gateway = netip.MustParseAddr(opts.Gateway)
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
	listResult, err := cli.NetworkList(ctx, client.NetworkListOptions{})
	if err != nil {
		return nil, err
	}
	networks := listResult.Items

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
	inspectResult, err := cli.NetworkInspect(ctx, networkID, client.NetworkInspectOptions{})
	if err != nil {
		return nil, err
	}
	net := inspectResult.Network

	info := networkResourceToInfo(net)
	return &info, nil
}

// networkToInfo converts a network.Summary to SwarmNetworkInfo (from list)
func networkToInfo(net network.Summary) SwarmNetworkInfo {
	info := SwarmNetworkInfo{
		ID:         net.ID,
		Name:       net.Name,
		Driver:     net.Driver,
		Scope:      net.Scope,
		Attachable: net.Attachable,
		Internal:   net.Internal,
		Labels:     net.Labels,
		Options:    net.Options,
		CreatedAt:  net.Created.Format("2006-01-02T15:04:05Z07:00"),
	}

	if info.Options == nil {
		info.Options = make(map[string]string)
	}

	if info.Labels == nil {
		info.Labels = make(map[string]string)
	}

	return info
}

// networkResourceToInfo converts a network.Inspect to SwarmNetworkInfo
func networkResourceToInfo(net network.Inspect) SwarmNetworkInfo {
	info := SwarmNetworkInfo{
		ID:         net.ID,
		Name:       net.Name,
		Driver:     net.Driver,
		Scope:      net.Scope,
		Attachable: net.Attachable,
		Internal:   net.Internal,
		Labels:     net.Labels,
		Options:    net.Options,
		CreatedAt:  net.Created.Format("2006-01-02T15:04:05Z07:00"),
	}

	if info.Options == nil {
		info.Options = make(map[string]string)
	}

	if len(net.IPAM.Config) > 0 {
		for _, cfg := range net.IPAM.Config {
			info.IPAM = append(info.IPAM, SwarmNetworkIPAMConfig{
				Subnet:       cfg.Subnet.String(),
				Gateway:      cfg.Gateway.String(),
				IPRange:      cfg.IPRange.String(),
				AuxAddresses: map[string]string{},
			})
		}
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
	_, err := cli.NetworkRemove(ctx, networkID, client.NetworkRemoveOptions{})
	return err
}

// PruneSwarmNetworks removes all unused networks
func PruneSwarmNetworks(ctx context.Context, cli *client.Client) ([]string, error) {
	return pruneSwarmNetworks(ctx, cli)
}

func pruneSwarmNetworks(ctx context.Context, cli swarmNetworksClient) ([]string, error) {
	result, err := cli.NetworkPrune(ctx, client.NetworkPruneOptions{})
	if err != nil {
		return nil, err
	}
	return result.Report.NetworksDeleted, nil
}
