package docker

import (
	"context"
	"sync"
	"time"

	"github.com/moby/moby/api/types/swarm"
	"github.com/moby/moby/client"
)

type swarmMetricsClient interface {
	ServiceList(context.Context, client.ServiceListOptions) (client.ServiceListResult, error)
	TaskList(context.Context, client.TaskListOptions) (client.TaskListResult, error)
	NodeList(context.Context, client.NodeListOptions) (client.NodeListResult, error)
}

var swarmMetricsStore = struct {
	mu     sync.RWMutex
	points []SwarmMetricsPoint
	max    int
}{
	points: make([]SwarmMetricsPoint, 0, 720),
	max:    720, // ~1 hour at 5s
}

func appendSwarmMetricsPoint(p SwarmMetricsPoint) {
	swarmMetricsStore.mu.Lock()
	swarmMetricsStore.points = append(swarmMetricsStore.points, p)
	if swarmMetricsStore.max > 0 && len(swarmMetricsStore.points) > swarmMetricsStore.max {
		over := len(swarmMetricsStore.points) - swarmMetricsStore.max
		swarmMetricsStore.points = append([]SwarmMetricsPoint{}, swarmMetricsStore.points[over:]...)
	}
	swarmMetricsStore.mu.Unlock()
}

func GetSwarmMetricsHistory() []SwarmMetricsPoint {
	swarmMetricsStore.mu.RLock()
	defer swarmMetricsStore.mu.RUnlock()
	out := make([]SwarmMetricsPoint, len(swarmMetricsStore.points))
	copy(out, swarmMetricsStore.points)
	return out
}

func CollectSwarmMetrics(ctx context.Context, cli *client.Client) (SwarmMetricsPoint, error) {
	return collectSwarmMetrics(ctx, cli)
}

// countReadyNodesAndCapacity counts ready nodes and their total resources
func countReadyNodesAndCapacity(nodes []swarm.Node) (int, int64, int64) {
	readyNodes := 0
	var cpuCap, memCap int64
	for _, n := range nodes {
		if n.Status.State == swarm.NodeStateReady {
			readyNodes++
			if n.Description.Resources.NanoCPUs > 0 {
				cpuCap += n.Description.Resources.NanoCPUs
			}
			if n.Description.Resources.MemoryBytes > 0 {
				memCap += n.Description.Resources.MemoryBytes
			}
		}
	}
	return readyNodes, cpuCap, memCap
}

// swarmResourceTotals holds aggregated resource requirements
type swarmResourceTotals struct {
	cpuRes, memRes, cpuLim, memLim int64
}

// calculateServiceResources calculates resource requirements for all services
func calculateServiceResources(services []swarm.Service, readyNodes int) swarmResourceTotals {
	var totals swarmResourceTotals
	for _, s := range services {
		mult := int64(0)
		if s.Spec.Mode.Replicated != nil && s.Spec.Mode.Replicated.Replicas != nil {
			mult = safeInt64FromUint64(*s.Spec.Mode.Replicated.Replicas)
		} else if s.Spec.Mode.Global != nil {
			mult = int64(readyNodes)
		}
		if mult <= 0 || s.Spec.TaskTemplate.Resources == nil {
			continue
		}

		req := s.Spec.TaskTemplate.Resources
		if req.Reservations != nil {
			totals.cpuRes += req.Reservations.NanoCPUs * mult
			totals.memRes += req.Reservations.MemoryBytes * mult
		}
		if req.Limits != nil {
			totals.cpuLim += req.Limits.NanoCPUs * mult
			totals.memLim += req.Limits.MemoryBytes * mult
		}
	}
	return totals
}

func collectSwarmMetrics(ctx context.Context, cli swarmMetricsClient) (SwarmMetricsPoint, error) {
	if ctx == nil {
		ctx = context.Background()
	}

	svcResult, err := cli.ServiceList(ctx, client.ServiceListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, err
	}
	services := svcResult.Items
	taskResult, err := cli.TaskList(ctx, client.TaskListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, err
	}
	tasks := taskResult.Items
	nodeResult, err := cli.NodeList(ctx, client.NodeListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, err
	}
	nodes := nodeResult.Items

	readyNodes, cpuCap, memCap := countReadyNodesAndCapacity(nodes)
	runningTasks := countRunningTasks(tasks)
	resources := calculateServiceResources(services, readyNodes)

	p := SwarmMetricsPoint{
		Timestamp:               time.Now().UTC().Format(time.RFC3339),
		Services:                len(services),
		Tasks:                   len(tasks),
		RunningTasks:            runningTasks,
		Nodes:                   len(nodes),
		ReadyNodes:              readyNodes,
		CpuCapacityNano:         cpuCap,
		MemoryCapacityBytes:     memCap,
		CpuReservationsNano:     resources.cpuRes,
		MemoryReservationsBytes: resources.memRes,
		CpuLimitsNano:           resources.cpuLim,
		MemoryLimitsBytes:       resources.memLim,
	}

	appendSwarmMetricsPoint(p)
	return p, nil
}
