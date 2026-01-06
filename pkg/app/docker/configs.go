package docker

import (
	"context"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmConfigsClient interface {
	ConfigList(context.Context, types.ConfigListOptions) ([]swarm.Config, error)
	ConfigInspectWithRaw(context.Context, string) (swarm.Config, []byte, error)
	ConfigCreate(context.Context, swarm.ConfigSpec) (types.ConfigCreateResponse, error)
	ConfigUpdate(context.Context, string, swarm.Version, swarm.ConfigSpec) error
	ConfigRemove(context.Context, string) error
}

// GetSwarmConfigs returns all Swarm configs
func GetSwarmConfigs(ctx context.Context, cli *client.Client) ([]SwarmConfigInfo, error) {
	return getSwarmConfigs(ctx, cli)
}

func getSwarmConfigs(ctx context.Context, cli swarmConfigsClient) ([]SwarmConfigInfo, error) {
	configs, err := cli.ConfigList(ctx, types.ConfigListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]SwarmConfigInfo, 0, len(configs))
	for _, cfg := range configs {
		info := configToInfo(cfg)
		result = append(result, info)
	}

	return result, nil
}

// GetSwarmConfig returns a specific Swarm config by ID or name
func GetSwarmConfig(ctx context.Context, cli *client.Client, configID string) (*SwarmConfigInfo, error) {
	return getSwarmConfig(ctx, cli, configID)
}

func getSwarmConfig(ctx context.Context, cli swarmConfigsClient, configID string) (*SwarmConfigInfo, error) {
	cfg, _, err := cli.ConfigInspectWithRaw(ctx, configID)
	if err != nil {
		return nil, err
	}

	info := configToInfo(cfg)
	return &info, nil
}

// GetSwarmConfigData returns the data content of a Swarm config
func GetSwarmConfigData(ctx context.Context, cli *client.Client, configID string) ([]byte, error) {
	return getSwarmConfigData(ctx, cli, configID)
}

func getSwarmConfigData(ctx context.Context, cli swarmConfigsClient, configID string) ([]byte, error) {
	cfg, _, err := cli.ConfigInspectWithRaw(ctx, configID)
	if err != nil {
		return nil, err
	}
	return cfg.Spec.Data, nil
}

// configToInfo converts a swarm.Config to SwarmConfigInfo
func configToInfo(cfg swarm.Config) SwarmConfigInfo {
	info := SwarmConfigInfo{
		ID:        cfg.ID,
		Name:      cfg.Spec.Name,
		CreatedAt: cfg.CreatedAt.Format(time.RFC3339),
		UpdatedAt: cfg.UpdatedAt.Format(time.RFC3339),
		DataSize:  len(cfg.Spec.Data),
		Labels:    cfg.Spec.Labels,
	}

	if info.Labels == nil {
		info.Labels = make(map[string]string)
	}

	return info
}

// CreateSwarmConfig creates a new Swarm config
func CreateSwarmConfig(ctx context.Context, cli *client.Client, name string, data []byte, labels map[string]string) (string, error) {
	return createSwarmConfig(ctx, cli, name, data, labels)
}

func createSwarmConfig(ctx context.Context, cli swarmConfigsClient, name string, data []byte, labels map[string]string) (string, error) {
	spec := swarm.ConfigSpec{
		Annotations: swarm.Annotations{
			Name:   name,
			Labels: labels,
		},
		Data: data,
	}

	resp, err := cli.ConfigCreate(ctx, spec)
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}

// UpdateSwarmConfig updates a Swarm config (note: configs are immutable, this creates a new version)
func UpdateSwarmConfig(ctx context.Context, cli *client.Client, configID string, newData []byte) error {
	return updateSwarmConfig(ctx, cli, configID, newData)
}

func updateSwarmConfig(ctx context.Context, cli swarmConfigsClient, configID string, newData []byte) error {
	// Get the current config
	cfg, _, err := cli.ConfigInspectWithRaw(ctx, configID)
	if err != nil {
		return err
	}

	// Update the config spec
	cfg.Spec.Data = newData

	return cli.ConfigUpdate(ctx, configID, cfg.Version, cfg.Spec)
}

// RemoveSwarmConfig removes a Swarm config
func RemoveSwarmConfig(ctx context.Context, cli *client.Client, configID string) error {
	return removeSwarmConfig(ctx, cli, configID)
}

func removeSwarmConfig(ctx context.Context, cli swarmConfigsClient, configID string) error {
	return cli.ConfigRemove(ctx, configID)
}
