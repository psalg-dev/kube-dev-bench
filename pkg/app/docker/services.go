package docker

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmServicesClient interface {
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
	ServiceInspectWithRaw(context.Context, string, types.ServiceInspectOptions) (swarm.Service, []byte, error)
	ServiceCreate(context.Context, swarm.ServiceSpec, types.ServiceCreateOptions) (types.ServiceCreateResponse, error)
	ServiceUpdate(context.Context, string, swarm.Version, swarm.ServiceSpec, types.ServiceUpdateOptions) (types.ServiceUpdateResponse, error)
	ServiceRemove(context.Context, string) error
	TaskList(context.Context, types.TaskListOptions) ([]swarm.Task, error)
}

// CreateServiceOptions holds common options for creating a Swarm service.
// This is intentionally a "convenience" API for the UI, not a full ServiceSpec.
type CreateServiceOptions struct {
	Name     string            `json:"name"`
	Image    string            `json:"image"`
	Mode     string            `json:"mode"`     // "replicated" or "global"
	Replicas uint64            `json:"replicas"` // only for replicated
	Labels   map[string]string `json:"labels"`
	Env      map[string]string `json:"env"`
	Ports    []SwarmPortInfo   `json:"ports"`
}

// CreateSwarmService creates a new Swarm service using Docker API.
func CreateSwarmService(ctx context.Context, cli *client.Client, opts CreateServiceOptions) (string, error) {
	return createSwarmService(ctx, cli, opts)
}

func createSwarmService(ctx context.Context, cli swarmServicesClient, opts CreateServiceOptions) (string, error) {
	name := opts.Name
	image := opts.Image
	if name == "" {
		return "", ErrInvalidServiceName
	}
	if image == "" {
		return "", ErrInvalidServiceImage
	}

	labels := opts.Labels
	if labels == nil {
		labels = map[string]string{}
	}

	env := make([]string, 0, len(opts.Env))
	for k, v := range opts.Env {
		if k == "" {
			continue
		}
		env = append(env, k+"="+v)
	}

	spec := swarm.ServiceSpec{}
	spec.Name = name
	spec.Labels = labels
	spec.TaskTemplate = swarm.TaskSpec{ContainerSpec: &swarm.ContainerSpec{Image: image, Env: env}}

	mode := opts.Mode
	if mode == "" {
		mode = "replicated"
	}
	if mode == "global" {
		spec.Mode = swarm.ServiceMode{Global: &swarm.GlobalService{}}
	} else {
		rep := opts.Replicas
		if rep == 0 {
			rep = 1
		}
		spec.Mode = swarm.ServiceMode{Replicated: &swarm.ReplicatedService{Replicas: &rep}}
	}

	if len(opts.Ports) > 0 {
		ports := make([]swarm.PortConfig, 0, len(opts.Ports))
		for _, p := range opts.Ports {
			proto := swarm.PortConfigProtocolTCP
			if p.Protocol == "udp" {
				proto = swarm.PortConfigProtocolUDP
			}
			publishMode := swarm.PortConfigPublishModeIngress
			if p.PublishMode == "host" {
				publishMode = swarm.PortConfigPublishModeHost
			}
			ports = append(ports, swarm.PortConfig{
				Protocol:      proto,
				TargetPort:    p.TargetPort,
				PublishedPort: p.PublishedPort,
				PublishMode:   publishMode,
			})
		}
		spec.EndpointSpec = &swarm.EndpointSpec{Ports: ports}
	}

	resp, err := cli.ServiceCreate(ctx, spec, types.ServiceCreateOptions{})
	if err != nil {
		return "", err
	}
	return resp.ID, nil
}

// GetSwarmServices returns all Swarm services
func GetSwarmServices(ctx context.Context, cli *client.Client) ([]SwarmServiceInfo, error) {
	return getSwarmServices(ctx, cli)
}

func getSwarmServices(ctx context.Context, cli swarmServicesClient) ([]SwarmServiceInfo, error) {
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
	return getSwarmService(ctx, cli, serviceID)
}

func getSwarmService(ctx context.Context, cli swarmServicesClient, serviceID string) (*SwarmServiceInfo, error) {
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
		if svc.Spec.TaskTemplate.ContainerSpec.Env != nil {
			info.Env = append([]string{}, svc.Spec.TaskTemplate.ContainerSpec.Env...)
		}
		if svc.Spec.TaskTemplate.ContainerSpec.Mounts != nil {
			info.Mounts = mountsToInfo(svc.Spec.TaskTemplate.ContainerSpec.Mounts)
		}
	}

	if svc.Spec.UpdateConfig != nil {
		info.UpdateConfig = &SwarmUpdateConfigInfo{
			Parallelism:     svc.Spec.UpdateConfig.Parallelism,
			Delay:           svc.Spec.UpdateConfig.Delay.String(),
			FailureAction:   string(svc.Spec.UpdateConfig.FailureAction),
			Monitor:         svc.Spec.UpdateConfig.Monitor.String(),
			MaxFailureRatio: float64(svc.Spec.UpdateConfig.MaxFailureRatio),
			Order:           string(svc.Spec.UpdateConfig.Order),
		}
	}

	if svc.Spec.TaskTemplate.Resources != nil {
		info.Resources = &SwarmResourcesInfo{}
		if svc.Spec.TaskTemplate.Resources.Limits != nil {
			info.Resources.Limits = &SwarmResourceLimitsInfo{
				NanoCPUs:    svc.Spec.TaskTemplate.Resources.Limits.NanoCPUs,
				MemoryBytes: svc.Spec.TaskTemplate.Resources.Limits.MemoryBytes,
			}
		}
		if svc.Spec.TaskTemplate.Resources.Reservations != nil {
			info.Resources.Reservations = &SwarmResourceLimitsInfo{
				NanoCPUs:    svc.Spec.TaskTemplate.Resources.Reservations.NanoCPUs,
				MemoryBytes: svc.Spec.TaskTemplate.Resources.Reservations.MemoryBytes,
			}
		}
		if info.Resources.Limits == nil && info.Resources.Reservations == nil {
			info.Resources = nil
		}
	}

	if svc.Spec.TaskTemplate.Placement != nil {
		p := svc.Spec.TaskTemplate.Placement
		out := &SwarmPlacementInfo{
			Constraints: append([]string{}, p.Constraints...),
			MaxReplicas: p.MaxReplicas,
		}
		if len(p.Preferences) > 0 {
			prefs := make([]string, 0, len(p.Preferences))
			for _, pref := range p.Preferences {
				if pref.Spread != nil {
					prefs = append(prefs, fmt.Sprintf("spread:%s", pref.Spread.SpreadDescriptor))
					continue
				}
				prefs = append(prefs, fmt.Sprintf("%+v", pref))
			}
			out.Preferences = prefs
		}
		if len(out.Constraints) == 0 && len(out.Preferences) == 0 && out.MaxReplicas == 0 {
			out = nil
		}
		info.Placement = out
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

	applyCachedImageUpdateFields(info.ID, &info)

	return info
}

func mountsToInfo(mounts []mount.Mount) []SwarmMountInfo {
	if len(mounts) == 0 {
		return nil
	}
	out := make([]SwarmMountInfo, 0, len(mounts))
	for _, m := range mounts {
		out = append(out, SwarmMountInfo{
			Type:     string(m.Type),
			Source:   m.Source,
			Target:   m.Target,
			ReadOnly: m.ReadOnly,
		})
	}
	return out
}

// ScaleSwarmService scales a replicated service to the specified number of replicas
func ScaleSwarmService(ctx context.Context, cli *client.Client, serviceID string, replicas uint64) error {
	return scaleSwarmService(ctx, cli, serviceID, replicas)
}

func scaleSwarmService(ctx context.Context, cli swarmServicesClient, serviceID string, replicas uint64) error {
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
	return removeSwarmService(ctx, cli, serviceID)
}

func removeSwarmService(ctx context.Context, cli swarmServicesClient, serviceID string) error {
	return cli.ServiceRemove(ctx, serviceID)
}

// UpdateSwarmServiceImage updates the image of a Swarm service
func UpdateSwarmServiceImage(ctx context.Context, cli *client.Client, serviceID string, image string) error {
	return updateSwarmServiceImage(ctx, cli, serviceID, image)
}

func updateSwarmServiceImage(ctx context.Context, cli swarmServicesClient, serviceID string, image string) error {
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
	return restartSwarmService(ctx, cli, serviceID)
}

func restartSwarmService(ctx context.Context, cli swarmServicesClient, serviceID string) error {
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, types.ServiceInspectOptions{})
	if err != nil {
		return err
	}

	// Increment ForceUpdate to trigger a rolling restart
	svc.Spec.TaskTemplate.ForceUpdate++

	_, err = cli.ServiceUpdate(ctx, serviceID, svc.Version, svc.Spec, types.ServiceUpdateOptions{})
	return err
}

// RollbackSwarmService performs a best-effort rollback to the previous service specification.
// This mirrors `docker service rollback` behavior when supported by the Docker API.
func RollbackSwarmService(ctx context.Context, cli *client.Client, serviceID string) error {
	return rollbackSwarmService(ctx, cli, serviceID)
}

func rollbackSwarmService(ctx context.Context, cli swarmServicesClient, serviceID string) error {
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, types.ServiceInspectOptions{})
	if err != nil {
		return err
	}

	_, err = cli.ServiceUpdate(ctx, serviceID, svc.Version, svc.Spec, types.ServiceUpdateOptions{Rollback: "previous"})
	return err
}
