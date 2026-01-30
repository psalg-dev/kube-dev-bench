package app

import (
	"archive/tar"
	"compress/gzip"
	"context"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/api/types/volume"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

func isGzipPath(p string) bool {
	low := strings.ToLower(p)
	return strings.HasSuffix(low, ".tgz") || strings.HasSuffix(low, ".tar.gz")
}

func normalizeTarStream(r io.Reader) (io.Reader, error) {
	// Strip common prefixes from tar entries so archives can be restored cleanly.
	// - docker.CopyFromContainer(/mnt) produces entries like "mnt/..."
	// - many tars use "./..."
	pr, pw := io.Pipe()

	go func() {
		defer func() {
			_ = pw.Close()
		}()

		tr := tar.NewReader(r)
		tw := tar.NewWriter(pw)
		defer func() {
			_ = tw.Close()
		}()

		for {
			h, err := tr.Next()
			if err == io.EOF {
				return
			}
			if err != nil {
				_ = pw.CloseWithError(err)
				return
			}
			if h == nil {
				continue
			}

			name := h.Name
			name = strings.TrimPrefix(name, "./")
			name = strings.TrimPrefix(name, "mnt/")
			name = strings.TrimPrefix(name, "/")
			if name == "" || name == "." {
				// Skip empty root entries.
				continue
			}

			h.Name = name
			if err := tw.WriteHeader(h); err != nil {
				_ = pw.CloseWithError(err)
				return
			}
			if h.Typeflag == tar.TypeReg || h.Typeflag == tar.TypeRegA {
				if _, err := io.Copy(tw, tr); err != nil {
					_ = pw.CloseWithError(err)
					return
				}
			}
		}
	}()

	return pr, nil
}

// BackupSwarmVolume saves a tar archive of the entire volume to a local file chosen via dialog.
// Returns the chosen path (empty if user cancelled).
func (a *App) BackupSwarmVolume(volumeName string) (string, error) {
	if strings.TrimSpace(volumeName) == "" {
		return "", fmt.Errorf("volume name required")
	}

	containerID, err := a.ensureSwarmVolumeHelper(volumeName)
	if err != nil {
		return "", err
	}
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	destPath, err := a.saveFileDialogWithE2E(runtime.SaveDialogOptions{
		Title:           "Backup Volume",
		DefaultFilename: filepath.Base(volumeName) + ".tar",
		Filters: []runtime.FileFilter{
			{DisplayName: "Tar Archive", Pattern: "*.tar"},
			{DisplayName: "Gzip Tar", Pattern: "*.tar.gz;*.tgz"},
			{DisplayName: "All Files", Pattern: "*"},
		},
	})
	if err != nil {
		return "", err
	}
	if destPath == "" {
		return "", nil
	}

	reader, _, err := cli.CopyFromContainer(a.ctx, containerID, "/mnt")
	if err != nil {
		return "", err
	}
	defer reader.Close()

	norm, _ := normalizeTarStream(reader)

	out, err := os.Create(destPath)
	if err != nil {
		return "", err
	}
	defer out.Close()

	if isGzipPath(destPath) {
		gz := gzip.NewWriter(out)
		if _, err := io.Copy(gz, norm); err != nil {
			_ = gz.Close()
			return "", err
		}
		if err := gz.Close(); err != nil {
			return "", err
		}
	} else {
		if _, err := io.Copy(out, norm); err != nil {
			return "", err
		}
	}

	return destPath, nil
}

// RestoreSwarmVolume restores a tar (or tar.gz/tgz) archive into the volume.
// Returns the chosen archive path (empty if user cancelled).
func (a *App) RestoreSwarmVolume(volumeName string) (string, error) {
	if strings.TrimSpace(volumeName) == "" {
		return "", fmt.Errorf("volume name required")
	}

	archivePath, err := a.openFileDialogWithE2E(runtime.OpenDialogOptions{
		Title: "Select Volume Backup (.tar/.tar.gz/.tgz)",
		Filters: []runtime.FileFilter{
			{DisplayName: "Tar Archive", Pattern: "*.tar"},
			{DisplayName: "Gzip Tar", Pattern: "*.tar.gz;*.tgz"},
			{DisplayName: "All Files", Pattern: "*"},
		},
	})
	if err != nil {
		return "", err
	}
	if archivePath == "" {
		return "", nil
	}

	containerID, err := a.ensureSwarmVolumeHelper(volumeName)
	if err != nil {
		return "", err
	}
	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	f, err := os.Open(archivePath)
	if err != nil {
		return "", err
	}
	defer f.Close()

	var r io.Reader = f
	if isGzipPath(archivePath) {
		gz, err := gzip.NewReader(f)
		if err != nil {
			return "", err
		}
		defer gz.Close()
		r = gz
	}

	norm, _ := normalizeTarStream(r)

	if err := cli.CopyToContainer(a.ctx, containerID, "/mnt", norm, container.CopyToContainerOptions{
		AllowOverwriteDirWithFile: true,
	}); err != nil {
		return "", err
	}

	return archivePath, nil
}

// CloneSwarmVolume creates a new volume and copies all content from source into it.
func (a *App) CloneSwarmVolume(sourceVolumeName string, newVolumeName string) (string, error) {
	sourceVolumeName = strings.TrimSpace(sourceVolumeName)
	newVolumeName = strings.TrimSpace(newVolumeName)
	if sourceVolumeName == "" {
		return "", fmt.Errorf("source volume name required")
	}
	if newVolumeName == "" {
		return "", fmt.Errorf("new volume name required")
	}

	cli, err := a.getDockerClient()
	if err != nil {
		return "", err
	}

	src, err := cli.VolumeInspect(a.ctx, sourceVolumeName)
	if err != nil {
		return "", err
	}

	// Fail if the target exists.
	if _, err := cli.VolumeInspect(a.ctx, newVolumeName); err == nil {
		return "", fmt.Errorf("target volume already exists")
	}

	created, err := cli.VolumeCreate(a.ctx, volume.CreateOptions{
		Name:       newVolumeName,
		Driver:     src.Driver,
		Labels:     src.Labels,
		DriverOpts: src.Options,
	})
	if err != nil {
		return "", err
	}
	_ = created

	// Ensure helper image exists.
	pullCtx, cancel := context.WithTimeout(a.ctx, 60*time.Second)
	defer cancel()
	if err := ensureDockerImage(pullCtx, cli, swarmVolumeHelperImage); err != nil {
		return "", fmt.Errorf("ensure helper image: %w", err)
	}

	resp, err := cli.ContainerCreate(a.ctx, &container.Config{
		Image: swarmVolumeHelperImage,
		Cmd:   []string{"sh", "-c", "set -e; cd /src; tar cf - . | tar xf - -C /dst"},
		Tty:   false,
		Env:   []string{"LC_ALL=C"},
	}, &container.HostConfig{
		AutoRemove: true,
		Mounts: []mount.Mount{
			{Type: mount.TypeVolume, Source: sourceVolumeName, Target: "/src", ReadOnly: true},
			{Type: mount.TypeVolume, Source: newVolumeName, Target: "/dst", ReadOnly: false},
		},
	}, nil, nil, "")
	if err != nil {
		return "", err
	}

	if err := cli.ContainerStart(a.ctx, resp.ID, container.StartOptions{}); err != nil {
		return "", err
	}

	statusCh, errCh := cli.ContainerWait(a.ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case st := <-statusCh:
		if st.StatusCode != 0 {
			logs, _ := cli.ContainerLogs(a.ctx, resp.ID, container.LogsOptions{ShowStdout: true, ShowStderr: true, Tail: "200"})
			if logs != nil {
				defer logs.Close()
				b, _ := io.ReadAll(logs)
				msg := strings.TrimSpace(string(b))
				if msg != "" {
					return "", fmt.Errorf("clone failed: %s", msg)
				}
			}
			return "", fmt.Errorf("clone failed (exit code %d)", st.StatusCode)
		}
	case err := <-errCh:
		if err != nil {
			return "", err
		}
	}

	return newVolumeName, nil
}

// Helper: build a label selector for volume helper containers (unused, but kept for future cleanup).
func helperContainerFilter() filters.Args {
	f := filters.NewArgs()
	f.Add("ancestor", swarmVolumeHelperImage)
	return f
}
