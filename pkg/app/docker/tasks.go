package docker

import (
	"context"
	"reflect"
	"sync"
	"time"

	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/swarm"
	"github.com/moby/moby/client"
)

type swarmTasksClient interface {
	TaskList(context.Context, client.TaskListOptions) (client.TaskListResult, error)
	TaskInspect(context.Context, string, client.TaskInspectOptions) (client.TaskInspectResult, error)
	ServiceList(context.Context, client.ServiceListOptions) (client.ServiceListResult, error)
	ServiceInspect(context.Context, string, client.ServiceInspectOptions) (client.ServiceInspectResult, error)
	NodeList(context.Context, client.NodeListOptions) (client.NodeListResult, error)
	NodeInspect(context.Context, string, client.NodeInspectOptions) (client.NodeInspectResult, error)
	ContainerInspect(context.Context, string, client.ContainerInspectOptions) (client.ContainerInspectResult, error)
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

	svcResult, err := cli.ServiceList(ctx, client.ServiceListOptions{})
	if err != nil {
		return nil, err
	}

	serviceNames := make(map[string]string)
	for _, svc := range svcResult.Items {
		serviceNames[svc.ID] = svc.Spec.Name
	}

	nodeResult, err := cli.NodeList(ctx, client.NodeListOptions{})
	if err != nil {
		return nil, err
	}

	nodeNames := make(map[string]string)
	for _, n := range nodeResult.Items {
		nodeNames[n.ID] = n.Description.Hostname
	}

	taskResult, err := cli.TaskList(ctx, client.TaskListOptions{})
	if err != nil {
		return nil, err
	}

	result := make([]SwarmTaskInfo, 0, len(taskResult.Items))
	for _, task := range taskResult.Items {
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
	filter := client.Filters{}
	filter["service"] = map[string]bool{serviceID: true}

	taskResult, err := cli.TaskList(ctx, client.TaskListOptions{Filters: filter})
	if err != nil {
		return nil, err
	}
	tasks := taskResult.Items

	// Get the service name
	svcResult, err := cli.ServiceInspect(ctx, serviceID, client.ServiceInspectOptions{})
	serviceName := ""
	if err == nil {
		serviceName = svcResult.Service.Spec.Name
	}
	serviceNames := map[string]string{serviceID: serviceName}

	// Get nodes to map node IDs to hostnames
	nodeResult, err := cli.NodeList(ctx, client.NodeListOptions{})
	nodeNames := make(map[string]string)
	if err == nil {
		for _, node := range nodeResult.Items {
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
	taskResult, err := cli.TaskInspect(ctx, taskID, client.TaskInspectOptions{})
	if err != nil {
		return nil, err
	}
	task := taskResult.Task

	// Get service name
	svcResult, err := cli.ServiceInspect(ctx, task.ServiceID, client.ServiceInspectOptions{})
	serviceName := ""
	if err == nil {
		serviceName = svcResult.Service.Spec.Name
	}
	serviceNames := map[string]string{task.ServiceID: serviceName}

	// Get node name
	nodeNames := make(map[string]string)
	if task.NodeID != "" {
		nodeResult, err := cli.NodeInspect(ctx, task.NodeID, client.NodeInspectOptions{})
		if err == nil {
			nodeNames[task.NodeID] = nodeResult.Node.Description.Hostname
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

	taskResult, err := cli.TaskInspect(ctx, taskID, client.TaskInspectOptions{})
	if err != nil {
		return out, err
	}
	task := taskResult.Task
	if task.Status.ContainerStatus == nil || task.Status.ContainerStatus.ContainerID == "" {
		return out, nil
	}

	ciResult, err := cli.ContainerInspect(ctx, task.Status.ContainerStatus.ContainerID, client.ContainerInspectOptions{})
	if err != nil {
		return out, nil
	}
	ci := ciResult.Container
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
			addrs := make([]string, len(na.Addresses))
			for i, a := range na.Addresses {
				addrs[i] = a.String()
			}
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
	ciResult, err := cli.ContainerInspect(ctx, containerID, client.ContainerInspectOptions{})
	if err != nil {
		return "none"
	}
	if ciResult.Container.State != nil && ciResult.Container.State.Health != nil && ciResult.Container.State.Health.Status != "" {
		return string(ciResult.Container.State.Health.Status)
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
