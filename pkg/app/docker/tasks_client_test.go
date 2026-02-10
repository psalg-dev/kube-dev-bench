package docker

import (
	"context"
	"testing"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/swarm"
)

func Test_getSwarmTasks_mapsServiceAndNodeNames(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		TaskListFn: func(context.Context, swarm.TaskListOptions) ([]swarm.Task, error) {
			return []swarm.Task{
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
			}, nil
		},
		ContainerInspectFn: func(context.Context, string) (container.InspectResponse, error) {
			return container.InspectResponse{}, nil
		},
		ServiceListFn: func(context.Context, swarm.ServiceListOptions) ([]swarm.Service, error) {
			return []swarm.Service{{ID: "svc-1", Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "svcname"}}}}, nil
		},
		NodeListFn: func(context.Context, swarm.NodeListOptions) ([]swarm.Node, error) {
			return []swarm.Node{{ID: "node-1", Description: swarm.NodeDescription{Hostname: "n1"}}}, nil
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

	var gotFilters filters.Args
	cli := &fakeDockerClient{
		TaskListFn: func(_ context.Context, opts swarm.TaskListOptions) ([]swarm.Task, error) {
			gotFilters = opts.Filters
			return []swarm.Task{}, nil
		},
		ServiceInspectWithRawFn: func(context.Context, string, swarm.ServiceInspectOptions) (swarm.Service, []byte, error) {
			return swarm.Service{Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "svcname"}}}, nil, nil
		},
		NodeListFn: func(context.Context, swarm.NodeListOptions) ([]swarm.Node, error) {
			return []swarm.Node{}, nil
		},
	}

	_, err := getSwarmTasksByService(ctx, cli, "svc-1")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotFilters.Len() == 0 {
		t.Fatalf("expected non-empty filters")
	}
	values := gotFilters.Get("service")
	if len(values) != 1 || values[0] != "svc-1" {
		t.Fatalf("expected service filter to include svc-1, got %v", values)
	}
}

func Test_getSwarmTask_populatesServiceAndNodeNames(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		TaskInspectWithRawFn: func(context.Context, string) (swarm.Task, []byte, error) {
			return swarm.Task{ID: "t1", ServiceID: "svc-1", NodeID: "node-1", Meta: swarm.Meta{CreatedAt: time.Unix(1, 0), UpdatedAt: time.Unix(2, 0)}}, nil, nil
		},
		ServiceInspectWithRawFn: func(context.Context, string, swarm.ServiceInspectOptions) (swarm.Service, []byte, error) {
			return swarm.Service{Spec: swarm.ServiceSpec{Annotations: swarm.Annotations{Name: "svcname"}}}, nil, nil
		},
		NodeInspectWithRawFn: func(context.Context, string) (swarm.Node, []byte, error) {
			return swarm.Node{Description: swarm.NodeDescription{Hostname: "nodehost"}}, nil, nil
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
