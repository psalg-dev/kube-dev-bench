package docker

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/client"
)

// GetSwarmStacks returns all Docker Stacks
// Note: Docker Stacks are identified by the com.docker.stack.namespace label
func GetSwarmStacks(ctx context.Context, cli *client.Client) ([]SwarmStackInfo, error) {
	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return nil, err
	}

	// Group services by stack namespace label
	stackMap := make(map[string]int)
	for _, svc := range services {
		if stackName, ok := svc.Spec.Labels["com.docker.stack.namespace"]; ok {
			stackMap[stackName]++
		}
	}

	result := make([]SwarmStackInfo, 0, len(stackMap))
	for name, count := range stackMap {
		result = append(result, SwarmStackInfo{
			Name:         name,
			Services:     count,
			Orchestrator: "Swarm",
		})
	}

	return result, nil
}

// GetSwarmStackServices returns all services belonging to a specific stack
func GetSwarmStackServices(ctx context.Context, cli *client.Client, stackName string) ([]SwarmServiceInfo, error) {
	services, err := GetSwarmServices(ctx, cli)
	if err != nil {
		return nil, err
	}

	// Filter services by stack namespace
	result := make([]SwarmServiceInfo, 0)
	for _, svc := range services {
		if svc.Labels["com.docker.stack.namespace"] == stackName {
			result = append(result, svc)
		}
	}

	return result, nil
}

// RemoveSwarmStack removes all services belonging to a stack
// This mimics `docker stack rm` behavior
func RemoveSwarmStack(ctx context.Context, cli *client.Client, stackName string) error {
	// Get all services in the stack
	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return err
	}

	// Remove each service in the stack
	for _, svc := range services {
		if svc.Spec.Labels["com.docker.stack.namespace"] == stackName {
			if err := cli.ServiceRemove(ctx, svc.ID); err != nil {
				return err
			}
		}
	}

	// Also remove networks created for this stack
	networks, err := cli.NetworkList(ctx, types.NetworkListOptions{})
	if err != nil {
		return nil // Don't fail if we can't list networks
	}

	for _, net := range networks {
		if net.Labels["com.docker.stack.namespace"] == stackName {
			// Ignore errors on network removal (they may still be in use briefly)
			_ = cli.NetworkRemove(ctx, net.ID)
		}
	}

	// Also remove configs created for this stack
	configs, err := cli.ConfigList(ctx, types.ConfigListOptions{})
	if err == nil {
		for _, cfg := range configs {
			if cfg.Spec.Labels["com.docker.stack.namespace"] == stackName {
				_ = cli.ConfigRemove(ctx, cfg.ID)
			}
		}
	}

	// Also remove secrets created for this stack
	secrets, err := cli.SecretList(ctx, types.SecretListOptions{})
	if err == nil {
		for _, secret := range secrets {
			if secret.Spec.Labels["com.docker.stack.namespace"] == stackName {
				_ = cli.SecretRemove(ctx, secret.ID)
			}
		}
	}

	return nil
}
