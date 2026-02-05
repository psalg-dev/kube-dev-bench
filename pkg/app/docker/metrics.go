package docker

import (
	"context"
	"sync"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmMetricsClient interface {
	ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error)
	TaskList(context.Context, types.TaskListOptions) ([]swarm.Task, error)
	NodeList(context.Context, types.NodeListOptions) ([]swarm.Node, error)
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
			mult = int64(*s.Spec.Mode.Replicated.Replicas)
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

	services, err := cli.ServiceList(ctx, types.ServiceListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, err
	}
	tasks, err := cli.TaskList(ctx, types.TaskListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, err
	}
	nodes, err := cli.NodeList(ctx, types.NodeListOptions{})
	if err != nil {
		return SwarmMetricsPoint{}, err
	}

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
