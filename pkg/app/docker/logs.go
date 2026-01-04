package docker

import (
	"context"
	"io"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/client"
)

// GetTaskLogs streams logs from a task's container
func GetTaskLogs(ctx context.Context, cli *client.Client, taskID string, tail string, follow bool) (io.ReadCloser, error) {
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
	options := types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     follow,
		Tail:       tail,
		Timestamps: true,
	}

	return cli.ServiceLogs(ctx, serviceID, options)
}
