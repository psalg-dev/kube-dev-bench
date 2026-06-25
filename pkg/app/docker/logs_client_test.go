package docker

import (
	"context"
	"io"
	"testing"

	"github.com/moby/moby/api/types/swarm"
	"github.com/moby/moby/client"
)

type nopCloser struct{ io.Reader }

func (n nopCloser) Close() error { return nil }

func Test_getTaskLogs_callsContainerLogs(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		TaskInspectFn: func(context.Context, string, client.TaskInspectOptions) (client.TaskInspectResult, error) {
			return client.TaskInspectResult{Task: swarm.Task{Status: swarm.TaskStatus{ContainerStatus: &swarm.ContainerStatus{ContainerID: "cid"}}}}, nil
		},
		ContainerLogsFn: func(_ context.Context, containerID string, opts client.ContainerLogsOptions) (client.ContainerLogsResult, error) {
			if containerID != "cid" {
				t.Fatalf("expected cid, got %q", containerID)
			}
			if opts.Tail != "10" || !opts.Timestamps {
				t.Fatalf("unexpected opts: %+v", opts)
			}
			return nopCloser{Reader: &emptyReader{}}, nil
		},
	}

	rc, err := getTaskLogs(ctx, cli, "task-1", "10", false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_ = rc.Close()
}

func Test_getTaskLogs_noContainerReturnsError(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{TaskInspectFn: func(context.Context, string, client.TaskInspectOptions) (client.TaskInspectResult, error) {
		return client.TaskInspectResult{}, nil
	}}

	if _, err := getTaskLogs(ctx, cli, "task-1", "10", false); err == nil {
		t.Fatalf("expected error")
	}
}

func Test_getServiceLogs_callsServiceLogs(t *testing.T) {
	ctx := context.Background()

	called := false
	cli := &fakeDockerClient{ServiceLogsFn: func(_ context.Context, serviceID string, opts client.ServiceLogsOptions) (client.ServiceLogsResult, error) {
		called = true
		if serviceID != "svc-1" {
			t.Fatalf("expected svc-1")
		}
		if opts.Tail != "20" || !opts.Timestamps {
			t.Fatalf("unexpected opts: %+v", opts)
		}
		return nopCloser{Reader: &emptyReader{}}, nil
	}}

	rc, err := getServiceLogs(ctx, cli, "svc-1", "20", true)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	_ = rc.Close()
	if !called {
		t.Fatalf("expected ServiceLogs to be called")
	}
}
