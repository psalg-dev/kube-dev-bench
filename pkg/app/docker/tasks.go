package docker

import (
	"context"
	"reflect"
	"sync"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmTasksClient interface {
	TaskList(context.Context, swarm.TaskListOptions) ([]swarm.Task, error)
	TaskInspectWithRaw(context.Context, string) (swarm.Task, []byte, error)
	ServiceList(context.Context, swarm.ServiceListOptions) ([]swarm.Service, error)
	ServiceInspectWithRaw(context.Context, string, swarm.ServiceInspectOptions) (swarm.Service, []byte, error)
	NodeList(context.Context, swarm.NodeListOptions) ([]swarm.Node, error)
	NodeInspectWithRaw(context.Context, string) (swarm.Node, []byte, error)
	ContainerInspect(context.Context, string) (container.InspectResponse, error)
}

type cachedHealthStatus struct {
	status    string
	fetchedAt time.Time
}

var swarmTaskHealthCache = struct {
	mu    sync.RWMutex
	items map[string]cachedHealthStatus
}{
	items: map[string]cachedHealthStatus{},
}

const swarmTaskHealthCacheTTL = 5 * time.Second

// GetSwarmTasks returns all Swarm tasks
func GetSwarmTasks(ctx context.Context, cli *client.Client) ([]SwarmTaskInfo, error) {
	return getSwarmTasks(ctx, cli)
}

func getSwarmTasks(ctx context.Context, cli swarmTasksClient) ([]SwarmTaskInfo, error) {
	if cli == nil {
		return nil, nil
	}

	tasks, err := cli.TaskList(ctx, swarm.TaskListOptions{})
	if err != nil {
		return nil, err
	}

	// Get services to map service IDs to names
	services, err := cli.ServiceList(ctx, swarm.ServiceListOptions{})
	serviceNames := make(map[string]string)
	if err == nil {
		for _, svc := range services {
			serviceNames[svc.ID] = svc.Spec.Name
		}
	}

	// Get nodes to map node IDs to hostnames
	nodes, err := cli.NodeList(ctx, swarm.NodeListOptions{})
	nodeNames := make(map[string]string)
	if err == nil {
		for _, node := range nodes {
			nodeNames[node.ID] = node.Description.Hostname
		}
	}

	result := make([]SwarmTaskInfo, 0, len(tasks))
	for _, task := range tasks {
		info := taskToInfo(task, serviceNames, nodeNames)
		populateSwarmTaskHealth(ctx, cli, &info)
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

	tasks, err := cli.TaskList(ctx, swarm.TaskListOptions{Filters: filter})
	if err != nil {
		return nil, err
	}

	// Get the service name
	svc, _, err := cli.ServiceInspectWithRaw(ctx, serviceID, swarm.ServiceInspectOptions{})
	serviceName := ""
	if err == nil {
		serviceName = svc.Spec.Name
	}
	serviceNames := map[string]string{serviceID: serviceName}

	// Get nodes to map node IDs to hostnames
	nodes, err := cli.NodeList(ctx, swarm.NodeListOptions{})
	nodeNames := make(map[string]string)
	if err == nil {
		for _, node := range nodes {
			nodeNames[node.ID] = node.Description.Hostname
		}
	}

	result := make([]SwarmTaskInfo, 0, len(tasks))
	for _, task := range tasks {
		info := taskToInfo(task, serviceNames, nodeNames)
		populateSwarmTaskHealth(ctx, cli, &info)
		result = append(result, info)
	}

	return result, nil
}

// GetSwarmTask returns a specific Swarm task by ID
func GetSwarmTask(ctx context.Context, cli *client.Client, taskID string) (*SwarmTaskInfo, error) {
	return getSwarmTask(ctx, cli, taskID)
}

// GetSwarmTaskHealthLogs returns recent healthcheck log entries for a task.
// This is best-effort: if no healthcheck is configured or health data is unavailable, returns an empty slice.
func GetSwarmTaskHealthLogs(ctx context.Context, cli *client.Client, taskID string) ([]SwarmHealthLogEntry, error) {
	return getSwarmTaskHealthLogs(ctx, cli, taskID)
}

func getSwarmTask(ctx context.Context, cli swarmTasksClient, taskID string) (*SwarmTaskInfo, error) {
	task, _, err := cli.TaskInspectWithRaw(ctx, taskID)
	if err != nil {
		return nil, err
	}

	// Get service name
	svc, _, err := cli.ServiceInspectWithRaw(ctx, task.ServiceID, swarm.ServiceInspectOptions{})
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
	populateSwarmTaskHealth(ctx, cli, &info)
	return &info, nil
}

func getSwarmTaskHealthLogs(ctx context.Context, cli swarmTasksClient, taskID string) (out []SwarmHealthLogEntry, err error) {
	out = []SwarmHealthLogEntry{}
	defer func() {
		// Health logs are best-effort; never let inspect panics crash the app.
		if recover() != nil {
			out = []SwarmHealthLogEntry{}
			err = nil
		}
	}()

	if cli == nil {
		return out, nil
	}
	if v := reflect.ValueOf(cli); v.Kind() == reflect.Ptr && v.IsNil() {
		return out, nil
	}

	task, _, err := cli.TaskInspectWithRaw(ctx, taskID)
	if err != nil {
		return out, err
	}
	if task.Status.ContainerStatus == nil || task.Status.ContainerStatus.ContainerID == "" {
		return out, nil
	}

	ci, err := cli.ContainerInspect(ctx, task.Status.ContainerStatus.ContainerID)
	if err != nil {
		return out, nil
	}
	if ci.State == nil || ci.State.Health == nil {
		return out, nil
	}

	logs := ci.State.Health.Log
	if len(logs) == 0 {
		return out, nil
	}
	// Keep the last 10 entries (most recent last in Docker API).
	start := 0
	if len(logs) > 10 {
		start = len(logs) - 10
	}
	out = make([]SwarmHealthLogEntry, 0, len(logs)-start)
	for _, l := range logs[start:] {
		out = append(out, SwarmHealthLogEntry{
			Start:    l.Start.Format(time.RFC3339),
			End:      l.End.Format(time.RFC3339),
			ExitCode: l.ExitCode,
			Output:   l.Output,
		})
	}
	return out, nil
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
		HealthStatus: "none",
	}

	if task.Spec.ContainerSpec != nil {
		info.Image = task.Spec.ContainerSpec.Image
		if task.Spec.ContainerSpec.Healthcheck != nil {
			info.HealthCheck = healthCheckToInfo(task.Spec.ContainerSpec.Healthcheck)
		}
		if task.Spec.ContainerSpec.Mounts != nil {
			info.Mounts = mountsToInfo(task.Spec.ContainerSpec.Mounts)
		}
	}

	if len(task.NetworksAttachments) > 0 {
		nets := make([]SwarmTaskNetworkInfo, 0, len(task.NetworksAttachments))
		for _, na := range task.NetworksAttachments {
			if na.Network.ID == "" {
				continue
			}
			addrs := append([]string{}, na.Addresses...)
			nets = append(nets, SwarmTaskNetworkInfo{
				NetworkID: na.Network.ID,
				Addresses: addrs,
			})
		}
		if len(nets) > 0 {
			info.Networks = nets
		}
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

func healthCheckToInfo(hc *container.HealthConfig) *SwarmHealthCheckInfo {
	if hc == nil {
		return nil
	}
	// Docker uses time.Duration for interval/timeout/startPeriod; stringify for UI.
	return &SwarmHealthCheckInfo{
		Test:        append([]string{}, hc.Test...),
		Interval:    hc.Interval.String(),
		Timeout:     hc.Timeout.String(),
		Retries:     hc.Retries,
		StartPeriod: hc.StartPeriod.String(),
	}
}

// isSwarmClientValid checks if the swarm client is valid and non-nil
func isSwarmClientValid(cli swarmTasksClient) bool {
	if cli == nil {
		return false
	}
	v := reflect.ValueOf(cli)
	return !(v.Kind() == reflect.Ptr && v.IsNil())
}

// getCachedHealthStatus returns cached health status if valid, otherwise empty string
func getCachedHealthStatus(containerID string) (string, bool) {
	swarmTaskHealthCache.mu.RLock()
	entry, ok := swarmTaskHealthCache.items[containerID]
	swarmTaskHealthCache.mu.RUnlock()
	if ok && time.Since(entry.fetchedAt) <= swarmTaskHealthCacheTTL {
		if entry.status != "" {
			return entry.status, true
		}
		return "none", true
	}
	return "", false
}

// setCachedHealthStatus stores health status in cache
func setCachedHealthStatus(containerID, status string) {
	now := time.Now()
	swarmTaskHealthCache.mu.Lock()
	swarmTaskHealthCache.items[containerID] = cachedHealthStatus{status: status, fetchedAt: now}
	swarmTaskHealthCache.mu.Unlock()
}

// fetchContainerHealthStatus fetches health status from container inspect
func fetchContainerHealthStatus(ctx context.Context, cli swarmTasksClient, containerID string) string {
	ci, err := cli.ContainerInspect(ctx, containerID)
	if err != nil {
		return "none"
	}
	if ci.State != nil && ci.State.Health != nil && ci.State.Health.Status != "" {
		return ci.State.Health.Status
	}
	return "none"
}

func populateSwarmTaskHealth(ctx context.Context, cli swarmTasksClient, info *SwarmTaskInfo) {
	defer func() {
		if recover() != nil && info != nil {
			info.HealthStatus = "none"
		}
	}()

	if info == nil {
		return
	}
	if !isSwarmClientValid(cli) || info.ContainerID == "" {
		info.HealthStatus = "none"
		return
	}

	if cached, ok := getCachedHealthStatus(info.ContainerID); ok {
		info.HealthStatus = cached
		return
	}

	status := fetchContainerHealthStatus(ctx, cli, info.ContainerID)
	info.HealthStatus = status
	setCachedHealthStatus(info.ContainerID, status)
}
