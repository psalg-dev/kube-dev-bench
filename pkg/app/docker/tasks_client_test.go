package docker

import (
	"context"
	"testing"
	"time"

	"github.com/moby/moby/api/types/swarm"
	"github.com/moby/moby/client"
)

func Test_getSwarmTasks_mapsServiceAndNodeNames(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		TaskListFn: func(context.Context, client.TaskListOptions) (client.TaskListResult, error) {
			return client.TaskListResult{Items: []swarm.Task{
				{
					ID:        "task-1",
					ServiceID: "svc-1",
					NodeID:    "node-1",
					Meta:      swarm.Meta{CreatedAt: time.Unix(1, 0), UpdatedAt: time.Unix(2, 0)},
					Status: swarm.TaskStatus{
						State: swarm.TaskStateRunning,
						ContainerStatus: &swarm.ContainerStatus{
							ContainerID: "cid-1",
						},
					},
					DesiredState: swarm.TaskStateRunning,
				},
			}}, nil
		},
		ContainerInspectFn: func(context.Context, string, client.ContainerInspectOptions) (client.ContainerInspectResult, error) {
			return client.ContainerInspectResult{}, nil
		},
		ServiceListFn: func(context.Context, client.ServiceListOptions) (client.ServiceListResult, error) {
			return client.ServiceListResult{Items: []swarm.Service{
				{ID: "svc-1", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "svcname"}}},
			}}, nil
		},
		NodeListFn: func(context.Context, client.NodeListOptions) (client.NodeListResult, error) {
			return client.NodeListResult{Items: []swarm.Node{
				{ID: "node-1", Description: swarm.NodeDescription{Hostname: "n1"}},
			}}, nil
		},
	}

	items, err := getSwarmTasks(ctx, cli)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(items) != 1 {
		t.Fatalf("expected 1 task, got %d", len(items))
	}
	if items[0].ServiceName != "svcname" {
		t.Fatalf("expected serviceName svcname, got %q", items[0].ServiceName)
	}
	if items[0].NodeName != "n1" {
		t.Fatalf("expected nodeName n1, got %q", items[0].NodeName)
	}
	if items[0].ContainerID != "cid-1" {
		t.Fatalf("expected containerID cid-1, got %q", items[0].ContainerID)
	}
}

func Test_getSwarmTasksByService_addsServiceFilter(t *testing.T) {
	ctx := context.Background()

	var gotFilters client.Filters
	cli := &fakeDockerClient{
		TaskListFn: func(_ context.Context, opts client.TaskListOptions) (client.TaskListResult, error) {
			gotFilters = opts.Filters
			return client.TaskListResult{}, nil
		},
		ServiceInspectFn: func(context.Context, string, client.ServiceInspectOptions) (client.ServiceInspectResult, error) {
			return client.ServiceInspectResult{Service: swarm.Service{Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "svcname"}}}}, nil
		},
		NodeListFn: func(context.Context, client.NodeListOptions) (client.NodeListResult, error) {
			return client.NodeListResult{}, nil
		},
	}

	_, err := getSwarmTasksByService(ctx, cli, "svc-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(gotFilters) == 0 {
		t.Fatalf("expected non-empty filters")
	}
	if !gotFilters["service"]["svc-1"] {
		t.Fatalf("expected service filter to include svc-1, got %v", gotFilters)
	}
}

func Test_getSwarmTask_populatesServiceAndNodeNames(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		TaskInspectFn: func(context.Context, string, client.TaskInspectOptions) (client.TaskInspectResult, error) {
			return client.TaskInspectResult{Task: swarm.Task{ID: "t1", ServiceID: "svc-1", NodeID: "node-1", Meta: swarm.Meta{CreatedAt: time.Unix(1, 0), UpdatedAt: time.Unix(2, 0)}}}, nil
		},
		ServiceInspectFn: func(context.Context, string, client.ServiceInspectOptions) (client.ServiceInspectResult, error) {
			return client.ServiceInspectResult{Service: swarm.Service{Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "svcname"}}}}, nil
		},
		NodeInspectFn: func(context.Context, string, client.NodeInspectOptions) (client.NodeInspectResult, error) {
			return client.NodeInspectResult{Node: swarm.Node{Description: swarm.NodeDescription{Hostname: "nodehost"}}}, nil
		},
	}

	item, err := getSwarmTask(ctx, cli, "t1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if item == nil || item.ServiceName != "svcname" || item.NodeName != "nodehost" {
		t.Fatalf("unexpected item: %+v", item)
	}
}
