package docker

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmStacksClient interface {
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
	ServiceRemove(context.Context, string) error
	NetworkList(context.Context, types.NetworkListOptions) ([]types.NetworkResource, error)
	NetworkRemove(context.Context, string) error
	ConfigList(context.Context, types.ConfigListOptions) ([]swarm.Config, error)
	ConfigRemove(context.Context, string) error
	SecretList(context.Context, types.SecretListOptions) ([]swarm.Secret, error)
	SecretRemove(context.Context, string) error
	TaskList(context.Context, types.TaskListOptions) ([]swarm.Task, error)
}

// GetSwarmStacks returns all Docker Stacks
// Note: Docker Stacks are identified by the com.docker.stack.namespace label
func GetSwarmStacks(ctx context.Context, cli *client.Client) ([]SwarmStackInfo, error) {
	return getSwarmStacks(ctx, cli)
}

func getSwarmStacks(ctx context.Context, cli swarmStacksClient) ([]SwarmStackInfo, error) {
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
	services, err := getSwarmServices(ctx, cli)
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
	return removeSwarmStack(ctx, cli, stackName)
}

func removeSwarmStack(ctx context.Context, cli swarmStacksClient, stackName string) error {
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

// RollbackSwarmStack performs a best-effort rollback of all services in a stack.
// Note: Swarm does not have a native "stack rollback" primitive; this iterates services.
func RollbackSwarmStack(ctx context.Context, cli *client.Client, stackName string) error {
	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return err
	}

	for _, svc := range services {
		if svc.Spec.Labels["com.docker.stack.namespace"] != stackName {
			continue
		}
		if err := RollbackSwarmService(ctx, cli, svc.ID); err != nil {
			return err
		}
	}

	return nil
}
