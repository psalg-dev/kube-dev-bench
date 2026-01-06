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

// GetSwarmStackResources returns stack-related networks/configs/secrets/volumes.
// Networks/configs/secrets are identified via the com.docker.stack.namespace label.
// Volumes are best-effort: label match OR name prefix "<stack>_".
func GetSwarmStackResources(ctx context.Context, cli *client.Client, stackName string) (*SwarmStackResources, error) {
	resources := &SwarmStackResources{}

	nets, err := GetSwarmNetworks(ctx, cli)
	if err == nil {
		for _, n := range nets {
			if n.Labels["com.docker.stack.namespace"] == stackName {
				resources.Networks = append(resources.Networks, n)
			}
		}
	}

	configs, err := GetSwarmConfigs(ctx, cli)
	if err == nil {
		for _, c := range configs {
			if c.Labels["com.docker.stack.namespace"] == stackName {
				resources.Configs = append(resources.Configs, c)
			}
		}
	}

	secrets, err := GetSwarmSecrets(ctx, cli)
	if err == nil {
		for _, s := range secrets {
			if s.Labels["com.docker.stack.namespace"] == stackName {
				resources.Secrets = append(resources.Secrets, s)
			}
		}
	}

	vols, err := GetSwarmVolumes(ctx, cli)
	if err == nil {
		prefix := stackName + "_"
		for _, v := range vols {
			if v.Labels["com.docker.stack.namespace"] == stackName {
				resources.Volumes = append(resources.Volumes, v)
				continue
			}
			if len(prefix) > 0 && len(v.Name) >= len(prefix) && v.Name[:len(prefix)] == prefix {
				resources.Volumes = append(resources.Volumes, v)
			}
		}
	}

	return resources, nil
}
