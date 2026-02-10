package docker

import (
	"context"

	"github.com/docker/docker/client"
)

// SwarmStackResources groups resources related to a stack.
// Note: Volumes are best-effort because Docker doesn't consistently label them with stack namespace.
type SwarmStackResources struct {
	Networks []SwarmNetworkInfo `json:"networks"`
	Volumes  []SwarmVolumeInfo  `json:"volumes"`
	Configs  []SwarmConfigInfo  `json:"configs"`
	Secrets  []SwarmSecretInfo  `json:"secrets"`
}

// filterNetworksByStack filters networks by stack namespace label
func filterNetworksByStack(nets []SwarmNetworkInfo, stackName string) []SwarmNetworkInfo {
	var result []SwarmNetworkInfo
	for _, n := range nets {
		if n.Labels["com.docker.stack.namespace"] == stackName {
			result = append(result, n)
		}
	}
	return result
}

// filterConfigsByStack filters configs by stack namespace label
func filterConfigsByStack(configs []SwarmConfigInfo, stackName string) []SwarmConfigInfo {
	var result []SwarmConfigInfo
	for _, c := range configs {
		if c.Labels["com.docker.stack.namespace"] == stackName {
			result = append(result, c)
		}
	}
	return result
}

// filterSecretsByStack filters secrets by stack namespace label
func filterSecretsByStack(secrets []SwarmSecretInfo, stackName string) []SwarmSecretInfo {
	var result []SwarmSecretInfo
	for _, s := range secrets {
		if s.Labels["com.docker.stack.namespace"] == stackName {
			result = append(result, s)
		}
	}
	return result
}

// filterVolumesByStack filters volumes by stack label or name prefix
func filterVolumesByStack(vols []SwarmVolumeInfo, stackName string) []SwarmVolumeInfo {
	var result []SwarmVolumeInfo
	prefix := stackName + "_"
	for _, v := range vols {
		if v.Labels["com.docker.stack.namespace"] == stackName {
			result = append(result, v)
			continue
		}
		if len(v.Name) >= len(prefix) && v.Name[:len(prefix)] == prefix {
			result = append(result, v)
		}
	}
	return result
}

// GetSwarmStackResources returns stack-related networks/configs/secrets/volumes.
// Networks/configs/secrets are identified via the com.docker.stack.namespace label.
// Volumes are best-effort: label match OR name prefix "<stack>_".
func GetSwarmStackResources(ctx context.Context, cli *client.Client, stackName string) (*SwarmStackResources, error) {
	resources := &SwarmStackResources{}

	if nets, err := GetSwarmNetworks(ctx, cli); err == nil {
		resources.Networks = filterNetworksByStack(nets, stackName)
	}

	if configs, err := GetSwarmConfigs(ctx, cli); err == nil {
		resources.Configs = filterConfigsByStack(configs, stackName)
	}

	if secrets, err := GetSwarmSecrets(ctx, cli); err == nil {
		resources.Secrets = filterSecretsByStack(secrets, stackName)
	}

	if vols, err := GetSwarmVolumes(ctx, cli); err == nil {
		resources.Volumes = filterVolumesByStack(vols, stackName)
	}

	return resources, nil
}
