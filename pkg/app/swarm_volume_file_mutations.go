package app

import (
	"archive/tar"
	"encoding/base64"
	"fmt"
	"io"
	"path"
	"strings"
	"time"

	"github.com/docker/docker/api/types/container"
)

// WriteSwarmVolumeFile writes content to a file within the volume.
// encoding can be "utf-8" (default) or "base64".
func (a *App) WriteSwarmVolumeFile(volumeName string, filePath string, content string, encoding string) error {
	if volumeName == "" {
		return fmt.Errorf("volume name required")
	}
	clean, err := sanitizePosixPath(filePath)
	if err != nil {
		return err
	}
	if clean == "/" {
		return fmt.Errorf("file path required")
	}

	data := []byte(content)
	if strings.EqualFold(strings.TrimSpace(encoding), "base64") {
		decoded, err := base64.StdEncoding.DecodeString(content)
		if err != nil {
			return fmt.Errorf("invalid base64 content")
		}
		data = decoded
	}

	containerID, err := a.ensureSwarmVolumeHelper(volumeName)
	if err != nil {
		return err
	}
	cli, err := a.getDockerClient()
	if err != nil {
		return err
	}

	dir := path.Dir(clean)
	name := path.Base(clean)
	if dir == "." {
		dir = "/"
	}
	if name == "." || name == "/" || name == "" {
		return fmt.Errorf("invalid file path")
	}

	// Ensure directory exists.
	absDir := "/mnt" + dir
	_, errOut, code, err := a.execInSwarmVolumeHelper(volumeName, []string{"mkdir", "-p", absDir}, 10*time.Second)
	if err != nil {
		return err
	}
	if code != 0 {
		msg := strings.TrimSpace(errOut)
		if msg == "" {
			msg = fmt.Sprintf("mkdir exit code %d", code)
		}
		return fmt.Errorf("%s", msg)
	}

	pr, pw := io.Pipe()
	go func() {
		tw := tar.NewWriter(pw)
		defer func() {
			_ = tw.Close()
			_ = pw.Close()
		}()
		hdr := &tar.Header{
			Name: name,
			Mode: 0o644,
			Size: int64(len(data)),
		}
		if err := tw.WriteHeader(hdr); err != nil {
			_ = pw.CloseWithError(err)
			return
		}
		if _, err := tw.Write(data); err != nil {
			_ = pw.CloseWithError(err)
			return
		}
	}()

	return cli.CopyToContainer(a.ctx, containerID, "/mnt"+dir, pr, container.CopyToContainerOptions{AllowOverwriteDirWithFile: true})
}

// DeleteSwarmVolumeFile deletes a path within the volume.
// If recursive is true, directories can be removed.
func (a *App) DeleteSwarmVolumeFile(volumeName string, filePath string, recursive bool) error {
	if volumeName == "" {
		return fmt.Errorf("volume name required")
	}
	clean, err := sanitizePosixPath(filePath)
	if err != nil {
		return err
	}
	if clean == "/" {
		return fmt.Errorf("refusing to delete volume root")
	}

	absPath := "/mnt" + clean
	args := []string{"rm", "-f", absPath}
	if recursive {
		args = []string{"rm", "-rf", absPath}
	}
	_, errOut, code, err := a.execInSwarmVolumeHelper(volumeName, args, 20*time.Second)
	if err != nil {
		return err
	}
	if code != 0 {
		msg := strings.TrimSpace(errOut)
		if msg == "" {
			msg = fmt.Sprintf("rm exit code %d", code)
		}
		return fmt.Errorf("%s", msg)
	}
	return nil
}

// CreateSwarmVolumeDirectory creates a directory within the volume.
func (a *App) CreateSwarmVolumeDirectory(volumeName string, dirPath string) error {
	if volumeName == "" {
		return fmt.Errorf("volume name required")
	}
	clean, err := sanitizePosixPath(dirPath)
	if err != nil {
		return err
	}
	if clean == "/" {
		return nil
	}

	absPath := "/mnt" + clean
	_, errOut, code, err := a.execInSwarmVolumeHelper(volumeName, []string{"mkdir", "-p", absPath}, 10*time.Second)
	if err != nil {
		return err
	}
	if code != 0 {
		msg := strings.TrimSpace(errOut)
		if msg == "" {
			msg = fmt.Sprintf("mkdir exit code %d", code)
		}
		return fmt.Errorf("%s", msg)
	}
	return nil
}
