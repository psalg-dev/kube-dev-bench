package docker

import (
	"context"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmNodesClient interface {
	NodeList(context.Context, types.NodeListOptions) ([]swarm.Node, error)
	NodeInspectWithRaw(context.Context, string) (swarm.Node, []byte, error)
	NodeUpdate(context.Context, string, swarm.Version, swarm.NodeSpec) error
	NodeRemove(context.Context, string, types.NodeRemoveOptions) error
	TaskList(context.Context, types.TaskListOptions) ([]swarm.Task, error)
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
}

// GetSwarmNodes returns all Swarm nodes
func GetSwarmNodes(ctx context.Context, cli *client.Client) ([]SwarmNodeInfo, error) {
	return getSwarmNodes(ctx, cli)
}

func getSwarmNodes(ctx context.Context, cli swarmNodesClient) ([]SwarmNodeInfo, error) {
	nodes, err := cli.NodeList(ctx, types.NodeListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]SwarmNodeInfo, 0, len(nodes))
	for _, node := range nodes {
		info := nodeToInfo(node)
		result = append(result, info)
	}

	return result, nil
}

// GetSwarmNode returns a specific Swarm node by ID
func GetSwarmNode(ctx context.Context, cli *client.Client, nodeID string) (*SwarmNodeInfo, error) {
	return getSwarmNode(ctx, cli, nodeID)
}

func getSwarmNode(ctx context.Context, cli swarmNodesClient, nodeID string) (*SwarmNodeInfo, error) {
	node, _, err := cli.NodeInspectWithRaw(ctx, nodeID)
	if err != nil {
		return nil, err
	}

	info := nodeToInfo(node)
	return &info, nil
}

// nodeToInfo converts a swarm.Node to SwarmNodeInfo
func nodeToInfo(node swarm.Node) SwarmNodeInfo {
	info := SwarmNodeInfo{
		ID:            node.ID,
		Hostname:      node.Description.Hostname,
		Role:          string(node.Spec.Role),
		Availability:  string(node.Spec.Availability),
		State:         string(node.Status.State),
		Address:       node.Status.Addr,
		EngineVersion: node.Description.Engine.EngineVersion,
		Labels:        node.Spec.Labels,
		Leader:        node.ManagerStatus != nil && node.ManagerStatus.Leader,
	}

	if info.Labels == nil {
		info.Labels = make(map[string]string)
	}

	return info
}

// UpdateSwarmNodeAvailability updates a node's availability (active, pause, drain)
func UpdateSwarmNodeAvailability(ctx context.Context, cli *client.Client, nodeID string, availability string) error {
	return updateSwarmNodeAvailability(ctx, cli, nodeID, availability)
}

func updateSwarmNodeAvailability(ctx context.Context, cli swarmNodesClient, nodeID string, availability string) error {
	node, _, err := cli.NodeInspectWithRaw(ctx, nodeID)
	if err != nil {
		return err
	}

	var avail swarm.NodeAvailability
	switch availability {
	case "active":
		avail = swarm.NodeAvailabilityActive
	case "pause":
		avail = swarm.NodeAvailabilityPause
	case "drain":
		avail = swarm.NodeAvailabilityDrain
	default:
		avail = swarm.NodeAvailability(availability)
	}

	node.Spec.Availability = avail
	return cli.NodeUpdate(ctx, nodeID, node.Version, node.Spec)
}

// UpdateSwarmNodeRole updates a node's role (worker, manager)
func UpdateSwarmNodeRole(ctx context.Context, cli *client.Client, nodeID string, role string) error {
	return updateSwarmNodeRole(ctx, cli, nodeID, role)
}

func updateSwarmNodeRole(ctx context.Context, cli swarmNodesClient, nodeID string, role string) error {
	node, _, err := cli.NodeInspectWithRaw(ctx, nodeID)
	if err != nil {
		return err
	}

	var nodeRole swarm.NodeRole
	switch role {
	case "worker":
		nodeRole = swarm.NodeRoleWorker
	case "manager":
		nodeRole = swarm.NodeRoleManager
	default:
		nodeRole = swarm.NodeRole(role)
	}

	node.Spec.Role = nodeRole
	return cli.NodeUpdate(ctx, nodeID, node.Version, node.Spec)
}

// UpdateSwarmNodeLabels updates a node's labels
func UpdateSwarmNodeLabels(ctx context.Context, cli *client.Client, nodeID string, labels map[string]string) error {
	return updateSwarmNodeLabels(ctx, cli, nodeID, labels)
}

func updateSwarmNodeLabels(ctx context.Context, cli swarmNodesClient, nodeID string, labels map[string]string) error {
	node, _, err := cli.NodeInspectWithRaw(ctx, nodeID)
	if err != nil {
		return err
	}

	node.Spec.Labels = labels
	return cli.NodeUpdate(ctx, nodeID, node.Version, node.Spec)
}

// RemoveSwarmNode removes a node from the swarm
func RemoveSwarmNode(ctx context.Context, cli *client.Client, nodeID string, force bool) error {
	return removeSwarmNode(ctx, cli, nodeID, force)
}

func removeSwarmNode(ctx context.Context, cli swarmNodesClient, nodeID string, force bool) error {
	return cli.NodeRemove(ctx, nodeID, types.NodeRemoveOptions{Force: force})
}

// GetSwarmNodeTasks returns all tasks running on a specific node
func GetSwarmNodeTasks(ctx context.Context, cli *client.Client, nodeID string) ([]SwarmTaskInfo, error) {
	return getSwarmNodeTasks(ctx, cli, nodeID)
}

func getSwarmNodeTasks(ctx context.Context, cli swarmNodesClient, nodeID string) ([]SwarmTaskInfo, error) {
	// Use TaskList with filter for the node
	tasks, err := cli.TaskList(ctx, types.TaskListOptions{Filters: filters.NewArgs(filters.Arg("node", nodeID))})
	if err != nil {
		return nil, err
	}

	// Get services to map service IDs to names
	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	serviceNames := make(map[string]string)
	if err == nil {
		for _, svc := range services {
			serviceNames[svc.ID] = svc.Spec.Name
		}
	}

	// Get nodes to map node IDs to hostnames
	nodes, err := cli.NodeList(ctx, types.NodeListOptions{})
	nodeNames := make(map[string]string)
	if err == nil {
		for _, node := range nodes {
			nodeNames[node.ID] = node.Description.Hostname
		}
	}

	result := make([]SwarmTaskInfo, 0, len(tasks))
	for _, task := range tasks {
		info := taskToInfo(task, serviceNames, nodeNames)
		result = append(result, info)
	}

	return result, nil
}

// formatNodeAge formats the node creation time as an age string
func formatNodeAge(created time.Time) string {
	if created.IsZero() {
		return "-"
	}
	d := time.Since(created)
	if d < 0 {
		d = 0
	}
	days := int(d.Hours() / 24)
	hours := int(d.Hours()) % 24
	minutes := int(d.Minutes()) % 60

	if days > 0 {
		return time.Now().Sub(created).Truncate(time.Hour * 24).String()
	} else if hours > 0 {
		return time.Now().Sub(created).Truncate(time.Hour).String()
	} else if minutes > 0 {
		return time.Now().Sub(created).Truncate(time.Minute).String()
	}
	return time.Now().Sub(created).Truncate(time.Second).String()
}
