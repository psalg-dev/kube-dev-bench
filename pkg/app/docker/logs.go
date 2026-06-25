package docker

import (
	"context"
	"io"

	"github.com/moby/moby/client"
)

type swarmLogsClient interface {
	TaskInspect(context.Context, string, client.TaskInspectOptions) (client.TaskInspectResult, error)
	ContainerLogs(context.Context, string, client.ContainerLogsOptions) (client.ContainerLogsResult, error)
	ServiceLogs(context.Context, string, client.ServiceLogsOptions) (client.ServiceLogsResult, error)
}

// GetTaskLogs streams logs from a task's container
func GetTaskLogs(ctx context.Context, cli *client.Client, taskID string, tail string, follow bool) (io.ReadCloser, error) {
	return getTaskLogs(ctx, cli, taskID, tail, follow)
}

func getTaskLogs(ctx context.Context, cli swarmLogsClient, taskID string, tail string, follow bool) (io.ReadCloser, error) {
	// Get the task to find its container ID
	taskResult, err := cli.TaskInspect(ctx, taskID, client.TaskInspectOptions{})
	if err != nil {
		return nil, err
	}

	containerID := ""
	if taskResult.Task.Status.ContainerStatus != nil {
		containerID = taskResult.Task.Status.ContainerStatus.ContainerID
	}

	if containerID == "" {
		return nil, ErrNoContainerSpec
	}

	options := client.ContainerLogsOptions{
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
	options := client.ServiceLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     follow,
		Tail:       tail,
		Timestamps: true,
	}

	return cli.ServiceLogs(ctx, serviceID, options)
}
