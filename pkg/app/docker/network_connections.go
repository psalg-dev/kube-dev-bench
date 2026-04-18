package docker

import (
	"context"
	"encoding/json"
	"sort"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/network"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmNetworkConnectionsClient interface {
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
	TaskList(context.Context, types.TaskListOptions) ([]swarm.Task, error)
	NodeList(context.Context, types.NodeListOptions) ([]swarm.Node, error)
	NetworkInspect(context.Context, string, network.InspectOptions) (network.Inspect, error)
}

// GetSwarmNetworkServices returns services that attach to the given network.
func GetSwarmNetworkServices(ctx context.Context, cli *client.Client, networkID string) ([]SwarmServiceRef, error) {
	return getSwarmNetworkServices(ctx, cli, networkID)
}

func getSwarmNetworkServices(ctx context.Context, cli swarmNetworkConnectionsClient, networkID string) ([]SwarmServiceRef, error) {
	networkName := networkID
	if netInfo, err := cli.NetworkInspect(ctx, networkID, network.InspectOptions{}); err == nil {
		if netInfo.Name != "" {
			networkName = netInfo.Name
		}
	}

	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return nil, err
	}

	out := make([]SwarmServiceRef, 0)
	for _, svc := range services {
		attached := false
		for _, n := range svc.Spec.TaskTemplate.Networks {
			if n.Target == networkID || n.Target == networkName {
				attached = true
				break
			}
		}
		if attached {
			out = append(out, SwarmServiceRef{ServiceID: svc.ID, ServiceName: svc.Spec.Name})
		}
	}

	sort.Slice(out, func(i, j int) bool { return out[i].ServiceName < out[j].ServiceName })
	return out, nil
}

// GetSwarmNetworkContainers returns tasks/containers attached to the given network.
// For Swarm, "containers" are represented as tasks.
func GetSwarmNetworkContainers(ctx context.Context, cli *client.Client, networkID string) ([]SwarmTaskInfo, error) {
	return getSwarmNetworkContainers(ctx, cli, networkID)
}

func getSwarmNetworkContainers(ctx context.Context, cli swarmNetworkConnectionsClient, networkID string) ([]SwarmTaskInfo, error) {
	tasks, err := cli.TaskList(ctx, types.TaskListOptions{})
	if err != nil {
		return nil, err
	}

	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	serviceNames := make(map[string]string)
	if err == nil {
		for _, svc := range services {
			serviceNames[svc.ID] = svc.Spec.Name
		}
	}

	nodes, err := cli.NodeList(ctx, types.NodeListOptions{})
	nodeNames := make(map[string]string)
	if err == nil {
		for _, n := range nodes {
			nodeNames[n.ID] = n.Description.Hostname
		}
	}

	out := make([]SwarmTaskInfo, 0)
	for _, task := range tasks {
		attached := false
		for _, na := range task.NetworksAttachments {
			if na.Network.ID == networkID {
				attached = true
				break
			}
		}
		if !attached {
			continue
		}
		out = append(out, taskToInfo(task, serviceNames, nodeNames))
	}

	sort.Slice(out, func(i, j int) bool {
		if out[i].ServiceName != out[j].ServiceName {
			return out[i].ServiceName < out[j].ServiceName
		}
		return out[i].ID < out[j].ID
	})

	return out, nil
}

// GetSwarmNetworkInspectJSON returns the raw Docker network inspect JSON (pretty-printed).
func GetSwarmNetworkInspectJSON(ctx context.Context, cli *client.Client, networkID string) (string, error) {
	return getSwarmNetworkInspectJSON(ctx, cli, networkID)
}

func getSwarmNetworkInspectJSON(ctx context.Context, cli swarmNetworkConnectionsClient, networkID string) (string, error) {
	net, err := cli.NetworkInspect(ctx, networkID, network.InspectOptions{})
	if err != nil {
		return "", err
	}
	b, err := json.MarshalIndent(net, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}
