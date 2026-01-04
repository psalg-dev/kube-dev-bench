package docker

import (
	"context"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

// GetSwarmServices returns all Swarm services
func GetSwarmServices(ctx context.Context, cli *client.Client) ([]SwarmServiceInfo, error) {
	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return nil, err
	}

	// Get tasks to count running tasks per service
	tasks, err := cli.TaskList(ctx, types.TaskListOptions{})
	if err != nil {
		tasks = []swarm.Task{} // Continue without task counts
	}

	// Count running tasks per service
	runningTasksMap := make(map[string]uint64)
	for _, task := range tasks {
		if task.Status.State == swarm.TaskStateRunning {
			runningTasksMap[task.ServiceID]++
		}
	}

	result := make([]SwarmServiceInfo, 0, len(services))
	for _, svc := range services {
		info := serviceToInfo(svc, runningTasksMap[svc.ID])
		result = append(result, info)
	}

	return result, nil
}

// GetSwarmService returns a specific Swarm service by ID or name
func GetSwarmService(ctx context.Context, cli *client.Client, serviceID string) (*SwarmServiceInfo, error) {
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, types.ServiceInspectOptions{})
	if err != nil {
		return nil, err
	}

	// Get running tasks count for this service
	taskFilter := filters.NewArgs()
	taskFilter.Add("service", serviceID)
	taskFilter.Add("desired-state", "running")
	tasks, err := cli.TaskList(ctx, types.TaskListOptions{Filters: taskFilter})
	runningTasks := uint64(0)
	if err == nil {
		for _, task := range tasks {
			if task.Status.State == swarm.TaskStateRunning {
				runningTasks++
			}
		}
	}

	info := serviceToInfo(svc, runningTasks)
	return &info, nil
}

// serviceToInfo converts a swarm.Service to SwarmServiceInfo
func serviceToInfo(svc swarm.Service, runningTasks uint64) SwarmServiceInfo {
	info := SwarmServiceInfo{
		ID:           svc.ID,
		Name:         svc.Spec.Name,
		RunningTasks: runningTasks,
		Labels:       svc.Spec.Labels,
		CreatedAt:    svc.CreatedAt.Format(time.RFC3339),
		UpdatedAt:    svc.UpdatedAt.Format(time.RFC3339),
	}

	// Get image from container spec
	if svc.Spec.TaskTemplate.ContainerSpec != nil {
		info.Image = svc.Spec.TaskTemplate.ContainerSpec.Image
	}

	// Determine mode and replicas
	if svc.Spec.Mode.Replicated != nil {
		info.Mode = "replicated"
		if svc.Spec.Mode.Replicated.Replicas != nil {
			info.Replicas = *svc.Spec.Mode.Replicated.Replicas
		}
	} else if svc.Spec.Mode.Global != nil {
		info.Mode = "global"
		// For global mode, replicas equals running tasks (one per node)
		info.Replicas = runningTasks
	}

	// Get published ports
	if svc.Endpoint.Ports != nil {
		info.Ports = make([]SwarmPortInfo, 0, len(svc.Endpoint.Ports))
		for _, port := range svc.Endpoint.Ports {
			info.Ports = append(info.Ports, SwarmPortInfo{
				Protocol:      string(port.Protocol),
				TargetPort:    port.TargetPort,
				PublishedPort: port.PublishedPort,
				PublishMode:   string(port.PublishMode),
			})
		}
	}

	if info.Labels == nil {
		info.Labels = make(map[string]string)
	}

	return info
}

// ScaleSwarmService scales a replicated service to the specified number of replicas
func ScaleSwarmService(ctx context.Context, cli *client.Client, serviceID string, replicas uint64) error {
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, types.ServiceInspectOptions{})
	if err != nil {
		return err
	}

	// Only replicated services can be scaled
	if svc.Spec.Mode.Replicated == nil {
		return ErrCannotScaleGlobalService
	}

	// Update the replica count
	svc.Spec.Mode.Replicated.Replicas = &replicas

	_, err = cli.ServiceUpdate(ctx, serviceID, svc.Version, svc.Spec, types.ServiceUpdateOptions{})
	return err
}

// RemoveSwarmService removes a Swarm service
func RemoveSwarmService(ctx context.Context, cli *client.Client, serviceID string) error {
	return cli.ServiceRemove(ctx, serviceID)
}

// UpdateSwarmServiceImage updates the image of a Swarm service
func UpdateSwarmServiceImage(ctx context.Context, cli *client.Client, serviceID string, image string) error {
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, types.ServiceInspectOptions{})
	if err != nil {
		return err
	}

	if svc.Spec.TaskTemplate.ContainerSpec == nil {
		return ErrNoContainerSpec
	}

	svc.Spec.TaskTemplate.ContainerSpec.Image = image
	svc.Spec.TaskTemplate.ForceUpdate++

	_, err = cli.ServiceUpdate(ctx, serviceID, svc.Version, svc.Spec, types.ServiceUpdateOptions{})
	return err
}

// RestartSwarmService forces a rolling restart of a Swarm service
func RestartSwarmService(ctx context.Context, cli *client.Client, serviceID string) error {
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, types.ServiceInspectOptions{})
	if err != nil {
		return err
	}

	// Increment ForceUpdate to trigger a rolling restart
	svc.Spec.TaskTemplate.ForceUpdate++

	_, err = cli.ServiceUpdate(ctx, serviceID, svc.Version, svc.Spec, types.ServiceUpdateOptions{})
	return err
}
