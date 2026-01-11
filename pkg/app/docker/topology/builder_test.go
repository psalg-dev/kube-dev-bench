package topology

import (
	"context"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/swarm"
)

type fakeTopologyClient struct {
	services []swarm.Service
	tasks    []swarm.Task
	nodes    []swarm.Node
}

func (f *fakeTopologyClient) ServiceList(context.Context, types.ServiceListOptions) ([]swarm.Service, error) {
	return f.services, nil
}
func (f *fakeTopologyClient) TaskList(context.Context, types.TaskListOptions) ([]swarm.Task, error) {
	return f.tasks, nil
}
func (f *fakeTopologyClient) NodeList(context.Context, types.NodeListOptions) ([]swarm.Node, error) {
	return f.nodes, nil
}

func TestBuildClusterTopology_BuildsLinksForRunningTasks(t *testing.T) {
	replicas := uint64(2)
	cli := &fakeTopologyClient{
		services: []swarm.Service{{
			ID: "svc1",
			Spec: swarm.ServiceSpec{
				Annotations: swarm.Annotations{Name: "api"},
				Mode:        swarm.ServiceMode{Replicated: &swarm.ReplicatedService{Replicas: &replicas}},
			},
		}},
		nodes: []swarm.Node{{
			ID:          "n1",
			Spec:        swarm.NodeSpec{Role: swarm.NodeRoleWorker},
			Status:      swarm.NodeStatus{State: swarm.NodeStateReady},
			Description: swarm.NodeDescription{Hostname: "worker-1"},
		}, {
			ID:          "n2",
			Spec:        swarm.NodeSpec{Role: swarm.NodeRoleManager},
			Status:      swarm.NodeStatus{State: swarm.NodeStateReady},
			Description: swarm.NodeDescription{Hostname: "mgr-1"},
		}},
		tasks: []swarm.Task{
			{ServiceID: "svc1", NodeID: "n1", Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
			{ServiceID: "svc1", NodeID: "n1", Status: swarm.TaskStatus{State: swarm.TaskStateRunning}},
			{ServiceID: "svc1", NodeID: "n2", Status: swarm.TaskStatus{State: swarm.TaskStateShutdown}},
		},
	}

	topo, err := BuildClusterTopology(context.Background(), cli)
	if err != nil {
		t.Fatalf("BuildClusterTopology returned error: %v", err)
	}
	if topo.Timestamp == "" {
		t.Fatalf("expected timestamp")
	}
	if len(topo.Nodes) != 2 {
		t.Fatalf("expected 2 nodes, got %d", len(topo.Nodes))
	}
	if len(topo.Services) != 1 {
		t.Fatalf("expected 1 service, got %d", len(topo.Services))
	}
	if topo.Services[0].RunningTasks != 2 {
		t.Fatalf("expected runningTasks=2, got %d", topo.Services[0].RunningTasks)
	}
	// Only running tasks produce links.
	if len(topo.Links) != 1 {
		t.Fatalf("expected 1 link, got %d", len(topo.Links))
	}
	if topo.Links[0].From != "svc1" || topo.Links[0].To != "n1" || topo.Links[0].Weight != 2 {
		t.Fatalf("unexpected link: %#v", topo.Links[0])
	}
}
