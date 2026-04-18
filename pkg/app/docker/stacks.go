package docker

import (
	"context"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmStacksClient interface {
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
	ServiceRemove(context.Context, string) error
	NetworkList(context.Context, network.ListOptions) ([]network.Summary, error)
	NetworkRemove(context.Context, string) error
	ConfigList(context.Context, swarm.ConfigListOptions) ([]swarm.Config, error)
	ConfigRemove(context.Context, string) error
	SecretList(context.Context, swarm.SecretListOptions) ([]swarm.Secret, error)
	SecretRemove(context.Context, string) error
	TaskList(context.Context, swarm.TaskListOptions) ([]swarm.Task, error)
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

// removeStackServices removes all services belonging to the stack
func removeStackServices(ctx context.Context, cli swarmStacksClient, stackName string) error {
	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return err
	}
	for _, svc := range services {
		if svc.Spec.Labels["com.docker.stack.namespace"] == stackName {
			if err := cli.ServiceRemove(ctx, svc.ID); err != nil {
				return err
			}
		}
	}
	return nil
}

// removeStackNetworks removes all networks belonging to the stack (best-effort)
func removeStackNetworks(ctx context.Context, cli swarmStacksClient, stackName string) {
	networks, err := cli.NetworkList(ctx, network.ListOptions{})
	if err != nil {
		return
	}
	for _, net := range networks {
		if net.Labels["com.docker.stack.namespace"] == stackName {
			_ = cli.NetworkRemove(ctx, net.ID)
		}
	}
}

// removeStackConfigs removes all configs belonging to the stack (best-effort)
func removeStackConfigs(ctx context.Context, cli swarmStacksClient, stackName string) {
	configs, err := cli.ConfigList(ctx, swarm.ConfigListOptions{})
	if err != nil {
		return
	}
	for _, cfg := range configs {
		if cfg.Spec.Labels["com.docker.stack.namespace"] == stackName {
			_ = cli.ConfigRemove(ctx, cfg.ID)
		}
	}
}

// removeStackSecrets removes all secrets belonging to the stack (best-effort)
func removeStackSecrets(ctx context.Context, cli swarmStacksClient, stackName string) {
	secrets, err := cli.SecretList(ctx, swarm.SecretListOptions{})
	if err != nil {
		return
	}
	for _, secret := range secrets {
		if secret.Spec.Labels["com.docker.stack.namespace"] == stackName {
			_ = cli.SecretRemove(ctx, secret.ID)
		}
	}
}

func removeSwarmStack(ctx context.Context, cli swarmStacksClient, stackName string) error {
	if err := removeStackServices(ctx, cli, stackName); err != nil {
		return err
	}
	removeStackNetworks(ctx, cli, stackName)
	removeStackConfigs(ctx, cli, stackName)
	removeStackSecrets(ctx, cli, stackName)
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
