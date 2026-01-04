package docker

import (
	"context"
	"io"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/swarm"
	"github.com/docker/docker/client"
)

type swarmLogsClient interface {
	TaskInspectWithRaw(context.Context, string) (swarm.Task, []byte, error)
	ContainerLogs(context.Context, string, container.LogsOptions) (io.ReadCloser, error)
	ServiceLogs(context.Context, string, types.ContainerLogsOptions) (io.ReadCloser, error)
}

// GetTaskLogs streams logs from a task's container
func GetTaskLogs(ctx context.Context, cli *client.Client, taskID string, tail string, follow bool) (io.ReadCloser, error) {
	return getTaskLogs(ctx, cli, taskID, tail, follow)
}

func getTaskLogs(ctx context.Context, cli swarmLogsClient, taskID string, tail string, follow bool) (io.ReadCloser, error) {
	// Get the task to find its container ID
	task, _, err := cli.TaskInspectWithRaw(ctx, taskID)
	if err != nil {
		return nil, err
	}

	containerID := ""
	if task.Status.ContainerStatus != nil {
		containerID = task.Status.ContainerStatus.ContainerID
	}

	if containerID == "" {
		return nil, ErrNoContainerSpec
	}

	options := container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     follow,
		Tail:       tail,
		Timestamps: true,
	}

	return cli.ContainerLogs(ctx, containerID, options)
}

// GetServiceLogs streams logs from all containers of a service
func GetServiceLogs(ctx context.Context, cli *client.Client, serviceID string, tail string, follow bool) (io.ReadCloser, error) {
	return getServiceLogs(ctx, cli, serviceID, tail, follow)
}

func getServiceLogs(ctx context.Context, cli swarmLogsClient, serviceID string, tail string, follow bool) (io.ReadCloser, error) {
	options := types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     follow,
		Tail:       tail,
		Timestamps: true,
	}

	return cli.ServiceLogs(ctx, serviceID, options)
}
