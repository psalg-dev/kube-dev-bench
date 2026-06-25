package docker

import (
	"context"
	"encoding/json"
	"sort"

	"github.com/moby/moby/client"
)

type swarmNetworkConnectionsClient interface {
	ServiceList(context.Context, client.ServiceListOptions) (client.ServiceListResult, error)
	TaskList(context.Context, client.TaskListOptions) (client.TaskListResult, error)
	NodeList(context.Context, client.NodeListOptions) (client.NodeListResult, error)
	NetworkInspect(context.Context, string, client.NetworkInspectOptions) (client.NetworkInspectResult, error)
}

// GetSwarmNetworkServices returns services that attach to the given network.
func GetSwarmNetworkServices(ctx context.Context, cli *client.Client, networkID string) ([]SwarmServiceRef, error) {
	return getSwarmNetworkServices(ctx, cli, networkID)
}

func getSwarmNetworkServices(ctx context.Context, cli swarmNetworkConnectionsClient, networkID string) ([]SwarmServiceRef, error) {
	networkName := networkID
	if netInfo, err := cli.NetworkInspect(ctx, networkID, client.NetworkInspectOptions{}); err == nil {
		if netInfo.Network.Name != "" {
			networkName = netInfo.Network.Name
		}
	}

	svcResult, err := cli.ServiceList(ctx, client.ServiceListOptions{})
	if err != nil {
		return nil, err
	}
	services := svcResult.Items

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
	taskResult, err := cli.TaskList(ctx, client.TaskListOptions{})
	if err != nil {
		return nil, err
	}
	tasks := taskResult.Items

	svcResult, err := cli.ServiceList(ctx, client.ServiceListOptions{})
	serviceNames := make(map[string]string)
	if err == nil {
		for _, svc := range svcResult.Items {
			serviceNames[svc.ID] = svc.Spec.Name
		}
	}

	nodeResult, err := cli.NodeList(ctx, client.NodeListOptions{})
	nodeNames := make(map[string]string)
	if err == nil {
		for _, n := range nodeResult.Items {
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
	net, err := cli.NetworkInspect(ctx, networkID, client.NetworkInspectOptions{})
	if err != nil {
		return "", err
	}
	b, err := json.MarshalIndent(net.Network, "", "  ")
	if err != nil {
		return "", err
	}
	return string(b), nil
}
