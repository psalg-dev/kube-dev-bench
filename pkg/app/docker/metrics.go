package docker

import (
	"context"
	"sync"
	"time"

	"gowails/pkg/app/internal/safeconv"

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

	readyNodes := 0
	var cpuCap int64
	var memCap int64
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

	runningTasks := 0
	for _, t := range tasks {
		if t.Status.State == swarm.TaskStateRunning {
			runningTasks++
		}
	}

	// Resource requirements are per-task. Multiply by replicas where possible.
	var cpuRes int64
	var memRes int64
	var cpuLim int64
	var memLim int64

	for _, s := range services {
		mult := int64(0)
		if s.Spec.Mode.Replicated != nil {
			if s.Spec.Mode.Replicated.Replicas != nil {
				rep, err := safeconv.Uint64ToInt64(*s.Spec.Mode.Replicated.Replicas)
				if err != nil {
					continue
				}
				mult = rep
			}
		} else if s.Spec.Mode.Global != nil {
			mult = int64(readyNodes)
		}
		if mult <= 0 {
			continue
		}

		req := s.Spec.TaskTemplate.Resources
		if req == nil {
			continue
		}

		if req.Reservations != nil {
			cpuRes += req.Reservations.NanoCPUs * mult
			memRes += req.Reservations.MemoryBytes * mult
		}
		if req.Limits != nil {
			cpuLim += req.Limits.NanoCPUs * mult
			memLim += req.Limits.MemoryBytes * mult
		}
	}

	p := SwarmMetricsPoint{
		Timestamp:               time.Now().UTC().Format(time.RFC3339),
		Services:                len(services),
		Tasks:                   len(tasks),
		RunningTasks:            runningTasks,
		Nodes:                   len(nodes),
		ReadyNodes:              readyNodes,
		CpuCapacityNano:         cpuCap,
		MemoryCapacityBytes:     memCap,
		CpuReservationsNano:     cpuRes,
		MemoryReservationsBytes: memRes,
		CpuLimitsNano:           cpuLim,
		MemoryLimitsBytes:       memLim,
	}

	appendSwarmMetricsPoint(p)
	return p, nil
}
