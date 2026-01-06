package docker

import (
	"context"
	"io"
	"testing"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/swarm"
)

type nopCloser struct{ io.Reader }

func (n nopCloser) Close() error { return nil }

func Test_getTaskLogs_callsContainerLogs(t *testing.T) {
	ctx := context.Background()

	cli := &fakeDockerClient{
		TaskInspectWithRawFn: func(context.Context, string) (swarm.Task, []byte, error) {
			return swarm.Task{Status: swarm.TaskStatus{ContainerStatus: &swarm.ContainerStatus{ContainerID: "cid"}}}, nil, nil
		},
		ContainerLogsFn: func(_ context.Context, containerID string, opts container.LogsOptions) (io.ReadCloser, error) {
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

	cli := &fakeDockerClient{TaskInspectWithRawFn: func(context.Context, string) (swarm.Task, []byte, error) {
		return swarm.Task{}, nil, nil
	}}

	if _, err := getTaskLogs(ctx, cli, "task-1", "10", false); err == nil {
		t.Fatalf("expected error")
	}
}

func Test_getServiceLogs_callsServiceLogs(t *testing.T) {
	ctx := context.Background()

	called := false
	cli := &fakeDockerClient{ServiceLogsFn: func(_ context.Context, serviceID string, opts types.ContainerLogsOptions) (io.ReadCloser, error) {
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
