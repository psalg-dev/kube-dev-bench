package docker

import (
	"context"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmTasksClient interface {
	TaskList(context.Context, types.TaskListOptions) ([]swarm.Task, error)
	TaskInspectWithRaw(context.Context, string) (swarm.Task, []byte, error)
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
	ServiceInspectWithRaw(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error)
	NodeList(context.Context, types.NodeListOptions) ([]swarm.Node, error)
	NodeInspectWithRaw(context.Context, string) (swarm.Node, []byte, error)
}

// GetSwarmTasks returns all Swarm tasks
func GetSwarmTasks(ctx context.Context, cli *client.Client) ([]SwarmTaskInfo, error) {
	return getSwarmTasks(ctx, cli)
}

func getSwarmTasks(ctx context.Context, cli swarmTasksClient) ([]SwarmTaskInfo, error) {
	tasks, err := cli.TaskList(ctx, types.TaskListOptions{})
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

// GetSwarmTasksByService returns all tasks for a specific service
func GetSwarmTasksByService(ctx context.Context, cli *client.Client, serviceID string) ([]SwarmTaskInfo, error) {
	return getSwarmTasksByService(ctx, cli, serviceID)
}

func getSwarmTasksByService(ctx context.Context, cli swarmTasksClient, serviceID string) ([]SwarmTaskInfo, error) {
	filter := filters.NewArgs()
	filter.Add("service", serviceID)

	tasks, err := cli.TaskList(ctx, types.TaskListOptions{Filters: filter})
	if err != nil {
		return nil, err
	}

	// Get the service name
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, types.ServiceInspectOptions{})
	serviceName := ""
	if err == nil {
		serviceName = svc.Spec.Name
	}
	serviceNames := map[string]string{serviceID: serviceName}

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

// GetSwarmTask returns a specific Swarm task by ID
func GetSwarmTask(ctx context.Context, cli *client.Client, taskID string) (*SwarmTaskInfo, error) {
	return getSwarmTask(ctx, cli, taskID)
}

func getSwarmTask(ctx context.Context, cli swarmTasksClient, taskID string) (*SwarmTaskInfo, error) {
	task, _, err := cli.TaskInspectWithRaw(ctx, taskID)
	if err != nil {
		return nil, err
	}

	// Get service name
	svc, _, err := cli.ServiceInspectWithRaw(ctx, task.ServiceID, types.ServiceInspectOptions{})
	serviceName := ""
	if err == nil {
		serviceName = svc.Spec.Name
	}
	serviceNames := map[string]string{task.ServiceID: serviceName}

	// Get node name
	nodeNames := make(map[string]string)
	if task.NodeID != "" {
		node, _, err := cli.NodeInspectWithRaw(ctx, task.NodeID)
		if err == nil {
			nodeNames[task.NodeID] = node.Description.Hostname
		}
	}

	info := taskToInfo(task, serviceNames, nodeNames)
	return &info, nil
}

// taskToInfo converts a swarm.Task to SwarmTaskInfo
func taskToInfo(task swarm.Task, serviceNames, nodeNames map[string]string) SwarmTaskInfo {
	info := SwarmTaskInfo{
		ID:           task.ID,
		ServiceID:    task.ServiceID,
		ServiceName:  serviceNames[task.ServiceID],
		NodeID:       task.NodeID,
		NodeName:     nodeNames[task.NodeID],
		Slot:         task.Slot,
		State:        string(task.Status.State),
		DesiredState: string(task.DesiredState),
		CreatedAt:    task.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    task.UpdatedAt.Format(time.RFC3339),
	}

	// Get container ID if available
	if task.Status.ContainerStatus != nil {
		info.ContainerID = task.Status.ContainerStatus.ContainerID
	}

	// Get error message if present
	if task.Status.Err != "" {
		info.Error = task.Status.Err
	}

	return info
}
