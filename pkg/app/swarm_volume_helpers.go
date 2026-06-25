package app

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"os"
	"time"

	"github.com/containerd/errdefs"
	"github.com/moby/moby/api/types/container"
	"github.com/moby/moby/api/types/mount"
	"github.com/moby/moby/client"
	"github.com/moby/moby/api/pkg/stdcopy"
)

// defaultSwarmVolumeHelperImage is the default image used for Swarm volume browse helper containers.
const defaultSwarmVolumeHelperImage = "debian:bookworm-slim"

// swarmVolumeHelperImage returns the configured or default helper image (IMP-9).
func swarmVolumeHelperImage() string {
	if img := os.Getenv("KDB_SWARM_HELPER_IMAGE"); img != "" {
		return img
	}
	return defaultSwarmVolumeHelperImage
}

func ensureDockerImage(ctx context.Context, cli *client.Client, image string) error {
	_, err := cli.ImageInspect(ctx, image)
	if err == nil {
		return nil
	}
	if !errdefs.IsNotFound(err) {
		return err
	}
	reader, err := cli.ImagePull(ctx, image, client.ImagePullOptions{})
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
	if _, err := cli.VolumeInspect(ctx, volumeName, client.VolumeInspectOptions{}); err != nil {
		return "", err
	}

	pullCtx, cancel := context.WithTimeout(ctx, 60*time.Second)
	defer cancel()
	if err := ensureDockerImage(pullCtx, cli, swarmVolumeHelperImage()); err != nil {
		return "", fmt.Errorf("ensure helper image: %w", err)
	}

	a.swarmVolumeHelpersMu.Lock()
	defer a.swarmVolumeHelpersMu.Unlock()

	if a.swarmVolumeHelpers == nil {
		a.swarmVolumeHelpers = make(map[string]string)
	}

	if existingID, ok := a.swarmVolumeHelpers[volumeName]; ok && existingID != "" {
		inspect, err := cli.ContainerInspect(ctx, existingID, client.ContainerInspectOptions{})
		if err == nil && inspect.Container.State != nil && inspect.Container.State.Running {
			return existingID, nil
		}
		delete(a.swarmVolumeHelpers, volumeName)
	}

	resp, err := cli.ContainerCreate(ctx, client.ContainerCreateOptions{
		Config: &container.Config{
			Image: swarmVolumeHelperImage(),
			Cmd:   []string{"sh", "-c", "trap : TERM INT; sleep infinity"},
			Tty:   false,
			Env:   []string{"LC_ALL=C"},
		},
		HostConfig: &container.HostConfig{
			Mounts: []mount.Mount{
				{Type: mount.TypeVolume, Source: volumeName, Target: "/mnt", ReadOnly: false},
			},
		},
	})
	if err != nil {
		return "", err
	}

	if _, err := cli.ContainerStart(ctx, resp.ID, client.ContainerStartOptions{}); err != nil {
		_, _ = cli.ContainerRemove(ctx, resp.ID, client.ContainerRemoveOptions{Force: true, RemoveVolumes: true})
		return "", err
	}

	a.swarmVolumeHelpers[volumeName] = resp.ID
	return resp.ID, nil
}

func execInContainer(ctx context.Context, cli *client.Client, containerID string, cmd []string, timeout time.Duration) (stdout string, stderr string, exitCode int, err error) {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	createResp, err := cli.ExecCreate(ctx, containerID, client.ExecCreateOptions{
		AttachStdout: true,
		AttachStderr: true,
		TTY:          false,
		Cmd:          cmd,
	})
	if err != nil {
		return "", "", 0, err
	}

	attach, err := cli.ExecAttach(ctx, createResp.ID, client.ExecAttachOptions{})
	if err != nil {
		return "", "", 0, err
	}
	defer attach.Close()

	var outBuf bytes.Buffer
	var errBuf bytes.Buffer
	_, _ = stdcopy.StdCopy(&outBuf, &errBuf, attach.Reader)

	inspect, err := cli.ExecInspect(ctx, createResp.ID, client.ExecInspectOptions{})
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
		_, _ = cli.ContainerRemove(ctx, id, client.ContainerRemoveOptions{Force: true, RemoveVolumes: false})
	}

	return nil
}
