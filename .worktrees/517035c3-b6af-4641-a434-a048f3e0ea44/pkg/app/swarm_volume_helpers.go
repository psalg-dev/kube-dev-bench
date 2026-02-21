package app

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"time"

	"github.com/docker/docker/api/types/container"
	imagetypes "github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

const swarmVolumeHelperImage = "debian:bookworm-slim"

func ensureDockerImage(ctx context.Context, cli *client.Client, image string) error {
	_, _, err := cli.ImageInspectWithRaw(ctx, image)
	if err == nil {
		return nil
	}
	if !client.IsErrNotFound(err) {
		return err
	}
	reader, err := cli.ImagePull(ctx, image, imagetypes.PullOptions{})
	if err != nil {
		return err
	}
	defer reader.Close()
	_, _ = io.Copy(io.Discard, reader)
	return nil
}

func (a *App) ensureSwarmVolumeHelper(volumeName string) (string, error) {
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}
	ctx := a.ctx

	if volumeName == "" {
		return "", fmt.Errorf("volume name required")
	}
	if _, err := cli.VolumeInspect(ctx, volumeName); err != nil {
		return "", err
	}

	pullCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	if err := ensureDockerImage(pullCtx, cli, swarmVolumeHelperImage); err != nil {
		return "", fmt.Errorf("ensure helper image: %w", err)
	}

	a.swarmVolumeHelpersMu.Lock()
	defer a.swarmVolumeHelpersMu.Unlock()

	if a.swarmVolumeHelpers == nil {
		a.swarmVolumeHelpers = make(map[string]string)
	}

	if existingID, ok := a.swarmVolumeHelpers[volumeName]; ok && existingID != "" {
		inspect, err := cli.ContainerInspect(ctx, existingID)
		if err == nil && inspect.State != nil && inspect.State.Running {
			return existingID, nil
		}
		delete(a.swarmVolumeHelpers, volumeName)
	}

	resp, err := cli.ContainerCreate(ctx, &container.Config{
		Image: swarmVolumeHelperImage,
		Cmd:   []string{"sh", "-c", "trap : TERM INT; sleep infinity"},
		Tty:   false,
		Env:   []string{"LC_ALL=C"},
	}, &container.HostConfig{
		Mounts: []mount.Mount{
			{Type: mount.TypeVolume, Source: volumeName, Target: "/mnt", ReadOnly: false},
		},
	}, nil, nil, "")
	if err != nil {
		return "", err
	}

	if err := cli.ContainerStart(ctx, resp.ID, container.StartOptions{}); err != nil {
		_ = cli.ContainerRemove(ctx, resp.ID, container.RemoveOptions{Force: true, RemoveVolumes: true})
		return "", err
	}

	a.swarmVolumeHelpers[volumeName] = resp.ID
	return resp.ID, nil
}

func execInContainer(ctx context.Context, cli *client.Client, containerID string, cmd []string, timeout time.Duration) (stdout string, stderr string, exitCode int, err error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	createResp, err := cli.ContainerExecCreate(ctx, containerID, container.ExecOptions{
		AttachStdout: true,
		AttachStderr: true,
		Tty:          false,
		Cmd:          cmd,
	})
	if err != nil {
		return "", "", 0, err
	}

	attach, err := cli.ContainerExecAttach(ctx, createResp.ID, container.ExecAttachOptions{Tty: false})
	if err != nil {
		return "", "", 0, err
	}
	defer attach.Close()

	var outBuf bytes.Buffer
	var errBuf bytes.Buffer
	_, _ = stdcopy.StdCopy(&outBuf, &errBuf, attach.Reader)

	inspect, err := cli.ContainerExecInspect(ctx, createResp.ID)
	if err != nil {
		return outBuf.String(), errBuf.String(), 0, err
	}

	return outBuf.String(), errBuf.String(), inspect.ExitCode, nil
}

func (a *App) execInSwarmVolumeHelper(volumeName string, cmd []string, timeout time.Duration) (stdout string, stderr string, exitCode int, err error) {
	containerID, err := a.ensureSwarmVolumeHelper(volumeName)
	if err != nil {
		return "", "", 0, err
	}
	cli, err := a.getDockerClient()
	if err != nil {
		return "", "", 0, err
	}
	return execInContainer(a.ctx, cli, containerID, cmd, timeout)
}

func (a *App) cleanupSwarmVolumeHelpers(ctx context.Context) error {
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}

	a.swarmVolumeHelpersMu.Lock()
	ids := make([]string, 0, len(a.swarmVolumeHelpers))
	for _, id := range a.swarmVolumeHelpers {
		if id != "" {
			ids = append(ids, id)
		}
	}
	a.swarmVolumeHelpers = make(map[string]string)
	a.swarmVolumeHelpersMu.Unlock()

	for _, id := range ids {
		_ = cli.ContainerRemove(ctx, id, container.RemoveOptions{Force: true, RemoveVolumes: false})
	}

	return nil
}
