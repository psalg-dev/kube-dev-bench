package docker

import (
	"context"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
)

type fakeSwarmMetricsClient struct {
	services []swarm.Service
	tasks    []swarm.Task
	nodes    []swarm.Node
}

func (f *fakeSwarmMetricsClient) ServiceList(ctx context.Context, opts types.ServiceListOptions) ([]swarm.Service, error) {
	return f.services, nil
}

func (f *fakeSwarmMetricsClient) TaskList(ctx context.Context, opts types.TaskListOptions) ([]swarm.Task, error) {
	return f.tasks, nil
}

func (f *fakeSwarmMetricsClient) NodeList(ctx context.Context, opts types.NodeListOptions) ([]swarm.Node, error) {
	return f.nodes, nil
}

func TestCollectSwarmMetrics_ComputesCountsAndResources(t *testing.T) {
	// Reset global store to keep test deterministic.
	swarmMetricsStore.mu.Lock()
	swarmMetricsStore.points = nil
	swarmMetricsStore.max = 720
	swarmMetricsStore.mu.Unlock()

	replicas := uint64(3)
	cli := &fakeSwarmMetricsClient{
		services: []swarm.Service{
			{
				Spec: swarm.ServiceSpec{
					Mode: swarm.ServiceMode{
						Replicated: &swarm.ReplicatedService{Replicas: &replicas},
					},
					TaskTemplate: swarm.TaskSpec{
						Resources: &swarm.ResourceRequirements{
							Reservations: &swarm.Resources{NanoCPUs: 1_000_000_000, MemoryBytes: 100},
							Limits:       &swarm.Limit{NanoCPUs: 2_000_000_000, MemoryBytes: 200},
						},
					},
				},
			},
			{
				Spec: swarm.ServiceSpec{
					Mode: swarm.ServiceMode{Global: &swarm.GlobalService{}},
					TaskTemplate: swarm.TaskSpec{
						Resources: &swarm.ResourceRequirements{
							Reservations: &swarm.Resources{NanoCPUs: 500_000_000, MemoryBytes: 50},
							Limits:       &swarm.Limit{NanoCPUs: 1_000_000_000, MemoryBytes: 150},
						},
					},
				},
			},
		},
		tasks: []swarm.Task{
			{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
			{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
			{Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
			{Status: swarm.TaskStatus{State: swarm.TaskStateShutdown}},
		},
		nodes: []swarm.Node{
			{
				Status:      swarm.NodeStatus{State: swarm.NodeStateReady},
				Description: swarm.NodeDescription{Resources: swarm.Resources{NanoCPUs: 2_000_000_000, MemoryBytes: 2048}},
			},
			{
				Status:      swarm.NodeStatus{State: swarm.NodeStateDown},
				Description: swarm.NodeDescription{Resources: swarm.Resources{NanoCPUs: 8_000_000_000, MemoryBytes: 8192}},
			},
		},
	}

	p, err := collectSwarmMetrics(context.Background(), cli)
	if err != nil {
		t.Fatalf("collectSwarmMetrics returned error: %v", err)
	}
	if p.Timestamp == "" {
		t.Fatalf("expected Timestamp to be set")
	}
	if p.Services != 2 {
		t.Fatalf("expected Services=2, got %d", p.Services)
	}
	if p.Tasks != 4 {
		t.Fatalf("expected Tasks=4, got %d", p.Tasks)
	}
	if p.RunningTasks != 3 {
		t.Fatalf("expected RunningTasks=3, got %d", p.RunningTasks)
	}
	if p.Nodes != 2 {
		t.Fatalf("expected Nodes=2, got %d", p.Nodes)
	}
	if p.ReadyNodes != 1 {
		t.Fatalf("expected ReadyNodes=1, got %d", p.ReadyNodes)
	}
	if p.CpuCapacityNano != 2_000_000_000 {
		t.Fatalf("expected CpuCapacityNano=2000000000, got %d", p.CpuCapacityNano)
	}
	if p.MemoryCapacityBytes != 2048 {
		t.Fatalf("expected MemoryCapacityBytes=2048, got %d", p.MemoryCapacityBytes)
	}

	// Expected resource totals:
	// - replicated service: mult=3
	//   reservations: cpu 1e9*3, mem 100*3
	//   limits: cpu 2e9*3, mem 200*3
	// - global service: mult=readyNodes=1
	//   reservations: cpu 0.5e9*1, mem 50
	//   limits: cpu 1e9*1, mem 150
	if p.CpuReservationsNano != 3_500_000_000 {
		t.Fatalf("expected CpuReservationsNano=3500000000, got %d", p.CpuReservationsNano)
	}
	if p.MemoryReservationsBytes != 350 {
		t.Fatalf("expected MemoryReservationsBytes=350, got %d", p.MemoryReservationsBytes)
	}
	if p.CpuLimitsNano != 7_000_000_000 {
		t.Fatalf("expected CpuLimitsNano=7000000000, got %d", p.CpuLimitsNano)
	}
	if p.MemoryLimitsBytes != 750 {
		t.Fatalf("expected MemoryLimitsBytes=750, got %d", p.MemoryLimitsBytes)
	}

	h := GetSwarmMetricsHistory()
	if len(h) != 1 {
		t.Fatalf("expected history length 1, got %d", len(h))
	}
}
