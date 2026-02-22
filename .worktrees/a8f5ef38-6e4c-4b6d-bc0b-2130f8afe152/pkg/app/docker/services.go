package docker

import (
	"context"
	"fmt"
	"time"

	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmServicesClient interface {
	ServiceList(context.Context, swarm.ServiceListOptions) ([]swarm.Service, error)
	ServiceInspectWithRaw(context.Context, string, swarm.ServiceInspectOptions) (swarm.Service, []byte, error)
	ServiceCreate(context.Context, swarm.ServiceSpec, swarm.ServiceCreateOptions) (swarm.ServiceCreateResponse, error)
	ServiceUpdate(context.Context, string, swarm.Version, swarm.ServiceSpec, swarm.ServiceUpdateOptions) (swarm.ServiceUpdateResponse, error)
	ServiceRemove(context.Context, string) error
	TaskList(context.Context, swarm.TaskListOptions) ([]swarm.Task, error)
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

// buildServiceMode builds the service mode configuration from options.
func buildServiceMode(mode string, replicas uint64) swarm.ServiceMode {
	if mode == "global" {
		return swarm.ServiceMode{Global: &swarm.GlobalService{}}
	}
	rep := replicas
	if rep == 0 {
		rep = 1
	}
	return swarm.ServiceMode{Replicated: &swarm.ReplicatedService{Replicas: &rep}}
}

// buildPortConfigs converts SwarmPortInfo slice to swarm.PortConfig slice.
func buildPortConfigs(ports []SwarmPortInfo) []swarm.PortConfig {
	if len(ports) == 0 {
		return nil
	}
	result := make([]swarm.PortConfig, 0, len(ports))
	for _, p := range ports {
		proto := swarm.PortConfigProtocolTCP
		if p.Protocol == "udp" {
			proto = swarm.PortConfigProtocolUDP
		}
		publishMode := swarm.PortConfigPublishModeIngress
		if p.PublishMode == "host" {
			publishMode = swarm.PortConfigPublishModeHost
		}
		result = append(result, swarm.PortConfig{
			Protocol:      proto,
			TargetPort:    p.TargetPort,
			PublishedPort: p.PublishedPort,
			PublishMode:   publishMode,
		})
	}
	return result
}

func createSwarmService(ctx context.Context, cli swarmServicesClient, opts CreateServiceOptions) (string, error) {
	if opts.Name == "" {
		return "", ErrInvalidServiceName
	}
	if opts.Image == "" {
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

	mode := opts.Mode
	if mode == "" {
		mode = "replicated"
	}

	spec := swarm.ServiceSpec{
		Annotations: swarm.Annotations{Name: opts.Name, Labels: labels},
		TaskTemplate: swarm.TaskSpec{
			ContainerSpec: &swarm.ContainerSpec{Image: opts.Image, Env: env},
		},
		Mode: buildServiceMode(mode, opts.Replicas),
	}

	if portConfigs := buildPortConfigs(opts.Ports); portConfigs != nil {
		spec.EndpointSpec = &swarm.EndpointSpec{Ports: portConfigs}
	}

	resp, err := cli.ServiceCreate(ctx, spec, swarm.ServiceCreateOptions{})
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
	services, err := cli.ServiceList(ctx, swarm.ServiceListOptions{})
	if err != nil {
		return nil, err
	}

	// Get tasks to count running tasks per service
	tasks, err := cli.TaskList(ctx, swarm.TaskListOptions{})
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
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, swarm.ServiceInspectOptions{})
	if err != nil {
		return nil, err
	}

	// Get running tasks count for this service
	taskFilter := filters.NewArgs()
	taskFilter.Add("service", serviceID)
	taskFilter.Add("desired-state", "running")
	tasks, err := cli.TaskList(ctx, swarm.TaskListOptions{Filters: taskFilter})
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

// extractContainerInfo extracts image, env, and mounts from container spec
func extractContainerInfo(svc *swarm.Service, info *SwarmServiceInfo) {
	if svc.Spec.TaskTemplate.ContainerSpec == nil {
		return
	}
	cs := svc.Spec.TaskTemplate.ContainerSpec
	info.Image = cs.Image
	if cs.Env != nil {
		info.Env = append([]string{}, cs.Env...)
	}
	if cs.Mounts != nil {
		info.Mounts = mountsToInfo(cs.Mounts)
	}
}

// extractUpdateConfig extracts update configuration from service
func extractUpdateConfig(svc *swarm.Service) *SwarmUpdateConfigInfo {
	if svc.Spec.UpdateConfig == nil {
		return nil
	}
	uc := svc.Spec.UpdateConfig
	return &SwarmUpdateConfigInfo{
		Parallelism:     uc.Parallelism,
		Delay:           uc.Delay.String(),
		FailureAction:   uc.FailureAction,
		Monitor:         uc.Monitor.String(),
		MaxFailureRatio: float64(uc.MaxFailureRatio),
		Order:           uc.Order,
	}
}

// extractResources extracts resource limits and reservations
func extractResources(svc *swarm.Service) *SwarmResourcesInfo {
	if svc.Spec.TaskTemplate.Resources == nil {
		return nil
	}
	res := svc.Spec.TaskTemplate.Resources
	info := &SwarmResourcesInfo{}
	if res.Limits != nil {
		info.Limits = &SwarmResourceLimitsInfo{
			NanoCPUs:    res.Limits.NanoCPUs,
			MemoryBytes: res.Limits.MemoryBytes,
		}
	}
	if res.Reservations != nil {
		info.Reservations = &SwarmResourceLimitsInfo{
			NanoCPUs:    res.Reservations.NanoCPUs,
			MemoryBytes: res.Reservations.MemoryBytes,
		}
	}
	if info.Limits == nil && info.Reservations == nil {
		return nil
	}
	return info
}

// extractPlacement extracts placement constraints and preferences
func extractPlacement(svc *swarm.Service) *SwarmPlacementInfo {
	if svc.Spec.TaskTemplate.Placement == nil {
		return nil
	}
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
			} else {
				prefs = append(prefs, fmt.Sprintf("%+v", pref))
			}
		}
		out.Preferences = prefs
	}
	if len(out.Constraints) == 0 && len(out.Preferences) == 0 && out.MaxReplicas == 0 {
		return nil
	}
	return out
}

// extractModeAndReplicas extracts service mode and replica count
func extractModeAndReplicas(svc *swarm.Service, runningTasks uint64) (mode string, replicas uint64) {
	if svc.Spec.Mode.Replicated != nil {
		mode = "replicated"
		if svc.Spec.Mode.Replicated.Replicas != nil {
			replicas = *svc.Spec.Mode.Replicated.Replicas
		}
	} else if svc.Spec.Mode.Global != nil {
		mode = "global"
		replicas = runningTasks
	}
	return mode, replicas
}

// extractPorts extracts published port information
func extractPorts(svc *swarm.Service) []SwarmPortInfo {
	if svc.Endpoint.Ports == nil {
		return nil
	}
	ports := make([]SwarmPortInfo, 0, len(svc.Endpoint.Ports))
	for _, port := range svc.Endpoint.Ports {
		ports = append(ports, SwarmPortInfo{
			Protocol:      string(port.Protocol),
			TargetPort:    port.TargetPort,
			PublishedPort: port.PublishedPort,
			PublishMode:   string(port.PublishMode),
		})
	}
	return ports
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

	extractContainerInfo(&svc, &info)
	info.UpdateConfig = extractUpdateConfig(&svc)
	info.Resources = extractResources(&svc)
	info.Placement = extractPlacement(&svc)
	info.Mode, info.Replicas = extractModeAndReplicas(&svc, runningTasks)
	info.Ports = extractPorts(&svc)

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
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, swarm.ServiceInspectOptions{})
	if err != nil {
		return err
	}

	// Only replicated services can be scaled
	if svc.Spec.Mode.Replicated == nil {
		return ErrCannotScaleGlobalService
	}

	// Update the replica count
	svc.Spec.Mode.Replicated.Replicas = &replicas

	_, err = cli.ServiceUpdate(ctx, serviceID, svc.Version, svc.Spec, swarm.ServiceUpdateOptions{})
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
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, swarm.ServiceInspectOptions{})
	if err != nil {
		return err
	}

	if svc.Spec.TaskTemplate.ContainerSpec == nil {
		return ErrNoContainerSpec
	}

	svc.Spec.TaskTemplate.ContainerSpec.Image = image
	svc.Spec.TaskTemplate.ForceUpdate++

	_, err = cli.ServiceUpdate(ctx, serviceID, svc.Version, svc.Spec, swarm.ServiceUpdateOptions{})
	return err
}

// RestartSwarmService forces a rolling restart of a Swarm service
func RestartSwarmService(ctx context.Context, cli *client.Client, serviceID string) error {
	return restartSwarmService(ctx, cli, serviceID)
}

func restartSwarmService(ctx context.Context, cli swarmServicesClient, serviceID string) error {
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, swarm.ServiceInspectOptions{})
	if err != nil {
		return err
	}

	// Increment ForceUpdate to trigger a rolling restart
	svc.Spec.TaskTemplate.ForceUpdate++

	_, err = cli.ServiceUpdate(ctx, serviceID, svc.Version, svc.Spec, swarm.ServiceUpdateOptions{})
	return err
}

// RollbackSwarmService performs a best-effort rollback to the previous service specification.
// This mirrors `docker service rollback` behavior when supported by the Docker API.
func RollbackSwarmService(ctx context.Context, cli *client.Client, serviceID string) error {
	return rollbackSwarmService(ctx, cli, serviceID)
}

func rollbackSwarmService(ctx context.Context, cli swarmServicesClient, serviceID string) error {
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, swarm.ServiceInspectOptions{})
	if err != nil {
		return err
	}

	_, err = cli.ServiceUpdate(ctx, serviceID, svc.Version, svc.Spec, swarm.ServiceUpdateOptions{Rollback: "previous"})
	return err
}
